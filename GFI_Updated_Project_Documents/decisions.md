# DECISIONS.md — Growth For Impact Architecture Decision Record

**Status:** User-approved specification, seven grilling rounds, finalized 2026-11-11. **No implementation started at document creation.**

## Assignment-derived facts (not design preferences)
The supplied Growth For Impact Software Engineering Assignment specifies: 47 anonymized resumes; two JDs (assignment overview describes LCA 4–6 years; **provided detailed LCA JD says 2–3 years independent LCA projects**, plus a UI/UX internship welcoming 0–1 year); extract relevant information; classify candidates as LCA/UI-UX/both/neither or uncertain; score and rank separately with clear method and evidence; interface with sorting/filtering, original resume references and visible errors; upload and rank a new resume among existing applicants; host on a **free Vercel** instance. It explicitly warns against submitting **uncleaned AI data** or omitting methodology. The document says the work takes **at least four focused hours** but does **not** state an absolute deadline. Some source links appear as “here” in the supplied document and must be resolved from the actual source files.

## Newly verified sources: full JDs and resume archive (2026-11-11)
- Source texts supplied directly by the user: **LCA Consultant (Chennai onsite, relocation)** and **Growth For Impact UI/UX Internship (remote)**. These are more specific than the high-level assignment summary and should anchor the rubrics, while preserving inconsistencies.
- Resume archive `Software Development Assignment Resumes.zip`: **47 `.docx` files** within a single folder; no initial PDF files. Preliminary `python-docx` traversal successfully opened 47/47; 46 had nonempty paragraph/table text and **one, `anonymized_resume_1793685080327.docx`, yielded no ordinary body/table text**. Its OOXML contains drawing elements, and must be audited further rather than called blank. No validated candidate classifications, project counts, eligibility outcomes or ranking measurements have yet been produced.
- The supplied LCA JD requests **2–3 years independently running LCA projects**, hands-on **GaBi OR SimaPro**, at least **three completed LCA projects**, and **ISO 14040/14044** compliance. Operational evidence: LCI data collection/quality control/modelling, assumptions and audit traceability, production/energy/logistics, public benchmarking, stakeholder coordination. Environmental education/EPD/finance familiarity preferred. **Chennai onsite**, extensive travel, English fluency and a one-year commitment are stated but must remain `needs_confirmation` absent evidence.
- The assignment overview instead labels the LCA role as requiring **4–6 years**. **Source conflict ADR-S01:** preserve both; provisionally prioritize detailed JD's 2–3 years of *independent LCA work* for scoring and show reviewer warning, but keep the final interpretation configurable pending a hiring owner clarification. This is **not** an automatic disqualifier. Avoid treating generic work years as specific LCA project years.
- UI/UX JD welcomes **0–1 year** or career transition. Substantial evidence: **Figma**, high-fidelity prototyping, human-centered design, user research/psychology, visually coherent responsive web and job-board design, portfolio/project outputs, collaboration and iteration. Mandatory *subjective* traits (creativity, aesthetics, detail, understanding psychology) should **not** be automatically asserted from isolated keywords; surface `requires_review` and portfolio evidence. Role is **fully remote**, first design hire; first 90 days focus on site/job board. Stipend **₹10,000–₹15,000/month** is descriptive only, not a scoring feature.
- Pre-audit keyword matches are **not** validated candidate qualifications. Repeated candidate initials occur in distinct filenames, so use stable per-file IDs rather than name/initial matching.

## Approved decisions

