
import React, { useState } from 'react';
import { authService } from '../services/authService';
import { User } from '../types';
import { Icons } from '../components/Icons';

interface Props {
  onLogin: (user: User) => void;
}

export const Onboarding: React.FC<Props> = ({ onLogin }) => {
  const [step, setStep] = useState<'intro' | 'auth'>('intro');
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg("Por favor ingresa correo y contraseña");
      return;
    }
    if (mode === 'register' && !name) {
      setErrorMsg("Por favor ingresa tu nombre");
      return;
    }

    setLoading(true);

    try {
      let result;
      if (mode === 'login') {
        result = await authService.signIn(email, password);
      } else {
        result = await authService.signUp(email, password, name);
      }

      if (result.error) {
        // Translate common Supabase errors
        if (result.error.includes("Invalid login credentials")) {
          setErrorMsg("Correo o contraseña incorrectos.");
        } else if (result.error.includes("Email not confirmed")) {
          setErrorMsg("Correo no verificado. Revisa tu bandeja de entrada.");
        } else if (result.error.includes("User already registered")) {
          setErrorMsg("Este correo ya está registrado.");
        } else {
          setErrorMsg(result.error);
        }
      } else if (result.user) {
        if (mode === 'register' && !result.user.id) {
          alert("Registro exitoso. Por favor verifica tu correo electrónico antes de iniciar sesión.");
          setMode('login');
        } else {
          onLogin(result.user);
        }
      }
    } catch (error) {
      console.error(error);
      setErrorMsg("Ocurrió un error inesperado de conexión.");
    } finally {
      setLoading(false);
    }
  };

  // Clear errors when typing
  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter(value);
    if (errorMsg) setErrorMsg('');
  };

  if (step === 'intro') {
    return (
      <div className="h-screen bg-primary flex flex-col items-center justify-between p-8 text-white">
        <div className="mt-20 flex flex-col items-center text-center">
          <div className="bg-white/20 p-6 rounded-full mb-6 backdrop-blur-sm animate-bounce-slow">
            <Icons.Wallet size={64} color="white" />
          </div>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">FinBalance</h1>
          <p className="text-lg text-white/90 max-w-xs font-light">
            Tu dinero, bajo control. <br /> Simple, inteligente y seguro.
          </p>
        </div>

        <div className="w-full max-w-sm space-y-4 mb-10 animate-fade-in-up">
          <button
            onClick={() => { setMode('register'); setStep('auth'); setErrorMsg(''); }}
            className="w-full bg-accent text-textPrimary font-bold py-4 rounded-2xl shadow-lg hover:bg-yellow-200 transition-all transform hover:scale-[1.02]"
          >
            Crear cuenta gratis
          </button>
          <button
            onClick={() => { setMode('login'); setStep('auth'); setErrorMsg(''); }}
            className="w-full bg-white/20 text-white font-semibold py-4 rounded-2xl backdrop-blur-sm hover:bg-white/30 transition-all"
          >
            Ya tengo cuenta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center p-6">
      <div className="max-w-md mx-auto w-full">
        <div className="mb-8 text-center">
          <button onClick={() => setStep('intro')} className="text-gray-400 mb-4 flex items-center justify-center gap-2 hover:text-primary mx-auto">
            <Icons.ArrowUpRight className="rotate-180" size={16} /> Volver
          </button>
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto mb-4">
            <Icons.Profile size={32} />
          </div>
          <h2 className="text-2xl font-bold text-textPrimary">
            {mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
          </h2>
          <p className="text-textSecondary">
            {mode === 'login' ? 'Ingresa tus datos para continuar' : 'Empieza a controlar tus gastos hoy'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="bg-white p-8 rounded-3xl shadow-sm space-y-5">

          {errorMsg && (
            <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-start gap-3 text-red-500 text-sm animate-fade-in">
              <Icons.Close size={18} className="mt-0.5 shrink-0" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {mode === 'register' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-textSecondary uppercase">Nombre</label>
              <div className="flex items-center bg-gray-50 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-primary/50 transition-all">
                <Icons.Profile size={20} className="text-gray-400 mr-3" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleInputChange(setName, e.target.value)}
                  placeholder="Tu nombre"
                  className="bg-transparent border-none outline-none w-full text-textPrimary"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-textSecondary uppercase">Correo Electrónico</label>
            <div className="flex items-center bg-gray-50 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-primary/50 transition-all">
              <Icons.Chat size={20} className="text-gray-400 mr-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => handleInputChange(setEmail, e.target.value)}
                placeholder="ejemplo@correo.com"
                className="bg-transparent border-none outline-none w-full text-textPrimary"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-textSecondary uppercase">Contraseña</label>
            <div className="flex items-center bg-gray-50 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-primary/50 transition-all">
              <Icons.Settings size={20} className="text-gray-400 mr-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => handleInputChange(setPassword, e.target.value)}
                placeholder="••••••••"
                className="bg-transparent border-none outline-none w-full text-textPrimary"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/30 hover:bg-purple-600 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {loading && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {mode === 'login' ? 'Iniciar Sesión' : 'Registrarse'}
          </button>
        </form>

        <div className="text-center mt-8">
          <p className="text-sm text-textSecondary mb-2">
            {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
          </p>
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setEmail('');
              setPassword('');
              setName('');
              setErrorMsg('');
            }}
            className="text-primary font-bold hover:underline transition-all"
          >
            {mode === 'login' ? 'Regístrate aquí' : 'Inicia sesión aquí'}
          </button>
        </div>
      </div>
    </div>
  );
};
