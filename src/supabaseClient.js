import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseUrl = rawUrl.startsWith('https://') ? rawUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

// Fail loudly in dev/console if the real credentials are missing — otherwise the
// app boots against a placeholder project and auth silently fails. See .env.example.
if (supabaseUrl.includes('placeholder') || supabaseAnonKey === 'placeholder-key') {
  console.warn(
    '[EggSight] Supabase env vars missing — set VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_ANON_KEY (.env locally, Project Settings on Vercel). ' +
    'Login and portal data will not work until these are set.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