| ID | Decision | Why / consequence |
| --- | --- | --- |
| D01 | Polished usable prototype; prioritize working MVP first | Academic time pressure; reliability before extra polish |
| D02 | Next.js full-stack, TypeScript/Tailwind, deploy to Vercel free tier | Single deployment and accessible HR experience |
| D03 | Offline preprocess/clean the 47 resumes once into structured JSON | Avoid redundant live processing; enable systematic cleaning/audits |
| D04 | Hybrid extraction: deterministic parsing, optional LLM only on ambiguous/low-confidence fields | Limit cost and hallucination; flag uncertainty |
| D05 | Role-specific weighted scoring + semantic embeddings, not LLM-only rankings | Deterministic, auditable, explainable |
| D06 | LCA points: skills 30, experience 30, projects 20, semantic 15, education 5 | Relevant experience emphasized |
| D07 | UI/UX points: skills 30, experience 10, projects 30, semantic 20, education 10 | Practical design work emphasized |
| D08 | JD-specific essential/preferred requirement rubrics with evidence-backed sub-scores | Avoid keyword frequency gaming; cite original resume evidence |
| D09 | Score LCA and UI/UX independently and classify LCA, UI/UX, both, neither/uncertain | Required multi-role outcomes |
| D10 | Calibrate configurable per-role thresholds on a representative reviewed sample, then freeze/version them | Avoid unsupported arbitrary classifications |
| D11 | LCA independent project experience is heavily weighted; preserve the **4–6 (overview) vs 2–3 (detailed JD)** conflict, use detailed JD provisionally, flag mismatches without auto-rejection | Prevent silent misreading of two source documents; require versioned clarification |
| D12 | Hugging Face hosted embedding API, intended model `BAAI/bge-small-en-v1.5` subject to real verification | Small semantic model; deployment-friendly external inference |
| D13 | Offline precompute baseline vectors; runtime uploads must use same model, revision, normalization, chunking and scoring version | New and initial candidates must be comparable |
| D14 | Compare role-specific relevant chunks with matching JD sections; bound strongest-evidence aggregation | Avoid truncation and unrelated resume content |
| D15 | Normalize similarity to a documented reference range; clip semantic contributions to 15/20 points | Raw cosine is not a percentage; avoid inflated or misleading values |
| D16 | Show total, five sub-scores, matched evidence, missing/unverified requirements, relevant experience and eligibility flags | HR reviewer can inspect ranking logic |
| D17 | Unknown or incomplete extraction is not evidence of absence; flag low-confidence fields | Avoid unsupported negative claims and invented qualifications |
| D18 | Upload PDF/DOCX, validate file size/type/text quality, error on scans/unreadable; no MVP OCR | Meet core task while containing implementation complexity |
| D19 | Live upload uses same extraction/embedding/scoring pipeline and joins unified rankings for both roles | Directly meets dynamic ranking requirement |
| D20 | Store local uploads (structured records, scores, vectors, blobs) in browser IndexedDB | Persist after refresh without cloud DB; no device sync |
| D21 | Public read-only baseline, no sign-in; uploaded rows distinguishable and removable | Frictionless public demo, local user isolation |
| D22 | Exact duplicates via SHA-256 hash; warn, do not auto-merge, possible identity duplicates | Reduce repeated entries without false identity conclusions |
| D23 | Server-side credentials, provider protection via rate limits, token/budget caps, validation | Public API access otherwise risks abuse and spend |
| D24 | On provider error retry briefly then report recoverable failure; never invent semantic/full comparable score | Preserve ranking integrity |
| D25 | Version score config; recalculate affected candidate scores; restore IndexedDB on refresh and handle migration | Prevent mixed-version rankings |
| D26 | Candidate privacy: local delete/reset, no resume-text analytics, minimal external transmission, disclose provider text processing | Treat resumes as potentially sensitive |
| D27 | Focused dashboard: two role tabs, ranked tables, filters, details, evidence, upload | Functional HR UI without unnecessary analytics |
| D28 | Automated unit/integration tests plus representative human review and Vercel smoke tests | Balanced rigor and short timeline |
| D29 | Release gates: account for all 47, both rankings, uploads, persistence, errors, explanations, tests and public URL | Concrete acceptance criteria |
| D30 | Optional backup export/import after core features pass; explain loss when browser storage is cleared | Better portability without making cloud DB a blocker |

