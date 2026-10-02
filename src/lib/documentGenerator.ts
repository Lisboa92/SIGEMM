import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import logoMatolaImg from '@/assets/logo-matola.png';

export interface DocumentData {
  tipo: 'recibo' | 'factura';
  numero: string;
  data: string;
  hora: string;
  agente: string;
  infrator: string;
  documentoId: string;
  matricula: string;
  infracao: string;
  local: string;
  valor: number;
  localPagamento?: string;
  metodoPagamento?: string;
  referencia?: string;
  categoriaMulta?: 'movel' | 'imovel';
  numeroAuto?: string;
  numeroProcesso?: string;
  // Identificação civil
  estadoCivil?: string;
  dataNascimento?: string; // dd/mm/aaaa
  naturalDe?: string;
  nomePai?: string;
  nomeMae?: string;
  profissao?: string;
  localTrabalho?: string;
  // Residência
  residenciaBairro?: string;
  residenciaQuarteirao?: string;
  residenciaAvenida?: string;
  residenciaCasa?: string;
  // Localização da infracção
  postoAdministrativo?: string;
  localQuarteirao?: string;
  localAvenida?: string;
  localCasa?: string;
  // Base legal
  alineaTransgredida?: string;
  numeroTransgredido?: string;
  artigoTransgredido?: string;
  legislacao?: string;
  alineaPunicao?: string;
  numeroPunicao?: string;
  artigoPunicao?: string;
  valorExtenso?: string;
  // Assinaturas digitais (data URL PNG)
  assinaturaInfrator?: string;
  assinaturaAgente?: string;
}

export function formatPaymentMethodLabel(method?: string): string {
  if (!method) return '—';
  const m = method.toLowerCase().trim();
  if (m === 'numerario' || m === 'dinheiro') return 'Dinheiro (Numerário)';
  if (m === 'pos') return 'POS (Terminal)';
  if (m === 'mpesa') return 'M-Pesa';
  if (m === 'emola') return 'e-Mola';
  if (m === 'mkesh') return 'mKesh';
  if (m === 'deposito') return 'Depósito Bancário';
  return method.toUpperCase();
}

async function generateQRDataUrl(data: string): Promise<string> {
  return QRCode.toDataURL(data, { width: 120, margin: 1 });
}

async function loadImageAsBase64(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}

export async function generatePDF(doc: DocumentData): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'mm', format: [80, 210] });
  const w = 80;
  let y = 6;

  // Load and add logo
  try {
    const logoBase64 = await loadImageAsBase64(logoMatolaImg);
    if (logoBase64) {
      pdf.addImage(logoBase64, 'PNG', (w - 14) / 2, y, 14, 14);
      y += 16;
    }
  } catch {
    y += 2;
  }

  // Header
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CONSELHO MUNICIPAL DA MATOLA', w / 2, y, { align: 'center' });
  y += 4;
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text('SIGEMM - Sistema de Gestão de Multas', w / 2, y, { align: 'center' });
  y += 5;

  pdf.setLineWidth(0.3);
  pdf.line(4, y, w - 4, y);
  y += 4;

  // Title
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  const titulo = doc.tipo === 'recibo' ? 'RECIBO DE PAGAMENTO' : 'FACTURA DE MULTA';
  pdf.text(titulo, w / 2, y, { align: 'center' });
  y += 5;
  pdf.line(4, y, w - 4, y);
  y += 4;

  // Details
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  const addLine = (label: string, value: string) => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, 4, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value, 30, y);
    y += 4;
  };

  addLine('Nº:', doc.numero);
  addLine('Data:', `${doc.data} ${doc.hora}`);
  addLine('Agente:', doc.agente);
  y += 2;
  addLine('Infrator:', doc.infrator);
  addLine('BI. nº:', doc.documentoId || '—');
  if (doc.matricula) {
    const labelMatricula = doc.categoriaMulta === 'imovel' ? 'Nº Porta/Talhão:' : 'Matrícula:';
    addLine(labelMatricula, doc.matricula);
  }
  y += 2;
  addLine('Infracção:', doc.infracao);
  addLine('Local:', doc.local);

  if (doc.localPagamento) {
    y += 2;
    addLine('Pagar em:', doc.localPagamento);
  }
  if (doc.metodoPagamento) addLine('Método:', formatPaymentMethodLabel(doc.metodoPagamento));
  if (doc.referencia) addLine('Ref.:', doc.referencia);

  y += 3;
  pdf.line(4, y, w - 4, y);
  y += 5;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`VALOR: ${doc.valor.toFixed(2)} MT`, w / 2, y, { align: 'center' });
  y += 5;
  pdf.line(4, y, w - 4, y);
  y += 4;

  pdf.setFontSize(8);
  pdf.text(doc.tipo === 'recibo' ? 'PAGO' : 'PENDENTE', w / 2, y, { align: 'center' });
  y += 5;

  // QR Code
  try {
    const qrData = JSON.stringify({
      tipo: doc.tipo, numero: doc.numero, valor: doc.valor,
      infrator: doc.infrator, infracao: doc.infracao, data: doc.data,
      status: doc.tipo === 'recibo' ? 'pago' : 'pendente',
    });
    const qrUrl = await generateQRDataUrl(qrData);
    pdf.addImage(qrUrl, 'PNG', (w - 25) / 2, y, 25, 25);
    y += 28;
  } catch { y += 2; }

  // Footer
  pdf.setFontSize(6);
  pdf.setFont('helvetica', 'normal');
  if (doc.tipo === 'factura') {
    pdf.text('Pague dentro de 15 dias úteis', w / 2, y, { align: 'center' });
    y += 3;
    pdf.text('para evitar agravamento.', w / 2, y, { align: 'center' });
    y += 4;
  }
  pdf.text('Conselho Municipal da Matola', w / 2, y, { align: 'center' });

  return pdf.output('blob');
}

