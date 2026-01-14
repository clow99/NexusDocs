# NexusDocs

AI-Assisted Repository Documentation Management

NexusDocs is a Next.js frontend application for managing repository documentation with AI-assisted updates driven by GitHub code changes. It allows users to connect GitHub repositories, configure documentation targets, schedule scans for documentation drift, and review/approve AI-generated documentation updates.

## Features

- **GitHub Integration**: Connect via OAuth or Personal Access Token
- **Multi-Project Support**: Track multiple repositories with individual configurations
- **Automated Scanning**: Schedule hourly, daily, or weekly scans for documentation drift
- **AI-Generated Updates**: Review proposed documentation changes with diff viewer
- **Manual Editing**: Edit proposals in-app before publishing
- **PR-Based Publishing**: Publish approved changes via GitHub Pull Requests
- **Audit Log**: Track all activity across projects

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: Tailwind CSS + shadcn/ui components
- **State Management**: TanStack Query (React Query)
- **Forms**: react-hook-form + zod validation
- **Diff Viewer**: Custom unified diff parser
- **Markdown**: react-markdown with GFM support
- **Auth**: NextAuth v5 (beta) + Prisma adapter
- **Database**: Prisma schema (MySQL provider) + MariaDB runtime adapter (`@prisma/adapter-mariadb`)

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- MariaDB (recommended) or MySQL-compatible server (required for auth + persistence)
- Google OAuth credentials (required to sign in)

### Installation

```bash
# Install dependencies
npm install
```

#### Configure environment

Create a `.env.local` file in the project root and fill in required values (template below).

Then create database tables:

```bash
npx prisma db push
```

Start the development server:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the app.

### Environment Variables

Create a `.env.local` file (or set these in your deployment environment).

```env
# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Enable mock mode for development UI (uses local JSON fixtures in the browser)
NEXT_PUBLIC_MOCK_MODE=true

# Database (required)
# Accepts mysql://... or mariadb://... (the app normalizes mysql:// to mariadb:// at runtime)
DATABASE_URL="mariadb://username:password@localhost:3306/nexusdocs"

# NextAuth (required)
# Supports either env name
AUTH_SECRET="replace-me"
# NEXTAUTH_SECRET="replace-me"

# Google login (required)
GOOGLE_CLIENT_ID="replace-me"
GOOGLE_CLIENT_SECRET="replace-me"

# Optional: comma-separated list of emails that should be marked as app admins on sign-in
ADMIN_EMAILS="admin@example.com,another@example.com"

# OpenAI (optional)
# If unset, NexusDocs falls back to a built-in (non-LLM) generator for demo/prototyping.
OPENAI_API_KEY="sk-your-key-here"
# OPENAI_READ_MODEL="gpt-4o"
# OPENAI_WRITE_MODEL="gpt-5.1"

# GitHub OAuth (optional; required for “Connect GitHub via OAuth”)
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
GITHUB_REDIRECT_URI="http://localhost:3000/api/auth/github/callback"

# Cron scans (optional)
# Protects /api/cron/scans via Authorization: Bearer <secret>
# CRON_SECRET="replace-me"
```

> ⚠️ **Security Warning**: Never commit `.env.local` to version control. Keep secrets server-side only.

### Database Setup (Prisma)

You need a database and a valid `DATABASE_URL` to run the app (auth and persistence use Prisma).

```bash
# Create tables from prisma/schema.prisma
npx prisma db push

# Optional: explore data in Prisma Studio
npx prisma studio
```

See `DATABASE_SETUP.md` for a quick walkthrough.

## Mock Mode

The application ships with a mock API layer for UI development:

1. Set `NEXT_PUBLIC_MOCK_MODE=true` in `.env.local`
2. The browser API client will use local JSON fixtures in `src/lib/api/fixtures/`
3. Simulated latency makes the UI feel realistic

Notes:
- Mock mode does **not** remove the need for authentication or a database; it only avoids hitting the app’s `/api/*` endpoints from the UI.

Mock data includes:
- 4 sample projects (React Dashboard, API Gateway, Design System, Backend Services)
- Sample scans with commits and PRs
- Multiple proposals in various states (pending, approved, published, rejected)
- Audit events

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API route handlers
│   │   ├── ai/status/     # AI service status
│   │   └── auth/me/       # User authentication
│   ├── app/               # Authenticated app routes
│   │   ├── audit/         # Audit log
│   │   ├── onboarding/    # Setup wizard
│   │   ├── projects/      # Projects dashboard & details
│   │   └── account/       # Account settings
│   ├── layout.js          # Root layout
│   └── page.js            # Landing (redirects to /app/projects)
├── components/
│   ├── layout/            # Sidebar, Header, ErrorBoundary
│   ├── proposals/         # DiffViewer, MarkdownEditor
│   └── ui/                # shadcn/ui components
├── hooks/                 # React Query hooks
│   ├── use-auth.js
│   ├── use-projects.js
│   ├── use-scans.js
│   ├── use-proposals.js
│   ├── use-ai.js
│   └── use-audit.js
└── lib/
    ├── api/
    │   ├── client.js      # API client with mock toggle
    │   ├── mock-adapter.js # Mock endpoint handlers
    │   └── fixtures/      # JSON mock data
    ├── types.js           # JSDoc type definitions
    └── utils.js           # Utility functions
