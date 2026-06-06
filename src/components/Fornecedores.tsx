import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Filter, Building2, Phone, Mail, Globe, MapPin, Trash2, CreditCard as Edit2, Eye, X, ChevronDown, ChevronUp, TrendingUp, TrendingDown, DollarSign, AlertCircle, CheckCircle, Package, Star, BarChart2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { fornecedorService } from '../lib/fornecedorService';
import type { Fornecedor, Debt } from '../types';
import { formatDateBR } from '../lib/dateOnly';
import { safeNumber } from '../utils/numberUtils';

// ─── Form ─────────────────────────────────────────────────────────────────────

const EMPTY_FORM: Omit<Fornecedor, 'id' | 'createdAt' | 'updatedAt'> = {
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  inscricaoEstadual: '',
  telefone: '',
  whatsapp: '',
  email: '',
  site: '',
  endereco: '',
  cidade: '',
  estado: '',
  cep: '',
  observacoes: '',
  categoria: 'Outros',
  status: 'Ativo',
  classificacao: 'C',
};

const CATEGORIAS: Fornecedor['categoria'][] = [
  'Matéria-prima', 'Embalagens', 'Pigmentos', 'Resinas',
  'Equipamentos', 'Serviços', 'Logística', 'Outros',
];

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

interface FornecedorFormProps {
  initial?: Fornecedor | null;
  onSave: (f: Omit<Fornecedor, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onClose: () => void;
}

function FornecedorForm({ initial, onSave, onClose }: FornecedorFormProps) {
  const [form, setForm] = useState<Omit<Fornecedor, 'id' | 'createdAt' | 'updatedAt'>>(
    initial ? { ...EMPTY_FORM, ...initial } : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.razaoSocial.trim()) { toast.error('Razão Social é obrigatória'); return; }
    setSaving(true);
    try {
      await onSave(form);
      toast.success(initial ? 'Fornecedor atualizado!' : 'Fornecedor cadastrado!');
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao salvar fornecedor');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        value={(form[key] as string) ?? ''}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-slate-800">
            {initial ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Dados principais */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Dados Principais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {field('Razão Social *', 'razaoSocial', 'text', 'Nome da empresa')}
              {field('Nome Fantasia', 'nomeFantasia', 'text', 'Nome comercial')}
              {field('CNPJ', 'cnpj', 'text', '00.000.000/0000-00')}
              {field('Inscrição Estadual', 'inscricaoEstadual')}
            </div>
          </div>

          {/* Classificação */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Classificação</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Categoria</label>
                <select
                  value={form.categoria}
                  onChange={e => set('categoria', e.target.value as Fornecedor['categoria'])}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                >
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => set('status', e.target.value as Fornecedor['status'])}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                  <option value="Bloqueado">Bloqueado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Classificação (A/B/C)</label>
                <select
                  value={form.classificacao}
                  onChange={e => set('classificacao', e.target.value as Fornecedor['classificacao'])}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                >
                  <option value="A">A — Estratégico</option>
                  <option value="B">B — Importante</option>
                  <option value="C">C — Comum</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contato */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Contato</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {field('Telefone', 'telefone', 'tel', '(00) 0000-0000')}
              {field('WhatsApp', 'whatsapp', 'tel', '(00) 00000-0000')}
              {field('E-mail', 'email', 'email', 'email@empresa.com')}
              {field('Site', 'site', 'url', 'https://empresa.com')}
            </div>
          </div>

          {/* Endereço */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Endereço</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {field('Endereço (Rua, Nº)', 'endereco')}
              {field('Cidade', 'cidade')}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Estado</label>
                <select
                  value={form.estado ?? ''}
                  onChange={e => set('estado', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                >
                  <option value="">Selecione...</option>
                  {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {field('CEP', 'cep', 'text', '00000-000')}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Observações</label>
            <textarea
              value={form.observacoes ?? ''}
              onChange={e => set('observacoes', e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? 'Salvando...' : initial ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Supplier metrics computed from debts ────────────────────────────────────

function useSupplierMetrics(fornecedorId: string, debts: Debt[]) {
  return useMemo(() => {
    const fornecedorDebts = debts.filter(d => d.fornecedorId === fornecedorId);
    const totalComprado = fornecedorDebts.reduce((s, d) => s + safeNumber(d.totalValue, 0), 0);
    const totalPago = fornecedorDebts.reduce((s, d) => s + safeNumber(d.paidAmount, 0), 0);
    const totalPendente = fornecedorDebts.reduce((s, d) => s + safeNumber(d.pendingAmount, 0), 0);
    const comprasCount = fornecedorDebts.length;
    return { totalComprado, totalPago, totalPendente, comprasCount, debts: fornecedorDebts };
  }, [fornecedorId, debts]);
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

function FornecedorDetail({ fornecedor, debts, onClose, onEdit }: {
  fornecedor: Fornecedor;
  debts: Debt[];
  onClose: () => void;
  onEdit: () => void;
}) {
  const metrics = useSupplierMetrics(fornecedor.id, debts);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 240 }}
        className="w-full max-w-xl h-full bg-white shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-700 to-blue-900 text-white px-6 py-5 z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1">{fornecedor.categoria}</p>
              <h2 className="text-xl font-bold leading-tight">{fornecedor.razaoSocial}</h2>
              {fornecedor.nomeFantasia && <p className="text-blue-200 text-sm mt-0.5">{fornecedor.nomeFantasia}</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={onEdit} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              fornecedor.status === 'Ativo' ? 'bg-emerald-400/30 text-emerald-100' :
              fornecedor.status === 'Bloqueado' ? 'bg-red-400/30 text-red-100' :
              'bg-slate-400/30 text-slate-200'
            }`}>{fornecedor.status}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white">
              Classe {fornecedor.classificacao}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Métricas */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Comprado', value: fmt(metrics.totalComprado), icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
              { label: 'Total Pago', value: fmt(metrics.totalPago), icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Pendente', value: fmt(metrics.totalPendente), icon: Clock, color: 'text-orange-600 bg-orange-50' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mx-auto mb-2`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-xs text-slate-500 font-medium">{label}</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Contato */}
          {(fornecedor.telefone || fornecedor.email || fornecedor.site) && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Contato</h3>
              <div className="space-y-2">
                {fornecedor.telefone && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span>{fornecedor.telefone}</span>
                  </div>
                )}
                {fornecedor.email && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span>{fornecedor.email}</span>
                  </div>
                )}
                {fornecedor.site && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span>{fornecedor.site}</span>
                  </div>
                )}
                {(fornecedor.cidade || fornecedor.estado) && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span>{[fornecedor.cidade, fornecedor.estado].filter(Boolean).join(' — ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Histórico de compras */}
          {metrics.debts.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                Histórico de Compras ({metrics.debts.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {metrics.debts.map(d => (
                  <div key={d.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5 text-sm">
                    <div>
                      <p className="font-semibold text-slate-800">{d.description}</p>
                      <p className="text-xs text-slate-500">{formatDateBR(d.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-800">{fmt(safeNumber(d.totalValue, 0))}</p>
                      <span className={`text-xs font-semibold ${d.isPaid ? 'text-emerald-600' : 'text-orange-600'}`}>
                        {d.isPaid ? 'Pago' : `Pendente: ${fmt(safeNumber(d.pendingAmount, 0))}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observações */}
          {fornecedor.observacoes && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Observações</h3>
              <p className="text-sm text-slate-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
                {fornecedor.observacoes}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function Fornecedores() {
  const { debts } = useAppContext();

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [viewingFornecedor, setViewingFornecedor] = useState<Fornecedor | null>(null);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | Fornecedor['status']>('');
  const [filterCategoria, setFilterCategoria] = useState<'' | Fornecedor['categoria']>('');

  const load = async () => {
    try {
      setLoading(true);
      const data = await fornecedorService.getAll();
      setFornecedores(data);
    } catch (err: any) {
      toast.error('Erro ao carregar fornecedores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return fornecedores.filter(f => {
      const matchSearch = !search ||
        f.razaoSocial.toLowerCase().includes(search.toLowerCase()) ||
        (f.nomeFantasia ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (f.cnpj ?? '').includes(search) ||
        (f.cidade ?? '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = !filterStatus || f.status === filterStatus;
      const matchCat = !filterCategoria || f.categoria === filterCategoria;
      return matchSearch && matchStatus && matchCat;
    });
  }, [fornecedores, search, filterStatus, filterCategoria]);

  // Global summary using debts linked to any supplier
  const summary = useMemo(() => {
    const ativos = fornecedores.filter(f => f.status === 'Ativo').length;
    const linkedDebts = debts.filter(d => d.fornecedorId);
    const totalComprado = linkedDebts.reduce((s, d) => s + safeNumber(d.totalValue, 0), 0);
    const totalPendente = linkedDebts.reduce((s, d) => s + safeNumber(d.pendingAmount, 0), 0);
    return { total: fornecedores.length, ativos, totalComprado, totalPendente };
  }, [fornecedores, debts]);

  const handleSave = async (form: Omit<Fornecedor, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingFornecedor) {
      await fornecedorService.update(editingFornecedor.id, form);
    } else {
      await fornecedorService.create(form);
    }
    await load();
    setEditingFornecedor(null);
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este fornecedor? Esta ação não pode ser desfeita.')) return;
    try {
      await fornecedorService.delete(id);
      toast.success('Fornecedor excluído');
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao excluir');
    }
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const statusColor = (s: Fornecedor['status']) =>
    s === 'Ativo' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
    s === 'Bloqueado' ? 'bg-red-100 text-red-700 border-red-200' :
    'bg-slate-100 text-slate-600 border-slate-200';

  const classColor = (c: Fornecedor['classificacao']) =>
    c === 'A' ? 'bg-blue-100 text-blue-700' :
    c === 'B' ? 'bg-amber-100 text-amber-700' :
    'bg-slate-100 text-slate-600';

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: summary.total, sub: 'fornecedores', icon: Building2, color: 'from-blue-500 to-blue-700' },
          { label: 'Ativos', value: summary.ativos, sub: 'fornecedores ativos', icon: CheckCircle, color: 'from-emerald-500 to-emerald-700' },
          { label: 'Total Comprado', value: fmt(summary.totalComprado), sub: 'com fornecedor vinculado', icon: DollarSign, color: 'from-sky-500 to-sky-700' },
          { label: 'Em Aberto', value: fmt(summary.totalPendente), sub: 'a pagar', icon: AlertCircle, color: 'from-orange-500 to-orange-700' },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0 shadow`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 truncate">{label}</p>
              <p className="text-xl font-black text-slate-800 leading-tight">{value}</p>
              <p className="text-xs text-slate-400 truncate">{sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Header + search */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Fornecedores</h2>
          <button
            onClick={() => { setEditingFornecedor(null); setShowForm(true); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Novo Fornecedor
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, CNPJ, cidade..."
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as any)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">Todos os status</option>
            <option value="Ativo">Ativo</option>
            <option value="Inativo">Inativo</option>
            <option value="Bloqueado">Bloqueado</option>
          </select>
          <select
            value={filterCategoria}
            onChange={e => setFilterCategoria(e.target.value as any)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">Todas categorias</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm font-medium">
          Carregando fornecedores...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Building2 className="w-12 h-12 mb-4 opacity-30" />
          <p className="font-semibold">Nenhum fornecedor encontrado</p>
          <p className="text-sm mt-1">Cadastre o primeiro fornecedor clicando em "Novo Fornecedor"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((f, i) => {
              const debtMetrics = debts.filter(d => d.fornecedorId === f.id);
              const totalComprado = debtMetrics.reduce((s, d) => s + safeNumber(d.totalValue, 0), 0);
              const totalPendente = debtMetrics.reduce((s, d) => s + safeNumber(d.pendingAmount, 0), 0);

              return (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${statusColor(f.status)}`}>
                          {f.status}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${classColor(f.classificacao)}`}>
                          {f.classificacao}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">{f.categoria}</span>
                      </div>
                      <h3 className="font-bold text-slate-800 text-base leading-snug truncate">{f.razaoSocial}</h3>
                      {f.nomeFantasia && <p className="text-xs text-slate-500 truncate">{f.nomeFantasia}</p>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => setViewingFornecedor(f)}
                        className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setEditingFornecedor(f); setShowForm(true); }}
                        className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(f.id)}
                        className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Contact info */}
                  <div className="space-y-1 mb-3">
                    {f.telefone && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span>{f.telefone}</span>
                      </div>
                    )}
                    {f.email && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{f.email}</span>
                      </div>
                    )}
                    {(f.cidade || f.estado) && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span>{[f.cidade, f.estado].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {/* Financial summary */}
                  {debtMetrics.length > 0 && (
                    <div className="border-t border-slate-100 pt-3 mt-3 grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-slate-500">Total comprado</p>
                        <p className="text-sm font-bold text-slate-800">{fmt(totalComprado)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Pendente</p>
                        <p className={`text-sm font-bold ${totalPendente > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                          {fmt(totalPendente)}
                        </p>
                      </div>
                    </div>
                  )}

                  {debtMetrics.length === 0 && (
                    <p className="text-xs text-slate-400 italic">Nenhuma compra vinculada</p>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Form modal */}
      <AnimatePresence>
        {showForm && (
          <FornecedorForm
            initial={editingFornecedor}
            onSave={handleSave}
            onClose={() => { setShowForm(false); setEditingFornecedor(null); }}
          />
        )}
      </AnimatePresence>

      {/* Detail drawer */}
      <AnimatePresence>
        {viewingFornecedor && (
          <FornecedorDetail
            fornecedor={viewingFornecedor}
            debts={debts}
            onClose={() => setViewingFornecedor(null)}
            onEdit={() => { setEditingFornecedor(viewingFornecedor); setViewingFornecedor(null); setShowForm(true); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
