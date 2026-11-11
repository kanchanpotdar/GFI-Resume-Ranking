"use client";

import React, { useState, useEffect } from "react";
import { CandidateRecord, RoleType } from "@/lib/types";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Briefcase,
  FolderGit2,
  GraduationCap,
  Sparkles,
  MapPin,
  Clock,
  Plane,
  FileText,
  Copy,
  Check
} from "lucide-react";

interface CandidateDetailModalProps {
  candidate: CandidateRecord | null;
  initialRole?: RoleType;
  onClose: () => void;
}

export function CandidateDetailModal({
  candidate,
  initialRole = "lca",
  onClose
}: CandidateDetailModalProps) {
  const [activeRole, setActiveRole] = useState<RoleType>(initialRole);
  const [copiedSha, setCopiedSha] = useState(false);

  useEffect(() => {
    setActiveRole(initialRole);
  }, [initialRole, candidate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!candidate) return null;

  const scoreData = candidate.scores[activeRole];
  const { totalScore, subScores, eligibilityFlags, requirementsEvidence } = scoreData;

  const copySha = () => {
    navigator.clipboard.writeText(candidate.sha256);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "evidenced":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" /> Evidenced
          </span>
        );
      case "partially_evidenced":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
            <Sparkles className="w-3.5 h-3.5" /> Partially Evidenced
          </span>
        );
      case "needs_confirmation":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <HelpCircle className="w-3.5 h-3.5" /> Needs Confirmation
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
            <XCircle className="w-3.5 h-3.5" /> Not Evidenced
          </span>
        );
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-emerald-700 bg-emerald-50 border-emerald-300";
    if (score >= 50) return "text-sky-700 bg-sky-50 border-sky-300";
    if (score >= 40) return "text-amber-700 bg-amber-50 border-amber-300";
    return "text-slate-700 bg-slate-100 border-slate-300";
  };

  const maxBudget = activeRole === "lca"
    ? { skills: 30, experience: 30, projects: 20, semantic: 15, education: 5 }
    : { skills: 30, experience: 10, projects: 30, semantic: 20, education: 10 };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h2 className="text-2xl font-bold text-slate-900">{candidate.extraction.name}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${
                candidate.sourceType === "baseline" ? "bg-slate-200 text-slate-700" : "bg-purple-100 text-purple-800"
              }`}>
                {candidate.sourceType === "baseline" ? "Baseline Pool" : "Uploaded Resume"}
              </span>
            </div>
            <p className="text-sm text-slate-600">
              {candidate.extraction.headline || "Candidate Profile"} &middot; <span className="font-mono text-xs text-slate-500">{candidate.candidateId}</span>
            </p>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
              <span className="truncate max-w-xs font-mono">SHA256: {candidate.sha256.slice(0, 16)}...</span>
              <button
                onClick={copySha}
                className="hover:text-slate-600 transition-colors p-0.5 rounded"
                title="Copy full SHA256"
              >
                {copiedSha ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Selector Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            onClick={() => setActiveRole("lca")}
            className={`py-3.5 px-4 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeRole === "lca"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>LCA Consultant Assessment</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              candidate.scores.lca.totalScore >= 50 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
            }`}>
              {candidate.scores.lca.totalScore}/100
            </span>
          </button>

          <button
            onClick={() => setActiveRole("uiux")}
            className={`py-3.5 px-4 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeRole === "uiux"
                ? "border-sky-600 text-sky-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>UI/UX Designer Intern Assessment</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              candidate.scores.uiux.totalScore >= 50 ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600"
            }`}>
              {candidate.scores.uiux.totalScore}/100
            </span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Hero Score Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className={`text-3xl font-extrabold px-3 py-1 rounded-xl border ${getScoreColor(totalScore)}`}>
                  {totalScore}
                  <span className="text-base font-medium text-slate-500"> / 100</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      eligibilityFlags.eligibilityStatus === "eligible"
                        ? "bg-emerald-100 text-emerald-800"
                        : eligibilityFlags.eligibilityStatus === "conditionally_eligible"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-200 text-slate-700"
                    }`}>
                      {eligibilityFlags.eligibilityStatus === "eligible"
                        ? "Eligible for Role"
                        : eligibilityFlags.eligibilityStatus === "conditionally_eligible"
                        ? "Conditionally Eligible (Review Required)"
                        : "Ineligible"}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Threshold: 50.0 pts
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {candidate.classificationReason}
                  </p>
                </div>
              </div>
            </div>

            {/* Overall Classification */}
            <div className="text-right text-xs">
              <span className="text-slate-500">System Classification:</span>
              <div className="font-bold uppercase tracking-wider text-slate-800 text-sm mt-0.5">
                {candidate.classification.replace("_", " ")}
              </div>
            </div>
          </div>

          {/* ADR-S01 Conflict Notice (if present) */}
          {eligibilityFlags.experienceConflictNotice && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg text-xs text-amber-900">
              <div className="flex items-center gap-2 font-semibold mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                ADR-S01 Experience Specification Conflict
              </div>
              <p>{eligibilityFlags.experienceConflictNotice}</p>
            </div>
          )}

          {/* Critical Missing Requirements Alert */}
          {eligibilityFlags.criticalRequirementMissing && eligibilityFlags.criticalRequirementMissing.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-900">
              <div className="font-semibold flex items-center gap-1.5 mb-1.5 text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Missing Mandatory Qualifications for this Profile:
              </div>
              <ul className="list-disc list-inside space-y-1">
                {eligibilityFlags.criticalRequirementMissing.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Subscores Breakdown Grid */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
              Sub-Score Component Breakdown
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-xs text-slate-500 block mb-1">Skills</span>
                <span className="text-lg font-bold text-slate-800">{subScores.skills}</span>
                <span className="text-xs text-slate-400"> / {maxBudget.skills}</span>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-emerald-600 h-1.5 rounded-full"
                    style={{ width: `${(subScores.skills / maxBudget.skills) * 100}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-xs text-slate-500 block mb-1">Experience</span>
                <span className="text-lg font-bold text-slate-800">{subScores.experience}</span>
                <span className="text-xs text-slate-400"> / {maxBudget.experience}</span>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-sky-600 h-1.5 rounded-full"
                    style={{ width: `${(subScores.experience / maxBudget.experience) * 100}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-xs text-slate-500 block mb-1">Projects</span>
                <span className="text-lg font-bold text-slate-800">{subScores.projects}</span>
                <span className="text-xs text-slate-400"> / {maxBudget.projects}</span>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full"
                    style={{ width: `${(subScores.projects / maxBudget.projects) * 100}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-xs text-slate-500 block mb-1">Semantic</span>
                <span className="text-lg font-bold text-slate-800">{subScores.semantic}</span>
                <span className="text-xs text-slate-400"> / {maxBudget.semantic}</span>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-purple-600 h-1.5 rounded-full"
                    style={{ width: `${(subScores.semantic / maxBudget.semantic) * 100}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-xs text-slate-500 block mb-1">Education</span>
                <span className="text-lg font-bold text-slate-800">{subScores.education}</span>
                <span className="text-xs text-slate-400"> / {maxBudget.education}</span>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-amber-600 h-1.5 rounded-full"
                    style={{ width: `${(subScores.education / maxBudget.education) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Granular Requirements Evidence Checklist */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
              Granular Requirements Evidence Checklist
            </h3>
            <div className="space-y-2.5">
              {requirementsEvidence.map((req, idx) => (
                <div
                  key={idx}
                  className="border border-slate-200 rounded-lg p-3.5 bg-white hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-semibold text-xs text-slate-800">
                      {req.requirementName}
                    </span>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(req.status)}
                      <span className="text-xs font-bold text-slate-700">
                        {req.pointsAwarded} / {req.pointsMax} pts
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-100">
                    "{req.evidenceSpan}"
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Contextual & Review Needed Flags */}
          {eligibilityFlags.reviewNeededFlags && eligibilityFlags.reviewNeededFlags.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5 text-amber-800">
                <HelpCircle className="w-4 h-4 text-amber-600" /> Recruiter Action Items & Review Flags
              </h3>
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-2">
                {eligibilityFlags.reviewNeededFlags.map((flag, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-amber-900">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <span>{flag}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Work Experience History */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-slate-600" /> Work Experience (Total: {candidate.extraction.totalExperienceMonths} mos &middot; Independent LCA: {candidate.extraction.independentLcaExperienceMonths} mos &middot; Design: {candidate.extraction.designExperienceMonths} mos)
            </h3>
            {candidate.extraction.experience.length === 0 ? (
              <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
                No formal employment roles evidenced in resume.
              </p>
            ) : (
              <div className="space-y-3">
                {candidate.extraction.experience.map((exp, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-lg p-3.5 bg-white">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <h4 className="font-semibold text-xs text-slate-900">{exp.title}</h4>
                        <span className="text-xs text-slate-600">{exp.company}</span>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                          <Clock className="w-3 h-3" /> {exp.rawDates || "Dates not specified"}
                        </span>
                        <div className="text-xs text-slate-400">
                          {exp.durationMonths > 0 ? `${exp.durationMonths} months` : "0 months (unverified)"}
                        </div>
                      </div>
                    </div>
                    {exp.bullets.length > 0 && (
                      <ul className="list-disc list-inside space-y-0.5 text-xs text-slate-600 mt-2">
                        {exp.bullets.map((b, bIdx) => (
                          <li key={bIdx}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Grouped Project Deliverables */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FolderGit2 className="w-4 h-4 text-slate-600" /> Project Deliverables ({candidate.extraction.projects.length} distinct grouped studies)
            </h3>
            {candidate.extraction.projects.length === 0 ? (
              <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
                No distinct project deliverables evidenced in resume.
              </p>
            ) : (
              <div className="space-y-3">
                {candidate.extraction.projects.map((proj, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-lg p-3.5 bg-white">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-xs text-slate-900">{proj.title}</h4>
                      <div className="flex gap-1.5">
                        {proj.isLCAProject && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                            LCA Study
                          </span>
                        )}
                        {proj.isDesignProject && (
                          <span className="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded">
                            Design Project
                          </span>
                        )}
                      </div>
                    </div>
                    {proj.description && (
                      <p className="text-xs text-slate-600 mb-1.5">{proj.description}</p>
                    )}
                    {proj.bullets.length > 0 && (
                      <ul className="list-disc list-inside space-y-0.5 text-xs text-slate-600">
                        {proj.bullets.map((b, bIdx) => (
                          <li key={bIdx}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Education & Qualifications */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-slate-600" /> Education & Academic Credentials
            </h3>
            {candidate.extraction.education.length === 0 ? (
              <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
                No formal degrees or academic background evidenced.
              </p>
            ) : (
              <div className="space-y-2">
                {candidate.extraction.education.map((edu, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-lg p-3 bg-white flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-xs text-slate-900">{edu.degree}</h4>
                      <span className="text-xs text-slate-600">{edu.institution}</span>
                      {edu.score && <span className="text-xs text-slate-400 ml-2">({edu.score})</span>}
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 font-medium">{edu.year || "Year unknown"}</span>
                      <span className="block text-[10px] uppercase font-bold text-slate-400 mt-0.5">
                        Domain: {edu.domain}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Categorized Skills */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
              Categorized Skills & Tools
            </h3>
            <div className="space-y-2">
              <div className="text-xs">
                <span className="font-semibold text-slate-700">Platforms / Tools: </span>
                {candidate.extraction.skills.platforms.length > 0 ? (
                  <div className="inline-flex flex-wrap gap-1 mt-1">
                    {candidate.extraction.skills.platforms.map((p, i) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
                        {p}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 italic">None explicit</span>
                )}
              </div>

              <div className="text-xs">
                <span className="font-semibold text-slate-700">Methods / Frameworks: </span>
                {candidate.extraction.skills.methods.length > 0 ? (
                  <div className="inline-flex flex-wrap gap-1 mt-1">
                    {candidate.extraction.skills.methods.map((m, i) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
                        {m}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 italic">None explicit</span>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Source document: <span className="font-medium text-slate-700">{candidate.sourceFilename}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-lg transition-colors"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
}
