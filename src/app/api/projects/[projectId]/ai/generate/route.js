/**
 * AI Generate API Route (doc generation)
 * POST /api/projects/[projectId]/ai/generate
 *
 * Even when OpenAI isn't configured, this will generate documentation proposals
 * using the built-in generator based on the repo scan + selected doc targets.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createTwoFilesPatch } from "diff";
import { scanRepoAndGenerateDocProposals, fetchRepoFileIfExists } from "@/lib/scanner";
import { getGitHubToken } from "@/lib/github";
import { rateLimit } from "@/lib/rate-limit";

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

export async function POST(request, { params }) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit({
    key: `ai_generate:${session.user.id}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limited", message: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 1_000_000) {
    return NextResponse.json(
      { error: "Payload too large" },
      { status: 413 }
    );
  }

  const { projectId } = await params;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { settings: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const constraints = Array.isArray(body?.constraints) ? body.constraints : [];

    const branch = project.settings?.targetBranch || "main";
    const gitProvider = project.gitProvider || "github";

    const token =
      gitProvider === "github" ? await getGitHubToken({ userId: session.user.id }) : null;
    if (gitProvider === "github" && !token) {
      return NextResponse.json(
        { error: "GitHub not connected. Connect GitHub before generating proposals." },
        { status: 401 }
      );
    }

    const scanResult = await scanRepoAndGenerateDocProposals({
      gitProvider,
      owner: project.repoOwner,
      repo: project.repoName,
      ref: branch,
      projectSettings: project.settings,
      constraints,
      ...(token ? { token } : {}),
    });

    if (!scanResult.enabledTargets || scanResult.enabledTargets.length === 0) {
      return NextResponse.json(
        {
          error: "No documents selected",
          message: "Select at least one document in Settings → Documents, then try again.",
        },
        { status: 400 }
      );
    }

    const proposalFiles = [];
    for (const item of scanResult.proposals) {
      const existing = await fetchRepoFileIfExists({
        gitProvider,
        owner: project.repoOwner,
        repo: project.repoName,
        path: item.outputPath,
        ref: branch,
        ...(token ? { token } : {}),
      });

      const before = existing.exists ? existing.content ?? "" : "";
      const after = item.markdown ?? "";
      const operation = existing.exists ? "update" : "create";
      const diff = createTwoFilesPatch(item.outputPath, item.outputPath, before, after);

      proposalFiles.push({
        filePath: item.outputPath,
        operation,
        originalContent: existing.exists ? before : null,
        proposedContent: after,
        unifiedDiff: diff,
      });
    }

    const summaryParts = scanResult.proposals
      .slice(0, 3)
      .map((p) => `${p.target?.type || "Doc"} (${p.outputPath})`);
    const summary =
      summaryParts.length > 0
        ? `Docs: ${summaryParts.join(", ")}${scanResult.proposals.length > 3 ? ", …" : ""}`
        : "Generate documentation updates";
    const proposal = await prisma.proposal.create({
      data: {
        projectId,
        status: project.settings?.autoApprove ? "approved" : "pending",
        summary,
        modelLabel: scanResult.modelLabel || (process.env.OPENAI_API_KEY ? "OpenAI (app key)" : "Built-in generator"),
        generationMetadata: {
          ...(scanResult.generationMetadata || {}),
          constraints,
          generatedAt: new Date().toISOString(),
        },
        ...(project.settings?.autoApprove ? { approvedAt: new Date() } : {}),
        ...(proposalFiles.length ? { files: { create: proposalFiles } } : {}),
      },
      include: { files: true },
    });

    const pendingCount = await prisma.proposal.count({
      where: { projectId, status: "pending" },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: { proposalsPendingCount: pendingCount },
    });

    return NextResponse.json({ proposals: [formatProposal(proposal)] });
  } catch (error) {
    console.error("Failed to generate proposals:", error);
    return NextResponse.json(
      { error: "Failed to generate proposals" },
      { status: 500 }
    );
  }
}

