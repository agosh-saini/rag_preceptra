import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { chunkText } from "@/lib/rag/chunk";
import { embedTexts } from "@/lib/embedding";

/**
 * POST /api/ingest
 *
 * Minimal ingestion endpoint for the RAG pipeline:
 * - creates a `documents` row
 * - chunks the provided text
 * - embeds each chunk (Gemini)
 * - stores chunks+embeddings into `public.chunks`
 *
 * This endpoint uses the Supabase **service role key** (server-side only).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      title?: string;
      source?: string;
      text: string;
    };

    if (!body?.text || body.text.trim().length < 1) {
      return NextResponse.json({ error: "Missing `text`" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // 1) Create a document row
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .insert({
        title: body.title ?? null,
        source: body.source ?? null,
      })
      .select("id")
      .single();

    if (docErr) throw docErr;

    // 2) Chunk
    const chunks = chunkText(body.text);
    const contents = chunks.map((c) => c.content);

    // 3) Embed (Gemini)
    const embeddings = await embedTexts(contents);
    if (embeddings.length !== contents.length) {
      throw new Error("Embedding count mismatch");
    }

    // 4) Store
    const rows = chunks.map((c, i) => ({
      document_id: doc.id,
      chunk_index: c.index,
      content: c.content,
      // pgvector column accepts an array of numbers via supabase-js
      embedding: embeddings[i],
    }));

    const { error: chunkErr } = await supabase.from("chunks").insert(rows);
    if (chunkErr) throw chunkErr;

    return NextResponse.json({
      document_id: doc.id,
      chunks_inserted: rows.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


