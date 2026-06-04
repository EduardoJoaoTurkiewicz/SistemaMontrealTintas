import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorHandler } from '../lib/errorHandler';
import { safeNumber, safeCurrency } from '../utils/numberUtils';
import { formatDateBR, fromISODateOnly, getCurrentDateISO } from '../lib/dateOnly';
import {
  DollarSign, TrendingUp, TrendingDown, Calendar, ArrowUpCircle, ArrowDownCircle,
  Activity, Wallet, Plus, RefreshCw, Filter, Search, Download, FileText,
  Eye, CreditCard as Edit, Trash2, X, AlertCircle, CreditCard, Receipt,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { CashTransactionForm } from './forms/CashTransactionForm';

const CATEGORY_LABELS: Record<string, string> = {
  venda: 'Venda', divida: 'Dívida', salario: 'Salário', adiantamento: 'Adiantamento',
  comissao: 'Comissão', cheque: 'Cheque', boleto: 'Boleto', recebimento_cartao: 'Cartão',
  acerto_cliente: 'Acerto', outro: 'Outro',
};

const CATEGORY_COLORS: Record<string, string> = {
  venda: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  divida: 'bg-red-100 text-red-800 border-red-200',
  salario: 'bg-blue-100 text-blue-800 border-blue-200',
  adiantamento: 'bg-orange-100 text-orange-800 border-orange-200',
  comissao: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  cheque: 'bg-teal-100 text-teal-800 border-teal-200',
  boleto: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  recebimento_cartao: 'bg-sky-100 text-sky-800 border-sky-200',
  acerto_cliente: 'bg-amber-100 text-amber-800 border-amber-200',
  outro: 'bg-slate-100 text-slate-800 border-slate-200',
};

const PM_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'PIX', cartao_credito: 'Crédito',
  cartao_debito: 'Débito', cheque: 'Cheque', boleto: 'Boleto',
  transferencia: 'Transf.', cartorio: 'Cartório',
};

