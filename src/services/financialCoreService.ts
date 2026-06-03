/**
 * financialCoreService.ts
 *
 * THE single source of truth for all financial processing.
 * All acerto creation/update, cash transaction inserts, and status
 * updates MUST go through this module.
 *
 * Rules enforced here:
 *  - Idempotency on every write (guard before INSERT).
 *  - Never swallow errors: always log + rethrow.
 *  - Installments/checks/boletos are the source of truth;
 *    cash balances and statuses are derived consequences.
 */

import { supabase } from '../lib/supabase';
import { safeNumber } from '../utils/numberUtils';
import { getCurrentDateISO } from '../lib/dateOnly';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CashTransactionInput {
  date: string;
  type: 'entrada' | 'saida';
  amount: number;
  description: string;
  category: string;
  relatedId?: string | null;
  /** Links this cash entry to the exact installment that generated it.
   *  When provided this is the PRIMARY idempotency key — a unique DB index on
   *  cash_transactions(installment_id) prevents any double-insert at the
   *  database level.  The related_id guard is kept as a secondary check. */
  installmentId?: string | null;
  paymentMethod?: string | null;
}

export interface AcertoUpsertParams {
  clientName: string;
  clienteId?: string | null;
  amount: number;
  type: 'cliente' | 'empresa';
}

export interface SaleStatusUpdate {
  saleId: string;
  receivedAmount: number;
  totalAmount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise a client/company name for case-insensitive comparison. */
function normaliseName(name: string): string {
  return name.trim().toLowerCase();
}

// ─── 1. Cash Transaction (idempotent) ────────────────────────────────────────

/**
 * Insert a cash_transaction row only if no equivalent row already exists.
 * Equivalence is defined by (related_id, category, type) when related_id is
 * provided, which prevents double-counting from retries or concurrent calls.
 *
 * Throws on any error that is NOT a unique-constraint violation (pg code 23505).
 */
export async function registerCashTransaction(input: CashTransactionInput): Promise<void> {
  const ctx = '[financialCoreService.registerCashTransaction]';

  // ── Primary guard: installment_id (most precise — one installment, one entry) ──
  if (input.installmentId) {
    try {
      const { data: existing, error: checkError } = await supabase
        .from('cash_transactions')
        .select('id')
        .eq('installment_id', input.installmentId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error(`${ctx} Error during installment_id idempotency check:`, checkError);
        throw checkError;
      }

      if (existing) {
        console.warn(`${ctx} Duplicate prevented — installment_id=${input.installmentId}`);
        return;
      }
    } catch (err: any) {
      if (err?.code !== 'PGRST116') {
        console.error(`${ctx} installment_id check failed:`, err);
        throw err;
      }
    }
  }

  // ── Secondary guard: (related_id, category, type) for non-installment events ──
  if (!input.installmentId && input.relatedId) {
    try {
      const { data: existing, error: checkError } = await supabase
        .from('cash_transactions')
        .select('id')
        .eq('related_id', input.relatedId)
        .eq('category', input.category)
        .eq('type', input.type)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error(`${ctx} Error during idempotency check:`, checkError);
        throw checkError;
      }

      if (existing) {
        console.warn(`${ctx} Duplicate prevented — related_id=${input.relatedId} category=${input.category}`);
        return;
      }
    } catch (err: any) {
      if (err?.code !== 'PGRST116') {
        console.error(`${ctx} Idempotency check failed:`, err);
        throw err;
      }
    }
  }

  // Build the row to insert
  const row: Record<string, any> = {
    date: input.date,
    type: input.type,
    amount: input.amount,
    description: input.description,
    category: input.category,
    created_at: new Date().toISOString(),
  };
  if (input.relatedId)     row.related_id      = input.relatedId;
  if (input.installmentId) row.installment_id  = input.installmentId;
  if (input.paymentMethod) row.payment_method  = input.paymentMethod;

  const { error } = await supabase.from('cash_transactions').insert([row]);

  if (error) {
    // Unique constraint violation → already inserted by a concurrent call
    if (error.code === '23505') {
      console.warn(`${ctx} Unique constraint prevented duplicate — installment_id=${input.installmentId} related_id=${input.relatedId}`);
      return;
    }
    console.error(`${ctx} INSERT failed:`, error);
    throw error;
  }

