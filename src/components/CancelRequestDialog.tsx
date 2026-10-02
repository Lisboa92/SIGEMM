import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Ban, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  multa: { id: string; numero?: string | null; infrator_nome?: string | null } | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmitted?: () => void;
}

/**
 * Pedido de cancelamento de multa — fluxo oficial do SIGEMM:
 * o solicitante escolhe o Presidente do Município, que autoriza (ou recusa).
 */
export default function CancelRequestDialog({ multa, open, onOpenChange, onSubmitted }: Props) {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { nivelAcesso } = useUserRole();
  const [presidentes, setPresidentes] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState<any | null>(null);
  const [motivo, setMotivo] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery(''); setSel(null); setMotivo(''); setPassword('');
    supabase.from('agentes')
      .select('id, nome, email, nivel_acesso')
      .in('nivel_acesso', ['superadmin', 'presidente'])
      .eq('activo', true)
      .order('nome')
      .then(({ data }) => setPresidentes(data ?? []));
  }, [open]);

  const sugestoes = query.trim().length === 0
    ? presidentes
    : presidentes.filter(p =>
        (p.nome || '').toLowerCase().includes(query.toLowerCase()) ||
        (p.email || '').toLowerCase().includes(query.toLowerCase()));

  async function enviar() {
    if (!multa) return;
    if (!sel) {
      toast.error(lang === 'en' ? 'Select the Municipal President who will authorize' : 'Seleccione o Presidente do Município que irá autorizar');
      return;
    }
    if (!password) {
      toast.error(lang === 'en' ? 'Enter your password' : 'Introduza a sua senha');
      return;
    }
    setSending(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user?.email || '', password,
      });
      if (authErr) {
        toast.error(lang === 'en' ? 'Incorrect password' : 'Senha incorrecta');
        setSending(false);
        return;
      }

      const { error: insertErr } = await supabase.from('cancel_requests').insert({
        multa_id: multa.id,
        requester_user_id: user?.id,
        requester_email: user?.email,
        requester_role: nivelAcesso,
        approver_role: 'presidente',
        approver_email: sel.email,
        approver_nome: sel.nome,
        motivo: motivo.trim() || null,
      } as any);
      if (insertErr) {
        toast.error((lang === 'en' ? 'Error creating request: ' : 'Erro ao criar pedido: ') + insertErr.message);
        setSending(false);
        return;
      }

      const agentInfo = await supabase.from('agentes').select('local_trabalho').eq('email', user?.email || '').maybeSingle();

      await supabase.from('notifications').insert({
        message: `Pedido de cancelamento: ${multa.infrator_nome} (${multa.numero}) — solicitado por ${user?.email}${motivo.trim() ? ` · Motivo: ${motivo.trim()}` : ''}`,
        action: 'CANCELAR_MULTA',
        resource_id: multa.id,
        local_trabalho: agentInfo.data?.local_trabalho || 'via_publica',
        created_by: user?.id,
        target_role: 'presidente',
      } as any);

      await supabase.functions.invoke('notify-email', {
        body: {
          to: sel.email,
          subject: `SIGEMM — Pedido de cancelamento da multa ${multa.numero}`,
          message: `Foi recebido um pedido de cancelamento da multa ${multa.numero} (infractor: ${multa.infrator_nome}), solicitado por ${user?.email}.${motivo.trim() ? `\n\nMotivo: ${motivo.trim()}` : ''}\n\nAceda ao SIGEMM e abra o sino de notificações para autorizar ou recusar o pedido.`,
        },
      }).catch(() => {});

      await supabase.from('audit_log').insert({
        user_id: user?.id, action: 'PEDIDO_CANCELAMENTO', resource_id: multa.id,
        details: `Pedido de cancelamento da multa ${multa.numero} enviado a ${sel.nome} (${sel.email})`,
      } as any);

      toast.success(lang === 'en' ? `Request sent to Municipal President ${sel.nome}.` : `Pedido enviado ao Presidente do Município ${sel.nome}.`);
      onOpenChange(false);
      onSubmitted?.();
    } catch {
      toast.error(lang === 'en' ? 'Unexpected error' : 'Erro inesperado');
    }
    setSending(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Ban className="h-5 w-5" /> {lang === 'en' ? 'Request Cancellation' : 'Solicitar Cancelamento'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {lang === 'en'
              ? `Cancellation of fine ${multa?.numero} requires authorization from the Municipal President.`
              : `O cancelamento da multa ${multa?.numero} carece de autorização do Presidente do Município.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">{lang === 'en' ? 'Municipal President *' : 'Presidente do Município *'}</Label>
            <Input
              placeholder={lang === 'en' ? "Type President's name or email" : "Escreva o nome ou email do Presidente"}
              value={sel ? `${sel.nome} · ${sel.email}` : query}
              onChange={(e) => { setSel(null); setQuery(e.target.value); }}
            />
            {!sel && (
              <div className="max-h-36 overflow-y-auto rounded-md border border-border divide-y divide-border">
                {sugestoes.length === 0 ? (
                  <p className="p-2 text-[11px] text-muted-foreground">{lang === 'en' ? 'No Municipal President found.' : 'Nenhum Presidente do Município encontrado.'}</p>
                ) : sugestoes.map(p => (
                  <button key={p.id} type="button"
                    className="w-full text-left px-2 py-1.5 hover:bg-muted/60 transition-colors"
                    onClick={() => { setSel(p); setQuery(''); }}>
                    <p className="text-xs font-semibold text-foreground">{p.nome}</p>
                    <p className="text-[10px] text-muted-foreground">{p.email}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">{lang === 'en' ? 'Reason for request' : 'Motivo do pedido'}</Label>
            <Input placeholder={lang === 'en' ? 'Reason (optional)' : 'Motivo (opcional)'} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">{lang === 'en' ? 'Your Password' : 'Sua Senha'}</Label>
            <div className="relative">
              <Input type={showPwd ? 'text' : 'password'} placeholder={lang === 'en' ? 'Your password' : 'A sua senha'}
                value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPwd(!showPwd)}>
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="destructive" onClick={enviar} disabled={sending} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            {sending ? t('common.loading') : (lang === 'en' ? 'Send Request' : 'Enviar Pedido')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
