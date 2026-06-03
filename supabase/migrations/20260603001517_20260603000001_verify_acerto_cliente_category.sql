/*
  # Verify and enforce acerto_cliente in cash_transactions category constraint

  ## Summary
  Ensures the cash_transactions CHECK constraint includes 'acerto_cliente'.
  The AcertoPaymentService inserts rows with category='acerto_cliente' and this
  constraint must be present or those inserts silently fail.

  ## Changes
  1. Drops the existing cash_transactions_category_check constraint if present.
  2. Recreates it with the full set of valid categories including 'acerto_cliente',
     'antecipacao_cartao', 'pagamento_cartao', 'recebimento_cartao', and
     'acerto_cliente'.

  ## Notes
  - Fully idempotent (DROP IF EXISTS + CREATE).
  - No existing data is modified.
  - NEVER silently catches this error — if the constraint is violated the
    application layer now throws explicitly.
*/

ALTER TABLE cash_transactions
  DROP CONSTRAINT IF EXISTS cash_transactions_category_check;

ALTER TABLE cash_transactions
  ADD CONSTRAINT cash_transactions_category_check
    CHECK (category = ANY (ARRAY[
      'venda'::text,
      'divida'::text,
      'adiantamento'::text,
      'salario'::text,
      'comissao'::text,
      'cheque'::text,
      'boleto'::text,
      'recebimento_cartao'::text,
      'pagamento_cartao'::text,
      'antecipacao_cartao'::text,
      'acerto_cliente'::text,
      'outro'::text
    ]));
