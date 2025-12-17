import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

/**
 * Minimal local RAG sanity check.
 *
 * What it verifies:
 * - We can connect to Supabase with the service role key
 * - Chunks exist
 * - Chunk embeddings are non-null (required for vector search)
 * - `match_chunks` RPC returns results for a query embedding
 *
 * Usage:
 *   cd web
 *   node scripts/rag_check.mjs "your query"
 */

function parseDotEnv(contents) {
  const out = {};
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function requireEnv(name, env) {
  const v = env[name];
  if (!v) throw new Error(`Missing required env var: ${name} (check web/.env.local)`);
  return v;
}

async function embedGemini(text, geminiKey) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent" +
    `?key=${encodeURIComponent(geminiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: { parts: [{ text }] } }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini embeddings failed: ${res.status} ${body}`);
  }
  const json = await res.json();
  const values = json?.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Gemini embeddings response missing embedding.values");
  }
  return values;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "..", ".env.local");
const env = fs.existsSync(envPath)
  ? { ...process.env, ...parseDotEnv(fs.readFileSync(envPath, "utf8")) }
  : { ...process.env };

const supabaseUrl = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
  throw new Error(
    "Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in web/.env.local"
  );
}

const serviceKey = requireEnv("SUPABASE_SERVICE_KEY", env);
const geminiKey = requireEnv("GEMINI_API_KEY", env);

const queryText = process.argv.slice(2).join(" ").trim() || "axolotl";

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("Supabase URL:", supabaseUrl);

// Count chunks
const total = await supabase.from("chunks").select("*", { count: "exact", head: true });
if (total.error) throw total.error;
const totalCount = total.count ?? 0;

const nullEmb = await supabase
  .from("chunks")
  .select("*", { count: "exact", head: true })
  .is("embedding", null);
if (nullEmb.error) throw nullEmb.error;
const nullCount = nullEmb.count ?? 0;

console.log("chunks total:", totalCount);
console.log("chunks with embedding:", totalCount - nullCount);
console.log("chunks missing embedding:", nullCount);

if (totalCount === 0) {
  console.log("No chunks found. Ingest a document in the UI, then re-run this script.");
  process.exit(0);
}

// Inspect one stored embedding to confirm shape/serialization.
const sample = await supabase
  .from("chunks")
  .select("id, embedding, content")
  .limit(1)
  .single();
if (sample.error) throw sample.error;
console.log("\nSample stored chunk id:", sample.data.id);
console.log("Sample content preview:", String(sample.data.content).slice(0, 80).replace(/\s+/g, " "));
console.log("Sample embedding JS type:", typeof sample.data.embedding);
if (Array.isArray(sample.data.embedding)) {
  console.log("Sample embedding length:", sample.data.embedding.length);
} else {
  console.log("Sample embedding value (truncated):", String(sample.data.embedding).slice(0, 120));
}

// Sanity check: if we feed the stored embedding back into the RPC,
// we should at least retrieve the same chunk.
try {
  const storedArr = Array.isArray(sample.data.embedding)
    ? sample.data.embedding
    : JSON.parse(String(sample.data.embedding));
  console.log("\nSelf-match test embedding length:", storedArr.length);
  const self = await supabase.rpc("match_chunks_json", {
    query_embedding: storedArr,
    match_count: 3,
  });
  if (self.error) throw self.error;
  console.log("Self-match result count:", (self.data ?? []).length);
  if ((self.data ?? []).length > 0) {
    console.log("Self-match top chunk_id:", self.data[0].chunk_id);
  }
} catch (e) {
  console.log("\nSelf-match test failed:", e instanceof Error ? e.message : String(e));
}

// Show a few most recent chunks so we can confirm multiple ingests are present.
const recent = await supabase
  .from("chunks")
  .select("id, document_id, chunk_index, content, created_at")
  .order("created_at", { ascending: false })
  .limit(5);
if (recent.error) throw recent.error;
console.log("\nMost recent chunks:");
for (const c of recent.data ?? []) {
  const preview = String(c.content).replace(/\s+/g, " ").slice(0, 120);
  console.log(`- ${c.id} doc=${c.document_id} idx=${c.chunk_index} ${preview}${preview.length >= 120 ? "…" : ""}`);
}

// Vector search smoke test
console.log("\nEmbedding query via Gemini:", JSON.stringify(queryText));
const queryEmbedding = await embedGemini(queryText, geminiKey);
console.log("query embedding dims:", queryEmbedding.length);

const rpc = await supabase.rpc("match_chunks_json", {
  query_embedding: queryEmbedding,
  match_count: 5,
});
if (rpc.error) throw rpc.error;

console.log("\nTop matches:");
console.log("match count:", (rpc.data ?? []).length);
for (const r of rpc.data ?? []) {
  console.log(
    `- sim=${Number(r.similarity).toFixed(3)} chunk=${r.chunk_index} doc=${r.document_id}`
  );
  const preview = String(r.content).replace(/\s+/g, " ").slice(0, 160);
  console.log(`  ${preview}${preview.length >= 160 ? "…" : ""}`);
}