export async function downloadDocument(doc: DocumentData) {
  const blob = await generatePDF(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.tipo}_${doc.numero}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function shareDocument(doc: DocumentData) {
  try {
    const blob = await generatePDF(doc);
    const file = new File([blob], `${doc.tipo}_${doc.numero}.pdf`, { type: 'application/pdf' });
    const title = `${doc.tipo === 'recibo' ? 'Recibo' : 'Factura'} - ${doc.numero}`;
    const text = `${doc.tipo === 'recibo' ? 'Recibo de Pagamento' : 'Factura de Multa'} nº ${doc.numero} - ${doc.valor.toFixed(2)} MT`;

    // Try native share with file first (mobile apps like WhatsApp, Gmail)
    if (navigator.share) {
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title, text, files: [file] });
          return true;
        }
        // Fallback: share without file (link/text only)
        await navigator.share({ title, text });
        return true;
      } catch (e: any) {
        // User cancelled share - not an error
        if (e?.name === 'AbortError') return false;
        throw e;
      }
    }

    // Desktop fallback: download
    await downloadDocument(doc);
    return true;
  } catch {
    return false;
  }
}

export function buildDocumentData(multa: any, tipo: 'recibo' | 'factura', agente?: string): DocumentData {
  if (!multa) {
    return {
      tipo,
      numero: '—',
      data: new Date().toLocaleDateString('pt-MZ'),
      hora: new Date().toLocaleTimeString('pt-MZ'),
      agente: agente || '',
      infrator: '—',
      documentoId: '',
      matricula: '',
      infracao: '—',
      local: '—',
      valor: 0,
      categoriaMulta: 'movel',
    };
  }

  const getPaymentLocation = (obs: string | null) => {
    if (!obs) return 'Balcão Único do CMM - Sede';
    const match = obs.match(/Local pagamento: (.+?)(\||$)/);
    return match ? match[1].trim() : 'Balcão Único do CMM - Sede';
  };

  const getPaymentMethod = (obs: string | null) => {
    if (!obs) return undefined;
    const match = obs.match(/Pagamento: (\w+)/i);
    return match ? match[1] : undefined;
  };

  const categoriaMulta = (multa.categoria === 'imovel' || (typeof multa.observacoes === 'string' && multa.observacoes.includes('[IMÓVEL]'))) ? 'imovel' as const : 'movel' as const;

  const fmtDate = (s?: any) => {
    if (!s) return undefined;
    try {
      const d = new Date(s);
      if (isNaN(d.getTime())) return String(s);
      return d.toLocaleDateString('pt-MZ');
    } catch {
      return String(s);
    }
  };

  const safeDate = (s?: any) => {
    if (!s) return new Date().toLocaleDateString('pt-MZ');
    try {
      const d = new Date(s);
      if (isNaN(d.getTime())) return new Date().toLocaleDateString('pt-MZ');
      return d.toLocaleDateString('pt-MZ');
    } catch {
      return new Date().toLocaleDateString('pt-MZ');
    }
  };

  const safeTime = (s?: any) => {
    if (!s) return new Date().toLocaleTimeString('pt-MZ');
    try {
      const d = new Date(s);
      if (isNaN(d.getTime())) return new Date().toLocaleTimeString('pt-MZ');
      return d.toLocaleTimeString('pt-MZ');
    } catch {
      return new Date().toLocaleTimeString('pt-MZ');
    }
  };

  return {
    tipo,
    numero: multa.numero || '—',
    data: safeDate(multa.created_at),
    hora: safeTime(multa.created_at),
    agente: agente || multa.agente_email || '',
    infrator: multa.infrator_nome || '—',
    documentoId: multa.infrator_documento || '',
    matricula: multa.matricula || '',
    infracao: multa.infracao_tipo || '—',
    local: multa.local || '—',
    valor: Number(multa.valor || 0),
    localPagamento: multa.local_pagamento || getPaymentLocation(multa.observacoes),
    metodoPagamento: multa.forma_pagamento || getPaymentMethod(multa.observacoes),
    referencia: multa.referencia_deposito,
    categoriaMulta,
    numeroAuto: multa.numero_auto || undefined,
    numeroProcesso: multa.numero_processo || undefined,
    estadoCivil: multa.estado_civil || undefined,
    dataNascimento: fmtDate(multa.data_nascimento),
    naturalDe: multa.natural_de || undefined,
    nomePai: multa.nome_pai || undefined,
    nomeMae: multa.nome_mae || undefined,
    profissao: multa.profissao || undefined,
    localTrabalho: multa.local_trabalho || undefined,
    residenciaBairro: multa.residencia_bairro || undefined,
    residenciaQuarteirao: multa.residencia_quarteirao || undefined,
    residenciaAvenida: multa.residencia_avenida || undefined,
    residenciaCasa: multa.residencia_casa || undefined,
    postoAdministrativo: multa.posto_administrativo || undefined,
    localQuarteirao: multa.local_quarteirao || undefined,
    localAvenida: multa.local_avenida || undefined,
    localCasa: multa.local_casa || undefined,
    alineaTransgredida: multa.alinea_transgredida || undefined,
    numeroTransgredido: multa.numero_transgredido || undefined,
    artigoTransgredido: multa.artigo_transgredido || undefined,
    legislacao: multa.legislacao || undefined,
    alineaPunicao: multa.alinea_punicao || undefined,
    numeroPunicao: multa.numero_punicao || undefined,
    artigoPunicao: multa.artigo_punicao || undefined,
    valorExtenso: multa.valor_extenso || undefined,
    assinaturaInfrator: multa.assinatura_infrator || undefined,
    assinaturaAgente: multa.assinatura_agente || undefined,
  };
}

