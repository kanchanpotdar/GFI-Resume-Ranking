# SPRINTPLAN.md — Growth For Impact | November 11–14, 2026

## Goal and constraints
Deliver the agreed Growth For Impact resume ranking prototype **by Saturday, 14 November 2026**, with a reliable public Vercel URL and evidence-backed methodology. The owner has a **thesis report due Nov 12**, **thesis presentation Nov 13**, and **end-semester examinations from Nov 16**. The plan deliberately minimizes student review time and pushes repeatable tasks into automated scripts/tests. Dates are **planning targets, not a verified employer deadline**: the provided assignment document does not give a specific submission date.

## Priority rules
- **P0:** assignment compliance, correct 47-record baseline, cleaned outputs, JD-specific score/rank/explain, new resume upload and rerank, deployed public URL, methodology.
- **P1:** IndexedDB persistence, privacy/delete controls, recoverable API errors, representative evaluation, automated tests, usable styling.
- **P2:** export/import backup, extended analytics, advanced visualizations, optional OCR, more elaborate provider failover. Do not start P2 until P0/P1 pass.
- **Hard gates:** never silently present unverified AI extraction, fabricated semantic scores, unmatched embedding versions, or unreviewed rankings as validated.

## Workstreams and milestones

### Sprint 0 — Audit inputs and create reproducible project skeleton (Nov 11)
**Tasks:** Use the supplied archive with **47 DOCX** resumes and the two full JDs (copy them into the repo); inventory zip members and inspect document paragraphs, tables, drawings, headers and XML; investigate one zero-text result (`anonymized_resume_1793685080327.docx`); map detailed-JD requirements and the LCA experience conflict; create Next.js + TypeScript + Tailwind app, environment example, scripts and tests directory; confirm Vercel account/deployment target and Hugging Face token/provider access **without exposing credentials**. Record gaps honestly.

**Artifacts:** `data/input_manifest.*`, JD rubric draft, initial repository structure, `.env.example`, first Vercel hello-world deployment.

**Exit gate:** 47 ZIP members mapped, exact JD text saved, anomalous zero-text DOCX investigated or explicitly flagged, and LCA 4–6 vs 2–3 experience discrepancy documented; first public build available; provider tested or flagged. Do not assume credentials are available.

### Sprint 1 — Baseline data cleaning and score engine (Nov 11–12)
**Tasks:** Parse 47 resumes offline; deterministic extraction plus selective configurable LLM for ambiguity; normalize and audit fields; distinguish 2–3 years independent LCA work from general experience, count substantiated completed LCA projects, detect GaBi/SimaPro, ISO 14040/14044 and Figma/project/portfolio evidence; flag corrupt/uncertain records; include source references; create role-specific text chunks; precompute same-model embeddings through verified HF endpoint; define rubric evidence/subscores; implement fixed LCA weights **30/30/20/15/5** (skills/experience/projects/semantic/education) and UI/UX **30/10/30/20/10** in those same column categories; implement semantic normalization; draft calibration sample/thresholds; output versioned baseline JSON, score breakdowns and cleaning report.

**Artifacts:** baseline JSON with 47 accounted-for manifest entries, extraction/cleaning audit, score config, embedding provenance metadata, ranking-engine unit tests.

**Exit gate:** Both role scores/explanations reproducible for valid records; failures visibly distinguished; reviewed sample and threshold calibration documented, with targeted checks on the LCA three-project/software requirements and UI/UX Figma/portfolio evidence; all weights and score bounds tested.

### Sprint 2 — Functional dashboard + runtime upload + public deployment (Nov 12–13)
**Tasks:** Create LCA and UI/UX ranked tables, sorting and filters, evidence/detail view; implement PDF/DOCX upload validation and parsing in a supported runtime path; detect scanned/empty/oversize files; secure embedding proxy and provider error reporting; ensure exact same model/chunking/scoring config as offline baseline; add uploaded candidate to both unified rankings; deduplicate by SHA-256; maintain stable rank/tie-break order. Publish an early live build immediately after the happy path works.

**Artifacts:** navigable dashboard, secure API routes, working end-to-end upload flow, public URL.

**Exit gate — critical P0:** From a clean browser, open deployed URL, inspect baseline, upload valid PDF/DOCX, and see the candidate ranked in both roles with explanations. If not, stop polish and fix this flow.

### Sprint 3 — Persistence, resilience and validation (Nov 13–14)
**Tasks:** Add IndexedDB candidate records/embeddings/scores/uploaded file blobs; browser refresh recovery and recalculation on scoring config changes; remove/reset functionality; clear privacy notice; robust retry/failure states; rate limiting, input validation, provider spend bounds; test extraction errors and duplicated content; automated unit/integration suite plus manual review of representative candidates and all obvious failures; test from deployed/incognito browser.

**Artifacts:** persistence layer, tests, privacy controls, issue/fix log, evaluation report, deployed verified build.

**Exit gate:** Browser-local uploaded candidate survives refresh and can be removed; failed embeddings never produce fabricated scores; protections and public smoke tests verified.

### Sprint 4 — Submission package and final freeze (Nov 14)
**Tasks:** Run clean install, lint, typecheck, tests and build; revalidate all 47 inputs; review rank explanations; inspect client bundle/logs for tokens/PII; verify Vercel public URL from an unauthenticated browser; complete methodology and README; record tested provider/model/version, scoring thresholds and calibration, data-cleaning details, known limitations and evaluation results; open submission form and submit URL if the submission is in scope/authorized.

**Artifacts:** final public URL, README/methodology, cleaned data-audit record, test results, concise known limitations and submission checklist.

