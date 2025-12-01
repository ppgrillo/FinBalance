import React, { useState, useEffect } from 'react';
import { FinancialGoal, Account } from '../types';
import { dbService } from '../services/dbService';
import { Icons } from '../components/Icons';
import { geminiService } from '../services/geminiService';
import { useToast } from '../context/ToastContext';

export const Goals: React.FC = () => {
    const { success, error, warning } = useToast();
    const [goals, setGoals] = useState<FinancialGoal[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
    const [loadingPlan, setLoadingPlan] = useState(false);

    // Form State
    const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
    const [newGoal, setNewGoal] = useState<Partial<FinancialGoal>>({ color: '#A88BEB' });
    const [generatedPlan, setGeneratedPlan] = useState<string>('');

    // Deposit State
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
    const [depositAmount, setDepositAmount] = useState('');
    const [sourceAccount, setSourceAccount] = useState('');

    // Predefined colors for easier selection
    const GOAL_COLORS = ['#A88BEB', '#F87171', '#FBBF24', '#34D399', '#60A5FA', '#818CF8', '#F472B6', '#1E1E1E'];

    useEffect(() => {
        const load = async () => {
            const [gData, aData] = await Promise.all([
                dbService.getGoals(),
                dbService.getAccounts()
            ]);
            setGoals(gData);
            setAccounts(aData);
        };
        load();
    }, []);

    const handleAskAI = async () => {
        if (!newGoal.name || !newGoal.targetAmount || !newGoal.deadline) {
            warning("Por favor llena el nombre, monto y fecha objetivo para generar un plan.");
            return;
        }
        setLoadingPlan(true);

        // Format context explicitly for AI to understand liabilities
        const contextStr = accounts.map(a => {
            if (a.type === 'Credit') {
                return `CUENTA: ${a.name}, TIPO: Credit (DEUDA/PASIVO), MONTO DEUDA: $${a.balance}`;
            } else {
                return `CUENTA: ${a.name}, TIPO: ${a.type} (ACTIVO/DINERO), SALDO: $${a.balance}`;
            }
        }).join('; ');

        try {
            const result = await geminiService.createSavingsPlan(
                newGoal.name,
                newGoal.targetAmount,
                newGoal.deadline,
                contextStr
            );

            setGeneratedPlan(result.planText);
            setNewGoal(prev => ({ ...prev, monthlyContribution: result.monthlyContribution }));
        } catch (e) {
            error("Error generando plan IA");
        } finally {
            setLoadingPlan(false);
        }
    };

    const openCreateModal = () => {
        setEditingGoalId(null);
        setNewGoal({ color: '#A88BEB' });
        setGeneratedPlan('');
        setIsModalOpen(true);
    };

    const openEditModal = (goal: FinancialGoal) => {
        setEditingGoalId(goal.id);
        setNewGoal({
            name: goal.name,
            targetAmount: goal.targetAmount,
            currentAmount: goal.currentAmount,
            deadline: goal.deadline,
            monthlyContribution: goal.monthlyContribution,
            color: goal.color
        });
        setGeneratedPlan(goal.aiPlan || '');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        // Robust validation
        if (!newGoal.name) { warning("Por favor escribe un nombre para la meta."); return; }
        if (!newGoal.targetAmount || newGoal.targetAmount <= 0) { warning("Por favor ingresa un monto objetivo válido."); return; }
        if (!newGoal.deadline) { warning("Por favor selecciona una fecha límite."); return; }

        const colorToSave = newGoal.color || GOAL_COLORS[0];

        try {
            const goalData = {
                ...newGoal,
                aiPlan: generatedPlan,
                monthlyContribution: newGoal.monthlyContribution || 0,
                color: colorToSave
            };

            if (editingGoalId) {
                await dbService.updateGoal(editingGoalId, goalData);
            } else {
                await dbService.addGoal(goalData);
            }

            const updated = await dbService.getGoals();
            setGoals(updated);
            setIsModalOpen(false);
            setNewGoal({ color: '#A88BEB' });
            setGeneratedPlan('');
            setEditingGoalId(null);
            success("Meta guardada correctamente");
        } catch (e: any) {
            console.error(e);
            error('Error guardando meta: ' + (e.message || "Verifica tu conexión a internet."));
        }
    };

    const handleDeposit = async () => {
        if (!selectedGoalId || !depositAmount || !sourceAccount) return;

        try {
            await dbService.contributeToGoal(selectedGoalId, parseFloat(depositAmount), sourceAccount);

            // Refresh Data
            const updatedGoals = await dbService.getGoals();
            const updatedAccounts = await dbService.getAccounts();
            setGoals(updatedGoals);
            setAccounts(updatedAccounts);

            setIsDepositModalOpen(false);
            setDepositAmount('');
            setSourceAccount('');
            success("¡Aporte realizado con éxito!");
        } catch (e) {
            error("Error al realizar el aporte.");
        }
    };

    const openDepositModal = (goalId: string) => {
        setSelectedGoalId(goalId);
        setSourceAccount('');
        setDepositAmount('');
        setIsDepositModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("¿Borrar meta?")) {
            await dbService.deleteGoal(id);
            setGoals(prev => prev.filter(g => g.id !== id));
        }
    };

    const getGoalColor = (g: FinancialGoal) => g.color || '#A88BEB';

    return (
        <div className="space-y-8 pb-24">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Metas Financieras</h1>
                <button
                    onClick={openCreateModal}
                    className="bg-primary text-white px-4 py-2 rounded-xl shadow-md hover:bg-purple-600 flex items-center gap-2 transition-colors"
                >
                    <Icons.Add size={20} />
                    <span className="hidden sm:inline">Nueva Meta</span>
                </button>
            </div>

            <div className="grid gap-6">
                {goals.map(goal => {
                    const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                    // Recalculate days left
                    const now = new Date();
                    const deadline = new Date(goal.deadline);
                    const diffTime = deadline.getTime() - now.getTime();
                    const daysLeft = Math.ceil(diffTime / (1000 * 3600 * 24));
                    const goalColor = getGoalColor(goal);

                    return (
                        <div key={goal.id} className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-50 hover:shadow-md transition-all group">
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110" style={{ backgroundColor: goalColor }}>
                                            <Icons.Target size={30} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-textPrimary">{goal.name}</h3>
                                            <p className="text-sm text-textSecondary flex items-center gap-1">
                                                <Icons.Calendar size={14} /> Meta: {new Date(goal.deadline).toLocaleDateString()}
                                                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${daysLeft < 30 ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-600'}`}>
                                                    {daysLeft > 0 ? `${daysLeft} días` : 'Vencida'}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openDepositModal(goal.id)}
                                            className="bg-green-50 text-green-600 hover:bg-green-100 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                        >
                                            <Icons.Add size={14} /> Aportar
                                        </button>
                                        <button onClick={() => openEditModal(goal)} className="text-gray-300 hover:text-primary p-1">
                                            <Icons.Edit size={20} />
                                        </button>
                                        <button onClick={() => handleDelete(goal.id)} className="text-gray-300 hover:text-red-500 p-1">
                                            <Icons.Trash size={20} />
                                        </button>
                                    </div>
                                </div>

                                <div className="mb-2 flex justify-between items-end">
                                    <span className="text-2xl font-bold" style={{ color: goalColor }}>${goal.currentAmount.toLocaleString()}</span>
                                    <span className="text-sm text-gray-400">de ${goal.targetAmount.toLocaleString()}</span>
                                </div>
                                <div className="h-4 bg-gray-100 rounded-full overflow-hidden mb-3">
                                    <div
                                        className="h-full transition-all duration-1000 relative"
                                        style={{ width: `${progress}%`, backgroundColor: goalColor }}
                                    >
                                        <div className="absolute inset-0 bg-white/20 w-full h-full animate-pulse"></div>
                                    </div>
                                </div>

                                {goal.monthlyContribution !== undefined && goal.monthlyContribution > 0 && (
                                    <div className="flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 p-2 rounded-lg border border-yellow-100 mb-4">
                                        <Icons.Bank size={14} />
                                        <span>Se bloquean <strong>${goal.monthlyContribution.toLocaleString()}</strong> de tu Techo Mensual.</span>
                                    </div>
                                )}

                                {goal.aiPlan && (
                                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                        <h4 className="font-bold text-gray-700 text-sm mb-2 flex items-center gap-2">
                                            <Icons.Brain size={16} className="text-primary" /> Plan Estratégico
                                        </h4>
                                        <div className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                                            {goal.aiPlan}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">{editingGoalId ? 'Editar Meta' : 'Nueva Meta'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400"><Icons.Close size={20} /></button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Nombre de la Meta</label>
                                <input
                                    className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Ej. Viaje a Japón"
                                    value={newGoal.name || ''}
                                    onChange={e => setNewGoal({ ...newGoal, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Color Identificador</label>
                                <p className="text-[10px] text-gray-400 mb-2">Este color aparecerá en tu barra de Dashboard.</p>
                                <div className="flex flex-wrap gap-2 mt-1 mb-2">
                                    {GOAL_COLORS.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setNewGoal({ ...newGoal, color: c })}
                                            className={`w-10 h-10 rounded-full border-4 transition-transform hover:scale-105 ${newGoal.color === c ? 'border-gray-800 scale-105 shadow-md' : 'border-transparent'}`}
                                            style={{ backgroundColor: c }}
                                            title={c}
                                        />
                                    ))}
                                </div>
                                <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl mt-1">
                                    <input
                                        type="color"
                                        value={newGoal.color || '#A88BEB'}
                                        onChange={(e) => setNewGoal({ ...newGoal, color: e.target.value })}
                                        className="w-10 h-10 rounded-lg cursor-pointer border-none bg-transparent"
                                    />
                                    <span className="text-sm text-gray-500">Color Personalizado</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase">Costo Objetivo ($)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="80000"
                                        value={newGoal.targetAmount || ''}
                                        onChange={e => setNewGoal({ ...newGoal, targetAmount: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase">Ahorrado ($)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="0"
                                        value={newGoal.currentAmount || ''}
                                        onChange={e => setNewGoal({ ...newGoal, currentAmount: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Fecha Límite</label>
                                <input
                                    type="date"
                                    className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                    value={newGoal.deadline || ''}
                                    onChange={e => setNewGoal({ ...newGoal, deadline: e.target.value })}
                                />
                            </div>

                            <div className="bg-gradient-to-br from-primary/5 to-secondary/10 p-4 rounded-2xl border border-primary/10">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-primary flex items-center gap-2">
                                        <Icons.Brain size={18} /> Asistente de Planificación
                                    </h3>
                                    <button
                                        onClick={handleAskAI}
                                        disabled={loadingPlan}
                                        className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors"
                                    >
                                        {loadingPlan ? 'Calculando...' : editingGoalId ? 'Recalcular Plan' : 'Calcular Plan'}
                                    </button>
                                </div>

                                {newGoal.monthlyContribution !== undefined && (
                                    <div className="bg-white p-3 rounded-xl mb-2 border border-yellow-200 bg-yellow-50">
                                        <p className="text-xs text-yellow-800 font-bold uppercase">Aportación Mensual (Estimada):</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold text-yellow-600">$</span>
                                            <input
                                                type="number"
                                                value={newGoal.monthlyContribution}
                                                onChange={(e) => setNewGoal({ ...newGoal, monthlyContribution: parseFloat(e.target.value) })}
                                                className="text-lg font-bold text-yellow-600 bg-transparent w-full outline-none"
                                            />
                                        </div>
                                        <p className="text-[10px] text-yellow-700 opacity-70 leading-tight mt-1">
                                            Se calcula automáticamente para que alcances tu meta a tiempo.
                                        </p>
                                    </div>
                                )}

                                {generatedPlan && (
                                    <div className="bg-white p-3 rounded-xl text-sm text-gray-700 whitespace-pre-line border border-gray-100 shadow-sm max-h-40 overflow-y-auto custom-scrollbar">
                                        {generatedPlan}
                                    </div>
                                )}
                            </div>

                            <button onClick={handleSave} className="w-full py-4 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:bg-purple-600 transition-all">
                                {editingGoalId ? 'Guardar Cambios' : 'Crear Meta'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Deposit Modal */}
            {isDepositModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Icons.Wallet className="text-green-600" /> Aportar a Meta
                            </h2>
                            <button onClick={() => setIsDepositModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <Icons.Close size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-gray-500">El dinero se moverá de tu cuenta seleccionada a esta meta y se registrará como un gasto de "Ahorro".</p>

                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Origen de Fondos</label>
                                <select
                                    value={sourceAccount}
                                    onChange={(e) => setSourceAccount(e.target.value)}
                                    className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-green-500 mt-1"
                                >
                                    <option value="" disabled>Selecciona cuenta...</option>
                                    {accounts.filter(a => a.type !== 'Credit').map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name} (${acc.balance.toLocaleString()})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Monto a Aportar</label>
                                <div className="relative mt-1">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-800 font-bold">$</span>
                                    <input
                                        type="number"
                                        value={depositAmount}
                                        onChange={(e) => setDepositAmount(e.target.value)}
                                        className="w-full bg-gray-50 p-3 pl-8 rounded-xl outline-none focus:ring-2 focus:ring-green-500 font-bold text-xl"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleDeposit}
                                disabled={!sourceAccount || !depositAmount || parseFloat(depositAmount) <= 0}
                                className="w-full py-3 rounded-xl bg-green-500 text-white font-bold shadow-lg hover:bg-green-600 transition-colors disabled:opacity-50 mt-2"
                            >
                                Confirmar Aporte
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};