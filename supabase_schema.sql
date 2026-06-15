-- CAREFLOW: SMART HOSPITAL MANAGEMENT SYSTEM
-- PostgreSQL / Supabase Core Schema Migration
-- Designed with Row Level Security, Auditing, and proper Indexing

-- Custom Enumerations
CREATE TYPE user_role AS ENUM ('MAIN_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'PATIENT');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'PENDING', 'SUSPENDED');
CREATE TYPE appointment_status AS ENUM ('BOOKED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED');
CREATE TYPE lab_request_status AS ENUM ('PENDING', 'COMPLETED');

-- 1. HOSPITALS TABLE
CREATE TABLE hospitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    area VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(20) NOT NULL,
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. CORE USERS TABLE (Linked to auth.users in Supabase)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    role user_role NOT NULL,
    status user_status DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. USER PROFILES TABLE
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    gender VARCHAR(20),
    dob DATE,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. HOSPITAL ADMIN EXTENSION TABLE
CREATE TABLE hospital_admins (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. DOCTORS EXTENSION TABLE
CREATE TABLE doctors (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    license_number VARCHAR(100) UNIQUE NOT NULL,
    specialization VARCHAR(150) NOT NULL,
    experience INTEGER NOT NULL, -- in years
    hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    city VARCHAR(100) NOT NULL,
    area VARCHAR(100) NOT NULL,
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. RECEPTIONIST EXTENSION TABLE
CREATE TABLE receptionists (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. LAB TECHNICIANS EXTENSION TABLE
CREATE TABLE lab_technicians (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    qualification VARCHAR(255) NOT NULL,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. APPOINTMENTS TABLE
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES users(id) ON DELETE SET NULL,
    patient_name VARCHAR(255) NOT NULL,
    doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    doctor_name VARCHAR(255) NOT NULL,
    doctor_specialization VARCHAR(150) NOT NULL,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
    hospital_name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    token INTEGER NOT NULL,
    status appointment_status DEFAULT 'BOOKED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. PRESCRIPTIONS TABLE
CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    doctor_name VARCHAR(255) NOT NULL,
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    patient_name VARCHAR(255) NOT NULL,
    patient_dob DATE,
    patient_gender VARCHAR(20),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
    hospital_name VARCHAR(255) NOT NULL,
    symptoms TEXT,
    diagnosis TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. PRESCRIPTION ITEMS TABLE
CREATE TABLE prescription_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
    medicine_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL, -- e.g., '1-0-1'
    duration VARCHAR(100) NOT NULL, -- e.g., '5 days'
    reminder_time VARCHAR(255) -- comma separated times e.g., '08:00, 20:00'
);

-- 11. MEDICINE REMINDERS TABLE (Dynamic tracking)
CREATE TABLE medicine_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
    medicine_name VARCHAR(255) NOT NULL,
    time TIME NOT NULL, -- e.g., '08:00:00'
    dosage VARCHAR(100) NOT NULL,
    taken BOOLEAN DEFAULT FALSE,
    date_str DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. LAB REQUESTS TABLE
CREATE TABLE lab_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    doctor_name VARCHAR(255) NOT NULL,
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    patient_name VARCHAR(255) NOT NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
    test_name VARCHAR(255) NOT NULL, -- e.g. 'Blood Test', 'MRI'
    status lab_request_status DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. LAB REPORTS TABLE
CREATE TABLE lab_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES lab_requests(id) ON DELETE CASCADE,
    test_name VARCHAR(255) NOT NULL,
    doctor_name VARCHAR(255) NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    results_text TEXT NOT NULL,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Lab Technician
    file_url TEXT, -- Path in Supabase Storage buckets
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. NOTIFICATIONS TABLE
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. CHATS TABLE
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant1_id UUID REFERENCES users(id) ON DELETE CASCADE,
    participant2_id UUID REFERENCES users(id) ON DELETE CASCADE,
    participant1_name VARCHAR(255) NOT NULL,
    participant2_name VARCHAR(255) NOT NULL,
    participant1_role user_role NOT NULL,
    participant2_role user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. CHAT MESSAGES TABLE
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    text TEXT NOT NULL,
    read_status BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- STRICT INDEXES FOR QUERY PATTERNS & PERFORMANCE
CREATE INDEX idx_hospitals_location ON hospitals(city, area);
CREATE INDEX idx_users_role_status ON users(role, status);
CREATE INDEX idx_doctors_specialization ON doctors(specialization);
CREATE INDEX idx_appointments_date_status ON appointments(date, status);
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_lab_requests_patient ON lab_requests(patient_id);
CREATE INDEX idx_lab_reports_patient ON lab_reports(patient_id);
-- Row Level Security (RLS) Settings
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

-- Sample Policies
CREATE POLICY "Users can read own record" ON users 
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Patients can view their appointments" ON appointments
    FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Doctors can view and edit their appts" ON appointments
    FOR ALL USING (auth.uid() = doctor_id);