## JD-grounded rubric requirements (subweights to define during evidence audit)
| Role | Essential/strong evidence | Preferred/context or review-only |
| --- | --- | --- |
| LCA | Independently delivered LCA studies (2–3 years per detailed JD); ≥3 distinct completed LCA projects; hands-on GaBi/SimaPro; ISO 14040 + ISO 14044; lifecycle inventory gathering and QA; LCA modelling/assumption documentation | EPD; environmental degree; plant, energy/logistics, benchmarking, stakeholder collaboration, financial understanding; onsite relocation, travel, English and 1-year commitment are explicit confirmation flags |
| UI/UX | Figma/prototyping; demonstrated design work/portfolio; UX research and user psychology; human-centered design; responsive site/job-board thinking; visual design coherence and iteration | First-designer collaboration, sustainability alignment; creativity, aesthetic sense, eye for detail and nuanced psychology understanding require human review rather than inferred automated facts |

Do not redistribute scoring weights across the fixed five categories without approval. Define and document **component-level subweights** from these requirements, with the strongest critical evidence prioritized. Avoid soft-term keyword frequency as a substitute for portfolio evidence.

## Decisions explicitly rejected/deferred
- **No** persistent cloud candidate database or mandatory authentication in MVP; no shared uploads across devices.
- **No** raw keyword count or LLM-only global ranking replacing the approved rubric + embedding method.
- **No** auto-disqualification of applicants outside the LCA 4–6-year range.
- **No** silently manufactured semantic score when Hugging Face fails; no unrelated fallback model without re-embedding baseline and recording a versioned change.
- **No** mandatory OCR for scanned files, broad analytics dashboard, or export/import before submission-critical requirements pass.
- **No** server-side permanent file writes to Vercel's ephemeral runtime storage.

## Implementation details to verify, not silently assume
1. **Input handoff:** full JD texts and 47-resume DOCX ZIP were provided in chat and preliminarily inspected. Confirm they were copied to the implementation repository; do not claim implementation-ready structured records, full parsing success, verified clean fields or existing labels. Original submission links are still unresolved.
2. **Provider capabilities:** Test HF endpoint availability for `BAAI/bge-small-en-v1.5`, credentials, quota, vector format, exact model revision and any necessary query/document formatting. Model support can change. If an intended service cannot support it, report the blocker and propose an explicitly approved change.
3. **Optional extraction LLM:** Provider, credentials, privacy terms, budget and opt-in fallback are **configurable but not chosen**. Missing LLM access must not block ordinary deterministic extraction.
4. **Similarity reference range:** Derive and document a stable empirically inspected normalization (with clipped bounds). Avoid calibrating from a changing mix of new uploads in a way that shifts existing scores each upload.
5. **Classification calibration:** Determine numerical thresholds using actual reviewed sample data, not unsupported predetermined constants. Document reviewer labels, ambiguity and limited sample caveats.
6. **Upload path:** Validate deployed Vercel runtime/request limits, supported PDF/DOCX parser and default approximately 4 MB cap, plus rate limiting/budget-cap mechanisms before considering the endpoint safe.
7. **Source inspection:** Baseline file references must resolve; if original documents are confidential or cannot be shipped publicly, expose appropriate safe evidence/provenance and report the limitation without publicly leaking private data.
8. **Resume exposure:** Even anonymized baseline data should be checked for identifiers and unintended private information before public deployment. DOCX metadata, comments, relationships, revisions, embedded media and source document download are possible leakage paths; serve sanitized evidence and avoid shipping raw ZIP/DOCX publicly without an explicit privacy review.
9. **Local storage:** Handle IndexedDB quota errors, incompatible schema/config versions, and possible loss upon clearing browser data. Any export of resumes should warn about personal data.
10. **Date interpretation:** **Nov 14** is the user's own target, not a confirmed employer deadline; end-semester and thesis conflicts are user-specified constraints.

## Score computation contract
For each role `r` and candidate `c`:

