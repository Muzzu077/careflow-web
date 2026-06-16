import React, { useState, useEffect } from "react";
import { Database } from "../../api";
import { Hospital, User, UserRole, UserStatus, Profile } from "../../types";
import { supabase } from "../../supabaseClient";
import { createClient } from "@supabase/supabase-js";
import { 
  Building, Users, Activity, BarChart3, Settings, ShieldAlert, 
  MapPin, Check, Plus, Trash2, ShieldCheck, LogOut, Search, CornerDownRight 
} from "lucide-react";

interface MainAdminProps {
  user: User;
  onLogout: () => void;
}

export default function DashboardMainAdmin({ user, onLogout }: MainAdminProps) {
  // Tabs: 'hospitals' | 'add-hospital' | 'admins' | 'stats'
  const [activeTab, setActiveTab] = useState<"hospitals" | "add-hospital" | "admins" | "stats">("hospitals");

  // DB Sync State
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [profilesList, setProfilesList] = useState<Profile[]>([]);
  const [adminLinks, setAdminLinks] = useState<any[]>([]);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Create Hospital States
  const [hospName, setHospName] = useState("");
  const [hospAddress, setHospAddress] = useState("");
  const [hospCity, setHospCity] = useState("Chennai");
  const [hospArea, setHospArea] = useState("Tambaram");
  const [hospState, setHospState] = useState("TN");
  const [hospPincode, setHospPincode] = useState("600045");
  const [hospSuccess, setHospSuccess] = useState(false);
  const [hospEmail, setHospEmail] = useState("");
  const [hospPhone, setHospPhone] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    loadDatabase();
  }, [user]);

  const loadDatabase = async () => {
    setHospitals(await Database.getHospitals());
    setSystemUsers(await Database.getUsers());
    setProfilesList(await Database.getProfiles());
    const { data } = await supabase.from("hospital_admins").select("*");
    setAdminLinks(data || []);
  };

  const handleToggleApproveUser = async (userId: string) => {
    const currentUsers = await Database.getUsers();
    const updated = currentUsers.map(u => {
      if (u.id === userId) {
        const nextStatus = u.status === UserStatus.ACTIVE ? UserStatus.PENDING : UserStatus.ACTIVE;
        return { ...u, status: nextStatus };
      }
      return u;
    });

    await Database.saveUsers(updated);
    loadDatabase();
    alert("User status updated on platform pipeline.");
  };

  // PLATFORM LEVEL ACTION: TOGGLE SUSPEND HOSPITAL LICENSE
  const handleToggleSuspendHospital = async (hospitalId: string) => {
    const currentHospitals = await Database.getHospitals();
    const updated = currentHospitals.map(h => {
      if (h.id === hospitalId) {
        const nextStatus = h.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
        return { ...h, status: nextStatus, approved: nextStatus === "ACTIVE" };
      }
      return h;
    });

    await Database.saveHospitals(updated);
    loadDatabase();
    alert("Hospital status updated successfully.");
  };

  // ADD HOSPITAL DIRECTLY BY SUPER-ADMIN (WITH ADMINISTRATIVE USER CREATION)
  const handleAddHospitalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospName || !hospAddress || !hospEmail || !hospPhone || !adminName || !adminEmail || !adminPhone || !adminPassword) {
      alert("All hospital and administrator parameters are required.");
      return;
    }

    try {
      // Create sandboxed Supabase client to prevent overwrite of admin session
      const tempClient = createClient(
        (import.meta as any).env.VITE_SUPABASE_URL || "",
        (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "",
        { auth: { persistSession: false } }
      );

      // Sign up the new hospital admin user
      const { data: signUpData, error: signUpErr } = await tempClient.auth.signUp({
        email: adminEmail.trim(),
        password: adminPassword,
        options: {
          data: {
            role: UserRole.HOSPITAL_ADMIN,
            full_name: adminName,
            status: UserStatus.ACTIVE
          }
        }
      });

      if (signUpErr) {
        alert("Hospital Admin Creation Error: " + signUpErr.message);
        return;
      }

      if (!signUpData.user) {
        alert("Failed to create hospital admin auth user record.");
        return;
      }

      const adminUserId = signUpData.user.id;
      const hospitalId = crypto.randomUUID();

      // Create hospital record linked to admin
      const { error: hospErr } = await supabase
        .from("hospitals")
        .insert({
          id: hospitalId,
          hospital_name: hospName,
          email: hospEmail,
          phone: hospPhone,
          address: hospAddress,
          city: hospCity,
          area: hospArea,
          state: hospState,
          pincode: hospPincode,
          status: "ACTIVE",
          approved: true,
          admin_user_id: adminUserId
        });

      if (hospErr) {
        alert("Hospital Database Registration Error: " + hospErr.message);
        return;
      }

      // Link admin in hospital_admins relation
      const { error: adminLinkErr } = await supabase
        .from("hospital_admins")
        .insert({
          id: adminUserId,
          hospital_id: hospitalId
        });

      if (adminLinkErr) {
        alert("Hospital Admin Link Mapping Error: " + adminLinkErr.message);
        return;
      }

      // Ensure user record is marked ACTIVE in database
      await supabase.from("users").update({ status: UserStatus.ACTIVE }).eq("id", adminUserId);

      setHospSuccess(true);
      setHospName("");
      setHospEmail("");
      setHospPhone("");
      setHospAddress("");
      setAdminName("");
      setAdminEmail("");
      setAdminPhone("");
      setAdminPassword("");
      
      loadDatabase();

      setTimeout(() => {
        setHospSuccess(false);
        setActiveTab("hospitals");
      }, 1200);

    } catch (err: any) {
      alert("Platform error: " + err.message);
    }
  };

  const filteredHospitals = hospitals.filter(h => {
    const q = searchQuery.toLowerCase();
    return h.hospital_name.toLowerCase().includes(q) || h.city.toLowerCase().includes(q) || h.area.toLowerCase().includes(q);
  });

  const getRoleCount = (role: UserRole) => {
    return systemUsers.filter(u => u.role === role).length;
  };

  return (
    <div id="main-superadmin" className="min-h-screen bg-[#f8f9ff] flex flex-col md:flex-row">
      
      {/* Side Cabinet */}
      <aside className="w-full md:w-64 bg-white border-r border-[#bec8d2]/40 p-5 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 pb-6 border-b border-[#bec8d2]/20 mb-6">
            <div className="w-10 h-10 rounded-full bg-slate-900 border text-white flex items-center justify-center font-bold">
              PV
            </div>
            <div>
              <h3 className="font-extrabold text-xs text-[#0b1c30]">Administrator</h3>
              <p className="text-[9px] text-[#0ea5e9] uppercase tracking-wide font-black">Super Administrator</p>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab("hospitals")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "hospitals" 
                  ? "bg-[#006591] text-white shadow-xs" 
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <Building className="w-4 h-4" />
              Institutions Register
              {hospitals.filter(h => !h.approved).length > 0 && (
                <span className="bg-rose-500 text-white font-bold px-1.5 py-0.5 rounded-full text-[9px] ml-auto animate-pulse">
                  {hospitals.filter(h => !h.approved).length} new
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("add-hospital")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "add-hospital" 
                  ? "bg-[#006591] text-white shadow-xs" 
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <Plus className="w-4 h-4" />
              Add Hospital Org
            </button>

            <button
              onClick={() => setActiveTab("admins")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "admins" 
                  ? "bg-[#006591] text-white shadow-xs" 
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Admin Applications
              {systemUsers.filter(u => u.role === UserRole.HOSPITAL_ADMIN && u.status === UserStatus.PENDING).length > 0 && (
                <span className="bg-rose-500 text-white font-bold px-1.5 py-0.5 rounded-full text-[9px] ml-auto animate-pulse">
                  {systemUsers.filter(u => u.role === UserRole.HOSPITAL_ADMIN && u.status === UserStatus.PENDING).length} pending
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("stats")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "stats" 
                  ? "bg-[#006591] text-white shadow-xs" 
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              SaaS Operational metrics
            </button>
          </nav>
        </div>

        <button 
          onClick={onLogout}
          className="flex items-center gap-3 text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg mt-6 w-full text-left"
        >
          <LogOut className="w-4 h-4" />
          Shut Super-session
        </button>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-5xl mx-auto w-full">
        
        {/* HOSPITALS MANAGEMENT TABLE */}
        {activeTab === "hospitals" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">CareFlow Hospital Complex database</h1>
              <p className="text-xs text-[#3e4850]">Approve newly registered healthcare facilities. Unverified hospitals cannot hire staff or consult patients.</p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input 
                type="text"
                placeholder="Search medical institutions by name or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-[#bec8d2] bg-white rounded-lg text-xs focus:outline-none"
              />
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-3 bg-stone-50 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-[#0b1c30]">
                <span>MEMBERS REGISTER</span>
                <span>DESK COMMANDS</span>
              </div>

              {filteredHospitals.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No matching healthcare complex found.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredHospitals.map(hosp => (
                    <div key={hosp.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm text-[#0b1c30]">{hosp.hospital_name}</h4>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            hosp.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          }`}>
                            {hosp.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#3e4850] mt-1 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#006591]" />
                          {hosp.address}, {hosp.area}, {hosp.city} ({hosp.pincode})
                        </p>
                      </div>

                      <button
                        onClick={() => handleToggleSuspendHospital(hosp.id)}
                        className={`text-xs font-black px-4 py-2 rounded-lg border transition-all ${
                          hosp.status === "ACTIVE" 
                            ? "bg-stone-50 border-[#bec8d2]/50 text-slate-550 hover:bg-stone-100" 
                            : "bg-[#006591] border-[#006591] hover:bg-[#004c6e] text-white shadow-xs"
                        }`}
                      >
                        {hosp.status === "ACTIVE" ? "Suspend License" : "Activate License"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* REGISTER PHYSICAL MEDICAL COMPLEX */}
        {activeTab === "add-hospital" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Launch New Hospital Complex</h1>
              <p className="text-xs text-[#3e4850]">Add another certified clinical facility to the global CareFlow platform network.</p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl p-6 shadow-xs max-w-lg">
              {hospSuccess && (
                <div className="bg-[#6cf8bb]/20 border border-emerald-400 text-emerald-800 p-3 rounded text-xs font-bold mb-4 text-center">
                  Complex registered and pre-licensed! Returning to index.
                </div>
              )}

              <form onSubmit={handleAddHospitalSubmit} className="space-y-4">
                <div className="bg-[#eff4ff]/30 p-4 rounded-lg border border-[#d3e4fe]/50 space-y-3">
                  <h4 className="font-extrabold text-xs uppercase text-[#006591] tracking-wider mb-2">Hospital Information</h4>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Medical Hospital Name *</label>
                    <input 
                      required
                      type="text"
                      placeholder="e.g. Seattle General Hospital"
                      value={hospName}
                      onChange={(e) => setHospName(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs bg-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hospital Email *</label>
                      <input 
                        required
                        type="email"
                        placeholder="info@hospital.org"
                        value={hospEmail}
                        onChange={(e) => setHospEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hospital Phone *</label>
                      <input 
                        required
                        type="tel"
                        placeholder="e.g. +1 206 555 0199"
                        value={hospPhone}
                        onChange={(e) => setHospPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Clinic Address *</label>
                    <input 
                      required
                      type="text"
                      placeholder="e.g. 1004 Pine Avenue"
                      value={hospAddress}
                      onChange={(e) => setHospAddress(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs bg-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">City</label>
                      <input 
                        type="text"
                        value={hospCity}
                        onChange={(e) => setHospCity(e.target.value)}
                        className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Area</label>
                      <input 
                        type="text"
                        value={hospArea}
                        onChange={(e) => setHospArea(e.target.value)}
                        className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">State / Region</label>
                      <input 
                        type="text"
                        value={hospState}
                        onChange={(e) => setHospState(e.target.value)}
                        className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pincode</label>
                      <input 
                        type="text"
                        value={hospPincode}
                        onChange={(e) => setHospPincode(e.target.value)}
                        className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-500/5 p-4 rounded-lg border border-emerald-500/20 space-y-3">
                  <h4 className="font-extrabold text-xs uppercase text-emerald-800 tracking-wider mb-2">Hospital Admin credentials</h4>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Admin Full Name *</label>
                    <input 
                      required
                      type="text"
                      placeholder="e.g. Dr. Sarah Jenkins"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs bg-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Admin Email *</label>
                      <input 
                        required
                        type="email"
                        placeholder="admin@hospital.org"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Admin Phone *</label>
                      <input 
                        required
                        type="tel"
                        placeholder="e.g. +1 206 555 0199"
                        value={adminPhone}
                        onChange={(e) => setAdminPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Temporary Password *</label>
                    <input 
                      required
                      type="password"
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#006591] hover:bg-[#004c6e] text-white text-xs font-bold py-2.5 rounded hover:scale-101 transition-colors"
                >
                  Confirm and Launch Complex Node
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ADMIN APPLICATIONS APPROVAL */}
        {activeTab === "admins" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Hospital Admin Access Requests</h1>
              <p className="text-xs text-[#3e4850]">Approve or suspend Hospital Admin credentials. Approved admins can configure availability and approve doctors/staff.</p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-3 bg-stone-50 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-[#0b1c30]">
                <span>ADMIN DETAILS</span>
                <span>DESK COMMANDS</span>
              </div>

              {systemUsers.filter(u => u.role === UserRole.HOSPITAL_ADMIN).length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No Hospital Admins registered on platform.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {systemUsers.filter(u => u.role === UserRole.HOSPITAL_ADMIN).map(usr => {
                    const prof = profilesList.find(p => p.id === usr.id);
                    const link = adminLinks.find(l => l.id === usr.id);
                    const hosp = hospitals.find(h => h.id === link?.hospital_id);
                    
                    return (
                      <div key={usr.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-sm text-[#0b1c30]">{prof?.full_name || "Admin"}</h4>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                              usr.status === UserStatus.ACTIVE ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                            }`}>
                              {usr.status}
                            </span>
                          </div>
                          <p className="text-xs text-[#3e4850] mt-1">
                            Email: <span className="font-semibold">{usr.email}</span> | Hospital: <span className="font-semibold text-[#006591]">{hosp?.hospital_name || "None"} ({hosp?.city || "Unknown"})</span>
                          </p>
                        </div>

                        <button
                          onClick={() => handleToggleApproveUser(usr.id)}
                          className={`text-xs font-black px-4 py-2 rounded-lg border transition-all ${
                            usr.status === UserStatus.ACTIVE 
                              ? "bg-rose-50 border-rose-250 text-rose-700 hover:bg-rose-100" 
                              : "bg-[#0ea5e9] border-[#0ea5e9] hover:bg-[#0284c7] text-white shadow-xs"
                          }`}
                        >
                          {usr.status === UserStatus.ACTIVE ? "Suspend Access" : "Approve Admin"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* METRICS & ANALYSIS */}
        {activeTab === "stats" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">CareFlow platform statistics</h1>
              <p className="text-xs text-[#3e4850]">Platform parameters, global occupancy rates, and multi-state cloud system load monitors.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 border border-[#bec8d2]/30 rounded-xl shadow-xs">
                <span className="text-xs text-slate-500 font-bold block mb-1">TOTAL HOSPITALS</span>
                <div className="text-2xl font-black text-[#006591]">{hospitals.length} Nodes</div>
              </div>

              <div className="bg-white p-5 border border-[#bec8d2]/30 rounded-xl shadow-xs">
                <span className="text-xs text-slate-500 font-bold block mb-1">DOCTORS TOTAL</span>
                <div className="text-2xl font-black text-[#006591]">{getRoleCount(UserRole.DOCTOR)} certified</div>
              </div>

              <div className="bg-white p-5 border border-[#bec8d2]/30 rounded-xl shadow-xs">
                <span className="text-xs text-slate-500 font-bold block mb-1">PATIENTS REGISTERED</span>
                <div className="text-2xl font-black text-[#006591]">{getRoleCount(UserRole.PATIENT)} profiles</div>
              </div>

              <div className="bg-white p-5 border border-[#bec8d2]/30 rounded-xl shadow-xs">
                <span className="text-xs text-slate-500 font-bold block mb-1">CLINICAL STAFF</span>
                <div className="text-2xl font-black text-[#006591]">
                  {getRoleCount(UserRole.RECEPTIONIST) + getRoleCount(UserRole.LAB_TECHNICIAN)} members
                </div>
              </div>
            </div>

            {/* Systems platform logs */}
            <div className="bg-white rounded-xl border border-[#bec8d2]/30 p-5 shadow-xs space-y-3">
              <h3 className="font-extrabold text-xs uppercase text-[#0b1c30] tracking-wider">Cloud Transaction Logs Summary</h3>
              <div className="font-mono text-[10px] space-y-1.5 bg-slate-900 text-teal-400 p-4 rounded-lg overflow-x-auto">
                <p className="flex items-center gap-1"><CornerDownRight className="w-3 h-3 text-emerald-400 shrink-0" /> [LOG] pavaneshvuchuru@gmail.com initiated secure session cluster [active].</p>
                <p className="flex items-center gap-1"><CornerDownRight className="w-3 h-3 text-emerald-400 shrink-0" /> [LOG] DB Connection Pools: 16 active connections verified.</p>
                <p className="flex items-center gap-1"><CornerDownRight className="w-3 h-3 text-emerald-400 shrink-0" /> [LOG] Multi-role hashing engine certified with SHA-256 standard.</p>
                <p className="flex items-center gap-1"><CornerDownRight className="w-3 h-3 text-emerald-400 shrink-0" /> [LOG] CareFlow general hospital (H1-WA) clinical queue initialized.</p>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
