# Growth For Impact — Candidate Scoring & Ranking Rubric

## 1. Overview
This document defines the transparent, reproducible scoring methodology for the Growth For Impact Resume Ranking prototype. Each candidate is independently evaluated against two distinct roles:
1. **LifeCycle Assessment (LCA) Consultant** (100 points total)
2. **UI/UX Designer Intern** (100 points total)

Candidate classification into **LCA**, **UI/UX**, **Both**, or **Neither / Uncertain** is performed independently based on calibrated qualification thresholds, rather than mutually exclusive forced ranking.

---

## 2. LCA Consultant Rubric (100 Points Total)

### Component Budget
- **Skills (30 pts):**
  - **15 pts:** Hands-on GaBi or SimaPro software expertise (Essential JD requirement).
  - **8 pts:** ISO 14040 / ISO 14044 standard adherence (Essential JD requirement).
  - **7 pts:** Life Cycle Inventory (LCI) data collection, validation, and modelling.
- **Relevant Experience (30 pts):**
  - **30 pts:** $\ge 3$ years of independent LCA project execution.
  - **28 pts:** 2 to 3 years of independent LCA project execution (per detailed JD requirement).
  - **18 pts:** 1 to 2 years independent LCA experience.
  - **10 pts:** $<1$ year LCA experience or internship.
  - **0 pts:** No evidenced LCA work.
- **Projects & Deliverables (20 pts):**
  - **20 pts:** $\ge 3$ distinct completed LCA studies (Mandatory per JD: "at least 03 LCA projects").
  - **14 pts:** 2 completed LCA projects.
  - **8 pts:** 1 completed LCA project.
  - **0 pts:** No substantiated LCA projects.
- **Semantic Relevance (15 pts):**
  - BGE-small embedding cosine similarity with JD text, normalized across baseline reference range $[0.50, 0.85]$ and scaled to 15 points.
- **Education & Domain (5 pts):**
  - **5 pts:** Bachelor's or Master's in Environmental domain (Environmental Engineering / Science / Sustainability).
  - **3 pts:** Allied engineering or science degrees (Chemical, Civil, Energy).
  - **0 pts:** Unrelated background.

### Experience Conflict Policy (ADR-S01)
- **Conflict:** The assignment overview labels the role as requiring **4–6 years**, whereas the detailed JD specifically asks for **2–3 years of running LCA projects independently**.
- **Operational Rule:** We evaluate independent LCA experience against the detailed JD (2–3 years) provisionally, ensuring qualified candidates are not artificially disqualified, while surfacing a clear recruiter warning for profiles between 2 and 4 years.
- **Contextual Logistics Flags:** Willingness to relocate to Chennai, travel across India, and 1-year commitment are treated as `needs_confirmation` flags during human review, never as negative score deductions.

---

## 3. UI/UX Designer Intern Rubric (100 Points Total)

### Component Budget
- **Skills (30 pts):**
  - **15 pts:** Figma and interactive high-fidelity prototyping proficiency (Essential).
  - **10 pts:** UI/UX principles, design systems, responsive web & mobile design.
  - **5 pts:** User research methods, usability testing, and interview techniques.
- **Relevant Experience (10 pts):**
  - **10 pts:** Candidates with 0–1 year in UI/UX design, internships, freelance, or demonstrable student design work (JD specifically welcomes 0–1 year). Excess experience is also awarded full points (not penalized).
  - **0 pts:** No evidenced design interest or work.
- **Projects & Portfolio (30 pts):**
  - **20 pts:** High-fidelity prototypes, Figma links, case studies, website/job-board interface projects.
  - **10 pts:** Evidenced user research, interview insights, persona mapping, or usability testing results.
- **Semantic Relevance (20 pts):**
  - BGE-small embedding cosine similarity with UI/UX JD text, normalized across reference range $[0.50, 0.85]$ and scaled to 20 points.
- **Education & Background (10 pts):**
  - **10 pts:** Design, HCI, Computer Science, Media, or related degree / coursework.
  - **7 pts:** General degree with completed design bootcamp / certifications.
  - **4 pts:** General degree.

### Subjective Traits Policy
- Traits such as "aesthetic sense", "eye for detail", and "understanding user psychology" are JD criteria that cannot be verified solely by automated keyword matching. The system surfaces these as `requires_review` indicators alongside portfolio links for recruiter inspection.

---

## 4. Classification Thresholds
- **LCA Match:** Score $\ge 50$ on LCA rubric with substantiated LCA evidence.
- **UI/UX Match:** Score $\ge 50$ on UI/UX rubric with evidenced design skills/projects.
- **Both:** Candidate meets threshold for both roles.
- **Neither / Uncertain:** Below threshold for both roles, or extraction failure / insufficient data.
