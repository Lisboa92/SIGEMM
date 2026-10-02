import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script Oficial de Geração do Manual do Utilizador SIGEMM (PDF)
 * Versão 2.0 — 2026 · Conselho Municipal da Cidade da Matola
 * Desenvolvido pela Sideout Studios
 * 
 * Estrutura em 20 páginas temáticas e rigorosamente paginadas.
 */
export function generateManualPDF(): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Paleta de Cores Institucionais do Município da Matola
  const greenPrimary: [number, number, number] = [22, 101, 52];     // #166534 Verde Floresta
  const greenMedium: [number, number, number] = [21, 128, 61];      // #15803d Verde Institucional
  const greenLightBg: [number, number, number] = [240, 253, 244];   // #f0fdf4 Fundo suave
  const textDark: [number, number, number] = [31, 41, 55];          // #1f2937 Texto principal
  const textMuted: [number, number, number] = [100, 116, 139];      // #64748b Texto secundário
  const grayBorder: [number, number, number] = [226, 232, 240];     // #e2e8f0 Borda cinzenta

  let logoBase64 = '';
  try {
    const logoPath = path.join(process.cwd(), 'src', 'assets', 'logo-matola.png');
    if (fs.existsSync(logoPath)) {
      logoBase64 = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64');
    }
  } catch (err) {
    console.warn('Erro ao carregar logótipo:', err);
  }

  // --- FUNÇÕES UTILITÁRIAS DE LAYOUT ---

  // Desenha a caixa de cabeçalho com borda verde no topo da página
  function drawPageHeaderBox(title: string, yPos: number = 20): number {
    doc.setDrawColor(...greenPrimary);
    doc.setLineWidth(0.9);
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, yPos, contentWidth, 14, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...greenPrimary);
    doc.text(title, margin + 4, yPos + 9.5);

    return yPos + 22;
  }

  // Desenha rodapé institucional padronizado
  function drawFooter(pageNumber: number) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...textMuted);
    doc.text(`SIGEMM — Manual do Utilizador | Página ${pageNumber}`, pageWidth / 2, pageHeight - 12, { align: 'center' });
  }

  // Subtítulo da secção (ex: 1.1 Objectivos do Sistema)
  function drawSectionSubtitle(text: string, yPos: number): number {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...greenMedium);
    doc.text(text, margin, yPos);
    return yPos + 6.5;
  }

  // Parágrafo corrido
  function drawParagraph(text: string, yPos: number, bold = false): number {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...textDark);
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, margin, yPos);
    return yPos + lines.length * 4.8 + 2.5;
  }

  // Ponto de lista (bullet point)
  function drawBullet(title: string, text: string, yPos: number): number {
    doc.setFontSize(9.5);
    const prefix = title ? `• ${title}: ` : '• ';
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...greenPrimary);
    doc.text('•', margin, yPos);

    if (title) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...textDark);
      doc.text(title + ': ', margin + 4, yPos);
      const titleWidth = doc.getTextWidth(title + ': ');

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...textDark);
      const firstLineMax = contentWidth - 4 - titleWidth;
      const restLines = doc.splitTextToSize(text, contentWidth - 4);

      if (restLines.length > 0) {
        // Render first line next to title
        doc.text(restLines[0], margin + 4 + titleWidth, yPos);
        if (restLines.length > 1) {
          const subsequent = restLines.slice(1);
          doc.text(subsequent, margin + 4, yPos + 4.8);
          return yPos + (restLines.length) * 4.8 + 1.5;
        }
      }
      return yPos + 5.2;
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...textDark);
      const lines = doc.splitTextToSize(text, contentWidth - 4);
      doc.text(lines, margin + 4, yPos);
      return yPos + lines.length * 4.8 + 1.5;
    }
  }

  // Caixa de destaque (Callout / Dica / Nota / Regra)
  function drawCallout(prefix: string, content: string, yPos: number): number {
    const lines = doc.splitTextToSize(content, contentWidth - 14);
    const boxHeight = lines.length * 4.6 + 13;

    doc.setFillColor(...greenLightBg);
    doc.setDrawColor(...greenMedium);
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, yPos, contentWidth, boxHeight, 1.5, 1.5, 'FD');

    doc.setFillColor(...greenPrimary);
    doc.rect(margin, yPos, 2.5, boxHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...greenPrimary);
    doc.text(prefix, margin + 6, yPos + 5.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...textDark);
    doc.text(lines, margin + 6, yPos + 10.8);

    return yPos + boxHeight + 4;
  }

  // ==========================================
  // PÁGINA 1: CAPA
  // ==========================================
  doc.setPage(1);

  // Faixa verde superior decorativa sutil
  doc.setFillColor(...greenPrimary);
  doc.rect(0, 0, pageWidth, 5, 'F');

  // Logótipo da Matola no centro
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', pageWidth / 2 - 20, 48, 40, 40);
  }

  let y = 105;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(38);
  doc.setTextColor(...greenPrimary);
  doc.text('SIGEMM', pageWidth / 2, y, { align: 'center' });

  y += 12;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textDark);
  doc.text('Sistema de Gestão de Multas', pageWidth / 2, y, { align: 'center' });
  y += 7;
  doc.text('do Município da Matola', pageWidth / 2, y, { align: 'center' });

  y += 24;
  doc.setDrawColor(...greenPrimary);
  doc.setLineWidth(1.8);
  doc.line(margin + 25, y, pageWidth - margin - 25, y);

  y += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...textDark);
  doc.text('Manual do Utilizador', pageWidth / 2, y, { align: 'center' });

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...textMuted);
  doc.text('Versão 2.0 — 2026', pageWidth / 2, y, { align: 'center' });

  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...textDark);
  doc.text('Conselho Municipal da Matola', pageWidth / 2, y, { align: 'center' });
  y += 6.5;
  doc.text('Desenvolvido pela Sideout Studios', pageWidth / 2, y, { align: 'center' });

  y = pageHeight - 48;
  doc.setFontSize(9);
  doc.setTextColor(...textMuted);
  doc.text('Documento Confidencial — Uso Interno', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text('República de Moçambique · Província de Maputo', pageWidth / 2, y, { align: 'center' });

  drawFooter(1);

  // ==========================================
  // PÁGINA 2: ECRÃ DE LOGIN DO SIGEMM
  // ==========================================
  doc.addPage();
  y = drawPageHeaderBox('Ecrã de Login do SIGEMM', 20);

  // Card do Login desenhado com estilo visual profissional
  const cardW = 120;
  const cardH = 122;
  const cardX = (pageWidth - cardW) / 2;
  const cardY = y + 5;

  // Fundo simulando a tela de login
  doc.setFillColor(15, 23, 42); // Navy escuro
  doc.roundedRect(cardX - 12, cardY - 5, cardW + 24, cardH + 20, 4, 4, 'F');

  // Cartão branco central
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(cardX, cardY, cardW, cardH, 3, 3, 'F');

  // Logótipo pequeno dentro do card
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', pageWidth / 2 - 10, cardY + 8, 20, 20);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...greenPrimary);
  doc.text('SIGEMM', pageWidth / 2, cardY + 34, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...textMuted);
  doc.text('Sistema de Gestão de Multas do Município da Matola', pageWidth / 2, cardY + 39, { align: 'center' });

  // Campo Nome de Utilizador ou E-mail
  const inputW = 96;
  const inputX = (pageWidth - inputW) / 2;
  let inputY = cardY + 46;

  doc.setFontSize(7.5);
  doc.setTextColor(...textDark);
  doc.text('Nome de Utilizador ou E-mail', inputX, inputY);
  inputY += 2.5;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...grayBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(inputX, inputY, inputW, 8.5, 1.5, 1.5, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text('joao.silva ou joao@matola.gov.mz', inputX + 4, inputY + 5.5);

  // Campo Senha
  inputY += 13;
  doc.setFontSize(7.5);
  doc.setTextColor(...textDark);
  doc.text('Senha', inputX, inputY);
  inputY += 2.5;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(inputX, inputY, inputW, 8.5, 1.5, 1.5, 'FD');
  doc.setFontSize(8.5);
  doc.setTextColor(...textMuted);
  doc.text('••••••••••••', inputX + 4, inputY + 6);

  // Botão Entrar no Sistema
  inputY += 14;
  doc.setFillColor(...greenPrimary);
  doc.roundedRect(inputX, inputY, inputW, 9.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('→  Entrar no Sistema', pageWidth / 2, inputY + 6.2, { align: 'center' });

  // Rodapé do card
  inputY += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...textMuted);
  doc.text('Esqueceu a senha? Contacte o Administrador Municipal', pageWidth / 2, inputY, { align: 'center' });

  y = cardY + cardH + 24;

  y = drawParagraph(
    'O ecrã de login do SIGEMM apresenta uma interface limpa e profissional com o logotipo do Conselho Municipal da Matola, campos para nome de utilizador ou e-mail corporativo, campo de senha protegida e botão de acesso imediato ao sistema.',
    y
  );

  y = drawParagraph(
    'O sistema suporta autenticação segura por dois fatores (2FA / TOTP), recuperação assistida de credenciais por e-mail, e proteção contra acessos indevidos com bloqueio preventivo de tentativas falhadas.',
    y
  );

  drawCallout(
    '■ Segurança no Primeiro Acesso',
    'Ao aceder pela primeira vez com a senha provisória comunicada pela administração, o sistema exigirá obrigatoriamente a definição de uma nova senha pessoal e confidencial antes de permitir qualquer operação.',
    y
  );

  drawFooter(2);

  // ==========================================
  // PÁGINA 3: ÍNDICE
  // ==========================================
  doc.addPage();
  y = drawPageHeaderBox('Índice', 20);

  const indiceItens = [
    { num: '1.', titulo: 'Introdução e Objectivos', pag: '4' },
    { num: '2.', titulo: 'Arquitectura e Tecnologias', pag: '5' },
    { num: '3.', titulo: 'Autenticação e Segurança', pag: '6' },
    { num: '4.', titulo: 'Dashboard — Painel Principal', pag: '7' },
    { num: '5.', titulo: 'Nova Multa — Registo de Infracções', pag: '8' },
    { num: '6.', titulo: 'Pagamentos — Processamento', pag: '9' },
    { num: '7.', titulo: 'Histórico — Consulta de Multas', pag: '10' },
    { num: '8.', titulo: 'Tribunal e Produtividade', pag: '11' },
    { num: '9.', titulo: 'Agentes Online — Monitorização', pag: '12' },
    { num: '10.', titulo: 'Perfil e Mensagens', pag: '13' },
    { num: '11.', titulo: 'Administração', pag: '14' },
    { num: '12.', titulo: 'Configurações do Sistema', pag: '15' },
    { num: '13.', titulo: 'Notificações e Ferramentas', pag: '16' },
    { num: '14.', titulo: 'Níveis de Acesso e Permissões', pag: '17' },
    { num: '15.', titulo: 'Vantagens do Sistema', pag: '18' },
    { num: '16.', titulo: 'Perguntas Frequentes (FAQ)', pag: '19' },
    { num: '—', titulo: 'Contra-Capa Institucional', pag: '20' },
  ];

  y += 4;
  indiceItens.forEach((item) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...textDark);

    const numPrefix = `${item.num} ${item.titulo}`;
    doc.text(numPrefix, margin + 4, y);

    const titleWidth = doc.getTextWidth(numPrefix);
    const pagStr = item.pag;
    const pagWidth = doc.getTextWidth(pagStr);

    // Pontos de ligação
    const dotsStart = margin + 6 + titleWidth;
    const dotsEnd = pageWidth - margin - pagWidth - 6;
    let dotX = dotsStart;
    doc.setTextColor(...textMuted);
    while (dotX < dotsEnd) {
      doc.text('.', dotX, y);
      dotX += 3.2;
    }

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...greenPrimary);
    doc.text(pagStr, pageWidth - margin - 4, y, { align: 'right' });

    y += 10.5;
  });

  drawFooter(3);

  // ==========================================
  // PÁGINA 4: 1. INTRODUÇÃO E OBJECTIVOS
  // ==========================================
  doc.addPage();
  y = drawPageHeaderBox('1. Introdução e Objectivos', 20);

  y = drawParagraph(
    'O SIGEMM (Sistema de Gestão de Multas do Município da Matola) é uma aplicação web progressiva (PWA) de última geração desenvolvida para modernizar, digitalizar e auditar todo o processo de fiscalização e autuação municipal na cidade da Matola, Moçambique.',
    y
  );

  y = drawSectionSubtitle('1.1 Objectivos do Sistema', y);
  y = drawBullet('Digitalização Integral', 'Digitalizar o processo de registo e acompanhamento de multas municipais.', y);
  y = drawBullet('Eliminação do Papel', 'Eliminar o uso de blocos físicos e a transcrição manual de documentos.', y);
  y = drawBullet('Transparência Total', 'Garantir rastreabilidade absoluta e auditoria automática de todas as operações.', y);
  y = drawBullet('Métodos Electrónicos', 'Facilitar o pagamento célere via M-Pesa, e-Mola, mKesh e terminais POS.', y);
  y = drawBullet('Monitorização ao Vivo', 'Monitorizar agentes em tempo real no mapa e otimizar o patrulhamento.', y);
  y = drawBullet('Prevenção de Fraudes', 'Reduzir fraudes e manipulação de dados com assinaturas digitais e provas fotográficas.', y);
  y = drawBullet('Inteligência e Métricas', 'Fornecer relatórios estatísticos e rankings para apoio à tomada de decisão executiva.', y);
  y = drawBullet('Comunicação Integrada', 'Permitir troca de mensagens, áudio e coordenadas entre agentes e supervisores.', y);

  y += 2;
  y = drawSectionSubtitle('1.2 Público-Alvo', y);
  y = drawParagraph('O sistema destina-se aos diversos órgãos e escalões do Conselho Municipal:', y);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Perfil', 'Descrição da Actuação', 'Nível de Acesso']],
    body: [
      ['Presidente', 'Aprovação executiva de anulações extraordinárias e visão macro', 'Supremo'],
      ['Administrador', 'Gestão total do sistema, utilizadores, tabelas de coimas e auditoria', 'Total'],
      ['Supervisor', 'Supervisão de brigadas, gestão de recursos e remessa ao tribunal', 'Intermédio'],
      ['Agente de Campo', 'Autuação de trânsito móvel, leitura OCR e emissão no terreno', 'Operacional'],
      ['Fiscal de Posturas', 'Fiscalização de obras, mercados, alvarás, ocupação do solo e ruído', 'Operacional'],
      ['Cobrança / Balcão', 'Atendimento aos munícipes, recebimento presencial e recibos', 'Atendimento'],
    ],
    theme: 'grid',
    headStyles: { fillColor: greenPrimary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: textDark },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  y = drawSectionSubtitle('1.3 Âmbito', y);
  y = drawParagraph(
    'O SIGEMM cobre todo o ciclo de vida de uma multa municipal: desde a constatação da infracção no local pelo agente de campo (online ou offline), captura de fotografias e leitura OCR de matrículas, recolha de assinaturas digitais, pagamento por canais móveis ou bancários, até ao eventual encaminhamento judicial ao Tribunal ou cancelamento com dupla autorização.',
    y
  );

  drawFooter(4);

  // ==========================================
  // PÁGINA 5: 2. ARQUITECTURA E TECNOLOGIAS
  // ==========================================
  doc.addPage();
  y = drawPageHeaderBox('2. Arquitectura e Tecnologias', 20);

  y = drawSectionSubtitle('2.1 Stack Tecnológica', y);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Componente', 'Tecnologia Adoptada', 'Finalidade Operacional']],
    body: [
      ['Frontend', 'React 18 + TypeScript + Vite', 'Interface de utilizador rápida, fluida e reativa'],
      ['Estilização', 'Tailwind CSS + shadcn/ui', 'Design system institucional moderno e acessível'],
      ['Base de Dados', 'Lovable Cloud (Supabase PostgreSQL)', 'Base de dados relacional, autenticação e RLS'],
      ['Offline Store', 'IndexedDB / LocalStorage Resiliente', 'Persistência local segura para contingência sem rede'],
      ['Mapas & GPS', 'Leaflet + OpenStreetMap', 'Georreferenciação exata de multas e agentes'],
      ['Documentos', 'jsPDF + QR Code', 'Geração de autos, faturas e recibos timbrados'],
      ['Impressão', 'ESC/POS Bluetooth (58mm / 80mm)', 'Impressão térmica de talões no terreno'],
      ['Reconhecimento', 'OCR de Matrículas (Computer Vision)', 'Identificação automática de matrículas de veículos'],
      ['PWA Engine', 'Service Worker v5 + Background Sync', 'Funcionamento offline e instalação em dispositivos'],
    ],
    theme: 'grid',
    headStyles: { fillColor: greenPrimary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: textDark },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  y = drawSectionSubtitle('2.2 Características PWA e Funcionamento 100% Offline', y);
  y = drawParagraph(
    'O SIGEMM é uma Progressive Web App (PWA) de nível empresarial. O sistema foi desenhado especificamente para as condições de campo da Cidade da Matola, onde oscilações na cobertura de dados móveis (3G/4G) são frequentes:',
    y
  );

  y = drawBullet('Instalação Nativa', 'Pode ser instalado no telemóvel (Android/iOS) ou computador sem precisar de loja de aplicações, criando um ícone oficial no ecrã inicial.', y);
  y = drawBullet('Service Worker Inteligente', 'O ficheiro sw.js efetua pré-cache de todo o código da aplicação e dos dados cadastrais essenciais através da estratégia Stale-While-Revalidate.', y);
  y = drawBullet('Fila de Emissão Offline', 'Autos lavrados sem internet são guardados imediatamente na fila local com o estado "offline_pendente" e impressos de imediato via Bluetooth.', y);
  y = drawBullet('Sincronização Automática', 'Assim que o dispositivo volta a ter ligação à rede, o sistema submete todos os autos em fila para o servidor e atualiza os comprovativos sem intervenção manual.', y);

  y += 2;
  drawCallout(
    '■ Dica de Instalação PWA',
    'No computador (Chrome/Edge) ou telemóvel Android, clique no botão "Instalar App" no cabeçalho superior. No iPhone/iPad, abra no Safari, toque em "Partilhar" e seleccione "Ecrã Principal".',
    y
  );

  drawFooter(5);

  // ==========================================
  // PÁGINA 6: 3. AUTENTICAÇÃO E SEGURANÇA
  // ==========================================
  doc.addPage();
  y = drawPageHeaderBox('3. Autenticação e Segurança', 20);

  y = drawSectionSubtitle('3.1 Login no Sistema', y);
  y = drawParagraph(
    'O acesso ao SIGEMM é pessoal e intransmissível, efetuado através de nome de utilizador ou endereço de e-mail e senha. O nome de utilizador é padronizado pelo sistema a partir do nome do agente (ex: joao.silva).',
    y
  );

  y = drawBullet('1. Acesso', 'Abra o SIGEMM no navegador ou através do ícone instalado no dispositivo.', y);
  y = drawBullet('2. Identificação', 'Introduza o seu nome de utilizador ou e-mail institucional.', y);
  y = drawBullet('3. Credencial', 'Insira a sua senha de acesso.', y);
  y = drawBullet('4. Autenticação 2FA', 'Caso o perfil exija autenticação multifactor, insira o código de 6 dígitos gerado pela aplicação autenticadora.', y);
  y = drawBullet('5. Conclusão', 'Clique em "Entrar no Sistema".', y);

  y += 2;
  y = drawSectionSubtitle('3.2 Primeiro Login e Política de Senhas', y);
  y = drawParagraph(
    'Ao criar um agente, a administração atribui uma senha provisória aleatória. No primeiro acesso, o sistema bloqueia qualquer operação até que o agente proceda à alteração obrigatória para uma senha segura, cumprindo os critérios mínimos de complexidade.',
    y
  );

  drawCallout(
    '■ Segurança Pessoal',
    'Nunca partilhe a sua senha ou código 2FA. Cada multa, cobrança ou anulação fica indelevelmente associada à identidade do utilizador que realizou a ação para efeitos de responsabilidade funcional.',
    y
  );
  y += 24;

  y = drawSectionSubtitle('3.3 Controlo de Sessão e Inactividade', y);
  y = drawParagraph('O sistema efetua a monitorização contínua de cada sessão de trabalho, registando:', y);
  y = drawBullet('Horários de Turno', 'Registo exato da data e hora de entrada (login) e saída (logout).', y);
  y = drawBullet('Tempo de Patrulha', 'Contador contínuo em horas e minutos de serviço ativo.', y);
  y = drawBullet('Geolocalização Contínua', 'Ponto geográfico das autuações realizadas durante a patrulha.', y);
  y = drawBullet('Bloqueio por Inatividade', 'Logout automático caso o terminal permaneça sem utilização por tempo prolongado, prevenindo manipulações indevidas.', y);

  y += 2;
  y = drawSectionSubtitle('3.4 Níveis de Segurança e RLS', y);
  y = drawBullet('Row Level Security (RLS)', 'Garante que os dados confidenciais de munícipes e processos só são acedidos por perfis autorizados.', y);
  y = drawBullet('Logs de Auditoria Imutáveis', 'Registo cronológico de todas as ações no sistema com identificação de utilizador, IP e data/hora.', y);
  y = drawBullet('Dupla Autorização', 'Processos críticos, como o cancelamento de multas, exigem validação de dois níveis hierárquicos.', y);

  drawFooter(6);

  // ==========================================
  // PÁGINA 7: 4. DASHBOARD — PAINEL PRINCIPAL
  // ==========================================
  doc.addPage();
  y = drawPageHeaderBox('4. Dashboard — Painel Principal', 20);

  y = drawSectionSubtitle('4.1 Visão Geral', y);
  y = drawParagraph(
    'O Dashboard é o centro de comando visual do SIGEMM após o início de sessão. Apresenta uma consolidação em tempo real das operações do dia, saudação personalizada com o nome e patente do agente, e acesso direto aos módulos operacionais.',
    y
  );

  y = drawSectionSubtitle('4.2 Indicadores Principais em Tempo Real', y);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Indicador', 'Descrição Operacional', 'Actualização']],
    body: [
      ['Total de Multas', 'Volume total de autos de notícia lavrados no período', 'Tempo Real'],
      ['Multas Pendentes', 'Autos que aguardam pagamento dentro do prazo voluntário (15 dias)', 'Tempo Real'],
      ['Multas Pagas', 'Autos integralmente liquidados com receita creditada', 'Tempo Real'],
      ['Fora do Prazo / Tribunal', 'Multas com prazo de pagamento voluntário expirado', 'Tempo Real'],
      ['Receita Total', 'Valor total arrecadado expresso em Meticais (MT)', 'Tempo Real'],
      ['Agentes Online', 'Efetivo policial e fiscal atualmente em serviço ativo no terreno', 'Tempo Real'],
    ],
    theme: 'grid',
    headStyles: { fillColor: greenPrimary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: textDark },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  y = drawSectionSubtitle('4.3 Gráficos, Estatísticas e Metas', y);
  y = drawParagraph('O painel disponibiliza gráficos interactivos para análise do desempenho municipal:', y);
  y = drawBullet('Evolução Temporal', 'Gráfico de linhas demonstrando o fluxo diário, semanal e mensal de autuações e receitas.', y);
  y = drawBullet('Distribuição por Infracção', 'Gráfico circular categorizando as infrações mais frequentes (trânsito, ruído, ocupação ilegal, obras).', y);
  y = drawBullet('Canais de Arrecadação', 'Comparativo financeiro entre pagamentos recebidos via M-Pesa, e-Mola, POS bancário e Balcão.', y);
  y = drawBullet('Ranking e Produtividade', 'Classificação dos postos e brigadas com maior taxa de conformidade e eficiência no terreno.', y);
  y = drawBullet('Metas Operacionais', 'Barra de progresso indicando o cumprimento das metas municipais estabelecidas pela vereação.', y);

  drawFooter(7);

  // ==========================================
  // PÁGINA 8: 5. NOVA MULTA — REGISTO DE INFRACÇÕES
  // ==========================================
  doc.addPage();
  y = drawPageHeaderBox('5. Nova Multa — Registo de Infracções', 20);

  y = drawSectionSubtitle('5.1 Categorias de Multas', y);
  y = drawParagraph('O sistema contempla as duas grandes vertentes de fiscalização municipal da Matola:', y);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Categoria', 'Âmbito de Fiscalização', 'Exemplos Frequentes']],
    body: [
      ['Móvel', 'Infrações rodoviárias, viaturas ligeiras, pesadas, chapas, táxis e motos', 'Estacionamento proibido, excesso de lotação, paragem fora da paragem, falta de licença'],
      ['Imóvel', 'Infrações em propriedades, comércio, saneamento e posturas urbanas', 'Construção sem licença, ocupação ilegal de passeios, despejo de entulho, poluição sonora'],
    ],
    theme: 'grid',
    headStyles: { fillColor: greenPrimary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: textDark },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  y = drawSectionSubtitle('5.2 Processo de Registo no Terreno', y);
  y = drawBullet('1. Categoria', 'Selecionar entre "Móvel" ou "Imóvel".', y);
  y = drawBullet('2. Reconhecimento OCR', 'Para multas móveis, apontar a câmara para a matrícula para leitura ótica instantânea.', y);
  y = drawBullet('3. Dados do Infrator', 'Registar o nome, documento (BI/DIRE/Passaporte) e telefone do condutor/proprietário.', y);
  y = drawBullet('4. Consulta de Reincidência', 'O sistema alerta de imediato se o infrator possui multas pendentes ou reincidências.', y);
  y = drawBullet('5. Tipo de Infracção', 'Selecionar a infração da tabela oficial; o artigo legal e valor em Meticais são preenchidos automaticamente.', y);
  y = drawBullet('6. Geolocalização GPS', 'As coordenadas e posto municipal são capturados de forma automática pelo GPS do aparelho.', y);
  y = drawBullet('7. Fotos Probatórias', 'Capturar até 5 fotografias através da câmara como evidência inalterável.', y);
  y = drawBullet('8. Assinatura Digital', 'Recolher a assinatura no ecrã táctil do agente e do infrator (ou assinalar recusa formal).', y);
  y = drawBullet('9. Emissão e Envio', 'Confirmar a emissão, imprimir o talão térmico e enviar notificação por e-mail com PDF anexo.', y);

  y += 2;
  drawCallout(
    '■ Operação Offline no Terreno',
    'Caso o agente esteja numa zona sem rede móvel, o auto é registado com total normalidade, recebe o número sequencial oficial e é impresso no local. O auto é sincronizado automaticamente assim que houver sinal.',
    y
  );

  drawFooter(8);

  // ==========================================
  // PÁGINA 9: 6. PAGAMENTOS — PROCESSAMENTO
  // ==========================================
  doc.addPage();
  y = drawPageHeaderBox('6. Pagamentos — Processamento', 20);

  y = drawSectionSubtitle('6.1 Métodos de Pagamento Suportados', y);
  y = drawParagraph('O SIGEMM suporta os principais canais de pagamento eletrónico e presencial em Moçambique:', y);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Método de Pagamento', 'Canal / Operadora', 'Comprovativo Exigido']],
    body: [
      ['POS (Terminal Bancário)', 'Rede Nacional SIMO / Cartões Bancários', 'Nº de Autorização do Talão POS'],
      ['M-Pesa', 'Vodacom Moçambique', 'Código de Transacção M-Pesa (ex: 9K8J...)'],
      ['e-Mola', 'Movitel Moçambique', 'Número de Referência / ID da Transacção'],
      ['mKesh', 'Tmcel / Millennium BIM', 'Nº de Transacção / Validação mKesh'],
      ['Numerário / Balcão', 'Tesouraria do Conselho Municipal da Matola', 'Nº do Recibo de Caixa Municipal'],
    ],
    theme: 'grid',
    headStyles: { fillColor: greenPrimary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: textDark },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  y = drawSectionSubtitle('6.2 Processo de Cobrança e Quitação', y);
  y = drawBullet('1. Localização do Auto', 'Pesquisar a multa pendente pelo número do auto, nome do infrator, BI ou matrícula.', y);
  y = drawBullet('2. Seleção', 'Clicar na multa e verificar os detalhes da infração e o montante em Meticais.', y);
  y = drawBullet('3. Método de Cobrança', 'Escolher a forma de pagamento disponibilizada pelo munícipe.', y);
  y = drawBullet('4. Registo da Transação', 'Inserir a referência oficial emitida pela operadora ou terminal bancário.', y);
  y = drawBullet('5. Quitação Imediata', 'Confirmar a liquidação. A multa passa automaticamente para o estado "Paga".', y);

  y += 2;
  y = drawSectionSubtitle('6.3 Recibo Oficial, QR Code e Impressão Térmica', y);
  y = drawParagraph(
    'Após a confirmação do pagamento, o sistema gera de imediato o Recibo Oficial de Quitação timbrado pelo Conselho Municipal da Cidade da Matola:',
    y
  );
  y = drawBullet('Autenticidade por QR Code', 'Cada recibo possui um código QR único e criptografado que permite a qualquer fiscal ou munícipe validar a autenticidade online.', y);
  y = drawBullet('Impressão Portátil', 'Impressão direta em impressoras térmicas Bluetooth de 58mm e 80mm.', y);
  y = drawBullet('Partilha Digital', 'Envio instantâneo do recibo em PDF por correio eletrónico ou WhatsApp.', y);

  drawFooter(9);

  // ==========================================
  // PÁGINA 10: 7. HISTÓRICO — CONSULTA DE MULTAS
  // ==========================================
  doc.addPage();
  y = drawPageHeaderBox('7. Histórico — Consulta de Multas', 20);

  y = drawSectionSubtitle('7.1 Funcionalidades de Consulta e Pesquisa', y);
  y = drawParagraph(
    'O módulo de Histórico centraliza todos os registos de infrações do município, permitindo auditoria, acompanhamento e exportação de relatórios para os serviços municipais.',
    y
  );

  y = drawBullet('Pesquisa Universal', 'Pesquisa instantânea por número do auto, nome do infrator, matrícula, número de BI ou local.', y);
  y = drawBullet('Filtro por Estado', 'Pendente (dentro do prazo), Paga, Cancelada, Fora do Prazo (Tribunal) e Offline Pendente.', y);
  y = drawBullet('Filtro por Período', 'Seleção por data de autuação, semana, mês ou intervalos personalizados.', y);
  y = drawBullet('Exportação em Excel/CSV', 'Descarregamento de relatórios completos com todos os campos para conciliação contábil.', y);

  y += 2;
  y = drawSectionSubtitle('7.2 Cancelamento de Multas com Dupla Autorização', y);
  y = drawParagraph(
    'Para assegurar a máxima integridade e eliminar qualquer possibilidade de anulações indevidas ou arbitrárias, o SIGEMM implementa um fluxo assíncrono de Dupla Autorização:',
    y
  );

  y = drawBullet('Passo 1: Pedido de Anulação', 'O supervisor formula a solicitação com fundamentação legal fundamentada e confirma com a sua senha.', y);
  y = drawBullet('Passo 2: Notificação de Segurança', 'O sistema retém a multa e emite uma notificação de alta prioridade ao Presidente do Município ou Administrador.', y);
  y = drawBullet('Passo 3: Validação Superior', 'A autoridade analisa o despacho e, caso aprove, insere a sua senha para confirmar o cancelamento.', y);
  y = drawBullet('Passo 4: Registo de Auditoria', 'O auto é cancelado com registo perpétuo dos dois intervenientes, motivos e data/hora.', y);

  drawCallout(
    '■ Regra Estrita de Segurança Municipal',
    'Nenhum utilizador, individualmente, pode anular ou cancelar um auto de multa. É mandatória a validação de dois níveis hierárquicos distintos.',
    y
  );
  y += 24;

  y = drawSectionSubtitle('7.3 Módulo de Reclamações e Contestações', y);
  y = drawParagraph(
    'Os munícipes dispõem do direito legal de contestar autuações no prazo de 15 dias. O módulo de reclamações permite registar a alegação, anexar provas do requerente e emitir o parecer jurídico oficial: Deferida, Indeferida ou Em Análise.',
    y
  );

  drawFooter(10);

  // ==========================================
  // PÁGINA 11: 8. TRIBUNAL E PRODUTIVIDADE
  // ==========================================
  doc.addPage();
  y = drawPageHeaderBox('8. Tribunal e Produtividade', 20);

  y = drawSectionSubtitle('8.1 Encaminhamento para o Tribunal Municipal', y);
  y = drawParagraph(
    'Nos termos da postura municipal em vigor, as multas que não forem liquidadas voluntariamente no prazo de 15 dias contados da autuação transitam automaticamente para o estado "Fora do Prazo".',
    y
  );

  y = drawBullet('Transição Automática', 'O sistema identifica diariamente os autos que ultrapassaram os 15 dias de prazo legal.', y);
  y = drawBullet('Processamento em Lote', 'Supervisores podem agrupar centenas de processos vencidos com um único clique.', y);
  y = drawBullet('Guia de Remessa Judicial', 'Geração de guia de remessa oficial com QR Code e relação discriminada para entrega na Secção de Cobrança Coerciva do Tribunal da Matola.', y);
  y = drawBullet('Rastreamento Processual', 'Acompanhamento do estado do processo no foro judicial (penhora de bens, apreensão de viatura, etc.).', y);

  y += 4;
  y = drawSectionSubtitle('8.2 Produtividade e Desempenho Operacional', y);
  y = drawParagraph(
    'O módulo de Produtividade disponibiliza uma visão transparente e quantitativa da atividade desenvolvida pelos agentes e equipas em serviço na Cidade da Matola:',
    y
  );

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Métrica de Desempenho', 'Objectivo Funcional', 'Impacto Operacional']],
    body: [
      ['Total de Autos por Agente', 'Quantificar a atividade de fiscalização por agente', 'Identificar agentes de alto rendimento'],
      ['Tempo Médio em Patrulha', 'Monitorizar a assiduidade e permanência no posto', 'Optimizar a escala das brigadas'],
      ['Taxa de Conformidade', 'Percentual de autos sem contestação ou erro', 'Elevar a qualidade jurídica dos autos'],
      ['Cobrança Voluntária', 'Taxa de multas liquidadas no prazo de 15 dias', 'Melhorar a arrecadação imediata'],
    ],
    theme: 'grid',
    headStyles: { fillColor: greenPrimary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: textDark },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  drawFooter(11);

  // ==========================================
  // PÁGINA 12: 9. AGENTES ONLINE — MONITORIZAÇÃO
  // ==========================================
  doc.addPage();
  y = drawPageHeaderBox('9. Agentes Online — Monitorização', 20);

  y = drawSectionSubtitle('9.1 Visão Geral e Mapa ao Vivo', y);
  y = drawParagraph(
    'A secção de Agentes Online faculta aos supervisores e comando da Polícia Municipal uma visão geográfica e operacional de todos os meios humanos no terreno em tempo real.',
    y
  );

  y = drawBullet('Mapa Interativo', 'Exibição de todos os agentes em mapa dinâmico com a sua localização GPS exata.', y);
  y = drawBullet('Estado em Tempo Real', 'Distinção clara entre agentes em serviço ativo (Online) e fora de serviço (Offline).', y);
  y = drawBullet('Alocação por Posto', 'Identificação rápida do posto de trabalho e brigada a que o agente está destacado.', y);

  y += 2;
  y = drawSectionSubtitle('9.2 Informações por Agente', y);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Dado', 'Descrição / Funcionalidade']],
    body: [
      ['Estado', 'Online (verde piscante) ou Offline (cinzento)'],
      ['Tempo de Sessão', 'Contador contínuo de horas e minutos desde o início do turno'],
      ['Telefone', 'Botão para efetuar chamada direta via operadora de telecomunicações'],
      ['Mensagem', 'Atalho para abertura imediata do chat interno com o agente'],
      ['Mapa', 'Centralização automática do mapa na coordenada GPS do agente'],
      ['Produtividade', 'Contador de multas lavradas na sessão em curso'],
    ],
    theme: 'grid',
    headStyles: { fillColor: greenPrimary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: textDark },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  y = drawSectionSubtitle('9.3 Pesquisa de Agentes e Logs de Presença', y);
  y = drawParagraph(
    'A barra de pesquisa no topo permite filtrar agentes instantaneamente por nome ou posto. Na parte inferior da página, são exibidos os registos históricos de logins, incluindo datas, horários de saída e duração das sessões para efeitos de controlo de ponto.',
    y
  );

  drawFooter(12);

  // ==========================================
  // PÁGINA 13: 10. PERFIL E MENSAGENS
  // ==========================================
  doc.addPage();
  y = drawPageHeaderBox('10. Perfil e Mensagens', 20);

  y = drawSectionSubtitle('10.1 Dados do Perfil', y);
  y = drawParagraph(
    'A página de perfil apresenta as informações funcionais e dados cadastrais do colaborador autenticado:',
    y
  );
  y = drawBullet('Identificação', 'Nome completo, número de agente, cargo oficial e nível de acesso atribuído.', y);
  y = drawBullet('Contactos', 'Endereço de e-mail institucional e número de telefone.', y);
  y = drawBullet('Histórico de Acesso', 'Data de registo no sistema e data/hora do último início de sessão.', y);
  y = drawBullet('Campos Protegidos', 'O nível de acesso e cargo são blindados e apenas editáveis pela administração.', y);

  y += 3;
  y = drawSectionSubtitle('10.2 Sistema de Mensagens (Chat Operacional)', y);
  y = drawParagraph(
    'O SIGEMM incorpora um canal encriptado de comunicação multimédia em tempo real entre a central e os agentes em campo:',
    y
  );
  y = drawBullet('Mensagens de Texto', 'Comunicação instantânea para orientações táticas e despachos urgentes.', y);
  y = drawBullet('Envio Multimédia', 'Suporte à partilha de fotos de veículos suspeitos, mensagens de voz (áudios), vídeos e documentos PDF.', y);
  y = drawBullet('Notificações no Sino', 'Alerta visual imediato no ícone de sino quando uma nova mensagem é recebida.', y);
  y = drawBullet('Histórico Permanente', 'Registo de conversas com carimbo de remetente, destinatário e hora de entrega.', y);

  y += 3;
  y = drawSectionSubtitle('10.3 Chamadas Diretas e Alertas', y);
  y = drawParagraph(
    'O sistema permite efetuar chamadas telefónicas diretas para qualquer agente em serviço com um único toque, utilizando a rede telefónica do dispositivo móvel. Alertas urgentes são destacados visualmente.',
    y
  );

  drawFooter(13);

  // ==========================================
  // PÁGINA 14: 11. ADMINISTRAÇÃO
  // ==========================================
  doc.addPage();
  y = drawPageHeaderBox('11. Administração', 20);

  y = drawSectionSubtitle('11.1 Gestão de Agentes e Utilizadores', y);
  y = drawParagraph(
    'O módulo de Administração é exclusivo para administradores e chefias municipais para controlo de efetivos:',
    y
  );
  y = drawBullet('Criação de Novos Agentes', 'Formulário completo com validação de duplicados de e-mail e BI.', y);
  y = drawBullet('Atribuição de Funções', 'Definição do nível de acesso: Presidente, Administrador, Supervisor, Agente de Campo, Fiscal de Posturas ou Cobrança.', y);
  y = drawBullet('Gestão de Senhas', 'Geração de credenciais temporárias seguras e redefinição de senhas bloqueadas.', y);
  y = drawBullet('Atribuição de Postos', 'Lotação de agentes nos postos de fiscalização da Cidade da Matola.', y);

  y += 3;
  y = drawSectionSubtitle('11.2 Sugestão Automática de Nomes de Utilizador', y);
  y = drawParagraph(
    'Ao registar um novo colaborador, o sistema analisa o nome completo e sugere automaticamente nomes de utilizador institucionais normalizados (ex: joao.silva ou joao.costa), verificando em tempo real se já existem na base de dados para evitar homónimos.',
    y
  );

  y += 3;
  y = drawSectionSubtitle('11.3 Estatísticas Administrativas e Auditoria', y);
  y = drawParagraph(
    'O painel administrativo apresenta métricas executivas globais da fiscalização municipal:',
    y
  );
  y = drawBullet('Consolidação Global', 'Estatísticas de multas por posto, taxas de cobrança por brigada e volumes de receita.', y);
  y = drawBullet('Auditoria Geral (Audit Trail)', 'Registo perpétuo de todas as operações sensíveis efetuadas na base de dados.', y);
  y = drawBullet('Cópias de Segurança (Backups)', 'Monitorização e exportação de backups da base de dados municipal.', y);

  drawFooter(14);

  // ==========================================
  // PÁGINA 15: 12. CONFIGURAÇÕES DO SISTEMA
  // ==========================================
  doc.addPage();
  y = drawPageHeaderBox('12. Configurações do Sistema', 20);

  y = drawSectionSubtitle('12.1 Gestão de Tipos de Infracção e Coimas', y);
  y = drawParagraph(
    'O administrador pode parametrizar a tabela oficial de infrações em vigor na Cidade da Matola:',
    y
  );
  y = drawBullet('Descrição da Infração', 'Denominação oficial e artigo da postura municipal infringido.', y);
  y = drawBullet('Categoria', 'Enquadramento obrigatório como Móvel (trânsito/veículos) ou Imóvel (obras/posturas).', y);
  y = drawBullet('Valor em Meticais (MT)', 'Montante pecuniário exato da coima legalmente fixado.', y);
  y = drawBullet('Estado de Ativação', 'Ativar ou desativar tipos de infração conforme atualizações das posturas.', y);

  y += 3;
  y = drawSectionSubtitle('12.2 Configuração de Impressora Bluetooth (ESC/POS)', y);
  y = drawParagraph(
    'O SIGEMM suporta emparelhamento com impressoras térmicas portáteis de bolso utilizadas pelas brigadas no terreno:',
    y
  );
  y = drawBullet('Protocolo ESC/POS', 'Compatibilidade universal com impressoras térmicas Bluetooth de 58mm e 80mm.', y);
  y = drawBullet('Emparelhamento Direto', 'Deteção rápida de periféricos Bluetooth através da interface do sistema.', y);
  y = drawBullet('Teste de Impressão', 'Botão para emissão de talão de teste, validando o contraste e a leitura ótica do QR Code.', y);

  y += 3;
  y = drawSectionSubtitle('12.3 Locais de Pagamento e Permissões', y);
  y = drawParagraph(
    'Cadastro dos postos municipais autorizados para recebimento de pagamentos e parametrização de permissões de utilizadores.',
    y
  );

  drawCallout(
    '■ Nota Administrativa',
    'As alterações efetuadas nas configurações de infrações ou valores de coimas têm efeito imediato para todos os agentes e fiscais em serviço no terreno.',
    y
  );

  drawFooter(15);

  // ==========================================
  // PÁGINA 16: 13. NOTIFICAÇÕES E FERRAMENTAS
  // ==========================================
  doc.addPage();
  y = drawPageHeaderBox('13. Notificações e Ferramentas', 20);

  y = drawSectionSubtitle('13.1 Sistema de Notificações em Tempo Real', y);
  y = drawParagraph('O sino de notificações no cabeçalho exibe avisos instantâneos com atalhos de contexto:', y);
  y = drawBullet('Liquidação de Multas', 'Avisos de novos pagamentos confirmados pela rede móvel ou balcão.', y);
  y = drawBullet('Pedidos de Cancelamento', 'Notificações de solicitações de anulação pendentes de validação com senha.', y);
  y = drawBullet('Mensagens Operacionais', 'Alertas de novas mensagens de texto, áudios ou fotos recebidas no chat.', y);
  y = drawBullet('Alertas de Sistema', 'Avisos sobre sincronização offline e manutenções programadas.', y);

  y += 2;
  y = drawSectionSubtitle('13.2 Gestor de Conexão e Sincronização Offline', y);
  y = drawParagraph(
    'No cabeçalho do SIGEMM, o agente dispõe de um indicador permanente do estado da ligação:',
    y
  );
  y = drawBullet('Estado Online / Offline', 'Ponto verde (Online com todas as multas sincronizadas) ou botão âmbar (Modo Offline com contador de multas pendentes na fila).', y);
  y = drawBullet('Modal de Diagnóstico', 'Ao tocar no indicador, abre-se um painel com a lista detalhada de multas retidas no aparelho, estado do Service Worker e botão "Sincronizar Agora" para envio manual imediato.', y);

  y += 2;
  y = drawSectionSubtitle('13.3 Ferramentas Utilitárias Integradas', y);
  y = drawBullet('Screenshot do Ecrã', 'Botão de câmara no cabeçalho para capturar instantaneamente a imagem da tela atual para anexar a relatórios.', y);
  y = drawBullet('Alternância de Tema', 'Modo Claro e Modo Escuro para conforto visual durante patrulhas diurnas ou noturnas.', y);
  y = drawBullet('Suporte Bilingue', 'Alternância instantânea entre Português de Moçambique (pt-MZ) e Inglês (en).', y);

  drawFooter(16);

  // ==========================================
  // PÁGINA 17: 14. NÍVEIS DE ACESSO E PERMISSÕES
  // ==========================================
  doc.addPage();
  y = drawPageHeaderBox('14. Níveis de Acesso e Permissões', 20);

  y = drawSectionSubtitle('14.1 Matriz de Permissões por Perfil', y);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Funcionalidade do SIGEMM', 'Presid.', 'Admin', 'Superv.', 'Campo', 'Fiscal', 'Caixa']],
    body: [
      ['Registar Multa (Móvel / Imóvel)', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM', 'NÃO'],
      ['Processar Pagamentos (POS / M-Pesa)', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM'],
      ['Consultar Histórico Completo', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM'],
      ['Exportar Dados (Excel / CSV)', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM'],
      ['Consultar Configurações', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM'],
      ['Editar Configurações / Coimas', 'NÃO', 'SIM', 'NÃO', 'NÃO', 'NÃO', 'NÃO'],
      ['Criar e Editar Agentes', 'NÃO', 'SIM', 'NÃO', 'NÃO', 'NÃO', 'NÃO'],
      ['Solicitar Cancelamento de Multa', 'NÃO', 'SIM', 'SIM', 'NÃO', 'NÃO', 'NÃO'],
      ['Aprovar Cancelamento de Multa', 'SIM', 'SIM', 'NÃO', 'NÃO', 'NÃO', 'NÃO'],
      ['Remeter Multas ao Tribunal', 'SIM', 'SIM', 'SIM', 'NÃO', 'NÃO', 'NÃO'],
      ['Ver Agentes Online no Mapa', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM', 'NÃO'],
      ['Chat Operacional e Mensagens', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM'],
    ],
    theme: 'grid',
    headStyles: { fillColor: greenPrimary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: textDark, halign: 'center' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  y = drawSectionSubtitle('14.2 Princípio da Separação de Poderes', y);
  y = drawParagraph(
    'A arquitetura do SIGEMM respeita estritamente o princípio da separação de funções e prerrogativas institucionais:',
    y
  );
  y = drawBullet('Proteção Operacional', 'Agentes autuantes não possuem permissão técnica para alterar valores de coimas ou anular autos lavrados.', y);
  y = drawBullet('Dupla Validação Obrigatória', 'Supervisores iniciam pedidos de anulação fundamentados, mas a aprovação definitiva cabe em exclusivo ao Presidente do Município ou ao Administrador.', y);

  drawFooter(17);

  // ==========================================
  // PÁGINA 18: 15. VANTAGENS DO SISTEMA
  // ==========================================
  doc.addPage();
  y = drawPageHeaderBox('15. Vantagens do Sistema', 20);

  y = drawSectionSubtitle('15.1 Vantagens Operacionais', y);
  y = drawBullet('Eliminação Total do Papel', 'Autos 100% digitais, eliminando o extravio de blocos, rasuras e custos de papelaria.', y);
  y = drawBullet('Leitura Automática OCR', 'Captura da matrícula pela câmara em segundos, acelerando o trabalho policial.', y);
  y = drawBullet('Tempo Real', 'Comando e tesouraria acompanham instantaneamente as infrações lavradas na cidade.', y);
  y = drawBullet('Geolocalização & Fotos', 'Evidência visual inalterável e coordenadas GPS que protegem a atuação do agente.', y);

  y += 2;
  y = drawSectionSubtitle('15.2 Vantagens Financeiras', y);
  y = drawBullet('Arrecadação Multicanal', 'Recebimento seguro via M-Pesa, e-Mola, mKesh e terminais bancários POS.', y);
  y = drawBullet('Redução Drástica de Fugas', 'Conciliação imediata com códigos de transação das operadoras.', y);
  y = drawBullet('Recibos com QR Code', 'Garantia de autenticidade que combate a emissão de recibos falsos.', y);
  y = drawBullet('Transparência Contábil', 'Fecho diário e prestação de contas automatizada para as Finanças Municipais.', y);

  y += 2;
  y = drawSectionSubtitle('15.3 Vantagens de Segurança', y);
  y = drawBullet('Dupla Autorização', 'Anulações blindadas por assinatura eletrónica de dois intervenientes distintos.', y);
  y = drawBullet('Auditoria Contínua (Audit Log)', 'Registo forense imutável de todas as ações executadas no sistema.', y);
  y = drawBullet('Row Level Security (RLS)', 'Blindagem de dados e proteção da privacidade dos munícipes.', y);

  y += 2;
  y = drawSectionSubtitle('15.4 Vantagens Tecnológicas', y);
  y = drawBullet('PWA Instalável', 'Funciona com a agilidade de uma app nativa sem necessidade de download em lojas.', y);
  y = drawBullet('Operação 100% Offline', 'Trabalho contínuo em áreas sem cobertura de dados móveis.', y);
  y = drawBullet('Design Responsivo', 'Totalmente adaptado a telemóveis, tablets e computadores de secretária.', y);

  drawFooter(18);

  // ==========================================
  // PÁGINA 19: 16. PERGUNTAS FREQUENTES (FAQ)
  // ==========================================
  doc.addPage();
  y = drawPageHeaderBox('16. Perguntas Frequentes (FAQ)', 20);

  const faqs = [
    {
      p: 'Como faço login no sistema?',
      r: 'Utilize o nome de utilizador ou e-mail fornecido pelo administrador e a sua senha. No primeiro acesso, o sistema pedirá para definir obrigatoriamente uma nova senha pessoal.',
    },
    {
      p: 'Esqueci a minha senha. O que faço?',
      r: 'Utilize a opção "Esqueceu a senha?" no ecrã de login para receber um e-mail de recuperação ou solicite ao administrador a geração de uma nova senha temporária.',
    },
    {
      p: 'Posso usar o sistema no telemóvel?',
      r: 'Sim! O SIGEMM é uma PWA otimizada para telemóvel. Pode e deve instalá-la como aplicação nativa tocando em "Instalar App" para ter acesso rápido e estável.',
    },
    {
      p: 'O sistema funciona sem internet ou rede móvel?',
      r: 'Sim! Graças ao Service Worker e à fila de sincronização, o agente pode emitir multas e imprimir comprovativos mesmo em locais sem qualquer sinal de rede. Assim que o aparelho voltar a ter cobertura, os dados são enviados automaticamente.',
    },
    {
      p: 'Como funciona o OCR de matrículas?',
      r: 'No ecrã de emissão de multa móvel, aponte a câmara do aparelho para a chapa de matrícula. O sistema faz o reconhecimento ótico e preenche o campo sem necessidade de digitação.',
    },
    {
      p: 'Como cancelo uma multa lavrada por engano?',
      r: 'Solicite o cancelamento no histórico inserindo a sua justificativa e senha. A solicitação é enviada para a autoridade superior (Presidente do Município ou Administrador), que deve aprovar com a respetiva senha para que a multa seja anulada.',
    },
    {
      p: 'Como conectar a impressora Bluetooth?',
      r: 'Aceda ao menu "Configurações", secção "Impressora Bluetooth", ligue a impressora térmica portátil e clique em emparelhar. Faça um teste de impressão para validar a comunicação.',
    },
  ];

  faqs.forEach((item) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...greenPrimary);
    doc.text(`■ ${item.p}`, margin, y);
    y += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...textDark);
    const lines = doc.splitTextToSize(item.r, contentWidth - 4);
    doc.text(lines, margin + 4, y);
    y += lines.length * 4.2 + 3.5;
  });

  drawFooter(19);

  // ==========================================
  // PÁGINA 20: CONTRA-CAPA OFICIAL
  // ==========================================
  doc.addPage();

  // Faixa verde superior decorativa
  doc.setFillColor(...greenPrimary);
  doc.rect(0, 0, pageWidth, 5, 'F');

  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', pageWidth / 2 - 22, 60, 44, 44);
  }

  y = 125;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...greenPrimary);
  doc.text('SIGEMM', pageWidth / 2, y, { align: 'center' });

  y += 8;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textDark);
  doc.text('Sistema de Gestão de Multas', pageWidth / 2, y, { align: 'center' });

  y += 18;
  doc.setDrawColor(...greenPrimary);
  doc.setLineWidth(1.5);
  doc.line(margin + 35, y, pageWidth - margin - 35, y);

  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...textDark);
  doc.text('Conselho Municipal da Matola', pageWidth / 2, y, { align: 'center' });

  y += 7;
  doc.setFontSize(10.5);
  doc.setTextColor(...textMuted);
  doc.text('Desenvolvido pela Sideout Studios', pageWidth / 2, y, { align: 'center' });

  y = pageHeight - 40;
  doc.setFontSize(9);
  doc.setTextColor(...textMuted);
  doc.text('© 2026 — Todos os direitos reservados', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text('Conselho Municipal da Cidade da Matola · República de Moçambique', pageWidth / 2, y, { align: 'center' });

  drawFooter(20);

  // Salvar no ficheiro público
  const pdfOutput = doc.output('arraybuffer');
  const outputPath = path.join(process.cwd(), 'public', 'Manual_do_Utilizador_SIGEMM.pdf');
  fs.writeFileSync(outputPath, Buffer.from(pdfOutput));
  console.log(`[PDF Generator] Manual Oficial de 20 páginas gerado com sucesso em: ${outputPath}`);

  return outputPath;
}

// Executar quando chamado diretamente
generateManualPDF();
