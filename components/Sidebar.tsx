
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Icons } from './Icons';
import { Paywall } from './Paywall';
import { subscriptionService } from '../services/subscriptionService';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const location = useLocation();
  const [showPaywall, setShowPaywall] = useState(false);
  const isActive = (path: string) => location.pathname === path;

  const handlePremiumClick = async () => {
    // Always use custom UI since we are on an older SDK version
    // that doesn't support the latest native Paywalls
    setShowPaywall(true);
  };

  const navItems = [
    { path: '/dashboard', icon: Icons.Home, label: 'Dashboard' },
    { path: '/wallet', icon: Icons.CreditCard, label: 'Billetera' },
    { path: '/expenses', icon: Icons.List, label: 'Movimientos' },
    { path: '/budgets', icon: Icons.Wallet, label: 'Presupuestos' },
    { path: '/categories', icon: Icons.Tag, label: 'Categorías' },
    { path: '/goals', icon: Icons.Target, label: 'Metas' },
    { path: '/recurring', icon: Icons.Calendar, label: 'Gastos Fijos' },
    { path: '/stats', icon: Icons.Stats, label: 'Estadísticas' },
    { path: '/chat', icon: Icons.Chat, label: 'Asistente IA' },
    { path: '/profile', icon: Icons.Profile, label: 'Perfil' },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300 backdrop-blur-sm ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        onClick={onClose}
      />

      {/* Sidebar Container */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 
        transform transition-transform duration-300 ease-in-out flex flex-col h-full
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <div className="p-8 flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl">
              <Icons.Wallet size={28} className="text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-textPrimary">FinBalance</h1>
          </div>
          {/* Mobile Close Button */}
          <button onClick={onClose} className="md:hidden text-gray-400 hover:text-gray-600 transition-colors">
            <Icons.Close size={24} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
          <Link
            to="/"
            onClick={onClose}
            className="flex items-center gap-3 bg-primary text-white p-4 rounded-xl font-semibold shadow-lg hover:bg-purple-600 transition-all mb-6 group"
          >
            <div className="bg-white/20 p-1 rounded-lg group-hover:scale-110 transition-transform">
              <Icons.Add size={20} />
            </div>
            <span>Registrar Gasto</span>
          </Link>

          {/* Premium Banner */}
          <button
            onClick={handlePremiumClick}
            className="w-full mb-4 p-3 rounded-xl bg-gradient-to-r from-amber-200 to-yellow-400 text-yellow-900 flex items-center gap-3 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="bg-white/30 p-1.5 rounded-lg group-hover:rotate-12 transition-transform">
              <Icons.Crown size={18} strokeWidth={2.5} />
            </div>
            <div className="text-left">
              <span className="block text-xs font-bold uppercase tracking-wider opacity-80">Upgrade</span>
              <span className="block font-bold text-sm">Obtener Premium</span>
            </div>
          </button>

          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-200 ${active
                  ? 'bg-gray-50 text-primary font-semibold shadow-sm translate-x-1'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-textPrimary'
                  }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} className={active ? 'scale-110 transition-transform' : ''} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-gray-50">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <p className="text-xs text-gray-400 font-medium">Sistema Operativo</p>
          </div>
        </div>
      </aside>

      {/* Paywall Modal */}
      {showPaywall && (
        <Paywall
          onClose={() => setShowPaywall(false)}
          onSuccess={() => setShowPaywall(false)}
        />
      )}
    </>
  );
};
