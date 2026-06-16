export enum UserRole {
  MAIN_ADMIN = "MAIN_ADMIN",
  HOSPITAL_ADMIN = "HOSPITAL_ADMIN",
  DOCTOR = "DOCTOR",
  RECEPTIONIST = "RECEPTIONIST",
  LAB_TECHNICIAN = "LAB_TECHNICIAN",
  PATIENT = "PATIENT"
}

export enum UserStatus {
  ACTIVE = "ACTIVE",
  PENDING = "PENDING",
  SUSPENDED = "SUSPENDED",
  REJECTED = "REJECTED"
}

export enum AppointmentStatus {
  BOOKED = "BOOKED",
  CHECKED_IN = "CHECKED_IN",
  IN_CONSULTATION = "IN_CONSULTATION",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED"
}

export enum LabRequestStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED"
}

export interface User {
  id: string;
  email: string;
  phone?: string;
  role: UserRole;
  password?: string;
  status: UserStatus;
  created_at: string;
}

export interface Profile {
  id: string; // matches User.id
  full_name: string;
  gender?: string;
  dob?: string;
  address?: string;
}

export interface Hospital {
  id: string;
  hospital_name: string;
  email?: string;
  phone?: string;
  status: string; // ACTIVE | SUSPENDED
  address: string;
  city: string;
  area: string;
  state: string;
  pincode: string;
  approved: boolean;
  admin_user_id?: string;
  created_at: string;
}

export interface HospitalAdminExt {
  id: string;
  hospital_id: string;
}

export interface DoctorExt {
  id: string;
  license_number: string;
  specialization: string;
  experience: string; // years
  hospital_id: string;
  city: string;
  area: string;
  approved: boolean;
  available_days?: string;
  available_timings?: string;
  token_limit?: number;
  token_type?: string;
}

export interface DoctorAvailability {
  id: string;
  doctor_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  token_type: string; // "PER_HOUR" | "PER_DAY"
  max_tokens: number;
  created_at: string;
}

export interface ReceptionistExt {
  id: string;
  hospital_id: string;
  approved: boolean;
}

export interface LabTechnicianExt {
  id: string;
  qualification: string;
  hospital_id: string;
  approved: boolean;
}

export interface Appointment {
  id: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  doctor_specialization: string;
  hospital_id: string;
  hospital_name: string;
  date: string;
  time: string;
  token: number;
  status: AppointmentStatus;
  created_at: string;
}

export interface AppointmentLog {
  id: string;
  appointment_id: string;
  old_status: AppointmentStatus | null;
  new_status: AppointmentStatus;
  updated_by: string | null;
  updated_at: string;
}

export interface Prescription {
  id: string;
  appointment_id: string;
  doctor_id: string;
  doctor_name: string;
  patient_id: string;
  patient_name: string;
  patient_dob?: string;
  patient_gender?: string;
  hospital_id: string;
  hospital_name: string;
  symptoms: string;
  diagnosis: string;
  notes: string;
  created_at: string;
}

export interface PrescriptionItem {
  id: string;
  prescription_id: string;
  medicine_name: string;
  dosage: string; // e.g. "650mg"
  frequency?: string; // e.g. "Morning, Night"
  duration: string; // e.g. "5 days"
  instructions?: string; // e.g. "After Food"
  reminder_time: string; // e.g. "08:00, 20:00"
}

export interface LabRequest {
  id: string;
  doctor_id: string;
  doctor_name: string;
  patient_id: string;
  patient_name: string;
  appointment_id: string;
  hospital_id: string;
  test_name: string; // "Blood Test" etc.
  status: LabRequestStatus;
  instructions?: string;
  created_at: string;
}

export interface LabReport {
  id: string;
  request_id: string;
  test_name: string;
  doctor_name: string;
  patient_name: string;
  patient_id: string;
  results_text: string;
  uploaded_by: string; // User.id (Lab Tech)
  file_url?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'APPOINTMENT' | 'PRESCRIPTION' | 'LAB_REPORT' | 'CHAT' | 'SYSTEM';
  is_read: boolean;
  created_at: string;
}

export interface Chat {
  id: string;
  participant1_id: string;
  participant2_id: string;
  participant1_name: string;
  participant2_name: string;
  participant1_role: UserRole;
  participant2_role: UserRole;
  created_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  text: string;
  read_status: boolean;
  created_at: string;
}

export interface MedicineReminder {
  id: string;
  patient_id: string;
  prescription_id: string;
  medicine_name: string;
  time: string; // "08:00"
  dosage: string;
  taken: boolean;
  dateStr: string; // "2026-06-15"
}

export interface FamilyMember {
  id: string;
  patient_id: string;
  full_name: string;
  relationship: string; // 'Self' | 'Father' | 'Mother' | 'Child' etc.
  gender?: string;
  dob?: string;
  created_at?: string;
}

export interface StaffActivityLog {
  id: string;
  actor_id: string;
  actor_name: string;
  action_type: string;
  details: string;
  hospital_id?: string;
  created_at: string;
}


