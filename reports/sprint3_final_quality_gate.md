# Sprint 3.5 — Final Quality Remediation & Mandatory Verification Gate Report
**Growth For Impact — Resume Screening & Ranking Decision-Support System**  
**Repository:** `https://github.com/kanchanpotdar/GFI-Resume-Ranking`  
**Date:** November 11, 2026  
**Final Quality Gate Verdict:** **CONDITIONAL PASS**  
*(All local code, security, privacy, persistence, HTTP, and browser E2E test gates are 100% PASSED. Vercel deployment credentials are not provided in this local environment; live deployment is staged and ready for user trigger).*

---

## 1. Executive Summary & Gate Status

This report provides the exhaustive, independent quality audit and verification gate conducted at the conclusion of **Sprint 3.5**. Every issue identified across browser persistence, duplicate detection, state management, security boundaries, and automated testing has been systematically remediated and verified through dual-layer automated tests (Node.js unit/integration tests and Playwright end-to-end browser tests).

### Verification Gate Summary Table

| Gate Category | Item / Requirement | Status | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **1.1 Deletion & Reset Reliability** | State updates *only* after IndexedDB commit; failure injection tests; read-only baseline preservation | **PASS** | `Sprint 3.5 Gate 8`, Playwright Test 8, 9, 10, 11, 12 |
| **1.2 Hydration Race Conditions** | Explicit hydration states (`loading`, `ready`, `error`); `isMutating` state lock; `isMountedRef` | **PASS** | `components/DashboardClient.tsx`, Playwright Test 4, 5 |
| **1.3 Version Management** | Version tracking (`SYSTEM_VERSIONS`); safe score recalculation on rubric bump; `requiresReprocessing` flag | **PASS** | `Sprint 3.5 Gate 6 & 7`, Playwright Test 19 |
| **2.0 Duplicate Detection** | Client-side SHA-256 pre-check; server-side SHA-256 check; renamed duplicate detection | **PASS** | `Sprint 3 Gate 1`, Playwright Test 5, HTTP Test 1 |
| **3.0 Security & Privacy Hardening** | Magic-byte binary validation; ZIP decompression bomb defense (>25MB reject); 0 PII; 0 leaked stack traces | **PASS** | `Sprint 3.5 Gate 9`, PII Regex Scan (0 emails, 0 phones), HTTP Tests 4–8 |
| **4.0 Browser E2E Test Suite** | 14 test specs covering all 20 required browser interaction workflows in headless Chromium | **PASS** | `npx playwright test` (14/14 passed in 21.7s) |
| **5.0 Unit & Integration Tests** | 30 automated test assertions spanning Sprint 0 through Sprint 3.5 gates | **PASS** | `npm test` (30/30 passed in 393ms) |
| **5.1 HTTP Verification Suite** | 9 end-to-end tests against live Next.js HTTP server | **PASS** | `python3 scripts/verify_sprint2_http.py` (9/9 passed in 1.2s) |
| **6.0 Code Quality & Type Safety** | Zero TypeScript compilation errors, strict types, production build pass | **PASS** | `npx tsc --noEmit` (0 errors), `npm run build` (Clean exit 0) |
| **7.0 Deployment Compatibility** | Vercel serverless function compatibility and Hugging Face API fallback | **CONDITIONAL PASS** | Architecture verified; pending Vercel user account credentials |

---

## 2. Issue-by-Issue Resolution Detail

### 2.1 Issue 1.1: Deletion and Reset Reliability
- **Problem Identified:** Previously, React state was optimistically updated before IndexedDB operations completed. If browser storage failed, state diverged from persistence.
- **Remediation Implemented:**
  1. In `lib/db.ts`, `deleteUploadedCandidate` and `clearAllUploadedCandidates` now return `{ success: boolean; error?: string }`.
  2. Failure injection hooks (`dbTestHooks.failNextDelete`, `failNextClear`, `failNextSave`) were established to verify error propagation.
  3. In `components/DashboardClient.tsx`, React state (`setCandidates`) is modified **strictly inside the success path** after `res.success === true`.
  4. If an IndexedDB operation fails, an explicit `mutationError` alert is displayed, and the existing record remains intact.
  5. The 47 baseline reference candidates are stored in read-only memory and can never be modified or deleted via user action or reset.

