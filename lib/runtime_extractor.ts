import { CandidateExtraction, EducationItem, ExperienceItem, ProjectItem } from "./types";

export const EVAL_REF_YEAR = 2026;
export const EVAL_REF_MONTH = 11;

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10,
  october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const KNOWN_PLATFORMS = new Set([
  "gabi", "simapro", "openlca", "umberto", "one click lca", "eime", "aspen plus", "aspen hysys",
  "pvsyst", "arcgis", "qgis", "google earth engine", "autocad", "solidworks", "ansys",
  "creo parametric", "catia", "bluestar", "inventor", "autodesk inventor", "siemens nx",
  "figma", "sketch", "adobe xd", "invision", "photoshop", "illustrator", "after effects",
  "spline", "canva", "framer", "miro", "jira", "confluence", "salesforce", "power bi",
  "tableau", "excel", "microsoft excel", "powerpoint", "word", "sap erp", "python",
  "react", "html", "css", "javascript", "typescript", "sql", "matlab", "simulink"
]);

const KNOWN_METHODS = new Set([
  "life cycle assessment", "lca", "environmental impact assessment", "eia",
  "social impact assessment", "sia", "cradle-to-gate", "cradle-to-grave",
  "cradle - to - gate", "cradle - to - grave", "gate-to-gate", "ghg accounting",
  "carbon footprint", "carbon footprinting", "scope 1", "scope 2", "scope 3",
  "iso 14040", "iso 14044", "iso 14040/44", "epd", "environmental product declaration",
  "product environmental profile", "pep", "material flow analysis", "mfa", "mfca",
  "water footprint", "user research", "user interviews", "usability testing",
  "wireframing", "prototyping", "interaction design", "information architecture",
  "design systems", "heuristic evaluation", "journey mapping", "persona creation",
  "human-centered design", "hcd", "design thinking", "responsive design", "a/b testing"
]);

const KNOWN_SOFT_SKILLS = new Set([
  "communication", "collaboration", "leadership", "teamwork", "critical thinking",
  "problem solving", "adaptability", "cross-functional collaboration", "presentation skills",
  "time management", "attention to detail", "quick learner", "self-motivated", "innovative",
  "proactive", "organized", "stakeholder management", "content writing"
]);

const DEGREE_REGEX = /\b(?:bachelor|master|doctor|ph\.?d|b\.?\s*tech|m\.?\s*tech|b\.?\s*des|m\.?\s*des|b\.?\s*e\b|m\.?\s*e\b|b\.?\s*sc|m\.?\s*sc|b\.?\s*a\b|m\.?\s*a\b|mba|bba|bca|m\.?\s*s\b|pgd|post graduate|diploma|class\s+(?:xii|x\b)|hsc|ssc|intermediate|higher secondary|secondary|pre-university|science stream|cbse)\b/i;
const INSTITUTION_KEYWORDS = ["university", "institute", "college", "academy", "school", "polytechnic", "campus", "vidyalaya"];

const LCA_METHODOLOGY_TERMS = [
  /\blca\b/i, /life cycle assessment/i, /life-cycle assessment/i,
  /cradle[\s-]+to[\s-]+gate/i, /cradle[\s-]+to[\s-]+grave/i,
  /openlca\b/i, /simapro\b/i, /gabi\b/i, /one click lca\b/i,
  /recipe\s*(?:2016|\d+)?/i, /ecoinvent\b/i, /\blci\b/i,
  /life cycle inventory/i, /\bepd\b/i, /product environmental profile/i
];

const STRICT_LCA_EXP_TERMS = [
  /\blca\b/i, /life cycle assessment/i, /life-cycle assessment/i,
  /simapro\b/i, /gabi\b/i, /openlca\b/i, /one click lca\b/i,
  /cradle[\s-]+to[\s-]+gate/i, /cradle[\s-]+to[\s-]+grave/i,
  /\blci modelling\b/i, /\blci modeling\b/i, /life cycle inventory modelling/i,
  /environmental product declaration (?:modelling|study|calculation|authoring|verification)/i
];

