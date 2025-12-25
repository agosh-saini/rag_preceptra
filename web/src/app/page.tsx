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

  // Queue state
  const [queue, setQueue] = useState<File[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchStatus, setBatchStatus] = useState<string>("");
  const [batchLogs, setBatchLogs] = useState<string[]>([]);

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

  // Handle folder selection
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const totalFiles = files.length;
      
      // Filter for likely text files
      const textFiles = files.filter(
        (f) =>
          f.type.startsWith("text/") ||
          f.name.endsWith(".md") ||
          f.name.endsWith(".json") ||
          f.name.endsWith(".csv") ||
          f.name.endsWith(".js") ||
          f.name.endsWith(".ts") ||
          f.name.endsWith(".tsx") ||
          f.name.endsWith(".py") ||
          f.name.endsWith(".txt") ||
          f.name.endsWith(".pdf")
      );
      
      setQueue(textFiles);
      setProcessedCount(0);
      setBatchStatus(`Found ${totalFiles} files. Queued ${textFiles.length} text files (filtered ${totalFiles - textFiles.length}).`);
      setBatchLogs([]);

      // Reset input so same folder can be selected again if needed
      e.target.value = "";
    }
  };

  // Process the queue
  const processQueue = async () => {
    if (queue.length === 0) return;
    setIsProcessing(true);
    setBatchStatus("Processing queue...");

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < queue.length; i++) {
      const file = queue[i];
      setBatchLogs((prev) => [`Processing: ${file.name}...`, ...prev]);

      try {
        let fileContent = "";
        const formData = new FormData();
        
        // Use filename as title, relative path (if available) as source
        const fileTitle = file.name;
        // webkitRelativePath is available on files from folder input
        const fileSource = file.webkitRelativePath || file.name;

        formData.append("title", fileTitle);
        formData.append("source", fileSource);
        formData.append("file", file);

        // Call ingest API
        const res = await fetch("/api/ingest", {
          method: "POST",
          // headers: { "Content-Type": "multipart/form-data" }, // fetch sets boundary automatically for FormData
          body: formData,
        });
        
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
        
        successCount++;
        setBatchLogs((prev) => [`✅ Success: ${file.name} (${json.chunks_inserted} chunks)`, ...prev]);
        
      } catch (err) {
        failCount++;
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === "object"
            ? JSON.stringify(err)
            : String(err);
        setBatchLogs((prev) => [`❌ Error ${file.name}: ${msg}`, ...prev]);
      }

      setProcessedCount(i + 1);
      
      // Delay before next request to respect rate limits
      if (i < queue.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    setIsProcessing(false);
    setBatchStatus(`Done. Success: ${successCount}, Failed: ${failCount}`);
    setQueue([]); // Clear queue after done? Or keep it? keeping it empty for now to reset.
  };

  const [answer, setAnswer] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  async function search() {
    setSearchStatus("Searching…");
    setAnswer("");
    setIsGenerating(false);
    
    try {
      // 1) Prepare context (Search)
      const resContext = await fetch("/api/prepare-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, k: 3 }), // Top 3 as requested
      });
      const jsonContext = await resContext.json();
      if (!resContext.ok) throw new Error(jsonContext?.error ?? `HTTP ${resContext.status}`);
      
      setResults((jsonContext.results ?? []) as SearchResult[]);
      setSearchStatus(`Found ${(jsonContext.results ?? []).length} matches.`);

      // 2) Generate Answer
      if (jsonContext.results && jsonContext.results.length > 0) {
        setIsGenerating(true);
        const resGen = await fetch("/api/generate-answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: jsonContext.prompt }),
        });
        const jsonGen = await resGen.json();
        if (!resGen.ok) throw new Error(jsonGen?.error ?? `HTTP ${resGen.status}`);
        
        setAnswer(jsonGen.answer);
      } else {
        setAnswer("No relevant documents found to answer the question.");
      }

    } catch (e) {
      setSearchStatus(e instanceof Error ? `Error: ${e.message}` : `Error: ${String(e)}`);
      setAnswer("");
    } finally {
        setIsGenerating(false);
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1>Personal Corpus</h1>
            <p className={styles.subtle}>
              Your private knowledge base. Ingest documents and ask questions.
            </p>
          </div>
        </header>

        <section className={styles.card}>
          <h2>1) Ingest text</h2>
          
          <div className={styles.tabs}>
            {/* Simple manual ingest */}
            <div className={styles.ingestGroup}>
                <h3>Manual Entry</h3>
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
                    Ingest One
                    </button>
                    <div className={styles.status}>{ingestStatus}</div>
                </div>
            </div>

            <hr className={styles.divider} />

            {/* Folder ingest */}
            <div className={styles.ingestGroup}>
                <h3>Batch Upload (Folder)</h3>
                <div className={styles.row}>
                    <label className={styles.label}>
                        Select Folder
                        <input
                            type="file"
                            className={styles.input}
                            // @ts-ignore - directory attributes are non-standard but supported
                            webkitdirectory=""
                            directory=""
                            mozdirectory=""
                            multiple
                            onChange={handleFolderSelect}
                        />
                    </label>
                    <button 
                        className={styles.button} 
                        onClick={processQueue} 
                        disabled={queue.length === 0 || isProcessing}
                    >
                        {isProcessing ? `Processing (${processedCount}/${queue.length})...` : "Process Queue"}
                    </button>
                </div>
                <div className={styles.status}>{batchStatus}</div>
                
                {batchLogs.length > 0 && (
                    <div className={styles.logs}>
                        {batchLogs.slice(0, 5).map((log, i) => (
                            <div key={i} className={styles.logEntry}>{log}</div>
                        ))}
                        {batchLogs.length > 5 && <div className={styles.logEntry}>...and {batchLogs.length - 5} more</div>}
                    </div>
                )}
            </div>
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
          
          {/* Answer Section */}
          {(isGenerating || answer) && (
            <div className={styles.answerBox}>
                <h3>Gemini Answer</h3>
                {isGenerating ? (
                    <div className={styles.animatePulse}>Generating answer...</div>
                ) : (
                    <div className={styles.answerText}>{answer}</div>
                )}
            </div>
          )}

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
