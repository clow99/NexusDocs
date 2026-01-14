/**
 * GitHub Disconnect Route
 * Clears the GitHub token cookie
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { clearGitHubToken, deleteGitHubConnection } from "@/lib/github";

export async function POST() {
  try {
    const session = await auth();
    if (session?.user?.id) {
      await deleteGitHubConnection(session.user.id);
    }
    await clearGitHubToken();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("GitHub disconnect error:", error);
    return NextResponse.json(
      { code: "DISCONNECT_ERROR", message: error.message },
      { status: 500 }
    );
  }
}
