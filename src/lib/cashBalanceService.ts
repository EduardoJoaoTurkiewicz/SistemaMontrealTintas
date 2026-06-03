// Service to handle cash balance updates when payments are marked as paid
import { supabase } from './supabase';
import { supabaseServices } from './supabaseServices';
import { safeNumber } from '../utils/numberUtils';
import { registerCashTransaction } from '../services/financialCoreService';
import { validateFinancialAmounts } from '../utils/financialValidation';

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
      const principal  = safeNumber(boleto.value, 0);
      const notaryCosts = safeNumber(boleto.notaryCosts, 0);
      // finalAmount is the gross amount received/paid — principal plus any charges.
      // If the record doesn't carry finalAmount explicitly we derive it.
      const finalAmount = safeNumber(boleto.finalAmount, principal + notaryCosts);

      // Warn when the stored three-field model is internally inconsistent.
      if (!validateFinancialAmounts(principal, notaryCosts, finalAmount)) {
        console.warn(
          `⚠️ Boleto ${boleto.id}: principal(${principal}) + charges(${notaryCosts}) ≠ final(${finalAmount}). Using finalAmount as authoritative.`
        );
      }

      if (boleto.isCompanyPayable) {
        // Company's boleto = cash outflow for the full settled amount
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
        // Received boleto = cash inflow for the gross amount received.
        // Notary/cartório costs are recorded as a SEPARATE outflow so they
        // are never deducted twice from the principal.
        await this.createCashTransaction({
          date: boleto.paymentDate || new Date().toISOString().split('T')[0],
          type: 'entrada',
          amount: finalAmount,
          description: `Boleto recebido - ${boleto.client}`,
          category: 'boleto',
          relatedId: boleto.id,
          paymentMethod: 'boleto'
        });

        if (notaryCosts > 0) {
          await this.createCashTransaction({
            date: boleto.paymentDate || new Date().toISOString().split('T')[0],
            type: 'saida',
            amount: notaryCosts,
            description: `Custos de cartório - ${boleto.client}`,
            category: 'outro',
            relatedId: `${boleto.id}_cartorio`,
            paymentMethod: 'cartorio'
          });
        }
      }
    }
  }

  // Delegate to financialCoreService.registerCashTransaction (idempotent, never silent).
  private static async createCashTransaction(transactionData: any): Promise<void> {
    await registerCashTransaction({
      date:          transactionData.date,
      type:          transactionData.type,
      amount:        transactionData.amount,
      description:   transactionData.description,
      category:      transactionData.category,
      relatedId:     transactionData.relatedId ?? null,
      paymentMethod: transactionData.paymentMethod ?? null,
    });
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