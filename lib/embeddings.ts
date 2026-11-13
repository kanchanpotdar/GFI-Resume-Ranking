import { pipeline, env } from "@xenova/transformers";

export const EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5";
export const EMBEDDING_DIMENSIONS = 384;
export const MAX_CHUNK_CHARS = 1500;
export const CHUNK_OVERLAP_CHARS = 150;

let pipelinePromise: Promise<any> | null = null;

export async function getEmbeddingPipeline() {
  if (!pipelinePromise) {
    env.allowLocalModels = true;
    pipelinePromise = pipeline("feature-extraction", "Xenova/bge-small-en-v1.5").catch((err) => {
      pipelinePromise = null;
      throw err;
    });
  }
  return pipelinePromise;
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

export function chunkText(text: string, maxLen = MAX_CHUNK_CHARS, overlap = CHUNK_OVERLAP_CHARS): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxLen;
    if (end < text.length) {
      // Look for a whitespace boundary near end
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
 * Parses, validates, and unit-normalizes raw Hugging Face feature-extraction API responses.
 * Handles 1D pooled vectors [384], 2D single-sequence vectors [[384]], and token-level 2D matrices [seq_len, 384].
 */
export function parseAndNormalizeHFResponse(rawData: any): number[] {
  let vec: number[];

  if (Array.isArray(rawData)) {
    if (typeof rawData[0] === "number" && rawData.length === EMBEDDING_DIMENSIONS) {
      vec = rawData as number[];
    } else if (Array.isArray(rawData[0])) {
      if (typeof rawData[0][0] === "number" && rawData[0].length === EMBEDDING_DIMENSIONS && rawData.length === 1) {
        vec = rawData[0] as number[];
      } else if (typeof rawData[0][0] === "number" && rawData[0].length === EMBEDDING_DIMENSIONS) {
        // Token embeddings [seq_len, 384] -> mean pool across token axis
        const seqLen = rawData.length;
        const meanPooled = new Float64Array(EMBEDDING_DIMENSIONS);
        for (let t = 0; t < seqLen; t++) {
          const tok = rawData[t] as number[];
          for (let d = 0; d < EMBEDDING_DIMENSIONS; d++) {
            meanPooled[d] += tok[d];
          }
        }
        vec = Array.from(meanPooled).map((v) => v / seqLen);
      } else {
        throw new Error(`Unexpected Hugging Face response dimension: array shape [${rawData.length}, ${rawData[0]?.length}]`);
      }
    } else {
      throw new Error(`Invalid data type in Hugging Face embedding array`);
    }
  } else {
    throw new Error(`Invalid response format from Hugging Face: expected array`);
  }

  // Strict finite validation & unit L2 normalization
  let sumSq = 0;
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    const val = vec[i];
    if (typeof val !== "number" || !Number.isFinite(val)) {
      throw new Error(`Non-finite value at index ${i} in Hugging Face embedding vector`);
    }
    sumSq += val * val;
  }
  const norm = Math.sqrt(sumSq);
  if (norm === 0 || !Number.isFinite(norm)) {
    throw new Error("Zero or non-finite norm from Hugging Face embedding vector");
  }

  const result = new Array(EMBEDDING_DIMENSIONS);
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    result[i] = vec[i] / norm;
  }
  return result;
}

/**
 * Mean-pools multiple 384-dimensional chunk vectors and re-normalizes to unit L2 length.
 */
export function poolAndNormalizeVectors(chunkVectors: number[][]): number[] {
  if (!chunkVectors || chunkVectors.length === 0) {
    throw new Error("Cannot pool empty chunk vector list");
  }
  if (chunkVectors.length === 1) {
    const single = chunkVectors[0];
    let sumSqSingle = 0;
    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
      const val = single[i];
      if (typeof val !== "number" || !Number.isFinite(val)) {
        throw new Error(`Non-finite component at index ${i} in embedding vector`);
      }
      sumSqSingle += val * val;
    }
    const singleNorm = Math.sqrt(sumSqSingle);
    if (singleNorm === 0 || !Number.isFinite(singleNorm)) {
      throw new Error("Embedding vector has zero or non-finite L2 norm");
    }
    return single.map((v) => v / singleNorm);
  }
  const pooled = new Float64Array(EMBEDDING_DIMENSIONS);
  for (const vec of chunkVectors) {
    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
      const val = vec[i];
      if (typeof val !== "number" || !Number.isFinite(val)) {
        throw new Error(`Non-finite component at index ${i} in chunk vector`);
      }
      pooled[i] += val;
    }
  }
  let sumSq = 0;
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    pooled[i] /= chunkVectors.length;
    sumSq += pooled[i] * pooled[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm === 0 || !Number.isFinite(norm)) {
    throw new Error("Pooled embedding vector has zero or non-finite L2 norm");
  }
  const result = new Array(EMBEDDING_DIMENSIONS);
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    result[i] = pooled[i] / norm;
  }
  return result;
}

/**
 * Calls hosted Hugging Face Inference API for BAAI/bge-small-en-v1.5.
 * Retries once cleanly on transient 429/503 responses.
 */
export async function generateEmbeddingHF(text: string, apiKey: string): Promise<number[]> {
  const url =
    process.env.HUGGINGFACE_API_URL ||
    "https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5/pipeline/feature-extraction";

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "x-use-cache": "true",
        "x-wait-for-model": "true"
      },
      body: JSON.stringify({
        inputs: text,
        parameters: {
          pooling: "mean",
          normalize: true
        }
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (response.ok) {
      const rawData = await response.json();
      return parseAndNormalizeHFResponse(rawData);
    }

    const errorText = await response.text();
    const isTransient = response.status === 429 || response.status === 503;
    if (isTransient && attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 800));
      continue;
    }
    throw new Error(`Hugging Face API error (${response.status}): ${errorText.slice(0, 160)}`);
  }

  throw new Error("Hugging Face API exhausted retry budget");
}

/**
 * Local ONNX inference pipeline using @xenova/transformers.
 */
async function generateEmbeddingLocal(chunks: string[]): Promise<number[]> {
  const extractor = await getEmbeddingPipeline();
  const chunkVectors: number[][] = [];

  for (const chunk of chunks) {
    const output = await extractor(chunk, { pooling: "mean", normalize: true });
    chunkVectors.push(Array.from(output.data));
  }

  return poolAndNormalizeVectors(chunkVectors);
}

/**
 * Generates canonical 384-dimensional BGE-small-en-v1.5 embeddings.
 * Multi-tier execution strategy:
 * 1. If HUGGINGFACE_API_KEY is present, calls hosted Hugging Face Inference API.
 * 2. If hosted call fails or key is omitted, executes local ONNX inference via @xenova/transformers.
 * 3. Never fabricates vectors on missing text (returns null for empty documents).
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const cleanText = (text || "").trim();
  if (!cleanText) {
    return null;
  }

  const chunks = chunkText(cleanText);
  const hfKey = process.env.HUGGINGFACE_API_KEY;

  if (hfKey) {
    try {
      const chunkVectors: number[][] = [];
      for (const chunk of chunks) {
        const vec = await generateEmbeddingHF(chunk, hfKey);
        chunkVectors.push(vec);
      }
      return poolAndNormalizeVectors(chunkVectors);
    } catch (hfErr: any) {
      console.warn("Hosted Hugging Face inference failed, falling back to local ONNX:", hfErr.message);
    }
  }

  // Local ONNX inference
  return generateEmbeddingLocal(chunks);
}
