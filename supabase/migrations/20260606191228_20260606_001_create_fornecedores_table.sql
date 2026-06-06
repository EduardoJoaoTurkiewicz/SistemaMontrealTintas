-- Create fornecedores (suppliers) master table
CREATE TABLE IF NOT EXISTS fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  inscricao_estadual TEXT,
  telefone TEXT,
  whatsapp TEXT,
  email TEXT,
  site TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  observacoes TEXT,
  categoria TEXT NOT NULL DEFAULT 'Outros'
    CHECK (categoria IN ('Matéria-prima','Embalagens','Pigmentos','Resinas','Equipamentos','Serviços','Logística','Outros')),
  status TEXT NOT NULL DEFAULT 'Ativo'
    CHECK (status IN ('Ativo','Inativo','Bloqueado')),
  classificacao TEXT NOT NULL DEFAULT 'C'
    CHECK (classificacao IN ('A','B','C')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fornecedores_select" ON fornecedores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fornecedores_insert" ON fornecedores FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "fornecedores_update" ON fornecedores FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fornecedores_delete" ON fornecedores FOR DELETE TO anon, authenticated USING (true);

CREATE TRIGGER update_fornecedores_updated_at
  BEFORE UPDATE ON fornecedores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add optional fornecedor_id FK to debts
ALTER TABLE debts ADD COLUMN IF NOT EXISTS fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL;
