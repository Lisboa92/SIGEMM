import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { FileText, CheckCircle, Clock, AlertTriangle, TrendingUp, TrendingDown, MapPin, Users, Award } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, Area, AreaChart } from 'recharts';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import logoMatola from '@/assets/logo-matola.png';
import { getQueue, cacheGet, cacheSet } from '@/lib/offlineQueue';

interface Stats {
  total: number;
  pagas: number;
  pendentes: number;
  hoje: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ total: 0, pagas: 0, pendentes: 0, hoje: 0 });
  const [multas, setMultas] = useState<any[]>([]);
  const [recentMultas, setRecentMultas] = useState<any[]>([]);
  const [agenteName, setAgenteName] = useState<string | null>(null);
  const [agenteCargo, setAgenteCargo] = useState<string | null>(null);

  const computeStats = useCallback((data: any[]) => {
    const total = data.length;
    const pagas = data.filter(m => m.status === 'paga').length;
    const pendentes = data.filter(m => m.status === 'pendente' || m.status === 'offline_pendente').length;
    const today = new Date().toISOString().split('T')[0];
    const hoje = data.filter(m => (m.created_at || '').startsWith(today)).length;
    setStats({ total, pagas, pendentes, hoje });
  }, []);

  const loadAllData = useCallback(async () => {
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
      console.warn('[Dashboard] Erro ao carregar fila:', e);
    }

    try {
      if (navigator.onLine) {
        const { data, error } = await supabase.from('multas').select('*').order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) {
          cacheSet('multas_list', data);
          const combined = [...queueItems, ...data];
          setMultas(combined);
          setRecentMultas(combined.slice(0, 5));
          computeStats(combined);
          return;
        }
      }
    } catch {}

    const cached = cacheGet<any[]>('multas_list');
    const safeCached = Array.isArray(cached) ? cached : [];
    const combined = [...queueItems, ...safeCached];
    setMultas(combined);
    setRecentMultas(combined.slice(0, 5));
    computeStats(combined);
  }, [computeStats]);

  useEffect(() => {
    loadAllData();
    if (user?.email) {
      const cachedAgent = cacheGet<any>(`agent_${user.email}`);
      if (cachedAgent) {
        setAgenteName(cachedAgent.nome);
        setAgenteCargo(cachedAgent.cargo);
      }
      if (navigator.onLine) {
        supabase.from('agentes').select('nome, cargo').eq('email', user.email).maybeSingle()
          .then(({ data }) => {
            if (data) {
              cacheSet(`agent_${user.email}`, data);
              setAgenteName(data.nome);
              setAgenteCargo(data.cargo);
            }
          });
      }
    }

    const handler = () => loadAllData();
    window.addEventListener('multas-updated', handler);
    window.addEventListener('sigemm-queue-changed', handler);
    return () => {
      window.removeEventListener('multas-updated', handler);
      window.removeEventListener('sigemm-queue-changed', handler);
    };
  }, [user?.email, loadAllData]);

  // Rankings
  const topAgentes = useMemo(() => {
    const map: Record<string, number> = {};
    multas.forEach(m => {
      const agent = m.agente_email || 'Desconhecido';
      map[agent] = (map[agent] || 0) + 1;
    });
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 5);
  }, [multas]);

  const topLocais = useMemo(() => {
    const map: Record<string, number> = {};
    multas.forEach(m => {
      const loc = m.local || 'Desconhecido';
      map[loc] = (map[loc] || 0) + 1;
    });
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 5);
  }, [multas]);

  const topInfracoes = useMemo(() => {
    const map: Record<string, number> = {};
    multas.forEach(m => {
      map[m.infracao_tipo] = (map[m.infracao_tipo] || 0) + 1;
    });
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 5);
  }, [multas]);

  // Chart data - last 14 days
  const chartData = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days[key] = 0;
    }
    multas.forEach(m => {
      const day = m.created_at?.split('T')[0];
      if (day && day in days) days[day]++;
    });
    return Object.entries(days).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit' }),
      multas: count,
    }));
  }, [multas]);

  const trend = chartData.length >= 2
    ? chartData[chartData.length - 1].multas - chartData[chartData.length - 2].multas
    : 0;

  const chartConfig = {
    multas: { label: 'Multas', color: 'hsl(var(--primary))' },
  };

  const statCards = [
    { label: 'Total Multas', value: stats.total, icon: FileText, color: 'text-primary', bg: 'bg-primary/15', cardClass: 'stat-card-total' },
    { label: 'Pagas', value: stats.pagas, icon: CheckCircle, color: 'text-accent', bg: 'bg-accent/15', cardClass: 'stat-card-paid' },
    { label: 'Pendentes', value: stats.pendentes, icon: Clock, color: 'text-secondary', bg: 'bg-secondary/15', cardClass: 'stat-card-pending' },
    { label: 'Hoje', value: stats.hoje, icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/15', cardClass: 'stat-card-today' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Welcome Header */}
      <Card className="overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
        <div className="relative p-5 flex items-center gap-4">
          <img src={logoMatola} alt="CMM" className="w-14 h-14 object-contain drop-shadow-md" />
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground">
              Bem-vindo, {agenteName || user?.email?.split('@')[0]}
            </h2>
            {agenteCargo && <p className="text-xs text-muted-foreground font-medium">{agenteCargo}</p>}
            <p className="text-[11px] text-muted-foreground/70">{user?.email}</p>
          </div>
        </div>
      </Card>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((stat) => (
          <Card key={stat.label} className={`p-4 space-y-2 ${stat.cardClass} hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{stat.label}</span>
              <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-4.5 h-4.5 ${stat.color}`} />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-foreground">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Growth Chart */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            {trend >= 0 ? <TrendingUp className="w-4 h-4 text-primary" /> : <TrendingDown className="w-4 h-4 text-destructive" />}
            Evolução de Multas (14 dias)
          </h2>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${trend >= 0 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
            {trend >= 0 ? '+' : ''}{trend} hoje
          </span>
        </div>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
            <defs>
              <linearGradient id="colorMultas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area type="monotone" dataKey="multas" stroke="hsl(var(--primary))" fill="url(#colorMultas)" strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      </Card>

      {/* Rankings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Top Agentes */}
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Top Agentes
          </h3>
          <div className="space-y-2">
            {topAgentes.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>
            ) : topAgentes.map(([agent, count], i) => (
              <div key={agent} className="flex items-center gap-2 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {i + 1}
                </span>
                <span className="text-foreground truncate flex-1">{agent}</span>
                <span className="font-bold text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Locais */}
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4 text-accent" />
            Locais c/ Mais Multas
          </h3>
          <div className="space-y-2">
            {topLocais.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>
            ) : topLocais.map(([loc, count], i) => (
              <div key={loc} className="flex items-center gap-2 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {i + 1}
                </span>
                <span className="text-foreground truncate flex-1">{loc}</span>
                <span className="font-bold text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Infrações */}
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Award className="w-4 h-4 text-destructive" />
            Multas Mais Registadas
          </h3>
          <div className="space-y-2">
            {topInfracoes.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>
            ) : topInfracoes.map(([tipo, count], i) => (
              <div key={tipo} className="flex items-center gap-2 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {i + 1}
                </span>
                <span className="text-foreground truncate flex-1">{tipo}</span>
                <span className="font-bold text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Multas */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Multas Recentes</h2>
        <div className="space-y-2">
          {recentMultas.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              Nenhuma multa registada ainda.
            </Card>
          ) : (
            recentMultas.map((multa) => (
              <Card key={multa.id} className="p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{multa.infrator_nome}</p>
                  <p className="text-xs text-muted-foreground">{multa.infracao_tipo}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-sm font-bold text-foreground">{Number(multa.valor).toFixed(2)} MT</p>
                  <span className={`status-badge ${multa.status === 'paga' ? 'status-paid' : multa.status === 'pendente' ? 'status-pending' : 'status-cancelled'}`}>
                    {multa.status}
                  </span>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
