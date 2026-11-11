# Embedding Integrity and Verification Report (Sprint 1.5 Remediated)

## 1. Model & Tokenizer Identity
- **Model Name:** `BAAI/bge-small-en-v1.5`
- **Architecture:** `BertModel` (12 layers, 384 hidden dimensions, 12 attention heads)
- **Parameters:** ~33.5M parameters
- **Canonical Runtime Implementation:** `@xenova/transformers` with ONNX Runtime backend (`Xenova/bge-small-en-v1.5`, quantized ONNX graph `model_quantized.onnx`, 34.0 MB).
- **Single Canonical Pipeline:** Per remediation mandate, all unverified external network routes were removed from the primary scoring path. Local ONNX execution is the sole, authoritative embedding engine.

---

## 2. Preprocessing, Chunking & Multi-Chunk Pooling Specification
- **Multi-Chunk Segmentation:** Texts exceeding 1,500 characters are partitioned into overlapping segments (`MAX_CHUNK_CHARS = 1500`, `CHUNK_OVERLAP_CHARS = 150`) on word and sentence boundaries.
- **Pooling Strategy:** Each chunk is extracted using `mean` pooling with L2 unit-norm normalization (`normalize: true`). When multiple chunks exist, chunk vectors are mean-pooled and re-normalized:
  $$v_{\text{final}} = \frac{\sum_{i=1}^k v_i}{\left\|\sum_{i=1}^k v_i\right\|_2}$$
  This guarantees that resumes exceeding the context window contribute their entire text content to the semantic vector without arbitrary truncation.
- **Query / Document Conventions:** Symmetric cosine geometry is preserved by tokenizing both JD criteria and candidate chunks with the exact same tokenizer, mean-pooling, and unit L2 normalization.
- **Vector Dimension:** Verified strictly as **384** dimensions across 100% of extractable records.
- **Finite Check:** All 384 vector dimensions across all 46 extractable candidates were verified: 0 NaN, 0 Infinite values.
- **Empty Document Representation:** The empty document (`anonymized_resume_1793685080327.docx`) receives an explicit `null` vector rather than an artificial zero vector. Cosine similarity functions safely return `0.0` when encountering `null` vectors.

---

## 3. Hosted Provider Parity Assessment
- **Status:** Hosted Hugging Face inference without credentials returns `HTTP 401 Unauthorized`.
- **Architectural Decision:** To guarantee reproducibility, zero network latency, zero token costs, and immunity from provider model updates, local ONNX is established as the canonical baseline and runtime upload standard.
- **Consistency Invariant:** Runtime live uploads in Sprint 2 will invoke the exact same ONNX pipeline (`Xenova/bge-small-en-v1.5`) and multi-chunk pooling algorithm, guaranteeing 100% mathematical parity between baseline and uploaded resumes.

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
  - Strictly prevents high semantic similarity from overriding hard requirements (such as missing GaBi/SimaPro or missing Figma).
