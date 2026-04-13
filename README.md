# ProductOS — AI PRD Builder

> An AI-powered Product Requirements Document builder for Telus Digital's internal product management team. Transform rough ideas, meeting notes, or simple prompts into comprehensive, client-grounded product documents.

---

## What it does

ProductOS is a full-stack web application that acts as an always-available Chief Product Officer. It:

- **Generates 6 document types** from a prompt: PRD, User Stories, Technical Spec, Product Brief, Roadmap, OKRs
- **Streams output token-by-token** via Server-Sent Events — results appear within 800ms
- **Enforces Gherkin BDD** — every acceptance criteria block is parsed and reformatted server-side if non-compliant; malformed ACs never reach the client
- **Generates analytics instrumentation plans** paired with every success metric (event name, trigger, properties, platform)
- **CPO Review mode** — a slide-in panel that streams a structured 7-section review including assumption audit, user empathy score, and analytics readiness check
- **Client context injection** — every project has a `clientContext` field (client name, industry, goals, users, tech constraints) injected into every AI call, ensuring output is never generic
- **Integrates with** Jira, Confluence, Slack, Figma, and Google Drive
- **Versions every save** — full version history with side-by-side diff view and one-click restore

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS |
| Editor | TipTap (ProseMirror) with custom extensions |
| State | Zustand |
| Backend | Node.js + Express + TypeScript |
| AI | Anthropic Claude (`claude-sonnet-4-20250514`) via `@anthropic-ai/sdk` |
| Database | PostgreSQL via Prisma ORM (SQLite for local dev) |
| Auth | JWT (Auth0/Clerk-ready) |
| Exports | PDF (pdfkit), Markdown, Confluence, Google Drive |
| Deployment | Docker + docker-compose / AWS ECS / Railway |

---

## Project structure

```
/
├── client/                   React frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/           Badge, Modal, LoadingSpinner
│   │   │   ├── editor/       RichEditor (TipTap), GherkinRenderer, CPOReviewDrawer
│   │   │   └── layout/       Layout, Sidebar
│   │   ├── pages/            All 8 pages
│   │   ├── stores/           authStore, projectStore, documentStore (Zustand)
│   │   └── services/         api.ts (axios + SSE stream helpers)
├── server/                   Express backend
│   ├── src/
│   │   ├── controllers/      document, project, auth, settings, export
│   │   ├── services/
│   │   │   ├── aiService.ts      Anthropic streaming + post-processing
│   │   │   ├── prompts.ts        All AI prompts as exported constants
│   │   │   ├── acParser.ts       GIVEN/WHEN/THEN parser + validator
│   │   │   ├── auditService.ts   Audit log writer
│   │   │   └── integrations/     jira, confluence, slack, figma, gdrive
│   │   ├── middleware/       auth (JWT), rateLimiter, logger (Winston), errorHandler
│   │   ├── routes/           projects, documents, integrations, settings, auth
│   │   └── prisma/           schema.prisma + seed.ts
│   └── src/__tests__/        Jest unit tests for acParser + prompts
└── shared/                   Types shared between client and server
    └── types/index.ts
```

---

## Getting started

### Prerequisites

- Node.js 22+
- npm 10+
- PostgreSQL 16+ (or use SQLite for local dev — see below)
- An Anthropic API key

### 1. Clone and install

```bash
git clone <repo-url> productos
cd productos
npm install
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
# Edit server/.env — at minimum set:
#   ANTHROPIC_API_KEY=sk-ant-...
#   JWT_SECRET=some-random-secret
#   DATABASE_URL=file:./dev.db  (SQLite) or postgresql://...
```

### 3. Run database migrations

```bash
# For SQLite (local dev — no Postgres needed)
cd server
DATABASE_URL="file:./dev.db" npx prisma migrate dev --name init
DATABASE_URL="file:./dev.db" npx prisma db seed

# For PostgreSQL
npx prisma migrate dev --name init
npx prisma db seed
```

### 4. Start the app

