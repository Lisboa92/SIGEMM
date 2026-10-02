import QRCode from 'qrcode';
import logoMatolaImg from '@/assets/logo-matola.png';
import { type DocumentData, formatPaymentMethodLabel } from '@/lib/documentGenerator';

export type PrintPaperSize = 'a4' | 'thermal-80mm' | 'thermal-58mm';
export type DocumentPrintMode = 'auto-e-aviso' | 'auto' | 'aviso' | 'recibo' | 'factura' | 'termico' | 'report';

export interface ReportPrintData {
  titulo: string;
  subtitulo?: string;
  periodo?: string;
  geradoPor?: string;
  dataGeracao?: string;
  resumo?: { label: string; valor: string | number }[];
  colunas: string[];
  linhas: (string | number)[][];
  rodape?: string;
}

let cachedLogoBase64: string | null = null;

export async function getLogoBase64(): Promise<string> {
  if (cachedLogoBase64) return cachedLogoBase64;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        cachedLogoBase64 = canvas.toDataURL('image/png');
        resolve(cachedLogoBase64);
      } catch {
        resolve(logoMatolaImg);
      }
    };
    img.onerror = () => resolve(logoMatolaImg);
    img.src = logoMatolaImg;
  });
}

export async function generateQRBase64(data: string, size = 160): Promise<string> {
  try {
    return await QRCode.toDataURL(data, { width: size, margin: 1 });
  } catch {
    return '';
  }
}

/**
 * Triggers printing using a high-fidelity iframe or new window with complete @media print styles.
 * This guarantees browser print dialog will appear with exact page layout and printer detection.
 */
export async function executePrintHtml(htmlContent: string, title = 'Documento'): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // 1) Try opening direct printable popup window (most reliable across Edge/Chrome/Safari)
      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(htmlContent);
        win.document.close();
        setTimeout(() => {
          try {
            win.focus();
            win.print();
            resolve(true);
          } catch {
            resolve(true);
          }
        }, 350);
        return;
      }

      // 2) Fallback to iframe if popup was blocked
      const existingFrame = document.getElementById('sigemm-universal-print-frame');
      if (existingFrame) {
        try { document.body.removeChild(existingFrame); } catch {}
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'sigemm-universal-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-9999';

      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document;
      if (!frameDoc) {
        resolve(false);
        return;
      }

      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch (e) {
          console.warn('Iframe print failed:', e);
          resolve(false);
        } finally {
          setTimeout(() => {
            try {
              if (document.body.contains(iframe)) document.body.removeChild(iframe);
            } catch {}
          }, 60000);
        }
      }, 400);
    } catch (err) {
      console.error('Print execution error:', err);
      resolve(false);
    }
  });
}

/**
 * Opens a PDF Blob directly into the browser's native PDF Viewer with auto-print,
 * which displays the exact screen shown in Edge/Chrome with the printer selection list
 * ("Microsoft Print to PDF", USB, Network, WiFi printers, etc.).
 */
export async function executePrintPdf(pdfBlob: Blob, filename = 'documento.pdf'): Promise<boolean> {
  try {
    const url = URL.createObjectURL(pdfBlob);
    
    // 1) Try opening in a new tab/window - this allows Edge/Chrome/Firefox/Safari to show the native print viewer
    const win = window.open(url, '_blank');
    if (win) {
      setTimeout(() => {
        try {
          win.focus();
        } catch {}
      }, 300);
      setTimeout(() => URL.revokeObjectURL(url), 120000);
      return true;
    }

    // 2) If popup is blocked, use hidden iframe with print()
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = url;
      
      let resolved = false;
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          if (!resolved) {
            resolved = true;
            resolve(true);
          }
        } catch (e) {
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        }
        setTimeout(() => {
          try {
            if (document.body.contains(iframe)) document.body.removeChild(iframe);
          } catch {}
          URL.revokeObjectURL(url);
        }, 60000);
      };
      
      document.body.appendChild(iframe);
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(true);
        }
      }, 3000);
    });
  } catch (err) {
    console.error('executePrintPdf error:', err);
    return false;
  }
}

function splitDate(doc: DocumentData) {
  const [d = '', m = '', a = ''] = (doc.data || '').split('/');
  const [hh = '', mm = ''] = (doc.hora || '').split(':');
  const ano2 = a ? a.slice(-2) : '';
  return { d, m, a, ano2, hh, mm };
}