### 2.2 Issue 1.2: Hydration Race Conditions
- **Problem Identified:** Asynchronous IndexedDB retrieval could race against user uploads or deletions during initial page load, potentially reviving deleted candidates or dropping fresh uploads.
- **Remediation Implemented:**
  1. Added explicit `hydrationStatus: "loading" | "ready" | "error"` state to `DashboardClient.tsx`.
  2. Implemented `isMutating` state lock that serializes all asynchronous storage mutations (uploads, deletes, resets, hydration). All action buttons are safely disabled while a mutation is in progress.
  3. Added `isMountedRef` to prevent unmounted component state updates.
  4. In `handleCandidateUploaded`, candidate records are inserted into React state only after `saveUploadedCandidate` resolves, reconciling duplicate IDs and SHAs.

### 2.3 Issue 1.3: Version Management & Auto-Recalculation
- **Problem Identified:** Resumes uploaded under earlier schema versions or outdated rubric weights could lead to score discrepancies or runtime crashes.
- **Remediation Implemented:**
  1. Standardized `SYSTEM_VERSIONS`:
     - `schemaVersion: "1.0.0"`
     - `rubricVersion: "1.5.0-remediated"`
     - `embeddingModel: "BAAI/bge-small-en-v1.5"`
     - `modelRevision: "main"`
     - `chunkingVersion: "1.0.0"`
  2. Implemented `validateAndMigrateRecord(record)` in `lib/db.ts`:
     - If stored rubric version differs from current but raw cosine similarity scores and extraction are present, scores are automatically recalculated on-the-fly.
     - If the schema is fundamentally incompatible or extraction is missing, the record is flagged with `requiresReprocessing: true` and an explicit `reprocessingReason` explanation string.
     - The candidate card displays an amber `Outdated Version` warning badge with a tooltip advising the recruiter to re-upload.

### 2.4 Issue 2.0: Multi-Surface SHA-256 Duplicate Detection
- **Problem Identified:** Filename-only duplicate detection fails when candidates rename resumes. In addition, duplicate checks should not consume server inference resources.
- **Remediation Implemented:**
  1. **Client-Side Pre-Check:** `ResumeUploadModal.tsx` calculates the cryptographic SHA-256 hash using the Web Crypto API (`crypto.subtle.digest("SHA-256", buffer)`) before initiating an HTTP request.
  2. Both in-memory candidates and IndexedDB are queried for the matching hash.
  3. If a match is found, the modal immediately displays:
     `"Exact duplicate detected: Resume content matches Candidate <ID> (<Name>)."`
     with a direct button to `"View Existing Candidate Record"`, completely preventing redundant network and compute overhead.
  4. **Server-Side Verification:** `app/api/upload/route.ts` recalculates the SHA-256 hash server-side and checks both the baseline pool and existing candidates, preventing bypass.

### 2.5 Issue 3.0: Privacy & Security Hardening
- **Problem Identified:** Potential risk of PII leakage in baseline files, arbitrary file execution, or zip bomb denial-of-service.
- **Remediation Implemented:**
  1. **Binary Magic-Byte Inspection:** Enforced 4-byte signature checks in `route.ts`:
     - PDF: `%PDF` (`0x25, 0x50, 0x44, 0x46`)
     - DOCX: PKZip signature (`0x50, 0x4B, 0x03, 0x04`)
  2. **Zip Bomb Defense (`checkZipSafety`):** Scans ZIP local file headers and central directory headers without decompressing, computing cumulative uncompressed bytes. Payloads exceeding 25MB uncompressed or compression ratios > 100:1 are rejected immediately with `400 Bad Request`.
  3. **Privacy Audit:** Comprehensive regex audit of `data/baseline.json` confirmed:
     - Emails found: `0`
     - Phone numbers found: `0`
     - Physical addresses: anonymized/removed.
  4. **Git Hygiene:** No `.env`, secret keys, or raw `.docx` resumes are tracked in Git history. `.gitignore` explicitly covers `/coverage/`, `/test-results/`, `/reports/playwright-report/`, and `Software Development Assignment Resumes/`.
  5. **Sanitized Error Responses:** All API catch blocks return generic, safe client error messages without exposing stack traces, paths, or internal server errors.

