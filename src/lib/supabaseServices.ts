import { supabase, isSupabaseConfigured } from './supabase';
import { sanitizeSupabaseData, safeNumber, logMonetaryValues, transformToSnakeCase, transformFromSnakeCase } from '../utils/numberUtils';
import { ErrorHandler } from './errorHandler';
import { saveOffline, addToSyncQueue, getLocalCashBalance, setLocalCashBalance } from './offlineStorage';
import { saveOfflineEnhanced, addToSyncQueueEnhanced } from './enhancedOfflineStorage';
import { UUIDManager } from './uuidManager';
import { DeduplicationService } from './deduplicationService';
import { connectionManager } from './connectionManager';
import type { 
  Sale, 
  Employee, 
  CashBalance, 
  CashTransaction, 
  Debt, 
  Check, 
  Boleto,
  EmployeePayment,
  EmployeeAdvance,
  EmployeeOvertime,
  EmployeeCommission,
  PixFee,
  Tax,
  AgendaEvent,
  Acerto,
  Permuta
} from '../types';

// Enhanced Supabase services with deduplication
export { enhancedSupabaseServices } from './enhancedSupabaseServices';
// Helper function to safely execute Supabase operations
async function safeSupabaseOperation<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  fallbackValue: T | null = null,
  context: string = 'Unknown'
): Promise<T | null> {
  if (!isSupabaseConfigured()) {
    console.warn(`⚠️ Supabase not configured for ${context} - working offline`);
    return fallbackValue;
  }

  try {
    const { data, error } = await operation();
    
    if (error) {
      // Handle PGRST116 error (no rows found) gracefully
      if (error.code === 'PGRST116') {
        console.log(`ℹ️ No rows found for ${context} - returning null`);
        return fallbackValue;
      }
      
      console.error(`❌ Supabase error in ${context}:`, error);
      throw error;
    }
    
    // Sanitize monetary values in the response
    const sanitizedData = sanitizeSupabaseData(data);
    logMonetaryValues(sanitizedData, context);
    
    return sanitizedData;
  } catch (error) {
    // Handle PGRST116 error in catch block as well
    if (error?.code === 'PGRST116') {
      console.log(`ℹ️ No rows found for ${context} - returning fallback value`);
      return fallbackValue;
    }
    
    ErrorHandler.logProjectError(error, context);
    
    if (error?.message?.includes('Failed to fetch') || error?.message?.includes('Network error')) {
      console.warn(`⚠️ Network error in ${context} - working offline`);
      return fallbackValue;
    }
    
    throw error;
  }
}