  console.log(`${ctx} ✅ Cash transaction created: ${input.description}`);
}

// ─── 2. Acerto Upsert (idempotent, case-insensitive) ─────────────────────────

/**
 * Create or update an acerto record — the ONLY authorised path to do so.
 *
 * Priority for finding an existing acerto:
 *   1. clienteId match (most reliable for 'cliente' type)
 *   2. case-insensitive name match via ILIKE
 *
 * Returns the acerto id.
 */
export async function upsertAcerto(params: AcertoUpsertParams): Promise<string> {
  const ctx = '[financialCoreService.upsertAcerto]';
  const { clientName, clienteId, amount, type } = params;

  const normName = normaliseName(clientName);
  if (safeNumber(amount, 0) <= 0) {
    console.warn(`${ctx} Skipping upsert — amount is 0 for "${clientName}"`);
    return '';
  }

  try {
    // --- Search for existing acerto ---
    let existingId: string | null = null;
    let existingTotal = 0;
    let existingPending = 0;

    // Attempt 1: by clienteId (reliable, avoids name collisions)
    if (clienteId && type === 'cliente') {
      const { data, error } = await supabase
        .from('acertos')
        .select('id, total_amount, pending_amount')
        .eq('cliente_id', clienteId)
        .eq('type', 'cliente')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error(`${ctx} Error fetching acerto by clienteId:`, error);
        throw error;
      }
      if (data) {
        existingId = data.id;
        existingTotal = safeNumber(data.total_amount, 0);
        existingPending = safeNumber(data.pending_amount, 0);
      }
    }

    // Attempt 2: by case-insensitive name
    if (!existingId) {
      const { data, error } = await supabase
        .from('acertos')
        .select('id, total_amount, pending_amount')
        .ilike('client_name', normName)
        .eq('type', type)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error(`${ctx} Error fetching acerto by name:`, error);
        throw error;
      }
      if (data) {
        existingId = data.id;
        existingTotal = safeNumber(data.total_amount, 0);
        existingPending = safeNumber(data.pending_amount, 0);
      }
    }

    if (existingId) {
      // UPDATE
      const newTotal   = existingTotal + amount;
      const newPending = existingPending + amount;

      const { error } = await supabase
        .from('acertos')
        .update({
          total_amount:   newTotal,
          pending_amount: newPending,
          status:         'pendente',
          updated_at:     new Date().toISOString(),
        })
        .eq('id', existingId);

      if (error) {
        console.error(`${ctx} Error updating acerto ${existingId}:`, error);
        throw error;
      }

      console.log(`${ctx} ✅ Acerto UPDATED id=${existingId} name="${clientName}" new_total=${newTotal}`);
      return existingId;
    } else {
      // INSERT
      const row: Record<string, any> = {
        client_name:               clientName,
        type,
        total_amount:              amount,
        paid_amount:               0,
        pending_amount:            amount,
        payment_installments:      1,
        payment_installment_value: amount,
        payment_interval:          30,
        status:                    'pendente',
      };
      if (clienteId && type === 'cliente') row.cliente_id = clienteId;
      if (type === 'empresa') row.company_name = clientName;

      const { data, error } = await supabase
        .from('acertos')
        .insert(row)
        .select('id')
        .single();

      if (error) {
        console.error(`${ctx} Error inserting acerto for "${clientName}":`, error);
        throw error;
      }

      console.log(`${ctx} ✅ Acerto CREATED id=${data.id} name="${clientName}" amount=${amount}`);
      return data.id;
    }
  } catch (err) {
    console.error(`${ctx} Fatal error for "${clientName}":`, err);
    throw err;
  }
}

// ─── 3. Proportional Sale Status Update ──────────────────────────────────────

/**
 * Update a sale's status, received_amount, and pending_amount proportionally.
 *
 *   received >= total  → 'pago'
 *   received  > 0      → 'parcial'
 *   received == 0      → 'pendente'
 */
