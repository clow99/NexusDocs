/**
 * @fileoverview Repository scanning + doc generation helpers
 *
 * This module:
 * - Lists repository files via the GitHub API
 * - Extracts lightweight signals (file tree, API routes, package scripts)
 * - Generates markdown docs per enabled doc targets
 *
 * Notes:
 * - Uses GitHub OAuth/PAT token stored in HTTP-only cookies (see `lib/github.js`)
 * - Designed to be safe by default (size caps, ignores, no binaries)
 */

import { githubRequest } from "@/lib/github";
import { getOpenAIClient, getOpenAIModelLabel, getOpenAIModels } from "@/lib/openai";

function getGitRequest(gitProvider) {
  if (gitProvider && gitProvider !== "github") {
    throw new Error(`Unsupported git provider: ${gitProvider}`);
  }
  return githubRequest;
}

const DEFAULT_MAX_FILES_TO_READ = 40;
const DEFAULT_MAX_FILE_BYTES = 200_000; // 200KB per file
const DEFAULT_MAX_TOTAL_CHARS = 220_000; // across all fetched file contents (prompt/context budget)

const DEFAULT_IGNORED_PREFIXES = [
  ".git/",
  ".github/",
  ".next/",
  ".vercel/",
  "node_modules/",
  "dist/",
  "build/",
  "coverage/",
  "out/",
  "vendor/",
  ".turbo/",
  ".cache/",
];

const DEFAULT_IGNORED_BASENAMES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  ".DS_Store",
]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".tar",
  ".tgz",
  ".7z",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
]);

function toPosixPath(p) {
  return String(p || "").replaceAll("\\", "/");
}

function basename(p) {
  const s = toPosixPath(p);
  const idx = s.lastIndexOf("/");
  return idx >= 0 ? s.slice(idx + 1) : s;
}

function extname(p) {
  const b = basename(p);
  const dot = b.lastIndexOf(".");
  return dot >= 0 ? b.slice(dot).toLowerCase() : "";
}