/** Desenha as assinaturas digitais imediatamente acima das linhas de assinatura. */
function drawSignatures(
  pdf: jsPDF,
  doc: DocumentData,
  opts: { leftX: number; rightX: number; lineY: number; w?: number; h?: number },
) {
  const w = opts.w ?? 40;
  const h = opts.h ?? 12;
  try {
    if (doc.assinaturaInfrator) {
      pdf.addImage(doc.assinaturaInfrator, 'PNG', opts.leftX, opts.lineY - h - 1, w, h);
    }
    if (doc.assinaturaAgente) {
      pdf.addImage(doc.assinaturaAgente, 'PNG', opts.rightX, opts.lineY - h - 1, w, h);
    }
  } catch {
    // assinatura inválida — ignora silenciosamente
  }
}

// ─── Helpers comuns aos formulários oficiais ──────────────────────────
type Seg = { t: string; fill?: boolean; minW?: number };

/**
 * Renderiza segmentos inline com word-wrap. Segmentos `fill` ficam sublinhados
 * (campos preenchíveis estilo formulário oficial). Devolve o novo Y.
 */
function writeInline(pdf: jsPDF, segs: Seg[], x0: number, y0: number, maxX: number, lh = 4.8) {
  let x = x0, y = y0;
  for (const seg of segs) {
    if (seg.fill) {
      const txt = seg.t || '';
      const minW = seg.minW ?? 22;
      const wTxt = pdf.getTextWidth(txt);
      const w = Math.max(wTxt, minW);
      if (x + w > maxX) { x = x0; y += lh; }
      // texto centrado dentro da "linha" sublinhada
      const tx = x + (w - wTxt) / 2;
      pdf.text(txt, tx, y);
      pdf.setLineWidth(0.15);
      pdf.line(x, y + 0.9, x + w, y + 0.9);
      x += w + 0.6;
    } else {
      // dividir por palavras preservando espaços
      const words = seg.t.split(/(\s+)/);
      for (const word of words) {
        if (!word) continue;
        const w = pdf.getTextWidth(word);
        if (word.trim() && x + w > maxX) { x = x0; y += lh; }
        if (!word.trim() && x === x0) continue; // engole espaço no início da linha
        pdf.text(word, x, y);
        x += w;
      }
    }
  }
  return y;
}

async function drawOfficialHeader(pdf: jsPDF, W: number, y: number, tituloDireita: string) {
  try {
    const logo = await loadImageAsBase64(logoMatolaImg);
    if (logo) pdf.addImage(logo, 'PNG', W / 2 - 7, y, 14, 14);
  } catch {}
  pdf.setFont('helvetica', 'bold').setFontSize(11).setTextColor(20, 20, 20);
  pdf.text('CONSELHO MUNICIPAL DA CIDADE DA MATOLA', W / 2, y + 18, { align: 'center' });
  pdf.text('COMANDO DA POLÍCIA MUNICIPAL', W / 2, y + 23, { align: 'center' });
  pdf.setFontSize(10);
  pdf.text(tituloDireita, W - 14, y + 30, { align: 'right' });
  pdf.setLineWidth(0.5); pdf.line(14, y + 32.5, W - 14, y + 32.5);
  return y + 38;
}

function splitDateTime(doc: DocumentData) {
  const [d = '', m = '', a = ''] = (doc.data || '').split('/');
  const [hh = '', mm = ''] = (doc.hora || '').split(':');
  const ano2 = a ? a.slice(-2) : '';
  return { d, m, a, ano2, hh, mm };
}

