import React, { useEffect } from 'react';
import { Icons } from './Icons';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
    duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 3000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const styles = {
        success: 'bg-green-50 border-green-200 text-green-800',
        error: 'bg-red-50 border-red-200 text-red-800',
        warning: 'bg-orange-50 border-orange-200 text-orange-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800'
    };

    const icons = {
        success: <Icons.Check size={18} className="text-green-500" />,
        error: <Icons.Close size={18} className="text-red-500" />, // Using Close as generic error icon or we could add Alert
        warning: <Icons.Trending size={18} className="text-orange-500" />, // Using Trending as generic warning or add Alert
        info: <Icons.Brain size={18} className="text-blue-500" />
    };

    return (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg animate-fade-in-down transition-all ${styles[type]} max-w-sm`}>
            <div className="shrink-0">
                {icons[type]}
            </div>
            <p className="text-sm font-medium">{message}</p>
            <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100">
                <Icons.Close size={14} />
            </button>
        </div>
    );
};
