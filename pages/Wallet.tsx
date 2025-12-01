import React, { useState, useEffect } from 'react';
import { Account, AccountType } from '../types';
import { dbService } from '../services/dbService';
import { Icons } from '../components/Icons';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';

export const Wallet: React.FC = () => {
    const { success, error, warning } = useToast();
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formAccount, setFormAccount] = useState<Partial<Account>>({ type: 'Debit', color: '#1E1E1E' });

    // Calibration State
    const [isCalibrating, setIsCalibrating] = useState(false);
    const [calibrationBalance, setCalibrationBalance] = useState('');
    const [recordCalibration, setRecordCalibration] = useState(true);

    // Delete Confirmation State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const loadAccounts = async () => {
        const data = await dbService.getAccounts();
        setAccounts(data);
    };

    useEffect(() => {
        loadAccounts();
    }, []);

    const totalAssets = accounts
        .filter(a => a.type !== 'Credit' && a.type !== 'Loan')
        .reduce((acc, curr) => acc + curr.balance, 0);

    const totalDebt = accounts
        .filter(a => a.type === 'Credit' || a.type === 'Loan')
        .reduce((acc, curr) => acc + curr.balance, 0);

    const netWorth = totalAssets - totalDebt;

    // Handlers
    const handleOpenCreate = () => {
        setEditingId(null);
        setFormAccount({ type: 'Debit', color: '#1E1E1E', name: '', balance: 0, limit: 0, lastDigits: '' });
        setIsCalibrating(false);
        setShowDeleteConfirm(false);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (acc: Account) => {
        setEditingId(acc.id);
        setFormAccount({ ...acc });
        setIsCalibrating(false);
        setShowDeleteConfirm(false);
        setCalibrationBalance(acc.balance.toString());
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Guardando cuenta...", editingId);
        if (!formAccount.name || formAccount.balance === undefined) {
            warning("Por favor ingresa al menos el nombre y el saldo actual.");
            return;
        }
        setLoading(true);
        try {
            if (editingId) {
                if (isCalibrating) {
                    // Use Calibration Logic
                    await dbService.calibrateAccount(
                        editingId,
                        parseFloat(calibrationBalance),
                        recordCalibration
                    );
                    success("Cuenta calibrada exitosamente");
                } else {
                    // Standard Update (Name, Color, etc.)
                    await dbService.updateAccount(editingId, formAccount);
                    success("Cuenta actualizada");
                }
            } else {
                // Create New
                await dbService.addAccount(formAccount);
                success("Cuenta creada");
            }

            await loadAccounts();
            setIsModalOpen(false);
        } catch (e) {
            console.error("Save Error:", e);
            error('Error guardando cuenta. Verifica tu conexión.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!editingId) return;

        setLoading(true);
        try {
            console.log("Llamando a dbService.deleteAccount...");
            await dbService.deleteAccount(editingId);
            console.log("Cuenta borrada exitosamente");
            await loadAccounts();
            setIsModalOpen(false);
            success("Cuenta eliminada");
        } catch (error: any) {
            console.error("Delete error details:", error);
            error("Error al eliminar la cuenta: " + (error.message || "Intenta nuevamente."));
        } finally {
            setLoading(false);
            setShowDeleteConfirm(false);
        }
    };

    const getDifference = () => {
        const oldBal = formAccount.balance || 0;
        const newBal = parseFloat(calibrationBalance) || 0;

        if (formAccount.type === 'Credit' || formAccount.type === 'Loan') {
            return newBal - oldBal;
        } else {
            return newBal - oldBal;
        }
    };

    const renderCard = (acc: Account) => (
        <div
            key={acc.id}
            onClick={() => navigate(`/wallet/${acc.id}`)}
            className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg transition-transform hover:scale-[1.02] cursor-pointer group"
            style={{ backgroundColor: acc.color }}
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10"></div>

            {/* Edit Button (Bottom Right) */}
            <div className="absolute bottom-3 right-3 bg-black/20 p-2 rounded-full z-20">
                <button
                    onClick={(e) => { e.stopPropagation(); handleOpenEdit(acc); }}
                    className="text-white hover:text-gray-200 flex items-center justify-center"
                >
                    <Icons.Edit size={14} />
                </button>
            </div>

            <div className="relative z-10 flex flex-col h-32 justify-between">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-white/80 text-xs font-medium tracking-wider uppercase">
                            {acc.type === 'Credit' ? 'Crédito' : acc.type === 'Investment' ? 'Inversión' : acc.type === 'Cash' ? 'Efectivo' : acc.type === 'Loan' ? 'Préstamo / Deuda' : 'Débito'}
                        </p>
                        <h3 className="font-bold text-lg tracking-wide mt-1 flex items-center gap-2">
                            {acc.name}
                            {acc.isDefault && <Icons.Star size={16} className="text-yellow-300 fill-yellow-300" />}
                        </h3>
                    </div>
                    {acc.type === 'Credit' ? <Icons.CreditCard className="opacity-50" size={24} /> :
                        acc.type === 'Loan' ? <Icons.Profile className="opacity-50" size={24} /> :
                            <Icons.Bank className="opacity-50" size={24} />}
                </div>

                <div>
                    <div className="flex justify-between items-end mb-1">
                        <p className="text-2xl font-bold tracking-widest">
                            ${acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                    {acc.type === 'Credit' && acc.limit ? (
                        <div className="text-xs text-white/70 flex justify-between">
                            <span>Límite: ${acc.limit.toLocaleString()}</span>
                            <span>Disp: ${(acc.limit - acc.balance).toLocaleString()}</span>
                        </div>
                    ) : (
                        <div className="h-4"></div>
                    )}
                    <div className="text-left mt-2 h-5">
                        {acc.lastDigits && <span className="text-sm tracking-widest opacity-80">•••• {acc.lastDigits}</span>}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 pb-24">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Mi Billetera</h1>
                <button
                    onClick={handleOpenCreate}
                    className="bg-primary text-white px-4 py-2 rounded-xl shadow-md hover:bg-purple-600 flex items-center gap-2 transition-colors"
                >
                    <Icons.Add size={20} />
                    <span className="hidden sm:inline">Nueva Cuenta</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-3xl shadow-sm border-l-4 border-green-400">
                    <p className="text-textSecondary text-sm font-medium">Patrimonio Neto</p>
                    <h2 className="text-2xl font-bold text-textPrimary mt-1">${netWorth.toLocaleString()}</h2>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border-l-4 border-blue-400">
                    <p className="text-textSecondary text-sm font-medium">Activos (Ahorro/Inv)</p>
                    <h2 className="text-2xl font-bold text-blue-600 mt-1">${totalAssets.toLocaleString()}</h2>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border-l-4 border-red-400">
                    <p className="text-textSecondary text-sm font-medium">Pasivos (Deuda TC/Préstamos)</p>
                    <h2 className="text-2xl font-bold text-red-500 mt-1">${totalDebt.toLocaleString()}</h2>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Icons.CreditCard size={20} className="text-primary" />
                    Tarjetas de Crédito
                </h3>
                {accounts.filter(a => a.type === 'Credit').length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {accounts.filter(a => a.type === 'Credit').map(renderCard)}
                    </div>
                ) : (
                    <p className="text-gray-400 text-sm">No tienes tarjetas de crédito registradas.</p>
                )}
            </div>

            <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Icons.Profile size={20} className="text-orange-500" />
                    Préstamos y Deudas
                </h3>
                {accounts.filter(a => a.type === 'Loan').length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {accounts.filter(a => a.type === 'Loan').map(renderCard)}
                    </div>
                ) : (
                    <p className="text-gray-400 text-sm">No tienes préstamos registrados. Crea una cuenta tipo "Préstamo" para rastrear deudas bancarias (Hipoteca, Coche) o personales.</p>
                )}
            </div>

            <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Icons.Bank size={20} className="text-green-600" />
                    Cuentas de Débito y Efectivo
                </h3>
                {accounts.filter(a => a.type !== 'Credit' && a.type !== 'Loan').length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {accounts.filter(a => a.type !== 'Credit' && a.type !== 'Loan').map(renderCard)}
                    </div>
                ) : (
                    <p className="text-gray-400 text-sm">No tienes cuentas de débito registradas.</p>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">{editingId ? 'Editar Cuenta' : 'Nueva Cuenta'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><Icons.Close size={20} /></button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-6">
                            {/* Standard Form Fields */}
                            <div className={`space-y-4 ${isCalibrating ? 'hidden' : 'block'}`}>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase">Nombre</label>
                                    <input
                                        className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                        placeholder={formAccount.type === 'Loan' ? "Ej. Hipoteca / Deuda a Juan" : "Ej. Nómina BBVA"}
                                        value={formAccount.name || ''}
                                        onChange={e => setFormAccount({ ...formAccount, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase">Tipo</label>
                                        <select
                                            className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                            value={formAccount.type}
                                            onChange={e => setFormAccount({ ...formAccount, type: e.target.value as AccountType })}
                                        >
                                            <option value="Debit">Débito</option>
                                            <option value="Credit">Crédito (Banco)</option>
                                            <option value="Loan">Préstamo / Crédito Personal</option>
                                            <option value="Cash">Efectivo</option>
                                            <option value="Investment">Inversión</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase">Color</label>
                                        <input
                                            type="color"
                                            className="w-full h-12 rounded-xl cursor-pointer"
                                            value={formAccount.color}
                                            onChange={e => setFormAccount({ ...formAccount, color: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Balance Field with Calibrate Option */}
                                <div>
                                    <div className="flex justify-between items-end mb-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase">
                                            {formAccount.type === 'Credit' || formAccount.type === 'Loan' ? 'Deuda Actual' : 'Saldo Actual'}
                                        </label>
                                        {editingId && (
                                            <button
                                                type="button"
                                                onClick={() => setIsCalibrating(true)}
                                                className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg font-bold hover:bg-indigo-100 flex items-center gap-1 transition-colors"
                                            >
                                                <Icons.Settings size={12} /> Calibrar Saldo
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-textPrimary font-bold">$</span>
                                        <input
                                            type="number"
                                            className="w-full bg-gray-50 p-3 pl-8 rounded-xl outline-none focus:ring-2 focus:ring-primary font-bold"
                                            placeholder="0.00"
                                            value={formAccount.balance !== undefined ? formAccount.balance : ''}
                                            onChange={e => setFormAccount({ ...formAccount, balance: parseFloat(e.target.value) })}
                                            disabled={!!editingId} // Disable direct edit if editing, force Calibrate
                                            required
                                        />
                                    </div>
                                    {editingId && <p className="text-[10px] text-gray-400 mt-1 ml-1">Para corregir el saldo, usa "Calibrar"</p>}
                                </div>

                                {formAccount.type === 'Credit' && (
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase">Límite de Crédito</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-textPrimary font-bold">$</span>
                                            <input
                                                type="number"
                                                className="w-full bg-gray-50 p-3 pl-8 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                                placeholder="0.00"
                                                value={formAccount.limit !== undefined ? formAccount.limit : ''}
                                                onChange={e => setFormAccount({ ...formAccount, limit: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                )}

                                {formAccount.type !== 'Cash' && formAccount.type !== 'Loan' && (
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase">Últimos 4 dígitos (Opcional)</label>
                                        <input
                                            type="text"
                                            maxLength={4}
                                            className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary tracking-widest"
                                            placeholder="XXXX"
                                            value={formAccount.lastDigits || ''}
                                            onChange={e => setFormAccount({ ...formAccount, lastDigits: e.target.value.replace(/\D/g, '') })}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Calibration View */}
                            {isCalibrating && editingId && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                                        <h3 className="text-blue-800 font-bold text-sm mb-1 flex items-center gap-2">
                                            <Icons.Settings size={16} /> Ajuste Inteligente
                                        </h3>
                                        <p className="text-xs text-blue-600 leading-relaxed">
                                            Ingresa el saldo real de tu banco. Calcularemos la diferencia y podemos crear un registro automático para que tus cuentas cuadren.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase">Saldo Real en Banco / App</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-textPrimary font-bold">$</span>
                                            <input
                                                type="number"
                                                className="w-full bg-white border-2 border-primary/30 p-3 pl-8 rounded-xl outline-none focus:border-primary font-bold text-xl"
                                                autoFocus
                                                value={calibrationBalance}
                                                onChange={e => setCalibrationBalance(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="bg-gray-50 p-3 rounded-xl">
                                            <span className="block text-gray-500 mb-1">Saldo en App</span>
                                            <span className="font-bold text-gray-700 text-lg">${formAccount.balance}</span>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-xl">
                                            <span className="block text-gray-500 mb-1">Diferencia</span>
                                            <span className={`font-bold text-lg ${getDifference() !== 0 ? 'text-primary' : 'text-gray-400'}`}>
                                                {getDifference() > 0 ? '+' : ''}{getDifference().toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    {Math.abs(getDifference()) > 0 && (
                                        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <input
                                                type="checkbox"
                                                id="record"
                                                checked={recordCalibration}
                                                onChange={e => setRecordCalibration(e.target.checked)}
                                                className="mt-1 w-5 h-5 accent-primary cursor-pointer"
                                            />
                                            <label htmlFor="record" className="text-sm text-textPrimary cursor-pointer select-none">
                                                <span className="font-semibold">Crear movimiento automático</span>
                                                <span className="block text-xs text-gray-500 mt-1">
                                                    Se registrará como "{getDifference() > 0 && (formAccount.type === 'Credit' || formAccount.type === 'Loan') ? 'Gasto (Deuda sube)' : getDifference() < 0 && formAccount.type !== 'Credit' && formAccount.type !== 'Loan' ? 'Gasto (Dinero falta)' : 'Ingreso/Ajuste'}" en categoría Ajuste.
                                                </span>
                                            </label>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setIsCalibrating(false)}
                                        className="text-xs text-gray-400 hover:text-primary w-full text-center py-2"
                                    >
                                        Cancelar calibración
                                    </button>
                                </div>
                            )}

                            <div className="flex flex-col gap-3 pt-2">
                                {!showDeleteConfirm && (
                                    <>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full py-4 rounded-xl bg-primary text-white font-bold hover:bg-purple-600 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg shadow-primary/20"
                                        >
                                            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                            {isCalibrating ? 'Confirmar Ajuste' : (editingId ? 'Guardar Cambios' : 'Crear Cuenta')}
                                        </button>

                                        {editingId && !isCalibrating && (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (!editingId) return;
                                                    setLoading(true);
                                                    try {
                                                        await dbService.setDefaultAccount(editingId);
                                                        await loadAccounts();
                                                        setIsModalOpen(false);
                                                        success("Cuenta establecida como predeterminada");
                                                    } catch (e) {
                                                        error("Error al establecer como predeterminada");
                                                    } finally {
                                                        setLoading(false);
                                                    }
                                                }}
                                                className="w-full py-3 rounded-xl bg-yellow-50 text-yellow-600 font-bold hover:bg-yellow-100 transition-colors flex justify-center items-center gap-2 border border-yellow-200"
                                            >
                                                <Icons.Star size={18} className={formAccount.isDefault ? "fill-yellow-500 text-yellow-500" : ""} />
                                                {formAccount.isDefault ? 'Es tu cuenta predeterminada' : 'Hacer cuenta predeterminada'}
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </form>

                        {/* Delete Section with Custom Confirmation UI */}
                        {!isCalibrating && editingId && !showDeleteConfirm && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={handleDeleteClick}
                                    disabled={loading}
                                    className="w-full py-3 rounded-xl text-red-500 font-semibold hover:bg-red-50 transition-colors flex items-center justify-center gap-2 text-sm"
                                >
                                    <Icons.Trash size={16} />
                                    Eliminar Cuenta
                                </button>
                            </div>
                        )}

                        {/* Inline Confirmation UI */}
                        {showDeleteConfirm && (
                            <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-100 animate-fade-in">
                                <div className="flex items-start gap-3 mb-3">
                                    <Icons.Trash className="text-red-500 shrink-0" size={20} />
                                    <div>
                                        <h4 className="text-red-800 font-bold text-sm mb-1">¿Estás seguro?</h4>
                                        <p className="text-xs text-red-600 leading-relaxed">
                                            Eliminarás esta cuenta permanentemente. Tus gastos asociados NO se borrarán, pero quedarán desvinculados (sin cuenta asignada).
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="flex-1 py-2 bg-white border border-red-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={confirmDelete}
                                        disabled={loading}
                                        className="flex-1 py-2 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 flex items-center justify-center gap-2"
                                    >
                                        {loading ? 'Borrando...' : 'Sí, eliminar'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};