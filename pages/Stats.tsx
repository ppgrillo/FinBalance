import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { dbService } from '../services/dbService';
import { Expense, Budget, User } from '../types';
import { Icons } from '../components/Icons';
import { Link } from 'react-router-dom';

interface Props {
    user: User;
}

export const Stats: React.FC<Props> = ({ user }) => {
    const [transactions, setTransactions] = useState<Expense[]>([]);
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [view, setView] = useState<'overview' | 'categories'>('overview');
    const [periodLabel, setPeriodLabel] = useState('');
    const [periodRange, setPeriodRange] = useState('');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [txData, budData] = await Promise.all([
                    dbService.getExpenses(),
                    dbService.getBudgets()
                ]);
                setTransactions(txData);
                setBudgets(budData);

                const { label, start, end } = dbService.calculatePeriodRange(user);
                setPeriodLabel(label);
                setPeriodRange(`${start.toLocaleDateString()} - ${end.toLocaleDateString()}`);

            } catch (error) {
                console.error("Error loading stats data", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [user]);

    // --- DATA PROCESSING ---

    // 1. Period Filtering
    const { start, end } = dbService.calculatePeriodRange(user);
    const currentPeriodTx = transactions.filter(t => dbService.isDateInPeriod(t.date, start, end));

    const periodIncome = currentPeriodTx.filter(t => t.amount < 0).reduce((acc, curr) => acc + Math.abs(curr.amount), 0);
    const periodExpense = currentPeriodTx.filter(t => t.amount > 0).reduce((acc, curr) => acc + curr.amount, 0);
    const periodNetBalance = periodIncome - periodExpense;
    const periodSavingsRate = periodIncome > 0 ? ((periodNetBalance / periodIncome) * 100) : 0;

    // 2. Historical Data
    const getMonthlyData = () => {
        const months: Record<string, { name: string, income: number, expense: number, rawDate: Date }> = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            const name = d.toLocaleDateString('es-MX', { month: 'short' });
            months[key] = { name: name.charAt(0).toUpperCase() + name.slice(1), income: 0, expense: 0, rawDate: d };
        }
        transactions.forEach(t => {
            const d = new Date(t.date);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (months[key]) {
                if (t.amount < 0) months[key].income += Math.abs(t.amount);
                else months[key].expense += t.amount;
            }
        });
        return Object.values(months).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
    };
    const cashFlowData = getMonthlyData();

    // 3. Budget Analysis
    const calculatedBudgets = budgets.map(b => {
        const spentInPeriod = currentPeriodTx
            .filter(t => t.category === b.category && t.amount > 0)
            .reduce((sum, t) => sum + t.amount, 0);
        return { ...b, spent: spentInPeriod };
    });

    const budgetedCategories = budgets.map(b => b.category);

    // LEAK DETECTOR: Expenses without budget
    const unbudgetedExpenses = currentPeriodTx.filter(t => t.amount > 0 && !budgetedCategories.includes(t.category));
    const unbudgetedSpent = unbudgetedExpenses.reduce((sum, t) => sum + t.amount, 0);

    // Group unbudgeted by category to show top leaks
    const unbudgetedByCat: Record<string, number> = {};
    unbudgetedExpenses.forEach(e => {
        unbudgetedByCat[e.category] = (unbudgetedByCat[e.category] || 0) + e.amount;
    });
    const topLeaks = Object.entries(unbudgetedByCat)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

    const totalBudgeted = calculatedBudgets.reduce((acc, b) => acc + b.limit, 0);
    const totalSpentInBudgets = calculatedBudgets.reduce((acc, b) => acc + b.spent, 0);
    const totalActualSpent = totalSpentInBudgets + unbudgetedSpent;

    const budgetsOverLimit = calculatedBudgets.filter(b => b.spent > b.limit).length;
    const budgetsUnderLimit = calculatedBudgets.length - budgetsOverLimit;

    // 4. Category Breakdown
    const uniqueCategories = Array.from(new Set(currentPeriodTx.filter(t => t.amount > 0).map(e => e.category)));
    const categoryData = uniqueCategories.map(cat => {
        const total = currentPeriodTx
            .filter(e => e.category === cat && e.amount > 0)
            .reduce((sum, e) => sum + e.amount, 0);
        return { name: cat, value: total };
    }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

    const COLORS = ['#A88BEB', '#F8C0FF', '#F9F871', '#FF9AA2', '#B5EAD7', '#C7CEEA', '#E2F0CB', '#FFDAC1'];

    // 5. Drill down
    const filteredCategoryExpenses = selectedCategory
        ? currentPeriodTx.filter(e => e.category === selectedCategory).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        : [];

    // Gauge Data
    const gaugeData = [
        { name: 'Savings', value: Math.max(0, periodSavingsRate) },
        { name: 'Gap', value: Math.max(0, 100 - periodSavingsRate) }
    ];
    const gaugeColor = periodSavingsRate >= 20 ? '#4ADE80' : periodSavingsRate > 0 ? '#60A5FA' : '#F87171';

    if (loading) return <div className="p-10 text-center animate-pulse">Analizando finanzas...</div>;

    return (
        <div className="space-y-8 pb-24">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Salud Financiera</h1>
                    <p className="text-xs text-gray-500">Periodo actual: {periodLabel}</p>
                </div>
                <div className="bg-gray-100 p-1 rounded-xl flex self-start md:self-auto">
                    <button
                        onClick={() => setView('overview')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'overview' ? 'bg-white shadow-sm text-primary' : 'text-gray-400'}`}
                    >
                        Balance
                    </button>
                    <button
                        onClick={() => setView('categories')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'categories' ? 'bg-white shadow-sm text-primary' : 'text-gray-400'}`}
                    >
                        Categorías
                    </button>
                </div>
            </div>

            {view === 'overview' && (
                <div className="space-y-6 animate-fade-in">

                    {/* 1. SAVINGS GAUGE & CASH FLOW */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-6 rounded-3xl shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
                            <h3 className="text-sm font-bold text-gray-500 absolute top-6 left-6">Tasa de Ahorro</h3>

                            <div className="w-48 h-24 mt-8 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={gaugeData}
                                            cx="50%"
                                            cy="100%"
                                            startAngle={180}
                                            endAngle={0}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={0}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            <Cell fill={gaugeColor} />
                                            <Cell fill="#f3f4f6" />
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                                    <span className="text-2xl font-bold" style={{ color: gaugeColor }}>
                                        {periodSavingsRate.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-2 text-center max-w-[200px]">
                                {periodSavingsRate >= 20 ? '¡Excelente! Estás construyendo riqueza.' : periodSavingsRate > 0 ? 'Vas bien, intenta llegar al 20%.' : 'Cuidado, estás gastando tus ahorros.'}
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-3xl shadow-sm flex flex-col justify-center">
                            <h3 className="text-sm font-bold text-gray-500 mb-4">Flujo de Caja (Periodo)</h3>
                            <div className="flex items-end gap-2 mb-2">
                                <span className={`text-3xl font-bold ${periodNetBalance >= 0 ? 'text-gray-800' : 'text-red-500'}`}>
                                    {periodNetBalance >= 0 ? '+' : '-'}${Math.abs(periodNetBalance).toLocaleString()}
                                </span>
                                <span className="text-xs text-gray-400 mb-1">neto</span>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">Ingresos</span>
                                    <span className="font-bold text-green-500">+${periodIncome.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">Gastos</span>
                                    <span className="font-bold text-red-500">-${periodExpense.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. LEAK DETECTOR (Unbudgeted Expenses) */}
                    {unbudgetedSpent > 0 && (
                        <div className="bg-orange-50 border border-orange-100 p-6 rounded-3xl shadow-sm">
                            <div className="flex items-start gap-4">
                                <div className="bg-orange-100 p-3 rounded-full text-orange-500 shrink-0">
                                    <Icons.Trending size={24} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-orange-800 text-lg">Fugas de Dinero Detectadas</h3>
                                    <p className="text-sm text-orange-700 mt-1">
                                        Has gastado <span className="font-bold">${unbudgetedSpent.toLocaleString()}</span> en categorías sin presupuesto.
                                        Esto representa el {((unbudgetedSpent / periodExpense) * 100).toFixed(0)}% de tus gastos totales.
                                    </p>

                                    <div className="mt-4 bg-white/50 rounded-xl p-3">
                                        <p className="text-xs font-bold text-orange-800 uppercase mb-2">Principales Fugas:</p>
                                        <div className="space-y-2">
                                            {topLeaks.map(leak => (
                                                <div key={leak.name} className="flex justify-between text-sm">
                                                    <span className="text-gray-600">{leak.name}</span>
                                                    <span className="font-bold text-orange-600">-${leak.amount.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <Link to="/budgets" className="text-xs font-bold text-orange-600 hover:text-orange-800 underline">
                                            Crear presupuestos para controlar esto &rarr;
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. BUDGET PERFORMANCE */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm">
                        <h3 className="font-bold text-lg mb-6">Desempeño de Presupuestos</h3>

                        <div className="space-y-6">
                            {calculatedBudgets.map(b => {
                                const pct = Math.min((b.spent / b.limit) * 100, 100);
                                const isOver = b.spent > b.limit;
                                return (
                                    <div key={b.category}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-medium">{b.category}</span>
                                            <span className={isOver ? 'text-red-500 font-bold' : 'text-gray-500'}>
                                                ${b.spent.toLocaleString()} / ${b.limit.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${isOver ? 'bg-red-500' : ''}`}
                                                style={{ width: `${pct}%`, backgroundColor: isOver ? undefined : b.color }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                            {calculatedBudgets.length === 0 && <p className="text-gray-400 text-center text-sm">No hay presupuestos.</p>}
                        </div>
                    </div>

                    {/* 4. HISTORICAL CHART */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm">
                        <h3 className="font-bold text-lg mb-6">Histórico (6 Meses)</h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={cashFlowData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF' }} />
                                    <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val / 1000}k`} tick={{ fill: '#9CA3AF' }} />
                                    <Tooltip
                                        cursor={{ fill: '#F9FAFB' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                        formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                                    />
                                    <Bar name="Ingresos" dataKey="income" fill="#4ADE80" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Bar name="Gastos" dataKey="expense" fill="#F87171" radius={[4, 4, 0, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {view === 'categories' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-white p-6 rounded-3xl shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="font-bold text-lg text-textPrimary">Gastos del Periodo</h3>
                                <p className="text-xs text-textSecondary">Mostrando solo gastos de: {periodLabel}</p>
                            </div>
                            <Link to="/expenses" className="bg-gray-50 hover:bg-gray-100 text-primary px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors">
                                <Icons.List size={16} />
                                Gestionar Categorías
                            </Link>
                        </div>

                        {categoryData.length > 0 ? (
                            <>
                                <div className="h-64 w-full relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={categoryData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                                onClick={(data) => setSelectedCategory(data.name === selectedCategory ? null : data.name)}
                                                className="cursor-pointer outline-none"
                                            >
                                                {categoryData.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={COLORS[index % COLORS.length]}
                                                        strokeWidth={selectedCategory === entry.name ? 4 : 0}
                                                        stroke={selectedCategory === entry.name ? '#1E1E1E' : 'none'}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                                        </PieChart>
                                    </ResponsiveContainer>

                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                                        {selectedCategory ? (
                                            <>
                                                <p className="text-xs text-textSecondary">Total</p>
                                                <p className="font-bold text-primary text-lg truncate max-w-[100px]">{selectedCategory}</p>
                                            </>
                                        ) : (
                                            <p className="text-xs text-textSecondary w-20">Toca para filtrar</p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-4 max-h-40 overflow-y-auto custom-scrollbar">
                                    {categoryData.map((entry, index) => (
                                        <div
                                            key={index}
                                            className={`flex items-center gap-2 p-1 rounded-lg cursor-pointer transition-colors ${selectedCategory === entry.name ? 'bg-gray-50' : ''}`}
                                            onClick={() => setSelectedCategory(entry.name === selectedCategory ? null : entry.name)}
                                        >
                                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                            <span className="text-xs text-textSecondary flex-1 truncate">{entry.name}</span>
                                            <span className="text-xs font-bold">${entry.value.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-10">
                                <p className="text-gray-400 mb-4">No hay gastos registrados en este periodo.</p>
                                <Link to="/add" className="text-primary font-bold hover:underline text-sm">
                                    Registrar mi primer gasto
                                </Link>
                            </div>
                        )}
                    </div>

                    {selectedCategory && (
                        <div className="bg-white rounded-3xl shadow-sm overflow-hidden animate-fade-in">
                            <div className="p-4 bg-gray-50 border-b border-gray-100">
                                <h3 className="font-bold text-sm">Detalle: {selectedCategory}</h3>
                            </div>
                            {filteredCategoryExpenses.slice(0, 10).map((exp, i) => (
                                <div key={exp.id} className={`flex items-center justify-between p-4 ${i !== filteredCategoryExpenses.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                    <div>
                                        <p className="font-medium text-textPrimary text-sm">{exp.description}</p>
                                        <p className="text-xs text-textSecondary">{new Date(exp.date).toLocaleDateString()}</p>
                                    </div>
                                    <span className="font-semibold text-textPrimary">${exp.amount.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
