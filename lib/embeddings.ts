import { pipeline, env } from "@xenova/transformers";

export const EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5";
export const EMBEDDING_DIMENSIONS = 384;
export const MAX_CHUNK_CHARS = 1500;
export const CHUNK_OVERLAP_CHARS = 150;

let pipelineInstance: any = null;

export async function getEmbeddingPipeline() {
  if (!pipelineInstance) {
    env.allowLocalModels = true;
    pipelineInstance = await pipeline("feature-extraction", "Xenova/bge-small-en-v1.5");
  }
  return pipelineInstance;
}

export function computeCosineSimilarity(
  vecA: number[] | null | undefined,
  vecB: number[] | null | undefined
): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  if (vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0 || !isFinite(denom)) return 0;
  const sim = dotProduct / denom;
  return isFinite(sim) ? Math.max(-1, Math.min(1, sim)) : 0;
}

function chunkText(text: string, maxLen = MAX_CHUNK_CHARS, overlap = CHUNK_OVERLAP_CHARS): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxLen;
    if (end < text.length) {
      // Look for a whitespace or period boundary near end
      const lastSpace = text.lastIndexOf(" ", end);
      if (lastSpace > start + maxLen * 0.7) {
        end = lastSpace;
      }
    } else {
      end = text.length;
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks.length > 0 ? chunks : [text];
}

/**
 * Generates canonical 384-dimensional BGE-small-en-v1.5 embeddings using local ONNX inference.
 * For empty text or unpopulated resumes, returns null (unscorable state).
 * For long texts exceeding model context, segments into chunks and mean-pools vectors.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const cleanText = (text || "").trim();
  if (!cleanText) {
    return null;
  }

  const extractor = await getEmbeddingPipeline();
  const chunks = chunkText(cleanText);

  if (chunks.length === 1) {
    const output = await extractor(chunks[0], { pooling: "mean", normalize: true });
    return Array.from(output.data);
  }

  // Multi-chunk pooling
  const pooled = new Float64Array(EMBEDDING_DIMENSIONS);
  for (const chunk of chunks) {
    const output = await extractor(chunk, { pooling: "mean", normalize: true });
    const data = output.data as Float32Array;
    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
      pooled[i] += data[i];
    }
  }

  // Mean-pool and re-normalize to unit L2 norm
  let sumSq = 0;
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    pooled[i] /= chunks.length;
    sumSq += pooled[i] * pooled[i];
  }
  const norm = Math.sqrt(sumSq);
  const result = new Array(EMBEDDING_DIMENSIONS);
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    result[i] = norm > 0 ? pooled[i] / norm : 0;
  }
  return result;
}
