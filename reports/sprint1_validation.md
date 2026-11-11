# Sprint 1.5 — Independent Validation & Quality Audit Report (Remediated)

**Date:** November 2026  
**Target Milestone:** Sprint 1.5 Quality Gate & Remediation Verification  
**Evaluation Scope:** All 47 resumes, source DOCX files, JDs, embeddings, scoring logic, and classification thresholds.  
**Reference Document:** See [reports/sprint1_remediation.md](file:///Users/kanchanpotdar/Downloads/GFI%20Assignment/reports/sprint1_remediation.md) for full root-cause analyses, code diffs, and before-and-after audit logs.

---

## 1. Executive Summary & Verdict

### Final Verification Gate Verdict: **PASS (Certified for Sprint 2)**

Following an independent source-level audit and subsequent comprehensive remediation, all previously flagged vulnerabilities have been resolved:
1. **Multi-line Project Grouping:** Eliminated artificial project inflation (where descriptive sentences were previously treated as standalone titles). Enforced strict LCA methodology criteria (ISO 14040/44, cradle-to-gate/grave, SimaPro/GaBi/OpenLCA) to distinguish completed independent LCA studies from generic environmental, waste, or emissions tasks.
2. **Education Degree & University Association:** Built an adjacent-line state machine linking degree specializations to institutions, graduation years, and scores. Resolved 100% of empty institution fields (`0/82` blank institutions in remediated baseline vs `82/82` blank previously).
3. **Non-Fabrication of Experience:** Eliminated the 6-month artificial fallback, applied non-overlapping calendar interval unions, and strictly separated independent LCA execution from generic ESG coordination and carbon-accounting roles.
4. **Calibrated 4-Tier ISO Standards Scoring:** Replaced full-credit awards for masked tokens (`ISO /`, `ISO :2006`) with an explicit four-tier rubric:
   - `evidenced` (8 pts): Explicit ISO 14040/14044 citation.
   - `partially_evidenced` (4 pts): Generic ISO standards text in verifiable LCA context.
   - `needs_confirmation` (0 pts + review flag): Masked or anonymized tokens pending recruiter unmasking.
   - `not_evidenced` (0 pts + critical flag): No ISO standards reference found.
5. **Reconciled Dual-Layer Independent Oracle:**
   - **Layer A (Scoring Arithmetic Oracle):** Verified formula correctness and sub-score bounds in Python. **Result: 47/47 (100.0%) exact mathematical match.**
   - **Layer B (Source-Evidence Audit):** Fully reconciled all candidate attributes against the underlying resume text.
6. **Canonical Embeddings & Empty Doc Standardization:** Local ONNX `Xenova/bge-small-en-v1.5` standardized as the sole embedding engine with multi-chunk mean-pooling for long text. Empty file represented as `null` embedding vector.
7. **Automated Test Suite:** All 15 automated test suites pass with zero regressions. Next.js 14 production build compiles cleanly.

---

## 2. Source-Level Extraction Verification

### Discrepancy Analysis & Root Causes
- **Date Matching Failure:** The preliminary extractor used `[-–]` in date regex, which omitted the Unicode em-dash (`—`, U+2014) commonly generated in Word documents.
  - *Fix:* Implemented `parse_robust_date_span` supporting em-dashes, en-dashes, hyphens, slashes (`MM/YYYY`), apostrophes (`'YY`), and relative durations (`X months`).
- **Bullet Header Misclassification:** Any line with an em-dash was previously evaluated as a job header.
  - *Fix:* Enforced strict exclusion of bullet points (`•`, `-`, `*`, `–`) from header detection.
- **Interval Merging:** Replaced naive month addition with calendar interval unions to prevent double-counting overlapping tenures.
- **Empty Document Record (`anonymized_resume_1793685080327.docx`):** Re-inspected at OOXML level. Confirmed empty paragraph container (`<w:t xml:space="preserve"></w:t>`), 0 text nodes, 0 drawing elements. Recorded as `unscorable` due to insufficient evidence with 0.0 scores and `neither_or_uncertain` classification.

---

## 3. Scoring & Threshold Reconciliation

### Independent Oracle Comparison
An independent test oracle (`scripts/audit_and_validate_sprint1.py`) was constructed with separate rules:
- **LCA Role:**
  - `TM_1793682784495`: Rank 1 (88.8 / 100) — Proven SimaPro, $\ge 3$ projects, independent LCA experience.
  - `MS_1793682784442`: Rank 2 (82.1 / 100) — SimaPro + OpenLCA, PCF, thesis deliverables.
  - `SS_1793682784470`: Rank 3 (76.7 / 100) — CII experience, SimaPro, cradle-to-gate studies.
  - `SRK_1793682784455`: Corrected from 20.6 to **58.2 / 100** (Associate LCA Consultant at Mondra Global with 67 months LCA experience).
- **UI/UX Role:**
  - `DVJ_1793685080268`: Rank 1 (95.5 / 100) — Figma prototyping, design systems, user interviews.
  - `CG_1793685080278`: Rank 2 (91.5 / 100) — Design tokens, usability testing, mobile healthcare flows.
  - `MM_1793685080338`: Rank 3 (91.4 / 100) — Figma interactive prototypes, user flows, accessibility.
  - `AA_1793685080195`: Corrected from 45.9 to **55.9 / 100** (Product Designer, Gluco SMBG app, WCAG accessibility).

---

## 4. Embedding Integrity Summary
- Model: `BAAI/bge-small-en-v1.5` (via ONNX runtime in `@xenova/transformers`).
- Dimension: **384** (100% verified, 0 NaN/Inf values).
- Semantic Normalization: Scaled across empirical baseline range $[0.50, 0.85]$.
- Hard-cap Protection: Semantic points capped at 15 for LCA and 20 for UI/UX, preventing similarity from overriding missing technical requirements.

---

## 5. Audit Deliverables Manifest
1. `reports/sprint1_validation.md`: This comprehensive validation summary.
2. `reports/extraction_discrepancies.csv`: Full list of audited discrepancies and applied fixes.
3. `reports/scoring_reconciliation.csv`: Baseline vs oracle score delta verification.
4. `reports/embedding_validation.md`: Model architecture, pooling, and parity documentation.
5. `reports/ranking_evaluation.md`: Precision@k, NDCG@k, and confusion matrices.
6. `reports/manual_review_queue.csv`: Borderline candidates flagged for reviewer attention.
