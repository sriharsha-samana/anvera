# Family Graph Enterprise Platform

Private, owner-governed, append-only, versioned family relationship graph platform with proposal workflow and rollback governance.

## Architecture

Clean Architecture + DDD layers:

- Domain: graph algorithms, governance rules, proposal/version business logic.
- Application: use-case services, transaction orchestration, policy enforcement.
- Infrastructure: Prisma, SQLite persistence, Winston logging, Ollama client.
- Interface: Express REST API with Zod validation and centralized error middleware.
- Presentation: Nuxt 3 + Vuetify + Pinia + Vue Query + Vue Flow.

## Repo Structure

- `/backend` TypeScript Express backend with Prisma.
- `/frontend` Nuxt 3 frontend.
- `/docker-compose.yml` full local stack.

## Core Domain Guarantees

- Only family owner can directly mutate people/relationships.
- Members submit proposals for mutation.
- Approved proposal creates immutable snapshot version.
- Rollback never deletes history and creates a new version.
- Rollback marks later approved proposals as overridden.
- Version history is append-only with full graph snapshots.
- All write flows run in DB transactions.
- AI is explanation-only (no mutation decisions).

## Backend API

- `POST /auth/register`
- `POST /auth/login`
- `GET /families`
- `POST /families`
- `GET /families/:id/persons`
- `POST /families/:id/persons` (owner only)
- `GET /families/:id/relationships`
- `POST /families/:id/relationships` (owner only)
- `POST /families/:id/proposals`
- `GET /families/:id/proposals`
- `POST /proposals/:id/approve`
- `POST /proposals/:id/reject`
- `GET /families/:id/versions`
- `POST /families/:id/rollback/:versionNumber`
- `GET /relationship?familyId=&personA=&personB=`
  - Optional: `culture=te` or `locale=te-IN` adds `kinshipTerm` (and legacy `term`) in response with `{ termKey, en, te, confidence }`
- `POST /ai/explain`
- `POST /ai/ask`

## AI Provider Switching

Backend supports pluggable providers via `AI_PROVIDER`:

- `ollama` (default local/docker)
- `openai_compatible` (generic OpenAI-compatible endpoint)
- `groq` (preconfigured OpenAI-compatible defaults)
- `openrouter` (preconfigured OpenAI-compatible defaults)
- `gemini`

Core env vars:

- `AI_PROVIDER`
- `LLM_API_KEY` for `openai_compatible|groq|openrouter`
- `LLM_BASE_URL` and `LLM_MODEL` (optional overrides for openai-compatible providers)
- `GEMINI_API_KEY` (for `gemini`)
- `OLLAMA_URL` and `OLLAMA_MODEL` (for `ollama`)

Examples:

```bash
# Groq
AI_PROVIDER=groq
LLM_API_KEY=your_groq_key
LLM_MODEL=llama-3.3-70b-versatile
```

```bash
# OpenRouter
AI_PROVIDER=openrouter
LLM_API_KEY=your_openrouter_key
LLM_MODEL=openai/gpt-4o-mini
```

```bash
# Gemini
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_key
```

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Backend env:

```bash
cp backend/.env.example backend/.env
```

3. Run Prisma migrate + seed:

```bash
npm run prisma:deploy -w backend
npm run prisma:seed -w backend
```

4. Start apps:

```bash
npm run dev -w backend
npm run dev -w frontend
```

## Docker

Single command:

```bash
docker-compose up --build
```

Services started:

- backend (http://localhost:4000)
- frontend (http://localhost:3000)
- sqlite volume service
- ollama optional profile (`--profile optional`)

## Cloud Deployment

Production VM deployment assets are available in [`deploy/`](./deploy):

- `deploy/docker-compose.cloud.yml` (frontend + backend + Caddy TLS proxy)
- `deploy/.env.cloud.example` (required environment variables)
- `deploy/DEPLOY_EC2.md` (step-by-step AWS EC2 guide)

## Testing

Backend (Jest + Supertest + coverage threshold 90%):

```bash
npm run test -w backend
```

Frontend (Vitest + Vue Testing Library):

```bash
npm run test -w frontend
```

## Seed Credentials

- Owner: `owner` / `owner123`
- Member: `member` / `member123`

## Fresh Start (Real User Flow)

1. Register a new account from the login page (`Sign In` -> `Register`) or `POST /auth/register`.
2. Sign in with your new credentials.
3. Create your own family from the Family Workspace.
4. Add yourself as a person in that family (recommended: person name exactly matches your username).
5. In Graph view:
   - `Focus on person` auto-selects if username matches a person name.
   - AI `I am` context auto-selects with the same username-name match and remains manually overrideable.
