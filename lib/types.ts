export type RoleType = "lca" | "uiux";

export type ClassificationType = "lca" | "uiux" | "both" | "neither_or_uncertain";

export interface ExperienceItem {
  title: string;
  company: string;
  rawDates: string;
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
  durationMonths: number;
  bullets: string[];
  isIndependentLCA: boolean;
  isDesignRole: boolean;
  evidenceSpan?: string;
}

export interface ProjectItem {
  title: string;
  description: string;
  bullets: string[];
  tools: string[];
  isLCAProject: boolean;
  isDesignProject: boolean;
  evidenceSpan?: string;
}

export interface EducationItem {
  degree: string;
  institution: string;
  year?: string;
  score?: string;
  domain: "environmental" | "design" | "allied_technical" | "general" | "unknown";
  evidenceSpan?: string;
}

export interface CandidateExtraction {
  candidateId: string;
  sourceFilename: string;
  sourceFilepath: string;
  sha256: string;
  extractionStatus: "ready_for_extraction" | "empty_document" | "corrupt";
  name: string;
  headline: string;
  summary: string;
  experience: ExperienceItem[];
  projects: ProjectItem[];
  education: EducationItem[];
  certifications: string[];
  skills: {
    platforms: string[];
    methods: string[];
    domainKnowledge: string[];
    softSkills: string[];
    allSkills: string[];
  };
  totalExperienceMonths: number;
  independentLcaExperienceMonths: number;
  designExperienceMonths: number;
  completedLcaProjectsCount: number;
  hasDesignPortfolioOrCaseStudies: boolean;
  hasUserResearchEvidence: boolean;
  contextualFlags: {
    relocationMentioned: boolean;
    travelWillingnessMentioned: boolean;
    commitmentMentioned: boolean;
    subjectiveTraitsRequireReview: boolean;
  };
  rawTextLength: number;
  warnings: string[];
}

export interface SubScoreBreakdown {
  skills: number;
  experience: number;
  projects: number;
  semantic: number;
  education: number;
}

export interface RequirementEvidence {
  requirementKey: string;
  requirementName: string;
  status: "evidenced" | "partially_evidenced" | "not_evidenced" | "needs_confirmation";
  pointsAwarded: number;
  pointsMax: number;
  evidenceSpan: string;
}

export interface CandidateRoleScore {
  roleId: RoleType;
  roleTitle: string;
  rubricVersion: string;
  totalScore: number; // 0 - 100
  subScores: SubScoreBreakdown;
  semanticRawCosine: number;
  semanticNormalized: number;
  requirementsEvidence: RequirementEvidence[];
  eligibilityFlags: {
    experienceConflictNotice?: string;
    meetsRoleThreshold: boolean;
    criticalRequirementMissing?: string[];
    reviewNeededFlags: string[];
  };
  explanation: string;
}

export interface CandidateRecord {
  candidateId: string;
  sourceType: "baseline" | "local_upload";
  sourceFilename: string;
  sha256: string;
  extraction: CandidateExtraction;
  embeddings: {
    model: string;
    dimensions: number;
    lcaChunkVector?: number[] | null;
    uiuxChunkVector?: number[] | null;
  };
  scores: {
    lca: CandidateRoleScore;
    uiux: CandidateRoleScore;
  };
  classification: ClassificationType;
  classificationReason: string;
  schemaVersion: string;
  updatedAt: string;
}

export interface BaselineDataset {
  datasetVersion: string;
  generatedAt: string;
  totalCandidates: number;
  readyCount: number;
  emptyCount: number;
  embeddingModel: string;
  embeddingDimensions: number;
  candidates: CandidateRecord[];
}
