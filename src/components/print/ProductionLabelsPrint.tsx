import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface ProducaoData {
  id: string;
  titulo: string;
  lote: string;
  fabricacao_date: string;
  validade_date: string;
}

interface ItemData {
  id: string;
  quantidade: number;
  nomeProduto: string;
  nomeVariacao: string;
  nomeCor: string | null;
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function ProductionLabelsPrint() {
  const { id } = useParams<{ id: string }>();
  const [producao, setProducao] = useState<ProducaoData | null>(null);
  const [itens, setItens] = useState<ItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('ID de produção não informado.');
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const { data: prod, error: prodError } = await supabase
          .from('producoes')
          .select('id, titulo, lote, fabricacao_date, validade_date')
          .eq('id', id)
          .maybeSingle();

        if (prodError) throw prodError;
        if (!prod) throw new Error('Produção não encontrada.');

        const { data: rawItens, error: itensError } = await supabase
          .from('producao_itens')
          .select(`
            id,
            quantidade,
            estoque_produtos(nome),
            estoque_variacoes(nome_variacao),
            estoque_cores(nome_cor)
          `)
          .eq('producao_id', id);

        if (itensError) throw itensError;

        const mapped: ItemData[] = (rawItens || []).map((row: any) => ({
          id: row.id,
          quantidade: Number(row.quantidade),
          nomeProduto: row.estoque_produtos?.nome ?? '',
          nomeVariacao: row.estoque_variacoes?.nome_variacao ?? '',
          nomeCor: row.estoque_cores?.nome_cor ?? null,
        }));

        setProducao(prod);
        setItens(mapped);
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao carregar dados.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  useEffect(() => {
    if (!loading && !error && producao) {
      const timer = setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.print();
          });
        });
      }, 800);
      window.onafterprint = () => window.close();
      return () => clearTimeout(timer);
    }
  }, [loading, error, producao]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Arial, sans-serif', color: '#374151' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Carregando etiquetas...</div>
          <div style={{ fontSize: '14px', color: '#9ca3af' }}>Aguarde um momento</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Arial, sans-serif', color: '#374151' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: '#ef4444' }}>Erro ao carregar etiquetas</div>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>{error}</div>
          <button
            onClick={() => window.close()}
            className="no-print"
            style={{ padding: '10px 24px', background: '#f97316', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  if (!producao) return null;

  const etiquetas: React.ReactNode[] = [];
  let globalIndex = 0;
  itens.forEach(item => {
    const descricao = [item.nomeVariacao, item.nomeCor].filter(Boolean).join(' · ');
    for (let i = 0; i < item.quantidade; i++) {
      if (globalIndex >= 200) break;
      globalIndex++;
      const sublot = `${producao.lote}/B${String(globalIndex).padStart(3, '0')}`;
      etiquetas.push(
        <div key={`${item.id}-${i}`} className="label">
          <div className="label-header">
            <img src="/LOGO_MONTREAL_TINTAS_A_MAIOR_INDUSTRIA_DE_TINTAS_DO_PARANA-removebg-preview.png" className="logo-img" alt="Montreal Tintas" />
          </div>
          <div className="produto">{item.nomeProduto}</div>
          {descricao && <div className="descricao">{descricao}</div>}
          <div className="separator" />
          <div className="info-row">
            <span className="info-label">LOTE</span>
            <span className="info-value lote">{sublot}</span>
          </div>
          <div className="info-row">
            <span className="info-label">FAB.</span>
            <span className="info-value">{formatDateBR(producao.fabricacao_date)}</span>
          </div>
          <div className="info-row">
            <span className="info-label">VAL.</span>
            <span className="info-value">{formatDateBR(producao.validade_date)}</span>
          </div>
        </div>
      );
    }
    if (globalIndex >= 200) return;
  });

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          transition: none !important;
          animation: none !important;
        }

        html, body {
          font-family: Arial, Helvetica, sans-serif;
          background: #f3f4f6 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .label-header {
          display: flex;
          align-items: center;
          gap: 2mm;
        }

        .logo-img {
          height: 8mm;
          width: auto;
          object-fit: contain;
          flex-shrink: 0;
        }

        .produto {
          font-size: 7.5pt;
          font-weight: 900;
          color: #111827;
          line-height: 1.15;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .descricao {
          font-size: 6pt;
          font-weight: 700;
          color: #1a3a8f;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        }

        .separator {
          height: 0.3mm;
          background: #e5e7eb;
          margin: 0.5mm 0;
        }

        .info-row {
          display: flex;
          align-items: center;
          gap: 1.5mm;
          line-height: 1.2;
        }

        .info-label {
          font-size: 4.5pt;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.3pt;
          width: 6mm;
          flex-shrink: 0;
        }

        .info-value {
          font-size: 5.5pt;
          font-weight: 800;
          color: #374151;
        }

        .info-value.lote {
          font-family: 'Courier New', monospace;
          color: #1f2937;
          font-size: 5pt;
        }

        @media screen {
          body {
            background: #f3f4f6;
            padding: 48px 10px 10px;
          }
          .label {
            width: 70mm;
            height: 30mm;
            border: 1px dashed #d1d5db;
            margin: 8px;
            padding: 2mm;
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
          }
          .no-print-bar {
            display: flex;
          }
        }

        @media print {
          @page {
            size: 70mm 30mm;
            margin: 0;
          }
          html, body {
            width: 70mm;
            height: 30mm;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          .print-root {
            width: 70mm;
          }
          .label {
            width: 70mm;
            height: 30mm;
            box-sizing: border-box;
            padding: 2mm;
            overflow: hidden;
            page-break-after: always;
            break-after: page;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: white !important;
          }
          .logo-img {
            height: 8mm !important;
            width: auto !important;
            object-fit: contain !important;
          }
          .produto {
            color: #111827 !important;
          }
          .descricao {
            color: #1a3a8f !important;
          }
          .separator {
            background: #e5e7eb !important;
          }
          .info-label {
            color: #9ca3af !important;
          }
          .info-value {
            color: #374151 !important;
          }
          .info-value.lote {
            color: #1f2937 !important;
          }
          .no-print, .no-print-bar {
            display: none !important;
          }
        }
      `}</style>

      <div
        className="no-print-bar"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: '#1e293b',
          color: '#fff',
          padding: '8px 16px',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 9999,
          fontFamily: 'Arial, sans-serif',
          fontSize: '13px',
          fontWeight: 600,
          gap: '12px',
        }}
      >
        <span>
          Etiquetas: <strong>{producao.lote}</strong> — {etiquetas.length} etiqueta{etiquetas.length !== 1 ? 's' : ''}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => window.print()}
            className="no-print"
            style={{
              padding: '6px 18px',
              background: '#1a3a8f',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Imprimir
          </button>
          <button
            onClick={() => window.close()}
            className="no-print"
            style={{
              padding: '6px 18px',
              background: '#475569',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Fechar
          </button>
        </div>
      </div>

      <div className="print-root">
        {etiquetas}
      </div>
    </>
  );
}
