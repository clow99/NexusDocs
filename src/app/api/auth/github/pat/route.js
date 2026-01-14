/**
 * GitHub PAT Connect Route
 * Validates and stores a Personal Access Token
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setGitHubToken, upsertGitHubConnection, validateGitHubToken } from "@/lib/github";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "Please sign in to connect GitHub." },
        { status: 401 }
      );
    }

    const rl = rateLimit({
      key: `github_pat:${session.user.id}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { code: "RATE_LIMITED", message: "Too many attempts. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSeconds) },
        }
      );
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { code: "INVALID_TOKEN", message: "Token is required" },
        { status: 400 }
      );
    }

    // Validate the token by fetching user info
    const { user, scopes } = await validateGitHubToken(token);

    // Check for required scopes
    const requiredScopes = ["repo"];
    const hasRequiredScopes = requiredScopes.some(
      (scope) => scopes.includes(scope) || scopes.includes("public_repo")
    );

    if (!hasRequiredScopes && scopes.length > 0) {
      return NextResponse.json(
        {
          code: "INSUFFICIENT_SCOPES",
          message: "Token needs 'repo' scope to access repositories",
        },
        { status: 400 }
      );
    }

    // Store token in cookie
    await setGitHubToken(token);

    // Persist token for background scans / API access
    await upsertGitHubConnection({
      userId: session.user.id,
      accessToken: token,
      tokenType: "pat",
      githubUserId: user?.id != null ? String(user.id) : null,
      githubUsername: user?.login ?? null,
      githubEmail: user?.email ?? null,
      scopes,
      expiresAt: null,
    });

    return NextResponse.json({
      githubConnection: {
        status: "connected",
        method: "pat",
        lastValidatedAt: new Date().toISOString(),
        scopes,
        username: user.login,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (error) {
    console.error("GitHub PAT validation error:", error);
    return NextResponse.json(
      { code: "INVALID_TOKEN", message: error.message },
      { status: 400 }
    );
  }
}
