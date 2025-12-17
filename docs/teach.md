# Teach Me: How This RAG App Works (No Web Dev Background Needed)

This doc explains **what’s happening in this repo** in plain English, with minimal web jargon.

You said you come from simulations + math programming, so I’ll use analogies like:

- **Function** = a mapping \(f(x)\rightarrow y\)
- **Database table** = a structured dataset
- **API endpoint** = a function callable over HTTP

---

## Big picture

We built a small system that can:

1) **Ingest** text (store it)
2) **Chunk** it (split into pieces)
3) **Embed** it (convert text → vector)
4) **Search** using vectors (find semantically similar chunks)

This is the core of RAG (Retrieval Augmented Generation). We are only doing the **retrieval** part here; “generation” (LLM answering with context) can be added later.

---

## The moving parts (what runs where)

### 1) Next.js web app (your UI + API)

- Runs at `http://localhost:3000`
- Contains:
  - **UI page** (what you see in the browser)
  - **API routes** (server functions the UI calls)

### 2) Supabase (local stack via Docker)

- Provides:
  - Postgres database
  - A REST/RPC gateway (PostgREST)
  - Studio UI at `http://localhost:54323`

### 3) Gemini embeddings API (Google)

- External service used to compute vectors for text.
- Your local system sends text → gets back an array of numbers.

---

## What “embedding” means (math view)

An **embedding** is a vector:

\[
\text{text} \rightarrow \mathbf{v}\in \mathbb{R}^{768}
\]

where “similar meaning” texts tend to have vectors close to each other (cosine distance / similarity).

We store those vectors in Postgres using `pgvector`, then do nearest-neighbor search.

---

## What happens when you click **Ingest**

UI calls:

`POST http://localhost:3000/api/ingest`

Server steps (in order):

1) Insert a row into `documents`
2) Split your text into chunks
3) For each chunk, call Gemini to get a 768-dim embedding
4) Insert rows into `chunks` (chunk text + embedding vector)

Files involved:

- `web/src/app/api/ingest/route.ts`
- `web/src/lib/rag/chunk.ts`
- `web/src/lib/embedding/gemini.ts`

Database tables:

- `public.documents`
- `public.chunks`

---

## What happens when you click **Search**

UI calls:

`POST http://localhost:3000/api/search`

Server steps:

1) Call Gemini to embed the query text
2) Call a Postgres function (RPC) to find the most similar chunk vectors
3) Return the best matching chunks to the UI

Files involved:

- `web/src/app/api/search/route.ts`
- `web/src/lib/embedding/gemini.ts`

Database function used:

- `public.match_chunks_json(...)`

---

## Why you sometimes saw “weird” results (like plant → dog)

Vector search always returns the “closest” thing it has, even if nothing is truly relevant.

With a small dataset, a broad query like “plant” might not have any good matches, so it returns the least-bad match (dog).

Two practical fixes:

- Use a **similarity threshold** (treat low similarity as “no match”)
- Ingest more relevant material (more data = better retrieval)

---

## Where your data lives (Supabase Studio)

Open `http://localhost:54323` → Table Editor:

- `documents`: each ingestion creates 1 row
- `chunks`: each ingestion creates 1+ chunk rows
  - `content`: the text
  - `embedding`: the vector

---

## Env vars (what they are and why some are “public”)

In `web/.env.local`:

### Browser-safe (exposed to client code)

These must start with `NEXT_PUBLIC_`:

```env
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_..."
```

### Server-only secrets (NEVER expose)

These must NOT start with `NEXT_PUBLIC_`:

```env
SUPABASE_SERVICE_KEY="sb_secret_..."
GEMINI_API_KEY="..."
```

Why: anything with `NEXT_PUBLIC_` can end up in the browser bundle.

---

## How to debug when something “doesn’t work”

### 1) Check the server logs

Your terminal running `npm run dev` shows:

- `POST /api/ingest ...`
- `POST /api/search ...`

If you see 500s, the error message is usually in the response (UI status line).

### 2) Confirm data exists in the DB

Studio → `chunks` table:

- Do you see new rows?
- Is `embedding` non-empty?

### 3) Run the automated smoke test

```bash
cd web
node scripts/rag_check.mjs "sweet tropical fruit"
```

This prints:

- how many chunks exist
- whether they have embeddings
- what the search returns

---

## Glossary (quick)

- **Next.js**: framework for React apps; provides UI pages and backend API routes in one project.
- **Route / endpoint**: a URL + method (like `POST /api/search`) that runs code on the server.
- **Supabase**: “backend in a box” using Postgres + REST/RPC APIs + auth/storage (we only use DB + RPC right now).
- **Postgres**: relational database.
- **pgvector**: Postgres extension that adds a `vector(n)` type and vector similarity operators.
- **RPC**: calling a Postgres function over HTTP via Supabase.

---

## Next improvements (optional, but recommended)

- Add **similarity threshold** (e.g. only show results if similarity ≥ 0.25)
- Add **document filters** (search only within a chosen document/source)
- Add **answer generation**: send top chunks to Gemini to generate an answer
