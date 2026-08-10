import { get, post, buildQuery } from './client'
import type { ActiveLoanResponse, LendRequest, LoanResponse } from '../types/loan'

export function lendOwnership(body: LendRequest): Promise<LoanResponse> {
  return post<LoanResponse>('/loans', body)
}

export function markLoanReturned(id: string): Promise<LoanResponse> {
  return post<LoanResponse>(`/loans/${id}/return`)
}

export function listLoansForOwnership(ownershipId: string): Promise<LoanResponse[]> {
  return get<LoanResponse[]>(`/loans${buildQuery({ ownershipId })}`)
}

/** Tous les prêts en cours, tous propriétaires confondus - "Prêts en cours" (Mon profil). */
export function listActiveLoans(): Promise<ActiveLoanResponse[]> {
  return get<ActiveLoanResponse[]>('/loans/active')
}
