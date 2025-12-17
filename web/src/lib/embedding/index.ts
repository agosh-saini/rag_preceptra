/**
 * Embeddings provider entrypoint.
 *
 * We standardize on one function (`embedTexts`) so the rest of the RAG pipeline
 * doesn't care whether we use Gemini/OpenAI/etc.
 */

export { embedTexts } from "./gemini";


