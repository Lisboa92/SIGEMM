import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  Table, 
  TableRow, 
  TableCell, 
  BorderStyle, 
  WidthType, 
  AlignmentType, 
  ShadingType,
  Header,
  Footer,
  PageNumber
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';

async function generateTFCProposalDocx() {
  const primaryColor = '005A9C'; // Azul Municipal / Institucional
  const secondaryColor = '1F2937'; // Cinza escuro
  const accentColor = '0D9488'; // Verde Petróleo
  const lightBg = 'F3F4F6';
  const tableBorderColor = 'D1D5DB';

  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: tableBorderColor },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: tableBorderColor },
    left: { style: BorderStyle.SINGLE, size: 1, color: tableBorderColor },
    right: { style: BorderStyle.SINGLE, size: 1, color: tableBorderColor },
  };

  function titleP(text: string) {
    return new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text,
          bold: true,
          size: 32, // 16pt
          color: primaryColor,
          font: 'Arial',
        }),
      ],
    });
  }

  function subtitleP(text: string) {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 50, after: 250 },
      children: [
        new TextRun({
          text,
          bold: false,
          size: 22, // 11pt
          color: secondaryColor,
          font: 'Arial',
        }),
      ],
    });
  }

  function h1(text: string) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 320, after: 120 },
      children: [
        new TextRun({
          text,
          bold: true,
          size: 26, // 13pt
          color: primaryColor,
          font: 'Arial',
        }),
      ],
    });
  }

  function h2(text: string) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 220, after: 80 },
      children: [
        new TextRun({
          text,
          bold: true,
          size: 24, // 12pt
          color: secondaryColor,
          font: 'Arial',
        }),
      ],
    });
  }

  function p(text: string, options?: { bold?: boolean; italic?: boolean }) {
    return new Paragraph({
      spacing: { before: 60, after: 80, line: 276 },
      children: [
        new TextRun({
          text,
          bold: options?.bold || false,
          italics: options?.italic || false,
          size: 22, // 11pt
          color: '374151',
          font: 'Arial',
        }),
      ],
    });
  }

  function bullet(text: string, boldPrefix?: string) {
    const children: TextRun[] = [];
    if (boldPrefix) {
      children.push(new TextRun({ text: boldPrefix + ' ', bold: true, size: 22, color: '111827', font: 'Arial' }));
    }
    children.push(new TextRun({ text, size: 22, color: '374151', font: 'Arial' }));

    return new Paragraph({
      bullet: { level: 0 },
      spacing: { before: 40, after: 40, line: 260 },
      children,
    });
  }

  function callout(title: string, content: string) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: {
                left: { style: BorderStyle.SINGLE, size: 24, color: primaryColor },
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              shading: { fill: 'F0F7FF', type: ShadingType.CLEAR },
              children: [
                new Paragraph({
                  spacing: { before: 80, after: 40 },
                  children: [
                    new TextRun({ text: `📌 ${title}`, bold: true, size: 22, color: primaryColor, font: 'Arial' }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 80, line: 260 },
                  children: [
                    new TextRun({ text: content, size: 20, color: '374151', font: 'Arial' }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  function createTable(headers: string[], rowsData: string[][]) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: headers.map(h => new TableCell({
            borders: cellBorder,
            shading: { fill: '005A9C', type: ShadingType.CLEAR },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 100, after: 100 },
                children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 20, font: 'Arial' })],
              }),
            ],
          })),
        }),
        ...rowsData.map((row, idx) => new TableRow({
          children: row.map(cell => new TableCell({
            borders: cellBorder,
            shading: { fill: idx % 2 === 0 ? 'FFFFFF' : lightBg, type: ShadingType.CLEAR },
            children: [
              new Paragraph({
                spacing: { before: 80, after: 80 },
                children: [new TextRun({ text: cell, size: 20, color: '374151', font: 'Arial' })],
              }),
            ],
          })),
        })),
      ],
    });
  }

  const doc = new Document({
    creator: 'Universidade Técnica Diogo Eugénio Guilande',
    title: 'Proposta de Tema de Trabalho de Fim de Curso - TFC',
    description: 'Proposta de Tema para Trabalho de Fim de Curso (TFC) na área de Engenharia Informática / Computação',
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            size: 22,
            color: '374151',
          },
        },
      },
    },
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Proposta de Tema de TFC · Licenciatura em Informática',
                    size: 18,
                    color: '9CA3AF',
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.SPACE_BETWEEN,
                children: [
                  new TextRun({
                    text: 'Faculdade de Ciências Tecnológicas · Trabalho de Fim de Curso',
                    size: 18,
                    color: '9CA3AF',
                    font: 'Arial',
                  }),
                  new TextRun({
                    text: '\tPágina ',
                    size: 18,
                    color: '9CA3AF',
                    font: 'Arial',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18,
                    color: '9CA3AF',
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // CABEÇALHO ACADÉMICO
          titleP('REPÚBLICA DE MOÇAMBIQUE\nUNIVERSIDADE TÉCNICA DIOGO EUGÉNIO GUILANDE\nFACULDADE DE CIÊNCIAS TECNOLÓGICAS'),
          subtitleP('CURSO DE LICENCIATURA EM INFORMÁTICA / ENGENHARIA INFORMÁTICA\nPROPOSTA FORMAL DE TEMA PARA TRABALHO DE FIM DE CURSO (TFC)'),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 150 },
            children: [
              new TextRun({
                text: '══════════════════════════════════════════════════════════════════',
                color: primaryColor,
                size: 20,
              }),
            ],
          }),

          // TÍTULO PROPOSTO
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 80 },
            children: [
              new TextRun({
                text: 'TÍTULO PROPOSTO PARA O TRABALHO DE FIM DE CURSO:',
                bold: true,
                size: 22,
                color: secondaryColor,
                font: 'Arial',
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 200 },
            children: [
              new TextRun({
                text: '«Desenvolvimento de um Sistema Integrado e Concorrente para Informatização, Fiscalização e Cobrança de Multas Municipais em Ambientes com Conectividade Intermitente: Caso do Município da Matola»',
                bold: true,
                italics: true,
                size: 26,
                color: primaryColor,
                font: 'Arial',
              }),
            ],
          }),

          callout(
            'Resumo da Proposta',
            'Esta proposta visa responder às exigências metodológicas de elaboração de TFC, estruturada em 4 eixos fundamentais: (1) Campo do Conhecimento, (2) Assunto dentro do Campo, (3) Situação Insatisfatória Concreta e (4) Interrogação Científica a que se responde com dados mensuráveis.'
          ),

          new Paragraph({ spacing: { before: 150, after: 80 } }),

          // PASSO 1
          h1('1. Escolha do Campo do Conhecimento'),
          p('• Campo Principal: Ciências da Computação / Engenharia Informática.'),
          p('• Subáreas de Especialização: Engenharia de Software, Sistemas de Informação Distribuídos, Computação Móvel e Governação Electrónica (E-Government / Smart Cities).'),
          p('• Justificação: O projecto assenta na concepção e implementação de uma solução de software robusta, distribuída e escalável, aplicando padrões modernos de engenharia de software e persistência de dados em ambientes operacionais críticos do sector público.'),

          // PASSO 2
          h1('2. Assunto Específico Dentro do Campo'),
          p('«Sistemas Móveis e Web com Arquitectura Offline-First, Automação de Fiscalização no Terreno através de Reconhecimento Óptico de Caracteres (OCR) e Integração de Meios de Pagamento Electrónicos para Arrecadação de Receitas Municipais.»'),
          p('Foco Tecnológico:'),
          bullet('Desenvolvimento de aplicações web progressivas (PWA) e móveis orientadas a dados.', '• PWA & Mobile:'),
          bullet('Resolução de concorrência e sincronização de dados bidirecional entre clientes locais (IndexedDB/Room) e base de dados na nuvem (PostgreSQL).', '• Arquitetura Offline-First:'),
          bullet('Processamento de imagem e visão computacional leve para leitura instantânea de matrículas.', '• Visão Computacional / OCR:'),
          bullet('Integração de carteiras móveis (M-Pesa, E-Mola) e terminais bancários para liquidação imediata com comprovativo digital.', '• FinTech & Arrecadação:'),

          // PASSO 3
          h1('3. Situação Insatisfatória Concreta (Problematização)'),
          p('No Conselho Municipal da Cidade da Matola (CMCM), o processo de autuação e fiscalização de infrações de trânsito e posturas municipais ainda assenta predominantemente em meios manuais baseados em talões de papel (autos físicos de notícia). Esta prática gera um conjunto de problemas críticos comprovados:'),
          bullet('Autos escritos à mão com caligrafia ilegível, dados incompletos (matrícula errada, falta de identificação do infrator) e perda física de canhotos entre o terreno e a tesouraria municipal.', '1. Extravio e Ilegibilidade de Documentos:'),
          bullet('Existe um hiato de dias ou semanas entre o momento da autuação no terreno e o lançamento manual nos cadernos de registo municipal, impossibilitando a conciliação bancária imediata e abrindo espaço para cobranças ilegais ou não declaradas (fuga de receitas).', '2. Morosidade e Falta de Conciliação Financeira:'),
          bullet('Inexistência de um mecanismo automatizado para alertar sobre multas com prazos de 15 dias expirados, resultando em milhares de processos que prescrevem sem nunca chegarem a ser cobrados judicialmente no Tribunal Municipal.', '3. Impossibilidade de Controlo de Prazos e Prescrição:'),
          bullet('Nas artérias periféricas e postos fiscais da Matola (ex: Machava, Infulene, Matola-Gare), a ausência temporária de sinal de rede 3G/4G impede o uso de sistemas web convencionais, forçando os fiscais a regressarem ao papel.', '4. Vulnerabilidade a Falhas de Conectividade:'),

          // PASSO 4
          h1('4. Interrogação a que se Responde com Dados (Questão de Partida)'),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 80, after: 120 },
            children: [
              new TextRun({
                text: '«De que forma a implementação de uma plataforma digital integrada (web/mobile), baseada em arquitectura offline-first, reconhecimento automático de matrículas por OCR e liquidação multicanal em tempo real, contribui para a redução da taxa de inadimplência de multas e diminuição do tempo médio de tramitação de autos no Município da Matola?»',
                bold: true,
                italics: true,
                size: 24,
                color: primaryColor,
                font: 'Arial',
              }),
            ],
          }),

          p('Para responder cientificamente a esta interrogação, a pesquisa irá recolher e comparar evidências quantitativas e qualitativas antes e após a implementação do sistema:'),

          createTable(
            ['Métrica / Indicador Quantitativo', 'Cenário Manual (Antes)', 'Cenário com SIGEMM (Depois)'],
            [
              ['Tempo médio de emissão de um auto', '8 a 15 minutos (preenchimento manual no talão).', 'Menos de 2 minutos (com preenchimento automático via OCR).'],
              ['Taxa de autos com erros cadastrais', 'Elevada (> 20% com erros em matrículas ou artigos).', 'Reduzida para < 2% (validação por regras de dados).'],
              ['Tempo de disponibilização para pagamento', '48 a 120 horas (transporte físico e digitação).', 'Instantâneo (0 segundos online / sincronização pós-offline).'],
              ['Taxa de arrecadação e conversão de multas', 'Baixa (< 40% das multas emitidas liquidadas).', 'Aumento significativo com múltiplos canais (M-Pesa, POS).'],
              ['Processos remetidos ao Tribunal no prazo', 'Residual (< 10% por falta de monitorização).', 'Automatizada em 100% dos autos com prazo legal expirado.'],
            ]
          ),

          new Paragraph({ spacing: { before: 150, after: 80 } }),

          // OBJECTIVOS
          h1('5. Objectivos do Trabalho de Fim de Curso'),
          h2('5.1. Objectivo Geral'),
          p('Desenvolver e avaliar uma plataforma integrada de gestão de autuações e cobrança de multas para a Polícia Municipal da Matola, garantindo continuidade operacional offline-first, rastreabilidade e auditoria imutável dos processos fiscais.'),
          
          h2('5.2. Objectivos Específicos'),
          bullet('Mapear e analisar o fluxo atual de emissão, registo e liquidação de multas no Conselho Municipal da Cidade da Matola.', '1.'),
          bullet('Projetar a arquitetura em três camadas do sistema com mecanismos de persistência local (IndexedDB / Cache Local) e sincronização concorrente bidirecional com a nuvem.', '2.'),
          bullet('Implementar o módulo de reconhecimento óptico de caracteres (OCR) para extração automática de matrículas e recolha de assinaturas digitais e provas fotográficas.', '3.'),
          bullet('Integrar o módulo de tesouraria multicanal (M-Pesa, E-Mola, POS bancário) com emissão de recibos térmicos instantâneos.', '4.'),
          bullet('Avaliar o impacto do sistema através de testes de usabilidade e análise comparativa de métricas de eficiência operacional e financeira.', '5.'),

          // METODOLOGIA
          h1('6. Metodologia de Investigação e Desenvolvimento'),
          bullet('Design Science Research (DSR) combinada com metodologia ágil (Scrum/Kanban) para desenvolvimento iterativo do artefacto de software.', '• Metodologia de Investigação:'),
          bullet('Entrevistas com agentes municipais, análise documental de posturas e autos de notícia do CMCM.', '• Técnicas de Recolha de Dados:'),
          bullet('React 18, TypeScript, Tailwind CSS, Node.js (Express), PostgreSQL / Supabase, Docker e ESC/POS para impressão térmica.', '• Ferramentas & Tecnologias:'),
          bullet('Testes funcionais, testes de carga, testes de usabilidade (SUS - System Usability Scale) e validação piloto em posto fiscal.', '• Validação do Artefacto:'),

          new Paragraph({ spacing: { before: 200, after: 100 } }),

          // ASSINATURAS ACADÉMICAS
          createTable(
            ['O Candidato / Estudante', 'O Docente Supervisor / Orientador'],
            [
              ['Data: ____ / ____ / 2026\n\nAssinatura: _____________________________', 'Data: ____ / ____ / 2026\n\nParecer: [  ] Aprovado   [  ] Reformular\n\nAssinatura: _____________________________'],
            ]
          ),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(process.cwd(), 'public', 'Proposta_Tema_TFC_SIGEMM.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Proposta de TFC gerada com sucesso em: ${outputPath}`);
}

generateTFCProposalDocx().catch(console.error);
