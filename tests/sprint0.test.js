const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

test("Sprint 0 Gate: Input manifest exists and contains 47 verified entries", () => {
  const manifestPath = path.join(__dirname, "../data/input_manifest.json");
  assert.ok(fs.existsSync(manifestPath), "input_manifest.json must exist");

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.strictEqual(manifest.total_files, 47, "Total resumes must be exactly 47");
  assert.strictEqual(manifest.ready_count, 46, "Ready files must be exactly 46");
  assert.strictEqual(manifest.empty_count, 1, "Empty files must be exactly 1");
  assert.strictEqual(manifest.corrupt_count, 0, "Corrupt files must be 0");
  assert.strictEqual(manifest.entries.length, 47, "Entries array must contain 47 items");

  const emptyDoc = manifest.entries.find(e => e.filename === "anonymized_resume_1793685080327.docx");
  assert.ok(emptyDoc, "anonymized_resume_1793685080327.docx must be in manifest");
  assert.strictEqual(emptyDoc.status, "empty_document", "Zero-text docx must be flagged as empty_document");
});

test("Sprint 0 Gate: Verbatim JD files exist with complete text", () => {
  const lcaPath = path.join(__dirname, "../data/jds/lca.md");
  const uiuxPath = path.join(__dirname, "../data/jds/uiux.md");

  assert.ok(fs.existsSync(lcaPath), "data/jds/lca.md must exist");
  assert.ok(fs.existsSync(uiuxPath), "data/jds/uiux.md must exist");

  const lcaText = fs.readFileSync(lcaPath, "utf8");
  const uiuxText = fs.readFileSync(uiuxPath, "utf8");

  assert.ok(lcaText.includes("LCA Consultant"), "LCA JD must mention LCA Consultant");
  assert.ok(lcaText.includes("Chennai"), "LCA JD must mention Chennai");
  assert.ok(lcaText.includes("GaBi") || lcaText.includes("SimaPro"), "LCA JD must mention GaBi/SimaPro");

  assert.ok(uiuxText.includes("UI/UX"), "UI/UX JD must mention UI/UX");
  assert.ok(uiuxText.includes("Figma"), "UI/UX JD must mention Figma");
});

test("Sprint 0 Gate: Scoring rubrics sum strictly to 100 points for both roles", () => {
  const lcaRubricPath = path.join(__dirname, "../data/rubrics/lca_rubric.json");
  const uiuxRubricPath = path.join(__dirname, "../data/rubrics/uiux_rubric.json");

  assert.ok(fs.existsSync(lcaRubricPath), "lca_rubric.json must exist");
  assert.ok(fs.existsSync(uiuxRubricPath), "uiux_rubric.json must exist");

  const lcaRubric = JSON.parse(fs.readFileSync(lcaRubricPath, "utf8"));
  const uiuxRubric = JSON.parse(fs.readFileSync(uiuxRubricPath, "utf8"));

  const lcaSum = Object.values(lcaRubric.weights).reduce((a, b) => a + b, 0);
  assert.strictEqual(lcaSum, 100, "LCA component weights must sum strictly to 100");

  const uiuxSum = Object.values(uiuxRubric.weights).reduce((a, b) => a + b, 0);
  assert.strictEqual(uiuxSum, 100, "UI/UX component weights must sum strictly to 100");

  assert.strictEqual(lcaRubric.weights.skills, 30);
  assert.strictEqual(lcaRubric.weights.experience, 30);
  assert.strictEqual(lcaRubric.weights.projects, 20);
  assert.strictEqual(lcaRubric.weights.semantic, 15);
  assert.strictEqual(lcaRubric.weights.education, 5);

  assert.strictEqual(uiuxRubric.weights.skills, 30);
  assert.strictEqual(uiuxRubric.weights.experience, 10);
  assert.strictEqual(uiuxRubric.weights.projects, 30);
  assert.strictEqual(uiuxRubric.weights.semantic, 20);
  assert.strictEqual(uiuxRubric.weights.education, 10);
});

test("Sprint 0 Gate: .env.example exists and contains no live secrets", () => {
  const envPath = path.join(__dirname, "../.env.example");
  assert.ok(fs.existsSync(envPath), ".env.example must exist");

  const envContent = fs.readFileSync(envPath, "utf8");
  assert.ok(envContent.includes("HUGGINGFACE_API_KEY"), "Must contain HUGGINGFACE_API_KEY placeholder");
  assert.ok(!envContent.includes("hf_live_"), "Must not contain real credentials");
});
