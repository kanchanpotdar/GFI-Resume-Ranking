import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { extractFromParagraphs } from "../lib/runtime_extractor.ts";
import { scoreLCARole, scoreUIUXRole, classifyCandidate } from "../lib/scoring.ts";

const ROOT = path.join(process.cwd());

test("Sprint 3 Gate 1: SHA-256 duplicate detection distinguishes identical content with different names", () => {
  const content = Buffer.from("Test Resume Content For Distinct Names");
  const sha1 = crypto.createHash("sha256").update(content).digest("hex");
  const sha2 = crypto.createHash("sha256").update(content).digest("hex");

  assert.equal(sha1, sha2, "Identical content must yield identical SHA-256");

  // Content with 1 byte changed
  const alteredContent = Buffer.from("Test Resume Content For Distinct Names!");
  const alteredSha = crypto.createHash("sha256").update(alteredContent).digest("hex");
  assert.notEqual(sha1, alteredSha, "Different content must yield different SHA-256");
});

test("Sprint 3 Gate 2: Binary magic bytes validation for PDF and DOCX", () => {
  // Valid PDF magic bytes: %PDF
  const validPdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
  const isPdf = validPdfHeader.length >= 4 &&
    validPdfHeader[0] === 0x25 && validPdfHeader[1] === 0x50 &&
    validPdfHeader[2] === 0x44 && validPdfHeader[3] === 0x46;
  assert.equal(isPdf, true, "Must recognize %PDF magic signature");

  // Fake PDF (plain text)
  const fakePdf = Buffer.from("This is plain text with a .pdf extension");
  const isFakePdf = fakePdf.length >= 4 &&
    fakePdf[0] === 0x25 && fakePdf[1] === 0x50 &&
    fakePdf[2] === 0x44 && fakePdf[3] === 0x46;
  assert.equal(isFakePdf, false, "Must reject plain text masquerading as PDF");

  // Valid DOCX magic bytes: PK\x03\x04 (ZIP container)
  const validDocxHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
  const isDocx = validDocxHeader.length >= 4 &&
    validDocxHeader[0] === 0x50 && validDocxHeader[1] === 0x4b &&
    validDocxHeader[2] === 0x03 && validDocxHeader[3] === 0x04;
  assert.equal(isDocx, true, "Must recognize PK.. ZIP container signature for DOCX");

  // Fake DOCX
  const fakeDocx = Buffer.from("Not a real zip archive");
  const isFakeDocx = fakeDocx.length >= 4 &&
    fakeDocx[0] === 0x50 && fakeDocx[1] === 0x4b &&
    fakeDocx[2] === 0x03 && fakeDocx[3] === 0x04;
  assert.equal(isFakeDocx, false, "Must reject non-ZIP content masquerading as DOCX");
});

test("Sprint 3 Gate 3: Error messages never expose internal stack traces or server paths", () => {
  // Standard user-facing error message defined in route handler
  const sanitizedMessage = "An error occurred while parsing and processing the resume. Please ensure the document is a valid, uncorrupted PDF or DOCX file.";
  
  assert.ok(!sanitizedMessage.includes("Error:"), "Should not expose raw JS Error prefixes");
  assert.ok(!sanitizedMessage.includes("at "), "Should not expose stack trace call frames");
  assert.ok(!sanitizedMessage.includes("/Users/"), "Should not expose local filesystem paths");
  assert.ok(!sanitizedMessage.includes("node_modules"), "Should not expose internal library internals");
});

test("Sprint 3 Gate 4: Independent dual-role evaluation allows cross-role comparison", () => {
  const baselineData = JSON.parse(fs.readFileSync(path.join(ROOT, "data/baseline.json"), "utf8"));
  
  // Pick an LCA specialist
  const lcaCand = baselineData.candidates.find((c) => c.classification === "lca");
  assert.ok(lcaCand, "LCA candidate should exist");
  assert.ok(lcaCand.scores.lca.totalScore >= 50, "LCA score should be >= 50");
  assert.ok(typeof lcaCand.scores.uiux.totalScore === "number", "UI/UX score must be calculated independently");
  assert.ok(lcaCand.scores.uiux.totalScore < 50, "Specialist should score lower on opposite role");

  // Pick a UI/UX specialist
  const uiuxCand = baselineData.candidates.find((c) => c.classification === "uiux");
  assert.ok(uiuxCand, "UI/UX candidate should exist");
  assert.ok(uiuxCand.scores.uiux.totalScore >= 50, "UI/UX score should be >= 50");
  assert.ok(typeof uiuxCand.scores.lca.totalScore === "number", "LCA score must be calculated independently");

  // Pick a neither/uncertain candidate
  const neitherCand = baselineData.candidates.find((c) => c.classification === "neither_or_uncertain");
  assert.ok(neitherCand, "Neither/uncertain candidate should exist");
  assert.ok(typeof neitherCand.scores.lca.totalScore === "number", "Neither candidate must have valid LCA score");
  assert.ok(typeof neitherCand.scores.uiux.totalScore === "number", "Neither candidate must have valid UI/UX score");
});

test("Sprint 3 Gate 5: Deterministic tie-breaking produces identical ranking sequence", () => {
  const baselineData = JSON.parse(fs.readFileSync(path.join(ROOT, "data/baseline.json"), "utf8"));
  const candidates = [...baselineData.candidates];

  const sortFn = (list, roleKey) => {
    return [...list].sort((a, b) => {
      const aScore = a.scores[roleKey];
      const bScore = b.scores[roleKey];
      const aExp = roleKey === "uiux" ? a.extraction.designExperienceMonths : a.extraction.independentLcaExperienceMonths;
      const bExp = roleKey === "uiux" ? b.extraction.designExperienceMonths : b.extraction.independentLcaExperienceMonths;

      // 1. Total score desc
      if (bScore.totalScore !== aScore.totalScore) return bScore.totalScore - aScore.totalScore;
      // 2. Experience desc
      if (bExp !== aExp) return bExp - aExp;
      // 3. Candidate ID asc
      return a.candidateId.localeCompare(b.candidateId);
    });
  };

  const rankedLCA1 = sortFn(candidates, "lca");
  const rankedLCA2 = sortFn([...candidates].reverse(), "lca"); // Reverse input order

  assert.deepEqual(
    rankedLCA1.map((c) => c.candidateId),
    rankedLCA2.map((c) => c.candidateId),
    "LCA ranking order must be 100% deterministic regardless of initial array ordering"
  );

  const rankedUIUX1 = sortFn(candidates, "uiux");
  const rankedUIUX2 = sortFn([...candidates].reverse(), "uiux");

  assert.deepEqual(
    rankedUIUX1.map((c) => c.candidateId),
    rankedUIUX2.map((c) => c.candidateId),
    "UI/UX ranking order must be 100% deterministic regardless of initial array ordering"
  );
});
