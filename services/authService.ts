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
          data: { full_name: name }
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
      const user = await authService.getUser();

      return { user, error: null };
    } catch (e: any) {
      console.error("SignIn Error:", e);
      return { user: null, error: "Error de conexión o configuración." };
    }
  },

  signInWithGoogle: async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      return { data, error };
    } catch (e) {
      console.error("Google Auth Error:", e);
      return { data: null, error: e };
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

  getUser: async (): Promise<User | null> => {
    try {
      // 1. Check active session with timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Session check timeout')), 2000)
      );

      const sessionPromise = supabase.auth.getSession();

      const { data: { session }, error: sessionError } = await Promise.race([
        sessionPromise,
        timeoutPromise
      ]) as any;

      if (sessionError || !session?.user) {
        return null;
      }

      const user = session.user;

      // 2. Fetch DB Profile
      let profile = null;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (!error && data) {
          profile = data;
          // Update local storage with fresh data
          const newSettings = {
            monthlyLimit: Number(data.monthly_limit),
            periodType: data.period_type as any,
            periodStartDay: Number(data.period_start_day),
            currency: data.currency
          };
          localStorage.setItem('user_settings', JSON.stringify(newSettings));
        } else if (!data && !error) {
          // If no profile exists, create one with defaults
          console.log("No profile found, creating default...");
          const defaultSettings = {
            monthlyLimit: 10000,
            periodType: 'Mensual' as any, // Cast to satisfy type
            periodStartDay: 1,
            currency: 'MXN'
          };
          await dbService.updateUserProfile(user.id, defaultSettings);
          profile = { ...defaultSettings, full_name: user.user_metadata.full_name };
        }
      } catch (profileError) {
        console.error("Error fetching profile:", profileError);
        // Fallback to local storage only if DB fails
      }

      // 3. Construct User Object
      // Priority: DB Profile -> Local Storage -> Hardcoded Defaults
      let localSettings: any = {};
      try {
        const stored = localStorage.getItem('user_settings');
        if (stored) localSettings = JSON.parse(stored);
      } catch (e) { }

      return {
        id: user.id,
        email: user.email!,
        name: profile?.full_name || user.user_metadata.full_name || 'Usuario',
        currency: profile?.currency || localSettings?.currency || 'MXN',
        monthlyLimit: profile?.monthly_limit ? Number(profile.monthly_limit) : (localSettings.monthlyLimit || 10000),
        periodType: profile?.period_type || localSettings.periodType || 'Mensual',
        periodStartDay: profile?.period_start_day ? Number(profile.period_start_day) : (localSettings.periodStartDay || 1)
      };

    } catch (error) {
      console.warn("Auth check critical failure", error);
      return null;
    }
  }
};