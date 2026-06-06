import { supabase } from './supabase';
import type { ProducaoCompleta, ProducaoItemCompleto } from '../types';

function toDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function toCamelCaseProducao(row: any): Omit<ProducaoCompleta, 'itens'> {
  return {
    id: row.id,
    titulo: row.titulo,
    lote: row.lote,
    fabricacaoDate: row.fabricacao_date,
    validadeDate: row.validade_date,
    createdAt: row.created_at,
  };
}

function toCamelCaseItem(row: any): ProducaoItemCompleto {
  return {
    id: row.id,
    producaoId: row.producao_id,
    produtoId: row.produto_id,
    variacaoId: row.variacao_id,
    corId: row.cor_id ?? undefined,
    quantidade: Number(row.quantidade),
    createdAt: row.created_at,
    nomeProduto: row.estoque_produtos?.nome ?? '',
    nomeVariacao: row.estoque_variacoes?.nome_variacao ?? '',
    nomeCor: row.estoque_cores?.nome_cor ?? undefined,
    validadeMeses: row.estoque_variacoes?.validade_meses ?? 24,
  };
}

export const producaoService = {
  async gerarProximoLote(data: Date): Promise<string> {
    const year = data.getFullYear().toString();
    const prefix = `${year}-`;

    const { data: rows, error } = await supabase
      .from('producoes')
      .select('lote')
      .like('lote', `${prefix}%`)
      .not('lote', 'like', 'MT-%')
      .order('lote', { ascending: false })
      .limit(1);

    if (error) throw error;

    let seq = 1;
    if (rows && rows.length > 0) {
      const last = rows[0].lote;
      const parts = last.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  },

  async getProducoes(): Promise<ProducaoCompleta[]> {
    const { data: producoes, error: prodError } = await supabase
      .from('producoes')
      .select('*')
      .order('created_at', { ascending: false });

    if (prodError) throw prodError;
    if (!producoes || producoes.length === 0) return [];

    const ids = producoes.map(p => p.id);

    const { data: itens, error: itensError } = await supabase
      .from('producao_itens')
      .select(`
        *,
        estoque_produtos(nome),
        estoque_variacoes(nome_variacao, validade_meses),
        estoque_cores(nome_cor)
      `)
      .in('producao_id', ids);

    if (itensError) throw itensError;

    return producoes.map(p => ({
      ...toCamelCaseProducao(p),
      itens: (itens || [])
        .filter(i => i.producao_id === p.id)
        .map(toCamelCaseItem),
    }));
  },

  async createProducao(
    titulo: string,
    lote: string,
    fabricacaoDate: Date,
    itens: { produtoId: string; variacaoId: string; corId?: string; quantidade: number }[]
  ): Promise<ProducaoCompleta> {
    const fabricacaoStr = toDate(fabricacaoDate);

    // Fetch validadeMeses from the first item's variacao (all items in a batch share the same product line)
    let validadeMeses = 24;
    if (itens.length > 0) {
      const variacaoIds = [...new Set(itens.map(i => i.variacaoId))];
      const { data: variacoes } = await supabase
        .from('estoque_variacoes')
        .select('validade_meses')
        .in('id', variacaoIds)
        .limit(1);
      if (variacoes && variacoes.length > 0) {
        validadeMeses = variacoes[0].validade_meses ?? 24;
      }
    }

    const validadeDate = new Date(fabricacaoDate);
    validadeDate.setMonth(validadeDate.getMonth() + validadeMeses);
    const validadeStr = toDate(validadeDate);

    const { data: producao, error: prodError } = await supabase
      .from('producoes')
      .insert({
        titulo,
        lote,
        fabricacao_date: fabricacaoStr,
        validade_date: validadeStr,
      })
      .select()
      .single();

    if (prodError) throw prodError;

    const itensParaInserir = itens.map(item => ({
      producao_id: producao.id,
      produto_id: item.produtoId,
      variacao_id: item.variacaoId,
      cor_id: item.corId ?? null,
      quantidade: item.quantidade,
    }));

    const { error: itensError } = await supabase
      .from('producao_itens')
      .insert(itensParaInserir);

    if (itensError) throw itensError;

    for (const item of itens) {
      const query = supabase
        .from('estoque_saldos')
        .select('id, quantidade_atual')
        .eq('variacao_id', item.variacaoId);

      const finalQuery = item.corId
        ? query.eq('cor_id', item.corId)
        : query.is('cor_id', null);

      const { data: saldos, error: saldoError } = await finalQuery;
      if (saldoError) throw saldoError;

      if (saldos && saldos.length > 0) {
        const saldo = saldos[0];
        const novaQtd = Number(saldo.quantidade_atual) + item.quantidade;
        const { error: updateError } = await supabase
          .from('estoque_saldos')
          .update({ quantidade_atual: novaQtd, updated_at: new Date().toISOString() })
          .eq('id', saldo.id);
        if (updateError) throw updateError;
      }
    }

    const { data: itensCompletos, error: itensCompletosError } = await supabase
      .from('producao_itens')
      .select(`
        *,
        estoque_produtos(nome),
        estoque_variacoes(nome_variacao, validade_meses),
        estoque_cores(nome_cor)
      `)
      .eq('producao_id', producao.id);

    if (itensCompletosError) throw itensCompletosError;

    return {
      ...toCamelCaseProducao(producao),
      itens: (itensCompletos || []).map(toCamelCaseItem),
    };
  },
};
