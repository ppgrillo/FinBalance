
import React, { useState } from 'react';
import { User, PeriodType } from '../types';
import { Icons } from '../components/Icons';
import { authService } from '../services/authService';
import { dbService } from '../services/dbService';
import { dataService } from '../services/dataService';
import { useToast } from '../context/ToastContext';

interface Props {
  user: User;
  onLogout: () => void;
  onUpdate: () => Promise<void>;
}

export const Profile: React.FC<Props> = ({ user, onLogout, onUpdate }) => {
  const { success, error, warning } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user.name,
    monthlyLimit: user.monthlyLimit,
    periodType: user.periodType || 'Mensual',
    periodStartDay: user.periodStartDay || 1
  });

  const handleLogout = async () => {
    await authService.signOut();
    onLogout();
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await dbService.updateUserProfile(user.id, {
        periodType: formData.periodType,
        periodStartDay: formData.periodStartDay,
        monthlyLimit: formData.monthlyLimit
      });

      await onUpdate(); // Refresh global user state
      setIsEditing(false);

      if (result.synced) {
        success("Perfil actualizado correctamente.");
      } else {
        warning("✅ Cambios guardados en dispositivo.\n⚠️ No sincronizado con BD: Faltan permisos SQL en Supabase.");
      }

    } catch (e: any) {
      console.error(e);
      error(`Error crítico: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-24 space-y-6">
      <h1 className="text-2xl font-bold">Perfil</h1>

      <div className="bg-white p-6 rounded-3xl shadow-sm flex flex-col items-center relative">
        <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center text-primary mb-4">
          <Icons.Profile size={48} />
        </div>
        <h2 className="text-xl font-bold text-textPrimary">{user.name}</h2>
        <p className="text-textSecondary text-sm">{user.email}</p>

        <button
          onClick={() => setIsEditing(!isEditing)}
          className="absolute top-6 right-6 p-2 bg-gray-50 rounded-full text-primary hover:bg-gray-100"
        >
          <Icons.Edit size={20} />
        </button>
      </div>

      {isEditing ? (
        <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4 animate-fade-in">
          <h3 className="font-bold text-lg mb-2">Editar Configuración</h3>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase">Límite Total por Periodo ($)</label>
            <input
              type="number"
              value={formData.monthlyLimit}
              onChange={e => setFormData({ ...formData, monthlyLimit: parseFloat(e.target.value) })}
              className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary mt-1"
            />
            <p className="text-[10px] text-gray-400 mt-2 leading-tight">
              Este es tu <strong>techo máximo</strong> (tus Ingresos esperados). La app te avisará si la suma de tus Presupuestos individuales excede esta cantidad.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Frecuencia</label>
              <select
                value={formData.periodType}
                onChange={e => setFormData({ ...formData, periodType: e.target.value as PeriodType })}
                className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary mt-1"
              >
                <option value="Semanal">Semanal</option>
                <option value="Quincenal">Quincenal</option>
                <option value="Mensual">Mensual</option>
                <option value="Bimestral">Bimestral</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Día de Inicio</label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.periodStartDay}
                onChange={e => setFormData({ ...formData, periodStartDay: parseInt(e.target.value) })}
                className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary mt-1"
              />
              <p className="text-[10px] text-gray-400 mt-1">Ej. 15 si te pagan el 15.</p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg hover:bg-purple-600 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />}
            Guardar Cambios
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="font-bold text-textPrimary px-2">Configuración Actual</h3>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icons.Settings size={20} className="text-gray-400" />
                <div>
                  <span className="block text-sm font-medium">Ciclo Financiero</span>
                  <span className="text-xs text-gray-400">{user.periodType} (Inicia día {user.periodStartDay})</span>
                </div>
              </div>
            </div>
            <div className="p-4 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icons.Wallet size={20} className="text-gray-400" />
                <div>
                  <span className="block text-sm font-medium">Límite Total de Gasto</span>
                  <span className="text-xs text-gray-400">${user.monthlyLimit.toLocaleString()} / periodo</span>
                </div>
              </div>
            </div>

            {/* Data Management Section */}
            <div className="p-4 border-b border-gray-50">
              <div className="flex items-center gap-3 mb-3">
                <Icons.List size={20} className="text-gray-400" />
                <span className="block text-sm font-medium">Gestión de Datos</span>
              </div>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={async () => {
                    try {
                      setLoading(true);
                      await authService.forceRefreshUserProfile(user.id);
                      await onUpdate();
                      success('Datos sincronizados correctamente');
                    } catch (e: any) {
                      error(`Error al sincronizar: ${e.message}`);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="w-full bg-indigo-50 text-indigo-600 py-3 rounded-xl text-sm font-semibold hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Icons.Cloud size={18} /> Sincronizar Datos (Nube)
                </button>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={async () => {
                      try {
                        setLoading(true);
                        await dataService.exportData();
                        success('Datos exportados correctamente');
                      } catch (e: any) {
                        error(`Error al exportar: ${e.message}`);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="flex-1 bg-green-50 text-green-600 py-2 rounded-xl text-sm font-semibold hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Icons.Stats size={16} /> Exportar Excel
                  </button>
                  <label className="flex-1 bg-blue-50 text-blue-600 py-2 rounded-xl text-sm font-semibold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                    <Icons.Add size={16} /> Importar Excel
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          setLoading(true);
                          const result: any = await dataService.importData(file);
                          success(`✅ Importación completada con éxito:\n\n📄 Movimientos: ${result.expensesAdded}\n🏦 Cuentas nuevas: ${result.accountsCreated}\n🏷️ Categorías nuevas: ${result.categoriesCreated}\n💰 Presupuestos actualizados: ${result.budgetsUpdated}`);
                          onUpdate();
                        } catch (e) {
                          error('Error al importar');
                        } finally {
                          setLoading(false);
                          e.target.value = ''; // Reset input
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

          </div>

          <button
            onClick={handleLogout}
            className="w-full bg-red-50 p-4 rounded-2xl text-red-500 font-semibold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
          >
            <Icons.Logout size={20} />
            Cerrar Sesión
          </button>
        </div>
      )}
      {loading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center animate-in fade-in zoom-in duration-200">
            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
            <p className="font-semibold text-gray-700">Procesando datos...</p>
            <p className="text-xs text-gray-500 mt-1">Por favor espera un momento</p>
          </div>
        </div>
      )}
    </div>
  );
};
