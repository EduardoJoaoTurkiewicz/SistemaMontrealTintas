/*
  # Auto-status trigger for check compensation

  ## Summary
  Adds a PostgreSQL trigger on the `checks` table that automatically calls
  `recalculate_sale_status` and/or `recalculate_debt_status` whenever a
  check's `status` column is updated. This is the Layer 3 database fallback
  that ensures sale/debt statuses stay in sync even if the application-level
  calls fail or are skipped.

  ## Changes
  - New trigger function: sync_parent_status_on_check_update()
  - New trigger: trg_sync_parent_status_on_check_update (AFTER UPDATE on checks)

  ## Security
  - Trigger function uses SECURITY DEFINER to allow updating sales/debts rows.
  - No new tables or RLS policies needed.
*/

-- ============================================================
-- Trigger function: sync parent status when check status changes
-- ============================================================
CREATE OR REPLACE FUNCTION sync_parent_status_on_check_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire when the status column actually changed
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.sale_id IS NOT NULL THEN
      PERFORM recalculate_sale_status(NEW.sale_id);
    END IF;
    IF NEW.debt_id IS NOT NULL THEN
      PERFORM recalculate_debt_status(NEW.debt_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger first to allow idempotent re-run
DROP TRIGGER IF EXISTS trg_sync_parent_status_on_check_update ON checks;

CREATE TRIGGER trg_sync_parent_status_on_check_update
  AFTER UPDATE ON checks
  FOR EACH ROW
  EXECUTE FUNCTION sync_parent_status_on_check_update();
