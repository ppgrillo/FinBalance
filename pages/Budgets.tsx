import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { Budget, CategoryType, Expense } from '../types';
import { dbService } from '../services/dbService';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

import { User } from '../types';
import { useToast } from '../context/ToastContext';
import { ConfirmModal } from '../components/ConfirmModal';

interface Props {
    user: User | null;
}

export const Budgets: React.FC<Props> = ({ user }) => {
    const { success, error, warning } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [categories, setCategories] = useState<{ name: string, color?: string }[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);

    // UI States
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedBudgetForDetail, setSelectedBudgetForDetail] = useState<Budget | null>(null);

    // Confirm Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'warning' | 'danger' | 'info';
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'warning',
        onConfirm: () => { }
    });

    // Form State
    const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
    const [category, setCategory] = useState<string>('');
    const [limit, setLimit] = useState<string>('');
    const [color, setColor] = useState<string>('#A88BEB');

    // Dynamic Category Creation
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const [bData, cData, eData] = await Promise.all([
                dbService.getBudgets(),
                dbService.getCategories(),
                dbService.getExpenses()
            ]);

            // Calculate Spent based on Period
            let updatedBudgets = bData;
            if (user) {
                const { start, end } = dbService.calculatePeriodRange(user);
                const periodExpenses = eData.filter(e => dbService.isDateInPeriod(e.date, start, end));

                updatedBudgets = bData.map(b => ({
                    ...b,
                    spent: periodExpenses
                        .filter(e => e.category === b.category && e.amount > 0)
                        .reduce((sum, e) => sum + e.amount, 0)
                }));
            }

            setBudgets(updatedBudgets);
            setExpenses(eData);

            if (cData.length > 0) {
                setCategories(cData);
            } else {
                setCategories(Object.values(CategoryType).map(c => ({ name: c, color: '#A88BEB' })));
            }
        } catch (e) {
            console.error(e);
            error("Error al cargar datos");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Auto-expand logic
    useEffect(() => {
        if (budgets.length > 0 && location.state?.expandCategory) {
            const target = budgets.find(b => b.category === location.state.expandCategory);
            if (target) {
                setSelectedBudgetForDetail(target);
                // Clear state so it doesn't re-trigger
                navigate(location.pathname, { replace: true, state: {} });
            }
        }
    }, [budgets, location.state, navigate, location.pathname]);

    const openEdit = (budget: Budget) => {
        // Switch from Detail View to Edit View
        setEditingBudget(budget);
        setCategory(budget.category);
        setLimit(budget.limit.toString());
        setColor(budget.color || '#A88BEB');
        setIsCreatingCategory(false);
        setIsEditModalOpen(true);
        setSelectedBudgetForDetail(null); // Close detail modal if open
    };

    const openCreate = () => {
        setEditingBudget(null);
        setCategory(categories.length > 0 ? categories[0].name : CategoryType.Food);
        setLimit('');
        setColor('#A88BEB');
        setIsCreatingCategory(false);
        setNewCategoryName('');
        setIsEditModalOpen(true);
    };

    const openDetail = (budget: Budget) => {
        setSelectedBudgetForDetail(budget);
    };

    const handleDelete = async () => {
        if (!editingBudget) return;

        setConfirmModal({
            isOpen: true,
            title: 'Eliminar Presupuesto',
            message: `¿Estás seguro de que deseas eliminar el presupuesto de ${editingBudget.category}?`,
            type: 'danger',
            onConfirm: async () => {
                try {
                    await dbService.deleteBudget(editingBudget.category);
                    await loadData();
                    setIsEditModalOpen(false);
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    success("Presupuesto eliminado");
                } catch (e) {
                    error("Error eliminando presupuesto");
                }
            }
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(limit);
        if (!amount) return;

        const saveLogic = async () => {
            try {
                let finalCategory = category;

                if (isCreatingCategory && newCategoryName.trim()) {
                    finalCategory = newCategoryName.trim();
                }

                if (editingBudget) {
                    // Update existing
                    await dbService.updateBudget(finalCategory, amount, color);
                } else {
                    // Create new
                    if (budgets.some(b => b.category === finalCategory)) {
                        warning("Esta categoría ya tiene un presupuesto.");
                        return;
                    }
                    await dbService.addBudget(finalCategory, amount, color);
                }

                await loadData();
                setIsEditModalOpen(false);
                success("Presupuesto guardado correctamente");
            } catch (e) {
                console.error(e);
                error("Error al guardar presupuesto");
            }
        };

        // --- SMART VALIDATION ---
        if (user) {
            const currentTotal = budgets.reduce((sum, b) => sum + b.limit, 0);
            const oldAmount = editingBudget ? editingBudget.limit : 0;
            const newTotal = currentTotal - oldAmount + amount;

            if (newTotal > user.monthlyLimit) {
                setConfirmModal({
                    isOpen: true,
                    title: '⚠️ Límite Excedido',
                    message: `Esto hará que tus presupuestos($${newTotal.toLocaleString()}) superen tu Límite Total de Ingresos($${user.monthlyLimit.toLocaleString()}).\n\n¿Deseas continuar de todas formas ? `,
                    type: 'warning',
                    onConfirm: async () => {
                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                        await saveLogic();
                    }
                });
                return;
            }
        }
        // ------------------------

        await saveLogic();
    };

    // Helper for Chart Data
    const getChartData = (categoryName: string) => {
        // Filter expenses for this category, sort by date ascending
        const filtered = expenses
            .filter(e => e.category === categoryName && e.amount > 0)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Aggregate by day
        const grouped: Record<string, number> = {};
        filtered.forEach(e => {
            const d = new Date(e.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
            grouped[d] = (grouped[d] || 0) + e.amount;
        });

        return Object.keys(grouped).map(k => ({ date: k, amount: grouped[k] }));
    };

    if (loading && budgets.length === 0) return <div className="p-10 text-center">Cargando presupuestos...</div>;

    return (
        <div className="pb-24 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Presupuestos</h1>
                <button
                    onClick={openCreate}
                    className="bg-primary text-white px-4 py-2 rounded-xl shadow-md hover:bg-purple-600 flex items-center gap-2 transition-colors"
                >
                    <Icons.Add size={20} />
                    <span className="hidden sm:inline">Nuevo</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {budgets.map((b, i) => {
                    const pct = b.limit > 0 ? Math.min((b.spent / b.limit) * 100, 100) : 100;
                    const isOver = b.spent > b.limit;

                    return (
                        <div
                            key={i}
                            onClick={() => openDetail(b)}
                            className="bg-white p-5 rounded-3xl shadow-sm cursor-pointer hover:shadow-lg transition-all border border-transparent hover:border-primary/20 group relative overflow-hidden"
                        >
                            {/* Decorative gradient blob */}
                            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 blur-xl" style={{ backgroundColor: b.color }}></div>

                            <div className="flex justify-between items-center mb-4 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm text-white font-bold text-lg" style={{ backgroundColor: b.color }}>
                                        {b.category.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-textPrimary text-lg leading-tight">{b.category}</h3>
                                        <p className={`text-xs font-medium ${isOver ? 'text-red-500' : 'text-gray-400'}`}>
                                            {isOver ? 'Excedido' : `${(100 - pct).toFixed(0)}% restante`}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-2 flex justify-between items-end relative z-10">
                                <span className="text-2xl font-bold text-textPrimary">${b.spent.toLocaleString()}</span>
                                <span className="text-xs text-gray-400 font-medium mb-1">de ${b.limit.toLocaleString()}</span>
                            </div>

                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${isOver ? 'bg-red-500' : ''}`}
                                    style={{ width: `${pct}%`, backgroundColor: isOver ? undefined : b.color }}
                                ></div>
                            </div>
                        </div>
                    )
                })}
                {budgets.length === 0 && (
                    <div className="col-span-1 md:col-span-3 text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                            <Icons.Wallet size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-400">Sin presupuestos</h3>
                        <p className="text-sm text-gray-400 mb-4">Define límites para controlar tus gastos.</p>
                        <button onClick={openCreate} className="text-primary font-bold hover:underline">Crear el primero</button>
                    </div>
                )}
            </div>

            {/* DETAIL MODAL (Drill Down) */}
            {selectedBudgetForDetail && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-fade-in overflow-hidden flex flex-col max-h-[90vh]">

                        {/* Header */}
                        <div className="p-6 text-white shrink-0 relative overflow-hidden" style={{ backgroundColor: selectedBudgetForDetail.color }}>
                            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>

                            <div className="flex justify-between items-start mb-6 relative z-10">
                                <h2 className="text-2xl font-bold">{selectedBudgetForDetail.category}</h2>
                                <button onClick={() => setSelectedBudgetForDetail(null)} className="p-2 bg-black/10 rounded-full hover:bg-black/20 transition-colors">
                                    <Icons.Close size={20} />
                                </button>
                            </div>

                            <div className="relative z-10">
                                <p className="text-white/80 text-sm font-medium uppercase tracking-wider">Disponible</p>
                                <h3 className="text-4xl font-bold mt-1">${(selectedBudgetForDetail.limit - selectedBudgetForDetail.spent).toLocaleString()}</h3>
                                <div className="mt-4 flex items-center gap-2 text-xs font-medium bg-black/10 w-fit px-3 py-1 rounded-lg">
                                    <span>Presupuesto total: ${selectedBudgetForDetail.limit.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            {/* Chart */}
                            <div>
                                <h4 className="font-bold text-gray-700 mb-3 text-sm">Tendencia de Gasto</h4>
                                <div className="h-40 w-full bg-gray-50 rounded-2xl p-2 border border-gray-100">
                                    {getChartData(selectedBudgetForDetail.category).length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={getChartData(selectedBudgetForDetail.category)}>
                                                <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                    itemStyle={{ color: selectedBudgetForDetail.color, fontWeight: 'bold' }}
                                                />
                                                <Line type="monotone" dataKey="amount" stroke={selectedBudgetForDetail.color} strokeWidth={3} dot={{ r: 3, fill: selectedBudgetForDetail.color }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-gray-400 text-xs">Sin datos recientes</div>
                                    )}
                                </div>
                            </div>

                            {/* Recent Transactions List */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-gray-700 text-sm">Últimos Movimientos</h4>
                                </div>
                                <div className="space-y-3">
                                    {expenses
                                        .filter(e => e.category === selectedBudgetForDetail.category)
                                        .slice(0, 5)
                                        .map(exp => (
                                            <div key={exp.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                <div>
                                                    <p className="font-semibold text-sm text-textPrimary">{exp.description}</p>
                                                    <p className="text-xs text-gray-400">{new Date(exp.date).toLocaleDateString()}</p>
                                                </div>
                                                <span className="font-bold text-sm text-textPrimary">-${exp.amount}</span>
                                            </div>
                                        ))}
                                    {expenses.filter(e => e.category === selectedBudgetForDetail.category).length === 0 && (
                                        <p className="text-gray-400 text-xs text-center py-4">No hay movimientos registrados.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer Action */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0">
                            <button
                                onClick={() => openEdit(selectedBudgetForDetail)}
                                className="w-full py-3 rounded-xl font-bold bg-white border border-gray-200 text-textPrimary shadow-sm hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <Icons.Edit size={18} />
                                Editar Presupuesto / Color
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT/CREATE MODAL */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">{editingBudget ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}</h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <Icons.Close size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-textSecondary uppercase mb-2">Categoría</label>
                                {editingBudget ? (
                                    <input
                                        type="text"
                                        value={category}
                                        disabled
                                        className="w-full bg-gray-100 text-gray-500 p-3 rounded-xl font-medium"
                                    />
                                ) : (
                                    !isCreatingCategory ? (
                                        <select
                                            value={category}
                                            onChange={(e) => {
                                                if (e.target.value === 'NEW_CATEGORY') {
                                                    setIsCreatingCategory(true);
                                                    setColor('#A88BEB'); // Reset color for new
                                                } else {
                                                    setCategory(e.target.value);
                                                    // Auto-select existing color if available
                                                    const match = categories.find(c => c.name === e.target.value);
                                                    if (match?.color) setColor(match.color);
                                                }
                                            }}
                                            className="w-full bg-background p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                        >
                                            {categories.map(c => (
                                                <option key={c.name} value={c.name}>{c.name}</option>
                                            ))}
                                            <option value="NEW_CATEGORY" className="font-bold text-primary">+ Nueva Categoría...</option>
                                        </select>
                                    ) : (
                                        <div className="flex gap-2 animate-fade-in">
                                            <input
                                                type="text"
                                                placeholder="Nombre de categoría"
                                                className="flex-1 bg-white border-2 border-primary/30 p-3 rounded-xl outline-none focus:border-primary"
                                                autoFocus
                                                value={newCategoryName}
                                                onChange={e => setNewCategoryName(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setIsCreatingCategory(false)}
                                                className="p-3 bg-gray-100 rounded-xl text-gray-500 hover:bg-gray-200"
                                            >
                                                <Icons.Close size={20} />
                                            </button>
                                        </div>
                                    )
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-textSecondary uppercase mb-2">Color de Categoría</label>
                                <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-100">
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        className="w-10 h-10 rounded-lg cursor-pointer border-none bg-transparent"
                                    />
                                    <span className="text-sm font-medium text-gray-500">{color}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-textSecondary uppercase mb-2">Límite Mensual</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-textPrimary font-bold">$</span>
                                    <input
                                        type="number"
                                        value={limit}
                                        onChange={(e) => setLimit(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-background p-3 pl-8 rounded-xl outline-none focus:ring-2 focus:ring-primary font-bold text-lg"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex flex-col gap-3">
                                <button
                                    type="submit"
                                    className="w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all"
                                    style={{ backgroundColor: color }}
                                >
                                    Guardar
                                </button>

                                {editingBudget && (
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        className="w-full py-3 rounded-xl font-semibold text-red-500 hover:bg-red-50 flex items-center justify-center gap-2 border border-transparent hover:border-red-100"
                                    >
                                        <Icons.Trash size={18} /> Eliminar Presupuesto
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
};
