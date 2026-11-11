# Sprint 2 Verification & Sprint 3 Implementation Report
**Growth For Impact — Resume Screening & Ranking Decision-Support System**  
**Date:** November 11, 2026  
**Status:** Complete & Verified  

---

## 1. Executive Summary

This report documents the completion of **Sprint 2 Verification** and **Sprint 3 Implementation (IndexedDB Persistence, Application Quality, Privacy Audit, and Automated Verification)**.

All objectives set forth in `sprintplan.md`, `decisions.md`, and the assignment rubric have been achieved and verified through live automated test suites and end-to-end HTTP endpoint validation.

| Milestone / Gate | Scope | Status | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Sprint 2 HTTP Verification** | Live `/api/upload` endpoint validation with real DOCX/PDF | **PASS** | `scripts/verify_sprint2_http.py` (9/9 tests pass) |
| **Magic-Byte & Duplicate Defense** | Binary verification (`%PDF`, `PK\x03\x04`), SHA-256 deduplication | **PASS** | Tests 1, 5, 6 in verification suite |
| **Sprint 3 IndexedDB Layer** | Browser persistence (`idb`), quota fallback, delete/reset controls | **PASS** | `lib/db.ts`, `DashboardClient.tsx` |
| **Application Quality & Scope** | Independent dual-role ranking, 3-tier deterministic tie-breaking | **PASS** | Scope selector (`qualified_only` vs `all_resumes`), deterministic sort |
| **Privacy & Security Audit** | PII scan in baseline, git history, error sanitization | **PASS** | 0 emails, 0 phone numbers, 0 tracked DOCX files |
| **Automated Test Suite** | 26 unit and integration test assertions | **PASS** | `npm test` passing 26/26 in 559ms |
| **Deployment Compatibility** | Vercel serverless analysis and local/production build verification | **PASS** | Clean build (`npm run build`), Next.js daemon running |

---

## 2. Phase 1 — Sprint 2 HTTP Verification Findings

The `/api/upload` HTTP endpoint was verified against running production Next.js instance on port 3000 using `scripts/verify_sprint2_http.py`.

### 2.1 Benchmark Results & Latency

```
=================================================================
SPRINT 2 END-TO-END HTTP ENDPOINT & PIPELINE VERIFICATION
=================================================================
✔ Test 1: Baseline DOCX Duplicate Detection          [PASS] (472.8ms - detected exact SHA-256 duplicate)
✔ Test 2: New DOCX LCA Full Pipeline & Cold Start    [PASS] (910.3ms - parsed, embedded, scored 99.7/100)
✔ Test 3: New PDF UI/UX Pipeline & Warm Inference    [PASS] (155.7ms - parsed, embedded, scored 94.8/100)
✔ Test 4: Unsupported Format Rejection (.txt)        [PASS] (2.6ms - 400 Bad Request)
✔ Test 5: Content Magic Byte Verification (PDF)      [PASS] (2.4ms - 400 Bad Request)
✔ Test 6: Content Magic Byte Verification (DOCX)     [PASS] (2.3ms - 400 Bad Request)
✔ Test 7: 0-Byte Empty File Rejection                [PASS] (1.7ms - 400 Bad Request)
✔ Test 8: 5MB Size Limit Enforcement                 [PASS] (7.3ms - 400 Bad Request)
✔ Test 9: Empty Document Zero-Score Handling         [PASS] (15.3ms - 200 OK, zero score, neither)
=================================================================
ALL 9 HTTP ENDPOINT VERIFICATION TESTS PASSED SUCCESSFULLY!
```

### 2.2 Cold Start vs Warm Inference
- **Cold Start (Test 2, New DOCX):** 910.3 ms total HTTP roundtrip. This includes reading the DOCX XML with `mammoth`, running regex/state-machine attribute extraction, executing ONNX Runtime inference for `BAAI/bge-small-en-v1.5` over two text chunks, computing dual-role scoring rubrics, and evaluating eligibility.
- **Warm Inference (Test 3, New PDF):** 155.7 ms total HTTP roundtrip. Once the ONNX model session is resident in Node memory, inference latency drops by over 80%.
- **Zero Fabrication:** Empty documents (Test 9) extract with `extractionStatus: "empty_document"`, produce zero vector embeddings (`null`), score strictly 0.0/100 on both roles, and are classified as `neither_or_uncertain`.

---

## 3. Phase 2 — Sprint 3 IndexedDB Persistence Architecture

