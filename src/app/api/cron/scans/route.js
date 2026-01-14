/**
 * Cron: Run due scans
 * GET/POST /api/cron/scans
 *
 * Intended to be invoked by an external scheduler (e.g. Vercel Cron).
 * Protected by CRON_SECRET (Authorization: Bearer <secret>).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTwoFilesPatch } from "diff";
import { githubRequest, getGitHubToken } from "@/lib/github";
import { fetchRepoFileIfExists, scanRepoAndGenerateDocProposals } from "@/lib/scanner";

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

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

function isDueByFrequency({ now, lastScanAt, scanFrequency }) {
  if (!lastScanAt) return true;
  const last = new Date(lastScanAt);
  const freq = scanFrequency || "daily";
  const ms =
    freq === "hourly"
      ? 60 * 60 * 1000
      : freq === "weekly"
      ? 7 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000; // daily default
  return now.getTime() - last.getTime() >= ms;
}

async function getHeadCommitSha({ owner, repo, branch, token }) {
  try {
    const head = await githubRequest(
      `/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`,
      { token }
    );
    return head?.sha || null;
  } catch {
    return null;
  }
}

async function hasActiveScan(projectId) {
  const active = await prisma.scan.findFirst({
    where: {
      projectId,
      status: { in: ["pending", "running"] },
    },
    select: { id: true },
  });
  return Boolean(active?.id);
}

async function runScanForProject({ project, settings, token, headCommitSha }) {
  const now = new Date();
  let completedAt = new Date();
  if (completedAt <= now) completedAt = new Date(now.getTime() + 1000);

  const branch = settings?.targetBranch || "main";

  // Create scan record first (lets UI show it immediately)
  const scan = await prisma.scan.create({
    data: {
      projectId: project.id,
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

  try {
    const updateProgress = createScanProgressUpdater(scan.id);
    await updateProgress({ phase: "init", percent: 1, message: "Starting scan" });

    const scanResult = await scanRepoAndGenerateDocProposals({
      gitProvider: "github",
      owner: project.repoOwner,
      repo: project.repoName,
      ref: branch,
      projectSettings: settings,
      token,
      onProgress: updateProgress,
    });

    await updateProgress({ phase: "proposal", percent: 88, message: "Preparing proposal diffs" });

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

    await updateProgress({ phase: "db", percent: 95, message: "Saving proposal" });

    const summaryParts = scanResult.enabledTargets.map((t) => t.type).slice(0, 4);
    const proposal = await prisma.proposal.create({
      data: {
        projectId: project.id,
        scanId: scan.id,
        status: settings?.autoApprove ? "approved" : "pending",
        summary:
          summaryParts.length > 0
            ? `Generate ${summaryParts.join(", ")} docs`
            : "Generate documentation updates",
        modelLabel: process.env.OPENAI_API_KEY ? "OpenAI (app key)" : "Built-in generator",
        generationMetadata: scanResult.generationMetadata,
        ...(settings?.autoApprove ? { approvedAt: new Date() } : {}),
        files: { create: proposalFiles },
      },
    });

    const pendingCount = await prisma.proposal.count({
      where: { projectId: project.id, status: "pending" },
    });

    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        status: "completed",
        completedAt,
        filesScanned: scanResult.filesScanned,
        driftItemsFound: 0,
        progressPercent: 100,
        progressPhase: "done",
        progressMessage: "Completed",
        errorMessage: null,
      },
    });

    await prisma.project.update({
      where: { id: project.id },
      data: {
        lastScanAt: completedAt,
        proposalsPendingCount: pendingCount,
      },
    });

    return { ok: true, scanId: scan.id, proposalId: proposal.id };
  } catch (error) {
    const message =
      error?.message ||
      "Scan failed. Make sure the repository is accessible and your GitHub connection is valid.";

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
      where: { id: project.id },
      data: { lastScanAt: completedAt },
    });

    return { ok: false, scanId: scan.id, errorMessage: message };
  }
}

async function handleCron(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const projects = await prisma.project.findMany({
    where: { enabled: true },
    include: { settings: true },
    orderBy: { updatedAt: "desc" },
  });

  const results = [];

  for (const project of projects) {
    const settings = project.settings;
    const scanFrequency = settings?.scanFrequency || "daily";
    const branch = settings?.targetBranch || "main";

    // Skip if a scan is already running for this project
    if (await hasActiveScan(project.id)) {
      results.push({ projectId: project.id, skipped: true, reason: "active_scan" });
      continue;
    }

    const token = await getGitHubToken({ userId: project.userId });
    if (!token) {
      results.push({ projectId: project.id, skipped: true, reason: "no_github_token" });
      continue;
    }

    const headCommitSha = await getHeadCommitSha({
      owner: project.repoOwner,
      repo: project.repoName,
      branch,
      token,
    });

    const shouldScan = isDueByFrequency({ now, lastScanAt: project.lastScanAt, scanFrequency });

    if (!shouldScan) {
      results.push({ projectId: project.id, skipped: true, reason: "not_due" });
      continue;
    }

    const runResult = await runScanForProject({
      project,
      settings,
      token,
      headCommitSha,
    });

    results.push({ projectId: project.id, ...runResult });
  }

  const summary = results.reduce(
    (acc, r) => {
      if (r?.ok) acc.ran += 1;
      else if (r?.skipped) acc.skipped += 1;
      else acc.failed += 1;
      return acc;
    },
    { ran: 0, skipped: 0, failed: 0 }
  );

  return NextResponse.json({
    at: now.toISOString(),
    ...summary,
    results,
  });
}

export async function GET(request) {
  return handleCron(request);
}

export async function POST(request) {
  return handleCron(request);
}

