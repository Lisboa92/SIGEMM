import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUserRole, canAccess } from '@/hooks/useUserRole';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Search, FileText, MapPin, Calendar, User, CreditCard, Ban, Eye, EyeOff, Loader2, Gavel, Send, CloudOff, RefreshCw } from 'lucide-react';
import DocumentActions from '@/components/DocumentActions';
import ExportMultasDialog from '@/components/ExportMultasDialog';
import { buildDocumentData } from '@/lib/documentGenerator';
import { getQueue, cacheGet, cacheSet } from '@/lib/offlineQueue';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { toast } from 'sonner';

export default function HistoricoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { nivelAcesso } = useUserRole();
  const { online, pending, syncing, sync } = useOfflineSync();
  // Pedido de cancelamento: agente de cobrança, supervisor ou administrador.
  // A aprovação final é sempre do Presidente do Município.
  const canCancel = nivelAcesso === 'agente_cobranca' || canAccess(nivelAcesso, 'supervisor');
  const [searchParams, setSearchParams] = useSearchParams();

  const [multas, setMultas] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [selectedMulta, setSelectedMulta] = useState<any | null>(null);
  const [agenteNome, setAgenteNome] = useState<string>('');

  // Enviar ao Tribunal
  const [tribunalOpen, setTribunalOpen] = useState(false);
  const [tribunalNome, setTribunalNome] = useState('');
  const [enviandoTribunal, setEnviandoTribunal] = useState(false);
  const canSendTribunal = canAccess(nivelAcesso, 'supervisor');

  // Cancel request state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelMultaId, setCancelMultaId] = useState<string | null>(null);
  const [myPassword, setMyPassword] = useState('');
  const [showMyPwd, setShowMyPwd] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  // Selecção do Presidente do Município que irá autorizar
  const [presidentes, setPresidentes] = useState<any[]>([]);
  const [presidenteQuery, setPresidenteQuery] = useState('');
  const [presidenteSel, setPresidenteSel] = useState<any | null>(null);
  const [motivoCancel, setMotivoCancel] = useState('');

  useEffect(() => {
    if (!cancelDialogOpen) return;
    supabase
      .from('agentes')
      .select('id, nome, email, activo, nivel_acesso')
      .in('nivel_acesso', ['superadmin', 'presidente'])
      .eq('activo', true)
      .then(({ data }) => setPresidentes(data ?? []));
  }, [cancelDialogOpen]);

  const presidenteSugestoes = presidenteQuery.trim().length === 0
    ? presidentes
    : presidentes.filter(p =>
        (p.nome || '').toLowerCase().includes(presidenteQuery.toLowerCase()) ||
        (p.email || '').toLowerCase().includes(presidenteQuery.toLowerCase())
      );

  const loadMultas = useCallback(async () => {
    setLoading(true);
    let queueItems: any[] = [];
    try {
      const rawQueue = getQueue();
      if (Array.isArray(rawQueue)) {
        queueItems = rawQueue.map(q => ({
          ...(q.payload || {}),
          id: q.id || `queue-${Math.random().toString(36).slice(2, 7)}`,
          status: 'offline_pendente',
          created_at: q.createdAt || (q.payload && q.payload.created_at) || new Date().toISOString(),
          isOfflineQueue: true,
        }));
      }
    } catch (e) {
      console.warn('[Historico] Erro ao carregar fila:', e);
    }

    try {
      if (navigator.onLine) {
        let query = supabase.from('multas').select('*').order('created_at', { ascending: false }).limit(50);
        if (statusFilter !== 'todos') query = query.eq('status', statusFilter);
        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          if (statusFilter === 'todos') {
            cacheSet('multas_list', data);
          }
          setMultas([...queueItems, ...data]);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('[Historico] Erro ao carregar multas online:', err);
    }

    const cached = cacheGet<any[]>('multas_list');
    const safeCached = Array.isArray(cached) ? cached : [];
    const filteredCached = statusFilter === 'todos' ? safeCached : safeCached.filter(m => m.status === statusFilter);
    setMultas([...queueItems, ...filteredCached]);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { loadMultas(); }, [loadMultas]);

  // Recarrega quando uma multa muda de estado noutro ponto da aplicação ou na fila offline
  useEffect(() => {
    const handler = () => loadMultas();
    window.addEventListener('multas-updated', handler);
    window.addEventListener('sigemm-queue-changed', handler);
    return () => {
      window.removeEventListener('multas-updated', handler);
      window.removeEventListener('sigemm-queue-changed', handler);
    };
  }, [loadMultas]);

  // Abre directamente a multa indicada pela pesquisa global ou notificação (?multa=<id> ou ?id=<id>)
  useEffect(() => {
    const multaId = searchParams.get('multa') || searchParams.get('id');
    if (!multaId) return;
    (async () => {
      let foundMulta: any = null;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(multaId);
      
      if (isUuid) {
        const { data } = await supabase.from('multas').select('*').eq('id', multaId).maybeSingle();
        foundMulta = data;
      }
      
      if (!foundMulta) {
        const { data: byNum } = await supabase
          .from('multas')
          .select('*')
          .or(`numero.eq.${multaId},numero_auto.eq.${multaId}`)
          .maybeSingle();
        foundMulta = byNum;
      }

      if (!foundMulta) {
        const { data: byLike } = await supabase
          .from('multas')
          .select('*')
          .or(`numero.ilike.%${multaId}%,numero_auto.ilike.%${multaId}%,infrator_nome.ilike.%${multaId}%`)
          .limit(1)
          .maybeSingle();
        foundMulta = byLike;
      }

      if (!foundMulta) {
        // Fallback: check cached list
        const cached = cacheGet<any[]>('multas_list') || [];
        foundMulta = cached.find((m: any) => m.id === multaId || m.numero === multaId || m.numero_auto === multaId);
      }

      if (foundMulta) {
        setSelectedMulta(foundMulta);
      }
      searchParams.delete('multa');
      searchParams.delete('id');
      setSearchParams(searchParams, { replace: true });
    })();
  }, [searchParams, setSearchParams]);

  // Carrega o nome completo do agente que emitiu a multa para preencher documentos
  useEffect(() => {
    (async () => {
      if (!selectedMulta) { setAgenteNome(''); return; }
      if (selectedMulta.agente_nome) { setAgenteNome(selectedMulta.agente_nome); return; }
      const email = selectedMulta.agente_email || user?.email;
      if (!email) { setAgenteNome(user?.email || ''); return; }
      const { data } = await supabase.from('agentes').select('nome').eq('email', email).maybeSingle();
      setAgenteNome(data?.nome || email);
    })();
  }, [selectedMulta, user?.email]);

  const formatDateSafe = (dateVal: any) => {
    if (!dateVal) return '—';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('pt-MZ');
    } catch {
      return '—';
    }
  };

  const filtered = multas.filter(m => {
    if (!m) return false;
    const term = (search || '').toLowerCase().trim();
    if (!term) return true;
    return (
      (m.infrator_nome || '').toLowerCase().includes(term) ||
      (m.matricula || '').toLowerCase().includes(term) ||
      (m.numero || '').toLowerCase().includes(term) ||
      (m.numero_auto || '').toLowerCase().includes(term)
    );
  });

  const getPaymentLocation = (obs: string | null) => {
    if (!obs) return 'Balcão Único do CMM - Sede';
    const match = obs.match(/Local pagamento: (.+?)(\||$)/);
    return match ? match[1].trim() : 'Balcão Único do CMM - Sede';
  };

  function openCancelDialog(multaId: string) {
    setCancelMultaId(multaId);
    setMyPassword('');
    setPresidenteQuery('');
    setPresidenteSel(null);
    setMotivoCancel('');
    setCancelDialogOpen(true);
  }

  async function handleRequestCancel() {
    if (!presidenteSel) {
      toast.error('Seleccione o Presidente do Município que irá autorizar');
      return;
    }
    if (!myPassword) {
      toast.error('Introduza a sua senha');
      return;
    }
    setCancelling(true);
    try {
      // Verify own password first
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: myPassword,
      });
      if (authErr) {
        toast.error('Senha incorrecta');
        setCancelling(false);
        return;
      }

      const approverRole = 'presidente';
      const multa = multas.find(m => m.id === cancelMultaId);

      // Create cancel request
      const { error: insertErr } = await supabase.from('cancel_requests').insert({
        multa_id: cancelMultaId,
        requester_user_id: user?.id,
        requester_email: user?.email,
        requester_role: nivelAcesso,
        approver_role: approverRole,
        approver_email: presidenteSel.email,
        approver_nome: presidenteSel.nome,
        motivo: motivoCancel.trim() || null,
      } as any);

      if (insertErr) {
        toast.error('Erro ao criar pedido: ' + insertErr.message);
        setCancelling(false);
        return;
      }

      // Get agent local for notification
      const agentInfo = await supabase.from('agentes').select('local_trabalho').eq('email', user?.email || '').maybeSingle();
      const localTrabalho = agentInfo.data?.local_trabalho || 'via_publica';

      // Notificação dirigida ao Presidente escolhido + email
      const approverLabel = 'Presidente do Município';
      await supabase.from('notifications').insert({
        message: `Pedido de cancelamento: ${multa?.infrator_nome} (${multa?.numero}) — solicitado por ${user?.email}${motivoCancel.trim() ? ` · Motivo: ${motivoCancel.trim()}` : ''}`,
        action: 'CANCELAR_MULTA',
        resource_id: cancelMultaId,
        local_trabalho: localTrabalho,
        created_by: user?.id,
        target_role: 'presidente',
      } as any);

      await supabase.functions.invoke('notify-email', {
        body: {
          to: presidenteSel.email,
          subject: `SIGEMM — Pedido de cancelamento da multa ${multa?.numero}`,
          message: `Foi recebido um pedido de cancelamento da multa ${multa?.numero} (infractor: ${multa?.infrator_nome}), solicitado por ${user?.email}.${motivoCancel.trim() ? `\n\nMotivo: ${motivoCancel.trim()}` : ''}\n\nAceda ao SIGEMM e abra o sino de notificações para autorizar ou recusar o pedido.`,
        },
      }).catch(() => {});

      await supabase.from('audit_log').insert({
        user_id: user?.id, action: 'PEDIDO_CANCELAMENTO', resource_id: cancelMultaId,
        details: `Pedido de cancelamento da multa ${multa?.numero} enviado a ${presidenteSel.nome} (${presidenteSel.email})`,
      } as any);

      toast.success(`Pedido enviado ao ${approverLabel} ${presidenteSel.nome}.`);
      setCancelDialogOpen(false);
      setSelectedMulta(null);
    } catch {
      toast.error('Erro inesperado');
    }
    setCancelling(false);
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {pending > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-200">
          <div className="flex items-center gap-2.5 text-xs font-medium">
            <CloudOff className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              {pending === 1
                ? 'Existe 1 multa registada offline pendente de sincronização.'
                : `Existem ${pending} multas registadas offline pendentes de sincronização.`}
              {online ? ' O sistema sincronizará automaticamente com a base de dados.' : ' O sistema sincronizará assim que houver rede.'}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => sync()}
            disabled={!online || syncing}
            className="h-8 text-xs gap-1.5 border-amber-500/40 bg-background/80 hover:bg-amber-500/20 shrink-0 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'A sincronizar...' : 'Sincronizar Agora'}
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar por infractor, número, matrícula..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44 h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Estados</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="paga">Paga</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
              <SelectItem value="fora_prazo">Fora do Prazo</SelectItem>
              <SelectItem value="enviada_tribunal">Enviada ao Tribunal</SelectItem>
            </SelectContent>
          </Select>
          <ExportMultasDialog />
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <Card className="p-8 text-center text-muted-foreground">Carregando...</Card>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            Nenhuma multa encontrada.
          </Card>
        ) : (
          filtered.map((multa) => (
            <Card
              key={multa.id}
              className="p-4 space-y-2 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedMulta(multa)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">{multa.infrator_nome}</p>
                  <p className="text-xs font-mono text-muted-foreground">{multa.numero}</p>
                </div>
                <span className={`status-badge flex-shrink-0 ${
                  multa.status === 'paga' ? 'status-paid' :
                  multa.status === 'pendente' ? 'status-pending' :
                  multa.status === 'offline_pendente' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-300' :
                  multa.status === 'fora_prazo' ? 'bg-orange-500/10 text-orange-700 border border-orange-200' :
                  multa.status === 'enviada_tribunal' ? 'bg-purple-500/10 text-purple-700 border border-purple-200' :
                  'status-cancelled'
                }`}>
                  {multa.status === 'offline_pendente' ? 'Offline (Pendente)' : multa.status?.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{multa.infracao_tipo}</span>
                <span className="font-semibold text-foreground">{Number(multa.valor).toFixed(2)} MT</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{multa.local}</span>
                <span>{formatDateSafe(multa.created_at)}</span>
              </div>
              {multa.numero_auto && (
                <p className="text-xs font-mono text-muted-foreground">Auto Nº: {multa.numero_auto}</p>
              )}
              {multa.matricula && (
                <p className="text-xs font-mono text-muted-foreground">
                  {(multa.categoria === 'imovel' || multa.observacoes?.includes('[IMÓVEL]')) ? 'Nº Porta / Talhão' : 'Matrícula'}: {multa.matricula}
                </p>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedMulta} onOpenChange={(open) => !open && setSelectedMulta(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Detalhes da Multa
            </DialogTitle>
            <DialogDescription>{selectedMulta?.numero}</DialogDescription>
          </DialogHeader>

          {selectedMulta && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Infrator</p>
                  <p className="font-semibold text-foreground">{selectedMulta.infrator_nome}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Documento</p>
                  <p className="font-semibold text-foreground">{selectedMulta.infrator_documento || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Auto de Notícia</p>
                  <p className="font-mono font-semibold text-foreground">{selectedMulta.numero_auto || '—'}</p>
                </div>
                {(selectedMulta as any).tribunal_nome && (
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Tribunal</p>
                    <p className="font-semibold text-foreground">{(selectedMulta as any).tribunal_nome}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Data</p>
                  <p className="font-semibold text-foreground">{formatDateSafe(selectedMulta.created_at)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">
                    {(selectedMulta.categoria === 'imovel' || selectedMulta.observacoes?.includes('[IMÓVEL]')) ? 'Nº Porta / Talhão' : 'Matrícula'}
                  </p>
                  <p className="font-mono font-semibold text-foreground">{selectedMulta.matricula || '—'}</p>
                </div>
              </div>

              <Card className="p-3 bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Infracção</p>
                <p className="text-sm font-semibold text-foreground">{selectedMulta.infracao_tipo}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedMulta.local}</p>
              </Card>

              <div className="rounded-lg bg-primary/10 p-4 text-center">
                <p className="text-xs text-muted-foreground">Valor da Multa</p>
                <p className="text-2xl font-bold text-foreground">{Number(selectedMulta.valor).toFixed(2)} MT</p>
                <span className={`status-badge mt-2 ${selectedMulta.status === 'paga' ? 'status-paid' : selectedMulta.status === 'pendente' ? 'status-pending' : 'status-cancelled'}`}>
                  {selectedMulta.status}
                </span>
              </div>

              <Card className="p-3 space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="h-3 w-3" /> Local de Pagamento</p>
                <p className="text-sm font-semibold text-foreground">{getPaymentLocation(selectedMulta.observacoes)}</p>
                <p className="text-xs text-muted-foreground">Prazo: 15 dias úteis</p>
              </Card>

              {selectedMulta.observacoes && (
                <div className="text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground mb-1">Observações:</p>
                  <p>{selectedMulta.observacoes}</p>
                </div>
              )}

              {/* Status-based actions */}
              {selectedMulta.status === 'paga' ? (
                <DocumentActions
                  document={buildDocumentData(selectedMulta, 'recibo', agenteNome || user?.email)}
                />
              ) : (selectedMulta.status === 'pendente' || selectedMulta.status === 'fora_prazo') ? (
                <div className="space-y-2">
                  <DocumentActions
                    document={buildDocumentData(selectedMulta, 'factura', agenteNome || user?.email)}
                    showPayButton
                    onPay={() => {
                      setSelectedMulta(null);
                      navigate('/pagamentos');
                    }}
                  />
                  {canSendTribunal && (
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-purple-300 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                      onClick={() => { setTribunalNome(''); setTribunalOpen(true); }}
                    >
                      <Gavel className="h-4 w-4" />
                      Enviar ao Tribunal
                    </Button>
                  )}
                  {canCancel && (
                    <Button
                      variant="destructive"
                      className="w-full gap-2"
                      onClick={() => openCancelDialog(selectedMulta.id)}
                    >
                      <Ban className="h-4 w-4" />
                      Solicitar Cancelamento
                    </Button>
                  )}
                </div>
              ) : selectedMulta.status === 'enviada_tribunal' ? (
                <Card className="p-3 bg-purple-500/10 text-center border border-purple-200">
                  <p className="text-xs font-semibold text-purple-700 flex items-center justify-center gap-1">
                    <Gavel className="h-3 w-3" /> Enviado ao Tribunal{(selectedMulta as any).tribunal_nome ? ` — ${(selectedMulta as any).tribunal_nome}` : ''}
                  </p>
                </Card>
              ) : (
                <Card className="p-3 bg-destructive/10 text-center">
                  <p className="text-xs font-semibold text-destructive">Multa cancelada — sem acções disponíveis</p>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Request Dialog - Only own password */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" />
              Solicitar Cancelamento
            </DialogTitle>
            <DialogDescription>
              Indique o Presidente do Município que irá autorizar e confirme com a sua senha. O Presidente receberá uma notificação no sistema e por email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Presidente do Município *</Label>
              <Input
                placeholder="Escreva o nome ou email do Presidente"
                value={presidenteSel ? `${presidenteSel.nome} · ${presidenteSel.email}` : presidenteQuery}
                onChange={(e) => { setPresidenteSel(null); setPresidenteQuery(e.target.value); }}
              />
              {!presidenteSel && (
                <div className="max-h-36 overflow-y-auto rounded-md border border-border divide-y divide-border">
                  {presidenteSugestoes.length === 0 ? (
                    <p className="p-2 text-[11px] text-muted-foreground">Nenhum Presidente do Município encontrado.</p>
                  ) : presidenteSugestoes.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-2 py-1.5 hover:bg-muted/60 transition-colors"
                      onClick={() => { setPresidenteSel(p); setPresidenteQuery(''); }}
                    >
                      <p className="text-xs font-semibold text-foreground">{p.nome}</p>
                      <p className="text-[10px] text-muted-foreground">{p.email}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Motivo do pedido</Label>
              <Input placeholder="Motivo (opcional)" value={motivoCancel} onChange={(e) => setMotivoCancel(e.target.value)} maxLength={300} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Sua Senha</Label>
              <div className="relative">
                <Input
                  type={showMyPwd ? 'text' : 'password'}
                  placeholder="A sua senha"
                  value={myPassword}
                  onChange={(e) => setMyPassword(e.target.value)}
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowMyPwd(!showMyPwd)}>
                  {showMyPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Voltar</Button>
            <Button variant="destructive" onClick={handleRequestCancel} disabled={cancelling} className="gap-2">
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              {cancelling ? 'Enviando...' : 'Enviar Pedido'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enviar ao Tribunal */}
      <Dialog open={tribunalOpen} onOpenChange={setTribunalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700">
              <Gavel className="h-5 w-5" /> Enviar ao Tribunal
            </DialogTitle>
            <DialogDescription>
              {selectedMulta?.numero} · Auto Nº {selectedMulta?.numero_auto || '—'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Card className="p-3 bg-muted/40">
              <p className="text-sm font-semibold">{selectedMulta?.infrator_nome}</p>
              <p className="text-xs text-muted-foreground">{selectedMulta?.infracao_tipo}</p>
              <p className="text-sm font-bold mt-1">{selectedMulta && Number(selectedMulta.valor).toFixed(2)} MT</p>
            </Card>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Nome do Tribunal *</Label>
              <Input value={tribunalNome} onChange={(e) => setTribunalNome(e.target.value)} placeholder="Ex: Tribunal Judicial da Matola" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTribunalOpen(false)}>Cancelar</Button>
            <Button
              className="gap-2 bg-purple-600 hover:bg-purple-700"
              disabled={enviandoTribunal}
              onClick={async () => {
                if (!tribunalNome.trim()) { toast.error('Introduza o nome do Tribunal'); return; }
                if (!selectedMulta) return;
                setEnviandoTribunal(true);
                const { error } = await supabase.from('multas').update({
                  status: 'enviada_tribunal', tribunal_nome: tribunalNome.trim(),
                } as any).eq('id', selectedMulta.id);
                if (error) { toast.error('Erro: ' + error.message); setEnviandoTribunal(false); return; }
                await supabase.from('audit_log').insert({
                  action: 'ENVIAR_TRIBUNAL', resource_id: selectedMulta.id, user_id: user?.id,
                  details: `Multa ${selectedMulta.numero} (Auto ${selectedMulta.numero_auto || '—'}) enviada ao ${tribunalNome.trim()}`,
                });
                toast.success('Multa enviada ao tribunal');
                setEnviandoTribunal(false);
                setTribunalOpen(false);
                setSelectedMulta(null);
                loadMultas();
              }}
            >
              {enviandoTribunal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Encaminhar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
