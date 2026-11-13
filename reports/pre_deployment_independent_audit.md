# Pre-Deployment Independent Audit & Quality Gate Report

**Repository:** `https://github.com/kanchanpotdar/GFI-Resume-Ranking`  
**Audit Baseline Commit:** `d0da677` (`main`)  
**Audit Date:** 2026-11-13  
**Audit Verdict:** **`CONDITIONAL PASS`** (All local, clean-room, build, lint, unit, HTTP, and Playwright browser gates pass; **live Vercel deployment + authenticated Hugging Face Router pooling verification remain pending**).

---

## 1. Executive Verdict & Conditions Before Public Submission

### Why Verdict Is `CONDITIONAL PASS` (Not Unconditional `PASS`)
1. **Live Vercel Serverless Deployment Pending:** No Vercel credentials (`VERCEL_TOKEN`) are configured in this workspace, so deployment bundle limits, serverless cold-start memory/timeouts, and public URL end-to-end tests remain unexecuted until deployment.
2. **Live Hugging Face Router Inference & Pooling Parity Unverified:** `generateEmbeddingHF()` in `lib/embeddings.ts` was migrated off deprecated `api-inference.huggingface.co` to `https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5/pipeline/feature-extraction` with retry (`429`/`503`) and strict unit-norm / 384-dim validation. However, **no `HUGGINGFACE_API_KEY` is configured locally**, so live network execution and numerical equivalence between hosted HF Router vectors and local mean-pooled ONNX vectors (`@xenova/transformers`) remain **UNVERIFIED**.
3. **Sprint 0 Git History Disclosure:** Although current `HEAD` ignores private resumes and assignment documents via `.gitignore`, commit `430644e` (`feat(sprint-0)`) originally tracked `GFI Software Engineer Assignment.docx`, `Software Development Assignment Resumes.zip`, and the 47 `.docx` resumes before commit `caafac4` removed them from `HEAD`. Git history was **not** rewritten without repository-owner approval; review git history exposure before making the repository public or sharing its git history externally.

---

## 2. Confirmed Defects Discovered & Remediated

