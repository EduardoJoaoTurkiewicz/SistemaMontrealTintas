// Service to handle cash balance updates when payments are marked as paid
import { supabase } from './supabase';
import { supabaseServices } from './supabaseServices';
import { safeNumber } from '../utils/numberUtils';

export class CashBalanceService {
  // Update cash balance when a check is marked as paid
  static async handleCheckPayment(check: any, oldStatus: string, newStatus: string): Promise<void> {
    if (oldStatus !== 'compensado' && newStatus === 'compensado') {
      const amount = safeNumber(check.value, 0);
      
      if (check.isOwnCheck || check.isCompanyPayable) {
        // Company's own check = cash outflow
        await this.createCashTransaction({
          date: check.paymentDate || new Date().toISOString().split('T')[0],
          type: 'saida',
          amount: amount,
          description: `Cheque próprio pago - ${check.companyName || check.client}`,
          category: 'cheque',
          relatedId: check.id,
          paymentMethod: 'cheque'
        });
      } else {
        // Third-party check = cash inflow
        await this.createCashTransaction({
          date: check.paymentDate || new Date().toISOString().split('T')[0],
          type: 'entrada',
          amount: amount,
          description: `Cheque compensado - ${check.client}`,
          category: 'cheque',
          relatedId: check.id,
          paymentMethod: 'cheque'
        });
      }
    }
  }

  // Update cash balance when a boleto is marked as paid
  static async handleBoletoPayment(boleto: any, oldStatus: string, newStatus: string): Promise<void> {
    if (oldStatus !== 'compensado' && newStatus === 'compensado') {
      const amount = safeNumber(boleto.value, 0);
      const finalAmount = safeNumber(boleto.finalAmount, amount);
      const notaryCosts = safeNumber(boleto.notaryCosts, 0);
      
      if (boleto.isCompanyPayable) {
        // Company's boleto = cash outflow
        await this.createCashTransaction({
          date: boleto.paymentDate || new Date().toISOString().split('T')[0],
          type: 'saida',
          amount: finalAmount,
          description: `Boleto pago - ${boleto.companyName || boleto.client}`,
          category: 'boleto',
          relatedId: boleto.id,
          paymentMethod: 'boleto'
        });
      } else {
        // Received boleto = cash inflow (minus notary costs)
        const netAmount = finalAmount - notaryCosts;
        
        await this.createCashTransaction({
          date: boleto.paymentDate || new Date().toISOString().split('T')[0],
          type: 'entrada',
          amount: netAmount,
          description: `Boleto recebido - ${boleto.client}`,
          category: 'boleto',
          relatedId: boleto.id,
          paymentMethod: 'boleto'
        });
        
        // Create separate transaction for notary costs if any
        if (notaryCosts > 0) {
          await this.createCashTransaction({
            date: boleto.paymentDate || new Date().toISOString().split('T')[0],
            type: 'saida',
            amount: notaryCosts,
            description: `Custos de cartório - ${boleto.client}`,
            category: 'outro',
            relatedId: boleto.id,
            paymentMethod: 'cartorio'
          });
        }
      }
    }
  }

  // Create cash transaction with idempotency guard (Layer 2)
  private static async createCashTransaction(transactionData: any): Promise<void> {
    try {
      // Layer 2: check for an existing transaction with the same related_id + category
      // to prevent duplicate entries (e.g. from double-clicks or retries).
      if (transactionData.relatedId) {
        const { data: existing } = await supabase
          .from('cash_transactions')
          .select('id')
          .eq('related_id', transactionData.relatedId)
          .eq('category', transactionData.category)
          .maybeSingle();

        if (existing) {
          console.warn('⚠️ Cash transaction already exists for related_id:', transactionData.relatedId, '— skipping duplicate.');
          return;
        }
      }

      await supabaseServices.cashTransactions.create(transactionData);
      console.log('✅ Cash transaction created:', transactionData.description);
    } catch (error: any) {
      // Layer 3: unique constraint violation (23505) means the DB already has this row
      if (error?.code === '23505') {
        console.warn('⚠️ Unique constraint prevented duplicate cash transaction for related_id:', transactionData.relatedId);
        return;
      }
      console.error('❌ Error creating cash transaction:', error);
      throw error;
    }
  }

  // Handle acerto payment processing
  static async handleAcertoPayment(acerto: any, paymentData: any): Promise<void> {
    try {
      // If payment method creates installments, process them
      if (paymentData.paymentMethod === 'cheque' && paymentData.paymentInstallments > 1) {
        await this.createChecksForAcerto(acerto, paymentData);
      } else if (paymentData.paymentMethod === 'boleto' && paymentData.paymentInstallments > 1) {
        await this.createBoletosForAcerto(acerto, paymentData);
      } else if (['dinheiro', 'pix', 'cartao_debito', 'transferencia'].includes(paymentData.paymentMethod)) {
        // Direct cash payment
        await this.createCashTransaction({
          date: paymentData.paymentDate,
          type: acerto.type === 'cliente' ? 'entrada' : 'saida',
          amount: paymentData.paymentAmount || (paymentData.paidAmount - acerto.paidAmount),
          description: `Pagamento de acerto - ${acerto.clientName}`,
          category: 'outro',
          relatedId: acerto.id,
          paymentMethod: paymentData.paymentMethod
        });
      }
    } catch (error) {
      console.error('❌ Error handling acerto payment:', error);
      throw error;
    }
  }

  // Create checks for acerto payment
  private static async createChecksForAcerto(acerto: any, paymentData: any): Promise<void> {
    const installments = paymentData.paymentInstallments || 1;
    const installmentValue = paymentData.paymentInstallmentValue || 0;
    const interval = paymentData.paymentInterval || 30;
    
    for (let i = 1; i <= installments; i++) {
      const dueDate = new Date(paymentData.paymentDate);
      dueDate.setDate(dueDate.getDate() + (i - 1) * interval);
      
      const checkData = {
        client: acerto.clientName,
        value: installmentValue,
        dueDate: dueDate.toISOString().split('T')[0],
        status: 'pendente',
        isOwnCheck: acerto.type === 'empresa',
        isCompanyPayable: acerto.type === 'empresa',
        companyName: acerto.type === 'empresa' ? acerto.companyName : null,
        installmentNumber: i,
        totalInstallments: installments,
        observations: `Cheque ${i}/${installments} - Pagamento de acerto para ${acerto.clientName}`
      };
      
      await supabaseServices.checks.create(checkData);
    }
  }

  // Create boletos for acerto payment
  private static async createBoletosForAcerto(acerto: any, paymentData: any): Promise<void> {
    const installments = paymentData.paymentInstallments || 1;
    const installmentValue = paymentData.paymentInstallmentValue || 0;
    const interval = paymentData.paymentInterval || 30;
    
    for (let i = 1; i <= installments; i++) {
      const dueDate = new Date(paymentData.paymentDate);
      dueDate.setDate(dueDate.getDate() + (i - 1) * interval);
      
      const boletoData = {
        client: acerto.clientName,
        value: installmentValue,
        dueDate: dueDate.toISOString().split('T')[0],
        status: 'pendente',
        installmentNumber: i,
        totalInstallments: installments,
        isCompanyPayable: acerto.type === 'empresa',
        companyName: acerto.type === 'empresa' ? acerto.companyName : null,
        observations: `Boleto ${i}/${installments} - Pagamento de acerto para ${acerto.clientName}`
      };
      
      await supabaseServices.boletos.create(boletoData);
    }
  }
}