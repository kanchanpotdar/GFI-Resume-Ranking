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

test("Sprint 1 Gate 7: Cleaning audit log and calibration report exist and are consistent", () => {
  assert.ok(fs.existsSync(auditPath), "data/cleaning_audit.json must exist");
  assert.ok(fs.existsSync(calibPath), "data/calibration_report.json must exist");

  const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
  const calib = JSON.parse(fs.readFileSync(calibPath, "utf8"));

  assert.strictEqual(audit.length, 47, "Audit log must contain 47 entries");
  assert.strictEqual(calib.thresholds.lca, 50);
  assert.strictEqual(calib.thresholds.uiux, 50);
  assert.strictEqual(calib.datasetSummary.totalCandidates, 47);
  assert.strictEqual(calib.datasetSummary.emptyCandidates, 1);
  assert.ok(calib.representativeReviewedSamples.length >= 3);
});
