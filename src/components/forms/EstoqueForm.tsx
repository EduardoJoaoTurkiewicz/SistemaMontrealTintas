import React, { useState } from 'react';
import { X, Plus, Trash2, Package, Info, AlertCircle, RefreshCw } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import type { EstoqueProdutoCompleto } from '../../types';

interface VariacaoInput {
  id: string;
  nomeVariacao: string;
  valorUnitarioPadrao: string;
  descricao: string;
  validadeMeses: string;
}

interface EstoqueFormProps {
  produto?: EstoqueProdutoCompleto;
  onClose: () => void;
  onSuccess: () => void;
}

const EstoqueForm: React.FC<EstoqueFormProps> = ({ produto, onClose, onSuccess }) => {
  const { createEstoqueProduto, updateEstoqueProduto } = useAppContext();
  const isEditing = !!produto;

  const [nome, setNome] = useState(produto?.nome || '');
  const [descricao, setDescricao] = useState(produto?.descricao || '');
  const [semCor, setSemCor] = useState(!produto ? false : !produto.temCor);
  const [cores, setCores] = useState<string[]>(
    produto?.temCor && produto.cores.length > 0
      ? produto.cores.map(c => c.nomeCor)
      : ['']
  );
  const [variacoes, setVariacoes] = useState<VariacaoInput[]>(
    produto && produto.variacoes.length > 0
      ? produto.variacoes.map(v => ({
          id: v.id,
          nomeVariacao: v.nomeVariacao,
          valorUnitarioPadrao: String(v.valorUnitarioPadrao),
          descricao: v.descricao || '',
          validadeMeses: String(v.validadeMeses ?? 24),
        }))
      : [{ id: crypto.randomUUID(), nomeVariacao: '', valorUnitarioPadrao: '', descricao: '', validadeMeses: '24' }]
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!nome.trim()) newErrors.nome = 'Nome do produto e obrigatorio';
    if (!semCor && cores.filter(c => c.trim()).length === 0) {
      newErrors.cores = 'Adicione pelo menos uma cor ou marque "Nao se aplica"';
    }
    const variacoesValidas = variacoes.filter(v => v.nomeVariacao.trim());
    if (variacoesValidas.length === 0) {
      newErrors.variacoes = 'Adicione pelo menos uma variacao';
    }
    variacoes.forEach((v, i) => {
      if (v.nomeVariacao.trim() && (isNaN(Number(v.valorUnitarioPadrao)) || v.valorUnitarioPadrao === '')) {
        newErrors[`variacao_valor_${i}`] = 'Valor invalido';
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const coresValidas = semCor ? [] : cores.filter(c => c.trim());
      const variacoesValidas = variacoes
        .filter(v => v.nomeVariacao.trim())
        .map(v => ({
          nomeVariacao: v.nomeVariacao.trim(),
          valorUnitarioPadrao: Number(v.valorUnitarioPadrao) || 0,
          descricao: v.descricao.trim() || undefined,
          validadeMeses: Number(v.validadeMeses) || 24,
        }));

      if (isEditing) {
        await updateEstoqueProduto(produto!.id, nome.trim(), descricao.trim() || undefined);
      } else {
        await createEstoqueProduto(
          nome.trim(),
          descricao.trim() || undefined,
          !semCor,
          coresValidas,
          variacoesValidas
        );
      }
      onSuccess();
    } catch (err: any) {
      setErrors({ submit: err.message || 'Erro ao salvar produto' });
    } finally {
      setSubmitting(false);
    }
  };

  const addCor = () => setCores(prev => [...prev, '']);
  const removeCor = (index: number) => {
    if (cores.length <= 1) return;
    setCores(prev => prev.filter((_, i) => i !== index));
  };
  const updateCor = (index: number, value: string) => {
    setCores(prev => prev.map((c, i) => (i === index ? value : c)));
  };

  const addVariacao = () =>
    setVariacoes(prev => [
      ...prev,
      { id: crypto.randomUUID(), nomeVariacao: '', valorUnitarioPadrao: '', descricao: '', validadeMeses: '24' },
    ]);
  const removeVariacao = (id: string) => {
    if (variacoes.length <= 1) return;
    setVariacoes(prev => prev.filter(v => v.id !== id));
  };
  const updateVariacao = (id: string, field: keyof VariacaoInput, value: string) => {
    setVariacoes(prev => prev.map(v => (v.id === id ? { ...v, [field]: value } : v)));
  };

  const coresValidas = semCor ? 0 : cores.filter(c => c.trim()).length;
  const variacoesValidas = variacoes.filter(v => v.nomeVariacao.trim()).length;
  const totalSaldos = !semCor && coresValidas > 0 ? variacoesValidas * coresValidas : variacoesValidas;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">

        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-5 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                {isEditing ? 'Editar Produto' : 'Novo Produto'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {isEditing ? 'Atualize o nome e descricao do produto' : 'Cadastre um novo produto no estoque'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              Nome do Produto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Tinta Emborrachada, Lixa, Selador..."
              className={`w-full px-4 py-3 rounded-xl border text-sm transition-all outline-none ${
                errors.nome
                  ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-200'
                  : 'border-gray-200 bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400'
              }`}
            />
            {errors.nome && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.nome}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              Descricao <span className="text-gray-400 font-normal text-xs">(opcional)</span>
            </label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Descricao adicional do produto..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none transition-all text-sm resize-none"
            />
          </div>

          {!isEditing && (
            <>
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-800">Cores</h3>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      onClick={() => setSemCor(v => !v)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${semCor ? 'bg-blue-500' : 'bg-gray-200'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${semCor ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                    <span className="text-xs text-gray-600 font-medium">Nao se aplica</span>
                  </label>
                </div>

                <div className="p-4">
                  {!semCor ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {cores.map((cor, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5 group"
                          >
                            <input
                              type="text"
                              value={cor}
                              onChange={e => updateCor(index, e.target.value)}
                              placeholder={`Cor ${index + 1}`}
                              className="w-28 text-sm bg-transparent outline-none text-blue-800 placeholder:text-blue-300 font-medium"
                            />
                            {cores.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeCor(index)}
                                className="text-blue-300 hover:text-red-400 transition-colors ml-1"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addCor}
                          className="flex items-center gap-1.5 border-2 border-dashed border-blue-200 hover:border-blue-400 text-blue-400 hover:text-blue-600 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Adicionar cor
                        </button>
                      </div>
                      {errors.cores && (
                        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {errors.cores}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Produto sem variacao de cor (ex: lixas, solventes)</p>
                  )}
                </div>
              </div>

              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-800">
                    Variacoes <span className="text-red-500">*</span>
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  {variacoes.map((variacao, index) => (
                    <div
                      key={variacao.id}
                      className="border border-gray-100 rounded-xl p-3.5 bg-white shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Variacao {index + 1}
                        </span>
                        {variacoes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeVariacao(variacao.id)}
                            className="p-1 hover:bg-red-50 text-gray-300 hover:text-red-400 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-500">Nome</label>
                          <input
                            type="text"
                            value={variacao.nomeVariacao}
                            onChange={e => updateVariacao(variacao.id, 'nomeVariacao', e.target.value)}
                            placeholder="Ex: 18 Litros, 25 KG..."
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none text-sm transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-500">Valor unitario (R$)</label>
                          <input
                            type="number"
                            value={variacao.valorUnitarioPadrao}
                            onChange={e => updateVariacao(variacao.id, 'valorUnitarioPadrao', e.target.value)}
                            placeholder="0,00"
                            min="0"
                            step="0.01"
                            className={`w-full px-3 py-2 rounded-lg border outline-none text-sm transition-all ${
                              errors[`variacao_valor_${index}`]
                                ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-200'
                                : 'border-gray-200 bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400'
                            }`}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">Descricao <span className="text-gray-300">(opcional)</span></label>
                        <input
                          type="text"
                          value={variacao.descricao}
                          onChange={e => updateVariacao(variacao.id, 'descricao', e.target.value)}
                          placeholder="Descricao da variacao..."
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none text-sm transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">Validade (meses)</label>
                        <input
                          type="number"
                          value={variacao.validadeMeses}
                          onChange={e => updateVariacao(variacao.id, 'validadeMeses', e.target.value)}
                          placeholder="24"
                          min="1"
                          step="1"
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none text-sm transition-all"
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addVariacao}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-blue-200 hover:border-blue-400 text-blue-400 hover:text-blue-600 rounded-xl text-sm font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar variacao
                  </button>
                  {errors.variacoes && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.variacoes}
                    </p>
                  )}
                </div>
              </div>

              {variacoesValidas > 0 && (
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-700 leading-snug">
                    Serao criados{' '}
                    <strong className="font-bold">{totalSaldos}</strong>{' '}
                    registro{totalSaldos !== 1 ? 's' : ''} de saldo zerado
                    {!semCor && coresValidas > 0
                      ? ` — ${variacoesValidas} variacao${variacoesValidas !== 1 ? 'es' : ''} x ${coresValidas} cor${coresValidas !== 1 ? 'es' : ''}`
                      : ` — ${variacoesValidas} variacao${variacoesValidas !== 1 ? 'es' : ''}`}
                  </p>
                </div>
              )}
            </>
          )}

          {errors.submit && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-red-700 font-medium">Erro ao salvar produto</p>
                <p className="text-xs text-red-500 mt-0.5">{errors.submit}</p>
              </div>
              <button
                type="button"
                onClick={() => setErrors(prev => { const n = { ...prev }; delete n.submit; return n; })}
                className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                title="Tentar novamente"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-xl disabled:opacity-60 disabled:cursor-not-allowed transition-all text-sm font-bold shadow-sm"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  {isEditing ? 'Salvar Alteracoes' : 'Criar Produto'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EstoqueForm;
