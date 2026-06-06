-- Add validade_meses to estoque_variacoes (validity months per product variation)
-- Default 24 months preserves existing behavior (all current records had +2 years hardcoded)
ALTER TABLE estoque_variacoes ADD COLUMN IF NOT EXISTS validade_meses INTEGER NOT NULL DEFAULT 24;