**Exit gate:** All mandatory assignment requirements demonstrably met, no critical known failures, links function, evidence and methodology included. Do not claim form submission unless it actually occurred.

## Known inputs, discrepancies and concrete acceptance cases
- **Confirmed archive:** exactly 47 `.docx` resume members, no baseline PDFs. Python-docx opened all 47; **46 yielded text via ordinary paragraph/table extraction**, and `anonymized_resume_1793685080327.docx` yielded none through that method. Triage that file before classifying it as unusable.
- **Detailed JD versus overview conflict:** assignment overview describes LCA as 4–6 years; provided detailed LCA JD says **2–3 years independently running LCA projects**. Preserve both, use detailed JD provisionally in scoring, display source conflict, request clarification only if possible without blocking delivery.
- **LCA regression fixtures:** candidate with explicitly evidenced ≥3 completed LCA projects, GaBi or SimaPro and ISO 14040/14044; candidate with only general sustainability experience; candidate who mentions `openLCA` but not GaBi/SimaPro; candidate with total employment years but no demonstrable independent LCA tenure; candidate whose relocation/travel willingness is not stated. Ensure unknowns aren't converted into negative facts.
- **UI/UX regression fixtures:** 0-year applicant with credible Figma prototypes and user-research portfolio; candidate listing Figma only with no portfolio; experienced unrelated applicant; incomplete/subjective aesthetics claims requiring review. Confirm 0–1 year is welcome and remote location is not incorrectly scored as Chennai readiness.
- **QA data hygiene:** repeated initial-based pseudonyms are not unique IDs; do not expose hidden original identifiers, email, phone, tracked changes, comments, author metadata or unexpected DOCX properties in the public baseline. Include sanitized provenance.
- **Submission:** source assignment has no verified deadline or directly resolved submission link. Nov 14 is the project target.

## Deliverables checklist
- [x] Exact supplied JD texts stored; all 47 DOCX ZIP members inventoried; one zero-text DOCX triaged
- [x] Extraction and human cleaning audit (raw-to-clean changes, unknown/invalid fields)
- [x] Versioned, validated baseline dataset and cached embeddings
- [x] Evidence-backed rubric including LCA GaBi/SimaPro, ≥3 projects, ISO requirements and UI/UX Figma/research/portfolio evidence
- [x] LCA 4–6 vs 2–3 year source conflict documented and shown; thresholds calibrated; four-outcome classification
- [x] Sprint 1.5 Independent validation audit: extraction discrepancies resolved, test oracle reconciliation, NDCG/Precision evaluated, 6 audit reports created
- [x] Sprint 1.5 Remediation: Multi-line project grouping, education university linking (0/82 blank), 4-tier ISO standards scoring, dual-layer oracle reconciliation (100.0% Layer A agreement), canonical ONNX embeddings with multi-chunk pooling, honest evaluation benchmarks certified
- [ ] LCA/UI-UX tabs, filtering/sorting, inspectable evidence and source references
- [ ] New PDF/DOCX upload, duplicate detection, comparable scoring and two-role rerank
- [ ] Secure HF calls; explicit timeout/provider/scanned-file/oversize errors
- [ ] IndexedDB recovery, per-upload delete and reset, privacy messaging
- [ ] Unit/integration tests and representative human review
- [ ] Public Vercel deployment confirmed in clean browser
- [ ] Methodology/README, limitations, configuration provenance, final URL
- [ ] Optional: export/import (only after mandatory gates)

## Risk register and mitigations
| Risk | Impact | Practical mitigation |
| --- | --- | --- |
| Missing or malformed 47 resume files / JDs | Rankings cannot be justified | First-day inventory, source manifest, visible processing statuses; no fabricated replacements |
| Unavailable HF embedding endpoint/quota | Runtime uploads cannot score consistently | Verify early; retry and report; switch model **only** with documented approval and full baseline re-embedding |
| Serverless upload parsing incompatible with deployment | Upload flow broken | Spike a real PDF/DOCX upload on Vercel early; use compatible JS parsing or supported runtime strategy, document result |
| Token leakage/API abuse | Cost, confidentiality risk | Server-side tokens, limits, rate limiting and budget cap; sanitize error messages/logs |
| Unreliable extraction / no cleaning report | Assignment rejection risk | Audit corrections and reviewer checks before polishing UI |
| Semantic scoring overweights repeated text | Poor candidate ordering | Role-specific bounded chunks, rubric checks, inspect borderline/top cases |
| Local storage quota/browser reset | Candidate loss | Explain local-only nature, catch quota errors; optional export/import |
| Academic time pressure | Incomplete submission | Freeze optional features, ship public MVP early, maintain hard P0 gates |

## Suggested effort allocation
Automate extraction, schema checks, calibration reports, and regression tests wherever possible. Reserve limited manual time for reviewing **ambiguous/high-ranked/borderline** candidates, resolving actual JD wording, and verifying deployment. No fixed hourly commitment is assumed.

## Daily standup template
- **Completed and verified:** [artifact/commit/test evidence]
- **Next highest-priority task:** [single P0/P1 action]
- **Blocker / dependency:** [file, API quota, runtime, access]
- **Decision changed:** [link/update to `decisions.md`]
- **Live build / tests:** [URL, commands, pass/fail]

## Stop conditions
Do not submit as fully working if any of these are unresolved: missing core JD/rubric source, baseline silently missing candidates, invalid/missing explanations, new uploads not inserted into both ranked lists, fabricated semantic scores on provider failure, no public working Vercel URL, or absent data-cleaning/methodology documentation. Report partial status transparently if time runs out.