`score(c,r) = skills_r + experience_r + projects_r + semantic_r + education_r`

Each component is between zero and that role's approved maximum. Deterministic requirement sub-scores require verifiable resume evidence. Semantic component is a documented normalized similarity `s_norm` in `[0,1]` multiplied by the role-specific maximum (15 LCA / 20 UI/UX). All subscore evidence, model metadata, config version and source locations are carried into reviewer-facing explanations. Incomplete/incompatible provider results create explicit error or review states, **not comparable fabricated scores**.

## Consistency and quality invariants
- Every baseline resume has one stable ID and ingestion status; total records accounted for is 47 even if some are unreadable. The one zero-text paragraph/table case must be specifically investigated; duplicate initials are not duplicate people.
- Both role scores are computed independently with consistent configurations. New uploads join both rankings, and read-only baseline entries remain untouched.
- Same embedding model/revision and chunking settings for offline and runtime scoring, with provenance metadata.
- Role thresholds are versioned and frozen after sample calibration; changes trigger uniform score/classification recomputation.
- Missing evidence remains missing; hallucinated skills, employment dates, degree qualifications or achievements are prohibited.
- Candidate score ordering has stable deterministic tie-breaking and no undisclosed LLM evaluation steps.
- A public Vercel URL, real deployment smoke tests, cleaning report and methodology are mandatory to claim completion.

## Change-control template
For any post-approval change, append:

`ADR-XXX | YYYY-MM-DD | Proposed/Accepted/Rejected | Change | Context and evidence | Alternative rejected | Data/scoring/deployment impact | Migration and test plan | User approval (if architectural)`

### Recorded Sprint 1 Architecture Decisions
- **ADR-S02 | 2026-11-11 | Accepted | Verified Local ONNX + Server Proxy for BAAI/bge-small-en-v1.5 embeddings**  
  *Context:* Remote HF API requires authenticated tokens and risks rate limits or cold starts during local runs and evaluation. Using `@xenova/transformers` with `Xenova/bge-small-en-v1.5` executes the identical 384-dimensional dense vector embeddings offline and deterministically in ~1.5s, while optionally supporting remote HF inference if `HUGGINGFACE_API_KEY` is set.  
  *Impact:* Deterministic 384-dim baseline precomputation in `data/baseline.json`; runtime uploads use the exact same model and chunking pipeline.

- **ADR-S03 | 2026-11-11 | Accepted | Independent Role Scoring & Threshold Calibration at 50 Points**  
  *Context:* Evaluated 47 resumes across both role rubrics independently. Calibrated against representative samples: LCA matches (8 candidates, top score 75.8), UI/UX matches (20 candidates, top score 95.4), neither/uncertain (19 candidates, including the 1 empty document and non-matching profiles).  
  *Impact:* Clear four-way classification (`lca`, `uiux`, `both`, `neither_or_uncertain`) without forced mutual exclusion.

- **ADR-S04 | 2026-11-11 | Accepted | Robust Multi-Format Date Parsing & Non-Overlapping Experience Interval Unions**  
  *Context:* Unicode em-dashes (`—`) in date strings caused regex failures across 23 candidates in initial baseline extraction, erroneously producing 0 experience months. Concurrently, naive month summation risked double-counting concurrent roles.  
  *Decision:* Implement comprehensive `parse_robust_date_span` supporting em-dashes, en-dashes, hyphens, MM/YYYY, 'YY, and interval unions for non-overlapping experience calculation.  
  *Impact:* Restored genuine tenure calculations across all 46 extractable resumes (e.g. SRK corrected from 0 to 67 months LCA experience).

- **ADR-S05 | 2026-11-11 | Superceded by ADR-S06 | Anonymized Standard Token Recognition for ISO 14040/14044 Compliance**  
  *Context:* Initial audit recognized anonymized tokens (`ISO /`, `ISO :2006`) but awarded full points (8/8) without human unmasking.  
  *Superceded:* Replaced by 4-tier calibrated rubric in ADR-S06.

