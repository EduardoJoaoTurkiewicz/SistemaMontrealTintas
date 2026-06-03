// Service to handle installment creation and management
import { supabaseServices } from './supabaseServices';
import { formatDateForInput, addDays, getCurrentDateString } from '../utils/dateUtils';
import { safeNumber } from '../utils/numberUtils';
import { UUIDManager } from './uuidManager';
import { upsertAcerto } from '../services/financialCoreService';

export class InstallmentService {
  // Create checks for sale payment method
  static async createChecksForSale(saleId: string, client: string, paymentMethod: any): Promise<void> {
    if (paymentMethod.type !== 'cheque') return;

    const installments = safeNumber(paymentMethod.installments, 1);
    const interval = safeNumber(paymentMethod.installmentInterval, 30);
    const startDate = paymentMethod.firstInstallmentDate || getCurrentDateString();

    // Check if using custom values
    const useCustomValues = paymentMethod.useCustomValues && paymentMethod.customInstallmentValues && paymentMethod.customInstallmentValues.length === installments;

    console.log(`🔄 Creating ${installments} checks for sale ${saleId}${useCustomValues ? ' with custom values' : ''}`);

    for (let i = 1; i <= installments; i++) {
      const dueDate = addDays(startDate, (i - 1) * interval);

      // Use custom value if available, otherwise use default installment value
      const checkValue = useCustomValues
        ? safeNumber(paymentMethod.customInstallmentValues[i - 1], 0)
        : safeNumber(paymentMethod.installmentValue, paymentMethod.amount);

      const checkData = {
        id: UUIDManager.generateUUID(),
        saleId,
        client,
        value: checkValue,
        dueDate,
        status: 'pendente',
        isOwnCheck: paymentMethod.isOwnCheck || false,
        isThirdPartyCheck: paymentMethod.isThirdPartyCheck || false,
        installmentNumber: i,
        totalInstallments: installments,
        observations: `Cheque ${i}/${installments} - Venda para ${client}`,
        // Add third party details if available
        thirdPartyDetails: paymentMethod.thirdPartyDetails?.[i-1] || null
      };
      
      try {
        await supabaseServices.checks.create(checkData);
        console.log(`✅ Check ${i}/${installments} created for sale`);
      } catch (error) {
        console.error(`❌ Error creating check ${i}/${installments}:`, error);
        throw error;
      }
    }
    
    console.log(`✅ All ${installments} checks created for sale ${saleId}`);
  }

  // Create boletos for sale payment method
  static async createBoletosForSale(saleId: string, client: string, paymentMethod: any): Promise<void> {
    if (paymentMethod.type !== 'boleto') return;

    const installments = safeNumber(paymentMethod.installments, 1);
    const interval = safeNumber(paymentMethod.installmentInterval, 30);
    const startDate = paymentMethod.firstInstallmentDate || getCurrentDateString();

    // Check if using custom values
    const useCustomValues = paymentMethod.useCustomValues && paymentMethod.customInstallmentValues && paymentMethod.customInstallmentValues.length === installments;
    
    console.log(`🔄 Creating ${installments} boletos for sale ${saleId}${useCustomValues ? ' with custom values' : ''}`);

    for (let i = 1; i <= installments; i++) {
      const dueDate = addDays(startDate, (i - 1) * interval);

      // Use custom value if available, otherwise use default installment value
      const boletoValue = useCustomValues
        ? safeNumber(paymentMethod.customInstallmentValues[i - 1], 0)
        : safeNumber(paymentMethod.installmentValue, paymentMethod.amount);

      const boletoData = {
        id: UUIDManager.generateUUID(),
        saleId,
        client,
        value: boletoValue,
        dueDate,
        status: 'pendente',
        installmentNumber: i,
        totalInstallments: installments,
        observations: `Boleto ${i}/${installments} - Venda para ${client}`
      };
      
      try {
        await supabaseServices.boletos.create(boletoData);
        console.log(`✅ Boleto ${i}/${installments} created for sale`);
      } catch (error) {
        console.error(`❌ Error creating boleto ${i}/${installments}:`, error);
        throw error;
      }
    }
    
    console.log(`✅ All ${installments} boletos created for sale ${saleId}`);
  }

  // Create acerto for sale payment method — delegates to financialCoreService (single authority).
  // clienteId: the registered customer's UUID (required for acerto payment).
  // client: the customer's display name.
  static async createAcertoForSale(client: string, paymentMethod: any, clienteId?: string | null): Promise<void> {
    if (paymentMethod.type !== 'acerto') return;

    const amount = safeNumber(paymentMethod.amount, 0);
    if (amount <= 0) return;

    console.log(`[InstallmentService] Delegating acerto upsert for client "${client}" to financialCoreService`);
    await upsertAcerto({ clientName: client, clienteId, amount, type: 'cliente' });
  }

