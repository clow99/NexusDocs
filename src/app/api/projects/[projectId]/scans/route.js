/**
 * Project Scans API Route
 * GET /api/projects/[projectId]/scans - List scans for a project
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function formatScan(scan) {
  return {
    id: scan.id,
    projectId: scan.projectId,
    status: scan.status === "completed" ? "succeeded" : scan.status,
    // The DB schema doesn't persist a scan trigger/source (manual vs scheduled).
    // Treat listed scans as "manual" for now; the manual scan endpoint sets it explicitly.
    source: "manual",
    startedAt: scan.startedAt ?? scan.createdAt,
    finishedAt: scan.completedAt ?? null,
    driftItemsCreated: scan.driftItemsFound ?? 0,
    filesScanned: scan.filesScanned ?? 0,
    commits: [],
    pullRequests: [],
    progress: {
      percent: scan.progressPercent ?? 0,
      phase: scan.progressPhase ?? null,
      message: scan.progressMessage ?? null,
      updatedAt: scan.updatedAt ?? null,
    },
    errorMessage: scan.errorMessage ?? null,
    createdAt: scan.createdAt,
  };
}

export async function GET(request, { params }) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { projectId } = await params;

  try {
    // Verify user owns project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

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

    // Get scans
    const scans = await prisma.scan.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 20, // Limit to last 20 scans
    });

    return NextResponse.json({ scans: scans.map(formatScan) });
  } catch (error) {
    console.error("Failed to fetch scans:", error);
    return NextResponse.json(
      { error: "Failed to fetch scans", message: error.message },
      { status: 500 }
    );
  }
}
