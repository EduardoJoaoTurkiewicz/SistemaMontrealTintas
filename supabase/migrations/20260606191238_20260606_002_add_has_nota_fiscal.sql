-- Add has_nota_fiscal flag to sales and debts
ALTER TABLE sales ADD COLUMN IF NOT EXISTS has_nota_fiscal BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS has_nota_fiscal BOOLEAN NOT NULL DEFAULT FALSE;