/**
 * Builds standard HTML representation of Auto de Notícia + Aviso de Multa in single A4 sheet
 */
export async function buildAutoEAvisoHtml(doc: DocumentData): Promise<string> {
  const logo = await getLogoBase64();
  const { d, m, a, ano2, hh, mm } = splitDate(doc);

  const qrData = JSON.stringify({
    tipo: 'auto-e-aviso',
    auto: doc.numeroAuto || doc.numero,
    numero: doc.numero,
    infrator: doc.infrator,
    valor: doc.valor,
    data: doc.data,
    hora: doc.hora,
  });
  const qrBase64 = await generateQRBase64(qrData, 140);

  const valorFmt = Number(doc.valor || 0).toFixed(2);
  const matriculaLabel = doc.categoriaMulta === 'imovel' ? 'Nº Porta / Talhão' : 'Matrícula';

  return `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <title>Auto de Notícia e Aviso de Multa - ${doc.numeroAuto || doc.numero}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.45;
      color: #111827;
      background: #fff;
      padding: 0;
    }
    .page-container {
      width: 100%;
      max-width: 190mm;
      margin: 0 auto;
      background: #fff;
    }
    .doc-section {
      padding: 4px 0;
    }
    .header {
      text-align: center;
      position: relative;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 1.5px solid #1f2937;
    }
    .logo {
      width: 44px;
      height: 44px;
      object-fit: contain;
      margin: 0 auto 3px;
      display: block;
    }
    .header h1 {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #111827;
      margin: 0;
    }
    .header h2 {
      font-size: 11.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: #374151;
      margin: 1px 0 0;
    }
    .doc-title-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      background: #f3f4f6;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid #d1d5db;
      margin-top: 3px;
      color: #111827;
    }
    .body-text {
      text-align: justify;
      font-size: 10.5px;
      line-height: 1.55;
      margin-bottom: 6px;
    }
    .fill {
      font-weight: 700;
      color: #000;
      border-bottom: 1px solid #4b5563;
      padding: 0 3px;
      display: inline-block;
      min-width: 18px;
      text-align: center;
    }
    .signatures-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 10px;
      padding: 0 10px;
    }
    .sig-col {
      width: 44%;
      text-align: center;
    }
    .sig-img {
      max-height: 38px;
      max-width: 140px;
      object-fit: contain;
      margin: 0 auto 2px;
      display: block;
    }
    .sig-placeholder {
      height: 32px;
    }
    .sig-line {
      border-top: 1px solid #111827;
      margin-top: 2px;
      padding-top: 3px;
      font-size: 10px;
      font-weight: 600;
    }
    .qr-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
      font-size: 9px;
      color: #4b5563;
    }
    .qr-img {
      width: 48px;
      height: 48px;
    }
    /* Linha de corte */
    .cut-line-container {
      margin: 10px 0;
      position: relative;
      text-align: center;
    }
    .cut-line {
      border-top: 1.5px dashed #9ca3af;
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      z-index: 1;
    }
    .cut-text {
      position: relative;
      z-index: 2;
      background: #fff;
      padding: 0 12px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7280;
    }
    .valor-highlight {
      font-size: 13px;
      font-weight: 800;
      text-align: center;
      padding: 5px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      margin: 6px 0;
    }
    .watermark {
      position: fixed;
      top: 45%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 110px;
      font-weight: 900;
      color: rgba(229, 231, 235, 0.35);
      pointer-events: none;
      z-index: 0;
      letter-spacing: 10px;
    }
    .doc-footer {
      font-size: 8.5px;
      color: #6b7280;
      text-align: center;
      margin-top: 6px;
      border-top: 1px solid #e5e7eb;
      padding-top: 3px;
    }
    @media print {
      body { background: #fff !important; }
      .page-container { max-width: 100% !important; }
    }
  </style>
</head>
<body>
  <div class="watermark">CMM</div>
  <div class="page-container">

    <!-- 1. AUTO DE NOTÍCIA (METADE SUPERIOR) -->
    <div class="doc-section">
      <div class="header">
        <img class="logo" src="${logo}" alt="Brasão Matola" />
        <h1>Conselho Municipal da Cidade da Matola</h1>
        <h2>Comando da Polícia Municipal</h2>
        <div class="doc-title-badge">AUTO DE NOTÍCIA Nº ${doc.numeroAuto || doc.numero}</div>
      </div>

      <div class="body-text">
        Aos <span class="fill">${d || '__'}</span> dias do mês de <span class="fill">${m || '_________'}</span> do ano de 20<span class="fill">${ano2 || '__'}</span>, nesta cidade da Matola, Posto Administrativo Municipal de <span class="fill">${doc.postoAdministrativo || 'Sede'}</span>, Bairro <span class="fill">${doc.local || '___________'}</span>, Quarteirão nº <span class="fill">${doc.localQuarteirao || '___'}</span>, Avenida/Rua <span class="fill">${doc.localAvenida || '____________________'}</span>, casa nº <span class="fill">${doc.localCasa || '___'}</span>, pelas <span class="fill">${hh || '__'}</span> horas e <span class="fill">${mm || '__'}</span> minutos, eu, <span class="fill">${doc.agente || '_____________________'}</span>, Agente da Polícia Municipal, autuei o/a Senhor/a <span class="fill">${doc.infrator || '________________________________'}</span>, estado civil <span class="fill">${doc.estadoCivil || '________'}</span>, nascido/a a <span class="fill">${doc.dataNascimento || '__/__/____'}</span>, natural de <span class="fill">${doc.naturalDe || '_______________'}</span>, filho/a de <span class="fill">${doc.nomePai || '_______________________'}</span> e de <span class="fill">${doc.nomeMae || '_______________________'}</span>, profissão <span class="fill">${doc.profissao || '___________'}</span>, local de trabalho <span class="fill">${doc.localTrabalho || '________________'}</span>, residente no Bairro <span class="fill">${doc.residenciaBairro || doc.local || '___________'}</span>, Quarteirão nº <span class="fill">${doc.residenciaQuarteirao || '___'}</span>, Avenida/Rua <span class="fill">${doc.residenciaAvenida || '____________________'}</span>, Casa nº <span class="fill">${doc.residenciaCasa || '___'}</span>, por haver transgredido as disposições da alínea <span class="fill">${doc.alineaTransgredida || '___'}</span>) do nº <span class="fill">${doc.numeroTransgredido || '___'}</span> do artigo <span class="fill">${doc.artigoTransgredido || '___'}</span> do/a <span class="fill">${doc.legislacao || doc.infracao || 'Postura Municipal'}</span>, punível nos termos da alínea <span class="fill">${doc.alineaPunicao || '___'}</span>) do nº <span class="fill">${doc.numeroPunicao || '___'}</span> do artigo <span class="fill">${doc.artigoPunicao || '___'}</span> (${matriculaLabel}: <span class="fill">${doc.matricula || 'N/A'}</span>; Doc.ID: <span class="fill">${doc.documentoId || 'N/A'}</span>), com a multa de <span class="fill">${doc.valorExtenso || valorFmt + ' Meticais'}</span> (<span class="fill">${valorFmt} MT</span>), devendo proceder ao pagamento na Tesouraria da Polícia Municipal no prazo de 15 dias úteis, findo o qual o auto será remetido ao Tribunal competente.
      </div>

      <div style="font-size: 9.5px; font-style: italic; color: #4b5563; margin-bottom: 6px;">
        Por ser verdade e para constar, lavrei o presente auto que vai assinado nos termos da lei.
      </div>

      <div class="signatures-row">
        <div class="sig-col">
          ${doc.assinaturaInfrator ? `<img class="sig-img" src="${doc.assinaturaInfrator}" />` : '<div class="sig-placeholder"></div>'}
          <div class="sig-line">O Transgressor / Notificado</div>
        </div>
        <div class="sig-col">
          ${doc.assinaturaAgente ? `<img class="sig-img" src="${doc.assinaturaAgente}" />` : '<div class="sig-placeholder"></div>'}
          <div class="sig-line">O Agente Autuante</div>
        </div>
      </div>
    </div>

    <!-- LINHA DE CORTE -->
    <div class="cut-line-container">
      <div class="cut-line"></div>
      <span class="cut-text">✂ — — — — — — — — — LINHA DE CORTE — — — — — — — — — ✂</span>
    </div>

    <!-- 2. AVISO DE MULTA (METADE INFERIOR) -->
    <div class="doc-section">
      <div class="header">
        <img class="logo" src="${logo}" alt="Brasão Matola" />
        <h1>Conselho Municipal da Cidade da Matola</h1>
        <h2>Comando da Polícia Municipal</h2>
        <div class="doc-title-badge">AVISO DE MULTA Nº ${doc.numeroAuto || doc.numero}</div>
      </div>

      <div class="body-text">
        Fica avisado/a o/a Senhor/a <span class="fill">${doc.infrator || '________________________________'}</span> que foi autuado/a no Bairro <span class="fill">${doc.local || '___________'}</span>, Quarteirão nº <span class="fill">${doc.localQuarteirao || '___'}</span>, Avenida/Rua <span class="fill">${doc.localAvenida || '____________________'}</span>, Casa nº <span class="fill">${doc.localCasa || '___'}</span>, pelas <span class="fill">${hh || '__'}</span> horas e <span class="fill">${mm || '__'}</span> minutos, por transgressão ao artigo <span class="fill">${doc.artigoTransgredido || '___'}</span> da <span class="fill">${doc.legislacao || doc.infracao || 'Postura Municipal'}</span> (${matriculaLabel}: <span class="fill">${doc.matricula || 'N/A'}</span>), correspondente à multa abaixo indicada.
      </div>

      <div class="valor-highlight">
        VALOR A PAGAR: ${valorFmt} MT
        <div style="font-size: 10px; font-weight: normal; color: #4b5563; margin-top: 2px;">
          (${doc.valorExtenso || valorFmt + ' Meticais'})
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 8px;">
        <div class="qr-badge">
          ${qrBase64 ? `<img class="qr-img" src="${qrBase64}" />` : ''}
          <div>
            <p><strong>Nº Multa:</strong> ${doc.numero}</p>
            <p><strong>Auto:</strong> ${doc.numeroAuto || doc.numero}</p>
            <p><strong>Prazo:</strong> 15 dias úteis</p>
            <p><strong>Local:</strong> Tesouraria CMM / Balcão Único</p>
          </div>
        </div>

        <div style="width: 44%; text-align: center;">
          ${doc.assinaturaAgente ? `<img class="sig-img" src="${doc.assinaturaAgente}" />` : '<div class="sig-placeholder"></div>'}
          <div class="sig-line">O Agente Autuante</div>
          <div style="font-size: 9px; color: #6b7280; margin-top: 2px;">Matola, ${doc.data}</div>
        </div>
      </div>

      <div class="doc-footer">
        SIGEMM · Sistema Integrado de Gestão Municipal · Documento Oficial Emitido em ${doc.data} às ${doc.hora}
      </div>
    </div>

  </div>
</body>
</html>
  `;
}

