
import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// CONFIGURACIÓN DE SUPABASE
// Reemplaza los valores a continuación con las credenciales de tu proyecto.
// Si no tienes cuenta, la app funcionará en modo "demo" (sin guardar datos).
// ------------------------------------------------------------------

const PROJECT_URL = "https://vyoxfhbgqityitcaeccs.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5b3hmaGJncWl0eWl0Y2FlY2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NjY5ODgsImV4cCI6MjA3OTM0Mjk4OH0.pN9SsM2YjAK1eAehTtQ2DzXxl6_AC1-xVmz4fG9KNk0";

// ------------------------------------------------------------------

// Lógica de validación para evitar errores si no se han cambiado los valores
const isValidUrl = (url: string) => url.startsWith('http');
const supabaseUrl = isValidUrl(PROJECT_URL) ? PROJECT_URL : 'https://placeholder-project.supabase.co';
const supabaseKey = ANON_KEY ?? 'placeholder-key';

if (!isValidUrl(PROJECT_URL)) {
  console.warn('⚠️ Credenciales de Supabase no configuradas en lib/supabaseClient.ts. La base de datos no funcionará.');
}

const customStorage = {
  getItem: (key: string) => {
    try {
      const stored = localStorage.getItem(key);
      return stored;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
