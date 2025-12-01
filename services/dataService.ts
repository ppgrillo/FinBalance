import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient';
import { dbService } from './dbService';
import { Expense, Account, Category, Income, Budget } from '../types';

export const dataService = {
    async exportData() {
        try {
            // 1. Fetch all data
            const { data: expenses } = await supabase.from('expenses').select('*');
            const { data: accounts } = await supabase.from('accounts').select('*');
            const { data: categories } = await supabase.from('categories').select('*');
            const { data: budgets } = await supabase.from('budgets').select('*');

            // 2. Create Workbook
            const wb = XLSX.utils.book_new();

            // 3. Create Sheets
            if (expenses) {
                // Transform for readability (User Friendly Columns)
                const formattedTx = expenses.map(tx => {
                    const account = accounts?.find(a => a.id === tx.account_id);
                    return {
                        Fecha: tx.date ? tx.date.split('T')[0] : '',
                        Tipo: tx.amount < 0 ? 'Ingreso' : 'Gasto',
                        Categoria: tx.category_name,
                        Cuenta: account?.name || 'Desconocida',
                        Descripcion: tx.description,
                        Monto: Math.abs(tx.amount)
                    };
                });
                const wsTx = XLSX.utils.json_to_sheet(formattedTx);
                XLSX.utils.book_append_sheet(wb, wsTx, "Movimientos");
            }

            if (accounts) {
                const formattedAccounts = accounts.map(acc => ({
                    Nombre: acc.name,
                    Tipo: acc.type,
                    Balance: acc.balance,
                    Color: acc.color
                }));
                const wsAccounts = XLSX.utils.json_to_sheet(formattedAccounts);
                XLSX.utils.book_append_sheet(wb, wsAccounts, "Cuentas");
            }

            if (categories) {
                const formattedCategories = categories.map(cat => ({
                    Nombre: cat.name,
                    Tipo: cat.type === 'income' ? 'Ingreso' : 'Gasto',
                    Icono: cat.icon,
                    Color: cat.color
                }));
                const wsCategories = XLSX.utils.json_to_sheet(formattedCategories);
                XLSX.utils.book_append_sheet(wb, wsCategories, "Categorias");
            }

            if (budgets) {
                const formattedBudgets = budgets.map(b => ({
                    Categoria: b.category_name,
                    Limite: b.limit_amount
                }));
                const wsBudgets = XLSX.utils.json_to_sheet(formattedBudgets);
                XLSX.utils.book_append_sheet(wb, wsBudgets, "Presupuestos");
            }

            // 4. Generate File
            XLSX.writeFile(wb, `FinBalance_Backup_${new Date().toISOString().split('T')[0]}.xlsx`);
            return { success: true };
        } catch (error) {
            console.error('Export failed:', error);
            throw error;
        }
    },

    async importData(file: File) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });

                    const results = {
                        expensesAdded: 0, // Renamed to match Profile.tsx expectation
                        accountsCreated: 0,
                        categoriesCreated: 0,
                        budgetsUpdated: 0
                    };

                    // --- 1. Process Accounts ---
                    const accountsSheet = workbook.Sheets["Cuentas"];
                    if (accountsSheet) {
                        const accountsData = XLSX.utils.sheet_to_json(accountsSheet) as any[];
                        for (const acc of accountsData) {
                            const name = acc.Nombre || acc.name;
                            const type = acc.Tipo || acc.type || 'Cash';
                            const balance = acc.Balance || acc.balance || 0;
                            const color = acc.Color || acc.color || '#10B981';

                            const { data: existing } = await supabase
                                .from('accounts')
                                .select('id')
                                .eq('name', name)
                                .maybeSingle(); // Fixed: use maybeSingle

                            if (!existing && name) {
                                await dbService.addAccount({
                                    name,
                                    type: type === 'Efectivo' ? 'Cash' : type,
                                    balance,
                                    color
                                });
                                results.accountsCreated++;
                            }
                        }
                    }

                    // --- 2. Process Categories ---
                    const categoriesSheet = workbook.Sheets["Categorias"];
                    if (categoriesSheet) {
                        const categoriesData = XLSX.utils.sheet_to_json(categoriesSheet) as any[];
                        for (const cat of categoriesData) {
                            const name = cat.Nombre || cat.name;
                            const typeRaw = cat.Tipo || cat.type || 'Gasto';
                            const type = typeRaw === 'Ingreso' ? 'income' : 'expense';
                            const icon = cat.Icono || cat.icon || 'Tag';
                            const color = cat.Color || cat.color || '#6366f1';

                            const { data: existing } = await supabase
                                .from('categories')
                                .select('id')
                                .eq('name', name)
                                .eq('type', type)
                                .maybeSingle(); // Fixed: use maybeSingle

                            if (!existing && name) {
                                await dbService.createCategory(name, icon, color, type);
                                results.categoriesCreated++;
                            }
                        }
                    }

                    // --- 3. Process Budgets ---
                    const budgetsSheet = workbook.Sheets["Presupuestos"];
                    if (budgetsSheet) {
                        const budgetsData = XLSX.utils.sheet_to_json(budgetsSheet) as any[];
                        for (const b of budgetsData) {
                            const categoryName = b.Categoria || b.category_name;
                            const limit = b.Limite || b.limit_amount;

                            if (categoryName && limit) {
                                await dbService.ensureCategoryExists(categoryName, '#A88BEB');

                                const { data: existing } = await supabase
                                    .from('budgets')
                                    .select('*')
                                    .eq('category_name', categoryName)
                                    .maybeSingle(); // Fixed: use maybeSingle

                                if (existing) {
                                    await dbService.updateBudget(categoryName, limit);
                                } else {
                                    await dbService.addBudget(categoryName, limit);
                                }
                                results.budgetsUpdated++;
                            }
                        }
                    }

                    // --- 4. Process Transactions (Movimientos) ---
                    const txSheet = workbook.Sheets["Movimientos"] || workbook.Sheets["Gastos"];
                    if (txSheet) {
                        const txData = XLSX.utils.sheet_to_json(txSheet) as any[];

                        for (const tx of txData) {
                            const date = tx.Fecha || tx.date;
                            const type = tx.Tipo || tx.type;
                            const categoryName = tx.Categoria || tx.category_name || 'Otros';
                            const accountName = tx.Cuenta || tx.account_name;
                            const description = tx.Descripcion || tx.description || 'Importado';
                            const amount = tx.Monto || Math.abs(tx.amount);

                            const isIncome = type === 'Ingreso' || (amount < 0 && !type);
                            const finalAmount = Math.abs(amount);

                            // A. Ensure Category Exists
                            const { data: cat } = await supabase
                                .from('categories')
                                .select('id')
                                .eq('name', categoryName)
                                .maybeSingle(); // Fixed: use maybeSingle

                            if (!cat) {
                                await dbService.createCategory(
                                    categoryName,
                                    'Tag',
                                    isIncome ? '#10B981' : '#EF4444',
                                    isIncome ? 'income' : 'expense'
                                );
                                results.categoriesCreated++;
                            }

                            // B. Ensure Account Exists
                            let accountId = null;
                            if (accountName) {
                                const { data: acc } = await supabase
                                    .from('accounts')
                                    .select('id')
                                    .eq('name', accountName)
                                    .maybeSingle(); // Fixed: use maybeSingle

                                if (acc) {
                                    accountId = acc.id;
                                } else {
                                    const newAcc = await dbService.addAccount({
                                        name: accountName,
                                        type: 'Cash',
                                        balance: 0,
                                        color: '#6B7280'
                                    });
                                    if (newAcc) {
                                        accountId = newAcc.id;
                                        results.accountsCreated++;
                                    }
                                }
                            }

                            // C. Insert Transaction
                            if (accountId && finalAmount) {
                                if (isIncome) {
                                    await dbService.addIncome({
                                        amount: finalAmount,
                                        description: description,
                                        date: date ? new Date(date).toISOString() : new Date().toISOString(),
                                        category: categoryName
                                    }, accountId);
                                } else {
                                    await dbService.addExpense({
                                        amount: finalAmount,
                                        description: description,
                                        date: date ? new Date(date).toISOString() : new Date().toISOString(),
                                        category: categoryName
                                    }, accountId);
                                }
                                results.expensesAdded++; // Updated key
                            }
                        }
                    }

                    resolve(results);

                } catch (error) {
                    console.error("Import parsing error:", error);
                    reject(error);
                }
            };

            reader.readAsArrayBuffer(file);
        });
    }
};
