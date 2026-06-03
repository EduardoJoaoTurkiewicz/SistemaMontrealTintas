/*
  # Atomic credit card sale creation RPC

  ## Summary
  Creates a PostgreSQL function `create_credit_card_sale_atomic` that inserts a
  credit_card_sales record and all its installments inside a single transaction.
  If the installments insert fails the entire operation is rolled back, so there
  can never be an orphan credit_card_sales row without corresponding installments.

  ## New Functions
  - `create_credit_card_sale_atomic(sale_data jsonb, installments_data jsonb)`
    Returns the new credit_card_sales.id (uuid).
    Raises an exception (and rolls back) if either insert fails.

  ## Used by
  - CreditCardService.createFromSale()
  - CreditCardService.createFromDebt()
  - CreditCardService.createFromAcerto()

  ## Notes
  - SECURITY DEFINER so it can bypass RLS from the application layer.
  - Installments are passed as a JSONB array, each element matching the
    credit_card_sale_installments column set.
*/

CREATE OR REPLACE FUNCTION create_credit_card_sale_atomic(
  p_sale_data       jsonb,
  p_installments    jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id uuid;
BEGIN
  -- Insert the parent sale record
  INSERT INTO credit_card_sales (
    sale_id,
    client_name,
    total_amount,
    remaining_amount,
    installments,
    sale_date,
    first_due_date,
    status,
    anticipated
  )
  VALUES (
    (p_sale_data->>'sale_id')::uuid,
    p_sale_data->>'client_name',
    (p_sale_data->>'total_amount')::numeric,
    (p_sale_data->>'remaining_amount')::numeric,
    (p_sale_data->>'installments')::int,
    (p_sale_data->>'sale_date')::date,
    (p_sale_data->>'first_due_date')::date,
    COALESCE(p_sale_data->>'status', 'active'),
    COALESCE((p_sale_data->>'anticipated')::boolean, false)
  )
  RETURNING id INTO v_sale_id;

  -- Insert all installments, stamping the parent id
  INSERT INTO credit_card_sale_installments (
    credit_card_sale_id,
    installment_number,
    amount,
    due_date,
    status
  )
  SELECT
    v_sale_id,
    (elem->>'installment_number')::int,
    (elem->>'amount')::numeric,
    (elem->>'due_date')::date,
    COALESCE(elem->>'status', 'pending')
  FROM jsonb_array_elements(p_installments) AS elem;

  RETURN v_sale_id;

EXCEPTION WHEN OTHERS THEN
  -- Re-raise: the implicit transaction rolls back both inserts
  RAISE;
END;
$$;


/*
  Debt variant of the same atomic function.
*/
CREATE OR REPLACE FUNCTION create_credit_card_debt_atomic(
  p_debt_data       jsonb,
  p_installments    jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_debt_id uuid;
BEGIN
  INSERT INTO credit_card_debts (
    debt_id,
    supplier_name,
    total_amount,
    remaining_amount,
    installments,
    purchase_date,
    first_due_date,
    status
  )
  VALUES (
    (p_debt_data->>'debt_id')::uuid,
    p_debt_data->>'supplier_name',
    (p_debt_data->>'total_amount')::numeric,
    (p_debt_data->>'remaining_amount')::numeric,
    (p_debt_data->>'installments')::int,
    (p_debt_data->>'purchase_date')::date,
    (p_debt_data->>'first_due_date')::date,
    COALESCE(p_debt_data->>'status', 'active')
  )
  RETURNING id INTO v_debt_id;

  INSERT INTO credit_card_debt_installments (
    credit_card_debt_id,
    installment_number,
    amount,
    due_date,
    status
  )
  SELECT
    v_debt_id,
    (elem->>'installment_number')::int,
    (elem->>'amount')::numeric,
    (elem->>'due_date')::date,
    COALESCE(elem->>'status', 'pending')
  FROM jsonb_array_elements(p_installments) AS elem;

  RETURN v_debt_id;

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;
