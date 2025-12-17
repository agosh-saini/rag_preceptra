import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { embedTexts } from "@/lib/embedding";

/**
 * POST /api/search
 *
 * Minimal semantic search endpoint:
 * - embed the query text (Gemini)
 * - call Postgres RPC `match_chunks` to do vector similarity search
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { query: string; k?: number };
    const query = body?.query?.trim();
    const k = Math.max(1, Math.min(50, body?.k ?? 8));

    if (!query) {
      return NextResponse.json({ error: "Missing `query`" }, { status: 400 });
    }

    const [queryEmbedding] = await embedTexts([query]);

    const supabase = createSupabaseAdmin();
    // Use the *_json RPC to avoid pgvector/array serialization edge cases over PostgREST.
    const { data, error } = await supabase.rpc("match_chunks_json", {
      query_embedding: queryEmbedding,
      match_count: k,
    });

    if (error) throw error;

    return NextResponse.json({ results: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


