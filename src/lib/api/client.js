/**
 * @fileoverview API client with mock mode support
 * This client routes requests to either the real API or mock adapter
 */

import { isMockMode} from "@/lib/utils";

/**
 * @typedef {Object} RequestOptions
 * @property {'GET'|'POST'|'PUT'|'DELETE'|'PATCH'} [method] - HTTP method
 * @property {Object} [body] - Request body
 * @property {Object} [headers] - Additional headers
 * @property {Object} [params] - Query parameters
 */

/**
 * Base API URL - uses relative URLs in browser, full URL on server
 */
const API_BASE = "/api";

/**
 * Build query string from params object
 * @param {Object} params - Query parameters
 * @returns {string} Query string with leading ?
 */
function buildQueryString(params) {
  if (!params || Object.keys(params).length === 0) return "";
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  return `?${searchParams.toString()}`;
}

/**
 * Make an API request
 * @param {string} endpoint - API endpoint (without /api prefix)
 * @param {RequestOptions} [options] - Request options
 * @returns {Promise<any>} Response data
 * @throws {import('@/lib/types').APIError} On error
 */
export async function apiRequest(endpoint, options = {}) {
  const { method = "GET", body, headers = {}, params } = options;

  // If in mock mode, use mock adapter
  if (isMockMode()) {
    const { mockRequest } = await import("./mock-adapter");
    return mockRequest(endpoint, options);
  }

  const url = `${API_BASE}${endpoint}${buildQueryString(params)}`;

  const fetchOptions = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body && method !== "GET") {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  // Handle error responses
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.message || "An error occurred");
    error.code = errorData.code || "UNKNOWN_ERROR";
    error.status = response.status;
    error.details = errorData.details;
    error.requestId = errorData.requestId;
    error.retryAfterSeconds = errorData.retryAfterSeconds;
    throw error;
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// ============================================
// Auth / User API
// ============================================

/**
 * Get current user and connection status
 * @returns {Promise<{user: import('@/lib/types').User, githubConnection: import('@/lib/types').GitHubConnection}>}
 */
export function getMe() {
  return apiRequest("/auth/me");
}

/**
 * Update current user profile
 * @param {{name?: string, email?: string}} data - Profile fields to update
 * @returns {Promise<{user: import('@/lib/types').User}>}
 */
export function updateProfile(data) {
  return apiRequest("/auth/profile", {
    method: "PATCH",
    body: data,
  });
}

/**
 * Start GitHub OAuth flow
 * @returns {Promise<{redirectUrl: string}>}
 */
export function connectGitHubOAuth() {
  return apiRequest("/auth/github/connect", { method: "POST" });
}

/**
 * Connect GitHub with Personal Access Token
 * @param {string} token - GitHub PAT
 * @returns {Promise<{githubConnection: import('@/lib/types').GitHubConnection}>}
 */
export function connectGitHubPAT(token) {
  return apiRequest("/auth/github/pat", {
    method: "POST",
    body: { token },
  });
}

/**
 * Disconnect GitHub integration
 * @returns {Promise<void>}
 */
export function disconnectGitHub() {
  return apiRequest("/auth/github/disconnect", { method: "POST" });
}

// ============================================
// GitHub API
// ============================================

/**
 * List accessible repositories
 * @param {Object} [options] - Filter options
 * @param {string} [options.org] - Filter by organization
 * @param {number} [options.page] - Page number
 * @param {number} [options.perPage] - Items per page
 * @returns {Promise<{repos: import('@/lib/types').GitHubRepo[], total: number}>}
 */
export function getRepos(options = {}) {
  return apiRequest("/github/repos", { params: options });
}

/**
 * Get repository details
 * @param {string} owner - Repo owner
 * @param {string} repo - Repo name
 * @returns {Promise<import('@/lib/types').GitHubRepo>}
 */
export function getRepo(owner, repo) {
  return apiRequest(`/github/repos/${owner}/${repo}`);
}

// ============================================
// Projects API
// ============================================

/**
 * List projects
 * @returns {Promise<{projects: import('@/lib/types').Project[]}>}
 */
export function getProjects() {
  return apiRequest("/projects");
}

/**
 * Get project by ID
 * @param {string} projectId - Project ID
 * @returns {Promise<import('@/lib/types').Project>}
 */
export function getProject(projectId) {
  return apiRequest(`/projects/${projectId}`);
}

/**
 * Create a new project
 * @param {Object} data - Project data
 * @param {string} data.repoOwner - Repository owner
 * @param {string} data.repoName - Repository name
 * @param {string} [data.name] - Display name
 * @returns {Promise<import('@/lib/types').Project>}
 */
export function createProject(data) {
  return apiRequest("/projects", {
    method: "POST",
    body: data,
  });
}

/**
 * Get project settings
 * @param {string} projectId - Project ID
 * @returns {Promise<import('@/lib/types').ProjectSettings>}
 */
export function getProjectSettings(projectId) {
  return apiRequest(`/projects/${projectId}/settings`);
}

