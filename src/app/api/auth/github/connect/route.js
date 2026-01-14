/**
 * GitHub OAuth Connect Route
 * Redirects to GitHub OAuth authorization page
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOAuthUrl } from "@/lib/github";
import { rateLimit } from "@/lib/rate-limit";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "Please sign in to connect GitHub." },
        { status: 401 }
      );
    }

    const rl = rateLimit({
      key: `oauth_connect:${session.user.id}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { code: "RATE_LIMITED", message: "Too many requests. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSeconds) },
        }
      );
    }

    const state = crypto.randomUUID();
    const redirectUrl = getOAuthUrl(state);

    const res = NextResponse.json({ redirectUrl });
    res.cookies.set("github_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    });
    return res;
  } catch (error) {
    return NextResponse.json(
      { code: "OAUTH_ERROR", message: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Also support GET for direct browser redirects
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Please sign in to connect GitHub." },
      { status: 401 }
    );
  }

  const rl = rateLimit({
    key: `oauth_connect:${session.user.id}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      }
    );
  }

  const state = crypto.randomUUID();
  const redirectUrl = getOAuthUrl(state);
  const res = NextResponse.redirect(redirectUrl);
  res.cookies.set("github_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });
  return res;
}
