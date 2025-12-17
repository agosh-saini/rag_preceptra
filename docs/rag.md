# RAG Pipeline (Chunk → Embed → Search)

This repo contains a minimal **Retrieval-Augmented Generation (RAG)** pipeline backed by **Supabase Postgres + pgvector**.

If you’re new to web development / TypeScript / Supabase, read `docs/teach.md` first.

## What exists today

- **Supabase schema**
  - `public.documents`: one row per ingested document
  - `public.chunks`: chunk text + vector embedding (`vector(768)`)
  - `public.match_chunks_json(...)`: SQL function that does cosine-similarity search (RPC-friendly)
- **Web app**
  - Next.js App Router scaffold
  - Server-side utilities for chunking + embeddings (Gemini)
  - (Next) API routes + UI to drive ingestion/search

## Prerequisites

- Node.js 20+
- Supabase CLI
- A Gemini API key (from Google AI Studio)

## Environment variables

### Web client (browser-exposed)'
Set in `web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_PUBLISHABLE_KEY"
```

### Server-only secrets (do NOT expose to browser)

Also set in `web/.env.local` (Next.js reads this on the server too), but **never** prefix these with `NEXT_PUBLIC_`:

```env
# local supabase project url (same as NEXT_PUBLIC_SUPABASE_URL)
SUPABASE_URL="http://127.0.0.1:54321"

# service role key (full access; server-side only)
SUPABASE_SERVICE_KEY="YOUR_SERVICE_ROLE_KEY"

# Gemini embeddings key (server-side only)
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

Tip: you can see your local Supabase keys with:

```bash
supabase status
```

## Apply database migrations

From the repo root:

```bash
supabase db reset
```

This applies:

- `supabase/migrations/20251217000100_rag_chunks.sql`
- `supabase/migrations/20251217000200_rag_gemini_embedding_dim.sql`

## How the pipeline works

### 1) Ingest (chunk + embed + store)

1. Create a `documents` row (title/source optional).
2. Chunk the raw text into ~1200-char chunks (with overlap).
3. Embed each chunk via Gemini embeddings API.
4. Insert into `chunks(document_id, chunk_index, content, embedding)`.

### 2) Search (embed query + vector match)

1. Embed the user’s query text with the same model.
2. Call `public.match_chunks(query_embedding, match_count)` to retrieve the top chunks.
3. Use those chunks as context for an LLM answer (not implemented yet).

## Troubleshooting

- **Studio works but API calls fail**: confirm `SUPABASE_URL` is `http://127.0.0.1:54321`
- **Embedding errors**: verify `GEMINI_API_KEY` is set in the environment of the Next.js server
- **Vector dimension mismatch**: run `supabase db reset` so the `vector(768)` migration is applied
