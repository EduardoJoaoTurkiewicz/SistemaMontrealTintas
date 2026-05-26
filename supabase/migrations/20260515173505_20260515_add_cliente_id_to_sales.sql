/*
  # Add cliente_id to sales table

  Adds a nullable `cliente_id` (uuid FK to clientes.id) to the sales table.
  This links a sale to a registered customer record when the "Acerto" payment
  method is used, enabling fully automatic acerto management per customer.

  - Nullable so existing sales and sales with free-text clients are unaffected
  - ON DELETE SET NULL so deleting a customer doesn't cascade-delete their sales
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'cliente_id'
  ) THEN
    ALTER TABLE sales
      ADD COLUMN cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL;
  END IF;
END $$;
