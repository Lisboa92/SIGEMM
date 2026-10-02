import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as fs from 'fs';
import * as path from 'path';

function buildTFCProposalPDF() {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  function checkPageBreak(spaceNeeded: number) {
    if (y + spaceNeeded > pageHeight - 20) {
      doc.addPage();
      y = margin;
      drawHeaderFooter();
    }
  }

  function drawHeaderFooter() {
    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      if (i > 1) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Proposta de Tema de TFC · Licenciatura em Informática · SIGEMM', margin, 12);
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(margin, 14, pageWidth - margin, 14);
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
      doc.text('Faculdade de Ciências Tecnológicas — Trabalho de Fim de Curso', margin, pageHeight - 9);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 9, { align: 'right' });
    }
  }

  function addTitle(text: string) {
    checkPageBreak(25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 90, 156);
    doc.text(text, margin, y);
    y += 7;
    doc.setDrawColor(0, 90, 156);
    doc.setLineWidth(0.7);
    doc.line(margin, y, margin + 45, y);
    y += 7;
  }

  function addParagraph(text: string, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);
    const lines = doc.splitTextToSize(text, contentWidth);
    checkPageBreak(lines.length * 5 + 4);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 2;
  }

  function addBullet(title: string, text: string) {
    doc.setFontSize(10);
    const prefix = title ? `${title} ` : '';
    const fullText = `• ${prefix}${text}`;
    const lines = doc.splitTextToSize(fullText, contentWidth - 4);
    checkPageBreak(lines.length * 5 + 3);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 90, 156);
    doc.text('•', margin, y);

    if (title) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      doc.text(title + ' ', margin + 4, y);
      const titleWidth = doc.getTextWidth(title + ' ');
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(55, 65, 81);
      
      const restLines = doc.splitTextToSize(text, contentWidth - 4 - titleWidth);
      if (restLines.length > 0) {
        doc.text(restLines[0], margin + 4 + titleWidth, y);
        if (restLines.length > 1) {
          const subsequentLines = doc.splitTextToSize(restLines.slice(1).join(' '), contentWidth - 4);
          doc.text(subsequentLines, margin + 4, y + 5);
          y += subsequentLines.length * 5;
        }
      }
      y += 5;
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(55, 65, 81);
      doc.text(lines, margin + 4, y);
      y += lines.length * 5 + 2;
    }
  }

  // --- CABEÇALHO ACADÉMICO ---
  doc.setFillColor(0, 90, 156);
  doc.rect(0, 0, pageWidth, 26, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('UNIVERSIDADE TÉCNICA DIOGO EUGÉNIO GUILANDE', pageWidth / 2, 10, { align: 'center' });
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text('FACULDADE DE CIÊNCIAS TECNOLÓGICAS · CURSO DE LICENCIATURA EM INFORMÁTICA', pageWidth / 2, 16, { align: 'center' });
  doc.text('PROPOSTA FORMAL DE TEMA PARA TRABALHO DE FIM DE CURSO (TFC)', pageWidth / 2, 21, { align: 'center' });

  y = 40;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(31, 41, 55);
  doc.text('TÍTULO PROPOSTO PARA O TRABALHO:', margin, y);
  y += 7;

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(11);
  doc.setTextColor(0, 90, 156);
  const titleLines = doc.splitTextToSize('«Desenvolvimento de um Sistema Integrado e Concorrente para Informatização, Fiscalização e Cobrança de Multas Municipais em Ambientes com Conectividade Intermitente: Caso do Município da Matola»', contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 6 + 6;

  addTitle('1. Escolha do Campo do Conhecimento');
  addParagraph('• Campo Principal: Ciências da Computação / Engenharia Informática.');
  addParagraph('• Subáreas: Engenharia de Software, Sistemas Distribuídos, Computação Móvel e Governação Electrónica (E-Gov).');

  addTitle('2. Assunto Dentro do Campo');
  addParagraph('Sistemas Móveis e Web com Arquitectura Offline-First, Automação de Fiscalização no Terreno (OCR de Matrículas) e Integração de Meios de Pagamento Electrónicos para Arrecadação de Receitas Municipais.');

  addTitle('3. Situação Insatisfatória Concreta (Problematização)');
  addBullet('Extravio e Ilegibilidade:', 'Autos manuais em papel com caligrafia ilegível, erros cadastrais em matrículas e perda física de canhotos.');
  addBullet('Morosidade & Fuga de Receitas:', 'Atrasos de vários dias entre a autuação e o registo em tesouraria, inviabilizando conciliação e controlo de caixa.');
  addBullet('Falta de Controlo de Prazos:', 'Inexistência de triagem automática para multas com prazo legal expirado (> 15 dias), resultando em prescrição sem remessa ao Tribunal.');
  addBullet('Falhas de Rede no Terreno:', 'Ausência temporária de sinal 3G/4G nos postos periféricos (ex: Machava, Infulene), impedindo sistemas tradicionais.');

  addTitle('4. Interrogação a que se Responde com Dados');
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 90, 156);
  const qLines = doc.splitTextToSize('«De que forma a implementação de uma plataforma digital integrada (web/mobile), baseada em arquitectura offline-first, reconhecimento automático de matrículas por OCR e liquidação multicanal em tempo real, contribui para a redução da taxa de inadimplência de multas e diminuição do tempo médio de tramitação de autos no Município da Matola?»', contentWidth);
  checkPageBreak(qLines.length * 5 + 10);
  doc.text(qLines, margin, y);
  y += qLines.length * 5 + 6;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Métrica / Indicador Quantitativo', 'Cenário Manual (Antes)', 'Cenário com SIGEMM (Depois)']],
    body: [
      ['Tempo médio de emissão de um auto', '8 a 15 minutos (talão manual).', 'Menos de 2 minutos (OCR automático).'],
      ['Taxa de autos com erros cadastrais', 'Elevada (> 20% com erros).', 'Reduzida para < 2% (validação).'],
      ['Tempo até disponibilidade em caixa', '48 a 120 horas (físico).', 'Instantâneo (0s / sync pós-offline).'],
      ['Taxa de arrecadação e quitação', 'Baixa (< 40% liquidadas).', 'Aumento com M-Pesa, E-Mola, POS.'],
      ['Autos remetidos ao Tribunal no prazo', 'Residual (< 10%).', '100% dos autos fora do prazo legal.'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [0, 90, 156], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8.5, textColor: [55, 65, 81] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  addTitle('5. Objectivos do Trabalho');
  addParagraph('• Geral: Desenvolver e avaliar uma plataforma integrada de gestão e cobrança de multas para o Conselho Municipal da Cidade da Matola, com persistência offline-first e auditoria imutável.');
  addParagraph('• Específicos: (1) Mapear o fluxo fiscal; (2) Projectar a arquitetura em 3 camadas e sincronização concorrente; (3) Implementar OCR de matrículas e assinaturas digitais; (4) Integrar pagamentos móveis e impressão térmica; (5) Avaliar usabilidade e ganho operacional.');

  drawHeaderFooter();

  const pdfOutput = doc.output('arraybuffer');
  const outputPath = path.join(process.cwd(), 'public', 'Proposta_Tema_TFC_SIGEMM.pdf');
  fs.writeFileSync(outputPath, Buffer.from(pdfOutput));
  console.log(`Proposta PDF gerada com sucesso em: ${outputPath}`);
}

buildTFCProposalPDF();