// Sales Service
export const salesService = {
  async getSales(): Promise<Sale[]> {
    const data = await safeSupabaseOperation(
      () => supabase.from('sales').select('*').order('created_at', { ascending: false }),
      [],
      'Get Sales'
    );
    
    if (!data) return [];
    
    const salesData = data.map(sale => {
      const sanitized = sanitizeSupabaseData(transformFromSnakeCase(sale));
      
      // Ensure all monetary fields are numbers
      sanitized.totalValue = safeNumber(sanitized.totalValue, 0);
      sanitized.receivedAmount = safeNumber(sanitized.receivedAmount, 0);
      sanitized.pendingAmount = safeNumber(sanitized.pendingAmount, 0);
      sanitized.customCommissionRate = safeNumber(sanitized.customCommissionRate, 5);
      
      // Sanitize payment methods
      if (sanitized.paymentMethods && Array.isArray(sanitized.paymentMethods)) {
        sanitized.paymentMethods = sanitized.paymentMethods.map(method => ({
          ...method,
          amount: safeNumber(method.amount, 0),
          installmentValue: safeNumber(method.installmentValue, 0),
          installments: safeNumber(method.installments, 1),
          installmentInterval: safeNumber(method.installmentInterval, 30)
        }));
      }
      
      return sanitized;
    });
    
    // Remove duplicates before returning
    return DeduplicationService.removeDuplicatesById(salesData);
  },

  async create(sale: Omit<Sale, 'id' | 'createdAt'>): Promise<string> {
    console.log('🔄 salesService.create - Input sale:', sale);

    // Generate UUID and clean data
    const saleId = UUIDManager.generateUUID();
    const saleWithId = { ...sale, id: saleId };
    const cleanedSale = UUIDManager.cleanObjectUUIDs(saleWithId);

    // Sanitize all monetary values before sending
    const sanitizedSale = {
      ...cleanedSale,
      totalValue: safeNumber(cleanedSale.totalValue, 0),
      receivedAmount: safeNumber(cleanedSale.receivedAmount, 0),
      pendingAmount: safeNumber(cleanedSale.pendingAmount, 0),
      customCommissionRate: safeNumber(cleanedSale.customCommissionRate, 5),
      paymentMethods: (cleanedSale.paymentMethods || []).map(method => ({
        ...method,
        amount: safeNumber(method.amount, 0),
        installmentValue: safeNumber(method.installmentValue, 0),
        installments: safeNumber(method.installments, 1),
        installmentInterval: safeNumber(method.installmentInterval, 30)
      }))
    };

    logMonetaryValues(sanitizedSale, 'Create Sale Input');

    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      console.log('💾 Saving sale offline');
      return await saveOfflineEnhanced('sales', sanitizedSale);
    }

    try {
      console.log('🔄 salesService.create - Calling Supabase RPC...');
      const { data, error } = await supabase.rpc('create_sale', {
        payload: transformToSnakeCase(sanitizedSale)
      });

      if (error) {
        console.error('❌ Supabase RPC error:', error);
        throw error;
      }

      // Parse the RPC response to extract the actual sale ID
      let saleId: string;
      if (typeof data === 'string') {
        try {
          const parsedData = JSON.parse(data);
          saleId = parsedData.sale_id || data;
        } catch {
          saleId = data;
        }
      } else if (data && typeof data === 'object' && data.sale_id) {
        saleId = data.sale_id;
      } else {
        saleId = data;
      }

      console.log('✅ salesService.create - Sale created with ID:', saleId);

      // Process installments after sale creation
      try {
        const { InstallmentService } = await import('./installmentService');
        await InstallmentService.processInstallmentsForSale(saleId, sanitizedSale.client, sanitizedSale.paymentMethods || [], sanitizedSale.cliente_id ?? null);
        console.log('✅ Installments processed successfully for sale:', saleId);
      } catch (installmentError) {
        console.error('❌ Error processing installments for sale:', installmentError);
      }

      // Process credit card sales - create records in credit_card_sales table
      try {
        for (const method of sanitizedSale.paymentMethods || []) {
          if (method.type === 'cartao_credito') {
            console.log('💳 Creating credit card sale for method:', method);
            const { CreditCardService } = await import('./creditCardService');
            const installments = safeNumber(method.installments, 1);
            await CreditCardService.createFromSale({
              saleId: saleId,
              clientName: sanitizedSale.client,
              totalAmount: safeNumber(method.amount, 0),
              installments: installments,
              saleDate: sanitizedSale.date,
              firstDueDate: method.firstInstallmentDate || sanitizedSale.date
            });
            console.log('✅ Credit card sale created successfully with', installments, 'installment(s)');
          }
        }
      } catch (creditCardError) {
        console.error('❌ Error creating credit card sale:', creditCardError);
      }

      // Process acertos - add to existing acerto group if specified
      try {
        for (const method of sanitizedSale.paymentMethods || []) {
          if (method.type === 'acerto') {
            console.log('🔄 Processing acerto for method:', method);
            const clientName = method.acertoClientName === '__novo__' || !method.acertoClientName
              ? sanitizedSale.client
              : method.acertoClientName;

            // Find existing acerto for this client
            const { data: existingAcerto, error: acertosError } = await supabase
              .from('acertos')
              .select('*')
              .eq('client_name', clientName)
              .eq('type', 'cliente')
              .maybeSingle();

            if (acertosError && acertosError.code !== 'PGRST116') {
              console.error('❌ Error finding existing acerto:', acertosError);
            }

            if (existingAcerto) {
              // Update existing acerto - ALWAYS use existing when client is selected
              console.log('✅ Found existing acerto, updating:', existingAcerto.id);
              const newTotal = safeNumber(existingAcerto.total_amount, 0) + safeNumber(method.amount, 0);
              const newPending = safeNumber(existingAcerto.pending_amount, 0) + safeNumber(method.amount, 0);

              await supabase
                .from('acertos')
                .update({
                  total_amount: newTotal,
                  pending_amount: newPending,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingAcerto.id);

              console.log('✅ Acerto updated successfully - Total:', newTotal, 'Pending:', newPending);
            } else {
              // Only create new acerto if no existing one found for this client
              console.log('✅ No existing acerto found - Creating new acerto for client:', clientName);
              await supabase
                .from('acertos')
                .insert({
                  client_name: clientName,
                  type: 'cliente',
                  total_amount: safeNumber(method.amount, 0),
                  paid_amount: 0,
                  pending_amount: safeNumber(method.amount, 0),
                  payment_installments: 1,
                  payment_installment_value: safeNumber(method.amount, 0),
                  payment_interval: 30,
                  status: 'pendente'
                });

              console.log('✅ New acerto created successfully for:', clientName);
            }
          }
        }
      } catch (acertoError) {
        console.error('❌ Error processing acerto:', acertoError);
      }

      // Register agenda events automatically
      try {
        const { AgendaAutoService } = await import('./agendaAutoService');

        // Register delivery date if provided
        if (sanitizedSale.deliveryDate) {
          await AgendaAutoService.registerSaleDelivery(saleId, sanitizedSale.deliveryDate, sanitizedSale.client);
        }

        // Register payment due dates for installments
        if (sanitizedSale.paymentMethods) {
          const installmentsToRegister: Array<{date: string, amount: number, type: string, number: number, total: number}> = [];

          for (const method of sanitizedSale.paymentMethods) {
            // Handle installment-based payment methods
            if (method.firstInstallmentDate && method.installments && method.installments > 1) {
              const dueDate = new Date(method.firstInstallmentDate);
              const useCustomValues = method.useCustomValues && method.customInstallmentValues && method.customInstallmentValues.length === method.installments;

              for (let i = 0; i < method.installments; i++) {
                const installmentDate = new Date(dueDate);
                installmentDate.setDate(dueDate.getDate() + (i * (method.installmentInterval || 30)));
                const dateStr = installmentDate.toISOString().split('T')[0];

                const amount = useCustomValues
                  ? safeNumber(method.customInstallmentValues[i], 0)
                  : safeNumber(method.installmentValue, method.amount / method.installments);

                installmentsToRegister.push({
                  date: dateStr,
                  amount: amount,
                  type: method.type,
                  number: i + 1,
                  total: method.installments
                });
              }
            }
            // Handle single payment methods with due date (like single boleto or single check)
            else if (method.firstInstallmentDate && (method.type === 'boleto' || method.type === 'cheque')) {
              installmentsToRegister.push({
                date: method.firstInstallmentDate,
                amount: safeNumber(method.amount, 0),
                type: method.type,
                number: 1,
                total: 1
              });
            }
          }

          if (installmentsToRegister.length > 0) {
            await AgendaAutoService.registerSaleInstallments(saleId, sanitizedSale.client, installmentsToRegister);
          }
        }
      } catch (agendaError) {
        console.error('❌ Error registering agenda events:', agendaError);
      }

      return saleId;
    } catch (error) {
      console.error('❌ Error creating sale:', error);

      // Save offline if network error
      if (error?.message?.includes('Failed to fetch') || error?.message?.includes('Network error')) {
        console.log('💾 Saving sale offline due to network error');
        return await saveOfflineEnhanced('sales', sanitizedSale);
      }

      throw error;
    }
  },

  async update(id: string, sale: Partial<Sale>): Promise<void> {
    // Clean and sanitize data
    const cleanedSale = UUIDManager.cleanObjectUUIDs(sale);
    const sanitizedSale = sanitizeSupabaseData(cleanedSale);
    logMonetaryValues(sanitizedSale, 'Update Sale');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueueEnhanced({
        type: 'update',
        table: 'sales',
        data: { id, ...sanitizedSale },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('sales')
      .update(transformToSnakeCase(sanitizedSale))
      .eq('id', id);
    
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueueEnhanced({
        type: 'delete',
        table: 'sales',
        data: { id },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Employee Service
export const employeeService = {
  async getEmployees(): Promise<Employee[]> {
    const data = await safeSupabaseOperation(
      () => supabase.from('employees').select('*').order('created_at', { ascending: false }),
      [],
      'Get Employees'
    );
    
    if (!data) return [];
    
    const employeesData = data.map(employee => {
      const sanitized = sanitizeSupabaseData(transformFromSnakeCase(employee));
      sanitized.salary = safeNumber(sanitized.salary, 0);
      sanitized.paymentDay = safeNumber(sanitized.paymentDay, 5);
      return sanitized;
    });
    
    // Remove duplicates before returning
    return DeduplicationService.removeDuplicatesById(employeesData);
  },

  async create(employee: Omit<Employee, 'id' | 'createdAt'>): Promise<string> {
    // Generate UUID and clean data
    const employeeId = UUIDManager.generateUUID();
    const employeeWithId = { ...employee, id: employeeId };
    const cleanedEmployee = UUIDManager.cleanObjectUUIDs(employeeWithId);
    
    const sanitizedEmployee = {
      ...cleanedEmployee,
      salary: safeNumber(cleanedEmployee.salary, 0),
      paymentDay: safeNumber(cleanedEmployee.paymentDay, 5)
    };
    
    logMonetaryValues(sanitizedEmployee, 'Create Employee');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      return await saveOfflineEnhanced('employees', sanitizedEmployee);
    }

    const { data, error } = await supabase
      .from('employees')
      .insert([transformToSnakeCase(sanitizedEmployee)])
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  },

  async update(id: string, employee: Partial<Employee>): Promise<void> {
    const cleanedEmployee = UUIDManager.cleanObjectUUIDs(employee);
    const sanitizedEmployee = sanitizeSupabaseData(cleanedEmployee);
    logMonetaryValues(sanitizedEmployee, 'Update Employee');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueueEnhanced({
        type: 'update',
        table: 'employees',
        data: { id, ...sanitizedEmployee },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('employees')
      .update(transformToSnakeCase(sanitizedEmployee))
      .eq('id', id);
    
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueueEnhanced({
        type: 'delete',
        table: 'employees',
        data: { id },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Cash Service
export const cashService = {
  async getCurrentBalance(): Promise<CashBalance | null> {
    // If offline, use local balance
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      const localBalance = await getLocalCashBalance();
      return {
        id: 'local-balance',
        currentBalance: localBalance,
        initialBalance: localBalance,
        initialDate: new Date().toISOString().split('T')[0],
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    
    const data = await safeSupabaseOperation(
      () => supabase.rpc('get_current_cash_balance'),
      null,
      'Get Cash Balance'
    );
    
    if (!data || !Array.isArray(data) || data.length === 0) return null;
    
    const balance = transformFromSnakeCase(data[0]);
    const sanitized = sanitizeSupabaseData(balance);
    
    // Ensure all balance fields are numbers
    sanitized.currentBalance = safeNumber(sanitized.currentBalance, 0);
    sanitized.initialBalance = safeNumber(sanitized.initialBalance, 0);
    
    // Update local balance to match Supabase
    await setLocalCashBalance(sanitized.currentBalance);
    
    logMonetaryValues(sanitized, 'Cash Balance');
    return sanitized;
  },

  async getTransactions(): Promise<CashTransaction[]> {
    const data = await safeSupabaseOperation(
      () => supabase.from('cash_transactions').select('*').order('date', { ascending: false }),
      [],
      'Get Cash Transactions'
    );
    
    if (!data) return [];
    
    return data.map(transaction => {
      const sanitized = sanitizeSupabaseData(transformFromSnakeCase(transaction));
      sanitized.amount = safeNumber(sanitized.amount, 0);
      return sanitized;
    });
  },

  async initializeCashBalance(amount: number): Promise<string> {
    const safeAmount = safeNumber(amount, 0);
    logMonetaryValues({ amount: safeAmount }, 'Initialize Cash Balance');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      throw new Error('Supabase não configurado ou sem conexão');
    }

    const { data, error } = await supabase.rpc('initialize_cash_balance', { 
      initial_amount: safeAmount 
    });
    
    if (error) throw error;
    return data;
  },

  async recalculateBalance(): Promise<void> {
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      throw new Error('Supabase não configurado ou sem conexão');
    }

    const { error } = await supabase.rpc('recalculate_cash_balance');
    if (error) throw error;
  },

  async create(transaction: Omit<CashTransaction, 'id' | 'createdAt'>): Promise<string> {
    const sanitizedTransaction = {
      ...transaction,
      amount: safeNumber(transaction.amount, 0)
    };
    
    logMonetaryValues(sanitizedTransaction, 'Create Cash Transaction');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      // Update local cash balance for offline transactions
      const currentBalance = await getLocalCashBalance();
      let newBalance = currentBalance;
      
      if (sanitizedTransaction.type === 'entrada') {
        newBalance += sanitizedTransaction.amount;
      } else if (sanitizedTransaction.type === 'saida') {
        newBalance -= sanitizedTransaction.amount;
      }
      
      await setLocalCashBalance(newBalance);
      console.log('💰 Local cash balance updated:', { old: currentBalance, new: newBalance });
      
      return await saveOffline('cash_transactions', sanitizedTransaction);
    }

    const { data, error } = await supabase
      .from('cash_transactions')
      .insert([transformToSnakeCase(sanitizedTransaction)])
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  },

  async updateTransaction(id: string, transaction: Partial<CashTransaction>): Promise<void> {
    const sanitizedTransaction = sanitizeSupabaseData(transaction);
    logMonetaryValues(sanitizedTransaction, 'Update Cash Transaction');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueue({
        type: 'update',
        table: 'cash_transactions',
        data: { id, ...sanitizedTransaction },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('cash_transactions')
      .update(transformToSnakeCase(sanitizedTransaction))
      .eq('id', id);
    
    if (error) throw error;
  },

  async deleteTransaction(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueue({
        type: 'delete',
        table: 'cash_transactions',
        data: { id },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('cash_transactions')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Debts Service
export const debtsService = {
  async getDebts(): Promise<Debt[]> {
    const data = await safeSupabaseOperation(
      () => supabase.from('debts').select('*').order('created_at', { ascending: false }),
      [],
      'Get Debts'
    );
    
    if (!data) return [];
    
    const debtsData = data.map(debt => {
      const sanitized = sanitizeSupabaseData(transformFromSnakeCase(debt));
      
      // Ensure all monetary fields are numbers
      sanitized.totalValue = safeNumber(sanitized.totalValue, 0);
      sanitized.paidAmount = safeNumber(sanitized.paidAmount, 0);
      sanitized.pendingAmount = safeNumber(sanitized.pendingAmount, 0);
      
      // Sanitize payment methods
      if (sanitized.paymentMethods && Array.isArray(sanitized.paymentMethods)) {
        sanitized.paymentMethods = sanitized.paymentMethods.map(method => ({
          ...method,
          amount: safeNumber(method.amount, 0),
          installmentValue: safeNumber(method.installmentValue, 0)
        }));
      }
      
      return sanitized;
    });
    
    // Remove duplicates before returning
    return DeduplicationService.removeDuplicatesById(debtsData);
  },

  async create(debt: Omit<Debt, 'id' | 'createdAt'>): Promise<string> {
    // Generate UUID and clean data
    const debtId = UUIDManager.generateUUID();
    const debtWithId = { ...debt, id: debtId };
    const cleanedDebt = UUIDManager.cleanObjectUUIDs(debtWithId);

    const sanitizedDebt = {
      ...cleanedDebt,
      totalValue: safeNumber(cleanedDebt.totalValue, 0),
      paidAmount: safeNumber(cleanedDebt.paidAmount, 0),
      pendingAmount: safeNumber(cleanedDebt.pendingAmount, 0),
      paymentMethods: (cleanedDebt.paymentMethods || []).map(method => ({
        ...method,
        amount: safeNumber(method.amount, 0),
        installmentValue: safeNumber(method.installmentValue, 0)
      }))
    };

    logMonetaryValues(sanitizedDebt, 'Create Debt');

    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      return await saveOfflineEnhanced('debts', sanitizedDebt);
    }

    const { data, error } = await supabase
      .from('debts')
      .insert([transformToSnakeCase(sanitizedDebt)])
      .select()
      .single();

    if (error) throw error;

    // Process installments after debt creation
    try {
      const { InstallmentService } = await import('./installmentService');
      await InstallmentService.processInstallmentsForDebt(data.id, sanitizedDebt.company, sanitizedDebt.paymentMethods || []);
      console.log('✅ Installments processed successfully for debt:', data.id);
    } catch (installmentError) {
      console.error('❌ Error processing installments for debt:', installmentError);
    }

    // Process credit card debts - create records in credit_card_debts table
    try {
      for (const method of sanitizedDebt.paymentMethods || []) {
        if (method.type === 'cartao_credito') {
          console.log('💳 Creating credit card debt for method:', method);
          const { CreditCardService } = await import('./creditCardService');
          const installments = safeNumber(method.installments, 1);
          await CreditCardService.createFromDebt({
            debtId: data.id,
            supplierName: sanitizedDebt.company,
            totalAmount: safeNumber(method.amount, 0),
            installments: installments,
            purchaseDate: sanitizedDebt.date,
            firstDueDate: method.firstInstallmentDate || sanitizedDebt.date
          });
          console.log('✅ Credit card debt created successfully with', installments, 'installment(s)');
        }
      }
    } catch (creditCardError) {
      console.error('❌ Error creating credit card debt:', creditCardError);
    }

    // Register agenda events automatically
    try {
      const { AgendaAutoService } = await import('./agendaAutoService');

      // Register payment due dates for installments
      // ONLY for payment methods that come out of company's cash (dinheiro, pix, transferencia, cheque, boleto)
      if (sanitizedDebt.paymentMethods) {
        const installmentsToRegister: Array<{date: string, amount: number, type: string, number: number, total: number}> = [];

        // Payment methods that come out of cash
        const cashPaymentMethods = ['dinheiro', 'pix', 'transferencia', 'cheque', 'boleto', 'cartao_debito'];

        for (const method of sanitizedDebt.paymentMethods) {
          // Only register if it's a payment method that comes out of cash
          if (!cashPaymentMethods.includes(method.type)) {
            continue;
          }

          // Handle installment-based payment methods
          if (method.firstInstallmentDate && method.installments && method.installments > 1) {
            const dueDate = new Date(method.firstInstallmentDate);
            const useCustomValues = method.useCustomValues && method.customInstallmentValues && method.customInstallmentValues.length === method.installments;

            for (let i = 0; i < method.installments; i++) {
              const installmentDate = new Date(dueDate);
              installmentDate.setDate(dueDate.getDate() + (i * (method.installmentInterval || 30)));
              const dateStr = installmentDate.toISOString().split('T')[0];

              const amount = useCustomValues
                ? safeNumber(method.customInstallmentValues[i], 0)
                : safeNumber(method.installmentValue, method.amount / method.installments);

              installmentsToRegister.push({
                date: dateStr,
                amount: amount,
                type: method.type,
                number: i + 1,
                total: method.installments
              });
            }
          }
          // Handle single payment methods with due date (like single boleto or single check)
          else if (method.firstInstallmentDate && (method.type === 'boleto' || method.type === 'cheque')) {
            installmentsToRegister.push({
              date: method.firstInstallmentDate,
              amount: safeNumber(method.amount, 0),
              type: method.type,
              number: 1,
              total: 1
            });
          }
        }

        if (installmentsToRegister.length > 0) {
          await AgendaAutoService.registerDebtInstallments(data.id, sanitizedDebt.company, installmentsToRegister);
        }
      }
    } catch (agendaError) {
      console.error('❌ Error registering agenda events for debt:', agendaError);
    }

    return data.id;
  },

  async update(id: string, debt: Partial<Debt>): Promise<void> {
    const cleanedDebt = UUIDManager.cleanObjectUUIDs(debt);
    const sanitizedDebt = sanitizeSupabaseData(cleanedDebt);
    logMonetaryValues(sanitizedDebt, 'Update Debt');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueueEnhanced({
        type: 'update',
        table: 'debts',
        data: { id, ...sanitizedDebt },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('debts')
      .update(transformToSnakeCase(sanitizedDebt))
      .eq('id', id);
    
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueueEnhanced({
        type: 'delete',
        table: 'debts',
        data: { id },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('debts')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Checks Service
export const checksService = {
  async getChecks(): Promise<Check[]> {
    const data = await safeSupabaseOperation(
      () => supabase.from('checks').select('*').order('created_at', { ascending: false }),
      [],
      'Get Checks'
    );
    
    if (!data) return [];
    
    return data.map(check => {
      const sanitized = sanitizeSupabaseData(transformFromSnakeCase(check));
      sanitized.value = safeNumber(sanitized.value, 0);
      sanitized.installmentNumber = safeNumber(sanitized.installmentNumber, 1);
      sanitized.totalInstallments = safeNumber(sanitized.totalInstallments, 1);
      return sanitized;
    });
  },

  async create(check: Omit<Check, 'id' | 'createdAt'>): Promise<string> {
    const sanitizedCheck = {
      ...check,
      value: safeNumber(check.value, 0),
      installmentNumber: safeNumber(check.installmentNumber, 1),
      totalInstallments: safeNumber(check.totalInstallments, 1)
    };
    
    logMonetaryValues(sanitizedCheck, 'Create Check');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      return await saveOffline('checks', sanitizedCheck);
    }

    const { data, error } = await supabase
      .from('checks')
      .insert([transformToSnakeCase(sanitizedCheck)])
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  },

  async update(id: string, check: Partial<Check>): Promise<void> {
    const sanitizedCheck = sanitizeSupabaseData(check);
    logMonetaryValues(sanitizedCheck, 'Update Check');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueue({
        type: 'update',
        table: 'checks',
        data: { id, ...sanitizedCheck },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('checks')
      .update(transformToSnakeCase(sanitizedCheck))
      .eq('id', id);
    
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueue({
        type: 'delete',
        table: 'checks',
        data: { id },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('checks')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Boletos Service
export const boletosService = {
  async getBoletos(): Promise<Boleto[]> {
    const data = await safeSupabaseOperation(
      () => supabase.from('boletos').select('*').order('created_at', { ascending: false }),
      [],
      'Get Boletos'
    );
    
    if (!data) return [];
    
    return data.map(boleto => {
      const sanitized = sanitizeSupabaseData(transformFromSnakeCase(boleto));
      
      // Ensure all monetary fields are numbers
      sanitized.value = safeNumber(sanitized.value, 0);
      sanitized.installmentNumber = safeNumber(sanitized.installmentNumber, 1);
      sanitized.totalInstallments = safeNumber(sanitized.totalInstallments, 1);
      sanitized.interestAmount = safeNumber(sanitized.interestAmount, 0);
      sanitized.penaltyAmount = safeNumber(sanitized.penaltyAmount, 0);
      sanitized.notaryCosts = safeNumber(sanitized.notaryCosts, 0);
      sanitized.finalAmount = safeNumber(sanitized.finalAmount, sanitized.value);
      sanitized.interestPaid = safeNumber(sanitized.interestPaid, 0);
      
      return sanitized;
    });
  },

  async create(boleto: Omit<Boleto, 'id' | 'createdAt'>): Promise<string> {
    const sanitizedBoleto = {
      ...boleto,
      value: safeNumber(boleto.value, 0),
      installmentNumber: safeNumber(boleto.installmentNumber, 1),
      totalInstallments: safeNumber(boleto.totalInstallments, 1),
      interestAmount: safeNumber(boleto.interestAmount, 0),
      penaltyAmount: safeNumber(boleto.penaltyAmount, 0),
      notaryCosts: safeNumber(boleto.notaryCosts, 0),
      finalAmount: safeNumber(boleto.finalAmount, safeNumber(boleto.value, 0)),
      interestPaid: safeNumber(boleto.interestPaid, 0)
    };
    
    logMonetaryValues(sanitizedBoleto, 'Create Boleto');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      return await saveOffline('boletos', sanitizedBoleto);
    }

    const { data, error } = await supabase
      .from('boletos')
      .insert([transformToSnakeCase(sanitizedBoleto)])
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  },

  async update(id: string, boleto: Partial<Boleto>): Promise<void> {
    const sanitizedBoleto = sanitizeSupabaseData(boleto);
    logMonetaryValues(sanitizedBoleto, 'Update Boleto');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueue({
        type: 'update',
        table: 'boletos',
        data: { id, ...sanitizedBoleto },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('boletos')
      .update(transformToSnakeCase(sanitizedBoleto))
      .eq('id', id);
    
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueue({
        type: 'delete',
        table: 'boletos',
        data: { id },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('boletos')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Employee Payments Service
export const employeePaymentsService = {
  async getPayments(): Promise<EmployeePayment[]> {
    const data = await safeSupabaseOperation(
      () => supabase.from('employee_payments').select('*').order('payment_date', { ascending: false }),
      [],
      'Get Employee Payments'
    );
    
    if (!data) return [];
    
    return data.map(payment => {
      const sanitized = sanitizeSupabaseData(transformFromSnakeCase(payment));
      sanitized.amount = safeNumber(sanitized.amount, 0);
      return sanitized;
    });
  },

  async create(payment: Omit<EmployeePayment, 'id' | 'createdAt'>): Promise<string> {
    const sanitizedPayment = {
      ...payment,
      amount: safeNumber(payment.amount, 0)
    };
    
    logMonetaryValues(sanitizedPayment, 'Create Employee Payment');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      return await saveOffline('employee_payments', sanitizedPayment);
    }

    const { data, error } = await supabase
      .from('employee_payments')
      .insert([transformToSnakeCase(sanitizedPayment)])
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  }
};

// Employee Advances Service
export const employeeAdvancesService = {
  async getAdvances(): Promise<EmployeeAdvance[]> {
    const data = await safeSupabaseOperation(
      () => supabase.from('employee_advances').select('*').order('date', { ascending: false }),
      [],
      'Get Employee Advances'
    );
    
    if (!data) return [];
    
    return data.map(advance => {
      const sanitized = sanitizeSupabaseData(transformFromSnakeCase(advance));
      sanitized.amount = safeNumber(sanitized.amount, 0);
      return sanitized;
    });
  },

  async create(advance: Omit<EmployeeAdvance, 'id' | 'createdAt'>): Promise<string> {
    const sanitizedAdvance = {
      ...advance,
      amount: safeNumber(advance.amount, 0)
    };
    
    logMonetaryValues(sanitizedAdvance, 'Create Employee Advance');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      return await saveOffline('employee_advances', sanitizedAdvance);
    }

    const { data, error } = await supabase
      .from('employee_advances')
      .insert([transformToSnakeCase(sanitizedAdvance)])
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  },

  async update(id: string, advance: Partial<EmployeeAdvance>): Promise<void> {
    const sanitizedAdvance = sanitizeSupabaseData(advance);
    logMonetaryValues(sanitizedAdvance, 'Update Employee Advance');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueue({
        type: 'update',
        table: 'employee_advances',
        data: { id, ...sanitizedAdvance },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('employee_advances')
      .update(transformToSnakeCase(sanitizedAdvance))
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Employee Overtimes Service
export const employeeOvertimesService = {
  async getOvertimes(): Promise<EmployeeOvertime[]> {
    const data = await safeSupabaseOperation(
      () => supabase.from('employee_overtimes').select('*').order('date', { ascending: false }),
      [],
      'Get Employee Overtimes'
    );
    
    if (!data) return [];
    
    return data.map(overtime => {
      const sanitized = sanitizeSupabaseData(transformFromSnakeCase(overtime));
      sanitized.hours = safeNumber(sanitized.hours, 0);
      sanitized.hourlyRate = safeNumber(sanitized.hourlyRate, 0);
      sanitized.totalAmount = safeNumber(sanitized.totalAmount, 0);
      return sanitized;
    });
  },

  async create(overtime: Omit<EmployeeOvertime, 'id' | 'createdAt'>): Promise<string> {
    const sanitizedOvertime = {
      ...overtime,
      hours: safeNumber(overtime.hours, 0),
      hourlyRate: safeNumber(overtime.hourlyRate, 0),
      totalAmount: safeNumber(overtime.totalAmount, 0)
    };
    
    logMonetaryValues(sanitizedOvertime, 'Create Employee Overtime');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      return await saveOffline('employee_overtimes', sanitizedOvertime);
    }

    const { data, error } = await supabase
      .from('employee_overtimes')
      .insert([transformToSnakeCase(sanitizedOvertime)])
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  },

  async update(id: string, overtime: Partial<EmployeeOvertime>): Promise<void> {
    const sanitizedOvertime = sanitizeSupabaseData(overtime);
    logMonetaryValues(sanitizedOvertime, 'Update Employee Overtime');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueue({
        type: 'update',
        table: 'employee_overtimes',
        data: { id, ...sanitizedOvertime },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('employee_overtimes')
      .update(transformToSnakeCase(sanitizedOvertime))
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Employee Commissions Service
export const employeeCommissionsService = {
  async getCommissions(): Promise<EmployeeCommission[]> {
    const data = await safeSupabaseOperation(
      () => supabase.from('employee_commissions').select('*').order('date', { ascending: false }),
      [],
      'Get Employee Commissions'
    );
    
    if (!data) return [];
    
    return data.map(commission => {
      const sanitized = sanitizeSupabaseData(transformFromSnakeCase(commission));
      sanitized.saleValue = safeNumber(sanitized.saleValue, 0);
      sanitized.commissionRate = safeNumber(sanitized.commissionRate, 5);
      sanitized.commissionAmount = safeNumber(sanitized.commissionAmount, 0);
      return sanitized;
    });
  },

  async update(id: string, commission: Partial<EmployeeCommission>): Promise<void> {
    const sanitizedCommission = sanitizeSupabaseData(commission);
    logMonetaryValues(sanitizedCommission, 'Update Employee Commission');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueue({
        type: 'update',
        table: 'employee_commissions',
        data: { id, ...sanitizedCommission },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('employee_commissions')
      .update(transformToSnakeCase(sanitizedCommission))
      .eq('id', id);
    
    if (error) throw error;
  }
};

// PIX Fees Service
export const pixFeesService = {
  async getPixFees(): Promise<PixFee[]> {
    const data = await safeSupabaseOperation(
      () => supabase.from('pix_fees').select('*').order('date', { ascending: false }),
      [],
      'Get PIX Fees'
    );
    
    if (!data) return [];
    
    return data.map(fee => {
      const sanitized = sanitizeSupabaseData(transformFromSnakeCase(fee));
      sanitized.amount = safeNumber(sanitized.amount, 0);
      return sanitized;
    });
  },

  async create(pixFee: Omit<PixFee, 'id' | 'createdAt'>): Promise<string> {
    const sanitizedPixFee = {
      ...pixFee,
      amount: safeNumber(pixFee.amount, 0)
    };
    
    logMonetaryValues(sanitizedPixFee, 'Create PIX Fee');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      return await saveOffline('pix_fees', sanitizedPixFee);
    }

    const { data, error } = await supabase
      .from('pix_fees')
      .insert([transformToSnakeCase(sanitizedPixFee)])
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  },

  async update(id: string, pixFee: Partial<PixFee>): Promise<void> {
    const sanitizedPixFee = sanitizeSupabaseData(pixFee);
    logMonetaryValues(sanitizedPixFee, 'Update PIX Fee');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueue({
        type: 'update',
        table: 'pix_fees',
        data: { id, ...sanitizedPixFee },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('pix_fees')
      .update(transformToSnakeCase(sanitizedPixFee))
      .eq('id', id);
    
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueue({
        type: 'delete',
        table: 'pix_fees',
        data: { id },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('pix_fees')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Taxes Service
export const taxesService = {
  async getTaxes(): Promise<Tax[]> {
    const data = await safeSupabaseOperation(
      () => supabase.from('taxes').select('*').order('date', { ascending: false }),
      [],
      'Get Taxes'
    );
    
    if (!data) return [];
    
    return data.map(tax => {
      const sanitized = sanitizeSupabaseData(transformFromSnakeCase(tax));
      sanitized.amount = safeNumber(sanitized.amount, 0);
      return sanitized;
    });
  },

  async create(tax: Omit<Tax, 'id' | 'createdAt'>): Promise<string> {
    const sanitizedTax = {
      ...tax,
      amount: safeNumber(tax.amount, 0)
    };
    
    logMonetaryValues(sanitizedTax, 'Create Tax');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      return await saveOffline('taxes', sanitizedTax);
    }

    const { data, error } = await supabase
      .from('taxes')
      .insert([transformToSnakeCase(sanitizedTax)])
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  },

  async update(id: string, tax: Partial<Tax>): Promise<void> {
    const sanitizedTax = sanitizeSupabaseData(tax);
    logMonetaryValues(sanitizedTax, 'Update Tax');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueue({
        type: 'update',
        table: 'taxes',
        data: { id, ...sanitizedTax },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('taxes')
      .update(transformToSnakeCase(sanitizedTax))
      .eq('id', id);
    
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueue({
        type: 'delete',
        table: 'taxes',
        data: { id },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('taxes')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Agenda Service
export const agendaService = {
  async getEvents(): Promise<AgendaEvent[]> {
    const data = await safeSupabaseOperation(
      () => supabase.from('agenda_events').select('*').order('date', { ascending: false }),
      [],
      'Get Agenda Events'
    );
    
    if (!data) return [];
    
    return data.map(event => transformFromSnakeCase(event));
  },

  async create(event: Omit<AgendaEvent, 'id' | 'createdAt'>): Promise<string> {
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      return await saveOffline('agenda_events', event);
    }

    const { data, error } = await supabase
      .from('agenda_events')
      .insert([transformToSnakeCase(event)])
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  },

  async update(id: string, event: Partial<AgendaEvent>): Promise<void> {
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueue({
        type: 'update',
        table: 'agenda_events',
        data: { id, ...event },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('agenda_events')
      .update(transformToSnakeCase(event))
      .eq('id', id);
    
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueue({
        type: 'delete',
        table: 'agenda_events',
        data: { id },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('agenda_events')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Acertos Service
export const acertosService = {
  async getAcertos(): Promise<Acerto[]> {
    const data = await safeSupabaseOperation(
      () => supabase.from('acertos').select('*').order('created_at', { ascending: false }),
      [],
      'Get Acertos'
    );
    
    if (!data) return [];
    
    return data.map(acerto => {
      const sanitized = sanitizeSupabaseData(transformFromSnakeCase(acerto));
      
      // Ensure all monetary fields are numbers
      sanitized.totalAmount = safeNumber(sanitized.totalAmount, 0);
      sanitized.paidAmount = safeNumber(sanitized.paidAmount, 0);
      sanitized.pendingAmount = safeNumber(sanitized.pendingAmount, 0);
      sanitized.paymentInstallments = safeNumber(sanitized.paymentInstallments, 1);
      sanitized.paymentInstallmentValue = safeNumber(sanitized.paymentInstallmentValue, 0);
      sanitized.paymentInterval = safeNumber(sanitized.paymentInterval, 30);
      
      return sanitized;
    });
  },

  async create(acerto: Omit<Acerto, 'id' | 'createdAt'>): Promise<string> {
    const sanitizedAcerto = {
      ...acerto,
      totalAmount: safeNumber(acerto.totalAmount, 0),
      paidAmount: safeNumber(acerto.paidAmount, 0),
      pendingAmount: safeNumber(acerto.pendingAmount, 0),
      paymentInstallments: safeNumber(acerto.paymentInstallments, 1),
      paymentInstallmentValue: safeNumber(acerto.paymentInstallmentValue, 0),
      paymentInterval: safeNumber(acerto.paymentInterval, 30)
    };
    
    logMonetaryValues(sanitizedAcerto, 'Create Acerto');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      return await saveOffline('acertos', sanitizedAcerto);
    }

    const { data, error } = await supabase
      .from('acertos')
      .insert([transformToSnakeCase(sanitizedAcerto)])
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  },

  async update(id: string, acerto: Partial<Acerto>): Promise<void> {
    const sanitizedAcerto = sanitizeSupabaseData(acerto);
    logMonetaryValues(sanitizedAcerto, 'Update Acerto');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueue({
        type: 'update',
        table: 'acertos',
        data: { id, ...sanitizedAcerto },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('acertos')
      .update(transformToSnakeCase(sanitizedAcerto))
      .eq('id', id);
    
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueue({
        type: 'delete',
        table: 'acertos',
        data: { id },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('acertos')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Permutas Service
export const permutasService = {
  async getPermutas(): Promise<Permuta[]> {
    console.log('🔄 Loading permutas from Supabase...');
    
    const data = await safeSupabaseOperation(
      () => supabase.from('permutas').select('*').order('created_at', { ascending: false }),
      [],
      'Get Permutas'
    );
    
    if (!data) {
      console.log('⚠️ No permutas data received from Supabase');
      return [];
    }
    
    console.log(`✅ Loaded ${data.length} permutas from Supabase`);
    
    return data.map(permuta => {
      const sanitized = sanitizeSupabaseData(transformFromSnakeCase(permuta));
      
      // Ensure all monetary fields are numbers
      sanitized.vehicleValue = safeNumber(sanitized.vehicleValue, 0);
      sanitized.consumedValue = safeNumber(sanitized.consumedValue, 0);
      sanitized.remainingValue = safeNumber(sanitized.remainingValue, 0);
      sanitized.vehicleYear = safeNumber(sanitized.vehicleYear, new Date().getFullYear());
      sanitized.vehicleMileage = safeNumber(sanitized.vehicleMileage, 0);
      
      return sanitized;
    });
  },

  async create(permuta: Omit<Permuta, 'id' | 'createdAt'>): Promise<string> {
    const sanitizedPermuta = {
      ...permuta,
      vehicleValue: safeNumber(permuta.vehicleValue, 0),
      consumedValue: safeNumber(permuta.consumedValue, 0),
      remainingValue: safeNumber(permuta.remainingValue, 0),
      vehicleYear: safeNumber(permuta.vehicleYear, new Date().getFullYear()),
      vehicleMileage: safeNumber(permuta.vehicleMileage, 0)
    };
    
    logMonetaryValues(sanitizedPermuta, 'Create Permuta');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      return await saveOffline('permutas', sanitizedPermuta);
    }

    const { data, error } = await supabase
      .from('permutas')
      .insert([transformToSnakeCase(sanitizedPermuta)])
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  },

  async update(id: string, permuta: Partial<Permuta>): Promise<void> {
    const sanitizedPermuta = sanitizeSupabaseData(permuta);
    logMonetaryValues(sanitizedPermuta, 'Update Permuta');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueue({
        type: 'update',
        table: 'permutas',
        data: { id, ...sanitizedPermuta },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('permutas')
      .update(transformToSnakeCase(sanitizedPermuta))
      .eq('id', id);
    
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      await addToSyncQueue({
        type: 'delete',
        table: 'permutas',
        data: { id },
        maxRetries: 3
      });
      return;
    }

    const { error } = await supabase
      .from('permutas')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Debug Service
export const debugService = {
  async getRecentSaleErrors(limit: number = 50): Promise<any[]> {
    const data = await safeSupabaseOperation(
      () => supabase
        .from('create_sale_errors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit),
      [],
      'Get Sale Errors'
    );
    
    return data || [];
  },

  async cleanupOldErrors(daysOld: number = 7): Promise<number> {
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const { data, error } = await supabase
      .from('create_sale_errors')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select('id');
    
    if (error) throw error;
    return data?.length || 0;
  }
};

// Export aggregated services object
export const supabaseServices = {
  sales: salesService,
  employees: employeeService,
  cashBalance: cashService,
  cashTransactions: cashService,
  debts: debtsService,
  checks: checksService,
  boletos: boletosService,
  employeePayments: employeePaymentsService,
  employeeAdvances: employeeAdvancesService,
  employeeOvertimes: employeeOvertimesService,
  employeeCommissions: employeeCommissionsService,
  pixFees: pixFeesService,
  taxes: taxesService,
  agendaEvents: agendaService,
  acertos: acertosService,
  permutas: permutasService
};

// Image upload service
export async function uploadCheckImage(file: File, checkId: string, imageType: 'front' | 'back'): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado');
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${checkId}_${imageType}.${fileExt}`;
  const filePath = `checks/${fileName}`;

  const { data, error } = await supabase.storage
    .from('check-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) throw error;
  return data.path;
}

export async function deleteCheckImage(imagePath: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado');
  }

  const { error } = await supabase.storage
    .from('check-images')
    .remove([imagePath]);

  if (error) throw error;
}

export function getCheckImageUrl(imagePath: string): string {
  if (!isSupabaseConfigured()) {
    return '';
  }

  const { data } = supabase.storage
    .from('check-images')
    .getPublicUrl(imagePath);

  return data.publicUrl;
}

// Connection test
export async function checkSupabaseConnection(): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { 
      success: false, 
      error: 'Supabase não configurado. Configure o arquivo .env com suas credenciais.' 
    };
  }
  
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('id')
      .limit(1);
    
    if (error) {
      return { 
        success: false, 
        error: `Erro de conexão: ${error.message}` 
      };
    }
    
    return { success: true };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}