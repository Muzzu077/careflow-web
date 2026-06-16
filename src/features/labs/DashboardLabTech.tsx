import React, { useState, useEffect } from "react";
import { Database } from "../../api";
import { User, LabRequest, LabReport, LabRequestStatus } from "../../types";
import { 
  Activity, Clipboard, CheckSquare, Sparkles, Send, FileText, 
  MapPin, LogOut, CheckCircle2, ChevronRight, AlertCircle 
} from "lucide-react";

interface LabTechProps {
  user: User;
  onLogout: () => void;
}

export default function DashboardLabTech({ user, onLogout }: LabTechProps) {
  // Tabs: 'pending' | 'completed' | 'create-report'
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");

  // DB Sync state
  const [labRequests, setLabRequests] = useState<LabRequest[]>([]);
  const [labReports, setLabReports] = useState<LabReport[]>([]);

  // Active testing form parameters
  const [activeRequest, setActiveRequest] = useState<LabRequest | null>(null);
  const [resultsText, setResultsText] = useState("");
  const [publishSuccess, setPublishSuccess] = useState(false);

  useEffect(() => {
    loadDatabase();
  }, [user]);

  const loadDatabase = async () => {
    // Lab Tech sees clinic requests
    const reqs = await Database.getLabRequests();
    const reps = await Database.getLabReports();
    
    setLabRequests(reqs);
    setLabReports(reps);
  };

  // COMPLETE LAB WORKFLOW -> PUBLISH RESULTS text
  const handlePublishResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRequest) return;

    if (!resultsText.trim()) {
      alert("Please record actual numerical or qualitative pathology test parameters.");
      return;
    }

    // 1. Create Report
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
      created_at: new Date().toISOString()
    };

    const currentReports = await Database.getLabReports();
    currentReports.unshift(newReport);
    await Database.saveLabReports(currentReports);

    // 2. Mark request completed
    const currentRequests = await Database.getLabRequests();
    const updated = currentRequests.map(r => {
      if (r.id === activeRequest.id) {
        return { ...r, status: LabRequestStatus.COMPLETED };
      }
      return r;
    });
    await Database.saveLabRequests(updated);

    // 3. Notify doctor and patient
    await Database.addNotification(activeRequest.patient_id, "Diagnostic Lab Report Published", `Your results for ${activeRequest.test_name} have been finalized and are available in your portal.`);
    
    setPublishSuccess(true);
    setResultsText("");
    setActiveRequest(null);
    loadDatabase();

    setTimeout(() => {
      setPublishSuccess(false);
      setActiveTab("pending");
    }, 1200);
  };

  const pendingRequests = labRequests.filter(r => r.status === LabRequestStatus.PENDING);
  const completedReports = labReports.filter(r => r.uploaded_by === user.id);

  return (
    <div id="lab-tech-portal" className="min-h-screen bg-[#f8f9ff] flex flex-col md:flex-row">
      
      {/* Side Cabinet */}
      <aside className="w-full md:w-64 bg-white border-r border-[#bec8d2]/40 p-5 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 pb-6 border-b border-[#bec8d2]/20 mb-6">
            <div className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold">
              LB
            </div>
            <div>
              <h3 className="font-extrabold text-xs text-[#0b1c30]">Technician</h3>
              <p className="text-[9px] text-[#0ea5e9] uppercase tracking-wide font-black font-mono">Specialist Technician</p>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => { setActiveTab("pending"); setActiveRequest(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "pending" && !activeRequest
                  ? "bg-[#006591] text-white shadow-xs" 
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <Activity className="w-4 h-4" />
              Incoming Lab Orders
              {pendingRequests.length > 0 && (
                <span className="bg-rose-500 text-white font-bold px-1.5 py-0.5 rounded-full text-[9px] ml-auto">
                  {pendingRequests.length} pending
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
              <FileText className="w-4 h-4" />
              Reports History log
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

      {/* Main Panel */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-5xl mx-auto w-full">
        
        {/* PENDING LAB REQUESTS */}
        {activeTab === "pending" && !activeRequest && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Clinical Laboratory Testing Queue</h1>
              <p className="text-xs text-[#3e4850]">Incoming requests ordered by consulting specialist doctors. Conduct tests and upload numerical reports.</p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-3 bg-stone-50 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-[#0b1c30]">
                <span>LAB DIAGNOSTICS ORDER</span>
                <span>DESK ACTION</span>
              </div>

              {pendingRequests.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No pending orders on queue today. Good work.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingRequests.map(req => (
                    <div key={req.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <span className="text-[10px] bg-red-100 text-red-800 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          PENDING DIAGNOSTICS
                        </span>
                        <h4 className="font-bold text-sm text-[#0b1c30] mt-1.5">{req.test_name}</h4>
                        <p className="text-xs text-slate-500">Patient: {req.patient_name} · Ordered by: Dr. {req.doctor_name}</p>
                      </div>

                      <button
                        onClick={() => {
                          setActiveRequest(req);
                          setResultsText(`Test Category: ${req.test_name}\nHemoglobin Rate: 14.1 g/dL (Normal)\nPulse rhythm: Steady\nDiagnostics summary: No pathogen growth detected. Metrics are normal.`);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm"
                      >
                        Enter Lab Results <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ACTIVE TEST LOG WORKSTATION */}
        {activeRequest && (
          <div className="space-y-6">
            <div className="bg-[#eff4ff] p-4 rounded-xl border border-teal-200">
              <span className="text-[10px] font-black uppercase text-[#0ea5e9]">DIAGNOSTICS RECORD WORKSTATION</span>
              <h2 className="text-lg font-black text-[#0b1c30] mt-0.5">Recording Results for {activeRequest.test_name}</h2>
              <p className="text-xs text-[#3e4850]">Target patient: {activeRequest.patient_name} · Attending doctor: Dr. {activeRequest.doctor_name}</p>
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
                    Pathology Metrics & Narrative (Enter Values) *
                  </label>
                  <textarea
                    required
                    rows={8}
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
                    className="bg-[#006591] hover:bg-[#004c6e] text-white text-xs font-bold px-6 py-2.5 rounded-lg shadow-sm"
                  >
                    Verify Metrics & Publish Completed Report
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* REPORTS LOGS HISTORY */}
        {activeTab === "completed" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Pathology Reports archive</h1>
              <p className="text-xs text-[#3e4850]">Log history of completed pathology metrics uploaded under your laboratory technician account.</p>
            </div>

            <div className="space-y-4">
              {completedReports.length === 0 ? (
                <div className="bg-white p-8 border border-slate-200 rounded-xl text-center text-xs text-slate-400">No report histories recorded.</div>
              ) : (
                completedReports.map(rep => (
                  <div key={rep.id} className="bg-white border border-[#bec8d2]/30 rounded-xl p-5 shadow-xs">
                    <div className="flex justify-between items-start pb-3 border-b border-slate-100 font-bold text-xs">
                      <div>
                        <h4 className="text-[#0b1c30]">Category: {rep.test_name}</h4>
                        <p className="text-[10px] text-slate-400 font-medium">Patient: {rep.patient_name} · Consulting: Dr. {rep.doctor_name}</p>
                      </div>
                      <span className="text-[#0ea5e9]">Report #{rep.id}</span>
                    </div>

                    <div className="pt-3 font-mono text-xs text-[#3e4850] whitespace-pre-wrap bg-stone-50 p-3 rounded border border-slate-200/50 mt-2">
                      {rep.results_text}
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
