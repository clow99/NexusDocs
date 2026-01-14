/**
 * GitHub OAuth Callback Route
 * Handles the OAuth callback and exchanges code for access token
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { exchangeCodeForToken, setGitHubToken, upsertGitHubConnection, validateGitHubToken } from "@/lib/github";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const stateCookie = request.cookies.get("github_oauth_state")?.value || null;

  function redirectWithStateClear(url) {
    const res = NextResponse.redirect(url);
    res.cookies.delete("github_oauth_state");
    return res;
  }

  // Handle OAuth errors
  if (error) {
    return redirectWithStateClear(
      `${appUrl}/app/onboarding?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  // Validate state to prevent CSRF / token swapping attacks
  if (!state || !stateCookie || state !== stateCookie) {
    return redirectWithStateClear(
      `${appUrl}/app/onboarding?error=${encodeURIComponent("Invalid OAuth state. Please try connecting again.")}`
    );
  }

  // Missing authorization code
  if (!code) {
    return redirectWithStateClear(
      `${appUrl}/app/onboarding?error=${encodeURIComponent("Missing authorization code")}`
    );
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      // Onboarding requires auth; send user to login and then back.
      return redirectWithStateClear(
        `${appUrl}/login?callbackUrl=${encodeURIComponent("/app/onboarding")}`
      );
    }

    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(code);
    
    // Validate the token and get user info
    const { user, scopes } = await validateGitHubToken(tokenData.access_token);

    // Store token in cookie
    await setGitHubToken(tokenData.access_token);

    // Persist token for background scans / API access
    await upsertGitHubConnection({
      userId: session.user.id,
      accessToken: tokenData.access_token,
      tokenType: "oauth",
      githubUserId: user?.id != null ? String(user.id) : null,
      githubUsername: user?.login ?? null,
      githubEmail: user?.email ?? null,
      scopes,
      expiresAt: null,
    });

    // Redirect back to onboarding with success
    return redirectWithStateClear(`${appUrl}/app/onboarding?connected=true&step=1`);
  } catch (error) {
    console.error("GitHub OAuth error:", error);
    return redirectWithStateClear(
      `${appUrl}/app/onboarding?error=${encodeURIComponent("Failed to connect GitHub. Please try again.")}`
    );
  }
}