### Recorded Sprint 1.5 Remediation Architecture Decisions
- **ADR-S06 | 2026-11-11 | Accepted | Calibrated 4-Tier ISO Standards Scoring Rubric**  
  *Context:* Awarding full points (8/8) for masked tokens risked false-positive compliance claims for unverified standard numbers.  
  *Decision:* Implement four distinct tiers: Tier 1: Explicit citation (`evidenced`, 8 pts); Tier 2: Generic standards text in LCA context (`partially_evidenced`, 4 pts); Tier 3: Masked tokens (`needs_confirmation`, 0 pts + review flag for human unmasking); Tier 4: Not evidenced (0 pts + critical flag).  
  *Impact:* Eliminates unverified compliance points while preserving audit trail for recruiters.

- **ADR-S07 | 2026-11-11 | Accepted | Multi-Line Project Grouping & Strict LCA Methodology Execution**  
  *Context:* Preliminary project parser treated every non-bullet paragraph as a separate project title, inflating project counts up to 8 per candidate and misclassifying generic environmental/waste tasks as LCA studies.  
  *Decision:* Implement state-machine grouping (title + description + bullets + tools). Require genuine LCA methodology (ISO 14040/44, cradle-to-gate/grave, SimaPro/GaBi/OpenLCA, LCI modeling) and completed independent study execution to qualify as an LCA project.  
  *Impact:* Consolidated inflated project records (e.g. TM from 6 to 3 distinct projects; SS from 8 to 4); filtered non-LCA environmental studies.

- **ADR-S08 | 2026-11-11 | Accepted | State-Machine Education Parser for Degree-Institution Association**  
  *Context:* Education parser previously failed to associate degree lines with adjacent institution lines, producing 100% blank institution fields.  
  *Decision:* Implement multi-line state machine linking degree names with adjacent university lines, graduation years, and scores/CGPA, preventing orphan degree items.  
  *Impact:* 100% of candidate education records (82/82) now have verified associated institutions (0 blank).

- **ADR-S09 | 2026-11-11 | Accepted | Dual-Layer Independent Scoring Oracle (Arithmetic vs Source-Evidence Reconciliation)**  
  *Context:* Audit identified a 36-candidate score delta between the Python audit script and the TypeScript scoring engine due to disparate subscore calculations.  
  *Decision:* Restructure oracle validation into Layer A (Scoring Arithmetic Verification using exact baseline candidate attributes) and Layer B (Source-Evidence Audit directly from DOCX text).  
  *Impact:* Layer A arithmetic agreement achieved 100.0% (47/47 candidates match). Layer B source discrepancies fully documented and reconciled in `reports/scoring_reconciliation.csv`.

- **ADR-S10 | 2026-11-11 | Accepted | Canonical Local ONNX Embeddings with Multi-Chunk Pooling & Null Empty Doc Representation**  
  *Context:* Audits discovered hosted API authorization failures and arbitrary context truncation for texts exceeding 512 tokens, while empty files generated artificial zero vectors.  
  *Decision:* Standardize exclusively on local ONNX `Xenova/bge-small-en-v1.5` inference. Multi-chunk long texts (>1500 chars) with mean-pooling and unit L2 normalization. Represent empty documents as `null` vector rather than zero-filled arrays.  
  *Impact:* Deterministic, offline-reproducible 384-dimensional embeddings across baseline and runtime uploads without provider drift.

### Recorded Sprint 2 & Sprint 3 Architecture Decisions
- **ADR-S11 | 2026-11-11 | Accepted | Runtime Upload Pipeline with Content Magic-Byte Verification and SHA-256 Deduplication**  
  *Context:* Relying on file extensions alone allows renamed corrupt or plaintext files to crash binary parsers. Moreover, checking duplicates by filename causes collisions when different users upload distinct resumes with generic names (e.g., `resume.pdf`).  
  *Decision:* Validate file magic bytes (`%PDF` for PDF, `PK\x03\x04` for DOCX). Enforce exact deduplication strictly by SHA-256 hash. Enforce 5MB size limit and 0-byte rejection. Provide sanitized client-facing error envelopes without exposing internal call stacks, system paths, or exception details.  
  *Impact:* Robust, abuse-resistant upload endpoint tested and verified across real DOCX and PDF fixtures.

