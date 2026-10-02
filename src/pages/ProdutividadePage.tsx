import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Trophy, Target, Banknote, Percent, Users, Printer } from 'lucide-react';
import PrinterSelectDialog from '@/components/PrinterSelectDialog';
import { type ReportPrintData } from '@/lib/printService';

const PERIODOS = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: '3650', label: 'Todo o período' },
];

interface AgenteStats {
  chave: string;
  nome: string;
  total: number;
  pagas: number;
  canceladas: number;
  tribunal: number;
  valorTotal: number;
  valorCobrado: number;
  taxa: number;
}

export default function ProdutividadePage() {
  const [multas, setMultas] = useState<any[]>([]);
  const [periodo, setPeriodo] = useState('30');
  const [loading, setLoading] = useState(true);
  const [printOpen, setPrintOpen] = useState(false);
  const [reportData, setReportData] = useState<ReportPrintData | undefined>(undefined);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const desde = new Date();
      desde.setDate(desde.getDate() - Number(periodo));
      const { data } = await supabase
        .from('multas')
        .select('agente_email, agente_nome, valor, status, created_at')
        .gte('created_at', desde.toISOString())
        .order('created_at', { ascending: false });
      setMultas(data ?? []);
      setLoading(false);
    })();
  }, [periodo]);

  const stats = useMemo<AgenteStats[]>(() => {
    const map = new Map<string, AgenteStats>();
    multas.forEach(m => {
      const chave = m.agente_email || 'desconhecido';
      const cur = map.get(chave) ?? {
        chave, nome: m.agente_nome || chave, total: 0, pagas: 0, canceladas: 0,
        tribunal: 0, valorTotal: 0, valorCobrado: 0, taxa: 0,
      };
      cur.nome = m.agente_nome || cur.nome;
      cur.total += 1;
      cur.valorTotal += Number(m.valor || 0);
      if (m.status === 'paga') { cur.pagas += 1; cur.valorCobrado += Number(m.valor || 0); }
      if (m.status === 'cancelada') cur.canceladas += 1;
      if (m.status === 'enviada_tribunal') cur.tribunal += 1;
      map.set(chave, cur);
    });
    return Array.from(map.values())
      .map(s => ({ ...s, taxa: s.total ? Math.round((s.pagas / s.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [multas]);

  const totais = useMemo(() => ({
    multas: multas.length,
    agentes: stats.length,
    cobrado: stats.reduce((s, a) => s + a.valorCobrado, 0),
    taxa: multas.length ? Math.round((multas.filter(m => m.status === 'paga').length / multas.length) * 100) : 0,
  }), [multas, stats]);

  const chartData = stats.slice(0, 8).map(s => ({
    agente: s.nome.split(' ')[0],
    registadas: s.total,
    pagas: s.pagas,
  }));

  const chartConfig = {
    registadas: { label: 'Registadas', color: 'hsl(var(--primary))' },
    pagas: { label: 'Pagas', color: 'hsl(var(--accent))' },
  };

  const cards = [
    { label: 'Multas no período', value: totais.multas, icon: Target },
    { label: 'Agentes activos', value: totais.agentes, icon: Users },
    { label: 'Valor cobrado', value: `${totais.cobrado.toFixed(0)} MT`, icon: Banknote },
    { label: 'Taxa de cobrança', value: `${totais.taxa}%`, icon: Percent },
  ];

  const handlePrint = () => {
    const periodoLabel = PERIODOS.find(p => p.value === periodo)?.label || 'Período';
    const data: ReportPrintData = {
      titulo: 'Mapa de Produtividade dos Agentes de Campo',
      subtitulo: 'Comando da Polícia Municipal da Matola · SIGEMM',
      periodo: periodoLabel,
      resumo: [
        { label: 'Total Multas', valor: totais.multas },
        { label: 'Agentes Activos', valor: totais.agentes },
        { label: 'Valor Cobrado', valor: `${totais.cobrado.toFixed(2)} MT` },
        { label: 'Taxa Cobrança', valor: `${totais.taxa}%` },
      ],
      colunas: ['Posição', 'Agente', 'Total Multas', 'Pagas', 'Tribunal', 'Valor Cobrado (MT)', 'Taxa (%)'],
      linhas: stats.map((s, i) => [
        `#${i + 1}`,
        s.nome,
        s.total,
        s.pagas,
        s.tribunal,
        s.valorCobrado.toFixed(2),
        `${s.taxa}%`,
      ]),
    };
    setReportData(data);
    setPrintOpen(true);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Trophy className="h-4 w-4 text-secondary" /> Produtividade dos Agentes
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 h-9">
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Relatório</span>
          </Button>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(c => (
          <Card key={c.label} className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">{c.label}</span>
              <c.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-extrabold text-foreground">{c.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Registadas vs. Pagas (top 8)</h3>
        {chartData.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">{loading ? 'A carregar...' : 'Sem dados no período.'}</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="agente" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="registadas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pagas" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Ranking detalhado</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 font-semibold">#</th>
                <th className="text-left py-2 font-semibold">Agente</th>
                <th className="text-right py-2 font-semibold">Multas</th>
                <th className="text-right py-2 font-semibold">Pagas</th>
                <th className="text-right py-2 font-semibold">Tribunal</th>
                <th className="text-right py-2 font-semibold">Cobrado</th>
                <th className="text-right py-2 font-semibold">Taxa</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Sem dados.</td></tr>
              ) : stats.map((s, i) => (
                <tr key={s.chave} className="border-b border-border last:border-0">
                  <td className="py-2">
                    <span className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
                  </td>
                  <td className="py-2 text-foreground font-medium truncate max-w-[160px]">{s.nome}</td>
                  <td className="py-2 text-right font-bold">{s.total}</td>
                  <td className="py-2 text-right">{s.pagas}</td>
                  <td className="py-2 text-right">{s.tribunal}</td>
                  <td className="py-2 text-right">{s.valorCobrado.toFixed(0)} MT</td>
                  <td className="py-2 text-right">
                    <Badge variant={s.taxa >= 60 ? 'default' : s.taxa >= 30 ? 'secondary' : 'destructive'} className="text-[10px]">{s.taxa}%</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <PrinterSelectDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        reportData={reportData}
        initialMode="report"
      />
    </div>
  );
}