// ─── Auto de Notícia (A4) ─────────────────────────────────────────────
export async function generateAutoNoticia(doc: DocumentData): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14, maxX = W - M;
  const { d, m, ano2, hh, mm } = splitDateTime(doc);

  // Marca d'água diagonal subtil
  pdf.setTextColor(235, 235, 235).setFont('helvetica', 'bold').setFontSize(70);
  pdf.text('CMM', W / 2, 160, { align: 'center', angle: 30 });
  pdf.setTextColor(20, 20, 20);

  let y = await drawOfficialHeader(pdf, W, 10, `AUTO DE NOTÍCIA Nº  ${doc.numeroAuto || doc.numero}`);
  y += 2;

  pdf.setFont('helvetica', 'normal').setFontSize(9.5);
  const local = doc.local || '';
  const infrator = doc.infrator || '';
  const agente = doc.agente || '';
  const docId = doc.documentoId || '';
  const matriculaLabel = doc.categoriaMulta === 'imovel' ? 'Nº Porta/Talhão' : 'Matrícula';
  const matricula = doc.matricula || '';
  const infracao = doc.infracao || '';
  const valor = doc.valor.toFixed(2);
  const [nascD = '', nascM = '', nascA = ''] = (doc.dataNascimento || '').split('/');
  const bairroLoc = doc.residenciaBairro || local;

  // Parágrafo 1 — identificação temporal, local e agente
  y = writeInline(pdf, [
    { t: 'Aos ' }, { t: d, fill: true, minW: 10 },
    { t: ' dias do mês de ' }, { t: m, fill: true, minW: 20 },
    { t: ' do ano de 20' }, { t: ano2, fill: true, minW: 10 },
    { t: ', nesta cidade da Matola, Posto Administrativo Municipal de ' },
    { t: doc.postoAdministrativo || '', fill: true, minW: 35 },
    { t: ', Bairro ' }, { t: local, fill: true, minW: 40 },
    { t: ', Quarteirão nº ' }, { t: doc.localQuarteirao || '', fill: true, minW: 14 },
    { t: ', Avenida/Rua ' }, { t: doc.localAvenida || '', fill: true, minW: 40 },
    { t: ', casa nº ' }, { t: doc.localCasa || '', fill: true, minW: 14 },
    { t: ', pelas ' }, { t: hh, fill: true, minW: 10 },
    { t: ' horas e ' }, { t: mm, fill: true, minW: 10 },
    { t: ' minutos, eu, ' }, { t: agente, fill: true, minW: 55 },
    { t: ', Agente da Polícia Municipal da Cidade da Matola autuei o/a Senhor/a ' },
    { t: infrator, fill: true, minW: 70 },
  ], M, y, maxX);
  y += 6;

  // Linha estado civil / nascimento
  y = writeInline(pdf, [
    { t: '', fill: true, minW: 40 },
    { t: ' estado civil ' }, { t: doc.estadoCivil || '', fill: true, minW: 25 },
    { t: ' nascido/a ' }, { t: nascD, fill: true, minW: 14 },
    { t: ' de ' }, { t: nascM, fill: true, minW: 22 },
    { t: ' de ' }, { t: nascA, fill: true, minW: 14 },
  ], M, y, maxX);
  y += 5.5;

  // Natural / filho de
  y = writeInline(pdf, [
    { t: 'natural ' }, { t: doc.naturalDe || '', fill: true, minW: 45 },
    { t: ' filho/a de ' }, { t: doc.nomePai || '', fill: true, minW: 70 },
  ], M, y, maxX);
  y += 5.5;

  y = writeInline(pdf, [
    { t: 'e de ' }, { t: doc.nomeMae || '', fill: true, minW: 80 },
    { t: ' profissão ' }, { t: doc.profissao || '', fill: true, minW: 40 }, { t: ',' },
  ], M, y, maxX);
  y += 5.5;

  y = writeInline(pdf, [
    { t: 'local de trabalho ' }, { t: doc.localTrabalho || '', fill: true, minW: 55 },
    { t: ', residente no Bairro ' }, { t: bairroLoc, fill: true, minW: 45 },
  ], M, y, maxX);
  y += 5.5;

  y = writeInline(pdf, [
    { t: 'Quarteirão nº ' }, { t: doc.residenciaQuarteirao || '', fill: true, minW: 25 },
    { t: '  Avenida/Rua ' }, { t: doc.residenciaAvenida || '', fill: true, minW: 90 },
  ], M, y, maxX);
  y += 5.5;

  // Parágrafo da transgressão (inclui matrícula/talhão e descrição da infracção)
  y = writeInline(pdf, [
    { t: 'Casa nº ' }, { t: doc.residenciaCasa || '', fill: true, minW: 16 },
    { t: ', por haver transgredido as disposições da alínea ' },
    { t: doc.alineaTransgredida || '', fill: true, minW: 16 },
    { t: ' ) do nº ' }, { t: doc.numeroTransgredido || '', fill: true, minW: 14 },
    { t: ' do artigo ' }, { t: doc.artigoTransgredido || '', fill: true, minW: 16 },
    { t: ' do/a ' }, { t: doc.legislacao || infracao, fill: true, minW: 60 },
    { t: ' punível nos termos da alínea ' }, { t: doc.alineaPunicao || '', fill: true, minW: 14 },
    { t: ' ) do nº ' }, { t: doc.numeroPunicao || '', fill: true, minW: 12 },
    { t: ' do artigo ' }, { t: doc.artigoPunicao || '', fill: true, minW: 14 },
    { t: ` da legislação supracitada (${matriculaLabel}: ` },
    { t: matricula, fill: true, minW: 30 }, { t: '; Doc.ID: ' },
    { t: docId, fill: true, minW: 28 }, { t: '),' },
    { t: ' com a multa de ' }, { t: doc.valorExtenso || '', fill: true, minW: 55 },
    { t: ', ' }, { t: valor, fill: true, minW: 22 },
    { t: ' MT, e deve proceder ao pagamento na tesouraria da Polícia Municipal, sita na Avenida de Almoxarifado nº 11072 no prazo de 15 dias, findo o qual o auto será remetido ao Tribunal competente.' },
  ], M, y, maxX);
  y += 7;

  pdf.setFont('helvetica', 'italic').setFontSize(9);
  const fecho = pdf.splitTextToSize(
    'Por isso, e em cumprimento da obrigação que a lei me impõe, levanto este auto, que afirmo por minha honra ser verdadeiro como nele se contém e vai assinado por mim e pelas testemunhas.',
    maxX - M,
  );
  pdf.text(fecho, M, y); y += fecho.length * 4.5 + 4;

  // TESTEMUNHAS
  pdf.setFont('helvetica', 'bold').setFontSize(10);
  pdf.text('TESTEMUNHAS:', W / 2, y, { align: 'center' }); y += 5;
  pdf.setLineWidth(0.15);
  pdf.line(M, y, maxX, y); y += 5;
  pdf.line(M, y, maxX, y); y += 8;

  // INFORMAÇÕES COMPLEMENTARES
  pdf.text('INFORMAÇÕES COMPLEMENTARES', W / 2, y, { align: 'center' }); y += 5;
  pdf.line(M, y, maxX, y); y += 5;
  pdf.line(M, y, maxX, y); y += 12;

  // Assinaturas
  pdf.line(M + 6, y, M + 76, y);
  pdf.line(W - M - 76, y, W - M - 6, y);
  drawSignatures(pdf, doc, { leftX: M + 21, rightX: W - M - 61, lineY: y });
  y += 4;
  pdf.setFont('helvetica', 'normal').setFontSize(9);
  pdf.text('O Transgressor', M + 41, y, { align: 'center' });
  pdf.text('O Agente Autuante', W - M - 41, y, { align: 'center' });
  y += 10;

  // QR + carimbo digital — posicionados no fundo da página, sem sobrepor texto
  const H_AN = 297;
  try {
    const qr = await generateQRDataUrl(JSON.stringify({
      tipo: 'auto-noticia', auto: doc.numeroAuto, numero: doc.numero,
      valor: doc.valor, infrator: doc.infrator, data: doc.data,
    }));
    pdf.addImage(qr, 'PNG', M, H_AN - 28, 20, 20);
  } catch {}
  pdf.setFont('helvetica', 'italic').setFontSize(7).setTextColor(110, 110, 110);
  pdf.text(
    `SIGEMM · Auto de Notícia · ${doc.numero} · emitido em ${doc.data} ${doc.hora}`,
    W - M, H_AN - 6, { align: 'right' },
  );
  pdf.setTextColor(20, 20, 20);

  return pdf.output('blob');
}

