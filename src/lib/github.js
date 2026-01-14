/**
 * @fileoverview GitHub API utilities and token management
 */

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const GITHUB_TOKEN_COOKIE = "github_token";
const GITHUB_API_BASE = "https://api.github.com";

/**
 * Get the GitHub token.
 *
 * Prefers the DB-backed GitHubConnection when a userId is provided,
 * otherwise falls back to the legacy cookie token.
 * @returns {Promise<string|null>}
 */
export async function getGitHubToken(options = {}) {
  const { userId } = options || {};

  if (userId) {
    try {
      const connection = await prisma.gitHubConnection.findUnique({
        where: { userId },
        select: { accessToken: true },
      });
      if (connection?.accessToken) return connection.accessToken;
    } catch (error) {
      // Fall back to cookie token if DB isn't available/misconfigured.
      console.warn("[github] Failed to read GitHubConnection from DB; falling back to cookie token.", error);
    }
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(GITHUB_TOKEN_COOKIE);
  return token?.value || null;
}

/**
 * Set the GitHub token in cookies
 * @param {string} token - GitHub access token
 */
export async function setGitHubToken(token) {
  const cookieStore = await cookies();
  cookieStore.set(GITHUB_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
}

/**
 * Clear the GitHub token from cookies
 */
export async function clearGitHubToken() {
  const cookieStore = await cookies();
  cookieStore.delete(GITHUB_TOKEN_COOKIE);
}

/**
 * Upsert (create or update) the DB-backed GitHub connection for a user.
 * @param {Object} input
 * @param {string} input.userId
 * @param {string} input.accessToken
 * @param {'oauth'|'pat'} input.tokenType
 * @param {string|null} [input.githubUserId]
 * @param {string|null} [input.githubUsername]
 * @param {string|null} [input.githubEmail]
 * @param {string[]} [input.scopes]
 * @param {Date|null} [input.expiresAt]
 */
export async function upsertGitHubConnection(input) {
  const {
    userId,
    accessToken,
    tokenType,
    githubUserId = null,
    githubUsername = null,
    githubEmail = null,
    scopes = [],
    expiresAt = null,
  } = input || {};

  if (!userId) throw new Error("Missing userId");
  if (!accessToken) throw new Error("Missing accessToken");
  if (!tokenType) throw new Error("Missing tokenType");

  return prisma.gitHubConnection.upsert({
    where: { userId },
    update: {
      accessToken,
      tokenType,
      githubUserId,
      githubUsername,
      githubEmail,
      scopes,
      expiresAt,
    },
    create: {
      userId,
      accessToken,
      tokenType,
      githubUserId,
      githubUsername,
      githubEmail,
      scopes,
      expiresAt,
    },
  });
}

/**
 * Delete the DB-backed GitHub connection for a user.
 * @param {string} userId
 */
export async function deleteGitHubConnection(userId) {
  if (!userId) return;
  try {
    await prisma.gitHubConnection.delete({ where: { userId } });
  } catch (error) {
    // Ignore missing row errors, rethrow anything else.
    const msg = String(error?.message || "").toLowerCase();
    if (msg.includes("record to delete does not exist") || msg.includes("no record")) return;
    throw error;
  }
}

/**
 * Make a request to the GitHub API
 * @param {string} endpoint - API endpoint (e.g., "/user/repos")
 * @param {Object} options - Fetch options
 * @returns {Promise<any>}
 */
export async function githubRequest(endpoint, options = {}) {
  const { token: tokenOverride, ...fetchOptions } = options || {};
  const token = tokenOverride ?? (await getGitHubToken());
  
  if (!token) {
    throw new Error("GitHub token not found. Please connect your GitHub account.");
  }

  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
    ...fetchOptions,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `GitHub API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Validate a GitHub token by fetching user info
 * @param {string} token - GitHub access token or PAT
 * @returns {Promise<{user: Object, scopes: string[]}>}
 */
export async function validateGitHubToken(token) {
  const response = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error("Invalid GitHub token");
  }

  const user = await response.json();
  const scopes = response.headers.get("x-oauth-scopes")?.split(", ") || [];

  return { user, scopes };
}

/**
 * Exchange OAuth code for access token
 * @param {string} code - Authorization code from GitHub
 * @returns {Promise<{access_token: string, token_type: string, scope: string}>}
 */
export async function exchangeCodeForToken(code) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_REDIRECT_URI,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  return data;
}

/**
 * Get GitHub OAuth authorization URL
 * @param {string} [state] - Optional state parameter for CSRF protection
 * @returns {string}
 */
export function getOAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_REDIRECT_URI,
    scope: "repo read:org read:user",
    state: state || crypto.randomUUID(),
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}
