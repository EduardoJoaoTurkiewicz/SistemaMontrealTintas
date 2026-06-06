import React, { useState, useMemo, useRef } from 'react';
import {
  FileText, Download, Calendar, DollarSign, TrendingUp, TrendingDown,
  BarChart3, Activity, Receipt, CreditCard, CheckCircle, AlertCircle,
  ArrowUpCircle, ArrowDownCircle, Clock, Users, ChevronDown, Filter
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart as RechartsPieChart,
  Pie, Cell, AreaChart, Area, ComposedChart
} from 'recharts';
import { useAppContext } from '../context/AppContext';
import { formatDateBR, getCurrentDateISO } from '../lib/dateOnly';
import { safeNumber } from '../utils/numberUtils';

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#8b5cf6'];

const PM_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'PIX', cartao_credito: 'Crédito',
  cartao_debito: 'Débito', cheque: 'Cheque', boleto: 'Boleto',
  transferencia: 'Transf.', acerto: 'Acerto', permuta: 'Permuta',
};

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getMonthStart(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
}

const SECTIONS = [
  { id: 'summary',      label: 'Resumo',       icon: DollarSign },
  { id: 'cashflow',     label: 'Fluxo de Caixa', icon: Activity },
  { id: 'sales',        label: 'Vendas',        icon: TrendingUp },
  { id: 'receivables',  label: 'A Receber',     icon: ArrowUpCircle },
  { id: 'payables',     label: 'A Pagar',       icon: ArrowDownCircle },
  { id: 'creditcard',   label: 'Cartão',        icon: CreditCard },
  { id: 'comparisons',  label: 'Comparativos',  icon: BarChart3 },
  { id: 'checks',       label: 'Cheques',       icon: FileText },
];