```

## Routes

| Route | Description |
|-------|-------------|
| `/` | Redirect to projects |
| `/app/projects` | Projects dashboard |
| `/app/projects/[id]` | Project overview |
| `/app/projects/[id]/settings` | Project configuration |
| `/app/projects/[id]/scans` | Scan history |
| `/app/projects/[id]/scans/[scanId]` | Scan details |
| `/app/projects/[id]/proposals` | Proposals list |
| `/app/projects/[id]/proposals/[proposalId]` | Proposal review |
| `/app/audit` | Audit log |
| `/app/onboarding` | Setup wizard |
| `/app/account/integrations` | Integration status |

## API Endpoints

These endpoints are implemented as Next.js Route Handlers under `src/app/api/`. When `NEXT_PUBLIC_MOCK_MODE=true`, the browser UI uses `src/lib/api/mock-adapter.js` + fixtures instead of calling these routes.

### Authentication
- `GET /api/auth/me` - Current user + GitHub connection status
- `POST /api/auth/github/connect` - Start OAuth flow
- `POST /api/auth/github/pat` - Connect with PAT
- `POST /api/auth/github/disconnect` - Disconnect GitHub

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project
- `GET /api/projects/:id/settings` - Get settings
- `PUT /api/projects/:id/settings` - Update settings

### Scans & Proposals
- `POST /api/projects/:id/scan` - Run scan now
- `GET /api/projects/:id/scans` - List scans
- `GET /api/projects/:id/proposals` - List proposals
- `POST /api/projects/:id/proposals/:id/approve` - Approve
- `POST /api/projects/:id/proposals/:id/reject` - Reject
- `POST /api/projects/:id/proposals/:id/publish` - Publish to GitHub

### AI Service
- `GET /api/ai/status` - Check if AI is configured

## Security Notes

1. **OpenAI API Key**: Stored in environment variables, accessed only in server-side API routes, never exposed to client bundles
2. **GitHub Tokens**: Should be stored securely server-side, validated on each request
3. **No secrets in localStorage**: All sensitive data handled server-side
4. **File allowlists**: AI can only modify files explicitly allowed in project settings
5. **Manual approval**: All proposals require human review before publishing

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Docker

This repo includes a production-style Docker image that bundles:

- Next.js app (started with `pm2`) on **port 3000**
- Nginx on **port 80**, reverse-proxying to `http://127.0.0.1:3000` (see `default.conf`)

### Build

```bash
docker build -t nexusdocs .
```

Optional proxy build args (if your network requires it):

```bash
docker build -t nexusdocs \
  --build-arg HTTP_PROXY=http://proxy:8080 \
  --build-arg HTTPS_PROXY=http://proxy:8080 \
  --build-arg NO_PROXY=localhost,127.0.0.1 \
  .
```

### Run (Docker)

The container needs the same **required env vars** as local dev (at minimum: `DATABASE_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).

- **Via Nginx (recommended)**: map container port 80

```bash
docker run --rm -p 8080:80 --name nexusdocs \
  -e DATABASE_URL="mariadb://user:pass@host:3306/nexusdocs" \
  -e AUTH_SECRET="replace-me" \
  -e GOOGLE_CLIENT_ID="replace-me" \
  -e GOOGLE_CLIENT_SECRET="replace-me" \
  nexusdocs
```

- **Direct to Next.js**: map container port 3000

```bash
docker run --rm -p 3000:3000 --name nexusdocs \
  -e DATABASE_URL="mariadb://user:pass@host:3306/nexusdocs" \
  -e AUTH_SECRET="replace-me" \
  -e GOOGLE_CLIENT_ID="replace-me" \
  -e GOOGLE_CLIENT_SECRET="replace-me" \
  nexusdocs
```

### Run (Docker Compose)

`docker-compose.yml` currently builds the image and maps **host `3000` → container `3000`** (direct-to-Next.js). It also mounts `/etc/nginx/ssl/` as read-only for certificates, but `default.conf` is currently configured for HTTP on port 80 only.

```bash
docker compose up --build
```

Notes:
- Compose does **not** define a database service; you’ll need a reachable MariaDB/MySQL instance and `DATABASE_URL` provided to the container (e.g. via an `.env` file and `environment:`/`env_file:` in Compose).
- If you want to use Nginx in the container, map **`80:80`** instead of `3000:3000`.

## Cron / Scheduled Scans

For scheduled scans, call `GET` or `POST /api/cron/scans` from an external scheduler (e.g. Vercel Cron).

- Set `CRON_SECRET`
- Send `Authorization: Bearer <CRON_SECRET>`

## License

MIT
