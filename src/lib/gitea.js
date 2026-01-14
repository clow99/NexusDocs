/**
 * @fileoverview Gitea API utilities and token management
 *
 * Note: The app primarily supports GitHub today, but some modules still
 * reference `giteaRequest`. This helper keeps the import stable and provides
 * a minimal, safe implementation.
 */
 
import { cookies } from "next/headers";
 
const GITEA_TOKEN_COOKIE = "gitea_token";
 
function normalizeApiBase(raw) {
  const base = String(raw || "").trim().replace(/\/+$/, "");
  if (!base) return "";
  if (base.toLowerCase().endsWith("/api/v1")) return base;
  return `${base}/api/v1`;
}
 
function getApiBase() {
  // Prefer explicit API base, otherwise derive from instance base URL.
  const apiBase =
    normalizeApiBase(process.env.GITEA_API_BASE) ||
    normalizeApiBase(process.env.GITEA_BASE_URL);
 
  if (!apiBase) {
    throw new Error(
      "Gitea is not configured. Set GITEA_BASE_URL (e.g. https://gitea.example.com) or GITEA_API_BASE (e.g. https://gitea.example.com/api/v1)."
    );
  }
 
  return apiBase;
}
 
/**
 * Get the Gitea token from the HTTP-only cookie.
 * @returns {Promise<string|null>}
 */
export async function getGiteaToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get(GITEA_TOKEN_COOKIE);
  return token?.value || null;
}
 
/**
 * Set the Gitea token in cookies.
 * @param {string} token
 */
export async function setGiteaToken(token) {
  const cookieStore = await cookies();
  cookieStore.set(GITEA_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
}
 
/**
 * Clear the Gitea token cookie.
 */
export async function clearGiteaToken() {
  const cookieStore = await cookies();
  cookieStore.delete(GITEA_TOKEN_COOKIE);
}
 
/**
 * Make a request to the Gitea API.
 * @param {string} endpoint - API endpoint (e.g., "/user/repos")
 * @param {Object} options - Fetch options
 * @returns {Promise<any>}
 */
export async function giteaRequest(endpoint, options = {}) {
  const { token: tokenOverride, ...fetchOptions } = options || {};
  const token = tokenOverride ?? (await getGiteaToken());
 
  if (!token) {
    throw new Error("Gitea token not found. Please connect your Gitea account.");
  }
 
  const apiBase = getApiBase();
  const response = await fetch(`${apiBase}${endpoint}`, {
    ...fetchOptions,
    headers: {
      "Accept": "application/json",
      // Gitea supports both `token` and `Bearer`; `token` is widely compatible.
      "Authorization": `token ${token}`,
      ...fetchOptions.headers,
    },
  });
 
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.message || `Gitea API error: ${response.status}`);
  }
 
  return response.json();
}

