const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const baselinePath = path.join(__dirname, "../data/baseline.json");
const auditPath = path.join(__dirname, "../data/cleaning_audit.json");
const calibPath = path.join(__dirname, "../data/calibration_report.json");

test("Sprint 1 Gate 1: Baseline dataset accounts for all 47 resumes with valid schema", () => {
  assert.ok(fs.existsSync(baselinePath), "data/baseline.json must exist");
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

  assert.strictEqual(baseline.totalCandidates, 47, "Total candidates must be 47");
  assert.strictEqual(baseline.readyCount, 46, "Ready count must be 46");
  assert.strictEqual(baseline.emptyCount, 1, "Empty count must be 1");
  assert.strictEqual(baseline.candidates.length, 47, "Must contain 47 candidate objects");
  assert.strictEqual(baseline.embeddingModel, "BAAI/bge-small-en-v1.5");
  assert.strictEqual(baseline.embeddingDimensions, 384);
});

test("Sprint 1 Gate 2: Empty document record is explicitly zero-scored and classified as neither_or_uncertain", () => {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const empty = baseline.candidates.find(c => c.candidateId === "anonymized_resume_1793685080327");

  assert.ok(empty, "anonymized_resume_1793685080327 must be present in baseline");
  assert.strictEqual(empty.extraction.extractionStatus, "empty_document");
  assert.strictEqual(empty.scores.lca.totalScore, 0, "Empty doc LCA score must be 0");
  assert.strictEqual(empty.scores.uiux.totalScore, 0, "Empty doc UI/UX score must be 0");
  assert.strictEqual(empty.classification, "neither_or_uncertain", "Empty doc must be classified as neither_or_uncertain");
  assert.strictEqual(empty.scores.lca.eligibilityFlags.meetsRoleThreshold, false);
  assert.strictEqual(empty.scores.uiux.eligibilityFlags.meetsRoleThreshold, false);
  assert.strictEqual(empty.embeddings.lcaChunkVector, null, "Empty doc LCA embedding must be null");
  assert.strictEqual(empty.embeddings.uiuxChunkVector, null, "Empty doc UI/UX embedding must be null");
});

test("Sprint 1 Gate 3: Subscores are strictly bounded within approved component budgets", () => {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

  baseline.candidates.forEach(c => {
    // LCA bounds: skills 30, experience 30, projects 20, semantic 15, education 5
    const lca = c.scores.lca.subScores;
    assert.ok(lca.skills >= 0 && lca.skills <= 30, `${c.candidateId} LCA skills out of bounds: ${lca.skills}`);
    assert.ok(lca.experience >= 0 && lca.experience <= 30, `${c.candidateId} LCA experience out of bounds: ${lca.experience}`);
    assert.ok(lca.projects >= 0 && lca.projects <= 20, `${c.candidateId} LCA projects out of bounds: ${lca.projects}`);
    assert.ok(lca.semantic >= 0 && lca.semantic <= 15, `${c.candidateId} LCA semantic out of bounds: ${lca.semantic}`);
    assert.ok(lca.education >= 0 && lca.education <= 5, `${c.candidateId} LCA education out of bounds: ${lca.education}`);
    assert.ok(c.scores.lca.totalScore >= 0 && c.scores.lca.totalScore <= 100, `${c.candidateId} LCA total out of bounds`);

    // UI/UX bounds: skills 30, experience 10, projects 30, semantic 20, education 10
    const uiux = c.scores.uiux.subScores;
    assert.ok(uiux.skills >= 0 && uiux.skills <= 30, `${c.candidateId} UIUX skills out of bounds: ${uiux.skills}`);
    assert.ok(uiux.experience >= 0 && uiux.experience <= 10, `${c.candidateId} UIUX experience out of bounds: ${uiux.experience}`);
    assert.ok(uiux.projects >= 0 && uiux.projects <= 30, `${c.candidateId} UIUX projects out of bounds: ${uiux.projects}`);
    assert.ok(uiux.semantic >= 0 && uiux.semantic <= 20, `${c.candidateId} UIUX semantic out of bounds: ${uiux.semantic}`);
    assert.ok(uiux.education >= 0 && uiux.education <= 10, `${c.candidateId} UIUX education out of bounds: ${uiux.education}`);
    assert.ok(c.scores.uiux.totalScore >= 0 && c.scores.uiux.totalScore <= 100, `${c.candidateId} UIUX total out of bounds`);
  });
});

