import { openDB, DBSchema, IDBPDatabase } from "idb";
import { CandidateRecord, SYSTEM_VERSIONS } from "./types";
import { scoreLCARole, scoreUIUXRole, classifyCandidate } from "./scoring";

export interface StoredCandidateRecord extends CandidateRecord {
  fileBlob?: Blob | null;
  uploadedAt: string;
}

interface GFIDatabaseSchema extends DBSchema {
  uploaded_candidates: {
    key: string; // candidateId
    value: StoredCandidateRecord;
    indexes: {
      "by-sha256": string;
      "by-uploadedAt": string;
    };
  };
}

const DB_NAME = "gfi_resume_ranking_db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<GFIDatabaseSchema>> | null = null;

// Test hooks for simulated failure injection
export const dbTestHooks = {
  failNextDelete: false,
  failNextClear: false,
  failNextSave: false,
  simulateSlowHydrationMs: 0,
};

export function getDatabase(): Promise<IDBPDatabase<GFIDatabaseSchema>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB is only accessible in browser environments"));
  }

  if (!dbPromise) {
    dbPromise = openDB<GFIDatabaseSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("uploaded_candidates")) {
          const store = db.createObjectStore("uploaded_candidates", {
            keyPath: "candidateId"
          });
          store.createIndex("by-sha256", "sha256", { unique: false });
          store.createIndex("by-uploadedAt", "uploadedAt", { unique: false });
        }
      }
    });
  }

  return dbPromise;
}

/**
 * Validates stored record against current system versions.
 * Safely recalculates scores if rubric version is outdated but extraction/embeddings exist.
 * Otherwise flags record as requiring reprocessing without discarding user data.
 */
export function validateAndMigrateRecord(record: StoredCandidateRecord): StoredCandidateRecord {
  const currentSchema = SYSTEM_VERSIONS.schemaVersion;
  const currentRubric = SYSTEM_VERSIONS.rubricVersion;
  const currentModel = SYSTEM_VERSIONS.embeddingModel;
  const currentRevision = SYSTEM_VERSIONS.embeddingRevision;
  const currentChunking = SYSTEM_VERSIONS.chunkingVersion;

  const schemaMatch = record.schemaVersion === currentSchema;
  const lcaRubricMatch = record.scores?.lca?.rubricVersion === currentRubric;
  const uiuxRubricMatch = record.scores?.uiux?.rubricVersion === currentRubric;
  
  // Strict embedding provenance verification
  const modelMatch = record.embeddings?.model === currentModel;
  const revisionMatch = Boolean(record.embeddings?.modelRevision && record.embeddings?.modelRevision === currentRevision);
  const chunkingMatch = Boolean(record.embeddings?.chunkingVersion && record.embeddings?.chunkingVersion === currentChunking);
  const embeddingCompatible = modelMatch && revisionMatch && chunkingMatch;

  // Fully current across all dimensions
  if (schemaMatch && lcaRubricMatch && uiuxRubricMatch && embeddingCompatible) {
    return {
      ...record,
      requiresReprocessing: false,
      reprocessingReason: undefined
    };
  }

  // If embedding configuration is incompatible, we MUST NOT reuse old semantic cosine scores!
  // Preserve the record but flag for reprocessing so user can re-upload resume.
  if (!embeddingCompatible) {
    const safeExtraction = record.extraction || {
      name: record.candidateId || "Outdated Candidate",
      headline: "Legacy record requiring reprocessing",
      totalExperienceMonths: 0,
      independentLcaExperienceMonths: 0,
      designExperienceMonths: 0,
      skills: { platforms: [], methods: [], allSkills: [] },
      education: [],
      projects: [],
      experienceHistory: [],
      extractionStatus: "error"
    };

    return {
      ...record,
      extraction: safeExtraction,
      requiresReprocessing: true,
      reprocessingReason: `Embedding configuration mismatch: stored (${record.embeddings?.model || "unknown"}, rev: ${record.embeddings?.modelRevision || "legacy"}, chunk: ${record.embeddings?.chunkingVersion || "legacy"}) vs current (${currentModel}, rev: ${currentRevision}, chunk: ${currentChunking}). Stored semantic similarities cannot be safely reused. Please re-upload resume.`
    };
  }

  // If embedding configuration IS compatible, but rubric is outdated, attempt safe score recalculation
  if (record.extraction && typeof record.scores?.lca?.semanticRawCosine === "number" && typeof record.scores?.uiux?.semanticRawCosine === "number") {
    try {
      const newLca = scoreLCARole(record.extraction, record.scores.lca.semanticRawCosine);
      const newUiux = scoreUIUXRole(record.extraction, record.scores.uiux.semanticRawCosine);
      const newClassification = classifyCandidate(newLca, newUiux, record.extraction.extractionStatus);

      return {
        ...record,
        schemaVersion: currentSchema,
        scores: {
          lca: newLca,
          uiux: newUiux
        },
        classification: newClassification.classification,
        classificationReason: newClassification.reason,
        updatedAt: new Date().toISOString(),
        requiresReprocessing: false,
        reprocessingReason: undefined
      };
    } catch (recalcErr) {
      console.warn(`Failed to auto-migrate candidate ${record.candidateId}:`, recalcErr);
    }
  }

  // If cannot safely recalculate, flag for user notice rather than discarding
  const safeExtraction = record.extraction || {
    name: record.candidateId || "Outdated Candidate",
    headline: "Legacy record requiring reprocessing",
    totalExperienceMonths: 0,
    independentLcaExperienceMonths: 0,
    designExperienceMonths: 0,
    skills: { platforms: [], methods: [], allSkills: [] },
    education: [],
    projects: [],
    experienceHistory: [],
    extractionStatus: "error"
  };

  return {
    ...record,
    extraction: safeExtraction,
    requiresReprocessing: true,
    reprocessingReason: `Config mismatch: stored rubric (${record.scores?.lca?.rubricVersion || "unknown"}) vs current (${currentRubric}). Please re-upload resume.`
  };
}

