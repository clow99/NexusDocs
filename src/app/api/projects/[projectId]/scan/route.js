/**
 * Run Scan API Route
 * POST /api/projects/[projectId]/scan - Start a new scan
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createTwoFilesPatch } from "diff";
import { scanRepoAndGenerateDocProposals, fetchRepoFileIfExists } from "@/lib/scanner";
import { githubRequest, getGitHubToken } from "@/lib/github";
import { rateLimit } from "@/lib/rate-limit";

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function createScanProgressUpdater(scanId) {
  let lastWriteAt = 0;
  let last = { percent: null, phase: null, message: null };

  return async function updateProgress(progress) {
    if (!progress) return;
    const percent = clampPercent(progress.percent);
    const phase = progress.phase ? String(progress.phase) : null;
    const message = progress.message ? String(progress.message) : null;

    const now = Date.now();
    const changed =
      percent !== last.percent || phase !== last.phase || message !== last.message;
    const throttleOk = now - lastWriteAt >= 600;
    if (!changed || !throttleOk) return;

    lastWriteAt = now;
    last = { percent, phase, message };

    await prisma.scan.update({
      where: { id: scanId },
      data: {
        progressPercent: percent,
        progressPhase: phase,
        progressMessage: message,
      },
    });
  };
}

// Normalize scan shape for the frontend expectations
function formatScan(scan, extras = {}) {
  return {
    id: scan.id,
    projectId: scan.projectId,
    status: scan.status === "completed" ? "succeeded" : scan.status,
    source: extras.source || "manual",
    startedAt: scan.startedAt ?? scan.createdAt,
    finishedAt: scan.completedAt ?? null,
    driftItemsCreated: scan.driftItemsFound ?? extras.driftItemsCreated ?? 0,
    filesScanned: scan.filesScanned ?? extras.filesScanned ?? 0,
    commits: extras.commits ?? [],
    pullRequests: extras.pullRequests ?? [],
    proposalId: extras.proposalId ?? null,
    progress: {
      percent: scan.progressPercent ?? 0,
      phase: scan.progressPhase ?? null,
      message: scan.progressMessage ?? null,
      updatedAt: scan.updatedAt ?? null,
    },
    errorMessage: scan.errorMessage ?? extras.errorMessage ?? null,
    createdAt: scan.createdAt,
  };
}

async function fetchProjectWithSettings(projectId) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: { settings: true },
  });
}

export async function POST(request, { params }) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const rl = rateLimit({
    key: `scan:${session.user.id}`,
    limit: 3,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limited", message: "Too many scans started. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const { projectId } = await params;

  const now = new Date();

  try {
    // Verify user owns project
    const project = await fetchProjectWithSettings(projectId);

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const branch = project.settings?.targetBranch || "main";

    const token = await getGitHubToken({ userId: session.user.id });
    if (!token) {
      return NextResponse.json(
        { error: "GitHub not connected. Connect GitHub before running scans." },
        { status: 401 }
      );
    }

    // Capture the current head commit SHA so we can track what was scanned.
    let headCommitSha = null;
    try {
      const head = await githubRequest(
        `/repos/${project.repoOwner}/${project.repoName}/commits/${encodeURIComponent(branch)}`,
        { token }
      );
      headCommitSha = head?.sha || null;
    } catch {
      headCommitSha = null;
    }

    // Create scan record first so the UI can see it immediately.
    const scan = await prisma.scan.create({
      data: {
        projectId,
        status: "running",
        startedAt: now,
        commitSha: headCommitSha,
        baseCommitSha: null,
        filesScanned: 0,
        driftItemsFound: 0,
        progressPercent: 0,
        progressPhase: "init",
        progressMessage: "Starting scan",
      },
    });

    let completedAt = new Date();
    if (completedAt <= now) completedAt = new Date(now.getTime() + 1000);

    try {
      const updateProgress = createScanProgressUpdater(scan.id);
      await updateProgress({ phase: "init", percent: 1, message: "Starting scan" });

      const scanResult = await scanRepoAndGenerateDocProposals({
        gitProvider: "github",
        owner: project.repoOwner,
        repo: project.repoName,
        ref: branch,
        projectSettings: project.settings,
        token,
        onProgress: updateProgress,
      });

      if (!scanResult.enabledTargets || scanResult.enabledTargets.length === 0) {
        throw new Error("No documents selected. Select at least one document in Settings → Documents.");
      }

      await updateProgress({ phase: "proposal", percent: 88, message: "Preparing proposal diffs" });

      // Build proposal file changes (create/update docs files)
      // Only include files where content actually differs
      const proposalFiles = [];
      for (const item of scanResult.proposals) {
        const existing = await fetchRepoFileIfExists({
          gitProvider: "github",
          owner: project.repoOwner,
          repo: project.repoName,
          path: item.outputPath,
          ref: branch,
          token,
        });

        const before = existing.exists ? existing.content ?? "" : "";
        const after = item.markdown ?? "";
        
        // Only add to proposal if content differs
        if (before !== after) {
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
      }

      await updateProgress({ phase: "db", percent: 95, message: proposalFiles.length > 0 ? "Saving proposal" : "No changes detected" });

      // Only create proposal if there are actual file changes
      let proposal = null;
      if (proposalFiles.length > 0) {
        const proposalSummaryParts = scanResult.enabledTargets.map((t) => t.type).slice(0, 4);
        proposal = await prisma.proposal.create({
          data: {
            projectId,
            scanId: scan.id,
            status: project.settings?.autoApprove ? "approved" : "pending",
            summary:
              proposalSummaryParts.length > 0
                ? `Generate ${proposalSummaryParts.join(", ")} docs`
                : "Generate documentation updates",
            modelLabel: process.env.OPENAI_API_KEY ? "OpenAI (app key)" : "Built-in generator",
            generationMetadata: scanResult.generationMetadata,
            ...(project.settings?.autoApprove ? { approvedAt: new Date() } : {}),
            files: { create: proposalFiles },
          },
          include: { files: true },
        });
      }

      // Update scan + project stats
      const pendingCount = await prisma.proposal.count({
        where: { projectId, status: "pending" },
      });

      const finalMessage = proposalFiles.length > 0 
        ? "Completed" 
        : "Completed - No documentation changes detected";

      await prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: "completed",
          completedAt,
          filesScanned: scanResult.filesScanned,
          driftItemsFound: 0,
          progressPercent: 100,
          progressPhase: "done",
          progressMessage: finalMessage,
          errorMessage: null,
        },
      });

      await prisma.project.update({
        where: { id: projectId },
        data: {
          lastScanAt: completedAt,
          proposalsPendingCount: pendingCount,
        },
      });

      return NextResponse.json(
        formatScan(
          {
            ...scan,
            status: "completed",
            completedAt,
            filesScanned: scanResult.filesScanned,
            driftItemsFound: 0,
            progressPercent: 100,
            progressPhase: "done",
            progressMessage: finalMessage,
            errorMessage: null,
          },
          {
            filesScanned: scanResult.filesScanned,
            commits: [],
            pullRequests: [],
            proposalId: proposal?.id ?? null,
            source: "manual",
          }
        )
      );
    } catch (error) {
      console.error("Scan failed:", error);
      const message =
        error?.message ||
        "Scan failed. Make sure the repository is accessible and your git connection is valid.";
      const statusCode = String(message).toLowerCase().includes("no documents selected") ? 400 : 500;

      await prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: "failed",
          completedAt,
          progressPhase: "failed",
          progressMessage: message,
          errorMessage: message,
        },
      });

      await prisma.project.update({
        where: { id: projectId },
        data: { lastScanAt: completedAt },
      });

      return NextResponse.json(
        {
          ...formatScan(
          {
            ...scan,
            status: "failed",
            completedAt,
            progressPhase: "failed",
            progressMessage: message,
            errorMessage: message,
          },
          { filesScanned: 0, errorMessage: message, source: "manual" }
          ),
          message,
        },
        { status: statusCode }
      );
    }
  } catch (error) {
    console.error("Failed to start scan:", error);
    return NextResponse.json(
      { error: "Failed to start scan", message: error.message },
      { status: 500 }
    );
  }
}
