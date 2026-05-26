import React, { useState } from 'react';
import { Plus, CreditCard as Edit, Trash2, Eye, FileText, DollarSign, Calendar, AlertCircle, X, Building2, CreditCard, Clock, CheckCircle, ChevronDown, ChevronRight, Zap, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { Check } from '../types';
import { CheckForm } from './forms/CheckForm';
import { ImageUpload } from './ImageUpload';
import { getCurrentDateString } from '../utils/dateUtils';
import { DiscountChecksForm } from './forms/DiscountChecksForm';

export function Checks() {
  const { checks, sales, debts, isLoading, error, createCheck, updateCheck, deleteCheck } = useAppContext();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCheck, setEditingCheck] = useState<Check | null>(null);
  const [viewingCheck, setViewingCheck] = useState<Check | null>(null);
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set());
  const [expandedDebts, setExpandedDebts] = useState<Set<string>>(new Set());
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  const [expandedDiscounted, setExpandedDiscounted] = useState<Set<string>>(new Set());
  const [showReceivableFilters, setShowReceivableFilters] = useState(false);
  const [showPayableFilters, setShowPayableFilters] = useState(false);
  const [showUsedFilters, setShowUsedFilters] = useState(false);
  // Layer 1 UI guard: tracks which check ids are currently being processed
  const [processingCheckIds, setProcessingCheckIds] = useState<Set<string>>(new Set());
  const [receivableFilters, setReceivableFilters] = useState({
    client: '',
    dateFrom: '',
    dateTo: '',
    minValue: '',
    maxValue: ''
  });
  const [payableFilters, setPayableFilters] = useState({
    supplier: '',
    dateFrom: '',
    dateTo: '',
    minValue: '',
    maxValue: ''
  });
  const [usedFilters, setUsedFilters] = useState({
    name: '',
    dateFrom: '',
    dateTo: '',
    minValue: '',
    maxValue: ''
  });

  const today = getCurrentDateString();
  const dueToday = checks.filter(check => check.dueDate === today && check.status === 'pendente');
  const overdue = checks.filter(check => check.dueDate < today && check.status === 'pendente');
  
  // Novos cálculos para widgets
  const notDueYet = checks.filter(check => check.dueDate > today && check.status === 'pendente');
  const totalNotDueYet = notDueYet.reduce((sum, check) => sum + check.value, 0);
  const totalOverdue = overdue.reduce((sum, check) => sum + check.value, 0);

  const discountedChecks = checks.filter(check => check.is_discounted || check.discount_date);
  const totalDiscountedOriginalValue = discountedChecks.reduce((sum, check) => sum + check.value, 0);
  const totalDiscountedReceivedValue = discountedChecks.reduce((sum, check) => sum + (check.discounted_amount || 0), 0);
  
  // Cheques que a empresa tem para pagar
  const companyPayableChecks = checks.filter(check => 
    check.isCompanyPayable && check.status === 'pendente'
  );
  const totalCompanyPayableChecks = companyPayableChecks.reduce((sum, check) => sum + check.value, 0);

  // All sales that have checks (used for both "a receber" and "depositados" sections)
  const allSalesWithChecks = sales.filter(sale => {
    const saleChecks = checks.filter(check => check.saleId === sale.id);
    return saleChecks.length > 0;
  }).map(sale => {
    const saleChecks = checks.filter(check => check.saleId === sale.id);
    const pendingCheckValue = saleChecks
      .filter(check => check.status !== 'compensado')
      .reduce((sum, check) => sum + check.value, 0);
    const compensatedCount = saleChecks.filter(check => check.status === 'compensado').length;
    const allCompensated = saleChecks.length > 0 && compensatedCount === saleChecks.length;
    const someCompensated = compensatedCount > 0 && compensatedCount < saleChecks.length;
    // Derived check status: use sale.status but also check check-level compensation
    const checkStatus: 'pago' | 'parcial' | 'pendente' = allCompensated ? 'pago' : someCompensated ? 'parcial' : 'pendente';
    return {
      ...sale,
      checks: saleChecks,
      pendingCheckValue,
      checkStatus,
      allCompensated,
    };
  });

  // "Cheques a Receber" — only sales where NOT all checks are compensated, with filters applied
  const salesWithChecks = allSalesWithChecks.filter(sale => {
    // Exclude fully compensated sales — they move to "Depositados"
    if (sale.allCompensated) return false;

    // Apply receivable filters
    if (receivableFilters.client && !sale.client.toLowerCase().includes(receivableFilters.client.toLowerCase())) {
      return false;
    }
    if (receivableFilters.dateFrom && sale.date < receivableFilters.dateFrom) {
      return false;
    }
    if (receivableFilters.dateTo && sale.date > receivableFilters.dateTo) {
      return false;
    }
    const totalValue = sale.checks.reduce((sum, check) => sum + check.value, 0);
    if (receivableFilters.minValue && totalValue < parseFloat(receivableFilters.minValue)) {
      return false;
    }
    if (receivableFilters.maxValue && totalValue > parseFloat(receivableFilters.maxValue)) {
      return false;
    }
    return true;
  });

  const debtsWithChecks = debts.filter(debt => {
    const debtChecks = checks.filter(check => check.debtId === debt.id);
    if (debtChecks.length === 0) return false;

    // Apply payable filters
    if (payableFilters.supplier && !debt.company.toLowerCase().includes(payableFilters.supplier.toLowerCase())) {
      return false;
    }
    if (payableFilters.dateFrom && debt.date < payableFilters.dateFrom) {
      return false;
    }
    if (payableFilters.dateTo && debt.date > payableFilters.dateTo) {
      return false;
    }
    const totalValue = debtChecks.reduce((sum, check) => sum + check.value, 0);
    if (payableFilters.minValue && totalValue < parseFloat(payableFilters.minValue)) {
      return false;
    }
    if (payableFilters.maxValue && totalValue > parseFloat(payableFilters.maxValue)) {
      return false;
    }
    return true;
  }).map(debt => ({
    ...debt,
    checks: checks.filter(check => check.debtId === debt.id)
  }));

  // Filter used checks — use allSalesWithChecks so fully-compensated sales are still shown here
  const usedChecksSales = allSalesWithChecks.filter(sale => {
    const usedChecks = sale.checks.filter(check => check.usedInDebt);
    if (usedChecks.length === 0) return false;

    // Apply used filters
    if (usedFilters.name && !sale.client.toLowerCase().includes(usedFilters.name.toLowerCase())) {
      return false;
    }
    if (usedFilters.dateFrom && sale.date < usedFilters.dateFrom) {
      return false;
    }
    if (usedFilters.dateTo && sale.date > usedFilters.dateTo) {
      return false;
    }
    const totalValue = usedChecks.reduce((sum, check) => sum + check.value, 0);
    if (usedFilters.minValue && totalValue < parseFloat(usedFilters.minValue)) {
      return false;
    }
    if (usedFilters.maxValue && totalValue > parseFloat(usedFilters.maxValue)) {
      return false;
    }
    return true;
  });

  const handleAddCheck = (check: Omit<Check, 'id' | 'createdAt'>) => {
    createCheck(check).then(() => {
      setIsFormOpen(false);
    }).catch(error => {
      alert('Erro ao criar cheque: ' + error.message);
    });
  };

  const handleEditCheck = (check: Omit<Check, 'id' | 'createdAt'>) => {
    if (editingCheck) {
      updateCheck({ ...check, id: editingCheck.id, createdAt: editingCheck.createdAt }).then(() => {
        setEditingCheck(null);
      }).catch(error => {
        alert('Erro ao atualizar cheque: ' + error.message);
      });
    }
  };

  const handleDeleteCheck = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este cheque? Esta ação não pode ser desfeita.')) {
      deleteCheck(id).catch(error => {
        alert('Erro ao excluir cheque: ' + error.message);
      });
    }
  };

  // Shared handler for compensating any check (sales or debt)
  const handleCompensateCheck = (check: Check, confirmMessage: string, successMessage: string) => {
    if (processingCheckIds.has(check.id)) return;
    if (!window.confirm(confirmMessage)) return;

    // Layer 1: disable button immediately
    setProcessingCheckIds(prev => new Set(prev).add(check.id));

    const updatedCheck = {
      ...check,
      status: 'compensado' as const,
      paymentDate: getCurrentDateString(),
      updatedAt: new Date().toISOString(),
    };

    updateCheck({ ...updatedCheck, id: check.id })
      .then(() => {
        toast.success(successMessage);
      })
      .catch((error: Error) => {
        toast.error('Erro: ' + error.message);
        // Re-enable button only on error
        setProcessingCheckIds(prev => {
          const next = new Set(prev);
          next.delete(check.id);
          return next;
        });
      });
    // On success, leave the id in processingCheckIds — the check row will re-render
    // as 'compensado' and the button will be hidden, so there's no need to remove it.
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

  const getStatusColor = (status: Check['status']) => {
    switch (status) {
      case 'compensado': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'devolvido': return 'bg-red-100 text-red-800 border-red-200';
      case 'reapresentado': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getStatusLabel = (status: Check['status']) => {
    switch (status) {
      case 'compensado': return 'Compensado';
      case 'devolvido': return 'Devolvido';
      case 'reapresentado': return 'Reapresentado';
      default: return 'Pendente';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-600 font-semibold">Carregando cheques...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-yellow-600 to-amber-700 shadow-xl floating-animation">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Gestão de Cheques</h1>
            <p className="text-slate-600 text-lg">Controle completo de cheques recebidos e emitidos</p>
          </div>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="btn-primary flex items-center gap-2 modern-shadow-xl hover:modern-shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Adicionar Cheque
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
            <div>
              <h3 className="font-bold text-red-800">Erro no Sistema</h3>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Cheques não vencidos */}
        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 modern-shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-600 modern-shadow-lg">
              <Calendar className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-green-900 text-lg">Não Vencidos</h3>
              <p className="text-green-700 font-medium">{notDueYet.length} cheque(s)</p>
              <p className="text-sm text-green-600 font-semibold">
                Total: R$ {totalNotDueYet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Cheques vencidos */}
        <div className="card bg-gradient-to-br from-red-50 to-red-100 border-red-200 modern-shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-600 modern-shadow-lg">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-red-900 text-lg">Vencidos</h3>
              <p className="text-red-700 font-medium">{overdue.length} cheque(s)</p>
              <p className="text-sm text-red-600 font-semibold">
                Total: R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Cheques para pagar */}
        <div className="card bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 modern-shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-orange-600 modern-shadow-lg">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-orange-900 text-lg">Para Pagar</h3>
              <p className="text-orange-700 font-medium">{companyPayableChecks.length} cheque(s)</p>
              <p className="text-sm text-orange-600 font-semibold">
                Total: R$ {totalCompanyPayableChecks.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {dueToday.length > 0 && (
          <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 modern-shadow-xl">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-600 modern-shadow-lg">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-blue-900 text-lg">Vencimentos Hoje</h3>
                <p className="text-blue-700 font-medium">{dueToday.length} cheque(s)</p>
                <p className="text-sm text-blue-600 font-semibold">
                  Total: R$ {dueToday.reduce((sum, check) => sum + check.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cheques a Receber (de Vendas) */}
      <div className="card modern-shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-green-600">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Cheques a Receber (de Vendas)</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReceivableFilters(!showReceivableFilters)}
              className="btn-secondary flex items-center gap-2"
            >
              <Filter className="w-5 h-5" />
              Filtros
            </button>
            <button
              onClick={() => {
                const availableChecks = checks.filter(check =>
                  check.saleId &&
                  !check.usedInDebt &&
                  !check.is_discounted &&
                  check.status === 'pendente'
                );
                if (availableChecks.length === 0) {
                  alert('Não há cheques disponíveis para antecipar');
                  return;
                }
                setShowDiscountForm(true);
              }}
              className="btn-primary flex items-center gap-2 modern-shadow-xl hover:modern-shadow-lg"
            >
              <Zap className="w-5 h-5" />
              Antecipar Cheques
            </button>
          </div>
        </div>

        {showReceivableFilters && (
          <div className="mb-6 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-slate-900">Filtros de Cheques a Receber</h4>
              <button
                onClick={() => {
                  setReceivableFilters({
                    client: '',
                    dateFrom: '',
                    dateTo: '',
                    minValue: '',
                    maxValue: ''
                  });
                }}
                className="text-sm text-green-600 hover:text-green-800 font-semibold"
              >
                Limpar Filtros
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Cliente</label>
                <input
                  type="text"
                  value={receivableFilters.client}
                  onChange={(e) => setReceivableFilters(prev => ({ ...prev, client: e.target.value }))}
                  placeholder="Nome do cliente"
                  className="input-field"
                />
              </div>
              <div>
                <label className="form-label">Data Início</label>
                <input
                  type="date"
                  value={receivableFilters.dateFrom}
                  onChange={(e) => setReceivableFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="form-label">Data Fim</label>
                <input
                  type="date"
                  value={receivableFilters.dateTo}
                  onChange={(e) => setReceivableFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="form-label">Valor Mínimo</label>
                <input
                  type="number"
                  step="0.01"
                  value={receivableFilters.minValue}
                  onChange={(e) => setReceivableFilters(prev => ({ ...prev, minValue: e.target.value }))}
                  placeholder="0,00"
                  className="input-field"
                />
              </div>
              <div>
                <label className="form-label">Valor Máximo</label>
                <input
                  type="number"
                  step="0.01"
                  value={receivableFilters.maxValue}
                  onChange={(e) => setReceivableFilters(prev => ({ ...prev, maxValue: e.target.value }))}
                  placeholder="0,00"
                  className="input-field"
                />
              </div>
            </div>
          </div>
        )}
        
        {salesWithChecks.length > 0 ? (
          <div className="space-y-4">
            {salesWithChecks.map(sale => (
              <div key={sale.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                <div 
                  className="p-6 bg-gradient-to-r from-green-50 to-transparent hover:from-green-100 cursor-pointer transition-modern"
                  onClick={() => toggleSaleExpansion(sale.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button className="p-2 rounded-lg bg-green-600 text-white modern-shadow">
                        {expandedSales.has(sale.id) ? 
                          <ChevronDown className="w-5 h-5" /> : 
                          <ChevronRight className="w-5 h-5" />
                        }
                      </button>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{sale.client}</h3>
                        <p className="text-sm text-slate-600">
                          Data: {new Date(sale.date).toLocaleDateString('pt-BR')} • 
                          {sale.checks.length} cheque(s)
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-600">
                        R$ {sale.pendingCheckValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-slate-500 mb-1">
                        a receber em cheques
                      </p>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        sale.checkStatus === 'pago' ? 'bg-emerald-100 text-emerald-700' :
                        sale.checkStatus === 'parcial' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {sale.checkStatus === 'pago' ? 'Totalmente Recebida' :
                         sale.checkStatus === 'parcial' ? 'Parcial' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                </div>

                {expandedSales.has(sale.id) && (
                  <div className="border-t border-slate-200 bg-white">
                    <div className="p-6">
                      <h4 className="font-semibold text-slate-900 mb-4">Cheques desta Venda</h4>
                      <div className="space-y-3">
                        {sale.checks.map(check => (
                          <div key={check.id} className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-medium text-slate-900">{check.client}</span>
                                <div className="text-sm text-slate-600 mt-1">
                                  Parcela {check.installmentNumber}/{check.totalInstallments}
                                </div>
                                <div className="text-sm text-slate-600">
                                  Vencimento: {new Date(check.dueDate).toLocaleDateString('pt-BR')}
                                </div>
                                <div className="text-sm text-slate-600">
                                  Status: {getStatusLabel(check.status)}
                                  {check.status === 'compensado' && ' ✓'}
                                </div>
                               {check.usedInDebt && (
                                 <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                                   <div className="text-xs text-red-900 font-bold">
                                     USADO PARA PAGAMENTO DE DÍVIDAS
                                   </div>
                                   <div className="text-xs text-red-700">
                                     Dívida: {debts.find(d => d.id === check.usedInDebt)?.company || check.usedInDebt}
                                   </div>
                                 </div>
                               )}
                               {check.usedFor && !check.usedInDebt && (
                                 <div className="text-sm text-blue-600 font-semibold">
                                   Usado para: {check.usedFor}
                                 </div>
                               )}
                              </div>
                              <div className="text-right">
                                <span className="font-medium text-yellow-600">
                                  R$ {check.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                                {check.status === 'pendente' && !check.usedInDebt && (
                                  <div className="mt-2">
                                    <button
                                      disabled={processingCheckIds.has(check.id)}
                                      onClick={() => handleCompensateCheck(
                                        check,
                                        `Marcar este cheque como compensado?\n\nValor: R$ ${check.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\nEste valor será adicionado ao caixa da empresa.`,
                                        'Cheque marcado como compensado!'
                                      )}
                                      className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {processingCheckIds.has(check.id) ? 'Processando...' : 'Marcar como Compensado'}
                                    </button>
                                  </div>
                                )}
                                {check.usedInDebt && (
                                  <div className="mt-2">
                                    <div className="px-3 py-1 bg-gray-200 text-gray-600 rounded-lg font-bold text-xs text-center">
                                      Cheque já usado em dívida
                                    </div>
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
          <div className="text-center py-16">
            <FileText className="w-20 h-20 mx-auto mb-6 text-slate-300" />
            <p className="text-slate-500 mb-4 text-xl font-medium">Nenhuma venda com cheques ainda.</p>
            <p className="text-slate-400 text-sm mb-6">
              Os cheques são criados automaticamente quando você registra vendas com pagamento em cheque.
            </p>
          </div>
        )}
      </div>

      {/* Cheques a Pagar (de Dívidas) */}
      <div className="card modern-shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-orange-600">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-orange-900">Cheques a Pagar (de Dívidas)</h3>
              <span className="text-orange-600 font-semibold text-sm">
                Total: R$ {totalCompanyPayableChecks.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowPayableFilters(!showPayableFilters)}
            className="btn-secondary flex items-center gap-2"
          >
            <Filter className="w-5 h-5" />
            Filtros
          </button>
        </div>

        {showPayableFilters && (
          <div className="mb-6 p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-200">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-slate-900">Filtros de Cheques a Pagar</h4>
              <button
                onClick={() => {
                  setPayableFilters({
                    supplier: '',
                    dateFrom: '',
                    dateTo: '',
                    minValue: '',
                    maxValue: ''
                  });
                }}
                className="text-sm text-orange-600 hover:text-orange-800 font-semibold"
              >
                Limpar Filtros
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Fornecedor</label>
                <input
                  type="text"
                  value={payableFilters.supplier}
                  onChange={(e) => setPayableFilters(prev => ({ ...prev, supplier: e.target.value }))}
                  placeholder="Nome do fornecedor"
                  className="input-field"
                />
              </div>
              <div>
                <label className="form-label">Data Início</label>
                <input
                  type="date"
                  value={payableFilters.dateFrom}
                  onChange={(e) => setPayableFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="form-label">Data Fim</label>
                <input
                  type="date"
                  value={payableFilters.dateTo}
                  onChange={(e) => setPayableFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="form-label">Valor Mínimo</label>
                <input
                  type="number"
                  step="0.01"
                  value={payableFilters.minValue}
                  onChange={(e) => setPayableFilters(prev => ({ ...prev, minValue: e.target.value }))}
                  placeholder="0,00"
                  className="input-field"
                />
              </div>
              <div>
                <label className="form-label">Valor Máximo</label>
                <input
                  type="number"
                  step="0.01"
                  value={payableFilters.maxValue}
                  onChange={(e) => setPayableFilters(prev => ({ ...prev, maxValue: e.target.value }))}
                  placeholder="0,00"
                  className="input-field"
                />
              </div>
            </div>
          </div>
        )}
        
        {debtsWithChecks.length > 0 ? (
          <div className="space-y-4">
            {debtsWithChecks.map(debt => (
              <div key={debt.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                <div 
                  className="p-6 bg-gradient-to-r from-orange-50 to-transparent hover:from-orange-100 cursor-pointer transition-modern"
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
                          Data: {new Date(debt.date).toLocaleDateString('pt-BR')} • 
                          {debt.checks.length} cheque(s)
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-orange-600">
                        R$ {debt.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      {(() => {
                        const compensated = debt.checks.filter((c: any) => c.status === 'compensado').length;
                        const total = debt.checks.length;
                        const debtStatus = debt.isPaid || compensated === total
                          ? 'pago'
                          : compensated > 0
                          ? 'parcial'
                          : 'pendente';
                        return (
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            debtStatus === 'pago' ? 'bg-emerald-100 text-emerald-700' :
                            debtStatus === 'parcial' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {debtStatus === 'pago' ? 'Pago' : debtStatus === 'parcial' ? 'Parcial' : 'Pendente'}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {expandedDebts.has(debt.id) && (
                  <div className="border-t border-slate-200 bg-white">
                    <div className="p-6">
                      <h4 className="font-semibold text-slate-900 mb-4">Cheques desta Dívida</h4>
                      <div className="space-y-3">
                        {debt.checks.map(check => (
                          <div key={check.id} className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-medium text-slate-900">{check.client}</span>
                                <div className="text-sm text-slate-600 mt-1">
                                  Parcela {check.installmentNumber}/{check.totalInstallments}
                                </div>
                                <div className="text-sm text-slate-600">
                                  Vencimento: {new Date(check.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </div>
                                <div className="text-sm text-slate-600">
                                  Status: {getStatusLabel(check.status)}
                                  {check.status === 'compensado' && ' ✓'}
                                </div>
                               {check.usedFor && (
                                 <div className="text-sm text-blue-600 font-semibold">
                                   Usado para: {check.usedFor}
                                 </div>
                               )}
                              </div>
                              <div className="text-right">
                                <span className="font-medium text-orange-600">
                                  R$ {check.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                                {check.status === 'pendente' && (
                                  <div className="mt-2">
                                    <button
                                      disabled={processingCheckIds.has(check.id)}
                                      onClick={() => handleCompensateCheck(
                                        check,
                                        `Marcar este cheque como pago?\n\nValor: R$ ${check.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\nEste valor será descontado do caixa da empresa.`,
                                        'Cheque marcado como pago!'
                                      )}
                                      className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {processingCheckIds.has(check.id) ? 'Processando...' : 'Marcar como Pago'}
                                    </button>
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
            <CreditCard className="w-16 h-16 mx-auto mb-4 text-orange-300" />
            <p className="text-orange-600 font-medium">Nenhuma dívida com cheques</p>
            <p className="text-orange-500 text-sm mt-2">
              Cheques de dívidas aparecerão aqui
            </p>
          </div>
        )}
      </div>

      {/* Cheques Usados para Pagamento de Dívidas */}
      <div className="card modern-shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-600">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Cheques Usados para Pagamento de Dívidas</h3>
              <p className="text-sm text-slate-600">
                Total: R$ {checks.filter(c => c.usedInDebt).reduce((sum, c) => sum + c.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} •
                {checks.filter(c => c.usedInDebt).length} cheque(s)
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowUsedFilters(!showUsedFilters)}
            className="btn-secondary flex items-center gap-2"
          >
            <Filter className="w-5 h-5" />
            Filtros
          </button>
        </div>

        {showUsedFilters && (
          <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-slate-900">Filtros de Cheques Usados</h4>
              <button
                onClick={() => {
                  setUsedFilters({
                    name: '',
                    dateFrom: '',
                    dateTo: '',
                    minValue: '',
                    maxValue: ''
                  });
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
              >
                Limpar Filtros
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Nome</label>
                <input
                  type="text"
                  value={usedFilters.name}
                  onChange={(e) => setUsedFilters(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do cliente"
                  className="input-field"
                />
              </div>
              <div>
                <label className="form-label">Data Início</label>
                <input
                  type="date"
                  value={usedFilters.dateFrom}
                  onChange={(e) => setUsedFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="form-label">Data Fim</label>
                <input
                  type="date"
                  value={usedFilters.dateTo}
                  onChange={(e) => setUsedFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="form-label">Valor Mínimo</label>
                <input
                  type="number"
                  step="0.01"
                  value={usedFilters.minValue}
                  onChange={(e) => setUsedFilters(prev => ({ ...prev, minValue: e.target.value }))}
                  placeholder="0,00"
                  className="input-field"
                />
              </div>
              <div>
                <label className="form-label">Valor Máximo</label>
                <input
                  type="number"
                  step="0.01"
                  value={usedFilters.maxValue}
                  onChange={(e) => setUsedFilters(prev => ({ ...prev, maxValue: e.target.value }))}
                  placeholder="0,00"
                  className="input-field"
                />
              </div>
            </div>
          </div>
        )}

        {checks.filter(c => c.usedInDebt).length > 0 ? (
          <div className="space-y-4">
            {usedChecksSales.map(sale => (
                <div key={sale.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div
                    className="p-6 bg-gradient-to-r from-blue-50 to-transparent hover:from-blue-100 cursor-pointer transition-modern"
                    onClick={() => {
                      const newExpanded = new Set(expandedSales);
                      if (newExpanded.has(sale.id)) {
                        newExpanded.delete(sale.id);
                      } else {
                        newExpanded.add(sale.id);
                      }
                      setExpandedSales(newExpanded);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button className="p-2 rounded-lg bg-blue-600 text-white modern-shadow">
                          {expandedSales.has(sale.id) ?
                            <ChevronDown className="w-5 h-5" /> :
                            <ChevronRight className="w-5 h-5" />
                          }
                        </button>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{sale.client}</h3>
                          <p className="text-sm text-slate-600">
                            Data: {new Date(sale.date).toLocaleDateString('pt-BR')} •
                            {sale.checks.filter(c => c.usedInDebt).length} cheque(s) usado(s) em dívidas
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {expandedSales.has(sale.id) && (
                    <div className="border-t border-slate-200 bg-white">
                      <div className="p-6">
                        <h4 className="font-semibold text-slate-900 mb-4">Cheques Usados em Dívidas</h4>
                        <div className="space-y-3">
                          {sale.checks
                            .filter(check => check.usedInDebt)
                            .map(check => (
                              <div key={check.id} className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <span className="font-medium text-slate-900">{check.client}</span>
                                    <div className="text-sm text-slate-600 mt-1">
                                      Parcela {check.installmentNumber}/{check.totalInstallments}
                                    </div>
                                    <div className="text-sm text-slate-600">
                                      Vencimento Original: {new Date(check.dueDate).toLocaleDateString('pt-BR')}
                                    </div>
                                    {check.supplierName && (
                                      <div className="text-sm text-blue-600 font-semibold mt-2">
                                        Fornecedor Pago: {check.supplierName}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <span className="font-medium text-blue-600">
                                      R$ {check.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                    <div className="text-xs text-blue-500 mt-1">Usado em dívida</div>
                                  </div>
                                </div>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        ) : (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 mx-auto mb-4 text-blue-300" />
            <p className="text-blue-600 font-medium">Nenhum cheque usado em pagamento de dívidas ainda</p>
            <p className="text-blue-500 text-sm mt-2">
              Quando você usar cheques de clientes para pagar fornecedores, eles aparecerão aqui
            </p>
          </div>
        )}
      </div>

      {/* Cheques Depositados ou Antecipados */}
      <div className="card modern-shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-xl bg-emerald-600">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Cheques Depositados ou Antecipados</h3>
            <p className="text-sm text-slate-600">
              Total Original: R$ {totalDiscountedOriginalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} •
              Total Recebido: R$ {totalDiscountedReceivedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {(() => {
          // Show sales with discounted/anticipated checks AND fully-compensated sales
          const depositedSales = allSalesWithChecks.filter(sale =>
            sale.allCompensated ||
            sale.checks.some(check => check.is_discounted || check.discount_date)
          );
          return depositedSales.length > 0 ? (
            <div className="space-y-4">
              {depositedSales.map(sale => {
                const anticipatedChecks = sale.checks.filter(c => c.is_discounted || c.discount_date);
                const compensatedChecks = sale.checks.filter(c => c.status === 'compensado' && !c.is_discounted && !c.discount_date);
                const isFullyCompensated = sale.allCompensated;
                const totalCompensatedValue = sale.checks
                  .filter(c => c.status === 'compensado')
                  .reduce((sum, c) => sum + c.value, 0);
                return (
                  <div key={sale.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                    <div
                      className="p-6 bg-gradient-to-r from-emerald-50 to-transparent hover:from-emerald-100 cursor-pointer transition-modern"
                      onClick={() => {
                        const newExpanded = new Set(expandedDiscounted);
                        if (newExpanded.has(sale.id)) {
                          newExpanded.delete(sale.id);
                        } else {
                          newExpanded.add(sale.id);
                        }
                        setExpandedDiscounted(newExpanded);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <button className="p-2 rounded-lg bg-emerald-600 text-white modern-shadow">
                            {expandedDiscounted.has(sale.id) ?
                              <ChevronDown className="w-5 h-5" /> :
                              <ChevronRight className="w-5 h-5" />
                            }
                          </button>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">{sale.client}</h3>
                            <p className="text-sm text-slate-600">
                              Data: {new Date(sale.date).toLocaleDateString('pt-BR')} •{' '}
                              {sale.checks.filter(c => c.status === 'compensado' || c.is_discounted || c.discount_date).length} cheque(s) depositado(s)
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-emerald-600">
                            R$ {totalCompensatedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          {isFullyCompensated && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                              Totalmente Recebida
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {expandedDiscounted.has(sale.id) && (
                      <div className="border-t border-slate-200 bg-white">
                        <div className="p-6 space-y-4">
                          {compensatedChecks.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-slate-900 mb-3">Cheques Compensados</h4>
                              <div className="space-y-3">
                                {compensatedChecks.map(check => (
                                  <div key={check.id} className="p-4 bg-green-50 rounded-xl border border-green-200">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <span className="font-medium text-slate-900">{check.client}</span>
                                        <div className="text-sm text-slate-600 mt-1">
                                          Parcela {check.installmentNumber}/{check.totalInstallments}
                                        </div>
                                        <div className="text-sm text-slate-600">
                                          Vencimento: {new Date(check.dueDate).toLocaleDateString('pt-BR')}
                                        </div>
                                        {check.paymentDate && (
                                          <div className="text-sm text-green-600 font-semibold">
                                            Compensado em: {new Date(check.paymentDate).toLocaleDateString('pt-BR')}
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <span className="font-bold text-green-700">
                                          R$ {check.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                        <div className="text-xs text-green-600 font-semibold mt-1">Compensado ✓</div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {anticipatedChecks.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-slate-900 mb-3">Cheques Antecipados</h4>
                              <div className="space-y-3">
                                {anticipatedChecks.map(check => (
                                  <div key={check.id} className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <span className="font-medium text-slate-900">{check.client}</span>
                                        <div className="text-sm text-slate-600 mt-1">
                                          Parcela {check.installmentNumber}/{check.totalInstallments}
                                        </div>
                                        <div className="text-sm text-slate-600">
                                          Vencimento Original: {new Date(check.dueDate).toLocaleDateString('pt-BR')}
                                        </div>
                                        {check.discount_date && (
                                          <div className="text-sm text-emerald-600 font-semibold">
                                            Antecipado em: {new Date(check.discount_date).toLocaleDateString('pt-BR')}
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <div className="text-sm text-slate-600">Valor Original:</div>
                                        <span className="font-medium text-slate-900">
                                          R$ {check.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                        {check.discounted_amount && (
                                          <>
                                            <div className="text-sm text-emerald-600 font-bold mt-1">Valor Recebido:</div>
                                            <span className="font-bold text-emerald-600">
                                              R$ {check.discounted_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                          </>
                                        )}
                                        {check.discount_fee && check.discount_fee > 0 && (
                                          <div className="text-xs text-red-600 mt-1">
                                            Taxa: R$ {check.discount_fee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-300" />
              <p className="text-emerald-600 font-medium">Nenhum cheque depositado ou antecipado ainda</p>
              <p className="text-emerald-500 text-sm mt-2">
                Cheques compensados e antecipados aparecerão aqui
              </p>
            </div>
          );
        })()}
      </div>

      {/* Cheques Avulsos */}
      <div className="card modern-shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-xl bg-blue-600">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Cheques Avulsos</h3>
        </div>
        
        {checks.filter(c => !c.saleId && !c.debtId).length > 0 ? (
          <div className="overflow-x-auto modern-scrollbar">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-4 px-6 font-bold text-slate-700 bg-gradient-to-r from-yellow-50 to-amber-50">Cliente</th>
                  <th className="text-left py-4 px-6 font-bold text-slate-700 bg-gradient-to-r from-yellow-50 to-amber-50">Valor</th>
                  <th className="text-left py-4 px-6 font-bold text-slate-700 bg-gradient-to-r from-yellow-50 to-amber-50">Vencimento</th>
                  <th className="text-left py-4 px-6 font-bold text-slate-700 bg-gradient-to-r from-yellow-50 to-amber-50">Status</th>
                  <th className="text-left py-4 px-6 font-bold text-slate-700 bg-gradient-to-r from-yellow-50 to-amber-50">Ações</th>
                </tr>
              </thead>
              <tbody>
                {checks.filter(c => !c.saleId && !c.debtId).map(check => (
                  <tr key={check.id} className="border-b border-slate-100 hover:bg-gradient-to-r hover:from-yellow-50/50 hover:to-amber-50/50 transition-all duration-300">
                    <td className="py-4 px-6 text-sm font-bold text-slate-900">{check.client}</td>
                    <td className="py-4 px-6 text-sm font-black text-yellow-600">
                      R$ {check.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6 text-sm">
                      {new Date(check.dueDate).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-4 px-6 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(check.status)}`}>
                        {getStatusLabel(check.status)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewingCheck(check)}
                          className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-modern"
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingCheck(check)}
                          className="text-emerald-600 hover:text-emerald-800 p-2 rounded-lg hover:bg-emerald-50 transition-modern"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCheck(check.id)}
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
            <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6 floating-animation">
              <FileText className="w-12 h-12 text-yellow-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-4">Nenhum cheque avulso registrado</h3>
            <p className="text-slate-600 mb-8 text-lg">Cheques avulsos (não vinculados a vendas ou dívidas) aparecerão aqui.</p>
            <button
              onClick={() => setIsFormOpen(true)}
              className="btn-primary modern-shadow-xl"
            >
              Registrar cheque avulso
            </button>
          </div>
        )}
      </div>

      {/* Check Form Modal */}
      {(isFormOpen || editingCheck) && (
        <CheckForm
          check={editingCheck}
          onSubmit={editingCheck ? handleEditCheck : handleAddCheck}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingCheck(null);
          }}
        />
      )}

      {/* View Check Modal */}
      {viewingCheck && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto modern-shadow-xl">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-yellow-600 to-amber-700 modern-shadow-xl">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900">Detalhes do Cheque</h2>
                </div>
                <button
                  onClick={() => setViewingCheck(null)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="form-label">Cliente</label>
                  <p className="text-sm text-slate-900 font-medium">{viewingCheck.client}</p>
                </div>
                <div>
                  <label className="form-label">Valor</label>
                  <p className="text-sm text-slate-900 font-bold text-yellow-600">
                    R$ {viewingCheck.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <label className="form-label">Vencimento</label>
                  <p className="text-sm text-slate-900 font-medium">
                    {new Date(viewingCheck.dueDate).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(viewingCheck.status)}`}>
                    {getStatusLabel(viewingCheck.status)}
                  </span>
                </div>
                <div>
                  <label className="form-label">Parcela</label>
                  <p className="text-sm text-slate-900 font-medium">
                    {viewingCheck.installmentNumber} de {viewingCheck.totalInstallments}
                  </p>
                </div>
                <div>
                  <label className="form-label">Tipo</label>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    viewingCheck.isOwnCheck ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {viewingCheck.isOwnCheck ? 'Cheque Próprio' : 'Cheque de Terceiros'}
                  </span>
                </div>
                {viewingCheck.usedFor && (
                  <div className="md:col-span-2">
                    <label className="form-label">Usado Para</label>
                    <p className="text-sm text-slate-900 font-medium">{viewingCheck.usedFor}</p>
                  </div>
                )}
              </div>

              {viewingCheck.observations && (
                <div className="mb-8">
                  <label className="form-label">Observações</label>
                  <p className="text-sm text-slate-900 p-4 bg-slate-50 rounded-xl border">
                    {viewingCheck.observations}
                  </p>
                </div>
              )}

              {/* Image Upload Section */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-900 mb-6">Imagens do Cheque</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ImageUpload
                    checkId={viewingCheck.id}
                    imageType="front"
                    currentImage={viewingCheck.frontImage}
                    onImageUploaded={(imageUrl) => {
                      const updatedCheck = { ...viewingCheck, frontImage: imageUrl };
                      updateCheck({ ...updatedCheck, id: viewingCheck.id }).catch(error => {
                        alert('Erro ao atualizar cheque: ' + error.message);
                      });
                    }}
                    onImageDeleted={() => {
                      const updatedCheck = { ...viewingCheck, frontImage: null };
                      updateCheck({ ...updatedCheck, id: viewingCheck.id }).catch(error => {
                        alert('Erro ao atualizar cheque: ' + error.message);
                      });
                    }}
                    label="Frente do Cheque"
                  />
                  
                  <ImageUpload
                    checkId={viewingCheck.id}
                    imageType="back"
                    currentImage={viewingCheck.backImage}
                    onImageUploaded={(imageUrl) => {
                      const updatedCheck = { ...viewingCheck, backImage: imageUrl };
                      updateCheck({ ...updatedCheck, id: viewingCheck.id }).catch(error => {
                        alert('Erro ao atualizar cheque: ' + error.message);
                      });
                    }}
                    onImageDeleted={() => {
                      const updatedCheck = { ...viewingCheck, backImage: null };
                      updateCheck({ ...updatedCheck, id: viewingCheck.id }).catch(error => {
                        alert('Erro ao atualizar cheque: ' + error.message);
                      });
                    }}
                    label="Verso do Cheque"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setViewingCheck(null)}
                  className="btn-secondary"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discount Checks Form Modal */}
      {showDiscountForm && (
        <DiscountChecksForm
          checks={checks.filter(check =>
            check.saleId &&
            !check.usedInDebt &&
            !check.is_discounted &&
            check.status === 'pendente'
          )}
          onClose={() => setShowDiscountForm(false)}
          onSuccess={() => {
            setShowDiscountForm(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}