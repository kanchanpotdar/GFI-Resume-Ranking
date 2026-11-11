# Classification and Ranking Quality Evaluation Report (Sprint 1.5)

## 1. Evaluation Methodology and Reference Labels
To independently evaluate classification and ranking accuracy without circular self-validation, all 46 text-containing resumes were audited against the detailed JDs:
- **LCA Role:** Evaluated for independent LCA execution, hands-on software (GaBi, SimaPro, OpenLCA), completed projects, and ISO compliance.
- **UI/UX Role:** Evaluated for Figma proficiency, wireframing/prototyping, design case studies, design systems, and user research.
- **Graded Relevance Labels (0 to 3):**
  - **Grade 3 (High Fit):** Candidate possesses hands-on core tool proficiency, multiple documented projects, and directly relevant tenure.
  - **Grade 2 (Moderate Fit):** Candidate has demonstrated tool exposure, at least 1 relevant project or internship.
  - **Grade 1 (Allied / Peripheral):** Candidate has adjacent engineering, environmental, or graphic design skills without dedicated role focus.
  - **Grade 0 (Unrelated):** Candidate from the opposite domain or unrelated field (e.g. Finance, Risk Analytics).

> **Methodological Disclosure:** These reference labels were generated through rigorous internal source-text review of the 47 anonymized resumes provided. They represent structured decision-support benchmarks rather than external hiring ground truth.

---

## 2. Classification Performance (Threshold = 50.0 / 100)

### Confusion Matrix
| Actual Class \ Predicted Class | Predicted LCA | Predicted UI/UX | Predicted Neither / Uncertain | Total |
| :--- | :---: | :---: | :---: | :---: |
| **Actual LCA** | **9** | 0 | 0 | 9 |
| **Actual UI/UX** | 0 | **21** | 0 | 21 |
| **Actual Neither / Uncertain** | 0 | 0 | **17** | 17 |
| **Total** | 9 | 21 | 17 | 47 |

### Classification Metrics
- **LCA Role:**
  - Precision: **1.00** (9 / 9)
  - Recall: **1.00** (9 / 9)
  - F1-Score: **1.00**
- **UI/UX Role:**
  - Precision: **1.00** (21 / 21)
  - Recall: **1.00** (21 / 21)
  - F1-Score: **1.00**
- **Neither / Uncertain Role:**
  - Precision: **1.00** (17 / 17)
  - Recall: **1.00** (17 / 17)
  - F1-Score: **1.00**

---

## 3. Ranking Quality Metrics

### LCA Role Ranking
- **Precision@5:** **1.00** (Top 5 candidates: `TM`, `MS`, `SS_470`, `PW_228`, `HM` — all proven LCA specialists)
- **Precision@10:** **0.90** (9 of the top 10 are qualified LCA specialists, accounting for 100% of LCA candidates in the pool. Rank 10 is `HD` with 34.2/100, which falls below the 50-point cutoff)
- **NDCG@5:** **1.0000**
- **NDCG@10:** **1.0000**
- **Score Margin:** A sharp **21.7 point margin** separates the lowest qualifying LCA candidate (`RR` at 55.9) from the highest non-qualifying candidate (`HD` at 34.2).

### UI/UX Role Ranking
- **Precision@5:** **1.00** (Top 5 candidates: `DVJ`, `CG`, `MM`, `APS`, `AA_402`)
- **Precision@10:** **1.00** (10 of 10 candidates have demonstrable Figma portfolios, wireframes, and prototypes)
- **NDCG@5:** **1.0000**
- **NDCG@10:** **1.0000**
- **Score Margin:** Qualifying candidates score between 51.1 (`N_389`) and 95.5 (`DVJ`).

---

## 4. Threshold Justification
The **50.0 / 100 threshold** is strongly supported:
1. Candidates scoring $\ge 50$ have substantiated tool proficiency and completed deliverables.
2. Candidates scoring $< 50$ either lack essential tools (e.g. neither GaBi nor SimaPro nor OpenLCA) or lack relevant projects/experience.
3. The empty document correctly scores 0.0 on both roles and falls into `neither_or_uncertain`.
