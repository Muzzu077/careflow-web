import React, { useState, useEffect } from "react";
import { Database } from "../../api";
import { User, Appointment, Profile, UserRole, UserStatus, AppointmentStatus, ReceptionistExt } from "../../types";
import { supabase } from "../../supabaseClient";
import { 
  Heart, Calendar, Search, Users, Activity, 
  MapPin, CheckCircle2, UserCheck, SearchCode, Clock, 
  AlertCircle, Plus, LogOut, TrendingUp, ChevronRight
} from "lucide-react";

interface ReceptionistProps {
  user: User;
  onLogout: () => void;
}

export default function DashboardReceptionist({ user, onLogout }: ReceptionistProps) {
  const [activeTab, setActiveTab] = useState<"appointments" | "checkin" | "search" | "add-patient">("appointments");

  // DB Sync state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [myHospitalName, setMyHospitalName] = useState("CareFlow Facility");

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "BOOKED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED">("ALL");

  // Quick Registration Form State
  const [patName, setPatName] = useState("");
  const [patEmail, setPatEmail] = useState("");
  const [patPhone, setPatPhone] = useState("");
  const [patDob, setPatDob] = useState("");
  const [patSuccess, setPatSuccess] = useState(false);

  useEffect(() => {
    loadDatabase();
  }, [user]);

  useEffect(() => {
    const channel = supabase
      .channel(`realtime-receptionist-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => { loadDatabase(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadDatabase = async () => {
    const allAppts = await Database.getAppointments();
    const allProfs = await Database.getProfiles();
    const allUsers = await Database.getUsers();
    const foundProfile = allProfs.find(p => p.id === user.id) || null;
    setMyProfile(foundProfile);

    // Find receptionist's hospital
    const allReceps = await Database.getReceptionists();
    const myRecepExt = allReceps.find(r => r.id === user.id);
    if (myRecepExt?.hospital_id) {
      const hospitals = await Database.getHospitals();
      const hosp = hospitals.find(h => h.id === myRecepExt.hospital_id);
      if (hosp) setMyHospitalName(hosp.hospital_name);
      // Filter appointments by my hospital
      setAppointments(allAppts.filter(a => a.hospital_id === myRecepExt.hospital_id));
    } else {
      setAppointments(allAppts);
    }

    setProfiles(allProfs);
    setUsersList(allUsers);
  };

  const handleMarkCheckedIn = async (appointmentId: string) => {
    try {
      const allAppts = await Database.getAppointments();
      const matched = allAppts.find(a => a.id === appointmentId);
      if (!matched) return;
      const updated = allAppts.map(a =>
        a.id === appointmentId ? { ...a, status: AppointmentStatus.CHECKED_IN } : a
      );
      await Database.saveAppointments(updated);
      await Database.logAppointmentStatusChange(appointmentId, matched.status, AppointmentStatus.CHECKED_IN, user.id);
      await Database.addNotification(
        matched.patient_id,
        "Checked In Successfully",
        `You have been checked in at ${myHospitalName}. Please proceed to the Doctor's waiting lobby.`,
        "APPOINTMENT"
      );
      loadDatabase();
    } catch (err: any) {
      alert("Error checking in patient: " + err.message);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      const allAppts = await Database.getAppointments();
      const matched = allAppts.find(a => a.id === appointmentId);
      if (!matched) return;
      const updated = allAppts.map(a =>
        a.id === appointmentId ? { ...a, status: AppointmentStatus.CANCELLED } : a
      );
      await Database.saveAppointments(updated);
      await Database.logAppointmentStatusChange(appointmentId, matched.status, AppointmentStatus.CANCELLED, user.id);
      await Database.addNotification(
        matched.patient_id,
        "Appointment Cancelled",
        "Your appointment has been cancelled by the reception desk. Please rebook if needed.",
        "APPOINTMENT"
      );
      loadDatabase();
    } catch (err: any) {
      alert("Error cancelling appointment: " + err.message);
    }
  };

  const handleQuickRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patEmail || !patName) { alert("Name and Email are required."); return; }
    try {
      const { error } = await supabase.auth.signUp({
        email: patEmail.trim(),
        password: patPhone || "CareFlow" + Math.floor(Math.random() * 10000),
        options: { data: { role: "PATIENT", full_name: patName, gender: "Male", dob: patDob || "1994-01-01", address: "Walk-In Registration" } }
      });
      if (error) { alert(error.message); return; }
      setPatSuccess(true);
      setPatName(""); setPatEmail(""); setPatPhone(""); setPatDob("");
      loadDatabase();
      setTimeout(() => { setPatSuccess(false); setActiveTab("appointments"); }, 1400);
    } catch (err: any) {
      alert("Registration error: " + err.message);
    }
  };

  // Derived stats
  const todayStr = new Date().toLocaleDateString();
  const bookedToday = appointments.filter(a => new Date(a.created_at || "").toLocaleDateString() === todayStr);
  const checkedInNow = appointments.filter(a => a.status === AppointmentStatus.CHECKED_IN);
  const completedToday = appointments.filter(a => a.status === AppointmentStatus.COMPLETED && new Date(a.created_at || "").toLocaleDateString() === todayStr);

  const filteredAppts = appointments.filter(a => {
    if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return a.patient_name.toLowerCase().includes(q) || a.doctor_name.toLowerCase().includes(q) || String(a.token).includes(q);
  });

  const filteredProfiles = profiles.filter(p => {
    const q = searchQuery.toLowerCase();
    return p.full_name.toLowerCase().includes(q) || (p.address && p.address.toLowerCase().includes(q)) || p.id.includes(q);
  });

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      BOOKED: "bg-sky-100 text-sky-800",
      CHECKED_IN: "bg-amber-100 text-amber-800",
      IN_CONSULTATION: "bg-violet-100 text-violet-800",
      COMPLETED: "bg-emerald-100 text-emerald-800",
      CANCELLED: "bg-rose-100 text-rose-800",
    };
    return map[status] || "bg-slate-100 text-slate-700";
  };

  return (
    <div id="receptionist-portal" className="min-h-screen bg-[#f8f9ff] flex flex-col md:flex-row">
      
      {/* Side Cabinet */}
      <aside className="w-full md:w-64 bg-white border-r border-[#bec8d2]/40 p-5 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 pb-6 border-b border-[#bec8d2]/20 mb-6">
            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
              {myProfile?.full_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2) || "RX"}
            </div>
            <div>
              <h3 className="font-extrabold text-xs text-[#0b1c30]">{myProfile?.full_name || "Desk Officer"}</h3>
              <p className="text-[9px] text-[#0ea5e9] uppercase tracking-wide font-black">Reception · {myHospitalName}</p>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-2 mb-5 text-center">
            <div className="bg-sky-50 rounded-lg p-2">
              <div className="text-lg font-black text-[#006591]">{appointments.filter(a => a.status === AppointmentStatus.BOOKED).length}</div>
              <div className="text-[8px] font-bold text-slate-400 uppercase">Pending</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-2">
              <div className="text-lg font-black text-amber-600">{checkedInNow.length}</div>
              <div className="text-[8px] font-bold text-slate-400 uppercase">In Lobby</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-2">
              <div className="text-lg font-black text-emerald-600">{completedToday.length}</div>
              <div className="text-[8px] font-bold text-slate-400 uppercase">Done</div>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { tab: "appointments", icon: <Calendar className="w-4 h-4" />, label: "All Bookings", badge: appointments.filter(a => a.status === AppointmentStatus.BOOKED).length },
              { tab: "checkin", icon: <UserCheck className="w-4 h-4" />, label: "Check-In Queue", badge: checkedInNow.length },
              { tab: "search", icon: <Search className="w-4 h-4" />, label: "Patient Registry", badge: 0 },
              { tab: "add-patient", icon: <Plus className="w-4 h-4" />, label: "Register Patient", badge: 0 },
            ].map(({ tab, icon, label, badge }) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab as typeof activeTab); setSearchQuery(""); setStatusFilter("ALL"); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                  activeTab === tab ? "bg-[#006591] text-white shadow-xs" : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
                }`}
              >
                {icon}
                {label}
                {badge > 0 && (
                  <span className={`ml-auto font-bold px-1.5 py-0.5 rounded-full text-[9px] ${activeTab === tab ? "bg-white/20 text-white" : "bg-rose-500 text-white"}`}>
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <button onClick={onLogout} className="flex items-center gap-3 text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg mt-6 w-full text-left">
          <LogOut className="w-4 h-4" /> Disconnect Panel
        </button>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-5xl mx-auto w-full">

        {/* APPOINTMENTS TAB */}
        {activeTab === "appointments" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">On-Duty Clinic Consultations</h1>
              <p className="text-xs text-[#3e4850]">View and manage all bookings for <strong>{myHospitalName}</strong>. Check-in patients upon physical arrival.</p>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by patient name, doctor, or token..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-[#bec8d2] bg-white rounded-lg text-xs focus:outline-none"
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                className="px-3 py-2 border border-[#bec8d2] bg-white rounded-lg text-xs focus:outline-none font-bold text-[#0b1c30]"
              >
                <option value="ALL">All Statuses</option>
                <option value="BOOKED">Booked</option>
                <option value="CHECKED_IN">Checked In</option>
                <option value="IN_CONSULTATION">In Consultation</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-3 bg-stone-50 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-[#0b1c30]">
                <span>PATIENT BOOKING RECORD ({filteredAppts.length})</span>
                <span>DESK ACTION</span>
              </div>

              {filteredAppts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No matching bookings found.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredAppts.map(apt => (
                    <div key={apt.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-stone-50/50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[#0b1c30]">{apt.patient_name}</span>
                          <span className="text-[10px] bg-sky-100 text-[#006591] font-bold px-2 py-0.5 rounded-full">
                            Token #{apt.token}
                          </span>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${getStatusBadge(apt.status)}`}>
                            {apt.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#3e4850] mt-0.5">Assigned to: <strong>{apt.doctor_name}</strong> ({apt.doctor_specialization})</p>
                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {apt.time} · {apt.date}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {apt.status === AppointmentStatus.BOOKED ? (
                          <>
                            <button
                              onClick={() => handleCancelAppointment(apt.id)}
                              className="px-3 py-1.5 border border-rose-200 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-50"
                            >
                              No Show
                            </button>
                            <button
                              onClick={() => handleMarkCheckedIn(apt.id)}
                              className="bg-[#006591] hover:bg-[#004c6e] text-white text-xs font-bold px-4 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm"
                            >
                              <UserCheck className="w-3.5 h-3.5" /> Check-In
                            </button>
                          </>
                        ) : (
                          <span className={`text-xs font-bold px-3 py-1 rounded-full ${getStatusBadge(apt.status)}`}>
                            {apt.status.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CHECK-IN QUEUE TAB */}
        {activeTab === "checkin" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Clinic Lobby Waiting Queue</h1>
              <p className="text-xs text-[#3e4850]">Patients who have been checked in are now waiting in the Doctor's lobby.</p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 text-xs font-bold text-amber-800 flex justify-between">
                <span>ACTIVE LOBBY QUEUE</span>
                <span>{checkedInNow.length} patient{checkedInNow.length !== 1 ? "s" : ""} waiting</span>
              </div>

              {checkedInNow.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">Queue empty. All arrived patients have been called in.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {checkedInNow.map((apt, idx) => (
                    <div key={apt.id} className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-black">
                          #{idx + 1}
                        </div>
                        <div>
                          <span className="font-bold text-sm text-slate-800">{apt.patient_name}</span>
                          <p className="text-[10px] text-slate-500">Token #{apt.token} · Dr. {apt.doctor_name}</p>
                          <p className="text-[10px] text-slate-400">{apt.time}</p>
                        </div>
                      </div>
                      <span className="bg-amber-100 text-amber-800 text-[10px] uppercase font-black px-3 py-1 rounded-full animate-pulse">
                        WAITING
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Completed appointments today */}
            {completedToday.length > 0 && (
              <div className="bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs">
                <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 text-xs font-bold text-emerald-800">
                  COMPLETED TODAY ({completedToday.length})
                </div>
                <div className="divide-y divide-slate-100">
                  {completedToday.map(apt => (
                    <div key={apt.id} className="p-4 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-xs text-slate-700">{apt.patient_name}</span>
                        <p className="text-[10px] text-slate-400">Token #{apt.token} · Dr. {apt.doctor_name}</p>
                      </div>
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full">✓ COMPLETED</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PATIENT REGISTRY & SEARCH */}
        {activeTab === "search" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Patient Registration Records</h1>
              <p className="text-xs text-[#3e4850]">Browse or filter all verified CareFlow members across facilities.</p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Filter patients by name, ID or address..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-[#bec8d2] bg-white rounded-lg text-xs focus:outline-none"
              />
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs">
              {filteredProfiles.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No matching patient profiles found.</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-50 border-b border-slate-100 text-slate-500 font-bold">
                      <th className="p-3">FULL NAME</th>
                      <th className="p-3">PHONE</th>
                      <th className="p-3">DATE OF BIRTH</th>
                      <th className="p-3">ADDRESS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProfiles.map(p => {
                      const usr = usersList.find(u => u.id === p.id);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-bold text-slate-800">{p.full_name}</td>
                          <td className="p-3 font-mono text-slate-600">{usr?.phone || "—"}</td>
                          <td className="p-3 text-slate-500">{p.dob || "Not recorded"}</td>
                          <td className="p-3 text-slate-400">{p.address || "Walk-in"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* REGISTER WALK-IN PATIENT */}
        {activeTab === "add-patient" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Register Walk-In Patient</h1>
              <p className="text-xs text-[#3e4850]">Immediately register a walk-in patient. They will receive login credentials via email.</p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl p-6 shadow-xs max-w-lg">
              {patSuccess && (
                <div className="bg-emerald-50 border border-emerald-400 text-emerald-800 p-3 rounded text-xs font-bold mb-4 text-center">
                  ✓ Patient registration successful! Returning to on-duty rosters.
                </div>
              )}

              <form onSubmit={handleQuickRegisterPatient} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Name *</label>
                    <input required type="text" placeholder="e.g. Rajesh Kumar" value={patName} onChange={e => setPatName(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Address *</label>
                    <input required type="email" placeholder="patient@example.com" value={patEmail} onChange={e => setPatEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                    <input type="text" placeholder="+91 9XXXXXXXXX" value={patPhone} onChange={e => setPatPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date of Birth</label>
                    <input type="date" value={patDob} onChange={e => setPatDob(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]" />
                  </div>
                </div>
                <button type="submit"
                  className="w-full bg-[#006591] hover:bg-[#004c6e] text-white text-xs font-bold py-2.5 rounded transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Register and Create Account
                </button>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
