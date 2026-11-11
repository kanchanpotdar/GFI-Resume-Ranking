import {
  CandidateExtraction,
  CandidateRoleScore,
  ClassificationType,
  RequirementEvidence,
  SubScoreBreakdown,
} from "./types";

export const SCORING_VERSION = "1.5.0-remediated";
export const LCA_THRESHOLD = 50;
export const UIUX_THRESHOLD = 50;

// Semantic normalization parameters calibrated against BGE-small embeddings
export const SEMANTIC_REF_MIN = 0.50;
export const SEMANTIC_REF_MAX = 0.85;

export function normalizeCosineSimilarity(rawCosine: number): number {
  if (isNaN(rawCosine) || !isFinite(rawCosine)) return 0;
  const clamped = Math.max(SEMANTIC_REF_MIN, Math.min(SEMANTIC_REF_MAX, rawCosine));
  return (clamped - SEMANTIC_REF_MIN) / (SEMANTIC_REF_MAX - SEMANTIC_REF_MIN);
}

export function scoreLCARole(
  extraction: CandidateExtraction,
  rawCosineSimilarity: number = 0
): CandidateRoleScore {
  if (extraction.extractionStatus === "empty_document") {
    return {
      roleId: "lca",
      roleTitle: "LifeCycle Assessment (LCA) Consultant",
      rubricVersion: SCORING_VERSION,
      totalScore: 0,
      subScores: { skills: 0, experience: 0, projects: 0, semantic: 0, education: 0 },
      semanticRawCosine: 0,
      semanticNormalized: 0,
      requirementsEvidence: [],
      eligibilityFlags: {
        meetsRoleThreshold: false,
        criticalRequirementMissing: ["Document contains no text/content (0 XML text nodes)"],
        reviewNeededFlags: ["Empty document record: Unscorable due to insufficient evidence"],
      },
      explanation: "Document is empty (0 text nodes). Unscorable due to insufficient evidence.",
    };
  }

  const allText = [
    extraction.headline,
    extraction.summary,
    ...extraction.skills.allSkills,
    ...extraction.experience.map(e => `${e.title} ${e.company} ${e.bullets.join(" ")}`),
    ...extraction.projects.map(p => `${p.title} ${p.description} ${p.bullets.join(" ")}`),
  ].join(" ").toLowerCase();

  const reqEvidence: RequirementEvidence[] = [];

  // 1. SKILLS (Max 30 pts)
  // 1.1 GaBi or SimaPro hands-on (15 pts) - Essential JD requirement
  const hasGabi = allText.includes("gabi");
  const hasSimaPro = allText.includes("simapro");
  const hasOpenLca = allText.includes("openlca") || allText.includes("open lca");
  let gabiPoints = 0;
  let gabiEvidence = "Neither GaBi nor SimaPro explicitly evidenced in resume.";
  if (hasGabi && hasSimaPro) {
    gabiPoints = 15;
    gabiEvidence = "Evidenced hands-on expertise in both GaBi and SimaPro software.";
  } else if (hasGabi) {
    gabiPoints = 15;
    gabiEvidence = "Evidenced hands-on expertise in GaBi software.";
  } else if (hasSimaPro) {
    gabiPoints = 15;
    gabiEvidence = "Evidenced hands-on expertise in SimaPro software.";
  } else if (hasOpenLca) {
    gabiPoints = 5;
    gabiEvidence = "Mentions OpenLCA; GaBi/SimaPro hands-on experience requires verification.";
  }

  reqEvidence.push({
    requirementKey: "lca_software",
    requirementName: "GaBi or SimaPro hands-on software expertise",
    status: gabiPoints === 15 ? "evidenced" : gabiPoints > 0 ? "partially_evidenced" : "not_evidenced",
    pointsAwarded: gabiPoints,
    pointsMax: 15,
    evidenceSpan: gabiEvidence,
  });

  // 1.2 ISO 14040 / ISO 14044 compliance (8 pts) - 4-Tier Calibration
  const hasIsoExplicit = allText.includes("iso 14040") || allText.includes("iso 14044") ||
                         allText.includes("iso14040") || allText.includes("iso14044") ||
                         allText.includes("iso 14040/44") || allText.includes("iso 14040/14044");
  const hasIsoGeneric = (allText.includes("iso standard") || allText.includes("iso standards") ||
                         allText.includes("iso compliant lca") || allText.includes("iso-compliant lca") ||
                         allText.includes("iso methodology")) &&
                        (allText.includes("lca") || allText.includes("life cycle"));
  const hasIsoAnonymized = (allText.includes("iso /") || allText.includes("iso :2006") ||
                            allText.includes("iso lca") || allText.includes("iso s") || allText.includes("iso /s")) &&
                           (allText.includes("lca") || allText.includes("life cycle") || allText.includes("footprint") || allText.includes("pcf") || allText.includes("epd"));

  let isoPoints = 0;
  let isoStatus: "evidenced" | "partially_evidenced" | "needs_confirmation" | "not_evidenced" = "not_evidenced";
  let isoEvidence = "No explicit ISO 14040/14044 standards reference found.";

  if (hasIsoExplicit) {
    isoPoints = 8;
    isoStatus = "evidenced";
    isoEvidence = "Explicitly references ISO 14040/14044 standards adherence.";
  } else if (hasIsoGeneric) {
    isoPoints = 4;
    isoStatus = "partially_evidenced";
    isoEvidence = "Verifiable LCA context with generic standards adherence language (requires confirmation of 14040/44 citation).";
  } else if (hasIsoAnonymized) {
    isoPoints = 0;
    isoStatus = "needs_confirmation";
    isoEvidence = "Anonymized or masked ISO token ('ISO /' or 'ISO :2006') in LCA context; awarded 0 pts pending human unmasking.";
  }

  reqEvidence.push({
    requirementKey: "standards_iso",
    requirementName: "ISO 14040 / ISO 14044 compliance",
    status: isoStatus,
    pointsAwarded: isoPoints,
    pointsMax: 8,
    evidenceSpan: isoEvidence,
  });

  // 1.3 LCI Data Collection, Validation & LCA Modelling (7 pts)
  const hasLci = allText.includes("lci") || allText.includes("life cycle inventory");
  const hasModelling = allText.includes("lca modelling") || allText.includes("modelling") || allText.includes("modeling");
  const hasEpd = allText.includes("epd") || allText.includes("environmental product declaration");
  let lciPoints = 0;
  if (hasLci && hasModelling) lciPoints = 7;
  else if (hasLci || hasModelling || hasEpd || extraction.completedLcaProjectsCount > 0) lciPoints = 5;
  reqEvidence.push({
    requirementKey: "lci_methodology",
    requirementName: "LCI Data Collection, Validation & Modelling",
    status: lciPoints === 7 ? "evidenced" : lciPoints > 0 ? "partially_evidenced" : "not_evidenced",
    pointsAwarded: lciPoints,
    pointsMax: 7,
    evidenceSpan: lciPoints === 7 ? "Demonstrated LCI data collection & LCA modelling workflows." : lciPoints > 0 ? "Mention of LCI/EPD or modeling concepts in projects." : "Not evidenced.",
  });

  const skillsScore = gabiPoints + isoPoints + lciPoints;

  // 2. RELEVANT EXPERIENCE (Max 30 pts)
  const lcaMonths = extraction.independentLcaExperienceMonths;
  let expPoints = 0;
  let expNotice: string | undefined = undefined;

  if (lcaMonths >= 36) {
    expPoints = 30;
    expNotice = "Candidate has ≥3 years independent LCA experience (satisfies both 2–3 yr detailed JD and approaches 4–6 yr overview).";
  } else if (lcaMonths >= 24) {
    expPoints = 28;
    expNotice = "ADR-S01 Notice: Candidate has 2–3 years independent LCA experience (meets detailed JD requirement; recruiter should review against 4–6 yr overview summary).";
  } else if (lcaMonths >= 12) {
    expPoints = 18;
    expNotice = "Candidate has 1–2 years LCA experience (below 2–3 yr detailed requirement).";
  } else if (lcaMonths > 0) {
    expPoints = 10;
    expNotice = "Candidate has <1 year LCA experience or internship exposure only.";
  } else {
    expPoints = 0;
    expNotice = "No evidenced independent LCA execution tenure.";
  }

  reqEvidence.push({
    requirementKey: "independent_lca_experience",
    requirementName: "Independent LCA Project Experience (2–3 years per detailed JD)",
    status: expPoints >= 28 ? "evidenced" : expPoints > 0 ? "partially_evidenced" : "not_evidenced",
    pointsAwarded: expPoints,
    pointsMax: 30,
    evidenceSpan: `${(lcaMonths / 12).toFixed(1)} years evidenced (${lcaMonths} non-overlapping months). ${expNotice}`,
  });

  // 3. PROJECTS / DELIVERABLES (Max 20 pts)
  const completedProjects = extraction.completedLcaProjectsCount;
  let projectPoints = 0;
  if (completedProjects >= 3) projectPoints = 20;
  else if (completedProjects === 2) projectPoints = 14;
  else if (completedProjects === 1) projectPoints = 8;
  else projectPoints = 0;

  reqEvidence.push({
    requirementKey: "completed_lca_projects",
    requirementName: "Completed LCA Projects (≥3 required by JD)",
    status: completedProjects >= 3 ? "evidenced" : completedProjects > 0 ? "partially_evidenced" : "not_evidenced",
    pointsAwarded: projectPoints,
    pointsMax: 20,
    evidenceSpan: `${completedProjects} substantiated completed LCA project(s) identified.`,
  });

  // 4. SEMANTIC RELEVANCE (Max 15 pts)
  const normCosine = normalizeCosineSimilarity(rawCosineSimilarity);
  const semanticScore = Math.round(normCosine * 15 * 10) / 10;

  reqEvidence.push({
    requirementKey: "semantic_relevance",
    requirementName: "Semantic JD Alignment (BGE-small-en-v1.5)",
    status: normCosine >= 0.5 ? "evidenced" : "partially_evidenced",
    pointsAwarded: semanticScore,
    pointsMax: 15,
    evidenceSpan: `Cosine similarity: ${rawCosineSimilarity.toFixed(4)} (normalized score: ${(normCosine * 100).toFixed(1)}%).`,
  });

  // 5. EDUCATION & DOMAIN (Max 5 pts)
  const hasEnvEdu = extraction.education.some(e => e.domain === "environmental");
  const hasAlliedEdu = extraction.education.some(e => e.domain === "allied_technical");
  let eduPoints = 0;
  if (hasEnvEdu) eduPoints = 5;
  else if (hasAlliedEdu) eduPoints = 3;
  else eduPoints = 0;

  reqEvidence.push({
    requirementKey: "education_environmental",
    requirementName: "Environmental Domain Degree (Bachelor's or Master's)",
    status: hasEnvEdu ? "evidenced" : hasAlliedEdu ? "partially_evidenced" : "not_evidenced",
    pointsAwarded: eduPoints,
    pointsMax: 5,
    evidenceSpan: hasEnvEdu
      ? "Degree in Environmental Science / Engineering / Sustainability."
      : hasAlliedEdu
      ? "Allied Engineering / Science degree."
      : "Non-environmental domain degree.",
  });

  const subScores: SubScoreBreakdown = {
    skills: skillsScore,
    experience: expPoints,
    projects: projectPoints,
    semantic: semanticScore,
    education: eduPoints,
  };

  const totalScore = Math.min(100, Math.round((skillsScore + expPoints + projectPoints + semanticScore + eduPoints) * 10) / 10);

  // Critical requirement flags
  const criticalMissing: string[] = [];
  if (gabiPoints === 0) {
    criticalMissing.push("Missing GaBi/SimaPro software expertise");
  } else if (gabiPoints === 5) {
    criticalMissing.push("GaBi/SimaPro software expertise not evidenced (OpenLCA requires verification)");
  }
  if (isoStatus === "not_evidenced") {
    criticalMissing.push("Missing ISO 14040 / ISO 14044 standards compliance");
  }
  if (completedProjects < 3) {
    criticalMissing.push(`Completed LCA projects (${completedProjects}) below required 3`);
  }

  // Review flags (Logistics & ISO Masking)
  const reviewFlags: string[] = [];
  if (isoStatus === "needs_confirmation") {
    reviewFlags.push("Anonymized ISO standard token ('ISO /' or 'ISO :2006') requires human unmasking and verification");
  }
  if (!extraction.contextualFlags.relocationMentioned) {
    reviewFlags.push("Willingness to relocate to Chennai requires confirmation");
  }
  if (!extraction.contextualFlags.travelWillingnessMentioned) {
    reviewFlags.push("Willingness to travel extensively across India requires confirmation");
  }
  if (!extraction.contextualFlags.commitmentMentioned) {
    reviewFlags.push("Minimum 1-year commitment requires confirmation");
  }

  return {
    roleId: "lca",
    roleTitle: "LifeCycle Assessment (LCA) Consultant",
    rubricVersion: SCORING_VERSION,
    totalScore,
    subScores,
    semanticRawCosine: rawCosineSimilarity,
    semanticNormalized: normCosine,
    requirementsEvidence: reqEvidence,
    eligibilityFlags: {
      experienceConflictNotice: expNotice,
      meetsRoleThreshold: totalScore >= LCA_THRESHOLD,
      criticalRequirementMissing: criticalMissing.length > 0 ? criticalMissing : undefined,
      reviewNeededFlags: reviewFlags,
    },
    explanation: `Total LCA score: ${totalScore}/100. Skills: ${skillsScore}/30, Experience: ${expPoints}/30, Projects: ${projectPoints}/20, Semantic: ${semanticScore}/15, Education: ${eduPoints}/5.`,
  };
}

