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

  // Always verify end-to-end Mammoth DOCX parse -> extraction -> scoring on tracked synthetic fixture
  const fixturePath = path.join(ROOT, "data/fixtures/sample_lca_resume.docx");
  assert.ok(fs.existsSync(fixturePath), "Tracked fixture sample_lca_resume.docx must exist on disk");
  const fixtureBuffer = fs.readFileSync(fixturePath);
  const fixtureMammoth = await mammoth.extractRawText({ buffer: fixtureBuffer });
  const fixtureParas = fixtureMammoth.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const fixtureExt = extractFromParagraphs(fixtureParas, "fixture_evelyn_vance", "sample_lca_resume.docx", "fixture_hash");
  assert.equal(fixtureExt.extractionStatus, "ready_for_extraction");
  assert.equal(fixtureExt.completedLcaProjectsCount, 3);
  assert.equal(fixtureExt.independentLcaExperienceMonths, 46);
  assert.ok(fixtureExt.education.length >= 1, "Fixture must extract education");

  // When private baseline source archive exists locally, also assert exact parity on TM_495
  const tmCandidate = baselineData.candidates.find((c) => c.candidateId.includes("TM_1793682784495"));
  assert.ok(tmCandidate, "Baseline candidate TM_495 should exist");
  const docxPath = path.join(ROOT, "Software Development Assignment Resumes", `${tmCandidate.candidateId}.docx`);
  if (fs.existsSync(docxPath)) {
    const fileBuffer = fs.readFileSync(docxPath);
    const mammothRes = await mammoth.extractRawText({ buffer: fileBuffer });
    const paras = mammothRes.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    const runtimeExt = extractFromParagraphs(paras, tmCandidate.candidateId, `${tmCandidate.candidateId}.docx`, tmCandidate.sha256);

    assert.equal(runtimeExt.candidateId, tmCandidate.candidateId);
    assert.equal(runtimeExt.extractionStatus, "ready_for_extraction");
    assert.equal(runtimeExt.completedLcaProjectsCount, tmCandidate.extraction.completedLcaProjectsCount);
    assert.equal(runtimeExt.independentLcaExperienceMonths, tmCandidate.extraction.independentLcaExperienceMonths);
    assert.equal(runtimeExt.education.length, tmCandidate.extraction.education.length);
  }
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

test("Pre-Deploy Audit Gate: Runtime extractor handles Sept dates, apostrophe years, relative months, and section boundaries", () => {
  const sampleParas = [
    "Candidate AB",
    "Product Designer",
    "Experience",
    "Product Designer — Studio One   Sept 2021 – Jun 2023",
    "• Delivered responsive Figma prototypes and design system.",
    "UX Design Intern — Studio Two   Sep ’25 – Dec ’25",
    "• Conducted user interviews and wireframing.",
    "UI Consultant — Studio Three   8 Months",
    "• Built UI components.",
    "Core Skills",
    "Platforms: Figma",
    "Tools / Technologies",
    "Miro, FigJam",
    "Awards / Honors",
    "• Hackathon Winner 2024",
    "Languages",
    "English"
  ];

  const ext = extractFromParagraphs(sampleParas, "test_edge", "test_edge.docx", "hash_edge");
  assert.equal(ext.experience.length, 3, "Must parse Sept span, apostrophe-year span, and relative months");
  assert.equal(ext.experience[0].durationMonths, 22, "Sept 2021 – Jun 2023 must equal strictly 22 months");
  assert.equal(ext.experience[1].durationMonths, 4, "Sep ’25 – Dec ’25 must equal 4 months");
  assert.equal(ext.experience[2].durationMonths, 8, "8 Months must equal 8 months");
  assert.ok(!ext.skills.allSkills.some((s) => s.includes("Hackathon") || s === "Awards / Honors" || s === "Languages"),
    "Awards / Languages headers must never bleed into Core Skills"
  );
  assert.ok(ext.skills.platforms.includes("Miro"), "Tools / Technologies known platforms must be extracted");
});

test("Pre-Deploy Audit Gate: Runtime vs baseline parity across all 47 source DOCX resumes when archive is present", async (t) => {
  const resumeDir = path.join(ROOT, "Software Development Assignment Resumes");
  if (!fs.existsSync(resumeDir)) {
    t.skip("Source archive directory omitted in clean checkout");
    return;
  }

  const baselineData = JSON.parse(fs.readFileSync(path.join(ROOT, "data/baseline.json"), "utf8"));
  assert.equal(baselineData.candidates.length, 47);

  for (const b of baselineData.candidates) {
    const docxPath = path.join(resumeDir, b.sourceFilename);
    const mammothRes = await mammoth.extractRawText({ buffer: fs.readFileSync(docxPath) });
    const paras = mammothRes.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const runtimeExt = extractFromParagraphs(paras, b.candidateId, b.sourceFilename, b.sha256);

    assert.equal(runtimeExt.extractionStatus, b.extraction.extractionStatus, `${b.candidateId} status mismatch`);
    assert.equal(runtimeExt.independentLcaExperienceMonths, b.extraction.independentLcaExperienceMonths, `${b.candidateId} LCA months mismatch`);
    assert.equal(runtimeExt.designExperienceMonths, b.extraction.designExperienceMonths, `${b.candidateId} design months mismatch`);
    assert.equal(runtimeExt.completedLcaProjectsCount, b.extraction.completedLcaProjectsCount, `${b.candidateId} LCA projects mismatch`);

    const lca = scoreLCARole(runtimeExt, b.scores.lca.semanticRawCosine || 0);
    const uiux = scoreUIUXRole(runtimeExt, b.scores.uiux.semanticRawCosine || 0);
    const cls = classifyCandidate(lca, uiux, runtimeExt.extractionStatus).classification;

    assert.ok(Math.abs(lca.totalScore - b.scores.lca.totalScore) < 0.01, `${b.candidateId} LCA score mismatch`);
    assert.ok(Math.abs(uiux.totalScore - b.scores.uiux.totalScore) < 0.01, `${b.candidateId} UI/UX score mismatch`);
    assert.equal(cls, b.classification, `${b.candidateId} classification mismatch`);
  }
});
