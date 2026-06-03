import { supabase } from './supabase';
import { safeNumber } from '../utils/numberUtils';
import { getCurrentDateISO, toISODateOnly, fromISODateOnly } from './dateOnly';
import toast from 'react-hot-toast';
import { registerCashTransaction } from '../services/financialCoreService';

export interface CreditCardSale {
  id: string;
  sale_id: string | null;
  client_name: string;
  total_amount: number;
  remaining_amount: number;
  installments: number;
  sale_date: string;
  first_due_date: string;
  status: string;
  anticipated: boolean;
  anticipated_date: string | null;
  anticipated_fee: number | null;
  anticipated_amount: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreditCardSaleInstallment {
  id: string;
  credit_card_sale_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  status: string;
  received_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditCardDebt {
  id: string;
  debt_id: string | null;
  supplier_name: string;
  total_amount: number;
  remaining_amount: number;
  installments: number;
  purchase_date: string;
  first_due_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreditCardDebtInstallment {
  id: string;
  credit_card_debt_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  status: string;
  paid_date: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Item 4 fix: a sale/debt is completed only when the installments array is
 * non-empty AND every entry has the expected paid status.
 * An empty array NEVER triggers 'completed'.
 */
function isAllReceived(installments: any[] | null | undefined): boolean {
  return (installments?.length ?? 0) > 0 && installments!.every(i => i.status === 'received');
}

function isAllPaid(installments: any[] | null | undefined): boolean {
  return (installments?.length ?? 0) > 0 && installments!.every(i => i.status === 'paid');
}

/** Build the installments array for a credit_card_sale. */
function buildSaleInstallments(
  creditCardSaleId: string,
  totalAmount: number,
  count: number,
  firstDueDate: string
): Array<{
  credit_card_sale_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  status: string;
}> {
  const installmentAmount = totalAmount / count;
  return Array.from({ length: count }, (_, i) => {
    const dueDate = fromISODateOnly(firstDueDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    return {
      credit_card_sale_id: creditCardSaleId,
      installment_number: i + 1,
      amount: installmentAmount,
      due_date: toISODateOnly(dueDate),
      status: 'pending',
    };
  });
}

/** Build the installments array for a credit_card_debt. */
function buildDebtInstallments(
  creditCardDebtId: string,
  totalAmount: number,
  count: number,
  firstDueDate: string
): Array<{
  credit_card_debt_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  status: string;
}> {
  const installmentAmount = totalAmount / count;
  return Array.from({ length: count }, (_, i) => {
    const dueDate = fromISODateOnly(firstDueDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    return {
      credit_card_debt_id: creditCardDebtId,
      installment_number: i + 1,
      amount: installmentAmount,
      due_date: toISODateOnly(dueDate),
      status: 'pending',
    };
  });
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const CreditCardService = {

  /**
   * Item 5 — Atomic creation via RPC.
   * Falls back to two-step insert with delete-on-failure rollback if the RPC
   * is unavailable.
   */
  async createFromSale(params: {
    saleId: string;
    clientName: string;
    totalAmount: number;
    installments: number;
    saleDate: string;
    firstDueDate: string;
  }): Promise<string> {
    const { saleId, clientName, totalAmount, installments, saleDate, firstDueDate } = params;

    // Attempt atomic RPC first (Item 5)
    const saleData = {
      sale_id:          saleId,
      client_name:      clientName,
      total_amount:     totalAmount,
      remaining_amount: totalAmount,
      installments,
      sale_date:        saleDate,
      first_due_date:   firstDueDate,
      status:           'active',
      anticipated:      false,
    };

    const installmentsForRpc = Array.from({ length: installments }, (_, i) => {
      const dueDate = fromISODateOnly(firstDueDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      return {
        installment_number: i + 1,
        amount:             totalAmount / installments,
        due_date:           toISODateOnly(dueDate),
        status:             'pending',
      };
    });

    const { data: rpcId, error: rpcError } = await supabase.rpc(
      'create_credit_card_sale_atomic',
      { p_sale_data: saleData, p_installments: installmentsForRpc }
    );

    if (!rpcError && rpcId) {
      return rpcId as string;
    }

    // RPC unavailable — fall back to two-step with manual rollback
    console.warn('[CreditCardService.createFromSale] RPC unavailable, using fallback:', rpcError?.message);

    const { data: sale, error: saleError } = await supabase
      .from('credit_card_sales')
      .insert(saleData)
      .select()
      .single();

    if (saleError) throw saleError;

    const installmentsData = buildSaleInstallments(sale.id, totalAmount, installments, firstDueDate);

    const { error: installmentsError } = await supabase
      .from('credit_card_sale_installments')
      .insert(installmentsData);

    if (installmentsError) {
      // Rollback: remove the orphan sale (Item 5)
      await supabase.from('credit_card_sales').delete().eq('id', sale.id);
      throw installmentsError;
    }

    return sale.id;
  },

  async createFromDebt(params: {
    debtId: string;
    supplierName: string;
    totalAmount: number;
    installments: number;
    purchaseDate: string;
    firstDueDate: string;
  }): Promise<string> {
    const { debtId, supplierName, totalAmount, installments, purchaseDate, firstDueDate } = params;

    const debtData = {
      debt_id:          debtId,
      supplier_name:    supplierName,
      total_amount:     totalAmount,
      remaining_amount: totalAmount,
      installments,
      purchase_date:    purchaseDate,
      first_due_date:   firstDueDate,
      status:           'active',
    };

    const installmentsForRpc = Array.from({ length: installments }, (_, i) => {
      const dueDate = fromISODateOnly(firstDueDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      return {
        installment_number: i + 1,
        amount:             totalAmount / installments,
        due_date:           toISODateOnly(dueDate),
        status:             'pending',
      };
    });

    const { data: rpcId, error: rpcError } = await supabase.rpc(
      'create_credit_card_debt_atomic',
      { p_debt_data: debtData, p_installments: installmentsForRpc }
    );

    if (!rpcError && rpcId) {
      return rpcId as string;
    }

    console.warn('[CreditCardService.createFromDebt] RPC unavailable, using fallback:', rpcError?.message);

    const { data: debt, error: debtError } = await supabase
      .from('credit_card_debts')
      .insert(debtData)
      .select()
      .single();

    if (debtError) throw debtError;

    const installmentsData = buildDebtInstallments(debt.id, totalAmount, installments, firstDueDate);

    const { error: installmentsError } = await supabase
      .from('credit_card_debt_installments')
      .insert(installmentsData);

    if (installmentsError) {
      await supabase.from('credit_card_debts').delete().eq('id', debt.id);
      throw installmentsError;
    }

    return debt.id;
  },

  async createFromAcerto(params: {
    acertoId: string | undefined;
    clientName: string;
    totalAmount: number;
    installments: number;
    paymentDate: string;
    firstDueDate: string;
  }): Promise<string> {
    const { clientName, totalAmount, installments, paymentDate, firstDueDate } = params;

    const saleData = {
      sale_id:          null,
      client_name:      clientName,
      total_amount:     totalAmount,
      remaining_amount: totalAmount,
      installments,
      sale_date:        paymentDate,
      first_due_date:   firstDueDate,
      status:           'active',
      anticipated:      false,
    };

    const installmentsForRpc = Array.from({ length: installments }, (_, i) => {
      const dueDate = fromISODateOnly(firstDueDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      return {
        installment_number: i + 1,
        amount:             totalAmount / installments,
        due_date:           toISODateOnly(dueDate),
        status:             'pending',
      };
    });

    const { data: rpcId, error: rpcError } = await supabase.rpc(
      'create_credit_card_sale_atomic',
      { p_sale_data: saleData, p_installments: installmentsForRpc }
    );

    if (!rpcError && rpcId) {
      return rpcId as string;
    }

    console.warn('[CreditCardService.createFromAcerto] RPC unavailable, using fallback:', rpcError?.message);

    const { data: sale, error: saleError } = await supabase
      .from('credit_card_sales')
      .insert(saleData)
      .select()
      .single();

    if (saleError) throw saleError;

    const installmentsData = buildSaleInstallments(sale.id, totalAmount, installments, firstDueDate);

    const { error: installmentsError } = await supabase
      .from('credit_card_sale_installments')
      .insert(installmentsData);

    if (installmentsError) {
      await supabase.from('credit_card_sales').delete().eq('id', sale.id);
      throw installmentsError;
    }

    return sale.id;
  },

  async anticipateSale(saleId: string, anticipationFee: number): Promise<void> {
    const { data: sale, error: saleError } = await supabase
      .from('credit_card_sales')
      .select('*')
      .eq('id', saleId)
      .single();

    if (saleError) throw saleError;
    if (!sale) throw new Error('Venda não encontrada');

    const anticipatedAmount = sale.remaining_amount - anticipationFee;

    const { error: updateError } = await supabase
      .from('credit_card_sales')
      .update({
        anticipated:        true,
        anticipated_date:   getCurrentDateISO(),
        anticipated_fee:    anticipationFee,
        anticipated_amount: anticipatedAmount,
        remaining_amount:   0,
        status:             'completed',
      })
      .eq('id', saleId);

    if (updateError) throw updateError;

    const { error: installmentsError } = await supabase
      .from('credit_card_sale_installments')
      .update({ status: 'received', received_date: getCurrentDateISO() })
      .eq('credit_card_sale_id', saleId)
      .eq('status', 'pending');

    if (installmentsError) throw installmentsError;

    // Anticipation cash entry — use related_id as idempotency key (no installment_id)
    await registerCashTransaction({
      date:          getCurrentDateISO(),
      type:          'entrada',
      amount:        anticipatedAmount,
      description:   `Antecipação de venda (Cartão de Crédito) - ${sale.client_name}`,
      category:      'antecipacao_cartao',
      relatedId:     saleId,
      paymentMethod: 'cartao_credito',
    });

    const { AgendaAutoService } = await import('./agendaAutoService');
    await AgendaAutoService.removeSaleInstallmentsFromAgenda(saleId);
  },

  /**
   * Items 2 & 3 & 4 — register a single credit-card sale installment as received.
   *
   * - Idempotency: installment_id is the primary guard (unique DB index).
   * - Status update: installment → 'received'.
   * - Cash entry: via registerCashTransaction (never duplicated).
   * - Parent status: recalculated only when array is non-empty (Item 4).
   */
  async registerSaleInstallmentPayment(
    installmentId: string,
    receivedDate: string,
    observations?: string
  ): Promise<void> {
    const { data: installment, error: installmentError } = await supabase
      .from('credit_card_sale_installments')
      .select('*, credit_card_sales(*)')
      .eq('id', installmentId)
      .maybeSingle();

    if (installmentError) throw installmentError;
    if (!installment) throw new Error('Parcela não encontrada');

    const sale = (installment as any).credit_card_sales;

    const { error: updateError } = await supabase
      .from('credit_card_sale_installments')
      .update({ status: 'received', received_date: receivedDate })
      .eq('id', installmentId);

    if (updateError) throw updateError;

    const description = `Recebimento parcela ${installment.installment_number}/${sale.installments} - ${sale.client_name} (Cartão de Crédito)${observations ? ` - ${observations}` : ''}`;

    // Item 3: installment_id is the primary idempotency key
    await registerCashTransaction({
      date:          receivedDate,
      type:          'entrada',
      amount:        installment.amount,
      description,
      category:      'recebimento_cartao',
      relatedId:     sale.id,
      installmentId: installmentId,
      paymentMethod: 'cartao_credito',
    });

    const { data: allInstallments } = await supabase
      .from('credit_card_sale_installments')
      .select('status')
      .eq('credit_card_sale_id', sale.id);

    // Item 4: non-empty check
    if (isAllReceived(allInstallments)) {
      await supabase
        .from('credit_card_sales')
        .update({ remaining_amount: 0, status: 'completed' })
        .eq('id', sale.id);
    } else {
      const remainingAmount =
        (allInstallments ?? []).filter(i => i.status === 'pending').reduce((sum, i: any) => sum + i.amount, 0);
      await supabase
        .from('credit_card_sales')
        .update({ remaining_amount: remainingAmount })
        .eq('id', sale.id);
    }
  },

  /**
   * Items 2 & 3 & 4 — register a single credit-card debt installment as paid.
   */
  async registerDebtInstallmentPayment(
    installmentId: string,
    paidDate: string,
    observations?: string
  ): Promise<void> {
    const { data: installment, error: installmentError } = await supabase
      .from('credit_card_debt_installments')
      .select('*, credit_card_debts(*)')
      .eq('id', installmentId)
      .maybeSingle();

    if (installmentError) throw installmentError;
    if (!installment) throw new Error('Parcela não encontrada');

    const debt = (installment as any).credit_card_debts;

    const { error: updateError } = await supabase
      .from('credit_card_debt_installments')
      .update({ status: 'paid', paid_date: paidDate })
      .eq('id', installmentId);

    if (updateError) throw updateError;

    // Item 3: installment_id is the primary idempotency key
    await registerCashTransaction({
      date:          paidDate,
      type:          'saida',
      amount:        installment.amount,
      description:   `Pagamento parcela ${installment.installment_number}/${debt.installments} - ${debt.supplier_name} (Cartão de Crédito)${observations ? ` - ${observations}` : ''}`,
      category:      'pagamento_cartao',
      relatedId:     debt.id,
      installmentId: installmentId,
      paymentMethod: 'cartao_credito',
    });

    const { data: allDebtInstallments } = await supabase
      .from('credit_card_debt_installments')
      .select('status')
      .eq('credit_card_debt_id', debt.id);

    // Item 4: non-empty check
    if (isAllPaid(allDebtInstallments)) {
      await supabase
        .from('credit_card_debts')
        .update({ remaining_amount: 0, status: 'completed' })
        .eq('id', debt.id);
    } else {
      const remainingAmount =
        (allDebtInstallments ?? []).filter(i => i.status === 'pending').reduce((sum, i: any) => sum + i.amount, 0);
      await supabase
        .from('credit_card_debts')
        .update({ remaining_amount: remainingAmount })
        .eq('id', debt.id);
    }
  },

  /**
   * Items 2, 3, 4 — batch-process all installments whose due_date has passed.
   */
  async checkAndProcessDueInstallments(): Promise<void> {
    const today = getCurrentDateISO();

    // ── Sale installments ──────────────────────────────────────────────────────
    const { data: dueInstallments, error: queryError } = await supabase
      .from('credit_card_sale_installments')
      .select('*, credit_card_sales!inner(*)')
      .eq('status', 'pending')
      .lte('due_date', today);

    if (queryError) {
      console.error('[CreditCardService] Erro ao buscar parcelas vencidas:', queryError);
      return;
    }

    for (const installment of dueInstallments ?? []) {
      const sale = (installment as any).credit_card_sales;

      const { error: updateError } = await supabase
        .from('credit_card_sale_installments')
        .update({ status: 'received', received_date: today })
        .eq('id', installment.id);

      if (updateError) {
        console.error(`[CreditCardService] Error updating installment ${installment.id}:`, updateError);
        continue;
      }

      // Item 3: installment_id primary guard
      await registerCashTransaction({
        date:          today,
        type:          'entrada',
        amount:        installment.amount,
        description:   `Recebimento parcela ${installment.installment_number} - ${sale.client_name} (Cartão de Crédito)`,
        category:      'recebimento_cartao',
        relatedId:     sale.id,
        installmentId: installment.id,
        paymentMethod: 'cartao_credito',
      });

      const { data: allInstallments } = await supabase
        .from('credit_card_sale_installments')
        .select('status, amount')
        .eq('credit_card_sale_id', sale.id);

      // Item 4: non-empty check
      if (isAllReceived(allInstallments)) {
        await supabase
          .from('credit_card_sales')
          .update({ remaining_amount: 0, status: 'completed' })
          .eq('id', sale.id);
      } else {
        const remainingAmount =
          (allInstallments ?? []).filter(i => i.status === 'pending').reduce((sum, i: any) => sum + i.amount, 0);
        await supabase
          .from('credit_card_sales')
          .update({ remaining_amount: remainingAmount })
          .eq('id', sale.id);
      }
    }

    // ── Debt installments ──────────────────────────────────────────────────────
    const { data: dueDebtInstallments, error: debtQueryError } = await supabase
      .from('credit_card_debt_installments')
      .select('*, credit_card_debts!inner(*)')
      .eq('status', 'pending')
      .lte('due_date', today);

    if (debtQueryError) {
      console.error('[CreditCardService] Erro ao buscar parcelas de dívida vencidas:', debtQueryError);
      return;
    }

    for (const installment of dueDebtInstallments ?? []) {
      const debt = (installment as any).credit_card_debts;

      const { error: updateError } = await supabase
        .from('credit_card_debt_installments')
        .update({ status: 'paid', paid_date: today })
        .eq('id', installment.id);

      if (updateError) {
        console.error(`[CreditCardService] Error updating debt installment ${installment.id}:`, updateError);
        continue;
      }

      // Item 3: installment_id primary guard
      await registerCashTransaction({
        date:          today,
        type:          'saida',
        amount:        installment.amount,
        description:   `Pagamento parcela ${installment.installment_number} - ${debt.supplier_name} (Cartão de Crédito)`,
        category:      'pagamento_cartao',
        relatedId:     debt.id,
        installmentId: installment.id,
        paymentMethod: 'cartao_credito',
      });

      const { data: allDebtInstallments } = await supabase
        .from('credit_card_debt_installments')
        .select('status, amount')
        .eq('credit_card_debt_id', debt.id);

      // Item 4: non-empty check
      if (isAllPaid(allDebtInstallments)) {
        await supabase
          .from('credit_card_debts')
          .update({ remaining_amount: 0, status: 'completed' })
          .eq('id', debt.id);
      } else {
        const remainingAmount =
          (allDebtInstallments ?? []).filter(i => i.status === 'pending').reduce((sum, i: any) => sum + i.amount, 0);
        await supabase
          .from('credit_card_debts')
          .update({ remaining_amount: remainingAmount })
          .eq('id', debt.id);
      }
    }
  },
};
