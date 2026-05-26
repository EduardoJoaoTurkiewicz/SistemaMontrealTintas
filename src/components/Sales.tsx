import React, { useState } from 'react';
import { Plus, CreditCard as Edit, Trash2, Eye, ShoppingCart, AlertCircle, X, DollarSign, Calendar, User, Package, TrendingUp, CheckCircle, Clock, Filter, Upload, FileDown } from 'lucide-react';
import { formatDateForDisplay } from '../utils/dateUtils';
import { useAppContext } from '../context/AppContext';
import { Sale, SaleItem } from '../types';
import { SaleForm } from './forms/SaleForm';
import { BulkSalesImportModal } from './forms/BulkSalesImportModal';
import { DeduplicationService } from '../lib/deduplicationService';
import { UUIDManager } from '../lib/uuidManager';
import { DebugPanel } from './DebugPanel';
import { TestSaleCreation } from './TestSaleCreation';
import { OfflineDataViewer } from './OfflineDataViewer';
import { getSaleItems, saveSaleItems, aplicarBaixaEstoque, reverterBaixaEstoque, aplicarDeltaEstoque } from '../lib/saleStockService';
import { gerarComprovantePDF } from '../utils/saleReceiptPdf';

export default function Sales() {
  const { sales, employees, permutas, isLoading, error, createSale, updateSale, deleteSale, estoqueProdutos, loadEstoqueData, orcamentoPrefill, setOrcamentoPrefill, marcarOrcamentoConvertido } = useAppContext();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [showOfflineViewer, setShowOfflineViewer] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    client: '',
    dateFrom: '',
    dateTo: '',
    minValue: '',
    maxValue: '',
    paymentMethod: ''
  });

  // Ensure sales data is deduplicated in the UI
  const deduplicatedSales = React.useMemo(() => {
    let filteredSales = DeduplicationService.removeDuplicatesById(sales || []);

    // Apply filters
    if (filters.client) {
      filteredSales = filteredSales.filter(sale =>
        sale.client.toLowerCase().includes(filters.client.toLowerCase())
      );
    }

    if (filters.dateFrom) {
      filteredSales = filteredSales.filter(sale =>
        sale.date >= filters.dateFrom
      );
    }

    if (filters.dateTo) {
      filteredSales = filteredSales.filter(sale =>
        sale.date <= filters.dateTo
      );
    }

    if (filters.minValue) {
      filteredSales = filteredSales.filter(sale =>
        sale.totalValue >= parseFloat(filters.minValue)
      );
    }

    if (filters.maxValue) {
      filteredSales = filteredSales.filter(sale =>
        sale.totalValue <= parseFloat(filters.maxValue)
      );
    }

    if (filters.paymentMethod) {
      filteredSales = filteredSales.filter(sale =>
        sale.paymentMethods?.some(method => method.type === filters.paymentMethod)
      );
    }

    return filteredSales;
  }, [sales, filters]);

  // Calculate totals
  const totals = React.useMemo(() => {
    const totalSales = deduplicatedSales.reduce((sum, sale) => sum + sale.totalValue, 0);
    const totalReceived = deduplicatedSales.reduce((sum, sale) => sum + sale.receivedAmount, 0);
    const totalPending = deduplicatedSales.reduce((sum, sale) => sum + sale.pendingAmount, 0);
    const paidSales = deduplicatedSales.filter(sale => sale.status === 'pago').length;
    const partialSales = deduplicatedSales.filter(sale => sale.status === 'parcial').length;
    const pendingSales = deduplicatedSales.filter(sale => sale.status === 'pendente').length;
    
    return {
      totalSales,
      totalReceived,
      totalPending,
      paidSales,
      partialSales,
      pendingSales,
      totalCount: deduplicatedSales.length
    };
  }, [deduplicatedSales]);

  React.useEffect(() => {
    if (orcamentoPrefill) {
      setIsFormOpen(true);
    }
  }, [orcamentoPrefill]);

  const handleAddSale = async (sale: Omit<Sale, 'id' | 'createdAt'>, saleItems: SaleItem[]) => {
    if (!sale.client || !sale.client.trim()) {
      alert('Por favor, informe o nome do cliente.');
      return;
    }
    if (sale.totalValue <= 0) {
      alert('O valor total da venda deve ser maior que zero.');
      return;
    }

    try {
      const saleId: string = await createSale(sale);
      setIsFormOpen(false);

      if (orcamentoPrefill) {
        await marcarOrcamentoConvertido(orcamentoPrefill.id, saleId);
        setOrcamentoPrefill(null);
      }

      if (saleItems.length > 0) {
        await saveSaleItems(saleId, saleItems);
        await aplicarBaixaEstoque(saleId, saleItems);
        await loadEstoqueData();
      }

      const hasInstallments = sale.paymentMethods?.some(method =>
        (method.type === 'cheque' || method.type === 'boleto') && method.installments > 1
      );
      if (hasInstallments) {
        setTimeout(() => {
          alert('Venda criada com sucesso!\n\nOs cheques e boletos foram criados automaticamente e já estão disponíveis nas respectivas abas.');
        }, 1000);
      }
    } catch (err: any) {
      let errorMessage = 'Erro ao criar venda';
      if (err?.message) {
        if (err.message.includes('duplicate key') || err.message.includes('unique constraint') || err.message.includes('já existe')) {
          errorMessage = 'Esta venda já existe no sistema. O sistema previne duplicatas automaticamente.';
        } else if (err.message.includes('constraint') || err.message.includes('violates')) {
          errorMessage = 'Dados inválidos ou duplicados. Verifique as informações inseridas.';
        } else if (err.message.includes('invalid input syntax')) {
          errorMessage = 'Formato de dados inválido. Verifique os valores inseridos.';
        } else if (err.message.includes('null value')) {
          errorMessage = 'Campos obrigatórios não preenchidos. Verifique todos os campos.';
        } else {
          errorMessage = err.message;
        }
      }
      alert('Erro ao criar venda: ' + errorMessage);
    }
  };

  const handleEditSale = async (sale: Omit<Sale, 'id' | 'createdAt'>, saleItems: SaleItem[]) => {
    if (!editingSale) return;
    try {
      const itensAntigos = await getSaleItems(editingSale.id);
      await updateSale({ ...sale, id: editingSale.id, createdAt: editingSale.createdAt });

      if (saleItems.length > 0 || itensAntigos.length > 0) {
        await saveSaleItems(editingSale.id, saleItems);
        const erros = await aplicarDeltaEstoque(editingSale.id, itensAntigos, saleItems, estoqueProdutos);
        if (erros.length > 0) {
          const msg = erros.map(e => `${e.nomeProduto} (${e.nomeVariacao}${e.nomeCor ? ' / ' + e.nomeCor : ''}): solicitado ${e.solicitado}, disponivel ${e.disponivel}`).join('\n');
          alert('Aviso: estoque insuficiente para alguns itens editados:\n' + msg);
        }
        await loadEstoqueData();
      }

      setEditingSale(null);
    } catch (err: any) {
      alert('Erro ao atualizar venda: ' + (err?.message ?? 'Erro desconhecido'));
    }
  };

  const handleDeleteSale = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita.')) return;
    try {
      const itens = await getSaleItems(id);
      await deleteSale(id);
      if (itens.length > 0) {
        await reverterBaixaEstoque(id, itens);
        await loadEstoqueData();
      }
    } catch (err: any) {
      alert('Erro ao excluir venda: ' + (err?.message ?? 'Erro desconhecido'));
    }
  };

  const handleDownloadPDF = async (sale: Sale) => {
    try {
      const items = await getSaleItems(sale.id);
      gerarComprovantePDF(sale, items.length > 0 ? items : undefined);
    } catch {
      gerarComprovantePDF(sale);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-600 font-semibold">Carregando vendas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 shadow-xl floating-animation">
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Gestão de Vendas</h1>
            <p className="text-slate-600 text-lg">Controle completo de vendas e recebimentos</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary flex items-center gap-2"
          >
            <Filter className="w-5 h-5" />
            Filtros
          </button>
          <button
            onClick={() => setShowDebugPanel(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <AlertCircle className="w-5 h-5" />
            Debug Logs
          </button>
          <button
            onClick={() => setShowTestPanel(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            Testes
          </button>
          <button
            onClick={() => setShowOfflineViewer(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Package className="w-5 h-5" />
            Dados Offline
          </button>
          <button
            onClick={() => setShowBulkImportModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Upload className="w-5 h-5" />
            Vendas em Massa
          </button>
          <button
            onClick={() => setIsFormOpen(true)}
            className="btn-primary flex items-center gap-2 modern-shadow-xl hover:modern-shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Nova Venda
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="card modern-shadow-xl bg-gradient-to-br from-green-50 to-emerald-50">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-900">Filtros de Vendas</h3>
            <button
              onClick={() => {
                setFilters({
                  client: '',
                  dateFrom: '',
                  dateTo: '',
                  minValue: '',
                  maxValue: '',
                  paymentMethod: ''
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
                value={filters.client}
                onChange={(e) => setFilters(prev => ({ ...prev, client: e.target.value }))}
                placeholder="Nome do cliente"
                className="input-field"
              />
            </div>
            <div>
              <label className="form-label">Data Início</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="form-label">Data Fim</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="form-label">Valor Mínimo</label>
              <input
                type="number"
                step="0.01"
                value={filters.minValue}
                onChange={(e) => setFilters(prev => ({ ...prev, minValue: e.target.value }))}
                placeholder="0,00"
                className="input-field"
              />
            </div>
            <div>
              <label className="form-label">Valor Máximo</label>
              <input
                type="number"
                step="0.01"
                value={filters.maxValue}
                onChange={(e) => setFilters(prev => ({ ...prev, maxValue: e.target.value }))}
                placeholder="0,00"
                className="input-field"
              />
            </div>
            <div>
              <label className="form-label">Método de Pagamento</label>
              <select
                value={filters.paymentMethod}
                onChange={(e) => setFilters(prev => ({ ...prev, paymentMethod: e.target.value }))}
                className="input-field"
              >
                <option value="">Todos</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="cartao_credito">Cartão de Crédito</option>
                <option value="cartao_debito">Cartão de Débito</option>
                <option value="cheque">Cheque</option>
                <option value="boleto">Boleto</option>
                <option value="acerto">Acerto</option>
                <option value="permuta">Permuta</option>
              </select>
            </div>
          </div>
        </div>
      )}

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 modern-shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-600 modern-shadow-lg">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-green-900 text-lg">Total em Vendas</h3>
              <p className="text-3xl font-black text-green-700">
                R$ {totals.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-green-600 font-semibold">
                {totals.totalCount} venda(s)
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 modern-shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-600 modern-shadow-lg">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-emerald-900 text-lg">Valor Recebido</h3>
              <p className="text-3xl font-black text-emerald-700">
                R$ {totals.totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-emerald-600 font-semibold">
                {totals.paidSales} venda(s) pagas
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 modern-shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-orange-600 modern-shadow-lg">
              <Clock className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-orange-900 text-lg">Valor Pendente</h3>
              <p className="text-3xl font-black text-orange-700">
                R$ {totals.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-orange-600 font-semibold">
                {totals.pendingSales + totals.partialSales} venda(s)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sales List */}
      <div className="space-y-6">
        {deduplicatedSales.length > 0 ? (
          deduplicatedSales.map((sale) => {
            // Additional safety check for duplicates in render
            if (!sale.id || !UUIDManager.isValidUUID(sale.id)) {
              console.warn('⚠️ Invalid sale ID detected in render:', sale.id);
              return null;
            }
            
            return (
              <div key={sale.id} className="card modern-shadow-xl">
                {/* Sale Header */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-green-600">
                      <ShoppingCart className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">{sale.client}</h3>
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDateForDisplay(sale.date)}
                        </span>
                        {sale.sellerId && (
                          <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {employees.find(e => e.id === sale.sellerId)?.name || 'Vendedor'}
                          </span>
                        )}
                        {sale.deliveryDate && (
                          <span className="flex items-center gap-1">
                            <Package className="w-4 h-4" />
                            Entrega: {formatDateForDisplay(sale.deliveryDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-3xl font-black text-green-600">
                      R$ {sale.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full border ${
                      sale.status === 'pago' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                      sale.status === 'parcial' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                      'bg-orange-100 text-orange-800 border-orange-200'
                    }`}>
                      {sale.status === 'pago' ? 'Pago' : 
                       sale.status === 'parcial' ? 'Parcial' : 'Pendente'}
                    </span>
                  </div>
                </div>

                {/* Products */}
                {sale.products && (
                  <div className="mb-6">
                    <h4 className="font-bold text-slate-900 mb-2">Produtos</h4>
                    <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                      <p className="text-green-700">
                        {typeof sale.products === 'string' ? sale.products : 'Produtos vendidos'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Payment Methods */}
                <div className="mb-6">
                  <h4 className="font-bold text-slate-900 mb-4">Métodos de Pagamento</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(sale.paymentMethods || []).map((method, index) => {
                      const permutaVehicle = method.type === 'permuta' && method.vehicleId
                        ? permutas.find(p => p.id === method.vehicleId)
                        : null;

                      return (
                        <div key={index} className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex flex-col gap-1">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold border w-fit ${
                                method.type === 'dinheiro' ? 'bg-green-100 text-green-800 border-green-200' :
                                method.type === 'pix' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                method.type === 'cartao_credito' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                method.type === 'cartao_debito' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                                method.type === 'cheque' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                method.type === 'boleto' ? 'bg-cyan-100 text-cyan-800 border-cyan-200' :
                                method.type === 'acerto' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                method.type === 'permuta' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                                'bg-slate-100 text-slate-800 border-slate-200'
                              }`}>
                                {method.type === 'permuta' ? 'PERMUTA' : method.type.replace('_', ' ').toUpperCase()}
                              </span>
                              {permutaVehicle && (
                                <span className="text-sm font-semibold text-indigo-700">
                                  {permutaVehicle.vehicleMake} {permutaVehicle.vehicleModel} {permutaVehicle.vehicleYear}
                                </span>
                              )}
                            </div>
                            <span className="text-xl font-black text-green-600">
                              R$ {method.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          {method.installments && method.installments > 1 && (
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-green-700">Parcelas:</span>
                                <span className="font-bold text-green-800">
                                  {method.installments}x de R$ {
                                    method.useCustomValues && method.customInstallmentValues && method.customInstallmentValues.length > 0
                                      ? (method.customInstallmentValues.reduce((sum, v) => sum + v, 0) / method.installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                                      : (method.installmentValue || (method.amount / method.installments)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                                  }
                                </span>
                              </div>
                              {method.installmentInterval && (
                                <div className="flex justify-between">
                                  <span className="text-green-700">Intervalo:</span>
                                  <span className="font-bold text-green-800">{method.installmentInterval} dias</span>
                                </div>
                              )}
                              {method.firstInstallmentDate && (
                                <div className="flex justify-between">
                                  <span className="text-green-700">Primeira parcela:</span>
                                  <span className="font-bold text-green-800">
                                    {formatDateForDisplay(method.firstInstallmentDate)}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="mb-6">
                  <h4 className="font-bold text-slate-900 mb-4">Resumo Financeiro</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-green-50 rounded-xl border border-green-200">
                      <p className="text-green-600 font-semibold">Total</p>
                      <p className="text-2xl font-black text-green-700">
                        R$ {sale.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                      <p className="text-emerald-600 font-semibold">Recebido</p>
                      <p className="text-2xl font-black text-emerald-700">
                        R$ {sale.receivedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-xl border border-orange-200">
                      <p className="text-orange-600 font-semibold">Pendente</p>
                      <p className="text-2xl font-black text-orange-700">
                        R$ {sale.pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Observations */}
                {sale.observations && (
                  <div className="mb-6">
                    <h4 className="font-bold text-slate-900 mb-2">Observações</h4>
                    <div className="p-4 bg-slate-50 rounded-xl border">
                      <p className="text-slate-700">{sale.observations}</p>
                    </div>
                  </div>
                )}

                {sale.paymentDescription && (
                  <div className="mb-6">
                    <h4 className="font-bold text-slate-900 mb-2">Descrição do Pagamento</h4>
                    <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                      <p className="text-green-700">{sale.paymentDescription}</p>
                    </div>
                  </div>
                )}

                {sale.paymentObservations && (
                  <div className="mb-6">
                    <h4 className="font-bold text-slate-900 mb-2">Observações do Pagamento</h4>
                    <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                      <p className="text-green-700">{sale.paymentObservations}</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => handleDownloadPDF(sale)}
                    className="text-slate-600 hover:text-slate-800 p-2 rounded-lg hover:bg-slate-100 transition-modern"
                    title="Baixar PDF"
                  >
                    <FileDown className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewingSale(sale)}
                    className="text-green-600 hover:text-green-800 p-2 rounded-lg hover:bg-green-50 transition-modern"
                    title="Visualizar Detalhes Completos"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setEditingSale(sale)}
                    className="text-emerald-600 hover:text-emerald-800 p-2 rounded-lg hover:bg-emerald-50 transition-modern"
                    title="Editar"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSale(sale.id)}
                    className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-modern"
                    title="Excluir"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 floating-animation">
              <ShoppingCart className="w-12 h-12 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-4">Nenhuma venda registrada</h3>
            <p className="text-slate-600 mb-8 text-lg">Comece registrando sua primeira venda para controlar as receitas.</p>
            <button
              onClick={() => setIsFormOpen(true)}
              className="btn-primary modern-shadow-xl"
            >
              Registrar primeira venda
            </button>
          </div>
        )}
      </div>

      {/* Sale Form Modal */}
      {(isFormOpen || editingSale) && (
        <SaleForm
          sale={editingSale}
          prefillOrcamento={!editingSale ? orcamentoPrefill : null}
          onSubmit={editingSale ? handleEditSale : handleAddSale}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingSale(null);
            setOrcamentoPrefill(null);
          }}
        />
      )}

      {/* View Sale Modal */}
      {viewingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-6xl w-full max-h-[90vh] overflow-y-auto modern-shadow-xl">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 modern-shadow-xl">
                    <ShoppingCart className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900">Detalhes Completos da Venda</h2>
                    <p className="text-slate-600">{viewingSale.client}</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingSale(null)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-8">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                    <h4 className="font-bold text-green-900 mb-2">Informações Básicas</h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>Cliente:</strong> {viewingSale.client}</p>
                      <p><strong>Data:</strong> {formatDateForDisplay(viewingSale.date)}</p>
                      {viewingSale.deliveryDate && (
                        <p><strong>Entrega:</strong> {formatDateForDisplay(viewingSale.deliveryDate)}</p>
                      )}
                      <p><strong>Status:</strong> 
                        <span className={`ml-2 px-2 py-1 rounded-full text-xs font-bold border ${
                          viewingSale.status === 'pago' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                          viewingSale.status === 'parcial' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                          'bg-orange-100 text-orange-800 border-orange-200'
                        }`}>
                          {viewingSale.status === 'pago' ? 'Pago' : 
                           viewingSale.status === 'parcial' ? 'Parcial' : 'Pendente'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                    <h4 className="font-bold text-green-900 mb-2">Valores</h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>Total:</strong> R$ {viewingSale.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      <p><strong>Recebido:</strong> <span className="text-emerald-600 font-bold">R$ {viewingSale.receivedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                      <p><strong>Pendente:</strong> <span className="text-orange-600 font-bold">R$ {viewingSale.pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                      {viewingSale.customCommissionRate && (
                        <p><strong>Comissão:</strong> {viewingSale.customCommissionRate}%</p>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                    <h4 className="font-bold text-green-900 mb-2">Sistema</h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>ID:</strong> <span className="font-mono text-xs">{viewingSale.id}</span></p>
                      <p><strong>Criado:</strong> {new Date(viewingSale.createdAt).toLocaleString('pt-BR')}</p>
                      {viewingSale.updatedAt && (
                        <p><strong>Atualizado:</strong> {new Date(viewingSale.updatedAt).toLocaleString('pt-BR')}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Products Details */}
                {viewingSale.products && (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                    <h4 className="font-bold text-slate-900 mb-4">Produtos Vendidos</h4>
                    <p className="text-slate-700 text-lg">
                      {typeof viewingSale.products === 'string' ? viewingSale.products : 'Produtos vendidos'}
                    </p>
                  </div>
                )}

                {/* Payment Methods Detailed */}
                <div className="p-6 bg-green-50 rounded-2xl border border-green-200">
                  <h4 className="font-bold text-green-900 mb-4">Métodos de Pagamento Detalhados</h4>
                  <div className="space-y-4">
                    {(viewingSale.paymentMethods || []).map((method, index) => {
                      const permutaVehicle = method.type === 'permuta' && method.vehicleId
                        ? permutas.find(p => p.id === method.vehicleId)
                        : null;

                      return (
                        <div key={index} className="p-4 bg-white rounded-xl border border-green-100 shadow-sm">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex flex-col gap-1">
                              <span className={`px-3 py-1 rounded-full text-sm font-bold border w-fit ${
                                method.type === 'dinheiro' ? 'bg-green-100 text-green-800 border-green-200' :
                                method.type === 'pix' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                method.type === 'cartao_credito' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                method.type === 'cartao_debito' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                                method.type === 'cheque' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                method.type === 'boleto' ? 'bg-cyan-100 text-cyan-800 border-cyan-200' :
                                method.type === 'acerto' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                method.type === 'permuta' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                                'bg-slate-100 text-slate-800 border-slate-200'
                              }`}>
                                {method.type === 'permuta' ? 'PERMUTA' : method.type.replace('_', ' ').toUpperCase()}
                              </span>
                              {permutaVehicle && (
                                <span className="text-base font-semibold text-indigo-700">
                                  {permutaVehicle.vehicleMake} {permutaVehicle.vehicleModel} {permutaVehicle.vehicleYear}
                                </span>
                              )}
                            </div>
                            <span className="text-2xl font-black text-green-600">
                              R$ {method.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        
                        {method.installments && method.installments > 1 && (
                          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                            <div>
                              <p><strong className="text-green-800">Parcelas:</strong> {method.installments}x</p>
                              <p><strong className="text-green-800">Valor por parcela:</strong> R$ {
                                method.useCustomValues && method.customInstallmentValues && method.customInstallmentValues.length > 0
                                  ? (method.customInstallmentValues.reduce((sum, v) => sum + v, 0) / method.installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                                  : (method.installmentValue || (method.amount / method.installments)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                              }</p>
                            </div>
                            <div>
                              <p><strong className="text-green-800">Intervalo:</strong> {method.installmentInterval} dias</p>
                              {method.firstInstallmentDate && (
                                <p><strong className="text-green-800">Primeira parcela:</strong> {formatDateForDisplay(method.firstInstallmentDate)}</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Third Party Check Details */}
                        {method.type === 'cheque' && method.isThirdPartyCheck && method.thirdPartyDetails && (
                          <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                            <h5 className="font-bold text-yellow-900 mb-3">Detalhes dos Cheques de Terceiros</h5>
                            <div className="space-y-3">
                              {method.thirdPartyDetails.map((check, checkIndex) => (
                                <div key={checkIndex} className="p-3 bg-white rounded-lg border border-yellow-100">
                                  <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div><strong>Banco:</strong> {check.bank}</div>
                                    <div><strong>Agência:</strong> {check.agency}</div>
                                    <div><strong>Conta:</strong> {check.account}</div>
                                    <div><strong>Nº Cheque:</strong> {check.checkNumber}</div>
                                    <div><strong>Emissor:</strong> {check.issuer}</div>
                                    <div><strong>CPF/CNPJ:</strong> {check.cpfCnpj}</div>
                                    {check.observations && (
                                      <div className="col-span-2"><strong>Obs:</strong> {check.observations}</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* All Observations */}
                {(viewingSale.observations || viewingSale.paymentDescription || viewingSale.paymentObservations) && (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                    <h4 className="font-bold text-slate-900 mb-4">Todas as Observações</h4>
                    <div className="space-y-4">
                      {viewingSale.observations && (
                        <div>
                          <h5 className="font-bold text-slate-800 mb-2">Observações Gerais:</h5>
                          <p className="text-slate-700 p-3 bg-white rounded-lg border">{viewingSale.observations}</p>
                        </div>
                      )}
                      {viewingSale.paymentDescription && (
                        <div>
                          <h5 className="font-bold text-slate-800 mb-2">Descrição do Pagamento:</h5>
                          <p className="text-slate-700 p-3 bg-white rounded-lg border">{viewingSale.paymentDescription}</p>
                        </div>
                      )}
                      {viewingSale.paymentObservations && (
                        <div>
                          <h5 className="font-bold text-slate-800 mb-2">Observações do Pagamento:</h5>
                          <p className="text-slate-700 p-3 bg-white rounded-lg border">{viewingSale.paymentObservations}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-8">
                <button
                  onClick={() => setViewingSale(null)}
                  className="btn-secondary"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debug Panel */}
      <DebugPanel 
        isOpen={showDebugPanel} 
        onClose={() => setShowDebugPanel(false)} 
      />

      {/* Test Panel */}
      <TestSaleCreation 
        isOpen={showTestPanel} 
        onClose={() => setShowTestPanel(false)} 
      />

      {/* Offline Data Viewer */}
      <OfflineDataViewer
        isOpen={showOfflineViewer}
        onClose={() => setShowOfflineViewer(false)}
      />

      {/* Bulk Sales Import Modal */}
      {showBulkImportModal && (
        <BulkSalesImportModal
          onClose={() => setShowBulkImportModal(false)}
        />
      )}
    </div>
  );
}