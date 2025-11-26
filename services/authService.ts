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
        monthlyLimit: 10000, // Default
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

      // OPTIMIZATION: Construct user directly to avoid loading hang waiting for DB profile
      // We assume defaults for profile settings initially; they will update on next refresh/edit.
      const simpleUser: User = {
        id: data.user?.id!,
        email: data.user?.email!,
        name: data.user?.user_metadata.full_name || 'Usuario',
        currency: 'MXN',
        monthlyLimit: 10000,
        periodType: 'Mensual',
        periodStartDay: 1
      };

      // Background sync: Try to fetch real profile data to update LocalStorage for next reload
      // We DO NOT await this, so the UI unblocks immediately.
      authService.getUser().then(u => {
          if (u) console.log("Profile background sync complete");
      }).catch(e => console.warn("Profile background sync failed", e));

      return { user: simpleUser, error: null };
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
      localStorage.removeItem('user_settings'); // Clear local settings to prevent leaking to next user
    } catch (e) {
      console.error("SignOut Error:", e);
    }
  },

  getUser: async (): Promise<User | null> => {
    try {
      // 1. Check active session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user) {
          return null;
      }

      const user = session.user;
      
      // Safe parse local settings with extra guards
      let localSettings: any = {};
      try {
        const stored = localStorage.getItem('user_settings');
        if (stored) {
             const parsed = JSON.parse(stored);
             if (parsed && typeof parsed === 'object') {
                 localSettings = parsed;
             }
        }
      } catch (parseError) {
        console.warn("Corrupted user settings in local storage, resetting.");
        localStorage.removeItem('user_settings');
        localSettings = {};
      }

      // 2. Fetch DB Profile with Aggressive Timeout
      // If DB is slow, we skip it and use Local/Defaults to let the app load.
      let profile = null;
      try {
        // 1 second timeout for DB. If it takes longer, we proceed with local data.
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Profile fetch timeout')), 1000)
        );
        
        // Race the DB call against timeout
        const dbPromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle(); 

        const response: any = await Promise.race([dbPromise, timeoutPromise]);
        const { data, error } = response;
        
        if (!error && data) {
            profile = data;
            // SYNC: Update LocalStorage with latest DB truth
            const newSettings = {
                ...localSettings,
                monthlyLimit: Number(data.monthly_limit),
                periodType: data.period_type,
                periodStartDay: Number(data.period_start_day),
                currency: data.currency
            };
            localStorage.setItem('user_settings', JSON.stringify(newSettings));
        } else if (!data && !error) {
            // Missing profile logic (Auto-create in background)
            const defaultSettings = {
                monthlyLimit: 10000,
                periodType: 'Mensual',
                periodStartDay: 1,
                currency: 'MXN',
                ...localSettings
            };
            // Fire and forget
            dbService.updateUserProfile(user.id, defaultSettings).catch(console.error);
        }
      } catch (profileError) {
        // Timeout or DB error: Ignore and use LocalStorage
        console.log("Using cached profile settings due to DB delay/error.");
      }

      // 3. Construct User Object (Prioritizing DB -> Local -> Default)
      const dbStartDay = profile?.period_start_day;
      const dbLimit = profile?.monthly_limit;

      const finalStartDay = (dbStartDay !== undefined && dbStartDay !== null) 
          ? Number(dbStartDay) 
          : (localSettings?.periodStartDay !== undefined ? Number(localSettings.periodStartDay) : 1);

      const finalLimit = (dbLimit !== undefined && dbLimit !== null)
          ? Number(dbLimit)
          : (localSettings?.monthlyLimit !== undefined ? Number(localSettings.monthlyLimit) : 10000);

      const finalPeriodType = profile?.period_type || localSettings?.periodType || 'Mensual';

      return {
        id: user.id,
        email: user.email!,
        name: profile?.full_name || user.user_metadata.full_name || 'Usuario',
        currency: profile?.currency || localSettings?.currency || 'MXN',
        monthlyLimit: finalLimit,
        periodType: finalPeriodType,
        periodStartDay: finalStartDay
      };

    } catch (error) {
      console.warn("Auth check critical failure", error);
      return null;
    }
  }
};