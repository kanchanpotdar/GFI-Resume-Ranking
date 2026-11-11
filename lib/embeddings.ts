import { pipeline, env } from "@xenova/transformers";

export const EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5";
export const EMBEDDING_DIMENSIONS = 384;

let pipelineInstance: any = null;

export async function getEmbeddingPipeline() {
  if (!pipelineInstance) {
    env.allowLocalModels = true;
    pipelineInstance = await pipeline("feature-extraction", "Xenova/bge-small-en-v1.5");
  }
  return pipelineInstance;
}

export function computeCosineSimilarity(vecA: number[], vecB: number[]): number {
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
  if (denom === 0) return 0;
  return dotProduct / denom;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const cleanText = (text || "").trim().slice(0, 2000);
  if (!cleanText) {
    return new Array(EMBEDDING_DIMENSIONS).fill(0);
  }

  // Optional server-side Hugging Face API call if configured
  const hfToken = process.env.HUGGINGFACE_API_KEY;
  if (hfToken && !hfToken.includes("your_token_here")) {
    try {
      const response = await fetch("https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: cleanText }),
      });

      if (response.ok) {
        const result = await response.json();
        if (Array.isArray(result) && typeof result[0] === "number") {
          return result as number[];
        }
      }
    } catch {
      // Fall back to verified local ONNX pipeline
    }
  }

  // Local verified BGE-small ONNX pipeline
  const extractor = await getEmbeddingPipeline();
  const output = await extractor(cleanText, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}