function getStartOfMonth(): string {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export function CashManagement() {
  const {
    cashBalance, cashTransactions, sales, checks, boletos, debts,
    isLoading, error, initializeCashBalance, recalculateCashBalance,
    loadAllData, createCashTransaction, updateCashTransaction, deleteCashTransaction
  } = useAppContext();

  const [isInitializing, setIsInitializing] = useState(false);
  const [initialAmount, setInitialAmount] = useState(0);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [viewingTransaction, setViewingTransaction] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    startDate: getStartOfMonth(),
    endDate: getCurrentDateISO(),
    category: 'all',
    paymentMethod: 'all',
    type: 'all',
    searchTerm: '',
  });

  const filteredTransactions = useMemo(() => {
    return cashTransactions.filter(tx => {
      const d = tx.date;
      return (
        d >= filters.startDate && d <= filters.endDate &&
        (filters.category === 'all' || tx.category === filters.category) &&
        (filters.paymentMethod === 'all' || tx.paymentMethod === filters.paymentMethod) &&
        (filters.type === 'all' || tx.type === filters.type) &&
        (!filters.searchTerm || tx.description.toLowerCase().includes(filters.searchTerm.toLowerCase()))
      );
    }).sort((a, b) => fromISODateOnly(b.date).getTime() - fromISODateOnly(a.date).getTime());
  }, [cashTransactions, filters]);

  const periodTotals = useMemo(() => {
    const entrada = filteredTransactions.filter(t => t.type === 'entrada').reduce((s, t) => s + safeNumber(t.amount, 0), 0);
    const saida = filteredTransactions.filter(t => t.type === 'saida').reduce((s, t) => s + safeNumber(t.amount, 0), 0);
    return { entrada, saida, saldo: entrada - saida };
  }, [filteredTransactions]);

  const getRelatedInfo = (transaction: any) => {
    if (!transaction.relatedId) return null;
    const sale = sales.find(s => s.id === transaction.relatedId);
    if (sale) return { type: 'venda', icon: DollarSign, label: sale.client };
    const check = checks.find(c => c.id === transaction.relatedId);
    if (check) return { type: 'cheque', icon: FileText, label: check.client };
    const boleto = boletos.find(b => b.id === transaction.relatedId);
    if (boleto) return { type: 'boleto', icon: Receipt, label: boleto.client };
    const debt = debts.find(d => d.id === transaction.relatedId);
    if (debt) return { type: 'dívida', icon: CreditCard, label: debt.company };
    return null;
  };

  const handleInitializeCash = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = safeNumber(initialAmount, 0);
    if (v <= 0) { alert('O valor inicial deve ser maior que zero.'); return; }
    setIsInitializing(true);
    try {
      await initializeCashBalance(v);
      await loadAllData();
    } catch (err) {
      alert('Erro ao inicializar caixa: ' + ErrorHandler.handleSupabaseError(err));
    } finally { setIsInitializing(false); }
  };

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try { await recalculateCashBalance(); await loadAllData(); }
    catch (err) { alert('Erro ao recalcular: ' + ErrorHandler.handleSupabaseError(err)); }
    finally { setIsRecalculating(false); }
  };

  const handleTransactionSubmit = async (data: any) => {
    try {
      if (editingTransaction) {
        await updateCashTransaction({ ...data, id: editingTransaction.id, createdAt: editingTransaction.createdAt });
      } else {
        await createCashTransaction(data);
      }
      setShowTransactionForm(false);
      setEditingTransaction(null);
    } catch (err) { alert('Erro ao salvar: ' + ErrorHandler.handleSupabaseError(err)); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta transação?')) return;
    try { await deleteCashTransaction(id); }
    catch (err) { alert('Erro ao excluir: ' + ErrorHandler.handleSupabaseError(err)); }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-600 font-semibold">Carregando caixa...</p>
        </div>
      </div>
    );
  }

  if (!cashBalance) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 shadow-xl">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Gestão de Caixa</h1>
            <p className="text-slate-500">Controle completo do fluxo financeiro</p>
          </div>
        </div>
        <div className="card max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-green-600 to-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Inicializar Caixa</h2>
            <p className="text-slate-500">Informe o valor atual em caixa para começar.</p>
          </div>
          <form onSubmit={handleInitializeCash} className="space-y-6">
            <div>
              <label className="form-label">Valor Atual em Caixa *</label>
              <input type="number" step="0.01" min="0" value={initialAmount}
                onChange={e => setInitialAmount(safeNumber(e.target.value, 0))}
                className="input-field text-center text-2xl font-bold" placeholder="0,00" required />
            </div>
            <button type="submit" disabled={isInitializing} className="btn-primary w-full">
              {isInitializing ? 'Inicializando...' : 'Inicializar Caixa'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 shadow-lg">
            <Wallet className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Gestão de Caixa</h1>
            <p className="text-slate-500 text-sm">Controle completo do fluxo financeiro</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRecalculate} disabled={isRecalculating}
            className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`} />
            {isRecalculating ? 'Recalculando...' : 'Recalcular'}
          </button>
          <button onClick={() => setShowTransactionForm(true)}
            className="btn-primary flex items-center gap-2 text-sm shadow-lg">
            <Plus className="w-4 h-4" />
            Nova Transação
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Saldo Atual', icon: Wallet,
            value: safeCurrency(cashBalance.currentBalance),
            valueClass: cashBalance.currentBalance >= 0 ? 'text-emerald-700' : 'text-red-600',
            bg: 'from-emerald-50 to-green-50 border-emerald-200',
            iconBg: 'bg-emerald-600',
            sub: 'Saldo em tempo real',
          },
          {
            label: 'Entradas', icon: ArrowUpCircle,
            value: safeCurrency(periodTotals.entrada),
            valueClass: 'text-green-700',
            bg: 'from-green-50 to-emerald-50 border-green-200',
            iconBg: 'bg-green-600',
            sub: `${filteredTransactions.filter(t => t.type === 'entrada').length} transações`,
          },
          {
            label: 'Saídas', icon: ArrowDownCircle,
            value: safeCurrency(periodTotals.saida),
            valueClass: 'text-red-600',
            bg: 'from-red-50 to-red-100 border-red-200',
            iconBg: 'bg-red-600',
            sub: `${filteredTransactions.filter(t => t.type === 'saida').length} transações`,
          },
          {
            label: 'Saldo do Período', icon: Activity,
            value: safeCurrency(periodTotals.saldo),
            valueClass: periodTotals.saldo >= 0 ? 'text-blue-700' : 'text-red-600',
            bg: 'from-blue-50 to-sky-50 border-blue-200',
            iconBg: 'bg-blue-600',
            sub: cashBalance.initialDate ? `Desde ${formatDateBR(cashBalance.initialDate)}` : 'No período',
          },
        ].map(card => (
          <div key={card.label} className={`card bg-gradient-to-br ${card.bg} p-5`}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl ${card.iconBg} shrink-0`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{card.label}</p>
                <p className={`text-xl font-black truncate ${card.valueClass}`}>{card.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{card.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card">
        <button
          onClick={() => setShowFilters(v => !v)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-500" />
            <span className="font-semibold text-slate-700">Filtros</span>
            {(filters.category !== 'all' || filters.type !== 'all' || filters.paymentMethod !== 'all' || filters.searchTerm) && (
              <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-bold">Ativo</span>
            )}
          </div>
          {showFilters ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="form-label text-xs">Data Inicial</label>
                  <input type="date" value={filters.startDate}
                    onChange={e => setFilters(p => ({ ...p, startDate: e.target.value }))}
                    className="input-field text-sm" />
                </div>
                <div>
                  <label className="form-label text-xs">Data Final</label>
                  <input type="date" value={filters.endDate}
                    onChange={e => setFilters(p => ({ ...p, endDate: e.target.value }))}
                    className="input-field text-sm" />
                </div>
                <div>
                  <label className="form-label text-xs">Tipo</label>
                  <select value={filters.type} onChange={e => setFilters(p => ({ ...p, type: e.target.value }))}
                    className="input-field text-sm">
                    <option value="all">Todos</option>
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Categoria</label>
                  <select value={filters.category} onChange={e => setFilters(p => ({ ...p, category: e.target.value }))}
                    className="input-field text-sm">
                    <option value="all">Todas</option>
                    {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Pagamento</label>
                  <select value={filters.paymentMethod} onChange={e => setFilters(p => ({ ...p, paymentMethod: e.target.value }))}
                    className="input-field text-sm">
                    <option value="all">Todas</option>
                    {Object.entries(PM_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Buscar</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                    <input type="text" placeholder="Descrição..." value={filters.searchTerm}
                      onChange={e => setFilters(p => ({ ...p, searchTerm: e.target.value }))}
                      className="input-field text-sm pl-8" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Transactions List */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900">Transações</h3>
            <span className="text-xs text-slate-500 font-medium">
              {filteredTransactions.length} registro{filteredTransactions.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">Nenhuma transação encontrada</h3>
            <p className="text-slate-500 text-sm">Ajuste os filtros ou registre uma nova transação.</p>
          </div>
        ) : (
          <motion.div className="space-y-2" initial="hidden" animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.04 } }, hidden: {} }}>
            {filteredTransactions.map(tx => {
              const rel = getRelatedInfo(tx);
              const isIn = tx.type === 'entrada';
              return (
                <motion.div
                  key={tx.id}
                  variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150 hover:shadow-sm group ${
                    isIn
                      ? 'bg-emerald-50/60 border-emerald-100 hover:border-emerald-200'
                      : 'bg-red-50/60 border-red-100 hover:border-red-200'
                  }`}
                >
                  {/* Color bar */}
                  <div className={`w-1 self-stretch rounded-full shrink-0 ${isIn ? 'bg-emerald-500' : 'bg-red-500'}`} />

                  {/* Date */}
                  <div className="w-20 shrink-0">
                    <p className="text-xs font-bold text-slate-800">{formatDateBR(tx.date)}</p>
                    <p className={`text-xs font-semibold ${isIn ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isIn ? 'ENTRADA' : 'SAÍDA'}
                    </p>
                  </div>

                  {/* Description */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{tx.description}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${CATEGORY_COLORS[tx.category] ?? CATEGORY_COLORS.outro}`}>
                        {CATEGORY_LABELS[tx.category] ?? tx.category}
                      </span>
                      {tx.paymentMethod && (
                        <span className="text-xs text-slate-500">
                          {PM_LABELS[tx.paymentMethod] ?? tx.paymentMethod}
                        </span>
                      )}
                      {rel && (
                        <span className="text-xs text-blue-600 flex items-center gap-1">
                          <rel.icon className="w-3 h-3" />
                          {rel.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="shrink-0 text-right">
                    <p className={`text-base font-black ${isIn ? 'text-emerald-700' : 'text-red-600'}`}>
                      {isIn ? '+' : '−'}{safeCurrency(safeNumber(tx.amount, 0))}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setViewingTransaction(tx)}
                      className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-100 transition-colors" title="Ver">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setEditingTransaction(tx); setShowTransactionForm(true); }}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors" title="Editar">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(tx.id)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-100 transition-colors" title="Excluir">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Transaction Form Modal */}
      {showTransactionForm && (
        <CashTransactionForm
          transaction={editingTransaction}
          onSubmit={handleTransactionSubmit}
          onCancel={() => { setShowTransactionForm(false); setEditingTransaction(null); }}
        />
      )}

      {/* View Modal */}
      <AnimatePresence>
        {viewingTransaction && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
            onClick={() => setViewingTransaction(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className={`px-6 py-5 flex items-center justify-between ${
                viewingTransaction.type === 'entrada' ? 'bg-emerald-600' : 'bg-red-600'
              }`}>
                <div className="flex items-center gap-3">
                  {viewingTransaction.type === 'entrada'
                    ? <ArrowUpCircle className="w-6 h-6 text-white" />
                    : <ArrowDownCircle className="w-6 h-6 text-white" />
                  }
                  <div>
                    <p className="text-white font-bold">Detalhes da Transação</p>
                    <p className="text-white/80 text-sm">{formatDateBR(viewingTransaction.date)}</p>
                  </div>
                </div>
                <button onClick={() => setViewingTransaction(null)}
                  className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="text-center py-3">
                  <p className={`text-3xl font-black ${viewingTransaction.type === 'entrada' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {viewingTransaction.type === 'entrada' ? '+' : '−'}
                    {safeCurrency(safeNumber(viewingTransaction.amount, 0))}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs uppercase font-semibold mb-1">Categoria</p>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${CATEGORY_COLORS[viewingTransaction.category] ?? CATEGORY_COLORS.outro}`}>
                      {CATEGORY_LABELS[viewingTransaction.category] ?? viewingTransaction.category}
                    </span>
                  </div>
                  {viewingTransaction.paymentMethod && (
                    <div>
                      <p className="text-slate-500 text-xs uppercase font-semibold mb-1">Forma de Pagamento</p>
                      <p className="font-semibold text-slate-800">{PM_LABELS[viewingTransaction.paymentMethod] ?? viewingTransaction.paymentMethod}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-slate-500 text-xs uppercase font-semibold mb-1">Descrição</p>
                  <p className="text-slate-800 font-medium">{viewingTransaction.description}</p>
                </div>

                {getRelatedInfo(viewingTransaction) && (() => {
                  const rel = getRelatedInfo(viewingTransaction)!;
                  return (
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-3">
                      <rel.icon className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-xs text-blue-500 font-semibold uppercase">{rel.type}</p>
                        <p className="font-bold text-blue-900">{rel.label}</p>
                      </div>
                    </div>
                  );
                })()}

                <div className="pt-2">
                  <button onClick={() => setViewingTransaction(null)} className="btn-secondary w-full">Fechar</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
