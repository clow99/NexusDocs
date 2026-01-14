/**
 * Project Drift API Route
 * GET /api/projects/[projectId]/drift - List drift items for a project
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
  const resolved = searchParams.get("resolved");

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
    if (resolved !== null && resolved !== undefined) {
      where.resolved = resolved === "true";
    }

    // Get drift items
    const driftItems = await prisma.driftItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ driftItems });
  } catch (error) {
    console.error("Failed to fetch drift items:", error);
    return NextResponse.json(
      { error: "Failed to fetch drift items", message: error.message },
      { status: 500 }
    );
  }
}
