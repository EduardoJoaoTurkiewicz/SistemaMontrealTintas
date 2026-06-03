/*
  # Deduplicate cash_transactions before adding unique index

  ## Summary
  Some cash_transactions rows share the same (related_id, category, type),
  which would prevent adding the unique partial index for idempotency.

  ## Changes
  1. Keeps the EARLIEST row (lowest created_at) for each
     (related_id, category, type) group where related_id IS NOT NULL.
  2. Deletes the newer duplicates.

  ## Safety
  - Only deletes rows where a duplicate exists with the same
    (related_id, category, type) AND related_id IS NOT NULL.
  - The oldest row (true original) is always preserved.
  - No schema changes in this migration.
*/

DELETE FROM cash_transactions
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY related_id, category, type
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM cash_transactions
    WHERE related_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);
