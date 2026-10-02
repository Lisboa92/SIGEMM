import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Gavel, Search, Send, Loader2, Calendar, FileText, AlertTriangle, Printer } from 'lucide-react';
import { toast } from 'sonner';
import PrinterSelectDialog from '@/components/PrinterSelectDialog';
import { type ReportPrintData } from '@/lib/printService';

export default function TribunalPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [multas, setMultas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'fora_prazo' | 'enviada_tribunal'>('fora_prazo');
  const [selected, setSelected] = useState<any | null>(null);
  const [tribunalNome, setTribunalNome] = useState('');
  const [sending, setSending] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [reportData, setReportData] = useState<ReportPrintData | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('multas').select('*').eq('status', filter).order('created_at', { ascending: false });
    setMultas(data ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    (async () => {
      await supabase.rpc('marcar_multas_fora_prazo' as any);
      load();
    })();
  }, [load]);

  // Direct navigation from notifications (?multa=<id> or ?id=<id> or ?numero=<num>)
  useEffect(() => {
    const multaParam = searchParams.get('multa') || searchParams.get('id') || searchParams.get('numero');
    if (!multaParam) return;
    (async () => {
      let data: any = null;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(multaParam);
      
      if (isUuid) {
        const res = await supabase.from('multas').select('*').eq('id', multaParam).maybeSingle();
        data = res.data;
      }
      
      if (!data) {
        const res = await supabase
          .from('multas')
          .select('*')
          .or(`numero.eq.${multaParam},numero_auto.eq.${multaParam}`)
          .maybeSingle();
        data = res.data;
      }

      if (!data) {
        const res = await supabase
          .from('multas')
          .select('*')
          .or(`numero.ilike.%${multaParam}%,numero_auto.ilike.%${multaParam}%,infrator_nome.ilike.%${multaParam}%`)
          .limit(1)
          .maybeSingle();
        data = res.data;
      }

      if (data) {
        if (data.status === 'enviada_tribunal') {
          setFilter('enviada_tribunal');
        } else {
          setFilter('fora_prazo');
        }
        setSelected(data);
        if (data.tribunal_nome) setTribunalNome(data.tribunal_nome);
      }
      searchParams.delete('multa');
      setSearchParams(searchParams, { replace: true });
    })();
  }, [searchParams, setSearchParams]);

  const filtered = multas.filter(m =>
    m.numero?.toLowerCase().includes(search.toLowerCase()) ||
    m.infrator_nome?.toLowerCase().includes(search.toLowerCase()) ||
    m.infracao_tipo?.toLowerCase().includes(search.toLowerCase()) ||
    m.numero_auto?.toLowerCase().includes(search.toLowerCase()) ||
    m.tribunal_nome?.toLowerCase().includes(search.toLowerCase())
  );

  async function enviarTribunal() {
    if (!selected) return;
    if (!tribunalNome.trim()) { toast.error('Introduza o nome do Tribunal'); return; }
    setSending(true);
    const { error } = await supabase.from('multas').update({
      status: 'enviada_tribunal',
      tribunal_nome: tribunalNome.trim(),
    } as any).eq('id', selected.id);
    if (error) { toast.error('Erro: ' + error.message); setSending(false); return; }
    await supabase.from('audit_log').insert({
      action: 'ENVIAR_TRIBUNAL', resource_id: selected.id, user_id: user?.id,
      details: `Multa ${selected.numero} (Auto ${selected.numero_auto || '—'}) encaminhada ao ${tribunalNome.trim()}`,
    });
    toast.success('Multa encaminhada ao tribunal');
    setSelected(null); setTribunalNome(''); setSending(false); load();
  }

  const handlePrintGuia = () => {
    const isEnviadas = filter === 'enviada_tribunal';
    const totalValor = filtered.reduce((sum, m) => sum + Number(m.valor || 0), 0);
    const data: ReportPrintData = {
      titulo: isEnviadas ? 'Guia de Remessa de Autos ao Tribunal' : 'Relação de Multas Fora do Prazo Legal',
      subtitulo: 'Conselho Municipal da Cidade da Matola · Comando da Polícia Municipal',
      periodo: new Date().toLocaleDateString('pt-MZ'),
      geradoPor: user?.email || 'Comando Geral',
      resumo: [
        { label: 'Total de Processos', valor: filtered.length },
        { label: 'Valor Global', valor: `${totalValor.toFixed(2)} MT` },
        { label: 'Categoria', valor: isEnviadas ? 'Enviadas ao Tribunal' : 'Fora do Prazo' },
      ],
      colunas: ['Nº Auto / Multa', 'Infractor', 'Infracção', 'Local / Bairro', 'Valor (MT)', 'Data Autuação', 'Tribunal'],
      linhas: filtered.map(m => [
        m.numero_auto || m.numero,
        m.infrator_nome,
        m.infracao_tipo,
        m.local,
        Number(m.valor).toFixed(2),
        new Date(m.created_at).toLocaleDateString('pt-MZ'),
        m.tribunal_nome || 'A definir',
      ]),
    };
    setReportData(data);
    setPrintOpen(true);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="p-4 border-l-4 border-l-purple-500 bg-purple-50/40 dark:bg-purple-950/20">
        <div className="flex items-center gap-3">
          <Gavel className="h-6 w-6 text-purple-600" />
          <div>
            <h2 className="font-bold text-foreground">Encaminhamento ao Tribunal</h2>
            <p className="text-xs text-muted-foreground">Multas pendentes que ultrapassaram o prazo de 15 dias e devem ser remetidas ao tribunal competente.</p>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button variant={filter === 'fora_prazo' ? 'default' : 'outline'} onClick={() => setFilter('fora_prazo')} className="gap-2">
            <AlertTriangle className="h-4 w-4" /> Fora do Prazo
          </Button>
          <Button variant={filter === 'enviada_tribunal' ? 'default' : 'outline'} onClick={() => setFilter('enviada_tribunal')} className="gap-2">
            <Gavel className="h-4 w-4" /> Enviadas ao Tribunal
          </Button>
        </div>

        <Button variant="outline" onClick={handlePrintGuia} className="gap-2">
          <Printer className="h-4 w-4" /> Imprimir Lista / Guia
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pesquisar por infrator, nº auto, tribunal..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} {filter === 'fora_prazo' ? 'multa(s) fora do prazo' : 'multa(s) enviada(s) ao tribunal'}</p>

      <div className="space-y-2">
        {loading ? (
          <Card className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></Card>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Nenhuma multa nesta categoria.
          </Card>
        ) : (
          filtered.map(m => (
            <Card key={m.id} className="p-3.5 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">{m.numero}</span>
                    {m.numero_auto && (
                      <Badge variant="outline" className="text-[10px]">Auto {m.numero_auto}</Badge>
                    )}
                    {m.status === 'enviada_tribunal' && (
                      <Badge variant="default" className="text-[10px] bg-purple-600">{m.tribunal_nome || 'Tribunal'}</Badge>
                    )}
                  </div>
                  <p className="font-semibold text-sm text-foreground mt-0.5">{m.infrator_nome}</p>
                </div>
                {filter === 'fora_prazo' && (
                  <Button size="sm" onClick={() => { setSelected(m); setTribunalNome(m.tribunal_nome || ''); }} className="gap-1.5 bg-purple-600 hover:bg-purple-700">
                    <Gavel className="h-3.5 w-3.5" /> Encaminhar
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{m.infracao_tipo}</span>
                <span className="font-bold text-foreground">{Number(m.valor).toFixed(2)} MT</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(m.created_at).toLocaleDateString('pt-MZ')}</span>
                {filter === 'fora_prazo' && (
                  <span className="text-orange-600 font-semibold">{Math.floor((Date.now() - new Date(m.created_at).getTime()) / 86400000)} dias</span>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Gavel className="h-5 w-5 text-purple-600" /> Enviar ao Tribunal</DialogTitle>
            <DialogDescription>{selected?.numero} · Auto Nº {selected?.numero_auto || '—'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Card className="p-3 bg-muted/40">
              <p className="text-sm font-semibold">{selected?.infrator_nome}</p>
              <p className="text-xs text-muted-foreground">{selected?.infracao_tipo}</p>
              <p className="text-sm font-bold mt-1">{selected && Number(selected.valor).toFixed(2)} MT</p>
            </Card>
            <div className="space-y-2">
              <Label>Nome do Tribunal *</Label>
              <Input value={tribunalNome} onChange={(e) => setTribunalNome(e.target.value)} placeholder="Ex: Tribunal Judicial do Distrito da Matola" />
              <p className="text-[10px] text-muted-foreground">Não é necessário indicar o número do processo.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button onClick={enviarTribunal} disabled={sending} className="gap-2 bg-purple-600 hover:bg-purple-700">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Encaminhar ao Tribunal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrinterSelectDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        reportData={reportData}
        initialMode="report"
      />
    </div>
  );
}
