import React, { useState, useEffect, useCallback } from 'react';
import { User, Budget, Expense, Account, FinancialGoal, RecurringItem } from '../types';
import { Icons } from '../components/Icons';
import { Link, useNavigate } from 'react-router-dom';
import { dbService } from '../services/dbService';
import { expenseService } from '../services/expenseService';
import { useToast } from '../context/ToastContext';
import { ConfirmModal } from '../components/ConfirmModal';

interface Props {
    user: User;
    onMenuClick?: () => void;
}

export const Dashboard: React.FC<Props> = ({ user, onMenuClick }) => {
    const { success, error } = useToast();
    const navigate = useNavigate();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loading, setLoading] = useState(true);
    const [isBalanceExpanded, setIsBalanceExpanded] = useState(false);

    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

    // Period State
    const [periodLabel, setPeriodLabel] = useState("");
    const [daysLeft, setDaysLeft] = useState(0);
    const [periodExpenses, setPeriodExpenses] = useState<Expense[]>([]);

    // Savings Sweep Modal
    const [isSweepOpen, setIsSweepOpen] = useState(false);
    const [surplus, setSurplus] = useState(0);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [goals, setGoals] = useState<FinancialGoal[]>([]);

    const [sweepSource, setSweepSource] = useState("");
    const [sweepTargetType, setSweepTargetType] = useState<'goal' | 'account'>('account');
    const [sweepTargetId, setSweepTargetId] = useState("");

    // Pending Variable Expenses State
    const [pendingPayments, setPendingPayments] = useState<RecurringItem[]>([]);
    const [paymentToConfirm, setPaymentToConfirm] = useState<RecurringItem | null>(null);
    const [confirmAmount, setConfirmAmount] = useState('');

    // Active Debts State
    const [activeLoans, setActiveLoans] = useState<Account[]>([]);
    const [zeroBalanceLoan, setZeroBalanceLoan] = useState<Account | null>(null);

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

    const loadData = useCallback(async () => {
        try {
            const [expData, budData, accData, goalData, recurData] = await Promise.all([
                dbService.getExpenses(),
                dbService.getBudgets(),
                dbService.getAccounts(),
                dbService.getGoals(),
                dbService.getRecurringExpenses()
            ]);

            // 1. Calculate Period Range
            const { start, end, label, daysLeft: dl } = dbService.calculatePeriodRange(user);
            setPeriodLabel(label);
            setDaysLeft(dl);

            // 2. Filter Expenses for this Period using new helper
            const filteredExp = expData.filter(e => dbService.isDateInPeriod(e.date, start, end));

            setExpenses(expData); // Keep all for list
            setPeriodExpenses(filteredExp); // Specific for stats

            // 3. Recalculate Budget Spent based on Period
            const updatedBudgets = budData.map(b => ({
                ...b,
                spent: filteredExp
                    .filter(e => e.category === b.category && e.amount > 0)
                    .reduce((sum, e) => sum + e.amount, 0)
            }));

            setBudgets(updatedBudgets);
            setAccounts(accData);
            setGoals(goalData);

            // 4. Calculate Surplus (Income - Expenses) for Period
            const income = filteredExp.filter(e => e.amount < 0).reduce((acc, curr) => acc + Math.abs(curr.amount), 0);
            const spent = filteredExp.filter(e => e.amount > 0).reduce((acc, curr) => acc + curr.amount, 0);
            setSurplus(Math.max(0, income - spent));

            // 5. Check for Pending Variable Expenses (From DB)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const pending = recurData.filter(item => {
                const nextDate = new Date(item.nextDate + 'T00:00:00');
                return item.isVariable && nextDate <= today;
            });
            setPendingPayments(pending);

            // 6. Check active Loans & Zero Balance Cleanup
            const loans = accData.filter(a => a.type === 'Loan' && a.balance > 0);
            setActiveLoans(loans);

            // Find if there is a Loan account with 0 balance (candidate for deletion)
            const finishedLoan = accData.find(a => a.type === 'Loan' && a.balance === 0);
            if (finishedLoan) {
                setZeroBalanceLoan(finishedLoan);
            } else {
                setZeroBalanceLoan(null);
            }

        } catch (error) {
            console.error("Error loading dashboard", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // --- SMART LIMIT LOGIC (TECHO DINÁMICO) ---
    const totalGoalContributionNeeds = goals.reduce((acc, g) => acc + (g.monthlyContribution || 0), 0);

    // "Safe to Spend" is the User's limit minus the forced savings
    const safeLimitBase = user.monthlyLimit > 0 ? user.monthlyLimit : 10000;
    const safeToSpendLimit = Math.max(0, safeLimitBase - totalGoalContributionNeeds);

    const totalSpent = periodExpenses.filter(e => e.amount > 0).reduce((acc, curr) => acc + curr.amount, 0);

    // Remaining logic based on Safe Limit
    const remainingSafe = safeToSpendLimit - totalSpent;

    // Percentages for the Bar (Scaled if over 100%)
    const rawSpentPct = (totalSpent / safeLimitBase) * 100;

    // Process goals for individual segments
    const goalSegments = goals
        .map(g => {
            const amount = g.monthlyContribution || 0;
            // Ensure visual representation even if small
            let pct = (amount / safeLimitBase) * 100;
            // Fallback: if 0 amount but goal exists, give it 5% visual just so they see the color
            if (amount === 0 && g.targetAmount > 0) pct = 5;
            return {
                id: g.id,
                name: g.name,
                color: g.color || '#FCD34D',
                amount: amount,
                pct: pct
            };
        });

    const totalGoalsPct = goalSegments.reduce((sum, g) => sum + g.pct, 0);
    const totalOccupiedPct = rawSpentPct + totalGoalsPct;

    // Scaling factor if we exceed 100% to keep things inside the bar visually
    const scaleFactor = totalOccupiedPct > 100 ? (99.5 / totalOccupiedPct) : 1;

    // --- PLANNING HEALTH ---
    const totalBudgetedSum = budgets.reduce((acc, b) => acc + b.limit, 0);
    const unallocated = safeToSpendLimit - totalBudgetedSum;
    const isOverPlanned = totalBudgetedSum > safeToSpendLimit;


    const handleExpenseClick = (exp: Expense) => {
        setSelectedExpense(exp);
    };

    const handleDelete = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Eliminar Gasto',
            message: '¿Estás seguro de que deseas eliminar este gasto?',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await dbService.deleteExpense(id);
                    await loadData();
                    setSelectedExpense(null);
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    success("Gasto eliminado");
                } catch (e) {
                    error('Error al eliminar');
                }
            }
        });
    };

    const handleSweepSave = async () => {
        if (!sweepSource || !sweepTargetId) return;
        try {
            await dbService.moveSurplusToSavings(
                surplus,
                sweepSource,
                sweepTargetType === 'goal' ? sweepTargetId : undefined,
                sweepTargetType === 'account' ? sweepTargetId : undefined
            );
            success("¡Ahorro realizado con éxito!");
            setIsSweepOpen(false);
            await loadData();
        } catch (e) {
            error("Error al mover fondos.");
        }
    };

    const handleConfirmPayment = (item: RecurringItem) => {
        setPaymentToConfirm(item);
        setConfirmAmount(item.amount.toString());
    };

    const saveConfirmedPayment = async () => {
        if (!paymentToConfirm || !confirmAmount) return;
        const val = parseFloat(confirmAmount);

        try {
            await dbService.addExpense({
                amount: val,
                category: paymentToConfirm.category,
                description: paymentToConfirm.name,
                date: new Date().toISOString(),
                isFixed: true
            });

            const currentDueDate = new Date(paymentToConfirm.nextDate + 'T00:00:00');
            const nextDate = expenseService.calculateNextDate(currentDueDate, paymentToConfirm.frequency);
            const nextDateStr = nextDate.toISOString().split('T')[0];

            await dbService.updateRecurringExpenseDate(paymentToConfirm.id, nextDateStr);

            setPaymentToConfirm(null);
            await loadData();
            success("Pago registrado correctamente");

        } catch (e) {
            error("Error guardando el pago.");
        }
    };

    const handlePayLoan = (loan: Account) => {
        navigate(`/add?type=transfer&dest=${loan.id}&amount=${loan.balance}`);
    };

    const handleDeleteZeroBalanceLoan = async () => {
        if (!zeroBalanceLoan) return;

        setConfirmModal({
            isOpen: true,
            title: 'Eliminar Cuenta',
            message: `¿Deseas eliminar la cuenta ${zeroBalanceLoan.name} que ya está pagada?`,
            type: 'info',
            onConfirm: async () => {
                try {
                    await dbService.deleteAccount(zeroBalanceLoan.id);
                    setZeroBalanceLoan(null);
                    await loadData();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    success("Cuenta eliminada");
                } catch (e) {
                    error("Error al eliminar la cuenta");
                }
            }
        });
    };

    if (loading) return <div className="p-10 text-center animate-pulse">Cargando tus finanzas...</div>;

    return (
        <div className="space-y-6 pb-24">
            <div className="flex justify-between items-center py-2">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onMenuClick}
                        className="md:hidden flex items-center justify-center w-10 h-10 text-textPrimary hover:bg-gray-100 rounded-xl transition-colors"
                        title="Abrir menú"
                    >
                        <Icons.Menu size={26} />
                    </button>
                    <div className="flex flex-col">
                        <p className="text-textSecondary text-xs font-medium">Hola,</p>
                        <h1 className="text-xl md:text-2xl font-bold text-textPrimary truncate max-w-[200px] leading-tight">{user.name} 👋</h1>
                    </div>
                </div>
                <Link to="/profile" className="w-10 h-10 bg-white rounded-full flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm hover:opacity-80 transition-opacity shrink-0">
                    <Icons.Profile size={20} className="text-primary" />
                </Link>
            </div>

            {(pendingPayments.length > 0 || activeLoans.length > 0 || zeroBalanceLoan) && (
                <div className="space-y-3">
                    {zeroBalanceLoan && (
                        <div className="bg-green-50 border border-green-200 rounded-3xl p-4 flex items-center justify-between shadow-sm animate-fade-in">
                            <div className="flex items-center gap-3">
                                <div className="bg-green-100 p-2 rounded-full text-green-600">
                                    <Icons.Check size={20} />
                                </div>
                                <div>
                                    <h3 className="text-green-800 font-bold text-sm">¡Deuda pagada!</h3>
                                    <p className="text-xs text-green-700">La cuenta <strong>{zeroBalanceLoan.name}</strong> está en $0. ¿Quieres borrarla?</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setZeroBalanceLoan(null)} className="text-xs text-gray-400 font-bold px-2">Más tarde</button>
                                <button onClick={handleDeleteZeroBalanceLoan} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700">Sí, borrar</button>
                            </div>
                        </div>
                    )}

                    {(pendingPayments.length > 0 || activeLoans.length > 0) && (
                        <div className="bg-orange-50 border border-orange-100 rounded-3xl p-4 animate-fade-in shadow-sm">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="bg-orange-100 p-2 rounded-full text-orange-600 animate-pulse">
                                    <Icons.CreditCard size={20} />
                                </div>
                                <div>
                                    <h3 className="text-orange-800 font-bold text-sm">Pendientes y Deudas</h3>
                                    <p className="text-xs text-orange-600">
                                        {pendingPayments.length > 0 ? `${pendingPayments.length} pagos fijos` : ''}
                                        {pendingPayments.length > 0 && activeLoans.length > 0 ? ' y ' : ''}
                                        {activeLoans.length > 0 ? `${activeLoans.length} deudas` : ''}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {pendingPayments.map(item => (
                                    <div key={item.id} className="bg-white p-3 rounded-xl flex justify-between items-center shadow-sm">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm text-textPrimary">{item.name}</span>
                                            <span className="text-[10px] text-gray-400">Vence: {new Date(item.nextDate).toLocaleDateString()}</span>
                                        </div>
                                        <button
                                            onClick={() => handleConfirmPayment(item)}
                                            className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors shadow-orange-200 shadow-md"
                                        >
                                            Confirmar
                                        </button>
                                    </div>
                                ))}

                                {activeLoans.map(loan => (
                                    <div key={loan.id} className="bg-white p-3 rounded-xl flex justify-between items-center shadow-sm border-l-4 border-orange-400">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm text-textPrimary">{loan.name}</span>
                                            <span className="text-[10px] text-gray-400">Deuda: ${loan.balance.toLocaleString()}</span>
                                        </div>
                                        <button
                                            onClick={() => handlePayLoan(loan)}
                                            className="bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                                        >
                                            Liquidar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Main Period Card */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={`bg-primary text-white p-6 rounded-3xl shadow-lg relative overflow-hidden w-full transition-all duration-500 ease-in-out ${isBalanceExpanded ? 'row-span-2' : ''}`}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-10 -mb-10"></div>

                    <div className="relative z-10">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-white/80 mb-1 text-sm font-medium">{periodLabel}</p>
                                <h2 className="text-4xl font-bold mb-1 tracking-tight">${remainingSafe.toLocaleString()}</h2>
                                <p className="text-xs text-indigo-100 opacity-90 mb-4">Disponible (Libre de Metas)</p>
                            </div>
                            <div className="bg-white/20 px-3 py-1 rounded-lg text-xs font-bold backdrop-blur-sm">
                                {daysLeft} días restantes
                            </div>
                        </div>

                        {/* Visual Bar Logic */}
                        <div className="mb-6">
                            <div className="flex justify-between text-xs mb-1 opacity-80 font-medium">
                                <span>Gasto ({rawSpentPct.toFixed(0)}%)</span>
                                <span>Metas: ${totalGoalContributionNeeds.toLocaleString()}</span>
                            </div>

                            <div className="w-full h-5 bg-black/20 rounded-full overflow-hidden flex relative ring-2 ring-white/10">
                                {/* 1. SPENT SEGMENT */}
                                <div
                                    className="h-full bg-white shadow-sm shrink-0 flex items-center justify-center relative z-10 transition-all duration-500"
                                    style={{ width: `${Math.max(0, rawSpentPct * scaleFactor)}%` }}
                                    title={`Gastado: $${totalSpent}`}
                                >
                                    {rawSpentPct * scaleFactor > 15 && (
                                        <span className="text-[9px] font-bold text-primary px-1 truncate">
                                            Gastos
                                        </span>
                                    )}
                                </div>

                                {/* 2. GAP (Available) */}
                                <div className="flex-1 h-full min-w-0"></div>

                                {/* 3. GOAL SEGMENTS (Individual Colors) */}
                                {goalSegments.map((g, i) => (
                                    <div
                                        key={g.id}
                                        className="h-full shrink-0 relative border-l border-white/10 transition-all duration-500 group hover:brightness-110"
                                        style={{
                                            width: `${Math.max(g.pct * scaleFactor, 2)}%`,
                                            backgroundColor: g.color
                                        }}
                                        title={`${g.name}: $${g.amount.toLocaleString()}`}
                                    >
                                        <div className="w-full h-full opacity-90 hover:opacity-100"></div>
                                    </div>
                                ))}
                            </div>

                            {/* Legend / Status */}
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-[10px] opacity-70">${totalSpent.toLocaleString()} gastado</span>

                                {/* Visual legend for goals */}
                                {goalSegments.length > 0 && (
                                    <div className="flex items-center gap-2 overflow-x-auto max-w-[60%] no-scrollbar justify-end">
                                        {goalSegments.slice(0, 4).map(g => (
                                            <div key={g.id} className="flex items-center gap-1 shrink-0">
                                                <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: g.color }}></div>
                                                <span className="text-[9px] opacity-90 truncate max-w-[60px] font-medium">{g.name}</span>
                                            </div>
                                        ))}
                                        {goalSegments.length > 4 && <span className="text-[9px] opacity-60">+{goalSegments.length - 4}</span>}
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={() => setIsBalanceExpanded(!isBalanceExpanded)}
                            className="w-full bg-white/10 hover:bg-white/20 p-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors backdrop-blur-sm"
                        >
                            {isBalanceExpanded ? 'Ocultar Salud Financiera' : 'Ver Salud Financiera'}
                            {isBalanceExpanded ? <Icons.ChevronUp size={16} /> : <Icons.ChevronDown size={16} />}
                        </button>

                        {isBalanceExpanded && (
                            <div className="mt-6 space-y-6 animate-fade-in border-t border-white/10 pt-4">

                                {/* --- NEW: FINANCIAL HEALTH CHART --- */}
                                <div className="bg-black/10 p-4 rounded-2xl">
                                    <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                                        <Icons.Brain size={16} /> Comparativa de Salud
                                    </h3>

                                    <div className="space-y-4">
                                        {/* 1. TECHO (INGRESOS) */}
                                        <div>
                                            <div className="flex justify-between text-xs mb-1 opacity-90">
                                                <span>Techo (Ingresos)</span>
                                                <span>${user.monthlyLimit.toLocaleString()}</span>
                                            </div>
                                            <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-400 w-full"></div>
                                            </div>
                                        </div>

                                        {/* 2. PLAN (PRESUPUESTOS) */}
                                        <div>
                                            <div className="flex justify-between text-xs mb-1 opacity-90">
                                                <span>Plan (Presupuestos)</span>
                                                <span className={totalBudgetedSum > user.monthlyLimit ? 'text-red-300 font-bold' : ''}>${totalBudgetedSum.toLocaleString()}</span>
                                            </div>
                                            <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${totalBudgetedSum > user.monthlyLimit ? 'bg-red-400' : 'bg-green-400'}`}
                                                    style={{ width: `${Math.min((totalBudgetedSum / Math.max(1, user.monthlyLimit)) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* 3. REALIDAD (GASTOS) */}
                                        <div>
                                            <div className="flex justify-between text-xs mb-1 opacity-90">
                                                <span>Realidad (Gastos)</span>
                                                <span className={totalSpent > totalBudgetedSum ? 'text-orange-300 font-bold' : ''}>${totalSpent.toLocaleString()}</span>
                                            </div>
                                            <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${totalSpent > user.monthlyLimit ? 'bg-red-500' : totalSpent > totalBudgetedSum ? 'bg-orange-400' : 'bg-white'}`}
                                                    style={{ width: `${Math.min((totalSpent / Math.max(1, user.monthlyLimit)) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-[10px] leading-tight opacity-80 mt-4">
                                        {totalBudgetedSum > user.monthlyLimit
                                            ? `⚠️ CUIDADO: Tu plan ($${totalBudgetedSum.toLocaleString()}) supera tus ingresos. Estás planeando gastar dinero que no tienes.`
                                            : `✅ BUEN PLAN: Tus presupuestos están dentro de tus ingresos.`
                                        }
                                    </p>
                                </div>

                                {/* --- NEW: LIQUIDITY WARNING --- */}
                                {(() => {
                                    const liquidAssets = accounts
                                        .filter(a => a.type === 'Debit' || a.type === 'Cash')
                                        .reduce((sum, a) => sum + a.balance, 0);

                                    if (liquidAssets < user.monthlyLimit) {
                                        return (
                                            <div className="bg-orange-500/20 border border-orange-400/30 p-3 rounded-xl">
                                                <div className="flex items-start gap-2">
                                                    <Icons.Wallet size={16} className="text-orange-300 shrink-0 mt-0.5" />
                                                    <div>
                                                        <h4 className="font-bold text-xs text-orange-200">Alerta de Liquidez</h4>
                                                        <p className="text-[10px] text-orange-100 leading-tight mt-1">
                                                            Tienes <strong>${liquidAssets.toLocaleString()}</strong> en efectivo/débito, pero tu límite de gasto es <strong>${user.monthlyLimit.toLocaleString()}</strong>. Podrías quedarte sin fondos reales.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-4 w-full">
                    {/* Intelligent Savings Widget */}
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-5 rounded-3xl text-white shadow-lg flex flex-col justify-between flex-1 relative overflow-hidden">
                        <div className="absolute -right-5 -bottom-5 text-white/10">
                            <Icons.Wallet size={100} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Icons.Brain size={20} /> Smart Saver
                            </h3>
                            <p className="text-xs text-indigo-100 mt-1 opacity-90 leading-relaxed">
                                {surplus > 0
                                    ? `¡Tienes un excedente de $${surplus.toLocaleString()}! Recuerda que el sistema ya descontó $${totalGoalContributionNeeds.toLocaleString()} de tu vista principal para proteger tus metas.`
                                    : "Aún no tienes excedente para ahorrar."}
                            </p>
                        </div>
                        {surplus > 0 && (
                            <button
                                onClick={() => setIsSweepOpen(true)}
                                className="mt-4 bg-white text-indigo-600 py-2 px-4 rounded-xl font-bold text-sm shadow-sm hover:bg-indigo-50 transition-colors z-10"
                            >
                                Mover a Ahorros
                            </button>
                        )}
                    </div>

                    <Link to="/add" className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between group hover:bg-gray-50 transition-colors border border-gray-50 h-[80px]">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <Icons.Add size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-textPrimary text-sm">Nuevo Gasto</h3>
                                <p className="text-xs text-textSecondary">Registrar compra</p>
                            </div>
                        </div>
                        <Icons.ArrowUpRight size={18} className="text-gray-300 group-hover:text-primary transition-colors" />
                    </Link>
                </div>
            </div>

            {!isBalanceExpanded && (
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <h3 className="font-bold text-lg text-textPrimary">Presupuestos ({user.periodType})</h3>
                        <Link to="/budgets" className="text-primary text-sm font-medium hover:underline">Gestionar</Link>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:flex md:gap-4 md:overflow-x-auto md:pb-4 md:snap-x md:scrollbar-hide">
                        {budgets.slice(0, 4).map(b => (
                            <div key={b.category} className="min-w-0 md:min-w-[140px] bg-white p-4 rounded-2xl shadow-sm border border-gray-50 hover:shadow-md transition-shadow flex-shrink-0">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: `${b.color}20` }}>
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }}></div>
                                </div>
                                <p className="font-semibold text-textPrimary text-sm truncate">{b.category}</p>
                                <p className="text-xs text-textSecondary mb-2">${b.spent.toLocaleString()} / ${b.limit.toLocaleString()}</p>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full"
                                        style={{ width: `${Math.min((b.spent / Math.max(1, b.limit)) * 100, 100)}%`, backgroundColor: b.color }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        {budgets.length === 0 && <p className="text-sm text-gray-400">No hay presupuestos activos.</p>}
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg text-textPrimary">Últimos Gastos</h3>
                    <Link to="/expenses" className="text-primary text-sm font-medium hover:underline flex items-center gap-1">
                        Ver todo <Icons.ArrowUpRight size={14} />
                    </Link>
                </div>
                <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
                    {expenses.slice(0, 4).map((exp, i) => (
                        <div
                            key={exp.id}
                            onClick={() => handleExpenseClick(exp)}
                            className={`flex items-center justify-between p-4 cursor-pointer ${i !== expenses.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50 transition-colors`}
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-gray-400 shrink-0">
                                    <Icons.Wallet size={18} />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-medium text-textPrimary text-sm truncate pr-2">{exp.description}</p>
                                    <p className="text-xs text-textSecondary">{new Date(exp.date).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <span className={`font-semibold shrink-0 ${exp.amount > 0 ? 'text-red-400' : 'text-green-500'}`}>
                                {exp.amount > 0 ? '-' : '+'}${Math.abs(exp.amount)}
                            </span>
                        </div>
                    ))}
                    {expenses.length === 0 && (
                        <div className="p-6 text-center text-gray-400">No hay gastos recientes.</div>
                    )}
                </div>
            </div>

            {paymentToConfirm && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fade-in">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Icons.CreditCard size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-800">Confirmar Pago</h2>
                            <p className="text-sm text-gray-500">{paymentToConfirm.name}</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Monto Real</label>
                                <div className="relative mt-1">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-800 font-bold">$</span>
                                    <input
                                        type="number"
                                        autoFocus
                                        value={confirmAmount}
                                        onChange={(e) => setConfirmAmount(e.target.value)}
                                        className="w-full bg-gray-50 p-4 pl-8 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 font-bold text-2xl"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setPaymentToConfirm(null)}
                                    className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={saveConfirmedPayment}
                                    className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-200 hover:bg-orange-600"
                                >
                                    Pagar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isSweepOpen && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fade-in">
                        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                            <Icons.Wallet className="text-indigo-600" /> Ahorro Inteligente
                        </h2>
                        <p className="text-sm text-gray-500 mb-6">
                            ¡Gran trabajo! Tienes <strong>${surplus.toLocaleString()}</strong> libres.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Origen</label>
                                <select
                                    className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 mt-1"
                                    value={sweepSource}
                                    onChange={(e) => setSweepSource(e.target.value)}
                                >
                                    <option value="">Selecciona cuenta...</option>
                                    {accounts.filter(a => a.type === 'Debit' || a.type === 'Cash').map(a => (
                                        <option key={a.id} value={a.id}>{a.name} (${a.balance})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Destino</label>
                                <div className="flex gap-2 mb-2 mt-1">
                                    <button
                                        onClick={() => { setSweepTargetType('account'); setSweepTargetId(""); }}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${sweepTargetType === 'account' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-gray-100 text-gray-400'}`}
                                    >
                                        Cuenta
                                    </button>
                                    <button
                                        onClick={() => { setSweepTargetType('goal'); setSweepTargetId(""); }}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${sweepTargetType === 'goal' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-gray-100 text-gray-400'}`}
                                    >
                                        Meta
                                    </button>
                                </div>

                                {sweepTargetType === 'account' ? (
                                    <select
                                        className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={sweepTargetId}
                                        onChange={(e) => setSweepTargetId(e.target.value)}
                                    >
                                        <option value="">Selecciona cuenta...</option>
                                        {accounts.filter(a => a.type === 'Investment' || (a.type === 'Debit' && a.id !== sweepSource)).map(a => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <select
                                        className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={sweepTargetId}
                                        onChange={(e) => setSweepTargetId(e.target.value)}
                                    >
                                        <option value="">Selecciona meta...</option>
                                        {goals.map(g => (
                                            <option key={g.id} value={g.id}>{g.name} (Faltan ${g.targetAmount - g.currentAmount})</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <button
                                onClick={handleSweepSave}
                                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold shadow-lg hover:bg-indigo-700 transition-colors mt-2"
                            >
                                Confirmar
                            </button>
                            <button
                                onClick={() => setIsSweepOpen(false)}
                                className="w-full py-3 rounded-xl text-gray-400 font-semibold hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedExpense && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fade-in">
                        <div className="flex justify-between items-start mb-6">
                            <h2 className="text-xl font-bold">Detalle</h2>
                            <button onClick={() => setSelectedExpense(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600">
                                <Icons.Close size={20} />
                            </button>
                        </div>

                        <div className="flex flex-col items-center mb-8">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <Icons.Wallet size={40} className="text-gray-400" />
                            </div>
                            <h3 className={`text-3xl font-bold ${selectedExpense.amount > 0 ? 'text-textPrimary' : 'text-green-500'}`}>
                                ${Math.abs(selectedExpense.amount)}
                            </h3>
                            <p className="text-textSecondary">{selectedExpense.category}</p>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">Descripción</span>
                                <span className="text-sm font-medium text-textPrimary text-right">{selectedExpense.description}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">Fecha</span>
                                <span className="text-sm font-medium text-textPrimary">{new Date(selectedExpense.date).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <button
                            onClick={() => handleDelete(selectedExpense.id)}
                            className="w-full py-3 rounded-xl font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <Icons.Trash size={18} />
                            Eliminar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};