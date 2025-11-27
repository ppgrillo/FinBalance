
import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// CONFIGURACIÓN DE SUPABASE
// Reemplaza los valores a continuación con las credenciales de tu proyecto.
// Si no tienes cuenta, la app funcionará en modo "demo" (sin guardar datos).
// ------------------------------------------------------------------

const PROJECT_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ------------------------------------------------------------------

// Lógica de validación para evitar errores si no se han cambiado los valores
const isValidUrl = (url: string) => url.startsWith('http');
const supabaseUrl = isValidUrl(PROJECT_URL) ? PROJECT_URL : 'https://placeholder-project.supabase.co';
const supabaseKey = ANON_KEY ?? 'placeholder-key';

if (!isValidUrl(PROJECT_URL)) {
  console.warn('⚠️ Credenciales de Supabase no configuradas en lib/supabaseClient.ts. La base de datos no funcionará.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage
  }
});
