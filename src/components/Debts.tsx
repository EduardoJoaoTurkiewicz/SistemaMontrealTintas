import React, { useState } from 'react';
import {
  Plus,
  CreditCard as Edit,
  Trash2,
  Eye,
  CreditCard,
  FileText,
  AlertCircle,
  X,
  Filter,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { Debt } from '../types';
import { DebtForm } from './forms/DebtForm';
import { DeduplicationService } from '../lib/deduplicationService';
import { UUIDManager } from '../lib/uuidManager';
import { dbDateToDisplay, getCurrentDateString } from '../utils/dateUtils';
import { getCurrentDateISO } from '../lib/dateOnly';
import { StatusCalculationService } from '../lib/statusCalculationService';

// ─── Types ────────────────────────────────────────────────────────────────────

type DebtStatus = 'pago' | 'vencido' | 'parcial' | 'pendente';

interface PendingInstallment {
  type: 'check' | 'boleto';
  id: string;
  installmentNumber: number;
  totalInstallments: number;
  value: number;
  dueDate: string;
  status: string;
  debtId: string;
  debtCompany: string;
}

// ─── Confirm Payment Modal ─────────────────────────────────────────────────────

interface ConfirmPayModalProps {
  installment: PendingInstallment;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}

function ConfirmPayModal({ installment, onConfirm, onCancel, isProcessing }: ConfirmPayModalProps) {
  const today = getCurrentDateISO();
  const isOverdue = installment.dueDate < today && installment.status !== 'compensado';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl">
        <div className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className={`p-3 rounded-2xl ${isOverdue ? 'bg-orange-100' : 'bg-green-100'}`}>
              {isOverdue
                ? <AlertTriangle className="w-7 h-7 text-orange-600" />
                : <CheckCircle className="w-7 h-7 text-green-600" />
              }
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Confirmar Pagamento</h3>
              <p className="text-slate-500 text-sm">{installment.debtCompany}</p>
            </div>
          </div>

          <div className="space-y-3 mb-8 p-5 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Tipo</span>
              <span className="font-semibold text-slate-800">
                {installment.type === 'check' ? 'Cheque' : 'Boleto'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Parcela</span>
              <span className="font-semibold text-slate-800">
                {installment.installmentNumber}/{installment.totalInstallments}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Vencimento</span>
              <span className={`font-semibold ${isOverdue ? 'text-orange-600' : 'text-slate-800'}`}>
                {dbDateToDisplay(installment.dueDate)}
                {isOverdue && ' (Vencido)'}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-200 pt-3 mt-1">
              <span className="text-slate-600 text-sm">Valor</span>
              <span className="font-black text-xl text-green-700">
                R$ {installment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <p className="text-sm text-slate-500 mb-6 text-center">
            {installment.type === 'check'
              ? 'Este valor será debitado do caixa da empresa.'
              : 'Este pagamento será registrado no sistema.'
            }
          </p>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1 px-6 py-3 rounded-2xl border-2 border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={isProcessing}
              className="flex-1 px-6 py-3 rounded-2xl bg-green-600 text-white font-bold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Confirmar Pagamento
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────────

function DebtStatusBadge({ status }: { status: DebtStatus }) {
  const config: Record<DebtStatus, { cls: string; label: string }> = {
    pago:     { cls: 'bg-green-100 text-green-800 border-green-200',   label: 'Pago' },
    parcial:  { cls: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Parcial' },
    vencido:  { cls: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Vencido' },
    pendente: { cls: 'bg-red-100 text-red-800 border-red-200',          label: 'Pendente' },
  };
  const { cls, label } = config[status];
  return (
    <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function Debts() {
  const {
    debts,
    checks,
    boletos,
    isLoading,
    error,
    createDebt,
    updateDebt,
    deleteDebt,
    updateCheck,
    updateBoleto,
  } = useAppContext();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [viewingDebt, setViewingDebt] = useState<Debt | null>(null);
  const [expandedDebts, setExpandedDebts] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    company: '',
    dateFrom: '',
    dateTo: '',
    minValue: '',
    maxValue: '',
    paymentMethod: '',
  });

  const [confirmInstallment, setConfirmInstallment] = useState<PendingInstallment | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // ─── Derived data ────────────────────────────────────────────────────────────

  const deduplicatedDebts = React.useMemo(() => {
    let list = DeduplicationService.removeDuplicatesById(debts || []);
    if (filters.company)
      list = list.filter(d => d.company.toLowerCase().includes(filters.company.toLowerCase()));
    if (filters.dateFrom)  list = list.filter(d => d.date >= filters.dateFrom);
    if (filters.dateTo)    list = list.filter(d => d.date <= filters.dateTo);
    if (filters.minValue)  list = list.filter(d => d.totalValue >= parseFloat(filters.minValue));
    if (filters.maxValue)  list = list.filter(d => d.totalValue <= parseFloat(filters.maxValue));
    if (filters.paymentMethod)
      list = list.filter(d => d.paymentMethods?.some(m => m.type === filters.paymentMethod));
    return list;
  }, [debts, filters]);

  const getDebtStatus = (debt: Debt): DebtStatus =>
    StatusCalculationService.deriveDebtDisplayStatus(debt, checks, boletos);

  const totals = React.useMemo(() => {
    const totalDebt    = deduplicatedDebts.reduce((s, d) => s + d.totalValue, 0);
    const totalPaid    = deduplicatedDebts.reduce((s, d) => s + d.paidAmount, 0);
    const totalPending = deduplicatedDebts.reduce((s, d) => s + d.pendingAmount, 0);
    const paidCount    = deduplicatedDebts.filter(d => getDebtStatus(d) === 'pago').length;
    const partialCount = deduplicatedDebts.filter(d => getDebtStatus(d) === 'parcial').length;
    const vencidoCount = deduplicatedDebts.filter(d => getDebtStatus(d) === 'vencido').length;
    const pendingCount = deduplicatedDebts.filter(d => getDebtStatus(d) === 'pendente').length;
    return {
      totalDebt, totalPaid, totalPending,
      paidCount, partialCount, vencidoCount, pendingCount,
      totalCount: deduplicatedDebts.length,
    };
  }, [deduplicatedDebts, checks, boletos]);

  const getDebtInstallments = (debtId: string): PendingInstallment[] => {
    const company = debts.find(d => d.id === debtId)?.company ?? '';
    const fromChecks: PendingInstallment[] = checks
      // Exclude customer checks used to pay this debt — they are assets, not liabilities
      .filter(c => c.debtId === debtId && !c.saleId)
      .map(c => ({
        type: 'check' as const,
        id: c.id,
        installmentNumber: c.installmentNumber ?? 1,
        totalInstallments: c.totalInstallments ?? 1,
        value: c.value,
        dueDate: c.dueDate,
        status: c.status,
        debtId,
        debtCompany: company,
      }));
    const fromBoletos: PendingInstallment[] = boletos
      .filter(b => b.debtId === debtId)
      .map(b => ({
        type: 'boleto' as const,
        id: b.id,
        installmentNumber: b.installmentNumber,
        totalInstallments: b.totalInstallments,
        value: b.value,
        dueDate: b.dueDate,
        status: b.status,
        debtId,
        debtCompany: company,
      }));
    return [...fromChecks, ...fromBoletos].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'check' ? -1 : 1;
      return a.installmentNumber - b.installmentNumber;
    });
  };

  // ─── Payment handler ──────────────────────────────────────────────────────────

  const handleConfirmPayment = async () => {
    if (!confirmInstallment) return;
    const { id, type, debtId } = confirmInstallment;

    setProcessingIds(prev => new Set(prev).add(id));
    const paymentDate = getCurrentDateString();

    try {
      if (type === 'check') {
        await updateCheck({ id, status: 'compensado', paymentDate });
      } else {
        await updateBoleto({ id, status: 'compensado', paymentDate });
      }
      await StatusCalculationService.syncDebtStatus(debtId);
      toast.success('Parcela marcada como paga com sucesso!');
      setConfirmInstallment(null);
    } catch (err: any) {
      toast.error('Erro ao registrar pagamento: ' + (err?.message ?? 'Erro desconhecido'));
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  const handleAddDebt = (debt: Omit<Debt, 'id' | 'createdAt'>) => {
    if (!debt.company?.trim()) { alert('Por favor, informe o nome da empresa/fornecedor.'); return; }
    if (!debt.description?.trim()) { alert('Por favor, informe a descrição da dívida.'); return; }
    if (debt.totalValue <= 0) { alert('O valor total da dívida deve ser maior que zero.'); return; }

    createDebt(debt).then(() => {
      setIsFormOpen(false);
      const hasInstallments = debt.paymentMethods?.some(m =>
        (m.type === 'cheque' || m.type === 'boleto') && (m.installments ?? 0) > 1
      );
      if (hasInstallments) {
        setTimeout(() => alert('✅ Dívida criada com sucesso!\n\nOs cheques e boletos foram criados automaticamente.'), 1000);
      }
    }).catch((err: any) => alert('Erro ao criar dívida: ' + (err?.message ?? err)));
  };

  const handleEditDebt = (debt: Omit<Debt, 'id' | 'createdAt'>) => {
    if (!editingDebt) return;
    updateDebt({ ...debt, id: editingDebt.id, createdAt: editingDebt.createdAt })
      .then(() => setEditingDebt(null))
      .catch((err: any) => alert('Erro ao atualizar dívida: ' + err?.message));
  };

  const handleDeleteDebt = (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta dívida? Esta ação não pode ser desfeita.')) return;
    deleteDebt(id).catch((err: any) => alert('Erro ao excluir dívida: ' + err?.message));
  };

  const toggleDebt = (id: string) =>
    setExpandedDebts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  const today = getCurrentDateISO();

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 shadow-xl floating-animation">
            <CreditCard className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Gestão de Dívidas</h1>
            <p className="text-slate-600 text-lg">Controle completo de despesas e pagamentos</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary flex items-center gap-2">
            <Filter className="w-5 h-5" /> Filtros
          </button>
          <button onClick={() => setIsFormOpen(true)} className="btn-primary flex items-center gap-2 modern-shadow-xl hover:modern-shadow-lg">
            <Plus className="w-5 h-5" /> Nova Dívida
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      {showFilters && (
        <div className="card modern-shadow-xl bg-gradient-to-br from-red-50 to-rose-50">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-900">Filtros de Dívidas</h3>
            <button
              onClick={() => setFilters({ company: '', dateFrom: '', dateTo: '', minValue: '', maxValue: '', paymentMethod: '' })}
              className="text-sm text-red-600 hover:text-red-800 font-semibold"
            >
              Limpar Filtros
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Fornecedor</label>
              <input type="text" value={filters.company} onChange={e => setFilters(p => ({ ...p, company: e.target.value }))} placeholder="Nome do fornecedor" className="input-field" />
            </div>
            <div>
              <label className="form-label">Data Início</label>
              <input type="date" value={filters.dateFrom} onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="form-label">Data Fim</label>
              <input type="date" value={filters.dateTo} onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="form-label">Valor Mínimo</label>
              <input type="number" step="0.01" value={filters.minValue} onChange={e => setFilters(p => ({ ...p, minValue: e.target.value }))} placeholder="0,00" className="input-field" />
            </div>
            <div>
              <label className="form-label">Valor Máximo</label>
              <input type="number" step="0.01" value={filters.maxValue} onChange={e => setFilters(p => ({ ...p, maxValue: e.target.value }))} placeholder="0,00" className="input-field" />
            </div>
            <div>
              <label className="form-label">Método de Pagamento</label>
              <select value={filters.paymentMethod} onChange={e => setFilters(p => ({ ...p, paymentMethod: e.target.value }))} className="input-field">
                <option value="">Todos</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="cartao_credito">Cartão de Crédito</option>
                <option value="cartao_debito">Cartão de Débito</option>
                <option value="cheque">Cheque</option>
                <option value="boleto">Boleto</option>
                <option value="acerto">Acerto</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── Error ── */}
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

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-red-50 to-rose-50 border-red-200 modern-shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-red-600 modern-shadow-lg flex-shrink-0">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-red-900 text-sm">Total Dívidas</h3>
              <p className="text-xl font-black text-red-700">
                R$ {totals.totalDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-red-600 font-semibold">{totals.totalCount} dívida(s)</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 modern-shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-green-600 modern-shadow-lg flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-green-900 text-sm">Valor Pago</h3>
              <p className="text-xl font-black text-green-700">
                R$ {totals.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-green-600 font-semibold">{totals.paidCount} paga(s)</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 modern-shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-orange-600 modern-shadow-lg flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-orange-900 text-sm">Vencidas</h3>
              <p className="text-xl font-black text-orange-700">{totals.vencidoCount}</p>
              <p className="text-xs text-orange-600 font-semibold">dívida(s) vencida(s)</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200 modern-shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-yellow-600 modern-shadow-lg flex-shrink-0">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-yellow-900 text-sm">A Pagar</h3>
              <p className="text-xl font-black text-yellow-700">
                R$ {totals.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-yellow-600 font-semibold">{totals.pendingCount + totals.partialCount} pendente(s)</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Debts List ── */}
      <div className="space-y-6">
        {deduplicatedDebts.length > 0 ? deduplicatedDebts.map(debt => {
          if (!debt.id || !UUIDManager.isValidUUID(debt.id)) return null;
          const status = getDebtStatus(debt);
          const installments = getDebtInstallments(debt.id);
          const isExpanded = expandedDebts.has(debt.id);

          return (
            <div key={debt.id} className="card modern-shadow-xl overflow-hidden">
              {/* Debt Header */}
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-red-600">
                    <CreditCard className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">{debt.company}</h3>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {dbDateToDisplay(debt.date)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-red-600">
                    R$ {debt.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <DebtStatusBadge status={status} />
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <h4 className="font-bold text-slate-900 mb-2">Descrição</h4>
                <div className="p-4 bg-slate-50 rounded-xl border">
                  <p className="text-slate-700">{debt.description}</p>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="mb-6">
                <h4 className="font-bold text-slate-900 mb-4">Métodos de Pagamento</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(debt.paymentMethods || []).map((method, index) => (
                    <div key={index} className="p-4 bg-gradient-to-r from-red-50 to-rose-50 rounded-xl border border-red-200">
                      <div className="flex justify-between items-center mb-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          method.type === 'dinheiro'       ? 'bg-green-100 text-green-800 border-green-200' :
                          method.type === 'pix'            ? 'bg-blue-100 text-blue-800 border-blue-200' :
                          method.type === 'cartao_credito' ? 'bg-sky-100 text-sky-800 border-sky-200' :
                          method.type === 'cartao_debito'  ? 'bg-cyan-100 text-cyan-800 border-cyan-200' :
                          method.type === 'cheque'         ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                          method.type === 'boleto'         ? 'bg-cyan-100 text-cyan-800 border-cyan-200' :
                          'bg-slate-100 text-slate-800 border-slate-200'
                        }`}>
                          {method.type.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="text-xl font-black text-red-600">
                          R$ {method.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {method.selectedChecks && method.selectedChecks.length > 0 && (
                        <div className="mb-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                          <p className="text-xs font-semibold text-yellow-800 mb-2">
                            Cheques Utilizados ({method.selectedChecks.length}):
                          </p>
                          <div className="space-y-1">
                            {method.selectedChecks.map(checkId => {
                              const c = checks.find(x => x.id === checkId);
                              if (!c) return null;
                              return (
                                <div key={checkId} className="text-xs text-yellow-700 flex justify-between">
                                  <span>{c.client}</span>
                                  <span className="font-bold">R$ {c.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {method.installments && method.installments > 1 && (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-red-700">Parcelas:</span>
                            <span className="font-bold text-red-800">
                              {method.installments}x de R$ {method.installmentValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          {method.installmentInterval && (
                            <div className="flex justify-between">
                              <span className="text-red-700">Intervalo:</span>
                              <span className="font-bold text-red-800">{method.installmentInterval} dias</span>
                            </div>
                          )}
                          {method.firstInstallmentDate && (
                            <div className="flex justify-between">
                              <span className="text-red-700">Primeira parcela:</span>
                              <span className="font-bold text-red-800">{dbDateToDisplay(method.firstInstallmentDate)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Installments Section */}
              {installments.length > 0 && (
                <div className="mb-6 border border-slate-200 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => toggleDebt(debt.id)}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-slate-600" />
                      <span className="font-bold text-slate-900">
                        Parcelas ({installments.filter(i => i.status === 'compensado').length}/{installments.length} pagas)
                      </span>
                      {installments.some(i => i.status !== 'compensado' && i.dueDate < today) && (
                        <span className="flex items-center gap-1 text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" /> Com vencidas
                        </span>
                      )}
                    </div>
                    {isExpanded
                      ? <ChevronDown className="w-5 h-5 text-slate-500 flex-shrink-0" />
                      : <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
                    }
                  </button>

                  {isExpanded && (
                    <div className="divide-y divide-slate-100">
                      {installments.map(inst => {
                        const isPaid = inst.status === 'compensado';
                        const isOverdue = !isPaid && inst.dueDate < today;
                        const isProcessing = processingIds.has(inst.id);

                        return (
                          <div
                            key={inst.id}
                            className={`flex items-center justify-between px-4 py-3 ${
                              isPaid    ? 'bg-green-50/40' :
                              isOverdue ? 'bg-orange-50/60' :
                              'bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                isPaid    ? 'bg-green-100 text-green-700' :
                                isOverdue ? 'bg-orange-100 text-orange-700' :
                                            'bg-slate-100 text-slate-600'
                              }`}>
                                {inst.installmentNumber}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">
                                  {inst.type === 'check' ? 'Cheque' : 'Boleto'}{' '}
                                  {inst.installmentNumber}/{inst.totalInstallments}
                                </p>
                                <p className={`text-xs ${isOverdue ? 'text-orange-600 font-semibold' : 'text-slate-500'}`}>
                                  Vencimento: {dbDateToDisplay(inst.dueDate)}
                                  {isOverdue && ' · Vencido'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className={`font-bold text-sm ${isPaid ? 'text-green-700' : 'text-slate-800'}`}>
                                R$ {inst.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              {isPaid ? (
                                <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-3 py-1 rounded-full">
                                  <CheckCircle className="w-3 h-3" /> Pago
                                </span>
                              ) : (
                                <button
                                  disabled={isProcessing}
                                  onClick={() => setConfirmInstallment(inst)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                    isOverdue
                                      ? 'bg-orange-600 hover:bg-orange-700 text-white'
                                      : 'bg-green-600 hover:bg-green-700 text-white'
                                  }`}
                                >
                                  {isProcessing ? 'Processando...' : 'Marcar como Pago'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Financial Summary */}
              <div className="mb-6">
                <h4 className="font-bold text-slate-900 mb-4">Resumo Financeiro</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-red-50 rounded-xl border border-red-200">
                    <p className="text-red-600 font-semibold text-sm">Total</p>
                    <p className="text-xl font-black text-red-700">
                      R$ {debt.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-xl border border-green-200">
                    <p className="text-green-600 font-semibold text-sm">Pago</p>
                    <p className="text-xl font-black text-green-700">
                      R$ {debt.paidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-xl border border-orange-200">
                    <p className="text-orange-600 font-semibold text-sm">Pendente</p>
                    <p className="text-xl font-black text-orange-700">
                      R$ {debt.pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Observations */}
              {debt.paymentDescription && (
                <div className="mb-6">
                  <h4 className="font-bold text-slate-900 mb-2">Observações do Pagamento</h4>
                  <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                    <p className="text-red-700">{debt.paymentDescription}</p>
                  </div>
                </div>
              )}
              {debt.debtPaymentDescription && (
                <div className="mb-6">
                  <h4 className="font-bold text-slate-900 mb-2">Descrição da Dívida</h4>
                  <div className="p-4 bg-slate-50 rounded-xl border">
                    <p className="text-slate-700">{debt.debtPaymentDescription}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  onClick={() => setViewingDebt(debt)}
                  className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-modern"
                  title="Visualizar Detalhes Completos"
                >
                  <Eye className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setEditingDebt(debt)}
                  className="text-emerald-600 hover:text-emerald-800 p-2 rounded-lg hover:bg-emerald-50 transition-modern"
                  title="Editar"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDeleteDebt(debt.id)}
                  className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-modern"
                  title="Excluir"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          );
        }) : (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 floating-animation">
              <CreditCard className="w-12 h-12 text-red-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-4">Nenhuma dívida registrada</h3>
            <p className="text-slate-600 mb-8 text-lg">Comece registrando sua primeira dívida para controlar os gastos.</p>
            <button onClick={() => setIsFormOpen(true)} className="btn-primary modern-shadow-xl">
              Registrar primeira dívida
            </button>
          </div>
        )}
      </div>

      {/* ── Debt Form Modal ── */}
      {(isFormOpen || editingDebt) && (
        <DebtForm
          debt={editingDebt}
          onSubmit={editingDebt ? handleEditDebt : handleAddDebt}
          onCancel={() => { setIsFormOpen(false); setEditingDebt(null); }}
        />
      )}

      {/* ── View Debt Modal ── */}
      {viewingDebt && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-6xl w-full max-h-[90vh] overflow-y-auto modern-shadow-xl">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 modern-shadow-xl">
                    <CreditCard className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900">Detalhes Completos da Dívida</h2>
                    <p className="text-slate-600">{viewingDebt.company}</p>
                  </div>
                </div>
                <button onClick={() => setViewingDebt(null)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                    <h4 className="font-bold text-red-900 mb-2">Informações Básicas</h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>Empresa:</strong> {viewingDebt.company}</p>
                      <p><strong>Data:</strong> {dbDateToDisplay(viewingDebt.date)}</p>
                      <p className="flex items-center gap-2"><strong>Status:</strong> <DebtStatusBadge status={getDebtStatus(viewingDebt)} /></p>
                    </div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                    <h4 className="font-bold text-red-900 mb-2">Valores</h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>Total:</strong> R$ {viewingDebt.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      <p><strong>Pago:</strong> <span className="text-green-600 font-bold">R$ {viewingDebt.paidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                      <p><strong>Pendente:</strong> <span className="text-orange-600 font-bold">R$ {viewingDebt.pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                    </div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                    <h4 className="font-bold text-red-900 mb-2">Sistema</h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>ID:</strong> <span className="font-mono text-xs">{viewingDebt.id}</span></p>
                      <p><strong>Criado:</strong> {new Date(viewingDebt.createdAt).toLocaleString('pt-BR')}</p>
                      {viewingDebt.updatedAt && (
                        <p><strong>Atualizado:</strong> {new Date(viewingDebt.updatedAt).toLocaleString('pt-BR')}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                  <h4 className="font-bold text-slate-900 mb-4">Descrição da Dívida</h4>
                  <p className="text-slate-700 text-lg">{viewingDebt.description}</p>
                </div>

                <div className="p-6 bg-red-50 rounded-2xl border border-red-200">
                  <h4 className="font-bold text-red-900 mb-4">Métodos de Pagamento Detalhados</h4>
                  <div className="space-y-4">
                    {(viewingDebt.paymentMethods || []).map((method, index) => (
                      <div key={index} className="p-4 bg-white rounded-xl border border-red-100 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-bold border ${
                            method.type === 'dinheiro'       ? 'bg-green-100 text-green-800 border-green-200' :
                            method.type === 'pix'            ? 'bg-blue-100 text-blue-800 border-blue-200' :
                            method.type === 'cartao_credito' ? 'bg-sky-100 text-sky-800 border-sky-200' :
                            method.type === 'cartao_debito'  ? 'bg-cyan-100 text-cyan-800 border-cyan-200' :
                            method.type === 'cheque'         ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                            method.type === 'boleto'         ? 'bg-cyan-100 text-cyan-800 border-cyan-200' :
                            'bg-slate-100 text-slate-800 border-slate-200'
                          }`}>
                            {method.type.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className="text-2xl font-black text-red-600">
                            R$ {method.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        {method.installments && method.installments > 1 && (
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p><strong className="text-red-800">Parcelas:</strong> {method.installments}x</p>
                              <p><strong className="text-red-800">Valor por parcela:</strong> R$ {method.installmentValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div>
                              <p><strong className="text-red-800">Intervalo:</strong> {method.installmentInterval} dias</p>
                              {method.firstInstallmentDate && (
                                <p><strong className="text-red-800">Primeira parcela:</strong> {dbDateToDisplay(method.firstInstallmentDate)}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {(viewingDebt.paymentDescription || viewingDebt.debtPaymentDescription) && (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                    <h4 className="font-bold text-slate-900 mb-4">Observações</h4>
                    <div className="space-y-4">
                      {viewingDebt.paymentDescription && (
                        <div>
                          <h5 className="font-bold text-slate-800 mb-2">Descrição do Pagamento:</h5>
                          <p className="text-slate-700 p-3 bg-white rounded-lg border">{viewingDebt.paymentDescription}</p>
                        </div>
                      )}
                      {viewingDebt.debtPaymentDescription && (
                        <div>
                          <h5 className="font-bold text-slate-800 mb-2">Descrição da Dívida:</h5>
                          <p className="text-slate-700 p-3 bg-white rounded-lg border">{viewingDebt.debtPaymentDescription}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-8">
                <button onClick={() => setViewingDebt(null)} className="btn-secondary">Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Payment Modal ── */}
      {confirmInstallment && (
        <ConfirmPayModal
          installment={confirmInstallment}
          onConfirm={handleConfirmPayment}
          onCancel={() => setConfirmInstallment(null)}
          isProcessing={processingIds.has(confirmInstallment.id)}
        />
      )}
    </div>
  );
}
