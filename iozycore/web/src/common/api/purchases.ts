import { get, post, put } from './client'
import type { AcquiredDto, BudgetDto, MonthSpendingDto, ToBuyLineDto } from '../types/api'

/** The one list of what to buy: soonest release first, then the work closest to complete. */
export function listToBuy(): Promise<ToBuyLineDto[]> {
  return get<ToBuyLineDto[]>('/purchases/to-buy')
}

/** What was spent this month (by purchase date) and the monthly budget. */
export function fetchMonthSpending(): Promise<MonthSpendingDto> {
  return get<MonthSpendingDto>('/purchases/month')
}

/** Sets the monthly budget in euros; `null` removes it. 400 for zero or less. */
export function setBudget(monthlyBudget: number | null): Promise<BudgetDto> {
  return put<BudgetDto>('/purchases/budget', { monthlyBudget })
}

/** "Je l'ai" on one element of a work: one new copy, bought today, no price. 409 when already owned. */
export function acquireElement(entityId: string, elementKey: string): Promise<AcquiredDto> {
  return post<AcquiredDto>('/purchases/acquire', { entityId, elementKey })
}
