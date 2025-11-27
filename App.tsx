import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { AddExpense } from './pages/AddExpense';
import { Stats } from './pages/Stats';
import { ChatAI } from './pages/ChatAI';
import { Budgets } from './pages/Budgets';
import { RecurringExpenses } from './pages/RecurringExpenses';
import { ExpensesList } from './pages/ExpensesList';
import { Profile } from './pages/Profile';
import { ToastProvider } from './context/ToastContext';
import { Goals } from './pages/Goals';
import { Categories } from './pages/Categories';
import { Wallet } from './pages/Wallet';
import { authService } from './services/authService';
import { User } from './types';
import { supabase } from './lib/supabaseClient';

interface LayoutProps {
  children: React.ReactNode;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, mobileMenuOpen, setMobileMenuOpen }) => {
  return (
    <div className="min-h-screen bg-background font-sans text-textPrimary flex">
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <div className="flex-1 md:ml-64 relative w-full min-h-screen transition-all duration-300 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="p-5 pb-28 md:p-10">
            {children}
          </div>
        </div>
        <BottomNav />
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const refreshUser = async (session: any = null) => {
    try {
      console.log("App: refreshUser called", session ? "with session" : "without session");
      const currentUser = await authService.getUser(session);
      console.log("App: getUser result:", currentUser);
      setUser(currentUser);
    } catch (e) {
      console.error("Failed to refresh user", e);
      // Do not throw, just leave user as null
    }
  };

  useEffect(() => {
    // Check active session
    const checkSession = async () => {
      console.log("App: checkSession starting...");
      await refreshUser();
      console.log("App: checkSession done, setting initializing false");
      setInitializing(false);
    };

    checkSession();

    // Safety fallback: If Supabase hangs, force app to load after 5 seconds
    const safetyTimer = setTimeout(() => {
      setInitializing(prev => {
        if (prev) {
          console.warn("Initialization timed out, forcing load.");
          return false;
        }
        return prev;
      });
    }, 5000);

    // Listen for Auth Changes (Login, Logout, Token Refresh)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("App: Auth Event:", event, session?.user?.id);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await refreshUser(session);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (initializing) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-primary font-bold gap-4">
      <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      <p>Cargando FinBalance...</p>
    </div>
  );

  if (!user) {
    return <Onboarding onLogin={setUser} />;
  }

  return (
    <ToastProvider>
      <Router>
        <Layout mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen}>
          <Routes>
            <Route path="/" element={<Dashboard user={user} onMenuClick={() => setMobileMenuOpen(true)} />} />
            <Route path="/budgets" element={<Budgets user={user} />} />
            <Route path="/recurring" element={<RecurringExpenses />} />
            <Route path="/expenses" element={<ExpensesList />} />
            <Route path="/add" element={<AddExpense />} />
            <Route path="/stats" element={<Stats user={user} />} />
            <Route path="/chat" element={<ChatAI />} />
            <Route path="/profile" element={<Profile user={user} onUpdate={refreshUser} />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/login" element={<Navigate to="/" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </ToastProvider>
  );
}