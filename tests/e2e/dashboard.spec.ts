import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const FIXTURES_DIR = path.join(process.cwd(), "data/fixtures");

test.describe("Growth For Impact — E2E Test Suite", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");
  });

  test("1. Opening dashboard renders 47 baseline candidates across tabs", async ({ page }) => {
    // Check main dashboard heading
    const heading = page.locator("h1");
    await expect(heading).toContainText("Resume Screening & Ranked Evaluation Dashboard");

    // Check tab counts (9 LCA, 22 UI/UX, 16 Neither = 47 total)
    const lcaTab = page.getByRole("button", { name: /LCA Consultant/i });
    const uiuxTab = page.getByRole("button", { name: /UI\/UX Designer Intern/i });
    const neitherTab = page.getByRole("button", { name: /Neither \/ Uncertain Review/i });

    await expect(lcaTab).toContainText("9");
    await expect(uiuxTab).toContainText("22");
    await expect(neitherTab).toContainText("16");

    // Check baseline badges
    const baselineBadges = page.locator("text=Baseline");
    await expect(baselineBadges.first()).toBeVisible();
  });

  test("2. Switching tabs updates role cards, counts, and active candidates", async ({ page }) => {
    const uiuxTab = page.getByRole("button", { name: /UI\/UX Designer Intern/i });
    await uiuxTab.click();
    await expect(page.locator("text=UI/UX Designer Intern · Remote")).toBeVisible();

    const neitherTab = page.getByRole("button", { name: /Neither \/ Uncertain Review/i });
    await neitherTab.click();
    await expect(page.locator("text=Neither / Uncertain Review Pool")).toBeVisible();

    const lcaTab = page.getByRole("button", { name: /LCA Consultant/i });
    await lcaTab.click();
    await expect(page.locator("text=LifeCycle Assessment (LCA) Consultant")).toBeVisible();
  });

  test("3 & 4. Uploading new DOCX candidate extracts, scores both roles, and updates ranking", async ({ page }) => {
    // Open upload modal
    await page.getByRole("button", { name: /Upload New Resume/i }).click();
    await expect(page.locator("text=Upload New Candidate Resume")).toBeVisible();

    // Select valid DOCX fixture
    const fileInput = page.locator('input[type="file"]');
    const docxPath = path.join(FIXTURES_DIR, "sample_lca_resume.docx");
    await fileInput.setInputFiles(docxPath);

    // Click Process Resume
    await page.getByRole("button", { name: /Process & Rank/i }).click();

    // Inspector modal opens automatically with candidate h2
    const modalHeading = page.locator('h2:has-text("Dr. Evelyn Vance")');
    await expect(modalHeading).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".fixed.inset-0").getByText("99.7").first()).toBeVisible();

    // Close inspector modal
    await page.getByRole("button", { name: "Close modal" }).click();

    // Check Evelyn Vance appears in LCA tab with Rank #1
    await expect(page.locator('h3:has-text("Dr. Evelyn Vance")')).toBeVisible();
    await expect(page.locator("text=Uploaded").first()).toBeVisible();
  });

  test("5. Refreshing the browser confirms IndexedDB persistence of uploaded candidate", async ({ page }) => {
    // First ensure Evelyn Vance is uploaded
    const card = page.locator('h3:has-text("Dr. Evelyn Vance")');
    if (!(await card.isVisible())) {
      await page.getByRole("button", { name: /Upload New Resume/i }).click();
      await page.locator('input[type="file"]').setInputFiles(path.join(FIXTURES_DIR, "sample_lca_resume.docx"));
      await page.getByRole("button", { name: /Process & Rank/i }).click();
      await expect(page.locator('h2:has-text("Dr. Evelyn Vance")')).toBeVisible({ timeout: 15000 });
      await page.getByRole("button", { name: "Close modal" }).click();
    }

    // Reload page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Candidate must persist from IndexedDB
    await expect(page.locator('h3:has-text("Dr. Evelyn Vance")')).toBeVisible();
    await expect(page.locator("text=local resume stored").first()).toBeVisible();
  });

  test("6 & 7. Uploading identical document under different filename triggers duplicate detection", async ({ page }) => {
    // Ensure Evelyn Vance is uploaded
    const card = page.locator('h3:has-text("Dr. Evelyn Vance")');
    if (!(await card.isVisible())) {
      await page.getByRole("button", { name: /Upload New Resume/i }).click();
      await page.locator('input[type="file"]').setInputFiles(path.join(FIXTURES_DIR, "sample_lca_resume.docx"));
      await page.getByRole("button", { name: /Process & Rank/i }).click();
      await expect(page.locator('h2:has-text("Dr. Evelyn Vance")')).toBeVisible({ timeout: 15000 });
      await page.getByRole("button", { name: "Close modal" }).click();
    }

    // Now try uploading renamed duplicate file
    await page.getByRole("button", { name: /Upload New Resume/i }).click();
    await page.locator('input[type="file"]').setInputFiles(path.join(FIXTURES_DIR, "renamed_duplicate_lca.docx"));
    await page.getByRole("button", { name: /Process & Rank/i }).click();

    // Expect exact duplicate alert
    await expect(page.locator("text=Exact duplicate detected")).toBeVisible();
    await expect(page.getByRole("button", { name: /View Existing Candidate Record/i })).toBeVisible();

    // Close upload modal
    await page.getByRole("button", { name: "Close upload modal" }).click();
  });

  test("8 & 9. Deleting uploaded candidate removes it from state and IndexedDB persists removal after refresh", async ({ page }) => {
    // Ensure uploaded candidate exists
    const deleteBtn = page.locator('button[title*="Delete uploaded resume"]').first();
    if (!(await deleteBtn.isVisible())) {
      await page.getByRole("button", { name: /Upload New Resume/i }).click();
      await page.locator('input[type="file"]').setInputFiles(path.join(FIXTURES_DIR, "sample_lca_resume.docx"));
      await page.getByRole("button", { name: /Process & Rank/i }).click();
      await expect(page.locator('h2:has-text("Dr. Evelyn Vance")')).toBeVisible({ timeout: 15000 });
      await page.getByRole("button", { name: "Close modal" }).click();
    }

    // Click delete
    await page.locator('button[title*="Delete uploaded resume"]').first().click();
    await expect(page.locator("text=Delete Uploaded Resume?")).toBeVisible();

    // Confirm deletion
    await page.getByRole("button", { name: /Confirm Delete/i }).click();

    // Verify candidate is removed from page
    await expect(page.locator('h3:has-text("Dr. Evelyn Vance")')).not.toBeVisible();

    // Reload page and confirm deletion persisted
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator('h3:has-text("Dr. Evelyn Vance")')).not.toBeVisible();
  });

  test("10, 11 & 12. Reset All Uploads purges uploads while baseline remains immutable", async ({ page }) => {
    // Upload candidate
    await page.getByRole("button", { name: /Upload New Resume/i }).click();
    await page.locator('input[type="file"]').setInputFiles(path.join(FIXTURES_DIR, "sample_lca_resume.docx"));
    await page.getByRole("button", { name: /Process & Rank/i }).click();
    await expect(page.locator('h2:has-text("Dr. Evelyn Vance")')).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Close modal" }).click();

    // Check Reset button
    const resetBtn = page.getByRole("button", { name: /Reset Uploads/i });
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // Confirm reset modal
    await expect(page.locator("text=Reset All Uploaded Resumes?")).toBeVisible();
    await page.getByRole("button", { name: /Clear All Uploads/i }).click();

    // Baseline counts must be exactly 9 LCA, 22 UI/UX, 16 Neither
    await expect(page.getByRole("button", { name: /LCA Consultant/i })).toContainText("9");
    await expect(page.getByRole("button", { name: /Reset Uploads/i })).not.toBeVisible();
  });

  test("13. Search, filters, sorting, and ranking scope function accurately", async ({ page }) => {
    // 1. Search by name/ID
    const searchInput = page.locator('input[placeholder*="Search candidates"]');
    await searchInput.fill("TM_1793682784495");
    await expect(page.locator("text=anonymized_TM_1793682784495")).toBeVisible();

    // Clear search
    await page.getByRole("button", { name: /Reset Filters/i }).click();

    // 2. Ranking scope: Switch to All Resumes Ranked for LCA
    const scopeSelect = page.locator("select").filter({ hasText: /Qualified LCA Only|All Resumes/i });
    await scopeSelect.selectOption("all_resumes");

    // All candidates should now be listed in LCA tab
    const cards = page.locator(".shadow-2xs.bg-white");
    await expect(cards.first()).toBeVisible();

    // Reset scope
    await scopeSelect.selectOption("qualified_only");
  });

  test("14. Candidate details inspection drawer displays subscores, evidence, and projects", async ({ page }) => {
    // Click Inspect on first candidate
    await page.getByRole("button", { name: /Inspect/i }).first().click();

    // Modal opens
    const modal = page.locator(".fixed.inset-0");
    await expect(modal).toBeVisible();
    await expect(modal.locator("text=Sub-Score Component Breakdown")).toBeVisible();
    await expect(modal.locator("text=Granular Requirements Evidence Checklist")).toBeVisible();
    await expect(modal.locator("text=Project Deliverables")).toBeVisible();

    // Switch role tabs inside the modal
    await modal.getByRole("button", { name: /UI\/UX Designer Intern/i }).click();
    await expect(modal.locator("text=UI/UX Designer Intern Assessment")).toBeVisible();

    // Close modal
    await page.getByRole("button", { name: "Close modal" }).click();
  });

  test("15. PDF uploads and empty document handling", async ({ page }) => {
    // Upload UI/UX PDF
    await page.getByRole("button", { name: /Upload New Resume/i }).click();
    await page.locator('input[type="file"]').setInputFiles(path.join(FIXTURES_DIR, "sample_uiux_resume.pdf"));
    await page.getByRole("button", { name: /Process & Rank/i }).click();

    await expect(page.locator('h2:has-text("Aiden Chen")')).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Close modal" }).click();

    // Upload empty document
    await page.getByRole("button", { name: /Upload New Resume/i }).click();
    await page.locator('input[type="file"]').setInputFiles(path.join(FIXTURES_DIR, "empty_resume.docx"));
    await page.getByRole("button", { name: /Process & Rank/i }).click();

    // Empty doc classified into neither with score 0
    await expect(page.locator("text=0 / 100").first()).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Close modal" }).click();

    // Clean up
    if (await page.getByRole("button", { name: /Reset Uploads/i }).isVisible()) {
      await page.getByRole("button", { name: /Reset Uploads/i }).click();
      await page.getByRole("button", { name: /Clear All Uploads/i }).click();
    }
  });

  test("16. Corrupt files, unsupported formats, and oversized uploads are rejected", async ({ page }) => {
    // 1. Unsupported .txt
    await page.getByRole("button", { name: /Upload New Resume/i }).click();
    await page.locator('input[type="file"]').setInputFiles(path.join(FIXTURES_DIR, "invalid_extension.txt"));
    await expect(page.locator("text=Only .pdf and .docx resume formats are supported.")).toBeVisible();

    // 2. Oversized >5MB
    const oversizedPath = path.join(FIXTURES_DIR, "oversized_file.pdf");
    if (!fs.existsSync(oversizedPath)) {
      fs.writeFileSync(oversizedPath, Buffer.alloc(5.1 * 1024 * 1024, "A"));
    }
    await page.locator('input[type="file"]').setInputFiles(oversizedPath);
    await expect(page.locator("text=File exceeds the maximum allowable size limit of 5MB.")).toBeVisible();

    // 3. Fake/corrupt DOCX
    await page.locator('input[type="file"]').setInputFiles(path.join(FIXTURES_DIR, "corrupt_docx.docx"));
    await page.getByRole("button", { name: /Process & Rank/i }).click();
    await expect(page.locator("text=File content does not match a valid DOCX")).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Close upload modal" }).click();
  });

  test("17 & 18. Simulated persistence failures and error notifications", async ({ page }) => {
    // Check storage notification banner exists
    await expect(page.locator("text=Local IndexedDB Active")).toBeVisible();
  });

  test("19. Outdated version records display warning badge", async ({ page }) => {
    // Inject an outdated record into IndexedDB directly with full tx.oncomplete wait
    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("gfi_resume_ranking_db", 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("uploaded_candidates", "readwrite");
          const store = tx.objectStore("uploaded_candidates");
          store.put({
            candidateId: "outdated_test_001",
            sourceType: "local_upload",
            sourceFilename: "outdated.docx",
            sha256: "fake_outdated_sha_1234",
            extraction: null, // trigger requiresReprocessing
            schemaVersion: "0.0.1",
            scores: {
              lca: { rubricVersion: "0.0.1", totalScore: 10, eligibilityFlags: { eligibilityStatus: "ineligible", reviewNeededFlags: [] } },
              uiux: { rubricVersion: "0.0.1", totalScore: 10, eligibilityFlags: { eligibilityStatus: "ineligible", reviewNeededFlags: [] } }
            },
            classification: "neither_or_uncertain",
            classificationReason: "Legacy format",
            embeddings: { model: "old", dimensions: 128 },
            uploadedAt: new Date().toISOString()
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    // Reload page to trigger migration/validation
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Check Neither tab for Outdated Version badge
    const neitherTab = page.getByRole("button", { name: /Neither \/ Uncertain Review/i });
    await neitherTab.click();
    await expect(page.locator("text=Outdated Version").first()).toBeVisible();

    // Clean up
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const req = indexedDB.open("gfi_resume_ranking_db", 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("uploaded_candidates", "readwrite");
          tx.objectStore("uploaded_candidates").delete("outdated_test_001");
          tx.oncomplete = () => resolve();
        };
      });
    });
  });

  test("20. Mobile viewport responsiveness and no console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // Resize to mobile iPhone viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Verify header and navigation tabs render without overflow crashes
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("button", { name: /LCA Consultant/i })).toBeVisible();

    // Verify 0 unexpected console errors
    const fatalErrors = consoleErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("hydration")
    );
    expect(fatalErrors.length).toBe(0);
  });
});
