export type Chunk = {
  index: number;
  content: string;
};

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Turn raw text into retrieval-friendly chunks.
 *
 * Why chunking matters:
 * - Embedding a whole document makes recall worse: the vector is a "blurry average".
 * - Chunking lets us retrieve the most relevant *parts* of a document.
 *
 * Strategy (simple + explainable):
 * - Split by paragraphs.
 * - Pack paragraphs until `maxChars`.
 * - Hard-split very large paragraphs.
 * - Add a small overlap so adjacent chunks share context (helps QA).
 *
 * This is a baseline; later we can add token-based chunking, headers, metadata, etc.
 */
export function chunkText(
  text: string,
  opts?: { maxChars?: number; overlapChars?: number }
): Chunk[] {
  const maxChars = opts?.maxChars ?? 1200;
  const overlapChars = opts?.overlapChars ?? 200;

  const paras = splitParagraphs(text);
  const chunks: Chunk[] = [];

  let current = "";
  let idx = 0;

  const flush = () => {
    const content = current.trim();
    if (!content) return;
    chunks.push({ index: idx++, content });
    current = "";
  };

  for (const p of paras) {
    if (!current) {
      current = p;
      continue;
    }

    if ((current + "\n\n" + p).length <= maxChars) {
      current = current + "\n\n" + p;
      continue;
    }

    flush();

    // If paragraph itself is huge, hard-split.
    if (p.length > maxChars) {
      let start = 0;
      while (start < p.length) {
        const end = Math.min(start + maxChars, p.length);
        const slice = p.slice(start, end).trim();
        if (slice) chunks.push({ index: idx++, content: slice });
        start = Math.max(0, end - overlapChars);
        if (start === end) start = end;
      }
      current = "";
    } else {
      current = p;
    }
  }

  flush();

  // Apply overlap across chunk boundaries for smaller chunks (cheap heuristic).
  // Overlap is appended to the *front* of the next chunk to preserve chunk_index ordering.
  if (overlapChars > 0 && chunks.length > 1) {
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1].content;
      const overlap = prev.slice(Math.max(0, prev.length - overlapChars));
      chunks[i] = { ...chunks[i], content: (overlap + "\n" + chunks[i].content).trim() };
    }
  }

  return chunks;
}