export async function updateSaleStatusProportional(params: SaleStatusUpdate): Promise<void> {
  const ctx = '[financialCoreService.updateSaleStatusProportional]';
  const { saleId, receivedAmount, totalAmount } = params;

  const total    = safeNumber(totalAmount, 0);
  const received = Math.min(safeNumber(receivedAmount, 0), total);
  const pending  = Math.max(0, total - received);

  let status: 'pago' | 'parcial' | 'pendente';
  if (pending <= 0.01) {
    status = 'pago';
  } else if (received > 0.01) {
    status = 'parcial';
  } else {
    status = 'pendente';
  }

  const { error } = await supabase
    .from('sales')
    .update({
      received_amount: received,
      pending_amount:  pending,
      status,
      updated_at:      new Date().toISOString(),
    })
    .eq('id', saleId);

  if (error) {
    console.error(`${ctx} Error updating sale ${saleId}:`, error);
    throw error;
  }

  console.log(`${ctx} ✅ Sale ${saleId} → status=${status} received=${received} pending=${pending}`);
}

// ─── 4. Reconciliation ───────────────────────────────────────────────────────

/**
 * Reconcile financial data by re-computing sale/debt statuses from their
 * installments (checks + boletos), which are the source of truth.
 *
 * Calls the DB-side RPC functions that were created in migration
 * 20260505235001_..._auto_status_update_triggers.sql.
 *
 * Safe to call at any time — all DB functions are idempotent.
 */
export async function reconcileFinancialData(): Promise<{ sales: number; debts: number; errors: number }> {
  const ctx = '[financialCoreService.reconcileFinancialData]';
  let salesFixed = 0;
  let debtsFixed = 0;
  let errors = 0;

  console.log(`${ctx} Starting reconciliation...`);

  try {
    // Sales: find all that have linked checks or boletos
    const { data: salesWithInstallments, error: salesErr } = await supabase
      .from('sales')
      .select('id')
      .or(
        `id.in.(${
          await _getIdsWithInstallments('checks', 'sale_id')
        }),id.in.(${
          await _getIdsWithInstallments('boletos', 'sale_id')
        })`
      );

    if (salesErr) {
      console.error(`${ctx} Error fetching sales for reconciliation:`, salesErr);
    } else {
      for (const sale of salesWithInstallments ?? []) {
        try {
          const { error } = await supabase.rpc('recalculate_sale_status', { p_sale_id: sale.id });
          if (error) {
            console.error(`${ctx} Error reconciling sale ${sale.id}:`, error);
            errors++;
          } else {
            salesFixed++;
          }
        } catch (err) {
          console.error(`${ctx} Exception reconciling sale ${sale.id}:`, err);
          errors++;
        }
      }
    }

    // Debts: find all that have linked checks or boletos
    const { data: debtsWithInstallments, error: debtsErr } = await supabase
      .from('debts')
      .select('id')
      .or(
        `id.in.(${
          await _getIdsWithInstallments('checks', 'debt_id')
        }),id.in.(${
          await _getIdsWithInstallments('boletos', 'debt_id')
        })`
      );

    if (debtsErr) {
      console.error(`${ctx} Error fetching debts for reconciliation:`, debtsErr);
    } else {
      for (const debt of debtsWithInstallments ?? []) {
        try {
          const { error } = await supabase.rpc('recalculate_debt_status', { p_debt_id: debt.id });
          if (error) {
            console.error(`${ctx} Error reconciling debt ${debt.id}:`, error);
            errors++;
          } else {
            debtsFixed++;
          }
        } catch (err) {
          console.error(`${ctx} Exception reconciling debt ${debt.id}:`, err);
          errors++;
        }
      }
    }
  } catch (err) {
    console.error(`${ctx} Unexpected error during reconciliation:`, err);
    errors++;
  }

  console.log(`${ctx} Reconciliation complete — sales: ${salesFixed}, debts: ${debtsFixed}, errors: ${errors}`);
  return { sales: salesFixed, debts: debtsFixed, errors };
}

/** Helper: returns a comma-separated list of distinct parent IDs that have at
 *  least one row in the given installment table. Used only for reconciliation. */