function isIgnoredPath(p) {
  const path = toPosixPath(p);
  if (!path) return true;
  if (DEFAULT_IGNORED_BASENAMES.has(basename(path))) return true;
  return DEFAULT_IGNORED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isProbablyTextFile(p) {
  const ext = extname(p);
  if (!ext) return true; // allow extensionless (Dockerfile, Makefile, etc.)
  if (BINARY_EXTENSIONS.has(ext)) return false;
  return true;
}

// Minimal glob matcher supporting **, *, ? for forward-slash paths.
// Good enough for docs target patterns like `docs/**/*.md`.
function globToRegExp(pattern) {
  const pat = toPosixPath(pattern).trim();
  // Escape regex special chars, then unescape glob tokens as we translate.
  let re = "";
  let i = 0;
  while (i < pat.length) {
    const ch = pat[i];
    if (ch === "*") {
      if (pat[i + 1] === "*") {
        // **/ -> match zero or more directories (including none)
        if (pat[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 3;
        } else {
          // ** -> match anything including slashes
          re += ".*";
          i += 2;
        }
      } else {
        // * -> match within a path segment
        re += "[^/]*";
        i += 1;
      }
      continue;
    }
    if (ch === "?") {
      re += "[^/]";
      i += 1;
      continue;
    }
    // Escape regexp metacharacters
    if ("\\.[]{}()+-^$|".includes(ch)) re += `\\${ch}`;
    else re += ch;
    i += 1;
  }
  return new RegExp(`^${re}$`);
}

function anyGlobMatches(patterns, path) {
  if (!patterns || patterns.length === 0) return false;
  const p = toPosixPath(path);
  return patterns.some((pat) => {
    try {
      return globToRegExp(pat).test(p);
    } catch {
      return false;
    }
  });
}

function inferOutputPathFromGlob(globPattern, fallbackDir, fallbackFile = "README.md") {
  const pattern = toPosixPath(globPattern || "").trim();
  if (!pattern) return `${fallbackDir}/${fallbackFile}`;

  // Try to cut at the first glob token to get a stable directory prefix.
  const firstStar = pattern.indexOf("*");
  const firstQ = pattern.indexOf("?");
  const cutAt = [firstStar, firstQ].filter((n) => n >= 0).sort((a, b) => a - b)[0];

  if (cutAt === undefined) {
    // Pattern has no globs; if it ends with .md assume it's a file path.
    if (pattern.toLowerCase().endsWith(".md")) return pattern;
    // Otherwise, treat as directory.
    const dir = pattern.endsWith("/") ? pattern.slice(0, -1) : pattern;
    return `${dir}/${fallbackFile}`;
  }

  const prefix = pattern.slice(0, cutAt);
  const dir = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  if (!dir) return `${fallbackDir}/${fallbackFile}`;
  return `${dir}/${fallbackFile}`;
}

function normalizeDocTargets(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function hasDocsPathsConfigured(settings) {
  const raw = settings?.docsPaths;
  if (raw === undefined || raw === null) return false;
  if (typeof raw === "string" && raw.trim() === "") return false;
  // Treat an empty array as "not configured" so new projects fall back to defaults.
  if (Array.isArray(raw) && raw.length === 0) return false;
  return true;
}

function pickDocTargets(settings) {
  const docTargets = normalizeDocTargets(settings?.docsPaths);
  const enabled = docTargets.filter((t) => t?.enabled !== false);
  return enabled.map((t) => ({
    type: String(t?.type || "Other"),
    paths: Array.isArray(t?.paths) ? t.paths.map(toPosixPath) : [toPosixPath(t?.paths || "")].filter(Boolean),
    enabled: t?.enabled !== false,
  }));
}

async function listRepoTree({ gitProvider, owner, repo, ref, token }) {
  const request = getGitRequest(gitProvider);
  const endpoint = `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const data = await request(endpoint, token ? { token } : undefined);
  const tree = Array.isArray(data?.tree) ? data.tree : [];
  return tree
    .filter((item) => item?.type === "blob" && item?.path)
    .map((item) => ({
      path: toPosixPath(item.path),
      size: typeof item.size === "number" ? item.size : null,
      sha: item.sha,
    }));
}

async function getBlobContent({ gitProvider, owner, repo, sha, token }) {
  const request = getGitRequest(gitProvider);
  const data = await request(`/repos/${owner}/${repo}/git/blobs/${sha}`, token ? { token } : undefined);
  if (!data?.content) return "";
  const encoding = data.encoding || "base64";
  if (encoding !== "base64") return "";
  const buf = Buffer.from(data.content.replace(/\n/g, ""), "base64");
  return buf.toString("utf8");
}

function extractApiRoutesFromFiles(files, contentsByPath) {
  const routes = [];
  for (const f of files) {
    const p = toPosixPath(f.path);
    if (!p.startsWith("src/app/api/") || !p.endsWith("/route.js")) continue;
    const rel = p.slice("src/app/api/".length).replace(/\/route\.js$/, "");
    const apiPath = `/api/${rel}`.replaceAll("[", ":").replaceAll("]", "");

    const content = contentsByPath.get(p) || "";
    const methods = [];
    for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      if (content.includes(`export async function ${m}`) || content.includes(`export function ${m}`)) {
        methods.push(m);
      }
    }
    routes.push({ apiPath, methods: methods.length ? methods : ["GET"] });
  }

  routes.sort((a, b) => a.apiPath.localeCompare(b.apiPath));
  return routes;
}

function buildRepoSummary({ owner, repo, ref, files }) {
  const total = files.length;
  const topDirs = new Map();
  for (const f of files) {
    const p = toPosixPath(f.path);
    const first = p.split("/")[0] || "";
    if (!first) continue;
    topDirs.set(first, (topDirs.get(first) || 0) + 1);
  }
  const top = [...topDirs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  return {
    repo: `${owner}/${repo}`,
    ref,
    totalFiles: total,
    topLevel: top.map(([name, count]) => ({ name, count })),
  };
}

function generateMarkdownDocs({ targetType, repoSummary, packageJson, apiRoutes, constraints }) {
  const title = `${repoSummary.repo} — ${targetType}`;
  const scripts = packageJson?.scripts ? Object.entries(packageJson.scripts) : [];

  const lines = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`Generated by NexusDocs from a scan of the repository at ref \`${repoSummary.ref}\`.`);
  lines.push("");

  if (targetType.toLowerCase().includes("api")) {
    lines.push("## API Reference");
    lines.push("");
    if (!apiRoutes.length) {
      lines.push("No `src/app/api/**/route.js` endpoints were detected.");
    } else {
      lines.push("### Endpoints");
      lines.push("");
      for (const r of apiRoutes) {
        lines.push(`- \`${r.apiPath}\` — ${r.methods.join(", ")}`);
      }
    }
    lines.push("");
  }

  if (targetType.toLowerCase().includes("architecture")) {
    lines.push("## Architecture");
    lines.push("");
    lines.push("### Repository layout (top-level)");
    lines.push("");
    for (const d of repoSummary.topLevel) {
      lines.push(`- \`${d.name}/\` (${d.count} files)`);
    }
    lines.push("");
    lines.push("### Notes");
    lines.push("");
    lines.push("- Add deeper module-level docs for key directories (e.g. `src/`, `prisma/`, `docs/`).");
    lines.push("");
  }

  if (targetType.toLowerCase().includes("tutorial")) {
    lines.push("## Tutorial");
    lines.push("");
    lines.push("### Run locally");
    lines.push("");
    if (scripts.length) {
      lines.push("Common scripts:");
      lines.push("");
      for (const [name, cmd] of scripts.slice(0, 10)) {
        lines.push(`- \`npm run ${name}\` — \`${cmd}\``);
      }
    } else {
      lines.push("No `scripts` were found in `package.json`.");
    }
    lines.push("");
    lines.push("### Next steps");
    lines.push("");
    lines.push("1. Add screenshots and concrete user flows.");
    lines.push("2. Link to the relevant sections in the User Guide and API Reference.");
    lines.push("");
  }

  if (targetType.toLowerCase().includes("user guide") || targetType.toLowerCase().includes("guide")) {
    lines.push("## User Guide");
    lines.push("");
    lines.push("### Getting started");
    lines.push("");
    lines.push("1. Configure environment variables (see your project's `.env` / `.env.local` docs).");
    lines.push("2. Install dependencies: `npm install`");
    lines.push("3. Start dev server: `npm run dev`");
    lines.push("");
    if (scripts.length) {
      lines.push("### Useful commands");
      lines.push("");
      for (const [name, cmd] of scripts.slice(0, 10)) {
        lines.push(`- \`npm run ${name}\` — \`${cmd}\``);
      }
      lines.push("");
    }
  }

  if (
    !targetType.toLowerCase().includes("api") &&
    !targetType.toLowerCase().includes("architecture") &&
    !targetType.toLowerCase().includes("tutorial") &&
    !targetType.toLowerCase().includes("user guide") &&
    !targetType.toLowerCase().includes("guide")
  ) {
    lines.push("## Overview");
    lines.push("");
    lines.push("This document was generated from a repository scan. Expand it with project-specific details.");
    lines.push("");
  }

  const normalizedConstraints = Array.isArray(constraints)
    ? constraints.map((c) => String(c || "").trim()).filter(Boolean)
    : [];
  if (normalizedConstraints.length) {
    lines.push("## Regeneration constraints");
    lines.push("");
    for (const c of normalizedConstraints) {
      lines.push(`- ${c}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

async function generateRepoDigestLLM({ repoSummary, packageJson, apiRoutes, contentsByPath }) {
  const client = getOpenAIClient();
  if (!client) return null;
  const { readModel } = getOpenAIModels();

  const scripts = packageJson?.scripts ? Object.entries(packageJson.scripts) : [];
  const files = [...contentsByPath.entries()].map(([path, content]) => ({
    path,
    // Keep excerpts manageable to avoid blowing context.
    excerpt: String(content || "").slice(0, 4000),
  }));

  const messages = [
    {
      role: "system",
      content:
        "You are a senior engineer summarizing a repository for documentation generation. Respond ONLY with valid JSON matching the requested schema.",
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          instructions: "Summarize the repository into a structured digest for downstream doc generation.",
          schema: {
            repoPurpose: "short description of what this repo does",
            setup: "step-by-step setup and run instructions",
            envVars: [
              {
                name: "NAME",
                required: true,
                purpose: "what it does",
                example: "value example if known",
              },
            ],
            keyModules: [
              {
                path: "path/to/file",
                summary: "what it does",
              },
            ],
            apiRoutes: [
              {
                path: "/api/foo",
                methods: ["GET"],
                summary: "purpose",
              },
            ],
            dataModels: [
              {
                name: "Model or entity name",
                summary: "what fields mean",
              },
            ],
            gotchas: ["important constraints, limits, or warnings"],
          },
          repoSummary,
          packageScripts: scripts,
          apiRoutes,
          files,
        },
        null,
        2
      ),
    },
  ];

  const completion = await client.chat.completions.create({
    model: readModel,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages,
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("Failed to parse repo digest JSON from OpenAI:", err, text?.slice(0, 500));
    return null;
  }
}

async function generateDocWithLLM({ digest, target, repoSummary, packageJson, apiRoutes, constraints }) {
  const client = getOpenAIClient();
  if (!client) return null;
  const { writeModel } = getOpenAIModels();

  const messages = [
    {
      role: "system",
      content:
        [
          "You are an expert technical writer improving an existing repository documentation file.",
          "",
          "Rules (critical):",
          "- You will be given existingMarkdown (may be empty). If it is already complete enough, return it unchanged.",
          "- Otherwise, make minimal, targeted edits. Preserve structure, headings, and useful details.",
          "- Do NOT delete large sections unless they are clearly wrong/outdated AND you replace them with better content.",
          "- Prefer adding/adjusting over rewriting.",
          "- Do not include YAML frontmatter.",
          "- Output ONLY the final Markdown content (no code fences, no explanations).",
          "- Avoid hallucinating; if unsure, omit rather than invent.",
        ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          targetType: target?.type || "Documentation",
          outputPath: target?.paths?.[0] || null,
          operation: target?.existingMarkdown && String(target.existingMarkdown).trim() ? "update" : "create",
          existingMarkdown: target?.existingMarkdown || "",
          constraints: Array.isArray(constraints)
            ? constraints.map((c) => String(c || "").trim()).filter(Boolean)
            : [],
          repoSummary,
          packageJson,
          apiRoutes,
          digest,
        },
        null,
        2
      ),
    },
  ];

  const completion = await client.chat.completions.create({
    model: writeModel,
    temperature: 0.35,
    messages,
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  return text || null;
}

function pickCandidateFiles(files) {
  // Prefer a handful of high-signal files, then include API routes for better docs.
  const preferred = new Set([
    "package.json",
    "README.md",
    "readme.md",
    "next.config.js",
    "next.config.mjs",
    "src/app/api",
    "src/pages/api",
    "prisma/schema.prisma",
  ]);

  const scored = files
    .filter((f) => !isIgnoredPath(f.path))
    .filter((f) => isProbablyTextFile(f.path))
    .filter((f) => (typeof f.size === "number" ? f.size <= DEFAULT_MAX_FILE_BYTES : true))
    .map((f) => {
      const p = toPosixPath(f.path);
      let score = 0;
      if (preferred.has(p)) score += 100;
      if (p.startsWith("src/app/api/") && p.endsWith("/route.js")) score += 80;
      if (p === "package.json") score += 120;
      if (p.toLowerCase() === "readme.md") score += 110;
      if (p.startsWith("src/")) score += 20;
      if (p.startsWith("app/")) score += 10;
      if (p.endsWith(".md") || p.endsWith(".mdx")) score += 5;
      return { ...f, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored;
}

export async function scanRepoAndGenerateDocProposals({
  gitProvider = "github",
  owner,
  repo,
  ref,
  projectSettings,
  constraints,
  token,
  limits = {},
  onProgress,
}) {
  const maxFilesToRead = limits.maxFilesToRead ?? DEFAULT_MAX_FILES_TO_READ;
  const maxTotalChars = limits.maxTotalChars ?? DEFAULT_MAX_TOTAL_CHARS;

  if (typeof onProgress === "function") {
    await onProgress({
      phase: "tree",
      percent: 5,
      message: "Listing repository files",
      meta: { owner, repo, ref },
    });
  }
  const allFiles = await listRepoTree({ gitProvider, owner, repo, ref, token });
  const repoSummary = buildRepoSummary({ owner, repo, ref, files: allFiles });

  const defaultTargets = [{ type: "README", paths: ["README.md"], enabled: true }];
  const configured = hasDocsPathsConfigured(projectSettings);
  const selectedTargets = pickDocTargets(projectSettings);
  const enabledTargets = configured ? selectedTargets : defaultTargets;

  const candidates = pickCandidateFiles(allFiles);
  const toRead = candidates.slice(0, maxFilesToRead);

  const contentsByPath = new Map();
  let remaining = maxTotalChars;

  const readCount = toRead.length || 1;
  for (const f of toRead) {
    if (!f?.sha) continue;
    if (remaining <= 0) break;
    if (typeof onProgress === "function") {
      const idx = contentsByPath.size;
      // Map reads to roughly 10-55% progress.
      const percent = Math.min(55, 10 + Math.round((idx / readCount) * 45));
      await onProgress({
        phase: "read_files",
        percent,
        message: `Reading ${toPosixPath(f.path)}`,
        meta: { path: toPosixPath(f.path), index: idx + 1, total: readCount },
      });
    }
    const text = await getBlobContent({ gitProvider, owner, repo, sha: f.sha, token });
    const trimmed = text.length > remaining ? text.slice(0, remaining) : text;
    contentsByPath.set(toPosixPath(f.path), trimmed);
    remaining -= trimmed.length;
  }

  // Parse package.json if present
  let packageJson = null;
  const pkgRaw = contentsByPath.get("package.json");
  if (pkgRaw) {
    try {
      packageJson = JSON.parse(pkgRaw);
    } catch {
      packageJson = null;
    }
  }

  const apiRoutes = extractApiRoutesFromFiles(toRead, contentsByPath);

  let repoDigest = null;
  let modelLabel = "Built-in generator";
  const models = getOpenAIModels();
  const hasOpenAI = Boolean(getOpenAIClient());

  if (hasOpenAI) {
    try {
      if (typeof onProgress === "function") {
        await onProgress({
          phase: "ai_digest",
          percent: 60,
          message: "Summarizing repository with AI",
        });
      }
      repoDigest = await generateRepoDigestLLM({ repoSummary, packageJson, apiRoutes, contentsByPath });
      if (repoDigest) {
        modelLabel = getOpenAIModelLabel();
      }
    } catch (err) {
      console.error("Failed to generate repo digest with OpenAI:", err);
      repoDigest = null;
    }
  }

  const proposals = [];
  const targetCount = enabledTargets.length || 1;
  for (let i = 0; i < enabledTargets.length; i++) {
    const target = enabledTargets[i];
    if (typeof onProgress === "function") {
      // Map doc generation to roughly 65-85%
      const percent = Math.min(85, 65 + Math.round((i / targetCount) * 20));
      await onProgress({
        phase: "generate_docs",
        percent,
        message: `Generating ${String(target?.type || "documentation")}`,
        meta: { index: i + 1, total: targetCount, targetType: target?.type || "Documentation" },
      });
    }
    const firstGlob = target.paths?.find(Boolean) || "";
    const fallbackDir = target.type?.toLowerCase().includes("api")
      ? "docs/api"
      : target.type?.toLowerCase().includes("architecture")
      ? "docs/architecture"
      : target.type?.toLowerCase().includes("tutorial")
      ? "docs/tutorials"
      : target.type?.toLowerCase().includes("user guide") || target.type?.toLowerCase().includes("guide")
      ? "docs/guides"
      : "docs";

    const outputPath = inferOutputPathFromGlob(firstGlob, fallbackDir, "README.md");

    // If the output file already exists, prefer updating it (minimal diff) rather than regenerating
    // a brand-new document that overwrites useful content.
    let existingMarkdown = "";
    try {
      const existing = await fetchRepoFileIfExists({
        gitProvider,
        owner,
        repo,
        path: outputPath,
        ref,
        ...(token ? { token } : {}),
      });
      existingMarkdown = existing?.exists ? String(existing.content ?? "") : "";
    } catch {
      existingMarkdown = "";
    }
    // Cap existing content to keep prompts bounded (very large docs can exceed context limits).
    if (existingMarkdown.length > 80_000) {
      existingMarkdown = existingMarkdown.slice(0, 80_000);
    }

    let markdown = null;
    if (repoDigest && hasOpenAI) {
      try {
        markdown = await generateDocWithLLM({
          digest: repoDigest,
          target: { ...target, existingMarkdown },
          repoSummary,
          packageJson,
          apiRoutes,
          constraints,
        });
      } catch (err) {
        console.error(`Failed to generate doc for ${target.type} via OpenAI:`, err);
        markdown = null;
      }
    }

    if (!markdown) {
      // Built-in generator is intentionally conservative: if a doc already exists,
      // don't overwrite it with a generic template.
      markdown =
        existingMarkdown && existingMarkdown.trim()
          ? existingMarkdown
          : generateMarkdownDocs({
              targetType: target.type,
              repoSummary,
              packageJson,
              apiRoutes,
              constraints,
            });
    }

    proposals.push({
      target,
      outputPath,
      markdown,
    });
  }

  return {
    repoSummary,
    enabledTargets,
    filesScanned: toRead.length,
    proposals,
    generationMetadata: {
      repo: repoSummary.repo,
      ref,
      filesScanned: toRead.length,
      topLevel: repoSummary.topLevel,
      docTargets: enabledTargets,
      apiRoutesCount: apiRoutes.length,
      models: modelLabel === "Built-in generator" ? null : models,
      modelLabel,
    },
    modelLabel,
  };
}

export async function fetchRepoFileIfExists({ gitProvider = "github", owner, repo, path, ref, token }) {
  const request = getGitRequest(gitProvider);
  const p = toPosixPath(path).replace(/^\/+/, "");
  try {
    // GitHub "contents" endpoint expects the path with slashes preserved.
    const encodedPath = p
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    const data = await request(
      `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
      token ? { token } : undefined
    );
    if (!data?.content) return { exists: false, content: null, sha: null };
    const buf = Buffer.from(String(data.content).replace(/\n/g, ""), "base64");
    return { exists: true, content: buf.toString("utf8"), sha: data.sha || null };
  } catch (err) {
    // GitHub returns 404 for missing files.
    const msg = String(err?.message || "");
    if (msg.toLowerCase().includes("not found")) return { exists: false, content: null, sha: null };
    return { exists: false, content: null, sha: null, error: err };
  }
}

export function matchPathsByGlobs(paths, globs) {
  if (!Array.isArray(paths)) return [];
  const patterns = Array.isArray(globs) ? globs.filter(Boolean) : [];
  return paths.filter((p) => anyGlobMatches(patterns, p));
}