/**
 * Builds standard HTML representation of Recibo or Factura
 */
export async function buildReceiptOrInvoiceHtml(doc: DocumentData): Promise<string> {
  const logo = await getLogoBase64();
  const isRecibo = doc.tipo === 'recibo';
  const titulo = isRecibo ? 'RECIBO DE PAGAMENTO' : 'FACTURA DE MULTA';
  const statusBadge = isRecibo ? 'PAGO' : 'PENDENTE DE PAGAMENTO';
  const statusColor = isRecibo ? '#059669' : '#d97706';

  const qrData = JSON.stringify({
    tipo: doc.tipo,
    numero: doc.numero,
    auto: doc.numeroAuto,
    infrator: doc.infrator,
    valor: doc.valor,
    data: doc.data,
    hora: doc.hora,
    status: isRecibo ? 'pago' : 'pendente',
    metodo: doc.metodoPagamento,
    ref: doc.referencia,
  });
  const qrBase64 = await generateQRBase64(qrData, 150);
  const valorFmt = Number(doc.valor || 0).toFixed(2);
  const matriculaLabel = doc.categoriaMulta === 'imovel' ? 'Nº Porta / Talhão' : 'Matrícula';

  return `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <title>${titulo} - ${doc.numero}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #111827;
      background: #fff;
    }
    .receipt-box {
      max-width: 170mm;
      margin: 0 auto;
      border: 1.5px solid #1f2937;
      border-radius: 8px;
      padding: 16px;
      background: #fff;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #111827;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .logo {
      width: 52px;
      height: 52px;
      object-fit: contain;
      margin: 0 auto 6px;
      display: block;
    }
    .header h1 {
      font-size: 15px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #111827;
    }
    .header h2 {
      font-size: 12px;
      font-weight: 600;
      color: #4b5563;
      margin-top: 2px;
    }
    .title-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 14px;
    }
    .title-banner h3 {
      font-size: 13px;
      font-weight: 800;
      color: #111827;
    }
    .status-pill {
      font-size: 11px;
      font-weight: 800;
      color: #fff;
      background: ${statusColor};
      padding: 3px 10px;
      border-radius: 9999px;
    }
    .grid-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 14px;
    }
    .info-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 10px;
    }
    .info-card h4 {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 6px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 3px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 11.5px;
      padding: 2px 0;
    }
    .info-label {
      color: #4b5563;
      font-weight: 500;
    }
    .info-val {
      font-weight: 700;
      color: #111827;
    }
    .total-box {
      background: #ecfdf5;
      border: 1.5px solid #059669;
      border-radius: 6px;
      padding: 12px;
      text-align: center;
      margin: 14px 0;
    }
    .total-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #065f46;
    }
    .total-val {
      font-size: 22px;
      font-weight: 900;
      color: #047857;
      margin: 2px 0;
    }
    .bottom-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #e5e7eb;
      padding-top: 12px;
      margin-top: 12px;
    }
    .qr-side {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .qr-side img {
      width: 64px;
      height: 64px;
    }
    .sig-box {
      width: 45%;
      text-align: center;
    }
    .sig-line {
      border-top: 1px solid #111827;
      margin-top: 30px;
      padding-top: 4px;
      font-size: 10px;
      font-weight: 600;
    }
    .footer-note {
      text-align: center;
      font-size: 9px;
      color: #6b7280;
      margin-top: 14px;
    }
    @media print {
      body { background: #fff !important; }
      .receipt-box { border: 1.5px solid #000; }
    }
  </style>
</head>
<body>
  <div class="receipt-box">
    <div class="header">
      <img class="logo" src="${logo}" alt="Logo Matola" />
      <h1>Conselho Municipal da Cidade da Matola</h1>
      <h2>Comando da Polícia Municipal · SIGEMM</h2>
    </div>

    <div class="title-banner">
      <div>
        <h3>${titulo}</h3>
        <p style="font-size: 10.5px; color: #4b5563;">Nº do Documento: <strong>${doc.numero}</strong> ${doc.numeroAuto ? `· Auto: <strong>${doc.numeroAuto}</strong>` : ''}</p>
      </div>
      <span class="status-pill">${statusBadge}</span>
    </div>

    <div class="grid-info">
      <div class="info-card">
        <h4>Identificação do Infractor</h4>
        <div class="info-row"><span class="info-label">Nome:</span><span class="info-val">${doc.infrator}</span></div>
        <div class="info-row"><span class="info-label">Doc. ID:</span><span class="info-val">${doc.documentoId || '—'}</span></div>
        <div class="info-row"><span class="info-label">${matriculaLabel}:</span><span class="info-val">${doc.matricula || '—'}</span></div>
        <div class="info-row"><span class="info-label">Residência:</span><span class="info-val">${doc.residenciaBairro || doc.local || '—'}</span></div>
      </div>

      <div class="info-card">
        <h4>Dados da Autuação</h4>
        <div class="info-row"><span class="info-label">Data e Hora:</span><span class="info-val">${doc.data} às ${doc.hora}</span></div>
        <div class="info-row"><span class="info-label">Agente:</span><span class="info-val">${doc.agente}</span></div>
        <div class="info-row"><span class="info-label">Local:</span><span class="info-val">${doc.local}</span></div>
        <div class="info-row"><span class="info-label">Infracção:</span><span class="info-val">${doc.infracao}</span></div>
      </div>
    </div>

    ${doc.metodoPagamento || doc.referencia || doc.localPagamento ? `
      <div class="info-card" style="margin-bottom: 12px;">
        <h4>Informações de Pagamento</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          ${doc.metodoPagamento ? `<div class="info-row"><span class="info-label">Forma de Pagamento:</span><span class="info-val">${formatPaymentMethodLabel(doc.metodoPagamento)}</span></div>` : ''}
          ${doc.referencia ? `<div class="info-row"><span class="info-label">Referência / Caixa:</span><span class="info-val">${doc.referencia}</span></div>` : ''}
          ${doc.localPagamento ? `<div class="info-row"><span class="info-label">Local de Pagamento:</span><span class="info-val">${doc.localPagamento}</span></div>` : ''}
        </div>
      </div>
    ` : ''}

    <div class="total-box">
      <div class="total-label">${isRecibo ? 'Total Pago' : 'Valor a Liquidar'}</div>
      <div class="total-val">${valorFmt} MT</div>
      <div style="font-size: 10.5px; color: #065f46;">${doc.valorExtenso || valorFmt + ' Meticais'}</div>
    </div>

    <div class="bottom-row">
      <div class="qr-side">
        ${qrBase64 ? `<img src="${qrBase64}" />` : ''}
        <div style="font-size: 9.5px; color: #4b5563;">
          <p>Valide este documento através</p>
          <p>do QR Code no portal SIGEMM.</p>
          <p><strong>Emitido em:</strong> ${doc.data} ${doc.hora}</p>
        </div>
      </div>

      <div class="sig-box">
        ${doc.assinaturaAgente ? `<img style="max-height:36px; display:block; margin:0 auto;" src="${doc.assinaturaAgente}" />` : ''}
        <div class="sig-line">Assinatura / Carimbo do Agente</div>
      </div>
    </div>

    <div class="footer-note">
      Conselho Municipal da Cidade da Matola · Av. do Almoxarifado nº 11072 · Tel: +258 21 720 000 · SIGEMM v1.0
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Builds thermal receipt (80mm / 58mm POS tape format)
 */
export async function buildThermalReceiptHtml(doc: DocumentData, widthMm: 80 | 58 = 80): Promise<string> {
  const logo = await getLogoBase64();
  const isRecibo = doc.tipo === 'recibo';
  const qrData = JSON.stringify({
    tipo: doc.tipo,
    num: doc.numero,
    auto: doc.numeroAuto,
    val: doc.valor,
    infr: doc.infrator,
    data: doc.data,
  });
  const qrBase64 = await generateQRBase64(qrData, 130);
  const valorFmt = Number(doc.valor || 0).toFixed(2);
  const matriculaLabel = doc.categoriaMulta === 'imovel' ? 'Porta/Talhão' : 'Matrícula';

  return `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <title>Talão Térmico - ${doc.numero}</title>
  <style>
    @page {
      size: ${widthMm}mm auto;
      margin: 2mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: "Courier New", Courier, monospace, monospace;
      font-size: ${widthMm === 58 ? '10px' : '11.5px'};
      line-height: 1.35;
      color: #000;
      background: #fff;
      width: ${widthMm}mm;
      margin: 0 auto;
      padding: 4px;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider {
      border-top: 1px dashed #000;
      margin: 5px 0;
    }
    .double-divider {
      border-top: 2px solid #000;
      margin: 6px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
    }
    .logo {
      width: 36px;
      height: 36px;
      display: block;
      margin: 0 auto 3px;
      object-fit: contain;
    }
    .big-val {
      font-size: ${widthMm === 58 ? '13px' : '15px'};
      font-weight: bold;
      text-align: center;
      padding: 4px 0;
    }
    .qr-center {
      text-align: center;
      margin: 6px 0;
    }
    .qr-center img {
      width: 100px;
      height: 100px;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <div class="center">
    <img class="logo" src="${logo}" alt="CMM" />
    <div class="bold">MUNICIPIO DA MATOLA</div>
    <div>POLICIA MUNICIPAL - SIGEMM</div>
    <div class="divider"></div>
    <div class="bold">${isRecibo ? 'RECIBO DE PAGAMENTO' : 'TALÃO DE MULTA'}</div>
    <div class="divider"></div>
  </div>

  <div class="row"><span>Multa Nº:</span><span class="bold">${doc.numero}</span></div>
  ${doc.numeroAuto ? `<div class="row"><span>Auto Nº:</span><span class="bold">${doc.numeroAuto}</span></div>` : ''}
  <div class="row"><span>Data:</span><span>${doc.data} ${doc.hora}</span></div>
  <div class="row"><span>Agente:</span><span>${doc.agente}</span></div>
  
  <div class="divider"></div>
  <div class="row"><span>Infractor:</span><span class="bold">${doc.infrator}</span></div>
  <div class="row"><span>Doc ID:</span><span>${doc.documentoId || '—'}</span></div>
  ${doc.matricula ? `<div class="row"><span>${matriculaLabel}:</span><span class="bold">${doc.matricula}</span></div>` : ''}
  <div>Infracção: ${doc.infracao}</div>
  <div>Local: ${doc.local}</div>

  <div class="double-divider"></div>
  <div class="big-val">VALOR: ${valorFmt} MT</div>
  <div class="center bold">${isRecibo ? '*** PAGO ***' : '*** PENDENTE ***'}</div>
  <div class="double-divider"></div>

  ${doc.metodoPagamento ? `<div class="row"><span>Pagamento:</span><span>${formatPaymentMethodLabel(doc.metodoPagamento)}</span></div>` : ''}
  ${doc.referencia ? `<div class="row"><span>Ref:</span><span>${doc.referencia}</span></div>` : ''}

  <div class="qr-center">
    ${qrBase64 ? `<img src="${qrBase64}" />` : ''}
  </div>

  <div class="center" style="font-size: 9px; margin-top: 4px;">
    ${isRecibo ? 'Obrigado por manter a cidade organizada.' : 'Pague no prazo de 15 dias úteis para evitar encaminhamento ao tribunal.'}
  </div>
  <div class="center" style="font-size: 8px; margin-top: 6px; color: #333;">
    CMM Matola · SIGEMM v1.0
  </div>
</body>
</html>
  `;
}

/**
 * Builds HTML representation of statistical / municipal reports
 */
export async function buildReportHtml(report: ReportPrintData): Promise<string> {
  const logo = await getLogoBase64();
  const dataHoje = report.dataGeracao || new Date().toLocaleDateString('pt-MZ');
  const horaHoje = new Date().toLocaleTimeString('pt-MZ');

  return `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <title>${report.titulo}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #111827;
      background: #fff;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      border-bottom: 2px solid #111827;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .logo {
      width: 48px;
      height: 48px;
      object-fit: contain;
    }
    .header-text h1 {
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      color: #111827;
    }
    .header-text h2 {
      font-size: 11px;
      font-weight: 600;
      color: #4b5563;
    }
    .report-meta {
      display: flex;
      justify-content: space-between;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 10px;
      margin-bottom: 12px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }
    .kpi-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 8px;
      text-align: center;
    }
    .kpi-label {
      font-size: 9px;
      color: #6b7280;
      text-transform: uppercase;
      font-weight: 600;
    }
    .kpi-val {
      font-size: 14px;
      font-weight: 800;
      color: #111827;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 16px;
    }
    th {
      background: #1e3a8a;
      color: #fff;
      font-weight: 700;
      text-align: left;
      padding: 5px 6px;
      border: 1px solid #1e3a8a;
      font-size: 9.5px;
      text-transform: uppercase;
    }
    td {
      padding: 4.5px 6px;
      border: 1px solid #e5e7eb;
      color: #1f2937;
    }
    tr:nth-child(even) {
      background: #f9fafb;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      font-size: 9.5px;
    }
    .sig-line {
      width: 180px;
      border-top: 1px solid #111827;
      text-align: center;
      padding-top: 3px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="header">
    <img class="logo" src="${logo}" alt="Logo Matola" />
    <div class="header-text">
      <h1>Conselho Municipal da Cidade da Matola</h1>
      <h2>Comando da Polícia Municipal · ${report.titulo}</h2>
    </div>
  </div>

  <div class="report-meta">
    <div><strong>Período:</strong> ${report.periodo || 'Geral / Todo o histórico'}</div>
    <div><strong>Emitido em:</strong> ${dataHoje} às ${horaHoje}</div>
    ${report.geradoPor ? `<div><strong>Emitido por:</strong> ${report.geradoPor}</div>` : ''}
  </div>

  ${report.resumo && report.resumo.length > 0 ? `
    <div class="kpi-grid">
      ${report.resumo.map(k => `
        <div class="kpi-card">
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-val">${k.valor}</div>
        </div>
      `).join('')}
    </div>
  ` : ''}

  <table>
    <thead>
      <tr>
        ${report.colunas.map(c => `<th>${c}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${report.linhas.map(row => `
        <tr>
          ${row.map(cell => `<td>${cell}</td>`).join('')}
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <div>
      <p>SIGEMM · Sistema de Gestão Municipal</p>
      <p style="color: #6b7280;">Total de registos impressos: ${report.linhas.length}</p>
    </div>
    <div class="sig-line">
      Responsável / Visto
    </div>
  </div>
</body>
</html>
  `;
}
