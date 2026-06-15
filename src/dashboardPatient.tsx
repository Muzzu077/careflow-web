import React, { useState, useEffect } from "react";
import { MockDB } from "./mockData";
import { User, Appointment, Prescription, PrescriptionItem, LabRequest, LabReport, Notification, Chat, Message, MedicineReminder, AppointmentStatus, LabRequestStatus, UserRole, Hospital, DoctorExt, Profile } from "./types";
import { 
  Heart, Calendar, FileText, ClipboardList, Bell, MessageSquare, 
  History, User as UserIcon, LogOut, CheckCircle, Clock, MapPin, 
  AlertCircle, Sparkles, Send, Eye, Download, Search, CheckSquare, Plus, Activity
} from "lucide-react";

interface PatientProps {
  user: User;
  onLogout: () => void;
}

export default function DashboardPatient({ user, onLogout }: PatientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "book" | "appointments" | "prescriptions" | "labs" | "chat" | "reminders" | "profile">("overview");

  // DB Sync States
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([]);
  const [labRequests, setLabRequests] = useState<LabRequest[]>([]);
  const [labReports, setLabReports] = useState<LabReport[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reminders, setReminders] = useState<MedicineReminder[]>([]);
  const [profile, setProfile] = useState<any>(null);
  
  // State cache for select selectors
  const [hospitalsList, setHospitalsList] = useState<Hospital[]>([]);
  const [doctorsList, setDoctorList] = useState<DoctorExt[]>([]);
  const [profilesList, setProfilesList] = useState<Profile[]>([]);

  // Dynamic Multi-step Booking State
  const [selectedCity, setSelectedCity] = useState("Seattle");
  const [selectedArea, setSelectedArea] = useState("Downtown");
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("General Physician");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Chat conversation state
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");

  // Prescription modal preview state
  const [viewingPrescription, setViewingPrescription] = useState<Prescription | null>(null);
  const [viewingLabReport, setViewingLabReport] = useState<LabReport | null>(null);

  // Load patient details
  useEffect(() => {
    loadDatabase();
  }, [user]);

  const loadDatabase = async () => {
    const appts = (await MockDB.getAppointments()).filter(a => a.patient_id === user.id);
    const prescs = (await MockDB.getPrescriptions()).filter(p => p.patient_id === user.id);
    const items = await MockDB.getPrescriptionItems();
    const lReqs = (await MockDB.getLabRequests()).filter(l => l.patient_id === user.id);
    const lReps = (await MockDB.getLabReports()).filter(r => r.patient_id === user.id);
    const notifs = (await MockDB.getNotifications()).filter(n => n.user_id === user.id);
    const userChats = (await MockDB.getChats()).filter(c => c.participant1_id === user.id || c.participant2_id === user.id);
    const msgs = await MockDB.getMessages();
    const rems = (await MockDB.getReminders()).filter(r => r.patient_id === user.id);
    const profiles = await MockDB.getProfiles();
    const foundProfile = profiles.find(p => p.id === user.id) || { full_name: "Sarah Jenkins" };
    const hospitals = await MockDB.getHospitals();
    const doctors = await MockDB.getDoctors();

    setAppointments(appts);
    setPrescriptions(prescs);
    setPrescriptionItems(items);
    setLabRequests(lReqs);
    setLabReports(lReps);
    setNotifications(notifs);
    setChats(userChats);
    setMessages(msgs);
    setReminders(rems);
    setProfile(foundProfile);
    setHospitalsList(hospitals);
    setDoctorList(doctors);
    setProfilesList(profiles);

    // Default first chat
    if (userChats.length > 0 && !activeChatId) {
      setActiveChatId(userChats[0].id);
    }
  };

  // Toggle medicine reminder
  const handleToggleReminder = async (id: string) => {
    const allReminders = await MockDB.getReminders();
    const updated = allReminders.map(r => {
      if (r.id === id) {
        return { ...r, taken: !r.taken };
      }
      return r;
    });
    await MockDB.saveReminders(updated);
    setReminders(updated.filter(r => r.patient_id === user.id));
  };

  // Action: Book Appointment
  const handleConfirmBooking = async () => {
    if (!selectedHospitalId || !selectedDoctorId || !selectedDate || !selectedTimeSlot) {
      alert("Please select facility, doctor, date, and a valid timing slot.");
      return;
    }

    const hospitals = await MockDB.getHospitals();
    const hospital = hospitals.find(h => h.id === selectedHospitalId);
    
    const doctors = await MockDB.getDoctors();
    const docExt = doctors.find(d => d.id === selectedDoctorId);
    const docProfile = (await MockDB.getProfiles()).find(p => p.id === selectedDoctorId);

    if (!hospital || !docExt || !docProfile) {
      alert("Invalid selection config error.");
      return;
    }

    const slots = getDoctorSlots(docExt);
    const slotIndex = slots.indexOf(selectedTimeSlot);
    const tokenVal = slotIndex !== -1 ? slotIndex + 1 : 1;

    const appts = await MockDB.getAppointments();

    const newAppointment: Appointment = {
      id: "apt-" + Math.random().toString(36).substring(2, 9),
      patient_id: user.id,
      patient_name: profile?.full_name || "Sarah Jenkins",
      doctor_id: selectedDoctorId,
      doctor_name: docProfile.full_name,
      doctor_specialization: docExt.specialization,
      hospital_id: hospital.id,
      hospital_name: hospital.name,
      date: selectedDate,
      time: selectedTimeSlot,
      token: tokenVal,
      status: AppointmentStatus.BOOKED,
      created_at: new Date().toISOString()
    };

    appts.unshift(newAppointment);
    await MockDB.saveAppointments(appts);

    // Save notification
    await MockDB.addNotification(user.id, "Appointment Placed", `Your appointment token #${tokenVal} under ${docProfile.full_name} is confirmed.`);
    
    // Create automatic private chat with doctor if none exists
    const currentChats = await MockDB.getChats();
    const existing = currentChats.find(c => 
      (c.participant1_id === user.id && c.participant2_id === selectedDoctorId) ||
      (c.participant1_id === selectedDoctorId && c.participant2_id === user.id)
    );
    if (!existing) {
      const activeChat: Chat = {
        id: "chat-" + Math.random().toString(36).substring(2, 9),
        participant1_id: user.id,
        participant2_id: selectedDoctorId,
        participant1_name: profile?.full_name || "Sarah Jenkins",
        participant2_name: docProfile.full_name,
        participant1_role: UserRole.PATIENT,
        participant2_role: UserRole.DOCTOR,
        created_at: new Date().toISOString()
      };
      currentChats.push(activeChat);
      await MockDB.saveChats(currentChats);
    }

    setBookingSuccess(true);
    loadDatabase();

    setTimeout(() => {
      setBookingSuccess(false);
      setActiveTab("appointments");
    }, 1200);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChatId) return;

    const allMsgs = await MockDB.getMessages();
    const newMsg: Message = {
      id: "msg-" + Math.random().toString(36).substring(2, 9),
      chat_id: activeChatId,
      sender_id: user.id,
      text: chatInput,
      read_status: false,
      created_at: new Date().toISOString()
    };

    allMsgs.push(newMsg);
    await MockDB.saveMessages(allMsgs);
    setChatInput("");
    loadDatabase();

    // Mock chatbot simulated response after 1.5 seconds if patient chats to general clinic/doctor
    setTimeout(async () => {
      const updatedMessages = await MockDB.getMessages();
      const botResponse: Message = {
        id: "msg-reply-" + Math.random().toString(36).substring(2, 9),
        chat_id: activeChatId,
        sender_id: viewingChatPartnerId() || "u-doctor-chen",
        text: "Thank you for the message. I have recorded your symptom state and will evaluate these during our upcoming scheduled consultation block. Please standby.",
        read_status: false,
        created_at: new Date().toISOString()
      };
      updatedMessages.push(botResponse);
      await MockDB.saveMessages(updatedMessages);
      loadDatabase();
    }, 1500);
  };

  const viewingChatPartnerId = () => {
    const active = chats.find(c => c.id === activeChatId);
    if (!active) return null;
    return active.participant1_id === user.id ? active.participant2_id : active.participant1_id;
  };

  const currentChatMessages = messages.filter(m => m.chat_id === activeChatId);
  
  // Doctors and hospitals filter logic for Appointment Booking Form
  const availableHospitals = hospitalsList.filter(h => h.approved);
  const availableDoctors = doctorsList.filter(d => 
    d.approved &&
    d.hospital_id === selectedHospitalId &&
    d.specialization === selectedCategory
  );

  const getDocName = (docId: string) => {
    const prof = profilesList.find(p => p.id === docId);
    return prof ? prof.full_name : "Doctor";
  };

  const getDoctorSlots = (doc: DoctorExt) => {
    const timings = doc.available_timings || '09:00-13:00,14:00-18:00';
    const parts = timings.split(',');
    const slots: string[] = [];
    parts.forEach(part => {
      const times = part.trim().split('-');
      if (times.length === 2) {
        const [start, end] = times;
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);
        let currentH = startH;
        let currentM = startM;
        while (currentH < endH || (currentH === endH && currentM < endM)) {
          const timeStr = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;
          slots.push(timeStr);
          currentM += 15;
          if (currentM >= 60) {
            currentH += Math.floor(currentM / 60);
            currentM = currentM % 60;
          }
        }
      }
    });
    return slots.length > 0 ? slots : ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];
  };

  const isDoctorAvailableOnDate = (doc: DoctorExt, dateStr: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const selectedDayName = days[date.getDay()];
    const availableDaysList = (doc.available_days || 'Monday,Tuesday,Wednesday,Thursday,Friday').split(',');
    return availableDaysList.includes(selectedDayName);
  };

  const hasNotifsCount = notifications.filter(n => !n.read).length;

  // Print simulator
  const handlePrint = (title: string, content: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Popup blocked. Content downloaded to console.");
      console.log(`--- ${title} ---\n${content}`);
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: monospace; padding: 40px; color: #111; line-height: 1.6; }
            .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .footer { border-top: 1px solid #ccc; margin-top: 50px; font-size: 10px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>CAREFLOW HEALTHCARE SYSTEMS PROTOCOL</h2>
            <p>Date Generated: ${new Date().toLocaleString()}</p>
          </div>
          <h3>${title}</h3>
          <pre style="white-space: pre-wrap; font-size: 12px;">${content}</pre>
          <div class="footer">
            <p>CareFlow Smart Security certified document. Simulated via Client Viewport.</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div id="patient-portal-core" className="min-h-screen bg-[#f8f9ff] flex flex-col md:flex-row">
      
      {/* Side Control Cabinet */}
      <aside className="w-full md:w-64 bg-white border-r border-[#bec8d2]/40 p-5 flex flex-col justify-between shrink-0">
        <div>
          {/* Patient Card */}
          <div className="flex items-center gap-3 pb-6 border-b border-[#bec8d2]/20 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#006591] text-white flex items-center justify-center font-bold">
              SJ
            </div>
            <div>
              <h3 className="font-extrabold text-xs text-[#0b1c30]">{profile?.full_name || "Sarah Jenkins"}</h3>
              <p className="text-[9px] text-[#0ea5e9] uppercase tracking-wide font-black">Patient Portal</p>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { id: "overview", icon: Activity, label: "Overview Metrics" },
              { id: "book", icon: Plus, label: "Book Appointment" },
              { id: "appointments", icon: Calendar, label: "Scheduled Queue" },
              { id: "prescriptions", icon: ClipboardList, label: "Rx Prescriptions" },
              { id: "labs", icon: FileText, label: "Diagnostic Labs" },
              { id: "chat", icon: MessageSquare, label: "Clinical Chat" },
              { id: "reminders", icon: Clock, label: "Meds Reminders" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                  activeTab === tab.id 
                    ? "bg-[#006591] text-white shadow-xs" 
                    : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.id === "chat" && messages.filter(m => !m.read_status && m.sender_id !== user.id).length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 ml-auto" />
                )}
              </button>
            ))}
          </nav>
        </div>

        <button 
          onClick={onLogout}
          className="flex items-center gap-3 text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg mt-6 w-full text-left"
        >
          <LogOut className="w-4 h-4" />
          Disconnect Portal
        </button>
      </aside>

      {/* Main Panel Content */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-5xl mx-auto w-full">
        
        {/* Urgent Notification Bar */}
        {hasNotifsCount > 0 && (
          <div className="bg-[#e5eeff] border border-[#006591]/20 p-3 rounded-lg mb-6 flex items-center justify-between text-xs font-semibold text-[#006591]">
            <span className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#006591]" />
              You have {hasNotifsCount} unread diagnostic notification messages.
            </span>
            <button 
              onClick={() => {
                MockDB.getNotifications().then(async nots => {
                  nots.forEach(n => { if (n.user_id === user.id) n.read = true; });
                  await MockDB.saveNotifications(nots);
                  loadDatabase();
                });
              }}
              className="text-[#0ea5e9] text-[10px] uppercase font-black tracking-wider hover:underline"
            >
              Clear notifications
            </button>
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-black text-[#0b1c30]">Patient Overview Card</h1>
                <p className="text-xs text-[#3e4850]">Vitals logs, recent consultation entries, and medicine schedules.</p>
              </div>
              <button 
                onClick={() => setActiveTab("book")} 
                className="bg-[#006591] hover:bg-[#004c6e] text-white text-xs font-semibold px-4 py-2 rounded-md shadow-xs flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Book Consultation Slot
              </button>
            </div>

            {/* Smart Interactive Vitals Panel */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-xl border border-[#bec8d2]/30 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Blood Pressure</span>
                  <Heart className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-2xl font-black text-rose-600">120/80 <span className="text-xs text-[#3e4850]">mmHg</span></div>
                <p className="text-[10px] text-slate-500 mt-1">Normal Level · Tracked 10 hours ago</p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-[#bec8d2]/30 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Pulse Rate</span>
                  <Activity className="w-4 h-4 text-teal-500" />
                </div>
                <div className="text-2xl font-black text-teal-600">72 <span className="text-xs text-[#3e4850]">bpm</span></div>
                <p className="text-[10px] text-slate-500 mt-1">Normal Sinus Rhythm · ECG verified</p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-[#bec8d2]/30 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Height & Weight</span>
                  <Sparkles className="w-4 h-4 text-purple-500" />
                </div>
                <div className="text-2xl font-black text-purple-600">165cm / 58kg <span className="text-xs text-[#3e4850]"></span></div>
                <p className="text-[10px] text-slate-500 mt-1">BMI 21.3 (HEALTHY RANGE)</p>
              </div>
            </div>

            {/* Sub content (Meds list & Recent Prescription) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Daily Medicine scheduler */}
              <div className="bg-white rounded-xl border border-[#bec8d2]/30 p-5 shadow-xs">
                <h3 className="font-extrabold text-xs uppercase text-[#0b1c30] tracking-wider mb-4">Today's Medicine Schedule</h3>
                {reminders.length === 0 ? (
                  <p className="text-xs text-slate-400">No diagnostic medication reminders set for today.</p>
                ) : (
                  <div className="space-y-2">
                    {reminders.map(rem => (
                      <div key={rem.id} className="flex items-center justify-between p-3 bg-stone-50 border border-slate-100 rounded-lg">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox"
                            checked={rem.taken}
                            onChange={() => handleToggleReminder(rem.id)}
                            className="w-4 h-4 rounded text-[#006591] focus:ring-[#006591]"
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-800">{rem.medicine_name}</p>
                            <p className="text-[10px] text-slate-500">Dosage: {rem.dosage} · Time: {rem.time}</p>
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          rem.taken ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {rem.taken ? "COMPLETED" : "PENDING SCHEDULE"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Consultation record */}
              <div className="bg-white rounded-xl border border-[#bec8d2]/30 p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="font-extrabold text-xs uppercase text-[#0b1c30] tracking-wider mb-4">Latest Consultation Entry</h3>
                  {prescriptions.length === 0 ? (
                    <p className="text-xs text-slate-400">No medical histories recorded yet.</p>
                  ) : (
                    <div>
                      <h4 className="font-bold text-sm text-[#0b1c30]">{prescriptions[0].diagnosis}</h4>
                      <p className="text-xs text-[#3e4850] mt-1 line-clamp-3">
                        Diagnostic Symptoms: {prescriptions[0].symptoms}. <br/>
                        Clinician Notes: {prescriptions[0].notes}
                      </p>
                      <div className="text-[10px] text-slate-400 mt-2">
                        Dr. {prescriptions[0].doctor_name} · {new Date(prescriptions[0].created_at).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                </div>
                {prescriptions.length > 0 && (
                  <button 
                    onClick={() => { setViewingPrescription(prescriptions[0]); }}
                    className="text-xs text-[#0ea5e9] font-bold text-left pt-4 hover:underline mt-4 border-t border-slate-100"
                  >
                    View diagnostic summary sheet →
                  </button>
                )}
              </div>

            </div>
          </div>
        )}

        {/* BOOK APPOINTMENT MODULAR FLOW */}
        {activeTab === "book" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Secure Consultation Booking Flow</h1>
              <p className="text-xs text-[#3e4850]">Our strict 7-Step booking flow registers and schedules your position immediately.</p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl p-6 shadow-xs space-y-6">
              
              {bookingSuccess && (
                <div className="bg-emerald-50 border border-emerald-400 text-emerald-800 p-4 rounded-md text-xs font-bold text-center">
                  🚀 Your Appointment slot has been successfully booked! Checking tokens...
                </div>
              )}

              {/* Progress Tracker */}
              <div id="booking-flow-breadcrumbs" className="grid grid-cols-7 gap-2 border-b border-[#bec8d2]/20 pb-4 text-center">
                {[
                  { s: 1, label: "City" },
                  { s: 2, label: "Area" },
                  { s: 3, label: "Clinic/Hosp" },
                  { s: 4, label: "Specialty" },
                  { s: 5, label: "Doctor" },
                  { s: 6, label: "Token Slot" },
                  { s: 7, label: "Confirm" }
                ].map((step) => (
                  <div key={step.s} className="flex flex-col items-center">
                    <span className="text-[9px] font-black text-[#3e4850] uppercase leading-none">Step {step.s}</span>
                    <span className="text-[10px] font-bold text-[#006591] mt-0.5">{step.label}</span>
                  </div>
                ))}
              </div>

              {/* 7-Step Interactive Controls Container */}
              <div className="space-y-4">
                {/* Step 1: Select City */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Step 1: Select City</label>
                    <select 
                      value={selectedCity} 
                      onChange={(e) => setSelectedCity(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none"
                    >
                      <option value="Seattle">Seattle</option>
                      <option value="Bellevue">Bellevue</option>
                    </select>
                  </div>

                  {/* Step 2: Select Area */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Step 2: Select Area</label>
                    <select 
                      value={selectedArea} 
                      onChange={(e) => setSelectedArea(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none"
                    >
                      <option value="Downtown">Downtown</option>
                      <option value="Emerald District">Emerald District</option>
                      <option value="Central Bellevue">Central Bellevue</option>
                    </select>
                  </div>
                </div>

                {/* Step 3: Select Hospital */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Step 3: Select Hospital / Medical Complex</label>
                  <select 
                    value={selectedHospitalId} 
                    onChange={(e) => { setSelectedHospitalId(e.target.value); setSelectedDoctorId(""); }}
                    className="w-full px-3 py-2 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none focus:border-[#006591]"
                  >
                    <option value="">-- Click to choose clinical facility on region --</option>
                    {availableHospitals.map(h => (
                      <option key={h.id} value={h.id}>{h.name} ({h.address}, {h.area})</option>
                    ))}
                  </select>
                </div>

                {/* Step 4: Medical Category */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Step 4: Select Doctor Category Specialty</label>
                  <select 
                    value={selectedCategory} 
                    onChange={(e) => { setSelectedCategory(e.target.value); setSelectedDoctorId(""); }}
                    className="w-full px-3 py-2 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none"
                  >
                    <option value="General Physician">General Physician</option>
                    <option value="Cardiologist">Cardiologist (Heart Care)</option>
                    <option value="Orthopedic">Orthopedic (Bone & Muscle Surgery)</option>
                    <option value="Dermatologist">Dermatologist (Skin Care)</option>
                    <option value="Neurologist">Neurologist (Brain & Nerve)</option>
                    <option value="Pediatrician">Pediatrician (Child Specialist)</option>
                  </select>
                </div>

                {/* Step 5: Select Doctor */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Step 5: Choose Associated Medical Professional</label>
                  <select 
                    value={selectedDoctorId} 
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none focus:border-[#006591]"
                  >
                    <option value="">-- Select available clinician specialty roster --</option>
                    {availableDoctors.map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {getDocName(doc.id)} ({doc.experience} Experience) - License: {doc.license_number}
                      </option>
                    ))}
                  </select>
                  {selectedHospitalId && selectedCategory && availableDoctors.length === 0 && (
                    <p className="text-[10px] text-red-500 mt-1">No active, approved on-duty doctor is registered under this hospital specialty today.</p>
                  )}
                </div>

                {/* Step 6 & 7: Date & Token Slot Selection */}
                {selectedDoctorId && (
                  <div className="space-y-4">
                    <div className="bg-[#f8f9ff] p-4 rounded-lg border border-slate-200">
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Step 6: Select Appointment Date</label>
                      <input 
                        type="date"
                        required
                        value={selectedDate}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => {
                          setSelectedDate(e.target.value);
                          setSelectedTimeSlot("");
                        }}
                        className="px-3 py-2 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none focus:border-[#006591]"
                      />
                    </div>

                    {(() => {
                      const doc = doctorsList.find(d => d.id === selectedDoctorId);
                      if (!doc) return null;
                      const isAvailable = isDoctorAvailableOnDate(doc, selectedDate);
                      
                      if (!isAvailable) {
                        return (
                          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs font-semibold">
                            ⚠️ Doctor is not available on this day of the week. Please select another date. (Available: {doc.available_days || 'Monday-Friday'})
                          </div>
                        );
                      }

                      const slots = getDoctorSlots(doc);
                      
                      return (
                        <div className="bg-[#f8f9ff] p-4 rounded-lg border border-teal-200">
                          <label className="block text-[10px] font-black text-[#006591] uppercase mb-2">Step 7: Choose Time & Token Slot</label>
                          <div className="flex flex-wrap gap-2 text-center">
                            {slots.map((time, idx) => {
                              const tokenNumber = idx + 1;
                              const isBooked = appointments.some(a => 
                                a.doctor_id === selectedDoctorId && 
                                a.date === selectedDate && 
                                a.time === time && 
                                a.status !== AppointmentStatus.CANCELLED
                              );

                              return (
                                <button
                                  key={time}
                                  type="button"
                                  disabled={isBooked}
                                  onClick={() => setSelectedTimeSlot(time)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                    isBooked 
                                      ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" 
                                      : selectedTimeSlot === time 
                                        ? "bg-teal-600 text-white border-teal-600" 
                                        : "bg-white text-slate-700 hover:bg-slate-50 border-[#bec8d2]"
                                  }`}
                                >
                                  {time} {isBooked ? "(Booked)" : `(Token #${tokenNumber})`}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Step 8: Confirmation actions */}
                {selectedDoctorId && selectedTimeSlot && (
                  <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                    <button 
                      type="button" 
                      onClick={() => { setSelectedDoctorId(""); setSelectedTimeSlot(""); }} 
                      className="text-xs text-slate-500 hover:underline px-4 py-2"
                    >
                      Reset selection
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmBooking}
                      className="bg-emerald-600 text-white text-xs font-bold px-6 py-2.5 rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" /> Complete Secure Booking
                    </button>
                  </div>
                )}

              </div>

            </div>
          </div>
        )}

        {/* APPOINTMENTS TAB */}
        {activeTab === "appointments" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Your Scheduled Medical Consultations</h1>
              <p className="text-xs text-[#3e4850]">View queue, arrival tokens, and receptionist check-in status.</p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs">
              {appointments.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">You have no scheduled appointments found.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {appointments.map(apt => (
                    <div key={apt.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-[#0b1c30]">{apt.doctor_name}</span>
                          <span className="text-[10px] bg-[#eff4ff] text-[#006591] font-bold px-2 py-0.5 rounded">
                            {apt.doctor_specialization}
                          </span>
                        </div>
                        <p className="text-xs text-[#3e4850] mt-1">{apt.hospital_name}</p>
                        <div className="flex items-center gap-4 text-[10px] text-slate-400 mt-2">
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {apt.date}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Time: {apt.time}</span>
                          <span className="font-bold text-[#006591]">Queue Token: #{apt.token}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                          apt.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" :
                          apt.status === "CHECKED_IN" ? "bg-amber-100 text-amber-800" : "bg-[#eff4ff] text-[#006591]"
                        }`}>
                          {apt.status}
                        </span>
                        
                        {apt.status === "BOOKED" && (
                          <button 
                            onClick={async () => {
                              const appts = await MockDB.getAppointments();
                              const updated = appts.map(a => a.id === apt.id ? { ...a, status: AppointmentStatus.CANCELLED } : a);
                              await MockDB.saveAppointments(updated);
                              loadDatabase();
                            }}
                            className="text-[10px] text-red-500 hover:underline hover:text-red-700"
                          >
                            Cancel
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

        {/* PRESCRIPTIONS TAB */}
        {activeTab === "prescriptions" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Your Clinician Rx Prescriptions</h1>
              <p className="text-xs text-[#3e4850]">View symptoms records, dosages directives, notes, and virtual PDF sheets.</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {prescriptions.length === 0 ? (
                <div className="bg-white p-8 text-center text-slate-400 text-xs border border-[#bec8d2]/30 rounded-xl">No certified prescriptions available for this profile.</div>
              ) : (
                prescriptions.map(pr => {
                  const prescItems = prescriptionItems.filter(item => item.prescription_id === pr.id);
                  return (
                    <div key={pr.id} className="bg-white border border-[#bec8d2]/30 rounded-xl p-5 shadow-xs">
                      <div className="flex justify-between items-start gap-4 pb-4 border-b border-slate-100">
                        <div>
                          <h3 className="font-extrabold text-[#0b1c30] text-sm">Diagnosis: {pr.diagnosis}</h3>
                          <p className="text-[10px] text-[#3e4850] mt-0.5">Clinic: {pr.hospital_name} · Prescribed by Dr. {pr.doctor_name}</p>
                          <p className="text-[11px] font-semibold text-[#006591] mt-2">Recorded symptoms: {pr.symptoms}</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setViewingPrescription(pr)}
                            className="bg-sky-550 border border-[#bec8d2] text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-slate-50 flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" /> Preview
                          </button>
                          <button 
                            onClick={() => handlePrint(`Prescription_${pr.id}`, `DIAGNOSIS: ${pr.diagnosis}\nDOCTOR: Dr. ${pr.doctor_name}\nHOSPITAL: ${pr.hospital_name}\nSYMPTOMS: ${pr.symptoms}\nMEDICATIONS:\n${prescItems.map(m => `- ${m.medicine_name}: ${m.dosage} for ${m.duration} (Timing: ${m.reminder_time})`).join("\n")}\nNOTES: ${pr.notes}`)}
                            className="bg-[#006591] text-white text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-[#004c6e] flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" /> PDF
                          </button>
                        </div>
                      </div>

                      <div className="pt-4 space-y-2">
                        <span className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">PRESCRIBED PHARMACIES</span>
                        {prescItems.length === 0 ? (
                          <p className="text-xs text-slate-400">No pharmacotherapy records.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {prescItems.map(item => (
                              <div key={item.id} className="bg-stone-50 border border-slate-200/50 p-3 rounded-lg text-xs leading-relaxed">
                                <p className="font-bold text-[#0b1c30]">{item.medicine_name}</p>
                                <p className="text-slate-500">Dosage: {item.dosage} · Duration: {item.duration}</p>
                                <p className="text-slate-400 text-[10px]">Reminders: <span className="text-[#0ea5e9] font-mono">{item.reminder_time}</span></p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {pr.notes && (
                        <div className="mt-3 p-2.5 bg-amber-50/50 border border-amber-200 rounded text-[11px] text-[#3e4850] italic">
                          <strong>Clinician Advices:</strong> {pr.notes}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* LAB REPORTS TAB */}
        {activeTab === "labs" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Your Laboratory Test Reports</h1>
              <p className="text-xs text-[#3e4850]">View blood panel parameters, imaging metrics, and diagnostics logs.</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {labReports.length === 0 ? (
                <div className="bg-white p-8 border border-[#bec8d2]/30 rounded-xl text-center text-slate-405 text-xs">No reports generated or uploaded by lab tech yet.</div>
              ) : (
                labReports.map(rep => (
                  <div key={rep.id} className="bg-white border border-[#bec8d2]/30 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <span className="inline-flex px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 rounded-full mb-1">
                        🔬 PATHOLOGY LAB CLOSED RESULTS
                      </span>
                      <h3 className="font-extrabold text-[#0b1c30] text-sm">{rep.test_name}</h3>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Requested by Dr. {rep.doctor_name} · Generated at {new Date(rep.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button 
                        onClick={() => setViewingLabReport(rep)}
                        className="bg-white text-slate-700 border border-[#bec8d2] text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-slate-50 flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" /> Read values
                      </button>
                      <button 
                        onClick={() => handlePrint(`LabReport_${rep.id}`, `TEST CATEGORY: ${rep.test_name}\nATTENDING CLINICIAN: Dr. ${rep.doctor_name}\nPATIENT NAME: ${rep.patient_name}\n\nMETRIC PARAMETERS:\n${rep.results_text}`)}
                        className="bg-[#006591] text-white text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-[#004c6e] flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* CLINICAL CHAT TAB */}
        {activeTab === "chat" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Clinical Message Channels</h1>
              <p className="text-xs text-[#3e4850]">Secure patient-to-clinician or patient-to-reception messaging room.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden min-h-[450px]">
              
              {/* Chat Channels Cabinet */}
              <div className="col-span-1 border-r border-[#bec8d2]/20 p-4 space-y-3 bg-[#f8f9ff]/40">
                <span className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Active channels</span>
                {chats.length === 0 ? (
                  <p className="text-xs text-slate-400">No active chat sessions found.</p>
                ) : (
                  chats.map(ch => {
                    const isSelected = activeChatId === ch.id;
                    const partnerName = ch.participant1_id === user.id ? ch.participant2_name : ch.participant1_name;
                    const partnerRole = ch.participant1_id === user.id ? ch.participant2_role : ch.participant1_role;
                    return (
                      <button
                        key={ch.id}
                        onClick={() => setActiveChatId(ch.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col ${
                          isSelected 
                            ? "bg-white border-[#006591] shadow-xs" 
                            : "bg-white/80 border-slate-200 hover:border-[#bec8d2]"
                        }`}
                      >
                        <span className="font-bold text-xs text-[#0b1c30]">{partnerName}</span>
                        <span className="text-[9px] text-[#0ea5e9] uppercase tracking-wide font-extrabold mt-0.5">{partnerRole}</span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Conversation Box */}
              <div className="col-span-1 md:col-span-2 flex flex-col min-h-[350px]">
                {activeChatId ? (
                  <>
                    {/* Header */}
                    <div className="bg-stone-50 border-b border-slate-100 p-4 font-bold text-xs text-[#0b1c30]">
                      Channel connection active
                    </div>

                    {/* Messages dynamic box */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[250px] max-h-[300px]">
                      {currentChatMessages.map((msg, index) => {
                        const isOwn = msg.sender_id === user.id;
                        return (
                          <div key={index} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-3 rounded-lg text-xs leading-normal max-w-[80%] ${
                              isOwn 
                                ? "bg-[#0b1c30] text-white rounded-tr-none" 
                                : "bg-stone-100 text-[#0b1c30] rounded-tl-none"
                            }`}>
                              {msg.text}
                              <span className="block text-[8px] text-right mt-1 opacity-75">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Input form */}
                    <form onSubmit={handleSendMessage} className="border-t border-[#bec8d2]/30 p-3 bg-stone-50 flex gap-2">
                      <input 
                        type="text"
                        placeholder="Write a secure message..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="flex-1 px-3 py-2 border border-[#bec8d2] bg-white rounded-md text-xs focus:outline-none"
                      />
                      <button type="submit" className="bg-[#006591] text-white px-4 py-2 rounded-md hover:bg-[#004c6e] hover:scale-102 flex items-center justify-center">
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="flex-grow flex items-center justify-center text-xs text-slate-400">Select an active chat channel.</div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* MEDICINE REMINDERS TAB */}
        {activeTab === "reminders" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Daily Medicine Reminder Tracking</h1>
              <p className="text-xs text-[#3e4850]">Tick medications after ingestion. System will log states for physician's review.</p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl p-6 shadow-xs">
              {reminders.length === 0 ? (
                <div className="text-center p-6 text-xs text-slate-400">No diagnostic medication schedules found.</div>
              ) : (
                <div className="space-y-3">
                  {reminders.map(rem => (
                    <div 
                      key={rem.id} 
                      onClick={() => handleToggleReminder(rem.id)}
                      className={`p-4 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                        rem.taken 
                          ? "bg-slate-50 border-emerald-200 opacity-80" 
                          : "bg-white border-[#bec8d2]/40 hover:border-[#006591]"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                          rem.taken ? "bg-emerald-600 border-emerald-600 text-white" : "border-[#bec8d2]"
                        }`}>
                          {rem.taken && <CheckCircle className="w-3.5 h-3.5 shrink-0" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-[#0b1c30]">{rem.medicine_name}</h4>
                          <p className="text-[10px] text-slate-500">Dosage: {rem.dosage} · Scheduled: {rem.time}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                        rem.taken ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {rem.taken ? "TAKEN ✓" : "TO TAKE"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* MODAL VIEW PRESCRIPTION */}
      {viewingPrescription && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl relative border border-[#bec8d2]">
            <h2 className="text-lg font-black text-[#0b1c30] mb-4">Certified Apothecary Prescription Sheet</h2>
            
            <div className="space-y-3 text-xs leading-relaxed border border-[#bec8d2]/30 p-4 rounded-lg bg-stone-50">
              <p><strong>attending clinic:</strong> {viewingPrescription.hospital_name}</p>
              <p><strong>prescribing physician:</strong> Dr. {viewingPrescription.doctor_name}</p>
              <p><strong>clinical diagnosis:</strong> {viewingPrescription.diagnosis}</p>
              <p><strong>recorded symptoms:</strong> {viewingPrescription.symptoms}</p>
              <p className="pt-2 border-t border-slate-200"><strong>clinical notes:</strong> {viewingPrescription.notes}</p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setViewingPrescription(null)}
                className="bg-stone-100 hover:bg-stone-200 text-xs px-4 py-2 rounded-md font-semibold"
              >
                Dismiss Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VIEW LAB REPORT */}
      {viewingLabReport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl relative border border-[#bec8d2]">
            <h2 className="text-lg font-black text-teal-800 mb-4">{viewingLabReport.test_name} pathology report</h2>
            
            <div className="space-y-3 text-xs font-mono leading-relaxed bg-[#f8f9ff] border border-cyan-100 p-4 rounded-lg whitespace-pre-wrap">
              {viewingLabReport.results_text}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setViewingLabReport(null)}
                className="bg-stone-100 hover:bg-stone-200 text-xs px-4 py-2 rounded-md font-bold"
              >
                Close Metrics
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
