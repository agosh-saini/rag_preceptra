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
    let title: string | undefined;
    let source: string | undefined;
    let text: string | undefined;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      title = (formData.get("title") as string) || undefined;
      source = (formData.get("source") as string) || undefined;
      const explicitText = formData.get("text") as string | null;

      if (explicitText) {
        text = explicitText;
      } else if (file) {
        // Handle file upload
        const buffer = Buffer.from(await file.arrayBuffer());

        if (
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf")
        ) {
          // Parse PDF
          // @ts-ignore
          const pdf = require("pdf-parse");
          const data = await pdf(buffer);
          text = data.text;
        } else {
          // Assume text-based
          text = buffer.toString("utf-8");
        }

        if (!title) title = file.name;
        if (!source) source = file.name;
      }
    } else {
      // JSON fallback
      const body = (await req.json()) as {
        title?: string;
        source?: string;
        text: string;
      };
      title = body.title;
      source = body.source;
      text = body.text;
    }

    if (!text || text.trim().length < 1) {
      return NextResponse.json({ error: "Missing `text`" }, { status: 400 });
    }

    console.log(`[Ingest] Processing text of length: ${text.length}`);

    const supabase = createSupabaseAdmin();

    // 1) Create a document row
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .insert({
        title: title ?? null,
        source: source ?? null,
      })
      .select("id")
      .single();

    if (docErr) throw docErr;

    // 2) Chunk
    console.log("[Ingest] Starting chunkText...");
    const chunks = chunkText(text);
    console.log(`[Ingest] Generated ${chunks.length} chunks.`);

    const contents = chunks.map((c) => c.content);

    // 3) Embed (Gemini)
    console.log("[Ingest] Starting embedTexts...");
    const embeddings = await embedTexts(contents);
    console.log(`[Ingest] Generated ${embeddings.length} embeddings.`);

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
    let message = "Unknown error";
    if (e instanceof Error) {
      message = e.message;
    } else if (typeof e === "object" && e !== null) {
      // Handle Supabase errors or other objects
      message = (e as any).message ?? (e as any).error ?? JSON.stringify(e);
    } else {
      message = String(e);
    }
    console.error("Ingest error:", message); // Log specific error to terminal
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
