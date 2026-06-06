import { supabase } from './supabase';
import type { EstoqueProdutoCompleto, EstoqueCor, EstoqueVariacao, EstoqueSaldo } from '../types';

function toCamelCaseProduto(row: any): EstoqueProdutoCompleto {
  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao ?? undefined,
    temCor: row.tem_cor,
    createdAt: row.created_at,
    cores: [],
    variacoes: [],
    saldos: [],
  };
}

function toCamelCaseCor(row: any): EstoqueCor {
  return {
    id: row.id,
    produtoId: row.produto_id,
    nomeCor: row.nome_cor,
    createdAt: row.created_at,
  };
}

function toCamelCaseVariacao(row: any): EstoqueVariacao {
  return {
    id: row.id,
    produtoId: row.produto_id,
    nomeVariacao: row.nome_variacao,
    valorUnitarioPadrao: Number(row.valor_unitario_padrao),
    descricao: row.descricao ?? undefined,
    validadeMeses: row.validade_meses ?? 24,
    createdAt: row.created_at,
  };
}

function toCamelCaseSaldo(row: any): EstoqueSaldo {
  return {
    id: row.id,
    produtoId: row.produto_id,
    variacaoId: row.variacao_id,
    corId: row.cor_id ?? undefined,
    quantidadeAtual: Number(row.quantidade_atual),
    updatedAt: row.updated_at,
  };
}

