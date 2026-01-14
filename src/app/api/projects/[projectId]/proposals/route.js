/**
 * Project Proposals API Route
 * GET /api/projects/[projectId]/proposals - List proposals for a project
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

export async function GET(request, { params }) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { projectId } = await params;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

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

    // Build where clause
    const where = { projectId };
    if (status) {
      where.status = status;
    }

    // Get proposals
    const proposals = await prisma.proposal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        files: true, // Include related files
      },
    });

    return NextResponse.json({ proposals: proposals.map(formatProposal) });
  } catch (error) {
    console.error("Failed to fetch proposals:", error);
    return NextResponse.json(
      { error: "Failed to fetch proposals", message: error.message },
      { status: 500 }
    );
  }
}
