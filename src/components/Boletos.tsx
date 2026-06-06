import React, { useState, useMemo } from 'react';
import { Plus, CreditCard as Edit, Trash2, Eye, Receipt, DollarSign, Calendar, AlertTriangle, X, Building2, CreditCard, Clock, CheckCircle, ChevronDown, ChevronRight, Search, Filter, TrendingDown, ArrowDownCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Boleto } from '../types';
import { BoletoForm } from './forms/BoletoForm';
import { OverdueBoletoForm } from './forms/OverdueBoletoForm';
import { getCurrentDateString } from '../utils/dateUtils';

type ReceivableFilter = 'todos' | 'pendente' | 'vencido' | 'vence_hoje' | 'compensado';

export function Boletos() {
  const { boletos, sales, debts, isLoading, error, createBoleto, updateBoleto, deleteBoleto } = useAppContext();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBoleto, setEditingBoleto] = useState<Boleto | null>(null);
  const [viewingBoleto, setViewingBoleto] = useState<Boleto | null>(null);
  const [managingOverdueBoleto, setManagingOverdueBoleto] = useState<Boleto | null>(null);
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set());
  const [expandedDebts, setExpandedDebts] = useState<Set<string>>(new Set());

  const [receivableSearch, setReceivableSearch] = useState('');
  const [receivableFilter, setReceivableFilter] = useState<ReceivableFilter>('todos');

  const today = getCurrentDateString();
  const dueToday = boletos.filter(boleto => boleto.dueDate === today && boleto.status === 'pendente');
  const overdue = boletos.filter(boleto => boleto.dueDate < today && boleto.status === 'pendente');

  const notDueYet = boletos.filter(boleto => boleto.dueDate > today && boleto.status === 'pendente');
  const totalNotDueYet = notDueYet.reduce((sum, boleto) => sum + boleto.value, 0);
  const totalOverdue = overdue.reduce((sum, boleto) => sum + boleto.value, 0);

  const companyPayableBoletos = boletos.filter(boleto =>
    boleto.isCompanyPayable && boleto.status === 'pendente'
  );
  const totalCompanyPayableBoletos = companyPayableBoletos.reduce((sum, boleto) => sum + boleto.value, 0);

  const salesWithBoletos = useMemo(() => {
    return sales
      .filter(sale => boletos.some(boleto => boleto.saleId === sale.id))
      .map(sale => ({
        ...sale,
        boletos: boletos.filter(boleto => boleto.saleId === sale.id),
        pendingBoletos: boletos.filter(boleto => boleto.saleId === sale.id && boleto.status !== 'compensado'),
        compensatedBoletos: boletos.filter(boleto => boleto.saleId === sale.id && boleto.status === 'compensado'),
      }));
  }, [sales, boletos]);

  // Sales with at least one pending/active boleto
  const salesWithPendingBoletos = useMemo(() => {
    return salesWithBoletos.filter(s => s.pendingBoletos.length > 0);
  }, [salesWithBoletos]);

  // Sales with at least one compensated boleto (for "Boletos Recebidos" section)
  const salesWithCompensatedBoletos = useMemo(() => {
    return salesWithBoletos.filter(s => s.compensatedBoletos.length > 0);
  }, [salesWithBoletos]);

  const filteredSalesWithBoletos = useMemo(() => {
    return salesWithPendingBoletos.filter(sale => {
      const matchesSearch = receivableSearch.trim() === '' ||
        sale.client?.toLowerCase().includes(receivableSearch.toLowerCase()) ||
        sale.boletos.some(b => b.client?.toLowerCase().includes(receivableSearch.toLowerCase()));

      const saleBoletos = sale.boletos;
      const hasVencido = saleBoletos.some(b => b.dueDate < today && b.status === 'pendente');
      const hasVenceHoje = saleBoletos.some(b => b.dueDate === today && b.status === 'pendente');
      const hasPendente = saleBoletos.some(b => b.status === 'pendente');
      const hasCompensado = saleBoletos.some(b => b.status === 'compensado');

      let matchesFilter = true;
      if (receivableFilter === 'vencido') matchesFilter = hasVencido;
      else if (receivableFilter === 'vence_hoje') matchesFilter = hasVenceHoje;
      else if (receivableFilter === 'pendente') matchesFilter = hasPendente;
      else if (receivableFilter === 'compensado') matchesFilter = hasCompensado;

      return matchesSearch && matchesFilter;
    });
  }, [salesWithPendingBoletos, receivableSearch, receivableFilter, today]);

  const receivableSummary = useMemo(() => {
    const allReceivableBoletos = boletos.filter(b => b.saleId && b.status === 'pendente');
    const totalPending = allReceivableBoletos.reduce((sum, b) => sum + b.value, 0);
    const totalVencido = allReceivableBoletos.filter(b => b.dueDate < today).reduce((sum, b) => sum + b.value, 0);
    const totalVenceHoje = allReceivableBoletos.filter(b => b.dueDate === today).reduce((sum, b) => sum + b.value, 0);
    const totalFuturo = allReceivableBoletos.filter(b => b.dueDate > today).reduce((sum, b) => sum + b.value, 0);
    return { totalPending, totalVencido, totalVenceHoje, totalFuturo, count: allReceivableBoletos.length };
  }, [boletos, today]);

  const debtsWithBoletos = useMemo(() => {
    return debts
      .filter(debt => boletos.some(boleto => boleto.debtId === debt.id))
      .map(debt => ({
        ...debt,
        boletos: boletos.filter(boleto => boleto.debtId === debt.id),
        pendingBoletos: boletos.filter(boleto => boleto.debtId === debt.id && boleto.status !== 'compensado'),
        paidBoletos: boletos.filter(boleto => boleto.debtId === debt.id && boleto.status === 'compensado'),
      }));
  }, [debts, boletos]);

  // Debts with pending boletos (for "A Pagar")
  const debtsWithPendingBoletos = useMemo(() => {
    return debtsWithBoletos.filter(d => d.pendingBoletos.length > 0);
  }, [debtsWithBoletos]);

  // Debts with paid boletos (for "Boletos Pagos" section)
  const debtsWithPaidBoletos = useMemo(() => {
    return debtsWithBoletos.filter(d => d.paidBoletos.length > 0);
  }, [debtsWithBoletos]);

  const handleAddBoleto = (boleto: Omit<Boleto, 'id' | 'createdAt'>) => {
    createBoleto(boleto).then(() => {
      setIsFormOpen(false);
    }).catch(error => {
      alert('Erro ao criar boleto: ' + error.message);
    });
  };

  const handleEditBoleto = (boleto: Omit<Boleto, 'id' | 'createdAt'>) => {
    if (editingBoleto) {
      const updatedBoleto: Boleto = {
        ...boleto,
        id: editingBoleto.id,
        createdAt: editingBoleto.createdAt
      };
      updateBoleto(updatedBoleto).then(() => {
        setEditingBoleto(null);
      }).catch(error => {
        alert('Erro ao atualizar boleto: ' + error.message);
      });
    }
  };

  const handleDeleteBoleto = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este boleto? Esta ação não pode ser desfeita.')) {
      deleteBoleto(id).catch(error => {
        alert('Erro ao excluir boleto: ' + error.message);
      });
    }
  };

  const handleOverdueBoletoSubmit = (boleto: Omit<Boleto, 'id' | 'createdAt'>) => {
    if (managingOverdueBoleto) {
      const updatedBoleto: Boleto = {
        ...boleto,
        id: managingOverdueBoleto.id,
        createdAt: managingOverdueBoleto.createdAt
      };
      updateBoleto(updatedBoleto).then(() => {
        setManagingOverdueBoleto(null);
      }).catch(error => {
        alert('Erro ao atualizar boleto vencido: ' + error.message);
      });
    }
  };

  const toggleSaleExpansion = (saleId: string) => {
    const newExpanded = new Set(expandedSales);
    if (newExpanded.has(saleId)) {
      newExpanded.delete(saleId);
    } else {
      newExpanded.add(saleId);
    }
    setExpandedSales(newExpanded);
  };

  const toggleDebtExpansion = (debtId: string) => {
    const newExpanded = new Set(expandedDebts);
    if (newExpanded.has(debtId)) {
      newExpanded.delete(debtId);
    } else {
      newExpanded.add(debtId);
    }
    setExpandedDebts(newExpanded);
  };

  const getStatusColor = (status: Boleto['status']) => {
    switch (status) {
      case 'compensado': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'vencido': return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelado': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'nao_pago': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getStatusLabel = (status: Boleto['status']) => {
    switch (status) {
      case 'compensado': return 'Compensado';
      case 'vencido': return 'Vencido';
      case 'cancelado': return 'Cancelado';
      case 'nao_pago': return 'Não Pago';
      default: return 'Pendente';
    }
  };

  const getBoletoUrgency = (boleto: Boleto) => {
    if (boleto.status !== 'pendente') return 'normal';
    if (boleto.dueDate < today) return 'overdue';
    if (boleto.dueDate === today) return 'due_today';
    return 'future';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-16 h-16 bg-cyan-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Receipt className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-600 font-semibold">Carregando boletos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 shadow-xl floating-animation">
            <Receipt className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Gestão de Boletos</h1>
            <p className="text-slate-600 text-lg">Controle completo de boletos bancários</p>
          </div>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="btn-primary flex items-center gap-2 modern-shadow-xl hover:modern-shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Adicionar Boleto
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            <div>
              <h3 className="font-bold text-red-800">Erro no Sistema</h3>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 modern-shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-600 modern-shadow-lg">
              <Calendar className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-green-900 text-lg">Não Vencidos</h3>
              <p className="text-green-700 font-medium">{notDueYet.length} boleto(s)</p>
              <p className="text-sm text-green-600 font-semibold">
                Total: R$ {totalNotDueYet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-red-50 to-red-100 border-red-200 modern-shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-600 modern-shadow-lg">
              <AlertTriangle className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-red-900 text-lg">Vencidos</h3>
              <p className="text-red-700 font-medium">{overdue.length} boleto(s)</p>
              <p className="text-sm text-red-600 font-semibold">
                Total: R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 modern-shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-orange-600 modern-shadow-lg">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-orange-900 text-lg">Para Pagar</h3>
              <p className="text-orange-700 font-medium">{companyPayableBoletos.length} boleto(s)</p>
              <p className="text-sm text-orange-600 font-semibold">
                Total: R$ {totalCompanyPayableBoletos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {dueToday.length > 0 ? (
          <div className="card bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 modern-shadow-xl">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-600 modern-shadow-lg">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-blue-900 text-lg">Vencimentos Hoje</h3>
                <p className="text-blue-700 font-medium">{dueToday.length} boleto(s)</p>
                <p className="text-sm text-blue-600 font-semibold">
                  Total: R$ {dueToday.reduce((sum, boleto) => sum + boleto.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="card bg-gradient-to-br from-slate-50 to-gray-50 border-slate-200 modern-shadow-xl">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-slate-400 modern-shadow-lg">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-700 text-lg">Vencimentos Hoje</h3>
                <p className="text-slate-500 font-medium">Nenhum hoje</p>
                <p className="text-sm text-slate-400 font-semibold">Sem pendências</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BOLETOS A RECEBER (de Vendas) */}
      <div className="card modern-shadow-xl">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-600">
              <ArrowDownCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Boletos a Receber (de Vendas)</h3>
              <p className="text-sm text-slate-500">
                {filteredSalesWithBoletos.length} venda(s) com boletos
                {receivableSummary.count > 0 && (
                  <span className="ml-2 text-green-600 font-semibold">
                    • R$ {receivableSummary.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} pendentes
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Summary mini-cards */}
        {receivableSummary.count > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <button
              onClick={() => setReceivableFilter(receivableFilter === 'pendente' ? 'todos' : 'pendente')}
              className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                receivableFilter === 'pendente'
                  ? 'border-cyan-500 bg-cyan-50'
                  : 'border-slate-200 bg-slate-50 hover:border-cyan-300'
              }`}
            >
              <p className="text-xs font-semibold text-slate-500 mb-1">Pendentes</p>
              <p className="text-lg font-black text-cyan-700">
                R$ {receivableSummary.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </button>
            <button
              onClick={() => setReceivableFilter(receivableFilter === 'vencido' ? 'todos' : 'vencido')}
              className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                receivableFilter === 'vencido'
                  ? 'border-red-500 bg-red-50'
                  : 'border-slate-200 bg-slate-50 hover:border-red-300'
              }`}
            >
              <p className="text-xs font-semibold text-slate-500 mb-1">Vencidos</p>
              <p className="text-lg font-black text-red-600">
                R$ {receivableSummary.totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </button>
            <button
              onClick={() => setReceivableFilter(receivableFilter === 'vence_hoje' ? 'todos' : 'vence_hoje')}
              className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                receivableFilter === 'vence_hoje'
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-slate-200 bg-slate-50 hover:border-amber-300'
              }`}
            >
              <p className="text-xs font-semibold text-slate-500 mb-1">Vencem Hoje</p>
              <p className="text-lg font-black text-amber-600">
                R$ {receivableSummary.totalVenceHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </button>
            <button
              onClick={() => setReceivableFilter(receivableFilter === 'compensado' ? 'todos' : 'compensado')}
              className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                receivableFilter === 'compensado'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 bg-slate-50 hover:border-emerald-300'
              }`}
            >
              <p className="text-xs font-semibold text-slate-500 mb-1">A Vencer</p>
              <p className="text-lg font-black text-emerald-600">
                R$ {receivableSummary.totalFuturo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </button>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={receivableSearch}
              onChange={(e) => setReceivableSearch(e.target.value)}
              placeholder="Buscar por cliente..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
            />
            {receivableSearch && (
              <button
                onClick={() => setReceivableSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={receivableFilter}
            onChange={(e) => setReceivableFilter(e.target.value as ReceivableFilter)}
            className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 bg-white text-slate-700"
          >
            <option value="todos">Todos os status</option>
            <option value="pendente">Pendentes</option>
            <option value="vencido">Vencidos</option>
            <option value="vence_hoje">Vencem Hoje</option>
            <option value="compensado">Compensados</option>
          </select>
        </div>

        {filteredSalesWithBoletos.length > 0 ? (
          <div className="space-y-4">
            {filteredSalesWithBoletos.map(sale => {
              const pendingBoletos = sale.boletos.filter(b => b.status === 'pendente');
              const overdueBoletos = sale.boletos.filter(b => b.dueDate < today && b.status === 'pendente');
              const totalSaleBoletos = sale.boletos.filter(b => b.status === 'pendente').reduce((s, b) => s + b.value, 0);

              return (
                <div key={sale.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div
                    className={`p-5 hover:brightness-95 cursor-pointer transition-all duration-200 ${
                      overdueBoletos.length > 0
                        ? 'bg-gradient-to-r from-red-50 to-rose-50'
                        : 'bg-gradient-to-r from-green-50 to-emerald-50'
                    }`}
                    onClick={() => toggleSaleExpansion(sale.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button className={`p-2 rounded-lg text-white modern-shadow ${
                          overdueBoletos.length > 0 ? 'bg-red-500' : 'bg-green-600'
                        }`}>
                          {expandedSales.has(sale.id) ?
                            <ChevronDown className="w-5 h-5" /> :
                            <ChevronRight className="w-5 h-5" />
                          }
                        </button>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{sale.client}</h3>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 mt-0.5">
                            <span>Data: {new Date(sale.date).toLocaleDateString('pt-BR')}</span>
                            <span>{sale.boletos.length} boleto(s)</span>
                            {overdueBoletos.length > 0 && (
                              <span className="text-red-600 font-semibold">
                                {overdueBoletos.length} vencido(s)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-bold ${overdueBoletos.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          R$ {sale.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        {pendingBoletos.length > 0 && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Pendente: R$ {totalSaleBoletos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        )}
                        <span className={`mt-1 inline-block px-3 py-0.5 rounded-full text-xs font-bold ${
                          sale.status === 'pago' ? 'bg-emerald-100 text-emerald-700' :
                          sale.status === 'parcial' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {sale.status === 'pago' ? 'Pago' :
                           sale.status === 'parcial' ? 'Parcial' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {expandedSales.has(sale.id) && (
                    <div className="border-t border-slate-200 bg-white">
                      <div className="p-5">
                        <h4 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wide">Boletos desta Venda</h4>
                        <div className="space-y-3">
                          {sale.boletos.map(boleto => {
                            const urgency = getBoletoUrgency(boleto);
                            return (
                              <div key={boleto.id} className={`p-4 rounded-xl border ${
                                urgency === 'overdue'
                                  ? 'bg-red-50 border-red-200'
                                  : urgency === 'due_today'
                                  ? 'bg-amber-50 border-amber-200'
                                  : boleto.status === 'compensado'
                                  ? 'bg-emerald-50 border-emerald-200'
                                  : 'bg-cyan-50 border-cyan-200'
                              }`}>
                                <div className="flex justify-between items-start gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-slate-900">{boleto.client}</span>
                                      {urgency === 'overdue' && (
                                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">Vencido</span>
                                      )}
                                      {urgency === 'due_today' && (
                                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">Vence Hoje</span>
                                      )}
                                    </div>
                                    <div className="text-sm text-slate-600 mt-1 space-y-0.5">
                                      <p>Parcela {boleto.installmentNumber}/{boleto.totalInstallments}</p>
                                      <p>Vencimento: {new Date(boleto.dueDate).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                  </div>
                                  <div className="text-right flex flex-col items-end gap-2">
                                    <span className={`font-bold text-lg ${
                                      urgency === 'overdue' ? 'text-red-600' :
                                      urgency === 'due_today' ? 'text-amber-600' :
                                      boleto.status === 'compensado' ? 'text-emerald-600' :
                                      'text-cyan-600'
                                    }`}>
                                      R$ {boleto.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(boleto.status)}`}>
                                      {getStatusLabel(boleto.status)}
                                    </span>
                                    {boleto.status === 'pendente' && (
                                      <div className="flex gap-2 flex-wrap justify-end">
                                        <button
                                          onClick={() => {
                                            if (window.confirm(`Marcar como compensado?\n\nValor: R$ ${boleto.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\nEste valor será adicionado ao caixa.`)) {
                                              updateBoleto({ ...boleto, id: boleto.id, status: 'compensado', paymentDate: getCurrentDateString(), updatedAt: new Date().toISOString() }).catch(err => alert('Erro: ' + err.message));
                                            }
                                          }}
                                          className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold text-xs"
                                        >
                                          Compensar
                                        </button>
                                        {urgency === 'overdue' && (
                                          <button
                                            onClick={() => setManagingOverdueBoleto(boleto)}
                                            className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold text-xs"
                                          >
                                            Gerenciar
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <Receipt className="w-20 h-20 mx-auto mb-6 text-green-300" />
            <p className="text-slate-500 mb-2 text-xl font-medium">
              {receivableSearch || receivableFilter !== 'todos'
                ? 'Nenhum boleto encontrado com os filtros aplicados.'
                : 'Nenhuma venda com boletos ainda.'}
            </p>
            {!receivableSearch && receivableFilter === 'todos' && (
              <p className="text-slate-400 text-sm">
                Os boletos são criados automaticamente ao registrar vendas com pagamento em boleto.
              </p>
            )}
            {(receivableSearch || receivableFilter !== 'todos') && (
              <button
                onClick={() => { setReceivableSearch(''); setReceivableFilter('todos'); }}
                className="mt-4 px-4 py-2 text-sm text-cyan-600 border border-cyan-300 rounded-lg hover:bg-cyan-50 transition-colors"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Boletos a Pagar (de Dívidas) */}
      <div className="card modern-shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-xl bg-orange-600">
            <TrendingDown className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-orange-900">Boletos a Pagar (de Dívidas)</h3>
            <p className="text-sm text-orange-600 font-semibold">
              Total pendente: R$ {totalCompanyPayableBoletos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {debtsWithBoletos.length > 0 ? (
          <div className="space-y-4">
            {debtsWithBoletos.map(debt => (
              <div key={debt.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                <div
                  className="p-5 bg-gradient-to-r from-orange-50 to-amber-50 hover:brightness-95 cursor-pointer transition-all duration-200"
                  onClick={() => toggleDebtExpansion(debt.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button className="p-2 rounded-lg bg-orange-600 text-white modern-shadow">
                        {expandedDebts.has(debt.id) ?
                          <ChevronDown className="w-5 h-5" /> :
                          <ChevronRight className="w-5 h-5" />
                        }
                      </button>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{debt.company}</h3>
                        <p className="text-sm text-slate-600">
                          Data: {new Date(debt.date).toLocaleDateString('pt-BR')} &bull; {debt.boletos.length} boleto(s)
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-orange-600">
                        R$ {debt.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <span className={`mt-1 inline-block px-3 py-0.5 rounded-full text-xs font-bold ${
                        debt.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {debt.isPaid ? 'Pago' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                </div>

                {expandedDebts.has(debt.id) && (
                  <div className="border-t border-slate-200 bg-white">
                    <div className="p-5">
                      <h4 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wide">Boletos desta Dívida</h4>
                      <div className="space-y-3">
                        {debt.boletos.map(boleto => (
                          <div key={boleto.id} className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-semibold text-slate-900">{boleto.client}</span>
                                <div className="text-sm text-slate-600 mt-1 space-y-0.5">
                                  <p>Parcela {boleto.installmentNumber}/{boleto.totalInstallments}</p>
                                  <p>Vencimento: {new Date(boleto.dueDate).toLocaleDateString('pt-BR')}</p>
                                </div>
                              </div>
                              <div className="text-right flex flex-col items-end gap-2">
                                <span className="font-bold text-lg text-orange-600">
                                  R$ {boleto.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(boleto.status)}`}>
                                  {getStatusLabel(boleto.status)}
                                </span>
                                {boleto.status === 'pendente' && (
                                  <div className="flex gap-2 flex-wrap justify-end">
                                    <button
                                      onClick={() => {
                                        if (window.confirm(`Marcar como pago?\n\nValor: R$ ${boleto.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\nEste valor será descontado do caixa.`)) {
                                          updateBoleto({ ...boleto, id: boleto.id, status: 'compensado', paymentDate: getCurrentDateString(), updatedAt: new Date().toISOString() }).catch(err => alert('Erro: ' + err.message));
                                        }
                                      }}
                                      className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold text-xs"
                                    >
                                      Marcar como Pago
                                    </button>
                                    {boleto.dueDate < today && (
                                      <button
                                        onClick={() => setManagingOverdueBoleto(boleto)}
                                        className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold text-xs"
                                      >
                                        Gerenciar Vencido
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Receipt className="w-16 h-16 mx-auto mb-4 text-orange-200" />
            <p className="text-orange-500 font-medium">Nenhuma dívida com boletos</p>
            <p className="text-orange-400 text-sm mt-1">Boletos de dívidas aparecerão aqui</p>
          </div>
        )}
      </div>

      {/* Boletos Avulsos */}
      <div className="card modern-shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-xl bg-blue-600">
            <Receipt className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Boletos Avulsos</h3>
        </div>

        {boletos.filter(b => !b.saleId && !b.debtId).length > 0 ? (
          <div className="overflow-x-auto modern-scrollbar">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-4 px-6 font-bold text-slate-700 bg-gradient-to-r from-cyan-50 to-blue-50">Cliente</th>
                  <th className="text-left py-4 px-6 font-bold text-slate-700 bg-gradient-to-r from-cyan-50 to-blue-50">Valor</th>
                  <th className="text-left py-4 px-6 font-bold text-slate-700 bg-gradient-to-r from-cyan-50 to-blue-50">Vencimento</th>
                  <th className="text-left py-4 px-6 font-bold text-slate-700 bg-gradient-to-r from-cyan-50 to-blue-50">Status</th>
                  <th className="text-left py-4 px-6 font-bold text-slate-700 bg-gradient-to-r from-cyan-50 to-blue-50">Ações</th>
                </tr>
              </thead>
              <tbody>
                {boletos.filter(b => !b.saleId && !b.debtId).map(boleto => (
                  <tr key={boleto.id} className="border-b border-slate-100 hover:bg-gradient-to-r hover:from-cyan-50/50 hover:to-blue-50/50 transition-all duration-300">
                    <td className="py-4 px-6 text-sm font-bold text-slate-900">{boleto.client}</td>
                    <td className="py-4 px-6 text-sm font-black text-cyan-600">
                      R$ {boleto.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6 text-sm">
                      {new Date(boleto.dueDate).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-4 px-6 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(boleto.status)}`}>
                        {getStatusLabel(boleto.status)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewingBoleto(boleto)}
                          className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-modern"
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingBoleto(boleto)}
                          className="text-emerald-600 hover:text-emerald-800 p-2 rounded-lg hover:bg-emerald-50 transition-modern"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBoleto(boleto.id)}
                          className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-modern"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-6 floating-animation">
              <Receipt className="w-12 h-12 text-cyan-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-4">Nenhum boleto avulso registrado</h3>
            <p className="text-slate-600 mb-8 text-lg">Boletos avulsos (não vinculados a vendas ou dívidas) aparecerão aqui.</p>
            <button
              onClick={() => setIsFormOpen(true)}
              className="btn-primary modern-shadow-xl"
            >
              Registrar boleto avulso
            </button>
          </div>
        )}
      </div>

      {(isFormOpen || editingBoleto) && (
        <BoletoForm
          boleto={editingBoleto}
          onSubmit={editingBoleto ? handleEditBoleto : handleAddBoleto}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingBoleto(null);
          }}
        />
      )}

      {managingOverdueBoleto && (
        <OverdueBoletoForm
          boleto={managingOverdueBoleto}
          onSubmit={handleOverdueBoletoSubmit}
          onCancel={() => setManagingOverdueBoleto(null)}
        />
      )}

      {viewingBoleto && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto modern-shadow-xl">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 modern-shadow-xl">
                    <Receipt className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900">Detalhes do Boleto</h2>
                </div>
                <button
                  onClick={() => setViewingBoleto(null)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="form-label">Cliente</label>
                  <p className="text-sm text-slate-900 font-medium">{viewingBoleto.client}</p>
                </div>
                <div>
                  <label className="form-label">Valor</label>
                  <p className="text-sm text-slate-900 font-bold text-cyan-600">
                    R$ {viewingBoleto.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <label className="form-label">Vencimento</label>
                  <p className="text-sm text-slate-900 font-medium">
                    {new Date(viewingBoleto.dueDate).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(viewingBoleto.status)}`}>
                    {getStatusLabel(viewingBoleto.status)}
                  </span>
                </div>
                <div>
                  <label className="form-label">Parcela</label>
                  <p className="text-sm text-slate-900 font-medium">
                    {viewingBoleto.installmentNumber} de {viewingBoleto.totalInstallments}
                  </p>
                </div>
                <div>
                  <label className="form-label">Tipo</label>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    viewingBoleto.isCompanyPayable ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {viewingBoleto.isCompanyPayable ? 'A Pagar' : 'A Receber'}
                  </span>
                </div>
                {viewingBoleto.observations && (
                  <div className="md:col-span-2">
                    <label className="form-label">Observações</label>
                    <p className="text-sm text-slate-900 font-medium">{viewingBoleto.observations}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button onClick={() => setViewingBoleto(null)} className="btn-secondary">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
