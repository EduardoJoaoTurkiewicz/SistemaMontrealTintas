import { supabase } from './supabase';
import type { Fornecedor } from '../types';

function fromRow(row: any): Fornecedor {
  return {
    id: row.id,
    razaoSocial: row.razao_social,
    nomeFantasia: row.nome_fantasia ?? null,
    cnpj: row.cnpj ?? null,
    inscricaoEstadual: row.inscricao_estadual ?? null,
    telefone: row.telefone ?? null,
    whatsapp: row.whatsapp ?? null,
    email: row.email ?? null,
    site: row.site ?? null,
    endereco: row.endereco ?? null,
    cidade: row.cidade ?? null,
    estado: row.estado ?? null,
    cep: row.cep ?? null,
    observacoes: row.observacoes ?? null,
    categoria: row.categoria,
    status: row.status,
    classificacao: row.classificacao,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(f: Partial<Fornecedor>): Record<string, any> {
  const row: Record<string, any> = {};
  if (f.razaoSocial !== undefined)      row.razao_social       = f.razaoSocial;
  if (f.nomeFantasia !== undefined)     row.nome_fantasia      = f.nomeFantasia;
  if (f.cnpj !== undefined)             row.cnpj               = f.cnpj;
  if (f.inscricaoEstadual !== undefined) row.inscricao_estadual = f.inscricaoEstadual;
  if (f.telefone !== undefined)         row.telefone           = f.telefone;
  if (f.whatsapp !== undefined)         row.whatsapp           = f.whatsapp;
  if (f.email !== undefined)            row.email              = f.email;
  if (f.site !== undefined)             row.site               = f.site;
  if (f.endereco !== undefined)         row.endereco           = f.endereco;
  if (f.cidade !== undefined)           row.cidade             = f.cidade;
  if (f.estado !== undefined)           row.estado             = f.estado;
  if (f.cep !== undefined)              row.cep                = f.cep;
  if (f.observacoes !== undefined)      row.observacoes        = f.observacoes;
  if (f.categoria !== undefined)        row.categoria          = f.categoria;
  if (f.status !== undefined)           row.status             = f.status;
  if (f.classificacao !== undefined)    row.classificacao      = f.classificacao;
  return row;
}

export const fornecedorService = {
  async getAll(): Promise<Fornecedor[]> {
    const { data, error } = await supabase
      .from('fornecedores')
      .select('*')
      .order('razao_social', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async create(f: Omit<Fornecedor, 'id' | 'createdAt' | 'updatedAt'>): Promise<Fornecedor> {
    const { data, error } = await supabase
      .from('fornecedores')
      .insert(toRow(f))
      .select()
      .single();
    if (error) throw error;
    return fromRow(data);
  },

  async update(id: string, f: Partial<Omit<Fornecedor, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Fornecedor> {
    const { data, error } = await supabase
      .from('fornecedores')
      .update({ ...toRow(f), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return fromRow(data);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('fornecedores').delete().eq('id', id);
    if (error) throw error;
  },
};
