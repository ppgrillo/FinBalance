import React, { useState } from 'react';
import { AddExpenseClassic } from '../components/AddExpenseClassic';
import { AddExpenseMinimal } from '../components/AddExpenseMinimal';
import { AddExpenseSpeed } from '../components/AddExpenseSpeed';

type ViewMode = 'classic' | 'minimal' | 'speed';

export const AddExpense: React.FC = () => {
    // Initialize from localStorage or default to 'minimal'
    const [view, setView] = useState<ViewMode>(() => {
        const saved = localStorage.getItem('addExpenseView');
        return (saved as ViewMode) || 'minimal';
    });

    // Save to localStorage whenever view changes
    const handleSetView = (newView: ViewMode) => {
        setView(newView);
        localStorage.setItem('addExpenseView', newView);
    };

    return (
        <div className="">
            {/* Tab Switcher */}
            <div className="flex justify-center mb-6">
                <div className="bg-gray-100 p-1 rounded-full flex gap-1">
                    <button
                        onClick={() => handleSetView('classic')}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${view === 'classic' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        Clásico
                    </button>
                    <button
                        onClick={() => handleSetView('minimal')}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${view === 'minimal' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        Minimal (Beta)
                    </button>
                    <button
                        onClick={() => handleSetView('speed')}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${view === 'speed' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        ⚡ Flash
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="animate-fade-in">
                {view === 'classic' && <AddExpenseClassic />}
                {view === 'minimal' && <AddExpenseMinimal />}
                {view === 'speed' && <AddExpenseSpeed />}
            </div>
        </div>
    );
};
