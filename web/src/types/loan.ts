// Miroir des DTOs Java de com.iozycore.api.dto.LoanDtos.

export interface LendRequest {
  ownershipId: string
  borrowerName: string
  lentAt: string // "YYYY-MM-DD"
  note?: string
}

export interface LoanResponse {
  id: string
  ownershipId: string
  borrowerName: string
  lentAt: string
  returnedAt: string | null
  note: string | null
}

/** Enrichi du titre/tome pour l'affichage (voir LoanController.enrich côté backend) - Loan ne connaît que l'Ownership prêtée. */
export interface ActiveLoanResponse {
  id: string
  ownershipId: string
  entityId: string
  entityTitle: string
  variantLabel: string | null
  borrowerName: string
  lentAt: string
  note: string | null
}