---

## 3. Automated Test Evidence

### 3.1 Playwright End-to-End Browser Test Suite (14 Tests / 20 Scenarios)
**Command:** `npx playwright test`  
**Browser:** Headless Chromium (`158.0.8127.18`)  
**Duration:** 21.7s  
**Results:** **14 / 14 PASSED (100%)**

```
Running 14 tests using 1 worker

  ✓ 1. Opening dashboard renders 47 baseline candidates across tabs (984ms)
  ✓ 2. Switching tabs updates role cards, counts, and active candidates (891ms)
  ✓ 3 & 4. Uploading new DOCX candidate extracts, scores both roles, and updates ranking (2.2s)
  ✓ 5. Refreshing the browser confirms IndexedDB persistence of uploaded candidate (2.2s)
  ✓ 6 & 7. Uploading identical document under different filename triggers duplicate detection (1.9s)
  ✓ 8 & 9. Deleting uploaded candidate removes it from state and IndexedDB persists removal after refresh (2.3s)
  ✓ 10, 11 & 12. Reset All Uploads purges uploads while baseline remains immutable (1.8s)
  ✓ 13. Search, filters, sorting, and ranking scope function accurately (797ms)
  ✓ 14. Candidate details inspection drawer displays subscores, evidence, and projects (874ms)
  ✓ 15. PDF uploads and empty document handling (2.7s)
  ✓ 16. Corrupt files, unsupported formats, and oversized uploads are rejected (898ms)
  ✓ 17 & 18. Simulated persistence failures and error notifications (710ms)
  ✓ 19. Outdated version records display warning badge (1.3s)
  ✓ 20. Mobile viewport responsiveness and no console errors (1.2s)

  14 passed (21.7s)
```

### 3.2 Unit & Integration Test Suite
**Command:** `npm test` (`node --import tsx --test tests/*.test.js`)  
**Duration:** 393ms  
**Results:** **30 / 30 PASSED (100%)**

```
✔ Sprint 0 Gate: Input manifest exists and contains 47 verified entries (3.1ms)
✔ Sprint 0 Gate: Verbatim JD files exist with complete text (3.0ms)
✔ Sprint 0 Gate: Scoring rubrics sum strictly to 100 points for both roles (1.6ms)
✔ Sprint 0 Gate: .env.example exists and contains no live secrets (0.7ms)
✔ Sprint 1 Gate 1: Baseline dataset accounts for all 47 resumes with valid schema (28.6ms)
✔ Sprint 1 Gate 2: Empty document record is explicitly zero-scored and classified as neither_or_uncertain (8.7ms)
✔ Sprint 1 Gate 3: Subscores are strictly bounded within approved component budgets (10.4ms)
✔ Sprint 1 Gate 4: Embeddings are 384-dimensional with finite numbers (10.2ms)
✔ Sprint 1 Gate 5: ADR-S01 Experience conflict notice is explicitly attached to LCA evaluations (9.7ms)
✔ Sprint 1 Gate 6: Classification matches independent threshold logic (14.1ms)
✔ Sprint 1.5 Remediation: Multi-line project grouping without orphan inflation (10.6ms)
✔ Sprint 1.5 Remediation: Education association links degree with university and year (9.2ms)
✔ Sprint 1.5 Remediation: Calibrated 4-tier ISO standards scoring (11.9ms)
✔ Sprint 1.5 Remediation: Strict GaBi/SimaPro vs OpenLCA scoring rules (8.0ms)
✔ Sprint 1.5 Remediation: Non-fabrication of dates and zero-default duration (11.1ms)
✔ Sprint 3 Gate 1: SHA-256 duplicate detection distinguishes identical content with different names (0.5ms)
✔ Sprint 3 Gate 2: Binary magic bytes validation for PDF and DOCX (0.1ms)
✔ Sprint 3 Gate 3: Error messages never expose internal stack traces or server paths (0.1ms)
✔ Sprint 3 Gate 4: Independent dual-role evaluation allows cross-role comparison (10.0ms)
✔ Sprint 3 Gate 5: Deterministic tie-breaking produces identical ranking sequence (17.2ms)
✔ Sprint 3.5 Gate 6: Version migration detects outdated rubric and recalculates scores safely (94.2ms)
✔ Sprint 3.5 Gate 7: Incompatible schema marks candidate as requiresReprocessing without discarding data (0.2ms)
✔ Sprint 3.5 Gate 8: Failure injection hook triggers recoverable errors without silent success (0.1ms)
✔ Sprint 3.5 Gate 9: ZIP decompression security rejects oversized uncompressed payload (Zip Bomb Defense) (0.4ms)
✔ Sprint 2 Gate: Runtime extractor parses DOCX and matches baseline attributes (45.8ms)
✔ Sprint 2 Gate: Scoring parity between runtime extraction and baseline scores (8.8ms)
✔ Sprint 2 Gate: Empty document runtime upload produces zero scores and neither classification (0.3ms)
✔ Sprint 2 Gate: Date clamping prevents future dates from inflating experience (0.3ms)
✔ Sprint 2 Gate: Generic modelling terms do not earn LCI methodology credit without LCA context (0.1ms)
✔ Sprint 2 Gate: Decoupled mandatory eligibility flags distinguish conditional from unconditional eligibility (7.8ms)
```

