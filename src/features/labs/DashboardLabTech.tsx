import React, { useState, useEffect, useMemo } from "react";
import { Database } from "../../api";
import {
  User,
  LabRequest,
  LabReport,
  LabRequestStatus,
  Profile,
  LabTechnicianExt,
  Hospital,
} from "../../types";
import {
  Activity,
  FileText,
  LogOut,
  Search,
  CheckCircle2,
  Clock,
  Building2,
  FlaskConical,
  ChevronRight,
  User2,
} from "lucide-react";

interface LabTechProps {
  user: User;
  onLogout: () => void;
}

export default function DashboardLabTech({ user, onLogout }: LabTechProps) {
  // Tabs
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");

  // DB state
  const [labRequests, setLabRequests] = useState<LabRequest[]>([]);
  const [labReports, setLabReports] = useState<LabReport[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [labTech, setLabTech] = useState<LabTechnicianExt | null>(null);
  const [hospital, setHospital] = useState<Hospital | null>(null);

  // Active testing form
  const [activeRequest, setActiveRequest] = useState<LabRequest | null>(null);
  const [resultsText, setResultsText] = useState("");
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Search/filter
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadDatabase();
  }, [user]);

  const loadDatabase = async () => {
    const [reqs, reps, profiles, labTechs, hospitals] = await Promise.all([
      Database.getLabRequests(),
      Database.getLabReports(),
      Database.getProfiles(),
      Database.getLabTechs(),
      Database.getHospitals(),
    ]);

    // Profile
    const myProfile = profiles.find((p) => p.id === user.id) ?? null;
    setProfile(myProfile);

    // Lab tech record
    const myLabTech = labTechs.find((lt) => lt.id === user.id) ?? null;
    setLabTech(myLabTech);

    // Hospital
    const myHospital = myLabTech
      ? hospitals.find((h) => h.id === myLabTech.hospital_id) ?? null
      : null;
    setHospital(myHospital);

    // Filter lab requests by hospital_id
    const filteredReqs = myLabTech
      ? reqs.filter((r) => r.hospital_id === myLabTech.hospital_id)
      : reqs;

    setLabRequests(filteredReqs);
    setLabReports(reps);
  };

  // Publish results
  const handlePublishResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRequest) return;

    if (!resultsText.trim()) {
      alert("Please record actual numerical or qualitative pathology test parameters.");
      return;
    }

    const repId = crypto.randomUUID();
    const newReport: LabReport = {
      id: repId,
      request_id: activeRequest.id,
      test_name: activeRequest.test_name,
      doctor_name: activeRequest.doctor_name,
      patient_name: activeRequest.patient_name,
      patient_id: activeRequest.patient_id,
      results_text: resultsText,
      uploaded_by: user.id,
      created_at: new Date().toISOString(),
    };

    const currentReports = await Database.getLabReports();
    currentReports.unshift(newReport);
    await Database.saveLabReports(currentReports);

    const currentRequests = await Database.getLabRequests();
    const updated = currentRequests.map((r) =>
      r.id === activeRequest.id ? { ...r, status: LabRequestStatus.COMPLETED } : r
    );
    await Database.saveLabRequests(updated);

    await Database.addNotification(
      activeRequest.patient_id,
      "Diagnostic Lab Report Published",
      `Your results for ${activeRequest.test_name} have been finalized and are available in your portal.`,
      "LAB_REPORT"
    );
    await Database.addNotification(
      activeRequest.doctor_id,
      "Pathology Lab Report Finalized",
      `Pathology results for patient ${activeRequest.patient_name} (${activeRequest.test_name}) have been uploaded.`,
      "LAB_REPORT"
    );

    // Audit Log: staff activity
    await Database.logStaffActivity(
      user.id,
      profile?.full_name || "Lab Technician",
      "LAB_REPORT_UPLOADED",
      `Published lab report for test: ${activeRequest.test_name} for patient: ${activeRequest.patient_name}`,
      hospital?.id
    );

    setPublishSuccess(true);
    setResultsText("");
    setActiveRequest(null);
    loadDatabase();

    setTimeout(() => {
      setPublishSuccess(false);
      setActiveTab("pending");
    }, 1200);
  };

  const handleStartTest = async (reqId: string) => {
    try {
      const currentRequests = await Database.getLabRequests();
      const updated = currentRequests.map((r) =>
        r.id === reqId ? { ...r, status: LabRequestStatus.IN_PROGRESS } : r
      );
      await Database.saveLabRequests(updated);
      loadDatabase();
    } catch (err: unknown) {
      alert("Error starting test: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Derived lists
  const pendingRequests = labRequests.filter(
    (r) => r.status === LabRequestStatus.PENDING || r.status === LabRequestStatus.IN_PROGRESS
  );
  const inProgressCount = labRequests.filter(
    (r) => r.status === LabRequestStatus.IN_PROGRESS
  ).length;
  const pendingOnlyCount = labRequests.filter(
    (r) => r.status === LabRequestStatus.PENDING
  ).length;

  const todayStr = new Date().toISOString().slice(0, 10);
  const completedTodayCount = labReports.filter(
    (r) => r.uploaded_by === user.id && r.created_at.startsWith(todayStr)
  ).length;

  const completedReports = labReports.filter((r) => r.uploaded_by === user.id);

  // Filtered pending requests by search
  const filteredPending = useMemo(() => {
    if (!searchQuery.trim()) return pendingRequests;
    const q = searchQuery.toLowerCase();
    return pendingRequests.filter(
      (r) =>
        r.patient_name.toLowerCase().includes(q) ||
        r.test_name.toLowerCase().includes(q) ||
        r.doctor_name.toLowerCase().includes(q)
    );
  }, [pendingRequests, searchQuery]);

  // Display name helpers
  const displayName = profile?.full_name ?? user.email.split("@")[0];
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div id="lab-tech-portal" className="min-h-screen bg-[#f8f9ff] flex flex-col md:flex-row">

      {/* ─── Sidebar ─── */}
      <aside className="w-full md:w-64 bg-white border-r border-[#bec8d2]/40 p-5 flex flex-col justify-between shrink-0">
        <div>
          {/* Profile block */}
          <div className="flex items-center gap-3 pb-5 border-b border-[#bec8d2]/20 mb-5">
            <div className="w-11 h-11 rounded-full bg-emerald-700 text-white flex items-center justify-center font-black text-sm shrink-0">
              {initials || "LB"}
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-xs text-[#0b1c30] truncate">{displayName}</h3>
              <p className="text-[9px] text-[#0ea5e9] uppercase tracking-wide font-black font-mono">
                Lab Technician
              </p>
              {labTech?.qualification && (
                <p className="text-[9px] text-slate-400 truncate">{labTech.qualification}</p>
              )}
            </div>
          </div>

          {/* Hospital assignment */}
          {hospital && (
            <div className="flex items-start gap-2 bg-[#eff4ff] rounded-lg px-3 py-2.5 mb-5 border border-blue-100">
              <Building2 className="w-3.5 h-3.5 text-[#006591] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">Assigned Hospital</p>
                <p className="text-[11px] font-bold text-[#0b1c30] leading-tight truncate">{hospital.hospital_name}</p>
                <p className="text-[9px] text-slate-400 truncate">{hospital.city}</p>
              </div>
            </div>
          )}

          {/* Nav */}
          <nav className="space-y-1">
            <button
              onClick={() => { setActiveTab("pending"); setActiveRequest(null); setSearchQuery(""); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "pending" && !activeRequest
                  ? "bg-[#006591] text-white shadow-xs"
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <Activity className="w-4 h-4 shrink-0" />
              Incoming Lab Orders
              {pendingRequests.length > 0 && (
                <span className="bg-rose-500 text-white font-bold px-1.5 py-0.5 rounded-full text-[9px] ml-auto">
                  {pendingRequests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab("completed"); setActiveRequest(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "completed"
                  ? "bg-[#006591] text-white shadow-xs"
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              Reports History
              {completedReports.length > 0 && (
                <span className="bg-emerald-500 text-white font-bold px-1.5 py-0.5 rounded-full text-[9px] ml-auto">
                  {completedReports.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        <button
          onClick={onLogout}
          className="flex items-center gap-3 text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg mt-6 w-full text-left"
        >
          <LogOut className="w-4 h-4" />
          Disconnect workstation
        </button>
      </aside>

      {/* ─── Main Panel ─── */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-5xl mx-auto w-full">

        {/* ══ PENDING / IN PROGRESS TAB ══ */}
        {activeTab === "pending" && !activeRequest && (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Clinical Laboratory Testing Queue</h1>
              <p className="text-xs text-[#3e4850] mt-0.5">
                Incoming requests ordered by consulting specialist doctors
                {hospital ? ` at ${hospital.hospital_name}` : ""}. Conduct tests and upload numerical reports.
              </p>
            </div>

            {/* ── Stats Bar ── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-[#bec8d2]/30 rounded-xl p-4 shadow-xs text-center">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Pending</p>
                <p className="text-2xl font-black text-blue-600">{pendingOnlyCount}</p>
              </div>
              <div className="bg-white border border-[#bec8d2]/30 rounded-xl p-4 shadow-xs text-center">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">In Progress</p>
                <p className="text-2xl font-black text-amber-500">{inProgressCount}</p>
              </div>
              <div className="bg-white border border-[#bec8d2]/30 rounded-xl p-4 shadow-xs text-center">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Completed Today</p>
                <p className="text-2xl font-black text-emerald-600">{completedTodayCount}</p>
              </div>
            </div>

            {/* ── Search bar ── */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by patient name, test name or doctor…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-xs border border-[#bec8d2] rounded-lg focus:outline-none focus:border-[#006591] bg-white shadow-xs"
              />
            </div>

            {/* ── Queue Table ── */}
            <div className="bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-3 bg-stone-50 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-[#0b1c30]">
                <span>LAB DIAGNOSTICS ORDER</span>
                <span>DESK ACTION</span>
              </div>

              {filteredPending.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  {searchQuery ? "No results match your search." : "No pending orders on queue today. Good work!"}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredPending.map((req) => (
                    <div
                      key={req.id}
                      className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        {/* Status badge */}
                        <div className="flex items-center gap-2 mb-1.5">
                          {req.status === LabRequestStatus.IN_PROGRESS ? (
                            <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                              Processing&hellip;
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              <Clock className="w-3 h-3" />
                              Pending
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-sm text-[#0b1c30]">{req.test_name}</h4>
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                          <User2 className="w-3 h-3" />
                          <span>Patient: <span className="font-semibold text-[#0b1c30]">{req.patient_name}</span></span>
                          <span className="text-slate-300">·</span>
                          <span>Dr. {req.doctor_name}</span>
                        </div>
                        {req.instructions && (
                          <p className="text-[11px] text-indigo-600 font-medium mt-1">
                            Instructions:{" "}
                            <span className="text-slate-600 font-normal">{req.instructions}</span>
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">
                          Ordered: {formatDate(req.created_at)}
                        </p>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        {req.status === LabRequestStatus.PENDING ? (
                          <button
                            onClick={() => handleStartTest(req.id)}
                            className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                          >
                            <FlaskConical className="w-3.5 h-3.5" />
                            Start Test
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setActiveRequest(req);
                              setResultsText(
                                `Test Category: ${req.test_name}\nAttending Specialist: Dr. ${req.doctor_name}\nPatient Name: ${req.patient_name}\n\nPathological parameters observed:\n- Parameter 1: 14.1 g/dL (Normal)\n- Parameter 2: Steady sinus rhythm\n\nPATHOLOGY DIAGNOSIS SUMMARY:\nFindings within normal reference ranges.`
                              );
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                            Enter Results &amp; Complete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ ACTIVE TEST LOG WORKSTATION ══ */}
        {activeRequest && (
          <div className="space-y-6">
            <div className="bg-[#eff4ff] p-4 rounded-xl border border-teal-200">
              <span className="text-[10px] font-black uppercase text-[#0ea5e9]">
                DIAGNOSTICS RECORD WORKSTATION
              </span>
              <h2 className="text-lg font-black text-[#0b1c30] mt-0.5">
                Recording Results for {activeRequest.test_name}
              </h2>
              <p className="text-xs text-[#3e4850]">
                Target patient: {activeRequest.patient_name} · Attending doctor: Dr.{" "}
                {activeRequest.doctor_name}
              </p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl p-6 shadow-xs max-w-2xl">
              {publishSuccess && (
                <div className="bg-emerald-50 border border-emerald-400 text-emerald-800 p-4 rounded-md text-xs font-bold text-center mb-4">
                  🚀 Pathology results finalized and published to client-clinician panel!
                </div>
              )}

              <form onSubmit={handlePublishResults} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">
                    Pathology Metrics &amp; Narrative (Enter Values) *
                  </label>
                  <textarea
                    required
                    rows={10}
                    value={resultsText}
                    onChange={(e) => setResultsText(e.target.value)}
                    className="w-full px-3 py-2 border border-[#bec8d2] rounded font-mono text-xs focus:outline-none focus:border-[#006591] bg-stone-50"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveRequest(null)}
                    className="text-xs text-slate-500 hover:underline px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-[#006591] hover:bg-[#004c6e] text-white text-xs font-bold px-6 py-2.5 rounded-lg shadow-sm transition-colors"
                  >
                    Verify Metrics &amp; Publish Completed Report
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══ REPORTS HISTORY ══ */}
        {activeTab === "completed" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Pathology Reports Archive</h1>
              <p className="text-xs text-[#3e4850] mt-0.5">
                Log history of completed pathology metrics uploaded under your laboratory technician account.
              </p>
            </div>

            <div className="space-y-4">
              {completedReports.length === 0 ? (
                <div className="bg-white p-8 border border-slate-200 rounded-xl text-center text-xs text-slate-400">
                  No report histories recorded.
                </div>
              ) : (
                completedReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="bg-white border border-[#bec8d2]/30 rounded-xl shadow-xs overflow-hidden"
                  >
                    {/* Card header */}
                    <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-base font-black text-[#0b1c30]">{rep.test_name}</h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                          <User2 className="w-3 h-3" />
                          <span className="font-semibold text-[#0b1c30]">{rep.patient_name}</span>
                          <span className="text-slate-300">·</span>
                          <span>Dr. {rep.doctor_name}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-start sm:items-end gap-1">
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                          <CheckCircle2 className="w-3 h-3" />
                          Completed
                        </span>
                        <p className="text-[10px] text-slate-400">{formatDate(rep.created_at)}</p>
                      </div>
                    </div>

                    {/* Results block */}
                    <div className="px-5 py-4">
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">
                        Results
                      </p>
                      <pre className="font-mono text-xs text-[#3e4850] whitespace-pre-wrap bg-stone-50 border border-slate-200/70 rounded-lg p-4 leading-relaxed">
                        {rep.results_text}
                      </pre>
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-2.5 bg-stone-50 border-t border-slate-100">
                      <p className="text-[9px] text-slate-400 font-mono">Report ID: {rep.id}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