export default function Reports() {
  const {
    sales, debts, checks, boletos, cashTransactions, acertos,
    employees, employeePayments, pixFees, isLoading
  } = useAppContext();

  const reportRef = useRef<HTMLDivElement>(null);

  const [activeSection, setActiveSection] = useState('summary');
  const [filters, setFilters] = useState({
    startDate: getMonthStart(),
    endDate: getCurrentDateISO(),
    hasNotaFiscal: 'all' as 'all' | 'com' | 'sem',
  });

  // ── helpers ──────────────────────────────────────────────────────────────

  const inRange = (dateStr: string) =>
    dateStr >= filters.startDate && dateStr <= filters.endDate;

  const matchesNF = (hasNF: boolean | undefined) => {
    if (filters.hasNotaFiscal === 'all') return true;
    if (filters.hasNotaFiscal === 'com') return !!hasNF;
    return !hasNF;
  };

  // ── period data ──────────────────────────────────────────────────────────

  const periodSales  = useMemo(() => sales.filter(s => inRange(s.date) && matchesNF(s.hasNotaFiscal)), [sales, filters]);
  const periodDebts  = useMemo(() => debts.filter(d => inRange(d.date) && matchesNF(d.hasNotaFiscal)), [debts, filters]);
  const periodTxIn   = useMemo(() => cashTransactions.filter(t => inRange(t.date) && t.type === 'entrada'), [cashTransactions, filters]);
  const periodTxOut  = useMemo(() => cashTransactions.filter(t => inRange(t.date) && t.type === 'saida'), [cashTransactions, filters]);

  // ── SECTION 1: Financial Summary ─────────────────────────────────────────

  const summary = useMemo(() => {
    const revenue  = periodTxIn.reduce((s, t) => s + safeNumber(t.amount, 0), 0);
    const expenses = periodTxOut.reduce((s, t) => s + safeNumber(t.amount, 0), 0);
    const salesTotal = periodSales.reduce((s, sale) => s + safeNumber(sale.totalValue, 0), 0);
    const debtsTotal = periodDebts.reduce((s, d) => s + safeNumber(d.totalValue, 0), 0);
    const pendingReceivables = sales.reduce((s, sale) => s + safeNumber(sale.pendingAmount, 0), 0);
    const pendingPayables    = debts.filter(d => !d.isPaid).reduce((s, d) => s + safeNumber(d.pendingAmount, 0), 0);
    const pendingChecks      = checks.filter(c => !c.isOwnCheck && c.status === 'pendente' && !c.usedInDebt).reduce((s, c) => s + c.value, 0);
    const pendingBoletos     = boletos.filter(b => !b.isCompanyPayable && b.status === 'pendente').reduce((s, b) => s + b.value, 0);
    return { revenue, expenses, net: revenue - expenses, salesTotal, debtsTotal, pendingReceivables, pendingPayables, pendingChecks, pendingBoletos };
  }, [periodTxIn, periodTxOut, periodSales, periodDebts, sales, debts, checks, boletos]);

  // ── SECTION 2: Cash Flow ─────────────────────────────────────────────────

  const cashFlowData = useMemo(() => {
    const map = new Map<string, { date: string; entrada: number; saida: number }>();
    cashTransactions.filter(t => inRange(t.date)).forEach(t => {
      if (!map.has(t.date)) map.set(t.date, { date: t.date, entrada: 0, saida: 0 });
      const row = map.get(t.date)!;
      if (t.type === 'entrada') row.entrada += safeNumber(t.amount, 0);
      else row.saida += safeNumber(t.amount, 0);
    });
    return [...map.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({ ...r, label: formatDateBR(r.date), saldo: r.entrada - r.saida }));
  }, [cashTransactions, filters]);

  // ── SECTION 3: Sales Analysis ─────────────────────────────────────────────

  const salesByMethod = useMemo(() => {
    const map: Record<string, number> = {};
    periodSales.forEach(sale => {
      (sale.paymentMethods || []).forEach((m: any) => {
        const k = PM_LABELS[m.type] ?? m.type;
        map[k] = (map[k] ?? 0) + safeNumber(m.amount, 0);
      });
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [periodSales]);

  const salesByClient = useMemo(() => {
    const map: Record<string, number> = {};
    periodSales.forEach(sale => {
      map[sale.client] = (map[sale.client] ?? 0) + safeNumber(sale.totalValue, 0);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  }, [periodSales]);

  // ── SECTION 4: Receivables ────────────────────────────────────────────────

  const pendingAcertos = useMemo(() =>
    acertos.filter(a => a.type === 'cliente' && a.status !== 'pago' && safeNumber(a.pendingAmount, 0) > 0)
      .sort((a, b) => safeNumber(b.pendingAmount, 0) - safeNumber(a.pendingAmount, 0)),
    [acertos]);

  const overdueChecks = useMemo(() => {
    const today = getCurrentDateISO();
    return checks.filter(c => !c.isOwnCheck && c.status === 'pendente' && c.dueDate < today && !c.usedInDebt)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [checks]);

  const upcomingChecks = useMemo(() => {
    const today = getCurrentDateISO();
    return checks.filter(c => !c.isOwnCheck && c.status === 'pendente' && c.dueDate >= today && !c.usedInDebt)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 15);
  }, [checks]);

  // ── SECTION 5: Payables ───────────────────────────────────────────────────

  const pendingDebts = useMemo(() =>
    debts.filter(d => !d.isPaid && safeNumber(d.pendingAmount, 0) > 0.01)
      .sort((a, b) => safeNumber(b.pendingAmount, 0) - safeNumber(a.pendingAmount, 0)),
    [debts]);

  // ── SECTION 6: Credit Card ────────────────────────────────────────────────
  // Installments from cash_transactions with category recebimento_cartao or acerto_cliente

  // ── SECTION 7: Monthly Comparisons ───────────────────────────────────────

  const monthlyComparisons = useMemo(() => {
    const today = new Date();
    const result = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const start = `${y}-${m}-01`;
      const endD = new Date(y, d.getMonth() + 1, 0);
      const end = `${y}-${m}-${String(endD.getDate()).padStart(2, '0')}`;
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const revenue  = cashTransactions.filter(t => t.date >= start && t.date <= end && t.type === 'entrada').reduce((s, t) => s + safeNumber(t.amount, 0), 0);
      const expenses = cashTransactions.filter(t => t.date >= start && t.date <= end && t.type === 'saida').reduce((s, t) => s + safeNumber(t.amount, 0), 0);
      result.push({ label, revenue, expenses, profit: revenue - expenses });
    }
    return result;
  }, [cashTransactions]);

  // ── SECTION 8: Check Management ──────────────────────────────────────────

  const checkStats = useMemo(() => {
    const received = checks.filter(c => !c.isOwnCheck);
    const issued   = checks.filter(c => c.isOwnCheck || c.isCompanyPayable);
    const groupByStatus = (arr: typeof checks) => ({
      pendente:    arr.filter(c => c.status === 'pendente').reduce((s, c) => s + c.value, 0),
      compensado:  arr.filter(c => c.status === 'compensado').reduce((s, c) => s + c.value, 0),
      devolvido:   arr.filter(c => c.status === 'devolvido').reduce((s, c) => s + c.value, 0),
    });
    return {
      received: { list: received, ...groupByStatus(received) },
      issued:   { list: issued,   ...groupByStatus(issued) },
    };
  }, [checks]);

  // ── EXPORT ─────────────────────────────────────────────────────────────────

  const handleExportPDF = async () => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(reportRef.current!, { scale: 1.5, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const win = window.open('', '_blank');
      if (!win) { alert('Permita popups para exportar PDF.'); return; }
      win.document.write(`<html><head><title>Relatório</title><style>body{margin:0}img{max-width:100%}</style></head><body><img src="${imgData}" /></body></html>`);
      win.document.close();
      win.onload = () => { win.print(); };
    } catch { alert('Erro ao exportar PDF.'); }
  };

  const handleExportXLSX = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      // Sales sheet
      const salesData = periodSales.map(s => ({
        Data: formatDateBR(s.date), Cliente: s.client,
        Total: s.totalValue, Recebido: s.receivedAmount, Pendente: s.pendingAmount,
        Status: s.status,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesData), 'Vendas');
      // Transactions sheet
      const txData = cashTransactions.filter(t => inRange(t.date)).map(t => ({
        Data: formatDateBR(t.date), Tipo: t.type, Categoria: t.category,
        Descrição: t.description, Valor: t.amount,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txData), 'Caixa');
      XLSX.writeFile(wb, `relatorio-${filters.startDate}-${filters.endDate}.xlsx`);
    } catch { alert('Erro ao exportar Excel.'); }
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-12 h-12 bg-blue-600 rounded-full animate-pulse flex items-center justify-center mx-auto">
          <BarChart3 className="w-6 h-6 text-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 shadow-lg">
            <BarChart3 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
            <p className="text-slate-500 text-sm">Painel de inteligência financeira</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input type="date" value={filters.startDate}
              onChange={e => setFilters(p => ({ ...p, startDate: e.target.value }))}
              className="text-sm border-none outline-none bg-transparent w-32" />
            <span className="text-slate-400 text-sm">—</span>
            <input type="date" value={filters.endDate}
              onChange={e => setFilters(p => ({ ...p, endDate: e.target.value }))}
              className="text-sm border-none outline-none bg-transparent w-32" />
          </div>
          <select
            value={filters.hasNotaFiscal}
            onChange={e => setFilters(p => ({ ...p, hasNotaFiscal: e.target.value as 'all' | 'com' | 'sem' }))}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="all">Todas (NF)</option>
            <option value="com">Com Nota Fiscal</option>
            <option value="sem">Sem Nota Fiscal</option>
          </select>
          <button onClick={handleExportXLSX}
            className="btn-secondary flex items-center gap-2 text-sm py-2">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={handleExportPDF}
            className="btn-secondary flex items-center gap-2 text-sm py-2">
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Section Nav */}
      <div className="flex gap-1 overflow-x-auto pb-1 modern-scrollbar">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
              activeSection === s.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'
            }`}>
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      <div ref={reportRef}>

        {/* ── SECTION 1: Summary ─────────────────────────────────────────── */}
        {activeSection === 'summary' && (
          <div className="space-y-6">
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Entradas no Período', value: summary.revenue, color: 'emerald', icon: ArrowUpCircle },
                { label: 'Saídas no Período',   value: summary.expenses, color: 'red', icon: ArrowDownCircle },
                { label: 'Resultado Líquido',   value: summary.net, color: summary.net >= 0 ? 'blue' : 'orange', icon: Activity },
                { label: 'A Receber (Total)',   value: summary.pendingReceivables, color: 'sky', icon: Clock },
              ].map(k => (
                <div key={k.label} className={`card bg-${k.color}-50 border-${k.color}-100 p-5`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl bg-${k.color}-600 shrink-0`}>
                      <k.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase">{k.label}</p>
                      <p className={`text-xl font-black text-${k.color}-700`}>{fmtBRL(k.value)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Vendas no Período',  value: summary.salesTotal,       sub: `${periodSales.length} vendas` },
                { label: 'Dívidas no Período', value: summary.debtsTotal,       sub: `${periodDebts.length} dívidas` },
                { label: 'Cheques Pendentes',  value: summary.pendingChecks,    sub: `${checks.filter(c => !c.isOwnCheck && c.status === 'pendente').length} cheques` },
                { label: 'Boletos Pendentes',  value: summary.pendingBoletos,   sub: `${boletos.filter(b => b.status === 'pendente').length} boletos` },
              ].map(k => (
                <div key={k.label} className="card p-5 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{k.label}</p>
                  <p className="text-lg font-black text-slate-800">{fmtBRL(k.value)}</p>
                  <p className="text-xs text-slate-500 mt-1">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Top clients table */}
            <div className="card">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" /> Top Clientes no Período
              </h3>
              <div className="space-y-2">
                {salesByClient.slice(0, 8).map((c, i) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="w-5 text-xs text-slate-400 font-bold">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-slate-700 truncate">{c.name}</span>
                        <span className="font-bold text-slate-800 shrink-0 ml-2">{fmtBRL(c.value)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(c.value / salesByClient[0].value) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
                {salesByClient.length === 0 && <p className="text-slate-400 text-sm text-center py-4">Nenhuma venda no período.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 2: Cash Flow ──────────────────────────────────────── */}
        {activeSection === 'cashflow' && (
          <div className="space-y-6">
            <div className="card">
              <h3 className="font-bold text-slate-800 mb-4">Fluxo de Caixa Diário</h3>
              {cashFlowData.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">Nenhuma transação no período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={cashFlowData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmtBRL(v)} />
                    <Legend />
                    <Bar dataKey="entrada" name="Entradas" fill="#10b981" radius={[3,3,0,0]} />
                    <Bar dataKey="saida"   name="Saídas"   fill="#ef4444" radius={[3,3,0,0]} />
                    <Line dataKey="saldo" name="Saldo" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Transaction breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card">
                <h4 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                  <ArrowUpCircle className="w-4 h-4" /> Entradas por Categoria
                </h4>
                <div className="space-y-2">
                  {Object.entries(
                    periodTxIn.reduce((acc, t) => {
                      acc[t.category] = (acc[t.category] ?? 0) + t.amount;
                      return acc;
                    }, {} as Record<string, number>)
                  ).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                    <div key={cat} className="flex justify-between text-sm">
                      <span className="text-slate-600">{cat}</span>
                      <span className="font-semibold text-emerald-700">{fmtBRL(val)}</span>
                    </div>
                  ))}
                  {periodTxIn.length === 0 && <p className="text-slate-400 text-sm">Nenhuma entrada.</p>}
                </div>
              </div>

              <div className="card">
                <h4 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4" /> Saídas por Categoria
                </h4>
                <div className="space-y-2">
                  {Object.entries(
                    periodTxOut.reduce((acc, t) => {
                      acc[t.category] = (acc[t.category] ?? 0) + t.amount;
                      return acc;
                    }, {} as Record<string, number>)
                  ).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                    <div key={cat} className="flex justify-between text-sm">
                      <span className="text-slate-600">{cat}</span>
                      <span className="font-semibold text-red-700">{fmtBRL(val)}</span>
                    </div>
                  ))}
                  {periodTxOut.length === 0 && <p className="text-slate-400 text-sm">Nenhuma saída.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 3: Sales Analysis ─────────────────────────────────── */}
        {activeSection === 'sales' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="font-bold text-slate-800 mb-4">Vendas por Método de Pagamento</h3>
                {salesByMethod.length === 0
                  ? <p className="text-slate-400 text-sm text-center py-8">Nenhuma venda no período.</p>
                  : (
                    <ResponsiveContainer width="100%" height={260}>
                      <RechartsPieChart>
                        <Pie data={salesByMethod} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {salesByMethod.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmtBRL(v)} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  )
                }
              </div>
              <div className="card">
                <h3 className="font-bold text-slate-800 mb-4">Top Clientes</h3>
                {salesByClient.length === 0
                  ? <p className="text-slate-400 text-sm text-center py-8">Nenhuma venda no período.</p>
                  : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={salesByClient} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                        <Tooltip formatter={(v: number) => fmtBRL(v)} />
                        <Bar dataKey="value" name="Valor" fill="#3b82f6" radius={[0,3,3,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                }
              </div>
            </div>

            {/* Sales table */}
            <div className="card overflow-hidden">
              <h3 className="font-bold text-slate-800 mb-4">Vendas no Período ({periodSales.length})</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-2 text-left font-semibold text-slate-600">Data</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-600">Cliente</th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-600">Total</th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-600">Recebido</th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-600">Pendente</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodSales.slice(0, 50).map(s => (
                      <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-700">{formatDateBR(s.date)}</td>
                        <td className="px-4 py-2 font-medium text-slate-800">{s.client}</td>
                        <td className="px-4 py-2 text-right font-semibold text-slate-800">{fmtBRL(s.totalValue)}</td>
                        <td className="px-4 py-2 text-right text-emerald-700">{fmtBRL(s.receivedAmount)}</td>
                        <td className="px-4 py-2 text-right text-red-600">{fmtBRL(s.pendingAmount)}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            s.status === 'pago' ? 'bg-emerald-100 text-emerald-800' :
                            s.status === 'parcial' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>{s.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {periodSales.length === 0 && <p className="text-slate-400 text-sm text-center py-8">Nenhuma venda no período.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 4: Receivables ────────────────────────────────────── */}
        {activeSection === 'receivables' && (
          <div className="space-y-6">
            {/* Pending acertos */}
            <div className="card">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Acertos Pendentes ({pendingAcertos.length})
                <span className="ml-auto font-black text-amber-700">{fmtBRL(pendingAcertos.reduce((s, a) => s + a.pendingAmount, 0))}</span>
              </h3>
              <div className="space-y-2">
                {pendingAcertos.map(a => (
                  <div key={a.id} className="flex justify-between items-center p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <div>
                      <p className="font-semibold text-slate-800">{a.clientName}</p>
                      <p className="text-xs text-slate-500">Total: {fmtBRL(a.totalAmount)} • Pago: {fmtBRL(a.paidAmount)}</p>
                    </div>
                    <p className="font-black text-amber-700">{fmtBRL(a.pendingAmount)}</p>
                  </div>
                ))}
                {pendingAcertos.length === 0 && <p className="text-slate-400 text-sm text-center py-4">Nenhum acerto pendente.</p>}
              </div>
            </div>

            {/* Overdue checks */}
            {overdueChecks.length > 0 && (
              <div className="card border border-red-200">
                <h3 className="font-bold text-red-800 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Cheques Vencidos ({overdueChecks.length})
                  <span className="ml-auto font-black text-red-700">{fmtBRL(overdueChecks.reduce((s, c) => s + c.value, 0))}</span>
                </h3>
                <div className="space-y-2">
                  {overdueChecks.map(c => (
                    <div key={c.id} className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100">
                      <div>
                        <p className="font-semibold text-slate-800">{c.client}</p>
                        <p className="text-xs text-red-600">Venceu: {formatDateBR(c.dueDate)}</p>
                      </div>
                      <p className="font-black text-red-700">{fmtBRL(c.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming checks */}
            <div className="card">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-500" />
                Próximos Cheques a Receber ({upcomingChecks.length})
                <span className="ml-auto font-black text-blue-700">{fmtBRL(upcomingChecks.reduce((s, c) => s + c.value, 0))}</span>
              </h3>
              <div className="space-y-2">
                {upcomingChecks.map(c => (
                  <div key={c.id} className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <div>
                      <p className="font-semibold text-slate-800">{c.client}</p>
                      <p className="text-xs text-slate-500">Vence: {formatDateBR(c.dueDate)}</p>
                    </div>
                    <p className="font-black text-blue-700">{fmtBRL(c.value)}</p>
                  </div>
                ))}
                {upcomingChecks.length === 0 && <p className="text-slate-400 text-sm text-center py-4">Nenhum cheque a receber.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 5: Payables ───────────────────────────────────────── */}
        {activeSection === 'payables' && (
          <div className="space-y-6">
            <div className="card">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-red-500" />
                Dívidas Pendentes ({pendingDebts.length})
                <span className="ml-auto font-black text-red-700">
                  {fmtBRL(pendingDebts.reduce((s, d) => s + safeNumber(d.pendingAmount, 0), 0))}
                </span>
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-2 text-left font-semibold text-slate-600">Empresa</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-600">Descrição</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-600">Data</th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-600">Total</th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-600">Pendente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingDebts.map(d => (
                      <tr key={d.id} className="border-b border-slate-100 hover:bg-red-50">
                        <td className="px-4 py-2 font-medium text-slate-800">{d.company}</td>
                        <td className="px-4 py-2 text-slate-600 max-w-xs truncate">{d.description}</td>
                        <td className="px-4 py-2 text-slate-600">{formatDateBR(d.date)}</td>
                        <td className="px-4 py-2 text-right text-slate-700">{fmtBRL(d.totalValue)}</td>
                        <td className="px-4 py-2 text-right font-bold text-red-700">{fmtBRL(safeNumber(d.pendingAmount, 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pendingDebts.length === 0 && <p className="text-slate-400 text-sm text-center py-8">Nenhuma dívida pendente.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 6: Credit Card ────────────────────────────────────── */}
        {activeSection === 'creditcard' && (
          <div className="space-y-6">
            <div className="card">
              <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-sky-500" /> Transações de Cartão de Crédito
              </h3>
              <p className="text-slate-500 text-sm mb-4">Recebimentos de cartão registrados no caixa no período.</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-2 text-left font-semibold text-slate-600">Data</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-600">Descrição</th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-600">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashTransactions.filter(t =>
                      inRange(t.date) && t.category === 'recebimento_cartao'
                    ).sort((a, b) => b.date.localeCompare(a.date)).map(t => (
                      <tr key={t.id} className="border-b border-slate-100 hover:bg-sky-50">
                        <td className="px-4 py-2 text-slate-700">{formatDateBR(t.date)}</td>
                        <td className="px-4 py-2 text-slate-600">{t.description}</td>
                        <td className="px-4 py-2 text-right font-bold text-sky-700">{fmtBRL(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {cashTransactions.filter(t => inRange(t.date) && t.category === 'recebimento_cartao').length === 0 &&
                  <p className="text-slate-400 text-sm text-center py-8">Nenhum recebimento de cartão no período.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 7: Comparisons ────────────────────────────────────── */}
        {activeSection === 'comparisons' && (
          <div className="space-y-6">
            <div className="card">
              <h3 className="font-bold text-slate-800 mb-4">Evolução Mensal (12 meses)</h3>
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={monthlyComparisons}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                  <Legend />
                  <Bar dataKey="revenue"  name="Entradas"  fill="#10b981" radius={[3,3,0,0]} />
                  <Bar dataKey="expenses" name="Saídas"    fill="#ef4444" radius={[3,3,0,0]} />
                  <Line dataKey="profit"  name="Resultado" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="card overflow-hidden">
              <h3 className="font-bold text-slate-800 mb-4">Tabela Mensal Detalhada</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-2 text-left font-semibold text-slate-600">Mês</th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-600">Entradas</th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-600">Saídas</th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-600">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyComparisons.map(row => (
                      <tr key={row.label} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-700">{row.label}</td>
                        <td className="px-4 py-2 text-right text-emerald-700">{fmtBRL(row.revenue)}</td>
                        <td className="px-4 py-2 text-right text-red-600">{fmtBRL(row.expenses)}</td>
                        <td className={`px-4 py-2 text-right font-bold ${row.profit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                          {fmtBRL(row.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 8: Check Management ───────────────────────────────── */}
        {activeSection === 'checks' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Received checks */}
            <div className="card">
              <h3 className="font-bold text-emerald-800 mb-4 flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4" />
                Cheques Recebidos ({checkStats.received.list.length})
              </h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Pendente', value: checkStats.received.pendente, color: 'yellow' },
                  { label: 'Compensado', value: checkStats.received.compensado, color: 'emerald' },
                  { label: 'Devolvido', value: checkStats.received.devolvido, color: 'red' },
                ].map(s => (
                  <div key={s.label} className={`p-3 bg-${s.color}-50 rounded-xl text-center`}>
                    <p className={`text-xs font-semibold text-${s.color}-700`}>{s.label}</p>
                    <p className={`font-black text-${s.color}-800 text-sm`}>{fmtBRL(s.value)}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1 max-h-80 overflow-y-auto modern-scrollbar">
                {checkStats.received.list.slice(0, 30).map(c => (
                  <div key={c.id} className="flex justify-between text-sm p-2 hover:bg-slate-50 rounded">
                    <div>
                      <p className="font-medium text-slate-800">{c.client}</p>
                      <p className="text-xs text-slate-500">Vence: {formatDateBR(c.dueDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-800">{fmtBRL(c.value)}</p>
                      <span className={`text-xs ${c.status === 'compensado' ? 'text-emerald-600' : c.status === 'devolvido' ? 'text-red-500' : 'text-yellow-600'}`}>
                        {c.status}
                      </span>
                    </div>
                  </div>
                ))}
                {checkStats.received.list.length === 0 && <p className="text-slate-400 text-sm text-center py-4">Nenhum cheque recebido.</p>}
              </div>
            </div>

            {/* Issued checks */}
            <div className="card">
              <h3 className="font-bold text-red-800 mb-4 flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4" />
                Cheques Emitidos ({checkStats.issued.list.length})
              </h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Pendente', value: checkStats.issued.pendente, color: 'yellow' },
                  { label: 'Compensado', value: checkStats.issued.compensado, color: 'emerald' },
                  { label: 'Devolvido', value: checkStats.issued.devolvido, color: 'red' },
                ].map(s => (
                  <div key={s.label} className={`p-3 bg-${s.color}-50 rounded-xl text-center`}>
                    <p className={`text-xs font-semibold text-${s.color}-700`}>{s.label}</p>
                    <p className={`font-black text-${s.color}-800 text-sm`}>{fmtBRL(s.value)}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1 max-h-80 overflow-y-auto modern-scrollbar">
                {checkStats.issued.list.slice(0, 30).map(c => (
                  <div key={c.id} className="flex justify-between text-sm p-2 hover:bg-slate-50 rounded">
                    <div>
                      <p className="font-medium text-slate-800">{c.companyName ?? c.client}</p>
                      <p className="text-xs text-slate-500">Vence: {formatDateBR(c.dueDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-800">{fmtBRL(c.value)}</p>
                      <span className={`text-xs ${c.status === 'compensado' ? 'text-emerald-600' : c.status === 'devolvido' ? 'text-red-500' : 'text-yellow-600'}`}>
                        {c.status}
                      </span>
                    </div>
                  </div>
                ))}
                {checkStats.issued.list.length === 0 && <p className="text-slate-400 text-sm text-center py-4">Nenhum cheque emitido.</p>}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
