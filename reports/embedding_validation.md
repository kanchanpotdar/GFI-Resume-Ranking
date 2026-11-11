# Embedding Integrity and Verification Report (Sprint 1.5)

## 1. Model & Tokenizer Identity
- **Model Name:** `BAAI/bge-small-en-v1.5`
- **Architecture:** `BertModel` (12 layers, 384 hidden dimensions, 12 attention heads)
- **Parameters:** ~33.5M parameters
- **Runtime Implementation:** `@xenova/transformers` with ONNX Runtime backend (`Xenova/bge-small-en-v1.5`, quantized ONNX graph `model_quantized.onnx`, 34.0 MB).
- **Fallback / Remote Route:** Direct server-side proxy calling Hugging Face inference router (`https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5`) when `HUGGINGFACE_API_KEY` is provided.

---

## 2. Preprocessing & Pooling Specification
- **Token Truncation:** Enabled with maximum sequence length of 512 tokens (character slice budget of 2,000 chars per role chunk).
- **Pooling Strategy:** `mean` pooling with L2 unit-norm normalization (`normalize: true`).
- **Query / Document Instruction:** In BGE retrieval tasks, document chunks are ingested without instruction prefix; JD reference text and candidate role chunks are tokenized directly with identical tokenizers and pooling to maintain symmetric cosine geometry.
- **Vector Dimension:** Verified strictly as **384** dimensions across 100% of candidate records.
- **Finite Check:** All 384 vector dimensions across all 46 extractable candidates were verified: 0 NaN, 0 Infinite values.

---

## 3. Parity Audit: Local ONNX vs Hosted Inference
- **Hosted HF Inference Status:** Unauthenticated requests to `https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5` return `HTTP 401 Unauthorized` without a bearer token.
- **Provider Parity Assessment:** Because no active third-party token was provided in the local environment, live hosted parity cannot be asserted as identical without empirical API traces. Per ADR-S02, the local ONNX execution was adopted as the **canonical, reproducible baseline pipeline** to eliminate runtime rate-limits, network latency, and provider drift.
- **Consistency Invariant:** Runtime live uploads in Sprint 2 use the **exact same ONNX pipeline (`Xenova/bge-small-en-v1.5`) and pooling/normalization functions** as the offline baseline, guaranteeing 100% mathematical comparability.

---

## 4. Semantic Normalization Reference Range
- **Observed Raw Cosine Distribution:**
  - LCA candidates vs LCA JD: $[0.505, 0.794]$
  - UI/UX candidates vs UI/UX JD: $[0.510, 0.804]$
  - Cross-domain pairs (e.g. Designer vs LCA JD): $[0.350, 0.460]$
- **Calibrated Reference Range:** $[0.50, 0.85]$
- **Normalization Formula:**
  $$\text{Normalized Cosine} = \frac{\min(0.85, \max(0.50, \text{raw})) - 0.50}{0.85 - 0.50} \in [0, 1]$$
- **Semantic Contribution Caps:**
  - LCA Role: Up to **15.0 points** ($15 \times \text{Normalized Cosine}$)
  - UI/UX Role: Up to **20.0 points** ($20 \times \text{Normalized Cosine}$)
  - This prevents high cosine similarity from overriding hard requirements (such as missing GaBi/SimaPro or missing Figma).
