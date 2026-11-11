export default function Home() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <header className="border-b border-slate-200 pb-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Sprint 0 Initialized & Verified
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Growth For Impact — Candidate Screening & Ranking Prototype
            </h1>
            <p className="text-slate-600 mt-1 text-sm">
              Decision-support prototype evaluating 47 applicant resumes against two operational job profiles.
            </p>
          </div>
        </div>
      </header>

      {/* Grid of Roles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* LCA Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded">
                Role 1
              </span>
              <h2 className="text-xl font-semibold text-slate-900 mt-1">
                LifeCycle Assessment (LCA) Consultant
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded">
              Chennai (Onsite)
            </span>
          </div>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 my-3 text-xs text-amber-900">
            <strong>ADR-S01 Reconciliation:</strong> Overview cites 4–6 yrs; detailed JD specifies 2–3 yrs independent LCA execution. Operationally scored using detailed JD with recruiter conflict flags.
          </div>

          <p className="text-xs text-slate-600 mb-4">
            Key criteria: Hands-on GaBi/SimaPro, ISO 14040/14044 compliance, LCI compilation & modeling, &ge;3 completed LCA studies.
          </p>

          <div className="border-t border-slate-100 pt-3 text-xs text-slate-500 flex justify-between">
            <span>Points: Skills 30 · Exp 30 · Proj 20 · Sem 15 · Edu 5</span>
            <span className="font-semibold text-slate-700">100 Pts</span>
          </div>
        </div>

        {/* UI/UX Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded">
                Role 2
              </span>
              <h2 className="text-xl font-semibold text-slate-900 mt-1">
                UI/UX Designer Intern
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded">
              Remote (₹10k–15k/mo)
            </span>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 my-3 text-xs text-blue-900">
            <strong>Experience Policy:</strong> Welcomes 0–1 year, recent graduates, or career transitions. Focus on design execution and user research.
          </div>

          <p className="text-xs text-slate-600 mb-4">
            Key criteria: Figma interactive prototyping, human-centered design, user psychology research, website & job-board interface design.
          </p>

          <div className="border-t border-slate-100 pt-3 text-xs text-slate-500 flex justify-between">
            <span>Points: Skills 30 · Exp 10 · Proj 30 · Sem 20 · Edu 10</span>
            <span className="font-semibold text-slate-700">100 Pts</span>
          </div>
        </div>
      </div>

      {/* Dataset Audit Status */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 mb-8 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900 mb-2">
          Dataset Inventory & Integrity Audit (Sprint 0 Exit Gate)
        </h3>
        <p className="text-xs text-slate-600 mb-4">
          All 47 DOCX candidate files provided in the archive have been indexed with SHA-256 signatures and structural XML parsing.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-slate-900">47</div>
            <div className="text-xs text-slate-500">Total DOCX Resumes</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700">46</div>
            <div className="text-xs text-emerald-700">Ready for Extraction</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-700">1</div>
            <div className="text-xs text-amber-700">Anomalous (0 Text)</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">0</div>
            <div className="text-xs text-blue-700">Corrupted Files</div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 border border-slate-200">
          <span className="font-semibold text-slate-800">Triage of Anomalous File:</span>{' '}
          <code className="text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">anonymized_resume_1793685080327.docx</code> is confirmed empty at the OOXML specification level (empty paragraph container, 0 text nodes, 0 drawing elements). Rather than silent omission or synthetic fabrication, it is formally logged in the manifest and flagged in the pipeline.
        </div>
      </section>

      {/* Methodology & Ethics Footer Note */}
      <footer className="text-xs text-slate-500 border-t border-slate-200 pt-4 flex flex-col sm:flex-row justify-between gap-2">
        <span>Methodology: Transparent rubric scoring + BGE semantic embedding + human-in-the-loop review.</span>
        <span>Version 1.0.0 · Sprint 0 Verified</span>
      </footer>
    </main>
  );
}
