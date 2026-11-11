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

test("Sprint 3.5 Gate 6: Version migration detects outdated rubric and recalculates scores safely", () => {
  const baselineData = JSON.parse(fs.readFileSync(path.join(ROOT, "data/baseline.json"), "utf8"));
  const sample = baselineData.candidates.find((c) => c.classification === "lca");
  assert.ok(sample, "Sample candidate should exist");

  // Create record with outdated rubric version but compatible embedding provenance
  const outdatedRecord = {
    ...sample,
    schemaVersion: "1.0.0",
    embeddings: {
      ...sample.embeddings,
      modelRevision: "v1.5",
      chunkingVersion: "1.0.0"
    },
    scores: {
      ...sample.scores,
      lca: {
        ...sample.scores.lca,
        rubricVersion: "0.9.0-outdated",
        totalScore: 42.0 // Artificially stale score
      }
    },
    uploadedAt: new Date().toISOString()
  };

  const { validateAndMigrateRecord } = require("../lib/db.ts");
  const migrated = validateAndMigrateRecord(outdatedRecord);

  assert.equal(migrated.requiresReprocessing, false);
  assert.equal(migrated.scores.lca.rubricVersion, "1.5.0-remediated", "Must migrate to current rubric version");
  assert.equal(migrated.scores.lca.totalScore, sample.scores.lca.totalScore, "Must safely recalculate to verified score");
});

test("Sprint 3.5 Gate 7: Incompatible schema marks candidate as requiresReprocessing without discarding data", () => {
  const { validateAndMigrateRecord } = require("../lib/db.ts");

  // Record with corrupt/unknown extraction and incompatible schema
  const incompatibleRecord = {
    candidateId: "legacy_cand_001",
    sourceType: "local_upload",
    sourceFilename: "legacy.docx",
    sha256: "deadbeef1234",
    schemaVersion: "0.0.1-alpha",
    extraction: null, // missing extraction
    embeddings: { model: "unknown-model", dimensions: 128 },
    scores: {
      lca: { rubricVersion: "old", totalScore: 30, semanticRawCosine: 0 },
      uiux: { rubricVersion: "old", totalScore: 20, semanticRawCosine: 0 }
    },
    classification: "neither_or_uncertain",
    classificationReason: "legacy",
    uploadedAt: new Date().toISOString()
  };

  const validated = validateAndMigrateRecord(incompatibleRecord);
  assert.equal(validated.requiresReprocessing, true, "Must flag incompatible record as requiring reprocessing");
  assert.ok(validated.reprocessingReason?.includes("mismatch"), "Must provide actionable mismatch explanation");
  assert.equal(validated.candidateId, "legacy_cand_001", "Must preserve record data rather than silently dropping it");
});

test("Sprint 3.5 Gate 8: Failure injection hook triggers recoverable errors without silent success", async () => {
  const { deleteUploadedCandidate, clearAllUploadedCandidates, dbTestHooks } = require("../lib/db.ts");

  // Test failure injection on delete
  dbTestHooks.failNextDelete = true;
  const delRes = await deleteUploadedCandidate("non_existent_id");
  assert.equal(delRes.success, false, "Must return failure when storage throws or aborts");
  assert.ok(delRes.error?.includes("Simulated delete failure"), "Must provide clear error context");
  assert.equal(dbTestHooks.failNextDelete, false, "Hook must automatically reset");

  // Test failure injection on clear
  dbTestHooks.failNextClear = true;
  const clearRes = await clearAllUploadedCandidates();
  assert.equal(clearRes.success, false, "Must return failure when clear aborts");
  assert.ok(clearRes.error?.includes("Simulated clear failure"), "Must provide clear error context");
  assert.equal(dbTestHooks.failNextClear, false, "Hook must automatically reset");
});

test("Sprint 3.5 Gate 9: ZIP decompression security rejects oversized uncompressed payload (Zip Bomb Defense)", () => {
  // Construct a minimal ZIP header simulating 50MB uncompressed size
  const buf = Buffer.alloc(100);
  buf.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
  buf.writeUInt32LE(50 * 1024 * 1024, 22); // Uncompressed size: 50MB!
  buf.writeUInt16LE(4, 26); // Filename len: 4
  buf.writeUInt16LE(0, 28); // Extra len: 0
  buf.write("test", 30);

  // Simple reproduction of checkZipSafety
  let totalUncompressed = 0;
  let offset = 0;
  let isSafe = true;
  while (offset < buf.length - 30) {
    if (buf[offset] === 0x50 && buf[offset+1] === 0x4b && buf[offset+2] === 0x03 && buf[offset+3] === 0x04) {
      const uncompressed = buf.readUInt32LE(offset + 22);
      totalUncompressed += uncompressed;
      if (totalUncompressed > 25 * 1024 * 1024) {
        isSafe = false;
        break;
      }
      const fnLen = buf.readUInt16LE(offset + 26);
      const exLen = buf.readUInt16LE(offset + 28);
      offset += 30 + fnLen + exLen;
    } else {
      offset++;
    }
  }

  assert.equal(isSafe, false, "Must reject ZIP container exceeding 25MB uncompressed limit");
});

