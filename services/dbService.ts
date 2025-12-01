import { supabase } from '../lib/supabaseClient';
import { Account, Expense, FinancialGoal, Expense as AppExpense, User, PeriodType, RecurringItem } from '../types';

// Helper to transform DB snake_case to App camelCase
const mapExpense = (row: any): AppExpense => ({
  id: row.id,
  amount: row.amount,
  category: row.category_name || 'Otros',
  description: row.description,
  date: row.date,
  isFixed: row.is_fixed,
  accountId: row.account_id
});

const mapAccount = (row: any): Account => ({
  id: row.id,
  name: row.name,
  type: row.type,
  balance: Number(row.balance),
  limit: row.credit_limit ? Number(row.credit_limit) : undefined,
  color: row.color,
  lastDigits: row.last_digits,
  isDefault: row.is_default
});

const mapGoal = (row: any): FinancialGoal => {
  // Calculate dynamic monthly contribution
  let calculatedContribution = 0;
  if (row.deadline && row.target_amount > row.current_amount) {
    const now = new Date();
    const deadlineDate = new Date(row.deadline);
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const months = Math.max(0.5, diffDays / 30); // Prevent divide by zero or negative months

    if (diffDays > 0) {
      calculatedContribution = Math.ceil((row.target_amount - row.current_amount) / months);
    } else {
      calculatedContribution = row.target_amount - row.current_amount;
    }
  }

  return {
    id: row.id,
    name: row.name,
    targetAmount: row.target_amount,
    currentAmount: row.current_amount,
    deadline: row.deadline,
    aiPlan: row.ai_plan,
    monthlyContribution: Math.max(0, calculatedContribution),
    color: row.color || '#A88BEB'
  };
};

const mapRecurring = (row: any): RecurringItem => ({
  id: row.id,
  name: row.name,
  amount: Number(row.amount),
  category: row.category_name,
  frequency: row.frequency,
  nextDate: row.next_date,
  isVariable: row.is_variable
});

