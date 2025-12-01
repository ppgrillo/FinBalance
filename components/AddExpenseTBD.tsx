import React from 'react';
import { Icons } from './Icons';

export const AddExpenseTBD: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <div className="bg-gray-100 p-6 rounded-full mb-4">
                <Icons.Brain size={48} className="text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-600 mb-2">Opción 3: En Construcción</h2>
            <p className="text-gray-400 max-w-xs">
                Este espacio está reservado para un futuro experimento de interfaz.
            </p>
        </div>
    );
};