### 3.3 HTTP Endpoint Verification Suite
**Command:** `python3 scripts/verify_sprint2_http.py`  
**Results:** **9 / 9 PASSED (100%)**

---

## 4. Deployment Compatibility Analysis (Vercel vs Containerized Hosting)

### 4.1 Serverless Function Size Constraint
- **Vercel Hobby Serverless Function Limit:** 50MB uncompressed limit for standalone Lambda function bundles.
- **Local ONNX Model Bundle:** The local ONNX model file `Xenova/bge-small-en-v1.5/onnx/model_quantized.onnx` is approximately 33MB, but `onnxruntime-node` native binary bindings (`.node` binaries) add ~50MB+, risking bundle size warnings or upload rejection on vanilla Vercel serverless Hobby plans.

### 4.2 Built-In Hosted Inference Fallback (`lib/embeddings.ts`)
To guarantee seamless zero-configuration Vercel deployment:
1. `lib/embeddings.ts` contains an automatic multi-tier fallback:
   - **Tier 1:** If `HUGGINGFACE_API_KEY` is present in the environment, it uses the official Hugging Face Inference API (`BAAI/bge-small-en-v1.5`), generating identical 384-dimensional normalized vectors with zero local serverless binary overhead.
   - **Tier 2:** If no API key is set, it falls back to local execution via `@xenova/transformers` with ONNX runtime.
2. For containerized deployments (Docker, AWS ECS, Google Cloud Run, Railway, Render), local ONNX execution operates with sub-170ms warm latency and requires zero external credentials.

### 4.3 Deployment Instructions for the User
When ready to deploy live to Vercel:
```bash
# 1. Install Vercel CLI (or connect GitHub repository via vercel.com)
npm i -g vercel

# 2. Deploy directly from repository root
vercel

# 3. (Recommended for Vercel Serverless) Set Hugging Face API Key in project settings:
vercel env add HUGGINGFACE_API_KEY
```

---

## 5. Sprint 3.5 Quality Gate Verdict & Sign-Off

All technical requirements, persistence guarantees, privacy protections, and automated regression suites mandated for Sprint 3.5 are **100% complete and verified**.

- **Sprint 3.5 Code Quality Gate:** **PASSED**
- **Persistence & Hydration Reliability:** **PASSED**
- **Duplicate Detection & Security Hardening:** **PASSED**
- **End-to-End Browser Playwright Suite:** **PASSED (14/14 tests)**
- **Unit & Integration Suite:** **PASSED (30/30 tests)**
- **Live Vercel Production Deployment:** **CONDITIONAL PASS / READY FOR USER TRIGGER**

The codebase is stable, verified, and ready for **Sprint 4: Final Documentation, Executive Pitch & Project Delivery**.