export const estoqueService = {
  async getProdutos(): Promise<EstoqueProdutoCompleto[]> {
    const [produtosRes, coresRes, variacoesRes, saldosRes] = await Promise.all([
      supabase.from('estoque_produtos').select('*').order('nome'),
      supabase.from('estoque_cores').select('*').order('nome_cor'),
      supabase.from('estoque_variacoes').select('*').order('nome_variacao'),
      supabase.from('estoque_saldos').select('*'),
    ]);

    if (produtosRes.error) throw produtosRes.error;

    const produtos = (produtosRes.data || []).map(toCamelCaseProduto);
    const cores = (coresRes.data || []).map(toCamelCaseCor);
    const variacoes = (variacoesRes.data || []).map(toCamelCaseVariacao);
    const saldos = (saldosRes.data || []).map(toCamelCaseSaldo);

    for (const produto of produtos) {
      produto.cores = cores.filter(c => c.produtoId === produto.id);
      produto.variacoes = variacoes.filter(v => v.produtoId === produto.id);
      produto.saldos = saldos.filter(s => s.produtoId === produto.id);
    }

    return produtos;
  },

  async createProduto(
    nome: string,
    descricao: string | undefined,
    temCor: boolean,
    cores: string[],
    variacoes: { nomeVariacao: string; valorUnitarioPadrao: number; descricao?: string; validadeMeses?: number }[]
  ): Promise<EstoqueProdutoCompleto> {
    const { data: produto, error: produtoError } = await supabase
      .from('estoque_produtos')
      .insert({ nome, descricao: descricao || null, tem_cor: temCor })
      .select()
      .single();

    if (produtoError) throw produtoError;

    const coresInseridas: EstoqueCor[] = [];
    if (temCor && cores.length > 0) {
      const { data: coresData, error: coresError } = await supabase
        .from('estoque_cores')
        .insert(cores.map(nomeCor => ({ produto_id: produto.id, nome_cor: nomeCor })))
        .select();
      if (coresError) throw coresError;
      coresInseridas.push(...(coresData || []).map(toCamelCaseCor));
    }

    const variacoesInseridas: EstoqueVariacao[] = [];
    if (variacoes.length > 0) {
      const { data: varData, error: varError } = await supabase
        .from('estoque_variacoes')
        .insert(
          variacoes.map(v => ({
            produto_id: produto.id,
            nome_variacao: v.nomeVariacao,
            valor_unitario_padrao: v.valorUnitarioPadrao,
            descricao: v.descricao || null,
            validade_meses: v.validadeMeses ?? 24,
          }))
        )
        .select();
      if (varError) throw varError;
      variacoesInseridas.push(...(varData || []).map(toCamelCaseVariacao));
    }

    const saldosParaInserir: object[] = [];
    if (temCor && coresInseridas.length > 0) {
      for (const variacao of variacoesInseridas) {
        for (const cor of coresInseridas) {
          saldosParaInserir.push({
            produto_id: produto.id,
            variacao_id: variacao.id,
            cor_id: cor.id,
            quantidade_atual: 0,
          });
        }
      }
    } else {
      for (const variacao of variacoesInseridas) {
        saldosParaInserir.push({
          produto_id: produto.id,
          variacao_id: variacao.id,
          cor_id: null,
          quantidade_atual: 0,
        });
      }
    }

    const saldosInseridos: EstoqueSaldo[] = [];
    if (saldosParaInserir.length > 0) {
      const { data: saldosData, error: saldosError } = await supabase
        .from('estoque_saldos')
        .insert(saldosParaInserir)
        .select();
      if (saldosError) throw saldosError;
      saldosInseridos.push(...(saldosData || []).map(toCamelCaseSaldo));
    }

    return {
      ...toCamelCaseProduto(produto),
      cores: coresInseridas,
      variacoes: variacoesInseridas,
      saldos: saldosInseridos,
    };
  },

  async updateProduto(id: string, nome: string, descricao?: string): Promise<void> {
    const { error } = await supabase
      .from('estoque_produtos')
      .update({ nome, descricao: descricao || null })
      .eq('id', id);
    if (error) throw error;
  },

  async updateVariacao(
    id: string,
    nomeVariacao: string,
    valorUnitarioPadrao: number,
    descricao?: string,
    validadeMeses?: number
  ): Promise<void> {
    const { error } = await supabase
      .from('estoque_variacoes')
      .update({
        nome_variacao: nomeVariacao,
        valor_unitario_padrao: valorUnitarioPadrao,
        descricao: descricao || null,
        ...(validadeMeses !== undefined && { validade_meses: validadeMeses }),
      })
      .eq('id', id);
    if (error) throw error;
  },

  async updateCor(id: string, nomeCor: string): Promise<void> {
    const { error } = await supabase
      .from('estoque_cores')
      .update({ nome_cor: nomeCor })
      .eq('id', id);
    if (error) throw error;
  },

  async removeVariacao(variacaoId: string): Promise<void> {
    const { data: saldos, error: checkError } = await supabase
      .from('estoque_saldos')
      .select('id, quantidade_atual')
      .eq('variacao_id', variacaoId);

    if (checkError) throw checkError;

    const temSaldo = (saldos || []).some(s => Number(s.quantidade_atual) > 0);
    if (temSaldo) {
      throw new Error('Nao e possivel remover pois ha saldo em estoque. Zere o saldo antes.');
    }

    const { error: saldosError } = await supabase
      .from('estoque_saldos')
      .delete()
      .eq('variacao_id', variacaoId);
    if (saldosError) throw saldosError;

    const { error } = await supabase
      .from('estoque_variacoes')
      .delete()
      .eq('id', variacaoId);
    if (error) throw error;
  },

  async removeCor(corId: string): Promise<void> {
    const { data: saldos, error: checkError } = await supabase
      .from('estoque_saldos')
      .select('id, quantidade_atual')
      .eq('cor_id', corId);

    if (checkError) throw checkError;

    const temSaldo = (saldos || []).some(s => Number(s.quantidade_atual) > 0);
    if (temSaldo) {
      throw new Error('Nao e possivel remover pois ha saldo em estoque. Zere o saldo antes.');
    }

    const { error: saldosError } = await supabase
      .from('estoque_saldos')
      .delete()
      .eq('cor_id', corId);
    if (saldosError) throw saldosError;

    const { error } = await supabase
      .from('estoque_cores')
      .delete()
      .eq('id', corId);
    if (error) throw error;
  },

  async deleteProduto(produtoId: string): Promise<void> {
    const { data: saldos, error: checkError } = await supabase
      .from('estoque_saldos')
      .select('id, quantidade_atual')
      .eq('produto_id', produtoId);

    if (checkError) throw checkError;

    const temSaldo = (saldos || []).some(s => Number(s.quantidade_atual) > 0);
    if (temSaldo) {
      throw new Error('Nao e possivel remover pois ha saldo em estoque. Zere o saldo antes.');
    }

    const { error } = await supabase
      .from('estoque_produtos')
      .delete()
      .eq('id', produtoId);
    if (error) throw error;
  },

  async updateSaldo(saldoId: string, quantidadeAtual: number): Promise<void> {
    const { error } = await supabase
      .from('estoque_saldos')
      .update({ quantidade_atual: quantidadeAtual, updated_at: new Date().toISOString() })
      .eq('id', saldoId);
    if (error) throw error;
  },

  async addCor(produtoId: string, nomeCor: string): Promise<void> {
    const { data: cor, error: corError } = await supabase
      .from('estoque_cores')
      .insert({ produto_id: produtoId, nome_cor: nomeCor })
      .select()
      .single();
    if (corError) throw corError;

    const { data: variacoes, error: varError } = await supabase
      .from('estoque_variacoes')
      .select('id')
      .eq('produto_id', produtoId);
    if (varError) throw varError;

    if ((variacoes || []).length > 0) {
      const { error: saldosError } = await supabase.from('estoque_saldos').insert(
        (variacoes || []).map(v => ({
          produto_id: produtoId,
          variacao_id: v.id,
          cor_id: cor.id,
          quantidade_atual: 0,
        }))
      );
      if (saldosError) throw saldosError;
    }
  },

  async addVariacao(
    produtoId: string,
    nomeVariacao: string,
    valorUnitarioPadrao: number,
    descricao?: string,
    validadeMeses?: number
  ): Promise<void> {
    const { data: variacao, error: varError } = await supabase
      .from('estoque_variacoes')
      .insert({
        produto_id: produtoId,
        nome_variacao: nomeVariacao,
        valor_unitario_padrao: valorUnitarioPadrao,
        descricao: descricao || null,
        validade_meses: validadeMeses ?? 24,
      })
      .select()
      .single();
    if (varError) throw varError;

    const { data: produto, error: prodError } = await supabase
      .from('estoque_produtos')
      .select('tem_cor')
      .eq('id', produtoId)
      .single();
    if (prodError) throw prodError;

    const saldosParaInserir: object[] = [];
    if (produto.tem_cor) {
      const { data: cores, error: coresError } = await supabase
        .from('estoque_cores')
        .select('id')
        .eq('produto_id', produtoId);
      if (coresError) throw coresError;

      for (const cor of cores || []) {
        saldosParaInserir.push({
          produto_id: produtoId,
          variacao_id: variacao.id,
          cor_id: cor.id,
          quantidade_atual: 0,
        });
      }
    } else {
      saldosParaInserir.push({
        produto_id: produtoId,
        variacao_id: variacao.id,
        cor_id: null,
        quantidade_atual: 0,
      });
    }

    if (saldosParaInserir.length > 0) {
      const { error: saldosError } = await supabase
        .from('estoque_saldos')
        .insert(saldosParaInserir);
      if (saldosError) throw saldosError;
    }
  },
};