export function parseDateSpan(
  dateStr: string,
  evalRefYear: number = EVAL_REF_YEAR,
  evalRefMonth: number = EVAL_REF_MONTH
): { interval: [number, number] | null; durationMonths: number; isCurrent: boolean } {
  if (!dateStr || !dateStr.trim()) {
    return { interval: null, durationMonths: 0, isCurrent: false };
  }

  const maxRefIdx = evalRefYear * 12 + evalRefMonth;
  const sNorm = dateStr.toLowerCase().replace(/—/g, "-").replace(/–/g, "-").replace(/’/g, "20").replace(/'/g, "20").trim();
  const isCurrent = /present|current|ongoing/.test(sNorm);

  const mDur = sNorm.match(/(\d+)\s*months?/);
  if (mDur) {
    return { interval: null, durationMonths: parseInt(mDur[1], 10), isCurrent: false };
  }

  const mSlash = sNorm.match(/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{4})/);
  if (mSlash) {
    const sm = parseInt(mSlash[1], 10);
    const sy = parseInt(mSlash[2], 10);
    const em = parseInt(mSlash[3], 10);
    const ey = parseInt(mSlash[4], 10);
    const startIdx = sy * 12 + sm;
    const endIdx = Math.min(ey * 12 + em, maxRefIdx);
    if (startIdx > maxRefIdx) return { interval: null, durationMonths: 0, isCurrent: false };
    return { interval: [startIdx, endIdx], durationMonths: Math.max(1, endIdx - startIdx + 1), isCurrent: false };
  }

  const mSlashCurr = sNorm.match(/(\d{1,2})\/(\d{4})\s*-\s*(?:present|current|ongoing)/);
  if (mSlashCurr) {
    const sm = parseInt(mSlashCurr[1], 10);
    const sy = parseInt(mSlashCurr[2], 10);
    const startIdx = sy * 12 + sm;
    const endIdx = maxRefIdx;
    if (startIdx > maxRefIdx) return { interval: null, durationMonths: 0, isCurrent: true };
    return { interval: [startIdx, endIdx], durationMonths: Math.max(1, endIdx - startIdx + 1), isCurrent: true };
  }

  const mFull = sNorm.match(/([a-z]{3,9})\s+(\d{4})\s*-\s*(([a-z]{3,9})\s+(\d{4})|present|current|ongoing)/);
  if (mFull) {
    const sm = MONTH_MAP[mFull[1].toLowerCase()] || 1;
    const sy = parseInt(mFull[2], 10);
    const startIdx = sy * 12 + sm;
    let endIdx = maxRefIdx;
    if (!isCurrent) {
      const em = mFull[4] ? (MONTH_MAP[mFull[4].toLowerCase()] || 12) : 12;
      const ey = mFull[5] ? parseInt(mFull[5], 10) : sy;
      endIdx = Math.min(ey * 12 + em, maxRefIdx);
    }
    if (startIdx > maxRefIdx) return { interval: null, durationMonths: 0, isCurrent };
    return { interval: [startIdx, endIdx], durationMonths: Math.max(1, endIdx - startIdx + 1), isCurrent };
  }

  const mSingleYear = sNorm.match(/([a-z]{3,9})\s*-\s*([a-z]{3,9})\s+(\d{4})/);
  if (mSingleYear) {
    const sm = MONTH_MAP[mSingleYear[1].toLowerCase()] || 1;
    const em = MONTH_MAP[mSingleYear[2].toLowerCase()] || 12;
    const ey = parseInt(mSingleYear[3], 10);
    const startIdx = ey * 12 + sm;
    const endIdx = Math.min(ey * 12 + em, maxRefIdx);
    if (startIdx > maxRefIdx) return { interval: null, durationMonths: 0, isCurrent: false };
    return { interval: [startIdx, endIdx], durationMonths: Math.max(1, endIdx - startIdx + 1), isCurrent: false };
  }

  const mYear = sNorm.match(/(\d{4})\s*-\s*(\d{4}|present|current|ongoing)/);
  if (mYear) {
    const sy = parseInt(mYear[1], 10);
    let endIdx = maxRefIdx;
    if (!isCurrent) {
      const ey = parseInt(mYear[2], 10);
      endIdx = Math.min(ey * 12 + (ey === evalRefYear ? evalRefMonth : 12), maxRefIdx);
    }
    const startIdx = sy * 12 + 1;
    if (startIdx > maxRefIdx) return { interval: null, durationMonths: 0, isCurrent };
    return { interval: [startIdx, endIdx], durationMonths: Math.max(1, endIdx - startIdx + 1), isCurrent };
  }

  return { interval: null, durationMonths: 0, isCurrent };
}

