import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { extractFromParagraphs } from "@/lib/runtime_extractor";
import { generateEmbedding, computeCosineSimilarity, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "@/lib/embeddings";
import { scoreLCARole, scoreUIUXRole, classifyCandidate } from "@/lib/scoring";
import { CandidateRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

// In-memory cache for JD embeddings
let cachedLcaJdEmbedding: number[] | null = null;
let cachedUiuxJdEmbedding: number[] | null = null;

async function getJdEmbeddings(): Promise<{ lcaEmbedding: number[]; uiuxEmbedding: number[] }> {
  if (cachedLcaJdEmbedding && cachedUiuxJdEmbedding) {
    return { lcaEmbedding: cachedLcaJdEmbedding, uiuxEmbedding: cachedUiuxJdEmbedding };
  }

  const lcaPath = path.join(process.cwd(), "data/jds/lca.md");
  const uiuxPath = path.join(process.cwd(), "data/jds/uiux.md");

  const lcaText = fs.readFileSync(lcaPath, "utf8");
  const uiuxText = fs.readFileSync(uiuxPath, "utf8");

  cachedLcaJdEmbedding = (await generateEmbedding(lcaText)) || [];
  cachedUiuxJdEmbedding = (await generateEmbedding(uiuxText)) || [];

  return { lcaEmbedding: cachedLcaJdEmbedding, uiuxEmbedding: cachedUiuxJdEmbedding };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const filename = file.name;
    const ext = path.extname(filename).toLowerCase();

    if (![".docx", ".pdf"].includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file format '${ext}'. Please upload a .docx or .pdf resume.` },
        { status: 400 }
      );
    }

    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File exceeds the maximum allowable size of 5MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Compute SHA-256
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    // Check duplicate in baseline dataset
    try {
      const baselinePath = path.join(process.cwd(), "data/baseline.json");
      if (fs.existsSync(baselinePath)) {
        const baselineData = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
        const existing = baselineData.candidates.find(
          (c: CandidateRecord) => c.sha256 === sha256 || c.sourceFilename === filename
        );
        if (existing) {
          return NextResponse.json({
            isDuplicate: true,
            candidate: existing,
            message: `Resume '${filename}' already exists in the system (Candidate ID: ${existing.candidateId}).`
          });
        }
      }
    } catch (e) {
      console.warn("Baseline check warning:", e);
    }

    // Extract text paragraphs
    let paras: string[] = [];
    if (ext === ".docx") {
      const mammothResult = await mammoth.extractRawText({ buffer });
      paras = mammothResult.value
        .split(/\r?\n/)
        .map(p => p.trim())
        .filter(Boolean);
    } else if (ext === ".pdf") {
      const pdfData = await pdfParse(buffer);
      paras = pdfData.text
        .split(/\r?\n/)
        .map(p => p.trim())
        .filter(Boolean);
    }

    const candidateId = `candidate_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const extraction = extractFromParagraphs(paras, candidateId, filename, sha256);

    // Embeddings & Scoring
    const { lcaEmbedding, uiuxEmbedding } = await getJdEmbeddings();

    let lcaVector: number[] | null = null;
    let uiuxVector: number[] | null = null;
    let rawLcaCosine = 0;
    let rawUiuxCosine = 0;

    if (extraction.extractionStatus !== "empty_document") {
      lcaVector = await generateEmbedding(extraction.lcaChunk || "");
      uiuxVector = await generateEmbedding(extraction.uiuxChunk || "");
      rawLcaCosine = computeCosineSimilarity(lcaVector, lcaEmbedding);
      rawUiuxCosine = computeCosineSimilarity(uiuxVector, uiuxEmbedding);
    }

    const lcaScore = scoreLCARole(extraction, rawLcaCosine);
    const uiuxScore = scoreUIUXRole(extraction, rawUiuxCosine);
    const { classification, reason } = classifyCandidate(lcaScore, uiuxScore, extraction.extractionStatus);

    const record: CandidateRecord = {
      candidateId,
      sourceType: "local_upload",
      sourceFilename: filename,
      sha256,
      extraction,
      embeddings: {
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
        lcaChunkVector: lcaVector,
        uiuxChunkVector: uiuxVector,
      },
      scores: {
        lca: lcaScore,
        uiux: uiuxScore,
      },
      classification,
      classificationReason: reason,
      schemaVersion: "1.0.0",
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      candidate: record
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: `Internal server error during resume processing: ${err?.message || "Unknown error"}` },
      { status: 500 }
    );
  }
}
