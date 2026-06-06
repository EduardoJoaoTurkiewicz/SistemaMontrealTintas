import React, { useState } from 'react';
import {
  X,
  Pencil,
  Trash2,
  Plus,
  Check,
  AlertTriangle,
  Layers,
  Palette,
  Package,
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import type { EstoqueProdutoCompleto, EstoqueCor, EstoqueVariacao } from '../../types';

interface EstoqueDetalhesProps {
  produto: EstoqueProdutoCompleto;
  onClose: () => void;
  onEditProduto: () => void;
  onDelete: () => void;
}

const EstoqueDetalhes: React.FC<EstoqueDetalhesProps> = ({
  produto,
  onClose,
  onEditProduto,
  onDelete,
}) => {
  const {
    updateEstoqueCor,
    updateEstoqueVariacao,
    removeEstoqueCor,
    removeEstoqueVariacao,
    updateEstoqueSaldo,
    addEstoqueCor,
    addEstoqueVariacao,
  } = useAppContext();

  const [editingCorId, setEditingCorId] = useState<string | null>(null);
  const [editingCorValue, setEditingCorValue] = useState('');
  const [editingVarId, setEditingVarId] = useState<string | null>(null);
  const [editingVar, setEditingVar] = useState<{ nomeVariacao: string; valorUnitarioPadrao: string; descricao: string; validadeMeses: string }>({ nomeVariacao: '', valorUnitarioPadrao: '', descricao: '', validadeMeses: '24' });
  const [editingSaldoId, setEditingSaldoId] = useState<string | null>(null);
  const [editingSaldoValue, setEditingSaldoValue] = useState('');

  const [addingCor, setAddingCor] = useState(false);
  const [novaCorValue, setNovaCorValue] = useState('');
  const [addingVar, setAddingVar] = useState(false);
  const [novaVar, setNovaVar] = useState({ nomeVariacao: '', valorUnitarioPadrao: '', descricao: '', validadeMeses: '24' });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'cor' | 'variacao' | 'produto'; id: string; label: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const handleSaveCor = async (cor: EstoqueCor) => {
    if (!editingCorValue.trim()) return;
    setLoading(true);
    try {
      await updateEstoqueCor(cor.id, editingCorValue.trim());
      setEditingCorId(null);
    } catch (err: any) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVariacao = async (variacao: EstoqueVariacao) => {
    if (!editingVar.nomeVariacao.trim()) return;
    setLoading(true);
    try {
      await updateEstoqueVariacao(
        variacao.id,
        editingVar.nomeVariacao.trim(),
        Number(editingVar.valorUnitarioPadrao) || 0,
        editingVar.descricao.trim() || undefined,
        Number(editingVar.validadeMeses) || 24
      );
      setEditingVarId(null);
    } catch (err: any) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setLoading(true);
    try {
      if (confirmDelete.type === 'cor') {
        await removeEstoqueCor(confirmDelete.id);
      } else if (confirmDelete.type === 'variacao') {
        await removeEstoqueVariacao(confirmDelete.id);
      } else if (confirmDelete.type === 'produto') {
        await onDelete();
        return;
      }
      setConfirmDelete(null);
    } catch (err: any) {
      setConfirmDelete(null);
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSaldo = async (saldoId: string) => {
    const qty = Number(editingSaldoValue);
    if (isNaN(qty) || qty < 0) return;
    setLoading(true);
    try {
      await updateEstoqueSaldo(saldoId, qty);
      setEditingSaldoId(null);
    } catch (err: any) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCor = async () => {
    if (!novaCorValue.trim()) return;
    setLoading(true);
    try {
      await addEstoqueCor(produto.id, novaCorValue.trim());
      setNovaCorValue('');
      setAddingCor(false);
    } catch (err: any) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVariacao = async () => {
    if (!novaVar.nomeVariacao.trim()) return;
    setLoading(true);
    try {
      await addEstoqueVariacao(
        produto.id,
        novaVar.nomeVariacao.trim(),
        Number(novaVar.valorUnitarioPadrao) || 0,
        novaVar.descricao.trim() || undefined,
        Number(novaVar.validadeMeses) || 24
      );
      setNovaVar({ nomeVariacao: '', valorUnitarioPadrao: '', descricao: '', validadeMeses: '24' });
      setAddingVar(false);
    } catch (err: any) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getSaldo = (variacaoId: string, corId?: string) => {
    return produto.saldos.find(
      s => s.variacaoId === variacaoId && (corId ? s.corId === corId : !s.corId)
    );
  };

  const totalEmEstoque = produto.saldos.reduce((acc, s) => acc + s.quantidadeAtual, 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">

        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-5 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm flex-shrink-0">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">{produto.nome}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {produto.temCor ? `${produto.cores.length} cor${produto.cores.length !== 1 ? 'es' : ''} · ` : ''}
                {produto.variacoes.length} variacao{produto.variacoes.length !== 1 ? 'es' : ''} · {totalEmEstoque} un. em estoque
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onEditProduto}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors font-semibold"
            >
              <Pencil className="w-4 h-4" />
              Editar nome
            </button>
            <button
              onClick={() => setConfirmDelete({ type: 'produto', id: produto.id, label: produto.nome })}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors font-semibold"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-700">{errorMsg}</p>
            </div>
          )}

          {produto.temCor && (
            <div className="border border-gray-100 rounded-2xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-bold text-gray-800">Cores Cadastradas</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600 font-semibold">{produto.cores.length}</span>
                </div>
                {!addingCor && (
                  <button
                    onClick={() => setAddingCor(true)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar cor
                  </button>
                )}
              </div>

              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {produto.cores.map(cor => (
                    <div
                      key={cor.id}
                      className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5 group"
                    >
                      {editingCorId === cor.id ? (
                        <>
                          <input
                            autoFocus
                            type="text"
                            value={editingCorValue}
                            onChange={e => setEditingCorValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveCor(cor); if (e.key === 'Escape') setEditingCorId(null); }}
                            className="w-24 text-xs px-1 py-0.5 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                          />
                          <button onClick={() => handleSaveCor(cor)} disabled={loading} className="text-blue-600 hover:text-blue-800 transition-colors">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingCorId(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-blue-700 font-semibold">{cor.nomeCor}</span>
                          <button
                            onClick={() => { setEditingCorId(cor.id); setEditingCorValue(cor.nomeCor); }}
                            className="text-blue-300 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ type: 'cor', id: cor.id, label: cor.nomeCor })}
                            className="text-blue-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}

                  {addingCor && (
                    <div className="flex items-center gap-1.5 border-2 border-blue-300 border-dashed rounded-xl px-3 py-1.5 bg-blue-50">
                      <input
                        autoFocus
                        type="text"
                        value={novaCorValue}
                        onChange={e => setNovaCorValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddCor(); if (e.key === 'Escape') { setAddingCor(false); setNovaCorValue(''); } }}
                        placeholder="Nova cor..."
                        className="w-24 text-xs px-1 py-0.5 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                      />
                      <button onClick={handleAddCor} disabled={loading} className="text-blue-600 hover:text-blue-800 transition-colors">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setAddingCor(false); setNovaCorValue(''); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold text-gray-800">Variacoes Cadastradas</h3>
                <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600 font-semibold">{produto.variacoes.length}</span>
              </div>
              {!addingVar && (
                <button
                  onClick={() => setAddingVar(true)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar variacao
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2.5 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Variacao</th>
                    <th className="text-left py-2.5 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Valor Unitario</th>
                    <th className="text-left py-2.5 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Descricao</th>
                    <th className="py-2.5 px-4 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {produto.variacoes.map(variacao => (
                    <tr key={variacao.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors group">
                      {editingVarId === variacao.id ? (
                        <>
                          <td className="py-2 px-4">
                            <input
                              autoFocus
                              type="text"
                              value={editingVar.nomeVariacao}
                              onChange={e => setEditingVar(prev => ({ ...prev, nomeVariacao: e.target.value }))}
                              className="w-full px-2 py-1 text-xs border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="number"
                              value={editingVar.valorUnitarioPadrao}
                              onChange={e => setEditingVar(prev => ({ ...prev, valorUnitarioPadrao: e.target.value }))}
                              className="w-full px-2 py-1 text-xs border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="text"
                              value={editingVar.descricao}
                              onChange={e => setEditingVar(prev => ({ ...prev, descricao: e.target.value }))}
                              className="w-full px-2 py-1 text-xs border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleSaveVariacao(variacao)} disabled={loading} className="text-blue-600 hover:text-blue-800 p-1 transition-colors">
                                <Check className="w-4 h-4" />
                              </button>
                              <button onClick={() => setEditingVarId(null)} className="text-gray-400 hover:text-gray-600 p-1 transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-4 font-semibold text-gray-800">{variacao.nomeVariacao}</td>
                          <td className="py-3 px-4">
                            {variacao.valorUnitarioPadrao > 0 ? (
                              <span className="font-bold text-gray-700">
                                R$ {variacao.valorUnitarioPadrao.toFixed(2).replace('.', ',')}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-xs">
                            {variacao.descricao || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setEditingVarId(variacao.id);
                                  setEditingVar({
                                    nomeVariacao: variacao.nomeVariacao,
                                    valorUnitarioPadrao: String(variacao.valorUnitarioPadrao),
                                    descricao: variacao.descricao || '',
                                    validadeMeses: String(variacao.validadeMeses ?? 24),
                                  });
                                }}
                                className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirmDelete({ type: 'variacao', id: variacao.id, label: variacao.nomeVariacao })}
                                className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}

                  {addingVar && (
                    <tr className="bg-blue-50 border-b border-blue-100">
                      <td className="py-2 px-4">
                        <input
                          autoFocus
                          type="text"
                          value={novaVar.nomeVariacao}
                          onChange={e => setNovaVar(prev => ({ ...prev, nomeVariacao: e.target.value }))}
                          placeholder="Ex: 18 Litros"
                          className="w-full px-2 py-1 text-xs border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="number"
                          value={novaVar.valorUnitarioPadrao}
                          onChange={e => setNovaVar(prev => ({ ...prev, valorUnitarioPadrao: e.target.value }))}
                          placeholder="R$"
                          className="w-full px-2 py-1 text-xs border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="text"
                          value={novaVar.descricao}
                          onChange={e => setNovaVar(prev => ({ ...prev, descricao: e.target.value }))}
                          placeholder="Descricao (opcional)"
                          className="w-full px-2 py-1 text-xs border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-1">
                          <button onClick={handleAddVariacao} disabled={loading} className="text-blue-600 hover:text-blue-800 p-1 transition-colors">
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setAddingVar(false); setNovaVar({ nomeVariacao: '', valorUnitarioPadrao: '', descricao: '' }); }}
                            className="text-gray-400 hover:text-gray-600 p-1 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">Estoque Atual</h3>
              <span className="text-xs text-gray-400 font-medium">Clique em um numero para editar</span>
            </div>

            <div className="p-4">
              {produto.temCor ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left py-2.5 px-3 text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50 rounded-tl-xl border border-gray-100">
                          Variacao / Cor
                        </th>
                        {produto.cores.map(cor => (
                          <th
                            key={cor.id}
                            className="text-center py-2.5 px-3 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 whitespace-nowrap"
                          >
                            {cor.nomeCor}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {produto.variacoes.map(variacao => (
                        <tr key={variacao.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-gray-700 border border-gray-100 text-xs bg-gray-50">
                            {variacao.nomeVariacao}
                          </td>
                          {produto.cores.map(cor => {
                            const saldo = getSaldo(variacao.id, cor.id);
                            if (!saldo) return (
                              <td key={cor.id} className="text-center py-2.5 px-3 border border-gray-100 text-gray-300">—</td>
                            );
                            return (
                              <td key={cor.id} className="text-center py-2 px-3 border border-gray-100">
                                {editingSaldoId === saldo.id ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <input
                                      autoFocus
                                      type="number"
                                      value={editingSaldoValue}
                                      onChange={e => setEditingSaldoValue(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter') handleSaveSaldo(saldo.id); if (e.key === 'Escape') setEditingSaldoId(null); }}
                                      min="0"
                                      className="w-16 text-center px-1 py-0.5 text-xs border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                                    />
                                    <button onClick={() => handleSaveSaldo(saldo.id)} disabled={loading} className="text-blue-600 hover:text-blue-800 transition-colors">
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => setEditingSaldoId(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setEditingSaldoId(saldo.id); setEditingSaldoValue(String(saldo.quantidadeAtual)); }}
                                    className={`inline-flex items-center justify-center min-w-[2rem] px-2.5 py-1 rounded-lg text-xs font-bold transition-all hover:ring-2 hover:ring-blue-300 ${
                                      saldo.quantidadeAtual > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
                                    }`}
                                  >
                                    {saldo.quantidadeAtual}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2.5 px-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Variacao</th>
                        <th className="text-center py-2.5 px-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Quantidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {produto.variacoes.map(variacao => {
                        const saldo = getSaldo(variacao.id);
                        return (
                          <tr key={variacao.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                            <td className="py-3 px-3 font-semibold text-gray-700">{variacao.nomeVariacao}</td>
                            <td className="py-2 px-3 text-center">
                              {saldo ? (
                                editingSaldoId === saldo.id ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <input
                                      autoFocus
                                      type="number"
                                      value={editingSaldoValue}
                                      onChange={e => setEditingSaldoValue(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter') handleSaveSaldo(saldo.id); if (e.key === 'Escape') setEditingSaldoId(null); }}
                                      min="0"
                                      className="w-20 text-center px-2 py-1 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                                    />
                                    <button onClick={() => handleSaveSaldo(saldo.id)} disabled={loading} className="text-blue-600 hover:text-blue-800 transition-colors">
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setEditingSaldoId(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setEditingSaldoId(saldo.id); setEditingSaldoValue(String(saldo.quantidadeAtual)); }}
                                    className={`inline-flex items-center justify-center px-4 py-1.5 rounded-lg text-sm font-bold transition-all hover:ring-2 hover:ring-blue-300 ${
                                      saldo.quantidadeAtual > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
                                    }`}
                                  >
                                    {saldo.quantidadeAtual}
                                  </button>
                                )
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-red-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Confirmar exclusao</h3>
                <p className="text-xs text-gray-500">Esta acao nao pode ser desfeita</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Deseja excluir{' '}
              {confirmDelete.type === 'cor' ? 'a cor' : confirmDelete.type === 'variacao' ? 'a variacao' : 'o produto'}{' '}
              <strong className="text-gray-800">"{confirmDelete.label}"</strong>?
              {confirmDelete.type === 'produto' && (
                <span className="block mt-1 text-red-500 text-xs">Todos os dados relacionados serao removidos.</span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60"
              >
                {loading ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EstoqueDetalhes;