export const dbService = {

  // --- USER PROFILE & CONFIG ---
  updateUserProfile: async (userId: string, updates: Partial<User>): Promise<{ success: boolean; synced: boolean }> => {
    try {
      const dbUpdates: any = {};
      if (updates.monthlyLimit !== undefined) dbUpdates.monthly_limit = updates.monthlyLimit;
      if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
      if (updates.periodType !== undefined) dbUpdates.period_type = updates.periodType;
      if (updates.periodStartDay !== undefined) dbUpdates.period_start_day = updates.periodStartDay;

      // 1. Save Local
      const currentLocal = JSON.parse(localStorage.getItem('user_settings') || '{}');
      const newLocal = { ...currentLocal, ...updates };
      localStorage.setItem('user_settings', JSON.stringify(newLocal));

      // 2. Sync DB
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          ...dbUpdates,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (error) {
        if (error.code === '42501') {
          return { success: true, synced: false };
        }
        throw error;
      }

      // 3. Verify
      const { data: verifyData, error: verifyError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (verifyError || !verifyData) return { success: true, synced: false };

      if (updates.monthlyLimit !== undefined && Number(verifyData.monthly_limit) !== Number(updates.monthlyLimit)) {
        return { success: true, synced: false };
      }

      return { success: true, synced: true };

    } catch (e: any) {
      console.error("Error in updateUserProfile:", e);
      return { success: true, synced: false };
    }
  },

  // --- PERIOD CALCULATOR ---
  calculatePeriodRange: (user: User): { start: Date, end: Date, label: string, daysLeft: number } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDay = typeof user.periodStartDay === 'number' ? user.periodStartDay : parseInt(String(user.periodStartDay)) || 1;
    let start = new Date(today);
    let end = new Date(today);
    let label = "";

    const setSafeDate = (date: Date, year: number, month: number, day: number) => {
      const maxDays = new Date(year, month + 1, 0).getDate();
      date.setFullYear(year, month, Math.min(day, maxDays));
      date.setHours(0, 0, 0, 0);
    };

    if (user.periodType === 'Quincenal') {
      if (today.getDate() <= 15) {
        setSafeDate(start, today.getFullYear(), today.getMonth(), 1);
        setSafeDate(end, today.getFullYear(), today.getMonth(), 15);
        label = `1ª Quincena ${today.toLocaleDateString('es-MX', { month: 'long' })}`;
      } else {
        setSafeDate(start, today.getFullYear(), today.getMonth(), 16);
        setSafeDate(end, today.getFullYear(), today.getMonth() + 1, 0);
        label = `2ª Quincena ${today.toLocaleDateString('es-MX', { month: 'long' })}`;
      }
    } else if (user.periodType === 'Semanal') {
      const currentDay = today.getDay() || 7;
      const diff = currentDay - 1;
      start.setDate(today.getDate() - diff);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      label = `Semana ${start.getDate()} - ${end.getDate()} ${today.toLocaleDateString('es-MX', { month: 'short' })}`;
    } else if (user.periodType === 'Bimestral') {
      const currentMonth = today.getMonth();
      const startMonth = currentMonth % 2 === 0 ? currentMonth : currentMonth - 1;
      setSafeDate(start, today.getFullYear(), startMonth, startDay);
      end = new Date(start);
      end.setMonth(end.getMonth() + 2);
      end.setDate(end.getDate() - 1);
      label = `Bimestre ${start.toLocaleDateString('es-MX', { month: 'short' })} - ${end.toLocaleDateString('es-MX', { month: 'short' })}`;
    } else {
      // Mensual
      let targetMonth = today.getMonth();
      let targetYear = today.getFullYear();

      if (today.getDate() < startDay) {
        targetMonth = targetMonth - 1;
        if (targetMonth < 0) {
          targetMonth = 11;
          targetYear--;
        }
      }

      setSafeDate(start, targetYear, targetMonth, startDay);
      end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      end.setDate(end.getDate() - 1);

      label = `${start.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`;
    }

    end.setHours(23, 59, 59, 999);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return { start, end, label, daysLeft: Math.max(0, daysLeft) };
  },

  isDateInPeriod: (expenseDateIso: string, start: Date, end: Date): boolean => {
    const txDate = new Date(expenseDateIso);
    const tx = new Date(txDate); tx.setHours(0, 0, 0, 0);
    const s = new Date(start); s.setHours(0, 0, 0, 0);
    const e = new Date(end); e.setHours(23, 59, 59, 999);
    return tx.getTime() >= s.getTime() && tx.getTime() <= e.getTime();
  },

  moveSurplusToSavings: async (amount: number, fromAccountId: string, toGoalId?: string, toAccountId?: string) => {
    await dbService.updateBalance(fromAccountId, amount, 'subtract');
    const date = new Date().toISOString();

    if (toGoalId) {
      const { data: goal } = await supabase.from('goals').select('*').eq('id', toGoalId).single();
      if (goal) {
        await supabase.from('goals').update({ current_amount: goal.current_amount + amount }).eq('id', toGoalId);
        await dbService.addExpense({
          amount: amount,
          category: 'Ahorro', // Fixed: passed as property of object
          description: `Ahorro inteligente: ${goal.name}`,
          date: date,
          isFixed: false
        }, fromAccountId);
      }
    } else if (toAccountId) {
      await dbService.updateBalance(toAccountId, amount, 'add');
      await dbService.transferFunds(amount, fromAccountId, toAccountId, date);
    }
  },

  /**
   * Get all categories
   */
  getCategories: async (): Promise<{ id: string, name: string, type: string, color?: string }[]> => {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, type, color')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new category
   */
  createCategory: async (name: string, icon: string = 'Tag', color: string = '#6366f1', type: 'expense' | 'income' = 'expense'): Promise<any> => {
    // Check if exists
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .ilike('name', name)
      .eq('type', type)
      .maybeSingle(); // Fixed: use maybeSingle to avoid 406

    if (existing) return existing;

    const { data, error } = await supabase
      .from('categories')
      .insert([{
        name,
        type,
        color,
        icon,
        user_id: (await supabase.auth.getUser()).data.user?.id
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateCategory: async (id: string, updates: { color?: string, name?: string, type?: 'expense' | 'income' }) => {
    try {
      const { error } = await supabase.from('categories').update(updates).eq('id', id);
      if (error) throw error;
    } catch (error) { throw error; }
  },

  getExpensesByCategory: async (categoryName: string, limit: number = 5) => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('category_name', categoryName)
        .order('date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data ? data.map(mapExpense) : [];
    } catch (error) { return []; }
  },

  ensureCategoryExists: async (name: string, color: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: existing } = await supabase
        .from('categories')
        .select('*')
        .eq('name', name)
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .maybeSingle();

      if (existing) {
        if (existing.user_id === user.id) {
          await dbService.updateCategory(existing.id, { color });
        } else {
          const { data: shadow } = await supabase.from('categories').select('*').eq('name', name).eq('user_id', user.id).maybeSingle();
          if (shadow) await dbService.updateCategory(shadow.id, { color });
          else await dbService.createCategory(name, 'Tag', color, 'expense');
        }
      } else {
        await dbService.createCategory(name, 'Tag', color, 'expense');
      }
    } catch (e) { console.error("Error ensuring category", e); }
  },

  deleteCategory: async (id: string) => {
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    } catch (error) { throw error; }
  },

  getExpenses: async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return data ? data.map(mapExpense) : [];
    } catch (error) { return []; }
  },

  executeAIQuery: async (filters: { startDate?: string, endDate?: string, category?: string }) => {
    try {
      let query = supabase
        .from('expenses')
        .select('date, amount, category_name, description')
        .order('date', { ascending: true });

      if (filters.startDate) {
        query = query.gte('date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('date', filters.endDate);
      }
      if (filters.category) {
        query = query.ilike('category_name', `%${filters.category}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error("AI Query Error", e);
      return [];
    }
  },

  addExpense: async (expense: Partial<AppExpense>, accountId?: string) => {
    try {
      const userResponse = await supabase.auth.getUser();
      const user = userResponse.data.user;
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase.from('expenses').insert({
        user_id: user.id,
        amount: expense.amount,
        description: expense.description,
        category_name: expense.category, // Correct mapping
        date: expense.date,
        account_id: accountId,
        is_fixed: expense.isFixed || false
      }).select().single();

      if (error) throw error;
      if (accountId) await dbService.updateBalance(accountId, expense.amount!, 'subtract');

      return data;
    } catch (error) { throw error; }
  },

  addIncome: async (income: Partial<AppExpense>, accountId: string) => {
    try {
      const userResponse = await supabase.auth.getUser();
      const user = userResponse.data.user;
      if (!user) throw new Error('No authenticated user');

      const dbAmount = -Math.abs(income.amount || 0);
      const { error } = await supabase.from('expenses').insert({
        user_id: user.id,
        amount: dbAmount,
        description: income.description,
        category_name: income.category || 'Ingreso',
        date: income.date,
        account_id: accountId,
        is_fixed: false
      });

      if (error) throw error;
      await dbService.updateBalance(accountId, Math.abs(income.amount || 0), 'add');
    } catch (error) { throw error; }
  },

  transferFunds: async (amount: number, fromAccountId: string, toAccountId: string, date: string) => {
    try {
      const userResponse = await supabase.auth.getUser();
      const user = userResponse.data.user;
      if (!user) throw new Error('No authenticated user');

      await dbService.updateBalance(fromAccountId, amount, 'subtract');
      await dbService.updateBalance(toAccountId, amount, 'add');

      const { data: fromAcc } = await supabase.from('accounts').select('name').eq('id', fromAccountId).single();
      const { data: toAcc } = await supabase.from('accounts').select('name').eq('id', toAccountId).single();

      await supabase.from('expenses').insert({
        user_id: user.id,
        amount: 0,
        description: `Transferencia: $${amount} de ${fromAcc?.name} a ${toAcc?.name}`,
        category_name: 'Transferencia',
        date: date,
        is_fixed: false
      });
    } catch (error) { throw error; }
  },

  updateExpense: async (id: string, expense: Partial<AppExpense>) => {
    try {
      const updateData: any = {};
      if (expense.amount !== undefined) updateData.amount = expense.amount;
      if (expense.description !== undefined) updateData.description = expense.description;
      if (expense.category !== undefined) updateData.category_name = expense.category;
      if (expense.date !== undefined) updateData.date = expense.date;
      if (expense.isFixed !== undefined) updateData.is_fixed = expense.isFixed;

      // Handle Account Change
      if (expense.accountId) {
        // 1. Get current expense to find old account
        const { data: currentExp } = await supabase.from('expenses').select('account_id, amount').eq('id', id).single();

        if (currentExp && currentExp.account_id !== expense.accountId) {
          // 2. Revert old account (Add back if it was an expense)
          // Note: expenses are stored as positive amounts usually, but let's be safe. 
          // If it was an expense (positive amount in DB context usually implies spending), we add it back.
          // Wait, addExpense subtracts. So here we ADD back to refund.
          await dbService.updateBalance(currentExp.account_id, Number(currentExp.amount), 'add');

          // 3. Apply to new account (Subtract)
          // We use the NEW amount if provided, otherwise the OLD amount
          const amountToDeduct = expense.amount !== undefined ? expense.amount : Number(currentExp.amount);
          await dbService.updateBalance(expense.accountId, amountToDeduct, 'subtract');

          updateData.account_id = expense.accountId;
        } else if (currentExp && currentExp.account_id === expense.accountId && expense.amount !== undefined) {
          // Same account, but amount changed. Adjust difference.
          const oldAmount = Number(currentExp.amount);
          const newAmount = expense.amount;
          const diff = newAmount - oldAmount;
          // If new is higher (e.g. 100 -> 150), diff is 50. We need to subtract 50 more.
          // If new is lower (e.g. 100 -> 80), diff is -20. We need to add 20 back.
          if (diff > 0) {
            await dbService.updateBalance(expense.accountId, diff, 'subtract');
          } else {
            await dbService.updateBalance(expense.accountId, Math.abs(diff), 'add');
          }
        }
      } else if (expense.amount !== undefined) {
        // Account didn't change, but amount did. We need the account ID to adjust.
        const { data: currentExp } = await supabase.from('expenses').select('account_id, amount').eq('id', id).single();
        if (currentExp && currentExp.account_id) {
          const oldAmount = Number(currentExp.amount);
          const newAmount = expense.amount;
          const diff = newAmount - oldAmount;
          if (diff > 0) {
            await dbService.updateBalance(currentExp.account_id, diff, 'subtract');
          } else {
            await dbService.updateBalance(currentExp.account_id, Math.abs(diff), 'add');
          }
        }
      }

      const { error } = await supabase.from('expenses').update(updateData).eq('id', id);
      if (error) throw error;
    } catch (error) { throw error; }
  },

  deleteExpense: async (id: string) => {
    try {
      // 1. Get expense details before deleting
      const { data: expense } = await supabase.from('expenses').select('*').eq('id', id).single();

      if (expense) {
        // 2. Handle Transfers
        if (expense.category_name === 'Transferencia') {
          // Parse description: "Transferencia: $500 de Ahorro a Efectivo"
          const match = expense.description.match(/Transferencia: \$(\d+(\.\d+)?) de (.+) a (.+)/);
          if (match) {
            const amount = Number(match[1]);
            const fromName = match[3];
            const toName = match[4];

            // Find accounts by name
            const { data: accounts } = await supabase.from('accounts').select('id, name');
            const fromAccount = accounts?.find(a => a.name === fromName);
            const toAccount = accounts?.find(a => a.name === toName);

            if (fromAccount && toAccount) {
              // Revert transfer: Add back to Source, Subtract from Dest
              await dbService.updateBalance(fromAccount.id, amount, 'add');
              await dbService.updateBalance(toAccount.id, amount, 'subtract');
            }
          }
        }
        // 3. Handle Regular Expenses/Income
        else if (expense.account_id) {
          const amount = Number(expense.amount);
          // If amount > 0 (Expense), we ADD it back to refund.
          // If amount < 0 (Income), we SUBTRACT it to remove the income.
          if (amount > 0) {
            await dbService.updateBalance(expense.account_id, amount, 'add');
          } else {
            await dbService.updateBalance(expense.account_id, Math.abs(amount), 'subtract');
          }
        }
      }

      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    } catch (error) { throw error; }
  },

  getAccounts: async () => {
    try {
      const { data, error } = await supabase.from('accounts').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data ? data.map(mapAccount) : [];
    } catch (error) { return []; }
  },

  addAccount: async (account: Partial<Account>): Promise<Account | null> => {
    try {
      const userResponse = await supabase.auth.getUser();
      const user = userResponse.data.user;
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase.from('accounts').insert({
        user_id: user.id,
        name: account.name,
        type: account.type,
        balance: account.balance,
        credit_limit: account.limit || null,
        color: account.color,
        last_digits: account.lastDigits || null
      }).select().single();

      if (error) {
        if (error.message?.includes('invalid input value for enum') || error.code === '22P02') {
          throw new Error("⚠️ ERROR DE BASE DE DATOS: Necesitas actualizar los tipos de cuenta en Supabase. Ejecuta: ALTER TYPE account_type ADD VALUE 'Loan';");
        }
        throw error;
      }
      return data ? mapAccount(data) : null;
    } catch (error: any) {
      console.error("Error adding account:", error);
      if (error.message && error.message.includes("ALTER TYPE")) {
        throw error;
      }
      return null;
    }
  },

  updateAccount: async (id: string, account: Partial<Account>) => {
    try {
      const updateData: any = {
        name: account.name,
        type: account.type,
        balance: account.balance,
        color: account.color,
        credit_limit: account.limit || null,
        last_digits: account.lastDigits || null
      };
      Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
      const { error } = await supabase.from('accounts').update(updateData).eq('id', id);
      if (error) throw error;
    } catch (error) { throw error; }
  },

  setDefaultAccount: async (accountId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // 1. Reset all to false
      await supabase.from('accounts').update({ is_default: false }).eq('user_id', user.id);

      // 2. Set target to true
      const { error } = await supabase.from('accounts').update({ is_default: true }).eq('id', accountId);
      if (error) throw error;
    } catch (error) { throw error; }
  },

  calibrateAccount: async (accountId: string, newBalance: number, recordTransaction: boolean) => {
    try {
      const { data: acc } = await supabase.from('accounts').select('*').eq('id', accountId).single();
      if (!acc) throw new Error("Cuenta no encontrada");

      const oldBalance = Number(acc.balance);
      let diff = 0;
      let isExpense = false;

      if (acc.type === 'Credit' || acc.type === 'Loan') {
        diff = newBalance - oldBalance;
        isExpense = diff > 0;
      } else {
        diff = oldBalance - newBalance;
        isExpense = diff > 0;
      }

      await supabase.from('accounts').update({ balance: newBalance }).eq('id', accountId);

      if (recordTransaction && Math.abs(diff) > 0.01) {
        const userResponse = await supabase.auth.getUser();
        const user = userResponse.data.user;
        if (user) {
          await supabase.from('expenses').insert({
            user_id: user.id,
            amount: isExpense ? Math.abs(diff) : -Math.abs(diff),
            description: isExpense ? 'Ajuste (Faltante/Gasto/Más Deuda)' : 'Ajuste (Sobrante/Ingreso/Menos Deuda)',
            category_name: 'Ajuste de Saldo',
            date: new Date().toISOString(),
            account_id: accountId,
            is_fixed: false
          });
        }
      }
    } catch (error) { throw error; }
  },

  deleteAccount: async (id: string) => {
    try {
      await supabase.from('expenses').update({ account_id: null }).eq('account_id', id);
      const { error } = await supabase.from('accounts').delete().eq('id', id);
      if (error) throw error;
    } catch (error: any) { throw error; }
  },

  updateBalance: async (accountId: string, amount: number, operation: 'add' | 'subtract') => {
    try {
      const { data: acc } = await supabase.from('accounts').select('balance, type').eq('id', accountId).single();
      if (!acc) return;

      let newBalance = Number(acc.balance);
      if (acc.type === 'Credit' || acc.type === 'Loan') {
        if (operation === 'subtract') newBalance += amount;
        else newBalance -= amount;
      } else {
        if (operation === 'subtract') newBalance -= amount;
        else newBalance += amount;
      }
      await supabase.from('accounts').update({ balance: newBalance }).eq('id', accountId);
    } catch (error) { console.error("DB Error (updateBalance):", error); }
  },

  getGoals: async () => {
    try {
      const { data, error } = await supabase.from('goals').select('*');
      if (error) throw error;
      return data ? data.map(mapGoal) : [];
    } catch (error) { return []; }
  },

  addGoal: async (goal: Partial<FinancialGoal>) => {
    try {
      const userResponse = await supabase.auth.getUser();
      const user = userResponse.data.user;
      if (!user) throw new Error('No authenticated user');

      const { error } = await supabase.from('goals').insert({
        user_id: user.id,
        name: goal.name,
        target_amount: goal.targetAmount,
        current_amount: goal.currentAmount || 0,
        deadline: goal.deadline,
        ai_plan: goal.aiPlan,
        color: goal.color || '#A88BEB'
      });
      if (error) throw error;
    } catch (error) { throw error; }
  },

  updateGoal: async (id: string, updates: Partial<FinancialGoal>) => {
    try {
      const dbUpdates: any = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.targetAmount) dbUpdates.target_amount = updates.targetAmount;
      if (updates.currentAmount !== undefined) dbUpdates.current_amount = updates.currentAmount;
      if (updates.deadline) dbUpdates.deadline = updates.deadline;
      if (updates.aiPlan) dbUpdates.ai_plan = updates.aiPlan;
      if (updates.color) dbUpdates.color = updates.color;

      const { error } = await supabase.from('goals').update(dbUpdates).eq('id', id);
      if (error) throw error;
    } catch (error) { throw error; }
  },

  contributeToGoal: async (goalId: string, amount: number, fromAccountId: string) => {
    try {
      const userResponse = await supabase.auth.getUser();
      const user = userResponse.data.user;
      if (!user) throw new Error('No authenticated user');

      const { data: goal } = await supabase.from('goals').select('*').eq('id', goalId).single();
      if (!goal) throw new Error("Meta no encontrada");

      await dbService.updateBalance(fromAccountId, amount, 'subtract');

      const newAmount = Number(goal.current_amount) + amount;
      await supabase.from('goals').update({ current_amount: newAmount }).eq('id', goalId);

      await supabase.from('expenses').insert({
        user_id: user.id,
        amount: amount,
        description: `Abono a meta: ${goal.name}`,
        category_name: 'Ahorro',
        date: new Date().toISOString(),
        account_id: fromAccountId,
        is_fixed: false
      });

    } catch (error) {
      console.error("Error contributing to goal", error);
      throw error;
    }
  },

  deleteGoal: async (id: string) => {
    try {
      const { error } = await supabase.from('goals').delete().eq('id', id);
      if (error) throw error;
    } catch (error) { throw error; }
  },

  getBudgets: async () => {
    try {
      const { data, error } = await supabase.from('budgets').select('*');
      if (error) throw error;
      const [categories] = await Promise.all([dbService.getCategories()]);
      return data ? data.map((b: any) => {
        const catInfo = categories.find(c => c.name === b.category_name);
        return {
          category: b.category_name,
          limit: b.limit_amount,
          spent: 0,
          color: catInfo?.color || '#A88BEB'
        };
      }) : [];
    } catch (error) { return []; }
  },

  addBudget: async (category: string, limit: number, color?: string) => {
    try {
      const userResponse = await supabase.auth.getUser();
      const user = userResponse.data.user;
      if (!user) throw new Error('No authenticated user');

      // Use upsert to prevent 409 Conflict
      const { error } = await supabase.from('budgets').upsert({
        user_id: user.id,
        category_name: category,
        limit_amount: limit,
        period_month: new Date().getMonth() + 1,
        period_year: new Date().getFullYear()
      }, { onConflict: 'user_id, category_name, period_month, period_year' });

      if (error) throw error;
      if (color) await dbService.ensureCategoryExists(category, color);
    } catch (error) { throw error; }
  },

  updateBudget: async (category: string, limit: number, color?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      const { error } = await supabase
        .from('budgets')
        .update({ limit_amount: limit })
        .eq('user_id', user.id)
        .eq('category_name', category);
      if (error) throw error;
      if (color) await dbService.ensureCategoryExists(category, color);
    } catch (error) { throw error; }
  },

  deleteBudget: async (category: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('user_id', user.id)
        .eq('category_name', category);
      if (error) throw error;
    } catch (error) { throw error; }
  },

  getRecurringExpenses: async () => {
    try {
      const { data, error } = await supabase.from('recurring_expenses').select('*').order('next_date', { ascending: true });
      if (error) {
        return [];
      }
      return data ? data.map(mapRecurring) : [];
    } catch (error) { return []; }
  },

  addRecurringExpense: async (item: RecurringItem) => {
    try {
      const userResponse = await supabase.auth.getUser();
      const user = userResponse.data.user;
      if (!user) throw new Error('No authenticated user');

      const { error } = await supabase.from('recurring_expenses').insert({
        user_id: user.id,
        name: item.name,
        amount: item.amount,
        category_name: item.category,
        frequency: item.frequency,
        next_date: item.nextDate,
        is_variable: item.isVariable
      });
      if (error) throw error;
    } catch (error) { throw error; }
  },

  updateRecurringExpenseDate: async (id: string, nextDate: string) => {
    try {
      const { error } = await supabase.from('recurring_expenses').update({ next_date: nextDate }).eq('id', id);
      if (error) throw error;
    } catch (error) { throw error; }
  },

  updateRecurringExpense: async (id: string, item: Partial<RecurringItem>) => {
    try {
      const updateData: any = {};
      if (item.name) updateData.name = item.name;
      if (item.amount) updateData.amount = item.amount;
      if (item.category) updateData.category_name = item.category;
      if (item.frequency) updateData.frequency = item.frequency;
      if (item.nextDate) updateData.next_date = item.nextDate;
      if (item.isVariable !== undefined) updateData.is_variable = item.isVariable;

      const { error } = await supabase.from('recurring_expenses').update(updateData).eq('id', id);
      if (error) throw error;
    } catch (error) { throw error; }
  },

  deleteRecurringExpense: async (id: string) => {
    try {
      const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
      if (error) throw error;
    } catch (error) { throw error; }
  }
};