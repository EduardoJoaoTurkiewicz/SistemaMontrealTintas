import { supabase } from './supabase';
import { safeNumber } from '../utils/numberUtils';
import type { Check, Boleto } from '../types';

export interface SaleStatusResult {
  status: 'pago' | 'pendente' | 'parcial';
  receivedAmount: number;
  pendingAmount: number;
}

export interface DebtStatusResult {
  isPaid: boolean;
  paidAmount: number;
  pendingAmount: number;
}

// Statuses that count as "paid" for checks and boletos
const CHECK_PAID_STATUS = 'compensado';
const BOLETO_PAID_STATUS = 'compensado';

export class StatusCalculationService {
  /**
   * Calculates sale status in-memory using already-loaded checks and boletos arrays.
   * Useful for optimistic UI updates before DB confirmation.
   */
  static calculateSaleStatus(
    sale: { totalValue: number },
    checks: Check[],
    boletos: Boleto[],
    saleId: string
  ): SaleStatusResult {
    const totalValue = safeNumber(sale.totalValue, 0);

    const saleChecks = checks.filter(c => c.saleId === saleId);
    const saleBoletos = boletos.filter(b => b.saleId === saleId);

    const totalChecks = saleChecks.reduce((s, c) => s + safeNumber(c.value, 0), 0);
    const totalBoletos = saleBoletos.reduce((s, b) => s + safeNumber(b.value, 0), 0);

    // If no installments exist, we cannot derive status from them
    if (totalChecks + totalBoletos === 0) {
      return {
        status: 'pendente',
        receivedAmount: safeNumber((sale as any).receivedAmount, 0),
        pendingAmount: safeNumber((sale as any).pendingAmount, 0),
      };
    }

    const checkPaid = saleChecks
      .filter(c => c.status === CHECK_PAID_STATUS)
      .reduce((s, c) => s + safeNumber(c.value, 0), 0);

    const boletoPaid = saleBoletos
      .filter(b => b.status === BOLETO_PAID_STATUS)
      .reduce((s, b) => s + safeNumber(b.finalAmount || b.value, 0), 0);

    const nonInstallment = Math.max(0, totalValue - totalChecks - totalBoletos);
    const received = Math.min(totalValue, nonInstallment + checkPaid + boletoPaid);
    const pending = Math.max(0, totalValue - received);

    let status: 'pago' | 'pendente' | 'parcial';
    if (pending <= 0.01) {
      status = 'pago';
    } else if (checkPaid + boletoPaid > 0.01) {
      status = 'parcial';
    } else {
      status = 'pendente';
    }

    return { status, receivedAmount: received, pendingAmount: pending };
  }

  /**
   * Calculates debt status in-memory using already-loaded checks and boletos arrays.
   */
  static calculateDebtStatus(
    debt: { totalValue: number },
    checks: Check[],
    boletos: Boleto[],
    debtId: string
  ): DebtStatusResult {
    const totalValue = safeNumber(debt.totalValue, 0);

    const debtChecks = checks.filter(c => c.debtId === debtId);
    const debtBoletos = boletos.filter(b => b.debtId === debtId);

    const totalChecks = debtChecks.reduce((s, c) => s + safeNumber(c.value, 0), 0);
    const totalBoletos = debtBoletos.reduce((s, b) => s + safeNumber(b.value, 0), 0);

    if (totalChecks + totalBoletos === 0) {
      return {
        isPaid: safeNumber((debt as any).isPaid ? 1 : 0, 0) === 1,
        paidAmount: safeNumber((debt as any).paidAmount, 0),
        pendingAmount: safeNumber((debt as any).pendingAmount, 0),
      };
    }

    const checkPaid = debtChecks
      .filter(c => c.status === CHECK_PAID_STATUS)
      .reduce((s, c) => s + safeNumber(c.value, 0), 0);

    const boletoPaid = debtBoletos
      .filter(b => b.status === BOLETO_PAID_STATUS)
      .reduce((s, b) => s + safeNumber(b.finalAmount || b.value, 0), 0);

    const nonInstallment = Math.max(0, totalValue - totalChecks - totalBoletos);
    const paidAmount = Math.min(totalValue, nonInstallment + checkPaid + boletoPaid);
    const pendingAmount = Math.max(0, totalValue - paidAmount);
    const isPaid = pendingAmount <= 0.01;

    return { isPaid, paidAmount, pendingAmount };
  }

  /**
   * Syncs sale status by directly calling the DB trigger function via RPC.
   * The trigger already fires automatically, but this can be called to force
   * an immediate recalculation if needed (e.g., after a batch operation).
   */
  static async syncSaleStatus(saleId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('recalculate_sale_status', {
        p_sale_id: saleId,
      });
      if (error) {
        console.error('StatusCalculationService.syncSaleStatus error:', error);
      }
    } catch (err) {
      console.error('StatusCalculationService.syncSaleStatus exception:', err);
    }
  }

  /**
   * Syncs debt status by directly calling the DB trigger function via RPC.
   */
  static async syncDebtStatus(debtId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('recalculate_debt_status', {
        p_debt_id: debtId,
      });
      if (error) {
        console.error('StatusCalculationService.syncDebtStatus error:', error);
      }
    } catch (err) {
      console.error('StatusCalculationService.syncDebtStatus exception:', err);
    }
  }

  /**
   * Derives a display-friendly four-state status for debts.
   * Priority: pago > vencido > parcial > pendente
   * "vencido" means at least one unpaid installment is past its due date.
   */
  static deriveDebtDisplayStatus(
    debt: {
      id?: string;
      isPaid?: boolean;
      paidAmount?: number;
      pendingAmount?: number;
      totalValue?: number;
    },
    checks: Check[] = [],
    boletos: Boleto[] = []
  ): 'pago' | 'vencido' | 'parcial' | 'pendente' {
    const total = safeNumber(debt.totalValue, 0);
    const paid = safeNumber(debt.paidAmount, 0);
    const pending = safeNumber(debt.pendingAmount, total);

    if (debt.isPaid || pending <= 0.01) return 'pago';

    // Check for overdue unpaid installments using today's date
    const today = new Date().toISOString().split('T')[0];
    if (debt.id) {
      const debtChecks = checks.filter(c => c.debtId === debt.id);
      const debtBoletos = boletos.filter(b => b.debtId === debt.id);
      const hasOverdue =
        debtChecks.some(c => c.status !== 'compensado' && c.dueDate < today) ||
        debtBoletos.some(b => b.status !== 'compensado' && b.dueDate < today);
      if (hasOverdue) return 'vencido';
    }

    if (paid > 0.01) return 'parcial';
    return 'pendente';
  }
}
