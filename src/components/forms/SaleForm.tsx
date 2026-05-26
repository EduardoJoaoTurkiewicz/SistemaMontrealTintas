import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Info, User, Package, AlertTriangle, CreditCard as Edit2 } from 'lucide-react';
import { Sale, PaymentMethod, SaleItem, Orcamento } from '../../types';
import { ThirdPartyCheckDetails } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { safeNumber, validateFormNumber, logMonetaryValues } from '../../utils/numberUtils';
import { formatDateForInput, parseInputDate } from '../../utils/dateUtils';
import { getCurrentDateString } from '../../utils/dateUtils';
import { CurrencyInput } from '../CurrencyInput';
import { ThirdPartyCheckVisual } from './ThirdPartyCheckVisual';
import { ClienteSelectorModal } from '../modals/ClienteSelectorModal';
import { ProdutoSelectorModal } from '../modals/ProdutoSelectorModal';
import { validarEstoqueParaItens } from '../../lib/saleStockService';
import type { Cliente } from '../../types';

interface SaleFormProps {
  sale?: Sale | null;
  prefillOrcamento?: Orcamento | null;
  onSubmit: (sale: Omit<Sale, 'id' | 'createdAt'>, saleItems: SaleItem[]) => void;
  onCancel: () => void;
}

const PAYMENT_TYPES = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao_credito', label: 'Cartao de Credito' },
  { value: 'cartao_debito', label: 'Cartao de Debito' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'acerto', label: 'Acerto (Pagamento Mensal)' },
  { value: 'permuta', label: 'Permuta (Troca de Veiculo)' }
];

const INSTALLMENT_TYPES = ['cartao_credito', 'cheque', 'boleto'];

