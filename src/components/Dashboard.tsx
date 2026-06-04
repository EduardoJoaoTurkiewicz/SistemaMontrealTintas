import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { getCurrentDateString } from '../utils/dateUtils';
import { formatDateBR } from '../lib/dateOnly';
import { safeNumber } from '../utils/numberUtils';
import { getFullGreeting } from '../utils/greetingUtils';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wallet,
  Star,
  FileText,
  Receipt,
  ArrowUpCircle,
  ArrowDownCircle,
  Activity,
  Target,
  Award,
  Building2,
  PieChart,
  BarChart3
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

const COLORS = ['#3b82f6', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#22c55e', '#f97316'];

const Dashboard: React.FC = () => {
  const {
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
    cashBalance,
    cashTransactions,
    recalculateCashBalance,
    loading,
    isLoading,
    error,
    setError,
    loadAllData
  } = useAppContext();
  
  const [isRecalculating, setIsRecalculating] = useState(false);

  const today = getCurrentDateString();
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  // Force data reload on mount
  React.useEffect(() => {
    if (!loading && !isLoading) {
      console.log('🔄 Dashboard montado, forçando reload dos dados...');
      loadAllData().catch(error => {
        console.error('Erro ao recarregar dados no dashboard:', error);
      });
    }
  }, []);

  // Calcular métricas do dia
  const dailyMetrics = useMemo(() => {
    // 1. Total de Vendas do dia
    const todaySales = sales.filter(sale => sale.date === today);
    const totalSalesToday = todaySales.reduce((sum, sale) => sum + sale.totalValue, 0);

    // 2. Valor Recebido do dia (vendas instantâneas + cheques compensados + boletos pagos)
    let totalReceivedToday = 0;
    
    // Vendas com pagamento instantâneo
    todaySales.forEach(sale => {
      (sale.paymentMethods || []).forEach(method => {
        if (['dinheiro', 'pix', 'cartao_debito'].includes(method.type) ||
            (method.type === 'cartao_credito' && (!method.installments || method.installments === 1))) {
          totalReceivedToday += method.amount;
        }
        // Permuta não conta como dinheiro recebido (é troca de produto)
        // Acerto não conta como dinheiro recebido (será cobrado depois)
      });
    });
    
    // Cheques compensados hoje
    checks.forEach(check => {
      if (check.dueDate === today && check.status === 'compensado') {
        totalReceivedToday += check.value;
      }
    });
    
    // Boletos pagos hoje
    boletos.forEach(boleto => {
      if (boleto.dueDate === today && boleto.status === 'compensado') {
        const finalAmount = boleto.finalAmount || boleto.value;
        const notaryCosts = boleto.notaryCosts || 0;
        totalReceivedToday += (finalAmount - notaryCosts);
      }
    });

    // Parcelas de cartão de crédito recebidas hoje (via cash_transactions)
    cashTransactions.forEach((tx: any) => {
      if (tx.date === today && tx.category === 'recebimento_cartao' && tx.type === 'entrada') {
        totalReceivedToday += tx.amount;
      }
    });

    // 3. Total de Dívidas do dia
    const todayDebts = debts.filter(debt => debt.date === today);
    const totalDebtsToday = todayDebts.reduce((sum, debt) => sum + debt.totalValue, 0);

    // 4. Total Pago hoje
    let totalPaidToday = 0;
    
    // Dívidas pagas hoje
    todayDebts.forEach(debt => {
      if (debt.isPaid) {
        (debt.paymentMethods || []).forEach(method => {
          if (['dinheiro', 'pix', 'cartao_debito', 'transferencia'].includes(method.type)) {
            totalPaidToday += method.amount;
          }
        });
      }
    });
    
    // Pagamentos de funcionários hoje
    employeePayments.forEach(payment => {
      if (payment.paymentDate === today) {
        totalPaidToday += payment.amount;
      }
    });
    
    // Tarifas PIX hoje
    pixFees.forEach(fee => {
      if (fee.date === today) {
        totalPaidToday += fee.amount;
      }
    });

    // 5. Lucro Líquido do dia
    const netProfitToday = totalReceivedToday - totalPaidToday;

    return {
      totalSalesToday,
      totalReceivedToday,
      totalDebtsToday,
      totalPaidToday,
      netProfitToday,
      todaySales: todaySales.length,
      todayDebts: todayDebts.length
    };
  }, [sales, debts, checks, boletos, employeePayments, pixFees, cashTransactions, today]);

  // Calcular métricas do mês
  const monthlyMetrics = useMemo(() => {
    // Comissões do mês
    const monthlyCommissions = employeeCommissions.filter(commission => {
      const commissionDate = new Date(commission.date);
      return commissionDate.getMonth() === currentMonth && 
             commissionDate.getFullYear() === currentYear;
    });
    const totalCommissionsMonth = monthlyCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);

    // Folha de pagamento do mês
    const monthlyPayroll = employees
      .filter(emp => emp.isActive)
      .reduce((sum, emp) => sum + emp.salary, 0);

    // Vendas do mês
    const monthlySales = sales.filter(sale => {
      const saleDate = new Date(sale.date);
      return saleDate.getMonth() === currentMonth && 
             saleDate.getFullYear() === currentYear;
    });
    const totalSalesMonth = monthlySales.reduce((sum, sale) => sum + sale.totalValue, 0);

    // Lucro do mês (simplificado)
    const monthlyProfit = totalSalesMonth - monthlyPayroll - totalCommissionsMonth;

    return {
      totalCommissionsMonth,
      monthlyPayroll,
      totalSalesMonth,
      monthlyProfit,
      monthlySalesCount: monthlySales.length
    };
  }, [employeeCommissions, employees, sales, currentMonth, currentYear]);

  // Boletos vencidos
  const overdueBoletos = useMemo(() => {
    return boletos.filter(boleto => 
      boleto.dueDate < today && boleto.status === 'pendente'
    );
  }, [boletos, today]);

  // Dívidas para pagar
  const debtsToPay = useMemo(() => {
    return debts.filter(debt => !debt.isPaid && safeNumber(debt.pendingAmount, 0) > 0.01);
  }, [debts]);

  // Valores a receber - MOSTRA SOMENTE VENDAS COM VALORES PENDENTES
  const valuesToReceive = useMemo(() => {
    const toReceive = [];

    // Processar SOMENTE vendas com valores pendentes
    sales.forEach(sale => {
      // pending_amount is the authoritative value — maintained by financialCoreService
      // updateSaleStatusProportional keeps it in sync after every payment event.
      const pendingAmount = Math.max(safeNumber(sale.pendingAmount, 0), 0);
      const receivedAmount = safeNumber(sale.receivedAmount, 0);

      // Só adiciona a venda se ainda houver valor pendente para receber
      if (pendingAmount > 0.01) { // Usa 0.01 para evitar problemas de arredondamento
        // Identificar data de vencimento mais próxima dos recebíveis pendentes desta venda
        let nextDueDate = sale.date;
        let pendingReceivables = [];

        // Verificar cheques pendentes
        checks.forEach(check => {
          if (check.saleId === sale.id &&
              check.status === 'pendente' &&
              !check.isOwnCheck &&
              !check.usedInDebt &&
              !check.is_discounted) {
            pendingReceivables.push({
              type: 'Cheque',
              date: check.dueDate,
              value: check.value,
              number: check.installmentNumber,
              total: check.totalInstallments
            });
          }
        });

        // Verificar boletos pendentes
        boletos.forEach(boleto => {
          if (boleto.saleId === sale.id &&
              boleto.status === 'pendente' &&
              !boleto.isCompanyPayable) {
            pendingReceivables.push({
              type: 'Boleto',
              date: boleto.dueDate,
              value: boleto.value,
              number: boleto.installmentNumber,
              total: boleto.totalInstallments
            });
          }
        });

        // Ordenar recebíveis por data e pegar a próxima data
        if (pendingReceivables.length > 0) {
          pendingReceivables.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          nextDueDate = pendingReceivables[0].date;
        }

        // Criar descrição detalhada
        let description = `Venda total: R$ ${sale.totalValue.toFixed(2)} | Recebido: R$ ${receivedAmount.toFixed(2)}`;

        if (pendingReceivables.length > 0) {
          const receivablesSummary = pendingReceivables
            .map(r => `${r.type} ${r.number}/${r.total} (R$ ${r.value.toFixed(2)})`)
            .join(', ');
          description += ` | Pendente: ${receivablesSummary}`;
        }

        toReceive.push({
          id: sale.id,
          type: 'Venda',
          client: sale.client,
          amount: pendingAmount,
          dueDate: nextDueDate,
          description: description,
          status: sale.status,
          totalValue: sale.totalValue,
          receivedAmount: receivedAmount
        });
      }
    });

    // Ordenar por data de vencimento
    return toReceive.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [checks, boletos, sales]);

  // Dados para gráfico de fluxo financeiro (30 dias)
  const flowChartData = useMemo(() => {
    const last30Days = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Vendas do dia
      const daySales = sales.filter(sale => sale.date === dateStr);
      const salesValue = daySales.reduce((sum, sale) => sum + sale.totalValue, 0);
      
      // Dívidas do dia
      const dayDebts = debts.filter(debt => debt.date === dateStr);
      const debtsValue = dayDebts.reduce((sum, debt) => sum + debt.totalValue, 0);
      
      // Lucro do dia (vendas - dívidas)
      const profit = salesValue - debtsValue;
      
      last30Days.push({
        date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        vendas: salesValue,
        dividas: debtsValue,
        lucro: profit
      });
    }
    
    return last30Days;
  }, [sales, debts]);

  // Dados para gráfico de métodos de pagamento
  const paymentMethodsData = useMemo(() => {
    const methods = {};
    
    sales.forEach(sale => {
      (sale.paymentMethods || []).forEach(method => {
        const methodName = method.type.replace('_', ' ').toUpperCase();
        if (!methods[methodName]) {
          methods[methodName] = 0;
        }
        methods[methodName] += method.amount;
      });
    });
    
    return Object.entries(methods).map(([name, value]) => ({
      name,
      value,
      percentage: ((value / Object.values(methods).reduce((a, b) => a + b, 0)) * 100).toFixed(1)
    }));
  }, [sales]);

  // Top vendedores do mês
  const topSellers = useMemo(() => {
    const sellerStats = {};
    
    // Vendas do mês por vendedor
    sales.forEach(sale => {
      if (sale.sellerId) {
        const saleDate = new Date(sale.date);
        if (saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear) {
          if (!sellerStats[sale.sellerId]) {
            const seller = employees.find(e => e.id === sale.sellerId);
            sellerStats[sale.sellerId] = {
              name: seller?.name || 'Vendedor',
              totalSales: 0,
              salesCount: 0,
              totalCommissions: 0
            };
          }
          sellerStats[sale.sellerId].totalSales += sale.totalValue;
          sellerStats[sale.sellerId].salesCount += 1;
        }
      }
    });
    
    // Comissões do mês por vendedor
    employeeCommissions.forEach(commission => {
      const commissionDate = new Date(commission.date);
      if (commissionDate.getMonth() === currentMonth && commissionDate.getFullYear() === currentYear) {
        if (sellerStats[commission.employeeId]) {
          sellerStats[commission.employeeId].totalCommissions += commission.commissionAmount;
        }
      }
    });
    
    return Object.values(sellerStats)
      .filter(seller => seller && typeof seller === 'object')
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 5);
  }, [sales, employees, employeeCommissions, currentMonth, currentYear]);

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-sky-700 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Activity className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Carregando Dashboard...</h2>
          <p className="text-slate-600">Preparando seus dados financeiros</p>
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl max-w-md mx-auto">
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show error state if there's an error but not loading
  if (error && !loading && !isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-2xl mx-auto p-8">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-12 h-12 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Erro de Conexão</h2>
          <div className="p-6 bg-red-50 border border-red-200 rounded-xl mb-6">
            <p className="text-red-700 font-medium">{error}</p>
          </div>
          <div className="space-y-4">
            <button
              onClick={() => {
                setError(null);
                loadAllData();
              }}
              className="btn-primary"
            >
              Tentar Novamente
            </button>
            <div className="text-sm text-slate-600">
              <p className="mb-2">Para resolver este problema:</p>
              <ul className="text-left space-y-1">
                <li>• Verifique sua conexão com a internet</li>
                <li>• Confirme se as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão corretas no arquivo .env</li>
                <li>• Verifique se o projeto Supabase está ativo e acessível</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Dynamic Greeting */}
      <div className="revgold-animate-fade-in">
        <h2 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-blue-600 via-sky-600 to-blue-500 bg-clip-text text-transparent mb-2">
          {getFullGreeting()}
        </h2>
        <p className="text-slate-600 text-lg font-medium">
          {new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
      </div>

      {/* Header */}
      <div className="flex items-center gap-6 revgold-animate-fade-in revgold-stagger-1">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-sky-700 modern-shadow-xl">
          <Activity className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-4xl font-black text-slate-900">Dashboard Montreal</h1>
          <p className="text-slate-600 text-lg font-semibold">
            Visão geral completa do seu negócio
          </p>
        </div>
      </div>

      {/* Widgets Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {/* Total de Vendas Hoje */}
        <div className="card bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200 modern-shadow-xl hover:modern-shadow-lg transition-all duration-300 hover:scale-105">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-sky-700 modern-shadow-lg">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-blue-900 text-lg">Vendas Hoje</h3>
              <p className="text-3xl font-black text-blue-700">
                R$ {dailyMetrics.totalSalesToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-blue-600 font-semibold">
                {dailyMetrics.todaySales} venda(s)
              </p>
            </div>
          </div>
        </div>

        {/* Valor Recebido Hoje */}
        <div className="card bg-gradient-to-br from-sky-50 to-blue-50 border-sky-200 modern-shadow-xl hover:modern-shadow-lg transition-all duration-300 hover:scale-105">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-600 to-blue-700 modern-shadow-lg">
              <ArrowUpCircle className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sky-900 text-lg">Recebido Hoje</h3>
              <p className="text-3xl font-black text-sky-700">
                R$ {dailyMetrics.totalReceivedToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-sky-600 font-semibold">
                Entradas efetivas
              </p>
            </div>
          </div>
        </div>

        {/* Total de Dívidas Hoje */}
        <div className="card bg-gradient-to-br from-red-50 to-red-100 border-red-200 modern-shadow-xl hover:modern-shadow-lg transition-all duration-300 hover:scale-105">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 modern-shadow-lg">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-red-900 text-lg">Dívidas Hoje</h3>
              <p className="text-3xl font-black text-red-700">
                R$ {dailyMetrics.totalDebtsToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-red-600 font-semibold">
                {dailyMetrics.todayDebts} dívida(s)
              </p>
            </div>
          </div>
        </div>

        {/* Total Pago Hoje */}
        <div className="card bg-gradient-to-br from-orange-50 to-red-50 border-orange-200 modern-shadow-xl hover:modern-shadow-lg transition-all duration-300 hover:scale-105">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-600 to-red-600 modern-shadow-lg">
              <ArrowDownCircle className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-orange-900 text-lg">Pago Hoje</h3>
              <p className="text-3xl font-black text-orange-700">
                R$ {dailyMetrics.totalPaidToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-orange-600 font-semibold">
                Saídas efetivas
              </p>
            </div>
          </div>
        </div>

        {/* Saldo em Caixa */}
        <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 modern-shadow-xl hover:modern-shadow-lg transition-all duration-300 hover:scale-105">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 modern-shadow-lg">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-blue-900 text-lg">Saldo Caixa</h3>
              <p className="text-3xl font-black text-blue-700">
                R$ {(cashBalance?.currentBalance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-sm text-blue-600 font-semibold">
                  Disponível agora
                </p>
                <button
                  onClick={async () => {
                    setIsRecalculating(true);
                    try {
                      await recalculateCashBalance();
                    } catch (error) {
                      console.error('Erro ao recalcular:', error);
                    } finally {
                      setIsRecalculating(false);
                    }
                  }}
                  disabled={isRecalculating}
                  className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors disabled:opacity-50"
                  title="Recalcular saldo"
                >
                  {isRecalculating ? '...' : '↻'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Segunda linha de widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Lucro Líquido Hoje */}
        <div className="card bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200 modern-shadow-xl hover:modern-shadow-lg transition-all duration-300 hover:scale-105">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-600 to-violet-700 modern-shadow-lg">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-purple-900 text-lg">Lucro Hoje</h3>
              <p className={`text-3xl font-black ${
                dailyMetrics.netProfitToday >= 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                {dailyMetrics.netProfitToday >= 0 ? '+' : ''}R$ {dailyMetrics.netProfitToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-purple-600 font-semibold">
                Recebido - Pago
              </p>
            </div>
          </div>
        </div>

        {/* Funcionários */}
        <div className="card bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200 modern-shadow-xl hover:modern-shadow-lg transition-all duration-300 hover:scale-105">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 modern-shadow-lg">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-indigo-900 text-lg">Funcionários</h3>
              <p className="text-3xl font-black text-indigo-700">
                {employees.filter(emp => emp.isActive).length}
              </p>
              <p className="text-sm text-indigo-600 font-semibold">
                {employees.filter(emp => emp.isActive && emp.isSeller).length} vendedor(es)
              </p>
            </div>
          </div>
        </div>

        {/* Comissões do Mês */}
        <div className="card bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200 modern-shadow-xl hover:modern-shadow-lg transition-all duration-300 hover:scale-105">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-yellow-600 to-amber-700 modern-shadow-lg">
              <Star className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-yellow-900 text-lg">Comissões</h3>
              <p className="text-3xl font-black text-yellow-700">
                R$ {monthlyMetrics.totalCommissionsMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-yellow-600 font-semibold">
                Mês atual
              </p>
            </div>
          </div>
        </div>

        {/* Folha de Pagamento */}
        <div className="card bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-200 modern-shadow-xl hover:modern-shadow-lg transition-all duration-300 hover:scale-105">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 modern-shadow-lg">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-cyan-900 text-lg">Folha Mensal</h3>
              <p className="text-3xl font-black text-cyan-700">
                R$ {monthlyMetrics.monthlyPayroll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-cyan-600 font-semibold">
                Salários base
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Resumo de Boletos Vencidos */}
      {overdueBoletos.length > 0 && (
        <div className="card bg-gradient-to-r from-red-50 to-orange-50 border-red-200 modern-shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-red-600 to-orange-600 modern-shadow-lg">
              <AlertTriangle className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-red-900">Boletos Vencidos</h2>
              <p className="text-red-700 font-semibold">
                {overdueBoletos.length} boleto(s) vencido(s) - Total: R$ {overdueBoletos.reduce((sum, b) => sum + b.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {overdueBoletos.slice(0, 6).map(boleto => {
              const daysOverdue = Math.ceil((new Date().getTime() - new Date(boleto.dueDate).getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={boleto.id} className="p-4 bg-white rounded-xl border border-red-200 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-red-900">{boleto.client}</h4>
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-bold">
                      {daysOverdue} dias
                    </span>
                  </div>
                  <p className="text-lg font-black text-red-600">
                    R$ {boleto.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-red-700">
                    Venceu em {formatDateBR(boleto.dueDate)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dívidas para Pagar e Valores a Receber */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Dívidas para Pagar */}
        <div className="card modern-shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-xl bg-red-600">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-red-900">Dívidas para Pagar</h3>
              <p className="text-red-700 font-semibold">
                Total: R$ {debtsToPay.reduce((sum, debt) => sum + debt.pendingAmount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          
          <div className="space-y-3 max-h-80 overflow-y-auto modern-scrollbar">
            {debtsToPay.slice(0, 10).map(debt => (
              <div key={debt.id} className="p-4 bg-red-50 rounded-xl border border-red-200">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-red-900">{debt.company}</h4>
                    <p className="text-sm text-red-700">{debt.description}</p>
                    <p className="text-xs text-red-600">
                      {formatDateBR(debt.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-red-600">
                      R$ {debt.pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-bold">
                      Pendente
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {debtsToPay.length === 0 && (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <p className="text-green-600 font-semibold">Nenhuma dívida pendente!</p>
              </div>
            )}
          </div>
        </div>

        {/* Valores a Receber */}
        <div className="card modern-shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-xl bg-blue-600">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-blue-900">Valores a Receber</h3>
              <p className="text-blue-700 font-semibold">
                Total: R$ {valuesToReceive.reduce((sum, item) => sum + item.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto modern-scrollbar">
            {valuesToReceive.slice(0, 10).map(item => (
              <div key={item.id} className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                        Venda
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                        new Date(item.dueDate) < new Date() ? 'bg-red-100 text-red-800' :
                        new Date(item.dueDate).toDateString() === new Date().toDateString() ? 'bg-sky-100 text-sky-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {new Date(item.dueDate) < new Date() ? 'Vencido' :
                         new Date(item.dueDate).toDateString() === new Date().toDateString() ? 'Hoje' :
                         'Pendente'}
                      </span>
                    </div>
                    <h4 className="font-bold text-blue-900 text-lg mb-1">{item.client}</h4>
                    <div className="text-sm text-blue-700 space-y-1">
                      <p className="font-semibold">
                        Valor da venda: R$ {item.totalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p>
                        Já recebido: R$ {item.receivedAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="font-bold text-blue-800">
                        Falta receber: R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <p className="text-xs text-blue-600 mt-2">
                      Próximo vencimento: {formatDateBR(item.dueDate)}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-2xl font-black text-blue-600">
                      R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      A receber
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {valuesToReceive.length === 0 && (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <p className="text-green-600 font-semibold">Nada a receber no momento!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Fluxo Financeiro (30 dias) */}
        <div className="card modern-shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-xl bg-blue-600">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Fluxo Financeiro (30 dias)</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={flowChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                  name === 'vendas' ? 'Vendas' : name === 'dividas' ? 'Dívidas' : 'Lucro'
                ]}
                labelFormatter={(label) => `Data: ${label}`}
              />
              <Legend />
              <Area type="monotone" dataKey="vendas" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Vendas" />
              <Area type="monotone" dataKey="dividas" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Dívidas" />
              <Line type="monotone" dataKey="lucro" stroke="#3b82f6" strokeWidth={3} name="Lucro" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Métodos de Pagamento */}
        <div className="card modern-shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-xl bg-purple-600">
              <PieChart className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Métodos de Pagamento</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Pie
                data={paymentMethodsData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {paymentMethodsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Vendedores e Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Vendedores */}
        <div className="card modern-shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-xl bg-yellow-600">
              <Award className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Top Vendedores</h3>
          </div>
          
          <div className="space-y-4">
            {topSellers.map((seller, index) => {
              if (!seller || typeof seller !== 'object' || !seller.name) return null;
              return (
                <div key={index} className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-amber-600' : 'bg-slate-400'
                    }`}>
                      {index + 1}
                    </div>
                    <h4 className="font-bold text-yellow-900">{seller.name}</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-yellow-700">Vendas: {seller.salesCount || 0}</p>
                      <p className="font-bold text-yellow-800">
                        R$ {Number(seller.totalSales || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-yellow-700">Comissão:</p>
                      <p className="font-bold text-green-600">
                        R$ {Number(seller.totalCommissions || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            {topSellers.length === 0 && (
              <div className="text-center py-8">
                <Star className="w-12 h-12 mx-auto mb-3 text-yellow-300" />
                <p className="text-yellow-600 font-medium">Nenhuma venda com vendedor este mês</p>
              </div>
            )}
          </div>
        </div>

        {/* Status das Vendas */}
        <div className="card modern-shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-xl bg-blue-600">
              <Target className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Status das Vendas</h3>
          </div>

          <div className="space-y-4">
            {[
              {
                status: 'pago',
                label: 'Pagas',
                count: sales.filter(s => s.status === 'pago').length,
                color: 'bg-blue-50 border-blue-200 text-blue-800'
              },
              { 
                status: 'parcial', 
                label: 'Parciais', 
                count: sales.filter(s => s.status === 'parcial').length,
                color: 'bg-yellow-50 border-yellow-200 text-yellow-800'
              },
              { 
                status: 'pendente', 
                label: 'Pendentes', 
                count: sales.filter(s => s.status === 'pendente').length,
                color: 'bg-red-50 border-red-200 text-red-800'
              }
            ].map(item => (
              <div key={item.status} className={`p-4 rounded-xl border ${item.color}`}>
                <div className="flex justify-between items-center">
                  <span className="font-bold">{item.label}</span>
                  <span className="text-2xl font-black">{item.count}</span>
                </div>
                <div className="text-sm mt-1">
                  Total: R$ {sales
                    .filter(s => s.status === item.status)
                    .reduce((sum, s) => sum + s.totalValue, 0)
                    .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status das Dívidas */}
        <div className="card modern-shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-xl bg-red-600">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Status das Dívidas</h3>
          </div>
          
          <div className="space-y-4">
            {[
              {
                status: true,
                label: 'Pagas',
                count: debts.filter(d => d.isPaid).length,
                total: debts.filter(d => d.isPaid).reduce((sum, d) => sum + d.totalValue, 0),
                color: 'bg-blue-50 border-blue-200 text-blue-800'
              },
              { 
                status: false, 
                label: 'Pendentes', 
                count: debts.filter(d => !d.isPaid).length,
                total: debts.filter(d => !d.isPaid).reduce((sum, d) => sum + d.pendingAmount, 0),
                color: 'bg-red-50 border-red-200 text-red-800'
              }
            ].map(item => (
              <div key={item.label} className={`p-4 rounded-xl border ${item.color}`}>
                <div className="flex justify-between items-center">
                  <span className="font-bold">{item.label}</span>
                  <span className="text-2xl font-black">{item.count}</span>
                </div>
                <div className="text-sm mt-1">
                  Total: R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resumo de Recebimentos */}
      <div className="card modern-shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-xl bg-blue-600">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Resumo de Recebimentos</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6 bg-blue-50 rounded-2xl border border-blue-200">
            <h4 className="font-bold text-blue-900 mb-2">Cheques Pendentes</h4>
            <p className="text-2xl font-black text-blue-700">
              {checks.filter(c => c.status === 'pendente' && !c.isOwnCheck).length}
            </p>
            <p className="text-sm text-blue-600 font-semibold">
              R$ {checks
                .filter(c => c.status === 'pendente' && !c.isOwnCheck)
                .reduce((sum, c) => sum + c.value, 0)
                .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          
          <div className="text-center p-6 bg-blue-50 rounded-2xl border border-blue-200">
            <h4 className="font-bold text-blue-900 mb-2">Boletos Pendentes</h4>
            <p className="text-2xl font-black text-blue-700">
              {boletos.filter(b => b.status === 'pendente').length}
            </p>
            <p className="text-sm text-blue-600 font-semibold">
              R$ {boletos
                .filter(b => b.status === 'pendente')
                .reduce((sum, b) => sum + b.value, 0)
                .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          
          <div className="text-center p-6 bg-purple-50 rounded-2xl border border-purple-200">
            <h4 className="font-bold text-purple-900 mb-2">Vendas Pendentes</h4>
            <p className="text-2xl font-black text-purple-700">
              {sales.filter(s => s.status === 'pendente').length}
            </p>
            <p className="text-sm text-purple-600 font-semibold">
              R$ {sales
                .filter(s => s.status === 'pendente')
                .reduce((sum, s) => sum + s.pendingAmount, 0)
                .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Resumo do Mês Atual */}
      <div className="card bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 border-blue-300 modern-shadow-xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 modern-shadow-lg">
              <Calendar className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-blue-900">
              Resumo de {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </h2>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center p-6 bg-white rounded-2xl border border-blue-200 modern-shadow-lg">
            <div className="p-3 rounded-xl bg-blue-600 w-fit mx-auto mb-4">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <h4 className="font-bold text-blue-900 mb-2">Faturamento</h4>
            <p className="text-3xl font-black text-blue-600">
              R$ {monthlyMetrics.totalSalesMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          
          <div className="text-center p-6 bg-white rounded-2xl border border-blue-200 modern-shadow-lg">
            <div className="p-3 rounded-xl bg-blue-600 w-fit mx-auto mb-4">
              <Target className="w-6 h-6 text-white" />
            </div>
            <h4 className="font-bold text-blue-900 mb-2">Quantidade de Vendas</h4>
            <p className="text-3xl font-black text-blue-600">
              {monthlyMetrics.monthlySalesCount}
            </p>
          </div>
          
          <div className="text-center p-6 bg-white rounded-2xl border border-blue-200 modern-shadow-lg">
            <div className="p-3 rounded-xl bg-yellow-600 w-fit mx-auto mb-4">
              <Star className="w-6 h-6 text-white" />
            </div>
            <h4 className="font-bold text-blue-900 mb-2">Comissões</h4>
            <p className="text-3xl font-black text-yellow-600">
              R$ {monthlyMetrics.totalCommissionsMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          
          <div className="text-center p-6 bg-white rounded-2xl border border-blue-200 modern-shadow-lg">
            <div className="p-3 rounded-xl bg-purple-600 w-fit mx-auto mb-4">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h4 className="font-bold text-blue-900 mb-2">Lucro Estimado</h4>
            <p className={`text-3xl font-black ${
              monthlyMetrics.monthlyProfit >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {monthlyMetrics.monthlyProfit >= 0 ? '+' : ''}R$ {monthlyMetrics.monthlyProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-blue-700 font-semibold text-lg">
            📊 Análise baseada em vendas realizadas, comissões geradas e folha de pagamento base
          </p>
          <p className="text-blue-600 text-sm mt-2">
            * Lucro estimado não inclui custos operacionais, impostos e outras despesas variáveis
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;