```bash
# From the root
npm run dev

# This starts:
#   server on http://localhost:3001
#   client on http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173) and log in with the seeded user:
- Email: `pm@telus.com`
- Password: (register a new account — the seed creates the user data but not a password)

---

## Docker (production)

```bash
cp server/.env.example server/.env
# Fill in your API keys

docker-compose up --build
# App: http://localhost
# API: http://localhost:3001
# API docs: http://localhost:3001/api/docs
```

---

## Key design decisions

### Client context injection
Every project has a `clientContext` string (free-text: client name, industry, goals, user types, tech constraints, regulatory context). This is prepended to every AI call for that project at runtime, ensuring all generated content is grounded in that client's specific reality — not generic product thinking.

The global `UserSettings.systemPromptPrefix` is prepended before `clientContext`, allowing Telus Digital brand voice and standards to apply across all calls.

### GIVEN/WHEN/THEN enforcement
The `acParser.ts` service validates every acceptance criteria block after AI generation. If the output does not contain valid Gherkin syntax, `reformatAcceptanceCriteria()` rewrites it before the content reaches the client. This is a server-side invariant — malformed ACs are never surfaced.

### SSE streaming architecture
Generation and CPO review use `fetch()` with a `ReadableStream` reader rather than `EventSource`, because `EventSource` does not support POST requests. The client processes `data:` lines and emits `delta` events token-by-token, `section` events when a review heading is detected, and a final `done` event with the complete content.

### Analytics instrumentation
Every success metric in a PRD or OKRs document is accompanied by a concrete analytics plan: `snake_case` event name, trigger, properties to capture, platform recommendation, and deduplication notes. The AI is explicitly instructed to suggest full funnel event sequences for conversion metrics.

---

## API reference

Interactive docs: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)

Key endpoints:

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login → JWT |
| `GET` | `/api/projects` | List projects |
| `POST` | `/api/projects` | Create project (sets clientContext) |
| `POST` | `/api/documents/generate` | **AI generation (SSE stream)** |
| `POST` | `/api/documents/:id/review` | **CPO review (SSE stream)** |
| `GET` | `/api/documents` | List + search documents |
| `GET` | `/api/documents/:id/versions` | Version history |
| `POST` | `/api/documents/:id/export` | Export PDF/MD/Confluence/GDrive |
| `POST` | `/api/integrations/jira/push` | Push stories to Jira |
| `GET` | `/api/settings` | Get user settings |
| `PATCH` | `/api/settings` | Update settings |

Rate limiting: 20 AI generation requests per user per hour.

---

## Running tests

```bash
cd server
npm test
# or
npm test -- --coverage
```

Tests cover:
- `acParser.ts` — parsing, validation, reformatting, document-level compliance check
- `prompts.ts` — all prompt constants contain required placeholders and content

---

## Assumptions

1. **SQLite is used for local development** (`file:./dev.db`). The Prisma schema uses SQLite as the default datasource provider. To switch to PostgreSQL for production, change `provider = "sqlite"` to `provider = "postgresql"` in `schema.prisma`.

2. **Auth is JWT-based with local email/password for dev**. The architecture is Auth0/Clerk-ready — replace the `register`/`login` controllers with an OAuth callback that issues a JWT from the Auth0 `sub` claim.

3. **OAuth tokens for integrations are stored in plain text** in the `integrations` table. In production, encrypt with AES-256 using a KMS-managed key before writing.

4. **The `avatarUrl` field temporarily stores password hashes** (prefixed with `hash:`) for dev simplicity. In production, add a `passwordHash` column to the User model and remove this hack.

5. **PDF export** uses pdfkit for simple text rendering. For styled exports matching the app's UI, replace with headless Chrome / Puppeteer rendering of the HTML editor output.

6. **Figma integration** requires the user to have a Figma access token. The integration currently uses the Figma REST API with a user-provided token — production flow should use Figma's OAuth2.

7. **Document content** is stored as a JSON string (TipTap ProseMirror format). Full-text search uses SQLite `LIKE` operator; in production with PostgreSQL, use `pg_trgm` or `tsvector` for performant full-text search.
