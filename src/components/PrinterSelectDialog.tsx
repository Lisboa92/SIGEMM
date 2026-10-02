import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Printer, 
  Download, 
  Share2, 
  Bluetooth, 
  Usb, 
  Wifi, 
  Monitor, 
  Loader2, 
  CheckCircle2, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  FileText,
  Receipt,
  FileSpreadsheet,
  AlertCircle,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  type DocumentData, 
  downloadAutoEAviso, 
  downloadDocument,
  generateAutoEAviso,
  generatePDF,
  printAutoEAviso
} from '@/lib/documentGenerator';
import {
  executePrintHtml,
  executePrintPdf,
  buildAutoEAvisoHtml,
  buildReceiptOrInvoiceHtml,
  buildThermalReceiptHtml,
  buildReportHtml,
  type ReportPrintData,
  type DocumentPrintMode,
} from '@/lib/printService';
import {
  connectBluetooth,
  connectUSB,
  connectNetwork,
  printReceipt,
  isPrinterConnected,
  getConnectionType,
  type ConnectionType,
} from '@/lib/printer';

export interface PrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document?: DocumentData;
  reportData?: ReportPrintData;
  initialMode?: DocumentPrintMode;
  title?: string;
}

export default function PrinterSelectDialog({
  open,
  onOpenChange,
  document,
  reportData,
  initialMode,
  title,
}: PrintDialogProps) {
  const { t, lang } = useLanguage();
  const [mode, setMode] = useState<DocumentPrintMode>(
    initialMode || (reportData ? 'report' : document?.tipo === 'recibo' ? 'recibo' : 'auto-e-aviso')
  );
  const [destination, setDestination] = useState<'system' | 'bluetooth' | 'usb' | 'wifi'>('system');
  const [zoom, setZoom] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [preparingPreview, setPreparingPreview] = useState<boolean>(true);

  // Load HTML preview for the selected mode
  const loadPreview = useCallback(async (selectedMode: DocumentPrintMode) => {
    setPreparingPreview(true);
    try {
      let html = '';
      if (selectedMode === 'report' && reportData) {
        html = await buildReportHtml(reportData);
      } else if (document) {
        if (selectedMode === 'auto-e-aviso' || selectedMode === 'auto' || selectedMode === 'aviso') {
          html = await buildAutoEAvisoHtml(document);
        } else if (selectedMode === 'termico') {
          html = await buildThermalReceiptHtml(document, 80);
        } else {
          // recibo or factura
          html = await buildReceiptOrInvoiceHtml({
            ...document,
            tipo: selectedMode === 'factura' ? 'factura' : 'recibo',
          });
        }
      }
      setPreviewHtml(html);
    } catch (e) {
      console.error('Error generating preview:', e);
    } finally {
      setPreparingPreview(false);
    }
  }, [document, reportData]);

  // Sync mode when dialog opens
  useEffect(() => {
    if (open) {
      const defaultMode = initialMode || (reportData ? 'report' : document?.tipo === 'recibo' ? 'recibo' : 'auto-e-aviso');
      setMode(defaultMode);
      setZoom(100);
      setDestination('system');
      loadPreview(defaultMode);
    }
  }, [open, document, reportData, initialMode, loadPreview]);

  const handleModeChange = (newMode: string) => {
    const m = newMode as DocumentPrintMode;
    setMode(m);
    loadPreview(m);
  };

  // Opens document in full browser tab with native Edge/Chrome print preview (matches screenshot)
  const handleOpenFullTab = async () => {
    setLoading(true);
    try {
      if (document && (mode === 'auto-e-aviso' || mode === 'auto' || mode === 'aviso')) {
        const blob = await generateAutoEAviso(document, { autoPrint: true });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        toast.success(lang === 'en' ? 'Opened in new tab with print preview' : 'Aberto em novo separador com diálogo de impressão');
      } else if (document) {
        const blob = await generatePDF(document);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        toast.success(lang === 'en' ? 'Opened in new tab' : 'Aberto em novo separador');
      } else if (reportData) {
        const html = await buildReportHtml(reportData);
        const win = window.open('', '_blank');
        if (win) {
          win.document.open();
          win.document.write(html);
          win.document.close();
          setTimeout(() => { try { win.focus(); win.print(); } catch {} }, 300);
        }
      }
    } catch (e: any) {
      toast.error('Erro ao abrir separador: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  // Primary Print Action: Triggers system print dialog with full printer detection
  const handlePrint = async () => {
    setLoading(true);
    try {
      if (destination === 'bluetooth' && document) {
        // Bluetooth Thermal Driver
        toast.info(lang === 'en' ? 'Connecting to Bluetooth thermal printer...' : 'A conectar à impressora térmica Bluetooth...');
        const connected = await connectBluetooth();
        if (connected) {
          const ok = await printReceipt({
            numero: document.numero,
            data: document.data,
            hora: document.hora,
            agente: document.agente,
            infrator: document.infrator,
            documentoId: document.documentoId,
            matricula: document.matricula,
            infracao: document.infracao,
            local: document.local,
            valor: document.valor,
            localPagamento: document.localPagamento,
          });
          if (ok) {
            toast.success(lang === 'en' ? 'Receipt printed successfully!' : 'Talão impresso com sucesso!');
            onOpenChange(false);
            return;
          }
        }
        toast.warning(lang === 'en' ? 'Bluetooth unavailable. Switching to system print dialog...' : 'Bluetooth indisponível. Abrindo diálogo do sistema...');
      }

      // Default System Printer Print: Use PDF vector output for Auto+Aviso or HTML
      toast.info(lang === 'en' ? 'Opening system print dialog...' : 'A abrir diálogo de impressão do sistema...');
      
      let printed = false;

      if (document && (mode === 'auto-e-aviso' || mode === 'auto' || mode === 'aviso')) {
        // Vector PDF with autoPrint - exact match for Microsoft Edge / Chrome native print dialog
        const blob = await generateAutoEAviso(document, { autoPrint: true });
        printed = await executePrintPdf(blob, `auto-noticia-e-aviso-${document.numeroAuto || document.numero}.pdf`);
      } else if (document && mode === 'termico') {
        const html = await buildThermalReceiptHtml(document, 80);
        printed = await executePrintHtml(html, `SIGEMM_Recibo_${document.numero}`);
      } else if (document) {
        const blob = await generatePDF(document);
        printed = await executePrintPdf(blob, `documento-${document.numero}.pdf`);
      } else if (reportData) {
        const html = await buildReportHtml(reportData);
        printed = await executePrintHtml(html, `SIGEMM_Relatorio`);
      }

      if (printed) {
        toast.success(
          lang === 'en' 
            ? 'Print dialog ready — all detected printers are listed in the dropdown' 
            : 'Diálogo de impressão aberto — todas as impressoras detectadas estão listadas'
        );
        onOpenChange(false);
      } else {
        toast.info(
          lang === 'en' 
            ? 'Use "Open in Full Tab" or allow pop-ups for direct printing.' 
            : 'Se a janela não abriu, clique em "Abrir no Navegador" ou permita pop-ups.'
        );
      }
    } catch (err: any) {
      console.error('Print trigger error:', err);
      toast.error(lang === 'en' ? 'Print error: ' + (err?.message || err) : 'Erro na impressão: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!document) {
      if (reportData) {
        toast.info(lang === 'en' ? 'Use print dialog to Save as PDF' : 'Utilize a opção "Guardar como PDF" no diálogo de impressão');
        handlePrint();
      }
      return;
    }
    setLoading(true);
    try {
      if (mode === 'auto-e-aviso' || mode === 'auto' || mode === 'aviso') {
        await downloadAutoEAviso(document);
      } else {
        await downloadDocument({
          ...document,
          tipo: mode === 'factura' ? 'factura' : 'recibo',
        });
      }
      toast.success(lang === 'en' ? 'PDF downloaded successfully' : 'PDF descarregado com sucesso');
    } catch (e) {
      toast.error(lang === 'en' ? 'Failed to download PDF' : 'Falha ao descarregar PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!document) return;
    try {
      const blob = await (mode === 'auto-e-aviso' ? generateAutoEAviso(document) : generatePDF(document));
      const file = new File([blob], `${document.tipo}_${document.numero}.pdf`, { type: 'application/pdf' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `SIGEMM - ${document.numero}`,
          text: `Documento oficial da Polícia Municipal da Matola: ${document.numero}`,
          files: [file],
        });
        toast.success('Partilhado com sucesso!');
      } else {
        await handleDownloadPdf();
      }
    } catch {
      toast.info('Partilha cancelada ou não suportada');
    }
  };

  const docTitle = title || (
    reportData 
      ? reportData.titulo 
      : document 
      ? `${document.tipo === 'recibo' ? 'Recibo de Pagamento' : 'Auto de Notícia + Aviso'} · Nº ${document.numero}`
      : 'Diálogo de Impressão'
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[96vw] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl border shadow-2xl">
        
        {/* HEADER */}
        <DialogHeader className="p-4 px-6 border-b bg-card/60 backdrop-blur-sm flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                {docTitle}
                {document && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    {document.numero}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {lang === 'en' 
                  ? 'Inspect document preview, select format/printer, and click Print.' 
                  : 'Verifique a pré-visualização, escolha o formato e clique em Imprimir.'}
              </DialogDescription>
            </div>
          </div>

          {/* ZOOM & OPEN IN TAB CONTROLS */}
          <div className="hidden sm:flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium"
              onClick={handleOpenFullTab}
              disabled={loading}
              title="Abrir directamente no navegador (Edge / Chrome) para pré-visualização completa"
            >
              <ExternalLink className="h-3.5 w-3.5 text-primary" />
              <span>Abrir no Navegador</span>
            </Button>

            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setZoom((z) => Math.max(50, z - 15))}
                title="Diminuir Zoom"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] font-mono w-10 text-center font-medium">{zoom}%</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setZoom((z) => Math.min(150, z + 15))}
                title="Aumentar Zoom"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setZoom(100)}
                title="Ajustar 100%"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* FORMAT SELECTION TABS */}
        {!reportData && document && (
          <div className="px-6 py-2 border-b bg-muted/20 flex items-center justify-between gap-2 overflow-x-auto">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              {lang === 'en' ? 'Format / Model:' : 'Modelo de Impressão:'}
            </span>
            <Tabs value={mode} onValueChange={handleModeChange} className="w-auto">
              <TabsList className="h-8 bg-muted/80 p-0.5">
                <TabsTrigger value="auto-e-aviso" className="text-xs px-3 h-7 gap-1.5 data-[state=active]:bg-background">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  Auto + Aviso (A4)
                </TabsTrigger>
                <TabsTrigger value="recibo" className="text-xs px-3 h-7 gap-1.5 data-[state=active]:bg-background">
                  <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                  Recibo Oficial
                </TabsTrigger>
                <TabsTrigger value="factura" className="text-xs px-3 h-7 gap-1.5 data-[state=active]:bg-background">
                  <FileText className="w-3.5 h-3.5 text-amber-600" />
                  Factura de Multa
                </TabsTrigger>
                <TabsTrigger value="termico" className="text-xs px-3 h-7 gap-1.5 data-[state=active]:bg-background">
                  <Printer className="w-3.5 h-3.5 text-indigo-600" />
                  Talão Térmico (80mm)
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* BODY: PREVIEW CONTAINER & SETTINGS */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 min-h-[380px] max-h-[56vh] overflow-hidden bg-neutral-900/5 dark:bg-neutral-950/40">
          
          {/* PREVIEW CANVAS */}
          <div className="lg:col-span-3 overflow-auto p-4 flex justify-center items-start bg-neutral-200/50 dark:bg-neutral-900/80 border-r">
            {preparingPreview ? (
              <div className="flex flex-col items-center justify-center h-72 gap-3 text-muted-foreground">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <span className="text-xs font-medium">A compor pré-visualização em alta resolução...</span>
              </div>
            ) : (
              <div 
                className="transition-transform duration-150 origin-top shadow-xl bg-white text-neutral-900 rounded-sm overflow-hidden"
                style={{
                  transform: `scale(${zoom / 100})`,
                  width: mode === 'termico' ? '320px' : '650px',
                  minHeight: mode === 'termico' ? '450px' : '900px',
                }}
              >
                <iframe
                  title="Document Preview"
                  srcDoc={previewHtml}
                  className="w-full border-0 pointer-events-none"
                  style={{
                    height: mode === 'termico' ? '540px' : '920px',
                    backgroundColor: '#ffffff',
                  }}
                />
              </div>
            )}
          </div>

          {/* SIDEBAR: PRINTER OPTIONS */}
          <div className="p-4 space-y-4 overflow-y-auto bg-card">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                {lang === 'en' ? 'Print Destination' : 'Destino da Impressão'}
              </h4>
              <div className="space-y-2">
                
                {/* SYSTEM PRINTER */}
                <button
                  type="button"
                  onClick={() => setDestination('system')}
                  className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-2.5 ${
                    destination === 'system'
                      ? 'border-primary bg-primary/10 ring-1 ring-primary text-foreground'
                      : 'border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Monitor className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">
                      {lang === 'en' ? 'System Printer / PDF' : 'Impressora do Sistema / PDF'}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      {lang === 'en' 
                        ? 'Opens native browser dialog with all office printers.' 
                        : 'Abre o diálogo nativo com todas as impressoras (A4, laser, PDF).'}
                    </p>
                  </div>
                </button>

                {/* BLUETOOTH THERMAL */}
                {document && (
                  <button
                    type="button"
                    onClick={() => {
                      setDestination('bluetooth');
                      if (mode !== 'termico') setMode('termico');
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-2.5 ${
                      destination === 'bluetooth'
                        ? 'border-primary bg-primary/10 ring-1 ring-primary text-foreground'
                        : 'border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Bluetooth className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-foreground">Impressora Bluetooth</p>
                        {getConnectionType() === 'bluetooth' && (
                          <Badge variant="outline" className="text-[9px] h-4 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            Conectada
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                        Impressora térmica portátil de bolso (ESC/POS).
                      </p>
                    </div>
                  </button>
                )}

                {/* USB PRINTER */}
                {document && (
                  <button
                    type="button"
                    onClick={() => {
                      setDestination('usb');
                      if (mode !== 'termico') setMode('termico');
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-2.5 ${
                      destination === 'usb'
                        ? 'border-primary bg-primary/10 ring-1 ring-primary text-foreground'
                        : 'border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Usb className="w-4 h-4 mt-0.5 text-purple-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground">Impressora USB</p>
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                        Cabo USB directo na impressora de talões.
                      </p>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* PRINTER DETECTION INFO */}
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-[11px] space-y-1.5 text-foreground">
              <div className="flex items-center gap-1.5 font-bold text-primary">
                <Sparkles className="w-3.5 h-3.5" />
                Detecção Automática
              </div>
              <p className="text-muted-foreground text-[10.5px] leading-relaxed">
                Ao clicar em <strong>Imprimir</strong>, o seu navegador (Edge/Chrome) detecta e lista de imediato todas as impressoras do computador (Laser, Térmicas, PDF e Rede).
              </p>
            </div>

            {/* QUICK INFO */}
            <div className="p-3 bg-muted/50 rounded-lg border text-[11px] space-y-1.5 text-muted-foreground">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Garantia de Qualidade
              </div>
              <p className="text-[10.5px]">
                O documento inclui brasão oficial, carimbo digital, assinaturas e código QR de validação autenticada.
              </p>
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 px-6 border-t bg-card/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {document && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPdf}
                  disabled={loading}
                  className="gap-1.5 text-xs h-9 flex-1 sm:flex-initial"
                >
                  <Download className="w-3.5 h-3.5" />
                  {lang === 'en' ? 'Download PDF' : 'Baixar PDF'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  disabled={loading}
                  className="gap-1.5 text-xs h-9 flex-1 sm:flex-initial"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  {lang === 'en' ? 'Share' : 'Partilhar'}
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="text-xs h-9 flex-1 sm:flex-initial"
            >
              {lang === 'en' ? 'Close' : 'Fechar'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenFullTab}
              disabled={loading}
              className="gap-1.5 text-xs h-9 sm:hidden flex-1"
            >
              <ExternalLink className="w-3.5 h-3.5 text-primary" />
              <span>Navegador</span>
            </Button>
            
            {/* PRIMARY PRINT TRIGGER BUTTON */}
            <Button
              size="sm"
              onClick={handlePrint}
              disabled={loading}
              className="gap-2 text-xs font-bold h-9 px-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md flex-1 sm:flex-initial"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === 'en' ? 'Processing...' : 'A processar...'}</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>{lang === 'en' ? 'Print Document' : 'Imprimir Documento'}</span>
                </>
              )}
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
