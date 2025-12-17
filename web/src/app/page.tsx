"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

type SearchResult = {
  chunk_id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
};

export default function Home() {
  const [title, setTitle] = useState("Notes");
  const [source, setSource] = useState("local");
  const [text, setText] = useState("");
  const [ingestStatus, setIngestStatus] = useState<string>("");

  const [query, setQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState<string>("");
  const [results, setResults] = useState<SearchResult[]>([]);

  const canIngest = useMemo(() => text.trim().length > 0, [text]);
  const canSearch = useMemo(() => query.trim().length > 0, [query]);

  async function ingest() {
    setIngestStatus("Ingesting…");
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, source, text }),
      });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setIngestStatus(
        `Inserted ${json.chunks_inserted} chunks (document ${json.document_id}).`
      );
    } catch (e) {
      setIngestStatus(e instanceof Error ? `Error: ${e.message}` : `Error: ${String(e)}`);
    }
  }

  async function search() {
    setSearchStatus("Searching…");
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, k: 8 }),
      });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setResults((json.results ?? []) as SearchResult[]);
      setSearchStatus(`Found ${(json.results ?? []).length} matches.`);
    } catch (e) {
      setSearchStatus(e instanceof Error ? `Error: ${e.message}` : `Error: ${String(e)}`);
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1>RAG Preceptra</h1>
            <p className={styles.subtle}>
              Paste text → chunk + embed (Gemini) → store in Supabase pgvector → semantic search.
            </p>
          </div>
          <a className={styles.link} href="/docs/rag.md" target="_blank" rel="noreferrer">
            RAG docs
          </a>
        </header>

        <section className={styles.card}>
          <h2>1) Ingest text</h2>
          <div className={styles.row}>
            <label className={styles.label}>
              Title
              <input
                className={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className={styles.label}>
              Source
              <input
                className={styles.input}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </label>
          </div>
          <label className={styles.label}>
            Document text
            <textarea
              className={styles.textarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste any text here…"
            />
          </label>
          <div className={styles.row}>
            <button className={styles.button} onClick={ingest} disabled={!canIngest}>
              Ingest
            </button>
            <div className={styles.status}>{ingestStatus}</div>
          </div>
        </section>

        <section className={styles.card}>
          <h2>2) Semantic search</h2>
          <div className={styles.row}>
            <input
              className={styles.input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask something or type keywords…"
            />
            <button className={styles.button} onClick={search} disabled={!canSearch}>
              Search
            </button>
          </div>
          <div className={styles.status}>{searchStatus}</div>
          <ol className={styles.results}>
            {results.map((r) => (
              <li key={r.chunk_id} className={styles.result}>
                <div className={styles.resultMeta}>
                  <span>sim {r.similarity.toFixed(3)}</span>
                  <span>chunk {r.chunk_index}</span>
                  <span className={styles.mono}>{r.document_id}</span>
                </div>
                <pre className={styles.resultText}>{r.content}</pre>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
