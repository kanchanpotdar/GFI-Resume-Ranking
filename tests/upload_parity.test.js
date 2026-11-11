import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import { extractFromParagraphs, parseDateSpan, mergeIntervals, EVAL_REF_YEAR, EVAL_REF_MONTH } from "../lib/runtime_extractor.ts";
import { scoreLCARole, scoreUIUXRole, classifyCandidate } from "../lib/scoring.ts";

const ROOT = path.join(process.cwd());

test("Sprint 2 Gate: Runtime extractor parses DOCX and matches baseline attributes", async () => {
  const baselineData = JSON.parse(fs.readFileSync(path.join(ROOT, "data/baseline.json"), "utf8"));
  
  // Pick representative LCA candidate: TM_495
  const tmCandidate = baselineData.candidates.find((c) => c.candidateId.includes("TM_1793682784495"));
  assert.ok(tmCandidate, "Baseline candidate TM_495 should exist");

  const docxPath = path.join(ROOT, "Software Development Assignment Resumes", `${tmCandidate.candidateId}.docx`);
  assert.ok(fs.existsSync(docxPath), "Source DOCX must exist on disk");

  const fileBuffer = fs.readFileSync(docxPath);
  const mammothRes = await mammoth.extractRawText({ buffer: fileBuffer });
  const paras = mammothRes.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const runtimeExt = extractFromParagraphs(paras, tmCandidate.candidateId, `${tmCandidate.candidateId}.docx`, tmCandidate.sha256);

  assert.equal(runtimeExt.candidateId, tmCandidate.candidateId);
  assert.equal(runtimeExt.extractionStatus, "ready_for_extraction");
  assert.equal(runtimeExt.completedLcaProjectsCount, tmCandidate.extraction.completedLcaProjectsCount);
  assert.equal(runtimeExt.independentLcaExperienceMonths, tmCandidate.extraction.independentLcaExperienceMonths);
  assert.equal(runtimeExt.education.length, tmCandidate.extraction.education.length);
});

test("Sprint 2 Gate: Scoring parity between runtime extraction and baseline scores", () => {
  const baselineData = JSON.parse(fs.readFileSync(path.join(ROOT, "data/baseline.json"), "utf8"));
  
  // Pick representative UI/UX candidate: AY_440
  const ayCandidate = baselineData.candidates.find((c) => c.candidateId.includes("AY_1793685080440"));
  assert.ok(ayCandidate, "Baseline candidate AY_440 should exist");

  const uiuxScore = scoreUIUXRole(ayCandidate.extraction, ayCandidate.scores.uiux.semanticRawCosine);
  assert.equal(uiuxScore.totalScore, ayCandidate.scores.uiux.totalScore, "UI/UX total score must match baseline");
  assert.equal(uiuxScore.eligibilityFlags.eligibilityStatus, ayCandidate.scores.uiux.eligibilityFlags.eligibilityStatus);
});

test("Sprint 2 Gate: Empty document runtime upload produces zero scores and neither classification", () => {
  const emptyExt = extractFromParagraphs([], "empty_test", "empty.docx", "hash_0000");

  assert.equal(emptyExt.extractionStatus, "empty_document");
  assert.equal(emptyExt.totalExperienceMonths, 0);
  assert.equal(emptyExt.completedLcaProjectsCount, 0);

  const lcaScore = scoreLCARole(emptyExt, 0);
  const uiuxScore = scoreUIUXRole(emptyExt, 0);
  const classification = classifyCandidate(lcaScore, uiuxScore, emptyExt.extractionStatus);

  assert.equal(lcaScore.totalScore, 0);
  assert.equal(uiuxScore.totalScore, 0);
  assert.equal(lcaScore.eligibilityFlags.isEligible, false);
  assert.equal(lcaScore.eligibilityFlags.eligibilityStatus, "ineligible");
  assert.equal(classification.classification, "neither_or_uncertain");
});

test("Sprint 2 Gate: Date clamping prevents future dates from inflating experience", () => {
  // Date range extending to 2028
  const { interval, durationMonths } = parseDateSpan("2024 - 2028", EVAL_REF_YEAR, EVAL_REF_MONTH);
  assert.ok(interval, "Interval should exist");
  
  const maxRefIdx = EVAL_REF_YEAR * 12 + EVAL_REF_MONTH; // Nov 2026
  assert.ok(interval[1] <= maxRefIdx, `End index (${interval[1]}) must be clamped to reference date (${maxRefIdx})`);
});

test("Sprint 2 Gate: Generic modelling terms do not earn LCI methodology credit without LCA context", () => {
  const candidateWithCad = {
    extractionStatus: "ready_for_extraction",
    headline: "Mechanical Design Engineer",
    summary: "Expert in 3D CAD modeling, solidworks, and predictive modeling.",
    experience: [],
    projects: [],
    education: [],
    skills: { platforms: ["SolidWorks", "AutoCAD"], methods: ["3D Modelling"], domainKnowledge: [], softSkills: [], allSkills: ["SolidWorks", "AutoCAD", "3D Modelling"] },
    totalExperienceMonths: 24,
    independentLcaExperienceMonths: 0,
    designExperienceMonths: 0,
    completedLcaProjectsCount: 0,
    hasDesignPortfolioOrCaseStudies: false,
    hasUserResearchEvidence: false,
    contextualFlags: { relocationMentioned: true, travelWillingnessMentioned: true, commitmentMentioned: true, subjectiveTraitsRequireReview: false },
    warnings: [],
  };

  const lcaScore = scoreLCARole(candidateWithCad, 0);
  const lciReq = lcaScore.requirementsEvidence.find((r) => r.requirementKey === "lci_methodology");
  assert.ok(lciReq, "LCI requirement must be evaluated");
  assert.equal(lciReq.pointsAwarded, 0, "Generic CAD/3D modeling must NOT earn LCI methodology points");
});

test("Sprint 2 Gate: Decoupled mandatory eligibility flags distinguish conditional from unconditional eligibility", () => {
  const baselineData = JSON.parse(fs.readFileSync(path.join(ROOT, "data/baseline.json"), "utf8"));
  
  // Check candidate with OpenLCA (e.g. RR_428): has score >= 50 but missing GaBi/SimaPro hands-on
  const rrCandidate = baselineData.candidates.find((c) => c.candidateId.includes("RR_1793682784428"));
  assert.ok(rrCandidate, "Candidate RR_428 should exist");

  const lcaScore = rrCandidate.scores.lca;
  assert.ok(lcaScore.totalScore >= 50, "RR_428 score should be >= 50");
  assert.equal(lcaScore.eligibilityFlags.meetsRoleThreshold, true, "Score meets role threshold");
  assert.equal(lcaScore.eligibilityFlags.eligibilityStatus, "conditionally_eligible", "Must be flagged as conditionally_eligible due to OpenLCA/GaBi verification requirement");
  assert.equal(lcaScore.eligibilityFlags.isEligible, false, "isEligible must be false while conditional review is pending");
});
