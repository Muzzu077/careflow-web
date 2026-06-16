-- 1. LAB WORKFLOW ENHANCEMENTS
-- Add 'IN_PROGRESS' to lab_request_status enum (if not exists)
ALTER TYPE public.lab_request_status ADD VALUE IF NOT EXISTS 'IN_PROGRESS';

-- Add 'instructions' to lab_requests (if not exists)
ALTER TABLE public.lab_requests ADD COLUMN IF NOT EXISTS instructions TEXT;

-- 2. PRESCRIPTION CLINICAL-GRADE UPGRADE
-- Add 'frequency' and 'instructions' to prescription_items (if not exists)
ALTER TABLE public.prescription_items ADD COLUMN IF NOT EXISTS frequency VARCHAR(255);
ALTER TABLE public.prescription_items ADD COLUMN IF NOT EXISTS instructions VARCHAR(255);

-- 3. FAMILY PROFILES MODULE
CREATE TABLE IF NOT EXISTS public.family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    relationship VARCHAR(50) NOT NULL, -- 'Self', 'Father', 'Mother', 'Child', 'Spouse', etc.
    gender VARCHAR(20),
    dob DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS for family_members
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- Add RLS policy (drop existing if any to avoid errors)
DROP POLICY IF EXISTS "Users can manage their own family members" ON public.family_members;
CREATE POLICY "Users can manage their own family members" ON public.family_members
    FOR ALL USING (auth.uid() = patient_id);

-- Also, let's enable RLS policies for SELECT by other users (like doctors or receptionists) who might need to read the family members
DROP POLICY IF EXISTS "All authenticated users can read family members" ON public.family_members;
CREATE POLICY "All authenticated users can read family members" ON public.family_members
    FOR SELECT USING (auth.role() = 'authenticated');
