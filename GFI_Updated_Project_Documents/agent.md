# AGENT.md — Growth For Impact Resume Ranking Prototype

## Mission
Build a polished, explainable, publicly deployed resume-screening **decision-support** prototype for the Growth For Impact Software Engineering Assignment. Analyze **47 supplied anonymized DOCX resumes** against the now-provided full JDs: **onsite LCA Consultant (Chennai)** and **remote Growth For Impact UI/UX Design Internship**. The assignment overview describes LCA as **4–6 years**, while the detailed LCA JD specifically requires **2–3 years of independently running LCA projects**; preserve both statements, flag the conflict, and use the detailed JD as the operational scoring rubric pending employer clarification. Show rankings for each JD, classify every candidate as **LCA / UI/UX / both / neither or uncertain**, and let reviewers upload an additional PDF/DOCX resume and see it scored and inserted into both rankings. Deploy on **Vercel free tier**. Human reviewers make decisions; do not portray heuristics as objective hiring outcomes.

**Critical assignment warning:** AI-generated/extracted resume data MUST be reviewed and cleaned, and the methodology MUST be shared. Failure to do either risks automatic rejection. The assignment allows imperfect parsing, but failures must be visible and handled. Do not fabricate scores, fields, evaluation results, input files, or source evidence.

## Status and boundaries
- This document records the user-approved design from seven decision rounds, as of **2026-11-11**. It is an instruction file, **not** a claim that code or data preprocessing has been completed.
- Target: working submission by **2026-11-14**. User also has a thesis report due Nov 12, thesis presentation Nov 13, exams beginning Nov 16. Favor fast delivery and demonstrable correctness.
- Read `decisions.md` for architectural choices and `sprintplan.md` for sequencing/gates. If the files conflict, preserve the user's approved choices, flag discrepancies, and update documentation together.
- Do not change approved architecture unilaterally. Record necessary refinements, evidence, trade-offs, and fallback decisions in `decisions.md`.
- The user has now supplied both full JD texts and a resume archive; **do not claim they are already present in a future Codex workspace**. Check that the files/contents are copied into the repository before processing. Provider credentials, verified labels and published source URLs are not supplied. The assignment document contains placeholders such as “here”; do not invent the destinations.

## Delivery priorities
1. Clean and validate the initial 47 candidate records and parse both JDs.
2. Produce defensible role-specific scoring, classifications, and evidence-based explanations.
3. Ship a functional public Next.js/Vercel app with the two ranked views and end-to-end new-upload flow.
4. Add IndexedDB persistence, deletion/reset, robust error handling, tests and polish.
5. Document methodology, limitations, verification evidence, public URL and reproducible steps. Optional export/import is **not** a blocker.

## Approved architecture
- **Application:** Next.js full-stack, TypeScript, Tailwind CSS, server-side API routes, Vercel free-tier hosting.
- **Baseline ingestion:** One-time offline preprocessing (Python utilities are allowed), parse PDF/DOCX, clean results, preserve source IDs, output validated structured JSON plus precomputed embedding vectors. **Do not recalculate baseline embeddings on page load.**
- **Extraction:** Deterministic parsing/rules first; optionally call a configurable LLM for low-confidence or ambiguous fields only. No LLM guesses presented as facts. If unavailable or unsuccessful, flag for review.
- **Embedding:** Hugging Face hosted inference, intended model `BAAI/bge-small-en-v1.5`, subject to actual endpoint/provider verification. Use the **same exact model, revision/configuration, chunking and normalization** for baseline and live uploads. Model output dimensions and deployed endpoint must be verified, not assumed.
- **Comparison:** JD-specific requirement rubrics; compare role-specific resume chunks against relevant JD sections; aggregate strongest relevant supported evidence, with bounded contribution to prevent long resumes or repeats gaming scores. Treat document truncation as a coverage problem to solve by chunking, not as an excuse to discard later evidence.
- **Scoring:** Deterministic role-specific weighted components plus normalized semantic relevance. Version the rubric, normalization reference, thresholds and scoring config together. Recompute all affected candidate scores on version changes.
- **Persistence:** Browser **IndexedDB** for uploaded structured candidate data, score/embedding metadata, and original uploaded file blobs. Original 47-candidate dataset is read-only and shipped as sanitized baseline data. Uploads are **per browser/device**, not globally synchronized. Provide per-upload removal, clear/reset controls, local-storage explanation, and optional export/import after core gates pass.
- **API security:** Hugging Face and optional LLM tokens on the server only; never expose via `NEXT_PUBLIC_` env vars, page payloads or logs. Input validation, request limits, rate limiting, and provider budget/spend cap; do not mistake a publicly callable API route for authenticated just because it uses a server-side secret. If a no-login public endpoint cannot be adequately protected, implement an abuse-resistant restriction/fallback and document it without compromising the assignment's public evaluation flow.

