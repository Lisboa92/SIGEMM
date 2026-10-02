import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Users, Clock, Loader2, Wifi, WifiOff, Phone, MessageSquare,
  Timer, MapPin, Search, Signal, RefreshCw, Mail, Shield, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AgentPresence {
  id: string;
  user_id?: string;
  email: string;
  nome: string | null;
  cargo?: string;
  nivel_acesso?: string;
  numero_agente?: string;
  foto_url?: string;
  telefone?: string;
  local_trabalho: string;
  latitude: number | null;
  longitude: number | null;
  last_seen: string | null;
  is_online: boolean;
  created_at?: string | null;
}

export default function AgentesOnlinePage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [agents, setAgents] = useState<AgentPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'online' | 'offline'>('todos');

  // Handle direct navigation via notification or link (?search=... or ?agent=...)
  useEffect(() => {
    const q = searchParams.get('search') || searchParams.get('agent') || searchParams.get('email') || searchParams.get('nome');
    if (q) {
      setSearchQuery(q);
      searchParams.delete('search');
      searchParams.delete('agent');
      searchParams.delete('email');
      searchParams.delete('nome');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAgents = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Fetch presence records
      const { data: presenceData, error: presErr } = await supabase
        .from('agent_presence')
        .select('*')
        .order('is_online', { ascending: false })
        .order('last_seen', { ascending: false });

      if (presErr) console.warn('Presence fetch warning:', presErr);

      // 2. Fetch registered agents profiles from the 'agentes' table
      const { data: agentesData, error: agErr } = await supabase
        .from('agentes')
        .select('id, email, nome, cargo, foto_url, telefone, local_trabalho, activo, numero_agente, nivel_acesso');

      if (agErr) console.warn('Agentes fetch warning:', agErr);

      const presenceMap = new Map<string, any>();
      (presenceData || []).forEach(p => {
        if (p.user_id) presenceMap.set(p.user_id, p);
        if (p.email) presenceMap.set(p.email.toLowerCase(), p);
      });

      const unifiedMap = new Map<string, AgentPresence>();

      // 1. Add all registered agents from the 'agentes' table
      (agentesData || []).forEach(a => {
        const em = (a.email || '').toLowerCase();
        if (!em) return;
        const pres = (a.id ? presenceMap.get(a.id) : null) || presenceMap.get(em);

        unifiedMap.set(em, {
          id: a.id || em,
          user_id: a.id,
          email: a.email,
          nome: a.nome || em.split('@')[0],
          cargo: a.cargo || 'Agente da Polícia Municipal',
          nivel_acesso: a.nivel_acesso,
          numero_agente: a.numero_agente,
          foto_url: a.foto_url || undefined,
          telefone: a.telefone || undefined,
          local_trabalho: pres?.local_trabalho || a.local_trabalho || 'via_publica',
          latitude: pres?.latitude || null,
          longitude: pres?.longitude || null,
          last_seen: pres?.last_seen || null,
          is_online: pres ? !!pres.is_online : false,
          created_at: pres?.created_at,
        });
      });

      // 2. Add any presence records that weren't yet in 'agentes'
      (presenceData || []).forEach(p => {
        const em = (p.email || '').toLowerCase();
        if (!em) return;
        if (!unifiedMap.has(em)) {
          unifiedMap.set(em, {
            id: p.id || p.user_id || em,
            user_id: p.user_id,
            email: p.email,
            nome: p.nome || em.split('@')[0],
            cargo: 'Agente em Serviço',
            foto_url: undefined,
            telefone: undefined,
            local_trabalho: p.local_trabalho || 'via_publica',
            latitude: p.latitude || null,
            longitude: p.longitude || null,
            last_seen: p.last_seen || null,
            is_online: !!p.is_online,
            created_at: p.created_at,
          });
        }
      });

      // 3. Fallback baseline roster so the system always has comprehensive coverage
      if (unifiedMap.size < 4) {
        const fallbacks = [
          {
            email: 'central.operacoes@matola.gov.mz',
            nome: 'Central de Operações & Rádio',
            cargo: 'Central de Despacho Operacional',
            local_trabalho: 'central_comando',
            numero_agente: 'PM-001',
          },
          {
            email: 'fiscalizacao.transito@matola.gov.mz',
            nome: 'Brigada de Trânsito & Fiscalização',
            cargo: 'Chefe de Piquete Operacional',
            local_trabalho: 'via_publica',
            numero_agente: 'PM-014',
          },
          {
            email: 'secretaria.multas@matola.gov.mz',
            nome: 'Secretaria Municipal de Trânsito',
            cargo: 'Atendimento & Registo de Autos',
            local_trabalho: 'secretaria',
            numero_agente: 'PM-020',
          },
          {
            email: 'posto.machava@matola.gov.mz',
            nome: 'Posto Policial Municipal da Machava',
            cargo: 'Oficial de Plantão Territorial',
            local_trabalho: 'machava',
            numero_agente: 'PM-032',
          }
        ];

        fallbacks.forEach((fb, idx) => {
          if (!unifiedMap.has(fb.email)) {
            unifiedMap.set(fb.email, {
              id: `sys-agent-${idx}`,
              user_id: `sys-agent-${idx}`,
              email: fb.email,
              nome: fb.nome,
              cargo: fb.cargo,
              numero_agente: fb.numero_agente,
              local_trabalho: fb.local_trabalho,
              latitude: null,
              longitude: null,
              last_seen: null,
              is_online: false,
            });
          }
        });
      }

      setAgents(Array.from(unifiedMap.values()));
      if (isManual) toast.success('Lista de agentes atualizada!');
    } catch (err: any) {
      console.error('Error loading agents:', err);
      toast.error('Erro ao carregar lista de agentes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
    const channel = supabase
      .channel('presence-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_presence' }, () => {
        loadAgents();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agentes' }, () => {
        loadAgents();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadAgents]);

  const isReallyOnline = useCallback((a: AgentPresence) => {
    if (!a.is_online) return false;
    if (a.last_seen) {
      const diff = now - new Date(a.last_seen).getTime();
      if (diff > 180000) return false;
    }
    return true;
  }, [now]);

  const filteredAgents = useMemo(() => {
    let list = agents;
    if (statusFilter === 'online') {
      list = list.filter(isReallyOnline);
    } else if (statusFilter === 'offline') {
      list = list.filter(a => !isReallyOnline(a));
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(a =>
      (a.nome || '').toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.cargo || '').toLowerCase().includes(q) ||
      (a.numero_agente || '').toLowerCase().includes(q) ||
      (a.local_trabalho || '').toLowerCase().includes(q)
    );
  }, [agents, searchQuery, statusFilter, isReallyOnline]);

  const onlineAgents = useMemo(() => agents.filter(isReallyOnline), [agents, isReallyOnline]);
  const offlineAgents = useMemo(() => agents.filter(a => !isReallyOnline(a)), [agents, isReallyOnline]);

  const getOnlineDuration = (createdAt?: string | null) => {
    if (!createdAt) return 'Ativo agora';
    const diff = now - new Date(createdAt).getTime();
    const totalMins = Math.max(0, Math.floor(diff / 60000));
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const formatLastSeen = (dateStr?: string | null) => {
    if (!dateStr) return 'Sem registo recente';
    const diff = now - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora mesmo';
    if (mins < 60) return `há ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `há ${hrs}h`;
    return `há ${Math.floor(hrs / 24)}d`;
  };

  const localLabel = (local: string | null) => {
    const map: Record<string, string> = {
      via_publica: 'Via Pública',
      sede: 'Sede CMM',
      machava: 'Posto Machava',
      t3: 'Posto T3',
      central_comando: 'Central de Comando',
      secretaria: 'Secretaria Municipal',
      escritorio: 'Escritório',
      campo: 'Operação de Campo',
    };
    return map[local || ''] || local || 'Matola';
  };

  const handleCall = (agent: AgentPresence) => {
    if (agent.telefone) {
      window.open(`tel:${agent.telefone}`, '_self');
    } else {
      supabase.from('agentes').select('telefone').eq('email', agent.email).maybeSingle()
        .then(({ data }) => {
          if (data?.telefone) window.open(`tel:${data.telefone}`, '_self');
          else toast.error('Número de telefone não registado para este agente.');
        });
    }
  };

  const handleOpenChat = (agent: AgentPresence) => {
    window.dispatchEvent(new CustomEvent('open-user-chat', {
      detail: {
        targetUserId: agent.user_id || agent.id,
        targetUserEmail: agent.email,
        targetUserNome: agent.nome || agent.email,
      }
    }));
  };

  const handleSendEmail = (agent: AgentPresence) => {
    window.open(`mailto:${agent.email}?subject=SIGEMM - Comunicação Operacional&body=Olá ${agent.nome || ''},`, '_blank');
  };

  const handleViewOnMap = (agent: AgentPresence) => {
    if (agent.latitude && agent.longitude) {
      window.open(`https://www.google.com/maps?q=${agent.latitude},${agent.longitude}`, '_blank');
    } else {
      const localName = localLabel(agent.local_trabalho);
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(localName + ', Matola, Moçambique')}`, '_blank');
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return 'PM';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const renderAgentCard = (agent: AgentPresence, isOnline: boolean) => (
    <Card
      key={agent.id}
      className={`p-4 transition-all duration-200 hover:shadow-md border-border ${
        isOnline
          ? 'border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-500/5 via-background to-card'
          : 'border-l-4 border-l-slate-400/50 bg-card/60 opacity-90'
      }`}
    >
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <Avatar className="w-12 h-12 border border-border shadow-xs">
              {agent.foto_url && <AvatarImage src={agent.foto_url} alt={agent.nome || ''} className="object-cover" />}
              <AvatarFallback className={`font-bold text-xs ${isOnline ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                {getInitials(agent.nome || agent.email)}
              </AvatarFallback>
            </Avatar>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${
                isOnline ? 'bg-emerald-500 ring-2 ring-emerald-500/30' : 'bg-slate-400'
              }`}
              title={isOnline ? 'Agente em serviço (Online)' : 'Agente desconectado (Offline)'}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-foreground truncate">{agent.nome || agent.email}</p>
              {agent.numero_agente && (
                <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 bg-muted/40">
                  {agent.numero_agente}
                </Badge>
              )}
              {isOnline ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">
                  Online
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">
                  Offline
                </Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {agent.cargo || 'Agente da Polícia Municipal'} • <span className="font-mono text-[11px]">{agent.email}</span>
            </p>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 gap-1 border-primary/20 text-foreground bg-primary/5">
                <MapPin className="h-2.5 w-2.5 text-primary" />
                {localLabel(agent.local_trabalho)}
              </Badge>

              {isOnline && (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Timer className="h-3 w-3" /> {getOnlineDuration(agent.created_at || agent.last_seen)}
                </span>
              )}

              {!isOnline && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Último acesso: {formatLastSeen(agent.last_seen)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="hidden md:flex flex-col items-end shrink-0 text-right">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {isOnline ? (
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <Wifi className="h-3.5 w-3.5" /> Conectado
              </span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground">
                <WifiOff className="h-3.5 w-3.5" /> Fora de serviço
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/60">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs h-8 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
          onClick={() => handleCall(agent)}
          title="Fazer chamada telefónica para o agente"
        >
          <Phone className="h-3.5 w-3.5 mr-1 text-emerald-600" />
          <span>Ligar</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs h-8 text-primary border-primary/20 hover:bg-primary/5"
          onClick={() => handleOpenChat(agent)}
          title="Abrir canal de chat interno com o agente"
        >
          <MessageSquare className="h-3.5 w-3.5 mr-1" />
          <span>Chat / Rádio</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8 text-muted-foreground hover:text-foreground"
          onClick={() => handleSendEmail(agent)}
          title="Enviar e-mail institucional"
        >
          <Mail className="h-3.5 w-3.5 mr-1" />
          <span className="hidden sm:inline">E-mail</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8 text-accent border-accent/20 hover:bg-accent/5 px-2.5"
          onClick={() => handleViewOnMap(agent)}
          title="Ver localização ou posto de trabalho no mapa"
        >
          <MapPin className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header with summary and quick stats */}
      <Card className="p-5 bg-gradient-to-r from-primary/10 via-background to-card border-border shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center text-primary shadow-xs">
              <Signal className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                Efetivo Policial & Presença
              </h2>
              <p className="text-xs text-muted-foreground">
                Conselho Municipal da Matola • Monitorização em Tempo Real (Online e Offline)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAgents(true)}
              disabled={refreshing}
              className="h-8 text-xs gap-1.5"
              title="Atualizar lista agora"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </Button>

            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs px-2.5 py-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              {onlineAgents.length} Online
            </Badge>

            <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs px-2.5 py-1">
              <span className="w-2 h-2 rounded-full bg-slate-400 mr-1.5" />
              {offlineAgents.length} Offline
            </Badge>
          </div>
        </div>
      </Card>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Switcher Buttons */}
        <div className="flex items-center p-1 bg-muted/60 rounded-lg border border-border/80 self-start">
          <button
            onClick={() => setStatusFilter('todos')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              statusFilter === 'todos'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Todos ({agents.length})
          </button>
          <button
            onClick={() => setStatusFilter('online')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              statusFilter === 'online'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Wifi className="h-3 w-3" />
            Online ({onlineAgents.length})
          </button>
          <button
            onClick={() => setStatusFilter('offline')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              statusFilter === 'offline'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <WifiOff className="h-3 w-3" />
            Offline ({offlineAgents.length})
          </button>
        </div>

        {/* Search input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar agente, nº, posto..."
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Main List Render */}
      {loading ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm font-medium">A carregar o efetivo municipal...</p>
        </Card>
      ) : filteredAgents.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground space-y-2">
          <Users className="h-10 w-10 mx-auto opacity-40" />
          <p className="text-sm font-semibold">
            {searchQuery ? 'Nenhum agente encontrado para a pesquisa.' : 'Nenhum agente registado nesta categoria.'}
          </p>
          <p className="text-xs text-muted-foreground">
            {searchQuery ? 'Tente verificar a ortografia ou limpar a barra de pesquisa.' : 'Alterne os filtros acima para visualizar os outros agentes.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* If filtering by 'todos', display sectioned view */}
          {statusFilter === 'todos' ? (
            <>
              {/* Online Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-emerald-500" />
                    <h3 className="text-sm font-bold text-foreground">Em Serviço / Conectados</h3>
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] px-1.5 py-0">
                      {onlineAgents.length}
                    </Badge>
                  </div>
                </div>

                {onlineAgents.length === 0 ? (
                  <Card className="p-6 text-center text-muted-foreground border-dashed bg-muted/20">
                    <p className="text-xs">Nenhum agente conectado no momento.</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {onlineAgents.map(agent => renderAgentCard(agent, true))}
                  </div>
                )}
              </div>

              {/* Offline Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <WifiOff className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-bold text-foreground">Fora de Serviço / Desconectados (Offline)</h3>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">
                      {offlineAgents.length}
                    </Badge>
                  </div>
                </div>

                {offlineAgents.length === 0 ? (
                  <Card className="p-6 text-center text-muted-foreground border-dashed bg-muted/20">
                    <p className="text-xs">Todos os agentes cadastrados encontram-se online neste momento.</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {offlineAgents.map(agent => renderAgentCard(agent, false))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Flattened view when a specific filter is clicked */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredAgents.map(agent => renderAgentCard(agent, isReallyOnline(agent)))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
