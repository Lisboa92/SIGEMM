import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { MessageSquareWarning, Plus, Search, Loader2, Ban, Send } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  em_analise: 'Em análise',
  deferida: 'Deferida',
  indeferida: 'Indeferida',
};

const STATUS_VARIANT: Record<string, string> = {
  pendente: 'bg-muted text-muted-foreground',
  em_analise: 'bg-primary/10 text-primary',
  deferida: 'bg-emerald-500/15 text-emerald-600',
  indeferida: 'bg-destructive/10 text-destructive',
};

const MOTIVOS = [
  'Multa aplicada indevidamente',
  'Dados do infrator incorrectos',
  'Matrícula/identificação errada',
  'Valor da multa incorrecto',
  'Infracção já regularizada',
  'Duplicação de multa',
  'Outro',
];

export default function ReclamacoesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [reclamacoes, setReclamacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Nova reclamação
  const [openNova, setOpenNova] = useState(false);
  const [saving, setSaving] = useState(false);
  const [multaNumero, setMultaNumero] = useState('');
  const [multaEncontrada, setMultaEncontrada] = useState<any | null>(null);
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [contacto, setContacto] = useState('');
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [descricao, setDescricao] = useState('');

  // Detalhe / resposta
  const [selected, setSelected] = useState<any | null>(null);
  const [resposta, setResposta] = useState('');
  const [novoStatus, setNovoStatus] = useState('em_analise');
  const [respondendo, setRespondendo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('reclamacoes').select('*').order('created_at', { ascending: false }).limit(100);
    if (statusFilter !== 'todos') q = q.eq('status', statusFilter);
    const { data } = await q;
    setReclamacoes(data ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Handle direct navigation via notification (?id=<id> or ?reclamacao=<id> or ?multa=<numero>)
  useEffect(() => {
    const reclamacaoId = searchParams.get('id') || searchParams.get('reclamacao');
    const multaParam = searchParams.get('multa') || searchParams.get('numero');
    if (!reclamacaoId && !multaParam) return;

    (async () => {
      let foundRec: any = null;
      if (reclamacaoId) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reclamacaoId);
        if (isUuid) {
          const { data } = await supabase.from('reclamacoes').select('*').eq('id', reclamacaoId).maybeSingle();
          foundRec = data;
        }
        if (!foundRec) {
          const { data: byNum } = await supabase
            .from('reclamacoes')
            .select('*')
            .or(`multa_numero.eq.${reclamacaoId},multa_id.eq.${reclamacaoId},nome.ilike.%${reclamacaoId}%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          foundRec = byNum;
        }
      } else if (multaParam) {
        const { data } = await supabase
          .from('reclamacoes')
          .select('*')
          .or(`multa_id.eq.${multaParam},multa_numero.ilike.%${multaParam}%,nome.ilike.%${multaParam}%`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        foundRec = data;
      }

      if (foundRec) {
        setSelected(foundRec);
        setNovoStatus(foundRec.status || 'em_analise');
        setResposta(foundRec.resposta || '');
      }

      searchParams.delete('id');
      searchParams.delete('reclamacao');
      searchParams.delete('multa');
      searchParams.delete('numero');
      setSearchParams(searchParams, { replace: true });
    })();
  }, [searchParams, setSearchParams]);

  async function procurarMulta(numero: string) {
    setMultaNumero(numero);
    setMultaEncontrada(null);
    if (numero.trim().length < 3) return;
    const { data } = await supabase
      .from('multas')
      .select('id, numero, infrator_nome, infrator_documento, valor, status')
      .ilike('numero', `%${numero.trim()}%`)
      .limit(1)
      .maybeSingle();
    if (data) {
      setMultaEncontrada(data);
      if (!nome) setNome(data.infrator_nome || '');
      if (!documento) setDocumento(data.infrator_documento || '');
    }
  }

  async function registar() {
    if (!nome.trim()) { toast.error('Indique o nome do reclamante'); return; }
    if (!descricao.trim()) { toast.error('Descreva a reclamação'); return; }
    setSaving(true);
    const { data: recData, error } = await supabase.from('reclamacoes').insert({
      multa_id: multaEncontrada?.id ?? null,
      multa_numero: multaEncontrada?.numero ?? (multaNumero.trim() || null),
      reclamante_nome: nome.trim(),
      reclamante_documento: documento.trim() || null,
      reclamante_contacto: contacto.trim() || null,
      motivo,
      descricao: descricao.trim(),
      criado_por: user?.id ?? null,
      criado_por_email: user?.email ?? null,
    } as any).select().single();
    setSaving(false);
    if (error) { toast.error('Erro ao registar reclamação: ' + error.message); return; }

    // Enviar notificação aos supervisores
    if (recData) {
      const { data: agentInfo } = await supabase.from('agentes').select('local_trabalho').eq('email', user?.email || '').maybeSingle();
      await supabase.from('notifications').insert({
        message: `Nova reclamação registada: ${nome.trim()} — ${motivo}${multaNumero.trim() ? ` (Multa: ${multaNumero.trim()})` : ''}`,
        action: 'RECLAMACAO',
        resource_id: recData.id,
        local_trabalho: agentInfo?.local_trabalho || 'via_publica',
        created_by: user?.id,
        target_role: 'supervisor',
      } as any);
    }

    toast.success('Reclamação registada com sucesso.');
    setOpenNova(false);
    setMultaNumero(''); setMultaEncontrada(null); setNome(''); setDocumento('');
    setContacto(''); setMotivo(MOTIVOS[0]); setDescricao('');
    load();
  }

  async function responder() {
    if (!selected) return;
    setRespondendo(true);
    const { error } = await supabase.from('reclamacoes').update({
      status: novoStatus,
      resposta: resposta.trim() || null,
      respondido_por_email: user?.email ?? null,
      respondido_em: new Date().toISOString(),
    } as any).eq('id', selected.id);
    setRespondendo(false);
    if (error) { toast.error('Erro ao actualizar: ' + error.message); return; }
    toast.success('Reclamação actualizada.');
    setSelected(null);
    load();
  }

  const filtered = reclamacoes.filter(r =>
    (r.reclamante_nome || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.multa_numero || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.motivo || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquareWarning className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Reclamações dos Infratores</h1>
            <p className="text-xs text-muted-foreground">
              Registo formal de reclamações que fundamentam pedidos de cancelamento de multas.
            </p>
          </div>
        </div>
        <Button onClick={() => setOpenNova(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Reclamação
        </Button>
      </div>

      <Card className="p-3 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Procurar por nome, nº da multa ou motivo..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os estados</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em_analise">Em análise</SelectItem>
            <SelectItem value="deferida">Deferida</SelectItem>
            <SelectItem value="indeferida">Indeferida</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nenhuma reclamação registada.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(r => (
            <Card
              key={r.id}
              className="p-4 space-y-2 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => { setSelected(r); setResposta(r.resposta || ''); setNovoStatus(r.status); }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{r.reclamante_nome}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_VARIANT[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
              {r.multa_numero && <Badge variant="outline" className="text-[10px]">Multa {r.multa_numero}</Badge>}
              <p className="text-xs font-medium text-primary">{r.motivo}</p>
              <p className="text-xs text-muted-foreground line-clamp-3">{r.descricao}</p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString('pt-MZ')}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Nova reclamação */}
      <Dialog open={openNova} onOpenChange={setOpenNova}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registar Reclamação</DialogTitle>
            <DialogDescription>Dados do infrator e fundamento da reclamação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nº da Multa (opcional)</Label>
              <Input value={multaNumero} onChange={(e) => procurarMulta(e.target.value)} placeholder="Ex.: MTL-2026-0001" />
              {multaEncontrada && (
                <p className="text-[11px] text-primary">
                  Multa encontrada: {multaEncontrada.numero} — {multaEncontrada.infrator_nome} ({multaEncontrada.status})
                </p>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nome do Reclamante *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">BI. nº</Label>
                <Input value={documento} onChange={(e) => setDocumento(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Contacto</Label>
              <Input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="+258 8x xxx xxxx" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Motivo *</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Descrição *</Label>
              <Textarea rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva os factos alegados pelo infrator..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNova(false)}>Cancelar</Button>
            <Button onClick={registar} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Registar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhe / resposta */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reclamação — {selected?.reclamante_nome}</DialogTitle>
            <DialogDescription>{selected?.motivo}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <p><span className="text-muted-foreground">Multa:</span> {selected.multa_numero || '—'}</p>
                <p><span className="text-muted-foreground">BI. nº:</span> {selected.reclamante_documento || '—'}</p>
                <p><span className="text-muted-foreground">Contacto:</span> {selected.reclamante_contacto || '—'}</p>
                <p><span className="text-muted-foreground">Registada em:</span> {new Date(selected.created_at).toLocaleString('pt-MZ')}</p>
              </div>
              <div className="rounded-md bg-muted/50 p-3 text-xs whitespace-pre-wrap">{selected.descricao}</div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Estado</Label>
                <Select value={novoStatus} onValueChange={setNovoStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_analise">Em análise</SelectItem>
                    <SelectItem value="deferida">Deferida</SelectItem>
                    <SelectItem value="indeferida">Indeferida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Resposta / Parecer</Label>
                <Textarea rows={3} value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder="Parecer do município sobre a reclamação..." />
              </div>

              {selected.multa_id && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => navigate(`/historico?multa=${selected.multa_id}`)}
                >
                  <Ban className="h-4 w-4" /> Abrir multa para pedir cancelamento
                </Button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>
            <Button onClick={responder} disabled={respondendo} className="gap-2">
              {respondendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
