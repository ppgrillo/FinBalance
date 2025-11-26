
import { RecurringItem } from '../types';

export const expenseService = {
  /**
   * Utility to calculate the next date based on frequency.
   * Does not access DB or LocalStorage.
   */
  calculateNextDate: (date: Date, frequency: string): Date => {
      const newDate = new Date(date);
      switch (frequency) {
          case 'Mensual':
            newDate.setMonth(newDate.getMonth() + 1);
            break;
          case 'Anual':
            newDate.setFullYear(newDate.getFullYear() + 1);
            break;
          case 'Semanal':
            newDate.setDate(newDate.getDate() + 7);
            break;
          case 'Bimestral':
            newDate.setMonth(newDate.getMonth() + 2);
            break;
           default: 
             newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
  }
};
