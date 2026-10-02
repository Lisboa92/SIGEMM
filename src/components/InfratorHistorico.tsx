import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, AlertTriangle } from 'lucide-react';

interface Props {
  documento?: string;
  nome?: string;
  matricula?: string;
  excludeId?: string;
}

export default function InfratorHistorico({ documento, nome, matricula, excludeId }: Props) {
  const [multas, setMultas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const doc = documento?.trim();
    const mat = matricula?.trim();
    const nm = nome?.trim();
    if ((doc?.length ?? 0) < 5 && (mat?.length ?? 0) < 5 && (nm?.length ?? 0) < 5) {
      setMultas([]);
      return;
    }

    let active = true;
    const t = setTimeout(async () => {
      setLoading(true);
      const filters: string[] = [];
      if (doc && doc.length >= 5) filters.push(`infrator_documento.eq.${doc}`);
      if (mat && mat.length >= 5) filters.push(`matricula.eq.${mat}`);
      if (nm && nm.length >= 5) filters.push(`infrator_nome.ilike.%${nm}%`);

      const { data } = await supabase
        .from('multas')
        .select('id, numero, infracao_tipo, valor, status, created_at, local')
        .or(filters.join(','))
        .order('created_at', { ascending: false })
        .limit(20);

      if (!active) return;
      setMultas((data ?? []).filter(m => m.id !== excludeId));
      setLoading(false);
    }, 500);

    return () => { active = false; clearTimeout(t); };
  }, [documento, nome, matricula, excludeId]);

  if (!loading && multas.length === 0) return null;

  const pendentes = multas.filter(m => m.status === 'pendente' || m.status === 'fora_prazo').length;
  const total = multas.reduce((s, m) => s + Number(m.valor || 0), 0);

  return (
    <Card className="p-4 space-y-3 border-secondary/40">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <History className="h-4 w-4 text-secondary" /> Histórico do Infractor
        </h3>
        {multas.length >= 3 && (
          <Badge variant="destructive" className="text-[10px] gap-1">
            <AlertTriangle className="h-3 w-3" /> Reincidente
          </Badge>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">A consultar registos...</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/60 p-2">
              <p className="text-[10px] text-muted-foreground uppercase">Multas</p>
              <p className="text-base font-bold text-foreground">{multas.length}</p>
            </div>
            <div className="rounded-lg bg-muted/60 p-2">
              <p className="text-[10px] text-muted-foreground uppercase">Em dívida</p>
              <p className="text-base font-bold text-destructive">{pendentes}</p>
            </div>
            <div className="rounded-lg bg-muted/60 p-2">
              <p className="text-[10px] text-muted-foreground uppercase">Total</p>
              <p className="text-base font-bold text-foreground">{total.toFixed(0)} MT</p>
            </div>
          </div>
          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            {multas.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-2 text-xs border-b border-border pb-1.5 last:border-0">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{m.infracao_tipo}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString('pt-MZ')} · {m.local}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-foreground">{Number(m.valor).toFixed(2)} MT</p>
                  <span className={`status-badge ${m.status === 'paga' ? 'status-paid' : m.status === 'pendente' ? 'status-pending' : 'status-cancelled'}`}>
                    {m.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
