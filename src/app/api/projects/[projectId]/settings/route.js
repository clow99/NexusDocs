/**
 * Project Settings API Routes
 * GET /api/projects/[projectId]/settings - Get project settings
 * PUT /api/projects/[projectId]/settings - Update project settings
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/projects/[projectId]/settings
 * Get project settings
 */
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
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        settings: true,
      },
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

    return NextResponse.json(project.settings);
  } catch (error) {
    console.error("Failed to fetch project settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch project settings", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[projectId]/settings
 * Update project settings
 */
export async function PUT(request, { params }) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { projectId } = await params;

  try {
    // Verify user owns this project
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

    const body = await request.json();
    const {
      scanFrequency,
      targetBranch,
      docsPaths,
      codePaths,
      fileAllowlist,
      aiModel,
      autoApprove,
      prTitleTemplate,
      prBodyTemplate,
    } = body;

    const settings = await prisma.projectSettings.upsert({
      where: { projectId },
      update: {
        ...(scanFrequency !== undefined && { scanFrequency }),
        ...(targetBranch !== undefined && { targetBranch }),
        ...(docsPaths !== undefined && { docsPaths }),
        ...(codePaths !== undefined && { codePaths }),
        ...(fileAllowlist !== undefined && { fileAllowlist }),
        ...(aiModel !== undefined && { aiModel }),
        ...(autoApprove !== undefined && { autoApprove }),
        ...(prTitleTemplate !== undefined && { prTitleTemplate }),
        ...(prBodyTemplate !== undefined && { prBodyTemplate }),
      },
      create: {
        projectId,
        ...(scanFrequency !== undefined && { scanFrequency }),
        ...(targetBranch !== undefined && { targetBranch }),
        ...(docsPaths !== undefined && { docsPaths }),
        ...(codePaths !== undefined && { codePaths }),
        ...(fileAllowlist !== undefined && { fileAllowlist }),
        ...(aiModel !== undefined && { aiModel }),
        ...(autoApprove !== undefined && { autoApprove }),
        ...(prTitleTemplate !== undefined && { prTitleTemplate }),
        ...(prBodyTemplate !== undefined && { prBodyTemplate }),
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to update project settings:", error);
    return NextResponse.json(
      { error: "Failed to update project settings", message: error.message },
      { status: 500 }
    );
  }
}
