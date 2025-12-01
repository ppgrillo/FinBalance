import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { Icons } from '../components/Icons';
import { Expense } from '../types';
import { useToast } from '../context/ToastContext';

export const Categories: React.FC = () => {
    const { success, error } = useToast();
    const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
    const [categories, setCategories] = useState<{ id: string, name: string, type: string, color?: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<any>(null);

    // Expanded State
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
    const [loadingExpenses, setLoadingExpenses] = useState(false);
    const [budgetedCategories, setBudgetedCategories] = useState<Set<string>>(new Set());

    // Form State
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('#A88BEB');
    const [newType, setNewType] = useState<'expense' | 'income'>('expense');

    const colors = [
        '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4',
        '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#64748B'
    ];

    const loadData = async () => {
        setLoading(true);
        try {
            const [cats, budgets] = await Promise.all([
                dbService.getCategories(),
                dbService.getBudgets()
            ]);
            setCategories(cats);
            setBudgetedCategories(new Set(budgets.map((b: any) => b.category)));
        } catch (e) {
            console.error("Error loading data", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleExpand = async (categoryId: string, categoryName: string) => {
        if (expandedCategory === categoryId) {
            setExpandedCategory(null);
            setRecentExpenses([]);
            return;
        }

        setExpandedCategory(categoryId);
        setLoadingExpenses(true);
        try {
            const expenses = await dbService.getExpensesByCategory(categoryName, 5);
            setRecentExpenses(expenses);
        } catch (e) {
            console.error("Error loading expenses", e);
        } finally {
            setLoadingExpenses(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        try {
            if (editingCategory) {
                await dbService.updateCategory(editingCategory.id, {
                    name: newName,
                    color: newColor,
                    type: newType
                });
                success("Categoría actualizada");
            } else {
                const newCat = await dbService.createCategory(newName, activeTab);
                if (newCat && newCat.id) {
                    await dbService.updateCategory(newCat.id, { color: newColor });
                }
                success("Categoría creada");
            }
            setShowAddModal(false);
            setEditingCategory(null);
            setNewName('');
            setNewColor('#A88BEB');
            loadData();
        } catch (e) {
            error("Error al guardar categoría");
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("¿Estás seguro de eliminar esta categoría?")) return;
        try {
            await dbService.deleteCategory(id);
            loadData();
            success("Categoría eliminada");
        } catch (e) {
            error("Error al eliminar");
        }
    };

    const openEdit = (cat: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingCategory(cat);
        setNewName(cat.name);
        setNewColor(cat.color || '#A88BEB');
        setNewType(cat.type as 'expense' | 'income');
        setShowAddModal(true);
    };

    const pickRandomColor = () => {
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        setNewColor(randomColor);
    };

    const filteredCategories = categories.filter(c => {
        if (activeTab === 'expense') return c.type === 'expense' || !c.type;
        return c.type === 'income';
    });

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800">Categorías</h1>
                <button
                    onClick={() => {
                        setEditingCategory(null);
                        setNewName('');
                        setNewColor('#A88BEB');
                        setNewType(activeTab);
                        setShowAddModal(true);
                    }}
                    className="bg-primary text-white px-4 py-2 rounded-xl font-bold shadow-lg hover:bg-purple-600 transition-all flex items-center gap-2"
                >
                    <Icons.Add size={20} />
                    Nueva
                </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100 p-1 rounded-xl">
                <button
                    onClick={() => setActiveTab('expense')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'expense' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-400'}`}
                >
                    Gastos
                </button>
                <button
                    onClick={() => setActiveTab('income')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'income' ? 'bg-white text-green-500 shadow-sm' : 'text-gray-400'}`}
                >
                    Ingresos
                </button>
            </div>

            {/* Table List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <p className="text-gray-400 text-center py-10">Cargando...</p>
                ) : filteredCategories.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <Icons.Tag size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No hay categorías de {activeTab === 'expense' ? 'gasto' : 'ingreso'}.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {filteredCategories.map(cat => (
                            <div key={cat.id} className="group">
                                {/* Row Header */}
                                <div
                                    onClick={() => handleExpand(cat.id, cat.name)}
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-3 h-10 rounded-full"
                                            style={{ backgroundColor: cat.color || '#A88BEB' }}
                                        ></div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-gray-800">{cat.name}</h3>
                                                {budgetedCategories.has(cat.name) && (
                                                    <div className="text-primary" title="Tiene presupuesto asignado">
                                                        <Icons.Wallet size={14} />
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400 capitalize">{cat.type || 'expense'}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => openEdit(cat, e)}
                                            className="p-2 text-gray-400 hover:text-primary hover:bg-purple-50 rounded-lg transition-colors"
                                        >
                                            <Icons.Edit size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => handleDelete(cat.id, e)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Icons.Trash size={18} />
                                        </button>
                                        <div className={`text-gray-300 transition-transform duration-300 ${expandedCategory === cat.id ? 'rotate-180' : ''}`}>
                                            <Icons.ChevronDown size={20} />
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedCategory === cat.id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                                    <div className="bg-gray-50/50 p-4 pl-12 border-t border-gray-100">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Últimos Movimientos</h4>

                                        {loadingExpenses ? (
                                            <div className="flex justify-center py-4">
                                                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                            </div>
                                        ) : recentExpenses.length > 0 ? (
                                            <div className="space-y-2">
                                                {recentExpenses.map(expense => (
                                                    <div key={expense.id} className="flex justify-between items-center text-sm bg-white p-2 rounded-lg border border-gray-100">
                                                        <div className="flex gap-2">
                                                            <span className="text-gray-400 font-mono text-xs pt-0.5">
                                                                {new Date(expense.date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                                            </span>
                                                            <span className="text-gray-700 font-medium">{expense.description}</span>
                                                        </div>
                                                        <span className={`font-bold ${expense.amount < 0 ? 'text-gray-800' : 'text-green-600'}`}>
                                                            ${Math.abs(expense.amount).toLocaleString()}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-400 italic">No hay movimientos recientes.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">
                            {editingCategory ? 'Editar Categoría' : `Nueva Categoría`}
                        </h2>

                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nombre</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50 font-bold"
                                    placeholder="Ej. Comida, Transporte..."
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Tipo</label>
                                <div className="flex bg-gray-100 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setNewType('expense')}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${newType === 'expense' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-400'}`}
                                    >
                                        Gasto
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewType('income')}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${newType === 'income' ? 'bg-white text-green-500 shadow-sm' : 'text-gray-400'}`}
                                    >
                                        Ingreso
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Color</label>
                                <div className="flex flex-wrap gap-2">
                                    {colors.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setNewColor(c)}
                                            className={`w-8 h-8 rounded-full transition-transform ${newColor === c ? 'scale-110 ring-2 ring-offset-2 ring-gray-300' : 'hover:scale-105'}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}

                                    {/* Custom Color Picker */}
                                    <div className="relative group">
                                        <input
                                            type="color"
                                            value={newColor}
                                            onChange={(e) => setNewColor(e.target.value)}
                                            className="absolute inset-0 w-8 h-8 opacity-0 cursor-pointer z-10"
                                            title="Color personalizado"
                                        />
                                        <button
                                            type="button"
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-transform ${!colors.some(c => c.toLowerCase() === newColor.toLowerCase())
                                                ? 'scale-110 ring-2 ring-offset-2 ring-gray-300'
                                                : 'hover:scale-105'
                                                }`}
                                            style={{
                                                background: !colors.some(c => c.toLowerCase() === newColor.toLowerCase())
                                                    ? newColor
                                                    : 'linear-gradient(135deg, #EC4899, #8B5CF6, #3B82F6)'
                                            }}
                                        >
                                            {!colors.some(c => c.toLowerCase() === newColor.toLowerCase()) ? (
                                                <Icons.Edit size={14} strokeWidth={2} />
                                            ) : (
                                                <Icons.Plus size={14} strokeWidth={3} />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 rounded-xl font-bold text-white bg-primary hover:bg-purple-600 shadow-lg shadow-primary/30"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
