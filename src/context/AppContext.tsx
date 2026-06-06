import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { supabaseServices, enhancedSupabaseServices } from '../lib/supabaseServices';
import { enhancedSyncManager } from '../lib/enhancedSyncManager';
import { getOfflineDataEnhanced, mergeOnlineOfflineDataEnhanced } from '../lib/enhancedOfflineStorage';
import { DeduplicationService } from '../lib/deduplicationService';
import { UUIDManager } from '../lib/uuidManager';
import { connectionManager } from '../lib/connectionManager';
import { ErrorHandler } from '../lib/errorHandler';
import { estoqueService } from '../lib/estoqueService';
import { producaoService } from '../lib/producaoService';
import { listarClientes, criarCliente, atualizarCliente, deletarCliente } from '../lib/clienteService';
import { orcamentoService } from '../lib/orcamentoService';
import { StatusCalculationService } from '../lib/statusCalculationService';
import { fornecedorService } from '../lib/fornecedorService';
import type { EstoqueProdutoCompleto, ProducaoCompleta, Cliente, ClienteFormData, Orcamento, OrcamentoItem, Fornecedor } from '../types';

interface AppContextType {
  // Loading and error states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  user: any;
  setUser: (user: any) => void;

  // Data states
  sales: any[];
  employees: any[];
  debts: any[];
  checks: any[];
  boletos: any[];
  employeeCommissions: any[];
  employeePayments: any[];
  employeeAdvances: any[];
  employeeOvertimes: any[];
  pixFees: any[];
  taxes: any[];
  agendaEvents: any[];
  acertos: any[];
  cashBalance: any;
  cashTransactions: any[];
  permutas: any[];

  // Data loading function
  loadAllData: () => Promise<void>;

  // Cash balance functions
  recalculateCashBalance: () => Promise<void>;
  initializeCashBalance: (amount: number) => Promise<void>;

  // CRUD functions for sales
  createSale: (saleData: any) => Promise<any>;
  updateSale: (saleData: any) => Promise<any>;
  deleteSale: (id: string) => Promise<void>;

  // CRUD functions for employees
  createEmployee: (employeeData: any) => Promise<any>;
  updateEmployee: (employeeData: any) => Promise<any>;
  deleteEmployee: (id: string) => Promise<void>;

  // CRUD functions for debts
  createDebt: (debtData: any) => Promise<any>;
  updateDebt: (debtData: any) => Promise<any>;
  deleteDebt: (id: string) => Promise<void>;

  // CRUD functions for checks
  createCheck: (checkData: any) => Promise<any>;
  updateCheck: (checkData: any) => Promise<any>;
  deleteCheck: (id: string) => Promise<void>;

  // CRUD functions for boletos
  createBoleto: (boletoData: any) => Promise<any>;
  updateBoleto: (boletoData: any) => Promise<any>;
  deleteBoleto: (id: string) => Promise<void>;

  // Other CRUD functions
  createEmployeePayment: (paymentData: any) => Promise<any>;
  createEmployeeAdvance: (advanceData: any) => Promise<any>;
  createEmployeeOvertime: (overtimeData: any) => Promise<any>;
  createPixFee: (feeData: any) => Promise<any>;
  updatePixFee: (id: string, feeData: any) => Promise<any>;
  deletePixFee: (id: string) => Promise<void>;
  createTax: (taxData: any) => Promise<any>;
  updateTax: (id: string, taxData: any) => Promise<any>;
  deleteTax: (id: string) => Promise<void>;
  createAgendaEvent: (eventData: any) => Promise<any>;
  updateAgendaEvent: (eventData: any) => Promise<any>;
  deleteAgendaEvent: (id: string) => Promise<void>;
  createAcerto: (acertoData: any) => Promise<any>;
  updateAcerto: (acertoData: any) => Promise<any>;
  deleteAcerto: (id: string) => Promise<void>;
  createCashTransaction: (transactionData: any) => Promise<any>;
  updateCashTransaction: (transactionData: any) => Promise<any>;
  deleteCashTransaction: (id: string) => Promise<void>;

  // CRUD functions for permutas
  createPermuta: (permutaData: any) => Promise<any>;
  updatePermuta: (permutaData: any) => Promise<any>;
  deletePermuta: (id: string) => Promise<void>;

  // Navigation
  navigateToPage: (page: string) => void;
  setNavigateToPage: (fn: (page: string) => void) => void;

  // Estoque
  estoqueProdutos: EstoqueProdutoCompleto[];
  isLoadingEstoque: boolean;
  loadEstoqueData: () => Promise<void>;
  createEstoqueProduto: (
    nome: string,
    descricao: string | undefined,
    temCor: boolean,
    cores: string[],
    variacoes: { nomeVariacao: string; valorUnitarioPadrao: number; descricao?: string; validadeMeses?: number }[]
  ) => Promise<EstoqueProdutoCompleto>;
  updateEstoqueProduto: (id: string, nome: string, descricao?: string) => Promise<void>;
  updateEstoqueVariacao: (id: string, nomeVariacao: string, valorUnitarioPadrao: number, descricao?: string, validadeMeses?: number) => Promise<void>;
  updateEstoqueCor: (id: string, nomeCor: string) => Promise<void>;
  removeEstoqueVariacao: (variacaoId: string) => Promise<void>;
  removeEstoqueCor: (corId: string) => Promise<void>;
  deleteEstoqueProduto: (produtoId: string) => Promise<void>;
  updateEstoqueSaldo: (saldoId: string, quantidadeAtual: number) => Promise<void>;
  addEstoqueCor: (produtoId: string, nomeCor: string) => Promise<void>;
  addEstoqueVariacao: (produtoId: string, nomeVariacao: string, valorUnitarioPadrao: number, descricao?: string, validadeMeses?: number) => Promise<void>;

  // Producao
  producoes: ProducaoCompleta[];
  isLoadingProducao: boolean;
  loadProducaoData: () => Promise<void>;
  createProducao: (
    titulo: string,
    lote: string,
    fabricacaoDate: Date,
    itens: { produtoId: string; variacaoId: string; corId?: string; quantidade: number }[]
  ) => Promise<ProducaoCompleta>;
  gerarProximoLote: (data: Date) => Promise<string>;

  // Clientes
  clientes: Cliente[];
  isLoadingClientes: boolean;
  loadClientesData: () => Promise<void>;
  createCliente: (data: ClienteFormData) => Promise<Cliente>;
  updateCliente: (id: string, data: Partial<ClienteFormData>) => Promise<Cliente>;
  deleteCliente: (id: string) => Promise<void>;