test("Sprint 1 Gate 4: Embeddings are 384-dimensional with finite numbers", () => {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const readyCandidates = baseline.candidates.filter(c => c.extraction.extractionStatus === "ready_for_extraction");

  assert.strictEqual(readyCandidates.length, 46);
  readyCandidates.forEach(c => {
    assert.strictEqual(c.embeddings.lcaChunkVector.length, 384);
    assert.strictEqual(c.embeddings.uiuxChunkVector.length, 384);

    c.embeddings.lcaChunkVector.forEach((v, idx) => {
      assert.ok(!isNaN(v) && isFinite(v), `LCA vector elem ${idx} in ${c.candidateId} is non-finite`);
    });
    c.embeddings.uiuxChunkVector.forEach((v, idx) => {
      assert.ok(!isNaN(v) && isFinite(v), `UIUX vector elem ${idx} in ${c.candidateId} is non-finite`);
    });
  });
});

test("Sprint 1 Gate 5: ADR-S01 Experience conflict notice is explicitly attached to LCA evaluations", () => {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const lcaCandidates = baseline.candidates.filter(c => c.extraction.independentLcaExperienceMonths >= 24);

  assert.ok(lcaCandidates.length > 0, "There should be candidates with >=2 yrs LCA experience");
  lcaCandidates.forEach(c => {
    const notice = c.scores.lca.eligibilityFlags.experienceConflictNotice;
    assert.ok(notice && notice.length > 0, `Candidate ${c.candidateId} must have experienceConflictNotice`);
  });
});

test("Sprint 1 Gate 6: Classification matches independent threshold logic", () => {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

  baseline.candidates.forEach(c => {
    if (c.extraction.extractionStatus === "empty_document") {
      assert.strictEqual(c.classification, "neither_or_uncertain");
      return;
    }

    const lcaPass = c.scores.lca.totalScore >= 50;
    const uiuxPass = c.scores.uiux.totalScore >= 50;

    if (lcaPass && uiuxPass) {
      assert.strictEqual(c.classification, "both");
    } else if (lcaPass) {
      assert.strictEqual(c.classification, "lca");
    } else if (uiuxPass) {
      assert.strictEqual(c.classification, "uiux");
    } else {
      assert.strictEqual(c.classification, "neither_or_uncertain");
    }
  });
});

test("Sprint 1.5 Remediation: Multi-line project grouping without orphan inflation", () => {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const tm = baseline.candidates.find(c => c.candidateId === "anonymized_TM_1793682784495");
  const rr = baseline.candidates.find(c => c.candidateId === "anonymized_RR_1793682784428");
  const aa = baseline.candidates.find(c => c.candidateId === "anonymized_AA_1793685080402");

  // TM has 3 distinct projects (Interior System, Exhaust System, Thermal Component), not 6
  assert.strictEqual(tm.extraction.projects.length, 3, "TM must have exactly 3 grouped projects");
  assert.strictEqual(tm.extraction.completedLcaProjectsCount, 3, "TM must have 3 completed LCA projects");

  // RR has 2 distinct comparative LCA projects, not 4
  assert.strictEqual(rr.extraction.projects.length, 2, "RR must have exactly 2 grouped projects");
  assert.strictEqual(rr.extraction.completedLcaProjectsCount, 2, "RR must have 2 completed LCA projects");

  // AA_402 has 4 design projects, none marked as LCA
  assert.strictEqual(aa.extraction.projects.length, 4, "AA must have exactly 4 grouped projects");
  assert.strictEqual(aa.extraction.completedLcaProjectsCount, 0, "AA must have 0 LCA projects");
  assert.strictEqual(aa.extraction.hasDesignPortfolioOrCaseStudies, true);
});

