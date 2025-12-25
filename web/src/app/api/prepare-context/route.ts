import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { embedTexts } from "@/lib/embedding";

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as { query: string; k?: number };
        const query = body?.query?.trim();
        // Default to k=3 as requested for context
        const k = Math.max(1, Math.min(50, body?.k ?? 3));

        if (!query) {
            return NextResponse.json({ error: "Missing `query`" }, {
                status: 400,
            });
        }

        const [queryEmbedding] = await embedTexts([query]);
        const supabase = createSupabaseAdmin();

        // Search for relevant chunks
        const { data: results, error } = await supabase.rpc(
            "match_chunks_json",
            {
                query_embedding: queryEmbedding,
                match_count: k,
            },
        );

        if (error) throw error;

        const safeResults = results ?? [];

        console.log(`[PrepareContext] Query: "${query}"`);
        console.log(`[PrepareContext] Found ${safeResults.length} chunks.`);
        if (safeResults.length > 0) {
            console.log(
                `[PrepareContext] Top similarity: ${safeResults[0].similarity}`,
            );
        }

        // Construct the context string
        let contextText = "";
        safeResults.forEach((r: any, i: number) => {
            contextText += `--- Document ${i + 1} (Score: ${
                r.similarity.toFixed(3)
            }) ---\n`;
            contextText += `${r.content}\n\n`;
        });

        // Create the final prompt
        const prompt =
            `You are a helpful assistant acting as a second brain for the user.
The user has provided the following context from their personal notes and documents (what they already know/have stored).
Your goal is to answer the user's question using *only* this information.

Instructions:
1. Treat the provided text as the user's own knowledge base.
2. Answer the question comprehensively using this knowledge.
3. If the answer is found in the notes, explain it clearly as if reminding the user of what they wrote/read.
4. If the answer is not in the notes, state that you couldn't find that specific information in their current knowledge base.

Context (User's Notes):
${contextText}

Question: ${query}

Answer:`;

        return NextResponse.json({
            prompt,
            results: safeResults,
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("Prepare context error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
