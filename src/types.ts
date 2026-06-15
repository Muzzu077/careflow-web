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
  SUSPENDED = "SUSPENDED"
}

export enum AppointmentStatus {
  BOOKED = "BOOKED",
  CHECKED_IN = "CHECKED_IN",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED"
}

export enum LabRequestStatus {
  PENDING = "PENDING",
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
  name: string;
  address: string;
  city: string;
  area: string;
  state: string;
  pincode: string;
  approved: boolean;
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
  dosage: string; // e.g. "1-0-1"
  duration: string; // e.g. "5 days"
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
  read: boolean;
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