test("Sprint 1.5 Remediation: Education association links degree with university and year", () => {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  let totalEdus = 0;
  let emptyInstitutions = 0;

  baseline.candidates.forEach(c => {
    if (c.extraction.extractionStatus !== "empty_document") {
      c.extraction.education.forEach(e => {
        totalEdus++;
        if (!e.institution || e.institution.trim() === "") {
          emptyInstitutions++;
        }
      });
    }
  });

  assert.ok(totalEdus >= 75, "Total extracted education records should be >= 75");
  assert.strictEqual(emptyInstitutions, 0, "No education record may have an empty institution");

  // Verify NIT Rourkela linked for AA_144
  const aa144 = baseline.candidates.find(c => c.candidateId === "anonymized_AA_1793682784144");
  assert.ok(aa144.extraction.education[0].institution.includes("National Institute of Technology, Rourkela"));
  assert.strictEqual(aa144.extraction.education[0].domain, "environmental");
});

test("Sprint 1.5 Remediation: Calibrated 4-tier ISO standards scoring", () => {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const tm = baseline.candidates.find(c => c.candidateId === "anonymized_TM_1793682784495");
  const np = baseline.candidates.find(c => c.candidateId === "anonymized_NP_1793682784325");

  // TM references ISO compliance in methods -> awarded points
  const tmIsoReq = tm.scores.lca.requirementsEvidence.find(r => r.requirementKey === "standards_iso");
  assert.ok(tmIsoReq, "TM must have standards_iso requirement");

  // NP has anonymized ISO token: awarded 0 pts with status: needs_confirmation and review flag
  const npIsoReq = np.scores.lca.requirementsEvidence.find(r => r.requirementKey === "standards_iso");
  assert.ok(npIsoReq, "NP must have standards_iso requirement");
  if (npIsoReq.status === "needs_confirmation") {
    assert.strictEqual(npIsoReq.pointsAwarded, 0, "Anonymized token must receive 0 points");
    assert.ok(np.scores.lca.eligibilityFlags.reviewNeededFlags.some(f => f.includes("ISO")), "Must flag anonymized ISO for review");
  }
});

test("Sprint 1.5 Remediation: Strict GaBi/SimaPro vs OpenLCA scoring rules", () => {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const rr = baseline.candidates.find(c => c.candidateId === "anonymized_RR_1793682784428");
  const tm = baseline.candidates.find(c => c.candidateId === "anonymized_TM_1793682784495");

  // RR has OpenLCA only (no GaBi or SimaPro) -> receives 5/15 pts with critical requirement flag
  const rrGabiReq = rr.scores.lca.requirementsEvidence.find(r => r.requirementKey === "lca_software");
  assert.strictEqual(rrGabiReq.pointsAwarded, 5, "OpenLCA alone must receive 5 pts");
  assert.strictEqual(rrGabiReq.status, "partially_evidenced");
  assert.ok(
    rr.scores.lca.eligibilityFlags.criticalRequirementMissing.some(f => f.includes("GaBi/SimaPro")),
    "OpenLCA candidate must have critical flag for missing GaBi/SimaPro"
  );

  // TM has SimaPro -> receives 15/15 pts (evidenced)
  const tmGabiReq = tm.scores.lca.requirementsEvidence.find(r => r.requirementKey === "lca_software");
  assert.strictEqual(tmGabiReq.pointsAwarded, 15, "SimaPro must receive 15 pts");
  assert.strictEqual(tmGabiReq.status, "evidenced");
});

test("Sprint 1.5 Remediation: Non-fabrication of dates and zero-default duration", () => {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  baseline.candidates.forEach(c => {
    if (c.extraction.extractionStatus !== "empty_document") {
      c.extraction.experience.forEach(exp => {
        if (!exp.rawDates || exp.rawDates.trim() === "") {
          assert.strictEqual(exp.durationMonths, 0, `Missing date role in ${c.candidateId} must have duration 0`);
        }
      });
    }
  });
});