## Verified input inventory and JD-grounded requirements (2026-11-11)
- Archive: `Software Development Assignment Resumes.zip` contains **47 DOCX files** under `Software Development Assignment Resumes/`; no PDF resume files in the initial archive. All 47 were opened successfully by `python-docx` during preliminary audit. **46 returned nonempty paragraph/table text; 1 did not**. This is a parser observation, **not** a verified count of truly empty or unusable resumes. Inspect DOCX XML, drawing/image parts and relevant alternative extractors for `anonymized_resume_1793685080327.docx`; only use OCR if explicitly approved (not MVP).
- Initial extracted text lengths ranged from 0 to approximately 5,552 characters (paragraphs plus table cells). Some DOCX files may have data in layout elements; don't rely solely on `doc.paragraphs`. Preserve original filename and ZIP member path, and inspect anonymization before public exposure.
- The source archive contains repeated initials across distinct filenames. Treat initials as **non-unique pseudonyms**, never a join key; stable ID = deterministic filename/path-based identifier or content hash with a collision policy. Keep exact hashes for identical files and show only safe display IDs.
- **LCA detailed JD — essential concrete evidence:** independent LCA study delivery (**2–3 years** stated), **at least three completed LCA projects**, **GaBi or SimaPro hands-on**, **ISO 14040 and ISO 14044**, LCI collection, validation, standardization, LCA/LCI modelling, documented assumptions and traceability. Distinguish explicit evidence from implied exposure. For number of projects, count **distinct substantiated completed LCA studies**, not repeated bullet mentions.
- **LCA work context:** plant/resource/energy/transport and supplier logistics data, CFT/stakeholder coordination, public benchmark studies/data sources, data quality, deadlines; **onsite Chennai / willingness to relocate**, extensive travel in India, fluent English, minimum 1-year commitment, full-time office rules. Treat willingness/commitment/language as **needs confirmation unless explicitly evidenced**, not negative inference from a resume. Company offers relocation help. Preferred: environmental degree, EPD experience, finance/accounting familiarity, initiative.
- **UI/UX detailed JD:** **0–1 year welcome**; Figma, high-fidelity prototypes and design specs, UI/UX and human-centered design, user research/psychology, responsive web and job-board interfaces, cross-functional collaboration, feedback/design critiques, coherent visual language, aesthetic attention, creativity and experimentation. User-psychology awareness, creativity, detail, and aesthetics are stated as mandatory but **cannot be objectively certified from keyword presence**; surface portfolio/project evidence or `requires_review`. Favor strong portfolio outcomes and actual user research over mere tool mentions.
- **UI/UX role context:** fully remote, first design team member, site/job-board redesign and first-90-day delivery expectations. Stipend is **₹10,000–₹15,000 per month**; informative metadata, **never an attribute of candidate fit**. Sustainability interest may be a documented preference but not an unannounced hard gate.
- **Experience conflict policy:** do not overwrite the assignment's 4–6-year summary or the detailed JD's 2–3-year requirement. Record both with provenance in rubric metadata; score independent LCA experience using detailed JD **provisionally**, present a recruiter-visible conflict warning, and allow an explicit versioned rubric override if the hiring owner confirms the range. No silent auto-rejection under either interpretation.
- **Role-specific evidence rubric:** assign the fixed five component budgets below to relevant JD-derived *sub-requirements*. For crucial JD conditions, store separate `status: evidenced | not_evidenced | contradictory | needs_confirmation`, and a recruiter-visible `critical_requirement_flag`. Semantic similarity never substitutes for missing GaBi/SimaPro, project count, ISO standards, or Figma evidence. Location, travel, language and commitment are disclosed as unverified logistics, not inferred eligibility.
- **Source hygiene:** furnished JDs are user-provided text, not yet separately uploaded as source files. Save exact quoted JD text into `data/jds/lca.md` and `data/jds/uiux.md` when creating the repo; preserve original passages and source provenance. Do not silently synthesize the missing submission URL from the original assignment's "here" placeholders.

