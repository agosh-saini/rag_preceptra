-- Supabase RPC tip:
-- Passing pgvector values through PostgREST can be finicky depending on client serialization.
-- This helper function accepts a plain float8[] and casts it to vector(768) inside Postgres.

create or replace function public.match_chunks_array(
  query_embedding float8[],
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
    1 - (c.embedding <=> (query_embedding::vector(768))) as similarity
  from public.chunks c
  where c.embedding is not null
  order by c.embedding <=> (query_embedding::vector(768))
  limit match_count;
$$;