export function SaleForm({ sale, prefillOrcamento, onSubmit, onCancel }: SaleFormProps) {
  const { employees, permutas, acertos, estoqueProdutos, clientes } = useAppContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showProdutoModal, setShowProdutoModal] = useState(false);
  const [saleItems, setSaleItems] = useState<SaleItem[]>(sale?.saleItems ?? []);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);

  const [formData, setFormData] = useState({
    date: sale?.date || getCurrentDateString(),
    deliveryDate: sale?.deliveryDate || '',
    client: sale?.client || '',
    sellerId: sale?.sellerId || '',
    customCommissionRate: safeNumber(sale?.customCommissionRate, 5),
    products: sale?.products || 'Produtos vendidos',
    observations: sale?.observations || '',
    totalValue: safeNumber(sale?.totalValue, 0),
    paymentMethods: (sale?.paymentMethods || [{ type: 'dinheiro' as const, amount: 0 }]).map(method => ({
      ...method,
      amount: safeNumber(method.amount, 0),
      installmentValue: safeNumber(method.installmentValue, 0),
      installments: safeNumber(method.installments, 1),
      installmentInterval: safeNumber(method.installmentInterval, 30),
      useCustomValues: method.useCustomValues || false,
      customInstallmentValues: method.customInstallmentValues || []
    })),
    paymentDescription: sale?.paymentDescription || '',
    paymentObservations: sale?.paymentObservations || ''
  });

  const sellers = employees.filter(emp => emp.isActive && emp.isSeller);

  const availablePermutas = React.useMemo(() => {
    return permutas.filter(permuta =>
      permuta.status === 'ativo' &&
      permuta.remainingValue > 0
    );
  }, [permutas]);

  // Acerto requires a registered client — check if currently selected client is registered
  const clienteRegistradoSelecionado = clienteSelecionado !== null;

  const totalItens = useMemo(() =>
    saleItems.reduce((sum, item) => sum + item.quantidade * item.valorUnitario, 0),
    [saleItems]
  );

  useEffect(() => {
    if (saleItems.length > 0 && totalItens > 0) {
      setFormData(prev => ({ ...prev, totalValue: totalItens }));
    }
  }, [totalItens, saleItems.length]);

  useEffect(() => {
    if (!prefillOrcamento) return;

    const orcItens: SaleItem[] = prefillOrcamento.itens.map((item) => ({
      produtoId: item.produtoId,
      variacaoId: item.variacaoId,
      corId: item.corId ?? null,
      nomeProduto: item.nomeProduto,
      nomeVariacao: item.nomeVariacao,
      nomeCor: item.nomeCor ?? undefined,
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
      valorTotal: item.subtotal,
    }));
    setSaleItems(orcItens);

    const clienteEncontrado = clientes.find((c) => c.id === prefillOrcamento.clienteId);
    if (clienteEncontrado) {
      setClienteSelecionado(clienteEncontrado);
    }

    const total = orcItens.reduce((s, i) => s + i.valorTotal, 0);

    setFormData((prev) => ({
      ...prev,
      client: prefillOrcamento.clienteNome,
      sellerId: clienteEncontrado?.vendedorResponsavelId ?? prev.sellerId,
      totalValue: total,
      paymentMethods: [],
    }));
  }, [prefillOrcamento]);

  function handleClienteSelect(cliente: Cliente) {
    setClienteSelecionado(cliente);
    const nome = cliente.nomeCompleto ?? cliente.razaoSocial ?? cliente.nomeFantasia ?? '';
    setFormData(prev => ({
      ...prev,
      client: nome,
      sellerId: cliente.vendedorResponsavelId ?? prev.sellerId,
    }));
  }

  const addPaymentMethod = () => {
    setFormData(prev => ({
      ...prev,
      paymentMethods: [...prev.paymentMethods, { type: 'dinheiro', amount: 0 }]
    }));
  };

  const removePaymentMethod = (index: number) => {
    setFormData(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.filter((_, i) => i !== index)
    }));
  };

  const updatePaymentMethod = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map((method, i) => {
        if (i === index) {
          const updatedMethod = { ...method, [field]: value };

          if (field === 'amount') {
            updatedMethod.amount = safeNumber(value, 0);
          }
          if (field === 'installments') {
            updatedMethod.installments = safeNumber(value, 1);
            if (updatedMethod.useCustomValues) {
              const newInstallments = safeNumber(value, 1);
              const installmentValue = safeNumber(method.amount, 0) / newInstallments;
              updatedMethod.customInstallmentValues = Array(newInstallments).fill(installmentValue);
            }
          }
          if (field === 'installmentInterval') {
            updatedMethod.installmentInterval = safeNumber(value, 30);
          }

          if (field === 'useCustomValues') {
            if (value) {
              const numInstallments = safeNumber(method.installments, 1);
              const installmentValue = safeNumber(method.amount, 0) / numInstallments;
              updatedMethod.customInstallmentValues = Array(numInstallments).fill(installmentValue);
            } else {
              updatedMethod.customInstallmentValues = [];
            }
          }

          if (field === 'installments' && safeNumber(value, 1) > 1 && !updatedMethod.useCustomValues) {
            updatedMethod.installmentValue = safeNumber(method.amount, 0) / safeNumber(value, 1);
          } else if (field === 'amount' && safeNumber(method.installments, 1) > 1 && !updatedMethod.useCustomValues) {
            updatedMethod.installmentValue = safeNumber(value, 0) / safeNumber(method.installments, 1);
          }

          if (field === 'type' && !INSTALLMENT_TYPES.includes(value)) {
            delete updatedMethod.installments;
            delete updatedMethod.installmentValue;
            delete updatedMethod.installmentInterval;
            delete updatedMethod.startDate;
            delete updatedMethod.firstInstallmentDate;
            delete updatedMethod.isThirdPartyCheck;
            delete updatedMethod.thirdPartyDetails;
            delete updatedMethod.isOwnCheck;
            delete updatedMethod.useCustomValues;
            delete updatedMethod.customInstallmentValues;
          }

          if (field === 'type' && INSTALLMENT_TYPES.includes(value)) {
            if (!updatedMethod.installments) updatedMethod.installments = 1;
            if (!updatedMethod.installmentInterval) updatedMethod.installmentInterval = 30;
          }

          return updatedMethod;
        }
        return method;
      })
    }));
  };

  const updateCustomInstallmentValue = (methodIndex: number, installmentIndex: number, value: number) => {
    setFormData(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map((method, i) => {
        if (i === methodIndex && method.customInstallmentValues) {
          const newCustomValues = [...method.customInstallmentValues];
          newCustomValues[installmentIndex] = safeNumber(value, 0);
          return { ...method, customInstallmentValues: newCustomValues };
        }
        return method;
      })
    }));
  };

  const addThirdPartyCheck = (paymentMethodIndex: number) => {
    setFormData(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map((method, i) => {
        if (i === paymentMethodIndex && method.type === 'cheque' && method.isThirdPartyCheck) {
          const thirdPartyDetails = method.thirdPartyDetails || [];
          return {
            ...method,
            thirdPartyDetails: [...thirdPartyDetails, {
              bank: '',
              agency: '',
              account: '',
              checkNumber: '',
              issuer: '',
              cpfCnpj: '',
              observations: ''
            }]
          };
        }
        return method;
      })
    }));
  };

  const updateThirdPartyCheck = (paymentMethodIndex: number, checkIndex: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map((method, i) => {
        if (i === paymentMethodIndex && method.thirdPartyDetails) {
          return {
            ...method,
            thirdPartyDetails: method.thirdPartyDetails.map((check, j) =>
              j === checkIndex ? { ...check, [field]: value } : check
            )
          };
        }
        return method;
      })
    }));
  };

  const removeThirdPartyCheck = (paymentMethodIndex: number, checkIndex: number) => {
    setFormData(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map((method, i) => {
        if (i === paymentMethodIndex && method.thirdPartyDetails) {
          return {
            ...method,
            thirdPartyDetails: method.thirdPartyDetails.filter((_, j) => j !== checkIndex)
          };
        }
        return method;
      })
    }));
  };

  const calculateAmounts = () => {
    const totalPaid = formData.paymentMethods.reduce((sum, method) => {
      const methodAmount = safeNumber(method.amount, 0);
      if (method.type === 'dinheiro' || method.type === 'pix' || method.type === 'cartao_debito') {
        return sum + methodAmount;
      }
      if (method.type === 'cartao_credito' && safeNumber(method.installments, 1) === 1) {
        return sum + methodAmount;
      }
      if (method.type === 'permuta') {
        return sum + methodAmount;
      }
      return sum;
    }, 0);

    const totalValue = safeNumber(formData.totalValue, 0);
    const pending = totalValue - totalPaid;

    return {
      receivedAmount: totalPaid,
      pendingAmount: Math.max(0, pending),
      status: pending <= 0.01 ? 'pago' : (totalPaid > 0 ? 'parcial' : 'pendente')
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!formData.client || !formData.client.trim()) {
      alert('Por favor, selecione um cliente.');
      return;
    }

    const totalValue = safeNumber(formData.totalValue, 0);
    if (totalValue <= 0) {
      alert('O valor total da venda deve ser maior que zero.');
      return;
    }

    if (!formData.paymentMethods || formData.paymentMethods.length === 0) {
      alert('Por favor, adicione pelo menos um metodo de pagamento.');
      return;
    }

    const totalPaymentAmount = formData.paymentMethods.reduce((sum, method) => sum + safeNumber(method.amount, 0), 0);
    if (totalPaymentAmount === 0) {
      alert('Por favor, informe pelo menos um metodo de pagamento com valor maior que zero.');
      return;
    }

    if (totalPaymentAmount > totalValue) {
      alert('O total dos metodos de pagamento nao pode ser maior que o valor total da venda.');
      return;
    }

    for (const method of formData.paymentMethods) {
      if (!method.type || typeof method.type !== 'string') {
        alert('Todos os metodos de pagamento devem ter um tipo valido.');
        return;
      }
      const methodAmount = safeNumber(method.amount, 0);
      if (methodAmount < 0) {
        alert('Todos os metodos de pagamento devem ter um valor valido.');
        return;
      }

      if (INSTALLMENT_TYPES.includes(method.type) && safeNumber(method.installments, 1) > 1) {
        if (safeNumber(method.installmentValue, 0) <= 0) {
          alert(`Valor da parcela deve ser maior que zero para ${method.type}.`);
          return;
        }
        if (safeNumber(method.installmentInterval, 30) <= 0) {
          alert(`Intervalo entre parcelas deve ser maior que zero para ${method.type}.`);
          return;
        }
      }

      if (method.type === 'cheque' && method.isThirdPartyCheck && safeNumber(method.installments, 1) > 1) {
        const requiredChecks = safeNumber(method.installments, 1);
        if (!method.thirdPartyDetails || method.thirdPartyDetails.length < requiredChecks) {
          alert(`Voce deve adicionar ${requiredChecks} cheque(s) de terceiros para este metodo de pagamento.`);
          return;
        }
        for (let i = 0; i < method.thirdPartyDetails.length; i++) {
          const check = method.thirdPartyDetails[i];
          if (!check.bank || !check.agency || !check.account || !check.checkNumber || !check.issuer || !check.cpfCnpj) {
            alert(`Por favor, preencha todos os campos obrigatorios do cheque ${i + 1}.`);
            return;
          }
        }
      }

      if (method.type === 'permuta') {
        if (!method.vehicleId) {
          alert('Por favor, selecione um veiculo para a permuta.');
          return;
        }
        const selectedVehicle = availablePermutas.find(p => p.id === method.vehicleId);
        if (!selectedVehicle) {
          alert('Veiculo selecionado nao encontrado.');
          return;
        }
        if (methodAmount > selectedVehicle.remainingValue) {
          alert(`O valor da permuta excede o credito disponivel no veiculo.`);
          return;
        }
      }

      if (method.type === 'acerto') {
        if (!clienteRegistradoSelecionado) {
          alert('O método "Acerto" só pode ser usado com clientes cadastrados na aba Clientes. Selecione um cliente registrado.');
          return;
        }
      }
    }

    if (!formData.products || (typeof formData.products === 'string' && !formData.products.trim())) {
      formData.products = 'Produtos vendidos';
    }

    if (saleItems.length > 0) {
      const erros = await validarEstoqueParaItens(saleItems, estoqueProdutos);
      if (erros.length > 0) {
        const mensagem = erros.map(e =>
          `- ${e.nomeProduto} / ${e.nomeVariacao}${e.nomeCor ? ` / ${e.nomeCor}` : ''}: solicitado ${e.solicitado}, disponivel ${e.disponivel}`
        ).join('\n');
        alert(`Estoque insuficiente para os seguintes itens:\n\n${mensagem}`);
        return;
      }
    }

    const amounts = calculateAmounts();

    let finalObservations = formData.observations;
    if (formData.paymentObservations.trim()) {
      finalObservations = finalObservations
        ? `${finalObservations}\n\nDescricao do Pagamento: ${formData.paymentObservations}`
        : `Descricao do Pagamento: ${formData.paymentObservations}`;
    }

    const sellerId = !formData.sellerId || formData.sellerId.trim() === '' ? null : formData.sellerId.trim();

    const cleanedPaymentMethods = formData.paymentMethods.map(method => {
      const cleaned: PaymentMethod = { ...method };

      if (!cleaned.type) cleaned.type = 'dinheiro';
      cleaned.amount = safeNumber(cleaned.amount, 0);

      if (cleaned.installments) cleaned.installments = safeNumber(cleaned.installments, 1);
      if (cleaned.installmentValue) cleaned.installmentValue = safeNumber(cleaned.installmentValue, 0);
      if (cleaned.installmentInterval) cleaned.installmentInterval = safeNumber(cleaned.installmentInterval, 30);

      if (safeNumber(cleaned.installments, 1) === 1) {
        delete cleaned.installments;
        delete cleaned.installmentValue;
        delete cleaned.installmentInterval;
        delete cleaned.startDate;
        delete cleaned.firstInstallmentDate;
      }

      if (cleaned.type !== 'cheque') {
        delete cleaned.isOwnCheck;
        delete cleaned.isThirdPartyCheck;
        delete cleaned.thirdPartyDetails;
      }

      Object.keys(cleaned).forEach(key => {
        const value = cleaned[key as keyof PaymentMethod];
        if (typeof value === 'string' && value.trim() === '') {
          delete cleaned[key as keyof PaymentMethod];
        }
        if (Array.isArray(value) && value.length === 0) {
          delete cleaned[key as keyof PaymentMethod];
        }
      });

      return cleaned;
    });

    if (cleanedPaymentMethods.length === 0) {
      alert('Erro na validacao dos metodos de pagamento.');
      return;
    }

    const deliveryDate = !formData.deliveryDate || formData.deliveryDate.trim() === '' ? null : formData.deliveryDate;
    const cleanedObservations = !finalObservations || finalObservations.trim() === '' ? null : finalObservations.trim();
    const cleanedProducts = !formData.products || (typeof formData.products === 'string' && formData.products.trim() === '')
      ? null
      : (typeof formData.products === 'string' ? formData.products.trim() : 'Produtos vendidos');

    const saleToSubmit = {
      ...formData,
      date: parseInputDate(formData.date),
      totalValue: safeNumber(formData.totalValue, 0),
      sellerId: sellerId,
      clienteId: clienteSelecionado?.id ?? null,
      deliveryDate: deliveryDate,
      paymentMethods: cleanedPaymentMethods,
      observations: cleanedObservations,
      products: cleanedProducts,
      paymentDescription: !formData.paymentDescription || formData.paymentDescription.trim() === '' ? null : formData.paymentDescription.trim(),
      paymentObservations: !formData.paymentObservations || formData.paymentObservations.trim() === '' ? null : formData.paymentObservations.trim(),
      ...amounts
    };

    logMonetaryValues(saleToSubmit, 'Sale Form Submit');

    if (!saleToSubmit.client || safeNumber(saleToSubmit.totalValue, 0) <= 0 || !saleToSubmit.paymentMethods) {
      alert('Dados da venda incompletos. Verifique todos os campos obrigatorios.');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(saleToSubmit as Omit<Sale, 'id' | 'createdAt'>, saleItems);
    } catch (error) {
      console.error('Erro ao criar venda:', error);
      alert('Erro ao salvar a venda. Por favor, tente novamente.');
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (formData.paymentMethods.length === 1 && safeNumber(formData.paymentMethods[0].amount, 0) === 0) {
      setFormData(prev => ({
        ...prev,
        paymentMethods: [{
          ...prev.paymentMethods[0],
          amount: safeNumber(prev.totalValue, 0)
        }]
      }));
    }
  }, [formData.totalValue]);

  const vendedorNome = useMemo(() => {
    if (!formData.sellerId) return null;
    return sellers.find(s => s.id === formData.sellerId)?.name ?? null;
  }, [formData.sellerId, sellers]);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm modal-overlay">
        <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto modern-shadow-xl">
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-slate-900">
                {sale ? 'Editar Venda' : 'Nova Venda'}
              </h2>
              <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Data *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="input-field"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Data de Entrega</label>
                  <input
                    type="date"
                    value={formData.deliveryDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, deliveryDate: e.target.value }))}
                    className="input-field"
                  />
                </div>

                <div className="form-group md:col-span-2">
                  <label className="form-label">Cliente *</label>
                  {formData.client ? (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 border-2 border-blue-200 rounded-xl">
                      <div className="p-2 bg-blue-600 rounded-lg flex-shrink-0">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{formData.client}</p>
                        {vendedorNome && (
                          <p className="text-xs text-blue-600 mt-0.5">Vendedor: {vendedorNome}</p>
                        )}
                        {clienteSelecionado && !clienteSelecionado.vendedorResponsavelId && (
                          <p className="text-xs text-slate-500 mt-0.5">Vendedor responsavel: Nao se aplica</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowClienteModal(true)}
                        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium flex-shrink-0"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Alterar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowClienteModal(true)}
                      className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-all font-medium"
                    >
                      <User className="w-5 h-5" />
                      Selecionar Cliente
                    </button>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Vendedor (Opcional)</label>
                  <select
                    value={formData.sellerId || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, sellerId: e.target.value }))}
                    className="input-field"
                  >
                    <option value="">Selecionar vendedor...</option>
                    {sellers.map(seller => (
                      <option key={seller.id} value={seller.id}>
                        {seller.name} - {seller.position}
                      </option>
                    ))}
                  </select>
                  {formData.sellerId && (
                    <div className="mt-3">
                      <label className="form-label">Comissao Personalizada (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={formData.customCommissionRate}
                        onChange={(e) => setFormData(prev => ({ ...prev, customCommissionRate: parseFloat(e.target.value) || 0 }))}
                        className="input-field"
                        placeholder="5.0"
                      />
                      <p className="text-xs text-blue-600 mt-1 font-bold">
                        Comissao: R$ {((formData.totalValue * (formData.customCommissionRate || 0)) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({formData.customCommissionRate}%)
                      </p>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Valor Total da Venda *</label>
                  <CurrencyInput
                    value={safeNumber(formData.totalValue, 0)}
                    onChange={(val) => setFormData(prev => ({ ...prev, totalValue: val }))}
                    className="input-field"
                    required
                    aria-label="Valor Total da Venda"
                  />
                  {saleItems.length > 0 && (
                    <p className="text-xs text-green-600 mt-1 font-medium">
                      Total calculado dos itens: R$ {totalItens.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Produtos / Itens da Venda</h3>
                  <button
                    type="button"
                    onClick={() => setShowProdutoModal(true)}
                    className="btn-secondary flex items-center gap-2 text-sm"
                  >
                    <Package className="w-4 h-4" />
                    {saleItems.length > 0 ? 'Editar Produtos' : 'Adicionar Produtos'}
                  </button>
                </div>

                {saleItems.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-slate-700">Produto</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-700">Variacao</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-700">Cor</th>
                          <th className="text-right px-3 py-2 font-semibold text-slate-700">Qtd</th>
                          <th className="text-right px-3 py-2 font-semibold text-slate-700">Unit.</th>
                          <th className="text-right px-3 py-2 font-semibold text-slate-700">Total</th>
                          <th className="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {saleItems.map((item, idx) => {
                          const produto = estoqueProdutos.find(p => p.id === item.produtoId);
                          const variacao = produto?.variacoes.find(v => v.id === item.variacaoId);
                          const cor = item.corId ? produto?.cores.find(c => c.id === item.corId) : undefined;
                          const saldo = produto?.saldos.find(s =>
                            s.variacaoId === item.variacaoId &&
                            (item.corId ? s.corId === item.corId : !s.corId)
                          );
                          const semEstoque = item.quantidade > (saldo?.quantidadeAtual ?? 0);
                          return (
                            <tr key={idx} className={`border-b border-slate-100 ${semEstoque ? 'bg-red-50' : idx % 2 === 1 ? 'bg-slate-50' : ''}`}>
                              <td className="px-3 py-2 font-medium text-slate-900">
                                {item.nomeProduto ?? produto?.nome ?? item.produtoId}
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {item.nomeVariacao ?? variacao?.nomeVariacao ?? item.variacaoId}
                              </td>
                              <td className="px-3 py-2 text-slate-500">
                                {item.nomeCor ?? cor?.nomeCor ?? '-'}
                              </td>
                              <td className="px-3 py-2 text-right font-medium">{item.quantidade}</td>
                              <td className="px-3 py-2 text-right text-slate-600">
                                R$ {item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-green-700">
                                R$ {item.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-2 py-2">
                                {semEstoque && (
                                  <AlertTriangle className="w-4 h-4 text-red-500" title="Estoque insuficiente" />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-green-50 border-t-2 border-green-200">
                        <tr>
                          <td colSpan={5} className="px-3 py-2 font-bold text-green-800 text-right">Total dos Itens:</td>
                          <td className="px-3 py-2 text-right font-black text-green-700 text-base">
                            R$ {totalItens.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group md:col-span-2">
                  <label className="form-label">Observacoes</label>
                  <textarea
                    value={formData.observations}
                    onChange={(e) => setFormData(prev => ({ ...prev, observations: e.target.value }))}
                    className="input-field"
                    rows={2}
                    placeholder="Informacoes adicionais sobre a venda (opcional)"
                  />
                </div>

                <div className="form-group md:col-span-2">
                  <label className="form-label">Descricao sobre o Pagamento (Opcional)</label>
                  <textarea
                    value={formData.paymentObservations}
                    onChange={(e) => setFormData(prev => ({ ...prev, paymentObservations: e.target.value }))}
                    className="input-field"
                    rows={2}
                    placeholder="Informacoes especificas sobre como sera feito o pagamento (opcional)"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Metodos de Pagamento</h3>
                  <button
                    type="button"
                    onClick={addPaymentMethod}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Metodo
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.paymentMethods.map((method, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-medium">Metodo {index + 1}</h4>
                        {formData.paymentMethods.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePaymentMethod(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="form-label">Tipo de Pagamento</label>
                          <select
                            value={method.type}
                            onChange={(e) => updatePaymentMethod(index, 'type', e.target.value)}
                            className="input-field"
                          >
                            {PAYMENT_TYPES.map(type => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="form-label">Valor</label>
                          <CurrencyInput
                            value={safeNumber(method.amount, 0)}
                            onChange={(val) => updatePaymentMethod(index, 'amount', val)}
                            className="input-field"
                            aria-label={`Valor do metodo de pagamento ${index + 1}`}
                          />
                        </div>

                        {INSTALLMENT_TYPES.includes(method.type) && (
                          <>
                            <div>
                              <label className="form-label">Numero de Parcelas</label>
                              <input
                                type="number"
                                min="1"
                                value={safeNumber(method.installments, 1)}
                                onChange={(e) => updatePaymentMethod(index, 'installments', safeNumber(e.target.value, 1))}
                                className="input-field"
                              />
                            </div>

                            {safeNumber(method.installments, 1) > 1 && (
                              <>
                                <div className="md:col-span-2">
                                  <label className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={method.useCustomValues || false}
                                      onChange={(e) => updatePaymentMethod(index, 'useCustomValues', e.target.checked)}
                                      className="rounded"
                                    />
                                    <span className="form-label mb-0">Valores personalizados?</span>
                                  </label>
                                  <p className="text-xs text-blue-600 mt-1">
                                    Marque para definir valores diferentes para cada parcela
                                  </p>
                                </div>

                                {!method.useCustomValues && safeNumber(method.installments, 1) > 1 && (
                                  <div>
                                    <label className="form-label">Valor por Parcela</label>
                                    <CurrencyInput
                                      value={safeNumber(method.installmentValue, 0)}
                                      onChange={(val) => updatePaymentMethod(index, 'installmentValue', val)}
                                      className="input-field"
                                      readOnly
                                      aria-label="Valor por parcela calculado automaticamente"
                                    />
                                    <p className="text-xs text-blue-600 mt-1 font-bold">
                                      Calculado automaticamente: R$ {safeNumber(method.amount, 0) && safeNumber(method.installments, 1) ? (safeNumber(method.amount, 0) / safeNumber(method.installments, 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'} por parcela
                                    </p>
                                  </div>
                                )}

                                {method.useCustomValues && method.customInstallmentValues && (
                                  <div className="md:col-span-2">
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                                      <h4 className="font-semibold text-blue-900 mb-3">
                                        Valores de Cada Parcela
                                      </h4>
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {method.customInstallmentValues.map((value, installmentIndex) => (
                                          <div key={installmentIndex}>
                                            <label className="text-xs font-medium text-blue-700">
                                              Parcela {installmentIndex + 1}
                                            </label>
                                            <CurrencyInput
                                              value={safeNumber(value, 0)}
                                              onChange={(val) => updateCustomInstallmentValue(index, installmentIndex, val)}
                                              className="input-field text-sm"
                                              aria-label={`Valor da parcela ${installmentIndex + 1}`}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                      <p className="text-xs text-blue-600 mt-3 font-bold">
                                        Total das parcelas: R$ {method.customInstallmentValues.reduce((sum, val) => sum + safeNumber(val, 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                <div>
                                  <label className="form-label">Intervalo (dias)</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={safeNumber(method.installmentInterval, 30)}
                                    onChange={(e) => updatePaymentMethod(index, 'installmentInterval', safeNumber(e.target.value, 30))}
                                    className="input-field"
                                    placeholder="30"
                                  />
                                </div>

                                <div>
                                  <label className="form-label">Data da Primeira Parcela</label>
                                  <input
                                    type="date"
                                    value={method.firstInstallmentDate || formData.date}
                                    onChange={(e) => updatePaymentMethod(index, 'firstInstallmentDate', e.target.value)}
                                    className="input-field"
                                  />
                                </div>
                              </>
                            )}

                            {(method.type === 'cheque' || method.type === 'boleto') && safeNumber(method.installments, 1) === 1 && (
                              <div>
                                <label className="form-label">Data de Vencimento/Pagamento *</label>
                                <input
                                  type="date"
                                  value={method.firstInstallmentDate || getCurrentDateString()}
                                  onChange={(e) => updatePaymentMethod(index, 'firstInstallmentDate', e.target.value)}
                                  className="input-field"
                                  required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  Data em que o {method.type === 'cheque' ? 'cheque' : 'boleto'} sera pago/vencera
                                </p>
                              </div>
                            )}
                          </>
                        )}

                        {method.type === 'acerto' && (
                          <div className="md:col-span-2">
                            {clienteRegistradoSelecionado ? (
                              <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border-2 border-blue-300">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-blue-600 rounded-lg flex-shrink-0">
                                    <User className="w-4 h-4 text-white" />
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-blue-900">Acerto vinculado a:</h4>
                                    <p className="text-blue-700 font-semibold">{formData.client}</p>
                                    <p className="text-xs text-blue-600 mt-0.5">
                                      A venda será automaticamente registrada no histórico de acertos deste cliente.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="p-4 bg-amber-50 rounded-xl border-2 border-amber-300">
                                <div className="flex items-start gap-3">
                                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <h4 className="font-bold text-amber-900">Cliente obrigatório</h4>
                                    <p className="text-sm text-amber-700 mt-1">
                                      O método "Acerto" requer um cliente cadastrado. Selecione um cliente registrado na aba Clientes antes de usar este método.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {method.type === 'permuta' && (
                          <div className="md:col-span-2">
                            <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border-2 border-slate-300">
                              <h4 className="font-bold text-slate-900 mb-3">Permuta (Troca de Veiculo)</h4>
                              {availablePermutas.length > 0 ? (
                                <select
                                  value={method.vehicleId || ''}
                                  onChange={(e) => updatePaymentMethod(index, 'vehicleId', e.target.value)}
                                  className="input-field bg-white border-2 border-slate-300 focus:border-slate-500"
                                  required
                                >
                                  <option value="">Selecione um veiculo com credito...</option>
                                  {availablePermutas.map(permuta => (
                                    <option key={permuta.id} value={permuta.id}>
                                      {permuta.vehicleMake} {permuta.vehicleModel} {permuta.vehicleYear} ({permuta.vehiclePlate}) - Disponivel: R$ {permuta.remainingValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <p className="text-sm text-yellow-700">Nenhum veiculo disponivel para permuta. Cadastre na aba Permutas.</p>
                              )}
                            </div>
                          </div>
                        )}

                        {method.type === 'cheque' && (
                          <>
                            <div className="md:col-span-2">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={method.isThirdPartyCheck || false}
                                  onChange={(e) => updatePaymentMethod(index, 'isThirdPartyCheck', e.target.checked)}
                                  className="rounded"
                                />
                                <span className="form-label mb-0">Cheques de Terceiros</span>
                              </label>
                            </div>

                            {method.isThirdPartyCheck && method.installments && method.installments > 1 && (
                              <div className="md:col-span-2">
                                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                      <Info className="w-5 h-5 text-amber-600" />
                                      <h4 className="font-bold text-amber-900">
                                        Cheques de Terceiros ({safeNumber(method.installments, 1)} cheques)
                                      </h4>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => addThirdPartyCheck(index)}
                                      className="btn-secondary text-xs py-1 px-3"
                                    >
                                      + Adicionar Cheque
                                    </button>
                                  </div>

                                  {(!method.thirdPartyDetails || method.thirdPartyDetails.length < (method.installments || 1)) && (
                                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
                                      <p className="text-sm text-yellow-700 font-medium">
                                        Adicione {safeNumber(method.installments, 1) - (method.thirdPartyDetails?.length || 0)} cheque(s) de terceiros para continuar
                                      </p>
                                    </div>
                                  )}

                                  <div>
                                    {(method.thirdPartyDetails || []).map((check, checkIndex) => {
                                      const checkDueDate = method.firstInstallmentDate
                                        ? (() => {
                                            const d = new Date(method.firstInstallmentDate + 'T00:00:00');
                                            d.setDate(d.getDate() + checkIndex * safeNumber(method.installmentInterval, 30));
                                            return d.toISOString().split('T')[0];
                                          })()
                                        : undefined;
                                      return (
                                        <ThirdPartyCheckVisual
                                          key={checkIndex}
                                          check={check}
                                          checkIndex={checkIndex}
                                          checkNumber={checkIndex + 1}
                                          totalChecks={safeNumber(method.installments, 1)}
                                          amount={safeNumber(method.installmentValue, 0) || (safeNumber(method.amount, 0) / safeNumber(method.installments, 1))}
                                          dueDate={checkDueDate}
                                          onUpdate={(field, value) => updateThirdPartyCheck(index, checkIndex, field, value)}
                                          onRemove={() => removeThirdPartyCheck(index, checkIndex)}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {method.type === 'cheque' && !method.isThirdPartyCheck && (
                          <div className="md:col-span-2">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={method.isOwnCheck || false}
                                onChange={(e) => updatePaymentMethod(index, 'isOwnCheck', e.target.checked)}
                                className="rounded"
                              />
                              <span className="form-label mb-0">Cheque Proprio</span>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200 modern-shadow-xl">
                <h3 className="text-xl font-black text-green-800 mb-4">Resumo da Venda</h3>
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <span className="text-green-600 font-semibold block mb-1">Total:</span>
                    <p className="text-2xl font-black text-green-800">
                      R$ {safeNumber(formData.totalValue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-center">
                    <span className="text-green-600 font-semibold block mb-1">Recebido:</span>
                    <p className="text-2xl font-black text-green-600">
                      R$ {safeNumber(calculateAmounts().receivedAmount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-center">
                    <span className="text-green-600 font-semibold block mb-1">Pendente:</span>
                    <p className="text-2xl font-black text-orange-600">
                      R$ {safeNumber(calculateAmounts().pendingAmount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onCancel}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`btn-primary group ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? 'Salvando...' : (sale ? 'Atualizar Venda' : 'Criar Venda')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {showClienteModal && (
        <ClienteSelectorModal
          onSelect={handleClienteSelect}
          onClose={() => setShowClienteModal(false)}
        />
      )}

      {showProdutoModal && (
        <ProdutoSelectorModal
          itensExistentes={saleItems}
          onConfirm={setSaleItems}
          onClose={() => setShowProdutoModal(false)}
        />
      )}
    </>
  );
}
