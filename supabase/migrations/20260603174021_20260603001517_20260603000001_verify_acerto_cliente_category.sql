/*
  # Add installment_id to cash_transactions for per-installment idempotency

  ## Summary
  Adds a nullable `installment_id` column to `cash_transactions` that links a
  cash register entry to the exact credit-card installment that generated it.
  A unique partial index on this column guarantees that no installment can ever
  produce more than one cash entry — providing DB-level idempotency as required
  by Item 3 of the financial integrity spec.

  ## Changes
  1. Add `installment_id` (uuid, nullable) column to `cash_transactions`.
  2. Create a unique partial index on `installment_id` WHERE NOT NULL.

  ## Notes
  - Non-destructive: existing rows are unaffected (column defaults to NULL).
  - The index is partial so manual/ad-hoc transactions (no installment link)
    remain unrestricted.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_transactions' AND column_name = 'installment_id'
  ) THEN
    ALTER TABLE cash_transactions ADD COLUMN installment_id uuid NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_transactions_installment_id
  ON cash_transactions (installment_id)
  WHERE installment_id IS NOT NULL;
