import { requireEnv } from "../env";

/**
 * Calls the Gemini Embeddings API to embed text.
 *
 * Notes:
 * - This is a SERVER-SIDE utility. Do not call it from the browser.
 * - Requires `GEMINI_API_KEY` in the environment.
 * - We use the REST API directly to avoid extra SDK dependencies.
 *
 * Docs: https://ai.google.dev/gemini-api/docs/embeddings
 */

type GeminiEmbedContentResponse = {
  embedding?: { values: number[] };
};

async function embedOne(text: string): Promise<number[]> {
  const apiKey = requireEnv("GEMINI_API_KEY");

  // `text-embedding-004` is the recommended general-purpose embedding model.
  // Endpoint format: .../v1beta/models/{model}:embedContent?key=...
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent" +
    `?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: {
        // "parts" is the standard Gemini content shape.
        parts: [{ text }],
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini embeddings failed: ${res.status} ${body}`);
  }

  const json = (await res.json()) as GeminiEmbedContentResponse;
  const values = json.embedding?.values;
  if (!values || values.length === 0) {
    throw new Error("Gemini embeddings response missing embedding.values");
  }
  return values;
}

/**
 * Embed many texts. This uses simple sequential calls to keep the implementation
 * easy to understand. We can batch/parallelize later if needed.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (const t of texts) out.push(await embedOne(t));
  return out;
}
/**
 * Calls the Gemini GenerateContent API to generate text.
 */
export async function generateContent(
  prompt: string,
  model: string = "gemini-2.5-flash",
): Promise<string> {
  const apiKey = requireEnv("GEMINI_API_KEY");

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${
      encodeURIComponent(apiKey)
    }`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini generation failed: ${res.status} ${body}`);
  }

  const json = await res.json() as any;
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini response missing text");
  }

  return text;
}