| # | Area | Defect Found | Fix Implemented | Verification |
| :-: | :--- | :--- | :--- | :--- |
| 1 | Date & Section Parsing (`scripts/extract_resumes.py`, `lib/runtime_extractor.ts`) | Missing `'sept': 9` in `MONTH_MAP` inflated `anonymized_VM_1793682784520` (`Sept 2021 – Jun 2023`) from **22 months** (`48.9`, `neither_or_uncertain`) to **30 months** (`58.9`, `lca`). Prefix header checks caused `"Experienced ..."` to truncate Professional Summary. TypeScript runtime parser also diverged on `’25`, `N Months`, inline `Jun – Jul 2024`, `:` splitting, missing section headers, and chunk capping. | Synchronized `'sept': 9`, word-bounded header matching, apostrophe/relative duration parsing, `indexOf(":")` splitting, `Tools / Technologies` extraction, and 1800-char chunk bounds across Python & TypeScript. Regenerated `data/baseline.json` (`1908.6 KB`). | **47/47** exact score, classification, experience, and project parity in `tests/upload_parity.test.js`; **47/47** Layer A oracle match via `audit_and_validate_sprint1.py`. |
| 2 | Clean-Room Client Modal Crash (`lib/db.ts`, `components/CandidateDetailModal.tsx`) | Clean-room Playwright Test 19 (`outdated_test_001` inspection) uncovered an uncaught Next.js client exception (`TypeError` reading `subScores.skills` and `requirementsEvidence.map` on partial legacy records). | Added `createSafeFallbackRoleScore()` alongside `createSafeFallbackExtraction()` in `lib/db.ts` (`validateAndMigrateRecord`) and added optional-chaining/default fallbacks across `CandidateDetailModal.tsx`. | E2E Test 19 clicks `Inspect` on outdated partial record and verifies safe modal rendering cleanly (`14/14` Playwright pass). |
| 3 | ZIP Bomb Bypass (`lib/upload_validation.ts`, `app/api/upload/route.ts`) | Naive local-header byte scan in `checkZipSafety()` trusted local header sizes (`0` under ZIP bit-3 data descriptors). | Implemented End-of-Central-Directory (`0x06054b50`) + Central Directory (`0x02014b50`) validation checking authoritative entry count (`<=500`), total uncompressed bytes (`<=25 MB`), and compression ratio (`<=100:1`). | Unit test (`Sprint 3.5 Gate 9`, including data-descriptor ZIP bombs) + HTTP Test 10 (`400`) pass. |
| 4 | Upload Hardening & Embeddings Concurrency (`app/api/upload/route.ts`, `lib/upload_validation.ts`, `lib/embeddings.ts`) | Missing rate limit, uncached racy JD/ONNX pipeline initialization, deprecated `api-inference.huggingface.co` URL, and unvalidated vector finiteness / zero-norm vectors. | Added sliding-window rate limiter (`checkUploadRateLimit`), `sanitizeUploadFilename()`, byte-length guards, promise-cached `getJdEmbeddings()` and ONNX `pipelinePromise`, updated HF Router URL with 1 retry (`429`/`503`) and strict L2 norm / finiteness validation. | Unit tests (`Sprint 3 Gate 2/3`, `Sprint 4 Gate 2/3`, `Pre-Deploy Audit Gate`) + HTTP 11/11 tests pass. |
| 5 | IndexedDB & UI Consistency (`lib/db.ts`, `components/DashboardClient.tsx`, `components/ResumeUploadModal.tsx`) | Outdated records needing reprocessing (`requiresReprocessing === true`) could still be blocked by SHA-256 pre-flight cache; modal could close before `onCandidateUploaded` settled; `saveUploadedCandidate()` could leave stale `by-sha256` duplicates; missing `.eslintrc.json`. | Allowed re-upload on `requiresReprocessing`, awaited parent callback before modal close, deduped `by-sha256` on save, fixed ESLint entities & null-safe clipboard/arrays, added `.eslintrc.json` + ESLint devDeps. | `npm run lint` (`✔ No ESLint warnings or errors`), `npx tsc --noEmit` exit `0`, Playwright E2E Scenarios 5–18 pass. |
| 6 | Clean-Checkout Test Portability (`tests/upload_parity.test.js`, `scripts/verify_sprint2_http.py`, `tests/sprint3_persistence.test.js`) | `upload_parity.test.js` Test 1 crashed without private gitignored `Software Development Assignment Resumes/`; `sprint3_persistence.test.js` contained tautological inline re-implementations. | Updated `upload_parity.test.js` Test 1 to always parse tracked `data/fixtures/sample_lca_resume.docx` (and verify `TM_495` when archive is present), replaced tautological tests with direct imports of production modules, and made `verify_sprint2_http.py` skip Test 1 gracefully if local archive is absent. | Clean checkout (`/tmp/gfi-cleanroom`) passed `npm test` (35/35 runnable + 1 archive-optional skip) & full workspace passed `36/36`. |

---

## 3. Baseline Remediation Impact (`data/baseline.json`)

- **Classification Distribution (47 Total: 46 ready, 1 empty):**
  - **Before:** `{ lca: 9, uiux: 22, both: 0, neither_or_uncertain: 16 }`
  - **After:** `{ lca: 8, uiux: 22, both: 0, neither_or_uncertain: 17 }`
- **Score Correction Explained:** Fixing `'sept': 9` corrected `anonymized_VM_1793682784520` (`Sept 2021 – Jun 2023`) from **30 months / `58.9` (`lca`)** to **22 months / `48.9` (`neither_or_uncertain`)**, placing it transparently in the `[45.0, 50.0)` manual-review band immediately below threshold (`50.0`).
- **Observed Separation After Remediation:**
  - **LCA Qualifying (`8`):** `51.1` (`anonymized_RR_1793682784428`) to `84.0` (`anonymized_TM_1793682784495`); Top 5: `84.0`, `66.2`, `65.8`, `65.4`, `60.7`. Highest non-qualifying: `48.9` (`anonymized_VM_1793682784520`), followed by `33.5` (`anonymized_UI_1793682784506`).
  - **UI/UX Qualifying (`22`):** `57.3` (`anonymized_AA_1793685080195`) to `96.3` (`anonymized_AY_1793685080440`); Top 5: `96.3`, `95.6`, `93.5`, `92.8`, `92.1`. Highest non-qualifying: `48.5` (`anonymized_FT_1793685080301`), `46.2` (`anonymized_KN_1793685080310`), then `34.5`.
