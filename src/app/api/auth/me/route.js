/**
 * Get current user API Route
 * Returns real user data from NextAuth session
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Get user with GitHub connection from database
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      githubConnection: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  // Format response
  const response = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.image || user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    },
    githubConnection: user.githubConnection
      ? {
          status: "connected",
          method: user.githubConnection.tokenType,
          lastValidatedAt: user.githubConnection.updatedAt.toISOString(),
          scopes: user.githubConnection.scopes || [],
          username: user.githubConnection.githubUsername,
        }
      : {
          status: "disconnected",
          method: null,
          lastValidatedAt: null,
          scopes: [],
          username: null,
        },
  };

  return NextResponse.json(response);
}
