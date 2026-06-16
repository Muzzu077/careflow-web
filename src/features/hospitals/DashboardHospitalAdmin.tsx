import React, { useState, useEffect } from "react";
import { Database } from "../../api";
import { User, UserRole, UserStatus } from "../../types";
import { supabase } from "../../supabaseClient";
import { createClient } from "@supabase/supabase-js";
import { 
  Building, Users, ShieldCheck, Activity, BarChart3, 
  MapPin, Check, X, ShieldAlert, LogOut, CheckCircle2, 
  Settings, UserX, Award, Plus
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

  // Add Staff form states
  const [staffRole, setStaffRole] = useState<"doctor" | "receptionist" | "lab_technician">("doctor");
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [docLicense, setDocLicense] = useState("");
  const [docSpecialization, setDocSpecialization] = useState("General Physician");
  const [docExperience, setDocExperience] = useState("5");
  const [docQualification, setDocQualification] = useState("MBBS, MD");
  const [labQualification, setLabQualification] = useState("B.Sc MLT");
  const [addStaffSuccess, setAddStaffSuccess] = useState(false);

  useEffect(() => {
    loadDatabase();
  }, [user]);

  const loadDatabase = async () => {
    // 1. Get admin's hospital ID
    const adminHospId = await Database.getHospitalAdminHospitalId(user.id);
    
    // 2. Load all records
    const allUsers = await Database.getUsers();
    const allProfs = await Database.getProfiles();
    const allHosps = await Database.getHospitals();
    const allDocs = await Database.getDoctors();
    const allTechs = await Database.getLabTechs();
    const allReceps = await Database.getReceptionists();

    // 3. Find the admin's hospital info
    const adminHosp = allHosps.find(h => h.id === adminHospId) || allHosps[0] || {
      id: "placeholder",
      name: "CareFlow General Hospital",
      city: "Chennai",
      area: "Tambaram",
      address: "Tambaram High Road",
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
    const allAppts = await Database.getAppointments();
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

  // SUSPEND STAFF USER
  const handleSuspendClinician = async (clinicianId: string) => {
    const { error } = await supabase
      .from("users")
      .update({ status: UserStatus.SUSPENDED })
      .eq("id", clinicianId);

    if (error) {
      alert("Database error: " + error.message);
      return;
    }

    alert("Clinician credentials SUSPENDED.");
    loadDatabase();
  };

  // REACTIVATE STAFF USER
  const handleReactivateClinician = async (clinicianId: string) => {
    const { error } = await supabase
      .from("users")
      .update({ status: UserStatus.ACTIVE })
      .eq("id", clinicianId);

    if (error) {
      alert("Database error: " + error.message);
      return;
    }

    alert("Clinician credentials REACTIVATED.");
    loadDatabase();
  };

  // ADD HOSPITAL STAFF (DOCTOR, RECEPTIONIST, LAB TECH)
  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName || !staffEmail || !staffPhone || !staffPassword) {
      alert("All basic credentials details are required.");
      return;
    }

    if (!hospitalInfo || hospitalInfo.id === "placeholder") {
      alert("Hospital context is not ready yet.");
      return;
    }

    try {
      const tempClient = createClient(
        (import.meta as any).env.VITE_SUPABASE_URL || "",
        (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "",
        { auth: { persistSession: false } }
      );

      let dbRole = UserRole.DOCTOR;
      if (staffRole === "receptionist") dbRole = UserRole.RECEPTIONIST;
      if (staffRole === "lab_technician") dbRole = UserRole.LAB_TECHNICIAN;

      const { data: signUpData, error: signUpErr } = await tempClient.auth.signUp({
        email: staffEmail.trim(),
        password: staffPassword,
        options: {
          data: {
            role: dbRole,
            full_name: staffName,
            status: UserStatus.ACTIVE
          }
        }
      });

      if (signUpErr) {
        alert("Auth signup failed: " + signUpErr.message);
        return;
      }

      if (!signUpData.user) {
        alert("No user object returned from auth signUp.");
        return;
      }

      const staffUserId = signUpData.user.id;

      if (staffRole === "doctor") {
        const { error: docErr } = await supabase
          .from("doctors")
          .insert({
            id: staffUserId,
            license_number: docLicense,
            specialization: docSpecialization,
            experience: parseInt(docExperience) || 0,
            hospital_id: hospitalInfo.id,
            city: hospitalInfo.city,
            area: hospitalInfo.area,
            approved: true
          });

        if (docErr) {
          alert("Doctor details insert error: " + docErr.message);
          return;
        }
      } 
      else if (staffRole === "receptionist") {
        const { error: recepErr } = await supabase
          .from("receptionists")
          .insert({
            id: staffUserId,
            hospital_id: hospitalInfo.id,
            approved: true
          });

        if (recepErr) {
          alert("Receptionist details insert error: " + recepErr.message);
          return;
        }
      } 
      else if (staffRole === "lab_technician") {
        const { error: labErr } = await supabase
          .from("lab_technicians")
          .insert({
            id: staffUserId,
            qualification: labQualification,
            hospital_id: hospitalInfo.id,
            approved: true
          });

        if (labErr) {
          alert("Lab technician details insert error: " + labErr.message);
          return;
        }
      }

      await supabase.from("users").update({ status: UserStatus.ACTIVE }).eq("id", staffUserId);

      setAddStaffSuccess(true);
      setStaffName("");
      setStaffEmail("");
      setStaffPhone("");
      setStaffPassword("");
      setDocLicense("");
      setLabQualification("");

      loadDatabase();

      setTimeout(() => {
        setAddStaffSuccess(false);
        setActiveTab("staff");
      }, 1200);

    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Active staff
  const activeStaffList = clinicians.filter(u => 
    u.status === "ACTIVE" && 
    (u.role === UserRole.DOCTOR || u.role === UserRole.RECEPTIONIST || u.role === UserRole.LAB_TECHNICIAN)
  );

  // Suspended or Rejected staff
  const suspendedStaffList = clinicians.filter(u => 
    (u.status === "SUSPENDED" || u.status === "REJECTED") && 
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
              onClick={() => setActiveTab("add-staff")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "add-staff" 
                  ? "bg-[#006591] text-white shadow-xs" 
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <Plus className="w-4 h-4" />
              Add Hospital Staff
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
        
        {/* ADD HOSPITAL STAFF TAB */}
        {activeTab === "add-staff" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Register Healthcare Staff</h1>
              <p className="text-xs text-[#3e4850]">Add Doctors, Receptionists, and Lab Specialists directly under your hospital's account registry.</p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl p-6 shadow-xs max-w-xl">
              {addStaffSuccess && (
                <div className="bg-emerald-50 border border-emerald-400 text-emerald-800 p-4 rounded-md text-xs font-bold mb-4 text-center">
                  ✓ Staff Account created and registered successfully!
                </div>
              )}

              <form onSubmit={handleAddStaffSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Select Roster Role</label>
                  <div className="grid grid-cols-3 gap-1 bg-stone-50 p-1 rounded border border-[#bec8d2]/30">
                    {[
                      { role: "doctor", label: "Doctor" },
                      { role: "receptionist", label: "Reception" },
                      { role: "lab_technician", label: "Lab Tech" }
                    ].map(r => (
                      <button
                        key={r.role}
                        type="button"
                        onClick={() => setStaffRole(r.role as any)}
                        className={`py-2 text-[10px] font-black rounded transition-all uppercase leading-none ${
                          staffRole === r.role 
                            ? "bg-[#0ea5e9] text-white shadow-xs" 
                            : "text-slate-600 hover:bg-slate-105"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Name *</label>
                    <input 
                      required
                      type="text"
                      placeholder="e.g. Jane Doe"
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Address *</label>
                    <input 
                      required
                      type="email"
                      placeholder="staff@hospital.org"
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone Number *</label>
                    <input 
                      required
                      type="tel"
                      placeholder="+1 (555) 012-3456"
                      value={staffPhone}
                      onChange={(e) => setStaffPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Temporary Password *</label>
                    <input 
                      required
                      type="password"
                      placeholder="••••••••"
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none"
                    />
                  </div>
                </div>

                {/* Conditional Fields per Role */}
                {staffRole === "doctor" && (
                  <div className="bg-[#eff4ff]/30 p-4 rounded-lg border border-[#d3e4fe]/50 space-y-3">
                    <h4 className="font-extrabold text-xs uppercase text-[#006591] tracking-wider mb-2">Doctor Clinical Details</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">License Number *</label>
                        <input 
                          required
                          type="text"
                          placeholder="e.g. LIC-12345"
                          value={docLicense}
                          onChange={(e) => setDocLicense(e.target.value)}
                          className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Specialization</label>
                        <input 
                          required
                          type="text"
                          value={docSpecialization}
                          onChange={(e) => setDocSpecialization(e.target.value)}
                          className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Experience (Years) *</label>
                        <input 
                          required
                          type="number"
                          value={docExperience}
                          onChange={(e) => setDocExperience(e.target.value)}
                          className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qualification</label>
                        <input 
                          required
                          type="text"
                          value={docQualification}
                          onChange={(e) => setDocQualification(e.target.value)}
                          className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {staffRole === "lab_technician" && (
                  <div className="bg-[#eff4ff]/30 p-4 rounded-lg border border-[#d3e4fe]/50 space-y-3">
                    <h4 className="font-extrabold text-xs uppercase text-[#006591] tracking-wider mb-2">Lab Specialist Details</h4>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qualification *</label>
                      <input 
                        required
                        type="text"
                        value={labQualification}
                        onChange={(e) => setLabQualification(e.target.value)}
                        className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-[#006591] hover:bg-[#004c6e] text-white text-xs font-bold py-2.5 rounded shadow-xs transition-colors"
                >
                  Create Staff Account & Dispatch Credentials
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MANAGE STAFF TAB */}
        {activeTab === "staff" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Attending Hospital Staff Roster</h1>
              <p className="text-xs text-[#3e4850]">List of Active clinical professionals, specialists, and desks staff currently verified for the complex.</p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-3 bg-stone-50 border-b border-slate-100 text-xs font-extrabold text-slate-500 uppercase">
                Active attendants roster ({activeStaffList.length} staff)
              </div>
              {activeStaffList.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">No active staff members currently on roster.</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-50/50 border-b border-slate-100 text-slate-550 font-bold">
                      <th className="p-3">ATTENDING SPECIALIST</th>
                      <th className="p-3">CLINICAL ROLE</th>
                      <th className="p-3">CREDENTIAL STATE</th>
                      <th className="p-3">DESK COMMAND</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeStaffList.map(st => (
                      <tr key={st.id} className="hover:bg-slate-50/55 transition-colors">
                        <td className="p-3 font-bold text-slate-800">
                          {getUserName(st.id)}
                          <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{st.email}</span>
                        </td>
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
              )}
            </div>

            {/* Suspended & Rejected Staff */}
            <div className="bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-3 bg-rose-50 border-b border-rose-100 text-xs font-extrabold text-rose-800 uppercase">
                Suspended & Rejected Accounts ({suspendedStaffList.length} accounts)
              </div>
              {suspendedStaffList.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">No suspended or rejected credentials in registry database.</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-50/50 border-b border-slate-100 text-slate-550 font-bold">
                      <th className="p-3">CLINICIAN</th>
                      <th className="p-3">ROLE</th>
                      <th className="p-3">LIFECYCLE STATE</th>
                      <th className="p-3">DESK ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {suspendedStaffList.map(st => (
                      <tr key={st.id} className="hover:bg-slate-50/55 transition-colors">
                        <td className="p-3 font-bold text-slate-800">
                          {getUserName(st.id)}
                          <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{st.email}</span>
                        </td>
                        <td className="p-3 font-mono text-[10px] uppercase font-bold text-slate-600">{st.role}</td>
                        <td className="p-3">
                          <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                            st.status === "SUSPENDED" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-850"
                          }`}>
                            {st.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleReactivateClinician(st.id)}
                            className="text-[#006591] hover:underline hover:text-[#004c6e] font-bold"
                          >
                            Reactivate & License Account
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
                  <h3 className="font-extrabold text-sm text-[#0b1c30]">{hospitalInfo?.hospital_name}</h3>
                  <p className="text-xs text-slate-400">Reg: CareFlow Node-H1WA</p>
                </div>
              </div>

              <div className="space-y-2 text-xs leading-relaxed text-slate-700">
                <p><strong>Physical Address:</strong> {hospitalInfo?.address || 'N/A'}, {hospitalInfo?.city || 'N/A'}</p>
                <p><strong>Work Area:</strong> {hospitalInfo?.area || 'N/A'}, {hospitalInfo?.city || 'N/A'} ({hospitalInfo?.state || 'N/A'})</p>
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
