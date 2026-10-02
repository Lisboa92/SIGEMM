import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { KeyRound, Loader2, RefreshCw, ShieldQuestion } from 'lucide-react';
import { toast } from 'sonner';

function gerarSenhaProvisoria() {
  const maiusc = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minusc = 'abcdefghijkmnopqrstuvwxyz';
  const nums = '23456789';
  const esp = '!@#$%^&*';
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const base = [pick(maiusc), pick(esp), pick(nums), pick(nums)];
  while (base.length < 12) base.push(pick(maiusc + minusc + nums));
  return base.sort(() => Math.random() - 0.5).join('');
}

export default function PasswordResetRequests() {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [senha, setSenha] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('password_reset_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setPedidos(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  function abrir(p: any) {
    setSelected(p);
    setSenha(gerarSenhaProvisoria());
  }

  async function aplicar() {
    if (!selected) return;
    if (senha.length < 8 || !/[A-Z]/.test(senha) || !/[0-9]/.test(senha) || !/[!@#$%^&*]/.test(senha)) {
      toast.error('A senha provisória deve ter 8+ caracteres, maiúscula, número e caractere especial');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-agent-password', {
        body: { email: selected.email, new_password: senha },
      });
      if (error || (data as any)?.error) {
        let msg = (data as any)?.error as string | undefined;
        if (!msg && (error as any)?.context?.json) {
          try { msg = (await (error as any).context.json())?.error; } catch { /* ignore */ }
        }
        toast.error(msg || error?.message || 'Erro ao repor a senha');
        setSaving(false);
        return;
      }

      await supabase.functions.invoke('notify-email', {
      body: {
        to: selected.email,
        subject: 'SIGEMM — Senha provisória',
        message: `Olá ${selected.nome ?? ''},\n\nA sua senha provisória de acesso ao SIGEMM é: ${senha}\n\nPor razões de segurança, o sistema irá pedir-lhe que a altere no primeiro acesso.`,
      },
      }).catch(() => {});

      const { error: updErr } = await supabase.from('password_reset_requests')
        .update({ status: 'resolved', resolved_by_email: user?.email, resolved_at: new Date().toISOString() })
        .eq('id', selected.id);
      if (updErr) console.error('Falha ao marcar o pedido como resolvido:', updErr.message);

      await supabase.from('audit_log').insert({
        user_id: user?.id, action: 'RESET_SENHA',
        details: `Senha provisória definida para ${selected.email}`,
      } as any);

      toast.success('Senha provisória definida e enviada por email.');
      setSelected(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Erro inesperado ao repor a senha');
    }
    setSaving(false);
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldQuestion className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-bold text-foreground">Pedidos de Reposição de Senha</h3>
            <p className="text-[11px] text-muted-foreground">Defina uma senha provisória e envie-a ao utilizador.</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {loading ? (
        <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
      ) : pedidos.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Sem pedidos pendentes.</p>
      ) : (
        <div className="space-y-2">
          {pedidos.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{p.nome || p.username || p.email}</p>
                <p className="text-[10px] text-muted-foreground truncate">{p.email}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleString('pt-MZ')}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className="bg-orange-500/10 text-orange-700 border-orange-200">Pendente</Badge>
                <Button size="sm" className="gap-1 text-xs" onClick={() => abrir(p)}>
                  <KeyRound className="h-3 w-3" /> Repor
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><KeyRound className="h-5 w-5 text-primary" /> Senha Provisória</DialogTitle>
            <DialogDescription className="text-xs">{selected?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Senha provisória</Label>
              <div className="flex gap-2">
                <Input value={senha} onChange={(e) => setSenha(e.target.value)} className="font-mono" />
                <Button variant="outline" size="icon" onClick={() => setSenha(gerarSenhaProvisoria())}><RefreshCw className="h-4 w-4" /></Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              A senha é enviada para o email do utilizador e terá de ser alterada no primeiro acesso.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button onClick={aplicar} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Definir e enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}