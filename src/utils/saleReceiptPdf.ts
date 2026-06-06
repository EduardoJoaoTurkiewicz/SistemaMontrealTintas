import type { Sale, SaleItem } from '../types';

export interface ReceiptOptions {
  saleItems?: SaleItem[];
  sellerName?: string;
  commissionRate?: number;
  commissionAmount?: number;
  producaoLotes?: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  cheque: 'Cheque',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  acerto: 'Acerto Mensal',
  permuta: 'Permuta',
};

function fmt(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function saleNumber(id: string): string {
  return id.split('-')[0].toUpperCase();
}

// ─── Section builders ────────────────────────────────────────────────────────

function buildItemsTable(saleItems: SaleItem[]): string {
  if (!saleItems || saleItems.length === 0) return '';
  const rows = saleItems.map(item => `
    <tr>
      <td>${esc(item.nomeProduto ?? item.produtoId)}</td>
      <td>${esc(item.nomeVariacao ?? item.variacaoId)}</td>
      <td>${item.nomeCor ? esc(item.nomeCor) : '<span class="muted">—</span>'}</td>
      <td class="r">${item.quantidade}</td>
      <td class="r">R$&nbsp;${fmt(item.valorUnitario)}</td>
      <td class="r bold">R$&nbsp;${fmt(item.valorTotal)}</td>
    </tr>`).join('');
  const total = saleItems.reduce((s, i) => s + i.valorTotal, 0);
  return `
    <div class="section">
      <div class="sec-header">
        <span class="sec-icon">📦</span>
        <span class="sec-title">Itens da Venda</span>
      </div>
      <table class="data-table">
        <thead><tr>
          <th>Produto</th><th>Variação</th><th>Cor</th>
          <th class="r">Qtd</th><th class="r">Unit.</th><th class="r">Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td colspan="5" class="r bold" style="border-top:2px solid #bbf7d0;padding-top:8px">Total dos Itens</td>
          <td class="r bold" style="border-top:2px solid #bbf7d0;padding-top:8px;color:#166534">R$&nbsp;${fmt(total)}</td>
        </tr></tfoot>
      </table>
    </div>`;
}

function buildPaymentSection(sale: Sale): string {
  const methods = sale.paymentMethods || [];
  const rows = methods.map(method => {
    const label = PAYMENT_LABELS[method.type] ?? method.type;
    let detail = '';
    if (method.installments && method.installments > 1) {
      detail = ` <span class="chip">${method.installments}x de R$&nbsp;${fmt(method.installmentValue ?? method.amount / method.installments)}</span>`;
    }
    return `<div class="pay-row">
      <span class="pay-label">${esc(label)}${detail}</span>
      <span class="pay-val">R$&nbsp;${fmt(method.amount)}</span>
    </div>`;
  }).join('');

  // Installment schedule
  let scheduleHtml = '';
  const creditMethods = methods.filter(m => m.type === 'cartao_credito' && m.installments && m.installments > 1);
  if (creditMethods.length > 0) {
    const scheduleRows = creditMethods.flatMap(m => {
      const interval = m.installmentInterval ?? 30;
      const today = new Date();
      return Array.from({ length: m.installments! }, (_, i) => {
        const dueDate = new Date(today);
        dueDate.setDate(dueDate.getDate() + (i + 1) * interval);
        const dateStr = dueDate.toLocaleDateString('pt-BR');
        return `<tr>
          <td>${i + 1}ª parcela</td>
          <td>${dateStr}</td>
          <td class="r bold">R$&nbsp;${fmt(m.installmentValue ?? m.amount / m.installments!)}</td>
        </tr>`;
      });
    }).join('');
    scheduleHtml = `
      <div style="margin-top:12px">
        <p class="small-label">Cronograma de Parcelas</p>
        <table class="data-table sched-table">
          <thead><tr><th>Parcela</th><th>Vencimento Aprox.</th><th class="r">Valor</th></tr></thead>
          <tbody>${scheduleRows}</tbody>
        </table>
      </div>`;
  }

  return `
    <div class="section">
      <div class="sec-header">
        <span class="sec-icon">💳</span>
        <span class="sec-title">Forma de Pagamento</span>
      </div>
      <div class="pay-grid">${rows}</div>
      ${scheduleHtml}
    </div>`;
}

function buildTotalsBox(sale: Sale): string {
  const pendingHtml = sale.pendingAmount > 0.01
    ? `<div class="total-row pending">
        <span>Saldo Pendente</span>
        <span>R$&nbsp;${fmt(sale.pendingAmount)}</span>
       </div>`
    : '<div class="total-row ok"><span>✓ Pagamento integral</span><span>Quitado</span></div>';
  return `
    <div class="totals-box">
      <div class="total-row main">
        <span>Valor Total</span>
        <span>R$&nbsp;${fmt(sale.totalValue)}</span>
      </div>
      <div class="total-row received">
        <span>Valor Recebido</span>
        <span>R$&nbsp;${fmt(sale.receivedAmount)}</span>
      </div>
      ${pendingHtml}
    </div>`;
}

function buildSellerSection(opts: ReceiptOptions): string {
  if (!opts.sellerName) return '';
  const commission = opts.commissionAmount != null
    ? `<div class="info-pair"><span>Comissão</span><span>R$&nbsp;${fmt(opts.commissionAmount)} (${opts.commissionRate ?? 0}%)</span></div>`
    : '';
  return `
    <div class="section">
      <div class="sec-header">
        <span class="sec-icon">👤</span>
        <span class="sec-title">Vendedor</span>
      </div>
      <div class="info-pair"><span>Nome</span><span>${esc(opts.sellerName)}</span></div>
      ${commission}
    </div>`;
}

function buildLotesSection(opts: ReceiptOptions): string {
  if (!opts.producaoLotes || opts.producaoLotes.length === 0) return '';
  const chips = opts.producaoLotes.map(l => `<span class="lot-chip">${esc(l)}</span>`).join('');
  return `
    <div class="section">
      <div class="sec-header">
        <span class="sec-icon">🏭</span>
        <span class="sec-title">Rastreabilidade de Produção</span>
      </div>
      <div class="lot-wrap">${chips}</div>
    </div>`;
}

function buildSignaturesSection(): string {
  return `
    <div class="sig-section">
      <div class="sig-col">
        <div class="sig-line"></div>
        <p class="sig-label">Assinatura do Cliente</p>
        <p class="sig-sub">Nome / CPF</p>
      </div>
      <div class="sig-col">
        <div class="sig-line"></div>
        <p class="sig-label">Montreal Tintas</p>
        <p class="sig-sub">Responsável / Vendedor</p>
      </div>
    </div>`;
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

function buildCSS(statusColor: string): string {
  return `
  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    background: #f8fafc;
    color: #1e293b;
    font-size: 13px;
    line-height: 1.55;
  }
  .no-print { background:#1e293b; color:#fff; display:flex; align-items:center; justify-content:space-between;
    padding:8px 20px; position:sticky; top:0; z-index:999; font-size:13px; font-weight:600; gap:12px; }
  .no-print button { padding:6px 18px; border:none; border-radius:8px; font-weight:700; font-size:13px;
    cursor:pointer; }
  .btn-print { background:#166534; color:#fff; }
  .btn-close { background:#475569; color:#fff; }
  .page { max-width:760px; margin:24px auto; background:#fff; border-radius:16px;
    box-shadow:0 4px 24px rgba(0,0,0,.10); overflow:hidden; }

  /* ── Header ── */
  .doc-header { background:linear-gradient(135deg,#14532d 0%,#166534 50%,#15803d 100%);
    padding:28px 32px; display:flex; align-items:center; justify-content:space-between; }
  .logo-wrap img { height:56px; max-width:200px; object-fit:contain; }
  .logo-text { font-size:22px; font-weight:900; color:#fff; letter-spacing:-.5px; }
  .header-right { text-align:right; }
  .doc-title { font-size:22px; font-weight:800; color:#fff; letter-spacing:-.3px; }
  .doc-num { font-size:13px; color:#86efac; margin-top:2px; font-weight:600; }
  .status-badge { display:inline-flex; align-items:center; gap:6px; margin-top:8px;
    padding:5px 16px; border-radius:20px; font-size:12px; font-weight:800;
    background:${statusColor}; color:#fff; letter-spacing:.5px; }

  /* ── Meta strip ── */
  .meta-strip { background:#f0fdf4; border-bottom:1px solid #dcfce7; padding:14px 32px;
    display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
  .meta-item { }
  .meta-label { font-size:9.5px; text-transform:uppercase; letter-spacing:.8px;
    color:#64748b; font-weight:700; margin-bottom:3px; }
  .meta-value { font-size:13px; font-weight:700; color:#1e293b; }
  .meta-sub { font-size:11px; color:#64748b; margin-top:1px; }

  /* ── NF Badge ── */
  .nf-strip { background:#eff6ff; border-bottom:1px solid #bfdbfe; padding:8px 32px;
    display:flex; align-items:center; gap:8px; font-size:12px; font-weight:700; color:#1d4ed8; }
  .nf-dot { width:8px; height:8px; border-radius:50%; background:#2563eb; flex-shrink:0; }

  /* ── Body ── */
  .body { padding:24px 32px; display:flex; flex-direction:column; gap:20px; }

  /* ── Sections ── */
  .section { }
  .sec-header { display:flex; align-items:center; gap:8px; margin-bottom:10px;
    padding-bottom:6px; border-bottom:2px solid #dcfce7; }
  .sec-icon { font-size:15px; }
  .sec-title { font-size:11.5px; text-transform:uppercase; letter-spacing:.8px;
    font-weight:800; color:#15803d; }

  /* ── Table ── */
  .data-table { width:100%; border-collapse:collapse; font-size:12px; }
  .data-table th { background:#f1f5f9; padding:7px 9px; text-align:left;
    font-size:10.5px; font-weight:700; color:#475569; text-transform:uppercase;
    letter-spacing:.5px; border:1px solid #e2e8f0; }
  .data-table td { padding:7px 9px; border:1px solid #e2e8f0; vertical-align:middle; }
  .data-table tbody tr:nth-child(even) td { background:#f8fafc; }
  .sched-table { margin-top:0; font-size:11.5px; }
  .r { text-align:right; }
  .bold { font-weight:700; }
  .muted { color:#94a3b8; }
  .chip { background:#dbeafe; color:#1d4ed8; border-radius:12px; padding:2px 8px;
    font-size:10.5px; font-weight:700; display:inline-block; margin-left:4px; }
  .small-label { font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase;
    letter-spacing:.5px; margin-bottom:6px; }

  /* ── Payment ── */
  .pay-grid { display:flex; flex-direction:column; gap:6px; }
  .pay-row { display:flex; justify-content:space-between; align-items:center;
    padding:8px 12px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; }
  .pay-label { font-weight:600; color:#334155; }
  .pay-val { font-weight:800; color:#15803d; font-size:14px; }

  /* ── Totals ── */
  .totals-box { background:#f0fdf4; border:2px solid #86efac; border-radius:12px;
    padding:16px 20px; display:flex; flex-direction:column; gap:6px; }
  .total-row { display:flex; justify-content:space-between; align-items:center;
    font-size:13.5px; font-weight:600; color:#334155; }
  .total-row.main { font-size:18px; font-weight:900; color:#166534;
    padding-bottom:10px; border-bottom:1px solid #86efac; margin-bottom:4px; }
  .total-row.received { color:#059669; }
  .total-row.pending { color:#dc2626; }
  .total-row.ok { color:#059669; font-style:italic; }

  /* ── Info pairs ── */
  .info-pair { display:flex; justify-content:space-between; padding:6px 0;
    border-bottom:1px solid #f1f5f9; font-size:12.5px; }
  .info-pair span:first-child { color:#64748b; font-weight:600; }
  .info-pair span:last-child { font-weight:700; color:#1e293b; }

  /* ── Lots ── */
  .lot-wrap { display:flex; flex-wrap:wrap; gap:8px; }
  .lot-chip { background:#f0fdf4; border:1px solid #86efac; color:#166534;
    padding:4px 12px; border-radius:20px; font-size:11.5px; font-weight:700;
    font-family:'Courier New',monospace; }

  /* ── Observations ── */
  .obs-box { background:#fffbeb; border:1px solid #fde68a; border-radius:10px;
    padding:12px 16px; color:#78350f; font-size:12px; line-height:1.6; }

  /* ── Signatures ── */
  .sig-section { display:grid; grid-template-columns:1fr 1fr; gap:40px;
    margin-top:8px; padding:24px 0 8px; border-top:1px dashed #cbd5e1; }
  .sig-col { display:flex; flex-direction:column; align-items:center; gap:6px; }
  .sig-line { width:100%; border-bottom:1px solid #334155; height:36px; }
  .sig-label { font-size:12px; font-weight:700; color:#334155; }
  .sig-sub { font-size:10.5px; color:#94a3b8; }

  /* ── Footer ── */
  .doc-footer { background:#f8fafc; border-top:1px solid #e2e8f0;
    padding:14px 32px; text-align:center; }
  .footer-brand { font-size:13px; font-weight:800; color:#166534; margin-bottom:3px; }
  .footer-meta { font-size:10.5px; color:#94a3b8; }

  @media print {
    body { background:#fff !important; }
    .no-print { display:none !important; }
    .page { margin:0; border-radius:0; box-shadow:none; max-width:100%; }
    .body { padding:16px 24px; }
    .doc-header { padding:20px 24px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .meta-strip, .nf-strip, .totals-box, .lot-chip, .pay-row { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function gerarComprovantePDF(sale: Sale, saleItemsOrOpts?: SaleItem[] | ReceiptOptions): void {
  let opts: ReceiptOptions = {};
  if (Array.isArray(saleItemsOrOpts)) {
    opts = { saleItems: saleItemsOrOpts };
  } else if (saleItemsOrOpts) {
    opts = saleItemsOrOpts;
  }

  const statusColor = sale.status === 'pago' ? '#16a34a' : sale.status === 'parcial' ? '#d97706' : '#dc2626';
  const statusLabel = sale.status === 'pago' ? '✓ PAGO' : sale.status === 'parcial' ? '◑ PARCIAL' : '✗ PENDENTE';
  const num = saleNumber(sale.id);
  const now = new Date();
  const issuedAt = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  const logoSrc = '/LOGO_MONTREAL_TINTAS_A_MAIOR_INDUSTRIA_DE_TINTAS_DO_PARANA-removebg-preview.png';

  const nfStrip = sale.hasNotaFiscal
    ? `<div class="nf-strip"><div class="nf-dot"></div>Esta venda possui Nota Fiscal emitida.</div>`
    : '';

  const productsSection = opts.saleItems && opts.saleItems.length > 0
    ? buildItemsTable(opts.saleItems)
    : sale.products
      ? `<div class="section"><div class="sec-header"><span class="sec-icon">📦</span><span class="sec-title">Produtos</span></div><div class="obs-box">${esc(typeof sale.products === 'string' ? sale.products : 'Produtos vendidos')}</div></div>`
      : '';

  const obsSection = sale.observations
    ? `<div class="section"><div class="sec-header"><span class="sec-icon">📝</span><span class="sec-title">Observações</span></div><div class="obs-box">${esc(sale.observations)}</div></div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Comprovante de Venda — ${num}</title>
  <style>${buildCSS(statusColor)}</style>
</head>
<body>
<div class="no-print">
  <span>Comprovante de Venda — ${esc(num)} &nbsp;|&nbsp; ${esc(sale.client)}</span>
  <div style="display:flex;gap:8px">
    <button class="btn-print" onclick="window.print()">Imprimir / Salvar PDF</button>
    <button class="btn-close" onclick="window.close()">Fechar</button>
  </div>
</div>

<div class="page">
  <!-- Header -->
  <div class="doc-header">
    <div class="logo-wrap">
      <img src="${logoSrc}" alt="Montreal Tintas"
        onerror="this.style.display='none';document.getElementById('lt').style.display='block'" />
      <span id="lt" class="logo-text" style="display:none">Montreal Tintas</span>
    </div>
    <div class="header-right">
      <div class="doc-title">Comprovante de Venda</div>
      <div class="doc-num">Nº ${esc(num)}</div>
      <div class="status-badge">${statusLabel}</div>
    </div>
  </div>

  ${nfStrip}

  <!-- Meta strip -->
  <div class="meta-strip">
    <div class="meta-item">
      <div class="meta-label">Cliente</div>
      <div class="meta-value">${esc(sale.client)}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Data da Venda</div>
      <div class="meta-value">${fmtDate(sale.date)}</div>
      ${sale.deliveryDate ? `<div class="meta-sub">Entrega: ${fmtDate(sale.deliveryDate)}</div>` : ''}
    </div>
    <div class="meta-item">
      <div class="meta-label">Emitido em</div>
      <div class="meta-value">${issuedAt}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Código</div>
      <div class="meta-value" style="font-family:monospace;font-size:11px">${esc(sale.id)}</div>
    </div>
  </div>

  <!-- Body -->
  <div class="body">
    ${productsSection}
    ${buildPaymentSection(sale)}
    ${buildTotalsBox(sale)}
    ${buildSellerSection(opts)}
    ${buildLotesSection(opts)}
    ${obsSection}
    ${buildSignaturesSection()}
  </div>

  <!-- Footer -->
  <div class="doc-footer">
    <div class="footer-brand">Montreal Tintas — A Maior Indústria de Tintas do Paraná</div>
    <div class="footer-meta">Comprovante gerado em ${issuedAt} &nbsp;|&nbsp; Este documento é apenas para fins informativos.</div>
  </div>
</div>
<script>
  window.onload = function() {
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        window.print();
      });
    });
  };
  window.onafterprint = function() { window.close(); };
</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'width=860,height=960,scrollbars=yes');
  if (win) win.onunload = () => URL.revokeObjectURL(url);
}
