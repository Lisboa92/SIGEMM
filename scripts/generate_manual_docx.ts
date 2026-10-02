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

async function generateManual() {
  const primaryColor = '005A9C'; // Azul Municipal Matola
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
      spacing: { before: 240, after: 120 },
      children: [
        new TextRun({
          text,
          bold: true,
          size: 36, // 18pt
          color: primaryColor,
          font: 'Arial',
        }),
      ],
    });
  }

  function subtitleP(text: string) {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 300 },
      children: [
        new TextRun({
          text,
          bold: false,
          size: 24, // 12pt
          color: secondaryColor,
          font: 'Arial',
        }),
      ],
    });
  }

  function h1(text: string) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 140 },
      children: [
        new TextRun({
          text,
          bold: true,
          size: 28, // 14pt
          color: primaryColor,
          font: 'Arial',
        }),
      ],
    });
  }

  function h2(text: string) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 100 },
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

  function h3(text: string) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 180, after: 80 },
      children: [
        new TextRun({
          text,
          bold: true,
          size: 22, // 11pt
          color: accentColor,
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
    creator: 'Conselho Municipal da Cidade da Matola',
    title: 'Manual do Utilizador - SIGEMM',
    description: 'Manual de Utilizador do Sistema Integrado de Gestão de Multas Municipais (SIGEMM)',
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
                    text: 'SIGEMM · Manual do Utilizador · Município da Matola',
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
                    text: 'Conselho Municipal da Cidade da Matola — Confidencial & Oficial',
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
          // CAPA
          titleP('REPÚBLICA DE MOÇAMBIQUE\nCONSELHO MUNICIPAL DA CIDADE DA MATOLA'),
          subtitleP('Comando da Policia Municipal\nSISTEMA INTEGRADO DE GESTÃO DE MULTAS MUNICIPAIS (SIGEMM)'),
          
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
            children: [
              new TextRun({
                text: '═════════════════════════════════════════════════════',
                color: primaryColor,
                size: 20,
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 200 },
            children: [
              new TextRun({
                text: 'MANUAL DO UTILIZADOR',
                bold: true,
                size: 40,
                color: primaryColor,
                font: 'Arial',
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 50, after: 300 },
            children: [
              new TextRun({
                text: 'Guia Completo de Operação, Fiscalização e Gestão de Multas Municipais\nVersão 1.0 — 2026',
                italics: true,
                size: 24,
                color: '4B5563',
                font: 'Arial',
              }),
            ],
          }),

          callout(
            'Informação Institucional',
            'Este documento é de uso oficial e destina-se a todos os Agentes da Polícia Municipal, Fiscais, Supervisores, Operadores de Caixa, Técnicos Administrativos e Chefias do Conselho Municipal da Cidade da Matola para a operação do sistema SIGEMM.'
          ),

          new Paragraph({ spacing: { before: 200, after: 100 } }),

          // ÍNDICE GERAL
          h1('Índice do Manual'),
          bullet('Capítulo 1: Introdução e Objectivos do Sistema'),
          bullet('Capítulo 2: Perfis de Acesso e Segurança (RBAC & 2FA)'),
          bullet('Capítulo 3: Acesso ao Sistema e Início de Sessão'),
          bullet('Capítulo 4: Painel Principal e Monitorização (Dashboard)'),
          bullet('Capítulo 5: Emissão de Autos de Multa (Módulo "Multas")'),
          bullet('Capítulo 6: Leitura OCR de Matrículas e Captura de Fotos'),
          bullet('Capítulo 7: Assinaturas Digitais e Impressão de Autos'),
          bullet('Capítulo 8: Liquidação e Cobrança de Multas (Pagamentos)'),
          bullet('Capítulo 9: Histórico, Pesquisa e Exportação para Excel'),
          bullet('Capítulo 10: Gestão de Reclamações e Contestações'),
          bullet('Capítulo 11: Encaminhamento de Multas para o Tribunal'),
          bullet('Capítulo 12: Cancelamento de Multas e Autorização Superior'),
          bullet('Capítulo 13: Mensagens em Tempo Real e Chat Operacional'),
          bullet('Capítulo 14: Monitorização de Agentes Online e Produtividade'),
          bullet('Capítulo 15: Modo Offline e Sincronização no Terreno'),
          bullet('Capítulo 16: Administração do Sistema e Configurações'),
          bullet('Capítulo 17: Resolução de Problemas e Dúvidas Frequentes'),

          // CAPÍTULO 1
          h1('1. Introdução e Objectivos do Sistema'),
          p('O SIGEMM (Sistema Integrado de Gestão de Multas Municipais) é a plataforma tecnológica oficial concebida para modernizar, informatizar e auditar todo o ciclo de vida das autuações municipais na Cidade da Matola. O sistema abrange desde a emissão do auto no terreno pelos agentes da Polícia Municipal até à liquidação em caixa, tramitação jurídica e cobrança judicial.'),
          p('Principais benefícios operacionais:'),
          bullet('Eliminação do papel tradicional e de erros de transcrição manual.', '• Digitalização Total:'),
          bullet('Controlo de arrecadação em tempo real e prevenção de desvios com registo imutável.', '• Transparência e Auditoria:'),
          bullet('Suporte para trabalho em áreas remotas ou com quebras de sinal de rede.', '• Operação Offline:'),
          bullet('Reconhecimento OCR de matrículas por câmera e assinatura digital no ecrã.', '• Automação Inteligente:'),
          bullet('Impressão térmica de talões de 58mm/80mm e autos completos em folha A4 oficial.', '• Impressão Imediata:'),

          // CAPÍTULO 2
          h1('2. Perfis de Acesso e Segurança'),
          p('O SIGEMM utiliza o modelo RBAC (Role-Based Access Control) garantindo que cada utilizador acede estritamente às funcionalidades compatíveis com a sua função hierárquica.'),
          createTable(
            ['Nível de Acesso', 'Funções Principais', 'Permissões Atribuídas'],
            [
              ['Superadmin', 'Administração Geral do Município', 'Acesso irrestrito a configurações, agentes, auditoria e backups.'],
              ['Admin', 'Supervisores e Chefias de Posto', 'Gestão de agentes, parametrizações, tribunal e relatórios globais.'],
              ['Agente', 'Polícia Municipal e Fiscais de Campo', 'Emissão de multas, cobrança, chat, consultas e histórico de autos.'],
              ['Leitor', 'Auditores e Consultores', 'Apenas visualização e exportação de relatórios sem edição.'],
            ]
          ),
          new Paragraph({ spacing: { before: 100, after: 100 } }),
          callout('Autenticação em Dois Factores (MFA)', 'Para maior segurança contra acessos não autorizados, os administradores e supervisores podem ativar o MFA via Google Authenticator ou Microsoft Authenticator na página de Configurações/Perfil.'),

          // CAPÍTULO 3
          h1('3. Acesso ao Sistema e Início de Sessão'),
          h2('3.1. Ecrã de Login'),
          p('1. Aceda ao endereço do SIGEMM através do navegador no computador ou terminal móvel.'),
          p('2. Introduza o seu Nome de Utilizador (ex: agente.cossa) ou endereço de E-mail institucional.'),
          p('3. Introduza a sua Senha de Acesso e clique no botão "Entrar no Sistema".'),
          p('4. Caso o MFA esteja ativo, insira o código de 6 dígitos gerado pela aplicação autenticadora.'),
          h2('3.2. Recuperação de Senha'),
          p('Se esqueceu a sua senha, clique em "Esqueceu a sua senha?", introduza o seu e-mail cadastrado e siga as instruções enviadas para a sua caixa de correio eletrónico.'),

          // CAPÍTULO 4
          h1('4. Painel Principal (Dashboard)'),
          p('O Dashboard apresenta uma visão sintética e em tempo real da performance do município:'),
          bullet('Total de multas registadas no dia, mês ou período selecionado.', '• Total de Multas:'),
          bullet('Valor total cobrado em Meticais (MT) através de todos os canais de pagamento.', '• Arrecadação Global:'),
          bullet('Volume de autos que aguardam liquidação dentro do prazo legal.', '• Multas Pendentes:'),
          bullet('Autos que ultrapassaram o prazo e requerem notificação ou tribunal.', '• Multas Fora do Prazo:'),
          bullet('Gráficos analíticos comparando infrações de trânsito (Móvel) versus posturas e obras (Imóvel).', '• Distribuição por Categoria:'),

          // CAPÍTULO 5
          h1('5. Emissão de Autos de Multa (Módulo "Multas")'),
          p('Para registar uma nova autuação, clique no menu lateral em "Multas". O formulário divide-se em 3 secções lógicas:'),
          h2('5.1. Categoria da Infração'),
          bullet('Aplica-se a veículos ligeiros, pesados, transporte de passageiros (chapas), táxis e motociclos. Requer matrícula, marca, modelo, nome do condutor e documento (BI/Carta).', '• Categoria Móvel:'),
          bullet('Aplica-se a estabelecimentos comerciais, obras clandestinas, publicidade ilegal, despejo de resíduos e poluição sonora. Requer número de porta/lote, endereço e responsável.', '• Categoria Imóvel:'),
          h2('5.2. Dados do Auto e Enquadramento Legal'),
          p('Seleccione o tipo de infração a partir da tabela oficial pré-configurada. O valor em Meticais (MT) e o artigo do código de posturas serão preenchidos automaticamente, permitindo também ajuste quando aplicável.'),
          h2('5.3. Localização e Posto de Trabalho'),
          p('O sistema preenche o posto de trabalho padrão do agente e obtém as coordenadas geográficas precisas por GPS do dispositivo móvel.'),

          // CAPÍTULO 6
          h1('6. Leitura OCR de Matrículas e Provas Fotográficas'),
          h2('6.1. Leitura Automática por OCR'),
          p('Ao fiscalizar um veículo, clique no botão "Ler matrícula (OCR)". Aponte a câmera para a chapa de matrícula do automóvel. A inteligência visual processa a imagem e preenche automaticamente o campo da matrícula no formato moçambicano (ex: ABC 123 MC).'),
          h2('6.2. Registo Fotográfico Probatório'),
          p('Podem ser anexadas até 5 fotografias ao auto de notícia para sustentar a infração (ex: estacionamento indevido, carga perigosa, obra sem licença). As fotos são enviadas de forma segura e anexadas ao registo digital.'),

          // CAPÍTULO 7
          h1('7. Assinaturas Digitais e Impressão de Autos'),
          h2('7.1. Assinatura Digital no Ecrã'),
          bullet('O agente autuante assina diretamente no ecrã táctil com o dedo ou caneta stylus.', '• Assinatura do Agente:'),
          bullet('O cidadão autuado confirma o conhecimento assinando na caixa própria. Caso se recuse, o agente marca a opção "Recusou-se a assinar", registando a fé pública do acto.', '• Assinatura do Infrator:'),
          h2('7.2. Impressão de Documentos Oficiais'),
          p('Após gravar a multa, o diálogo de impressão permite escolher:'),
          bullet('Impressora térmica portátil via Bluetooth ou USB (recibo oficial de 58mm/80mm com QR Code de autenticidade).', '• Talão Térmico:'),
          bullet('Documento formal com timbre do Conselho Municipal da Matola pronto para impressão em folhas A4 ou download em PDF.', '• Auto de Notícia + Aviso de Multa A4:'),

          // CAPÍTULO 8
          h1('8. Liquidação e Cobrança de Multas (Pagamentos)'),
          p('No menu "Pagamentos", o operador de caixa ou agente fiscaliza e liquida os valores em atraso:'),
          bullet('Pesquisa rápida pelo número do auto (ex: AUTO-2026-0001), BI do infrator ou matrícula.', '1. Localização do Auto:'),
          bullet('M-Pesa, E-Mola, Cartão de Débito/Crédito (POS), Numerário ou Transferência Bancária.', '2. Selecção do Método de Pagamento:'),
          bullet('Inserção do código da transação/talão de depósito para conciliação financeira.', '3. Número de Comprovativo:'),
          bullet('O sistema altera o estado da multa para "Paga" e disponibiliza a impressão imediata do Recibo de Quitação.', '4. Confirmação:'),

          // CAPÍTULO 9
          h1('9. Histórico, Pesquisa e Exportação'),
          p('O menu "Histórico" permite auditar e consultar todos os autos municipais com poderosos filtros:'),
          bullet('Pendente, Paga, Cancelada, Fora do Prazo, Enviada ao Tribunal.', '• Filtro por Estado:'),
          bullet('Seleção de intervalos de datas (data inicial e final).', '• Filtro Temporal:'),
          bullet('Pesquisa instantânea por agente, condutor, BI, matrícula ou localização.', '• Busca Inteligente:'),
          bullet('Geração de relatórios com folha de cálculo e resumo financeiro em formato Excel (.xlsx) e CSV.', '• Exportação de Relatórios:'),

          // CAPÍTULO 10
          h1('10. Gestão de Reclamações e Contestações'),
          p('Quando um munícipe contesta uma autuação dentro do prazo legal:'),
          p('1. Aceda ao módulo "Reclamações" e clique em "Registar Reclamação".'),
          p('2. Associe o número da multa e descreva os fundamentos e provas apresentadas pelo cidadão.'),
          p('3. A comissão de avaliação ou supervisor analisa e emite a decisão: Deferida (anulação/redução da multa), Indeferida (manutenção da coima) ou Em Análise.'),

          // CAPÍTULO 11
          h1('11. Encaminhamento de Multas para o Tribunal'),
          p('Multas não liquidadas após o prazo legal de 15 dias passam automaticamente para o estado "Fora do Prazo".'),
          p('No menu "Tribunal":'),
          bullet('Identificação dos autos com prazos prescritos ou expirados.', '• Triagem Automática:'),
          bullet('Seleção de múltiplos autos e geração da guia de remessa para a Secção Judicial do Tribunal da Cidade da Matola.', '• Remessa em Lote:'),
          bullet('Controlo de números de ofício, datas de entrada e sentenças judiciais.', '• Registo de Notificação:'),

          // CAPÍTULO 12
          h1('12. Cancelamento de Multas e Autorização Superior'),
          p('Para prevenir anulações indevidas, o cancelamento de qualquer multa carece de validação hierárquica estrita:'),
          p('1. O agente ou supervisor abre o auto e clica em "Solicitar Cancelamento".'),
          p('2. Selecciona o Presidente do Município ou Delegado responsável e descreve a justificação.'),
          p('3. O autorizador recebe a notificação no sino superior do sistema.'),
          p('4. O Presidente aprova ou recusa mediante confirmação com a sua senha pessoal de segurança.'),

          // CAPÍTULO 13
          h1('13. Mensagens em Tempo Real e Chat Operacional'),
          p('O SIGEMM integra um sistema de mensageria interna para coordenação entre o posto central de comando e as brigadas no terreno:'),
          bullet('Canal direto e seguro para troca de informações operacionais sem recurso a aplicações externas.', '• Mensagens Privadas:'),
          bullet('Avisos de novas diretrizes, reforço de efetivo e alertas prioritários de trânsito.', '• Comunicações Rápidas:'),

          // CAPÍTULO 14
          h1('14. Monitorização de Agentes Online e Produtividade'),
          h2('14.1. Agentes de Serviço (Presença em Tempo Real)'),
          p('O módulo "Agentes Online" mostra quem está ativo no terreno, o seu posto de trabalho e o tempo decorrido desde a última ação no sistema.'),
          h2('14.2. Tabela de Produtividade e Ranking'),
          p('Apresenta o ranking mensal de eficiência operacional, número de autos registados e taxa de conformidade por posto municipal.'),

          // CAPÍTULO 15
          h1('15. Modo Offline e Sincronização no Terreno'),
          p('Em locais com quebra de cobertura de dados móveis (3G/4G):'),
          bullet('O agente continua a emitir multas normalmente; o sistema armazena os dados localmente no dispositivo.', '• Funcionamento Ininterrupto:'),
          bullet('Um indicador visual no topo do ecrã exibe "Offline · X por enviar".', '• Indicador de Fila:'),
          bullet('Assim que o sinal de rede é recuperado, a sincronização é executada automaticamente ou clicando em "Sincronizar".', '• Envio Automático:'),

          // CAPÍTULO 16
          h1('16. Administração do Sistema e Configurações'),
          p('Apenas acessível a utilizadores com perfil de Administrador ou Superadmin:'),
          bullet('Cadastro, edição e inativação de agentes, atribuição de crachás e níveis de acesso.', '• Gestão de Agentes:'),
          bullet('Definição de artigos, códigos de posturas municipais e tabelas de taxas em Meticais (MT).', '• Parametrização de Infrações:'),
          bullet('Configuração de brigadas, postos fixos e zonas municipais da Matola.', '• Postos de Trabalho:'),
          bullet('Registo cronológico e imutável de todas as ações executadas no sistema (criação, edição, liquidação, cancelamento).', '• Logs de Auditoria:'),
          bullet('Exportação de cópia de segurança completa da base de dados.', '• Backups e Restauro:'),

          // CAPÍTULO 17
          h1('17. Resolução de Problemas e Dúvidas Frequentes'),
          createTable(
            ['Situação / Problema', 'Causa Provável', 'Solução Recomendada'],
            [
              ['Não consigo entrar no sistema', 'Credenciais erradas ou conta inativa', 'Verifique o username/senha ou contacte o administrador do município.'],
              ['Erro ao ler a matrícula por OCR', 'Má iluminação ou reflexo na placa', 'Posicione a câmera perpendicularmente à matrícula ou digite manualmente.'],
              ['Impressora Bluetooth não imprime', 'Impressora desligada ou desemparelhada', 'Ligue a impressora, verifique o emparelhamento Bluetooth e tente novamente.'],
              ['Registos pendentes não sincronizam', 'Falta de ligação à Internet', 'Aproxime-se de uma zona com sinal 4G/Wi-Fi e clique em "Sincronizar".'],
              ['Botão de Cancelar Multa pede autorização', 'Regra de segurança institucional', 'O cancelamento carece obrigatoriamente de autorização do Presidente do Município.'],
            ]
          ),
          new Paragraph({ spacing: { before: 200, after: 100 } }),
          p('Para assistência técnica adicional ou suporte especializado, contacte a Divisão de Tecnologias de Informação e Comunicação do Conselho Municipal da Cidade da Matola.'),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(process.cwd(), 'public', 'Manual_do_Utilizador_SIGEMM.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Manual gerado com sucesso em: ${outputPath}`);
}

generateManual().catch(console.error);
