import { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';

function getColunas(lang: string) {
  return [
    { key: 'numero', label: lang === 'en' ? 'Fine No.' : 'Nº Multa' },
    { key: 'numero_auto', label: lang === 'en' ? 'Ticket No.' : 'Nº Auto' },
    { key: 'created_at', label: lang === 'en' ? 'Date' : 'Data' },
    { key: 'infrator_nome', label: lang === 'en' ? 'Offender' : 'Infractor' },
    { key: 'infrator_documento', label: lang === 'en' ? 'ID No.' : 'BI nº' },
    { key: 'matricula', label: lang === 'en' ? 'Plate / Door No.' : 'Matrícula / Nº Porta' },
    { key: 'categoria', label: lang === 'en' ? 'Category' : 'Categoria' },
    { key: 'infracao_tipo', label: lang === 'en' ? 'Infraction' : 'Infracção' },
    { key: 'local', label: lang === 'en' ? 'Location' : 'Local' },
    { key: 'valor', label: lang === 'en' ? 'Amount (MZN)' : 'Valor (MT)' },
    { key: 'status', label: lang === 'en' ? 'Status' : 'Estado' },
    { key: 'forma_pagamento', label: lang === 'en' ? 'Payment Method' : 'Forma de Pagamento' },
    { key: 'local_pagamento', label: lang === 'en' ? 'Payment Place' : 'Local de Pagamento' },
    { key: 'tribunal_nome', label: lang === 'en' ? 'Court' : 'Tribunal' },
    { key: 'agente_nome', label: lang === 'en' ? 'Officer' : 'Agente' },
    { key: 'agente_email', label: lang === 'en' ? 'Officer Email' : 'Email do Agente' },
  ];
}

function formatValue(key: string, value: any, lang: string) {
  if (value === null || value === undefined) return '';
  if (key === 'created_at') return new Date(value).toLocaleString(lang === 'en' ? 'en-US' : 'pt-MZ');
  if (key === 'valor') return Number(value).toFixed(2);
  if (key === 'status') return String(value).replace('_', ' ');
  return value;
}

export default function ExportMultasDialog() {
  const { t, lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('todos');
  const [categoria, setCategoria] = useState('todas');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [formato, setFormato] = useState<'xlsx' | 'csv'>('xlsx');
  const [exporting, setExporting] = useState(false);

  const colunas = getColunas(lang);

  async function handleExport() {
    setExporting(true);
    try {
      let query = supabase.from('multas').select('*').order('created_at', { ascending: false });
      if (status !== 'todos') query = query.eq('status', status);
      if (categoria !== 'todas') query = query.eq('categoria', categoria);
      if (dataInicio) query = query.gte('created_at', new Date(`${dataInicio}T00:00:00`).toISOString());
      if (dataFim) query = query.lte('created_at', new Date(`${dataFim}T23:59:59`).toISOString());

      const { data, error } = await query;
      if (error) { toast.error((lang === 'en' ? 'Export error: ' : 'Erro ao exportar: ') + error.message); return; }
      if (!data || data.length === 0) {
        toast.error(lang === 'en' ? 'No fines found with these filters.' : 'Nenhuma multa encontrada com estes filtros.');
        return;
      }

      const rows = data.map((m: any) => {
        const row: Record<string, any> = {};
        colunas.forEach(c => { row[c.label] = formatValue(c.key, m[c.key], lang); });
        return row;
      });

      const total = data.reduce((s: number, m: any) => s + Number(m.valor || 0), 0);
      const sheet = XLSX.utils.json_to_sheet(rows);
      sheet['!cols'] = colunas.map(c => ({ wch: Math.max(12, c.label.length + 4) }));

      const stamp = new Date().toISOString().slice(0, 10);
      const nome = `SIGEMM_multas_${stamp}`;

      if (formato === 'csv') {
        const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ';' });
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${nome}.csv`; a.click();
        URL.revokeObjectURL(url);
      } else {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheet, lang === 'en' ? 'Fines' : 'Multas');
        const resumo = XLSX.utils.json_to_sheet([
          { [lang === 'en' ? 'Metric' : 'Indicador']: lang === 'en' ? 'Total fines' : 'Total de multas', [lang === 'en' ? 'Value' : 'Valor']: data.length },
          { [lang === 'en' ? 'Metric' : 'Indicador']: lang === 'en' ? 'Total amount (MZN)' : 'Valor total (MT)', [lang === 'en' ? 'Value' : 'Valor']: total.toFixed(2) },
          { [lang === 'en' ? 'Metric' : 'Indicador']: lang === 'en' ? 'Status' : 'Estado', [lang === 'en' ? 'Value' : 'Valor']: status === 'todos' ? (lang === 'en' ? 'All' : 'Todos') : status.replace('_', ' ') },
          { [lang === 'en' ? 'Metric' : 'Indicador']: lang === 'en' ? 'Category' : 'Categoria', [lang === 'en' ? 'Value' : 'Valor']: categoria === 'todas' ? (lang === 'en' ? 'All' : 'Todas') : categoria },
          { [lang === 'en' ? 'Metric' : 'Indicador']: lang === 'en' ? 'Period' : 'Período', [lang === 'en' ? 'Value' : 'Valor']: `${dataInicio || (lang === 'en' ? 'start' : 'início')} ${lang === 'en' ? 'to' : 'a'} ${dataFim || (lang === 'en' ? 'today' : 'hoje')}` },
          { [lang === 'en' ? 'Metric' : 'Indicador']: lang === 'en' ? 'Generated on' : 'Gerado em', [lang === 'en' ? 'Value' : 'Valor']: new Date().toLocaleString(lang === 'en' ? 'en-US' : 'pt-MZ') },
        ]);
        resumo['!cols'] = [{ wch: 22 }, { wch: 28 }];
        XLSX.utils.book_append_sheet(wb, resumo, lang === 'en' ? 'Summary' : 'Resumo');
        XLSX.writeFile(wb, `${nome}.xlsx`);
      }

      toast.success(`${data.length} ${lang === 'en' ? 'fine(s) exported' : 'multa(s) exportada(s)'} — ${total.toFixed(2)} MT`);
      setOpen(false);
    } catch {
      toast.error(lang === 'en' ? 'Unexpected export error' : 'Erro inesperado ao exportar');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="flex-shrink-0" title={lang === 'en' ? 'Export fines (Excel/CSV)' : 'Exportar multas (Excel/CSV)'}>
          <Download className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> {lang === 'en' ? 'Export Fines' : 'Exportar Multas'}
          </DialogTitle>
          <DialogDescription>{lang === 'en' ? 'Choose filters and report format.' : 'Escolha os filtros e o formato do relatório.'}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">{lang === 'en' ? 'Status' : 'Estado'}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{t('common.all')}</SelectItem>
                <SelectItem value="pendente">{t('status.pending')}</SelectItem>
                <SelectItem value="paga">{t('status.paid')}</SelectItem>
                <SelectItem value="cancelada">{t('status.cancelled')}</SelectItem>
                <SelectItem value="fora_prazo">{t('status.overdue')}</SelectItem>
                <SelectItem value="enviada_tribunal">{t('status.sentToCourt')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">{t('newFine.category')}</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">{t('common.all')}</SelectItem>
                <SelectItem value="movel">{t('newFine.categoryMobile')}</SelectItem>
                <SelectItem value="imovel">{t('newFine.categoryStationary')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{lang === 'en' ? 'From' : 'De'}</Label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{lang === 'en' ? 'To' : 'Até'}</Label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">{lang === 'en' ? 'Format' : 'Formato'}</Label>
            <Select value={formato} onValueChange={(v) => setFormato(v as 'xlsx' | 'csv')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">{lang === 'en' ? 'Excel (.xlsx) — with summary sheet' : 'Excel (.xlsx) — com folha de resumo'}</SelectItem>
                <SelectItem value="csv">CSV (.csv)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? t('common.loading') : (lang === 'en' ? 'Export' : 'Exportar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}