  // Orcamentos
  orcamentos: Orcamento[];
  isLoadingOrcamentos: boolean;
  loadOrcamentosData: () => Promise<void>;
  createOrcamento: (payload: Omit<Orcamento, 'id' | 'numero' | 'createdAt' | 'updatedAt' | 'itens'> & { itens: OrcamentoItem[] }) => Promise<Orcamento | null>;
  updateOrcamento: (id: string, updates: Partial<Omit<Orcamento, 'itens'>>) => Promise<Orcamento | null>;
  deleteOrcamento: (id: string) => Promise<void>;
  marcarOrcamentoConvertido: (id: string, vendaId: string) => Promise<void>;

  // Pending quote-to-sale prefill
  orcamentoPrefill: Orcamento | null;
  setOrcamentoPrefill: (o: Orcamento | null) => void;

  // Fornecedores
  fornecedores: Fornecedor[];
  isLoadingFornecedores: boolean;
  loadFornecedoresData: () => Promise<void>;
  createFornecedor: (data: Omit<Fornecedor, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Fornecedor>;
  updateFornecedor: (id: string, data: Partial<Omit<Fornecedor, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<Fornecedor>;
  deleteFornecedor: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState(null);

  // Data states
  const [sales, setSales] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [checks, setChecks] = useState<any[]>([]);
  const [boletos, setBoletos] = useState<any[]>([]);
  const [employeeCommissions, setEmployeeCommissions] = useState<any[]>([]);
  const [employeePayments, setEmployeePayments] = useState<any[]>([]);
  const [employeeAdvances, setEmployeeAdvances] = useState<any[]>([]);
  const [employeeOvertimes, setEmployeeOvertimes] = useState<any[]>([]);
  const [pixFees, setPixFees] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [agendaEvents, setAgendaEvents] = useState<any[]>([]);
  const [acertos, setAcertos] = useState<any[]>([]);
  const [cashBalance, setCashBalance] = useState<any>(null);
  const [cashTransactions, setCashTransactions] = useState<any[]>([]);
  const [permutas, setPermutas] = useState<any[]>([]);
  const [estoqueProdutos, setEstoqueProdutos] = useState<EstoqueProdutoCompleto[]>([]);
  const [isLoadingEstoque, setIsLoadingEstoque] = useState(false);
  const [producoes, setProducoes] = useState<ProducaoCompleta[]>([]);
  const [isLoadingProducao, setIsLoadingProducao] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoadingClientes, setIsLoadingClientes] = useState(false);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [isLoadingOrcamentos, setIsLoadingOrcamentos] = useState(false);
  const [orcamentoPrefill, setOrcamentoPrefill] = useState<Orcamento | null>(null);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [isLoadingFornecedores, setIsLoadingFornecedores] = useState(false);

  // Track loading state for each data type to prevent multiple loads
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [lastLoadTime, setLastLoadTime] = useState<Record<string, number>>({});
  const isLoadingAllDataRef = useRef(false);
  // Layer 1 guard: prevents concurrent updateCheck calls for the same check id
  const processingCheckIds = useRef(new Set<string>());

  // Navigation function - can be set by App component
  const [_navigateFn, _setNavigateFn] = useState<(page: string) => void>(() => () => {});
  const navigateToPage = (page: string) => _navigateFn(page);
  const setNavigateToPage = (fn: (page: string) => void) => _setNavigateFn(() => fn);

  // Load all data function
  const loadAllData = async () => {
    // Prevent multiple simultaneous loads using ref to avoid stale closure issues
    if (isLoadingAllDataRef.current) {
      console.log('🔄 Data loading already in progress, skipping...');
      return;
    }

    try {
      isLoadingAllDataRef.current = true;
      setLoading(true);
      setError(null);
      setLoadingStates(prev => ({ ...prev, loadAllData: true }));

      // Check if we're online
      const isOnline = connectionManager.getStatus().isOnline;
      
      if (isOnline) {
        // Load data from Supabase with enhanced services
        const [
          salesData,
          employeesData,
          debtsData,
          checksData,
          boletosData,
          commissionsData,
          paymentsData,
          advancesData,
          overtimesData,
          feesData,
          taxesData,
          eventsData,
          acertosData,
          balanceData,
          transactionsData,
          permutasData
        ] = await Promise.all([
          enhancedSupabaseServices.sales.getSales(),
          enhancedSupabaseServices.employees.getEmployees(),
          enhancedSupabaseServices.debts.getDebts(),
          supabaseServices.checks.getChecks(),
          supabaseServices.boletos.getBoletos(),
          supabaseServices.employeeCommissions.getCommissions(),
          supabaseServices.employeePayments.getPayments(),
          supabaseServices.employeeAdvances.getAdvances(),
          supabaseServices.employeeOvertimes.getOvertimes(),
          supabaseServices.pixFees.getPixFees(),
          supabaseServices.taxes.getTaxes(),
          supabaseServices.agendaEvents.getEvents(),
          supabaseServices.acertos.getAcertos(),
          supabaseServices.cashBalance.getCurrentBalance(),
          supabaseServices.cashTransactions.getTransactions(),
          supabaseServices.permutas.getPermutas()
        ]);

        // Merge with offline data and remove duplicates
        const offlineSalesData = await getOfflineDataEnhanced('sales');
        const offlineEmployeesData = await getOfflineDataEnhanced('employees');
        const offlineDebtsData = await getOfflineDataEnhanced('debts');
        
        const mergedSales = mergeOnlineOfflineDataEnhanced(
          salesData || [], 
          offlineSalesData.map(d => d.data)
        );
        const mergedEmployees = mergeOnlineOfflineDataEnhanced(
          employeesData || [], 
          offlineEmployeesData.map(d => d.data)
        );
        const mergedDebts = mergeOnlineOfflineDataEnhanced(
          debtsData || [], 
          offlineDebtsData.map(d => d.data)
        );

        // Update states with deduplicated data
        setSales(DeduplicationService.removeDuplicatesById(mergedSales));
        setEmployees(DeduplicationService.removeDuplicatesById(mergedEmployees));
        setDebts(DeduplicationService.removeDuplicatesById(mergedDebts));
        setChecks(checksData || []);
        setBoletos(boletosData || []);
        setEmployeeCommissions(commissionsData || []);
        setEmployeePayments(paymentsData || []);
        setEmployeeAdvances(advancesData || []);
        setEmployeeOvertimes(overtimesData || []);
        setPixFees(feesData || []);
        setTaxes(taxesData || []);
        setAgendaEvents(eventsData || []);
        setAcertos(acertosData || []);
        setCashBalance(balanceData);
        setCashTransactions(transactionsData || []);
        setPermutas(DeduplicationService.removeDuplicatesById(permutasData || []));

        console.log('✅ Data loaded and merged successfully');
        console.log(`📊 Loaded data summary: ${salesData?.length || 0} sales, ${employeesData?.length || 0} employees, ${debtsData?.length || 0} debts, ${permutasData?.length || 0} permutas`);
      } else {
        // Load data from enhanced offline storage
        const [
          offlineSalesData,
          offlineEmployeesData,
          offlineDebtsData
        ] = await Promise.all([
          getOfflineDataEnhanced('sales'),
          getOfflineDataEnhanced('employees'),
          getOfflineDataEnhanced('debts')
        ]);

        // Set offline data with deduplication
        setSales(DeduplicationService.removeDuplicatesById(offlineSalesData.map(d => d.data)));
        setEmployees(DeduplicationService.removeDuplicatesById(offlineEmployeesData.map(d => d.data)));
        setDebts(DeduplicationService.removeDuplicatesById(offlineDebtsData.map(d => d.data)));
        setPermutas([]); // No offline support for permutas yet
        
        console.log('✅ Offline data loaded with deduplication');
      }
      
      // Update last load time
      setLastLoadTime(prev => ({ ...prev, loadAllData: Date.now() }));
    } catch (err) {
      console.error('Error loading data:', err);
      ErrorHandler.logProjectError(err, 'Load All Data');
      setError(ErrorHandler.handleSupabaseError(err));
    } finally {
      isLoadingAllDataRef.current = false;
      setLoading(false);
      setLoadingStates(prev => ({ ...prev, loadAllData: false }));
    }
  };

  // Cash balance functions
  const recalculateCashBalance = async () => {
    try {
      const balance = await supabaseServices.cashBalance.recalculateBalance();
      setCashBalance(balance);
      return balance;
    } catch (err) {
      console.error('Error recalculating cash balance:', err);
      throw err;
    }
  };

  const initializeCashBalance = async (amount: number) => {
    try {
      const balanceId = await supabaseServices.cashBalance.initializeCashBalance(amount);
      
      // Refresh cash data after initialization
      const balanceData = await supabaseServices.cashBalance.getCurrentBalance();
      setCashBalance(balanceData);
      
      const transactionsData = await supabaseServices.cashTransactions.getTransactions();
      setCashTransactions(transactionsData || []);
      
      console.log('✅ Cash balance initialized successfully with ID:', balanceId);
      return balanceId;
    } catch (err) {
      console.error('Error initializing cash balance:', err);
      throw err;
    }
  };
  // Refresh permutas data
  const refreshPermutasData = async () => {
    try {
      if (connectionManager.isConnected()) {
        const permutasData = await supabaseServices.permutas.getPermutas();
        setPermutas(DeduplicationService.removeDuplicatesById(permutasData || []));
      }
    } catch (error) {
      ErrorHandler.logProjectError(error, 'Refresh Permutas Data');
    }
  };

  // CRUD functions for sales
  const createSale = async (saleData: any) => {
    try {
      console.log('🔄 AppContext.createSale - Enhanced creation');
      const result = await enhancedSupabaseServices.sales.create(saleData);

      // Refresh only sales data with enhanced deduplication
      await refreshSalesData();

      // Also refresh installment-related data to show new checks/boletos immediately
      await refreshInstallmentData();

      // Refresh agenda to show delivery events created automatically
      await refreshAgendaData();

      // Refresh permutas to reflect consumed/remaining values after permuta payment
      const hasPermutaPayment = saleData?.paymentMethods?.some((m: any) => m.type === 'permuta');
      if (hasPermutaPayment) {
        await refreshPermutasData();
      }

      // Notify CreditCard component to reload if credit card payment was used
      const hasCreditCardPayment = saleData?.paymentMethods?.some((m: any) => m.type === 'cartao_credito');
      if (hasCreditCardPayment) {
        window.dispatchEvent(new CustomEvent('creditCardDataChanged'));
      }

      // Notify Acertos component to reload if acerto payment was used
      const hasAcertoPayment = saleData?.paymentMethods?.some((m: any) => m.type === 'acerto');
      if (hasAcertoPayment) {
        await refreshInstallmentData();
      }

      // Refresh commissions so widget updates automatically after sale creation
      await refreshCommissionsData();

      return result;
    } catch (err) {
      console.error('Error creating sale:', err);
      ErrorHandler.logProjectError(err, 'Create Sale');
      throw err;
    }
  };

  const updateSale = async (saleData: any) => {
    try {
      const { id, ...updateData } = saleData;
      const result = await enhancedSupabaseServices.sales.update(id, updateData);
      await refreshSalesData();
      // Refresh agenda in case delivery date changed
      await refreshAgendaData();
      // Refresh permutas in case payment methods changed
      await refreshPermutasData();
      // Refresh commissions in case seller or value changed
      await refreshCommissionsData();
      return result;
    } catch (err) {
      console.error('Error updating sale:', err);
      ErrorHandler.logProjectError(err, 'Update Sale');
      throw err;
    }
  };

  const deleteSale = async (id: string) => {
    try {
      await enhancedSupabaseServices.sales.delete(id);
      await refreshSalesData();
      // Refresh permutas since a sale using permuta may have been deleted
      await refreshPermutasData();
      // Refresh commissions since commission for this sale is deleted by cascade
      await refreshCommissionsData();
    } catch (err) {
      console.error('Error deleting sale:', err);
      ErrorHandler.logProjectError(err, 'Delete Sale');
      throw err;
    }
  };

  // CRUD functions for employees
  const createEmployee = async (employeeData: any) => {
    try {
      const result = await enhancedSupabaseServices.employees.create(employeeData);
      await refreshEmployeesData();
      return result;
    } catch (err) {
      console.error('Error creating employee:', err);
      ErrorHandler.logProjectError(err, 'Create Employee');
      throw err;
    }
  };

  const updateEmployee = async (employeeData: any) => {
    try {
      const { id, ...updateData } = employeeData;
      const result = await enhancedSupabaseServices.employees.update(id, updateData);
      await refreshEmployeesData();
      return result;
    } catch (err) {
      console.error('Error updating employee:', err);
      ErrorHandler.logProjectError(err, 'Update Employee');
      throw err;
    }
  };

  const deleteEmployee = async (id: string) => {
    try {
      await enhancedSupabaseServices.employees.delete(id);
      await refreshEmployeesData();
    } catch (err) {
      console.error('Error deleting employee:', err);
      ErrorHandler.logProjectError(err, 'Delete Employee');
      throw err;
    }
  };

  // CRUD functions for debts
  const createDebt = async (debtData: any) => {
    try {
      const result = await enhancedSupabaseServices.debts.create(debtData);
      await refreshDebtsData();

      // Also refresh installment-related data to show new checks/boletos immediately
      await refreshInstallmentData();

      // Notify CreditCard component to reload if credit card payment was used
      const hasCreditCardPayment = debtData?.paymentMethods?.some((m: any) => m.type === 'cartao_credito');
      if (hasCreditCardPayment) {
        window.dispatchEvent(new CustomEvent('creditCardDataChanged'));
      }

      return result;
    } catch (err) {
      console.error('Error creating debt:', err);
      ErrorHandler.logProjectError(err, 'Create Debt');
      throw err;
    }
  };

  const updateDebt = async (debtData: any) => {
    try {
      const { id, ...updateData } = debtData;
      const result = await enhancedSupabaseServices.debts.update(id, updateData);
      await refreshDebtsData();
      return result;
    } catch (err) {
      console.error('Error updating debt:', err);
      ErrorHandler.logProjectError(err, 'Update Debt');
      throw err;
    }
  };

  const deleteDebt = async (id: string) => {
    try {
      await enhancedSupabaseServices.debts.delete(id);
      await refreshDebtsData();
    } catch (err) {
      console.error('Error deleting debt:', err);
      ErrorHandler.logProjectError(err, 'Delete Debt');
      throw err;
    }
  };

  // Enhanced refresh functions for specific data types
  const refreshSalesData = async () => {
    if (loadingStates.sales) return;
    
    try {
      setLoadingStates(prev => ({ ...prev, sales: true }));
      
      if (connectionManager.isConnected()) {
        const onlineSales = await enhancedSupabaseServices.sales.getSales();
        const offlineSales = await getOfflineDataEnhanced('sales');
        const merged = mergeOnlineOfflineDataEnhanced(onlineSales, offlineSales.map(d => d.data));
        setSales(DeduplicationService.removeDuplicatesById(merged));
      } else {
        const offlineSales = await getOfflineDataEnhanced('sales');
        setSales(DeduplicationService.removeDuplicatesById(offlineSales.map(d => d.data)));
      }
      
      setLastLoadTime(prev => ({ ...prev, sales: Date.now() }));
    } catch (error) {
      ErrorHandler.logProjectError(error, 'Refresh Sales Data');
    } finally {
      setLoadingStates(prev => ({ ...prev, sales: false }));
    }
  };

  const refreshEmployeesData = async () => {
    if (loadingStates.employees) return;
    
    try {
      setLoadingStates(prev => ({ ...prev, employees: true }));
      
      if (connectionManager.isConnected()) {
        const onlineEmployees = await enhancedSupabaseServices.employees.getEmployees();
        const offlineEmployees = await getOfflineDataEnhanced('employees');
        const merged = mergeOnlineOfflineDataEnhanced(onlineEmployees, offlineEmployees.map(d => d.data));
        setEmployees(DeduplicationService.removeDuplicatesById(merged));
      } else {
        const offlineEmployees = await getOfflineDataEnhanced('employees');
        setEmployees(DeduplicationService.removeDuplicatesById(offlineEmployees.map(d => d.data)));
      }
      
      setLastLoadTime(prev => ({ ...prev, employees: Date.now() }));
    } catch (error) {
      ErrorHandler.logProjectError(error, 'Refresh Employees Data');
    } finally {
      setLoadingStates(prev => ({ ...prev, employees: false }));
    }
  };

  const refreshDebtsData = async () => {
    if (loadingStates.debts) return;
    
    try {
      setLoadingStates(prev => ({ ...prev, debts: true }));
      
      if (connectionManager.isConnected()) {
        const onlineDebts = await enhancedSupabaseServices.debts.getDebts();
        const offlineDebts = await getOfflineDataEnhanced('debts');
        const merged = mergeOnlineOfflineDataEnhanced(onlineDebts, offlineDebts.map(d => d.data));
        setDebts(DeduplicationService.removeDuplicatesById(merged));
      } else {
        const offlineDebts = await getOfflineDataEnhanced('debts');
        setDebts(DeduplicationService.removeDuplicatesById(offlineDebts.map(d => d.data)));
      }
      
      setLastLoadTime(prev => ({ ...prev, debts: Date.now() }));
    } catch (error) {
      ErrorHandler.logProjectError(error, 'Refresh Debts Data');
    } finally {
      setLoadingStates(prev => ({ ...prev, debts: false }));
    }
  };

  // CRUD functions for checks
  const createCheck = async (checkData: any) => {
    try {
      const result = await supabaseServices.checks.create(checkData);
      // Refresh only checks data for better performance
      const checksData = await supabaseServices.checks.getChecks();
      setChecks(checksData || []);
      
      // Also refresh cash data since check creation might affect cash
      const balanceData = await supabaseServices.cashBalance.getCurrentBalance();
      setCashBalance(balanceData);
      const transactionsData = await supabaseServices.cashTransactions.getTransactions();
      setCashTransactions(transactionsData || []);
      
      return result;
    } catch (err) {
      console.error('Error creating check:', err);
      throw err;
    }
  };

  const updateCheck = async (checkData: any) => {
    const { id, ...updateData } = checkData;
    // Layer 1 guard: abort if already processing this check to prevent double-clicks
    if (processingCheckIds.current.has(id)) {
      console.warn('⚠️ updateCheck already in progress for id:', id);
      return;
    }
    processingCheckIds.current.add(id);
    try {
      const oldCheck = checks.find(c => c.id === id);
      const result = await supabaseServices.checks.update(id, updateData);

      // Refresh checks data
      const checksData = await supabaseServices.checks.getChecks();
      setChecks(checksData || []);

      // Handle cash balance update and parent status sync for status changes
      if (oldCheck && updateData.status && oldCheck.status !== updateData.status) {
        const { CashBalanceService } = await import('../lib/cashBalanceService');
        await CashBalanceService.handleCheckPayment(
          { ...oldCheck, ...updateData },
          oldCheck.status,
          updateData.status
        );

        // Force recalculation of parent sale/debt status via DB function
        if (oldCheck.saleId) {
          await StatusCalculationService.syncSaleStatus(oldCheck.saleId);
        }
        if (oldCheck.debtId) {
          await StatusCalculationService.syncDebtStatus(oldCheck.debtId);
        }
      }

      // Refresh cash data
      const balanceData = await supabaseServices.cashBalance.getCurrentBalance();
      setCashBalance(balanceData);
      const transactionsData = await supabaseServices.cashTransactions.getTransactions();
      setCashTransactions(transactionsData || []);

      // Refresh related sales and debts to reflect updated status
      await refreshSalesData();
      await refreshDebtsData();

      return result;
    } catch (err) {
      console.error('Error updating check:', err);
      throw err;
    } finally {
      processingCheckIds.current.delete(id);
    }
  };

  const deleteCheck = async (id: string) => {
    try {
      await supabaseServices.checks.delete(id);
      
      // Refresh only checks data for better performance
      const checksData = await supabaseServices.checks.getChecks();
      setChecks(checksData || []);
    } catch (err) {
      console.error('Error deleting check:', err);
      throw err;
    }
  };

  // CRUD functions for boletos
  const createBoleto = async (boletoData: any) => {
    try {
      const result = await supabaseServices.boletos.create(boletoData);
      
      // Refresh only boletos data for better performance
      const boletosData = await supabaseServices.boletos.getBoletos();
      setBoletos(boletosData || []);
      
      // Also refresh cash data since boleto creation might affect cash
      const balanceData = await supabaseServices.cashBalance.getCurrentBalance();
      setCashBalance(balanceData);
      const transactionsData = await supabaseServices.cashTransactions.getTransactions();
      setCashTransactions(transactionsData || []);
      
      return result;
    } catch (err) {
      console.error('Error creating boleto:', err);
      throw err;
    }
  };

  const updateBoleto = async (boletoData: any) => {
    try {
      const { id, ...updateData } = boletoData;
      const oldBoleto = boletos.find(b => b.id === id);
      const result = await supabaseServices.boletos.update(id, updateData);

      // Refresh boletos data
      const boletosData = await supabaseServices.boletos.getBoletos();
      setBoletos(boletosData || []);

      // Handle cash balance update and parent status sync for status changes
      if (oldBoleto && updateData.status && oldBoleto.status !== updateData.status) {
        const { CashBalanceService } = await import('../lib/cashBalanceService');
        await CashBalanceService.handleBoletoPayment(
          { ...oldBoleto, ...updateData },
          oldBoleto.status,
          updateData.status
        );

        // Force recalculation of parent sale/debt status via DB function
        if (oldBoleto.saleId) {
          await StatusCalculationService.syncSaleStatus(oldBoleto.saleId);
        }
        if (oldBoleto.debtId) {
          await StatusCalculationService.syncDebtStatus(oldBoleto.debtId);
        }
      }

      // Refresh cash data
      const balanceData = await supabaseServices.cashBalance.getCurrentBalance();
      setCashBalance(balanceData);
      const transactionsData = await supabaseServices.cashTransactions.getTransactions();
      setCashTransactions(transactionsData || []);

      // Refresh related sales and debts to reflect updated status
      await refreshSalesData();
      await refreshDebtsData();

      return result;
    } catch (err) {
      console.error('Error updating boleto:', err);
      throw err;
    }
  };

  const deleteBoleto = async (id: string) => {
    try {
      await supabaseServices.boletos.delete(id);
      
      // Refresh only boletos data for better performance
      const boletosData = await supabaseServices.boletos.getBoletos();
      setBoletos(boletosData || []);
    } catch (err) {
      console.error('Error deleting boleto:', err);
      throw err;
    }
  };

  // Other CRUD functions
  const createEmployeePayment = async (paymentData: any) => {
    try {
      const result = await supabaseServices.employeePayments.create(paymentData);
      
      // Refresh employee payments and cash data
      const paymentsData = await supabaseServices.employeePayments.getPayments();
      setEmployeePayments(paymentsData || []);
      
      // Refresh cash data since payment affects cash
      const balanceData = await supabaseServices.cashBalance.getCurrentBalance();
      setCashBalance(balanceData);
      const transactionsData = await supabaseServices.cashTransactions.getTransactions();
      setCashTransactions(transactionsData || []);
      
      return result;
    } catch (err) {
      console.error('Error creating employee payment:', err);
      throw err;
    }
  };

  const createEmployeeAdvance = async (advanceData: any) => {
    try {
      const result = await supabaseServices.employeeAdvances.create(advanceData);

      // Also create a corresponding employee_payments record so the advance
      // appears immediately in "Últimos Pagamentos" with type 'adiantamento'.
      try {
        await supabaseServices.employeePayments.create({
          employeeId: advanceData.employeeId,
          amount: advanceData.amount,
          paymentDate: advanceData.date,
          isPaid: true,
          paymentType: 'adiantamento',
          observations: advanceData.description || 'Adiantamento'
        });
      } catch (paymentErr) {
        console.error('Error creating payment record for advance:', paymentErr);
        // Non-fatal — advance itself was saved
      }

      // Refresh employee advances, payments, and cash data
      const advancesData = await supabaseServices.employeeAdvances.getAdvances();
      setEmployeeAdvances(advancesData || []);
      const paymentsData = await supabaseServices.employeePayments.getPayments();
      setEmployeePayments(paymentsData || []);

      // Refresh cash data since advance affects cash
      const balanceData = await supabaseServices.cashBalance.getCurrentBalance();
      setCashBalance(balanceData);
      const transactionsData = await supabaseServices.cashTransactions.getTransactions();
      setCashTransactions(transactionsData || []);

      return result;
    } catch (err) {
      console.error('Error creating employee advance:', err);
      throw err;
    }
  };

  const createEmployeeOvertime = async (overtimeData: any) => {
    try {
      const result = await supabaseServices.employeeOvertimes.create(overtimeData);
      
      // Refresh employee overtimes data
      const overtimesData = await supabaseServices.employeeOvertimes.getOvertimes();
      setEmployeeOvertimes(overtimesData || []);
      
      return result;
    } catch (err) {
      console.error('Error creating employee overtime:', err);
      throw err;
    }
  };

  const createPixFee = async (feeData: any) => {
    try {
      const result = await supabaseServices.pixFees.create(feeData);
      
      // Refresh PIX fees and cash data
      const feesData = await supabaseServices.pixFees.getPixFees();
      setPixFees(feesData || []);
      
      // Refresh cash data since PIX fee affects cash
      const balanceData = await supabaseServices.cashBalance.getCurrentBalance();
      setCashBalance(balanceData);
      const transactionsData = await supabaseServices.cashTransactions.getTransactions();
      setCashTransactions(transactionsData || []);
      
      return result;
    } catch (err) {
      console.error('Error creating pix fee:', err);
      throw err;
    }
  };

  const updatePixFee = async (id: string, feeData: any) => {
    try {
      const result = await supabaseServices.pixFees.update(id, feeData);
      
      // Refresh PIX fees data
      const feesData = await supabaseServices.pixFees.getPixFees();
      setPixFees(feesData || []);
      
      return result;
    } catch (err) {
      console.error('Error updating pix fee:', err);
      throw err;
    }
  };

  const deletePixFee = async (id: string) => {
    try {
      await supabaseServices.pixFees.delete(id);
      
      // Refresh PIX fees data
      const feesData = await supabaseServices.pixFees.getPixFees();
      setPixFees(feesData || []);
    } catch (err) {
      console.error('Error deleting pix fee:', err);
      throw err;
    }
  };
  const createTax = async (taxData: any) => {
    try {
      const result = await supabaseServices.taxes.create(taxData);
      
      // Refresh taxes and cash data
      const taxesData = await supabaseServices.taxes.getTaxes();
      setTaxes(taxesData || []);
      
      // Refresh cash data since tax affects cash
      const balanceData = await supabaseServices.cashBalance.getCurrentBalance();
      setCashBalance(balanceData);
      const transactionsData = await supabaseServices.cashTransactions.getTransactions();
      setCashTransactions(transactionsData || []);
      
      return result;
    } catch (err) {
      console.error('Error creating tax:', err);
      throw err;
    }
  };

  const updateTax = async (id: string, taxData: any) => {
    try {
      const result = await supabaseServices.taxes.update(id, taxData);
      
      // Refresh taxes data
      const taxesData = await supabaseServices.taxes.getTaxes();
      setTaxes(taxesData || []);
      
      return result;
    } catch (err) {
      console.error('Error updating tax:', err);
      throw err;
    }
  };

  const deleteTax = async (id: string) => {
    try {
      await supabaseServices.taxes.delete(id);
      
      // Refresh taxes data
      const taxesData = await supabaseServices.taxes.getTaxes();
      setTaxes(taxesData || []);
    } catch (err) {
      console.error('Error deleting tax:', err);
      throw err;
    }
  };
  const createAgendaEvent = async (eventData: any) => {
    try {
      const result = await supabaseServices.agendaEvents.create(eventData);
      
      // Refresh agenda events data
      const eventsData = await supabaseServices.agendaEvents.getEvents();
      setAgendaEvents(eventsData || []);
      
      return result;
    } catch (err) {
      console.error('Error creating agenda event:', err);
      throw err;
    }
  };

  const updateAgendaEvent = async (eventData: any) => {
    try {
      const { id, ...updateData } = eventData;
      const result = await supabaseServices.agendaEvents.update(id, updateData);
      
      // Refresh agenda events data
      const eventsData = await supabaseServices.agendaEvents.getEvents();
      setAgendaEvents(eventsData || []);
      
      return result;
    } catch (err) {
      console.error('Error updating agenda event:', err);
      throw err;
    }
  };

  const deleteAgendaEvent = async (id: string) => {
    try {
      await supabaseServices.agendaEvents.delete(id);
      
      // Refresh agenda events data
      const eventsData = await supabaseServices.agendaEvents.getEvents();
      setAgendaEvents(eventsData || []);
    } catch (err) {
      console.error('Error deleting agenda event:', err);
      throw err;
    }
  };
  const createAcerto = async (acertoData: any) => {
    try {
      const result = await supabaseServices.acertos.create(acertoData);
      
      // Refresh acertos data
      const acertosData = await supabaseServices.acertos.getAcertos();
      setAcertos(acertosData || []);
      
      return result;
    } catch (err) {
      console.error('Error creating acerto:', err);
      throw err;
    }
  };

  const updateAcerto = async (acertoData: any) => {
    try {
      const { id, ...updateData } = acertoData;
      const result = await supabaseServices.acertos.update(id, updateData);
      
      // Refresh acertos data
      const acertosData = await supabaseServices.acertos.getAcertos();
      setAcertos(acertosData || []);
      
      return result;
    } catch (err) {
      console.error('Error updating acerto:', err);
      throw err;
    }
  };

  const deleteAcerto = async (id: string) => {
    try {
      await supabaseServices.acertos.delete(id);
      
      // Refresh acertos data
      const acertosData = await supabaseServices.acertos.getAcertos();
      setAcertos(acertosData || []);
    } catch (err) {
      console.error('Error deleting acerto:', err);
      throw err;
    }
  };
  const createCashTransaction = async (transactionData: any) => {
    try {
      const result = await supabaseServices.cashTransactions.create(transactionData);
      
      // Refresh cash data
      const balanceData = await supabaseServices.cashBalance.getCurrentBalance();
      setCashBalance(balanceData);
      const transactionsData = await supabaseServices.cashTransactions.getTransactions();
      setCashTransactions(transactionsData || []);
      
      return result;
    } catch (err) {
      console.error('Error creating cash transaction:', err);
      throw err;
    }
  };

  const updateCashTransaction = async (transactionData: any) => {
    try {
      const { id, ...updateData } = transactionData;
      const result = await supabaseServices.cashTransactions.updateTransaction(id, updateData);
      
      // Refresh cash data
      const balanceData = await supabaseServices.cashBalance.getCurrentBalance();
      setCashBalance(balanceData);
      const transactionsData = await supabaseServices.cashTransactions.getTransactions();
      setCashTransactions(transactionsData || []);
      
      return result;
    } catch (err) {
      console.error('Error updating cash transaction:', err);
      throw err;
    }
  };

  const deleteCashTransaction = async (id: string) => {
    try {
      await supabaseServices.cashTransactions.deleteTransaction(id);
      
      // Refresh cash data
      const balanceData = await supabaseServices.cashBalance.getCurrentBalance();
      setCashBalance(balanceData);
      const transactionsData = await supabaseServices.cashTransactions.getTransactions();
      setCashTransactions(transactionsData || []);
    } catch (err) {
      console.error('Error deleting cash transaction:', err);
      throw err;
    }
  };

  // CRUD functions for permutas
  const createPermuta = async (permutaData: any) => {
    try {
      const result = await supabaseServices.permutas.create(permutaData);
      
      // Refresh permutas data
      const permutasData = await supabaseServices.permutas.getPermutas();
      setPermutas(permutasData || []);
      
      return result;
    } catch (err) {
      console.error('Error creating permuta:', err);
      throw err;
    }
  };

  const updatePermuta = async (permutaData: any) => {
    try {
      const { id, ...updateData } = permutaData;
      const result = await supabaseServices.permutas.update(id, updateData);
      
      // Refresh permutas data
      const permutasData = await supabaseServices.permutas.getPermutas();
      setPermutas(permutasData || []);
      
      return result;
    } catch (err) {
      console.error('Error updating permuta:', err);
      throw err;
    }
  };

  const deletePermuta = async (id: string) => {
    try {
      await supabaseServices.permutas.delete(id);
      
      // Refresh permutas data
      const permutasData = await supabaseServices.permutas.getPermutas();
      setPermutas(permutasData || []);
    } catch (err) {
      console.error('Error deleting permuta:', err);
      throw err;
    }
  };

  // Load data on mount
  useEffect(() => {
    let mounted = true;
    
    const initializeData = async () => {
      if (mounted) {
        await loadAllData();
      }
    };
    
    initializeData();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Real-time subscription: update sale status badges without full page reload
  useEffect(() => {
    const channel = supabase
      .channel('sales-status-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sales' },
        (payload) => {
          const updated = payload.new as any;
          if (!updated?.id) return;
          setSales(prev =>
            prev.map(s => s.id === updated.id ? { ...s, ...updated } : s)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Listen for connection changes
  // CRITICAL: Do NOT automatically reload data on connection change
  // This prevents form state from being reset while user is editing
  useEffect(() => {
    let mounted = true;

    const handleConnectionChange = (status: any) => {
      if (status.isOnline && mounted) {
        console.log('✅ Connection restored - ready for next operation');
        // Start background sync but DO NOT reload data automatically
        // User can manually refresh if needed
        enhancedSyncManager.startSync().catch(err => {
          console.error('Background sync error:', err);
        });
      } else if (!status.isOnline) {
        console.log('📴 Connection lost - operating in offline mode');
      }
    };

    const unsubscribe = connectionManager.addListener(handleConnectionChange);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const refreshAgendaData = async () => {
    try {
      const eventsData = await supabaseServices.agendaEvents.getEvents();
      setAgendaEvents(eventsData || []);
    } catch (error) {
      console.error('❌ Error refreshing agenda data:', error);
    }
  };

  const refreshCommissionsData = async () => {
    try {
      if (connectionManager.isConnected()) {
        const commissionsData = await supabaseServices.employeeCommissions.getCommissions();
        setEmployeeCommissions(commissionsData || []);
      }
    } catch (error) {
      console.error('❌ Error refreshing commissions data:', error);
    }
  };

  // Add function to refresh specific data types after installment operations
  const refreshInstallmentData = async () => {
    try {
      // Refresh all installment-related data
      const [checksData, boletosData, acertosData, balanceData, transactionsData] = await Promise.all([
        supabaseServices.checks.getChecks(),
        supabaseServices.boletos.getBoletos(),
        supabaseServices.acertos.getAcertos(),
        supabaseServices.cashBalance.getCurrentBalance(),
        supabaseServices.cashTransactions.getTransactions()
      ]);
      
      setChecks(checksData || []);
      setBoletos(boletosData || []);
      setAcertos(acertosData || []);
      setCashBalance(balanceData);
      setCashTransactions(transactionsData || []);
      
      console.log('✅ Installment data refreshed successfully');
    } catch (error) {
      console.error('❌ Error refreshing installment data:', error);
    }
  };
  const loadOrcamentosData = async (): Promise<void> => {
    try {
      setIsLoadingOrcamentos(true);
      const data = await orcamentoService.getAll();
      setOrcamentos(data);
    } catch (err) {
      console.error('Error loading orcamentos data:', err);
    } finally {
      setIsLoadingOrcamentos(false);
    }
  };

  const createOrcamento = async (
    payload: Omit<Orcamento, 'id' | 'numero' | 'createdAt' | 'updatedAt' | 'itens'> & { itens: OrcamentoItem[] }
  ): Promise<Orcamento | null> => {
    const result = await orcamentoService.create(payload);
    await loadOrcamentosData();
    return result;
  };

  const updateOrcamento = async (id: string, updates: Partial<Omit<Orcamento, 'itens'>>): Promise<Orcamento | null> => {
    const result = await orcamentoService.update(id, updates);
    await loadOrcamentosData();
    return result;
  };

  const deleteOrcamento = async (id: string): Promise<void> => {
    await orcamentoService.delete(id);
    await loadOrcamentosData();
  };

  const marcarOrcamentoConvertido = async (id: string, vendaId: string): Promise<void> => {
    await orcamentoService.marcarComoConvertido(id, vendaId);
    await loadOrcamentosData();
  };

  const loadEstoqueData = async () => {
    try {
      setIsLoadingEstoque(true);
      const data = await estoqueService.getProdutos();
      setEstoqueProdutos(data);
    } catch (err) {
      console.error('Error loading estoque data:', err);
    } finally {
      setIsLoadingEstoque(false);
    }
  };

  const createEstoqueProduto = async (
    nome: string,
    descricao: string | undefined,
    temCor: boolean,
    cores: string[],
    variacoes: { nomeVariacao: string; valorUnitarioPadrao: number; descricao?: string; validadeMeses?: number }[]
  ): Promise<EstoqueProdutoCompleto> => {
    const result = await estoqueService.createProduto(nome, descricao, temCor, cores, variacoes);
    await loadEstoqueData();
    return result;
  };

  const updateEstoqueProduto = async (id: string, nome: string, descricao?: string): Promise<void> => {
    await estoqueService.updateProduto(id, nome, descricao);
    await loadEstoqueData();
  };

  const updateEstoqueVariacao = async (
    id: string,
    nomeVariacao: string,
    valorUnitarioPadrao: number,
    descricao?: string,
    validadeMeses?: number
  ): Promise<void> => {
    await estoqueService.updateVariacao(id, nomeVariacao, valorUnitarioPadrao, descricao, validadeMeses);
    await loadEstoqueData();
  };

  const updateEstoqueCor = async (id: string, nomeCor: string): Promise<void> => {
    await estoqueService.updateCor(id, nomeCor);
    await loadEstoqueData();
  };

  const removeEstoqueVariacao = async (variacaoId: string): Promise<void> => {
    await estoqueService.removeVariacao(variacaoId);
    await loadEstoqueData();
  };

  const removeEstoqueCor = async (corId: string): Promise<void> => {
    await estoqueService.removeCor(corId);
    await loadEstoqueData();
  };

  const deleteEstoqueProduto = async (produtoId: string): Promise<void> => {
    await estoqueService.deleteProduto(produtoId);
    await loadEstoqueData();
  };

  const updateEstoqueSaldo = async (saldoId: string, quantidadeAtual: number): Promise<void> => {
    await estoqueService.updateSaldo(saldoId, quantidadeAtual);
    await loadEstoqueData();
  };

  const addEstoqueCor = async (produtoId: string, nomeCor: string): Promise<void> => {
    await estoqueService.addCor(produtoId, nomeCor);
    await loadEstoqueData();
  };

  const addEstoqueVariacao = async (
    produtoId: string,
    nomeVariacao: string,
    valorUnitarioPadrao: number,
    descricao?: string,
    validadeMeses?: number
  ): Promise<void> => {
    await estoqueService.addVariacao(produtoId, nomeVariacao, valorUnitarioPadrao, descricao, validadeMeses);
    await loadEstoqueData();
  };

  const loadProducaoData = async (): Promise<void> => {
    try {
      setIsLoadingProducao(true);
      const data = await producaoService.getProducoes();
      setProducoes(data);
    } catch (err) {
      console.error('Error loading producao data:', err);
    } finally {
      setIsLoadingProducao(false);
    }
  };

  const createProducao = async (
    titulo: string,
    lote: string,
    fabricacaoDate: Date,
    itens: { produtoId: string; variacaoId: string; corId?: string; quantidade: number }[]
  ): Promise<ProducaoCompleta> => {
    const result = await producaoService.createProducao(titulo, lote, fabricacaoDate, itens);
    await loadProducaoData();
    await loadEstoqueData();
    return result;
  };

  const gerarProximoLote = async (data: Date): Promise<string> => {
    return producaoService.gerarProximoLote(data);
  };

  const loadClientesData = async (): Promise<void> => {
    try {
      setIsLoadingClientes(true);
      const data = await listarClientes();
      setClientes(data);
    } catch (err) {
      console.error('Error loading clientes data:', err);
    } finally {
      setIsLoadingClientes(false);
    }
  };

  const createCliente = async (data: ClienteFormData): Promise<Cliente> => {
    const result = await criarCliente(data);
    await loadClientesData();
    return result;
  };

  const updateCliente = async (id: string, data: Partial<ClienteFormData>): Promise<Cliente> => {
    const result = await atualizarCliente(id, data);
    await loadClientesData();
    return result;
  };

  const deleteCliente = async (id: string): Promise<void> => {
    await deletarCliente(id);
    await loadClientesData();
  };

  const loadFornecedoresData = async (): Promise<void> => {
    try {
      setIsLoadingFornecedores(true);
      const data = await fornecedorService.getAll();
      setFornecedores(data);
    } catch (err) {
      console.error('Error loading fornecedores data:', err);
    } finally {
      setIsLoadingFornecedores(false);
    }
  };

  const createFornecedor = async (data: Omit<Fornecedor, 'id' | 'createdAt' | 'updatedAt'>): Promise<Fornecedor> => {
    const result = await fornecedorService.create(data);
    await loadFornecedoresData();
    return result;
  };

  const updateFornecedor = async (id: string, data: Partial<Omit<Fornecedor, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Fornecedor> => {
    const result = await fornecedorService.update(id, data);
    await loadFornecedoresData();
    return result;
  };

  const deleteFornecedor = async (id: string): Promise<void> => {
    await fornecedorService.delete(id);
    await loadFornecedoresData();
  };

  const value = {
    // Loading and error states
    isLoading,
    setIsLoading,
    loading,
    error,
    setError,
    user,
    setUser,

    // Data states
    sales,
    employees,
    debts,
    checks,
    boletos,
    employeeCommissions,
    employeePayments,
    employeeAdvances,
    employeeOvertimes,
    pixFees,
    taxes,
    agendaEvents,
    acertos,
    cashBalance,
    cashTransactions,
    permutas,

    // Data loading function
    loadAllData,

    // Cash balance functions
    recalculateCashBalance,
    initializeCashBalance,

    // CRUD functions
    createSale,
    updateSale,
    deleteSale,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    createDebt,
    updateDebt,
    deleteDebt,
    createCheck,
    updateCheck,
    deleteCheck,
    createBoleto,
    updateBoleto,
    deleteBoleto,
    createEmployeePayment,
    createEmployeeAdvance,
    createEmployeeOvertime,
    createPixFee,
    updatePixFee,
    deletePixFee,
    createTax,
    updateTax,
    deleteTax,
    createAgendaEvent,
    updateAgendaEvent,
    deleteAgendaEvent,
    createAcerto,
    updateAcerto,
    deleteAcerto,
    createCashTransaction,
    updateCashTransaction,
    deleteCashTransaction,
    
    // CRUD functions for permutas
    createPermuta,
    updatePermuta,
    deletePermuta,

    // Navigation
    navigateToPage,
    setNavigateToPage,

    // Estoque
    estoqueProdutos,
    isLoadingEstoque,
    loadEstoqueData,
    createEstoqueProduto,
    updateEstoqueProduto,
    updateEstoqueVariacao,
    updateEstoqueCor,
    removeEstoqueVariacao,
    removeEstoqueCor,
    deleteEstoqueProduto,
    updateEstoqueSaldo,
    addEstoqueCor,
    addEstoqueVariacao,

    // Producao
    producoes,
    isLoadingProducao,
    loadProducaoData,
    createProducao,
    gerarProximoLote,

    // Clientes
    clientes,
    isLoadingClientes,
    loadClientesData,
    createCliente,
    updateCliente,
    deleteCliente,

    // Orcamentos
    orcamentos,
    isLoadingOrcamentos,
    loadOrcamentosData,
    createOrcamento,
    updateOrcamento,
    deleteOrcamento,
    marcarOrcamentoConvertido,

    // Pending quote-to-sale prefill
    orcamentoPrefill,
    setOrcamentoPrefill,

    // Fornecedores
    fornecedores,
    isLoadingFornecedores,
    loadFornecedoresData,
    createFornecedor,
    updateFornecedor,
    deleteFornecedor,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};