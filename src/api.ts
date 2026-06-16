import { supabase } from "./supabaseClient";
import { 
  User, Profile, Hospital, HospitalAdminExt, DoctorExt, ReceptionistExt, LabTechnicianExt, 
  Appointment, Prescription, PrescriptionItem, LabRequest, LabReport, 
  Notification, Chat, Message, MedicineReminder, UserRole, UserStatus, 
  AppointmentStatus, LabRequestStatus, DoctorAvailability, FamilyMember, StaffActivityLog
} from "./types";


export class Database {
  static async getUsers(): Promise<User[]> {
    const { data, error } = await supabase.from('users').select('*');
    if (error) {
      console.error("Error fetching users:", error.message);
      throw error;
    }
    return data || [];
  }

  static async getProfiles(): Promise<Profile[]> {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) {
      console.error("Error fetching profiles:", error.message);
      throw error;
    }
    return data || [];
  }

  static async getHospitals(): Promise<Hospital[]> {
    const { data, error } = await supabase.from('hospitals').select('*');
    if (error) {
      console.error("Error fetching hospitals:", error.message);
      throw error;
    }
    return data || [];
  }

  static async getDoctors(): Promise<DoctorExt[]> {
    const { data, error } = await supabase.from('doctors').select('*');
    if (error) {
      console.error("Error fetching doctors:", error.message);
      throw error;
    }
    return (data || []).map(d => ({
      ...d,
      experience: d.experience ? `${d.experience} years` : "0 years",
      available_days: d.available_days || 'Monday,Tuesday,Wednesday,Thursday,Friday',
      available_timings: d.available_timings || '09:00-13:00,14:00-18:00',
      token_limit: d.token_limit || 50,
      token_type: d.token_type || 'PER_DAY'
    }));
  }

  static async getReceptionists(): Promise<ReceptionistExt[]> {
    const { data, error } = await supabase.from('receptionists').select('*');
    if (error) {
      console.error("Error fetching receptionists:", error.message);
      throw error;
    }
    return data || [];
  }

  static async getLabTechs(): Promise<LabTechnicianExt[]> {
    const { data, error } = await supabase.from('lab_technicians').select('*');
    if (error) {
      console.error("Error fetching lab technicians:", error.message);
      throw error;
    }
    return data || [];
  }

  static async getAppointments(): Promise<Appointment[]> {
    const { data, error } = await supabase.from('appointments').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error("Error fetching appointments:", error.message);
      throw error;
    }
    return data || [];
  }

  static async getPrescriptions(): Promise<Prescription[]> {
    const { data, error } = await supabase.from('prescriptions').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error("Error fetching prescriptions:", error.message);
      throw error;
    }
    return data || [];
  }

  static async getPrescriptionItems(): Promise<PrescriptionItem[]> {
    const { data, error } = await supabase.from('prescription_items').select('*');
    if (error) {
      console.error("Error fetching prescription items:", error.message);
      throw error;
    }
    return data || [];
  }

  static async getLabRequests(): Promise<LabRequest[]> {
    const { data, error } = await supabase.from('lab_requests').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error("Error fetching lab requests:", error.message);
      throw error;
    }
    return data || [];
  }

  static async getLabReports(): Promise<LabReport[]> {
    const { data, error } = await supabase.from('lab_reports').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error("Error fetching lab reports:", error.message);
      throw error;
    }
    return data || [];
  }

  static async getNotifications(): Promise<Notification[]> {
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error("Error fetching notifications:", error.message);
      throw error;
    }
    return data || [];
  }

  static async getChats(): Promise<Chat[]> {
    const { data, error } = await supabase.from('chats').select('*');
    if (error) {
      console.error("Error fetching chats:", error.message);
      throw error;
    }
    return data || [];
  }

  static async getMessages(): Promise<Message[]> {
    const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (error) {
      console.error("Error fetching messages:", error.message);
      throw error;
    }
    return data || [];
  }

  static async getReminders(): Promise<MedicineReminder[]> {
    const { data, error } = await supabase.from('medicine_reminders').select('*');
    if (error) {
      console.error("Error fetching medicine reminders:", error.message);
      throw error;
    }
    return (data || []).map(r => ({
      id: r.id,
      patient_id: r.patient_id,
      prescription_id: r.prescription_id,
      medicine_name: r.medicine_name,
      time: r.time,
      dosage: r.dosage,
      taken: r.taken,
      dateStr: r.date_str
    }));
  }

  // Savers
  static async saveUsers(data: User[]) {
    const { error } = await supabase.from('users').upsert(data);
    if (error) {
      console.error("Error saving users:", error.message);
      throw error;
    }
  }

  static async saveProfiles(data: Profile[]) {
    const { error } = await supabase.from('profiles').upsert(data);
    if (error) {
      console.error("Error saving profiles:", error.message);
      throw error;
    }
  }

  static async saveHospitals(data: Hospital[]) {
    const { error } = await supabase.from('hospitals').upsert(data);
    if (error) {
      console.error("Error saving hospitals:", error.message);
      throw error;
    }
  }

  static async saveDoctors(data: DoctorExt[]) {
    const mapped = data.map(d => ({
      id: d.id,
      license_number: d.license_number,
      specialization: d.specialization,
      experience: parseInt(d.experience) || 0,
      hospital_id: d.hospital_id,
      city: d.city,
      area: d.area,
      approved: d.approved,
      available_days: d.available_days,
      available_timings: d.available_timings,
      token_limit: d.token_limit,
      token_type: d.token_type
    }));
    const { error } = await supabase.from('doctors').upsert(mapped);
    if (error) {
      console.error("Error saving doctors:", error.message);
      throw error;
    }
  }

  static async saveReceptionists(data: ReceptionistExt[]) {
    const { error } = await supabase.from('receptionists').upsert(data);
    if (error) {
      console.error("Error saving receptionists:", error.message);
      throw error;
    }
  }

  static async saveLabTechs(data: LabTechnicianExt[]) {
    const { error } = await supabase.from('lab_technicians').upsert(data);
    if (error) {
      console.error("Error saving lab technicians:", error.message);
      throw error;
    }
  }

  static async saveAppointments(data: Appointment[]) {
    const { error } = await supabase.from('appointments').upsert(data);
    if (error) {
      console.error("Error saving appointments:", error.message);
      throw error;
    }
  }

  static async savePrescriptions(data: Prescription[]) {
    const { error } = await supabase.from('prescriptions').upsert(data);
    if (error) {
      console.error("Error saving prescriptions:", error.message);
      throw error;
    }
  }

  static async savePrescriptionItems(data: PrescriptionItem[]) {
    const { error } = await supabase.from('prescription_items').upsert(data);
    if (error) {
      console.error("Error saving prescription items:", error.message);
      throw error;
    }
  }

  static async saveLabRequests(data: LabRequest[]) {
    const { error } = await supabase.from('lab_requests').upsert(data);
    if (error) {
      console.error("Error saving lab requests:", error.message);
      throw error;
    }
  }

  static async saveLabReports(data: LabReport[]) {
    const { error } = await supabase.from('lab_reports').upsert(data);
    if (error) {
      console.error("Error saving lab reports:", error.message);
      throw error;
    }
  }

  static async saveNotifications(data: Notification[]) {
    const { error } = await supabase.from('notifications').upsert(data);
    if (error) {
      console.error("Error saving notifications:", error.message);
      throw error;
    }
  }

  static async saveChats(data: Chat[]) {
    const { error } = await supabase.from('chats').upsert(data);
    if (error) {
      console.error("Error saving chats:", error.message);
      throw error;
    }
  }

  static async saveMessages(data: Message[]) {
    const { error } = await supabase.from('messages').upsert(data);
    if (error) {
      console.error("Error saving messages:", error.message);
      throw error;
    }
  }

  static async saveReminders(data: MedicineReminder[]) {
    const mapped = data.map(r => ({
      id: r.id,
      patient_id: r.patient_id,
      prescription_id: r.prescription_id,
      medicine_name: r.medicine_name,
      time: r.time,
      dosage: r.dosage,
      taken: r.taken,
      date_str: r.dateStr
    }));
    const { error } = await supabase.from('medicine_reminders').upsert(mapped);
    if (error) {
      console.error("Error saving medicine reminders:", error.message);
      throw error;
    }
  }

  static async addNotification(userId: string, title: string, message: string, type: 'APPOINTMENT' | 'PRESCRIPTION' | 'LAB_REPORT' | 'CHAT' | 'SYSTEM' = 'SYSTEM') {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      is_read: false
    });
    if (error) {
      console.error("Error adding notification:", error.message);
      throw error;
    }
  }

  static async getHospitalAdminHospitalId(userId: string): Promise<string> {
    const { data, error } = await supabase.from('hospital_admins').select('hospital_id').eq('id', userId).maybeSingle();
    if (error) {
      console.error("Error getting hospital admin's hospital ID:", error.message);
      throw error;
    }
    return data?.hospital_id || '';
  }

  // Doctor Availability Slots Methods
  static async getDoctorAvailability(doctorId: string): Promise<DoctorAvailability[]> {
    const { data, error } = await supabase.from('doctor_availability').select('*').eq('doctor_id', doctorId).order('day_of_week').order('start_time');
    if (error) {
      console.error("Error fetching doctor availability slots:", error.message);
      throw error;
    }
    return data || [];
  }

  static async saveDoctorAvailability(data: DoctorAvailability[]) {
    const { error } = await supabase.from('doctor_availability').upsert(data);
    if (error) {
      console.error("Error saving doctor availability slots:", error.message);
      throw error;
    }
  }

  static async deleteDoctorAvailability(id: string) {
    const { error } = await supabase.from('doctor_availability').delete().eq('id', id);
    if (error) {
      console.error("Error deleting doctor availability slot:", error.message);
      throw error;
    }
  }

  // Appointment Logs (Audit Trail) Methods
  static async logAppointmentStatusChange(appointmentId: string, oldStatus: AppointmentStatus | null, newStatus: AppointmentStatus, updatedBy: string | null) {
    const { error } = await supabase.from('appointment_logs').insert({
      appointment_id: appointmentId,
      old_status: oldStatus,
      new_status: newStatus,
      updated_by: updatedBy
    });
    if (error) {
      console.error("Error logging appointment status change:", error.message);
      throw error;
    }
  }

  // Family Profile Methods
  static async getFamilyMembers(patientId: string): Promise<FamilyMember[]> {
    const { data, error } = await supabase.from('family_members').select('*').eq('patient_id', patientId);
    if (error) {
      console.error("Error fetching family members:", error.message);
      throw error;
    }
    return data || [];
  }

  static async saveFamilyMembers(data: FamilyMember[]) {
    const { error } = await supabase.from('family_members').upsert(data);
    if (error) {
      console.error("Error saving family members:", error.message);
      throw error;
    }
  }

  static async deleteFamilyMember(id: string) {
    const { error } = await supabase.from('family_members').delete().eq('id', id);
    if (error) {
      console.error("Error deleting family member:", error.message);
      throw error;
    }
  }

  // Staff Activity Logging Methods
  static async logStaffActivity(actorId: string, actorName: string, actionType: string, details: string, hospitalId?: string): Promise<void> {
    const { error } = await supabase.from('staff_activity_logs').insert({
      id: crypto.randomUUID(),
      actor_id: actorId,
      actor_name: actorName,
      action_type: actionType,
      details: details,
      hospital_id: hospitalId || null,
      created_at: new Date().toISOString()
    });
    if (error) {
      console.error("Error logging staff activity:", error.message);
    }
  }

  static async getStaffActivityLogs(hospitalId?: string): Promise<any[]> {
    let query = supabase.from('staff_activity_logs').select('*').order('created_at', { ascending: false });
    if (hospitalId) {
      query = query.eq('hospital_id', hospitalId);
    }
    const { data, error } = await query;
    if (error) {
      console.error("Error fetching staff activity logs:", error.message);
      throw error;
    }
    return data || [];
  }
}