export function mergeIntervals(intervals: Array<[number, number] | null | undefined>): number {
  const valid = intervals.filter((iv): iv is [number, number] => Array.isArray(iv) && iv.length === 2);
  if (valid.length === 0) return 0;
  valid.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [valid[0]];
  for (let i = 1; i < valid.length; i++) {
    const [start, end] = valid[i];
    const last = merged[merged.length - 1];
    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged.reduce((acc, [s, e]) => acc + (e - s + 1), 0);
}

function classifyEduDomain(degreeText: string): "environmental" | "design" | "allied_technical" | "general" {
  const low = degreeText.toLowerCase();
  if (["environmental", "sustainability", "ecology", "climate", "renewable", "energy"].some(w => low.includes(w))) {
    return "environmental";
  }
  if (["design", "hci", "interaction", "multimedia", "animation", "visual communication", "communication design", "fashion technology"].some(w => low.includes(w))) {
    return "design";
  }
  if ([
    "computer science", "information technology", "engineering", "civil", "chemical",
    "technology", "mechanical", "automotive", "biotechnology", "artificial intelligence",
    "data", "information science"
  ].some(w => low.includes(w))) {
    return "allied_technical";
  }
  return "general";
}

export function extractFromParagraphs(
  paras: string[],
  candidateId: string,
  filename: string,
  sha256: string
): CandidateExtraction {
  if (!paras || paras.length === 0 || paras.every(p => !p.trim())) {
    return {
      candidateId,
      sourceFilename: filename,
      sourceFilepath: filename,
      sha256,
      extractionStatus: "empty_document",
      name: "Unknown (Empty File)",
      headline: "Empty Document",
      summary: "",
      experience: [],
      projects: [],
      education: [],
      certifications: [],
      skills: { platforms: [], methods: [], domainKnowledge: [], softSkills: [], allSkills: [] },
      totalExperienceMonths: 0,
      independentLcaExperienceMonths: 0,
      designExperienceMonths: 0,
      completedLcaProjectsCount: 0,
      hasDesignPortfolioOrCaseStudies: false,
      hasUserResearchEvidence: false,
      contextualFlags: {
        relocationMentioned: false,
        travelWillingnessMentioned: false,
        commitmentMentioned: false,
        subjectiveTraitsRequireReview: false
      },
      rawTextLength: 0,
      warnings: ["File contains 0 text nodes. Flagged as unscorable due to insufficient evidence."],
      lcaChunk: "",
      uiuxChunk: ""
    };
  }

  const warnings: string[] = [];
  const name = paras[0].trim();
  const headline = paras.length > 1 && !/^(?:experience|education|projects|skills)\b/i.test(paras[1].trim())
    ? paras[1].trim()
    : "";

  // Segment into sections
  const sections: Record<string, string[]> = {
    "Professional Summary": [],
    "Experience": [],
    "Projects / Deliverables": [],
    "Education": [],
    "Core Skills": [],
    "Certifications": [],
    "Other": []
  };

  const SECTION_MAP: Array<{ key: string; regex: RegExp }> = [
    { key: "Professional Summary", regex: /^(?:professional\s+summary|summary|profile|about\s+me)\b/i },
    { key: "Experience", regex: /^(?:work\s+experience|professional\s+experience|experience|employment\s+history|internships?)\b/i },
    { key: "Projects / Deliverables", regex: /^(?:projects\s*\/?\s*deliverables|projects|key\s+projects|academic\s+projects)\b/i },
    { key: "Education", regex: /^(?:education|academic\s+background|qualifications)\b/i },
    { key: "Core Skills", regex: /^(?:core\s+skills|skills|technical\s+skills|tools\s+&?\s+technologies)\b/i },
    { key: "Certifications", regex: /^(?:certifications?|courses?|training)\b/i }
  ];

  let currentSection = "Other";
  for (let i = 1; i < paras.length; i++) {
    const line = paras[i].trim();
    if (!line) continue;

    const matched = SECTION_MAP.find(s => s.regex.test(line));
    if (matched && line.length < 50) {
      currentSection = matched.key;
      continue;
    }
    sections[currentSection].push(line);
  }

  // 1. Parse Experience
  const expRoles: ExperienceItem[] = [];
  let currentRole: ExperienceItem | null = null;

  for (const line of sections["Experience"]) {
    const isBullet = /^[•\-*–—]/.test(line);
    const dateMatch = line.match(/(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}|\d{1,2}\/\d{4}|\d{4})\s*[-–—]\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}|\d{1,2}\/\d{4}|\d{4}|present|current|ongoing)/i);

    if (dateMatch && !isBullet) {
      if (currentRole) expRoles.push(currentRole);
      const rawDates = dateMatch[0];
      const titleOrg = line.replace(rawDates, "").replace(/[-–—|]+$/, "").trim();
      const parts = titleOrg.split(/[-–—|@,]\s+/);
      const title = parts[0]?.trim() || "Role";
      const company = parts.length > 1 ? parts.slice(1).join(" - ").trim() : "Organization";
      const { interval, durationMonths, isCurrent } = parseDateSpan(rawDates);

      currentRole = {
        title,
        company,
        rawDates,
        interval,
        durationMonths,
        isCurrent,
        bullets: [],
        isIndependentLCA: false,
        isDesignRole: false,
        evidenceSpan: line
      };
    } else if (currentRole) {
      currentRole.bullets.push(line.replace(/^[•\-*–—]\s*/, ""));
    }
  }
  if (currentRole) expRoles.push(currentRole);

  const allIvs = expRoles.map(r => r.interval);
  let totalExperienceMonths = mergeIntervals(allIvs);
  if (totalExperienceMonths === 0 && expRoles.length > 0) {
    totalExperienceMonths = expRoles.reduce((acc, r) => acc + r.durationMonths, 0);
  }

  const lcaIvs: Array<[number, number] | null> = [];
  const designIvs: Array<[number, number] | null> = [];

  for (const r of expRoles) {
    const rText = `${r.title} ${r.company} ${r.bullets.join(" ")}`.toLowerCase();
    const isLcaTitle = ["lca consultant", "lca analyst", "life cycle assessment", "lca engineer", "lca specialist"].some(t => r.title.toLowerCase().includes(t));
    const hasLcaExecution = STRICT_LCA_EXP_TERMS.some(re => re.test(rText));
    const isLca = isLcaTitle || hasLcaExecution;

    const isDesign = [
      "ui/ux", "ux/ui", "product design", "visual design", "figma",
      "user research", "user experience", "interaction design", "wirefram", "prototyp"
    ].some(t => rText.includes(t));

    r.isIndependentLCA = isLca;
    r.isDesignRole = isDesign;
    if (isLca && r.interval) lcaIvs.push(r.interval);
    if (isDesign && r.interval) designIvs.push(r.interval);
  }

  let independentLcaExperienceMonths = mergeIntervals(lcaIvs);
  if (independentLcaExperienceMonths === 0 && expRoles.some(r => r.isIndependentLCA)) {
    independentLcaExperienceMonths = expRoles.filter(r => r.isIndependentLCA).reduce((acc, r) => acc + r.durationMonths, 0);
  }

  let designExperienceMonths = mergeIntervals(designIvs);
  if (designExperienceMonths === 0 && expRoles.some(r => r.isDesignRole)) {
    designExperienceMonths = expRoles.filter(r => r.isDesignRole).reduce((acc, r) => acc + r.durationMonths, 0);
  }

  // 2. Parse Projects
  const projectItems: ProjectItem[] = [];
  let currProj: ProjectItem | null = null;

  for (const line of sections["Projects / Deliverables"]) {
    const isBullet = /^[•\-*–—]/.test(line);
    if (isBullet) {
      const bText = line.replace(/^[•\-*–—]\s*/, "");
      if (currProj) {
        currProj.bullets.push(bText);
      } else {
        currProj = {
          title: "Project Deliverable",
          description: "",
          bullets: [bText],
          tools: [],
          isLCAProject: false,
          isDesignProject: false,
          evidenceSpan: line
        };
      }
      continue;
    }

    if (currProj === null) {
      currProj = {
        title: line,
        description: "",
        bullets: [],
        tools: [],
        isLCAProject: false,
        isDesignProject: false,
        evidenceSpan: line
      };
    } else if (currProj.description === "" && currProj.bullets.length === 0) {
      currProj.description = line;
      currProj.evidenceSpan += ` | ${line}`;
    } else {
      projectItems.push(currProj);
      currProj = {
        title: line,
        description: "",
        bullets: [],
        tools: [],
        isLCAProject: false,
        isDesignProject: false,
        evidenceSpan: line
      };
    }
  }
  if (currProj) projectItems.push(currProj);

  let completedLcaProjectsCount = 0;
  let hasDesignPortfolioOrCaseStudies = false;
  let hasUserResearchEvidence = false;

  for (const p of projectItems) {
    const pText = `${p.title} ${p.description} ${p.bullets.join(" ")}`.toLowerCase();
    const hasLcaMethod = LCA_METHODOLOGY_TERMS.some(re => re.test(pText));
    const isAssisting = /\b(?:assist(?:ed|ing)?|support(?:ed|ing)?|contribut(?:ed|ing)?)\b/i.test(pText) &&
      !["conducted", "performed", "engineered", "executed", "developed lca", "built life cycle"].some(v => pText.includes(v));
    const isOngoing = /\b(?:ongoing|in progress|expected)\b/i.test(pText);

    if (hasLcaMethod && !isAssisting && !isOngoing) {
      p.isLCAProject = true;
      completedLcaProjectsCount++;
    } else if (hasLcaMethod && (isAssisting || isOngoing)) {
      p.isLCAProject = false;
      warnings.push(`LCA project '${p.title.slice(0, 40)}' flagged as supported/ongoing; requires verification.`);
    }

    const designTerms = [
      "figma", "ui/ux", "ux/ui", "redesign", "mobile app", "prototype", "wireframe",
      "case study", "website", "design system", "hcd", "interaction design", "user flow",
      "visual hierarchy", "interface", "micro-interaction", "usability", "landing page",
      "dashboard", "dark theme", "shopping flow"
    ];
    const hasDesign = designTerms.some(term => pText.includes(term)) || /\b(?:ui|ux)\b/i.test(pText);
    if (hasDesign) {
      p.isDesignProject = true;
      hasDesignPortfolioOrCaseStudies = true;
    }
    if (["user interview", "user research", "usability testing", "personas", "survey"].some(t => pText.includes(t))) {
      hasUserResearchEvidence = true;
    }
  }

  // 3. Parse Education
  const eduItems: EducationItem[] = [];
  let currEdu: EducationItem | null = null;

  for (const line of sections["Education"]) {
    const lc = line.trim();
    const low = lc.toLowerCase();
    const mScore = low.match(/(?:cgpa|gpa|cgpi|ogpa|percentage|score|marks?)\s*[:–-]?\s*([0-9.]+(?:\s*(?:\/|out of)\s*[0-9.]+)?%?)/);
    const isScoreOnly = Boolean((mScore || /^[0-9.]+\s*%$/.test(lc)) && lc.length < 35 && !INSTITUTION_KEYWORDS.some(k => low.includes(k)));
    const isYearOnly = /^(?:19|20)\d{2}(?:\s*[-–]\s*(?:19|20)\d{2})?$/.test(lc);
    const hasInstKeyword = INSTITUTION_KEYWORDS.some(k => low.includes(k));
    const isDegreeStart = DEGREE_REGEX.test(low) && !hasInstKeyword;

    if (isScoreOnly && currEdu) {
      currEdu.score = lc;
      currEdu.evidenceSpan += ` | ${lc}`;
      continue;
    }
    if (isYearOnly && currEdu) {
      currEdu.year = lc;
      currEdu.evidenceSpan += ` | ${lc}`;
      continue;
    }
    if (isDegreeStart) {
      if (currEdu) eduItems.push(currEdu);
      const ym = lc.match(/\b(20\d{2}|19\d{2})\b/);
      currEdu = {
        degree: lc,
        institution: "Unknown Institution",
        year: ym ? ym[0] : null,
        score: null,
        domain: classifyEduDomain(lc),
        evidenceSpan: lc
      };
    } else if (currEdu && currEdu.institution === "Unknown Institution") {
      currEdu.evidenceSpan += ` | ${lc}`;
      if (!currEdu.year) {
        const ym = lc.match(/\b(20\d{2}|19\d{2})\b/);
        if (ym) currEdu.year = ym[0];
      }
      const instClean = lc.replace(/[,–—-]?\s*(?:[A-Za-z]{3,9}\s+)?(?:19|20)\d{2}.*/, "").trim().replace(/^[,–—-\s]+|[,–—-\s]+$/g, "");
      currEdu.institution = instClean || lc;
    } else if (currEdu) {
      currEdu.evidenceSpan += ` | ${lc}`;
    }
  }
  if (currEdu) eduItems.push(currEdu);

  // 4. Parse Skills
  const platforms: string[] = [];
  const methods: string[] = [];
  const domainKnowledge: string[] = [];
  const softSkills: string[] = [];
  const allSkills: string[] = [];

  for (const line of sections["Core Skills"]) {
    if (line.includes(":")) {
      const [cat, rest] = line.split(":", 2);
      const tokens = rest.split(",").map(t => t.trim()).filter(Boolean);
      allSkills.push(...tokens);
      const lowCat = cat.toLowerCase();
      if (lowCat.includes("platform") || lowCat.includes("tool")) platforms.push(...tokens);
      else if (lowCat.includes("method") || lowCat.includes("framework")) methods.push(...tokens);
      else if (lowCat.includes("soft") || lowCat.includes("interpersonal")) softSkills.push(...tokens);
      else domainKnowledge.push(...tokens);
    } else {
      const tokens = line.split(",").map(t => t.trim()).filter(Boolean);
      for (const t of tokens) {
        allSkills.push(t);
        const tLow = t.toLowerCase();
        if (KNOWN_PLATFORMS.has(tLow)) platforms.push(t);
        else if (KNOWN_METHODS.has(tLow)) methods.push(t);
        else if (KNOWN_SOFT_SKILLS.has(tLow)) softSkills.push(t);
        else domainKnowledge.push(t);
      }
    }
  }

  // Deduplicate skills
  const uniqPlatforms = Array.from(new Set(platforms));
  const uniqMethods = Array.from(new Set(methods));
  const uniqDomain = Array.from(new Set(domainKnowledge));
  const uniqSoft = Array.from(new Set(softSkills));
  const uniqAll = Array.from(new Set(allSkills));

  // 5. Contextual flags
  const rawText = paras.join("\n");
  const fullLower = rawText.toLowerCase();

  const relocation = fullLower.includes("chennai") || fullLower.includes("relocat");
  const travel = fullLower.includes("travel");
  const commitment = fullLower.includes("1 year") || fullLower.includes("01 year") || fullLower.includes("commitment");
  const subjectiveReview = ["aesthetic", "psychology", "creative", "curiosity"].some(term => fullLower.includes(term));
  hasUserResearchEvidence = hasUserResearchEvidence || ["user research", "user interview", "usability testing", "user testing", "persona"].some(w => fullLower.includes(w));

  // Construct role semantic chunks
  const summaryText = sections["Professional Summary"].join(" ");
  const lcaParts: string[] = [headline, summaryText];
  for (const e of expRoles) {
    if (e.isIndependentLCA || ["lca", "sustainability", "environment", "impact"].some(t => e.title.toLowerCase().includes(t))) {
      lcaParts.push(`${e.title} at ${e.company}: ${e.bullets.join(" ")}`);
    }
  }
  for (const p of projectItems) {
    if (p.isLCAProject) {
      lcaParts.push(`Project: ${p.title} - ${p.bullets.join(" ")}`);
    }
  }
  lcaParts.push(`Skills: ${uniqAll.join(", ")}`);
  let lcaChunk = lcaParts.filter(Boolean).join(" ").trim();
  if (lcaChunk.length < 50) lcaChunk = rawText.slice(0, 1200);

  const uiuxParts: string[] = [headline, summaryText];
  for (const e of expRoles) {
    if (e.isDesignRole || ["ui", "ux", "design", "frontend", "product"].some(t => e.title.toLowerCase().includes(t))) {
      uiuxParts.push(`${e.title} at ${e.company}: ${e.bullets.join(" ")}`);
    }
  }
  for (const p of projectItems) {
    if (p.isDesignProject) {
      uiuxParts.push(`Project: ${p.title} - ${p.bullets.join(" ")}`);
    }
  }
  uiuxParts.push(`Skills: ${uniqAll.join(", ")}`);
  let uiuxChunk = uiuxParts.filter(Boolean).join(" ").trim();
  if (uiuxChunk.length < 50) uiuxChunk = rawText.slice(0, 1200);

  return {
    candidateId,
    sourceFilename: filename,
    sourceFilepath: filename,
    sha256,
    extractionStatus: "ready_for_extraction",
    name: name || "Candidate",
    headline,
    summary: summaryText,
    experience: expRoles,
    projects: projectItems,
    education: eduItems,
    certifications: sections["Certifications"],
    skills: {
      platforms: uniqPlatforms,
      methods: uniqMethods,
      domainKnowledge: uniqDomain,
      softSkills: uniqSoft,
      allSkills: uniqAll
    },
    totalExperienceMonths,
    independentLcaExperienceMonths,
    designExperienceMonths,
    completedLcaProjectsCount,
    hasDesignPortfolioOrCaseStudies,
    hasUserResearchEvidence,
    contextualFlags: {
      relocationMentioned: relocation,
      travelWillingnessMentioned: travel,
      commitmentMentioned: commitment,
      subjectiveTraitsRequireReview: subjectiveReview
    },
    rawTextLength: rawText.length,
    warnings,
    lcaChunk,
    uiuxChunk
  };
}