### 3.1 Store Schema & Key Path (`lib/db.ts`)
- **Database:** `gfi_resume_ranking_db` (Version 1)
- **Object Store:** `uploaded_candidates`
  - **Key Path:** `candidateId` (string, e.g. `candidate_1794401581328_74344e`)
  - **Indexes:**
    - `by-sha256`: `sha256` hash (unique file fingerprint)
    - `by-uploadedAt`: ISO timestamp of upload
  - **Payload:** Full candidate record including extraction, 5-subscore breakdown, dual-role eligibility flags, 384-dimensional dense vectors, classification, and optional document binary blob.

### 3.2 Quota Exceeded Degradation
Browsers enforce strict per-origin storage quotas. When multiple large PDFs/DOCXs are uploaded, storing multi-megabyte `Blob` objects can trigger `DOMException: QuotaExceededError`.
- `lib/db.ts` intercepts quota exceptions.
- If storage quota is reached, it sheds the bulky binary file blob while preserving 100% of the structured extraction, embeddings, and score records (< 50 KB per candidate).
- The user is notified via an alert banner: *"Resume data saved (storage quota reached: original binary file was omitted)."*

### 3.3 Lifecycle Controls: Delete & Reset
1. **Per-Candidate Deletion:** A delete action (trash icon) appears exclusively on uploaded candidate cards (`sourceType === "local_upload"`). Clicking triggers a confirmation modal before calling `deleteUploadedCandidate(candidateId)`.
2. **Clear All Uploads (Reset):** If `uploadedCount > 0`, a *"Reset Uploads"* button appears in the dashboard header. A confirmation dialog prevents accidental loss. Baseline candidates are completely untouched.
3. **Read-Only Baseline:** The 47 baseline candidates are immutable reference records served from the verified dataset and cannot be deleted or modified in local storage.

---

## 4. Phase 3 — Application Quality & Ranking Scope

### 4.1 Independent Dual-Role Ranking Scope
To fulfill the requirement that *"candidates can be ranked against both job descriptions independently, even when their classification is neither/uncertain"*:
- A **Scope Selector** was added to the LCA and UI/UX tabs:
  - **Option 1: Qualified Only (Default):** Displays candidates matching the role's classification threshold ($\ge 50$ points).
  - **Option 2: All Resumes Ranked for Role:** Displays **all** candidates (including UI/UX specialists and Neither/Uncertain applicants) ranked by their score for that specific role.
- This allows recruiters to immediately answer: *"If this UI/UX applicant applied for LCA, where would they stand?"* without compromising their formal qualification classification.

### 4.2 Three-Tier Deterministic Tie-Breaking
To guarantee 100% reproducible ordering regardless of input sequence or browser refresh:
1. **Tier 1 (Primary):** Total Score descending (`bScore.totalScore - aScore.totalScore`)
2. **Tier 2 (Secondary):** Relevant Experience duration descending (`bExp - aExp`)
3. **Tier 3 (Final Tie-Breaker):** Candidate ID ascending alphanumeric (`a.candidateId.localeCompare(b.candidateId)`)

Automated verification in `tests/sprint3_persistence.test.js` confirms that reversing the input candidate array produces the exact same rank sequence.

---

## 5. Phase 4 — Privacy & Security Audit

| Audit Area | Inspection Method | Finding | Verdict |
| :--- | :--- | :--- | :--- |
| **Baseline Dataset PII** | Regex scan for emails and phone numbers across `data/baseline.json` | 0 emails, 0 phone numbers (only SHA-256 hashes and candidate IDs) | **PASS** |
| **Git Tracked Files** | `git ls-files` check for `.env` or raw `.docx` resumes | 0 sensitive files tracked; `.docx` and `.env` strictly gitignored | **PASS** |
| **API Error Leaks** | Inspect server error responses on malformed input | Internal stack traces, server paths, and exception names scrubbed | **PASS** |
| **Client-Supplied Data** | Tampering test on `/api/upload` payload | Server ignores client metadata; candidateId, sha256, scores generated server-side | **PASS** |

---

## 6. Phase 5 — Automated Test Suite Results

The automated regression and integration suite was expanded to **26 tests** spanning Sprint 0, Sprint 1, Sprint 1.5, Sprint 2, and Sprint 3:

```
> node --import tsx --test tests/*.test.js

✔ Sprint 0 Gate: Input manifest exists and contains 47 verified entries (1.14ms)
✔ Sprint 0 Gate: Verbatim JD files exist with complete text (0.43ms)
✔ Sprint 0 Gate: Scoring rubrics sum strictly to 100 points for both roles (0.56ms)
✔ Sprint 0 Gate: .env.example exists and contains no live secrets (0.36ms)
✔ Sprint 1 Gate 1: Baseline dataset accounts for all 47 resumes with valid schema (13.62ms)
✔ Sprint 1 Gate 2: Empty document record is explicitly zero-scored and classified as neither_or_uncertain (10.18ms)
✔ Sprint 1 Gate 3: Subscores are strictly bounded within approved component budgets (10.07ms)
✔ Sprint 1 Gate 4: Embeddings are 384-dimensional with finite numbers (20.95ms)
✔ Sprint 1 Gate 5: ADR-S01 Experience conflict notice is explicitly attached to LCA evaluations (13.84ms)
✔ Sprint 1 Gate 6: Classification matches independent threshold logic (12.77ms)
✔ Sprint 1.5 Remediation: Multi-line project grouping without orphan inflation (19.25ms)
✔ Sprint 1.5 Remediation: Education association links degree with university and year (14.99ms)
✔ Sprint 1.5 Remediation: Calibrated 4-tier ISO standards scoring (13.04ms)
✔ Sprint 1.5 Remediation: Strict GaBi/SimaPro vs OpenLCA scoring rules (14.95ms)
✔ Sprint 1.5 Remediation: Non-fabrication of dates and zero-default duration (13.67ms)
✔ Sprint 3 Gate 1: SHA-256 duplicate detection distinguishes identical content with different names (0.89ms)
✔ Sprint 3 Gate 2: Binary magic bytes validation for PDF and DOCX (0.12ms)
✔ Sprint 3 Gate 3: Error messages never expose internal stack traces or server paths (0.09ms)
✔ Sprint 3 Gate 4: Independent dual-role evaluation allows cross-role comparison (9.23ms)
✔ Sprint 3 Gate 5: Deterministic tie-breaking produces identical ranking sequence (18.53ms)
✔ Sprint 2 Gate: Runtime extractor parses DOCX and matches baseline attributes (43.70ms)
✔ Sprint 2 Gate: Scoring parity between runtime extraction and baseline scores (10.26ms)
✔ Sprint 2 Gate: Empty document runtime upload produces zero scores and neither classification (0.38ms)
✔ Sprint 2 Gate: Date clamping prevents future dates from inflating experience (0.36ms)
✔ Sprint 2 Gate: Generic modelling terms do not earn LCI methodology credit without LCA context (0.15ms)
✔ Sprint 2 Gate: Decoupled mandatory eligibility flags distinguish conditional from unconditional eligibility (9.81ms)

Pass: 26 | Fail: 0 | Total Duration: 559.8ms
```

---

## 7. Phase 6 — Early Vercel Deployment Compatibility Assessment

### 7.1 Architecture Analysis for Vercel
- **Next.js 14 Build:** The application builds cleanly (`npm run build`) in 4.2 seconds.
- **Client Bundle Size:**
  - Route `/`: First Load JS is 101 kB (well within Vercel's fast-render budget).
  - Route `/api/upload`: Serverless Function route.
- **ONNX Runtime Constraints in Vercel Serverless:**
  1. Vercel Serverless Functions have an uncompressed artifact limit of 50 MB on the Hobby tier.
  2. The `@xenova/transformers` library packages precompiled ONNX native bindings (`onnxruntime-node`) which vary by OS architecture. In `next.config.mjs`, we marked `@xenova/transformers`, `onnxruntime-node`, and `sharp` as `serverComponentsExternalPackages`.
  3. If deploying to standard Vercel serverless: The local ONNX model (`Xenova/bge-small-en-v1.5`, ~133MB) will download on function cold-start unless cached or bundled with Vercel Blob/Hosted Inference API.
  4. **Alternative Deployment Targets:**
     - **Vercel with Hosted Inference Proxy:** If serverless execution exceeds 50MB packaging, `lib/embeddings.ts` already supports switching to Hugging Face Inference API via `HUGGINGFACE_API_KEY` with zero changes to model dimensions or chunk pooling logic.
     - **Containerized / VPS Deployment (Railway / Render / Fly.io / Docker):** Executes full local ONNX inference with zero network dependencies and sub-200ms latency.

---

## 8. Conclusion & Ready for Sprint 4

Sprint 2 and Sprint 3 are complete, fully verified, and backed by automated integration tests and documentation. The project is ready for **Sprint 4: Submission Package & Final Freeze**.
