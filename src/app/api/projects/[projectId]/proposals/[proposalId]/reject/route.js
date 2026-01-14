/**
 * Reject Proposal API Route
 * POST /api/projects/[projectId]/proposals/[proposalId]/reject
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

export async function POST(request, { params }) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, proposalId } = await params;

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
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

    if (proposal.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending proposals can be rejected" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const reason = String(body?.reason || "").trim() || "No reason provided";

    const updated = await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: "rejected", rejectionReason: reason, rejectedAt: new Date() },
      include: { files: true },
    });

    const pendingCount = await prisma.proposal.count({
      where: { projectId, status: "pending" },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: { proposalsPendingCount: pendingCount },
    });

    return NextResponse.json(formatProposal(updated));
  } catch (error) {
    console.error("Failed to reject proposal:", error);
    return NextResponse.json(
      { error: "Failed to reject proposal", message: error.message },
      { status: 500 }
    );
  }
}

