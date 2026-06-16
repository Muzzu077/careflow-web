import React, { useState, useEffect } from "react";
import { Database } from "../../api";
import { User, Appointment, Prescription, PrescriptionItem, LabRequest, LabReport, Notification, Chat, Message, MedicineReminder, AppointmentStatus, LabRequestStatus, UserRole, UserStatus, Hospital, DoctorExt, Profile, DoctorAvailability, FamilyMember } from "../../types";
import { supabase } from "../../supabaseClient";
import { 
  Activity, Calendar, Clock, ClipboardList, FileText, History, 
  MessageSquare, Bell, User as UserIcon, LogOut, CheckCircle2, ChevronRight, 
  Search, ShieldAlert, Sparkles, MapPin, CheckCircle, Eye, Download, Info, Plus, Users, Send
} from "lucide-react";
import { jsPDF } from "jspdf";

interface PatientProps {
  user: User;
  onLogout: () => void;
}

export default function DashboardPatient({ user, onLogout }: PatientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "book" | "appointments" | "prescriptions" | "labs" | "chat" | "reminders" | "profile" | "history" | "notifications" | "family">("overview");

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
  // Family Profile States
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [famName, setFamName] = useState("");
  const [famRelationship, setFamRelationship] = useState("Father");
  const [famGender, setFamGender] = useState("Male");
  const [famDob, setFamDob] = useState("");
  const [famSuccess, setFamSuccess] = useState(false);
  const [bookingFor, setBookingFor] = useState("self");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // State cache for select selectors
  const [hospitalsList, setHospitalsList] = useState<Hospital[]>([]);
  const [doctorsList, setDoctorList] = useState<DoctorExt[]>([]);
  const [profilesList, setProfilesList] = useState<Profile[]>([]);
  const [availabilityList, setAvailabilityList] = useState<DoctorAvailability[]>([]);

  // Dynamic Multi-step Booking State
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
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

  // Real-time messages listener (Unique channel name per user to prevent collision)
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-messages-patient-${user.id}`)
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
    setIsLoading(true);
    try {
      const appts = (await Database.getAppointments()).filter(a => a.patient_id === user.id);
      const prescs = (await Database.getPrescriptions()).filter(p => p.patient_id === user.id);
      const items = await Database.getPrescriptionItems();
      const lReqs = (await Database.getLabRequests()).filter(l => l.patient_id === user.id);
      const lReps = (await Database.getLabReports()).filter(r => r.patient_id === user.id);
      const notifs = (await Database.getNotifications()).filter(n => n.user_id === user.id);
      const userChats = (await Database.getChats()).filter(c => c.participant1_id === user.id || c.participant2_id === user.id);
      const msgs = await Database.getMessages();
      const rems = (await Database.getReminders()).filter(r => r.patient_id === user.id);
      const famList = await Database.getFamilyMembers(user.id);
      const profiles = await Database.getProfiles();
      const foundProfile = profiles.find(p => p.id === user.id);
      const hospitals = await Database.getHospitals();
      const doctors = await Database.getDoctors();
      const allUsers = await Database.getUsers();

      // Only show active doctors
      const activeDoctors = doctors.filter(d => {
        const u = allUsers.find(usr => usr.id === d.id);
        return u ? u.status === UserStatus.ACTIVE : false;
      });

      // Fetch availability slots directly from the doctor_availability table
      const { data: avails, error: availErr } = await supabase.from('doctor_availability').select('*');
      if (availErr) throw availErr;

      setAppointments(appts);
      setPrescriptions(prescs);
      setPrescriptionItems(items);
      setLabRequests(lReqs);
      setLabReports(lReps);
      setNotifications(notifs);
      setChats(userChats);
      setMessages(msgs);
      setReminders(rems);
      setFamilyMembers(famList);
      setProfile(foundProfile);
      setHospitalsList(hospitals);
      setDoctorList(activeDoctors);
      setProfilesList(profiles);
      setAvailabilityList(avails || []);

      // Default first chat
      if (userChats.length > 0 && !activeChatId) {
        setActiveChatId(userChats[0].id);
      }
    } catch (e) {
      console.error("Error loading patient database:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const activeHosp = hospitalsList.filter(h => h.status === "ACTIVE");
    if (activeHosp.length > 0) {
      const cities = Array.from(new Set(activeHosp.map(h => h.city)));
      if (cities.length > 0 && (!selectedCity || !cities.includes(selectedCity))) {
        setSelectedCity(cities[0]);
      }
    }
  }, [hospitalsList]);

  useEffect(() => {
    const activeHosp = hospitalsList.filter(h => h.status === "ACTIVE" && h.city === selectedCity);
    if (activeHosp.length > 0) {
      const areas = Array.from(new Set(activeHosp.map(h => h.area)));
      if (areas.length > 0 && (!selectedArea || !areas.includes(selectedArea))) {
        setSelectedArea(areas[0]);
      }
    } else {
      setSelectedArea("");
    }
  }, [selectedCity, hospitalsList]);

  // Toggle medicine reminder
  const handleToggleReminder = async (id: string) => {
    const allReminders = await Database.getReminders();
    const updated = allReminders.map(r => {
      if (r.id === id) {
        return { ...r, taken: !r.taken };
      }
      return r;
    });
    await Database.saveReminders(updated);
    setReminders(updated.filter(r => r.patient_id === user.id));
  };

  const handleAddFamilyMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!famName.trim()) {
      alert("Please enter a family member's full name.");
      return;
    }

    try {
      const newMember: FamilyMember = {
        id: crypto.randomUUID(),
        patient_id: user.id,
        full_name: famName,
        relationship: famRelationship,
        gender: famGender,
        dob: famDob || undefined
      };

      await Database.saveFamilyMembers([newMember]);
      setFamSuccess(true);
      setFamName("");
      setFamDob("");
      
      const famList = await Database.getFamilyMembers(user.id);
      setFamilyMembers(famList);

      setTimeout(() => setFamSuccess(false), 2000);
    } catch (err: any) {
      alert("Error adding family member: " + err.message);
    }
  };

  const handleDeleteFamilyMember = async (id: string) => {
    if (!confirm("Are you sure you want to delete this family member profile?")) return;
    try {
      await Database.deleteFamilyMember(id);
      const famList = await Database.getFamilyMembers(user.id);
      setFamilyMembers(famList);
    } catch (err: any) {
      alert("Error deleting family member: " + err.message);
    }
  };

  // Upgraded PDF Generation Templates
  const downloadPrescriptionPDF = (pr: Prescription, items: PrescriptionItem[]) => {
    const doc = new jsPDF();
    const apt = appointments.find(a => a.id === pr.appointment_id);
    const specialization = apt?.doctor_specialization || "Clinical Specialist";
    
    // Header box/border
    doc.setDrawColor(14, 165, 233);
    doc.setLineWidth(1.5);
    doc.line(10, 10, 200, 10);
    doc.line(10, 10, 10, 287);
    doc.line(200, 10, 200, 287);
    doc.line(10, 287, 200, 287);
    
    // Draw cross logo
    doc.setFillColor(14, 165, 233);
    doc.rect(20, 20, 15, 5, 'F');
    doc.rect(25, 15, 5, 15, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(11, 28, 48);
    doc.text(pr.hospital_name.toUpperCase(), 40, 23);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text("CAREFLOW HEALTHCARE PORTAL · SECURE CLINICAL PRESCRIPTION", 40, 28);
    
    doc.setLineWidth(0.5);
    doc.setDrawColor(220, 220, 220);
    doc.line(20, 35, 190, 35);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(11, 28, 48);
    doc.text("PATIENT INFORMATION", 20, 45);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${pr.patient_name}`, 20, 50);
    doc.text(`Gender: ${pr.patient_gender || "N/A"} · DOB: ${pr.patient_dob || "N/A"}`, 20, 55);
    
    doc.setFont("helvetica", "bold");
    doc.text("CLINICIAN INFORMATION", 120, 45);
    doc.setFont("helvetica", "normal");
    doc.text(`Doctor: Dr. ${pr.doctor_name}`, 120, 50);
    doc.text(`Specialization: ${specialization}`, 120, 55);
    doc.text(`Date: ${new Date(pr.created_at).toLocaleDateString()}`, 120, 60);
    
    doc.line(20, 65, 190, 65);
    
    doc.setFont("helvetica", "bold");
    doc.text("CLINICAL DIAGNOSIS", 20, 73);
    const diagnosisLines = doc.splitTextToSize(pr.diagnosis, 164);
    const boxHeight = diagnosisLines.length * 5 + 6;
    doc.setDrawColor(220, 220, 220);
    doc.rect(20, 76, 170, boxHeight);
    doc.setFont("helvetica", "normal");
    doc.text(diagnosisLines, 23, 81);
    
    const symptomY = 76 + boxHeight + 8;
    doc.setFont("helvetica", "bold");
    doc.text("RECORDED SYMPTOMS", 20, symptomY);
    const symptomsLines = doc.splitTextToSize(pr.symptoms || "None reported", 164);
    const symptomsBoxHeight = symptomsLines.length * 5 + 6;
    doc.rect(20, symptomY + 3, 170, symptomsBoxHeight);
    doc.setFont("helvetica", "normal");
    doc.text(symptomsLines, 23, symptomY + 8);
    
    const medHeaderY = symptomY + symptomsBoxHeight + 12;
    doc.setFont("helvetica", "bold");
    doc.text("MEDICATIONS PRESCRIBED", 20, medHeaderY);
    
    doc.setFillColor(245, 247, 250);
    doc.rect(20, medHeaderY + 5, 170, 8, 'F');
    
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text("Medicine Name", 22, medHeaderY + 10);
    doc.text("Dosage", 70, medHeaderY + 10);
    doc.text("Frequency", 95, medHeaderY + 10);
    doc.text("Duration", 130, medHeaderY + 10);
    doc.text("Instructions", 155, medHeaderY + 10);
    
    let y = medHeaderY + 18;
    items.forEach((item, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(20, y - 5, 170, 7, 'F');
      }
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(11, 28, 48);
      doc.text(item.medicine_name, 22, y);
      doc.text(item.dosage, 70, y);
      doc.text(item.frequency || "Daily", 95, y);
      doc.text(item.duration, 130, y);
      doc.text(item.instructions || "After Food", 155, y);
      
      doc.setDrawColor(240, 240, 240);
      doc.line(20, y + 2, 190, y + 2);
      
      y += 10;
    });
    
    if (pr.notes) {
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.text("LIFESTYLE INSTRUCTIONS & CLINICAL NOTES", 20, y);
      doc.setFont("helvetica", "normal");
      const notesLines = doc.splitTextToSize(pr.notes, 164);
      doc.text(notesLines, 20, y + 5);
      y += notesLines.length * 5 + 10;
    }
    
    doc.setDrawColor(200, 200, 200);
    doc.line(130, 245, 185, 245);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Dr. ${pr.doctor_name}`, 130, 250);
    doc.setFont("helvetica", "normal");
    doc.text(specialization, 130, 255);
    doc.text("Authorized Consulting Specialist", 130, 260);
    doc.text("Digitally Signed", 130, 265);
    
    doc.setFontSize(7);
    doc.setTextColor(155, 155, 155);
    doc.text("CareFlow Digital Network · Secure Health Document · Ref: RX-" + pr.id.substring(0,8).toUpperCase(), 20, 280);
    
    doc.save(`Prescription_${pr.patient_name.replace(/\s+/g, '_')}_${new Date(pr.created_at).toISOString().split('T')[0]}.pdf`);
  };

  const downloadLabReportPDF = (rep: LabReport) => {
    const doc = new jsPDF();
    
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(1.5);
    doc.line(10, 10, 200, 10);
    doc.line(10, 10, 10, 287);
    doc.line(200, 10, 200, 287);
    doc.line(10, 287, 200, 287);
    
    doc.setFillColor(16, 185, 129);
    doc.rect(20, 20, 15, 5, 'F');
    doc.rect(25, 15, 5, 15, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(11, 28, 48);
    const apt = appointments.find(a => a.id === rep.request_id || a.doctor_name === rep.doctor_name);
    const hospitalName = apt?.hospital_name || "CAREFLOW GENERAL HOSPITAL";
    doc.text(hospitalName.toUpperCase(), 40, 23);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text("CLINICAL BIOCHEMISTRY, HEMATOLOGY AND MEDICAL IMAGING RECORDS", 40, 28);
    
    doc.setLineWidth(0.5);
    doc.setDrawColor(220, 220, 220);
    doc.line(20, 35, 190, 35);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(11, 28, 48);
    doc.text("PATIENT DETAILED PROFILE", 20, 45);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${rep.patient_name}`, 20, 50);
    doc.text(`Patient UID: ${rep.patient_id.substring(0,8).toUpperCase()}`, 20, 55);
    
    doc.setFont("helvetica", "bold");
    doc.text("DIAGNOSTICS METADATA", 120, 45);
    doc.setFont("helvetica", "normal");
    doc.text(`Attending Doctor: Dr. ${rep.doctor_name}`, 120, 50);
    doc.text(`Finalization Date: ${new Date(rep.created_at).toLocaleDateString()}`, 120, 55);
    
    doc.line(20, 62, 190, 62);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`DIAGNOSTIC TEST REPORT: ${rep.test_name.toUpperCase()}`, 20, 71);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("PATHOLOGY PARAMETERS & FINDINGS", 20, 82);
    
    doc.setFillColor(248, 249, 250);
    doc.rect(20, 87, 170, 95, 'F');
    
    doc.setFont("courier", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(40, 50, 60);
    
    const lines = doc.splitTextToSize(rep.results_text, 160);
    doc.text(lines, 25, 94);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(11, 28, 48);
    doc.text("CLINICAL REFERENCE INDEX", 20, 192);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text("· Hemoglobin Rate: Male: 13.8 - 17.2 g/dL | Female: 12.1 - 15.1 g/dL", 20, 198);
    doc.text("· Pulse Rhythm: 60 - 100 bpm (Normal sinus rhythm)", 20, 204);
    doc.text("· MRI / X-Ray Findings: Consult radiologist clinical summaries.", 20, 210);
    
    const techProfile = profilesList.find(p => p.id === rep.uploaded_by);
    const techName = techProfile?.full_name || "Laboratory Specialist";
    
    doc.setLineWidth(0.5);
    doc.setDrawColor(200, 200, 200);
    doc.line(130, 245, 185, 245);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(techName, 130, 250);
    doc.setFont("helvetica", "normal");
    doc.text("CareFlow Clinic Pathology", 130, 255);
    doc.text("Verified & Authorized", 130, 260);
    
    doc.setFontSize(7);
    doc.setTextColor(155, 155, 155);
    doc.text("CareFlow Diagnostics · Secure Lab File · Ref: LAB-" + rep.id.substring(0,8).toUpperCase(), 20, 280);
    
    doc.save(`LabReport_${rep.patient_name.replace(/\s+/g, '_')}_${rep.test_name.replace(/\s+/g, '_')}.pdf`);
  };

  // Action: Book Appointment
  const handleConfirmBooking = async () => {
    if (!selectedHospitalId || !selectedDoctorId || !selectedDate || !selectedTimeSlot) {
      alert("Please select facility, doctor, date, and a valid timing slot.");
      return;
    }

    const hospitals = await Database.getHospitals();
    const hospital = hospitals.find(h => h.id === selectedHospitalId);
    
    const doctors = await Database.getDoctors();
    const docExt = doctors.find(d => d.id === selectedDoctorId);
    const docProfile = (await Database.getProfiles()).find(p => p.id === selectedDoctorId);

    if (!hospital || !docExt || !docProfile) {
      alert("Invalid selection config error.");
      return;
    }

    // Get dynamic token index and time slots
    const slotsObj = getDoctorSlots(selectedDoctorId, selectedDate);
    const matchedSlot = slotsObj.find(s => s.time === selectedTimeSlot);
    const tokenVal = matchedSlot ? matchedSlot.token : 1;

    const appts = await Database.getAppointments();

    const newAppointment: Appointment = {
      id: crypto.randomUUID(),
      patient_id: user.id,
      patient_name: bookingFor === "self" ? (profile?.full_name || "Unknown Patient") : bookingFor,
      doctor_id: selectedDoctorId,
      doctor_name: docProfile.full_name,
      doctor_specialization: docExt.specialization,
      hospital_id: hospital.id,
      hospital_name: hospital.hospital_name,
      date: selectedDate,
      time: selectedTimeSlot,
      token: tokenVal,
      status: AppointmentStatus.BOOKED,
      created_at: new Date().toISOString()
    };

    appts.unshift(newAppointment);
    await Database.saveAppointments(appts);

    // Log status change to audit logs
    await Database.logAppointmentStatusChange(newAppointment.id, null, AppointmentStatus.BOOKED, user.id);

    // Save notification with type APPOINTMENT
    await Database.addNotification(
      user.id,
      "Appointment Placed",
      `Your appointment token #${tokenVal} under ${docProfile.full_name} is confirmed.`,
      "APPOINTMENT"
    );

    // Notify doctor
    await Database.addNotification(
      selectedDoctorId,
      "New Appointment Booked",
      `Patient ${bookingFor === "self" ? (profile?.full_name || "Patient") : bookingFor} booked an appointment (Token #${tokenVal}) for ${selectedDate} at ${selectedTimeSlot}.`,
      "APPOINTMENT"
    );

    setBookingFor("self");
    
    // Create automatic private chat with doctor if none exists
    const currentChats = await Database.getChats();
    const existing = currentChats.find(c => 
      (c.participant1_id === user.id && c.participant2_id === selectedDoctorId) ||
      (c.participant1_id === selectedDoctorId && c.participant2_id === user.id)
    );
    if (!existing) {
      const activeChat: Chat = {
        id: crypto.randomUUID(),
        participant1_id: user.id,
        participant2_id: selectedDoctorId,
        participant1_name: profile?.full_name || "Unknown Patient",
        participant2_name: docProfile.full_name,
        participant1_role: UserRole.PATIENT,
        participant2_role: UserRole.DOCTOR,
        created_at: new Date().toISOString()
      };
      currentChats.push(activeChat);
      await Database.saveChats(currentChats);
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

    const allMsgs = await Database.getMessages();
    const newMsg: Message = {
      id: crypto.randomUUID(),
      chat_id: activeChatId,
      sender_id: user.id,
      text: chatInput,
      read_status: false,
      created_at: new Date().toISOString()
    };

    allMsgs.push(newMsg);
    await Database.saveMessages(allMsgs);

    // Notify recipient of chat message
    const activeChat = chats.find(c => c.id === activeChatId);
    if (activeChat) {
      const recipientId = activeChat.participant1_id === user.id ? activeChat.participant2_id : activeChat.participant1_id;
      await Database.addNotification(
        recipientId,
        "New message from Patient",
        `${profile?.full_name || "Patient"} sent: "${chatInput.substring(0, 40)}${chatInput.length > 40 ? "..." : ""}"`,
        "CHAT"
      );
    }

    setChatInput("");
    loadDatabase();

  };

  const viewingChatPartnerId = () => {
    const active = chats.find(c => c.id === activeChatId);
    if (!active) return null;
    return active.participant1_id === user.id ? active.participant2_id : active.participant1_id;
  };

  const currentChatMessages = messages.filter(m => m.chat_id === activeChatId);
  
  // Doctors and hospitals filter logic for Appointment Booking Form
  const uniqueCities = Array.from(new Set(hospitalsList.filter(h => h.status === 'ACTIVE').map(h => h.city)));
  const uniqueAreas = Array.from(new Set(hospitalsList.filter(h => h.status === 'ACTIVE' && h.city === selectedCity).map(h => h.area)));

  const availableHospitals = hospitalsList.filter(h => 
    h.status === 'ACTIVE' && 
    h.city === selectedCity && 
    h.area === selectedArea
  );
  const availableDoctors = doctorsList.filter(d => 
    d.hospital_id === selectedHospitalId &&
    d.specialization === selectedCategory
  );

  const getDocName = (docId: string) => {
    const prof = profilesList.find(p => p.id === docId);
    return prof ? prof.full_name : "Doctor";
  };

  const getDoctorSlots = (doctorId: string, dateStr: string) => {
    if (!dateStr) return [];
    const date = new Date(dateStr);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const selectedDayName = days[date.getDay()];
    
    const slots: { time: string; token: number }[] = [];
    const matchingAvailabilities = availabilityList.filter(
      a => a.doctor_id === doctorId && a.day_of_week === selectedDayName
    );

    let globalTokenCounter = 1;

    matchingAvailabilities.forEach(avail => {
      const startStr = avail.start_time; // e.g. "09:00:00"
      const endStr = avail.end_time;     // e.g. "13:00:00"
      const [startH, startM] = startStr.split(':').map(Number);
      const [endH, endM] = endStr.split(':').map(Number);
      
      let interval = 15; // default 15 mins
      if (avail.token_type === 'PER_HOUR') {
        interval = Math.max(1, Math.floor(60 / avail.max_tokens));
      }

      let currentH = startH;
      let currentM = startM;
      let count = 0;

      while (currentH < endH || (currentH === endH && currentM < endM)) {
        if (avail.token_type === 'PER_DAY' && count >= avail.max_tokens) {
          break;
        }

        const timeStr = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;
        slots.push({ time: timeStr, token: globalTokenCounter++ });
        count++;

        currentM += interval;
        if (currentM >= 60) {
          currentH += Math.floor(currentM / 60);
          currentM = currentM % 60;
        }
      }
    });

    return slots;
  };

  const isDoctorAvailableOnDate = (doctorId: string, dateStr: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const selectedDayName = days[date.getDay()];
    return availabilityList.some(a => a.doctor_id === doctorId && a.day_of_week === selectedDayName);
  };

  const hasNotifsCount = notifications.filter(n => !n.is_read).length;

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
              <h3 className="font-extrabold text-xs text-[#0b1c30]">{profile?.full_name || "Patient"}</h3>
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
              { id: "history", icon: History, label: "Medical History" },
              { id: "chat", icon: MessageSquare, label: "Clinical Chat" },
              { id: "reminders", icon: Clock, label: "Meds Reminders" },
              { id: "family", icon: Users, label: "Family Profiles" },
              { id: "notifications", icon: Bell, label: "Notification Center" }
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
                {tab.id === "notifications" && hasNotifsCount > 0 && (
                  <span className="bg-rose-500 text-white font-bold px-1.5 py-0.5 rounded-full text-[9px] ml-auto animate-pulse">
                    {hasNotifsCount}
                  </span>
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
                Database.getNotifications().then(async nots => {
                  nots.forEach(n => { if (n.user_id === user.id) n.is_read = true; });
                  await Database.saveNotifications(nots);
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
                  <Activity className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-2xl font-black text-rose-600">--/-- <span className="text-xs text-[#3e4850]">mmHg</span></div>
                <p className="text-[10px] text-slate-500 mt-1">No recorded data</p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-[#bec8d2]/30 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Pulse Rate</span>
                  <Activity className="w-4 h-4 text-teal-500" />
                </div>
                <div className="text-2xl font-black text-teal-600">-- <span className="text-xs text-[#3e4850]">bpm</span></div>
                <p className="text-[10px] text-slate-500 mt-1">No recorded data</p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-[#bec8d2]/30 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Height & Weight</span>
                  <Sparkles className="w-4 h-4 text-purple-500" />
                </div>
                <div className="text-2xl font-black text-purple-600">--cm / --kg <span className="text-xs text-[#3e4850]"></span></div>
                <p className="text-[10px] text-slate-500 mt-1">No recorded data</p>
              </div>
            </div>

            {/* Sub content (Meds list & Recent Prescription) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Daily Medicine scheduler */}
              <div className="bg-white rounded-xl border border-[#bec8d2]/30 p-5 shadow-xs">
                <h3 className="font-extrabold text-xs uppercase text-[#0b1c30] tracking-wider mb-4">Today's Medicine Schedule</h3>
                {(() => {
                  const todayStr = new Date().toISOString().split("T")[0];
                  const todaysReminders = reminders.filter(r => r.dateStr === todayStr);

                  if (todaysReminders.length === 0) {
                    return <p className="text-xs text-slate-400">No diagnostic medication reminders set for today.</p>;
                  }

                  return (
                    <div className="space-y-2">
                      {todaysReminders.map(rem => (
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
                  );
                })()}
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
                      onChange={(e) => { setSelectedCity(e.target.value); setSelectedHospitalId(""); setSelectedDoctorId(""); }}
                      className="w-full px-3 py-2 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none"
                    >
                      {uniqueCities.length === 0 ? (
                        <option value="">-- No Approved Cities --</option>
                      ) : (
                        uniqueCities.map(c => <option key={c} value={c}>{c}</option>)
                      )}
                    </select>
                  </div>

                  {/* Step 2: Select Area */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Step 2: Select Area</label>
                    <select 
                      value={selectedArea} 
                      onChange={(e) => { setSelectedArea(e.target.value); setSelectedHospitalId(""); setSelectedDoctorId(""); }}
                      className="w-full px-3 py-2 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none"
                    >
                      {uniqueAreas.length === 0 ? (
                        <option value="">-- No Approved Areas --</option>
                      ) : (
                        uniqueAreas.map(a => <option key={a} value={a}>{a}</option>)
                      )}
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
                      <option key={h.id} value={h.id}>{h.hospital_name} ({h.address}, {h.area})</option>
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
                      const isAvailable = isDoctorAvailableOnDate(selectedDoctorId, selectedDate);
                      
                      if (!isAvailable) {
                        return (
                          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs font-semibold">
                            ⚠️ Doctor is not available on this day of the week. Please select another date.
                          </div>
                        );
                      }

                      const slots = getDoctorSlots(selectedDoctorId, selectedDate);
                      
                      return (
                        <div className="bg-[#f8f9ff] p-4 rounded-lg border border-teal-200">
                          <label className="block text-[10px] font-black text-[#006591] uppercase mb-2">Step 7: Choose Time & Token Slot</label>
                          <div className="flex flex-wrap gap-2 text-center">
                            {slots.map((slot) => {
                              const isBooked = appointments.some(a => 
                                a.doctor_id === selectedDoctorId && 
                                a.date === selectedDate && 
                                a.time === slot.time && 
                                a.status !== AppointmentStatus.CANCELLED
                              );

                              return (
                                <button
                                  key={slot.time}
                                  type="button"
                                  disabled={isBooked}
                                  onClick={() => setSelectedTimeSlot(slot.time)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                    isBooked 
                                      ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" 
                                      : selectedTimeSlot === slot.time 
                                        ? "bg-teal-600 text-white border-teal-600" 
                                        : "bg-white text-slate-700 hover:bg-slate-50 border-[#bec8d2]"
                                  }`}
                                >
                                  {slot.time} {isBooked ? "(Booked)" : `(Token #${slot.token})`}
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
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <div className="bg-stone-50 p-4 rounded-lg border border-slate-200 text-left">
                      <label className="block text-[10px] font-bold text-[#3e4850] uppercase mb-1.5">Who is this appointment for?</label>
                      <select
                        value={bookingFor}
                        onChange={(e) => setBookingFor(e.target.value)}
                        className="px-3 py-2 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none focus:border-[#006591]"
                      >
                        <option value="self">Self ({profile?.full_name})</option>
                        {familyMembers.map(fam => (
                          <option key={fam.id} value={fam.full_name}>{fam.full_name} ({fam.relationship})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end gap-3">
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
                        className="bg-[#006591] hover:bg-[#004c6e] text-white font-extrabold text-xs px-6 py-2.5 rounded-lg shadow-sm"
                      >
                        Confirm Booking & Allocate Token
                      </button>
                    </div>
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

            {/* Search & Filter Controls */}
            {(() => {
              const [aptSearch, setAptSearch] = React.useState("");
              const [aptStatusFilter, setAptStatusFilter] = React.useState("ALL");

              const filteredAppointments = appointments.filter(apt => {
                const matchesSearch = !aptSearch.trim() || 
                  apt.doctor_name.toLowerCase().includes(aptSearch.toLowerCase()) ||
                  apt.hospital_name.toLowerCase().includes(aptSearch.toLowerCase());
                const matchesStatus = aptStatusFilter === "ALL" || apt.status === aptStatusFilter;
                return matchesSearch && matchesStatus;
              });

              return (
                <>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by doctor name or hospital..."
                        value={aptSearch}
                        onChange={(e) => setAptSearch(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 border border-[#bec8d2] rounded-lg text-xs focus:outline-none focus:border-[#006591] bg-white"
                      />
                    </div>
                    <select
                      value={aptStatusFilter}
                      onChange={(e) => setAptStatusFilter(e.target.value)}
                      className="px-3 py-2.5 border border-[#bec8d2] rounded-lg text-xs font-semibold bg-white focus:outline-none focus:border-[#006591] min-w-[160px]"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="BOOKED">BOOKED</option>
                      <option value="CHECKED_IN">CHECKED_IN</option>
                      <option value="IN_CONSULTATION">IN_CONSULTATION</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>

                  <div className="bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs">
                    {filteredAppointments.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        {appointments.length === 0 ? "You have no scheduled appointments found." : "No appointments match your search criteria."}
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {filteredAppointments.map(apt => (
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
                                    const appts = await Database.getAppointments();
                                    const updated = appts.map(a => a.id === apt.id ? { ...a, status: AppointmentStatus.CANCELLED } : a);
                                    await Database.saveAppointments(updated);
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
                </>
              );
            })()}
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
                        <div className="flex gap-2 shrink-0">
                          <button 
                            onClick={() => setViewingPrescription(pr)}
                            className="bg-stone-50 border border-[#bec8d2] text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-slate-100 flex items-center gap-1.5 text-slate-700"
                          >
                            <Eye className="w-3.5 h-3.5" /> Preview
                          </button>
                          <button 
                            onClick={() => downloadPrescriptionPDF(pr, prescItems)}
                            className="bg-[#006591] text-white text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-[#004c6e] flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" /> PDF
                          </button>
                        </div>
                      </div>

                      <div className="pt-4 space-y-2">
                        <span className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">PRESCRIBED MEDICATIONS</span>
                        {prescItems.length === 0 ? (
                          <p className="text-xs text-slate-400">No pharmacotherapy records.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {prescItems.map(item => (
                              <div key={item.id} className="bg-stone-50 border border-slate-200/50 p-3 rounded-lg text-xs leading-relaxed text-left">
                                <p className="font-bold text-[#0b1c30]">{item.medicine_name}</p>
                                <p className="text-slate-500">Dosage: {item.dosage} · Duration: {item.duration}</p>
                                {item.frequency && <p className="text-slate-500 text-[10px]">Frequency: <span className="font-bold">{item.frequency}</span></p>}
                                {item.instructions && <p className="text-indigo-600 font-semibold text-[10px]">{item.instructions}</p>}
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
        {/* LAB REPORTS TAB */}
        {activeTab === "labs" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Your Laboratory Test Reports</h1>
              <p className="text-xs text-[#3e4850]">View active laboratory requests and pathology reports.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Requested / Active Tests Column */}
              <div className="space-y-4">
                <h3 className="font-extrabold text-sm uppercase text-[#0b1c30] tracking-wider border-b pb-2">Requested Tests</h3>
                {labRequests.filter(r => r.status === LabRequestStatus.PENDING || r.status === LabRequestStatus.IN_PROGRESS).length === 0 ? (
                  <div className="bg-white p-6 border border-[#bec8d2]/30 rounded-xl text-center text-slate-400 text-xs">No active laboratory requests.</div>
                ) : (
                  <div className="space-y-3">
                    {labRequests.filter(r => r.status === LabRequestStatus.PENDING || r.status === LabRequestStatus.IN_PROGRESS).map(req => (
                      <div key={req.id} className="bg-white border border-[#bec8d2]/30 rounded-xl p-4 shadow-xs space-y-2 text-left">
                        <div className="flex justify-between items-center">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            req.status === LabRequestStatus.IN_PROGRESS ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                          }`}>
                            {req.status === LabRequestStatus.IN_PROGRESS ? "IN PROGRESS" : "PENDING"}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">{new Date(req.created_at).toLocaleDateString()}</span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm">{req.test_name}</h4>
                        <p className="text-[10px] text-slate-500">Ordered by: Dr. {req.doctor_name}</p>
                        {req.instructions && (
                          <div className="p-2 bg-stone-50 border border-slate-100 rounded text-[10px] text-slate-650">
                            <strong>Instructions:</strong> {req.instructions}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Completed Pathology Reports Column */}
              <div className="space-y-4">
                <h3 className="font-extrabold text-sm uppercase text-[#0b1c30] tracking-wider border-b pb-2">Finalized Reports</h3>
                {labReports.length === 0 ? (
                  <div className="bg-white p-6 border border-[#bec8d2]/30 rounded-xl text-center text-slate-400 text-xs">No reports generated yet.</div>
                ) : (
                  <div className="space-y-3">
                    {labReports.map(rep => (
                      <div key={rep.id} className="bg-white border border-[#bec8d2]/30 rounded-xl p-4 shadow-xs flex justify-between items-center gap-4 text-left">
                        <div>
                          <span className="text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                            🔬 COMPLETED
                          </span>
                          <h4 className="font-bold text-slate-800 text-sm mt-1">{rep.test_name}</h4>
                          <p className="text-[10px] text-slate-450 mt-0.5">
                            By Dr. {rep.doctor_name} · {new Date(rep.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button 
                            onClick={() => setViewingLabReport(rep)}
                            className="bg-white text-slate-700 border border-[#bec8d2] text-[10px] font-bold px-2.5 py-1.5 rounded-md hover:bg-slate-50 flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Read
                          </button>
                          <button 
                            onClick={() => downloadLabReportPDF(rep)}
                            className="bg-[#006591] text-white text-[10px] font-bold px-2.5 py-1.5 rounded-md hover:bg-[#004c6e] flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" /> PDF
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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

            {(() => {
              const todayStr = new Date().toISOString().split("T")[0];
              const now = new Date();
              const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

              // Calculations for Today
              const todayReminders = reminders.filter(r => r.dateStr === todayStr);
              const totalToday = todayReminders.length;
              const takenToday = todayReminders.filter(r => r.taken).length;
              const missedToday = todayReminders.filter(r => !r.taken && r.time < currentHHMM).length;
              const pendingToday = todayReminders.filter(r => !r.taken && r.time >= currentHHMM).length;

              // Upcoming dates (next 3 days)
              const upcomingDates = Array.from({ length: 3 }).map((_, i) => {
                const d = new Date();
                d.setDate(now.getDate() + 1 + i);
                return d.toISOString().split("T")[0];
              });

              const upcomingReminders = reminders.filter(r => upcomingDates.includes(r.dateStr));

              return (
                <div className="space-y-6">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-[#bec8d2]/30 rounded-xl p-4 shadow-xs">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase">Total Today</span>
                      <div className="text-2xl font-black text-[#0b1c30] mt-1">{totalToday}</div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-xs">
                      <span className="text-[10px] text-emerald-700 font-extrabold uppercase">Taken</span>
                      <div className="text-2xl font-black text-emerald-800 mt-1">{takenToday}</div>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 shadow-xs">
                      <span className="text-[10px] text-rose-700 font-extrabold uppercase">Missed</span>
                      <div className="text-2xl font-black text-rose-800 mt-1">{missedToday}</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-xs">
                      <span className="text-[10px] text-amber-700 font-extrabold uppercase">Pending</span>
                      <div className="text-2xl font-black text-amber-800 mt-1">{pendingToday}</div>
                    </div>
                  </div>

                  {/* Today's Section */}
                  <div className="bg-white border border-[#bec8d2]/30 rounded-xl p-6 shadow-xs space-y-4">
                    <h3 className="font-extrabold text-sm text-[#0b1c30] border-b pb-2">Today's Scheduled Medications</h3>
                    {todayReminders.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400">No medications scheduled for today.</div>
                    ) : (
                      <div className="space-y-3">
                        {todayReminders.map(rem => {
                          let statusText = "PENDING";
                          let badgeStyle = "bg-amber-100 text-amber-800 border-amber-200";
                          if (rem.taken) {
                            statusText = "TAKEN";
                            badgeStyle = "bg-emerald-100 text-emerald-800 border-emerald-200";
                          } else if (rem.time < currentHHMM) {
                            statusText = "MISSED";
                            badgeStyle = "bg-rose-100 text-rose-800 border-rose-200";
                          }

                          return (
                            <div 
                              key={rem.id}
                              className={`p-4 border rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 transition-all ${
                                rem.taken 
                                  ? "bg-slate-50 border-emerald-100 opacity-80" 
                                  : statusText === "MISSED"
                                    ? "bg-rose-50/20 border-rose-100"
                                    : "bg-white border-[#bec8d2]/40"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div 
                                  onClick={() => handleToggleReminder(rem.id)}
                                  className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer ${
                                    rem.taken ? "bg-emerald-600 border-emerald-600 text-white" : "border-[#bec8d2] bg-white hover:border-[#006591]"
                                  }`}
                                >
                                  {rem.taken && <CheckCircle className="w-3.5 h-3.5 shrink-0" />}
                                </div>
                                <div>
                                  <h4 className="font-bold text-xs text-[#0b1c30]">{rem.medicine_name}</h4>
                                  <p className="text-[10px] text-slate-500">Dosage: {rem.dosage} · Scheduled: {rem.time}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 self-end sm:self-auto">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase ${badgeStyle}`}>
                                  {statusText}
                                </span>
                                {!rem.taken && statusText === "PENDING" && (
                                  <button
                                    onClick={() => handleToggleReminder(rem.id)}
                                    className="bg-[#006591] hover:bg-[#004c6e] text-white text-[10px] font-bold px-3 py-1 rounded transition-colors"
                                  >
                                    Mark as Taken
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Upcoming Section */}
                  <div className="bg-white border border-[#bec8d2]/30 rounded-xl p-6 shadow-xs space-y-4">
                    <h3 className="font-extrabold text-sm text-[#0b1c30] border-b pb-2">Upcoming Schedule (Next 3 Days)</h3>
                    {upcomingReminders.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400">No upcoming medications scheduled.</div>
                    ) : (
                      <div className="space-y-6">
                        {upcomingDates.map(date => {
                          const dateReminders = upcomingReminders.filter(r => r.dateStr === date);
                          if (dateReminders.length === 0) return null;

                          // Format Date
                          const formattedDate = new Date(date).toLocaleDateString(undefined, {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric'
                          });

                          return (
                            <div key={date} className="space-y-2">
                              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">{formattedDate}</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {dateReminders.map(rem => (
                                  <div key={rem.id} className="p-3 border border-slate-100 bg-slate-50/50 rounded-lg flex justify-between items-center">
                                    <div>
                                      <h5 className="font-bold text-xs text-[#0b1c30]">{rem.medicine_name}</h5>
                                      <p className="text-[9px] text-slate-500">Dosage: {rem.dosage} · Scheduled: {rem.time}</p>
                                    </div>
                                    <span className="text-[8px] bg-slate-200 text-slate-600 font-extrabold px-1.5 py-0.5 rounded border border-slate-300/30">
                                      UPCOMING
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* MEDICAL HISTORY TIMELINE TAB */}
        {activeTab === "history" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Longitudinal Medical History</h1>
              <p className="text-xs text-[#3e4850]">Chronological log of appointments, prescriptions, and lab test results.</p>
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl p-6 shadow-xs">
              {(() => {
                const appointmentEvents = appointments.map(a => ({
                  id: a.id,
                  type: "APPOINTMENT",
                  date: a.date,
                  title: `Appointment Booked - ${a.doctor_specialization}`,
                  subtitle: `With Dr. ${a.doctor_name} at ${a.hospital_name}`,
                  details: `Time Slot: ${a.time} | Token: #${a.token}`,
                  status: a.status
                }));

                const prescriptionEvents = prescriptions.map(p => {
                  const prescItems = prescriptionItems.filter(item => item.prescription_id === p.id);
                  return {
                    id: p.id,
                    type: "PRESCRIPTION",
                    date: p.created_at.split("T")[0],
                    title: `Rx Prescription Released`,
                    subtitle: `Diagnosis: ${p.diagnosis} (by Dr. ${p.doctor_name})`,
                    details: `Symptoms: ${p.symptoms || "None reported"}\nAdvices: ${p.notes || "None"}\nMedications:\n${prescItems.map(m => `- ${m.medicine_name}: ${m.dosage} for ${m.duration}`).join("\n")}`,
                    status: undefined as string | undefined
                  };
                });

                const labEvents = labReports.map(r => ({
                  id: r.id,
                  type: "LAB_REPORT",
                  date: r.created_at.split("T")[0],
                  title: `Diagnostic Lab Report: ${r.test_name}`,
                  subtitle: `Completed by Lab Specialist for Dr. ${r.doctor_name}`,
                  details: r.results_text,
                  status: undefined as string | undefined
                }));

                const timelineEvents = [...appointmentEvents, ...prescriptionEvents, ...labEvents].sort(
                  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                );

                if (timelineEvents.length === 0) {
                  return <p className="text-xs text-slate-400 text-center py-6">No historical records found for this patient profile.</p>;
                }

                return (
                  <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-8">
                    {timelineEvents.map((event, idx) => {
                      let badgeColor = "bg-sky-100 text-[#006591]";
                      let Icon = Calendar;
                      if (event.type === "PRESCRIPTION") {
                        badgeColor = "bg-emerald-100 text-emerald-800";
                        Icon = ClipboardList;
                      } else if (event.type === "LAB_REPORT") {
                        badgeColor = "bg-purple-100 text-purple-800";
                        Icon = FileText;
                      }

                      return (
                        <div key={idx} className="relative">
                          {/* Circle marker */}
                          <span className="absolute -left-[35px] top-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-white border-2 border-slate-200">
                            <Icon className="w-3.5 h-3.5 text-slate-550" />
                          </span>
                          
                          {/* Event Card */}
                          <div className="bg-stone-50 border border-slate-200/55 rounded-lg p-4 text-xs space-y-2">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                              <div>
                                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${badgeColor}`}>
                                  {event.type}
                                </span>
                                <h4 className="font-extrabold text-sm text-[#0b1c30] mt-1">{event.title}</h4>
                                <p className="text-slate-500 font-semibold mt-0.5">{event.subtitle}</p>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono font-bold shrink-0">
                                {event.date}
                              </span>
                            </div>
                            
                            <div className="text-[#3e4850] whitespace-pre-wrap leading-relaxed border-t border-slate-100 pt-2 mt-2 font-medium">
                              {event.details}
                            </div>

                            {event.status && (
                              <div className="mt-1.5 flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Status:</span>
                                <span className="text-[9px] bg-slate-200 px-1.5 py-0.5 rounded font-black text-slate-700">
                                  {event.status}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* FAMILY PROFILES TAB */}
        {activeTab === "family" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#0b1c30]">Family Profiles Management</h1>
              <p className="text-xs text-[#3e4850]">Add and manage your family members to book appointments on their behalf.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Add Family Member Form */}
              <div className="lg:col-span-1 bg-white border border-[#bec8d2]/30 rounded-xl p-6 shadow-xs space-y-4 text-left">
                <h3 className="font-extrabold text-xs uppercase text-[#0b1c30] tracking-wider border-b pb-2">Add Family Member</h3>
                
                {famSuccess && (
                  <div className="bg-emerald-50 border border-emerald-400 text-emerald-800 p-3 rounded text-xs font-bold text-center">
                    ✓ Family member profile added!
                  </div>
                )}

                <form onSubmit={handleAddFamilyMember} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe Sr."
                      value={famName}
                      onChange={(e) => setFamName(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Relationship</label>
                      <select
                        value={famRelationship}
                        onChange={(e) => setFamRelationship(e.target.value)}
                        className="w-full px-3 py-2 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none"
                      >
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Child">Child</option>
                        <option value="Spouse">Spouse</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Gender</label>
                      <select
                        value={famGender}
                        onChange={(e) => setFamGender(e.target.value)}
                        className="w-full px-3 py-2 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={famDob}
                      onChange={(e) => setFamDob(e.target.value)}
                      className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#006591] hover:bg-[#004c6e] text-white text-xs font-bold py-2.5 rounded shadow-xs"
                  >
                    Register Member Profile
                  </button>
                </form>
              </div>

              {/* Family Roster list */}
              <div className="lg:col-span-2 bg-white border border-[#bec8d2]/30 rounded-xl p-6 shadow-xs text-left">
                <h3 className="font-extrabold text-xs uppercase text-[#0b1c30] tracking-wider border-b pb-2 mb-4">
                  Registered Family Members ({familyMembers.length})
                </h3>

                {familyMembers.length === 0 ? (
                  <div className="text-center p-8 text-xs text-slate-400">No family members registered yet.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {familyMembers.map(member => (
                      <div key={member.id} className="py-4 flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-sm text-[#0b1c30]">{member.full_name}</h4>
                          <p className="text-xs text-slate-500">
                            Relationship: <span className="font-bold text-[#0ea5e9]">{member.relationship}</span> · Gender: {member.gender || "N/A"} · DOB: {member.dob || "N/A"}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteFamilyMember(member.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-bold"
                        >
                          Delete Profile
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
        {activeTab === "notifications" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-black text-[#0b1c30]">Platform Notification Center</h1>
                <p className="text-xs text-[#3e4850]">View recent alerts, appointment notifications, and prescription updates.</p>
              </div>
              {hasNotifsCount > 0 && (
                <button 
                  onClick={async () => {
                    const nots = await Database.getNotifications();
                    nots.forEach(n => { if (n.user_id === user.id) n.is_read = true; });
                    await Database.saveNotifications(nots);
                    loadDatabase();
                  }}
                  className="bg-[#006591] hover:bg-[#004c6e] text-white text-xs font-bold px-4 py-2 rounded-lg"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="bg-white border border-[#bec8d2]/30 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">Your notification history is empty.</p>
              ) : (
                notifications.map(n => {
                  let typeColor = "bg-slate-100 text-slate-700";
                  if (n.type === "APPOINTMENT") typeColor = "bg-sky-100 text-[#006591]";
                  if (n.type === "PRESCRIPTION") typeColor = "bg-emerald-100 text-emerald-800";
                  if (n.type === "LAB_REPORT") typeColor = "bg-purple-100 text-purple-800";
                  if (n.type === "CHAT") typeColor = "bg-amber-100 text-amber-800";

                  return (
                    <div key={n.id} className={`p-5 flex justify-between items-start gap-4 transition-colors ${!n.is_read ? "bg-[#eff4ff]/20" : ""}`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${typeColor}`}>
                            {n.type}
                          </span>
                          {!n.is_read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          )}
                          <h4 className="font-extrabold text-sm text-[#0b1c30]">{n.title}</h4>
                        </div>
                        <p className="text-xs text-[#3e4850] leading-relaxed font-medium">{n.message}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-2">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                      
                      {!n.is_read && (
                        <button
                          onClick={async () => {
                            const nots = await Database.getNotifications();
                            const updated = nots.map(item => item.id === n.id ? { ...item, is_read: true } : item);
                            await Database.saveNotifications(updated);
                            loadDatabase();
                          }}
                          className="text-[10px] text-[#006591] hover:underline font-bold shrink-0"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  );
                })
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
