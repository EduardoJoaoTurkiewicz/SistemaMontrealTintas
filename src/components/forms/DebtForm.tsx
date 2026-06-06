import React, { useState } from 'react';
import { X, Plus, Trash2, Info } from 'lucide-react';
import { Debt, PaymentMethod } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { safeNumber, logMonetaryValues } from '../../utils/numberUtils';
import { formatDateForInput, parseInputDate } from '../../utils/dateUtils';
import { getCurrentDateString } from '../../utils/dateUtils';
import { CurrencyInput } from '../CurrencyInput';

interface DebtFormProps {
  debt?: Debt | null;
  onSubmit: (debt: Omit<Debt, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}

const PAYMENT_TYPES = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'acerto', label: 'Acerto (Pagamento Mensal)' }
];

export function DebtForm({ debt, onSubmit, onCancel }: DebtFormProps) {
  const { checks, fornecedores } = useAppContext();

  // Get available checks (from sales, not used in debts, not discounted, and status is pending)
  const availableChecks = checks.filter(check =>
    check.saleId &&
    !check.debtId &&
    !check.usedInDebt &&
    !check.is_discounted &&
    check.status === 'pendente'
  );

  const [formData, setFormData] = useState({
    date: debt?.date || getCurrentDateString(),
    description: debt?.description || '',
    company: debt?.company || '',
    totalValue: safeNumber(debt?.totalValue, 0),
    paymentMethods: (debt?.paymentMethods || [{ type: 'dinheiro' as const, amount: 0 }]).map(method => ({
      ...method,
      amount: safeNumber(method.amount, 0),
      installmentValue: safeNumber(method.installmentValue, 0),
      installments: safeNumber(method.installments, 1),
      installmentInterval: safeNumber(method.installmentInterval, 30),
      useCustomValues: method.useCustomValues || false,
      customInstallmentValues: method.customInstallmentValues || [],
      selectedChecks: method.selectedChecks || []
    })),
    paymentDescription: debt?.paymentDescription || '',
    debtPaymentDescription: debt?.debtPaymentDescription || '',
    fornecedorId: debt?.fornecedorId || '',
    hasNotaFiscal: debt?.hasNotaFiscal ?? false
  });

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

          // Sanitize numeric values
          if (field === 'amount') {
            updatedMethod.amount = safeNumber(value, 0);
          }
          if (field === 'installments') {
            updatedMethod.installments = safeNumber(value, 1);
            // Initialize custom values array when installments change
            if (updatedMethod.useCustomValues) {
              const newInstallments = safeNumber(value, 1);
              const installmentValue = safeNumber(method.amount, 0) / newInstallments;
              updatedMethod.customInstallmentValues = Array(newInstallments).fill(installmentValue);
            }
          }
          if (field === 'installmentInterval') {
            updatedMethod.installmentInterval = safeNumber(value, 30);
          }

          // Handle custom values toggle
          if (field === 'useCustomValues') {
            if (value) {
              // Initialize custom values array with equal distribution
              const numInstallments = safeNumber(method.installments, 1);
              const installmentValue = safeNumber(method.amount, 0) / numInstallments;
              updatedMethod.customInstallmentValues = Array(numInstallments).fill(installmentValue);
            } else {
              // Clear custom values
              updatedMethod.customInstallmentValues = [];
            }
          }

          // Calculate installment value when installments change (for non-custom mode)
          if (field === 'installments' && safeNumber(value, 1) > 1 && !updatedMethod.useCustomValues) {
            updatedMethod.installmentValue = safeNumber(method.amount, 0) / safeNumber(value, 1);
          } else if (field === 'amount' && safeNumber(method.installments, 1) > 1 && !updatedMethod.useCustomValues) {
            // Recalculate installment value when amount changes
            updatedMethod.installmentValue = safeNumber(value, 0) / safeNumber(method.installments, 1);
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
          return {
            ...method,
            customInstallmentValues: newCustomValues
          };
        }
        return method;
      })
    }));
  };

  const toggleCheckSelection = (methodIndex: number, checkId: string) => {
    setFormData(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map((method, i) => {
        if (i === methodIndex) {
          const selectedChecks = method.selectedChecks || [];
          const isSelected = selectedChecks.includes(checkId);
          return {
            ...method,
            selectedChecks: isSelected
              ? selectedChecks.filter(id => id !== checkId)
              : [...selectedChecks, checkId]
          };
        }
        return method;
      })
    }));
  };

  const calculateAmounts = () => {
    const totalPaid = formData.paymentMethods.reduce((sum, method) => {
      const methodAmount = safeNumber(method.amount, 0);
      if (['dinheiro', 'pix', 'cartao_debito', 'transferencia'].includes(method.type)) {
        return sum + methodAmount;
      }
      if (method.type === 'cartao_credito' && safeNumber(method.installments, 1) === 1) {
        return sum + methodAmount;
      }
      if (method.type === 'cheque' && method.selectedChecks && method.selectedChecks.length > 0) {
        const totalSelectedChecks = method.selectedChecks.reduce((checkSum, checkId) => {
          const check = availableChecks.find(c => c.id === checkId);
          return checkSum + (check ? check.value : 0);
        }, 0);
        return sum + totalSelectedChecks;
      }
      return sum;
    }, 0);

    const totalValue = safeNumber(formData.totalValue, 0);
    const pending = totalValue - totalPaid;

    return {
      paidAmount: totalPaid,
      pendingAmount: Math.max(0, pending),
      isPaid: pending <= 0.01
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.company || !formData.company.trim()) {
      alert('Por favor, informe o nome da empresa.');
      return;
    }
    
    if (!formData.description || !formData.description.trim()) {
      alert('Por favor, informe a descrição da dívida.');
      return;
    }
    
    const totalValue = safeNumber(formData.totalValue, 0);
    if (totalValue <= 0) {
      alert('O valor total da dívida deve ser maior que zero.');
      return;
    }
    
    if (!formData.paymentMethods || formData.paymentMethods.length === 0) {
      alert('Por favor, adicione pelo menos um método de pagamento.');
      return;
    }
    
    const totalPaymentAmount = formData.paymentMethods.reduce((sum, method) => sum + safeNumber(method.amount, 0), 0);
    if (totalPaymentAmount === 0) {
      alert('Por favor, informe pelo menos um método de pagamento com valor maior que zero.');
      return;
    }
    
    if (totalPaymentAmount > totalValue) {
      alert('O total dos métodos de pagamento não pode ser maior que o valor total da dívida.');
      return;
    }
    
    // Validar estrutura dos métodos de pagamento
    for (const method of formData.paymentMethods) {
      if (!method.type || typeof method.type !== 'string') {
        alert('Todos os métodos de pagamento devem ter um tipo válido.');
        return;
      }
      const methodAmount = safeNumber(method.amount, 0);
      if (methodAmount < 0) {
        alert('Todos os métodos de pagamento devem ter um valor válido.');
        return;
      }
    }
    
    // Clean payment methods data
    const cleanedPaymentMethods = formData.paymentMethods.map(method => {
      const cleaned: PaymentMethod = { ...method };
      
      // Garantir campos obrigatórios
      if (!cleaned.type) cleaned.type = 'dinheiro';
      cleaned.amount = safeNumber(cleaned.amount, 0);
      
      // Sanitize numeric fields
      if (cleaned.installments) cleaned.installments = safeNumber(cleaned.installments, 1);
      if (cleaned.installmentValue) cleaned.installmentValue = safeNumber(cleaned.installmentValue, 0);
      if (cleaned.installmentInterval) cleaned.installmentInterval = safeNumber(cleaned.installmentInterval, 30);
      
      // Limpar campos opcionais vazios
      if (cleaned.installments === 1) {
        delete cleaned.installments;
        delete cleaned.installmentValue;
        delete cleaned.installmentInterval;
      }
      
      // Limpar strings vazias
      Object.keys(cleaned).forEach(key => {
        const value = cleaned[key as keyof PaymentMethod];
        if (typeof value === 'string' && value.trim() === '') {
          delete cleaned[key as keyof PaymentMethod];
        }
        // Clean UUID fields specifically
        if ((key.endsWith('Id') || key.endsWith('_id')) && (value === '' || value === 'null' || value === 'undefined')) {
          cleaned[key as keyof PaymentMethod] = null;
        }
      });
      
      return cleaned;
    });
    
    const amounts = calculateAmounts();
    
    // Add payment description to observations if provided
    let finalPaymentDescription = formData.paymentDescription;
    if (formData.debtPaymentDescription.trim()) {
      finalPaymentDescription = finalPaymentDescription 
        ? `${finalPaymentDescription}\n\nDescrição do Pagamento: ${formData.debtPaymentDescription}`
        : `Descrição do Pagamento: ${formData.debtPaymentDescription}`;
    }
    
    // Garantir que campos opcionais sejam null se vazios
    const paymentDescription = !finalPaymentDescription || finalPaymentDescription.trim() === '' ? null : finalPaymentDescription;
    const debtPaymentDescription = !formData.debtPaymentDescription || formData.debtPaymentDescription.trim() === '' ? null : formData.debtPaymentDescription;
    
    const debtToSubmit = {
      ...formData,
      date: parseInputDate(formData.date),
      totalValue: safeNumber(formData.totalValue, 0),
      paymentMethods: cleanedPaymentMethods,
      paymentDescription,
      debtPaymentDescription,
      fornecedorId: formData.fornecedorId || null,
      hasNotaFiscal: formData.hasNotaFiscal,
      ...amounts
    };
    
    logMonetaryValues(debtToSubmit, 'Debt Form Submit');
    
    console.log('📝 Enviando dívida:', debtToSubmit);
    onSubmit(debtToSubmit as Omit<Debt, 'id' | 'createdAt'>);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm modal-overlay">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto modern-shadow-xl">
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-slate-900">
              {debt ? 'Editar Dívida' : 'Nova Dívida'}
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
                <label className="form-label">Empresa *</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                  className="input-field"
                  placeholder="Nome da empresa"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Fornecedor (opcional)</label>
                <select
                  value={formData.fornecedorId}
                  onChange={(e) => setFormData(prev => ({ ...prev, fornecedorId: e.target.value }))}
                  className="input-field"
                >
                  <option value="">— Nenhum —</option>
                  {fornecedores.filter(f => f.status === 'Ativo').map(f => (
                    <option key={f.id} value={f.id}>
                      {f.nomeFantasia || f.razaoSocial}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.hasNotaFiscal}
                    onChange={(e) => setFormData(prev => ({ ...prev, hasNotaFiscal: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-semibold text-slate-700">Possui Nota Fiscal</span>
                </label>
              </div>

              <div className="form-group md:col-span-2">
                <label className="form-label">Descrição *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="input-field"
                  rows={3}
                  placeholder="Descrição da dívida..."
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Valor Total *</label>
                <CurrencyInput
                  value={safeNumber(formData.totalValue, 0)}
                  onChange={(val) => setFormData(prev => ({ ...prev, totalValue: val }))}
                  className="input-field"
                  required
                  aria-label="Valor Total da Dívida"
                />
              </div>

              <div className="form-group md:col-span-2">
                <label className="form-label">Descrição sobre o Pagamento (Opcional)</label>
                <textarea
                  value={formData.debtPaymentDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, debtPaymentDescription: e.target.value }))}
                  className="input-field"
                  rows={2}
                  placeholder="Informações específicas sobre como será feito o pagamento (opcional)"
                />
              </div>
            </div>

            {/* Payment Methods */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Métodos de Pagamento</h3>
                <button
                  type="button"
                  onClick={addPaymentMethod}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Método
                </button>
              </div>

              <div className="space-y-4">
                {formData.paymentMethods.map((method, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-medium">Método {index + 1}</h4>
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
                          aria-label={`Valor do método de pagamento ${index + 1}`}
                        />
                      </div>
                     
                     {(method.type === 'cheque' || method.type === 'boleto') && (
                       <>
                         <div>
                           <label className="form-label">Número de Parcelas</label>
                           <input
                             type="number"
                             min="1"
                             max="24"
                             value={safeNumber(method.installments, 1)}
                             onChange={(e) => updatePaymentMethod(index, 'installments', safeNumber(e.target.value, 1))}
                             className="input-field"
                             placeholder="1"
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
                                   className="input-field bg-gray-50"
                                   readOnly
                                   aria-label="Valor por parcela calculado automaticamente"
                                 />
                                 <p className="text-xs text-blue-600 mt-1 font-bold">
                                   ✓ Calculado automaticamente: R$ {(safeNumber(method.amount, 0) / safeNumber(method.installments, 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                 </p>
                               </div>
                             )}

                             {method.useCustomValues && method.customInstallmentValues && (
                               <div className="md:col-span-2">
                                 <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                                   <h4 className="font-semibold text-red-900 mb-3">
                                     Valores de Cada Parcela
                                   </h4>
                                   <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                     {method.customInstallmentValues.map((value, installmentIndex) => (
                                       <div key={installmentIndex}>
                                         <label className="text-xs font-medium text-red-700">
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
                                   <p className="text-xs text-red-600 mt-3 font-bold">
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

                         {safeNumber(method.installments, 1) === 1 && (
                           <div>
                             <label className="form-label">Data de Vencimento/Pagamento *</label>
                             <input
                               type="date"
                               value={method.firstInstallmentDate || formData.date}
                               onChange={(e) => updatePaymentMethod(index, 'firstInstallmentDate', e.target.value)}
                               className="input-field"
                               required
                             />
                             <p className="text-xs text-gray-500 mt-1">
                               Data em que o {method.type === 'cheque' ? 'cheque' : 'boleto'} será pago/vencerá
                             </p>
                           </div>
                         )}

                         {method.type === 'cheque' && availableChecks.length > 0 && (
                           <div className="md:col-span-2">
                             <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                               <div className="flex items-center gap-2 mb-3">
                                 <Info className="w-5 h-5 text-yellow-600" />
                                 <h4 className="font-semibold text-yellow-900">
                                   Usar Cheques Recebidos de Clientes
                                 </h4>
                               </div>
                               <p className="text-xs text-yellow-700 mb-3">
                                 Você pode usar cheques recebidos de vendas para pagar esta dívida. Selecione os cheques abaixo:
                               </p>
                               <div className="space-y-2 max-h-60 overflow-y-auto">
                                 {availableChecks.map(check => (
                                   <label key={check.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-yellow-100 hover:bg-yellow-50 cursor-pointer">
                                     <input
                                       type="checkbox"
                                       checked={method.selectedChecks?.includes(check.id) || false}
                                       onChange={() => toggleCheckSelection(index, check.id)}
                                       className="rounded"
                                     />
                                     <div className="flex-1">
                                       <div className="flex justify-between items-start">
                                         <div>
                                           <p className="font-medium text-slate-900">{check.client}</p>
                                           <p className="text-xs text-slate-600">
                                             Vencimento: {new Date(check.dueDate).toLocaleDateString('pt-BR')}
                                           </p>
                                           <p className="text-xs text-slate-600">
                                             Parcela {check.installmentNumber}/{check.totalInstallments}
                                           </p>
                                         </div>
                                         <div className="text-right">
                                           <p className="font-bold text-yellow-600">
                                             R$ {check.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                           </p>
                                           <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                                             {check.status === 'compensado' ? 'Compensado' : 'Pendente'}
                                           </span>
                                         </div>
                                       </div>
                                     </div>
                                   </label>
                                 ))}
                               </div>
                               {method.selectedChecks && method.selectedChecks.length > 0 && (
                                 <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
                                   <p className="text-xs text-green-700 font-bold">
                                     ✓ {method.selectedChecks.length} cheque(s) selecionado(s) - Total: R$ {
                                       availableChecks
                                         .filter(c => method.selectedChecks?.includes(c.id))
                                         .reduce((sum, c) => sum + c.value, 0)
                                         .toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                                     }
                                   </p>
                                 </div>
                               )}
                             </div>
                           </div>
                         )}
                       </>
                     )}

                     {method.type === 'cartao_credito' && (
                       <>
                         <div>
                           <label className="form-label">Número de Parcelas</label>
                           <input
                             type="number"
                             min="1"
                             max="48"
                             value={safeNumber(method.installments, 1)}
                             onChange={(e) => updatePaymentMethod(index, 'installments', safeNumber(e.target.value, 1))}
                             className="input-field"
                             placeholder="1"
                           />
                         </div>

                         {safeNumber(method.installments, 1) > 1 && (
                           <>
                             <div>
                               <label className="form-label">Valor por Parcela</label>
                               <input
                                 type="text"
                                 readOnly
                                 value={`R$ ${(safeNumber(method.amount, 0) / safeNumber(method.installments, 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                 className="input-field bg-slate-50 text-slate-600"
                               />
                             </div>

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
                           </>
                         )}

                         <div>
                           <label className="form-label">Data da Primeira Parcela</label>
                           <input
                             type="date"
                             value={method.firstInstallmentDate || formData.date}
                             onChange={(e) => updatePaymentMethod(index, 'firstInstallmentDate', e.target.value)}
                             className="input-field"
                           />
                         </div>

                         <div className="md:col-span-2">
                           <div className="p-3 bg-sky-50 rounded-xl border border-sky-200">
                             <p className="text-sm text-sky-800">
                               {safeNumber(method.installments, 1) > 1
                                 ? `${safeNumber(method.installments, 1)}x de R$ ${(safeNumber(method.amount, 0) / safeNumber(method.installments, 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — As parcelas serão gerenciadas na aba Cartão de Crédito.`
                                 : 'Pagamento à vista no cartão — será registrado como pago imediatamente.'
                               }
                             </p>
                           </div>
                         </div>
                       </>
                     )}

                     {method.type === 'acerto' && (
                       <div className="md:col-span-2">
                         <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                           <p className="text-sm text-red-800 font-semibold">
                             💡 Acerto: Este valor será adicionado ao acerto mensal da empresa "{formData.company}"
                           </p>
                           <p className="text-xs text-red-600 mt-1">
                             A empresa pagará este valor junto com outras dívidas em acerto no final do mês
                           </p>
                         </div>
                       </div>
                     )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="p-6 bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl border-2 border-red-200 modern-shadow-xl">
              <h3 className="text-xl font-black text-red-800 mb-4">
                Resumo da Dívida
              </h3>
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <span className="text-red-600 font-semibold block mb-1">Total:</span>
                  <p className="text-2xl font-black text-red-800">
                    R$ {safeNumber(formData.totalValue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-center">
                  <span className="text-red-600 font-semibold block mb-1">Pago:</span>
                  <p className="text-2xl font-black text-green-600">
                    R$ {safeNumber(calculateAmounts().paidAmount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-center">
                  <span className="text-red-600 font-semibold block mb-1">Pendente:</span>
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
                className="btn-primary group"
              >
                {debt ? 'Atualizar Dívida' : 'Criar Dívida'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}