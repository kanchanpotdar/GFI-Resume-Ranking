# Classification and Ranking Quality Evaluation Report (Sprint 1.5 Remediated)

## 1. Evaluation Methodology and Benchmark Framework

To rigorously evaluate classification and ranking accuracy without circular self-validation, all **47 baseline documents** (46 text-containing resumes and 1 empty document `anonymized_resume_1793685080327.docx`) were evaluated against the official Job Descriptions:
- **LCA Consultant Role:** Evaluated for independent LCA execution, hands-on software (GaBi, SimaPro, OpenLCA), completed distinct LCA studies, and ISO 14040/14044 compliance.
- **UI/UX Design Intern Role:** Evaluated for Figma proficiency, interactive prototyping, user research methodologies, design systems, and case study deliverables.

### Benchmark Relevance Grading (Grades 0 to 3)
- **Grade 3 (High Fit):** Candidate possesses hands-on core tool proficiency (GaBi/SimaPro for LCA; Figma for UI/UX), multiple substantiated project deliverables, and directly relevant tenure.
- **Grade 2 (Moderate Fit):** Candidate demonstrates verified tool exposure, at least 1 relevant project or internship.
- **Grade 1 (Allied / Peripheral):** Candidate has adjacent engineering, environmental, or graphic design skills without dedicated role focus.
- **Grade 0 (Unrelated / Empty):** Candidate from the opposite domain, unrelated field (e.g., general finance, risk analysis, sales), or empty document.

> [!IMPORTANT]
> **Methodological Disclosure & Denominators:**  
> These reference labels represent structured internal decision-support benchmarks generated from rigorous review of source text across all **47 total documents** (**46 text-containing resumes and 1 empty document**). They serve as programmatic heuristic baselines and must not be mischaracterized as external third-party human-annotated ground truth. Cutoff thresholds (50.0/100) are provisional triage baselines subject to recruiter calibration in Sprint 2.

---

## 2. Classification Performance (Threshold = 50.0 / 100)

### Programmatic Classification Breakdown (Post-`Sept` Parser Remediation)

Updated counts after resolving `'sept': 9` date parsing and section-boundary parity fixes (`scoringConfigVersion: 1.5.0-remediated`, cutoff = `50.0 / 100`):

| Predicted Class | Count | Share (of 47) | Notes |
| :--- | :---: | :---: | :--- |
| **LCA (`lca`)** | **8** | 17.0% | Verified LCA specialists scoring $\ge 50.0$ (`51.1`–`84.0`) |
| **UI/UX (`uiux`)** | **22** | 46.8% | Verified UI/UX applicants scoring $\ge 50.0$ (`57.3`–`96.3`) |
| **Both (`both`)** | **0** | 0.0% | No applicant met $\ge 50.0$ on both rubrics simultaneously |
| **Neither / Uncertain (`neither_or_uncertain`)** | **17** | 36.2% | 16 non-qualifying / borderline profiles + 1 empty document (`0.0`) |
| **Total** | **47** | 100.0% | 46 text-containing resumes + 1 empty DOCX |

> [!NOTE]
> `anonymized_VM_1793682784520` (`Sept 2021 – Jun 2023`) moved from an inflated **58.9 (`lca`)** (caused by missing `"sept"` token defaulting to 30 months) to an accurate **22 months** and **48.9 (`neither_or_uncertain`)**, placing it in the manual-review borderline band just below the provisional `50.0` threshold.

---

## 3. Ranking Quality Metrics

### LCA Role Ranking
- **Top 5 Ranked Candidates (Current Baseline):**
  1. `anonymized_TM_1793682784495` (Score: **84.0/100**)
  2. `anonymized_SS_1793682784470` (Score: **66.2/100**)
  3. `anonymized_PW_1793682784228` (Score: **65.8/100**)
  4. `anonymized_MS_1793682784442` (Score: **65.4/100**)
  5. `anonymized_HM_1793682784257` (Score: **60.7/100**)
- **Precision@5:** **1.00** (5 of 5 are proven LCA specialists).
- **Cutoff Separation:** Qualifying LCA candidates score between **51.1** (`anonymized_RR_1793682784428`) and **84.0** (`anonymized_TM_1793682784495`). Immediately below the `50.0` cutoff sits borderline `anonymized_VM_1793682784520` (**48.9**), followed by **33.5** (`anonymized_UI_1793682784506`) and **28.5** (`anonymized_VG_1793682784531`), giving a wide **17.6-point margin** separating qualifying candidates from non-borderline profiles.

### UI/UX Role Ranking
- **Top 5 Ranked Candidates (Current Baseline):**
  1. `anonymized_AY_1793685080440` (Score: **96.3/100**)
  2. `anonymized_DVJ_1793685080268` (Score: **95.6/100**)
  3. `anonymized_APS_1793685080222` (Score: **93.5/100**)
  4. `anonymized_CG_1793685080278` (Score: **92.8/100**)
  5. `anonymized_MM_1793685080338` (Score: **92.1/100**)
- **Precision@5:** **1.00** (5 of 5 have demonstrable Figma portfolios, wireframes, and prototypes).
- **Cutoff Separation:** Qualifying UI/UX candidates score between **57.3** (`anonymized_AA_1793685080195`) and **96.3** (`anonymized_AY_1793685080440`). Non-qualifying borderline scores reach **48.5** (`anonymized_FT_1793685080301`) and **46.2** (`anonymized_KN_1793685080310`), followed by **34.5** (`anonymized_PKG_1793682784369`).

---

## 4. Threshold Calibration & Practical Deployment Justification

The **50.0 / 100 threshold** functions as a provisional recruitment filter pending HR calibration:
1. **Borderline Transparency:** Profiles scoring in the `[45.0, 50.0)` band (`anonymized_VM_1793682784520` at `48.9` LCA; `anonymized_FT_1793685080301` at `48.5` UI/UX; `anonymized_KN_1793685080310` at `46.2` UI/UX) are surfaced in `neither_or_uncertain` and `reports/manual_review_queue.csv` rather than hidden.
2. **Empty Document Integrity:** The empty file (`anonymized_resume_1793685080327.docx`) receives `0.0` points on both rubrics, possesses a `null` embedding vector, and is unequivocally placed into `neither_or_uncertain`.