## Scoring contract
| Component | LCA points | UI/UX points |
| --- | ---: | ---: |
| Skills | 30 | 30 |
| Relevant experience | 30 | 10 |
| Projects/portfolio evidence | 20 | 30 |
| Semantic relevance | 15 | 20 |
| Education | 5 | 10 |
| **Total** | **100** | **100** |

- Create rubric items directly from the **actual JD text**, with requirement type (essential/preferred), evidence rule, assigned sub-weight, and matched resume excerpt/source locator. Do **not** invent JD requirements before seeing the JDs.
- Award points only on supported evidence. Distinguish `not_evidenced` from `confirmed_not_met`, and `extraction_uncertain` from actual absence. Treat ambiguous fields conservatively; never hallucinate years or employment chronology.
- LCA experience: **the detailed JD states 2–3 years independently running LCA projects**, although the assignment overview says 4–6 years. Use verified *independent LCA experience* as the primary signal; display a source-conflict notice and separately flag outside-range experience rather than hard-rejecting. Do not equate total employment tenure with independent LCA tenure. UI/UX explicitly welcomes **0–1 year**, recent graduates and career changers; excess years alone must not disqualify.
- Semantic score: normalize cosine (or actual provider similarity) against a **documented, empirically checked reference range**, clip to [0,1], then multiply by the respective 15/20 point weight. Do not treat raw cosine as a percent or silently substitute another technique on provider failure. Keep normalization reproducible and inspect its distribution.
- Classification: evaluate **both** role scores independently; assign LCA, UI/UX, both or neither/uncertain according to independently calibrated, frozen per-role thresholds and extraction sufficiency. Create provisional human-reviewed labels to calibrate; disclose labels/thresholds and avoid declaring unmeasured accuracy. Rank candidates by JD-specific score, then apply a stable documented tie-breaker.
- Explanation per role: total score; breakdown of all five components; matched skills/projects/experience with source excerpts/locations; unmet or unverified requirements; confidence/extraction warnings; eligibility flag; methodology version. Do not produce unsupported generative justifications.
- A score is **decision support**, not a qualification guarantee or hiring decision.

## Data contracts and consistency
Suggested types (adapt details to actual data, document changes):
- `Candidate`: stable `candidateId`, `sourceType` (`baseline|local_upload`), source filename/reference, `contentHash`, extracted skills/education/projects/experience, evidence spans, extraction warnings/confidence, optional browser-local file handle/blob reference, schemaVersion.
- `RoleScore`: `roleId`, rubricVersion, numeric sub-scores, total [0,100], normalized semantic value or explicit error state, matched/unverified requirements, evidence IDs, eligibility flags, explanation.
- `ScoringConfig`: role weights, JD requirement rubric, semantic normalization config, thresholds, embedding model ID/revision, chunking parameters, configVersion.
- `LocalUpload`: file metadata, blob, parsed candidate, embeddings/model metadata, scoring configuration version, timestamps, recoverable error state.

Use runtime schema validation (e.g., Zod) for loaded baseline artifacts, API input/output and IndexedDB migrations. Compute SHA-256 content hashes for exact duplicate detection. Warn on possible identity duplicates without auto-merging. Never identify candidates from guessed names. Deduplicate exact reuploads before insertion. Keep one logical ranking per role incorporating both baseline and uploaded candidates; visually label locally uploaded rows.

## Resume upload pipeline
1. Validate file MIME/extension, magic/signature where practical, size limit (default target **4 MB**, verify against actual deployed request-path limits), and nonempty content.
2. Parse PDF/DOCX; detect image-only/scanned, corrupt or unreadable documents; return actionable error and do not invent text. No OCR in MVP.
3. Normalize the extracted text and create evidence references with source locations where available.
4. Extract structured fields deterministically; optional LLM for flagged ambiguity through provider configuration; validate and flag unsupported/conflicting fields. Extract independently performed LCA project count, LCA-specific dates, software hands-on vs mention-only, ISO evidence, Figma/design project evidence, and no inferred relocation or subjective aesthetics.
5. Build role-specific chunks matched to each JD, call a secure rate-limited embedding API, enforce identical preprocessing/model/revision to the precomputed dataset, and validate vector shape/finite values.
6. On temporary inference failures retry briefly with limits; if unresolved, show recoverable failure with no fabricated semantic or full score. Preserve safely recoverable state without silently inserting an incomparable ranking.
7. Apply the same deterministic scoring/config/thresholds to baseline and uploaded records, rerank both views, show explanation and eligibility flags.
8. Persist locally in IndexedDB. On refresh restore, migrate or flag incompatible records, re-score using stored compatible embeddings where possible, and notify clearly if new API computation is required.
9. Provide delete-single and clear-all operations; revoke temporary object URLs and avoid stale entries. Uploaded files should be available for local inspection after refresh; baseline source references must actually work or their limitation must be shown.

