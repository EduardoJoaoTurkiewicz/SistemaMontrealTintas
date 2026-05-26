import React, { useState, useEffect } from 'react';
import { X, Users, Building2, Calculator } from 'lucide-react';
import { Acerto } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { CurrencyInput } from '../CurrencyInput';

interface AcertoFormProps {
  acerto?: Acerto | null;
  defaultType?: 'cliente' | 'empresa';
  onSubmit: (acerto: Omit<Acerto, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}

export function AcertoForm({ acerto, defaultType, onSubmit, onCancel }: AcertoFormProps) {
  const { sales, debts } = useAppContext();
  const [formData, setFormData] = useState({
    clientName: acerto?.clientName || '',
    companyName: acerto?.companyName || '',
    type: acerto?.type || defaultType || 'empresa' as const,
    totalAmount: acerto?.totalAmount || 0,
    paidAmount: acerto?.paidAmount || 0,
    pendingAmount: acerto?.pendingAmount || 0,
    status: acerto?.status || 'pendente' as const,
    observations: acerto?.observations || ''
  });

  // Auto-calculate total amount based on sales/debts with "acerto" payment method
  useEffect(() => {
    if (!acerto) {
      let calculatedTotal = 0;

      if (formData.type === 'cliente' && formData.clientName) {
        const relatedSales = sales.filter(sale =>
          sale.client.toLowerCase().trim() === formData.clientName.toLowerCase().trim() &&
          sale.paymentMethods?.some(method => method.type === 'acerto')
        );

        calculatedTotal = relatedSales.reduce((sum, sale) => {
          const acertoMethods = sale.paymentMethods?.filter(method => method.type === 'acerto') || [];
          const acertoAmount = acertoMethods.reduce((methodSum, method) => methodSum + (method.amount || 0), 0);
          return sum + acertoAmount;
        }, 0);
      } else if (formData.type === 'empresa' && formData.companyName) {
        const relatedDebts = debts.filter(debt =>
          debt.company.toLowerCase().trim() === formData.companyName.toLowerCase().trim() &&
          debt.paymentMethods?.some(method => method.type === 'acerto')
        );

        calculatedTotal = relatedDebts.reduce((sum, debt) => {
          const acertoMethods = debt.paymentMethods?.filter(method => method.type === 'acerto') || [];
          const acertoAmount = acertoMethods.reduce((methodSum, method) => methodSum + (method.amount || 0), 0);
          return sum + acertoAmount;
        }, 0);
      }

      if (calculatedTotal > 0) {
        setFormData(prev => ({ ...prev, totalAmount: calculatedTotal }));
      }
    }
  }, [formData.type, formData.clientName, formData.companyName, sales, debts, acerto]);

  // Auto-calculate pending amount
  React.useEffect(() => {
    const pending = Math.max(0, formData.totalAmount - formData.paidAmount);
    const status = formData.paidAmount >= formData.totalAmount ? 'pago' : 
                  formData.paidAmount > 0 ? 'parcial' : 'pendente';
    
    setFormData(prev => ({ 
      ...prev, 
      pendingAmount: pending,
      status: status as Acerto['status']
    }));
  }, [formData.totalAmount, formData.paidAmount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const nameField = formData.type === 'empresa' ? formData.companyName : formData.clientName;
    if (!nameField || !nameField.trim()) {
      alert(`Por favor, informe o nome ${formData.type === 'empresa' ? 'da empresa' : 'do cliente'}.`);
      return;
    }
    
    if (!formData.totalAmount || formData.totalAmount <= 0) {
      alert('O valor total do acerto deve ser maior que zero.');
      return;
    }
    
    if (formData.paidAmount < 0) {
      alert('O valor pago não pode ser negativo.');
      return;
    }
    
    if (formData.paidAmount > formData.totalAmount) {
      alert('O valor pago não pode ser maior que o valor total.');
      return;
    }
    
    // Clean data
    const cleanedData = {
      ...formData,
      clientName: formData.type === 'cliente' ? formData.clientName.trim() : formData.companyName?.trim() || '',
      companyName: formData.type === 'empresa' ? formData.companyName?.trim() : undefined,
      observations: !formData.observations || formData.observations.trim() === '' ? null : formData.observations.trim()
    };
    
    console.log('📝 Enviando acerto:', cleanedData);
    onSubmit(cleanedData as Omit<Acerto, 'id' | 'createdAt'>);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm modal-overlay">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto modern-shadow-xl">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900">
              {acerto ? 'Editar Acerto' : 'Novo Acerto'}
            </h2>
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-group md:col-span-2">
                <label className="form-label">Tipo de Acerto *</label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`
                    flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-300
                    ${formData.type === 'cliente' 
                      ? 'border-indigo-300 bg-indigo-50' 
                      : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/50'
                    }
                  `}>
                    <input
                      type="radio"
                      name="type"
                      value="cliente"
                      checked={formData.type === 'cliente'}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'cliente' | 'empresa' }))}
                      className="sr-only"
                    />
                    <div className="p-2 rounded-lg bg-indigo-600">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-indigo-800">Cliente</p>
                      <p className="text-sm text-indigo-600">Acerto de vendas</p>
                    </div>
                  </label>
                  
                  <label className={`
                    flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-300
                    ${formData.type === 'empresa' 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-slate-200 bg-white hover:border-red-200 hover:bg-red-50/50'
                    }
                  `}>
                    <input
                      type="radio"
                      name="type"
                      value="empresa"
                      checked={formData.type === 'empresa'}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'cliente' | 'empresa' }))}
                      className="sr-only"
                    />
                    <div className="p-2 rounded-lg bg-red-600">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-red-800">Empresa</p>
                      <p className="text-sm text-red-600">Acerto de dívidas</p>
                    </div>
                  </label>
                </div>
              </div>

              {formData.type === 'cliente' ? (
                <div className="form-group md:col-span-2">
                  <label className="form-label">Nome do Cliente *</label>
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                    className="input-field"
                    placeholder="Nome do cliente"
                    required
                  />
                  <p className="text-xs text-indigo-600 mt-1 font-semibold">
                    💡 Este nome deve ser exatamente igual ao usado nas vendas
                  </p>
                </div>
              ) : (
                <div className="form-group md:col-span-2">
                  <label className="form-label">Nome da Empresa *</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                    className="input-field"
                    placeholder="Nome da empresa"
                    required
                  />
                  <p className="text-xs text-red-600 mt-1 font-semibold">
                    💡 Este nome deve ser exatamente igual ao usado nas dívidas
                  </p>
                </div>
              )}

              <div className="form-group md:col-span-2">
                <label className="form-label">Valor Total do Acerto *</label>
                <CurrencyInput
                  value={formData.totalAmount}
                  onChange={(val) => setFormData(prev => ({ ...prev, totalAmount: val }))}
                  className="input-field bg-gray-50"
                  required
                  readOnly={!acerto}
                  aria-label="Valor Total do Acerto calculado automaticamente"
                />
                {!acerto && formData.totalAmount > 0 && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-green-600" />
                    <p className="text-xs text-green-700 font-semibold">
                      Valor calculado automaticamente com base nas vendas/dívidas em acerto
                    </p>
                  </div>
                )}
                {!acerto && formData.totalAmount === 0 && (formData.clientName || formData.companyName) && (
                  <p className="text-xs text-yellow-600 mt-1 font-semibold">
                    Nenhuma venda/dívida em acerto encontrada para este {formData.type === 'cliente' ? 'cliente' : 'fornecedor'}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Valor Já Pago</label>
                <CurrencyInput
                  value={formData.paidAmount}
                  onChange={(val) => setFormData(prev => ({ ...prev, paidAmount: val }))}
                  className="input-field"
                  max={formData.totalAmount}
                  aria-label="Valor já pago do acerto"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Valor Pendente</label>
                <CurrencyInput
                  value={formData.pendingAmount}
                  onChange={() => {}}
                  className="input-field bg-gray-50"
                  readOnly
                  aria-label="Valor pendente calculado automaticamente"
                />
                <p className="text-xs text-green-600 mt-1 font-bold">
                  ✓ Calculado automaticamente
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <input
                  type="text"
                  value={getStatusLabel(formData.status)}
                  className="input-field bg-gray-50"
                  readOnly
                />
                <p className="text-xs text-blue-600 mt-1 font-bold">
                  ✓ Atualizado automaticamente baseado nos valores
                </p>
              </div>

              <div className="form-group md:col-span-2">
                <label className="form-label">Observações</label>
                <textarea
                  value={formData.observations}
                  onChange={(e) => setFormData(prev => ({ ...prev, observations: e.target.value }))}
                  className="input-field"
                  rows={3}
                  placeholder="Observações sobre o acerto (opcional)"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border-2 border-indigo-200 modern-shadow-xl">
              <h3 className="text-xl font-black text-indigo-800 mb-4">Resumo do Acerto</h3>
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <span className="text-indigo-600 font-semibold block mb-1">Total:</span>
                  <p className="text-2xl font-black text-indigo-800">
                    R$ {formData.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-center">
                  <span className="text-indigo-600 font-semibold block mb-1">Pago:</span>
                  <p className="text-2xl font-black text-green-600">
                    R$ {formData.paidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-center">
                  <span className="text-indigo-600 font-semibold block mb-1">Pendente:</span>
                  <p className="text-2xl font-black text-orange-600">
                    R$ {formData.pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <div className="mt-4 text-center">
                <span className={`px-4 py-2 rounded-full text-sm font-bold border ${getStatusColor(formData.status)}`}>
                  Status: {getStatusLabel(formData.status)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t border-slate-200">
              <button type="button" onClick={onCancel} className="btn-secondary">
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                {acerto ? 'Atualizar' : 'Criar'} Acerto
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status: Acerto['status']) {
  switch (status) {
    case 'pago': return 'bg-green-100 text-green-800 border-green-200';
    case 'parcial': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default: return 'bg-red-100 text-red-800 border-red-200';
  }
}

function getStatusLabel(status: Acerto['status']) {
  switch (status) {
    case 'pago': return 'Pago';
    case 'parcial': return 'Parcial';
    default: return 'Pendente';
  }
}