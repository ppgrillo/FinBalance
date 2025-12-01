import React, { useState, useEffect, useRef } from 'react';
import { Icons } from './Icons';
import { dbService } from '../services/dbService';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { CategoryType, Account } from '../types';

export const AddExpenseMinimal: React.FC = () => {
    const { success, error } = useToast();
    const navigate = useNavigate();

    // State
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<string>('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Account State
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
    const [showAccountPicker, setShowAccountPicker] = useState(false);

    // Load Data
    useEffect(() => {
        const loadData = async () => {
            const [catData, accData] = await Promise.all([
                dbService.getCategories(),
                dbService.getAccounts()
            ]);

            if (catData && catData.length > 0) {
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

    const handleDragStart = (e: React.DragEvent, cat: string) => {
        e.dataTransfer.setData("category", cat);
        setIsDragging(true);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const cat = e.dataTransfer.getData("category");
        if (cat) {
            setCategory(cat);
            setIsDragging(false);
        }
    };

    const handleSave = async () => {
        if (!amount || !category) return;

        setLoading(true);
        try {
            if (!selectedAccount) {
                error("Selecciona una cuenta");
                return;
            }

            await dbService.addExpense({
                amount: parseFloat(amount),
                category,
                description,
                date: new Date(date).toISOString()
            }, selectedAccount.id);

            setShowSuccess(true);
            success("¡Guardado!");
        } catch (e) {
            console.error(e);
            error("Error al guardar");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setAmount('');
        setCategory('');
        setDescription('');
        setShowSuccess(false);
    };

    if (showSuccess) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in space-y-8">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-500 mb-4 animate-bounce">
                    <Icons.Check size={48} strokeWidth={3} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">¡Ingreso Guardado!</h2>

                <div className="flex flex-col w-full max-w-xs gap-4">
                    <button
                        onClick={resetForm}
                        className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg hover:bg-purple-600 transition-all"
                    >
                        Agregar otro
                    </button>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                    >
                        Volver al Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col relative h-full" style={{ height: 'calc(100vh - 140px)' }}>
            {/* 1. Date Toggle (Top Center) */}
            <div className="flex justify-center mb-4 shrink-0">
                <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all"
                >
                    <Icons.Calendar size={14} />
                    {date === new Date().toISOString().split('T')[0] ? 'Hoy' : date}
                </button>
            </div>

            {/* Date Picker Modal (Absolute) */}
            {showDatePicker && (
                <div className="absolute top-12 left-0 right-0 z-20 flex justify-center animate-fade-in">
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => {
                            setDate(e.target.value);
                            setShowDatePicker(false);
                        }}
                        className="bg-white border border-gray-200 rounded-xl p-2 shadow-lg outline-none focus:ring-2 focus:ring-primary/50"
                    />
                </div>
            )}

            {/* 2. Accounts (Horizontal Scroll) */}
            <div className="mb-4 shrink-0">
                <div className="overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
                    <div className="flex gap-2 w-max">
                        {accounts.map(acc => (
                            <button
                                key={acc.id}
                                onClick={() => setSelectedAccount(acc)}
                                className={`
                                    px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 whitespace-nowrap
                                    ${selectedAccount?.id === acc.id
                                        ? 'bg-gray-800 text-white border-gray-800 shadow-md'
                                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'}
                                `}
                            >
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                                {acc.name}
                            </button>
                        ))}
                        <button
                            onClick={() => navigate('/wallet')}
                            className="px-3 py-2 rounded-xl text-xs font-bold border border-dashed border-gray-300 text-gray-400 hover:text-primary hover:border-primary whitespace-nowrap"
                        >
                            + Cuenta
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. Amount & Description (Expanded Section) */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 mb-4 shrink-0 flex flex-col items-center justify-center gap-8 min-h-[300px]">
                {/* Amount */}
                <div className="relative w-full max-w-[280px]">
                    <span className={`absolute left-0 top-1/2 -translate-y-1/2 text-5xl font-bold transition-colors ${amount ? 'text-primary' : 'text-gray-300'}`}>$</span>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                        className="w-full bg-transparent text-7xl font-bold text-center outline-none text-gray-800 placeholder-gray-200"
                        autoFocus
                    />
                </div>

                {/* Description */}
                <div className="w-full max-w-sm border-b-2 border-gray-50 pb-2">
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="📝 ¿Qué compraste?"
                        className="w-full text-center bg-transparent outline-none text-xl font-medium text-gray-600 placeholder-gray-300"
                    />
                </div>
            </div>

            {/* 4. Categories (Grid 4xN - Text Only & Compact) */}
            <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2">
                <div className="grid grid-cols-4 gap-2 pb-24">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategory(cat)}
                            className={`
                                py-3 px-1 rounded-xl transition-all flex items-center justify-center
                                ${category === cat
                                    ? 'bg-primary text-white shadow-md font-bold'
                                    : 'bg-white border border-gray-100 text-gray-500 hover:border-primary/30 hover:bg-purple-50 font-medium'}
                            `}
                        >
                            <span className="text-[11px] text-center leading-tight break-words w-full truncate">
                                {cat}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Floating Save Button */}
            {amount && category && (
                <div className="absolute bottom-6 right-4 animate-slide-up z-50">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-black text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold hover:scale-105 transition-transform active:scale-95"
                    >
                        <span>{loading ? '...' : 'Guardar'}</span>
                        {!loading && <Icons.Check size={18} />}
                    </button>
                </div>
            )}
        </div>
    );
};
