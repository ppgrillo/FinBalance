import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Account, Expense } from '../types';
import { dbService } from '../services/dbService';
import { Icons } from '../components/Icons';
import { EditExpenseModal } from '../components/EditExpenseModal';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export const AccountDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [account, setAccount] = useState<Account | null>(null);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

    useEffect(() => {
        if (id) loadData();
    }, [id]);

    const loadData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [accData, expData] = await Promise.all([
                dbService.getAccounts(),
                dbService.getExpenses()
            ]);
            const acc = accData.find(a => a.id === id);
            setAccount(acc || null);
            setExpenses(expData.filter(e => e.accountId === id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // --- Chart Data Preparation ---

    // 1. Balance Trend (Reverse Calculation)
    const balanceHistory = useMemo(() => {
        if (!account) return [];
        let currentBalance = account.balance;
        const history = [];

        // Add current state
        history.push({ date: new Date().toLocaleDateString(), balance: currentBalance });

        // Iterate expenses to reverse-engineer balance
        // Note: This is an approximation. Ideally, we'd have a daily balance snapshot table.
        // We go from newest to oldest.
        // If expense was -100 (spent), previous balance was +100 higher.
        // If income was +100 (earned), previous balance was -100 lower.

        const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Newest first

        // Group by day to avoid too many points
        const dailyChanges: Record<string, number> = {};
        sortedExpenses.forEach(e => {
            const dateStr = new Date(e.date).toLocaleDateString();
            dailyChanges[dateStr] = (dailyChanges[dateStr] || 0) + e.amount;
        });

        // Reconstruct history
        // We need to walk backwards from today.
        // But for the chart, we usually want Oldest -> Newest.
        // So let's calculate the "Starting Balance" first.

        const totalChange = sortedExpenses.reduce((sum, e) => sum + e.amount, 0);
        let runningBalance = currentBalance - totalChange; // Approximate starting balance before these loaded expenses

        // Now build forward history
        const chartData = [];
        // Sort expenses oldest to newest for forward calculation
        const oldestToNewest = [...expenses].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (oldestToNewest.length > 0) {
            // Add initial point
            chartData.push({ date: 'Inicio', balance: runningBalance });

            oldestToNewest.forEach(e => {
                runningBalance += e.amount;
                chartData.push({
                    date: new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                    balance: runningBalance
                });
            });
        } else {
            chartData.push({ date: 'Hoy', balance: currentBalance });
        }

        return chartData;
    }, [account, expenses]);

    // 2. Category Distribution
    const categoryData = useMemo(() => {
        const groups: Record<string, number> = {};
        expenses.filter(e => e.amount < 0).forEach(e => { // Only expenses for pie chart
            const amount = Math.abs(e.amount);
            groups[e.category] = (groups[e.category] || 0) + amount;
        });
        return Object.entries(groups)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [expenses]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    if (loading) return <div className="p-10 text-center text-gray-400">Cargando detalles...</div>;
    if (!account) return <div className="p-10 text-center text-gray-400">Cuenta no encontrada</div>;

    return (
        <div className="pb-24 space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-xl shadow-sm text-gray-500 hover:text-primary">
                    <Icons.ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold">{account.name}</h1>
                    <p className="text-textSecondary text-sm">{account.type}</p>
                </div>
            </div>

            {/* Main Card */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-gray-400 text-sm mb-1">Saldo Actual</p>
                    <h2 className="text-4xl font-bold">${account.balance.toLocaleString()}</h2>
                </div>
                <div className="absolute right-0 top-0 h-full w-1/2 opacity-10 pointer-events-none">
                    {/* Decorative background pattern could go here */}
                    <Icons.Wallet size={150} />
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Balance Trend */}
                <div className="bg-white p-4 rounded-3xl shadow-sm">
                    <h3 className="font-bold text-gray-700 mb-4">Tendencia de Saldo</h3>
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={balanceHistory}>
                                <defs>
                                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="date" hide />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Saldo']}
                                />
                                <Area type="monotone" dataKey="balance" stroke="#8884d8" fillOpacity={1} fill="url(#colorBalance)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Expenses by Category */}
                <div className="bg-white p-4 rounded-3xl shadow-sm">
                    <h3 className="font-bold text-gray-700 mb-4">Gastos por Categoría</h3>
                    <div className="h-[200px] w-full flex items-center justify-center">
                        {categoryData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-gray-400 text-sm">Sin gastos registrados</p>
                        )}
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-2 mt-2 justify-center">
                        {categoryData.slice(0, 4).map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-1 text-xs text-gray-500">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                {entry.name}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Transactions List */}
            <div className="space-y-4">
                <h3 className="font-bold text-xl px-2">Historial</h3>
                <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
                    {expenses.length > 0 ? expenses.map((exp, i) => (
                        <div
                            key={exp.id}
                            className={`flex items-center justify-between p-4 ${i !== expenses.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50 transition-colors cursor-pointer`}
                            onClick={() => setEditingExpense(exp)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                                    {/* Icon based on category could go here */}
                                    <Icons.Wallet size={18} />
                                </div>
                                <div>
                                    <p className="font-medium text-textPrimary text-sm">{exp.description}</p>
                                    <p className="text-xs text-textSecondary">{new Date(exp.date).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <span className={`font-bold ${exp.amount > 0 ? 'text-red-400' : 'text-green-500'}`}>
                                {exp.amount > 0 ? '-' : '+'}${Math.abs(exp.amount)}
                            </span>
                        </div>
                    )) : (
                        <div className="p-8 text-center text-gray-400">No hay movimientos en esta cuenta.</div>
                    )}
                </div>
            </div>

            <EditExpenseModal
                isOpen={!!editingExpense}
                onClose={() => setEditingExpense(null)}
                expense={editingExpense}
                onSave={loadData}
            />
        </div>
    );
};
