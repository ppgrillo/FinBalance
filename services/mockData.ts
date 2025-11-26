
import { Expense, Budget, CategoryType, RecurringItem, Account, FinancialGoal } from '../types';

export const MOCK_EXPENSES: Expense[] = [
  { id: '1', amount: 120, category: CategoryType.Food, description: 'Tacos', date: new Date().toISOString() },
  { id: '2', amount: 450, category: CategoryType.Transport, description: 'Gasolina', date: new Date(Date.now() - 86400000).toISOString() },
  { id: '3', amount: 1200, category: CategoryType.Shopping, description: 'Zapatillas', date: new Date(Date.now() - 172800000).toISOString() },
  { id: '4', amount: 80, category: CategoryType.Food, description: 'Café', date: new Date(Date.now() - 200000000).toISOString() },
  { id: '5', amount: 3500, category: CategoryType.Housing, description: 'Renta (Parte)', date: new Date(Date.now() - 500000000).toISOString() },
  { id: '6', amount: 1500, category: CategoryType.Entertainment, description: 'Cine y Cena', date: new Date(Date.now() - 600000000).toISOString() },
  { id: '7', amount: 300, category: CategoryType.Health, description: 'Farmacia', date: new Date(Date.now() - 700000000).toISOString() },
];

export const MOCK_BUDGETS: Budget[] = [
  { category: CategoryType.Food, limit: 3000, spent: 1200, color: '#FF9AA2' },
  { category: CategoryType.Transport, limit: 2000, spent: 450, color: '#B5EAD7' },
  { category: CategoryType.Housing, limit: 6000, spent: 3500, color: '#C7CEEA' },
  { category: CategoryType.Entertainment, limit: 1500, spent: 800, color: '#F9F871' },
];

export const MOCK_RECURRING: RecurringItem[] = [
    { id: '1', name: 'Netflix', amount: 199, category: CategoryType.Entertainment, frequency: 'Mensual', nextDate: '2023-11-15', isVariable: false },
    { id: '2', name: 'Renta', amount: 5500, category: CategoryType.Housing, frequency: 'Mensual', nextDate: '2023-11-01', isVariable: false },
    { id: '3', name: 'Luz (CFE)', amount: 450, category: CategoryType.Housing, frequency: 'Bimestral' as any, nextDate: new Date().toISOString().split('T')[0], isVariable: true }, // Example due today
    { id: '4', name: 'Gimnasio', amount: 800, category: CategoryType.Health, frequency: 'Mensual', nextDate: '2023-11-05', isVariable: false },
];

export const MOCK_ACCOUNTS: Account[] = [
    { id: '1', name: 'Nómina BBVA', type: 'Debit', balance: 12500.00, color: '#1E88E5', lastDigits: '4589' },
    { id: '2', name: 'Ahorros Nu', type: 'Investment', balance: 50000.00, color: '#8E24AA', lastDigits: '1023' },
    { id: '3', name: 'AMEX Gold', type: 'Credit', balance: 4500.00, limit: 60000, color: '#FFB300', lastDigits: '9001' },
    { id: '4', name: 'Santander LikeU', type: 'Credit', balance: 1200.00, limit: 15000, color: '#E53935', lastDigits: '3321' },
    { id: '5', name: 'Efectivo', type: 'Cash', balance: 850.00, color: '#43A047' },
];

export const MOCK_GOALS: FinancialGoal[] = [
    { 
        id: '1', 
        name: 'Viaje a Japón', 
        targetAmount: 80000, 
        currentAmount: 15000, 
        deadline: '2025-06-01', 
        aiPlan: '1. Ahorra $5,500 mensuales.\n2. Reduce gastos en restaurantes un 20%.\n3. Busca vuelos con 6 meses de anticipación.' 
    },
    { 
        id: '2', 
        name: 'Nueva MacBook', 
        targetAmount: 35000, 
        currentAmount: 10000, 
        deadline: '2024-12-25' 
    }
];

// Helper to get all unique categories used across the app
export const getAvailableCategories = (): string[] => {
  const defaults = Object.values(CategoryType);
  const usedInExpenses = MOCK_EXPENSES.map(e => e.category);
  const usedInBudgets = MOCK_BUDGETS.map(b => b.category);
  
  // Merge and deduplicate
  return Array.from(new Set([...defaults, ...usedInExpenses, ...usedInBudgets]));
};