/**
 * Projects API Routes
 * GET /api/projects - List all projects for the current user
 * POST /api/projects - Create a new project
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/projects
 * List all projects for the authenticated user
 */
export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        settings: true,
      },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * Create a new project
 */
export async function POST(request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { repoOwner, repoName, name, docsPaths } = body;

    if (!repoOwner || !repoName) {
      return NextResponse.json(
        { error: "repoOwner and repoName are required" },
        { status: 400 }
      );
    }

    const sanitizedDocsPaths = Array.isArray(docsPaths)
      ? docsPaths
          .map((t) => {
            const type = String(t?.type || "").trim().slice(0, 120);
            const enabled = t?.enabled !== false;
            const rawPaths = Array.isArray(t?.paths) ? t.paths : t?.paths ? [t.paths] : [];
            const paths = rawPaths
              .map((p) => String(p || "").trim())
              .filter(Boolean)
              .slice(0, 25);
            if (!type) return null;
            return { type, enabled, paths };
          })
          .filter(Boolean)
      : undefined;

    // Check if project already exists
    const existingProject = await prisma.project.findUnique({
      where: {
        userId_repoOwner_repoName: {
          userId: session.user.id,
          repoOwner,
          repoName,
        },
      },
    });

    if (existingProject) {
      return NextResponse.json(
        { error: "Project already exists for this repository" },
        { status: 409 }
      );
    }

    // Create project with default settings
    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        name: name || `${repoOwner}/${repoName}`,
        repoOwner,
        repoName,
        settings: {
          create: {
            // Use defaults from schema
            ...(sanitizedDocsPaths !== undefined && { docsPaths: sanitizedDocsPaths }),
          },
        },
      },
      include: {
        settings: true,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project", message: error.message },
      { status: 500 }
    );
  }
}