// ─── Aviso de Multa (A4) ──────────────────────────────────────────────
export async function generateAvisoMulta(doc: DocumentData): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14, maxX = W - M;
  const { d, m, ano2, hh, mm } = splitDateTime(doc);

  pdf.setTextColor(240, 240, 240).setFont('helvetica', 'bold').setFontSize(70);
  pdf.text('AVISO', W / 2, 180, { align: 'center', angle: 30 });
  pdf.setTextColor(20, 20, 20);

  let y = await drawOfficialHeader(pdf, W, 10, `AVISO DE MULTA Nº  ${doc.numeroAuto || doc.numero}`);
  y += 4;

  pdf.setFont('helvetica', 'normal').setFontSize(9.5);
  const local = doc.local || '';
  const infrator = doc.infrator || '';
  const infracao = doc.infracao || '';
  const matriculaLabel = doc.categoriaMulta === 'imovel' ? 'Nº Porta/Talhão' : 'Matrícula';
  const matricula = doc.matricula || '';
  const valor = doc.valor.toFixed(2);

  y = writeInline(pdf, [
    { t: 'Fica avisado/a ' }, { t: infrator, fill: true, minW: 80 },
    { t: ' que foi autuado/a no Bairro ' }, { t: local, fill: true, minW: 45 },
    { t: ' Quarteirão nº ' }, { t: doc.localQuarteirao || '', fill: true, minW: 18 },
    { t: ' Avenida/Rua ' }, { t: doc.localAvenida || '', fill: true, minW: 55 },
    { t: ' Casa nº ' }, { t: doc.localCasa || '', fill: true, minW: 14 },
    { t: ' pelas ' }, { t: hh, fill: true, minW: 12 },
    { t: ' horas e ' }, { t: mm, fill: true, minW: 12 },
    { t: ' minutos, por haver transgredido as disposições da alínea ' },
    { t: doc.alineaTransgredida || '', fill: true, minW: 14 },
    { t: ' )do nº ' }, { t: doc.numeroTransgredido || '', fill: true, minW: 12 },
    { t: ' do artigo ' }, { t: doc.artigoTransgredido || '', fill: true, minW: 14 },
    { t: ' do/a ' }, { t: doc.legislacao || infracao, fill: true, minW: 60 },
    { t: `  (${matriculaLabel}: ` }, { t: matricula, fill: true, minW: 30 }, { t: ')' },
    { t: ' com a multa de ' }, { t: valor, fill: true, minW: 28 },
    { t: ' MT, e deve proceder ao pagamento na Tesouraria da Polícia Municipal, sita na Avenida do Almoxarifado nº 11072, no prazo de 15 dias findo o qual o auto será remetido ao Tribunal competente.' },
  ], M, y, maxX);
  y += 12;

  // Valor em destaque
  pdf.setFont('helvetica', 'bold').setFontSize(12);
  pdf.text(`VALOR A PAGAR: ${valor} MT`, W / 2, y, { align: 'center' });
  y += 14;

  // Data e assinatura
  pdf.setFont('helvetica', 'normal').setFontSize(9.5);
  y = writeInline(pdf, [
    { t: 'Matola, aos ' }, { t: d, fill: true, minW: 12 },
    { t: ' de ' }, { t: m, fill: true, minW: 22 },
    { t: ' de 20' }, { t: ano2, fill: true, minW: 10 },
  ], W / 2 - 50, y, W / 2 + 70);
  y += 18;

  pdf.setLineWidth(0.2);
  pdf.line(W - M - 76, y, W - M - 6, y); y += 4;
  drawSignatures(pdf, { ...doc, assinaturaInfrator: undefined } as DocumentData, {
    leftX: 0, rightX: W - M - 60, lineY: y - 4, w: 38, h: 11,
  });
  pdf.setFontSize(9).text('O Agente Autuante', W - M - 41, y, { align: 'center' });

  // QR
  try {
    const qr = await generateQRDataUrl(JSON.stringify({
      tipo: 'aviso-multa', auto: doc.numeroAuto, numero: doc.numero,
      valor: doc.valor, infrator: doc.infrator, data: doc.data,
    }));
    pdf.addImage(qr, 'PNG', M, y - 10, 22, 22);
  } catch {}

  pdf.setFont('helvetica', 'italic').setFontSize(7).setTextColor(110, 110, 110);
  pdf.text(`SIGEMM · Aviso de Multa · ${doc.numero} · emitido em ${doc.data} ${doc.hora}`, M, y + 18);

  return pdf.output('blob');
}

