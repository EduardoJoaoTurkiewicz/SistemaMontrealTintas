// Enhanced Supabase services with robust deduplication and UUID management

import { supabase, isSupabaseConfigured } from './supabase';
import { UUIDManager } from './uuidManager';
import { DeduplicationService } from './deduplicationService';
import { saveOfflineEnhanced, addToSyncQueueEnhanced } from './enhancedOfflineStorage';
import { connectionManager } from './connectionManager';
import { sanitizeSupabaseData, safeNumber, logMonetaryValues, transformToSnakeCase, transformFromSnakeCase } from '../utils/numberUtils';
import { ErrorHandler } from './errorHandler';
import type { Sale, Employee, Debt, Check, Boleto, CashBalance, CashTransaction } from '../types';

// Enhanced helper function for safe Supabase operations
async function safeSupabaseOperationEnhanced<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  fallbackValue: T | null = null,
  context: string = 'Unknown'
): Promise<T | null> {
  if (!isSupabaseConfigured()) {
    console.warn(`⚠️ Supabase not configured for ${context} - working offline`);
    return fallbackValue;
  }

  if (!connectionManager.isConnected()) {
    console.warn(`⚠️ No connection for ${context} - working offline`);
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

// Enhanced Sales Service
export const enhancedSalesService = {
  async getSales(): Promise<Sale[]> {
    const data = await safeSupabaseOperationEnhanced(
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
    
    // Remove any duplicates that might exist
    return DeduplicationService.removeDuplicatesById(salesData);
  },

  async create(sale: Omit<Sale, 'id' | 'createdAt'> & { bulk_insert_id?: string; origin_file_name?: string }): Promise<string> {
    console.log('🔄 Enhanced sales service - creating sale:', sale.client);

    // Extract optional bulk metadata
    const bulkInsertId = (sale as any).bulk_insert_id;
    const originFileName = (sale as any).origin_file_name;

    if (bulkInsertId) {
      console.log(`📦 Sale belongs to batch: ${bulkInsertId} from file: ${originFileName}`);
    }

    // Generate UUID for the sale
    const saleId = UUIDManager.generateUUID();
    const saleWithId = { ...sale, id: saleId };

    // Clean UUID fields
    const cleanedSale = UUIDManager.cleanObjectUUIDs(saleWithId);

    // Sanitize monetary values
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

    logMonetaryValues(sanitizedSale, 'Enhanced Create Sale');

    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      console.log('💾 Saving sale offline with enhanced storage');
      return await saveOfflineEnhanced('sales', sanitizedSale);
    }

    try {
      // Check for duplicates before creating
      const duplicateCheck = await DeduplicationService.checkSaleDuplicate(sanitizedSale);
      if (duplicateCheck.isDuplicate) {
        console.log('⚠️ Sale duplicate detected, returning existing ID:', duplicateCheck.existingId);
        return duplicateCheck.existingId!;
      }

      console.log('🔄 Creating sale in Supabase with RPC...');
      const payload = transformToSnakeCase(sanitizedSale);

      // Add optional bulk metadata if provided
      if (bulkInsertId) {
        (payload as any).bulk_insert_id = bulkInsertId;
      }
      if (originFileName) {
        (payload as any).origin_file_name = originFileName;
      }

      const { data, error } = await supabase.rpc('create_sale', { payload });

      if (error) {
        console.error('❌ Supabase RPC error:', error);
        throw error;
      }

      // Parse the RPC response to extract the actual sale ID
      let returnedSaleId: string;
      if (typeof data === 'string') {
        try {
          const parsedData = JSON.parse(data);
          returnedSaleId = parsedData.sale_id || data;
        } catch {
          returnedSaleId = data;
        }
      } else if (data && typeof data === 'object' && data.sale_id) {
        returnedSaleId = data.sale_id;
      } else {
        returnedSaleId = data;
      }

      console.log('✅ Enhanced sale created with ID:', returnedSaleId);

      // Process installments after sale creation
      try {
        const { InstallmentService } = await import('./installmentService');
        await InstallmentService.processInstallmentsForSale(returnedSaleId, sanitizedSale.client, sanitizedSale.paymentMethods || [], sanitizedSale.cliente_id ?? null);
        console.log('✅ Installments processed successfully for sale:', returnedSaleId);
      } catch (installmentError) {
        console.error('❌ Error processing installments for sale:', installmentError);
      }

      // Process credit card sales - create records in credit_card_sales table
      try {
        for (const method of sanitizedSale.paymentMethods || []) {
          if (method.type === 'cartao_credito') {
            const { CreditCardService } = await import('./creditCardService');
            const installments = safeNumber(method.installments, 1);
            await CreditCardService.createFromSale({
              saleId: returnedSaleId,
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

      // Register delivery event in agenda if delivery date exists
      if (sanitizedSale.deliveryDate) {
        try {
          const { AgendaAutoService } = await import('./agendaAutoService');

          // Build payment methods summary
          const paymentMethodsSummary = (sanitizedSale.paymentMethods || [])
            .map(pm => {
              if (pm.installments && pm.installments > 1) {
                return `${pm.type} (${pm.installments}x)`;
              }
              return pm.type;
            })
            .join(', ');

          await AgendaAutoService.registerSaleDelivery(
            returnedSaleId,
            sanitizedSale.deliveryDate,
            sanitizedSale.client,
            {
              totalValue: sanitizedSale.totalValue,
              products: typeof sanitizedSale.products === 'string' ? sanitizedSale.products : 'Produtos da venda',
              paymentMethods: paymentMethodsSummary
            }
          );
          console.log('✅ Delivery event registered in agenda for:', sanitizedSale.deliveryDate);
        } catch (agendaError) {
          console.error('❌ Error registering delivery event in agenda:', agendaError);
          // Don't throw - agenda is not critical
        }
      }

      return returnedSaleId;
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
    const cleanedSale = UUIDManager.cleanObjectUUIDs(sale);
    const sanitizedSale = sanitizeSupabaseData(cleanedSale);
    logMonetaryValues(sanitizedSale, 'Enhanced Update Sale');

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

    // Update delivery event in agenda if delivery date changed
    if (sanitizedSale.deliveryDate !== undefined) {
      try {
        const { AgendaAutoService } = await import('./agendaAutoService');

        // Remove old delivery events
        await AgendaAutoService.removeEventsByRelatedId('venda', id);

        // Add new delivery event if delivery date exists
        if (sanitizedSale.deliveryDate && sanitizedSale.client) {
          const paymentMethodsSummary = (sanitizedSale.paymentMethods || [])
            .map(pm => {
              if (pm.installments && pm.installments > 1) {
                return `${pm.type} (${pm.installments}x)`;
              }
              return pm.type;
            })
            .join(', ');

          await AgendaAutoService.registerSaleDelivery(
            id,
            sanitizedSale.deliveryDate,
            sanitizedSale.client,
            {
              totalValue: sanitizedSale.totalValue,
              products: typeof sanitizedSale.products === 'string' ? sanitizedSale.products : 'Produtos da venda',
              paymentMethods: paymentMethodsSummary
            }
          );
          console.log('✅ Delivery event updated in agenda');
        }
      } catch (agendaError) {
        console.error('❌ Error updating delivery event in agenda:', agendaError);
        // Don't throw - agenda is not critical
      }
    }
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

    // Remove delivery events from agenda
    try {
      const { AgendaAutoService } = await import('./agendaAutoService');
      await AgendaAutoService.removeEventsByRelatedId('venda', id);
      console.log('✅ Delivery events removed from agenda');
    } catch (agendaError) {
      console.error('❌ Error removing delivery events from agenda:', agendaError);
      // Don't throw - agenda is not critical
    }
  }
};

// Enhanced Debts Service
export const enhancedDebtsService = {
  async getDebts(): Promise<Debt[]> {
    const data = await safeSupabaseOperationEnhanced(
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
    
    // Remove any duplicates that might exist
    return DeduplicationService.removeDuplicatesById(debtsData);
  },

  async create(debt: Omit<Debt, 'id' | 'createdAt'>): Promise<string> {
    console.log('🔄 Enhanced debts service - creating debt:', debt.company);
    
    // Generate UUID for the debt
    const debtId = UUIDManager.generateUUID();
    const debtWithId = { ...debt, id: debtId };
    
    // Clean UUID fields
    const cleanedDebt = UUIDManager.cleanObjectUUIDs(debtWithId);
    
    // Sanitize monetary values
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
    
    logMonetaryValues(sanitizedDebt, 'Enhanced Create Debt');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      console.log('💾 Saving debt offline with enhanced storage');
      return await saveOfflineEnhanced('debts', sanitizedDebt);
    }

    try {
      // Check for duplicates before creating
      const duplicateCheck = await DeduplicationService.checkDebtDuplicate(sanitizedDebt);
      if (duplicateCheck.isDuplicate) {
        console.log('⚠️ Debt duplicate detected, returning existing ID:', duplicateCheck.existingId);
        return duplicateCheck.existingId!;
      }

      console.log('🔄 Creating debt in Supabase...');
      const { data, error } = await supabase
        .from('debts')
        .insert([transformToSnakeCase(sanitizedDebt)])
        .select()
        .single();
      
      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }
      
      console.log('✅ Enhanced debt created with ID:', data.id);
      
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

      return data.id;
    } catch (error) {
      console.error('❌ Error creating debt:', error);
      
      // Save offline if network error
      if (error?.message?.includes('Failed to fetch') || error?.message?.includes('Network error')) {
        console.log('💾 Saving debt offline due to network error');
        return await saveOfflineEnhanced('debts', sanitizedDebt);
      }
      
      throw error;
    }
  },

  async update(id: string, debt: Partial<Debt>): Promise<void> {
    const cleanedDebt = UUIDManager.cleanObjectUUIDs(debt);
    const sanitizedDebt = sanitizeSupabaseData(cleanedDebt);
    logMonetaryValues(sanitizedDebt, 'Enhanced Update Debt');
    
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

// Enhanced Employees Service
export const enhancedEmployeesService = {
  async getEmployees(): Promise<Employee[]> {
    const data = await safeSupabaseOperationEnhanced(
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
    
    // Remove any duplicates that might exist
    return DeduplicationService.removeDuplicatesById(employeesData);
  },

  async create(employee: Omit<Employee, 'id' | 'createdAt'>): Promise<string> {
    console.log('🔄 Enhanced employees service - creating employee:', employee.name);
    
    // Generate UUID for the employee
    const employeeId = UUIDManager.generateUUID();
    const employeeWithId = { ...employee, id: employeeId };
    
    // Clean UUID fields
    const cleanedEmployee = UUIDManager.cleanObjectUUIDs(employeeWithId);
    
    // Sanitize monetary values
    const sanitizedEmployee = {
      ...cleanedEmployee,
      salary: safeNumber(cleanedEmployee.salary, 0),
      paymentDay: safeNumber(cleanedEmployee.paymentDay, 5)
    };
    
    logMonetaryValues(sanitizedEmployee, 'Enhanced Create Employee');
    
    if (!isSupabaseConfigured() || !connectionManager.isConnected()) {
      console.log('💾 Saving employee offline with enhanced storage');
      return await saveOfflineEnhanced('employees', sanitizedEmployee);
    }

    try {
      // Check for duplicates before creating
      const duplicateCheck = await DeduplicationService.checkEmployeeDuplicate(sanitizedEmployee);
      if (duplicateCheck.isDuplicate) {
        console.log('⚠️ Employee duplicate detected, returning existing ID:', duplicateCheck.existingId);
        return duplicateCheck.existingId!;
      }

      console.log('🔄 Creating employee in Supabase...');
      const { data, error } = await supabase
        .from('employees')
        .insert([transformToSnakeCase(sanitizedEmployee)])
        .select()
        .single();
      
      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }
      
      console.log('✅ Enhanced employee created with ID:', data.id);
      return data.id;
    } catch (error) {
      console.error('❌ Error creating employee:', error);
      
      // Save offline if network error
      if (error?.message?.includes('Failed to fetch') || error?.message?.includes('Network error')) {
        console.log('💾 Saving employee offline due to network error');
        return await saveOfflineEnhanced('employees', sanitizedEmployee);
      }
      
      throw error;
    }
  },

  async update(id: string, employee: Partial<Employee>): Promise<void> {
    const cleanedEmployee = UUIDManager.cleanObjectUUIDs(employee);
    const sanitizedEmployee = sanitizeSupabaseData(cleanedEmployee);
    logMonetaryValues(sanitizedEmployee, 'Enhanced Update Employee');
    
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

// Export enhanced services
export const enhancedSupabaseServices = {
  sales: enhancedSalesService,
  debts: enhancedDebtsService,
  employees: enhancedEmployeesService
};