## Required interface
- Clear role tabs for LCA and UI/UX with separate ranked candidates, score and relevant experience sorting/filtering, readable roles and JDs, and clear source labels.
- Candidate details: cleaned structured fields, extracted evidence, five-component scoring breakdown, missing/unverified JD requirements, flags, data quality warnings, and accessible resume reference/viewer.
- Upload control with progress/stages, useful errors, duplicate notice, successful insert in **both** role rankings; mark uploaded candidates visually and allow removal.
- Plain-language methodology accessible from UI (how points/thresholds are derived, normalization, privacy, limitations and human-review policy).
- Responsive, accessible, keyboard-friendly, recruiter-oriented UI; avoid unnecessary dashboard embellishment until functionality works.
- Explain uploads stay only in this browser, may be lost if browser data is cleared, and are sent to external providers when embedding or optional extraction is invoked.

## Testing gates
- All **47** baseline DOCX resumes accounted for, with source references, parsing statuses and cleaning audit; never silently drop failures. One inspected resume (`anonymized_resume_1793685080327.docx`) returned zero text in ordinary paragraph/table extraction and needs XML/drawing/media inspection and a documented recovery/error state, **not** a fabricated empty profile.
- All candidates have independently computed LCA and UI/UX scores or explicit, visible failure states; classifications include both/neither routes when conditions warrant.
- Unit tests: score weights sum to 100; sub-scores within bounds; deterministic tie-breaking; threshold boundaries; unknown-vs-mismatch; experience flags; normalization/clamping; evidence traceability; duplicate hashing; config version migration.
- Integration tests: PDF/DOCX upload -> extraction -> embedding -> consistent scoring -> merged ranking -> IndexedDB restore/removal; corrupt/scanned/oversize cases; provider timeout/rate limits and no-fabrication behavior.
- Human review: inspect a representative sample spanning both roles, high/low/borderline ranks, ambiguous candidates, and **all obvious extraction failures**. Include targeted checks for LCA software and three-project evidence, UI/UX Figma/portfolio evidence, and the detailed-vs-summary LCA experience conflict. Document corrections and any calibration labels. Clearly report sample size and limitations; do not invent accuracy metrics.
- Security/privacy: no secrets in client bundles or logs, baseline data appropriate for public exposure, no unnecessary resume-text telemetry, protected API usage limits, file isolation.
- Deployment smoke test: clean install/build/tests, public Vercel URL loads without auth, two rankings and detail views work, and a genuinely new PDF/DOCX upload reranks correctly in an incognito browser; refresh persistence and error display verified.

## Developer workflow
- Start by inspecting actual repository/files and listing missing inputs. Do not claim initial data exists until verified.
- Make small reviewable commits in the order of `sprintplan.md`. After each milestone run relevant lint/typecheck/tests and record pass/fail evidence.
- Isolate extraction, embeddings, scoring, UI and persistence behind typed interfaces; keep deterministic scoring independent of UI and provider availability.
- Seed any demo/fallback data only when explicitly labeled as synthetic; **never** substitute it for the provided 47 resumes in submission.
- Provide `.env.example` with placeholder variable names, never real secrets. Add a concise methodology/README showing extraction, cleaning/audit, thresholds, scoring formula, model/provider, evaluation, limitations, run/deploy steps and current status.
- Prefer meaningful partial delivery and an early public build over spending all remaining time on peripheral features.
- If provider availability, upload limitations or data quality block acceptance, document the exact blocker and defensible fallback; do not silently change models or scores.

## Definition of done
A reviewer on the public URL can inspect **47 cleaned baseline candidate records**, switch between correct explainable role-specific rankings, upload a new supported resume and see it ranked alongside originals in both roles, inspect evidence and errors, refresh without losing that browser-local upload, delete it, and read the published methodology. Unit/integration checks and live Vercel verification are documented. No unsupported score, false metric or exposed credential is present.
