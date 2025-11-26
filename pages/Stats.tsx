
import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, CartesianGrid, AreaChart, Area } from 'recharts';
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

  // 1. Period Filtering for "Current Health" (Budgets & Savings Rate for THIS period)
  const { start, end } = dbService.calculatePeriodRange(user);
  
  // Filter expenses that fall strictly within the user's defined period using robust helper
  const currentPeriodTx = transactions.filter(t => dbService.isDateInPeriod(t.date, start, end));

  const periodIncome = currentPeriodTx.filter(t => t.amount < 0).reduce((acc, curr) => acc + Math.abs(curr.amount), 0);
  const periodExpense = currentPeriodTx.filter(t => t.amount > 0).reduce((acc, curr) => acc + curr.amount, 0);
  const periodNetBalance = periodIncome - periodExpense;
  const periodSavingsRate = periodIncome > 0 ? ((periodNetBalance / periodIncome) * 100) : 0;

  // 2. Prepare Monthly Cash Flow Data (HISTORICAL - Last 6 months, unaffected by period settings)
  const getMonthlyData = () => {
      const months: Record<string, { name: string, income: number, expense: number, rawDate: Date }> = {};
      
      // Initialize last 6 months
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
              if (t.amount < 0) {
                  months[key].income += Math.abs(t.amount);
              } else {
                  months[key].expense += t.amount;
              }
          }
      });

      return Object.values(months).sort((a,b) => a.rawDate.getTime() - b.rawDate.getTime());
  };
  const cashFlowData = getMonthlyData();

  // 3. Budget Health Analysis (Calculated LIVE based on current period)
  // We map the budgets and calculate 'spent' derived from actual transactions in this period
  const calculatedBudgets = budgets.map(b => {
      const spentInPeriod = currentPeriodTx
        .filter(t => t.category === b.category && t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      
      return { ...b, spent: spentInPeriod };
  });

  // Calculate unbudgeted expenses to show full picture
  const budgetedCategories = budgets.map(b => b.category);
  const unbudgetedSpent = currentPeriodTx
    .filter(t => t.amount > 0 && !budgetedCategories.includes(t.category))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalBudgeted = calculatedBudgets.reduce((acc, b) => acc + b.limit, 0);
  const totalSpentInBudgets = calculatedBudgets.reduce((acc, b) => acc + b.spent, 0);
  
  // Total Actual Spent = Budgeted Spend + Unbudgeted Spend
  const totalActualSpent = totalSpentInBudgets + unbudgetedSpent;

  const budgetsOverLimit = calculatedBudgets.filter(b => b.spent > b.limit).length;
  const budgetsUnderLimit = calculatedBudgets.length - budgetsOverLimit;

  // 4. Category Breakdown (Current Period Only)
  const uniqueCategories = Array.from(new Set(currentPeriodTx.filter(t => t.amount > 0).map(e => e.category)));
  const categoryData = uniqueCategories.map(cat => {
    const total = currentPeriodTx
      .filter(e => e.category === cat && e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0);
    return { name: cat, value: total };
  }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  const COLORS = ['#A88BEB', '#F8C0FF', '#F9F871', '#FF9AA2', '#B5EAD7', '#C7CEEA', '#E2F0CB', '#FFDAC1'];

  // 5. Drill down filtering
  const filteredCategoryExpenses = selectedCategory 
    ? currentPeriodTx.filter(e => e.category === selectedCategory).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p>Analizando finanzas...</p>
          </div>
      );
  }

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold">Salud Financiera</h1>
            <p className="text-xs text-gray-500">Periodo actual: {periodLabel}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">({periodRange})</p>
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

      {transactions.length === 0 ? (
          <div className="text-center py-10">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                  <Icons.Stats size={40} />
              </div>
              <h3 className="text-lg font-bold text-gray-500">Sin datos financieros</h3>
              <p className="text-sm text-gray-400 mt-2">Registra tus ingresos y gastos para ver el análisis.</p>
          </div>
      ) : (
        <>
        {currentPeriodTx.length === 0 && (
            <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 flex items-start gap-3 animate-fade-in">
                <Icons.Filter size={20} className="text-yellow-600 shrink-0 mt-0.5" />
                <div className="text-xs text-yellow-800">
                    <p className="font-bold">No hay gastos en este periodo ({periodRange})</p>
                    <p>Si tienes gastos registrados, verifica que la fecha de "Día de Inicio" en tu Perfil sea correcta.</p>
                </div>
            </div>
        )}

        {view === 'overview' && (
            <div className="space-y-6 animate-fade-in">
                {/* KPI Cards (Current Period) */}
                <div className="grid grid-cols-2 gap-4">
                    <div className={`p-5 rounded-3xl text-white shadow-lg ${periodSavingsRate >= 20 ? 'bg-green-500' : periodSavingsRate > 0 ? 'bg-blue-500' : 'bg-red-400'}`}>
                        <div className="flex items-center gap-2 mb-2 opacity-90">
                            <Icons.Trending size={18} />
                            <span className="text-xs font-bold uppercase">Ahorro (Periodo)</span>
                        </div>
                        <h2 className="text-3xl font-bold">{periodSavingsRate.toFixed(0)}%</h2>
                        <p className="text-xs opacity-80 mt-1">
                            {periodSavingsRate >= 20 ? '¡Excelente ritmo!' : periodSavingsRate > 0 ? 'Estás ahorrando' : 'Gastas más de lo que ingresas'}
                        </p>
                    </div>
                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50 flex flex-col justify-center">
                        <p className="text-textSecondary text-xs font-bold uppercase mb-1">Flujo de Caja (Periodo)</p>
                        <h2 className={`text-2xl font-bold ${periodNetBalance >= 0 ? 'text-textPrimary' : 'text-red-500'}`}>
                            {periodNetBalance >= 0 ? '+' : '-'}${Math.abs(periodNetBalance).toLocaleString()}
                        </h2>
                        <div className="flex gap-2 mt-2 text-[10px] text-gray-400">
                            <span className="text-green-500 flex items-center">Ing: ${periodIncome.toLocaleString()}</span>
                            <span className="text-red-400 flex items-center">Gas: ${periodExpense.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Income vs Expense Chart (Historical) */}
                <div className="bg-white p-6 rounded-3xl shadow-sm">
                    <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                        <Icons.ArrowUpRight className="text-green-500" size={20} />
                        Histórico (6 Meses)
                        <Icons.ArrowDownRight className="text-red-500" size={20} />
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={cashFlowData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} tick={{fill: '#9CA3AF'}} />
                                <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} tick={{fill: '#9CA3AF'}} />
                                <Tooltip 
                                    cursor={{fill: '#F9FAFB'}}
                                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}
                                    formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                                />
                                <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                                <Bar name="Ingresos" dataKey="income" fill="#4ADE80" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar name="Gastos" dataKey="expense" fill="#F87171" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Budget Health Aggregate (Current Period) */}
                <div className="bg-white p-6 rounded-3xl shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="font-bold text-lg">Desempeño de Presupuestos</h3>
                            <p className="text-xs text-textSecondary">Periodo: {periodLabel}</p>
                        </div>
                    </div>

                    {calculatedBudgets.length > 0 ? (
                        <>
                            <div className="flex items-center gap-6 mb-6 mt-4">
                                <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                        <path className="text-gray-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                                        <path 
                                            className={budgetsOverLimit === 0 ? "text-green-500" : "text-primary"} 
                                            strokeDasharray={`${(budgetsUnderLimit / calculatedBudgets.length) * 100}, 100`} 
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                                            fill="none" 
                                            stroke="currentColor" 
                                            strokeWidth="4" 
                                        />
                                    </svg>
                                    <div className="absolute flex flex-col items-center">
                                        <span className="text-xl font-bold text-textPrimary">{budgetsUnderLimit}/{calculatedBudgets.length}</span>
                                        <span className="text-9 text-gray-400">En orden</span>
                                    </div>
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-500">Límite Global</span>
                                            <span className="font-bold">${totalBudgeted.toLocaleString()}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 h-2 rounded-full"></div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-500">Gastado Real (Total)</span>
                                            <span className={`font-bold ${totalActualSpent > totalBudgeted ? 'text-red-500' : 'text-primary'}`}>
                                                ${totalActualSpent.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden flex">
                                            <div 
                                                className="h-full bg-primary" 
                                                style={{ width: `${Math.min((totalSpentInBudgets / totalBudgeted) * 100, 100)}%` }}
                                            ></div>
                                            {unbudgetedSpent > 0 && (
                                                 <div 
                                                    className="h-full bg-gray-300" 
                                                    style={{ width: `${Math.min((unbudgetedSpent / totalBudgeted) * 100, 100)}%` }}
                                                ></div>
                                            )}
                                        </div>
                                        {unbudgetedSpent > 0 && (
                                            <p className="text-[10px] text-gray-400 mt-1 text-right">
                                                + ${unbudgetedSpent.toLocaleString()} en gastos sin presupuesto
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-xl flex gap-3 items-start">
                                <Icons.Brain className="text-primary mt-1 shrink-0" size={18} />
                                <p className="text-xs text-gray-600 leading-relaxed">
                                    {totalActualSpent > totalBudgeted 
                                        ? `Has excedido tu presupuesto global por $${(totalActualSpent - totalBudgeted).toLocaleString()}. Revisa tus límites.`
                                        : `¡Bien hecho! Te sobran $${(totalBudgeted - totalActualSpent).toLocaleString()} de tu presupuesto planificado.`}
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-6 text-sm text-gray-400">
                            No hay presupuestos configurados.
                        </div>
                    )}
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

                            <div className="mt-4 p-3 bg-blue-50 rounded-xl flex gap-3 items-start border border-blue-100">
                                <Icons.Brain className="text-blue-500 mt-0.5 shrink-0" size={16} />
                                <p className="text-[10px] text-blue-700 leading-relaxed">
                                    Nota: Aquí solo aparecen las categorías en las que has gastado dinero en este periodo. Para agregar una categoría nueva, regístrala al crear un nuevo Gasto.
                                </p>
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
        </>
      )}
    </div>
  );
};
