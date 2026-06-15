import { supabase } from "./supabaseClient";
import { 
  User, Profile, Hospital, HospitalAdminExt, DoctorExt, ReceptionistExt, LabTechnicianExt, 
  Appointment, Prescription, PrescriptionItem, LabRequest, LabReport, 
  Notification, Chat, Message, MedicineReminder, UserRole, UserStatus, 
  AppointmentStatus, LabRequestStatus 
} from "./types";

export class MockDB {
  static async getUsers(): Promise<User[]> {
    const { data } = await supabase.from('users').select('*');
    return data || [];
  }

  static async getProfiles(): Promise<Profile[]> {
    const { data } = await supabase.from('profiles').select('*');
    return data || [];
  }

  static async getHospitals(): Promise<Hospital[]> {
    const { data } = await supabase.from('hospitals').select('*');
    return data || [];
  }

  static async getDoctors(): Promise<DoctorExt[]> {
    const { data } = await supabase.from('doctors').select('*');
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
    const { data } = await supabase.from('receptionists').select('*');
    return data || [];
  }

  static async getLabTechs(): Promise<LabTechnicianExt[]> {
    const { data } = await supabase.from('lab_technicians').select('*');
    return data || [];
  }

  static async getAppointments(): Promise<Appointment[]> {
    const { data } = await supabase.from('appointments').select('*').order('created_at', { ascending: false });
    return data || [];
  }

  static async getPrescriptions(): Promise<Prescription[]> {
    const { data } = await supabase.from('prescriptions').select('*').order('created_at', { ascending: false });
    return data || [];
  }

  static async getPrescriptionItems(): Promise<PrescriptionItem[]> {
    const { data } = await supabase.from('prescription_items').select('*');
    return data || [];
  }

  static async getLabRequests(): Promise<LabRequest[]> {
    const { data } = await supabase.from('lab_requests').select('*').order('created_at', { ascending: false });
    return data || [];
  }

  static async getLabReports(): Promise<LabReport[]> {
    const { data } = await supabase.from('lab_reports').select('*').order('created_at', { ascending: false });
    return data || [];
  }

  static async getNotifications(): Promise<Notification[]> {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
    return data || [];
  }

  static async getChats(): Promise<Chat[]> {
    const { data } = await supabase.from('chats').select('*');
    return data || [];
  }

  static async getMessages(): Promise<Message[]> {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    return data || [];
  }

  static async getReminders(): Promise<MedicineReminder[]> {
    const { data } = await supabase.from('medicine_reminders').select('*');
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
    await supabase.from('users').upsert(data);
  }

  static async saveProfiles(data: Profile[]) {
    await supabase.from('profiles').upsert(data);
  }

  static async saveHospitals(data: Hospital[]) {
    await supabase.from('hospitals').upsert(data);
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
    await supabase.from('doctors').upsert(mapped);
  }

  static async saveReceptionists(data: ReceptionistExt[]) {
    await supabase.from('receptionists').upsert(data);
  }

  static async saveLabTechs(data: LabTechnicianExt[]) {
    await supabase.from('lab_technicians').upsert(data);
  }

  static async saveAppointments(data: Appointment[]) {
    await supabase.from('appointments').upsert(data);
  }

  static async savePrescriptions(data: Prescription[]) {
    await supabase.from('prescriptions').upsert(data);
  }

  static async savePrescriptionItems(data: PrescriptionItem[]) {
    await supabase.from('prescription_items').upsert(data);
  }

  static async saveLabRequests(data: LabRequest[]) {
    await supabase.from('lab_requests').upsert(data);
  }

  static async saveLabReports(data: LabReport[]) {
    await supabase.from('lab_reports').upsert(data);
  }

  static async saveNotifications(data: Notification[]) {
    await supabase.from('notifications').upsert(data);
  }

  static async saveChats(data: Chat[]) {
    await supabase.from('chats').upsert(data);
  }

  static async saveMessages(data: Message[]) {
    await supabase.from('messages').upsert(data);
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
    await supabase.from('medicine_reminders').upsert(mapped);
  }

  static async addNotification(userId: string, title: string, message: string) {
    await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      read: false
    });
  }

  static async getHospitalAdminHospitalId(userId: string): Promise<string> {
    const { data } = await supabase.from('hospital_admins').select('hospital_id').eq('id', userId).maybeSingle();
    return data?.hospital_id || '';
  }
}
