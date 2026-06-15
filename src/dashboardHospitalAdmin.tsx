import React, { useState, useEffect } from "react";
import { MockDB } from "./mockData";
import { User, UserRole, UserStatus } from "./types";
import { 
  Building, Users, ShieldCheck, Activity, BarChart3, 
  MapPin, Check, X, ShieldAlert, LogOut, CheckCircle2, 
  Settings, UserX, Award 
} from "lucide-react";

interface HospitalAdminProps {
  user: User;
  onLogout: () => void;
}

export default function DashboardHospitalAdmin({ user, onLogout }: HospitalAdminProps) {
  // Tabs: 'verify' | 'staff' | 'analytics' | 'profile'
  const [activeTab, setActiveTab] = useState<"verify" | "staff" | "analytics" | "profile">("verify");

  // State
  const [clinicians, setClinicians] = useState<User[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [hospitalInfo, setHospitalInfo] = useState<any>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [labTechs, setLabTechs] = useState<any[]>([]);

  // Stats
  const [patientCount, setPatientCount] = useState(0);
  const [doctorCount, setDoctorCount] = useState(0);
  const [staffCount, setStaffCount] = useState(0);

  useEffect(() => {
    loadDatabase();
  }, [user]);

  const loadDatabase = async () => {
    // 1. Get admin's hospital ID
    const adminHospId = await MockDB.getHospitalAdminHospitalId(user.id);
    
    // 2. Load all records
    const allUsers = await MockDB.getUsers();
    const allProfs = await MockDB.getProfiles();
    const allHosps = await MockDB.getHospitals();
    const allDocs = await MockDB.getDoctors();
    const allTechs = await MockDB.getLabTechs();
    const allReceps = await MockDB.getReceptionists();

    // 3. Find the admin's hospital info
    const adminHosp = allHosps.find(h => h.id === adminHospId) || allHosps[0] || {
      id: "placeholder",
      name: "CareFlow General Hospital",
      city: "Seattle",
      area: "Downtown",
      address: "123 Main St",
      approved: true
    };
    setHospitalInfo(adminHosp);

    // 4. Filter doctors, receptionists, and lab techs for this hospital
    const myDoctors = allDocs.filter(d => d.hospital_id === adminHosp.id);
    const myReceps = allReceps.filter(r => r.hospital_id === adminHosp.id);
    const myTechs = allTechs.filter(t => t.hospital_id === adminHosp.id);

    // 5. Get the user IDs of the staff in this hospital
    const myStaffUserIds = new Set([
      ...myDoctors.map(d => d.id),
      ...myReceps.map(r => r.id),
      ...myTechs.map(t => t.id)
    ]);

    // 6. Filter clinicians (users) that belong to this hospital
    const myClinicians = allUsers.filter(u => myStaffUserIds.has(u.id));

    setClinicians(myClinicians);
    setProfiles(allProfs);
    setHospitals(allHosps);
    setDoctors(myDoctors);
    setLabTechs(myTechs);

    setDoctorCount(myDoctors.length);
    setStaffCount(myReceps.length + myTechs.length);

    // Count patients registered at this hospital (filter appointments at this hospital to find unique patients)
    const allAppts = await MockDB.getAppointments();
    const myAppts = allAppts.filter(a => a.hospital_id === adminHosp.id);
    const myPatientIds = new Set(myAppts.map(a => a.patient_id));
    setPatientCount(myPatientIds.size);
  };

  const getUserName = (userId: string) => {
    const prof = profiles.find(p => p.id === userId);
    return prof ? prof.full_name : "Consultant";
  };

  const getUserDetails = (u: User) => {
    if (u.role === UserRole.DOCTOR) {
      const dExt = doctors.find(doc => doc.id === u.id);
      return dExt ? `License: ${dExt.license_number} · Speciality: ${dExt.specialization} · ${dExt.experience} Years Exp` : "Clinician Application";
    }
    if (u.role === UserRole.LAB_TECHNICIAN) {
      const lExt = labTechs.find(l => l.id === u.id);
      return lExt ? `Qualification: ${lExt.qualification}` : "Lab Specialist Application";
    }
    return `Customer desk representative`;
  };

  // APPROVE STAFF USER
  const handleApproveClinician = async (clinicianId: string) => {
    const allUsers = await MockDB.getUsers();
    const targetUser = allUsers.find(u => u.id === clinicianId);
    if (!targetUser) return;

    const updated = allUsers.map(u => {
      if (u.id === clinicianId) {
        return { ...u, status: "ACTIVE" as UserStatus };
      }
      return u;
    });
    await MockDB.saveUsers(updated);

    if (targetUser.role === UserRole.DOCTOR) {
      const allDoctors = await MockDB.getDoctors();
      const updatedDocs = allDoctors.map(d => d.id === clinicianId ? { ...d, approved: true } : d);
      await MockDB.saveDoctors(updatedDocs);
    } else if (targetUser.role === UserRole.RECEPTIONIST) {
      const allReceptionists = await MockDB.getReceptionists();
      const updatedReceps = allReceptionists.map(r => r.id === clinicianId ? { ...r, approved: true } : r);
      await MockDB.saveReceptionists(updatedReceps);
    } else if (targetUser.role === UserRole.LAB_TECHNICIAN) {
      const allLabTechs = await MockDB.getLabTechs();
      const updatedTechs = allLabTechs.map(t => t.id === clinicianId ? { ...t, approved: true } : t);
      await MockDB.saveLabTechs(updatedTechs);
    }

    alert("Clinician verified successfully. Credential state updated to ACTIVE.");
    loadDatabase();
  };

  // REJECT/SUSPEND USER
  const handleSuspendClinician = async (clinicianId: string) => {
    const allUsers = await MockDB.getUsers();
    const updated = allUsers.map(u => {
      if (u.id === clinicianId) {
        return { ...u, status: "SUSPENDED" as UserStatus };
      }
      return u;
    });
    await MockDB.saveUsers(updated);
    alert("Clinician credentials SUSPENDED.");
    loadDatabase();
  };

  // Filter pending staff
  const pendingStaff = clinicians.filter(u => 
    u.status === "PENDING" && 
    (u.role === UserRole.DOCTOR || u.role === UserRole.RECEPTIONIST || u.role === UserRole.LAB_TECHNICIAN)
  );

  // Active staff
  const activeStaffList = clinicians.filter(u => 
    u.status === "ACTIVE" && 
    (u.role === UserRole.DOCTOR || u.role === UserRole.RECEPTIONIST || u.role === UserRole.LAB_TECHNICIAN)
  );

  return (
    <div id="hospital-admin-portal" className="min-h-screen bg-[#f8f9ff] flex flex-col md:flex-row">
      
      {/* Side Cabinet */}
      <aside className="w-full md:w-64 bg-white border-r border-[#bec8d2]/40 p-5 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 pb-6 border-b border-[#bec8d2]/20 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#006591] text-white flex items-center justify-center font-bold">
              HA
            </div>
            <div>
              <h3 className="font-extrabold text-xs text-[#0b1c30]">Hospital Administrator</h3>
              <p className="text-[9px] text-[#0ea5e9] uppercase tracking-wide font-black">Local Controller Node</p>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab("verify")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "verify" 
                  ? "bg-[#006591] text-white shadow-xs" 
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Verify Clinicians
              {pendingStaff.length > 0 && (
                <span className="bg-rose-500 text-white font-bold px-1.5 py-0.5 rounded-full text-[9px] ml-auto animate-pulse">
                  {pendingStaff.length} pending
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("staff")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "staff" 
                  ? "bg-[#006591] text-white shadow-xs" 
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <Users className="w-4 h-4" />
              Manage Staff
            </button>

            <button
              onClick={() => setActiveTab("analytics")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "analytics" 
                  ? "bg-[#006591] text-white shadow-xs" 
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Analytics Dashboard
            </button>

            <button
              onClick={() => setActiveTab("profile")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "profile" 
                  ? "bg-[#006591] text-white shadow-xs" 
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <Settings className="w-4 h-4" />
              Facility Profile
            </button>
          </nav>
        </div>

        <button 
          onClick={onLogout}
          className="flex items-center gap-3 text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg mt-6 w-full text-left"
        >
          <LogOut className="w-4 h-4" />
          Close local session
        </button>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-5xl mx-auto w-full">
        
        {/* VERIFY CLINICIANS TAB */}
        {activeTab === "verify" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Verify incoming Clinicians & Staff</h1>
              <p className="text-xs text-[#3e4850]">Hospital Admins review medical credentials and license numbers manually before licensing clinical write paths.</p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-3 bg-stone-50 border-b border-slate-100 text-xs font-bold text-[#0b1c30]">
                PENDING CLINICIANS pipeline
              </div>

              {pendingStaff.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs text-medium">No pending clinician applications waiting in register today.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingStaff.map(cl => (
                    <div key={cl.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-[#0b1c30]">{getUserName(cl.id)}</span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                            {cl.role}
                          </span>
                        </div>
                        <p className="text-xs text-[#3e4850] mt-1">Email: {cl.email}</p>
                        <p className="text-[11px] font-mono text-[#0ea5e9] mt-2 font-medium">{getUserDetails(cl)}</p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSuspendClinician(cl.id)}
                          className="p-2 border border-red-200 text-red-600 rounded hover:bg-red-50"
                          title="Reject credential"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleApproveClinician(cl.id)}
                          className="bg-[#006591] hover:bg-[#004c6e] text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-1 shadow-sm"
                        >
                          <Check className="w-4 h-4" /> Approve & Enable
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MANAGE STAFF TAB */}
        {activeTab === "staff" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Verified clinicians roster</h1>
              <p className="text-xs text-[#3e4850]">List of Active clinical professionals, specialists, and desks staff currently verified for the complex.</p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-slate-100 text-slate-500 font-bold">
                    <th className="p-3">ATTENDING SPECIALIST</th>
                    <th className="p-3">CLINICAL ROLE</th>
                    <th className="p-3">CREDENTIAL STATE</th>
                    <th className="p-3">DESK COMMAND</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeStaffList.map(st => (
                    <tr key={st.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{getUserName(st.id)}<span className="block text-[10px] text-slate-400 font-normal mt-0.5">{st.email}</span></td>
                      <td className="p-3 font-mono text-[10px] uppercase font-bold text-slate-600">{st.role}</td>
                      <td className="p-3">
                        <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                          ACTIVE VERIFIED
                        </span>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => handleSuspendClinician(st.id)}
                          className="text-red-500 hover:underline hover:text-red-700 font-bold"
                        >
                          Suspend credentials
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Clinical Workload Analytics</h1>
              <p className="text-xs text-[#3e4850]">Platform parameters, hospital occupancy rate, and specialists analytics charts.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 border border-[#bec8d2]/30 rounded-xl shadow-xs">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block mb-2">Total Patients</span>
                <div className="text-3xl font-black text-[#006591]">{patientCount}</div>
                <p className="text-[10px] text-slate-400 mt-1">Unique Patient ID keys</p>
              </div>

              <div className="bg-white p-5 border border-[#bec8d2]/30 rounded-xl shadow-xs">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block mb-2">Active Specialists</span>
                <div className="text-3xl font-black text-[#006591]">{doctorCount}</div>
                <p className="text-[10px] text-slate-400 mt-1">FTE Clinicians on site</p>
              </div>

              <div className="bg-white p-5 border border-[#bec8d2]/30 rounded-xl shadow-xs">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block mb-2">Office Staff</span>
                <div className="text-3xl font-black text-[#006591]">{staffCount}</div>
                <p className="text-[10px] text-slate-400 mt-1">Reception + Lab Techs</p>
              </div>
            </div>

            {/* Simulated Workload Metric Bar */}
            <div className="bg-white p-6 border border-[#bec8d2]/30 rounded-xl shadow-xs space-y-4">
              <h3 className="font-extrabold text-xs uppercase text-[#0b1c30] tracking-wider">Weekly Consulting Load By Department</h3>
              
              <div className="space-y-3">
                {[
                  { dept: "General Medicine", load: "85%", bg: "bg-teal-500" },
                  { dept: "Cardiology", load: "92%", bg: "bg-rose-500" },
                  { dept: "Orthopedics", load: "64%", bg: "bg-indigo-500" },
                  { dept: "Diagnostics lab", load: "78%", bg: "bg-emerald-500" }
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>{item.dept}</span>
                      <span>{item.load} Capacity</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded overflow-hidden">
                      <div className={`${item.bg} h-full`} style={{ width: item.load }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === "profile" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Facility profile setup</h1>
              <p className="text-xs text-[#3e4850]">Review local hospital parameters, location configurations, and metadata settings.</p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl p-6 shadow-xs max-w-lg space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className="w-12 h-12 bg-[#0ea5e9]/10 text-[#006591] rounded-full flex items-center justify-center">
                  <Building className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#0b1c30]">{hospitalInfo?.name}</h3>
                  <p className="text-xs text-slate-400">Reg: CareFlow Node-H1WA</p>
                </div>
              </div>

              <div className="space-y-2 text-xs leading-relaxed text-slate-700">
                <p><strong>Physical Address:</strong> 850 Health Plaza, Seattle</p>
                <p><strong>Work Area:</strong> Downtown, Seattle (WA)</p>
                <p><strong>Facility Status:</strong> <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">APPROVED PLATFORM FACILITY</span></p>
              </div>

              <button 
                onClick={() => alert("Credentials secured. Hospital parameters locked by admin.")}
                className="w-full bg-[#006591] hover:bg-[#004c6e] text-white font-bold py-2 rounded text-xs mt-4"
              >
                Modify Facility Configurations
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
