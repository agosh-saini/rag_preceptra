import { NextResponse } from "next/server";
import { generateContent } from "@/lib/embedding/gemini";

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as { prompt: string };
        const prompt = body?.prompt;

        if (!prompt) {
            return NextResponse.json({ error: "Missing `prompt`" }, {
                status: 400,
            });
        }

        // Call Gemini 2.5 Flash
        const answer = await generateContent(prompt, "gemini-2.5-flash");

        return NextResponse.json({ answer });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("Generate answer error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
