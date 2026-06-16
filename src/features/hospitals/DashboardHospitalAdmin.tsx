import React, { useState, useEffect } from "react";
import { Database } from "../../api";
import { User, UserRole, UserStatus, Profile, Hospital, DoctorExt, LabTechnicianExt } from "../../types";
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
  const [activeTab, setActiveTab] = useState<"verify" | "staff" | "analytics" | "profile" | "add-staff">("verify");

  // State
  const [clinicians, setClinicians] = useState<User[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [hospitalInfo, setHospitalInfo] = useState<Hospital | null>(null);
  const [doctors, setDoctors] = useState<DoctorExt[]>([]);
  const [labTechs, setLabTechs] = useState<LabTechnicianExt[]>([]);

  // Stats
  const [patientCount, setPatientCount] = useState(0);
  const [doctorCount, setDoctorCount] = useState(0);
  const [staffCount, setStaffCount] = useState(0);
  const [appointmentsToday, setAppointmentsToday] = useState(0);
  const [labRequestsCount, setLabRequestsCount] = useState(0);
  const [labPendingCount, setLabPendingCount] = useState(0);
  const [labCompletedCount, setLabCompletedCount] = useState(0);
  const [weeklyAppts, setWeeklyAppts] = useState<{ day: string; count: number }[]>([]);

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
      hospital_name: "CareFlow General Hospital",
      city: "Chennai",
      area: "Tambaram",
      address: "Tambaram High Road",
      state: "Tamil Nadu",
      pincode: "600045",
      status: "ACTIVE",
      approved: true,
      created_at: new Date().toISOString()
    } as Hospital;
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

    // Count today's appointments
    const todayStr = new Date().toISOString().split('T')[0];
    const todayAppts = myAppts.filter(a => a.created_at && a.created_at.split('T')[0] === todayStr);
    setAppointmentsToday(todayAppts.length);

    // Count lab requests for this hospital
    const { count: labCount } = await supabase
      .from("lab_requests")
      .select("*", { count: "exact", head: true })
      .eq("hospital_id", adminHosp.id);
    setLabRequestsCount(labCount || 0);

    // Lab request status breakdown
    const { count: pendingLabs } = await supabase
      .from("lab_requests")
      .select("*", { count: "exact", head: true })
      .eq("hospital_id", adminHosp.id)
      .neq("status", "COMPLETED");
    setLabPendingCount(pendingLabs || 0);

    const { count: completedLabs } = await supabase
      .from("lab_requests")
      .select("*", { count: "exact", head: true })
      .eq("hospital_id", adminHosp.id)
      .eq("status", "COMPLETED");
    setLabCompletedCount(completedLabs || 0);

    // Weekly appointment trend (last 7 days)
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        dateStr: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        isoStr: d.toISOString().split('T')[0],
        count: 0
      };
    });
    myAppts.forEach(a => {
      if (a.created_at) {
        const datePart = a.created_at.split('T')[0];
        const match = last7Days.find(day => day.isoStr === datePart);
        if (match) match.count++;
      }
    });
    setWeeklyAppts(last7Days.map(d => ({ day: d.dateStr, count: d.count })));
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

    await Database.logStaffActivity(
      user.id,
      "Hospital Administrator",
      "STAFF_STATUS_CHANGE",
      `Suspended staff user credentials for user ID: ${clinicianId}`,
      hospitalInfo?.id
    );

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

    await Database.logStaffActivity(
      user.id,
      "Hospital Administrator",
      "STAFF_STATUS_CHANGE",
      `Reactivated staff user credentials for user ID: ${clinicianId}`,
      hospitalInfo?.id
    );

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

      await Database.logStaffActivity(
        user.id,
        "Hospital Administrator",
        "STAFF_CREATED",
        `Registered new staff user ${staffName} (${dbRole}) with Email: ${staffEmail}`,
        hospitalInfo.id
      );

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
              <p className="text-xs text-[#3e4850]">Hospital performance metrics, occupancy rates, and live operational load across departments.</p>
            </div>

            {/* KPI Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 border border-[#bec8d2]/30 rounded-xl shadow-xs">
                <span className="text-xs text-slate-500 font-bold block mb-1">TODAY'S APPOINTMENTS</span>
                <div className="text-3xl font-black text-[#006591]">{appointmentsToday}</div>
                <p className="text-[10px] text-slate-400 mt-1">Scheduled bookings today</p>
              </div>

              <div className="bg-white p-5 border border-[#bec8d2]/30 rounded-xl shadow-xs">
                <span className="text-xs text-slate-500 font-bold block mb-1">TOTAL PATIENTS</span>
                <div className="text-3xl font-black text-[#006591]">{patientCount}</div>
                <p className="text-[10px] text-slate-400 mt-1">Unique patient profiles</p>
              </div>

              <div className="bg-white p-5 border border-[#bec8d2]/30 rounded-xl shadow-xs">
                <span className="text-xs text-slate-500 font-bold block mb-1">ACTIVE DOCTORS</span>
                <div className="text-3xl font-black text-[#006591]">{doctorCount}</div>
                <p className="text-[10px] text-slate-400 mt-1">FTE Clinicians on site</p>
              </div>

              <div className="bg-white p-5 border border-[#bec8d2]/30 rounded-xl shadow-xs">
                <span className="text-xs text-slate-500 font-bold block mb-1">LAB REQUESTS</span>
                <div className="text-3xl font-black text-[#006591]">{labRequestsCount}</div>
                <p className="text-[10px] text-slate-400 mt-1">Pathology lab requests</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* SVG Donut Chart - Staff Distribution */}
              <div className="bg-white border border-[#bec8d2]/30 rounded-xl p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="font-extrabold text-sm text-[#0b1c30]">Staff Distribution</h3>
                  <p className="text-[11px] text-[#3e4850]">Breakdown of clinical staff roles at this facility.</p>
                </div>
                {(() => {
                  const total = doctorCount + staffCount;
                  if (total === 0) return (
                    <div className="h-40 flex items-center justify-center text-xs text-slate-400">No staff registered yet.</div>
                  );
                  const segments = [
                    { label: "Doctors", count: doctorCount, color: "#0ea5e9" },
                    { label: "Support Staff", count: staffCount, color: "#6366f1" }
                  ];
                  const r = 60, cx = 80, cy = 80;
                  let startAngle = -Math.PI / 2;
                  const paths = segments.map(seg => {
                    const angle = (seg.count / total) * 2 * Math.PI;
                    const x1 = cx + r * Math.cos(startAngle);
                    const y1 = cy + r * Math.sin(startAngle);
                    const x2 = cx + r * Math.cos(startAngle + angle);
                    const y2 = cy + r * Math.sin(startAngle + angle);
                    const largeArc = angle > Math.PI ? 1 : 0;
                    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                    const result = { ...seg, d };
                    startAngle += angle;
                    return result;
                  });
                  return (
                    <div className="flex items-center gap-6">
                      <svg viewBox="0 0 160 160" className="w-36 h-36 shrink-0">
                        {paths.map((p, i) => (
                          <path key={i} d={p.d} fill={p.color} opacity="0.9" />
                        ))}
                        <circle cx={cx} cy={cy} r={r * 0.55} fill="white" />
                        <text x={cx} y={cy - 6} textAnchor="middle" className="text-[10px] fill-slate-500 font-bold">{total}</text>
                        <text x={cx} y={cy + 8} textAnchor="middle" className="text-[8px] fill-slate-400">Total Staff</text>
                      </svg>
                      <div className="space-y-2 text-xs">
                        {paths.map((p, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                            <span className="text-slate-600 font-semibold">{p.label}: <span className="text-[#0b1c30] font-black">{p.count}</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* SVG Bar Chart - Weekly Appointment Trend */}
              <div className="bg-white border border-[#bec8d2]/30 rounded-xl p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="font-extrabold text-sm text-[#0b1c30]">Weekly Booking Trend</h3>
                  <p className="text-[11px] text-[#3e4850]">Appointments booked at this facility over the last 7 days.</p>
                </div>
                {weeklyAppts.length > 0 ? (
                  <div className="w-full overflow-x-auto">
                    <svg className="w-full min-w-[260px]" viewBox="0 0 300 150" height="150">
                      {(() => {
                        const maxVal = Math.max(...weeklyAppts.map(d => d.count), 1);
                        return weeklyAppts.map((d, i) => {
                          const barH = (d.count / maxVal) * 90;
                          const x = 20 + i * 40;
                          const y = 100 - barH;
                          return (
                            <g key={i}>
                              <rect x={x} y={y} width="28" height={barH} rx="4" fill="#0ea5e9" opacity="0.85" />
                              <text x={x + 14} y={y - 4} textAnchor="middle" className="text-[8px] fill-[#006591] font-black">
                                {d.count > 0 ? d.count : ""}
                              </text>
                              <text x={x + 14} y="115" textAnchor="middle" className="text-[7px] fill-slate-400 font-semibold">
                                {d.day.split(' ')[1]}
                              </text>
                              <text x={x + 14} y="124" textAnchor="middle" className="text-[7px] fill-slate-400">
                                {d.day.split(' ')[0]}
                              </text>
                            </g>
                          );
                        });
                      })()}
                      <line x1="15" y1="100" x2="285" y2="100" stroke="#e2e8f0" strokeWidth="1" />
                    </svg>
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-xs text-slate-400">Loading trend data...</div>
                )}
              </div>
            </div>

            {/* Pending vs Completed Lab Ratio */}
            <div className="bg-white border border-[#bec8d2]/30 rounded-xl p-6 shadow-xs space-y-4">
              <div>
                <h3 className="font-extrabold text-sm text-[#0b1c30]">Lab Request Completion Ratio</h3>
                <p className="text-[11px] text-[#3e4850]">Breakdown of pending vs completed pathology lab requests at this facility.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                  <span className="text-xs text-amber-700 font-bold block mb-1">PENDING / IN-PROGRESS</span>
                  <div className="text-3xl font-black text-amber-600">{labPendingCount}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                  <span className="text-xs text-emerald-700 font-bold block mb-1">COMPLETED</span>
                  <div className="text-3xl font-black text-emerald-600">{labCompletedCount}</div>
                </div>
              </div>

              {/* Ratio Bar */}
              {labRequestsCount > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                    <span>Completion Rate</span>
                    <span>{Math.round((labCompletedCount / labRequestsCount) * 100)}%</span>
                  </div>
                  <div className="w-full h-3 bg-amber-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${(labCompletedCount / labRequestsCount) * 100}%` }}
                    />
                  </div>
                </div>
              )}
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
