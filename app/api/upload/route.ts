import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { extractFromParagraphs } from "@/lib/runtime_extractor";
import { generateEmbedding, computeCosineSimilarity, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "@/lib/embeddings";
import { scoreLCARole, scoreUIUXRole, classifyCandidate } from "@/lib/scoring";
import { CandidateRecord, SYSTEM_VERSIONS } from "@/lib/types";
import {
  MAX_UPLOAD_BYTES,
  checkUploadRateLimit,
  checkZipSafety,
  sanitizeUploadFilename,
  validateFileMagicBytes
} from "@/lib/upload_validation";

export const dynamic = "force-dynamic";

// Concurrent-safe promise cache for JD embeddings
let jdEmbeddingsPromise: Promise<{ lcaEmbedding: number[]; uiuxEmbedding: number[] }> | null = null;

async function getJdEmbeddings(): Promise<{ lcaEmbedding: number[]; uiuxEmbedding: number[] }> {
  if (!jdEmbeddingsPromise) {
    jdEmbeddingsPromise = (async () => {
      const lcaPath = path.join(process.cwd(), "data/jds/lca.md");
      const uiuxPath = path.join(process.cwd(), "data/jds/uiux.md");

      const lcaText = fs.readFileSync(lcaPath, "utf8");
      const uiuxText = fs.readFileSync(uiuxPath, "utf8");

      const [lcaEmbedding, uiuxEmbedding] = await Promise.all([
        generateEmbedding(lcaText),
        generateEmbedding(uiuxText)
      ]);

      if (!lcaEmbedding || !uiuxEmbedding) {
        throw new Error("Failed to compute canonical JD reference embeddings");
      }

      return { lcaEmbedding, uiuxEmbedding };
    })().catch((err) => {
      jdEmbeddingsPromise = null;
      throw err;
    });
  }

  return jdEmbeddingsPromise;
}

export async function POST(req: NextRequest) {
  try {
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "local";
    const rateCheck = checkUploadRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Please retry after ${rateCheck.retryAfterSeconds} seconds.` },
        {
          status: 429,
          headers: { "Retry-After": String(rateCheck.retryAfterSeconds) }
        }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const filename = sanitizeUploadFilename(file.name);
    const ext = path.extname(filename).toLowerCase();

    if (![".docx", ".pdf"].includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file format '${ext}'. Please upload a .docx or .pdf resume.` },
        { status: 400 }
      );
    }

    // 5MB limit
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the maximum allowable size of 5MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 0-byte and byte-length recheck
    if (buffer.length === 0) {
      return NextResponse.json(
        { error: "Uploaded file is empty (0 bytes)." },
        { status: 400 }
      );
    }
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the maximum allowable size of 5MB." },
        { status: 400 }
      );
    }

    // Validate actual file content (magic bytes + ZIP structure)
    const magicCheck = validateFileMagicBytes(buffer, ext);
    if (!magicCheck.valid) {
      return NextResponse.json({ error: magicCheck.error }, { status: 400 });
    }

    if (ext === ".docx" && !checkZipSafety(buffer)) {
      return NextResponse.json(
        { error: "File uncompressed structure exceeds safe limit or has malformed ZIP headers (possible compression bomb)." },
        { status: 400 }
      );
    }

    // Compute SHA-256
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    // Check exact duplicate in baseline dataset strictly by SHA-256
    try {
      const baselinePath = path.join(process.cwd(), "data/baseline.json");
      if (fs.existsSync(baselinePath)) {
        const baselineData = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
        const existing = baselineData.candidates.find(
          (c: CandidateRecord) => c.sha256 === sha256
        );
        if (existing) {
          return NextResponse.json({
            isDuplicate: true,
            candidate: existing,
            message: `Resume with SHA-256 (${sha256.slice(0, 12)}...) already exists as Candidate ${existing.candidateId}.`
          });
        }
      }
    } catch (e) {
      console.warn("Baseline duplicate check warning:", e);
    }

    // Extract text paragraphs with explicit parser & scanned-PDF handling
    let paras: string[] = [];
    try {
      if (ext === ".docx") {
        const mammothResult = await mammoth.extractRawText({ buffer });
        paras = mammothResult.value
          .split(/\r?\n/)
          .map(p => p.trim())
          .filter(Boolean);
      } else if (ext === ".pdf") {
        const pdfData = await pdfParse(buffer);
        paras = (pdfData.text || "")
          .split(/\r?\n/)
          .map(p => p.trim())
          .filter(Boolean);
        if (paras.length === 0) {
          return NextResponse.json(
            {
              error:
                "No extractable text found in PDF (file appears scanned, image-only, or blank). OCR is not enabled; please upload a text-selectable PDF or DOCX."
            },
            { status: 422 }
          );
        }
      }
    } catch (parseErr) {
      console.warn("Document parser error:", parseErr instanceof Error ? parseErr.message : "Corrupt file");
      return NextResponse.json(
        {
          error:
            "Unable to extract text from the uploaded document. The file appears corrupted, password-protected, or structurally invalid."
        },
        { status: 400 }
      );
    }

    const candidateId = `candidate_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const extraction = extractFromParagraphs(paras, candidateId, filename, sha256);

    // Embeddings & Scoring (fail loudly on provider failure — never fabricate scores)
    let lcaVector: number[] | null = null;
    let uiuxVector: number[] | null = null;
    let rawLcaCosine = 0;
    let rawUiuxCosine = 0;

    if (extraction.extractionStatus !== "empty_document") {
      try {
        const { lcaEmbedding, uiuxEmbedding } = await getJdEmbeddings();
        [lcaVector, uiuxVector] = await Promise.all([
          generateEmbedding(extraction.lcaChunk || ""),
          generateEmbedding(extraction.uiuxChunk || "")
        ]);
        if (!lcaVector || !uiuxVector) {
          throw new Error("Embedding service returned empty vector for non-empty resume");
        }
        rawLcaCosine = computeCosineSimilarity(lcaVector, lcaEmbedding);
        rawUiuxCosine = computeCosineSimilarity(uiuxVector, uiuxEmbedding);
      } catch (embErr) {
        console.error("Embedding inference failed:", embErr instanceof Error ? embErr.message : "Unknown error");
        return NextResponse.json(
          {
            error:
              "Semantic embedding service is temporarily unavailable; resume scoring was aborted rather than fabricating scores. Please retry shortly."
          },
          { status: 503 }
        );
      }
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
        modelRevision: SYSTEM_VERSIONS.embeddingRevision,
        chunkingVersion: SYSTEM_VERSIONS.chunkingVersion,
        lcaChunkVector: lcaVector,
        uiuxChunkVector: uiuxVector,
      },
      scores: {
        lca: lcaScore,
        uiux: uiuxScore,
      },
      classification,
      classificationReason: reason,
      schemaVersion: SYSTEM_VERSIONS.schemaVersion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      requiresReprocessing: false,
    };

    return NextResponse.json({
      success: true,
      candidate: record
    });
  } catch (err: any) {
    console.error("Internal resume processing failure:", err);
    return NextResponse.json(
      { error: "An error occurred while parsing and processing the resume. Please ensure the document is a valid, uncorrupted PDF or DOCX file." },
      { status: 500 }
    );
  }
}
