// User types
export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

// Product interface
export interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

// Payment method interface
export interface PaymentMethod {
  type: 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'cheque' | 'boleto' | 'transferencia' | 'acerto' | 'permuta';
  amount: number;
  installments?: number;
  installmentValue?: number;
  installmentInterval?: number;
  startDate?: string;
  firstInstallmentDate?: string;
  isOwnCheck?: boolean;
  isThirdPartyCheck?: boolean;
  thirdPartyDetails?: ThirdPartyCheckDetails[];
  useCustomValues?: boolean;
  customInstallmentValues?: number[];
  selectedChecks?: string[];
  vehicleId?: string;
  acertoClientName?: string;
  relatedEntityId?: string;
  relatedEntityType?: 'sale' | 'debt' | 'check' | 'boleto' | 'credit_card';
}

// Third party check details
export interface ThirdPartyCheckDetails {
  id?: string;
  checkId?: string;
  bank: string;
  agency: string;
  account: string;
  checkNumber: string;
  issuer: string;
  cpfCnpj: string;
  observations?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Sale item (line item linked to estoque)
export interface SaleItem {
  id?: string;
  saleId?: string;
  produtoId: string;
  variacaoId: string;
  corId?: string | null;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  nomeProduto?: string;
  nomeVariacao?: string;
  nomeCor?: string;
  createdAt?: string;
}

// Estoque movement audit record
export interface EstoqueMovimento {
  id?: string;
  tipo: 'IN' | 'OUT' | 'ADJUST';
  origem: 'SALE_CREATE' | 'SALE_EDIT' | 'SALE_DELETE' | 'PRODUCAO' | 'MANUAL';
  saleId?: string | null;
  produtoId: string;
  variacaoId: string;
  corId?: string | null;
  quantidade: number;
  createdAt?: string;
}

// Sale interface
export interface Sale {
  id: string;
  date: string;
  deliveryDate?: string | null;
  client: string;
  clienteId?: string | null; // FK to registered customer
  sellerId?: string | null;
  products: Product[] | null;
  saleItems?: SaleItem[];
  observations?: string | null;
  totalValue: number;
  paymentMethods: PaymentMethod[];
  receivedAmount: number;
  pendingAmount: number;
  status: 'pago' | 'pendente' | 'parcial';
  paymentDescription?: string | null;
  paymentObservations?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  custom_commission_rate: number;
}

// Debt interface
export interface Debt {
  id: string;
  date: string;
  description: string;
  company: string;
  totalValue: number;
  paymentMethods: PaymentMethod[];
  isPaid: boolean;
  paidAmount: number;
  pendingAmount: number;
  checksUsed?: string[] | null;
  paymentDescription?: string | null;
  debtPaymentDescription?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

// Check interface
export interface Check {
  id: string;
  saleId?: string | null;
  debtId?: string | null;
  client: string;
  value: number;
  dueDate: string;
  status: 'pendente' | 'compensado' | 'devolvido' | 'reapresentado';
  isOwnCheck: boolean;
  observations?: string | null;
  usedFor?: string | null;
  installmentNumber?: number | null;
  totalInstallments?: number | null;
  frontImage?: string | null;
  backImage?: string | null;
  selectedAvailableChecks?: string[] | null;
  usedInDebt?: string | null;
  supplierName?: string | null;
  discountDate?: string | null;
  discounted_amount?: number | null;
  discount_fee?: number | null;
  is_discounted?: boolean;
  createdAt: string;
  updatedAt?: string | null;
  // Campos para cheques da empresa
  isCompanyPayable?: boolean | null;
  companyName?: string | null;
  paymentDate?: string | null;
}

// Boleto interface
export interface Boleto {
  id: string;
  saleId?: string | null;
  debtId?: string | null;
  client: string;
  value: number;
  dueDate: string;
  status: 'pendente' | 'compensado' | 'vencido' | 'cancelado' | 'nao_pago';
  installmentNumber: number;
  totalInstallments: number;
  boletoFile?: string | null;
  observations?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  overdueAction?: 'pago_com_juros' | 'pago_com_multa' | 'pago_integral' | 'protestado' | 'negativado' | 'acordo_realizado' | 'cancelado' | 'perda_total' | null;
  interestAmount?: number | null;
  penaltyAmount?: number | null;
  notaryCosts?: number | null;
  finalAmount?: number | null;
  overdueNotes?: string | null;
  // Campos para boletos da empresa
  isCompanyPayable?: boolean | null;
  companyName?: string | null;
  paymentDate?: string | null;
  interestPaid?: number | null;
}

// Employee interface
export interface Employee {
  id: string;
  name: string;
  position: string;
  isSeller: boolean;
  salary: number;
  paymentDay: number;
  nextPaymentDate?: string;
  isActive: boolean;
  hireDate: string;
  observations?: string;
  createdAt: string;
  updatedAt?: string;
}

// Employee Payment interface
export interface EmployeePayment {
  id?: string;
  employeeId: string;
  amount: number;
  paymentDate: string;
  isPaid: boolean;
  paymentType?: 'salario' | 'adiantamento' | 'comissao' | 'bonus' | 'hora_extra' | 'outro';
  receipt?: string;
  observations?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Employee Advance interface
export interface EmployeeAdvance {
  id?: string;
  employeeId: string;
  amount: number;
  date: string;
  description?: string;
  paymentMethod: 'dinheiro' | 'pix' | 'transferencia' | 'desconto_folha';
  status: 'pendente' | 'descontado';
  createdAt?: string;
  updatedAt?: string;
}

// Employee Overtime interface
export interface EmployeeOvertime {
  id?: string;
  employeeId: string;
  hours: number;
  hourlyRate: number;
  totalAmount: number;
  date: string;
  description: string;
  status: 'pendente' | 'pago';
  createdAt?: string;
  updatedAt?: string;
}

// Employee Commission interface
export interface EmployeeCommission {
  id?: string;
  employeeId: string;
  saleId: string;
  saleValue: number;
  commissionRate: number;
  commissionAmount: number;
  date: string;
  status: 'pendente' | 'pago';
  createdAt?: string;
  updatedAt?: string;
}

// Cash Balance interface
export interface CashBalance {
  id?: string;
  currentBalance: number;
  initialBalance: number;
  initialDate: string;
  lastUpdated: string;
  createdAt?: string;
  updatedAt?: string;
}

// Cash Transaction interface
export interface CashTransaction {
  id?: string;
  date: string;
  type: 'entrada' | 'saida';
  amount: number;
  description: string;
  category: 'venda' | 'divida' | 'adiantamento' | 'salario' | 'comissao' | 'cheque' | 'boleto' | 'outro';
  relatedId?: string;
  paymentMethod?: string;
  createdAt?: string;
  updatedAt?: string;
}

// PIX Fee interface
export interface PixFee {
  id?: string;
  date: string;
  amount: number;
  description: string;
  bank: string;
  transactionType: 'pix_out' | 'pix_in' | 'ted' | 'doc' | 'other';
  relatedTransactionId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Tax interface
export interface Tax {
  id?: string;
  date: string;
  taxType: 'irpj' | 'csll' | 'pis' | 'cofins' | 'icms' | 'iss' | 'simples_nacional' | 'inss' | 'fgts' | 'iptu' | 'ipva' | 'outros';
  description: string;
  amount: number;
  dueDate?: string;
  paymentMethod: 'dinheiro' | 'pix' | 'transferencia' | 'cartao_debito' | 'cartao_credito' | 'cheque' | 'boleto' | 'outros';
  referencePeriod?: string;
  documentNumber?: string;
  observations?: string;
  receiptFile?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Agenda Event interface
export interface AgendaEvent {
  id?: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  type: 'evento' | 'reuniao' | 'pagamento' | 'cobranca' | 'entrega' | 'vencimento' | 'importante' | 'outros';
  priority: 'baixa' | 'media' | 'alta' | 'urgente';
  status: 'pendente' | 'concluido' | 'cancelado' | 'adiado';
  reminderDate?: string;
  observations?: string;
  relatedType?: 'boleto' | 'cheque' | 'venda' | 'divida' | 'cartao' | 'acerto' | 'imposto';
  relatedId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Acerto interface
export interface Acerto {
  id?: string;
  clientName: string;
  clienteId?: string; // FK to registered customer in clientes table
  companyName?: string; // Para dívidas de empresas
  type: 'cliente' | 'empresa'; // Distinguir entre acertos de clientes e empresas
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: 'pendente' | 'pago' | 'parcial';
  paymentDate?: string;
  paymentMethod?: 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'cheque' | 'boleto' | 'transferencia';
  paymentInstallments?: number;
  paymentInstallmentValue?: number;
  paymentInterval?: number;
  observations?: string;
  relatedDebts?: string[]; // IDs das dívidas relacionadas
  availableChecks?: string[]; // IDs dos cheques disponíveis para pagamento
  createdAt?: string;
  updatedAt?: string;
}

// Permuta interface
export interface Permuta {
  id?: string;
  clientName: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehiclePlate: string;
  vehicleChassis?: string;
  vehicleColor?: string;
  vehicleMileage?: number;
  vehicleValue: number;
  consumedValue: number;
  remainingValue: number;
  status: 'ativo' | 'finalizado' | 'cancelado';
  notes?: string;
  registrationDate: string;
  createdAt?: string;
  updatedAt?: string;
}

// Sale Boleto interface (A Receber)
export interface SaleBoleto {
  id: string;
  saleId: string;
  number: string;
  dueDate: string;
  value: number;
  status: 'pendente' | 'pago' | 'cancelado';
  paidAt?: string;
  interest: number;
  observations?: string;
  createdAt: string;
  updatedAt: string;
}

// Sale Cheque interface (A Receber)
export interface SaleCheque {
  id: string;
  saleId: string;
  bank?: string;
  number?: string;
  dueDate: string;
  value: number;
  usedForDebt: boolean;
  status: 'pendente' | 'pago' | 'usado' | 'cancelado';
  paidAt?: string;
  observations?: string;
  createdAt: string;
  updatedAt: string;
}

// Debt Boleto interface (A Pagar)
export interface DebtBoleto {
  id: string;
  debtId: string;
  number: string;
  dueDate: string;
  value: number;
  status: 'pendente' | 'pago' | 'cancelado';
  paidAt?: string;
  interest: number;
  observations?: string;
  createdAt: string;
  updatedAt: string;
}

// Debt Cheque interface (A Pagar)
export interface DebtCheque {
  id: string;
  debtId: string;
  bank?: string;
  number?: string;
  dueDate: string;
  value: number;
  status: 'pendente' | 'pago' | 'cancelado';
  paidAt?: string;
  observations?: string;
  createdAt: string;
  updatedAt: string;
}

// Installment interface
export interface Installment {
  id?: string;
  saleId?: string;
  debtId?: string;
  amount: number;
  dueDate: string;
  isPaid: boolean;
  type: 'venda' | 'divida';
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EstoqueProduto {
  id: string;
  nome: string;
  descricao?: string;
  temCor: boolean;
  createdAt: string;
}

export interface EstoqueCor {
  id: string;
  produtoId: string;
  nomeCor: string;
  createdAt: string;
}

export interface EstoqueVariacao {
  id: string;
  produtoId: string;
  nomeVariacao: string;
  valorUnitarioPadrao: number;
  descricao?: string;
  createdAt: string;
}

export interface EstoqueSaldo {
  id: string;
  produtoId: string;
  variacaoId: string;
  corId?: string;
  quantidadeAtual: number;
  updatedAt: string;
}

export interface EstoqueProdutoCompleto extends EstoqueProduto {
  cores: EstoqueCor[];
  variacoes: EstoqueVariacao[];
  saldos: EstoqueSaldo[];
}

export interface Producao {
  id: string;
  titulo: string;
  lote: string;
  fabricacaoDate: string;
  validadeDate: string;
  createdAt: string;
}

export interface ProducaoItem {
  id: string;
  producaoId: string;
  produtoId: string;
  variacaoId: string;
  corId?: string;
  quantidade: number;
  createdAt: string;
}

export interface ProducaoItemCompleto extends ProducaoItem {
  nomeProduto: string;
  nomeVariacao: string;
  nomeCor?: string;
}

export interface ProducaoCompleta extends Producao {
  itens: ProducaoItemCompleto[];
}

export interface Cliente {
  id: string;
  tipo: 'PF' | 'PJ';
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  nomeCompleto?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  telefone: string;
  email?: string | null;
  enderecoRua?: string | null;
  enderecoNumero?: string | null;
  enderecoBairro?: string | null;
  enderecoCidade: string;
  enderecoUf: string;
  enderecoCep?: string | null;
  enderecoComplemento?: string | null;
  vendedorResponsavelId?: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  vendedorNome?: string;
  inadimplente?: boolean;
}

export interface ClienteFormData {
  tipo: 'PF' | 'PJ';
  razaoSocial: string;
  nomeFantasia: string;
  nomeCompleto: string;
  cnpj: string;
  cpf: string;
  telefone: string;
  email: string;
  enderecoRua: string;
  enderecoNumero: string;
  enderecoBairro: string;
  enderecoCidade: string;
  enderecoUf: string;
  enderecoCep: string;
  enderecoComplemento: string;
  vendedorResponsavelId: string;
  tags: string[];
}

export interface ClienteFiltros {
  busca: string;
  tipo: '' | 'PF' | 'PJ';
  cidade: string;
  tags: string[];
  vendedorId: string;
  inadimplente: '' | 'sim' | 'nao';
}

export interface OrcamentoItem {
  id?: string;
  orcamentoId?: string;
  produtoId: string;
  variacaoId: string;
  corId?: string | null;
  nomeProduto: string;
  nomeVariacao: string;
  nomeCor?: string | null;
  quantidade: number;
  valorUnitario: number;
  subtotal: number;
  createdAt?: string;
}

export interface Orcamento {
  id: string;
  numero: number;
  clienteId?: string | null;
  clienteNome: string;
  vendedor: string;
  dataCriacao: string;
  dataValidade: string;
  valorTotal: number;
  status: 'pendente' | 'convertido' | 'vencido';
  observacoes?: string | null;
  vendaId?: string | null;
  itens: OrcamentoItem[];
  createdAt: string;
  updatedAt: string;
}