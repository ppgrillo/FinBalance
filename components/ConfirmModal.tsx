import React from 'react';
import { Icons } from './Icons';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'warning',
    onConfirm,
    onCancel
}) => {
    if (!isOpen) return null;

    const colors = {
        danger: {
            bg: 'bg-red-50',
            icon: 'text-red-500',
            button: 'bg-red-500 hover:bg-red-600 shadow-red-200'
        },
        warning: {
            bg: 'bg-orange-50',
            icon: 'text-orange-500',
            button: 'bg-orange-500 hover:bg-orange-600 shadow-orange-200'
        },
        info: {
            bg: 'bg-blue-50',
            icon: 'text-blue-500',
            button: 'bg-blue-500 hover:bg-blue-600 shadow-blue-200'
        }
    };

    const theme = colors[type];

    return (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl scale-100 transition-transform">
                <div className="text-center mb-6">
                    <div className={`w-16 h-16 ${theme.bg} ${theme.icon} rounded-full flex items-center justify-center mx-auto mb-3`}>
                        {type === 'danger' && <Icons.Trash size={32} />}
                        {type === 'warning' && <Icons.Trending size={32} />}
                        {type === 'info' && <Icons.Brain size={32} />}
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">{title}</h2>
                    <p className="text-sm text-gray-500 mt-2 leading-relaxed whitespace-pre-line">{message}</p>
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 py-3 text-white font-bold rounded-xl shadow-lg transition-colors ${theme.button}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
