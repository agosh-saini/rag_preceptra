-- Tuning for small datasets:
-- With very few rows, an ivfflat index with a large `lists` value can return 0 matches
-- because the query probes an empty list. For development/small data, keep `lists` small.

drop index if exists public.chunks_embedding_ivfflat_idx;

create index if not exists chunks_embedding_ivfflat_idx
  on public.chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 1);


