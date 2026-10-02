import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, Download, Share2, CreditCard, FileText } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Card } from '@/components/ui/card';
import {
  type DocumentData,
  downloadDocument,
  shareDocument,
  downloadAutoEAviso,
} from '@/lib/documentGenerator';
import { toast } from 'sonner';
import PrinterSelectDialog from '@/components/PrinterSelectDialog';
import { type DocumentPrintMode } from '@/lib/printService';

interface DocumentActionsProps {
  document: DocumentData;
  showPayButton?: boolean;
  onPay?: () => void;
  compact?: boolean;
}

export default function DocumentActions({ document, showPayButton, onPay, compact }: DocumentActionsProps) {
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [printerPickerOpen, setPrinterPickerOpen] = useState(false);
  const [printMode, setPrintMode] = useState<DocumentPrintMode>('auto-e-aviso');
  const [downloadingOficial, setDownloadingOficial] = useState(false);

  if (!document) return null;

  const handleDownloadOficial = async () => {
    setDownloadingOficial(true);
    try {
      await downloadAutoEAviso(document);
      toast.success('Auto de Notícia + Aviso de Multa baixado!');
    } catch {
      toast.error('Falha ao gerar o documento');
    }
    setDownloadingOficial(false);
  };

  const qrData = JSON.stringify({
    tipo: document.tipo || 'factura',
    numero: document.numero || '',
    valor: document.valor || 0,
    infrator: document.infrator || '',
    infracao: document.infracao || '',
    data: document.data || '',
    status: document.tipo === 'recibo' ? 'pago' : 'pendente',
  });

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadDocument(document);
      toast.success(`${document.tipo === 'recibo' ? 'Recibo' : 'Factura'} baixado!`);
    } catch {
      toast.error('Falha ao descarregar documento');
    }
    setDownloading(false);
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const ok = await shareDocument(document);
      if (ok) toast.success('Partilhado com sucesso!');
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        await downloadDocument(document);
        toast.success(`${document.tipo === 'recibo' ? 'Recibo' : 'Factura'} baixado!`);
      }
    }
    setSharing(false);
  };

  const handleOpenPrintDialog = (mode: DocumentPrintMode = 'auto-e-aviso') => {
    setPrintMode(mode);
    setPrinterPickerOpen(true);
  };

  const label = document.tipo === 'recibo' ? 'Recibo' : 'Factura';

  if (compact) {
    return (
      <>
        <div className="flex gap-2 flex-wrap">
          {showPayButton && onPay && (
            <Button size="sm" onClick={onPay} className="gap-1.5 flex-1">
              <CreditCard className="h-3.5 w-3.5" /> Pagar
            </Button>
          )}
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => handleOpenPrintDialog(document.tipo === 'recibo' ? 'recibo' : 'factura')} 
            className="gap-1.5 flex-1"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading} className="gap-1.5 flex-1">
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Baixar
          </Button>
          <Button size="sm" variant="outline" onClick={handleShare} disabled={sharing} className="gap-1.5 flex-1">
            {sharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
            Partilhar
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleOpenPrintDialog('auto-e-aviso')}
            className="gap-1.5 basis-full bg-gradient-to-r from-primary/15 to-secondary/15 hover:from-primary/25 hover:to-secondary/25 border border-primary/30 font-medium"
          >
            <FileText className="h-3.5 w-3.5" />
            Imprimir Auto de Notícia + Aviso de Multa
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadOficial} disabled={downloadingOficial} className="gap-1.5 basis-full">
            {downloadingOficial ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Baixar Auto de Notícia + Aviso de Multa
          </Button>
        </div>
        <PrinterSelectDialog 
          open={printerPickerOpen} 
          onOpenChange={setPrinterPickerOpen} 
          document={document} 
          initialMode={printMode}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* QR Code */}
        <Card className="p-4 bg-card flex flex-col items-center gap-2">
          <QRCodeSVG value={qrData} size={120} level="M" className="rounded" />
          <p className="text-[10px] text-muted-foreground">Escaneie o QR Code para ver os detalhes</p>
        </Card>

        <div className="flex flex-col gap-2">
          {showPayButton && onPay && (
            <Button onClick={onPay} className="w-full h-11 gap-2">
              <CreditCard className="h-4 w-4" /> Efectuar Pagamento
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={() => handleOpenPrintDialog(document.tipo === 'recibo' ? 'recibo' : 'factura')} 
            className="w-full gap-2"
          >
            <Printer className="h-4 w-4" />
            Imprimir {label}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleDownload} disabled={downloading} className="gap-2">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Baixar
            </Button>
            <Button variant="outline" onClick={handleShare} disabled={sharing} className="gap-2">
              {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              Partilhar
            </Button>
          </div>

          {/* Documento oficial — Auto de Notícia + Aviso de Multa na mesma folha */}
          <div className="pt-3 mt-1 border-t space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Documento Oficial (Polícia Municipal)
            </p>
            <Button
              variant="secondary"
              onClick={() => handleOpenPrintDialog('auto-e-aviso')}
              className="w-full gap-2 h-11 bg-gradient-to-r from-primary/20 to-secondary/20 hover:from-primary/30 hover:to-secondary/30 border border-primary/30 font-semibold"
            >
              <FileText className="h-4 w-4" />
              Imprimir Auto de Notícia + Aviso de Multa
            </Button>
            <Button variant="outline" onClick={handleDownloadOficial} disabled={downloadingOficial} className="w-full gap-2">
              {downloadingOficial ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Baixar Auto de Notícia + Aviso de Multa (PDF)
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              Ambos documentos numa única folha A4 com linha de corte e pré-visualização completa
            </p>
          </div>
        </div>
      </div>
      <PrinterSelectDialog 
        open={printerPickerOpen} 
        onOpenChange={setPrinterPickerOpen} 
        document={document} 
        initialMode={printMode}
      />
    </>
  );
}
