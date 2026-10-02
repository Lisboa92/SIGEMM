import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import logoMatola from '@/assets/logo-matola.png';
import {
  BookOpen, Search, Printer, Shield, CheckCircle2,
  Building2, WifiOff, FileText, Download, Loader2,
  Activity, Database, ArrowUp, Sparkles,
  Clock, Lock, Check, Gavel
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

interface UserManualViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UserManualViewer({ open, onOpenChange }: UserManualViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSection, setActiveSection] = useState<string>('intro');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePrint = () => {
    setIsPrinting(true);
    try {
      // Create dedicated hidden print iframe to avoid dialog/iframe cropping
      const existingFrame = document.getElementById('sigemm-manual-print-frame');
      if (existingFrame) existingFrame.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'sigemm-manual-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      iframe.style.width = '1024px';
      iframe.style.height = '1024px';
      iframe.style.opacity = '0.01';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document;
      if (!frameDoc) {
        window.print();
        setIsPrinting(false);
        return;
      }

      const manualHtml = `
        <!DOCTYPE html>
        <html lang="pt">
        <head>
          <meta charset="utf-8">
          <title>Manual Oficial do Utilizador — SIGEMM Matola v1.0</title>
          <style>
            @page {
              size: A4;
              margin: 15mm 15mm 20mm 15mm;
            }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #111827;
              background: #fff;
              line-height: 1.5;
              font-size: 10.5pt;
              margin: 0;
              padding: 0;
            }
            .header {
              text-align: center;
              border-bottom: 2.5px solid #047857;
              padding-bottom: 12px;
              margin-bottom: 22px;
            }
            .header img {
              max-height: 70px;
              margin-bottom: 8px;
            }
            .header h1 {
              font-size: 15pt;
              font-weight: 800;
              margin: 3px 0;
              color: #064e3b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .header h2 {
              font-size: 11pt;
              font-weight: 700;
              margin: 2px 0;
              color: #047857;
            }
            .header p {
              font-size: 8.5pt;
              color: #4b5563;
              margin: 2px 0;
            }
            .badge {
              display: inline-block;
              background: #ecfdf5;
              border: 1px solid #10b981;
              color: #065f46;
              padding: 3px 10px;
              border-radius: 9999px;
              font-weight: 700;
              font-size: 8.5pt;
              margin-top: 6px;
            }
            .chapter {
              margin-bottom: 22px;
              page-break-inside: avoid;
            }
            .chapter-title {
              display: flex;
              align-items: center;
              font-size: 12pt;
              font-weight: 800;
              color: #064e3b;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 5px;
              margin-bottom: 10px;
            }
            .chapter-num {
              display: inline-block;
              background: #047857;
              color: white;
              width: 22px;
              height: 22px;
              line-height: 22px;
              text-align: center;
              border-radius: 4px;
              font-size: 9pt;
              margin-right: 8px;
              font-weight: bold;
            }
            .card {
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 10px 12px;
              margin-bottom: 8px;
              background: #f9fafb;
              page-break-inside: avoid;
            }
            .card-title {
              font-weight: 700;
              font-size: 10pt;
              color: #111827;
              margin-bottom: 3px;
            }
            .card-desc {
              font-size: 9pt;
              color: #4b5563;
              margin: 0;
            }
            .grid {
              display: flex;
              gap: 10px;
              margin-bottom: 8px;
            }
            .grid > div {
              flex: 1;
            }
            ul, ol {
              margin-top: 4px;
              margin-bottom: 8px;
              padding-left: 20px;
              font-size: 9.5pt;
            }
            li {
              margin-bottom: 3px;
            }
            .alert-box {
              background: #fffbeb;
              border-left: 4px solid #f59e0b;
              padding: 8px 12px;
              font-size: 9pt;
              margin: 10px 0;
              border-radius: 0 4px 4px 0;
            }
            .footer {
              text-align: center;
              font-size: 8pt;
              color: #6b7280;
              margin-top: 25px;
              border-top: 1px solid #e5e7eb;
              padding-top: 10px;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoMatola}" alt="Brasão do CMM">
            <p>REPÚBLICA DE MOÇAMBIQUE • PROVÍNCIA DE MAPUTO</p>
            <h1>CONSELHO MUNICIPAL DA CIDADE DA MATOLA</h1>
            <h2>COMANDO DA POLÍCIA MUNICIPAL DA MATOLA</h2>
            <div><span class="badge">MANUAL OFICIAL DO UTILIZADOR — SIGEMM v1.0 (Produção)</span></div>
          </div>

          <div class="chapter">
            <div class="chapter-title"><span class="chapter-num">01</span> Introdução e Enquadramento Jurídico</div>
            <p>O SIGEMM (Sistema Integrado de Gestão de Multas Municipais) é a plataforma oficial do Conselho Municipal da Matola destinada a modernizar, desmaterializar e conferir transparência integral aos procedimentos de fiscalização de trânsito, posturas urbanísticas e cobrança de taxas coercivas.</p>
            <div class="grid">
              <div class="card">
                <div class="card-title">Base Legal de Trânsito</div>
                <div class="card-desc">Código da Estrada de Moçambique (Decreto-Lei n.º 1/2011) e Regulamentos Municipais de Circulação e Transportes.</div>
              </div>
              <div class="card">
                <div class="card-title">Posturas Municipais</div>
                <div class="card-desc">Regulamento de Edificações Urbanas (RGEU), Licenciamento de Atividades Económicas e Postura de Limpeza e Saneamento.</div>
              </div>
            </div>
          </div>

          <div class="chapter">
            <div class="chapter-title"><span class="chapter-num">02</span> Perfis de Utilizador, Acesso e Segurança (RBAC)</div>
            <p>O acesso ao SIGEMM é estritamente controlado pelo modelo de permissões baseado em funções (Role-Based Access Control):</p>
            <div class="card">
              <div class="card-title">Agente de Fiscalização / Polícia Municipal (Campo)</div>
              <div class="card-desc">Emissão de multas móveis e imóveis em campo, digitalização OCR de matrículas, recolha de assinaturas digitais, fotos de evidência e operação offline.</div>
            </div>
            <div class="card">
              <div class="card-title">Operador de Caixa / Tesouraria (Financeiro)</div>
              <div class="card-desc">Processamento e quitação de multas no balcão único, validação de depósitos bancários, M-Pesa, e-Mola, mKesh e emissão de recibos oficiais.</div>
            </div>
            <div class="card">
              <div class="card-title">Chefe de Operações / Oficial de Dia (Supervisão)</div>
              <div class="card-desc">Acompanhamento em tempo real da equipa em campo via GPS, análise de produtividade, gestão de reclamações e remessa de processos ao Tribunal.</div>
            </div>
            <div class="card">
              <div class="card-title">Administrador do Sistema (Acesso Total)</div>
              <div class="card-desc">Cadastro de agentes, parametrização da tabela de coimas, auditoria completa de sessões, autorização de cancelamentos e backups de segurança.</div>
            </div>
            <div class="alert-box">
              <strong>Política de Senhas:</strong> No primeiro login com credenciais geradas pela administração, o utilizador é obrigado a definir uma senha pessoal forte.
            </div>
          </div>

          <div class="chapter">
            <div class="chapter-title"><span class="chapter-num">03</span> Painel Principal (Dashboard)</div>
            <p>O Painel Principal fornece uma visão consolidada instantânea da atividade fiscalizadora do município:</p>
            <ul>
              <li><strong>Total de Multas Emitidas:</strong> Contagem acumulada com distinção entre pagas, pendentes e anuladas.</li>
              <li><strong>Arrecadação do Dia:</strong> Valor financeiro cobrado nas últimas 24 horas em Meticais (MT).</li>
              <li><strong>Desempenho Individual:</strong> Quantidade de autuações lavradas pelo agente com sessão ativa.</li>
              <li><strong>Tabela de Autos Recentes:</strong> Acesso direto para visualização de detalhes, impressão de talão e envio por email.</li>
            </ul>
          </div>

          <div class="chapter">
            <div class="chapter-title"><span class="chapter-num">04</span> Emissão de Multas Móveis (Trânsito e Viaturas)</div>
            <ol>
              <li><strong>Reconhecimento da Matrícula (OCR):</strong> Aponte a câmara do telemóvel/tablet para a chapa de matrícula ou digite no padrão ABC-123-MC. O sistema realiza busca imediata de reincidências.</li>
              <li><strong>Dados do Condutor / Infrator:</strong> Preencha o Nome Completo, Número do Documento (BI, Carta de Condução ou DIRE) e Número de Telefone para envio do SMS/Notificação.</li>
              <li><strong>Seleção da Infracção:</strong> Escolha a infração no catálogo municipal (ex: Estacionamento Indevido, Excesso de Velocidade, Falta de Licença de Táxi). O valor é preenchido automaticamente.</li>
              <li><strong>Geolocalização e Local:</strong> O GPS captura as coordenadas exatas do posto de fiscalização (ex: Av. das Indústrias, Rotunda da Matola 700).</li>
              <li><strong>Assinatura Digital e Fotos:</strong> Recolha a assinatura digital no ecrã e anexe até 4 fotos das evidências da infração.</li>
              <li><strong>Registo e Notificação:</strong> Ao gravar, é gerado o Número do Auto Oficial e a Factura com referência para pagamento voluntário.</li>
            </ol>
          </div>

          <div class="chapter">
            <div class="chapter-title"><span class="chapter-num">05</span> Emissão de Multas Imóveis (Obras e Posturas)</div>
            <p>Para fiscalização urbanística, de ocupação do solo ou de estabelecimentos comerciais:</p>
            <ul>
              <li><strong>Identificação do Terreno/Edifício:</strong> Nº da Porta, Talhão, Quarteirão, Bairro e Posto Administrativo.</li>
              <li><strong>Dimensões do Imóvel:</strong> Área em metros quadrados (m²) ou perímetro da vedação.</li>
              <li><strong>Estágio da Obra:</strong> Fundação, Alvenaria, Cobertura, Acabamentos ou Concluída.</li>
              <li><strong>Tipo de Infracção Urbanística:</strong> Obra Clandestina (sem licença), Invasão de Reserva Pública, Despejo de Entulho, Ruído Fora de Horas.</li>
            </ul>
          </div>

          <div class="chapter">
            <div class="chapter-title"><span class="chapter-num">06</span> Modo Offline e Sincronização Inteligente</div>
            <p>O SIGEMM opera sob arquitetura <strong>Offline-First</strong> para garantir continuidade operacional ininterrupta:</p>
            <ul>
              <li><strong>Sem Rede:</strong> O sistema ativa o distintivo Offline e armazena o auto na fila encriptada local.</li>
              <li><strong>Fila Segura:</strong> Os autos recebem o status provisório <code>offline_pendente</code>.</li>
              <li><strong>Auto-Sync:</strong> Ao reconectar ao Wi-Fi ou 4G, a sincronização é efetuada automaticamente sem duplicações.</li>
            </ul>
          </div>

          <div class="chapter">
            <div class="chapter-title"><span class="chapter-num">07</span> Processamento de Pagamentos e Quitação</div>
            <div class="grid">
              <div class="card">
                <div class="card-title">💳 POS Municipal / Cartão</div>
                <div class="card-desc">Débito direto no cartão de qualquer banco moçambicano (BIM, BCI, Standard Bank, Moza, etc.).</div>
              </div>
              <div class="card">
                <div class="card-title">📱 Carteiras Móveis</div>
                <div class="card-desc">Liquidação via M-Pesa, e-Mola e mKesh com envio de comprovativo digital e validação de referência.</div>
              </div>
            </div>
            <div class="grid">
              <div class="card">
                <div class="card-title">🏦 Depósito Bancário</div>
                <div class="card-desc">Registo do número do borderô/recibo bancário com anexo obrigatório do comprovativo digital.</div>
              </div>
              <div class="card">
                <div class="card-title">🏛️ Balcão Único</div>
                <div class="card-desc">Atendimento presencial na Sede do Município ou nos Postos Administrativos descentralizados.</div>
              </div>
            </div>
          </div>

          <div class="chapter">
            <div class="chapter-title"><span class="chapter-num">08</span> Impressão Térmica Portátil (ESC/POS)</div>
            <ol>
              <li>Aceda ao menu <strong>Configurações &gt; Impressora Térmica</strong>.</li>
              <li>Ligue o Bluetooth do dispositivo e selecione o modelo da sua impressora portátil (58mm ou 80mm).</li>
              <li>Clique em <strong>Testar Conexão</strong> para imprimir um talão de teste com o brasão da Matola.</li>
              <li>Na tela de emissão ou histórico, clique em <strong>Imprimir Auto / Factura</strong> para entregar o talão ao infrator.</li>
            </ol>
          </div>

          <div class="chapter">
            <div class="chapter-title"><span class="chapter-num">09</span> Histórico, Pesquisa Avançada e 2ª Via</div>
            <p>Permite consulta instantânea por Número de Auto, Matrícula, Nome do Infrator, Período de Datas e Estado de Cobrança com reimpressão de 2ª via oficial com QR Code autenticado.</p>
          </div>

          <div class="chapter">
            <div class="chapter-title"><span class="chapter-num">10</span> Prazos Legais e Encaminhamento ao Tribunal</div>
            <p>Conforme a legislação vigente, o infrator dispõe de <strong>15 dias úteis</strong> para liquidar a coima voluntariamente. Findo este prazo, o processo passa para <strong>FORA DE PRAZO</strong> e é remetido ao Tribunal Judicial da Província de Maputo (Secção de Polícia e Trânsito) com emissão de guia oficial de transgressão.</p>
          </div>

          <div class="chapter">
            <div class="chapter-title"><span class="chapter-num">11</span> Contestações e Reclamações de Munícipes</div>
            <p>O munícipe tem o direito legal de apresentar defesa escrita contra o auto lavrado. O módulo <strong>Reclamações</strong> regista a contestação, suspende temporariamente a contagem de prazos e submete o processo ao Comandante da Polícia Municipal para despacho fundamentado.</p>
          </div>

          <div class="chapter">
            <div class="chapter-title"><span class="chapter-num">12</span> Monitorização de Agentes em Tempo Real</div>
            <p>Permite ao comando operacional visualizar a localização em tempo real das brigadas de fiscalização, histórico de presença, mapas de patrulha e comunicação direta via rádio/chat operacional.</p>
          </div>

          <div class="chapter">
            <div class="chapter-title"><span class="chapter-num">13</span> Cópias de Segurança (Backup) e Registo de Auditoria</div>
            <p>Exportação periódica em JSON/Excel e trilha imutável de auditoria com registo timestamped de todas as ações executadas no sistema.</p>
          </div>

          <div class="footer">
            <p>Conselho Municipal da Cidade da Matola • SIGEMM v1.0 • Engenharia de Software por Sideout Studios © 2026</p>
          </div>
        </body>
        </html>
      `;

      frameDoc.open();
      frameDoc.write(manualHtml);
      frameDoc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          toast.success('Diálogo de impressão aberto com sucesso!');
        } catch (err) {
          console.error(err);
          window.print();
        } finally {
          setIsPrinting(false);
          setTimeout(() => {
            if (document.body.contains(iframe)) iframe.remove();
          }, 3000);
        }
      }, 500);

    } catch (err: any) {
      console.error('Print error:', err);
      toast.error('Erro ao abrir diálogo de impressão: ' + (err?.message || err));
      setIsPrinting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let y = 16;

      // Add logo
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d')?.drawImage(img, 0, 0);
            const base64 = canvas.toDataURL('image/png');
            doc.addImage(base64, 'PNG', 14, 10, 18, 18);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = logoMatola;
        });
      } catch {}

      // Header text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(6, 78, 59);
      doc.text('CONSELHO MUNICIPAL DA CIDADE DA MATOLA', 36, y);
      y += 5;

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(4, 120, 87);
      doc.text('COMANDO DA POLÍCIA MUNICIPAL', 36, y);
      y += 5;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('MANUAL OFICIAL DO UTILIZADOR — SIGEMM v1.0 (Produção)', 36, y);
      y += 8;

      doc.setDrawColor(4, 120, 87);
      doc.setLineWidth(0.6);
      doc.line(14, y, pageWidth - 14, y);
      y += 7;

      const chapters = [
        {
          num: '01',
          title: 'Introdução e Enquadramento Jurídico',
          body: 'O SIGEMM é a plataforma oficial do Conselho Municipal da Matola para modernizar e desmaterializar a fiscalização de trânsito, posturas urbanísticas e arrecadação de taxas coercivas.\nBase Legal: Código da Estrada (Decreto-Lei n.º 1/2011) e Regulamentos Municipais de Circulação, Edificações Urbanas (RGEU) e Saneamento.',
        },
        {
          num: '02',
          title: 'Perfis de Utilizador, Acesso e Segurança (RBAC)',
          body: '1. Agente de Fiscalização: Emissão em campo de autos móveis e imóveis, OCR de matrículas e modo offline.\n2. Operador de Caixa/Tesouraria: Processamento e quitação por POS, Carteiras Móveis e Banco.\n3. Chefe de Operações: Supervisão em tempo real da equipa, relatórios e tribunal.\n4. Administrador: Gestão global, tabela de coimas, auditoria e backups.',
        },
        {
          num: '03',
          title: 'Painel Principal (Dashboard)',
          body: 'Visão consolidada da arrecadação diária, contadores de autos (pagos, pendentes, anulados), produtividade por agente e acesso imediato aos autos recentes.',
        },
        {
          num: '04',
          title: 'Emissão de Multas Móveis (Trânsito)',
          body: 'Fluxo operacional: 1. OCR da Matrícula -> 2. Dados do Infrator -> 3. Seleção da Infração -> 4. Coordenadas GPS -> 5. Assinatura Digital e Fotos -> 6. Geração do Auto com QR Code.',
        },
        {
          num: '05',
          title: 'Emissão de Multas Imóveis (Obras e Posturas)',
          body: 'Fiscalização urbanística com registo de Talhão, Quarteirão, Bairro, Dimensões em m², Estágio da Obra e Tipologia de Infracção (falta de licença, invasão de via pública, entulho).',
        },
        {
          num: '06',
          title: 'Modo Offline e Sincronização Inteligente',
          body: 'Operação sem cobertura de rede móvel: os autos são armazenados em fila local encriptada e sincronizados de forma transparente ao restabelecer a conexão.',
        },
        {
          num: '07',
          title: 'Processamento de Pagamentos e Quitação',
          body: 'Canais autorizados: POS Municipal (cartões bancários), M-Pesa, e-Mola, mKesh, depósito bancário validado e Balcão Único presencial.',
        },
        {
          num: '08',
          title: 'Impressão Térmica Portátil (ESC/POS)',
          body: 'Suporte a impressoras térmicas portáteis de cintura (58mm e 80mm) via Bluetooth, Wi-Fi e USB para emissão imediata do talão oficial ao infrator.',
        },
        {
          num: '09',
          title: 'Histórico, Pesquisa Avançada e 2ª Via',
          body: 'Pesquisa avançada multicritério e emissão autenticada de 2ª via oficial do auto e recibo com validação por QR Code.',
        },
        {
          num: '10',
          title: 'Prazos Legais e Tribunal',
          body: 'Prazo voluntário de 15 dias úteis. Decorrido o prazo, os processos transitam para execução coerciva junto do Tribunal Judicial da Província de Maputo.',
        },
        {
          num: '11',
          title: 'Contestações e Reclamações',
          body: 'Registo e suspensão de prazos durante a análise da defesa escrita do munícipe pelo Comandante da Polícia Municipal.',
        },
        {
          num: '12',
          title: 'Monitorização de Agentes em Tempo Real',
          body: 'Geolocalização das brigadas em serviço, status de presença e comunicação por rádio e chat interno.',
        },
        {
          num: '13',
          title: 'Cópias de Segurança (Backup) e Auditoria',
          body: 'Exportação periódica em JSON/Excel e trilha imutável de auditoria com timestamp de cada operação.',
        },
      ];

      doc.setTextColor(30, 41, 59);

      chapters.forEach((ch) => {
        // Check page overflow
        if (y > pageHeight - 35) {
          doc.addPage();
          y = 16;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(6, 78, 59);
        doc.text(`${ch.num}. ${ch.title}`, 14, y);
        y += 5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);

        const lines = doc.splitTextToSize(ch.body, pageWidth - 28);
        doc.text(lines, 14, y);
        y += (lines.length * 4.2) + 5;
      });

      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Conselho Municipal da Matola • SIGEMM v1.0 — Página ${i} de ${totalPages}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        );
      }

      doc.save('Manual_do_Utilizador_SIGEMM_Matola_v1.pdf');
      toast.success('Manual do Utilizador baixado em PDF com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao gerar PDF: ' + (err?.message || err));
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[96vw] h-[92vh] max-h-[92vh] p-0 flex flex-col overflow-hidden bg-background text-foreground shadow-2xl border-primary/20">
        
        {/* TOP BAR / CONTROLS */}
        <div className="p-4 border-b border-border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Manual Oficial do Utilizador — SIGEMM
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Conselho Municipal da Matola • Versão 1.0 (Produção)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Pesquisar no manual..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs bg-muted/40"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="h-8 gap-1.5 text-xs shrink-0"
              title="Baixar Manual Oficial em PDF"
            >
              {isExportingPDF ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-emerald-600" />}
              <span className="hidden sm:inline">Baixar PDF</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handlePrint}
              disabled={isPrinting}
              className="h-8 gap-1.5 text-xs shrink-0 bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs"
              title="Imprimir Manual Completo"
            >
              {isPrinting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              <span>Imprimir</span>
            </Button>
          </div>
        </div>

        {/* QUICK NAVIGATION PILLS */}
        <div className="px-4 py-2 bg-muted/30 border-b border-border/60 overflow-x-auto flex items-center gap-1.5 shrink-0 [scrollbar-width:none]">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1 whitespace-nowrap">Capítulos:</span>
          {[
            { id: 'intro', label: '1. Enquadramento' },
            { id: 'perfis', label: '2. Perfis e Segurança' },
            { id: 'dashboard', label: '3. Dashboard' },
            { id: 'multas-moveis', label: '4. Multas Móveis' },
            { id: 'multas-imoveis', label: '5. Multas Imóveis' },
            { id: 'offline', label: '6. Modo Offline' },
            { id: 'pagamentos', label: '7. Pagamentos' },
            { id: 'impressoras', label: '8. Impressão' },
            { id: 'historico', label: '9. Histórico' },
            { id: 'tribunal', label: '10. Tribunal' },
            { id: 'reclamacoes', label: '11. Reclamações' },
            { id: 'agentes', label: '12. Agentes Online' },
            { id: 'backup-auditoria', label: '13. Backup e Auditoria' },
          ].map(sec => (
            <button
              key={sec.id}
              onClick={() => scrollToSection(sec.id)}
              className={`px-2.5 py-1 rounded-full text-xs whitespace-nowrap transition-colors ${
                activeSection === sec.id
                  ? 'bg-primary text-primary-foreground font-medium shadow-xs'
                  : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50'
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>

        {/* SCROLLABLE MANUAL CONTENT */}
        <ScrollArea className="flex-1 p-6 sm:p-8 space-y-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-10 pb-12">

            {/* MANUAL HEADER WITH OFFICIAL EMBLEM */}
            <div className="text-center space-y-4 pb-6 border-b border-border">
              <div className="flex justify-center">
                <img
                  src={logoMatola}
                  alt="Brasão do Conselho Municipal da Matola"
                  className="h-20 w-auto object-contain drop-shadow-xs"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                  República de Moçambique • Província de Maputo
                </p>
                <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                  CONSELHO MUNICIPAL DA CIDADE DA MATOLA
                </h1>
                <p className="text-sm font-semibold text-primary">
                  POLÍCIA MUNICIPAL & DIRECÇÃO DE ADMINISTRAÇÃO E FINANÇAS
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5" />
                MANUAL OFICIAL DO UTILIZADOR — SIGEMM v1.0
              </div>

              <p className="text-xs text-muted-foreground max-w-xl mx-auto italic">
                Documento normativo e guia operacional para a emissão, cobrança, fiscalização e tramitação de multas municipais na plataforma digital SIGEMM.
              </p>
            </div>

            {/* CAPÍTULO 1: INTRODUÇÃO & ENQUADRAMENTO JURÍDICO */}
            <section id="intro" className="space-y-4 scroll-mt-6">
              <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                  01
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Introdução e Enquadramento Jurídico
                </h2>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                O <strong className="text-foreground">SIGEMM (Sistema Integrado de Gestão de Multas Municipais)</strong> é a plataforma oficial do Conselho Municipal da Matola destinada a modernizar, desmaterializar e conferir transparência integral aos procedimentos de fiscalização de trânsito, posturas urbanísticas e cobrança de taxas coercivas.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <Card className="p-3.5 bg-muted/20 border-border space-y-1.5">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-primary" /> Base Legal de Trânsito
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Código da Estrada de Moçambique (Decreto-Lei n.º 1/2011) e Regulamentos Municipais de Circulação e Transportes.
                  </p>
                </Card>
                <Card className="p-3.5 bg-muted/20 border-border space-y-1.5">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-primary" /> Posturas Municipais
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Regulamento de Edificações Urbanas (RGEU), Licenciamento de Atividades Económicas e Postura de Limpeza e Saneamento.
                  </p>
                </Card>
              </div>
            </section>

            {/* CAPÍTULO 2: PERFIS E SEGURANÇA */}
            <section id="perfis" className="space-y-4 scroll-mt-6">
              <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                  02
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Perfis de Utilizador, Acesso e Segurança (RBAC)
                </h2>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                O acesso ao SIGEMM é estritamente controlado pelo modelo de permissões baseado em funções (Role-Based Access Control):
              </p>

              <div className="space-y-2.5">
                {[
                  {
                    perfil: 'Agente de Fiscalização / Polícia Municipal',
                    badge: 'Campo / Operacional',
                    color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300',
                    desc: 'Emissão de multas móveis e imóveis em campo, digitalização OCR de matrículas, recolha de assinaturas digitais, fotos de evidência e operação offline.',
                  },
                  {
                    perfil: 'Operador de Caixa / Tesouraria',
                    badge: 'Financeiro',
                    color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300',
                    desc: 'Processamento e quitação de multas no balcão único, validação de depósitos bancários, M-Pesa, e-Mola, mKesh e emissão de recibos oficiais.',
                  },
                  {
                    perfil: 'Chefe de Operações / Oficial de Dia',
                    badge: 'Supervisão',
                    color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-300',
                    desc: 'Acompanhamento em tempo real da equipa em campo via GPS, análise de produtividade, gestão de reclamações e remessa de processos ao Tribunal.',
                  },
                  {
                    perfil: 'Administrador do Sistema',
                    badge: 'Acesso Total',
                    color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-300',
                    desc: 'Cadastro de agentes, parametrização da tabela de coimas, auditoria completa de sessões, autorização de cancelamentos e backups de segurança.',
                  },
                ].map((item, idx) => (
                  <Card key={idx} className="p-3.5 border-border bg-card space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{item.perfil}</span>
                      <Badge variant="outline" className={`text-[10px] ${item.color}`}>
                        {item.badge}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </Card>
                ))}
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-300 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-amber-700 dark:text-amber-400" /> Política de Senhas Provisórias
                </p>
                <p>
                  Ao receber o email com a senha provisória gerada pelo administrador, o utilizador é obrigado a definir uma nova senha no primeiro login para desbloquear o sistema.
                </p>
              </div>
            </section>

            {/* CAPÍTULO 3: DASHBOARD */}
            <section id="dashboard" className="space-y-4 scroll-mt-6">
              <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-400 flex items-center justify-center font-bold text-sm">
                  03
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Painel Principal (Dashboard)
                </h2>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                O Painel Principal fornece uma visão consolidada instantânea da atividade fiscalizadora do município:
              </p>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2 p-2.5 rounded-md bg-muted/20 border border-border/60">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span><strong>Total de Multas Emitidas:</strong> Contagem acumulada com distinção entre pagas, pendentes e anuladas.</span>
                </li>
                <li className="flex items-start gap-2 p-2.5 rounded-md bg-muted/20 border border-border/60">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span><strong>Arrecadação do Dia:</strong> Valor financeiro cobrado nas últimas 24 horas em Meticais (MT).</span>
                </li>
                <li className="flex items-start gap-2 p-2.5 rounded-md bg-muted/20 border border-border/60">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span><strong>Desempenho Individual:</strong> Quantidade de autuações lavradas pelo agente com sessão ativa.</span>
                </li>
                <li className="flex items-start gap-2 p-2.5 rounded-md bg-muted/20 border border-border/60">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span><strong>Tabela de Autos Recentes:</strong> Acesso direto para visualização de detalhes, impressão de talão e envio por email.</span>
                </li>
              </ul>
            </section>

            {/* CAPÍTULO 4: MULTAS MÓVEIS */}
            <section id="multas-moveis" className="space-y-4 scroll-mt-6">
              <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  04
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Emissão de Multas Móveis (Trânsito e Viaturas)
                </h2>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                O fluxo de autuação de trânsito é desenhado para ser rápido e à prova de falhas:
              </p>

              <div className="space-y-2">
                {[
                  { step: '1. Reconhecimento da Matrícula (OCR)', text: 'Aponte a câmara do telemóvel/tablet para a chapa de matrícula ou digite no padrão ABC-123-MC. O sistema realiza busca imediata de reincidências.' },
                  { step: '2. Dados do Condutor / Infrator', text: 'Preencha o Nome Completo, Número do Documento (BI, Carta de Condução ou DIRE) e Número de Telefone para envio do SMS/Notificação.' },
                  { step: '3. Seleção da Infracção', text: 'Escolha a infração no catálogo municipal (ex: Estacionamento Indevido, Excesso de Velocidade, Falta de Licença de Táxi). O valor é preenchido automaticamente.' },
                  { step: '4. Geolocalização e Local', text: 'O GPS captura as coordenadas exatas do posto de fiscalização (ex: Av. das Indústrias, Rotunda da Matola 700).' },
                  { step: '5. Assinatura Digital e Fotos', text: 'Recolha a assinatura digital no ecrã e anexe até 4 fotos das evidências da infração.' },
                  { step: '6. Registo e Notificação', text: 'Ao gravar, é gerado o Número do Auto Oficial e a Factura com referência para pagamento voluntário.' },
                ].map((s, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-border bg-card flex items-start gap-3">
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                      {idx + 1}
                    </span>
                    <div className="space-y-0.5 text-xs">
                      <p className="font-bold text-foreground">{s.step}</p>
                      <p className="text-muted-foreground leading-relaxed">{s.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* CAPÍTULO 5: MULTAS IMÓVEIS */}
            <section id="multas-imoveis" className="space-y-4 scroll-mt-6">
              <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-700 dark:text-orange-400 flex items-center justify-center font-bold text-sm">
                  05
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Emissão de Multas Imóveis (Obras e Posturas)
                </h2>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                Para fiscalização urbanística, de ocupação do solo ou de estabelecimentos comerciais:
              </p>

              <div className="p-4 rounded-lg bg-muted/20 border border-border space-y-2 text-xs">
                <p className="font-bold text-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-orange-600" /> Campos Obrigatórios para Imóveis:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li><strong>Identificação do Terreno/Edifício:</strong> Nº da Porta, Talhão, Quarteirão, Bairro e Posto Administrativo.</li>
                  <li><strong>Dimensões do Imóvel:</strong> Área em metros quadrados (m²) ou perímetro da vedação.</li>
                  <li><strong>Estágio da Obra:</strong> Fundação, Alvenaria, Cobertura, Acabamentos ou Concluída.</li>
                  <li><strong>Tipo de Infracção Urbanística:</strong> Obra Clandestina (sem licença), Invasão de Reserva Pública, Despejo de Entulho, Ruído Fora de Horas.</li>
                </ul>
              </div>
            </section>

            {/* CAPÍTULO 6: MODO OFFLINE */}
            <section id="offline" className="space-y-4 scroll-mt-6">
              <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                  06
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Modo Offline e Sincronização Inteligente
                </h2>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                O SIGEMM foi concebido com arquitetura <strong className="text-foreground">Offline-First</strong> para garantir continuidade operacional mesmo em zonas com corte ou fraqueza de rede celular:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <Card className="p-3 bg-card border-border space-y-1">
                  <p className="font-bold text-foreground flex items-center gap-1.5">
                    <WifiOff className="h-3.5 w-3.5 text-amber-600" /> Sem Rede
                  </p>
                  <p className="text-muted-foreground">O sistema ativa o distintivo Offline e armazena o auto na fila encriptada do dispositivo.</p>
                </Card>
                <Card className="p-3 bg-card border-border space-y-1">
                  <p className="font-bold text-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-blue-600" /> Fila Segura
                  </p>
                  <p className="text-muted-foreground">Os autos recebem o status provisório <code>offline_pendente</code> e podem ser consultados no histórico.</p>
                </Card>
                <Card className="p-3 bg-card border-border space-y-1">
                  <p className="font-bold text-foreground flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600" /> Auto-Sync
                  </p>
                  <p className="text-muted-foreground">Ao reconectar ao Wi-Fi ou 4G, a sincronização é disparada em segundo plano sem perda de dados.</p>
                </Card>
              </div>
            </section>

            {/* CAPÍTULO 7: PAGAMENTOS */}
            <section id="pagamentos" className="space-y-4 scroll-mt-6">
              <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                  07
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Processamento de Pagamentos e Quitação
                </h2>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                As multas podem ser liquidadas através de múltiplos canais com emissão imediata de Recibo de Quitação Oficial:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-md bg-muted/20 border border-border space-y-1">
                  <p className="font-bold text-foreground">💳 Pagamento por POS Municipal</p>
                  <p className="text-muted-foreground">Débito direto no cartão de qualquer banco moçambicano (BIM, BCI, Standard Bank, Moza, etc.).</p>
                </div>
                <div className="p-3 rounded-md bg-muted/20 border border-border space-y-1">
                  <p className="font-bold text-foreground">📱 Carteiras Móveis (M-Pesa / e-Mola / mKesh)</p>
                  <p className="text-muted-foreground">Liquidação rápida com envio de comprovativo digital e validação de referência.</p>
                </div>
                <div className="p-3 rounded-md bg-muted/20 border border-border space-y-1">
                  <p className="font-bold text-foreground">🏦 Depósito Bancário e Transferência</p>
                  <p className="text-muted-foreground">Registo do número do borderô/recibo bancário com anexo obrigatório do comprovativo digital.</p>
                </div>
                <div className="p-3 rounded-md bg-muted/20 border border-border space-y-1">
                  <p className="font-bold text-foreground">🏛️ Balcão Único do CMM</p>
                  <p className="text-muted-foreground">Atendimento presencial na Sede do Município ou nos Postos Administrativos descentralizados.</p>
                </div>
              </div>
            </section>

            {/* CAPÍTULO 8: IMPRESSÃO TÉRMICA */}
            <section id="impressoras" className="space-y-4 scroll-mt-6">
              <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold text-sm">
                  08
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Impressão Térmica Portátil (ESC/POS)
                </h2>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                O SIGEMM suporta impressoras térmicas portáteis de cintura (58mm e 80mm) via Bluetooth, Wi-Fi, Rede e USB:
              </p>

              <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                <li>Aceda ao menu <strong>Configurações &gt; Impressora Térmica</strong>.</li>
                <li>Ligue o Bluetooth do dispositivo e selecione o modelo da sua impressora portátil.</li>
                <li>Clique em <strong>Testar Conexão</strong> para imprimir um talão de teste com o brasão da Matola.</li>
                <li>Na tela de emissão ou histórico, clique em <strong>Imprimir Auto / Factura</strong> para entregar o talão ao infrator.</li>
              </ol>
            </section>

            {/* CAPÍTULO 9: HISTÓRICO */}
            <section id="historico" className="space-y-4 scroll-mt-6">
              <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-400 flex items-center justify-center font-bold text-sm">
                  09
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Histórico, Pesquisa Avançada e 2ª Via
                </h2>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                No módulo <strong>Histórico</strong>, o operador pode filtrar autuações por:
              </p>

              <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                <li className="p-2 rounded bg-muted/20 border border-border text-center font-medium">Nº do Auto / Multa</li>
                <li className="p-2 rounded bg-muted/20 border border-border text-center font-medium">Matrícula da Viatura</li>
                <li className="p-2 rounded bg-muted/20 border border-border text-center font-medium">Nome do Infrator</li>
                <li className="p-2 rounded bg-muted/20 border border-border text-center font-medium">Estado (Pendente / Paga)</li>
              </ul>
            </section>

            {/* CAPÍTULO 10: TRIBUNAL & PRAZOS */}
            <section id="tribunal" className="space-y-4 scroll-mt-6">
              <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400 flex items-center justify-center font-bold text-sm">
                  10
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Prazos Legais e Encaminhamento ao Tribunal
                </h2>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                Conforme o Código da Estrada e as Posturas Municipais, o infrator dispõe de <strong className="text-foreground">15 dias úteis</strong> para liquidar a coima voluntariamente. Findo este prazo:
              </p>

              <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-200 dark:border-red-900/50 text-xs text-red-900 dark:text-red-200 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <Gavel className="h-4 w-4 text-red-600" /> Tramitação Judicial Coerciva:
                </p>
                <p>
                  O processo passa automaticamente para o estado <strong>FORA DE PRAZO</strong> e é listado no módulo do Tribunal para remessa ao Tribunal Judicial da Província de Maputo (Secção de Polícia e Trânsito) com emissão de guia oficial de transgressão.
                </p>
              </div>
            </section>

            {/* CAPÍTULO 11: RECLAMAÇÕES */}
            <section id="reclamacoes" className="space-y-4 scroll-mt-6">
              <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 flex items-center justify-center font-bold text-sm">
                  11
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Contestações e Reclamações de Munícipes
                </h2>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                O munícipe tem o direito legal de apresentar defesa escrita contra o auto lavrado. O módulo <strong>Reclamações</strong> regista a contestação, suspende temporariamente a contagem de prazos e submete o processo ao Comandante da Polícia Municipal para despacho fundamentado (Deferido / Indeferido).
              </p>
            </section>

            {/* CAPÍTULO 12: AGENTES ONLINE */}
            <section id="agentes" className="space-y-4 scroll-mt-6">
              <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 flex items-center justify-center font-bold text-sm">
                  12
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Monitorização de Agentes em Tempo Real
                </h2>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                O módulo <strong>Agentes Online &amp; Mapa</strong> permite ao comando operacional visualizar a localização em tempo real das brigadas de fiscalização, o histórico de presença e o número de multas emitidas no turno em curso.
              </p>
            </section>

            {/* CAPÍTULO 13: BACKUP E AUDITORIA */}
            <section id="backup-auditoria" className="space-y-4 scroll-mt-6">
              <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
                <div className="w-8 h-8 rounded-lg bg-slate-500/10 text-slate-700 dark:text-slate-400 flex items-center justify-center font-bold text-sm">
                  13
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Cópias de Segurança (Backup) e Registo de Auditoria
                </h2>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                A integridade dos dados municipais é salvaguardada por mecanismos automatizados de segurança:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <Card className="p-3.5 bg-card border-border space-y-1">
                  <p className="font-bold text-foreground flex items-center gap-1.5">
                    <Database className="h-4 w-4 text-primary" /> Exportação de Backup JSON / Excel
                  </p>
                  <p className="text-muted-foreground">Permite descarregar cópias completas de todas as tabelas (agentes, multas, logs, recibos) para arquivo histórico.</p>
                </Card>
                <Card className="p-3.5 bg-card border-border space-y-1">
                  <p className="font-bold text-foreground flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-primary" /> Trilha Imutável de Auditoria
                  </p>
                  <p className="text-muted-foreground">Registo timestamped de cada login, criação de auto, edição de dados e aprovação de cancelamento pelo Presidente.</p>
                </Card>
              </div>
            </section>

            {/* MANUAL FOOTER WITH SIDEOUT STUDIOS BRANDING */}
            <div className="pt-10 pb-4 border-t-2 border-primary/20 text-center space-y-4">
              <div className="flex justify-center">
                <img
                  src={logoMatola}
                  alt="Brasão Matola"
                  className="h-12 w-auto object-contain opacity-80"
                />
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">
                  Conselho Municipal da Cidade da Matola
                </h3>
                <p className="text-xs text-muted-foreground">
                  Sistema Integrado de Gestão e Emissão de Multas Municipais — SIGEMM v1.0
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/20 max-w-lg mx-auto space-y-1">
                <p className="text-xs font-bold text-foreground tracking-wide">
                  Desenvolvido pela{' '}
                  <a
                    href="https://www.facebook.com/sideoutstudios"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
                  >
                    Sideout Studios
                  </a>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Servicos audiovisuais e Desenvolvimento de Sistemas Informaticos &bull; Moçambique © 2026
                </p>
                <p className="text-[10px] text-muted-foreground/80 font-mono">
                  Suporte Técnico: sideoutgroup@gmail.com
                </p>
              </div>

              <p className="text-[10px] text-muted-foreground">
                Documento de consulta interna e formação operacional. Todos os direitos reservados.
              </p>
            </div>

          </div>
        </ScrollArea>

        {/* BOTTOM ACTION BAR */}
        <div className="p-3 border-t border-border bg-card flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => scrollToSection('intro')}
              className="gap-1.5 text-xs h-8"
            >
              <ArrowUp className="h-3.5 w-3.5" />
              Voltar ao Topo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={isPrinting}
              className="gap-1.5 text-xs h-8"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </Button>
          </div>

          <Button
            onClick={() => onOpenChange(false)}
            className="text-xs h-8 px-5 font-semibold"
          >
            Fechar Manual
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}

