import React, { useState, useEffect } from "react";
import { Database } from "../../api";
import { User, Appointment, Profile, UserRole, UserStatus, AppointmentStatus } from "../../types";
import { supabase } from "../../supabaseClient";
import { 
  Heart, Calendar, Search, Users, Activity, 
  MapPin, CheckCircle2, UserCheck, SearchCode, Clock, 
  AlertCircle, Plus, LogOut 
} from "lucide-react";

interface ReceptionistProps {
  user: User;
  onLogout: () => void;
}

export default function DashboardReceptionist({ user, onLogout }: ReceptionistProps) {
  // Tabs: 'appointments' | 'checkin' | 'search' | 'add-patient'
  const [activeTab, setActiveTab] = useState<"appointments" | "checkin" | "search" | "add-patient">("appointments");

  // DB Sync state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Quick Registration Form State
  const [patName, setPatName] = useState("");
  const [patEmail, setPatEmail] = useState("");
  const [patPhone, setPatPhone] = useState("");
  const [patDob, setPatDob] = useState("");
  const [patSuccess, setPatSuccess] = useState(false);

  useEffect(() => {
    loadDatabase();
  }, [user]);

  // Real-time messages listener (Unique channel name per user to prevent collision)
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-messages-receptionist-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          loadDatabase();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadDatabase = async () => {
    const allAppts = await Database.getAppointments();
    const allProfs = await Database.getProfiles();
    const allUsers = await Database.getUsers();
    
    setAppointments(allAppts);
    setProfiles(allProfs);
    setUsersList(allUsers);
  };

  // Turn patient status to CHECKED_IN
  const handleMarkCheckedIn = async (appointmentId: string) => {
    try {
      const allAppts = await Database.getAppointments();
      const matched = allAppts.find(a => a.id === appointmentId);
      if (!matched) return;

      const updated = allAppts.map(a => {
        if (a.id === appointmentId) {
          return { ...a, status: AppointmentStatus.CHECKED_IN };
        }
        return a;
      });

      await Database.saveAppointments(updated);

      // Log status transition to audit trail
      await Database.logAppointmentStatusChange(appointmentId, matched.status, AppointmentStatus.CHECKED_IN, user.id);

      // Send notification to patient with type APPOINTMENT
      await Database.addNotification(
        matched.patient_id, 
        "Checked In", 
        "Reception checked you in. Please proceed to the Doctor's waiting lobby.",
        "APPOINTMENT"
      );

      loadDatabase();
      alert("Patient marked as CHECKED_IN. Pushed to Attending Doctor.");
    } catch (err: any) {
      alert("Error checking in patient: " + err.message);
    }
  };

  // Cancel / No Show appointment action
  const handleCancelAppointment = async (appointmentId: string) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      const allAppts = await Database.getAppointments();
      const matched = allAppts.find(a => a.id === appointmentId);
      if (!matched) return;

      const updated = allAppts.map(a => {
        if (a.id === appointmentId) {
          return { ...a, status: AppointmentStatus.CANCELLED };
        }
        return a;
      });

      await Database.saveAppointments(updated);

      // Log status transition to audit trail
      await Database.logAppointmentStatusChange(appointmentId, matched.status, AppointmentStatus.CANCELLED, user.id);

      // Send notification to patient with type APPOINTMENT
      await Database.addNotification(
        matched.patient_id, 
        "Appointment Cancelled", 
        "Your appointment has been cancelled by the reception desk.",
        "APPOINTMENT"
      );

      loadDatabase();
      alert("Appointment has been marked as CANCELLED.");
    } catch (err: any) {
      alert("Error cancelling appointment: " + err.message);
    }
  };

  const handleQuickRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patEmail || !patName) {
      alert("Please fill in Email and Name.");
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: patEmail.trim(),
        password: patPhone || "SecurePass" + Math.floor(Math.random()*10000), // default to phone or generated pass
        options: {
          data: {
            role: "PATIENT",
            full_name: patName,
            gender: "Male",
            dob: patDob || "1994-01-01",
            address: "Quick Walkin Register"
          }
        }
      });

      if (error) {
        alert(error.message);
        return;
      }

      setPatSuccess(true);
      setPatName("");
      setPatEmail("");
      setPatPhone("");
      setPatDob("");
      loadDatabase();

      setTimeout(() => {
        setPatSuccess(false);
        setActiveTab("appointments");
      }, 1200);
    } catch (err: any) {
      alert("Registration error: " + err.message);
    }
  };

  // Searching Patient Logic
  const filteredProfiles = profiles.filter(p => {
    const q = searchQuery.toLowerCase();
    return p.full_name.toLowerCase().includes(q) || 
           (p.address && p.address.toLowerCase().includes(q)) || 
           p.id.includes(q);
  });

  const getPatientPhone = (patId: string) => {
    const foundUsr = usersList.find(u => u.id === patId);
    return foundUsr ? foundUsr.phone || "Walk-in" : "Walk-in";
  };

  return (
    <div id="receptionist-portal" className="min-h-screen bg-[#f8f9ff] flex flex-col md:flex-row">
      
      {/* Side Cabinet */}
      <aside className="w-full md:w-64 bg-white border-r border-[#bec8d2]/40 p-5 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 pb-6 border-b border-[#bec8d2]/20 mb-6">
            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
              CF
            </div>
            <div>
              <h3 className="font-extrabold text-xs text-[#0b1c30]">Desk Officer</h3>
              <p className="text-[9px] text-[#0ea5e9] uppercase tracking-wide font-black">Reception Administration</p>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab("appointments")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "appointments" 
                  ? "bg-[#006591] text-white shadow-xs" 
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <Calendar className="w-4 h-4" />
              On-Duty Bookings
            </button>

            <button
              onClick={() => setActiveTab("checkin")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "checkin" 
                  ? "bg-[#006591] text-white shadow-xs" 
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <UserCheck className="w-4 h-4" />
              Check-In Queue
            </button>

            <button
              onClick={() => setActiveTab("search")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "search" 
                  ? "bg-[#006591] text-white shadow-xs" 
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <Search className="w-4 h-4" />
              Patient Registry
            </button>

            <button
              onClick={() => setActiveTab("add-patient")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "add-patient" 
                  ? "bg-[#006591] text-white shadow-xs" 
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <Plus className="w-4 h-4" />
              Register Patient
            </button>
          </nav>
        </div>

        <button 
          onClick={onLogout}
          className="flex items-center gap-3 text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg mt-6 w-full text-left"
        >
          <LogOut className="w-4 h-4" />
          Disconnect Panel
        </button>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-5xl mx-auto w-full">
        
        {/* APPOINTMENTS TAB */}
        {activeTab === "appointments" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">On-Duty Clinic Consultations</h1>
              <p className="text-xs text-[#3e4850]">View newly booked records. Complete patient check-ins upon physical arrival.</p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-3 bg-stone-50 border-b border-sidebar-100 flex items-center justify-between text-xs font-bold text-[#0b1c30]">
                <span>PATIENT BOOKING RECORD</span>
                <span>DESK ACTION</span>
              </div>

              {appointments.length === 0 ? (
                <div className="p-8 text-center text-slate-450 text-xs">No active bookings registered in system today.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {appointments.map(apt => (
                    <div key={apt.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#0b1c30]">{apt.patient_name}</span>
                          <span className="text-[10px] bg-sky-100 text-[#006591] font-bold px-2 py-0.5 rounded-full">
                            Token #{apt.token}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#3e4850] mt-0.5">Assigned to: <strong>{apt.doctor_name}</strong> ({apt.doctor_specialization})</p>
                        <p className="text-[10px] text-slate-400 mt-1">Time Slot: {apt.time} · Facility: {apt.hospital_name}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {apt.status === AppointmentStatus.BOOKED ? (
                          <>
                            <button
                              onClick={() => handleCancelAppointment(apt.id)}
                              className="px-3 py-1.5 border border-rose-200 text-rose-650 rounded-lg text-xs font-bold hover:bg-rose-50 flex items-center gap-1.5"
                            >
                              No Show / Cancel
                            </button>
                            <button
                              onClick={() => handleMarkCheckedIn(apt.id)}
                              className="bg-[#006591] hover:bg-[#004c6e] text-white text-xs font-bold px-4 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                            >
                              <UserCheck className="w-4 h-4" /> Check-In Patient
                            </button>
                          </>
                        ) : (
                          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                            apt.status === AppointmentStatus.COMPLETED ? "bg-emerald-100 text-emerald-800" :
                            apt.status === AppointmentStatus.CANCELLED ? "bg-rose-100 text-rose-800" :
                            "bg-amber-100 text-amber-850"
                          }`}>
                            {apt.status}
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
              <p className="text-xs text-[#3e4850]">List of patients completed check-in who have been routed to their corresponding Doctors' lobby rooms.</p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-3 bg-stone-50 border-b border-slate-100 text-xs font-bold text-[#0b1c30]">
                ACTIVE LOBBY QUEUE
              </div>

              {appointments.filter(a => a.status === AppointmentStatus.CHECKED_IN).length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">Queue empty. All arrived patients have been called in.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {appointments.filter(a => a.status === AppointmentStatus.CHECKED_IN).map(apt => (
                    <div key={apt.id} className="p-4 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-xs text-slate-800">{apt.patient_name}</span>
                        <p className="text-[10px] text-slate-500">Routing doctor: {apt.doctor_name} Waiting lobby</p>
                      </div>
                      <span className="bg-amber-100 text-amber-800 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
                        LOBBY WAITING
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PATIENT REGISTRY & SEARCH */}
        {activeTab === "search" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Patient Registration Records</h1>
              <p className="text-xs text-[#3e4850]">Browse or filter verified CareFlow members.</p>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input 
                  type="text"
                  placeholder="Filter patients database by name, ID or address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-[#bec8d2] bg-white rounded-lg text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs">
              {filteredProfiles.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No matching patient profiles found in system.</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-50 border-b border-slate-100 text-slate-500 font-bold">
                      <th className="p-3">FULL NAME</th>
                      <th className="p-3">PHONE</th>
                      <th className="p-3">DATE OF BIRTH</th>
                      <th className="p-3">STREET ADDRESS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProfiles.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-800">{p.full_name}</td>
                        <td className="p-3 font-mono">{getPatientPhone(p.id)}</td>
                        <td className="p-3">{p.dob || "Walk-in registration"}</td>
                        <td className="p-3 text-slate-500">{p.address || "Walk-in register site"}</td>
                      </tr>
                    ))}
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
              <p className="text-xs text-[#3e4850]">Use this desk utility to immediately register a walk-in patient with their phone or email.</p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl p-6 shadow-xs max-w-lg">
              {patSuccess && (
                <div className="bg-[#6cf8bb]/20 border border-emerald-400 text-emerald-800 p-3 rounded text-xs font-bold mb-4 text-center">
                  Patient registration success! Returning to on-duty rosters.
                </div>
              )}

              <form onSubmit={handleQuickRegisterPatient} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Name</label>
                    <input 
                      required
                      type="text"
                      placeholder="e.g. Michael Scott"
                      value={patName}
                      onChange={(e) => setPatName(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Address</label>
                    <input 
                      required
                      type="email"
                      placeholder="michael@dundermifflin.com"
                      value={patEmail}
                      onChange={(e) => setPatEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                    <input 
                      type="text"
                      placeholder="+1 (206) ..."
                      value={patPhone}
                      onChange={(e) => setPatPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date of Birth</label>
                    <input 
                      type="date"
                      value={patDob}
                      onChange={(e) => setPatDob(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#006591] hover:bg-[#004c6e] text-white text-xs font-bold py-2.5 rounded transition-colors"
                >
                  Register and Create Record
                </button>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
