-- More robust RPC for PostgREST:
-- Accept the embedding as jsonb (a JSON array of numbers), then cast inside Postgres.
--
-- This avoids Postgres array-literal parsing issues when calling RPCs via supabase-js.

create or replace function public.match_chunks_json(
  query_embedding jsonb,
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
  with emb as (
    select array_agg((x.value)::float8) as arr
    from jsonb_array_elements_text(query_embedding) as x(value)
  )
  select
    c.id as chunk_id,
    c.document_id,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> ((select arr from emb)::vector(768))) as similarity
  from public.chunks c
  where c.embedding is not null
  order by c.embedding <=> ((select arr from emb)::vector(768))
  limit match_count;
$$;