export function scoreUIUXRole(
  extraction: CandidateExtraction,
  rawCosineSimilarity: number = 0
): CandidateRoleScore {
  if (extraction.extractionStatus === "empty_document") {
    return {
      roleId: "uiux",
      roleTitle: "UI/UX Designer Intern",
      rubricVersion: SCORING_VERSION,
      totalScore: 0,
      subScores: { skills: 0, experience: 0, projects: 0, semantic: 0, education: 0 },
      semanticRawCosine: 0,
      semanticNormalized: 0,
      requirementsEvidence: [],
      eligibilityFlags: {
        meetsRoleThreshold: false,
        criticalRequirementMissing: ["Document contains no text/content (0 XML text nodes)"],
        reviewNeededFlags: ["Empty document record: Unscorable due to insufficient evidence"],
      },
      explanation: "Document is empty (0 text nodes). Unscorable due to insufficient evidence.",
    };
  }

  const allText = [
    extraction.headline,
    extraction.summary,
    ...extraction.skills.allSkills,
    ...extraction.experience.map(e => `${e.title} ${e.company} ${e.bullets.join(" ")}`),
    ...extraction.projects.map(p => `${p.title} ${p.description} ${p.bullets.join(" ")}`),
  ].join(" ").toLowerCase();

  const reqEvidence: RequirementEvidence[] = [];

  // 1. SKILLS (Max 30 pts)
  // 1.1 Figma & Prototyping (15 pts) - Essential
  const hasFigma = allText.includes("figma");
  const hasPrototyping = allText.includes("prototyp") || allText.includes("wirefram") || allText.includes("mockup");
  let figmaPoints = 0;
  if (hasFigma && hasPrototyping) figmaPoints = 15;
  else if (hasFigma) figmaPoints = 12;
  else if (hasPrototyping) figmaPoints = 6;

  reqEvidence.push({
    requirementKey: "figma_prototyping",
    requirementName: "Figma & Interactive Prototyping Proficiency",
    status: figmaPoints >= 12 ? "evidenced" : figmaPoints > 0 ? "partially_evidenced" : "not_evidenced",
    pointsAwarded: figmaPoints,
    pointsMax: 15,
    evidenceSpan: hasFigma ? "Evidenced hands-on proficiency in Figma and wireframing/prototyping." : "Figma not explicitly evidenced.",
  });

  // 1.2 UI/UX Design Principles & Design Systems (10 pts)
  const hasHcd = allText.includes("human-centered") || allText.includes("user-centered") || allText.includes("design thinking");
  const hasDesignSystem = allText.includes("design system") || allText.includes("design systems") || allText.includes("style guide");
  const hasResponsive = allText.includes("responsive") || allText.includes("mobile") || allText.includes("web app") || allText.includes("ui design");
  let designPrinciplePoints = 0;
  if (hasHcd && hasDesignSystem) designPrinciplePoints = 10;
  else if (hasHcd || hasDesignSystem || hasResponsive) designPrinciplePoints = 7;

  reqEvidence.push({
    requirementKey: "design_principles",
    requirementName: "UI/UX Principles & Human-Centered Design Methodologies",
    status: designPrinciplePoints === 10 ? "evidenced" : designPrinciplePoints > 0 ? "partially_evidenced" : "not_evidenced",
    pointsAwarded: designPrinciplePoints,
    pointsMax: 10,
    evidenceSpan: designPrinciplePoints > 0 ? "Demonstrated human-centered design principles / design systems understanding." : "Not evidenced.",
  });

  // 1.3 User Research & Psychology (5 pts)
  const hasUserResearch = extraction.hasUserResearchEvidence || allText.includes("user research") || allText.includes("user interview") || allText.includes("usability testing") || allText.includes("user testing") || allText.includes("psychology") || allText.includes("persona");
  const userResearchPoints = hasUserResearch ? 5 : 0;
  reqEvidence.push({
    requirementKey: "user_research",
    requirementName: "User Research & Usability Testing Methods",
    status: hasUserResearch ? "evidenced" : "not_evidenced",
    pointsAwarded: userResearchPoints,
    pointsMax: 5,
    evidenceSpan: hasUserResearch ? "Evidenced user research, interview, or testing methodologies." : "No explicit user research methodology evidenced.",
  });

  const skillsScore = figmaPoints + designPrinciplePoints + userResearchPoints;

  // 2. RELEVANT EXPERIENCE (Max 10 pts)
  const designMonths = extraction.designExperienceMonths;
  let expPoints = 0;
  let expSpan = "";
  if (designMonths > 0 || extraction.experience.some(e => e.isDesignRole)) {
    expPoints = 10;
    expSpan = `Candidate has ${(designMonths / 12).toFixed(1)} years evidenced UI/UX or design experience (satisfies 0–1 yr requirement).`;
  } else if (extraction.hasDesignPortfolioOrCaseStudies) {
    expPoints = 8;
    expSpan = "Recent graduate or career transition with active design projects/portfolio.";
  } else {
    expPoints = 0;
    expSpan = "No demonstrated UI/UX design experience or portfolio transition.";
  }

  reqEvidence.push({
    requirementKey: "design_experience",
    requirementName: "Design Experience (0–1 year welcome / career transition)",
    status: expPoints === 10 ? "evidenced" : expPoints > 0 ? "partially_evidenced" : "not_evidenced",
    pointsAwarded: expPoints,
    pointsMax: 10,
    evidenceSpan: expSpan,
  });

  // 3. PROJECTS / PORTFOLIO (Max 30 pts)
  const hasPortfolioOrCaseStudies = extraction.hasDesignPortfolioOrCaseStudies || extraction.projects.some(p => p.isDesignProject);
  let portfolioPoints = 0;
  if (hasPortfolioOrCaseStudies && extraction.projects.filter(p => p.isDesignProject).length >= 2) {
    portfolioPoints = 20;
  } else if (hasPortfolioOrCaseStudies) {
    portfolioPoints = 14;
  } else {
    portfolioPoints = 0;
  }

  reqEvidence.push({
    requirementKey: "portfolio_projects",
    requirementName: "Design Projects, Case Studies & High-Fidelity Prototypes",
    status: portfolioPoints === 20 ? "evidenced" : portfolioPoints > 0 ? "partially_evidenced" : "not_evidenced",
    pointsAwarded: portfolioPoints,
    pointsMax: 20,
    evidenceSpan: portfolioPoints > 0
      ? `Identified ${extraction.projects.filter(p => p.isDesignProject).length} design project(s) or case study deliverables.`
      : "No design case studies or portfolio deliverables found.",
  });

  const hasResearchEvidence = extraction.hasUserResearchEvidence || allText.includes("user interview") || allText.includes("survey") || allText.includes("persona");
  const researchEvidencePoints = hasResearchEvidence ? 10 : 0;
  reqEvidence.push({
    requirementKey: "user_research_evidence",
    requirementName: "User Interview & Behavioral Insights Evidence",
    status: hasResearchEvidence ? "evidenced" : "not_evidenced",
    pointsAwarded: researchEvidencePoints,
    pointsMax: 10,
    evidenceSpan: hasResearchEvidence
      ? "Evidenced hands-on user research/interviews/personas in project deliverables."
      : "No hands-on user interview evidence found in projects.",
  });

  const projectsScore = portfolioPoints + researchEvidencePoints;

  // 4. SEMANTIC RELEVANCE (Max 20 pts)
  const normCosine = normalizeCosineSimilarity(rawCosineSimilarity);
  const semanticScore = Math.round(normCosine * 20 * 10) / 10;

  reqEvidence.push({
    requirementKey: "semantic_relevance",
    requirementName: "Semantic JD Alignment (BGE-small-en-v1.5)",
    status: normCosine >= 0.5 ? "evidenced" : "partially_evidenced",
    pointsAwarded: semanticScore,
    pointsMax: 20,
    evidenceSpan: `Cosine similarity: ${rawCosineSimilarity.toFixed(4)} (normalized score: ${(normCosine * 100).toFixed(1)}%).`,
  });

  // 5. EDUCATION & BACKGROUND (Max 10 pts)
  const hasDesignEdu = extraction.education.some(e => e.domain === "design");
  const hasAlliedEdu = extraction.education.some(e => e.domain === "allied_technical");
  let eduPoints = 0;
  if (hasDesignEdu) eduPoints = 10;
  else if (hasAlliedEdu) eduPoints = 7;
  else if (extraction.education.length > 0) eduPoints = 4;
  else eduPoints = 0;

  reqEvidence.push({
    requirementKey: "education_design",
    requirementName: "Design, HCI, Computer Science or Media Degree",
    status: hasDesignEdu ? "evidenced" : hasAlliedEdu ? "partially_evidenced" : "not_evidenced",
    pointsAwarded: eduPoints,
    pointsMax: 10,
    evidenceSpan: hasDesignEdu
      ? "Degree in Design / HCI / Multimedia."
      : hasAlliedEdu
      ? "Degree in Computer Science / Allied Technical field."
      : "General education background.",
  });

  const subScores: SubScoreBreakdown = {
    skills: skillsScore,
    experience: expPoints,
    projects: projectsScore,
    semantic: semanticScore,
    education: eduPoints,
  };

  const totalScore = Math.min(100, Math.round((skillsScore + expPoints + projectsScore + semanticScore + eduPoints) * 10) / 10);

  // Critical requirement flags
  const criticalMissing: string[] = [];
  if (figmaPoints === 0) criticalMissing.push("Missing Figma proficiency");
  if (projectsScore === 0) criticalMissing.push("Missing design case study or prototype evidence");

  // Subjective trait reviews
  const reviewFlags: string[] = [
    "Subjective traits (aesthetic sense, eye for detail, user psychology intuition) require human portfolio review",
  ];

  return {
    roleId: "uiux",
    roleTitle: "UI/UX Designer Intern",
    rubricVersion: SCORING_VERSION,
    totalScore,
    subScores,
    semanticRawCosine: rawCosineSimilarity,
    semanticNormalized: normCosine,
    requirementsEvidence: reqEvidence,
    eligibilityFlags: {
      meetsRoleThreshold: totalScore >= UIUX_THRESHOLD,
      criticalRequirementMissing: criticalMissing.length > 0 ? criticalMissing : undefined,
      reviewNeededFlags: reviewFlags,
    },
    explanation: `Total UI/UX score: ${totalScore}/100. Skills: ${skillsScore}/30, Experience: ${expPoints}/10, Projects: ${projectsScore}/30, Semantic: ${semanticScore}/20, Education: ${eduPoints}/10.`,
  };
}