export async function shareAutoNoticia(doc: DocumentData) {
  const blob = await generateAutoNoticia(doc);
  const file = new File([blob], `auto-noticia-${doc.numeroAuto || doc.numero}.pdf`, { type: 'application/pdf' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: `Auto de Notícia ${doc.numeroAuto || doc.numero}`, files: [file] });
      return true;
    }
  } catch {}
  return false;
}

export async function downloadAutoNoticia(doc: DocumentData) {
  const blob = await generateAutoNoticia(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `auto-noticia-${doc.numeroAuto || doc.numero}.pdf`; a.click();
  URL.revokeObjectURL(url);
}
export async function downloadAvisoMulta(doc: DocumentData) {
  const blob = await generateAvisoMulta(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `aviso-multa-${doc.numeroAuto || doc.numero}.pdf`; a.click();
  URL.revokeObjectURL(url);
}

// ─── Auto de Notícia + Aviso de Multa na MESMA folha A4 ──────────────
// Renderiza os dois documentos numa única página A4, separados por
// uma linha tracejada de corte. Pensado para emitir num único clique.
export async function generateAutoEAviso(
  doc: DocumentData,
  opts?: { autoPrint?: boolean },
): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 12, maxX = W - M;
  const { d, m, ano2, hh, mm } = splitDateTime(doc);

  const local = doc.local || '';
  const infrator = doc.infrator || '';
  const agente = doc.agente || '';
  const docId = doc.documentoId || '';
  const matriculaLabel = doc.categoriaMulta === 'imovel' ? 'Nº Porta/Talhão' : 'Matrícula';
  const matricula = doc.matricula || '';
  const infracao = doc.infracao || '';
  const valor = doc.valor.toFixed(2);
  const [nascD = '', nascM = '', nascA = ''] = (doc.dataNascimento || '').split('/');
  const bairroLoc = doc.residenciaBairro || local;

  // Cabeçalho oficial compacto (reaproveitável)
  const compactHeader = async (yTop: number, titulo: string) => {
    try {
      const logo = await loadImageAsBase64(logoMatolaImg);
      if (logo) pdf.addImage(logo, 'PNG', W / 2 - 5.5, yTop, 11, 11);
    } catch {}
    pdf.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(20, 20, 20);
    pdf.text('CONSELHO MUNICIPAL DA CIDADE DA MATOLA', W / 2, yTop + 14, { align: 'center' });
    pdf.setFontSize(8.5);
    pdf.text('COMANDO DA POLÍCIA MUNICIPAL', W / 2, yTop + 18.2, { align: 'center' });
    pdf.setFontSize(8.8);
    pdf.text(titulo, W - M, yTop + 23.4, { align: 'right' });
    pdf.setLineWidth(0.4); pdf.line(M, yTop + 25.4, W - M, yTop + 25.4);
    return yTop + 29;
  };

  // ───── 1) AUTO DE NOTÍCIA (metade superior) ─────
  let y = await compactHeader(8, `AUTO DE NOTÍCIA Nº  ${doc.numeroAuto || doc.numero}`);
  pdf.setFont('helvetica', 'normal').setFontSize(8.6);
  const lh = 4.3;

  y = writeInline(pdf, [
    { t: 'Aos ' }, { t: d, fill: true, minW: 8 },
    { t: ' dias do mês de ' }, { t: m, fill: true, minW: 18 },
    { t: ' do ano de 20' }, { t: ano2, fill: true, minW: 8 },
    { t: ', nesta cidade da Matola, Posto Administrativo Municipal de ' },
    { t: doc.postoAdministrativo || '', fill: true, minW: 30 },
    { t: ', Bairro ' }, { t: local, fill: true, minW: 35 },
    { t: ', Quarteirão nº ' }, { t: doc.localQuarteirao || '', fill: true, minW: 12 },
    { t: ', Avenida/Rua ' }, { t: doc.localAvenida || '', fill: true, minW: 35 },
    { t: ', casa nº ' }, { t: doc.localCasa || '', fill: true, minW: 12 },
    { t: ', pelas ' }, { t: hh, fill: true, minW: 8 },
    { t: ' horas e ' }, { t: mm, fill: true, minW: 8 },
    { t: ' minutos, eu, ' }, { t: agente, fill: true, minW: 45 },
    { t: ', Agente da Polícia Municipal, autuei o/a Senhor/a ' },
    { t: infrator, fill: true, minW: 60 },
    { t: ', estado civil ' }, { t: doc.estadoCivil || '', fill: true, minW: 22 },
    { t: ', nascido/a a ' }, { t: nascD, fill: true, minW: 10 },
    { t: '/' }, { t: nascM, fill: true, minW: 18 },
    { t: '/' }, { t: nascA, fill: true, minW: 12 },
    { t: ', natural de ' }, { t: doc.naturalDe || '', fill: true, minW: 38 },
    { t: ', filho/a de ' }, { t: doc.nomePai || '', fill: true, minW: 55 },
    { t: ' e de ' }, { t: doc.nomeMae || '', fill: true, minW: 55 },
    { t: ', profissão ' }, { t: doc.profissao || '', fill: true, minW: 32 },
    { t: ', local de trabalho ' }, { t: doc.localTrabalho || '', fill: true, minW: 45 },
    { t: ', residente no Bairro ' }, { t: bairroLoc, fill: true, minW: 38 },
    { t: ', Quarteirão nº ' }, { t: doc.residenciaQuarteirao || '', fill: true, minW: 18 },
    { t: ', Avenida/Rua ' }, { t: doc.residenciaAvenida || '', fill: true, minW: 60 },
    { t: ', Casa nº ' }, { t: doc.residenciaCasa || '', fill: true, minW: 14 },
    { t: ', por haver transgredido as disposições da alínea ' },
    { t: doc.alineaTransgredida || '', fill: true, minW: 12 },
    { t: ' ) do nº ' }, { t: doc.numeroTransgredido || '', fill: true, minW: 10 },
    { t: ' do artigo ' }, { t: doc.artigoTransgredido || '', fill: true, minW: 12 },
    { t: ' do/a ' }, { t: doc.legislacao || infracao, fill: true, minW: 50 },
    { t: ' punível nos termos da alínea ' }, { t: doc.alineaPunicao || '', fill: true, minW: 10 },
    { t: ' ) do nº ' }, { t: doc.numeroPunicao || '', fill: true, minW: 10 },
    { t: ' do artigo ' }, { t: doc.artigoPunicao || '', fill: true, minW: 12 },
    { t: ` (${matriculaLabel}: ` }, { t: matricula, fill: true, minW: 25 },
    { t: '; Doc.ID: ' }, { t: docId, fill: true, minW: 24 }, { t: '),' },
    { t: ' com a multa de ' }, { t: doc.valorExtenso || '', fill: true, minW: 45 },
    { t: ', ' }, { t: valor, fill: true, minW: 18 },
    { t: ' MT, devendo proceder ao pagamento na tesouraria da Polícia Municipal no prazo de 15 dias, findo o qual o auto será remetido ao Tribunal competente.' },
  ], M, y, maxX, lh);
  y += 5;

  pdf.setFont('helvetica', 'italic').setFontSize(8);
  const fecho = pdf.splitTextToSize(
    'Por isso, e em cumprimento da obrigação que a lei me impõe, levanto este auto, que afirmo por minha honra ser verdadeiro e vai assinado por mim e pelas testemunhas.',
    W - 2 * M,
  );
  pdf.text(fecho, M, y); y += fecho.length * 3.8 + 3;

  // Assinaturas auto
  pdf.setLineWidth(0.2);
  pdf.line(M + 4, y + 6, M + 70, y + 6);
  pdf.line(W - M - 70, y + 6, W - M - 4, y + 6);
  drawSignatures(pdf, doc, { leftX: M + 17, rightX: W - M - 57, lineY: y + 6, w: 36, h: 10 });
  pdf.setFont('helvetica', 'normal').setFontSize(8);
  pdf.text('O Transgressor', M + 37, y + 10, { align: 'center' });
  pdf.text('O Agente Autuante', W - M - 37, y + 10, { align: 'center' });

  // ───── Linha de corte ─────
  const cutY = Math.max(y + 28, H / 2 + 2);

  // QR auto — colocado entre as assinaturas e a linha de corte, sem sobrepor texto
  try {
    const qr = await generateQRDataUrl(JSON.stringify({
      tipo: 'auto-noticia', auto: doc.numeroAuto, numero: doc.numero,
      valor: doc.valor, infrator: doc.infrator, data: doc.data,
    }));
    pdf.addImage(qr, 'PNG', M, cutY - 18, 14, 14);
  } catch {}
  pdf.setLineDashPattern([1.4, 1.4], 0);
  pdf.setLineWidth(0.25);
  pdf.line(M, cutY, W - M, cutY);
  pdf.setLineDashPattern([], 0);
  pdf.setFont('helvetica', 'italic').setFontSize(7).setTextColor(120, 120, 120);
  pdf.text('— — — — — — — — — — —   c o r t e   a q u i   — — — — — — — — — — —', W / 2, cutY - 1.2, { align: 'center' });
  pdf.setTextColor(20, 20, 20);

  // ───── 2) AVISO DE MULTA (metade inferior) ─────
  let y2 = await compactHeader(cutY + 3, `AVISO DE MULTA Nº  ${doc.numeroAuto || doc.numero}`);
  pdf.setFont('helvetica', 'normal').setFontSize(8.8);

  y2 = writeInline(pdf, [
    { t: 'Fica avisado/a ' }, { t: infrator, fill: true, minW: 70 },
    { t: ' que foi autuado/a no Bairro ' }, { t: local, fill: true, minW: 40 },
    { t: ' Quarteirão nº ' }, { t: doc.localQuarteirao || '', fill: true, minW: 16 },
    { t: ' Avenida/Rua ' }, { t: doc.localAvenida || '', fill: true, minW: 48 },
    { t: ' Casa nº ' }, { t: doc.localCasa || '', fill: true, minW: 12 },
    { t: ' pelas ' }, { t: hh, fill: true, minW: 10 },
    { t: ' horas e ' }, { t: mm, fill: true, minW: 10 },
    { t: ' minutos, por haver transgredido as disposições da alínea ' },
    { t: doc.alineaTransgredida || '', fill: true, minW: 12 },
    { t: ' ) do nº ' }, { t: doc.numeroTransgredido || '', fill: true, minW: 10 },
    { t: ' do artigo ' }, { t: doc.artigoTransgredido || '', fill: true, minW: 12 },
    { t: ' do/a ' }, { t: doc.legislacao || infracao, fill: true, minW: 50 },
    { t: `  (${matriculaLabel}: ` }, { t: matricula, fill: true, minW: 26 }, { t: ')' },
    { t: ' com a multa de ' }, { t: valor, fill: true, minW: 24 },
    { t: ' MT, devendo proceder ao pagamento na Tesouraria da Polícia Municipal, sita na Av. do Almoxarifado nº 11072, no prazo de 15 dias, findo o qual o auto será remetido ao Tribunal competente.' },
  ], M, y2, maxX, 4.4);
  y2 += 6;

  pdf.setFont('helvetica', 'bold').setFontSize(11);
  pdf.text(`VALOR A PAGAR: ${valor} MT`, W / 2, y2, { align: 'center' });
  y2 += 8;

  pdf.setFont('helvetica', 'normal').setFontSize(8.8);
  y2 = writeInline(pdf, [
    { t: 'Matola, aos ' }, { t: d, fill: true, minW: 10 },
    { t: ' de ' }, { t: m, fill: true, minW: 20 },
    { t: ' de 20' }, { t: ano2, fill: true, minW: 8 },
  ], W / 2 - 45, y2, W / 2 + 65, 4.4);
  y2 += 12;

  pdf.setLineWidth(0.2);
  pdf.line(W - M - 70, y2, W - M - 4, y2);
  drawSignatures(pdf, { ...doc, assinaturaInfrator: undefined } as DocumentData, {
    leftX: 0, rightX: W - M - 57, lineY: y2, w: 36, h: 10,
  });
  pdf.setFontSize(8).text('O Agente Autuante', W - M - 37, y2 + 4, { align: 'center' });

  try {
    const qr = await generateQRDataUrl(JSON.stringify({
      tipo: 'aviso-multa', auto: doc.numeroAuto, numero: doc.numero,
      valor: doc.valor, infrator: doc.infrator, data: doc.data,
    }));
    pdf.addImage(qr, 'PNG', M, y2 - 8, 18, 18);
  } catch {}

  pdf.setFont('helvetica', 'italic').setFontSize(6.8).setTextColor(110, 110, 110);
  pdf.text(
    `SIGEMM · Auto de Notícia + Aviso de Multa · ${doc.numero} · emitido em ${doc.data} ${doc.hora}`,
    W / 2, H - 6, { align: 'center' },
  );

  if (opts?.autoPrint) {
    try { pdf.autoPrint(); } catch {}
  }

  return pdf.output('blob');
}

export async function downloadAutoEAviso(doc: DocumentData) {
  const blob = await generateAutoEAviso(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auto-noticia-e-aviso-${doc.numeroAuto || doc.numero}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Sends the Auto de Notícia + Aviso de Multa PDF to the browser's native
 * print dialog, which lists every printer connected to the operating
 * system (USB, network, Bluetooth, virtual PDF, etc.).
 */
export async function printAutoEAviso(doc: DocumentData): Promise<boolean> {
  // O PDF é gerado com a instrução /OpenAction de impressão (autoPrint), pelo
  // que o visualizador do navegador abre o diálogo de impressão sozinho.
  const blob = await generateAutoEAviso(doc, { autoPrint: true });
  const url = URL.createObjectURL(blob);

  // 1) Separador novo — é o caminho mais fiável no Chrome/Edge/Firefox.
  const win = window.open(url, '_blank');
  if (win) {
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  }

  // 2) Popup bloqueado → iframe oculto com chamada explícita a print().
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    iframe.src = url;
    let settled = false;
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        settled = true;
        resolve(true);
      } catch {
        if (!settled) { settled = true; resolve(false); }
      }
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch {}
        URL.revokeObjectURL(url);
      }, 60000);
    };
    document.body.appendChild(iframe);
    setTimeout(() => { if (!settled) { settled = true; resolve(false); } }, 4000);
  });
}
