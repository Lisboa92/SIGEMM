import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  Header,
  Footer,
  PageNumber,
} from 'docx';

/**
 * Generates and downloads a complete, professional Microsoft Word (.docx)
 * User Manual for SIGEMM (Conselho Municipal da Matola).
 */
export async function generateAndDownloadWordManual() {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            size: 22, // 11pt
            color: '2D3748',
          },
          paragraph: {
            spacing: { line: 360, after: 160 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'SIGEMM · Manual do Utilizador (v5.0)',
                    italics: true,
                    size: 18,
                    color: '718096',
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
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Conselho Municipal da Matola · Página ',
                    size: 18,
                    color: '718096',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18,
                    color: '718096',
                  }),
                  new TextRun({
                    text: ' de ',
                    size: 18,
                    color: '718096',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 18,
                    color: '718096',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // CAPA / TITLE
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 800, after: 200 },
            children: [
              new TextRun({
                text: 'REPÚBLICA DE MOÇAMBIQUE',
                bold: true,
                size: 26,
                color: '1A365D',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
            children: [
              new TextRun({
                text: 'CONSELHO MUNICIPAL DA CIDADE DA MATOLA\nPOLÍCIA MUNICIPAL',
                bold: true,
                size: 24,
                color: '2C5282',
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 600, after: 300 },
            children: [
              new TextRun({
                text: 'SIGEMM',
                bold: true,
                size: 64,
                color: '047857',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'SISTEMA INTEGRADO DE GESTÃO E EMISSÃO DE MULTAS MUNICIPAIS',
                bold: true,
                size: 28,
                color: '1F2937',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 1200 },
            children: [
              new TextRun({
                text: 'MANUAL OFICIAL DO UTILIZADOR E GUIA OPERACIONAL COMPLETO',
                italics: true,
                size: 22,
                color: '4B5563',
              }),
            ],
          }),

          // Metadata Box
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: 'F0FDF4' },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 1, color: '86EFAC' },
                      bottom: { style: BorderStyle.SINGLE, size: 1, color: '86EFAC' },
                      left: { style: BorderStyle.SINGLE, size: 1, color: '86EFAC' },
                      right: { style: BorderStyle.SINGLE, size: 1, color: '86EFAC' },
                    },
                    children: [
                      new Paragraph({
                        spacing: { before: 120, after: 60 },
                        children: [
                          new TextRun({ text: 'Versão do Sistema: ', bold: true, color: '065F46' }),
                          new TextRun({ text: '5.0 (Edição Oficial)' }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 60 },
                        children: [
                          new TextRun({ text: 'Data de Emissão: ', bold: true, color: '065F46' }),
                          new TextRun({ text: new Date().toLocaleDateString('pt-MZ', { day: '2-digit', month: 'long', year: 'numeric' }) }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 60 },
                        children: [
                          new TextRun({ text: 'Destinatários: ', bold: true, color: '065F46' }),
                          new TextRun({ text: 'Agentes de Campo, Balcão de Atendimento, Supervisores, Tribunal e Administradores' }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 120 },
                        children: [
                          new TextRun({ text: 'Plataforma: ', bold: true, color: '065F46' }),
                          new TextRun({ text: 'Web Responsiva & PWA Offline (Tablet, Smartphone e Desktop)' }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // ÍNDICE GERAL
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 800, after: 200 },
            children: [new TextRun({ text: 'ÍNDICE GERAL DO MANUAL', bold: true, size: 28, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '1. Introdução e Objectivos do Sistema\n2. Níveis de Acesso e Perfis de Utilizador\n3. Acesso ao Sistema e Autenticação (Login e Troca de Senha)\n4. Recuperação de Senha por Email e Solicitação ao Administrador\n5. Registo de Nova Multa (Móvel e Imóvel, Auto de Notícia)\n6. Captura de Fotos, OCR de Matrículas e Assinaturas Digitais\n7. Envio Automático de Notificação de Multa por Email ao Cidadão\n8. Operação Offline e Sincronização Automática com PowerSync\n9. Gestão de Pagamentos no Local e Emissão de Recibos com QR Code\n10. Histórico de Multas, Filtros Avançados e Exportação (PDF / Excel)\n11. Pedido de Cancelamento de Multas (Validação do Presidente)\n12. Módulo de Tribunal e Encaminhamento Judicial\n13. Painel de Produtividade e Mapa em Tempo Real de Agentes Online\n14. Módulo de Reclamações e Pareceres Técnicos\n15. Painel de Administração e Criação de Agentes com Envio de Credenciais\n16. Configurações Globais, Idiomas (Português / Inglês) e Impressoras Térmicas\n17. Screenshots e Guia Visual das Telas e Funcionalidades\n18. Perguntas Frequentes (FAQ) e Suporte Técnico' }),
            ],
          }),

          // CAPÍTULO 1
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 },
            children: [new TextRun({ text: '1. Introdução e Objectivos do Sistema', bold: true, size: 26, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'O SIGEMM (Sistema Integrado de Gestão e Emissão de Multas Municipais) é a solução tecnológica oficial do Conselho Municipal da Matola desenvolvida para modernizar, agilizar e dar total transparência ao processo de autuação de transgressões às posturas municipais.',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Principais vantagens do sistema:\n• Emissão digital imediata de autos de notícia e guias de pagamento;\n• Redução do tempo de autuação e eliminação de erros manuais em talões em papel;\n• Notificação instantânea ao munícipe por Email e SMS com dados bancários/M-Pesa;\n• Rastreabilidade completa por GPS e registo fotográfico de evidências probatórias;\n• Segurança reforçada com assinatura digital no ecrã e verificação por QR Code autenticado;\n• Funcionamento garantido em modo offline quando não houver cobertura de internet.',
              }),
            ],
          }),

          // CAPÍTULO 2
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 },
            children: [new TextRun({ text: '2. Níveis de Acesso e Perfis de Utilizador', bold: true, size: 26, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'O acesso ao SIGEMM é estritamente controlado por perfis de acesso baseados na função oficial de cada colaborador:',
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ shading: { type: ShadingType.CLEAR, fill: '065F46' }, children: [new Paragraph({ children: [new TextRun({ text: 'Perfil', bold: true, color: 'FFFFFF' })] })] }),
                  new TableCell({ shading: { type: ShadingType.CLEAR, fill: '065F46' }, children: [new Paragraph({ children: [new TextRun({ text: 'Permissões e Competências', bold: true, color: 'FFFFFF' })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'SuperAdmin (Supremo)', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Autoridade suprema irrestrita do sistema, posicionado acima do Administrador e do Presidente do Município. Controlo absoluto sobre todas as contas, auditoria, configurações globais e autorizações executivas.' })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Presidente do Município', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Acesso executivo total; autorização exclusiva para anulação e cancelamento definitivo de multas; reposição de base de dados e relatórios globais.' })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Administrador (Admin)', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Gestão de utilizadores e agentes; auditoria de segurança; parametrização de tipos de multa e locais de pagamento; geração de backups.' })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Supervisor / Tribunal', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Monitorização de agentes no terreno; encaminhamento de processos para o Tribunal Judicial; análise de produtividade e pareceres de reclamação.' })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Agente de Campo / Balcão', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Emissão de novas multas (móveis/imóveis); recolha de evidências fotográficas; recebimento no local; impressão térmica e consulta de histórico.' })] }),
                ],
              }),
            ],
          }),

          // CAPÍTULO 3 & 4
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 },
            children: [new TextRun({ text: '3. Autenticação e Recuperação de Senha por Email', bold: true, size: 26, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '• Login: Insira o seu Nome de Utilizador (ex: joao.silva) ou Email institucional e a respectiva senha.\n• Primeiro Acesso: Ao entrar pela primeira vez com a senha provisória enviada pelo administrador, o sistema exige obrigatoriamente a definição de uma nova senha pessoal forte (mínimo 8 caracteres, contendo maiúsculas, números e símbolos).\n• Recuperação por Email: No ecrã de login, clique em "Esqueceu a senha?". O sistema permite a geração de uma nova senha provisória enviada directamente para o seu email institucional ou solicitar a reposição ao administrador com 1 clique.',
              }),
            ],
          }),

          // CAPÍTULO 5 & 6 & 7
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 },
            children: [new TextRun({ text: '4. Passo a Passo: Registo de Nova Multa e Envio de Email', bold: true, size: 26, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Para lavrar uma multa no sistema SIGEMM:\n1. Aceda ao menu "Nova Multa".\n2. Escolha a Categoria: Móvel (Trânsito e Viaturas) ou Imóvel (Obras, Posturas e Estabelecimentos).\n3. Preencha o Nº do Auto de Notícia (ex: 2026/00142).\n4. Identificação do Infractor: Nome completo, BI/DIRE, Telefone e Email do Cidadão (Opcional, para envio imediato da notificação).\n5. Identificação do Objecto: Matrícula da viatura (com leitura automática por OCR de Matrícula) ou Nº da Porta/Bairro da obra.\n6. Enquadramento Legal: Seleccione a infracção da lista de posturas municipais para preenchimento automático do valor em Meticais (MT), artigos e alíneas legais.\n7. Localização GPS: Clique no botão "Capturar Localização" para gravar as coordenadas exactas da ocorrência.\n8. Evidências Fotográficas: Capture no mínimo 2 fotos do local/infracção e 1 foto do documento do infractor.\n9. Assinaturas Digitais: Solicite ao infractor que assine no ecrã táctil e aplique a assinatura do agente autuante.\n10. Concluir: Clique em "Registar Multa". O sistema grava os dados, envia o email oficial com comprovativo ao munícipe e disponibiliza a opção de imprimir o talão térmico ou baixar o PDF oficial.',
              }),
            ],
          }),

          // CAPÍTULO 8
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 },
            children: [new TextRun({ text: '5. Pagamento no Local e Liquidação de Coimas', bold: true, size: 26, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'O SIGEMM suporta múltiplos métodos de quitação:\n• Pagamento no Local pelo Agente de Campo: Seleccione "Pagar no Local", indique o método (M-Pesa, e-Mola, Cartão POS ou Dinheiro) e emita imediatamente o Recibo de Quitação com QR Code autenticado;\n• Pagamento pelo Cidadão via Serviços Bancários / SIMO: O munícipe pode utilizar a Entidade 99001 e a Referência gerada na notificação para pagar via Internet Banking ou ATM;\n• Liquidação nos Balcões de Atendimento Municipal: Qualquer posto municipal pode consultar o número do auto e validar a liquidação em tempo real.',
              }),
            ],
          }),

          // CAPÍTULO 9 & 10 & 11
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 },
            children: [new TextRun({ text: '6. Histórico, Auditoria, Tribunal e Reclamações', bold: true, size: 26, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '• Histórico e Relatórios: Pesquise multas por matrícula, nome, data ou estado (Pendente, Paga, Cancelada, Em Tribunal). Exporte listagens completas para Excel (.xlsx) e relatórios formatados em PDF com logótipo oficial do Município.\n• Cancelamento com Autorização do Presidente: Nenhum agente ou administrador pode cancelar uma multa unilateralmente. Todo pedido de anulação exige a inserção das credenciais do Presidente do Município e motivo justificado.\n• Encaminhamento ao Tribunal: Multas não regularizadas no prazo legal podem ser remetidas ao Tribunal Judicial com emissão do Termo de Envio em PDF.\n• Atendimento de Reclamações: Registo de contestações apresentadas pelos cidadãos com parecer técnico e notificação da decisão.',
              }),
            ],
          }),

          // CAPÍTULO 12: Screenshots e Descrições Visuais
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 },
            children: [new TextRun({ text: '7. Screenshots e Guia Visual das Telas e Funcionalidades', bold: true, size: 26, color: '047857' })],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ shading: { type: ShadingType.CLEAR, fill: 'F3F4F6' }, children: [new Paragraph({ children: [new TextRun({ text: 'Ecrã / Funcionalidade', bold: true })] })] }),
                  new TableCell({ shading: { type: ShadingType.CLEAR, fill: 'F3F4F6' }, children: [new Paragraph({ children: [new TextRun({ text: 'Descrição Visual e Elementos de Interacção', bold: true })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Painel Principal (Dashboard)', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Cartões de métricas em tempo real (Total de Multas, Pagas, Pendentes, Hoje), gráfico de evolução mensal em barras/linhas, atalhos rápidos e tabela das últimas multas emitidas.' })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Formulário de Nova Multa', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Abas Móvel/Imóvel, campo para Email do Infractor com aviso de disparo de notificação, câmara fotográfica embutida, OCR de leitura de placas e tela de assinatura táctil.' })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Agentes Online e Mapa GPS', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Mapa interactivo com marcadores das posições em tempo real dos agentes em patrulha, estado de ligação, posto de trabalho e rota de patrulhamento.' })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Gestão de Utilizadores (Admin)', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Lista de agentes com fotografia, sugestão automática inteligente de nome de utilizador (username), botão de envio de credenciais por email e activação/desactivação.' })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Configurações de Idioma e Impressão', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Selector dinâmico de Idioma (Português / Inglês) com actualização global instantânea, teste de impressoras térmicas Bluetooth e gestão de tabelas de coimas.' })] }),
                ],
              }),
            ],
          }),

          // CAPÍTULO 13: FAQ
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 },
            children: [new TextRun({ text: '8. Perguntas Frequentes (FAQ) e Resolução de Problemas', bold: true, size: 26, color: '047857' })],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'P: O que acontece se a internet cair durante o preenchimento de uma multa?\nR: O SIGEMM utiliza o motor de sincronização contínua PowerSync com base de dados SQLite local (sigemm_powersync.db). A multa, evidências fotográficas e assinaturas são gravadas de imediato no dispositivo com latência zero (0ms). Assim que a ligação à rede for restabelecida, o lote de transacções (CrudBatch) é sincronizado automaticamente e com total integridade para o servidor central do Município da Matola.\n\nP: Como o infractor recebe o comprovativo se não tiver email?\nR: O agente pode imprimir o talão na impressora térmica portátil Bluetooth ou fornecer o número do Auto de Notícia para consulta presencial no Município.\n\nP: Como alterar o idioma de toda a aplicação?\nR: Clique no botão de Idioma (PT / EN) no cabeçalho ou nas Configurações. Todo o sistema, menus, janelas, avisos e botões mudam imediatamente para o idioma seleccionado.',
              }),
            ],
          }),

          // FECHO
          new Paragraph({
            spacing: { before: 800 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'CONSELHO MUNICIPAL DA CIDADE DA MATOLA\nDirecção da Polícia Municipal · Departamento de Tecnologias de Informação\nTodos os Direitos Reservados © 2026',
                bold: true,
                size: 20,
                color: '065F46',
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SIGEMM_Manual_do_Utilizador_v5_${new Date().toISOString().slice(0, 10)}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