/**
 * Retrieves all locally uploaded candidate records from IndexedDB.
 */
export async function getAllUploadedCandidates(): Promise<CandidateRecord[]> {
  if (typeof window === "undefined") return [];
  try {
    if (dbTestHooks.simulateSlowHydrationMs > 0) {
      await new Promise((res) => setTimeout(res, dbTestHooks.simulateSlowHydrationMs));
    }

    const db = await getDatabase();
    const records = await db.getAll("uploaded_candidates");
    
    // Validate and migrate records
    const migrated = records.map((r) => validateAndMigrateRecord(r));

    // Sort by uploadedAt descending
    return migrated.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  } catch (err) {
    console.error("Failed to load uploaded candidates from IndexedDB:", err);
    throw err;
  }
}

/**
 * Saves or updates an uploaded candidate record in IndexedDB.
 * Gracefully degrades if quota is exceeded by shedding the raw file blob.
 */
export async function saveUploadedCandidate(
  candidate: CandidateRecord,
  fileBlob?: Blob | null
): Promise<{ success: boolean; blobSaved: boolean; error?: string }> {
  if (dbTestHooks.failNextSave) {
    dbTestHooks.failNextSave = false;
    return { success: false, blobSaved: false, error: "Simulated save failure" };
  }

  if (typeof window === "undefined") {
    return { success: false, blobSaved: false, error: "Window undefined" };
  }

  try {
    const db = await getDatabase();
    const storedRecord: StoredCandidateRecord = {
      ...candidate,
      sourceType: "local_upload",
      fileBlob: fileBlob || null,
      uploadedAt: candidate.updatedAt || new Date().toISOString()
    };

    try {
      await db.put("uploaded_candidates", storedRecord);
      return { success: true, blobSaved: !!fileBlob };
    } catch (putErr: any) {
      // Check for QuotaExceededError
      if (
        putErr?.name === "QuotaExceededError" ||
        putErr?.code === 22 ||
        putErr?.message?.toLowerCase().includes("quota")
      ) {
        console.warn("Storage quota exceeded with blob. Retrying without raw file blob...");
        const slimRecord: StoredCandidateRecord = {
          ...storedRecord,
          fileBlob: null
        };
        await db.put("uploaded_candidates", slimRecord);
        return { success: true, blobSaved: false, error: "Storage quota reached: saved candidate data without original document file." };
      }
      throw putErr;
    }
  } catch (err: any) {
    console.error("Failed to save candidate to IndexedDB:", err);
    return { success: false, blobSaved: false, error: err?.message || "Storage error" };
  }
}

/**
 * Deletes a single uploaded candidate from IndexedDB by candidateId.
 */
export async function deleteUploadedCandidate(candidateId: string): Promise<{ success: boolean; error?: string }> {
  if (dbTestHooks.failNextDelete) {
    dbTestHooks.failNextDelete = false;
    return { success: false, error: "Simulated delete failure (storage locked or unavailable)" };
  }

  if (typeof window === "undefined") return { success: false, error: "Window undefined" };

  try {
    const db = await getDatabase();
    await db.delete("uploaded_candidates", candidateId);
    return { success: true };
  } catch (err: any) {
    console.error(`Failed to delete candidate ${candidateId} from IndexedDB:`, err);
    return { success: false, error: err?.message || "Database deletion failed" };
  }
}

/**
 * Clears all uploaded candidate records from IndexedDB.
 * Does not affect baseline records.
 */
export async function clearAllUploadedCandidates(): Promise<{ success: boolean; error?: string }> {
  if (dbTestHooks.failNextClear) {
    dbTestHooks.failNextClear = false;
    return { success: false, error: "Simulated clear failure (storage transaction abort)" };
  }

  if (typeof window === "undefined") return { success: false, error: "Window undefined" };

  try {
    const db = await getDatabase();
    await db.clear("uploaded_candidates");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to clear uploaded candidates from IndexedDB:", err);
    return { success: false, error: err?.message || "Database clear failed" };
  }
}

/**
 * Checks for duplicate SHA-256 within the local IndexedDB store.
 */
export async function checkLocalDuplicate(sha256: string): Promise<CandidateRecord | null> {
  if (typeof window === "undefined") return null;
  try {
    const db = await getDatabase();
    const match = await db.getFromIndex("uploaded_candidates", "by-sha256", sha256);
    return match || null;
  } catch (err) {
    console.error("Error checking duplicate in IndexedDB:", err);
    return null;
  }
}
