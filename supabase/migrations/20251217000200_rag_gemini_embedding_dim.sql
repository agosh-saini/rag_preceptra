-- Align vector dimension with Gemini embeddings.
-- Google Gemini embedding models commonly return 768-dimension vectors.

-- Drop index before altering vector dimension.
drop index if exists public.chunks_embedding_ivfflat_idx;

alter table public.chunks
  alter column embedding type vector(768);

-- Recreate index with the new vector dimension.
create index if not exists chunks_embedding_ivfflat_idx
  on public.chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Replace RPC signature to match the new dimension.
drop function if exists public.match_chunks(vector(1536), int);

create or replace function public.match_chunks(
  query_embedding vector(768),
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


