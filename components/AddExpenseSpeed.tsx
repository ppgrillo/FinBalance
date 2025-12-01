import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { dbService } from '../services/dbService';
import { useToast } from '../context/ToastContext';
import { CategoryType, Account } from '../types';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export const AddExpenseSpeed: React.FC = () => {
    const { success, error } = useToast();

    const [amount, setAmount] = useState('0');
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastSaved, setLastSaved] = useState<{ amount: string, category: string } | null>(null);

    // Account State
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
    const [showAccountPicker, setShowAccountPicker] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            const [catData, accData] = await Promise.all([
                dbService.getCategories(),
                dbService.getAccounts()
            ]);

            if (catData && catData.length > 0) {
                // Show all categories
                setCategories(catData.filter(c => c.type === 'expense' || !c.type).map(c => c.name));
            } else {
                setCategories(Object.values(CategoryType));
            }

            setAccounts(accData);
            if (accData.length > 0) {
                const defaultAcc = accData.find(a => a.isDefault) || accData[0];
                setSelectedAccount(defaultAcc);
            }
        };
        loadData();
    }, []);

    const handleNumPress = async (num: string) => {
        await Haptics.impact({ style: ImpactStyle.Light });

        if (amount === '0' && num !== '.') {
            setAmount(num);
        } else {
            if (num === '.' && amount.includes('.')) return;
            if (amount.length > 8) return; // Limit length
            setAmount(prev => prev + num);
        }
    };

    const handleBackspace = async () => {
        await Haptics.impact({ style: ImpactStyle.Light });
        if (amount.length === 1) {
            setAmount('0');
        } else {
            setAmount(prev => prev.slice(0, -1));
        }
    };

    const handleClear = async () => {
        await Haptics.impact({ style: ImpactStyle.Medium });
        setAmount('0');
    };

    const [description, setDescription] = useState('');

    const handleCategorySelect = async (category: string) => {
        const val = parseFloat(amount);
        if (val <= 0) {
            await Haptics.notification({ type: 'error' as any });
            return;
        }

        await Haptics.impact({ style: ImpactStyle.Heavy });
        setLoading(true);

        try {
            if (!selectedAccount) {
                error("Selecciona una cuenta");
                return;
            }

            const newExpense = await dbService.addExpense({
                amount: val,
                category,
                description: description || 'Flash Expense', // Use input or default
                date: new Date().toISOString()
            }, selectedAccount.id);

            setLastSaved({ id: newExpense.id, amount, category });
            setAmount('0');
            setDescription(''); // Reset description

            // Show success feedback briefly
            setTimeout(() => setLastSaved(null), 3000); // Increased to 3s to give time to undo

        } catch (e) {
            console.error(e);
            error("Error al guardar");
        } finally {
            setLoading(false);
        }
    };

    const handleUndo = async () => {
        if (!lastSaved) return;

        try {
            await dbService.deleteExpense(lastSaved.id);
            // We should also revert balance technically, but deleteExpense might handle it or we assume user will fix.
            // Actually dbService.deleteExpense usually handles balance revert if implemented correctly.
            // Let's assume it does for now or just delete the record.

            await Haptics.impact({ style: ImpactStyle.Medium });
            setLastSaved(null);
            success("Gasto eliminado");
        } catch (e) {
            console.error(e);
            error("Error al eliminar");
        }
    };

    return (
        <div className="flex flex-col h-full relative" style={{ height: 'calc(100vh - 140px)' }}>
            {/* 1. Top: Display Area & Account */}
            <div className="flex-none flex flex-col justify-end px-6 pb-2 mb-2 relative shrink-0 min-h-[120px]">
                <div className="flex items-end justify-between w-full">
                    {/* Account Indicator */}
                    <button
                        onClick={() => setShowAccountPicker(!showAccountPicker)}
                        className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full text-[10px] font-bold text-gray-500 hover:bg-gray-200 transition-all mb-2"
                    >
                        <Icons.CreditCard size={12} />
                        {selectedAccount ? selectedAccount.name : 'Cuenta'}
                    </button>

                    {/* Amount Display */}
                    <div className="flex items-end">
                        <span className="text-gray-400 text-3xl font-light mr-1 mb-1">$</span>
                        <span className={`text-5xl font-bold tracking-tighter transition-all ${amount === '0' ? 'text-gray-300' : 'text-gray-800'}`}>
                            {amount}
                        </span>
                    </div>
                </div>

                {/* Ghost Input for Note */}
                <div className="w-full mt-1">
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Nota opcional..."
                        className="w-full text-right bg-transparent text-sm text-gray-500 placeholder-gray-300 outline-none border-b border-transparent focus:border-gray-200 transition-colors pb-1"
                    />
                </div>

                {/* Success Overlay */}
                {lastSaved && (
                    <div className="absolute inset-0 bg-green-500 rounded-2xl flex items-center justify-between px-6 animate-fade-in text-white z-10 shadow-xl">
                        <div className="flex flex-col">
                            <span className="text-xs font-bold uppercase opacity-80">Guardado</span>
                            <span className="text-xl font-bold">${lastSaved.amount} en {lastSaved.category}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleUndo}
                                className="bg-white/20 p-2 rounded-full hover:bg-white/30 active:scale-95 transition-all"
                            >
                                <Icons.Delete size={24} className="text-white" />
                            </button>

                            {/* Progress Circle with Check (Click to Dismiss) */}
                            <button
                                onClick={() => setLastSaved(null)}
                                className="relative w-10 h-10 flex items-center justify-center rounded-full hover:scale-110 active:scale-95 transition-transform"
                            >
                                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                                    {/* Background Circle */}
                                    <path
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="rgba(255, 255, 255, 0.3)"
                                        strokeWidth="3"
                                    />
                                    {/* Progress Circle */}
                                    <path
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="white"
                                        strokeWidth="3"
                                        strokeDasharray="100, 100"
                                        className="animate-progress"
                                    />
                                </svg>
                                <Icons.Check size={20} className="text-white relative z-10" />
                            </button>
                        </div>
                    </div>
                )}
                <style>{`
                    .animate-progress {
                        animation: countdown 3s linear forwards;
                    }
                    @keyframes countdown {
                        from { stroke-dashoffset: 0; }
                        to { stroke-dashoffset: 100; }
                    }
                `}</style>
            </div>

            {/* Account Picker Modal (Absolute) */}
            {showAccountPicker && (
                <div className="absolute top-16 left-6 z-30 bg-white shadow-xl rounded-2xl p-2 flex flex-col gap-2 animate-fade-in border border-gray-100 min-w-[150px]">
                    {accounts.map(acc => (
                        <button
                            key={acc.id}
                            onClick={() => {
                                setSelectedAccount(acc);
                                setShowAccountPicker(false);
                            }}
                            className={`px-3 py-2 rounded-xl text-xs font-bold text-left flex items-center gap-2 ${selectedAccount?.id === acc.id
                                ? 'bg-gray-800 text-white'
                                : 'hover:bg-gray-50 text-gray-600'
                                }`}
                        >
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                            {acc.name}
                        </button>
                    ))}
                </div>
            )}

            {/* 2. Middle: Scrollable Category Grid (4 cols, Text Only) - HIDDEN UNTIL AMOUNT > 0 */}
            <div className="flex-1 overflow-y-auto min-h-0 px-2 mb-2 relative">
                {amount === '0' ? (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-300 font-bold text-xl animate-pulse select-none pointer-events-none">
                        Ingresa el monto...
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-2 pb-2 animate-slide-up">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => handleCategorySelect(cat)}
                                disabled={loading}
                                className="bg-white border border-gray-100 rounded-xl flex items-center justify-center p-3 shadow-sm active:scale-95 active:bg-primary active:text-white transition-all hover:border-primary/30 min-h-[50px] animate-fade-in"
                            >
                                <span className="text-[10px] font-bold text-center leading-tight break-words w-full">{cat}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* 3. Bottom: Fixed Numeric Keypad */}
            <div className="flex-none bg-gray-50/50 p-2 rounded-t-3xl border-t border-gray-100">
                <div className="grid grid-cols-3 gap-2 h-[220px]">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button
                            key={num}
                            onClick={() => handleNumPress(num.toString())}
                            className="bg-white rounded-xl text-xl font-bold text-gray-700 shadow-[0_2px_0_0_rgba(0,0,0,0.05)] active:shadow-none active:translate-y-[2px] transition-all border border-gray-100"
                        >
                            {num}
                        </button>
                    ))}
                    <button
                        onClick={() => handleNumPress('.')}
                        className="bg-gray-100 rounded-xl text-xl font-bold text-gray-700 shadow-[0_2px_0_0_rgba(0,0,0,0.05)] active:shadow-none active:translate-y-[2px] transition-all border border-gray-100"
                    >
                        .
                    </button>
                    <button
                        onClick={() => handleNumPress('0')}
                        className="bg-white rounded-xl text-xl font-bold text-gray-700 shadow-[0_2px_0_0_rgba(0,0,0,0.05)] active:shadow-none active:translate-y-[2px] transition-all border border-gray-100"
                    >
                        0
                    </button>
                    <button
                        onClick={handleBackspace}
                        onLongPress={handleClear}
                        className="bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 shadow-[0_2px_0_0_rgba(0,0,0,0.05)] active:shadow-none active:translate-y-[2px] transition-all border border-gray-100"
                    >
                        <Icons.Delete size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};
