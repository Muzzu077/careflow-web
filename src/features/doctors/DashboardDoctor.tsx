import React, { useState, useEffect } from "react";
import { Database } from "../../api";
import { User, Appointment, Prescription, PrescriptionItem, LabRequest, Notification, Chat, Message, UserRole, AppointmentStatus, LabRequestStatus, Profile, DoctorExt } from "../../types";
import { supabase } from "../../supabaseClient";
import { 
  Heart, Calendar, FileText, ClipboardList, Send, MapPin, 
  User as UserIcon, LogOut, CheckCircle2, Clock, AlertCircle, 
  Activity, Plus, Trash2, ListChecks, MessageSquare, ChevronRight
} from "lucide-react";

interface DoctorProps {
  user: User;
  onLogout: () => void;
}

export default function DashboardDoctor({ user, onLogout }: DoctorProps) {
  // Tabs: 'queue' | 'consult' | 'labs' | 'chats' | 'prescriptions' | 'availability'
  const [activeTab, setActiveTab] = useState<"queue" | "consult" | "labs" | "chats" | "prescriptions" | "availability">("queue");

  // Core records
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeConsultation, setActiveConsultation] = useState<Appointment | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [doctorRecord, setDoctorRecord] = useState<DoctorExt | null>(null);

  // New Doctor Availability Slots State
  const [availabilitySlots, setAvailabilitySlots] = useState<any[]>([]);
  const [compDay, setCompDay] = useState("Monday");
  const [compStart, setCompStart] = useState("09:00");
  const [compEnd, setCompEnd] = useState("13:00");
  const [compTokenType, setCompTokenType] = useState("PER_DAY");
  const [compMaxTokens, setCompMaxTokens] = useState(20);
  const [availabilitySuccess, setAvailabilitySuccess] = useState(false);

  // Consultation Form States
  const [symptoms, setSymptoms] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  
  // Custom prescription medications builder
  const [prescriptionMeds, setPrescriptionMeds] = useState<{ medicineName: string; dosage: string; duration: string; reminderTime: string }[]>([]);
  const [medInputName, setMedInputName] = useState("");
  const [medInputDosage, setMedInputDosage] = useState("1-0-1");
  const [medInputDuration, setMedInputDuration] = useState("7 days");
  const [medInputReminders, setMedInputReminders] = useState("08:00, 20:00");

  // Lab test creator state
  const [labPatientId, setLabPatientId] = useState("");
  const [labPatientName, setLabPatientName] = useState("");
  const [labTestName, setLabTestName] = useState("Comprehensive Blood Panel");
  const [labAppointmentId, setLabAppointmentId] = useState("");
  const [labSuccess, setLabSuccess] = useState(false);

  // Chat conversation
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");

  const [docProfile, setDocProfile] = useState<any>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    loadDatabase();
  }, [user]);

  // Real-time messages listener (Unique channel name per user to prevent collision)
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-messages-doctor-${user.id}`)
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
    try {
      const allAppts = (await Database.getAppointments()).filter(a => a.doctor_id === user.id);
      const allPrescs = (await Database.getPrescriptions()).filter(p => p.doctor_id === user.id);
      const allChats = (await Database.getChats()).filter(c => c.participant1_id === user.id || c.participant2_id === user.id);
      const allMsgs = await Database.getMessages();
      const allProfs = await Database.getProfiles();
      const foundProfile = allProfs.find(p => p.id === user.id);
      const doctors = await Database.getDoctors();
      const currentDoc = doctors.find(d => d.id === user.id) || null;
      const slots = await Database.getDoctorAvailability(user.id);

      setAppointments(allAppts);
      setPrescriptions(allPrescs);
      setChats(allChats);
      setMessages(allMsgs);
      setProfiles(allProfs);
      setDocProfile(foundProfile);
      setDoctorRecord(currentDoc);
      setAvailabilitySlots(slots);

      if (allChats.length > 0 && !activeChatId) {
        setActiveChatId(allChats[0].id);
      }
    } catch (e) {
      console.error("Error loading doctor database:", e);
    }
  };

  // Add medicine to constructor buffer
  const handleAddMed = () => {
    if (!medInputName.trim()) {
      alert("Please input a valid medical substance name.");
      return;
    }
    setPrescriptionMeds(prev => [...prev, {
      medicineName: medInputName,
      dosage: medInputDosage,
      duration: medInputDuration,
      reminderTime: medInputReminders
    }]);
    setMedInputName("");
  };

  const handleRemoveMed = (idx: number) => {
    setPrescriptionMeds(prev => prev.filter((_, i) => i !== idx));
  };

  const handleStartConsultation = async (apt: Appointment) => {
    try {
      const allAppts = await Database.getAppointments();
      const updated = allAppts.map(a => a.id === apt.id ? { ...a, status: AppointmentStatus.IN_CONSULTATION } : a);
      await Database.saveAppointments(updated);
      await Database.logAppointmentStatusChange(apt.id, AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_CONSULTATION, user.id);
      setActiveConsultation({ ...apt, status: AppointmentStatus.IN_CONSULTATION });
      setSymptoms("");
      setDiagnosis("");
      setNotes("");
      setPrescriptionMeds([]);
      loadDatabase();
    } catch (err: any) {
      alert("Error starting consultation: " + err.message);
    }
  };

  // COMPLETE CONSULTATION -> SUBMIT TO LOCALSTORAGE
  const handleSubmitConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConsultation) return;

    if (!diagnosis.trim()) {
      alert("Clinical Diagnosis is a mandatory safety input field.");
      return;
    }

    const prescriptionId = crypto.randomUUID();
    
    const patProfile = profiles.find(p => p.id === activeConsultation.patient_id);

    // 1. Create Core Prescription
    const newPrescription: Prescription = {
      id: prescriptionId,
      appointment_id: activeConsultation.id,
      doctor_id: user.id,
      doctor_name: docProfile?.full_name || "Doctor",
      patient_id: activeConsultation.patient_id,
      patient_name: activeConsultation.patient_name,
      patient_dob: patProfile?.dob || "",
      patient_gender: patProfile?.gender || "",
      hospital_id: activeConsultation.hospital_id,
      hospital_name: activeConsultation.hospital_name,
      symptoms,
      diagnosis,
      notes,
      created_at: new Date().toISOString()
    };

    const currentPrescs = await Database.getPrescriptions();
    currentPrescs.unshift(newPrescription);
    await Database.savePrescriptions(currentPrescs);

    // 2. Inject prescription drugs list mapping
    const currentItems = await Database.getPrescriptionItems();
    const newRemindersList = await Database.getReminders();

    prescriptionMeds.forEach(med => {
      const itemUuid = crypto.randomUUID();
      currentItems.push({
        id: itemUuid,
        prescription_id: prescriptionId,
        medicine_name: med.medicineName,
        dosage: med.dosage,
        duration: med.duration,
        reminder_time: med.reminderTime
      });

      // Split comma reminders to generate multiple distinct time alert slots
      const timeSlots = med.reminderTime.split(",").map(t => t.trim());
      timeSlots.forEach(time => {
        newRemindersList.push({
          id: crypto.randomUUID(),
          patient_id: activeConsultation.patient_id,
          prescription_id: prescriptionId,
          medicine_name: med.medicineName,
          time: time || "08:00",
          dosage: med.dosage,
          taken: false,
          dateStr: new Date().toISOString().split("T")[0]
        });
      });
    });

    await Database.savePrescriptionItems(currentItems);
    await Database.saveReminders(newRemindersList);

    // 3. Mark appointment complete in db
    const currentAppointments = await Database.getAppointments();
    const updatedApts = currentAppointments.map(a => {
      if (a.id === activeConsultation.id) {
        return { ...a, status: AppointmentStatus.COMPLETED };
      }
      return a;
    });
    await Database.saveAppointments(updatedApts);

    // Log status change to audit logs
    await Database.logAppointmentStatusChange(activeConsultation.id, AppointmentStatus.IN_CONSULTATION, AppointmentStatus.COMPLETED, user.id);

    // 4. Send security notification
    await Database.addNotification(
      activeConsultation.patient_id, 
      "Prescription Ready", 
      `Dr. ${docProfile?.full_name} completed consultation. View medications directions on dashboard.`,
      "PRESCRIPTION"
    );

    alert("Consultation complete. Diagnostic Rx record published.");
    
    // Clear forms
    setSymptoms("");
    setDiagnosis("");
    setNotes("");
    setPrescriptionMeds([]);
    setActiveConsultation(null);
    setActiveTab("queue");
    loadDatabase();
  };

  const handleCreateLabRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labPatientId || !labTestName) {
      alert("Please select patient target first.");
      return;
    }

    const currentReqs = await Database.getLabRequests();
    currentReqs.unshift({
      id: crypto.randomUUID(),
      doctor_id: user.id,
      doctor_name: docProfile?.full_name || "Doctor",
      patient_id: labPatientId,
      patient_name: labPatientName,
      appointment_id: labAppointmentId || "apt-direct",
      hospital_id: doctorRecord?.hospital_id || "hosp-1", // associated doctor's clinic/hospital
      test_name: labTestName,
      status: LabRequestStatus.PENDING,
      created_at: new Date().toISOString()
    });

    await Database.saveLabRequests(currentReqs);
    setLabSuccess(true);
    setTimeout(() => {
      setLabSuccess(false);
      setActiveTab("queue");
    }, 1200);
  };

  const handleSendChatText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChatId) return;

    const allMsgs = await Database.getMessages();
    allMsgs.push({
      id: crypto.randomUUID(),
      chat_id: activeChatId,
      sender_id: user.id,
      text: chatInput,
      read_status: false,
      created_at: new Date().toISOString()
    });

    await Database.saveMessages(allMsgs);
    setChatInput("");
    loadDatabase();
  };

  const handleAddAvailabilitySlot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newSlot = {
        id: crypto.randomUUID(),
        doctor_id: user.id,
        day_of_week: compDay,
        start_time: compStart.includes(':') && compStart.split(':').length === 2 ? `${compStart}:00` : compStart,
        end_time: compEnd.includes(':') && compEnd.split(':').length === 2 ? `${compEnd}:00` : compEnd,
        token_type: compTokenType,
        max_tokens: compMaxTokens,
        created_at: new Date().toISOString()
      };

      await Database.saveDoctorAvailability([newSlot]);
      setAvailabilitySuccess(true);
      loadDatabase();
      setTimeout(() => setAvailabilitySuccess(false), 2000);
    } catch (err: any) {
      alert("Error adding availability slot: " + err.message);
    }
  };

  const handleDeleteAvailabilitySlot = async (slotId: string) => {
    if (!confirm("Are you sure you want to remove this availability slot?")) return;
    try {
      await Database.deleteDoctorAvailability(slotId);
      loadDatabase();
    } catch (err: any) {
      alert("Error deleting slot: " + err.message);
    }
  };

  const checkedInCount = appointments.filter(a => a.status === AppointmentStatus.CHECKED_IN).length;
  const currentChatMsgs = messages.filter(m => m.chat_id === activeChatId);

  return (
    <div id="doctor-portal-root" className="min-h-screen bg-[#f8f9ff] flex flex-col md:flex-row">
      
      {/* Side Cabinet */}
      <aside className="w-full md:w-64 bg-white border-r border-[#bec8d2]/40 p-5 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 pb-6 border-b border-[#bec8d2]/20 mb-6">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
              Dr
            </div>
            <div>
              <h3 className="font-extrabold text-xs text-[#0b1c30]">{docProfile?.full_name || "Doctor"}</h3>
              <p className="text-[9px] text-[#0ea5e9] uppercase tracking-wide font-black">Attending Clinician</p>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => { setActiveTab("queue"); setActiveConsultation(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "queue" 
                  ? "bg-[#006591] text-white shadow-xs" 
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <ListChecks className="w-4 h-4" />
              Patient Queue
              {checkedInCount > 0 && (
                <span className="bg-rose-500 text-white font-bold px-1.5 py-0.5 rounded-full text-[9px] ml-auto">
                  {checkedInCount} checked-in
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("prescriptions")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "prescriptions" 
                  ? "bg-[#006591] text-white shadow-xs" 
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Consultations History
            </button>

            <button
              onClick={() => setActiveTab("labs")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "labs" 
                  ? "bg-[#006591] text-white shadow-xs" 
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <Activity className="w-4 h-4" />
              Order Lab Request
            </button>

            <button
              onClick={() => setActiveTab("chats")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "chats" 
                  ? "bg-[#006591] text-white shadow-xs" 
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Patient Chat Rooms
            </button>

            <button
              onClick={() => setActiveTab("availability")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeTab === "availability" 
                  ? "bg-[#006591] text-white shadow-xs" 
                  : "text-[#3e4850] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
              }`}
            >
              <Clock className="w-4 h-4" />
              Availability Settings
            </button>
          </nav>
        </div>

        <button 
          onClick={onLogout}
          className="flex items-center gap-3 text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg mt-6 w-full text-left"
        >
          <LogOut className="w-4 h-4" />
          Logoff clinical grid
        </button>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-5xl mx-auto w-full">
        
        {/* QUEUE TAB */}
        {activeTab === "queue" && !activeConsultation && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Today's Attending patient Queue</h1>
              <p className="text-xs text-[#3e4850]">Wait for reception checked-in status to light-up before initiating consultation procedures.</p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-3 bg-stone-50 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-[#0b1c30]">
                <span>PATIENT QUEUE DETAILS</span>
                <span>STATUS STATUS</span>
              </div>

              {appointments.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No clinic appointments recorded today.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {appointments.map(apt => (
                    <div key={apt.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800">{apt.patient_name}</span>
                          <span className="text-[10px] bg-sky-100 text-[#006591] font-bold px-1.5 py-0.5 rounded-full">
                            Token #{apt.token}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Scheduled at {apt.time} · Contact via secure portal</p>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          apt.status === AppointmentStatus.CHECKED_IN ? "bg-amber-100 text-amber-800 animate-pulse" :
                          apt.status === AppointmentStatus.COMPLETED ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-600"
                        }`}>
                          {apt.status === AppointmentStatus.CHECKED_IN ? "CHECKED_IN (Waiting)" : apt.status}
                        </span>

                        {apt.status === AppointmentStatus.CHECKED_IN && (
                          <button
                            onClick={() => handleStartConsultation(apt)}
                            className="bg-emerald-600 text-white font-bold text-xs px-4 py-1.5 rounded-lg hover:bg-emerald-700 hover:scale-102 flex items-center gap-1 shadow-xs"
                          >
                            Open Consultation <ChevronRight className="w-3.5 h-3.5" />
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

        {/* ACTIVE CONSULTATION WORKBENCH */}
        {activeConsultation && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-[#eff4ff] p-4 rounded-xl border border-[#d3e4fe]">
              <div>
                <span className="text-[9px] font-black uppercase text-[#0ea5e9] tracking-wider">ACTIVE CONSULTATION BLOCK</span>
                <h2 className="text-lg font-extrabold text-[#0b1c30]">Patient name: <span className="text-[#006591]">{activeConsultation.patient_name}</span></h2>
                <p className="text-[10px] text-[#3e4850] mt-0.5">Token: {activeConsultation.token} · Location: {activeConsultation.hospital_name}</p>
              </div>
              <button 
                onClick={() => { setActiveConsultation(null); }} 
                className="text-xs text-red-500 hover:underline font-bold"
              >
                Abend consultation
              </button>
            </div>

            <form onSubmit={handleSubmitConsultation} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Symptoms & Diagnosis inputs */}
              <div className="col-span-1 md:col-span-2 space-y-4 bg-white p-6 border border-[#bec8d2]/30 rounded-xl shadow-xs">
                <div>
                  <label className="block text-[10px] font-bold text-[#3e4850] uppercase mb-1">Symptoms Description</label>
                  <textarea 
                    rows={2}
                    placeholder="Mild chest pain, shortness of breath, headache..."
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#3e4850] uppercase mb-1">Clinical Diagnosis Record *</label>
                  <input 
                    required
                    type="text"
                    placeholder="Slight exertion hypertension, stress induced palpitations etc."
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#3e4850] uppercase mb-1">Prescription Notes / Lifestyle advices</label>
                  <textarea 
                    rows={3}
                    placeholder="Advised low fat diet, strictly avoid heavy cardio activities for 14 days, measure BP daily."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    className="bg-emerald-600 text-white font-extrabold text-xs px-6 py-3 rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Save Rx Prescription & Close Consultation
                  </button>
                </div>
              </div>

              {/* Interactive Drug list Builder */}
              <div className="col-span-1 bg-white p-5 border border-[#bec8d2]/30 rounded-xl shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="font-extrabold text-xs uppercase text-[#0b1c30] tracking-wider mb-4 border-b pb-2">Drug Roster Composer</h3>
                  
                  {/* Current builders list */}
                  <div className="space-y-2 mb-4">
                    {prescriptionMeds.length === 0 ? (
                      <p className="text-[11px] text-slate-400">No drugs added. Populate using constructor tool below.</p>
                    ) : (
                      prescriptionMeds.map((med, idx) => (
                        <div key={idx} className="p-2.5 bg-stone-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-slate-800">{med.medicineName}</p>
                            <p className="text-[10px] text-slate-500">Dosage: {med.dosage} · Duration: {med.duration}</p>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveMed(idx)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Constructor parameters */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase">Medicine Name</label>
                      <input 
                        type="text"
                        placeholder="e.g. Lisinopril 10mg"
                        value={medInputName}
                        onChange={(e) => setMedInputName(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">Dosage</label>
                        <select 
                          value={medInputDosage} 
                          onChange={(e) => setMedInputDosage(e.target.value)}
                          className="w-full px-2 py-1.5 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none"
                        >
                          <option value="1-0-1">1-0-1</option>
                          <option value="0-1-0">0-1-0</option>
                          <option value="1-0-0">1-0-0</option>
                          <option value="1-1-1">1-1-1</option>
                          <option value="0-0-1">0-0-1</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">Duration</label>
                        <input 
                          type="text"
                          value={medInputDuration}
                          onChange={(e) => setMedInputDuration(e.target.value)}
                          className="w-full px-2 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase">Reminder Times (Comma list)</label>
                      <input 
                        type="text"
                        placeholder="08:00, 20:00"
                        value={medInputReminders}
                        onChange={(e) => setMedInputReminders(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddMed}
                      className="w-full bg-[#006591] text-white text-xs font-semibold py-1.5 rounded flex items-center justify-center gap-1 hover:bg-[#004c6e]"
                    >
                      <Plus className="w-3.5 h-3.5" /> Construct Med to Rx
                    </button>
                  </div>

                </div>
              </div>

            </form>
          </div>
        )}

        {/* CONSULTATIONS LIST */}
        {activeTab === "prescriptions" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Consultation Log History</h1>
              <p className="text-xs text-[#3e4850]">Past completed prescriptions diagnostics and medications logged under your credentials.</p>
            </div>

            <div className="space-y-4">
              {prescriptions.length === 0 ? (
                <div className="bg-white p-8 border border-slate-205 rounded-xl text-center text-xs text-slate-400">No prescription histories recorded.</div>
              ) : (
                prescriptions.map(pr => (
                  <div key={pr.id} className="bg-white border border-[#bec8d2]/30 rounded-xl p-5 shadow-xs">
                    <div className="flex justify-between text-xs font-bold text-slate-800 pb-3 border-b border-slate-100">
                      <div>
                        <h4>Patient: {pr.patient_name}</h4>
                        <p className="text-[10px] text-slate-400 font-medium">{pr.hospital_name} · Date: {new Date(pr.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className="text-[#006591]">Rx #{pr.id}</span>
                    </div>
                    <div className="pt-3 text-xs text-[#3e4850] space-y-2">
                      <p><strong>Diagnosis:</strong> {pr.diagnosis}</p>
                      <p><strong>Symptoms reported:</strong> {pr.symptoms}</p>
                      {pr.notes && <p className="italic text-[11px] text-slate-550"><strong>Advices:</strong> {pr.notes}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ORDER LAB REQUEST TAB */}
        {activeTab === "labs" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Order Diagnostic Lab testing</h1>
              <p className="text-xs text-[#3e4850]">Submit test parameters directly to the clinic's laboratory queue.</p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl p-6 shadow-xs max-w-xl">
              {labSuccess && (
                <div className="bg-emerald-50 border border-emerald-400 text-emerald-800 p-4 rounded-md text-xs font-bold mb-4 text-center">
                  🔬 Laboratory Request placed. Technicians notified.
                </div>
              )}

              <form onSubmit={handleCreateLabRequest} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#3e4850] uppercase mb-1">Target Patient</label>
                  <select
                    required
                    onChange={(e) => {
                      const selectedVal = e.target.value;
                      setLabPatientId(selectedVal);
                      const matched = profiles.find(p => p.id === selectedVal);
                      setLabPatientName(matched ? matched.full_name : "Patient");
                    }}
                    className="w-full px-3 py-2 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none focus:border-[#006591]"
                  >
                    <option value="">-- Choose active patient roster --</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name} ({p.dob || "adult"})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#3e4850] uppercase mb-1">Laboratory testing Category</label>
                  <select
                    value={labTestName}
                    onChange={(e) => setLabTestName(e.target.value)}
                    className="w-full px-3 py-2 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none"
                  >
                    <option value="Comprehensive Blood Panel">Comprehensive Blood Panel</option>
                    <option value="Cardiogram ECG">Cardiogram ECG</option>
                    <option value="Differential Urine Test">Differential Urine Test</option>
                    <option value="Chest X-Ray">Chest X-Ray</option>
                    <option value="Cardiac MRI scan">Cardiac MRI scan</option>
                    <option value="Head CT Scan">Head CT Scan</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#006591] hover:bg-[#004c6e] text-white text-xs font-bold py-2.5 rounded shadow-xs transition-transform"
                >
                  Publish Lab Request to Queue
                </button>
              </form>
            </div>
          </div>
        )}

        {/* CHATS TAB */}
        {activeTab === "chats" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Secured patient Chat Rooms</h1>
              <p className="text-xs text-[#3e4850]">Direct HIPAA-certified communications channel with your active patients.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden min-h-[450px]">
              
              {/* Cabinet */}
              <div className="col-span-1 border-r border-[#bec8d2]/20 p-4 space-y-3 bg-[#f8f9ff]/40">
                <span className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Active Patient Channels</span>
                {chats.length === 0 ? (
                  <p className="text-xs text-slate-400">No patient message threads verified today.</p>
                ) : (
                  chats.map(ch => {
                    const partnerName = ch.participant1_id === user.id ? ch.participant2_name : ch.participant1_name;
                    return (
                      <button
                        key={ch.id}
                        onClick={() => setActiveChatId(ch.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col ${
                          activeChatId === ch.id 
                            ? "bg-white border-[#006591] shadow-xs" 
                            : "bg-white/80 border-slate-200 hover:border-[#bec8d2]"
                        }`}
                      >
                        <span className="font-bold text-xs text-[#0b1c30]">{partnerName}</span>
                        <span className="text-[9px] text-slate-400 font-medium mt-0.5">HIPAA secure connection</span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Box */}
              <div className="col-span-1 md:col-span-2 flex flex-col min-h-[350px]">
                {activeChatId ? (
                  <>
                    <div className="bg-stone-50 border-b border-slate-100 p-4 font-bold text-xs text-[#0b1c30]">
                      Patient channel link active
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[250px] max-h-[300px]">
                      {currentChatMsgs.map((msg, index) => {
                        const isOwn = msg.sender_id === user.id;
                        return (
                          <div key={index} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-3 rounded-lg text-xs leading-normal max-w-[80%] ${
                              isOwn 
                                ? "bg-emerald-800 text-white rounded-tr-none" 
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

                    <form onSubmit={handleSendChatText} className="border-t border-[#bec8d2]/30 p-3 bg-stone-50 flex gap-2">
                      <input 
                        type="text"
                        placeholder="Write dynamic advice response..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="flex-1 px-3 py-2 border border-[#bec8d2] bg-white rounded-md text-xs focus:outline-none"
                      />
                      <button type="submit" className="bg-[#006591] text-white px-4 py-2 rounded-md hover:bg-[#004c6e] flex items-center justify-center">
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="flex-grow flex items-center justify-center text-xs text-slate-400">Choose patient from channels grid.</div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* AVAILABILITY SETTINGS TAB */}
        {activeTab === "availability" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Consultation Availability Slots & Token Configuration</h1>
              <p className="text-xs text-[#3e4850]">Define weekly visiting days, slot timings, and hourly/daily patient token limits.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Form composer to add new slots */}
              <div className="lg:col-span-1 bg-white border border-[#bec8d2]/30 rounded-xl p-6 shadow-xs space-y-4">
                <h3 className="font-extrabold text-xs uppercase text-[#0b1c30] tracking-wider border-b pb-2">Create Availability Slot</h3>
                
                {availabilitySuccess && (
                  <div className="bg-[#6cf8bb]/20 border border-emerald-400 text-emerald-800 p-3 rounded text-xs font-bold text-center">
                    ✓ Availability slot added successfully!
                  </div>
                )}

                <form onSubmit={handleAddAvailabilitySlot} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Day of Week</label>
                    <select
                      value={compDay}
                      onChange={(e) => setCompDay(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none"
                    >
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Start Time</label>
                      <input
                        type="time"
                        required
                        value={compStart}
                        onChange={(e) => setCompStart(e.target.value)}
                        className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">End Time</label>
                      <input
                        type="time"
                        required
                        value={compEnd}
                        onChange={(e) => setCompEnd(e.target.value)}
                        className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Token Limit Mode</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        required
                        min={1}
                        value={compMaxTokens}
                        onChange={(e) => setCompMaxTokens(parseInt(e.target.value) || 0)}
                        className="w-20 px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none"
                      />
                      <select
                        value={compTokenType}
                        onChange={(e) => setCompTokenType(e.target.value)}
                        className="flex-1 px-3 py-2 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none"
                      >
                        <option value="PER_HOUR">Patients Per Hour</option>
                        <option value="PER_DAY">Tokens Per Day</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#006591] hover:bg-[#004c6e] text-white text-xs font-bold py-2.5 rounded transition-colors"
                  >
                    Add Availability Slot
                  </button>
                </form>
              </div>

              {/* List of current active slots */}
              <div className="lg:col-span-2 bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs">
                <div className="px-5 py-3 bg-stone-50 border-b border-slate-100 text-xs font-extrabold text-[#0b1c30] flex justify-between items-center">
                  <span>ACTIVE AVAILABILITY SLOTS</span>
                  <span className="bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded text-[10px]">
                    {availabilitySlots.length} Slots Active
                  </span>
                </div>

                {availabilitySlots.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">No availability slots configured yet. Setup using the composer panel.</div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-stone-50/50 border-b border-slate-100 text-slate-550 font-bold">
                        <th className="p-3">DAY OF WEEK</th>
                        <th className="p-3">HOURS</th>
                        <th className="p-3">TOKEN MODE & LIMIT</th>
                        <th className="p-3">COMMAND</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {availabilitySlots.map(slot => (
                        <tr key={slot.id} className="hover:bg-slate-50/55 transition-colors">
                          <td className="p-3 font-bold text-slate-800">{slot.day_of_week}</td>
                          <td className="p-3 font-mono text-slate-600">
                            {slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}
                          </td>
                          <td className="p-3">
                            <span className="bg-sky-100 text-[#006591] font-bold px-2 py-0.5 rounded text-[10px]">
                              {slot.max_tokens} {slot.token_type === "PER_HOUR" ? "per Hour" : "per Day"}
                            </span>
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => handleDeleteAvailabilitySlot(slot.id)}
                              className="text-red-500 hover:text-red-700 hover:underline font-bold"
                            >
                              Remove Slot
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
