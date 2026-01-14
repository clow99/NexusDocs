/**
 * @fileoverview Mock API adapter for development without a backend
 * Simulates all API endpoints using local JSON fixtures
 */

import { sleep, generateId } from "@/lib/utils";

// Import fixtures
import userData from "./fixtures/user.json";
import reposData from "./fixtures/repos.json";
import projectsData from "./fixtures/projects.json";
import scansData from "./fixtures/scans.json";
import proposalsData from "./fixtures/proposals.json";
import auditData from "./fixtures/audit.json";

// Simulated latency range (ms)
const MIN_LATENCY = 100;
const MAX_LATENCY = 500;

/**
 * Simulate network latency
 */
async function simulateLatency() {
  const latency = Math.random() * (MAX_LATENCY - MIN_LATENCY) + MIN_LATENCY;
  await sleep(latency);
}

/**
 * Parse route with params
 * @param {string} pattern - Route pattern like /projects/:id
 * @param {string} path - Actual path
 * @returns {Object|null} Params object or null if no match
 */
function matchRoute(pattern, path) {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");

  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

/**
 * Route handlers
 */
const routes = {
  // Auth
  "GET /auth/me": async () => {
    return userData;
  },

  "POST /auth/github/connect": async () => {
    return { redirectUrl: "https://github.com/login/oauth/authorize?client_id=mock" };
  },

  "POST /auth/github/pat": async (_, body) => {
    if (!body?.token) {
      throw { code: "INVALID_TOKEN", message: "Token is required", status: 400 };
    }
    return {
      githubConnection: {
        ...userData.githubConnection,
        method: "pat",
        lastValidatedAt: new Date().toISOString(),
      },
    };
  },

  "POST /auth/github/disconnect": async () => {
    return null;
  },

  "PATCH /auth/profile": async (_, body) => {
    const updatedUser = {
      ...userData.user,
      ...(body.name !== undefined && { name: body.name }),
      ...(body.email !== undefined && { email: body.email }),
    };
    return { user: updatedUser };
  },

  // GitHub repos
  "GET /github/repos": async (_, __, params) => {
    let repos = [...reposData.repos];

    if (params?.org) {
      repos = repos.filter((r) => r.owner === params.org);
    }

    const page = parseInt(params?.page || "1");
    const perPage = parseInt(params?.perPage || "20");
    const start = (page - 1) * perPage;
    const paginated = repos.slice(start, start + perPage);

    return { repos: paginated, total: repos.length };
  },

  // Projects
  "GET /projects": async () => {
    return { projects: projectsData.projects };
  },

  "POST /projects": async (_, body) => {
    const newProject = {
      id: `proj_${generateId()}`,
      name: body.name || body.repoName,
      repoOwner: body.repoOwner,
      repoName: body.repoName,
      defaultBranch: "main",
      enabled: true,
      lastScanAt: null,
      nextScanAt: new Date(Date.now() + 86400000).toISOString(),
      driftOpenCount: 0,
      proposalsPendingCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // In real mock, we'd add to the array
    return newProject;
  },

  // AI Status
  "GET /ai/status": async () => {
    return {
      configured: true,
      defaultModelLabel: "OpenAI (app key)",
      limits: {
        requestsPerMinute: 60,
        tokensPerMinute: 90000,
      },
    };
  },

  // Audit
  "GET /audit": async (_, __, params) => {
    let events = [...auditData.events];

    if (params?.projectId) {
      events = events.filter((e) => e.projectId === params.projectId);
    }
    if (params?.type) {
      events = events.filter((e) => e.type === params.type);
    }

    return { events };
  },
};

/**
 * Dynamic route handlers (with params)
 */
const dynamicRoutes = [
  {
    pattern: "GET /projects/:projectId",
    handler: async (params) => {
      const project = projectsData.projects.find((p) => p.id === params.projectId);
      if (!project) {
        throw { code: "NOT_FOUND", message: "Project not found", status: 404 };
      }
      return project;
    },
  },
  {
    pattern: "GET /projects/:projectId/settings",
    handler: async (params) => {
      const settings = projectsData.settings[params.projectId];
      if (!settings) {
        throw { code: "NOT_FOUND", message: "Settings not found", status: 404 };
      }
      return settings;
    },
  },
  {
    pattern: "PUT /projects/:projectId/settings",
    handler: async (params, body) => {
      const settings = projectsData.settings[params.projectId];
      if (!settings) {
        throw { code: "NOT_FOUND", message: "Settings not found", status: 404 };
      }
      return { ...settings, ...body };
    },
  },
  {
    pattern: "POST /projects/:projectId/scan",
    handler: async (params) => {
      const project = projectsData.projects.find((p) => p.id === params.projectId);
      if (!project) {
        throw { code: "NOT_FOUND", message: "Project not found", status: 404 };
      }
      return {
        id: `scan_${generateId()}`,
        projectId: params.projectId,
        status: "queued",
        source: "manual",
        startedAt: new Date().toISOString(),
        finishedAt: null,
        commits: [],
        pullRequests: [],
        driftItemsCreated: 0,
        proposalId: null,
      };
    },
  },
  {
    pattern: "GET /projects/:projectId/scans",
    handler: async (params) => {
      const scans = scansData.scans.filter((s) => s.projectId === params.projectId);
      return { scans };
    },
  },
  {
    pattern: "GET /projects/:projectId/scans/:scanId",
    handler: async (params) => {
      const scan = scansData.scans.find(
        (s) => s.id === params.scanId && s.projectId === params.projectId
      );
      if (!scan) {
        throw { code: "NOT_FOUND", message: "Scan not found", status: 404 };
      }
      return scan;
    },
  },
  {
    pattern: "GET /projects/:projectId/drift",
    handler: async (params, _, queryParams) => {
      let driftItems = scansData.driftItems.filter(
        (d) => d.projectId === params.projectId
      );
      if (queryParams?.resolved !== undefined) {
        const resolved = queryParams.resolved === "true";
        driftItems = driftItems.filter((d) => d.resolved === resolved);
      }
      return { driftItems };
    },
  },
  {
    pattern: "GET /projects/:projectId/proposals",
    handler: async (params, _, queryParams) => {
      let proposals = proposalsData.proposals.filter(
        (p) => p.projectId === params.projectId
      );
      if (queryParams?.status) {
        proposals = proposals.filter((p) => p.status === queryParams.status);
      }
      return { proposals };
    },
  },
  {
    pattern: "GET /projects/:projectId/proposals/:proposalId",
    handler: async (params) => {
      const proposal = proposalsData.proposals.find(
        (p) => p.id === params.proposalId && p.projectId === params.projectId
      );
      if (!proposal) {
        throw { code: "NOT_FOUND", message: "Proposal not found", status: 404 };
      }
      return proposal;
    },
  },
  {
    pattern: "POST /projects/:projectId/ai/generate",
    handler: async (params) => {
      // Simulate AI generation delay
      await sleep(1500);
      return {
        proposals: [
          {
            id: `prop_${generateId()}`,
            projectId: params.projectId,
            status: "pending",
            summary: "AI-generated documentation update based on recent changes",
            createdAt: new Date().toISOString(),
            modelLabel: "OpenAI (app key)",
            promptVersion: "v2.1.0-mock",
            files: [],
          },
        ],
      };
    },
  },
  {
    pattern: "POST /projects/:projectId/proposals/:proposalId/regenerate",
    handler: async (params) => {
      const proposal = proposalsData.proposals.find(
        (p) => p.id === params.proposalId
      );
      if (!proposal) {
        throw { code: "NOT_FOUND", message: "Proposal not found", status: 404 };
      }
      await sleep(1500);
      return { ...proposal, createdAt: new Date().toISOString() };
    },
  },
  {
    pattern: "POST /projects/:projectId/proposals/:proposalId/approve",
    handler: async (params) => {
      const proposal = proposalsData.proposals.find(
        (p) => p.id === params.proposalId
      );
      if (!proposal) {
        throw { code: "NOT_FOUND", message: "Proposal not found", status: 404 };
      }
      return {
        ...proposal,
        status: "approved",
        approvedBy: "user_01",
        approvedAt: new Date().toISOString(),
      };
    },
  },
  {
    pattern: "POST /projects/:projectId/proposals/:proposalId/reject",
    handler: async (params, body) => {
      const proposal = proposalsData.proposals.find(
        (p) => p.id === params.proposalId
      );
      if (!proposal) {
        throw { code: "NOT_FOUND", message: "Proposal not found", status: 404 };
      }
      return {
        ...proposal,
        status: "rejected",
        rejectionReason: body?.reason || "No reason provided",
      };
    },
  },
  {
    pattern: "POST /projects/:projectId/proposals/:proposalId/publish",
    handler: async (params) => {
      const proposal = proposalsData.proposals.find(
        (p) => p.id === params.proposalId
      );
      if (!proposal) {
        throw { code: "NOT_FOUND", message: "Proposal not found", status: 404 };
      }
      await sleep(1000);
      return {
        ...proposal,
        status: "published",
        publishResult: {
          prUrl: `https://github.com/mock/mock/pull/${Math.floor(Math.random() * 100)}`,
          prNumber: Math.floor(Math.random() * 100),
          publishedAt: new Date().toISOString(),
        },
      };
    },
  },
  {
    pattern: "GET /github/repos/:owner/:repo",
    handler: async (params) => {
      const repo = reposData.repos.find(
        (r) => r.owner === params.owner && r.name === params.repo
      );
      if (!repo) {
        throw { code: "NOT_FOUND", message: "Repository not found", status: 404 };
      }
      return repo;
    },
  },
];

/**
 * Main mock request handler
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Request options
 * @returns {Promise<any>} Response data
 */
export async function mockRequest(endpoint, options = {}) {
  await simulateLatency();

  const { method = "GET", body, params: queryParams } = options;
  const routeKey = `${method} ${endpoint}`;

  // Check static routes first
  if (routes[routeKey]) {
    return routes[routeKey](null, body, queryParams);
  }

  // Check dynamic routes
  for (const route of dynamicRoutes) {
    const [routeMethod, routePattern] = route.pattern.split(" ");
    if (routeMethod !== method) continue;

    const params = matchRoute(routePattern, endpoint);
    if (params) {
      return route.handler(params, body, queryParams);
    }
  }

  // No route matched
  throw {
    code: "NOT_FOUND",
    message: `No mock handler for ${method} ${endpoint}`,
    status: 404,
  };
}
