import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing! Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your env configuration.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