/**
 * Update project settings
 * @param {string} projectId - Project ID
 * @param {Partial<import('@/lib/types').ProjectSettings>} settings - Settings to update
 * @returns {Promise<import('@/lib/types').ProjectSettings>}
 */
export function updateProjectSettings(projectId, settings) {
  return apiRequest(`/projects/${projectId}/settings`, {
    method: "PUT",
    body: settings,
  });
}

// ============================================
// Scans API
// ============================================

/**
 * List scans for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<{scans: import('@/lib/types').Scan[]}>}
 */
export function getScans(projectId) {
  return apiRequest(`/projects/${projectId}/scans`);
}

/**
 * Get scan by ID
 * @param {string} projectId - Project ID
 * @param {string} scanId - Scan ID
 * @returns {Promise<import('@/lib/types').Scan>}
 */
export function getScan(projectId, scanId) {
  return apiRequest(`/projects/${projectId}/scans/${scanId}`);
}

/**
 * Run a scan now
 * @param {string} projectId - Project ID
 * @returns {Promise<import('@/lib/types').Scan>}
 */
export function runScan(projectId) {
  return apiRequest(`/projects/${projectId}/scan`, { method: "POST" });
}

/**
 * Get drift items for a project
 * @param {string} projectId - Project ID
 * @param {Object} [options] - Filter options
 * @param {boolean} [options.resolved] - Filter by resolved status
 * @returns {Promise<{driftItems: import('@/lib/types').DriftItem[]}>}
 */
export function getDriftItems(projectId, options = {}) {
  return apiRequest(`/projects/${projectId}/drift`, { params: options });
}

// ============================================
// Proposals API
// ============================================

/**
 * List proposals for a project
 * @param {string} projectId - Project ID
 * @param {Object} [options] - Filter options
 * @param {string} [options.status] - Filter by status
 * @returns {Promise<{proposals: import('@/lib/types').Proposal[]}>}
 */
export function getProposals(projectId, options = {}) {
  return apiRequest(`/projects/${projectId}/proposals`, { params: options });
}

/**
 * Get proposal by ID
 * @param {string} projectId - Project ID
 * @param {string} proposalId - Proposal ID
 * @returns {Promise<import('@/lib/types').Proposal>}
 */
export function getProposal(projectId, proposalId) {
  return apiRequest(`/projects/${projectId}/proposals/${proposalId}`);
}

/**
 * Generate new proposals from scan/drift
 * @param {string} projectId - Project ID
 * @param {Object} data - Generation options
 * @param {string[]} [data.driftItemIds] - Drift items to address
 * @returns {Promise<{proposals: import('@/lib/types').Proposal[]}>}
 */
export function generateProposals(projectId, data) {
  return apiRequest(`/projects/${projectId}/ai/generate`, {
    method: "POST",
    body: data,
  });
}

/**
 * Regenerate a proposal with constraints
 * @param {string} projectId - Project ID
 * @param {string} proposalId - Proposal ID
 * @param {Object} data - Regeneration options
 * @param {string[]} [data.constraints] - Constraints for regeneration
 * @param {Object} [data.options] - Additional options
 * @returns {Promise<import('@/lib/types').Proposal>}
 */
export function regenerateProposal(projectId, proposalId, data) {
  return apiRequest(`/projects/${projectId}/proposals/${proposalId}/regenerate`, {
    method: "POST",
    body: data,
  });
}

/**
 * Approve a proposal
 * @param {string} projectId - Project ID
 * @param {string} proposalId - Proposal ID
 * @returns {Promise<import('@/lib/types').Proposal>}
 */
export function approveProposal(projectId, proposalId) {
  return apiRequest(`/projects/${projectId}/proposals/${proposalId}/approve`, {
    method: "POST",
  });
}

/**
 * Reject a proposal
 * @param {string} projectId - Project ID
 * @param {string} proposalId - Proposal ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<import('@/lib/types').Proposal>}
 */
export function rejectProposal(projectId, proposalId, reason) {
  return apiRequest(`/projects/${projectId}/proposals/${proposalId}/reject`, {
    method: "POST",
    body: { reason },
  });
}

/**
 * Publish a proposal (create PR)
 * @param {string} projectId - Project ID
 * @param {string} proposalId - Proposal ID
 * @returns {Promise<import('@/lib/types').Proposal>}
 */
export function publishProposal(projectId, proposalId) {
  return apiRequest(`/projects/${projectId}/proposals/${proposalId}/publish`, {
    method: "POST",
  });
}

// ============================================
// AI Service API
// ============================================

/**
 * Get AI service status
 * @returns {Promise<import('@/lib/types').AIServiceStatus>}
 */
export function getAIStatus() {
  return apiRequest("/ai/status");
}

// ============================================
// Audit API
// ============================================

/**
 * Get audit events
 * @param {Object} [options] - Filter options
 * @param {string} [options.projectId] - Filter by project
 * @param {string} [options.type] - Filter by event type
 * @param {string} [options.from] - Start date
 * @param {string} [options.to] - End date
 * @returns {Promise<{events: import('@/lib/types').AuditEvent[]}>}
 */
export function getAuditEvents(options = {}) {
  return apiRequest("/audit", { params: options });
}