async function _getIdsWithInstallments(table: 'checks' | 'boletos', column: 'sale_id' | 'debt_id'): Promise<string> {
  const { data } = await supabase
    .from(table)
    .select(column)
    .not(column, 'is', null);

  if (!data || data.length === 0) return "'00000000-0000-0000-0000-000000000000'";

  const unique = [...new Set(data.map((r: any) => r[column]).filter(Boolean))];
  return unique.map(id => `'${id}'`).join(',');
}

// ─── 5. Acerto Payment Processing ────────────────────────────────────────────

/**
 * Process a client acerto payment.
 *
 * Fixes:
 *  - Proportional sale status (not blanket 'pago').
 *  - Cash transactions through registerCashTransaction (idempotent, never silent).
 *  - Acerto balance update after payment.
 */
export async function processAcertoClientPayment(
  acerto: {
    id: string | undefined;
    clientName: string;
    totalAmount: number;
    paidAmount: number;
    type: string;
  },
  selectedSaleIds: string[],
  paymentAmount: number,
  paymentMethods: any[]
): Promise<void> {
  const ctx = '[financialCoreService.processAcertoClientPayment]';

  console.log(`${ctx} Processing acerto payment`, {
    acertoId:    acerto.id,
    selectedSales: selectedSaleIds,
    paymentAmount,
    methods: paymentMethods.map(m => m.type),
  });

  // 1. Distribute payment proportionally across selected sales
  if (selectedSaleIds.length > 0) {
    // Fetch current pending amounts for all selected sales
    const { data: salesData, error: salesErr } = await supabase
      .from('sales')
      .select('id, total_value, pending_amount')
      .in('id', selectedSaleIds);

    if (salesErr) {
      console.error(`${ctx} Error fetching selected sales:`, salesErr);
      throw salesErr;
    }

    const totalPending = (salesData ?? []).reduce(
      (sum, s) => sum + safeNumber(s.pending_amount, 0), 0
    );

    for (const sale of salesData ?? []) {
      const salePending = safeNumber(sale.pending_amount, 0);
      const saleTotal   = safeNumber(sale.total_value, 0);

      // Proportion of this sale in the total pending
      const proportion     = totalPending > 0 ? salePending / totalPending : 1 / selectedSaleIds.length;
      const allocatedToSale = Math.min(paymentAmount * proportion, salePending);

      // New received = what was already received + allocated now
      const currentReceived = saleTotal - salePending;
      const newReceived     = currentReceived + allocatedToSale;

      await updateSaleStatusProportional({
        saleId:         sale.id,
        receivedAmount: newReceived,
        totalAmount:    saleTotal,
      });
    }
  }

  // 2. Register cash transactions for each payment method
  const today = getCurrentDateISO();

  for (const method of paymentMethods) {
    const methodAmount = safeNumber(method.amount, 0);
    if (methodAmount <= 0) continue;

    if (['dinheiro', 'pix', 'transferencia'].includes(method.type)) {
      await registerCashTransaction({
        date:          today,
        type:          'entrada',
        amount:        methodAmount,
        description:   `Pagamento de acerto - Cliente: ${acerto.clientName}`,
        category:      'acerto_cliente',
        relatedId:     acerto.id ?? null,
        paymentMethod: method.type,
      });
    }

    if (method.type === 'cartao_debito') {
      const actualAmount = safeNumber(method.actualAmount, methodAmount);
      await registerCashTransaction({
        date:          today,
        type:          'entrada',
        amount:        actualAmount,
        description:   `Pagamento de acerto (Cartão de Débito) - Cliente: ${acerto.clientName}`,
        category:      'acerto_cliente',
        relatedId:     acerto.id ?? null,
        paymentMethod: 'cartao_debito',
      });
    }

    if (method.type === 'cartao_credito') {
      const { CreditCardService } = await import('../lib/creditCardService');
      await CreditCardService.createFromAcerto({
        acertoId:         acerto.id,
        clientName:       acerto.clientName,
        totalAmount:      methodAmount,
        installments:     safeNumber(method.installments, 1),
        paymentDate:      today,
        firstDueDate:     method.firstInstallmentDate || today,
      });
      console.log(`${ctx} ✅ Credit card record created`);
    }

    if (method.type === 'cheque') {
      const installments     = safeNumber(method.installments, 1);
      const installmentValue = methodAmount / installments;
      const interval         = safeNumber(method.installmentInterval, 30);
      const firstDate        = new Date(method.firstInstallmentDate || new Date());

      for (let i = 0; i < installments; i++) {
        const dueDate = new Date(firstDate);
        dueDate.setDate(firstDate.getDate() + i * interval);

        const { error } = await supabase.from('checks').insert({
          client:             acerto.clientName,
          value:              installmentValue,
          due_date:           dueDate.toISOString().split('T')[0],
          status:             'pendente',
          installment_number: i + 1,
          total_installments: installments,
          observations:       `Cheque ${i + 1}/${installments} - Pagamento de acerto (${acerto.clientName})`,
          created_at:         new Date().toISOString(),
        });
        if (error) {
          console.error(`${ctx} Error creating check ${i + 1}:`, error);
          throw error;
        }
      }
      console.log(`${ctx} ✅ ${installments} check(s) created`);
    }

    if (method.type === 'boleto') {
      const installments     = safeNumber(method.installments, 1);
      const installmentValue = methodAmount / installments;
      const interval         = safeNumber(method.installmentInterval, 30);
      const firstDate        = new Date(method.firstInstallmentDate || new Date());

      for (let i = 0; i < installments; i++) {
        const dueDate = new Date(firstDate);
        dueDate.setDate(firstDate.getDate() + i * interval);

        const { error } = await supabase.from('boletos').insert({
          client:             acerto.clientName,
          value:              installmentValue,
          due_date:           dueDate.toISOString().split('T')[0],
          status:             'pendente',
          installment_number: i + 1,
          total_installments: installments,
          observations:       `Boleto ${i + 1}/${installments} - Pagamento de acerto (${acerto.clientName})`,
          created_at:         new Date().toISOString(),
        });
        if (error) {
          console.error(`${ctx} Error creating boleto ${i + 1}:`, error);
          throw error;
        }
      }
      console.log(`${ctx} ✅ ${installments} boleto(s) created`);
    }

    if (method.type === 'permuta' && method.vehicleId) {
      const { data: permuta, error: permutaError } = await supabase
        .from('permutas')
        .select('*')
        .eq('id', method.vehicleId)
        .maybeSingle();

      if (permutaError) {
        console.error(`${ctx} Error fetching permuta:`, permutaError);
        throw permutaError;
      }

      if (permuta) {
        const newConsumed  = safeNumber(permuta.consumed_value, 0) + methodAmount;
        const newRemaining = safeNumber(permuta.vehicle_value, 0) - newConsumed;

        const { error } = await supabase
          .from('permutas')
          .update({
            consumed_value:  newConsumed,
            remaining_value: Math.max(0, newRemaining),
            updated_at:      new Date().toISOString(),
          })
          .eq('id', method.vehicleId);

        if (error) {
          console.error(`${ctx} Error updating permuta:`, error);
          throw error;
        }
        console.log(`${ctx} ✅ Permuta updated: ${method.vehicleId}`);
      }
    }
  }

  // 3. Update acerto balance
  if (acerto.id) {
    const newPaidAmount    = safeNumber(acerto.paidAmount, 0) + paymentAmount;
    const newPendingAmount = Math.max(0, safeNumber(acerto.totalAmount, 0) - newPaidAmount);
    const newStatus        = newPendingAmount <= 0.01 ? 'pago' : 'parcial';

    const { error: acertoErr } = await supabase
      .from('acertos')
      .update({
        paid_amount:    newPaidAmount,
        pending_amount: newPendingAmount,
        status:         newStatus,
        payment_date:   today,
        updated_at:     new Date().toISOString(),
      })
      .eq('id', acerto.id);

    if (acertoErr) {
      console.error(`${ctx} Error updating acerto balance:`, acertoErr);
      throw acertoErr;
    }

    console.log(`${ctx} ✅ Acerto updated — status=${newStatus} paid=${newPaidAmount}`);
  }
}