export function classifyCandidate(
  lcaScore: CandidateRoleScore,
  uiuxScore: CandidateRoleScore,
  extractionStatus: string
): { classification: ClassificationType; reason: string } {
  if (extractionStatus === "empty_document") {
    return {
      classification: "neither_or_uncertain",
      reason: "Document contains 0 text nodes. Unscorable due to insufficient evidence.",
    };
  }

  const lcaPass = lcaScore.totalScore >= LCA_THRESHOLD;
  const uiuxPass = uiuxScore.totalScore >= UIUX_THRESHOLD;

  if (lcaPass && uiuxPass) {
    return {
      classification: "both",
      reason: `Qualified for both roles: LCA score ${lcaScore.totalScore}/100 and UI/UX score ${uiuxScore.totalScore}/100 both meet threshold (>=${LCA_THRESHOLD}).`,
    };
  } else if (lcaPass) {
    return {
      classification: "lca",
      reason: `Qualified for LCA Consultant (score ${lcaScore.totalScore}/100 >= ${LCA_THRESHOLD}); UI/UX score (${uiuxScore.totalScore}/100) below threshold.`,
    };
  } else if (uiuxPass) {
    return {
      classification: "uiux",
      reason: `Qualified for UI/UX Design Intern (score ${uiuxScore.totalScore}/100 >= ${UIUX_THRESHOLD}); LCA score (${lcaScore.totalScore}/100) below threshold.`,
    };
  } else {
    return {
      classification: "neither_or_uncertain",
      reason: `Neither role threshold met: LCA score ${lcaScore.totalScore}/100, UI/UX score ${uiuxScore.totalScore}/100 (both < 50).`,
    };
  }
}
