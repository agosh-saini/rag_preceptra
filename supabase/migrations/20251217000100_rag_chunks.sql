-- RAG schema: documents + chunks + vector search RPC
-- Uses pgvector for embeddings.

create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text,
  source text,
  created_at timestamptz not null default now()
);

create table if not exists public.chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

-- For ivfflat indexes, you must set a lists value; tune later as data grows.
create index if not exists chunks_embedding_ivfflat_idx
  on public.chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists chunks_document_id_idx on public.chunks (document_id);

-- Simple vector search across chunks.
create or replace function public.match_chunks(
  query_embedding vector(1536),
  match_count int default 10
)
returns table (
  chunk_id uuid,
  document_id uuid,
  chunk_index int,
  content text,
  similarity float
)
language sql stable
as $$
  select
    c.id as chunk_id,
    c.document_id,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  where c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;