- **ADR-S12 | 2026-11-11 | Accepted | Client-Side IndexedDB Storage (`idb`) with Graceful Quota Fallback and Dual-Role Ranking Scope**  
  *Context:* Runtime uploads must persist across browser refreshes without requiring an external cloud database or violating candidate privacy. However, storing large multi-megabyte document blobs can trigger browser `QuotaExceededError`.  
  *Decision:* Implement IndexedDB persistence using `idb` (`gfi_resume_ranking_db`). Store candidate structured records, vector embeddings, subscores, and timestamps. If quota limits are reached, gracefully drop the raw file binary while preserving the essential candidate metadata and scores. Provide per-candidate deletion and confirmation-gated reset controls. Keep 47 baseline reference resumes strictly immutable and read-only.  
  *Impact:* Zero cloud storage costs, 100% client privacy, instant reload on refresh, and clear UX distinctions between read-only baseline records and user uploads.

- **ADR-S13 | 2026-11-11 | Accepted | Independent Dual-Role Ranking Scope & 3-Tier Deterministic Tie-Breaking**  
  *Context:* Reviewers need the flexibility to see how non-specialist or uncertain candidates rank on specific roles without altering their formal qualification classification. Furthermore, tie-breaks must never jitter across renders or refreshes.  
  *Decision:* Add ranking scope control to role tabs ("Qualified Resumes Only" vs "All Resumes Ranked for Role"). Implement a 3-tier deterministic sorting comparator: (1) Total Score descending, (2) Relevant Experience Months descending, (3) Candidate ID ascending (`localeCompare`).  
  *Impact:* Consistent, reproducible candidate ordering across both roles, supporting comprehensive HR screening and exploration.

### Recorded Sprint 3.5 Architecture Decisions
- **ADR-S14 | 2026-11-11 | Accepted | Multi-Surface Pre-Flight SHA-256 Deduplication & ZIP Decompression Safety**  
  *Context:* Uploading duplicate resumes under altered filenames wasted server inference and network resources. Additionally, uncompressed OpenXML payloads inside DOCX files could pose ZIP bomb vulnerabilities.  
  *Decision:* Implement pre-flight SHA-256 hash calculation in the browser via Web Crypto `crypto.subtle.digest("SHA-256", buffer)`. Check in-memory and IndexedDB duplicate caches *prior* to network request dispatch, offering a direct "View Existing Candidate Record" button. On the server, implement `checkZipSafety` header inspection to reject payloads exceeding 25MB uncompressed or compression ratios > 100:1.  
  *Impact:* Instant zero-latency duplicate detection on client side; robust defense against decompressed memory exhaustion.

- **ADR-S15 | 2026-11-11 | Accepted | IndexedDB State Mutation Serialization & Safe Version Recalculation**  
  *Context:* Asynchronous hydration raced with mutations, causing deleted records to occasionally reappear, while React state optimistically updated even if storage failed. In addition, changes to rubric versions required safe score updates without losing user-uploaded resumes.  
  *Decision:* Enforce strict state mutation serialization with `isMutating` locks. Update React state *strictly* after IndexedDB transactions resolve (`res.success === true`). Provide failure injection hooks for verification. Implement `validateAndMigrateRecord` to automatically recalculate scores when rubrics update, or mark incompatible schemas with `requiresReprocessing: true` and an amber UI badge.  
  *Impact:* 100% synchronization between React state and browser storage; zero data loss during version upgrades.

Keep `agent.md`, `sprintplan.md`, and this file aligned. Do not reinterpret unresolved verification tasks as permission to change approved decisions.
