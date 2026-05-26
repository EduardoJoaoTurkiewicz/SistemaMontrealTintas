/*
  # Add payment_type to employee_payments and cliente_id to acertos

  ## Changes

  ### 1. employee_payments — new column: payment_type
  - Adds `payment_type` (text, default 'salario') to distinguish record kinds
  - Allowed values: 'salario', 'adiantamento', 'comissao', 'bonus', 'hora_extra', 'outro'
  - Existing rows default to 'salario' — no data loss
  - Adds CHECK constraint to enforce allowed values

  ### 2. acertos — new column: cliente_id
  - Adds `cliente_id` (uuid, nullable FK to clientes.id) on SET NULL delete
  - Allows acertos of type 'cliente' to reference a registered customer
  - Nullable so existing rows and empresa-type acertos are unaffected
*/

-- 1. Add payment_type to employee_payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_payments' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE employee_payments
      ADD COLUMN payment_type text NOT NULL DEFAULT 'salario';
  END IF;
END $$;

-- Add check constraint (drop first if it already exists to be idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'employee_payments' AND constraint_name = 'employee_payments_payment_type_check'
  ) THEN
    ALTER TABLE employee_payments
      ADD CONSTRAINT employee_payments_payment_type_check
      CHECK (payment_type IN ('salario', 'adiantamento', 'comissao', 'bonus', 'hora_extra', 'outro'));
  END IF;
END $$;

-- 2. Add cliente_id to acertos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'acertos' AND column_name = 'cliente_id'
  ) THEN
    ALTER TABLE acertos
      ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL;
  END IF;
END $$;
