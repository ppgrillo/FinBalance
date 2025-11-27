
import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../components/Icons';
import { CategoryType, Account } from '../types';
import { geminiService } from '../services/geminiService';
import { dbService } from '../services/dbService';
import { useNavigate, useSearchParams } from 'react-router-dom';

type TransactionMode = 'expense' | 'income' | 'transfer';

export const AddExpense: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams(); // NEW: Hook for URL params

    const [mode, setMode] = useState<'text' | 'voice' | 'camera'>('text');
    const [transactionType, setTransactionType] = useState<TransactionMode>('expense');
    const [loading, setLoading] = useState(false);

    // Form State
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<string>(''); // Initial empty
    const [description, setDescription] = useState('');
    const [isCustomCategory, setIsCustomCategory] = useState(false);

    // Account States
    const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);

    // Account States
    const [selectedAccount, setSelectedAccount] = useState<string>(''); // Source for Expense/Transfer, Dest for Income
    const [destAccount, setDestAccount] = useState<string>(''); // Only for Transfer

    // Quick Loan Creation State
    const [isCreatingLoan, setIsCreatingLoan] = useState(false);
    const [newLoanName, setNewLoanName] = useState('');

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);

    // Voice State
    const [isRecording, setIsRecording] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [accData, catData] = await Promise.all([
                    dbService.getAccounts(),
                    dbService.getCategories()
                ]);
                setAccounts(accData);

                // Load categories from DB
                let catNames: string[] = [];
                if (catData && catData.length > 0) {
                    catNames = catData.map(c => c.name);
                } else {
                    // Fallback defaults
                    catNames = Object.values(CategoryType);
                }
                setAvailableCategories(catNames);

                // Set default category selection
                if (catNames.length > 0) {
                    const defaultCat = catNames.find(c => c === 'Otros' || c === 'Others') || catNames[0];
                    setCategory(defaultCat);
                }

                // Auto-select Default Account
                const defaultAcc = accData.find(a => a.isDefault);
                if (defaultAcc) {
                    setSelectedAccount(defaultAcc.id);
                } else if (accData.length > 0) {
                    // Fallback to first debit/cash if no default
                    const fallback = accData.find(a => a.type === 'Debit' || a.type === 'Cash');
                    if (fallback) setSelectedAccount(fallback.id);
                }

                // --- AUTO-FILL LOGIC FROM URL ---
                const typeParam = searchParams.get('type');
                const destParam = searchParams.get('dest');
                const amountParam = searchParams.get('amount');

                if (typeParam === 'transfer') {
                    setTransactionType('transfer');
                    if (destParam) setDestAccount(destParam);
                    if (amountParam) setAmount(amountParam);

                    // If it's a debt repayment, auto-select a Debit account as source if available
                    const debitAcc = accData.find(a => a.type === 'Debit' || a.type === 'Cash');
                    if (debitAcc) setSelectedAccount(debitAcc.id);
                }

            } catch (e) {
                console.error("Error loading data for AddExpense", e);
            }
        };
        loadData();
    }, [searchParams]); // Re-run if params change

    // Logic to pre-fill category based on type
    useEffect(() => {
        if (transactionType === 'income') {
            setCategory('Salario'); // Default suggested
            setDescription('Nómina');
        } else if (transactionType === 'transfer') {
            setCategory('Transferencia');
            setDescription('Pago de deuda / Transferencia');
        } else {
            // Expense defaults
            if (!category || category === 'Salario' || category === 'Transferencia') {
                setCategory('Comida');
                setDescription('');
            }
        }
    }, [transactionType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const val = parseFloat(amount);
        if (!val || val <= 0) {
            alert("Ingresa un monto válido");
            return;
        }

        if (transactionType === 'transfer' && (!destAccount || destAccount === selectedAccount)) {
            alert('Selecciona una cuenta de destino diferente al origen');
            return;
        }

        // Validation for loan creation
        if (transactionType !== 'transfer' && isCreatingLoan && !newLoanName.trim()) {
            alert("Ingresa el nombre del préstamo o acreedor.");
            return;
        }

        if (!selectedAccount && !isCreatingLoan && accounts.length > 0) {
            alert('Selecciona una cuenta');
            return;
        }

        setLoading(true);
        try {
            // Custom category logic (only for Expenses/Income usually)
            if (transactionType !== 'transfer' && category) {
                // If it's the suggested category (new) or a custom typed one
                if ((suggestedCategory === category && !availableCategories.includes(category)) || (isCustomCategory && !availableCategories.includes(category))) {
                    await dbService.createCategory(category);
                }
            }

            const date = new Date().toISOString();
            let effectiveAccountId = selectedAccount;

            // 1. Handle Quick Loan Account Creation
            if (isCreatingLoan) {
                const newAcc = await dbService.addAccount({
                    name: newLoanName,
                    type: 'Loan',
                    balance: 0,
                    color: '#F97316' // Orange color for loans
                });
                if (newAcc && newAcc.id) {
                    effectiveAccountId = newAcc.id;
                } else {
                    throw new Error("No se pudo crear la cuenta de préstamo");
                }
            }

            // 2. Process Transaction
            if (transactionType === 'income') {
                await dbService.addIncome({
                    amount: val,
                    category,
                    description,
                    date
                }, effectiveAccountId);

            } else if (transactionType === 'transfer') {
                await dbService.transferFunds(val, effectiveAccountId, destAccount, date);

            } else {
                // Expense
                await dbService.addExpense({
                    amount: val,
                    category,
                    description,
                    date
                }, effectiveAccountId);
            }

            navigate('/');
        } catch (e: any) {
            alert('Error al guardar la transacción: ' + (e.message || "Error desconocido"));
        } finally {
            setLoading(false);
        }
    };

    const handleAnalyze = async (text?: string, base64Img?: string) => {
        setLoading(true);
        try {
            const result = await geminiService.analyzeExpense(text, base64Img, availableCategories);
            if (result.amount) setAmount(result.amount.toString());

            if (result.category) {
                const match = availableCategories.find(c => c.toLowerCase() === result.category?.toLowerCase());
                if (match) {
                    setCategory(match);
                    setSuggestedCategory(null);
                    setIsCustomCategory(false);
                } else {
                    // New category suggested by AI
                    setCategory(result.category);
                    setSuggestedCategory(result.category);
                    setIsCustomCategory(false); // Don't switch to input, show chip instead
                }
            }

            if (result.description) setDescription(result.description);
            setMode('text');
            setTransactionType('expense'); // AI defaults to expense analysis
        } catch (e) {
            alert("No se pudo analizar.");
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                const base64Content = base64String.split(',')[1];
                handleAnalyze(undefined, base64Content);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Registrar</h1>
            </div>

            {/* Top Tabs for Transaction Type */}
            <div className="bg-gray-100 p-1 rounded-xl flex mb-4">
                <button
                    onClick={() => setTransactionType('expense')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${transactionType === 'expense' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-400'}`}
                >
                    Gasto
                </button>
                <button
                    onClick={() => setTransactionType('income')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${transactionType === 'income' ? 'bg-white text-green-500 shadow-sm' : 'text-gray-400'}`}
                >
                    Ingreso
                </button>
                <button
                    onClick={() => setTransactionType('transfer')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${transactionType === 'transfer' ? 'bg-white text-blue-500 shadow-sm' : 'text-gray-400'}`}
                >
                    Transferencia
                </button>
            </div>

            {/* Input Method Tabs (Only show for Expense/Income usually, let's keep simple) */}
            {transactionType !== 'transfer' && (
                <div className="bg-white p-1 rounded-xl flex mb-6 shadow-sm">
                    {(['text', 'voice', 'camera'] as const).map((m) => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={`flex-1 flex flex-col items-center py-3 rounded-lg text-xs font-medium transition-all ${mode === m ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'
                                }`}
                        >
                            {m === 'text' && <Icons.Text size={20} className="mb-1" />}
                            {m === 'voice' && <Icons.Mic size={20} className="mb-1" />}
                            {m === 'camera' && <Icons.Camera size={20} className="mb-1" />}
                            {m.charAt(0).toUpperCase() + m.slice(1)}
                        </button>
                    ))}
                </div>
            )}

            <div className="bg-white rounded-3xl shadow-sm p-6 min-h-[400px] relative">

                {loading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-3xl">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
                        <p className="text-primary font-medium animate-pulse">Procesando...</p>
                    </div>
                )}

                {mode === 'text' || transactionType === 'transfer' ? (
                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* AI Magic Input */}
                        {transactionType === 'expense' && mode === 'text' && (
                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mb-6">
                                <div className="flex items-center gap-2 mb-2 text-primary font-bold text-sm">
                                    <Icons.Brain size={18} />
                                    <span>Registro Rápido con IA</span>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Ej: 400 pesos en salchichas"
                                        className="flex-1 bg-white border border-purple-200 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const val = (e.target as HTMLInputElement).value;
                                                if (val.trim()) handleAnalyze(val);
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            const input = (e.currentTarget.previousElementSibling as HTMLInputElement).value;
                                            if (input.trim()) handleAnalyze(input);
                                        }}
                                        className="bg-primary text-white px-4 rounded-lg font-medium text-sm hover:bg-purple-600 transition-colors"
                                    >
                                        Analizar
                                    </button>
                                </div>
                                <p className="text-[10px] text-purple-400 mt-2">
                                    Escribe algo como "Cena de ayer 500" y la IA llenará el formulario.
                                </p>
                            </div>
                        )}

                        {/* Amount Input */}
                        <div>
                            <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Monto</label>
                            <div className="relative">
                                <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-bold text-lg ${transactionType === 'income' ? 'text-green-500' : 'text-textPrimary'}`}>$</span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className={`w-full bg-background rounded-xl py-4 pl-10 pr-4 text-2xl font-bold outline-none focus:ring-2 ${transactionType === 'income' ? 'text-green-600 focus:ring-green-200' : 'text-textPrimary focus:ring-primary/50'}`}
                                    placeholder="0.00"
                                    required
                                    autoFocus={!searchParams.get('amount')} // Only autofocus if not pre-filled
                                />
                            </div>
                        </div>

                        {/* Accounts Logic */}
                        {transactionType === 'transfer' ? (
                            <>
                                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 mb-4 flex gap-2 items-start">
                                    <Icons.Trending className="text-blue-500 shrink-0 mt-0.5" size={16} />
                                    <p className="text-xs text-blue-700 leading-tight">
                                        Usa "Transferencia" para pagar Tarjetas de Crédito o pagar Deudas Personales (Préstamos). El dinero saldrá de tu Origen y reducirá la deuda del Destino.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Desde (Origen)</label>
                                        <select
                                            value={selectedAccount}
                                            onChange={(e) => setSelectedAccount(e.target.value)}
                                            className="w-full bg-background rounded-xl py-3 px-4 text-textPrimary outline-none focus:ring-2 focus:ring-blue-200"
                                            required
                                        >
                                            <option value="" disabled>Seleccionar...</option>
                                            {accounts.filter(a => a.type !== 'Credit' && a.type !== 'Loan').map(acc => (
                                                <option key={acc.id} value={acc.id}>{acc.name} (${acc.balance})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-center md:hidden my-[-10px] text-blue-300"><Icons.ArrowDownRight size={24} /></div>
                                        <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Hacia (Destino/Pago)</label>
                                        <select
                                            value={destAccount}
                                            onChange={(e) => setDestAccount(e.target.value)}
                                            className="w-full bg-background rounded-xl py-3 px-4 text-textPrimary outline-none focus:ring-2 focus:ring-blue-200"
                                            required
                                        >
                                            <option value="" disabled>Seleccionar...</option>
                                            {accounts.filter(a => a.id !== selectedAccount).map(acc => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.name} (${acc.balance}) {acc.type === 'Loan' ? '(Deuda Activa)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div>
                                <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">
                                    {transactionType === 'income' ? 'Cuenta de Destino' : 'Medio de Pago / Quién pagó'}
                                </label>

                                {!isCreatingLoan ? (
                                    <select
                                        value={selectedAccount}
                                        onChange={(e) => {
                                            if (e.target.value === 'NEW_LOAN') {
                                                setIsCreatingLoan(true);
                                                setSelectedAccount('');
                                            } else {
                                                setSelectedAccount(e.target.value);
                                                setIsCreatingLoan(false);
                                            }
                                        }}
                                        className="w-full bg-background rounded-xl py-3 px-4 text-textPrimary outline-none focus:ring-2 focus:ring-primary/50"
                                        required={!isCreatingLoan}
                                    >
                                        <option value="" disabled>Seleccionar cuenta...</option>
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.name} (${acc.balance}) {acc.type === 'Loan' ? '(Deuda)' : ''}
                                            </option>
                                        ))}
                                        <option value="NEW_LOAN" className="text-orange-500 font-bold">+ Nueva Deuda (Alguien me prestó)</option>
                                    </select>
                                ) : (
                                    <div className="bg-orange-50 p-3 rounded-xl border border-orange-200 animate-fade-in">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-orange-700">Crear nueva deuda con:</span>
                                            <button
                                                type="button"
                                                onClick={() => { setIsCreatingLoan(false); setSelectedAccount(''); }}
                                                className="text-orange-400 hover:text-orange-600"
                                            >
                                                <Icons.Close size={16} />
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            value={newLoanName}
                                            onChange={(e) => setNewLoanName(e.target.value)}
                                            placeholder="Nombre (ej. Juan, Mamá)"
                                            className="w-full bg-white p-2 rounded-lg outline-none focus:ring-2 focus:ring-orange-300 text-sm"
                                            autoFocus
                                        />
                                        <p className="text-[10px] text-orange-600 mt-2 leading-tight">
                                            Se creará una cuenta tipo "Préstamo". El gasto aumentará tu deuda con esta persona.
                                        </p>
                                    </div>
                                )}

                                {!isCreatingLoan && transactionType === 'expense' && (
                                    <p className="text-[10px] text-gray-400 mt-1 ml-1">
                                        Si seleccionas una cuenta de "Préstamo", el gasto aumentará tu deuda con esa persona.
                                    </p>
                                )}
                                {!isCreatingLoan && accounts.length === 0 && <p className="text-xs text-red-400 mt-1">Crea una cuenta en la Billetera primero.</p>}
                            </div>
                        )}

                        {/* Category & Description (Hidden for Transfer to keep simple, or auto-filled) */}
                        {transactionType !== 'transfer' && (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Categoría</label>
                                    <div className="flex flex-wrap gap-2">
                                        {!isCustomCategory ? (
                                            <>
                                                {/* Suggested Category Chip */}
                                                {suggestedCategory && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setCategory(suggestedCategory)}
                                                        className={`py-2 px-4 rounded-full text-xs font-bold transition-all border flex items-center gap-1 animate-pulse ${category === suggestedCategory
                                                            ? 'bg-purple-100 text-purple-700 border-purple-300 shadow-md transform scale-105'
                                                            : 'bg-white border-purple-200 text-purple-400 hover:border-purple-300'
                                                            }`}
                                                    >
                                                        <Icons.Brain size={12} />
                                                        ✨ {suggestedCategory} (Nuevo)
                                                    </button>
                                                )}

                                                {availableCategories.map((cat) => (
                                                    <button
                                                        type="button"
                                                        key={cat}
                                                        onClick={() => setCategory(cat)}
                                                        className={`py-2 px-4 rounded-full text-xs font-bold transition-all border ${category === cat
                                                            ? 'bg-primary text-white border-primary shadow-md transform scale-105'
                                                            : 'bg-white border-gray-200 text-textSecondary hover:border-primary hover:text-primary'
                                                            }`}
                                                    >
                                                        {cat}
                                                    </button>
                                                ))}

                                                <button
                                                    type="button"
                                                    onClick={() => { setIsCustomCategory(true); setCategory(''); }}
                                                    className="py-2 px-4 rounded-full text-xs font-bold transition-all border border-dashed border-gray-300 text-textSecondary hover:border-primary hover:text-primary bg-gray-50"
                                                >
                                                    + Nueva
                                                </button>
                                            </>
                                        ) : (
                                            <div className="w-full flex gap-2">
                                                <input
                                                    type="text"
                                                    value={category}
                                                    onChange={(e) => setCategory(e.target.value)}
                                                    placeholder="Nombre de nueva categoría"
                                                    className="flex-1 bg-background rounded-xl py-3 px-4 text-textPrimary outline-none focus:ring-2 focus:ring-primary/50"
                                                    autoFocus
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => { setIsCustomCategory(false); setCategory(availableCategories[0] || ''); }}
                                                    className="bg-gray-200 px-4 rounded-xl text-gray-600 hover:bg-gray-300 transition-colors"
                                                >
                                                    <Icons.Close />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Descripción</label>
                                    <input
                                        type="text"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full bg-background rounded-xl py-3 px-4 text-textPrimary outline-none focus:ring-2 focus:ring-primary/50"
                                        placeholder={transactionType === 'income' ? "¿De qué es el ingreso?" : "¿Qué compraste?"}
                                        required
                                    />
                                </div>
                            </>
                        )}

                        <button
                            type="submit"
                            className={`w-full text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${transactionType === 'income' ? 'bg-green-500 hover:bg-green-600 shadow-green-500/30' :
                                transactionType === 'transfer' ? 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/30' :
                                    'bg-primary hover:bg-purple-600 shadow-primary/30'
                                }`}
                        >
                            <Icons.Check size={20} />
                            {transactionType === 'income' ? 'Guardar Ingreso' : transactionType === 'transfer' ? 'Realizar Transferencia' : 'Guardar Gasto'}
                        </button>
                    </form>
                ) : null}

                {/* Voice & Camera Modes (Only for Expense) */}
                {mode === 'voice' && transactionType === 'expense' && (
                    <div className="flex flex-col items-center justify-center h-[300px] text-center space-y-8">
                        <div className="relative">
                            {isRecording && (
                                <div className="absolute inset-0 bg-accent rounded-full animate-ping opacity-50"></div>
                            )}
                            <button
                                onClick={() => setIsRecording(!isRecording)}
                                className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all ${isRecording ? 'bg-red-500 text-white' : 'bg-primary text-white hover:scale-105'
                                    }`}
                            >
                                <Icons.Mic size={40} />
                            </button>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-textPrimary mb-2">
                                {isRecording ? 'Escuchando...' : 'Toca para hablar'}
                            </h3>
                        </div>
                    </div>
                )}

                {mode === 'camera' && transactionType === 'expense' && (
                    <div className="flex flex-col items-center justify-center h-[300px] text-center space-y-6">
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-48 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-gray-50 hover:border-primary transition-colors"
                        >
                            <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center text-primary">
                                <Icons.Camera size={32} />
                            </div>
                            <p className="text-sm text-textSecondary font-medium">Sube una foto de tu ticket</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
