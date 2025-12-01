import React, { useState, useEffect } from 'react';
import { Expense, Account } from '../types';
import { dbService } from '../services/dbService';
import { Icons } from './Icons';
import { useToast } from '../context/ToastContext';

interface EditExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    expense: Expense | null;
    onSave: () => void;
}

export const EditExpenseModal: React.FC<EditExpenseModalProps> = ({ isOpen, onClose, expense, onSave }) => {
    const { success, error } = useToast();
    const [form, setForm] = useState<Partial<Expense>>({});
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && expense) {
            setForm({
                ...expense,
                date: expense.date // Ensure date is preserved
            });
            loadAccounts();
        }
    }, [isOpen, expense]);

    const loadAccounts = async () => {
        try {
            const data = await dbService.getAccounts();
            setAccounts(data);
        } catch (e) {
            console.error("Error loading accounts", e);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!expense || !form.amount) return;

        setLoading(true);
        try {
            await dbService.updateExpense(expense.id, {
                amount: form.amount,
                category: form.category,
                description: form.description,
                date: form.date,
                accountId: form.accountId
            });
            success("Gasto actualizado");
            onSave();
            onClose();
        } catch (err) {
            error("Error al actualizar");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !expense) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Icons.Edit size={20} className="text-primary" /> Editar Gasto
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600">
                        <Icons.Close size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Amount */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Monto</label>
                        <div className="relative mt-1">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-800 font-bold">$</span>
                            <input
                                type="number"
                                value={Math.abs(form.amount || 0)}
                                onChange={(e) => setForm({ ...form, amount: (form.amount || 0) > 0 ? Number(e.target.value) : -Number(e.target.value) })}
                                className="w-full bg-gray-50 p-3 pl-8 rounded-xl outline-none focus:ring-2 focus:ring-primary font-bold text-lg"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Descripción</label>
                        <input
                            type="text"
                            value={form.description || ''}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary mt-1"
                        />
                    </div>

                    {/* Date */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Fecha</label>
                        <input
                            type="date"
                            value={form.date ? form.date.split('T')[0] : ''}
                            onChange={(e) => setForm({ ...form, date: new Date(e.target.value).toISOString() })}
                            className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary mt-1"
                        />
                    </div>

                    {/* Account Selection */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Cuenta de Pago</label>
                        <select
                            value={form.accountId || ''}
                            onChange={(e) => setForm({ ...form, accountId: e.target.value })}
                            className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary mt-1"
                        >
                            <option value="" disabled>Seleccionar cuenta...</option>
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name} (${acc.balance})</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-gray-400 mt-1">Cambiar la cuenta ajustará los saldos automáticamente.</p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-indigo-600 mt-4 disabled:opacity-50"
                    >
                        {loading ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </form>
            </div>
        </div>
    );
};
