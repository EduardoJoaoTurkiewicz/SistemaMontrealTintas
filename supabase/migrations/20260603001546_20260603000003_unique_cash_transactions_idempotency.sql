/*
  # Add unique partial index on cash_transactions for idempotency

  ## Summary
  Prevents double-counting in the cash register caused by concurrent or
  retried inserts for the same financial event.

  ## Changes
  1. Adds a unique partial index on (related_id, category, type) WHERE
     related_id IS NOT NULL.

  ## Design decisions
  - Partial index (WHERE related_id IS NOT NULL) so that manual/ad-hoc
    transactions without a related_id are not affected.
  - Covers check compensations, boleto receipts, credit-card installments,
    acerto payments, and any future payment that carries a related_id.

  ## Notes
  - Duplicates were removed in the preceding migration
    20260603000002_deduplicate_cash_transactions.sql.
*/

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_transactions_related_category_type
  ON cash_transactions (related_id, category, type)
  WHERE related_id IS NOT NULL;
