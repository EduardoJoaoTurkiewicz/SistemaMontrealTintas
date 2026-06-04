import React, { useState, useMemo } from 'react';
import { Plus, CreditCard as Edit, Trash2, Eye, Clock, DollarSign, Calendar, AlertCircle, X, Building2, CreditCard, FileText, Users, Receipt, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { Acerto } from '../types';
import { AcertoForm } from './forms/AcertoForm';
import { AcertoPaymentForm } from './forms/AcertoPaymentForm';
import { CompanyPaymentNegotiationForm } from './forms/CompanyPaymentNegotiationForm';

export function Acertos() {
  const {
    acertos,
    sales,
    debts,
    checks,
    boletos,
    isLoading,
    error,
    createAcerto,
    updateAcerto,
    deleteAcerto,
    updateDebt,
    loadAllData
  } = useAppContext();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAcerto, setEditingAcerto] = useState<Acerto | null>(null);
  const [viewingAcerto, setViewingAcerto] = useState<Acerto | null>(null);
  const [paymentAcerto, setPaymentAcerto] = useState<Acerto | null>(null);
  const [negotiatingAcerto, setNegotiatingAcerto] = useState<Acerto | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [showPaid, setShowPaid] = useState(false);

  // Separar acertos por tipo — ocultar pagos por padrão
  const clientAcertos = useMemo(() => {
    return acertos.filter(acerto =>
      acerto.type === 'cliente' && (showPaid || acerto.status !== 'pago')
    );
  }, [acertos, showPaid]);

  const companyAcertos = useMemo(() => {
    return acertos.filter(acerto =>
      acerto.type === 'empresa' && (showPaid || acerto.status !== 'pago')
    );
  }, [acertos, showPaid]);

  // Calcular totais
  const totals = useMemo(() => {
    const totalClients = clientAcertos.reduce((sum, acerto) => sum + acerto.totalAmount, 0);
    const totalCompanies = companyAcertos.reduce((sum, acerto) => sum + acerto.totalAmount, 0);
    const pendingClients = clientAcertos.reduce((sum, acerto) => sum + acerto.pendingAmount, 0);
    const pendingCompanies = companyAcertos.reduce((sum, acerto) => sum + acerto.pendingAmount, 0);
    
    return {
      totalClients,
      totalCompanies,
      pendingClients,
      pendingCompanies,
      totalGeneral: totalClients + totalCompanies,
      pendingGeneral: pendingClients + pendingCompanies
    };
  }, [clientAcertos, companyAcertos]);

  // Obter vendas relacionadas a um acerto de cliente
  const getRelatedSales = (clientName: string) => {
    return sales.filter(sale => {
      // Verificar se a venda tem método de pagamento "acerto"
      return sale.paymentMethods?.some(method => method.type === 'acerto') &&
             sale.client.toLowerCase() === clientName.toLowerCase();
    });
  };

  // Obter dívidas relacionadas a um acerto de empresa
  const getRelatedDebts = (companyName: string) => {
    return debts.filter(debt => {
      // Verificar se a dívida tem método de pagamento "acerto"
      return debt.paymentMethods?.some(method => method.type === 'acerto') &&
             debt.company.toLowerCase() === companyName.toLowerCase();
    });
  };

  const handleAddAcerto = (acerto: Omit<Acerto, 'id' | 'createdAt'>) => {
    createAcerto(acerto).then(() => {
      setIsFormOpen(false);
    }).catch(error => {
      alert('Erro ao criar acerto: ' + error.message);
    });
  };

  const handleEditAcerto = (acerto: Omit<Acerto, 'id' | 'createdAt'>) => {
    if (editingAcerto) {
      updateAcerto({ ...acerto, id: editingAcerto.id, createdAt: editingAcerto.createdAt }).then(() => {
        setEditingAcerto(null);
      }).catch(error => {
        alert('Erro ao atualizar acerto: ' + error.message);
      });
    }
  };

  const handleDeleteAcerto = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este acerto? Esta ação não pode ser desfeita.')) {
      deleteAcerto(id).catch(error => {
        alert('Erro ao excluir acerto: ' + error.message);
      });
    }
  };

  const handlePaymentSubmit = async (paymentData: any) => {
    if (paymentAcerto) {
      try {
        // Usar o serviço especializado para processar o pagamento
        const { AcertoPaymentService } = await import('../lib/acertoPaymentService');
        await AcertoPaymentService.processClientPayment(
          paymentAcerto,
          paymentData.selectedSaleIds || [],
          paymentData.paymentAmount,
          paymentData.paymentMethods || []
        );

        console.log('✅ Acerto payment processed successfully');
        toast.success('Pagamento registrado com sucesso!');
        setPaymentAcerto(null);
        await loadAllData();
      } catch (error: any) {
        console.error('❌ Error processing acerto payment:', error);
        toast.error('Erro ao registrar pagamento: ' + (error.message || 'Erro desconhecido'));
      }
    }
  };

  const handleNegotiationSubmit = async (paymentData: any) => {
    if (negotiatingAcerto) {
      try {
        await updateAcerto({ ...negotiatingAcerto, ...paymentData, id: negotiatingAcerto.id, updatedAt: new Date().toISOString() });

        if (paymentData.status === 'pago') {
          const relatedDebts = getRelatedDebts(negotiatingAcerto.companyName || negotiatingAcerto.clientName);
          for (const debt of relatedDebts) {
            if (!debt.isPaid) {
              await updateDebt({ id: debt.id, isPaid: true, paidAmount: debt.totalValue, pendingAmount: 0, updatedAt: new Date().toISOString() });
            }
          }
        }

        setNegotiatingAcerto(null);
      } catch (error: any) {
        alert('Erro ao processar negociação: ' + error.message);
      }
    }
  };

  const toggleClientExpansion = (clientName: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientName)) {
      newExpanded.delete(clientName);
    } else {
      newExpanded.add(clientName);
    }
    setExpandedClients(newExpanded);
  };

  const toggleCompanyExpansion = (companyName: string) => {
    const newExpanded = new Set(expandedCompanies);
    if (newExpanded.has(companyName)) {
      newExpanded.delete(companyName);
    } else {
      newExpanded.add(companyName);
    }
    setExpandedCompanies(newExpanded);
  };

  const getStatusColor = (status: Acerto['status']) => {
    switch (status) {
      case 'pago': return 'bg-green-100 text-green-800 border-green-200';
      case 'parcial': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  const getStatusLabel = (status: Acerto['status']) => {
    switch (status) {
      case 'pago': return 'Pago';
      case 'parcial': return 'Parcial';
      default: return 'Pendente';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-600 font-semibold">Carregando acertos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-700 shadow-xl floating-animation">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Gestão de Acertos</h1>
            <p className="text-slate-600 text-lg">Pagamentos mensais de clientes e negociações com fornecedores</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPaid(v => !v)}
            className={`btn-secondary flex items-center gap-2 text-sm ${showPaid ? 'ring-2 ring-green-400' : ''}`}
          >
            {showPaid ? 'Ocultar pagos' : 'Mostrar pagos'}
          </button>
          <button
            onClick={() => setIsFormOpen(true)}
            className="btn-primary flex items-center gap-2 modern-shadow-xl hover:modern-shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Novo Acerto de Empresa
          </button>
        </div>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 modern-shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-600 modern-shadow-lg">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-blue-900 text-lg">Acertos de Clientes</h3>
              <p className="text-blue-700 font-medium">{clientAcertos.length} acerto(s)</p>
              <p className="text-sm text-blue-600 font-semibold">
                Total: R$ {totals.totalClients.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-red-50 to-red-100 border-red-200 modern-shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-600 modern-shadow-lg">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-red-900 text-lg">Acertos de Empresas</h3>
              <p className="text-red-700 font-medium">{companyAcertos.length} acerto(s)</p>
              <p className="text-sm text-red-600 font-semibold">
                Total: R$ {totals.totalCompanies.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 modern-shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-orange-600 modern-shadow-lg">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-orange-900 text-lg">Pendente Clientes</h3>
              <p className="text-orange-700 font-medium">A receber</p>
              <p className="text-sm text-orange-600 font-semibold">
                R$ {totals.pendingClients.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200 modern-shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-600 modern-shadow-lg">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-purple-900 text-lg">Pendente Empresas</h3>
              <p className="text-purple-700 font-medium">A pagar</p>
              <p className="text-sm text-purple-600 font-semibold">
                R$ {totals.pendingCompanies.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Acertos de Clientes (Vendas) */}
      <div className="card modern-shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-xl bg-blue-600">
            <Users className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Acertos de Clientes (Vendas)</h3>
          <span className="text-blue-600 font-semibold">
            Total: R$ {totals.totalClients.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
        
        {clientAcertos.length > 0 ? (
          <div className="space-y-4">
            {clientAcertos.map(acerto => {
              const relatedSales = getRelatedSales(acerto.clientName);
              
              return (
                <div key={acerto.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div 
                    className="p-6 bg-gradient-to-r from-blue-50 to-transparent hover:from-blue-100 cursor-pointer transition-modern"
                    onClick={() => toggleClientExpansion(acerto.clientName)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button className="p-2 rounded-lg bg-blue-600 text-white modern-shadow">
                          {expandedClients.has(acerto.clientName) ? 
                            <ChevronDown className="w-5 h-5" /> : 
                            <ChevronRight className="w-5 h-5" />
                          }
                        </button>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{acerto.clientName}</h3>
                          <p className="text-sm text-slate-600">
                            {relatedSales.length} venda(s) relacionada(s) • 
                            Criado em {new Date(acerto.createdAt!).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-blue-600">
                          R$ {acerto.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(acerto.status)}`}>
                            {getStatusLabel(acerto.status)}
                          </span>
                          <span className="text-sm text-orange-600 font-bold">
                            Pendente: R$ {acerto.pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {expandedClients.has(acerto.clientName) && (
                    <div className="border-t border-slate-200 bg-white">
                      <div className="p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          {/* Vendas Relacionadas */}
                          <div>
                            <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                              <FileText className="w-5 h-5 text-blue-600" />
                              Vendas Relacionadas ({relatedSales.length})
                            </h4>
                            <div className="space-y-3">
                              {relatedSales.map(sale => (
                                <div key={sale.id} className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="font-bold text-blue-900">
                                        Venda de {new Date(sale.date).toLocaleDateString('pt-BR')}
                                      </p>
                                      <p className="text-sm text-blue-700">
                                        Produtos: {typeof sale.products === 'string' ? sale.products : 'Produtos vendidos'}
                                      </p>
                                      <p className="text-sm text-blue-700">
                                        Status: {sale.status}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-bold text-blue-600">
                                        R$ {sale.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </span>
                                      <p className="text-sm text-orange-600">
                                        Pendente: R$ {sale.pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {relatedSales.length === 0 && (
                                <div className="text-center py-8">
                                  <FileText className="w-12 h-12 mx-auto mb-3 text-blue-300" />
                                  <p className="text-blue-600 font-medium">Nenhuma venda relacionada</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Ações */}
                          <div>
                            <h4 className="font-semibold text-slate-900 mb-4">Ações Disponíveis</h4>
                            <div className="space-y-3">
                              <button
                                onClick={() => setViewingAcerto(acerto)}
                                className="w-full p-4 bg-green-50 rounded-xl border border-green-200 hover:bg-green-100 transition-colors flex items-center gap-3"
                              >
                                <Eye className="w-5 h-5 text-green-600" />
                                <span className="font-semibold text-green-800">Ver Detalhes Completos</span>
                              </button>
                              
                              {acerto.status !== 'pago' && (
                                <button
                                  onClick={() => setPaymentAcerto(acerto)}
                                  className="w-full p-4 bg-blue-50 rounded-xl border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-3"
                                >
                                  <DollarSign className="w-5 h-5 text-blue-600" />
                                  <span className="font-semibold text-blue-800">Registrar Pagamento</span>
                                </button>
                              )}
                             
                             <button
                               onClick={() => {
                                 // Navegar para a aba de vendas e filtrar por cliente
                                 window.location.hash = '#sales';
                                 setTimeout(() => {
                                   // Implementar filtro por cliente na aba vendas
                                   console.log('Filtrar vendas por cliente:', acerto.clientName);
                                 }, 100);
                               }}
                               className="w-full p-4 bg-purple-50 rounded-xl border border-purple-200 hover:bg-purple-100 transition-colors flex items-center gap-3"
                             >
                               <FileText className="w-5 h-5 text-purple-600" />
                               <span className="font-semibold text-purple-800">Ver Vendas Relacionadas</span>
                             </button>

                              <button
                                onClick={() => setEditingAcerto(acerto)}
                                className="w-full p-4 bg-yellow-50 rounded-xl border border-yellow-200 hover:bg-yellow-100 transition-colors flex items-center gap-3"
                              >
                                <Edit className="w-5 h-5 text-yellow-600" />
                                <span className="font-semibold text-yellow-800">Editar Acerto</span>
                              </button>

                              <button
                                onClick={() => handleDeleteAcerto(acerto.id)}
                                className="w-full p-4 bg-red-50 rounded-xl border border-red-200 hover:bg-red-100 transition-colors flex items-center gap-3"
                              >
                                <Trash2 className="w-5 h-5 text-red-600" />
                                <span className="font-semibold text-red-800">Excluir Acerto</span>
                              </button>
                            </div>
                          </div>
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
            <Users className="w-20 h-20 mx-auto mb-6 text-blue-300" />
            <p className="text-blue-600 mb-4 text-xl font-medium">Nenhum acerto de cliente ainda.</p>
            <p className="text-blue-500 text-sm mb-6">
              Acertos de clientes são criados automaticamente quando você registra vendas com pagamento em "acerto".
            </p>
          </div>
        )}
      </div>

      {/* Acertos de Empresas (Dívidas) */}
      <div className="card modern-shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-xl bg-red-600">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-red-900">Acertos de Empresas (Dívidas)</h3>
          <span className="text-red-600 font-semibold">
            Total: R$ {totals.totalCompanies.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
        
        {companyAcertos.length > 0 ? (
          <div className="space-y-4">
            {companyAcertos.map(acerto => {
              const relatedDebts = getRelatedDebts(acerto.companyName || acerto.clientName);
              
              return (
                <div key={acerto.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div 
                    className="p-6 bg-gradient-to-r from-red-50 to-transparent hover:from-red-100 cursor-pointer transition-modern"
                    onClick={() => toggleCompanyExpansion(acerto.companyName || acerto.clientName)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button className="p-2 rounded-lg bg-red-600 text-white modern-shadow">
                          {expandedCompanies.has(acerto.companyName || acerto.clientName) ? 
                            <ChevronDown className="w-5 h-5" /> : 
                            <ChevronRight className="w-5 h-5" />
                          }
                        </button>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{acerto.companyName || acerto.clientName}</h3>
                          <p className="text-sm text-slate-600">
                            {relatedDebts.length} dívida(s) relacionada(s) • 
                            Criado em {new Date(acerto.createdAt!).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-red-600">
                          R$ {acerto.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(acerto.status)}`}>
                            {getStatusLabel(acerto.status)}
                          </span>
                          <span className="text-sm text-orange-600 font-bold">
                            Pendente: R$ {acerto.pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {expandedCompanies.has(acerto.companyName || acerto.clientName) && (
                    <div className="border-t border-slate-200 bg-white">
                      <div className="p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          {/* Dívidas Relacionadas */}
                          <div>
                            <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                              <CreditCard className="w-5 h-5 text-red-600" />
                              Dívidas Relacionadas ({relatedDebts.length})
                            </h4>
                            <div className="space-y-3">
                              {relatedDebts.map(debt => (
                                <div key={debt.id} className="p-4 bg-red-50 rounded-xl border border-red-200">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="font-bold text-red-900">
                                        Dívida de {new Date(debt.date).toLocaleDateString('pt-BR')}
                                      </p>
                                      <p className="text-sm text-red-700">
                                        Descrição: {debt.description}
                                      </p>
                                      <p className="text-sm text-red-700">
                                        Status: {debt.isPaid ? 'Pago' : 'Pendente'}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-bold text-red-600">
                                        R$ {debt.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </span>
                                      <p className="text-sm text-orange-600">
                                        Pendente: R$ {debt.pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {relatedDebts.length === 0 && (
                                <div className="text-center py-8">
                                  <CreditCard className="w-12 h-12 mx-auto mb-3 text-red-300" />
                                  <p className="text-red-600 font-medium">Nenhuma dívida relacionada</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Ações */}
                          <div>
                            <h4 className="font-semibold text-slate-900 mb-4">Ações Disponíveis</h4>
                            <div className="space-y-3">
                              <button
                                onClick={() => setViewingAcerto(acerto)}
                                className="w-full p-4 bg-green-50 rounded-xl border border-green-200 hover:bg-green-100 transition-colors flex items-center gap-3"
                              >
                                <Eye className="w-5 h-5 text-green-600" />
                                <span className="font-semibold text-green-800">Ver Detalhes Completos</span>
                              </button>
                              
                              {acerto.status !== 'pago' && (
                                <button
                                  onClick={() => setNegotiatingAcerto(acerto)}
                                  className="w-full p-4 bg-purple-50 rounded-xl border border-purple-200 hover:bg-purple-100 transition-colors flex items-center gap-3"
                                >
                                  <Receipt className="w-5 h-5 text-purple-600" />
                                  <span className="font-semibold text-purple-800">Negociar Pagamento</span>
                                </button>
                              )}
                             
                             <button
                               onClick={() => {
                                 // Navegar para a aba de dívidas e filtrar por empresa
                                 window.location.hash = '#debts';
                                 setTimeout(() => {
                                   // Implementar filtro por empresa na aba dívidas
                                   console.log('Filtrar dívidas por empresa:', acerto.companyName);
                                 }, 100);
                               }}
                               className="w-full p-4 bg-indigo-50 rounded-xl border border-indigo-200 hover:bg-indigo-100 transition-colors flex items-center gap-3"
                             >
                               <CreditCard className="w-5 h-5 text-indigo-600" />
                               <span className="font-semibold text-indigo-800">Ver Dívidas Relacionadas</span>
                             </button>
                              
                              <button
                                onClick={() => setEditingAcerto(acerto)}
                                className="w-full p-4 bg-yellow-50 rounded-xl border border-yellow-200 hover:bg-yellow-100 transition-colors flex items-center gap-3"
                              >
                                <Edit className="w-5 h-5 text-yellow-600" />
                                <span className="font-semibold text-yellow-800">Editar Acerto</span>
                              </button>

                              <button
                                onClick={() => handleDeleteAcerto(acerto.id)}
                                className="w-full p-4 bg-red-50 rounded-xl border border-red-200 hover:bg-red-100 transition-colors flex items-center gap-3"
                              >
                                <Trash2 className="w-5 h-5 text-red-600" />
                                <span className="font-semibold text-red-800">Excluir Acerto</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 mx-auto mb-4 text-red-300" />
            <p className="text-red-600 font-medium">Nenhum acerto de empresa</p>
            <p className="text-red-500 text-sm mt-2">
              Acertos de empresas são criados automaticamente quando você registra dívidas com pagamento em "acerto"
            </p>
          </div>
        )}
      </div>

      {/* Acerto Form Modal — only for empresa type (new) or editing any type */}
      {(isFormOpen || editingAcerto) && (
        <AcertoForm
          acerto={editingAcerto}
          defaultType={isFormOpen && !editingAcerto ? 'empresa' : undefined}
          onSubmit={editingAcerto ? handleEditAcerto : handleAddAcerto}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingAcerto(null);
          }}
        />
      )}

      {/* Payment Form Modal */}
      {paymentAcerto && (
        <AcertoPaymentForm
          acerto={paymentAcerto}
          onSubmit={handlePaymentSubmit}
          onCancel={() => setPaymentAcerto(null)}
        />
      )}

      {/* Company Payment Negotiation Modal */}
      {negotiatingAcerto && (
        <CompanyPaymentNegotiationForm
          acerto={negotiatingAcerto}
          onSubmit={handleNegotiationSubmit}
          onCancel={() => setNegotiatingAcerto(null)}
        />
      )}

      {/* View Acerto Modal */}
      {viewingAcerto && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto modern-shadow-xl">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 modern-shadow-xl">
                    <Clock className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900">Detalhes do Acerto</h2>
                </div>
                <button
                  onClick={() => setViewingAcerto(null)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-8">
                {/* Basic Information */}
                <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-200">
                  <h3 className="text-xl font-bold text-indigo-900 mb-4">Informações Básicas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <p><strong className="text-indigo-800">Tipo:</strong> <span className="text-indigo-700 font-bold capitalize">{viewingAcerto.type}</span></p>
                    <p><strong className="text-indigo-800">Nome:</strong> <span className="text-indigo-700 font-bold">{viewingAcerto.clientName}</span></p>
                    {viewingAcerto.companyName && (
                      <p><strong className="text-indigo-800">Empresa:</strong> <span className="text-indigo-700 font-bold">{viewingAcerto.companyName}</span></p>
                    )}
                    <p><strong className="text-indigo-800">Status:</strong> 
                      <span className={`ml-2 px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(viewingAcerto.status)}`}>
                        {getStatusLabel(viewingAcerto.status)}
                      </span>
                    </p>
                    <p><strong className="text-indigo-800">Valor Total:</strong> <span className="text-indigo-700 font-bold">R$ {viewingAcerto.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                    <p><strong className="text-indigo-800">Valor Pago:</strong> <span className="text-green-600 font-bold">R$ {viewingAcerto.paidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                    <p><strong className="text-indigo-800">Valor Pendente:</strong> <span className="text-orange-600 font-bold">R$ {viewingAcerto.pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                    <p><strong className="text-indigo-800">Data de Criação:</strong> <span className="text-indigo-700">{new Date(viewingAcerto.createdAt!).toLocaleString('pt-BR')}</span></p>
                  </div>
                </div>

                {/* Payment Information */}
                {viewingAcerto.paymentDate && (
                  <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-200">
                    <h3 className="text-xl font-bold text-green-900 mb-4">Informações de Pagamento</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <p><strong className="text-green-800">Data do Pagamento:</strong> <span className="text-green-700">{new Date(viewingAcerto.paymentDate).toLocaleDateString('pt-BR')}</span></p>
                      {viewingAcerto.paymentMethod && (
                        <p><strong className="text-green-800">Método:</strong> <span className="text-green-700 capitalize">{viewingAcerto.paymentMethod.replace('_', ' ')}</span></p>
                      )}
                      {viewingAcerto.paymentInstallments && viewingAcerto.paymentInstallments > 1 && (
                        <>
                          <p><strong className="text-green-800">Parcelas:</strong> <span className="text-green-700">{viewingAcerto.paymentInstallments}x</span></p>
                          <p><strong className="text-green-800">Valor por Parcela:</strong> <span className="text-green-700">R$ {viewingAcerto.paymentInstallmentValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                          <p><strong className="text-green-800">Intervalo:</strong> <span className="text-green-700">{viewingAcerto.paymentInterval} dias</span></p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Related Items */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Related Sales/Debts */}
                  <div className="p-6 bg-gradient-to-r from-slate-50 to-gray-50 rounded-2xl border border-slate-200">
                    <h3 className="text-xl font-bold text-slate-900 mb-4">
                      {viewingAcerto.type === 'cliente' ? 'Vendas Relacionadas' : 'Dívidas Relacionadas'}
                    </h3>
                    <div className="space-y-3">
                      {viewingAcerto.type === 'cliente' ? (
                        getRelatedSales(viewingAcerto.clientName).map(sale => (
                          <div key={sale.id} className="p-3 bg-white rounded-xl border border-slate-100">
                            <div className="flex justify-between">
                              <div>
                                <p className="font-bold text-slate-900">{new Date(sale.date).toLocaleDateString('pt-BR')}</p>
                                <p className="text-sm text-slate-700">{typeof sale.products === 'string' ? sale.products : 'Produtos vendidos'}</p>
                              </div>
                              <span className="font-bold text-blue-600">
                                R$ {sale.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        getRelatedDebts(viewingAcerto.companyName || viewingAcerto.clientName).map(debt => (
                          <div key={debt.id} className="p-3 bg-white rounded-xl border border-slate-100">
                            <div className="flex justify-between">
                              <div>
                                <p className="font-bold text-slate-900">{new Date(debt.date).toLocaleDateString('pt-BR')}</p>
                                <p className="text-sm text-slate-700">{debt.description}</p>
                              </div>
                              <span className="font-bold text-red-600">
                                R$ {debt.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Observations */}
                  <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
                    <h3 className="text-xl font-bold text-blue-900 mb-4">Observações</h3>
                    {viewingAcerto.observations ? (
                      <p className="text-blue-800 font-medium">{viewingAcerto.observations}</p>
                    ) : (
                      <p className="text-blue-600 italic">Nenhuma observação registrada</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-8">
                <button
                  onClick={() => setViewingAcerto(null)}
                  className="btn-secondary"
                >
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