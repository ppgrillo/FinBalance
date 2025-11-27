
import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../components/Icons';
import { CategoryType, Account, IncomeCategoryType } from '../types';
import { geminiService } from '../services/geminiService';
import { dbService } from '../services/dbService';
import { useNavigate, useSearchParams } from 'react-router-dom';

type TransactionMode = 'expense' | 'income' | 'transfer';

export const AddExpense: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [transactionType, setTransactionType] = useState<TransactionMode>('expense');
    const [loading, setLoading] = useState(false);

    // Form State
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<string>('');
    const [description, setDescription] = useState('');
    const [isCustomCategory, setIsCustomCategory] = useState(false);

    // Account States
    const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
    const [selectedAccount, setSelectedAccount] = useState<string>('');
    const [destAccount, setDestAccount] = useState<string>('');

    // Quick Loan Creation State
    const [isCreatingLoan, setIsCreatingLoan] = useState(false);
    const [newLoanName, setNewLoanName] = useState('');

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);
    const [availableIncomeCategories, setAvailableIncomeCategories] = useState<string[]>(Object.values(IncomeCategoryType));

    // Voice State
    const [isRecording, setIsRecording] = useState(false);
    const [showCameraOptions, setShowCameraOptions] = useState(false);
    const recognitionRef = useRef<any>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [accData, catData] = await Promise.all([
                    dbService.getAccounts(),
                    dbService.getCategories()
                ]);
                setAccounts(accData);

                // Load categories from DB
                let expenseCats: string[] = [];
                let incomeCats: string[] = [];

                if (catData && catData.length > 0) {
                    expenseCats = catData.filter(c => c.type === 'expense' || !c.type).map(c => c.name);
                    incomeCats = catData.filter(c => c.type === 'income').map(c => c.name);
                }

                // Fallback if empty
                if (expenseCats.length === 0) expenseCats = Object.values(CategoryType);
                if (incomeCats.length === 0) incomeCats = Object.values(IncomeCategoryType);

                setAvailableCategories(expenseCats);
                setAvailableIncomeCategories(incomeCats);

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

                    const debitAcc = accData.find(a => a.type === 'Debit' || a.type === 'Cash');
                    if (debitAcc) setSelectedAccount(debitAcc.id);
                }

            } catch (e) {
                console.error("Error loading data for AddExpense", e);
            }
        };
        loadData();
    }, [searchParams]);

    // Logic to pre-fill category based on type
    useEffect(() => {
        if (transactionType === 'income') {
            setCategory('Salario');
            setDescription('Nómina');
        } else if (transactionType === 'transfer') {
            setCategory('Transferencia');
            setDescription('Pago de deuda / Transferencia');
        } else {
            if (!category || category === 'Salario' || category === 'Transferencia') {
                setCategory('Comida');
                setDescription('');
            }
        }
    }, [transactionType]);

    // --- VOICE LOGIC ---
    const startListening = () => {
        if (!('webkitSpeechRecognition' in window)) {
            alert("Tu navegador no soporta reconocimiento de voz. Intenta usar Chrome.");
            return;
        }

        const SpeechRecognition = (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-MX'; // Spanish Mexico
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsRecording(true);
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            console.log("Voice Result:", transcript);
            handleAnalyze(transcript);
        };

        recognition.onerror = (event: any) => {
            console.error("Voice Error:", event.error);
            setIsRecording(false);
            alert("Error al escuchar. Intenta de nuevo.");
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        recognition.start();
        recognitionRef.current = recognition;
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    };

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
            if (transactionType !== 'transfer' && category) {
                if ((suggestedCategory === category && !availableCategories.includes(category)) || (isCustomCategory && !availableCategories.includes(category))) {
                    await dbService.createCategory(category, transactionType === 'income' ? 'income' : 'expense');
                }
            }

            const date = new Date().toISOString();
            let effectiveAccountId = selectedAccount;

            if (isCreatingLoan) {
                const newAcc = await dbService.addAccount({
                    name: newLoanName,
                    type: 'Loan',
                    balance: 0,
                    color: '#F97316'
                });
                if (newAcc && newAcc.id) {
                    effectiveAccountId = newAcc.id;
                } else {
                    throw new Error("No se pudo crear la cuenta de préstamo");
                }
            }

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
            const result = await geminiService.analyzeExpense(
                text,
                base64Img,
                availableCategories,
                availableIncomeCategories,
                accounts.map(a => a.name)
            );

            if (result.amount) setAmount(result.amount.toString());

            // Handle Type Switching
            if (result.type) {
                setTransactionType(result.type);
            }

            // Handle Category
            if (result.category) {
                const targetList = result.type === 'income' ? availableIncomeCategories : availableCategories;
                const match = targetList.find(c => c.toLowerCase() === result.category?.toLowerCase());

                if (match) {
                    setCategory(match);
                    setSuggestedCategory(null);
                    setIsCustomCategory(false);
                } else {
                    setCategory(result.category);
                    setSuggestedCategory(result.category);
                    setIsCustomCategory(false);
                }
            }

            // Handle Account (Source or Destination)
            if (result.destinationAccount) {
                // Fuzzy match account name
                const accMatch = accounts.find(a =>
                    a.name.toLowerCase().includes(result.destinationAccount!.toLowerCase()) ||
                    result.destinationAccount!.toLowerCase().includes(a.name.toLowerCase())
                );
                if (accMatch) {
                    setSelectedAccount(accMatch.id);
                }
            }

            if (result.description) setDescription(result.description);

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

            {/* Transaction Type Tabs */}
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

            <div className="bg-white rounded-3xl shadow-sm p-6 min-h-[400px] relative">

                {loading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-3xl">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
                        <p className="text-primary font-medium animate-pulse">Procesando...</p>
                    </div>
                )}

                {/* --- UNIFIED QUICK INPUT (Text + Voice + Camera) --- */}
                <div className={`p-4 rounded-2xl border mb-6 transition-colors ${transactionType === 'income' ? 'bg-green-50 border-green-100' :
                    transactionType === 'transfer' ? 'bg-blue-50 border-blue-100' :
                        'bg-purple-50 border-purple-100'
                    }`}>
                    <div className={`flex items-center gap-2 mb-3 font-bold text-sm ${transactionType === 'income' ? 'text-green-600' :
                        transactionType === 'transfer' ? 'text-blue-600' :
                            'text-purple-600'
                        }`}>
                        <Icons.Brain size={18} />
                        <span>Registro Rápido con IA</span>
                    </div>

                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                placeholder={transactionType === 'income' ? "Ej: Nómina 5000 a BBVA" : "Ej: Tacos 200"}
                                className={`w-full bg-white border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 pr-10 ${transactionType === 'income' ? 'border-green-200 focus:ring-green-200' :
                                    transactionType === 'transfer' ? 'border-blue-200 focus:ring-blue-200' :
                                        'border-purple-200 focus:ring-purple-200'
                                    }`}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const val = (e.target as HTMLInputElement).value;
                                        if (val.trim()) handleAnalyze(val);
                                    }
                                }}
                            />
                            <button
                                onClick={(e) => {
                                    const input = (e.currentTarget.previousElementSibling as HTMLInputElement).value;
                                    if (input.trim()) handleAnalyze(input);
                                }}
                                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg ${transactionType === 'income' ? 'bg-green-100 text-green-600 hover:bg-green-200' :
                                    transactionType === 'transfer' ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' :
                                        'bg-purple-100 text-purple-600 hover:bg-purple-200'
                                    }`}
                            >
                                <Icons.ArrowUpRight size={16} />
                            </button>
                        </div>

                        {/* Voice Button */}
                        <button
                            type="button"
                            onClick={startListening}
                            className={`bg-white border w-12 rounded-xl flex items-center justify-center transition-colors ${transactionType === 'income' ? 'border-green-200 text-green-600 hover:bg-green-50' :
                                transactionType === 'transfer' ? 'border-blue-200 text-blue-600 hover:bg-blue-50' :
                                    'border-purple-200 text-purple-600 hover:bg-purple-50'
                                }`}
                            title="Usar Voz"
                        >
                            <Icons.Mic size={20} />
                        </button>

                        {/* Camera Button */}
                        <button
                            type="button"
                            onClick={() => setShowCameraOptions(true)}
                            className={`bg-white border w-12 rounded-xl flex items-center justify-center transition-colors ${transactionType === 'income' ? 'border-green-200 text-green-600 hover:bg-green-50' :
                                transactionType === 'transfer' ? 'border-blue-200 text-blue-600 hover:bg-blue-50' :
                                    'border-purple-200 text-purple-600 hover:bg-purple-50'
                                }`}
                            title="Usar Cámara"
                        >
                            <Icons.Camera size={20} />
                        </button>

                        {/* Hidden Inputs */}
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            ref={cameraInputRef}
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                    </div>
                    <p className={`text-[10px] mt-2 ml-1 ${transactionType === 'income' ? 'text-green-400' :
                        transactionType === 'transfer' ? 'text-blue-400' :
                            'text-purple-400'
                        }`}>
                        {transactionType === 'income' ? 'Ej: "Vendí bici 1500 a Efectivo"' : 'Escribe, habla o sube foto.'}
                    </p>
                </div>

                {/* Camera Options Modal */}
                {showCameraOptions && (
                    <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center animate-fade-in p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-6">¿Qué deseas hacer?</h3>
                        <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-6">
                            <button
                                onClick={() => {
                                    setShowCameraOptions(false);
                                    cameraInputRef.current?.click();
                                }}
                                className="flex flex-col items-center justify-center gap-3 bg-purple-50 border-2 border-purple-100 p-6 rounded-2xl hover:bg-purple-100 hover:border-purple-300 transition-all"
                            >
                                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white shadow-lg">
                                    <Icons.Camera size={24} />
                                </div>
                                <span className="font-bold text-purple-700 text-sm">Tomar Foto</span>
                            </button>

                            <button
                                onClick={() => {
                                    setShowCameraOptions(false);
                                    fileInputRef.current?.click();
                                }}
                                className="flex flex-col items-center justify-center gap-3 bg-blue-50 border-2 border-blue-100 p-6 rounded-2xl hover:bg-blue-100 hover:border-blue-300 transition-all"
                            >
                                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg">
                                    <Icons.Image size={24} />
                                </div>
                                <span className="font-bold text-blue-700 text-sm">Galería</span>
                            </button>
                        </div>
                        <button
                            onClick={() => setShowCameraOptions(false)}
                            className="text-gray-400 font-medium text-sm hover:text-gray-600"
                        >
                            Cancelar
                        </button>
                    </div>
                )}

                {/* Voice Recording Overlay */}
                {isRecording && (
                    <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center animate-fade-in">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20"></div>
                            <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center text-white shadow-xl">
                                <Icons.Mic size={32} />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Escuchando...</h3>
                        <p className="text-gray-500 text-sm mb-8">Di tu gasto, ej: "Gasolina 500"</p>
                        <button
                            onClick={stopListening}
                            className="bg-gray-100 text-gray-600 px-6 py-2 rounded-full font-bold text-sm hover:bg-gray-200"
                        >
                            Cancelar
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
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
                                autoFocus={!searchParams.get('amount') && transactionType !== 'expense'}
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
                                transactionType === 'income' ? (
                                    // ACCOUNT CHIPS FOR INCOME
                                    <div className="flex flex-wrap gap-2">
                                        {accounts.map(acc => (
                                            <button
                                                key={acc.id}
                                                type="button"
                                                onClick={() => setSelectedAccount(acc.id)}
                                                className={`py-3 px-4 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${selectedAccount === acc.id
                                                    ? 'bg-green-500 text-white border-green-500 shadow-md transform scale-105'
                                                    : 'bg-white border-gray-200 text-gray-600 hover:border-green-300'
                                                    }`}
                                            >
                                                {acc.type === 'Cash' && <Icons.Wallet size={14} />}
                                                {acc.type === 'Debit' && <Icons.CreditCard size={14} />}
                                                {acc.type === 'Bank' && <Icons.Bank size={14} />}
                                                {acc.name}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => navigate('/wallet')}
                                            className="py-3 px-4 rounded-xl text-xs font-bold border border-dashed border-gray-300 text-gray-400 hover:text-green-500 hover:border-green-300"
                                        >
                                            + Cuenta
                                        </button>
                                    </div>
                                ) : (
                                    // DROPDOWN FOR EXPENSE
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
                                )
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
                            )}                        {!isCreatingLoan && transactionType === 'expense' && (
                                <p className="text-[10px] text-gray-400 mt-1 ml-1">
                                    Si seleccionas una cuenta de "Préstamo", el gasto aumentará tu deuda con esa persona.
                                </p>
                            )}
                            {!isCreatingLoan && accounts.length === 0 && <p className="text-xs text-red-400 mt-1">Crea una cuenta en la Billetera primero.</p>}
                        </div>
                    )}

                    {/* Category & Description */}
                    {transactionType !== 'transfer' && (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Categoría</label>
                                <div className="flex flex-wrap gap-2">
                                    {!isCustomCategory ? (
                                        <>
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

                                            {(transactionType === 'income' ? availableIncomeCategories : availableCategories).map((cat) => (
                                                <button
                                                    type="button"
                                                    key={cat}
                                                    onClick={() => setCategory(cat)}
                                                    className={`py-2 px-4 rounded-full text-xs font-bold transition-all border ${category === cat
                                                        ? (transactionType === 'income' ? 'bg-green-500 text-white border-green-500' : 'bg-primary text-white border-primary') + ' shadow-md transform scale-105'
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
            </div>
        </div>
    );
};
