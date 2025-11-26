import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icons } from './Icons';

export const BottomNav: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;
  
  const navItems = [
    { path: '/', icon: Icons.Home, label: 'Inicio' },
    { path: '/expenses', icon: Icons.List, label: 'Gastos' }, // Changed from Budgets
    { path: '/add', icon: Icons.Add, label: 'Agregar', special: true },
    { path: '/stats', icon: Icons.Stats, label: 'Datos' },
    { path: '/chat', icon: Icons.Chat, label: 'Asistente' },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-safe pt-2 px-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
      <div className="flex justify-between items-end max-w-md mx-auto pb-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          if (item.special) {
            return (
              <Link key={item.path} to={item.path} className="-mt-8">
                <div className="bg-primary text-white p-4 rounded-full shadow-lg hover:bg-purple-500 transition-colors">
                  <Icon size={28} />
                </div>
              </Link>
            );
          }

          return (
            <Link key={item.path} to={item.path} className="flex flex-col items-center gap-1 w-16">
              <Icon 
                size={24} 
                className={`transition-colors ${active ? 'text-primary' : 'text-gray-400'}`} 
                strokeWidth={active ? 2.5 : 2}
              />
              <span className={`text-[10px] font-medium ${active ? 'text-primary' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};