  // Create checks for debt payment method
  static async createChecksForDebt(debtId: string, company: string, paymentMethod: any): Promise<void> {
    if (paymentMethod.type !== 'cheque') return;

    const installments = safeNumber(paymentMethod.installments, 1);
    const interval = safeNumber(paymentMethod.installmentInterval, 30);
    const startDate = paymentMethod.firstInstallmentDate || getCurrentDateString();

    // Check if using custom values
    const useCustomValues = paymentMethod.useCustomValues && paymentMethod.customInstallmentValues && paymentMethod.customInstallmentValues.length === installments;

    console.log(`🔄 Creating ${installments} checks for debt ${debtId}${useCustomValues ? ' with custom values' : ''}`);

    for (let i = 1; i <= installments; i++) {
      const dueDate = addDays(startDate, (i - 1) * interval);

      // Use custom value if available, otherwise use default installment value
      const checkValue = useCustomValues
        ? safeNumber(paymentMethod.customInstallmentValues[i - 1], 0)
        : safeNumber(paymentMethod.installmentValue, paymentMethod.amount);

      const checkData = {
        id: UUIDManager.generateUUID(),
        debtId,
        client: company,
        value: checkValue,
        dueDate,
        status: 'pendente',
        isOwnCheck: true,
        isCompanyPayable: true,
        companyName: company,
        installmentNumber: i,
        totalInstallments: installments,
        observations: `Cheque próprio ${i}/${installments} - Pagamento para ${company}`,
        usedFor: `Pagamento de dívida - ${company}`
      };
      
      try {
        await supabaseServices.checks.create(checkData);
        console.log(`✅ Check ${i}/${installments} created for debt`);
      } catch (error) {
        console.error(`❌ Error creating check ${i}/${installments}:`, error);
        throw error;
      }
    }
    
    console.log(`✅ All ${installments} checks created for debt ${debtId}`);
  }

  // Create boletos for debt payment method
  static async createBoletosForDebt(debtId: string, company: string, paymentMethod: any): Promise<void> {
    if (paymentMethod.type !== 'boleto') return;

    const installments = safeNumber(paymentMethod.installments, 1);
    const interval = safeNumber(paymentMethod.installmentInterval, 30);
    const startDate = paymentMethod.firstInstallmentDate || getCurrentDateString();

    // Check if using custom values
    const useCustomValues = paymentMethod.useCustomValues && paymentMethod.customInstallmentValues && paymentMethod.customInstallmentValues.length === installments;

    console.log(`🔄 Creating ${installments} boletos for debt ${debtId}${useCustomValues ? ' with custom values' : ''}`);

    for (let i = 1; i <= installments; i++) {
      const dueDate = addDays(startDate, (i - 1) * interval);

      // Use custom value if available, otherwise use default installment value
      const boletoValue = useCustomValues
        ? safeNumber(paymentMethod.customInstallmentValues[i - 1], 0)
        : safeNumber(paymentMethod.installmentValue, paymentMethod.amount);

      const boletoData = {
        id: UUIDManager.generateUUID(),
        debtId,
        client: company,
        value: boletoValue,
        dueDate,
        status: 'pendente',
        installmentNumber: i,
        totalInstallments: installments,
        isCompanyPayable: true,
        companyName: company,
        observations: `Boleto ${i}/${installments} - Pagamento para ${company}`
      };
      
      try {
        await supabaseServices.boletos.create(boletoData);
        console.log(`✅ Boleto ${i}/${installments} created for debt`);
      } catch (error) {
        console.error(`❌ Error creating boleto ${i}/${installments}:`, error);
        throw error;
      }
    }
    
    console.log(`✅ All ${installments} boletos created for debt ${debtId}`);
  }

  // Create acerto for debt payment method — delegates to financialCoreService (single authority).
  static async createAcertoForDebt(company: string, paymentMethod: any): Promise<void> {
    if (paymentMethod.type !== 'acerto') return;

    const amount = safeNumber(paymentMethod.amount, 0);
    if (amount <= 0) return;

    console.log(`[InstallmentService] Delegating acerto upsert for company "${company}" to financialCoreService`);
    await upsertAcerto({ clientName: company, amount, type: 'empresa' });
  }

  // Update permuta consumed value for sale payment method
  static async updatePermutaForSale(vehicleId: string, amount: number): Promise<void> {
    const usedAmount = safeNumber(amount, 0);
    if (usedAmount <= 0) return;

    console.log(`🔄 Updating permuta ${vehicleId}, adding consumed value: ${usedAmount}`);

    try {
      const permutas = await supabaseServices.permutas.getPermutas();
      const permuta = permutas.find(p => p.id === vehicleId);

      if (!permuta) {
        console.error(`❌ Permuta ${vehicleId} not found`);
        throw new Error(`Permuta ${vehicleId} não encontrada`);
      }

      // Calculate new values
      const newConsumedValue = permuta.consumedValue + usedAmount;
      const newRemainingValue = permuta.vehicleValue - newConsumedValue;

      // Determine new status
      let newStatus = permuta.status;
      if (newRemainingValue <= 0) {
        newStatus = 'finalizado';
      }

      const updatedPermuta = {
        ...permuta,
        consumedValue: newConsumedValue,
        remainingValue: Math.max(0, newRemainingValue),
        status: newStatus,
        updatedAt: new Date().toISOString()
      };

      await supabaseServices.permutas.update(vehicleId, updatedPermuta);
      console.log(`✅ Permuta ${vehicleId} updated - Consumed: R$ ${newConsumedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, Remaining: R$ ${newRemainingValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, Status: ${newStatus}`);
    } catch (error) {
      console.error(`❌ Error updating permuta ${vehicleId}:`, error);
      throw error;
    }
  }

