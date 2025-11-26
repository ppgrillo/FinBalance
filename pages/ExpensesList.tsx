
import React, { useState, useEffect } from 'react';
import { Expense, CategoryType, Account } from '../types';
import { dbService } from '../services/dbService';
import { Icons } from '../components/Icons';
import { useNavigate } from 'react-router-dom';

type ViewMode = 'table' | 'grouped';

interface CategoryItem {
    id?: string;
    name: string;
    user_id?: string; // If null, it's system default
}

export const ExpensesList: React.FC = () => {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Default view
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Expense>>({});
  
  // Categories State
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false); // Inside Edit Modal
  const [newCategoryName, setNewCategoryName] = useState('');

  // Category Manager Modal State
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [managerNewCatName, setManagerNewCatName] = useState('');

  // Delete Confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
      loadData();
  }, []);

  const loadData = async () => {
      setLoading(true);
      try {
          const [expensesData, categoriesData, accountsData] = await Promise.all([
              dbService.getExpenses(),
              dbService.getCategories(),
              dbService.getAccounts()
          ]);
          setExpenses(expensesData);
          setAccounts(accountsData);
          
          // Process categories
          if (categoriesData.length > 0) {
              setCategories(categoriesData);
          } else {
              setCategories(Object.values(CategoryType).map(c => ({ name: c })));
          }

      } catch (error) {
          console.error("Error loading expenses:", error);
      } finally {
          setLoading(false);
      }
  };

  // Helper to identify Loan expenses
  const getLoanInfo = (expense: Expense): Account | undefined => {
      if (!expense.accountId) return undefined;
      const account = accounts.find(a => a.id === expense.accountId);
      // Only return if it is a Loan account
      return (account && account.type === 'Loan') ? account : undefined;
  };

  const handlePayDebt = (account: Account) => {
      navigate(`/add?type=transfer&dest=${account.id}&amount=${account.balance}`);
  };

  const availableCategoriesNames = categories.map(c => c.name);

  // Derived State for Expenses List
  const filteredExpenses = expenses.filter(e => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = e.description.toLowerCase().includes(term) || e.category.toLowerCase().includes(term);
      const matchesCat = filterCategory === 'All' || e.category === filterCategory;
      return matchesSearch && matchesCat;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Grouped Data
  const groupedExpenses = filteredExpenses.reduce((acc, curr) => {
      if (!acc[curr.category]) acc[curr.category] = [];
      acc[curr.category].push(curr);
      return acc;
  }, {} as Record<string, Expense[]>);

  // Handlers
  const requestDelete = (id: string) => {
      setShowDeleteConfirm(id);
  };

  const confirmDelete = async () => {
      if (!showDeleteConfirm) return;
      try {
          await dbService.deleteExpense(showDeleteConfirm);
          setExpenses(prev => prev.filter(e => e.id !== showDeleteConfirm));
      } catch (e) {
          alert("Error al eliminar el gasto");
      } finally {
          setShowDeleteConfirm(null);
      }
  };

  const startEdit = (expense: Expense) => {
      setEditingId(expense.id);
      setEditForm(expense);
      setIsCreatingCategory(false);
      setNewCategoryName('');
  };

  const saveEdit = async () => {
      if (!editingId) return;
      try {
          let finalCategory = editForm.category;

          if (isCreatingCategory && newCategoryName.trim()) {
              await dbService.createCategory(newCategoryName.trim());
              finalCategory = newCategoryName.trim();
              const refreshedCats = await dbService.getCategories();
              setCategories(refreshedCats);
          }

          const updatedExpense = { ...editForm, category: finalCategory };

          await dbService.updateExpense(editingId, updatedExpense);
          setExpenses(prev => prev.map(e => e.id === editingId ? { ...e, ...updatedExpense } as Expense : e));
          
          setEditingId(null);
          setIsCreatingCategory(false);
      } catch (e) {
          alert("Error al guardar los cambios");
      }
  };

  const handleAddCategoryInManager = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!managerNewCatName.trim()) return;
      try {
          await dbService.createCategory(managerNewCatName.trim());
          setManagerNewCatName('');
          const refreshedCats = await dbService.getCategories();
          setCategories(refreshedCats);
      } catch (e) {
          alert("Error al crear categoría");
      }
  };

  const handleDeleteCategory = async (id: string) => {
      if (window.confirm("¿Borrar categoría?")) {
          try {
              await dbService.deleteCategory(id);
              const refreshedCats = await dbService.getCategories();
              setCategories(refreshedCats);
          } catch (e) {
              alert("Error al borrar categoría");
          }
      }
  };

  const renderAmount = (amount: number) => {
      const isIncome = amount < 0;
      const displayAmount = Math.abs(amount).toLocaleString();
      return (
          <span className={`font-bold ${isIncome ? 'text-green-500' : 'text-red-400'} shrink-0`}>
              {isIncome ? '+' : '-'}${displayAmount}
          </span>
      );
  };

  if (loading && expenses.length === 0) {
      return <div className="p-10 text-center text-gray-400">Cargando movimientos...</div>;
  }

  return (
    <div className="space-y-6 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h1 className="text-2xl font-bold">Movimientos</h1>
            
            <div className="flex gap-2 self-start">
                <button 
                    onClick={() => setShowCategoryManager(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-textSecondary hover:text-primary hover:border-primary transition-colors shadow-sm text-sm font-medium"
                >
                    <Icons.List size={18} />
                    Categorías
                </button>
                <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                    <button 
                        onClick={() => setViewMode('grouped')}
                        className={`p-2 rounded-lg transition-colors ${viewMode === 'grouped' ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                        <Icons.List size={20} />
                    </button>
                    <button 
                        onClick={() => setViewMode('table')}
                        className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                        <Icons.Grid size={20} />
                    </button>
                </div>
            </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm">
            <div className="flex-1 relative">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Buscar gasto o categoría..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 p-2 bg-gray-50 rounded-lg outline-none focus:ring-2 focus:ring-primary/50"
                />
            </div>
            <div className="relative min-w-[150px]">
                 <Icons.Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                 <select 
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full pl-10 p-2 bg-gray-50 rounded-lg outline-none appearance-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                 >
                     <option value="All">Todas</option>
                     {availableCategoriesNames.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
            </div>
        </div>

        {viewMode === 'grouped' ? (
            <div className="space-y-6">
                {Object.entries(groupedExpenses).map(([cat, list]: [string, Expense[]]) => {
                    const total = list.reduce((sum, item) => sum + item.amount, 0);
                    
                    return (
                    <div key={cat} className="bg-white rounded-3xl shadow-sm overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-primary">{cat}</h3>
                            <span className={`text-xs font-bold bg-white px-2 py-1 rounded-lg ${total < 0 ? 'text-green-600' : 'text-textSecondary'}`}>
                                {total < 0 ? '+' : ''}${Math.abs(total).toLocaleString()}
                            </span>
                        </div>
                        <div>
                            {list.map((exp, i) => {
                                const loanAccount = getLoanInfo(exp);
                                return (
                                <div key={exp.id} className={`p-4 flex justify-between items-center hover:bg-gray-50 transition-colors ${i !== list.length-1 ? 'border-b border-gray-50' : ''}`}>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-sm">{exp.description}</p>
                                            {loanAccount && (
                                                <span className="text-[9px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">
                                                    Deuda: {loanAccount.name}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400">{new Date(exp.date).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {renderAmount(exp.amount)}
                                        <div className="flex gap-2 items-center">
                                            {loanAccount && loanAccount.balance > 0.1 && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handlePayDebt(loanAccount); }}
                                                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-md transition-colors mr-2 flex items-center gap-1"
                                                >
                                                    <Icons.CreditCard size={12} /> Pagar Deuda
                                                </button>
                                            )}
                                            <button onClick={() => startEdit(exp)} className="text-gray-300 hover:text-primary"><Icons.Edit size={16} /></button>
                                            <button onClick={() => requestDelete(exp.id)} className="text-gray-300 hover:text-red-500"><Icons.Trash size={16} /></button>
                                        </div>
                                    </div>
                                </div>
                            )})}
                        </div>
                    </div>
                )})}
                {Object.keys(groupedExpenses).length === 0 && (
                    <div className="text-center text-gray-400 py-10">No se encontraron gastos.</div>
                )}
            </div>
        ) : (
            <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-textSecondary font-semibold border-b border-gray-100">
                            <tr>
                                <th className="p-4">Fecha</th>
                                <th className="p-4">Descripción</th>
                                <th className="p-4">Categoría</th>
                                <th className="p-4 text-right">Monto</th>
                                <th className="p-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredExpenses.map(exp => {
                                const loanAccount = getLoanInfo(exp);
                                return (
                                <tr key={exp.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                    <td className="p-4 whitespace-nowrap">{new Date(exp.date).toLocaleDateString()}</td>
                                    <td className="p-4">
                                        {exp.description}
                                        {loanAccount && (
                                            <span className="ml-2 text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">Deuda</span>
                                        )}
                                    </td>
                                    <td className="p-4"><span className="bg-gray-100 px-2 py-1 rounded text-xs">{exp.category}</span></td>
                                    <td className="p-4 text-right">
                                        {renderAmount(exp.amount)}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex justify-center gap-2 items-center">
                                            {loanAccount && loanAccount.balance > 0.1 && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handlePayDebt(loanAccount); }}
                                                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-md transition-colors mr-2 flex items-center gap-1"
                                                    title="Pagar Deuda"
                                                >
                                                    <Icons.CreditCard size={14} /> Pagar
                                                </button>
                                            )}
                                            <button onClick={() => startEdit(exp)} className="p-1 hover:text-primary text-gray-400"><Icons.Edit size={16} /></button>
                                            <button onClick={() => requestDelete(exp.id)} className="p-1 hover:text-red-500 text-gray-400"><Icons.Trash size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* Category Manager Modal */}
        {showCategoryManager && (
            <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-fade-in max-h-[85vh] flex flex-col">
                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <h2 className="text-xl font-bold">Administrar Categorías</h2>
                        <button onClick={() => setShowCategoryManager(false)} className="text-gray-400 hover:text-gray-600">
                            <Icons.Close size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleAddCategoryInManager} className="flex gap-2 mb-6 shrink-0">
                        <input 
                            type="text"
                            placeholder="Nueva categoría..."
                            className="flex-1 bg-gray-50 border border-transparent focus:bg-white focus:border-primary px-4 py-2 rounded-xl outline-none transition-all"
                            value={managerNewCatName}
                            onChange={(e) => setManagerNewCatName(e.target.value)}
                        />
                        <button 
                            type="submit" 
                            disabled={!managerNewCatName.trim()}
                            className="bg-primary text-white px-4 py-2 rounded-xl font-bold hover:bg-purple-600 disabled:opacity-50 shadow-md shadow-primary/20"
                        >
                            <Icons.Add size={20} />
                        </button>
                    </form>

                    <div className="overflow-y-auto custom-scrollbar pr-2 space-y-2 flex-1">
                        {categories.map((cat, i) => (
                            <div key={cat.id || i} className="flex justify-between items-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cat.user_id ? 'bg-white text-primary shadow-sm' : 'bg-gray-200 text-gray-400'}`}>
                                        {cat.user_id ? <Icons.Text size={14} /> : <Icons.Bank size={14} />}
                                    </div>
                                    <span className="font-medium text-textPrimary">{cat.name}</span>
                                </div>
                                
                                {cat.user_id ? (
                                    <button 
                                        onClick={() => cat.id && handleDeleteCategory(cat.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar categoría personalizada"
                                    >
                                        <Icons.Trash size={16} />
                                    </button>
                                ) : (
                                    <div className="p-2 text-gray-300" title="Categoría del sistema (no se puede borrar)">
                                        <span className="text-xs font-bold">Sistema</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl animate-fade-in">
                    <h3 className="text-lg font-bold text-textPrimary mb-2">¿Eliminar Gasto?</h3>
                    <p className="text-sm text-textSecondary mb-6">Esta acción no se puede deshacer.</p>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowDeleteConfirm(null)} 
                            className="flex-1 py-2 rounded-lg font-semibold text-gray-500 hover:bg-gray-50"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmDelete} 
                            className="flex-1 py-2 rounded-lg font-semibold bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20"
                        >
                            Eliminar
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Edit Modal */}
        {editingId && (
            <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Editar Gasto</h2>
                        <button onClick={() => setEditingId(null)} className="text-gray-400"><Icons.Close size={20} /></button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Fecha</label>
                            <input 
                                type="date"
                                className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                value={editForm.date ? new Date(editForm.date).toISOString().split('T')[0] : ''}
                                onChange={e => setEditForm({...editForm, date: new Date(e.target.value).toISOString()})}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Descripción</label>
                            <input 
                                className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                value={editForm.description}
                                onChange={e => setEditForm({...editForm, description: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Monto</label>
                            <input 
                                type="number"
                                className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                value={editForm.amount}
                                onChange={e => setEditForm({...editForm, amount: parseFloat(e.target.value)})}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Categoría</label>
                            {!isCreatingCategory ? (
                                <select 
                                    className="w-full bg-gray-50 p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                    value={editForm.category}
                                    onChange={e => {
                                        if (e.target.value === 'NEW_CATEGORY') {
                                            setIsCreatingCategory(true);
                                        } else {
                                            setEditForm({...editForm, category: e.target.value});
                                        }
                                    }}
                                >
                                    {availableCategoriesNames.map(c => <option key={c} value={c}>{c}</option>)}
                                    <option value="NEW_CATEGORY" className="font-bold text-primary">+ Nueva Categoría...</option>
                                </select>
                            ) : (
                                <div className="flex gap-2 animate-fade-in">
                                    <input 
                                        type="text"
                                        placeholder="Nombre de nueva categoría"
                                        className="flex-1 bg-white border-2 border-primary/30 p-3 rounded-xl outline-none focus:border-primary"
                                        autoFocus
                                        value={newCategoryName}
                                        onChange={e => setNewCategoryName(e.target.value)}
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setIsCreatingCategory(false)}
                                        className="p-3 bg-gray-100 rounded-xl text-gray-500 hover:bg-gray-200"
                                    >
                                        <Icons.Close size={20} />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setEditingId(null)} className="flex-1 py-3 rounded-xl text-gray-500 hover:bg-gray-100">Cancelar</button>
                            <button onClick={saveEdit} className="flex-1 py-3 rounded-xl bg-primary text-white hover:bg-purple-600 shadow-lg shadow-primary/20">
                                {isCreatingCategory ? 'Guardar Todo' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
