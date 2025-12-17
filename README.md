# RAG Preceptra

Local-first RAG (Retrieval-Augmented Generation) sandbox using:

- **Next.js** (`web/`) for the UI + API routes
- **Supabase local** (`supabase/`) for Postgres + pgvector + Studio
- **Gemini embeddings** for text → vector

## Start here

- **New to TypeScript / web apps?** Read `docs/teach.md`
- **RAG pipeline details**: `docs/rag.md`
- **Frontend project notes**: `web/README.md`

## Project structure

```ini
rag_preceptra/
├── web/              # Next.js frontend + API routes
├── supabase/         # Supabase local configuration + migrations
├── docs/             # Documentation (teach + rag)
└── keys/             # Local-only keys (do NOT commit)
```

## Local development

### Prereqs

- Node.js 20+
- Supabase CLI
- Docker Desktop running (Supabase local uses Docker)

### 1) Start Supabase locally

From repo root:

```bash
supabase start
```

Useful URLs:

- **Studio**: `http://localhost:54323`
- **API**: `http://127.0.0.1:54321`
- **DB**: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

### 2) Configure environment variables

Create `web/.env.local`:

```env
# Browser-safe (used by client-side code)
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_..."

# Server-only (used by Next.js API routes)
SUPABASE_SERVICE_KEY="sb_secret_..."
GEMINI_API_KEY="..."
```

Tip: print your local Supabase keys with:

```bash
supabase status
```

### 3) Apply DB migrations

```bash
supabase db reset
```

### 4) Run the web app

```bash
cd web
npm install
npm run dev
```

Open: `http://localhost:3000`

## Quick RAG smoke test

1) In the UI, ingest:
`Mango is a sweet tropical fruit.`

2) Search:
`sweet tropical fruit`

You should see the mango chunk returned.
