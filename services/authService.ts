import { supabase } from '../lib/supabaseClient';
import { User } from '../types';
import { dbService } from './dbService';

export const authService = {
  signUp: async (email: string, password: string, name: string): Promise<{ user: User | null, error: string | null }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: window.location.origin
        }
      });

      if (error) return { user: null, error: error.message };

      const appUser: User | null = data.user ? {
        id: data.user.id,
        email: data.user.email!,
        name: data.user.user_metadata.full_name || 'Usuario',
        currency: 'MXN',
        monthlyLimit: 10000, // Default for new users
        periodType: 'Mensual',
        periodStartDay: 1
      } : null;

      return { user: appUser, error: null };
    } catch (e: any) {
      console.error("SignUp Error:", e);
      return { user: null, error: "Error de conexión o configuración." };
    }
  },

  signIn: async (email: string, password: string): Promise<{ user: User | null, error: string | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) return { user: null, error: error.message };

      // Fetch the real user profile immediately
      const user = await authService.getUser(data.session);

      return { user, error: null };
    } catch (e: any) {
      console.error("SignIn Error:", e);
      return { user: null, error: "Error de conexión o configuración." };
    }
  },

  signInWithOAuth: async (): Promise<{ error: string | null }> => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      const isNative = Capacitor.isNativePlatform();

      const redirectTo = isNative
        ? 'com.finbalance.app://google-auth'
        : window.location.origin;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: false // Ensure browser opens for auth
        }
      });

      if (error) return { error: error.message };
      return { error: null };
    } catch (e: any) {
      console.error("OAuth Error:", e);
      return { error: "Error iniciando sesión con Google." };
    }
  },

  signOut: async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('user_settings');
    } catch (e) {
      console.error("SignOut Error:", e);
    }
  },

  getUser: async (existingSession?: any): Promise<User | null> => {
    try {
      console.log("AuthService: getUser called");
      let session = existingSession;

      if (!session) {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Session check timeout')), 2000)
          );

          const { data, error } = await Promise.race([
            supabase.auth.getSession(),
            timeoutPromise
          ]) as any;

          if (error) throw error;
          session = data.session;
        } catch (e) {
          console.warn("Session check failed:", e);
          return null;
        }
      }

      if (!session?.user) return null;

      const user = session.user;

      // 2. Fetch DB Profile (Fast Path: 2s timeout)
      let profile = null;
      try {
        const dbTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('DB timeout')), 2000)
        );

        const { data, error } = await Promise.race([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          dbTimeout
        ]) as any;

        if (!error && data) {
          console.log("AuthService: Profile loaded from DB");
          profile = data;
          // Update local storage
          const newSettings = {
            monthlyLimit: Number(data.monthly_limit),
            periodType: data.period_type,
            periodStartDay: Number(data.period_start_day),
            currency: data.currency
          };
          localStorage.setItem('user_settings', JSON.stringify(newSettings));
        }
      } catch (e) {
        console.warn("AuthService: DB fetch timed out, using local/defaults");
      }

      // 3. Construct User Object (Use Profile -> Local Storage -> Defaults)
      let localSettings: any = {};
      try {
        const stored = localStorage.getItem('user_settings');
        if (stored) localSettings = JSON.parse(stored);
      } catch (e) { }

      const finalUser = {
        id: user.id,
        email: user.email!,
        name: profile?.full_name || user.user_metadata.full_name || 'Usuario',
        currency: profile?.currency || localSettings?.currency || 'MXN',
        monthlyLimit: profile?.monthly_limit ? Number(profile.monthly_limit) : (localSettings.monthlyLimit || 10000),
        periodType: profile?.period_type || localSettings.periodType || 'Mensual',
        periodStartDay: profile?.period_start_day ? Number(profile.period_start_day) : (localSettings.periodStartDay || 1)
      };

      return finalUser;

    } catch (error) {
      console.error("Auth check critical failure", error);
      return null;
    }
  },

  forceRefreshUserProfile: async (userId: string): Promise<User | null> => {
    try {
      console.log("AuthService: forceRefreshUserProfile called for userId:", userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (!data) throw new Error("No se encontró el perfil en la base de datos.");

      console.log("AuthService: Profile refreshed:", data);

      // Update local storage
      const newSettings = {
        monthlyLimit: Number(data.monthly_limit),
        periodType: data.period_type,
        periodStartDay: Number(data.period_start_day),
        currency: data.currency
      };
      localStorage.setItem('user_settings', JSON.stringify(newSettings));

      // Re-fetch the full user object to ensure all parts are updated
      // Construct User Object directly to avoid redundant DB calls/timeouts
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;

      const user = session.user;
      const finalUser: User = {
        id: user.id,
        email: user.email!,
        name: data.full_name || user.user_metadata.full_name || 'Usuario',
        currency: data.currency || 'MXN',
        monthlyLimit: Number(data.monthly_limit),
        periodType: data.period_type,
        periodStartDay: Number(data.period_start_day)
      };

      console.log("AuthService: forceRefreshUserProfile returning:", finalUser);
      return finalUser;

    } catch (error: any) {
      console.error("Force Refresh Error:", error);
      throw new Error(error.message || "Error al descargar datos del perfil.");
    }
  }
};