- **Embedding Provenance Fixed:** Baseline embeddings now record `model: "BAAI/bge-small-en-v1.5"`, `modelRevision: "v1.5"`, `chunkingVersion: "1.0.0"`, `dimensions: 384`.

---

## 4. Verification Evidence (Observed Post-Final-Edit Runs)

### 4.1 Clean-Room Checkout (`/tmp/gfi-cleanroom` via fresh `npm ci`)
- `npm ci` -> exit `0` (`503` packages installed from `package-lock.json`)
- `npx tsc --noEmit` -> exit `0`
- `npm run lint` -> exit `0` (`✔ No ESLint warnings or errors`)
- `npm test` -> exit `0`: **`35 passed, 0 failed, 1 skipped`** (`Runtime vs baseline parity across all 47 source DOCX resumes when archive is present` skipped intentionally due to omitted private archive in cleanroom checkout)
- `npm run build` -> exit `0` (Next.js `14.2.15`; `/` `22.4 kB` / `109 kB` First Load JS; `/api/upload` dynamic)
- Clean-room client bundle scan (`.next/static`) -> `NO_SECRETS_OR_LOCAL_PATHS`, `NO_EMAIL_PII`
- Clean-room production server (`npx next start -p 3000`):
  - `python3 scripts/verify_sprint2_http.py` -> exit `0` (`10 passed`, `Test 1 skipped` without local archive; Cold Start DOCX `5055.2ms`, Warm PDF `115.0ms`, Empty DOCX `20.5ms`, Zip bomb `400` in `2.7ms`, Corrupt DOCX `400` in `11.6ms`)
  - `npx playwright test` -> exit `0` (**`14 passed (17.4s)`**, `0 failed`)

### 4.2 Full Workspace Verification (With All 47 Source DOCX Resumes)
- `npx tsc --noEmit` -> exit `0`
- `npm run lint` -> exit `0` (`✔ No ESLint warnings or errors`)
- `npm test` -> exit `0`: **`36 passed, 0 failed, 0 skipped`** (`duration_ms 1255.54`) — includes **47/47 exact runtime vs baseline parity**
- `npm run build` -> exit `0`
- `python3 scripts/verify_sprint2_http.py` (against workspace `next start -p 3000`) -> exit `0`: **`11 of 11 passed`** (`Test 1` baseline SHA-256 duplicate `195.6ms`, `Test 2` DOCX `538.4ms`, `Test 3` PDF `105.1ms`, `Test 9` empty DOCX `13.5ms`, `Test 10` Zip bomb `400` `2.1ms`, `Test 11` corrupt internal DOCX `400` `10.2ms`)
- `npx playwright test` (against workspace `next start -p 3000`) -> exit `0`: **`14 passed (17.2s)`**, 0 browser console errors, server ready in `212ms` with zero unhandled exceptions
- Temporary mutation-sensitivity check: Temporarily removed `'sept': 9` in `lib/runtime_extractor.ts` -> `npm test` failed cleanly (`30 !== 22` across both `Sept` unit test and 47-resume parity test); immediately restored and re-verified `36/36 pass`.

---

## 5. Privacy, Security & Documentation Sync

- **Baseline Privacy Check:** Inspected `data/baseline.json` — `0` email addresses, `0` URLs, `0` un-anonymized full names (candidate names use 2–3 letter anonymized initials); numeric tokens matching phone regex are anonymized resume IDs (`1793682784144`, `6642550394306`).
- **Environment Secrets:** No live `.env` secrets or API keys exist in workspace files or `.next/static`.
- **Synchronized Docs:** Updated `reports/ranking_evaluation.md` (`8 LCA / 22 UI/UX / 17 Neither`, accurate `48.9` borderline separation), `README.md` (Sprints 2–4 progress, `36`/`11`/`14` verified counts, file tree, HF unverified caveat), and `GFI_Updated_Project_Documents/decisions.md` (`ADR-S16`). *(Note: older historical `reports/final_submission_audit.md` retains its pre-audit Sprint 4 draft numbers `[0.60, 0.85]` and `33/9/14`; treat this Pre-Deployment Audit report as authoritative.)*