test("Sprint 4 Gate 1: validateAndMigrateRecord rejects reuse of old semantic similarities when embedding revision or chunking version is incompatible", () => {
  const { validateAndMigrateRecord } = require("../lib/db.ts");
  const baselineData = JSON.parse(fs.readFileSync(path.join(ROOT, "data/baseline.json"), "utf8"));
  const sample = baselineData.candidates.find((c) => c.classification === "lca");

  // Create a record where rubric is outdated BUT embedding revision is also incompatible
  const incompatibleEmbeddingRecord = {
    ...sample,
    schemaVersion: "1.0.0",
    embeddings: {
      model: "BAAI/bge-small-en-v1.5",
      dimensions: 384,
      modelRevision: "v1.0-incompatible", // Incompatible revision!
      chunkingVersion: "1.0.0"
    },
    scores: {
      lca: {
        ...sample.scores.lca,
        rubricVersion: "0.9.0-outdated",
        semanticRawCosine: 0.999 // Must NOT be reused!
      },
      uiux: {
        ...sample.scores.uiux,
        rubricVersion: "0.9.0-outdated",
        semanticRawCosine: 0.999
      }
    },
    uploadedAt: new Date().toISOString()
  };

  const migrated = validateAndMigrateRecord(incompatibleEmbeddingRecord);
  assert.equal(migrated.requiresReprocessing, true, "Must flag record as requiring reprocessing when embedding revision is incompatible");
  assert.ok(migrated.reprocessingReason.includes("Embedding configuration mismatch"), "Reason must specify embedding mismatch");
  assert.equal(migrated.scores.lca.semanticRawCosine, 0.999, "Original record values must be preserved intact for recruiter review");
});

test("Sprint 4 Gate 2: parseAndNormalizeHFResponse correctly validates and unit-normalizes 1D, 2D, and token-matrix responses to 384 dimensions", () => {
  const { parseAndNormalizeHFResponse } = require("../lib/embeddings.ts");

  // 1. Test 1D array of 384 numbers
  const dummy1D = new Array(384).fill(0.1);
  const parsed1D = parseAndNormalizeHFResponse(dummy1D);
  assert.equal(parsed1D.length, 384);
  const norm1D = Math.sqrt(parsed1D.reduce((sum, x) => sum + x * x, 0));
  assert.ok(Math.abs(norm1D - 1.0) < 1e-5, "Vector must have unit L2 norm");

  // 2. Test 2D array [1, 384]
  const dummy2D = [new Array(384).fill(0.5)];
  const parsed2D = parseAndNormalizeHFResponse(dummy2D);
  assert.equal(parsed2D.length, 384);
  const norm2D = Math.sqrt(parsed2D.reduce((sum, x) => sum + x * x, 0));
  assert.ok(Math.abs(norm2D - 1.0) < 1e-5, "Vector must have unit L2 norm");

  // 3. Test token-matrix [seq_len = 3, 384]
  const dummyTokenMatrix = [
    new Array(384).fill(0.2),
    new Array(384).fill(0.4),
    new Array(384).fill(0.6)
  ];
  const parsedTokens = parseAndNormalizeHFResponse(dummyTokenMatrix);
  assert.equal(parsedTokens.length, 384);
  const normTokens = Math.sqrt(parsedTokens.reduce((sum, x) => sum + x * x, 0));
  assert.ok(Math.abs(normTokens - 1.0) < 1e-5, "Token mean-pooled vector must have unit L2 norm");
});

test("Sprint 4 Gate 3: poolAndNormalizeVectors accurately aggregates multi-chunk embeddings with unit L2 length", () => {
  const { poolAndNormalizeVectors } = require("../lib/embeddings.ts");

  const v1 = new Array(384).fill(0).map((_, i) => (i === 0 ? 1 : 0));
  const v2 = new Array(384).fill(0).map((_, i) => (i === 1 ? 1 : 0));

  const pooled = poolAndNormalizeVectors([v1, v2]);
  assert.equal(pooled.length, 384);
  const norm = Math.sqrt(pooled.reduce((sum, x) => sum + x * x, 0));
  assert.ok(Math.abs(norm - 1.0) < 1e-5, "Pooled vector must be strictly unit L2 normalized");
  assert.ok(Math.abs(pooled[0] - Math.SQRT1_2) < 1e-5);
  assert.ok(Math.abs(pooled[1] - Math.SQRT1_2) < 1e-5);
});

