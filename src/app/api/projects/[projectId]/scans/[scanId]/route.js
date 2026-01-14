import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function formatScan(scan, extras = {}) {
  return {
    id: scan.id,
    projectId: scan.projectId,
    status: scan.status === "completed" ? "succeeded" : scan.status,
    // The DB schema doesn't persist a scan trigger/source (manual vs scheduled).
    source: extras.source || "manual",
    startedAt: scan.startedAt ?? scan.createdAt,
    finishedAt: scan.completedAt ?? null,
    driftItemsCreated: scan.driftItemsFound ?? scan.driftItems?.length ?? 0,
    filesScanned: scan.filesScanned ?? extras.filesScanned ?? 0,
    commits: extras.commits ?? [],
    pullRequests: extras.pullRequests ?? [],
    driftItems: scan.driftItems ?? [],
    proposalId: extras.proposalId ?? scan.proposals?.[0]?.id ?? null,
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

export async function GET(request, { params }) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { projectId, scanId } = await params;

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

    // Get scan
    const scan = await prisma.scan.findUnique({
      where: {
        id: scanId,
        projectId: projectId, // Ensure scan belongs to project
      },
      include: {
        driftItems: true,
        proposals: {
          select: { id: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!scan) {
      return NextResponse.json(
        { error: "Scan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      formatScan(scan, {
        commits: [],
        pullRequests: [],
        filesScanned: scan.filesScanned ?? 0,
        proposalId: scan.proposals?.[0]?.id ?? null,
        errorMessage: null,
        source: "manual",
      })
    );
  } catch (error) {
    console.error("Failed to fetch scan:", error);
    return NextResponse.json(
      { error: "Failed to fetch scan", message: error.message },
      { status: 500 }
    );
  }
}
