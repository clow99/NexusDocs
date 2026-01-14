/**
 * Publish Proposal API Route
 * POST /api/projects/[projectId]/proposals/[proposalId]/publish
 *
 * Publishes an approved proposal by creating a GitHub PR with the proposed doc changes.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { githubRequest, getGitHubToken } from "@/lib/github";

function getGitRequest(gitProvider, token) {
  if (gitProvider && gitProvider !== "github") {
    throw new Error(`Unsupported git provider: ${gitProvider}`);
  }
  return (endpoint, options = {}) =>
    githubRequest(endpoint, {
      ...options,
      ...(token ? { token } : {}),
    });
}

function toPosixPath(p) {
  return String(p || "").replaceAll("\\", "/").replace(/^\/+/, "");
}

function encodeGitHubPath(path) {
  return toPosixPath(path)
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

function formatProposalFile(file) {
  return {
    id: file.id,
    path: file.filePath,
    before: file.originalContent ?? "",
    after: file.proposedContent ?? "",
    diff: file.unifiedDiff ?? "",
    operation: file.operation,
    createdAt: file.createdAt,
  };
}

function formatProposal(proposal) {
  return {
    id: proposal.id,
    projectId: proposal.projectId,
    scanId: proposal.scanId,
    status: proposal.status,
    summary: proposal.summary,
    modelLabel: proposal.modelLabel,
    generationMetadata: proposal.generationMetadata ?? null,
    rejectionReason: proposal.rejectionReason ?? null,
    approvedAt: proposal.approvedAt ?? null,
    rejectedAt: proposal.rejectedAt ?? null,
    publishedAt: proposal.publishedAt ?? null,
    publishResult: proposal.publishResult ?? null,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    files: Array.isArray(proposal.files) ? proposal.files.map(formatProposalFile) : [],
  };
}

async function getRefSha({ gitProvider, token, owner, repo, branch }) {
  const request = getGitRequest(gitProvider, token);
  const data = await request(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  return data?.object?.sha;
}

async function createBranch({ gitProvider, token, owner, repo, branchName, baseSha }) {
  const request = getGitRequest(gitProvider, token);
  return request(`/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    }),
    headers: { "Content-Type": "application/json" },
  });
}

async function getContentShaIfExists({ gitProvider, token, owner, repo, path, ref }) {
  const request = getGitRequest(gitProvider, token);
  try {
    const encodedPath = encodeGitHubPath(path);
    const data = await request(
      `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`
    );
    return data?.sha || null;
  } catch (err) {
    const msg = String(err?.message || "").toLowerCase();
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function upsertFileContent({ gitProvider, token, owner, repo, path, branch, content, sha, message }) {
  const request = getGitRequest(gitProvider, token);
  const encodedPath = encodeGitHubPath(path);
  const payload = {
    message,
    content: Buffer.from(String(content || ""), "utf8").toString("base64"),
    branch,
    ...(sha ? { sha } : {}),
  };

  const method = "PUT";
  return request(`/repos/${owner}/${repo}/contents/${encodedPath}`, {
    method,
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
}

function renderTemplate(template, vars) {
  if (!template) return null;
  return String(template)
    .replaceAll("{{project}}", vars.project)
    .replaceAll("{{repo}}", vars.repo)
    .replaceAll("{{branch}}", vars.branch)
    .replaceAll("{{proposalId}}", vars.proposalId);
}

export async function POST(request, { params }) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, proposalId } = await params;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { settings: true },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { files: true },
    });
    if (!proposal || proposal.projectId !== projectId) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    if (proposal.status !== "approved") {
      return NextResponse.json(
        { error: "Only approved proposals can be published" },
        { status: 400 }
      );
    }

    const gitProvider = project.gitProvider || "github";
    if (gitProvider !== "github") {
      return NextResponse.json(
        { error: "Only GitHub projects can be published (Gitea support was removed)." },
        { status: 400 }
      );
    }

    const token = await getGitHubToken({ userId: session.user.id });
    if (!token) {
      return NextResponse.json(
        { error: "GitHub not connected. Connect GitHub before publishing proposals." },
        { status: 401 }
      );
    }
    const baseBranch = project.settings?.targetBranch || "main";
    const baseSha = await getRefSha({
      gitProvider,
      token,
      owner: project.repoOwner,
      repo: project.repoName,
      branch: baseBranch,
    });
    if (!baseSha) {
      return NextResponse.json(
        { error: "Unable to resolve base branch SHA" },
        { status: 500 }
      );
    }

    const shortId = String(proposalId).slice(0, 8);
    let newBranch = `nexusdocs/proposal-${shortId}`;
    try {
      await createBranch({
        gitProvider,
        token,
        owner: project.repoOwner,
        repo: project.repoName,
        branchName: newBranch,
        baseSha,
      });
    } catch (err) {
      // If branch already exists, add a timestamp suffix.
      const msg = String(err?.message || "").toLowerCase();
      if (msg.includes("reference already exists") || msg.includes("already exists")) {
        newBranch = `nexusdocs/proposal-${shortId}-${Date.now()}`;
        await createBranch({
          gitProvider,
          token,
          owner: project.repoOwner,
          repo: project.repoName,
          branchName: newBranch,
          baseSha,
        });
      } else {
        throw err;
      }
    }

    // Apply file changes
    for (const f of proposal.files || []) {
      if (!f?.filePath) continue;
      if (f.operation === "delete") {
        // Not used by current generator; ignore for now.
        continue;
      }

      const sha = await getContentShaIfExists({
        gitProvider,
        token,
        owner: project.repoOwner,
        repo: project.repoName,
        path: f.filePath,
        ref: newBranch,
      });

      await upsertFileContent({
        gitProvider,
        token,
        owner: project.repoOwner,
        repo: project.repoName,
        path: f.filePath,
        branch: newBranch,
        content: f.proposedContent ?? "",
        sha,
        message: `NexusDocs: update ${toPosixPath(f.filePath)}`,
      });
    }

    const templateVars = {
      project: project.name,
      repo: `${project.repoOwner}/${project.repoName}`,
      branch: baseBranch,
      proposalId,
    };

    const prTitle =
      renderTemplate(project.settings?.prTitleTemplate, templateVars) ||
      `NexusDocs: ${proposal.summary}`;
    const prBody =
      renderTemplate(project.settings?.prBodyTemplate, templateVars) ||
      `Generated documentation updates from NexusDocs.\n\nProposal: ${proposalId}\n`;

    const requestFn = getGitRequest(gitProvider, token);
    const pr = await requestFn(`/repos/${project.repoOwner}/${project.repoName}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title: prTitle,
        head: newBranch,
        base: baseBranch,
        body: prBody,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const publishResult = {
      prUrl: pr?.html_url || pr?.url || null,
      prNumber: pr?.number || pr?.index || null,
      publishedAt: new Date().toISOString(),
      branch: newBranch,
      base: baseBranch,
    };

    const updated = await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: "published",
        publishedAt: new Date(),
        publishResult,
      },
      include: { files: true },
    });

    // Pending proposals count can change elsewhere; recompute for correctness.
    const pendingCount = await prisma.proposal.count({
      where: { projectId, status: "pending" },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: { proposalsPendingCount: pendingCount },
    });

    return NextResponse.json(formatProposal(updated));
  } catch (error) {
    console.error("Failed to publish proposal:", error);
    return NextResponse.json(
      { error: "Failed to publish proposal", message: error.message },
      { status: 500 }
    );
  }
}

