-- V46__purchase_budget.sql
-- Lot 216: the "to buy" page. An optional monthly budget, one per account.
--
-- Private to each account: owner_id is the @TenantId column. No row means no
-- budget (the page then shows none). The amount is in euros, strictly positive:
-- "no budget" is said by removing the row, never by a zero.
CREATE TABLE purchase_budget (
    id             UUID PRIMARY KEY,
    owner_id       UUID NOT NULL,
    monthly_amount NUMERIC(10, 2) NOT NULL CHECK (monthly_amount > 0),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT purchase_budget_one_per_owner UNIQUE (owner_id)
);