  // Process all installments for a sale
  static async processInstallmentsForSale(saleId: string, client: string, paymentMethods: any[], clienteId?: string | null): Promise<void> {
    console.log(`🔄 Processing installments for sale ${saleId}, client: ${client}`);

    for (const method of paymentMethods) {
      try {
        // Handle cheques (both single and multiple installments)
        if (method.type === 'cheque') {
          if (method.installments && method.installments > 1) {
            await this.createChecksForSale(saleId, client, method);
          } else {
            // Single check
            await this.createChecksForSale(saleId, client, {
              ...method,
              installments: 1,
              installmentValue: method.amount,
              firstInstallmentDate: method.firstInstallmentDate || getCurrentDateString()
            });
          }
        }

        // Handle boletos (both single and multiple installments)
        if (method.type === 'boleto') {
          if (method.installments && method.installments > 1) {
            await this.createBoletosForSale(saleId, client, method);
          } else {
            // Single boleto
            await this.createBoletosForSale(saleId, client, {
              ...method,
              installments: 1,
              installmentValue: method.amount,
              firstInstallmentDate: method.firstInstallmentDate || getCurrentDateString()
            });
          }
        }

        // Handle acertos — pass clienteId for reliable linking
        if (method.type === 'acerto') {
          await this.createAcertoForSale(client, method, clienteId);
        }

        // Handle permutas - update consumed value
        if (method.type === 'permuta' && method.vehicleId) {
          await this.updatePermutaForSale(method.vehicleId, method.amount);
        }
      } catch (error) {
        console.error(`❌ Error processing payment method ${method.type} for sale:`, error);
        // Continue with other methods even if one fails
      }
    }

    console.log(`✅ All installments processed for sale ${saleId}`);
  }

  // Process all installments for a debt
  static async processInstallmentsForDebt(debtId: string, company: string, paymentMethods: any[]): Promise<void> {
    console.log(`🔄 Processing installments for debt ${debtId}, company: ${company}`);

    for (const method of paymentMethods) {
      try {
        // Handle cheques (both single and multiple installments)
        if (method.type === 'cheque') {
          // First, handle selected checks from sales
          if (method.selectedChecks && method.selectedChecks.length > 0) {
            console.log(`🔄 Updating ${method.selectedChecks.length} selected checks for debt ${debtId}`);
            for (const checkId of method.selectedChecks) {
              try {
                // Update the check to mark it as used in this debt
                await supabaseServices.checks.update(checkId, {
                  debtId: debtId,
                  usedInDebt: debtId,
                  supplierName: company,
                  usedFor: `Pagamento de dívida - ${company}`,
                  updatedAt: new Date().toISOString()
                });
                console.log(`✅ Check ${checkId} marked as used for debt ${debtId} - Supplier: ${company}`);

                // Remove check from agenda since it's now being used for a debt
                try {
                  const { AgendaAutoService } = await import('./agendaAutoService');
                  await AgendaAutoService.removeCheckEvents(checkId);
                  console.log(`✅ Removed check ${checkId} from agenda`);
                } catch (agendaError) {
                  console.error(`❌ Error removing check ${checkId} from agenda:`, agendaError);
                }
              } catch (error) {
                console.error(`❌ Error updating check ${checkId}:`, error);
              }
            }
          }

          // Then create new checks if needed (for installments not covered by selected checks)
          if (method.installments && method.installments > 1 && !method.selectedChecks) {
            await this.createChecksForDebt(debtId, company, method);
          } else if (!method.selectedChecks || method.selectedChecks.length === 0) {
            // Single check
            await this.createChecksForDebt(debtId, company, {
              ...method,
              installments: 1,
              installmentValue: method.amount,
              firstInstallmentDate: method.firstInstallmentDate || getCurrentDateString()
            });
          }
        }
        
        // Handle boletos (both single and multiple installments)
        if (method.type === 'boleto') {
          if (method.installments && method.installments > 1) {
            await this.createBoletosForDebt(debtId, company, method);
          } else {
            // Single boleto
            await this.createBoletosForDebt(debtId, company, { 
              ...method, 
              installments: 1, 
              installmentValue: method.amount,
              firstInstallmentDate: method.firstInstallmentDate || getCurrentDateString()
            });
          }
        }
        
        // Handle acertos
        if (method.type === 'acerto') {
          await this.createAcertoForDebt(company, method);
        }
      } catch (error) {
        console.error(`❌ Error processing payment method ${method.type} for debt:`, error);
        // Continue with other methods even if one fails
      }
    }
    
    console.log(`✅ All installments processed for debt ${debtId}`);
  }
}