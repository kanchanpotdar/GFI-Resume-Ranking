"use client";

import React, { useState, useMemo } from "react";
import {
  CandidateRecord,
  RoleType,
  EligibilityStatus
} from "@/lib/types";
import { CandidateDetailModal } from "@/components/CandidateDetailModal";
import { ResumeUploadModal } from "@/components/ResumeUploadModal";
import {
  Search,
  SlidersHorizontal,
  Upload,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileText,
  UserCheck,
  Eye,
  Filter,
  Sparkles,
  Building,
  RotateCcw
} from "lucide-react";

interface DashboardClientProps {
  initialCandidates: CandidateRecord[];
}

type TabType = "lca" | "uiux" | "neither";

export function DashboardClient({ initialCandidates }: DashboardClientProps) {
  const [candidates, setCandidates] = useState<CandidateRecord[]>(initialCandidates);
  const [activeTab, setActiveTab] = useState<TabType>("lca");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "experience" | "skills" | "projects" | "semantic">("score");
  const [eligibilityFilter, setEligibilityFilter] = useState<string>("all");
  const [reviewFilter, setReviewFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const [inspectCandidate, setInspectCandidate] = useState<CandidateRecord | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Filter candidates by tab
  const tabCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (activeTab === "lca") return c.classification === "lca" || c.classification === "both";
      if (activeTab === "uiux") return c.classification === "uiux" || c.classification === "both";
      return c.classification === "neither_or_uncertain";
    });
  }, [candidates, activeTab]);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    let lca = 0, uiux = 0, neither = 0;
    for (const c of candidates) {
      if (c.classification === "lca" || c.classification === "both") lca++;
      if (c.classification === "uiux" || c.classification === "both") uiux++;
      if (c.classification === "neither_or_uncertain") neither++;
    }
    return { lca, uiux, neither };
  }, [candidates]);

  // Filter & Sort candidates within the active tab
  const processedCandidates = useMemo(() => {
    const roleKey = activeTab === "uiux" ? "uiux" : "lca";

    let filtered = tabCandidates.filter((c) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.extraction.name.toLowerCase().includes(q);
        const matchesId = c.candidateId.toLowerCase().includes(q);
        const matchesHeadline = c.extraction.headline.toLowerCase().includes(q);
        const matchesSkills = c.extraction.skills.allSkills.some((s) => s.toLowerCase().includes(q));
        const matchesEdu = c.extraction.education.some((e) =>
          e.degree.toLowerCase().includes(q) || e.institution.toLowerCase().includes(q)
        );
        if (!matchesName && !matchesId && !matchesHeadline && !matchesSkills && !matchesEdu) {
          return false;
        }
      }

      // 2. Eligibility Filter
      const scoreData = c.scores[roleKey];
      if (eligibilityFilter !== "all") {
        if (scoreData.eligibilityFlags.eligibilityStatus !== eligibilityFilter) {
          return false;
        }
      }

      // 3. Review Filter
      if (reviewFilter === "iso_review") {
        const hasIsoReview = scoreData.eligibilityFlags.reviewNeededFlags.some((f) =>
          f.toLowerCase().includes("iso")
        );
        if (!hasIsoReview) return false;
      } else if (reviewFilter === "relocation_review") {
        const hasRelo = scoreData.eligibilityFlags.reviewNeededFlags.some((f) =>
          f.toLowerCase().includes("relocate")
        );
        if (!hasRelo) return false;
      } else if (reviewFilter === "critical_missing") {
        if (!scoreData.eligibilityFlags.criticalRequirementMissing?.length) return false;
      }

      // 4. Source Filter
      if (sourceFilter !== "all" && c.sourceType !== sourceFilter) {
        return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      const aScore = a.scores[roleKey];
      const bScore = b.scores[roleKey];

      switch (sortBy) {
        case "experience":
          const aExp = activeTab === "uiux" ? a.extraction.designExperienceMonths : a.extraction.independentLcaExperienceMonths;
          const bExp = activeTab === "uiux" ? b.extraction.designExperienceMonths : b.extraction.independentLcaExperienceMonths;
          return bExp - aExp;
        case "skills":
          return bScore.subScores.skills - aScore.subScores.skills;
        case "projects":
          return bScore.subScores.projects - aScore.subScores.projects;
        case "semantic":
          return bScore.subScores.semantic - aScore.subScores.semantic;
        case "score":
        default:
          return bScore.totalScore - aScore.totalScore;
      }
    });

    return filtered;
  }, [tabCandidates, activeTab, searchQuery, eligibilityFilter, reviewFilter, sourceFilter, sortBy]);

  // Tab stats summary
  const stats = useMemo(() => {
    const roleKey = activeTab === "uiux" ? "uiux" : "lca";
    let eligible = 0, conditional = 0, reviewItems = 0;
    for (const c of tabCandidates) {
      const status = c.scores[roleKey].eligibilityFlags.eligibilityStatus;
      if (status === "eligible") eligible++;
      else if (status === "conditionally_eligible") conditional++;
      if (c.scores[roleKey].eligibilityFlags.reviewNeededFlags.length > 0) reviewItems++;
    }
    return {
      total: tabCandidates.length,
      eligible,
      conditional,
      reviewItems,
    };
  }, [tabCandidates, activeTab]);

  const handleCandidateUploaded = (newCandidate: CandidateRecord) => {
    setCandidates((prev) => [newCandidate, ...prev]);
    // Switch to the tab where the candidate belongs
    if (newCandidate.classification === "uiux") {
      setActiveTab("uiux");
    } else if (newCandidate.classification === "lca") {
      setActiveTab("lca");
    } else {
      setActiveTab("neither");
    }
    // Automatically inspect new candidate
    setInspectCandidate(newCandidate);
  };

  const getScoreBadge = (score: number) => {
    if (score >= 70) return "bg-emerald-100 text-emerald-800 border-emerald-300";
    if (score >= 50) return "bg-sky-100 text-sky-800 border-sky-300";
    if (score >= 40) return "bg-amber-100 text-amber-800 border-amber-300";
    return "bg-slate-100 text-slate-700 border-slate-300";
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Growth For Impact &middot; Decision-Support Engine
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                Resume Screening & Ranked Evaluation Dashboard
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload New Resume
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-5 border-b border-slate-200 -mb-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab("lca")}
              className={`py-3 px-4 font-semibold text-xs rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === "lca"
                  ? "border-emerald-600 text-emerald-800 bg-emerald-50/50"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
              }`}
            >
              <span>LCA Consultant</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === "lca" ? "bg-emerald-200 text-emerald-900" : "bg-slate-200 text-slate-700"
              }`}>
                {tabCounts.lca}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("uiux")}
              className={`py-3 px-4 font-semibold text-xs rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === "uiux"
                  ? "border-sky-600 text-sky-800 bg-sky-50/50"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
              }`}
            >
              <span>UI/UX Designer Intern</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === "uiux" ? "bg-sky-200 text-sky-900" : "bg-slate-200 text-slate-700"
              }`}>
                {tabCounts.uiux}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("neither")}
              className={`py-3 px-4 font-semibold text-xs rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === "neither"
                  ? "border-amber-600 text-amber-800 bg-amber-50/50"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
              }`}
            >
              <span>Neither / Uncertain Review</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === "neither" ? "bg-amber-200 text-amber-900" : "bg-slate-200 text-slate-700"
              }`}>
                {tabCounts.neither}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        
        {/* Role Overview Notice Card */}
        {activeTab === "lca" && (
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-emerald-950">
            <div>
              <span className="font-bold uppercase tracking-wider text-emerald-800 block mb-0.5">
                LifeCycle Assessment (LCA) Consultant &middot; Onsite (Chennai)
              </span>
              <p className="text-emerald-900">
                Rubric (100 Pts): Hands-on GaBi/SimaPro (15), ISO 14040/14044 (8), LCI Modeling (7), Experience (30), &ge;3 Projects (20), Semantic BGE-small (15), Education (5).
              </p>
            </div>
            <div className="text-emerald-800 font-medium shrink-0 bg-emerald-100/60 px-3 py-1.5 rounded-lg border border-emerald-300/50">
              ADR-S01: 2–3 yrs detailed requirement with recruiter conflict notice
            </div>
          </div>
        )}

        {activeTab === "uiux" && (
          <div className="bg-sky-50/60 border border-sky-200 rounded-xl p-4 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-sky-950">
            <div>
              <span className="font-bold uppercase tracking-wider text-sky-800 block mb-0.5">
                UI/UX Designer Intern &middot; Remote
              </span>
              <p className="text-sky-900">
                Rubric (100 Pts): Figma & Prototyping (15), Design Principles & Systems (10), User Research (5), Experience 0–1 yr (10), Projects & Case Studies (30), Semantic (20), Education (10).
              </p>
            </div>
            <div className="text-sky-800 font-medium shrink-0 bg-sky-100/60 px-3 py-1.5 rounded-lg border border-sky-300/50">
              Portfolio & subjective traits flagged for human aesthetic verification
            </div>
          </div>
        )}

        {activeTab === "neither" && (
          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 mb-6 text-xs text-amber-950">
            <span className="font-bold uppercase tracking-wider text-amber-800 block mb-0.5">
              Neither / Uncertain Review Pool
            </span>
            <p className="text-amber-900">
              Applicants whose scores fall below the 50-point threshold for both profiles, or possess ambiguous/empty records requiring recruiter disposition.
            </p>
          </div>
        )}

        {/* Stats Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">Candidates in Pool</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Unconditionally Eligible
            </span>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{stats.eligible}</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            <span className="text-xs text-amber-700 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Conditionally Eligible
            </span>
            <div className="text-2xl font-bold text-amber-700 mt-1">{stats.conditional}</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            <span className="text-xs text-slate-600 font-medium flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" /> Requiring Recruiter Action
            </span>
            <div className="text-2xl font-bold text-slate-700 mt-1">{stats.reviewItems}</div>
          </div>
        </div>

        {/* Search, Filter & Sort Toolbar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs mb-6 space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search candidates by name, ID, headline, skills, or university..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-slate-400"
              />
            </div>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5" /> Sort:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs bg-white text-slate-700 focus:outline-hidden"
              >
                <option value="score">Total Score (High to Low)</option>
                <option value="experience">Relevant Experience (Mos)</option>
                <option value="skills">Skills Subscore</option>
                <option value="projects">Projects Subscore</option>
                <option value="semantic">Semantic Relevance</option>
              </select>
            </div>
          </div>

          {/* Secondary Filters */}
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Filters:</span>
            </div>

            {/* Eligibility Filter */}
            <select
              value={eligibilityFilter}
              onChange={(e) => setEligibilityFilter(e.target.value)}
              className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white text-slate-700"
            >
              <option value="all">All Eligibility</option>
              <option value="eligible">Eligible Only</option>
              <option value="conditionally_eligible">Conditionally Eligible Only</option>
              <option value="ineligible">Ineligible Only</option>
            </select>

            {/* Review Flags Filter */}
            <select
              value={reviewFilter}
              onChange={(e) => setReviewFilter(e.target.value)}
              className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white text-slate-700"
            >
              <option value="all">All Review Flags</option>
              <option value="iso_review">Masked ISO Token Flags</option>
              <option value="relocation_review">Chennai Relocation Flags</option>
              <option value="critical_missing">Critical Missing Requirements</option>
            </select>

            {/* Source Filter */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white text-slate-700"
            >
              <option value="all">All Sources</option>
              <option value="baseline">Baseline Pool Only</option>
              <option value="local_upload">Uploaded Resumes Only</option>
            </select>

            {/* Reset Filters button */}
            {(searchQuery || eligibilityFilter !== "all" || reviewFilter !== "all" || sourceFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setEligibilityFilter("all");
                  setReviewFilter("all");
                  setSourceFilter("all");
                }}
                className="text-xs text-rose-600 hover:text-rose-800 font-medium inline-flex items-center gap-1 ml-auto"
              >
                <RotateCcw className="w-3 h-3" /> Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Candidate List Table / Cards */}
        <div className="space-y-3">
          {processedCandidates.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">No candidates match your current filter criteria.</p>
              <p className="text-xs text-slate-400 mt-1">Try resetting search filters or upload a new resume.</p>
            </div>
          ) : (
            processedCandidates.map((candidate, idx) => {
              const roleKey = activeTab === "uiux" ? "uiux" : "lca";
              const score = candidate.scores[roleKey];
              const isEligible = score.eligibilityFlags.eligibilityStatus === "eligible";
              const isConditional = score.eligibilityFlags.eligibilityStatus === "conditionally_eligible";

              return (
                <div
                  key={candidate.candidateId}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs hover:border-slate-300 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  {/* Left: Rank, Candidate Name & Info */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center shrink-0 border border-slate-200">
                      #{idx + 1}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base text-slate-900">
                          {candidate.extraction.name}
                        </h3>
                        <span className="font-mono text-xs text-slate-400">
                          ({candidate.candidateId})
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          candidate.sourceType === "baseline" ? "bg-slate-100 text-slate-600" : "bg-purple-100 text-purple-800"
                        }`}>
                          {candidate.sourceType === "baseline" ? "Baseline" : "Uploaded"}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600">
                        {candidate.extraction.headline || "Candidate Profile"}
                      </p>

                      {/* Matched Skills Chips */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {candidate.extraction.skills.platforms.slice(0, 4).map((p, pIdx) => (
                          <span key={pIdx} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                            {p}
                          </span>
                        ))}
                        {candidate.extraction.skills.methods.slice(0, 3).map((m, mIdx) => (
                          <span key={mIdx} className="bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[11px]">
                            {m}
                          </span>
                        ))}
                      </div>

                      {/* Review Flags Chips */}
                      {score.eligibilityFlags.reviewNeededFlags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {score.eligibilityFlags.reviewNeededFlags.map((flag, fIdx) => (
                            <span key={fIdx} className="bg-amber-50 text-amber-900 border border-amber-200/60 px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1">
                              <HelpCircle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="truncate max-w-xs">{flag}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Scores, Eligibility & Inspect CTA */}
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4 shrink-0 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                    
                    {/* Score Hero */}
                    <div className="text-left md:text-right">
                      <div className={`inline-block px-3 py-1 rounded-xl font-extrabold text-xl border ${getScoreBadge(score.totalScore)}`}>
                        {score.totalScore}
                        <span className="text-xs font-medium text-slate-500"> / 100</span>
                      </div>
                      <div className="flex items-center md:justify-end gap-1.5 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isEligible
                            ? "bg-emerald-100 text-emerald-800"
                            : isConditional
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-200 text-slate-700"
                        }`}>
                          {score.eligibilityFlags.eligibilityStatus.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => setInspectCandidate(candidate)}
                      className="w-full md:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5" /> Inspect
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </main>

      {/* Candidate Detail Inspector Modal */}
      {inspectCandidate && (
        <CandidateDetailModal
          candidate={inspectCandidate}
          initialRole={activeTab === "uiux" ? "uiux" : "lca"}
          onClose={() => setInspectCandidate(null)}
        />
      )}

      {/* Resume Upload Modal */}
      <ResumeUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onCandidateUploaded={handleCandidateUploaded}
        onViewCandidate={(c) => setInspectCandidate(c)}
      />

    </div>
  );
}
