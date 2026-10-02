import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useUserRole, canAccess } from '@/hooks/useUserRole';
import { Bell, Eye, EyeOff, Loader2, Ban, ShieldCheck, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface Notification {
  id: string;
  message: string;
  action: string;
  local_trabalho: string;
  created_at: string;
  resource_id: string | null;
  created_by?: string | null;
  target_user_id?: string | null;
  target_role?: string | null;
}

export function NotificationBell() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { nivelAcesso } = useUserRole();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [userLocal, setUserLocal] = useState<string>('');
  const [menuOpen, setMenuOpen] = useState(false);

  // Cancel approval dialog state
  const [approvalDialog, setApprovalDialog] = useState(false);
  const [approvalRequestId, setApprovalRequestId] = useState<string | null>(null);
  const [approvalMultaInfo, setApprovalMultaInfo] = useState<string>('');
  const [approvalPassword, setApprovalPassword] = useState('');
  const [showApprovalPwd, setShowApprovalPwd] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('agentes')
      .select('local_trabalho')
      .eq('email', user.email || '')
      .maybeSingle()
      .then(({ data }) => {
        setUserLocal(data?.local_trabalho || 'via_publica');
      });
  }, [user]);

  useEffect(() => {
    if (!userLocal) return;

    const isForMe = (n: Notification) => {
      if (n.target_user_id) return n.target_user_id === user?.id;
      if (n.target_role) return n.target_role === nivelAcesso;
      return n.local_trabalho === userLocal;
    };

    const load = async () => {
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60);
      setNotifications(((notifs as Notification[]) ?? []).filter(isForMe).slice(0, 20));

      const { data: reads } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user?.id || '');
      setReadIds(new Set((reads || []).map((r: any) => r.notification_id)));
    };

    load();

    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const n = payload.new as Notification;
        if (isForMe(n)) {
          setNotifications(prev => [n, ...prev].slice(0, 20));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userLocal, user, nivelAcesso]);

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  const markAllRead = async () => {
    if (!user) return;
    const unread = notifications.filter(n => !readIds.has(n.id));
    if (unread.length === 0) return;
    const inserts = unread.map(n => ({ notification_id: n.id, user_id: user.id }));
    await supabase.from('notification_reads').upsert(inserts as any[], { onConflict: 'notification_id,user_id' });
    setReadIds(new Set(notifications.map(n => n.id)));
  };

  // Helper to extract fine numbers, document numbers, or usernames from message text if resource_id is missing
  const extractSubjectIdentifier = (n: Notification): string | null => {
    if (n.resource_id && n.resource_id.trim()) {
      return n.resource_id.trim();
    }
    const msg = n.message || '';
    // Look for fine numbers like M-2026-0001 or AUTO-0012 or (M-2026-...)
    const multaMatch = msg.match(/\b(M-\d{4}-\d+|\b\d{4}\/\d{2,6}\b|AUTO-[\w-]+)\b/i);
    if (multaMatch) return multaMatch[1];

    // Look for email addresses
    const emailMatch = msg.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) return emailMatch[1];

    return null;
  };

  const handleNotificationClick = async (n: Notification) => {
    setMenuOpen(false);

    // Mark as read in state & DB
    if (!readIds.has(n.id) && user) {
      supabase.from('notification_reads').upsert(
        [{ notification_id: n.id, user_id: user.id }] as any[],
        { onConflict: 'notification_id,user_id' }
      ).catch(() => {});
      setReadIds(prev => new Set([...prev, n.id]));
    }

    const action = (n.action || '').toUpperCase();
    const resourceId = extractSubjectIdentifier(n);
    const senderId = n.created_by;
    const msg = (n.message || '').toLowerCase();

    // 1. Cancellation request approvals for presidente
    if ((action === 'CANCELAR_MULTA' || action === 'PEDIDO_CANCELAMENTO' || msg.includes('pedido de cancelamento')) && nivelAcesso === 'presidente') {
      if (resourceId) {
        const { data: requests } = await supabase
          .from('cancel_requests')
          .select('*')
          .or(`multa_id.eq.${resourceId},id.eq.${resourceId}`)
          .eq('status', 'pending')
          .limit(1);

        if (requests && requests.length > 0) {
          setApprovalRequestId((requests[0] as any).id);
          setApprovalMultaInfo(n.message);
          setApprovalPassword('');
          setApprovalDialog(true);
          return;
        }
      }
      navigate(resourceId ? `/historico?multa=${encodeURIComponent(resourceId)}` : '/historico');
      return;
    }

    // 2. Chat / Agent Messages
    if (action === 'MENSAGEM' || action === 'NOVA_MENSAGEM' || action === 'CHAT' || msg.includes('mensagem')) {
      const targetUser = senderId || resourceId;
      if (targetUser) {
        window.dispatchEvent(new CustomEvent('open-user-chat', {
          detail: {
            targetUserId: targetUser,
            targetUserEmail: targetUser.includes('@') ? targetUser : undefined,
          }
        }));
        navigate(`/perfil?tab=mensagens&sender=${encodeURIComponent(targetUser)}`);
      } else {
        window.dispatchEvent(new CustomEvent('open-user-chat', { detail: {} }));
        navigate('/perfil?tab=mensagens');
      }
      return;
    }

    // 3. Fines creation & history
    if (action === 'CRIAR_MULTA' || action === 'MULTA_CRIADA' || action === 'NOVA_MULTA' || action === 'CANCELAR_MULTA' || action === 'CANCELAMENTO_APROVADO' || action === 'CANCELAMENTO_RECUSADO') {
      if (resourceId) {
        navigate(`/historico?multa=${encodeURIComponent(resourceId)}`);
      } else {
        navigate('/historico');
      }
      return;
    }

    // 4. Payments
    if (action === 'PAGAMENTO' || action === 'PAGAMENTO_MULTA' || action === 'MULTA_PAGA' || action === 'NOVO_PAGAMENTO' || msg.includes('pagamento') || msg.includes('paga via')) {
      if (resourceId) {
        navigate(`/pagamentos?multa=${encodeURIComponent(resourceId)}`);
      } else {
        navigate('/pagamentos');
      }
      return;
    }

    // 5. Complaints (Reclamações)
    if (action === 'RECLAMACAO' || action === 'RECLAMACAO_CRIADA' || action === 'RECLAMACAO_RESPONDIDA' || action === 'NOVA_RECLAMACAO' || msg.includes('reclamação') || msg.includes('reclamacao')) {
      if (resourceId) {
        navigate(`/reclamacoes?id=${encodeURIComponent(resourceId)}`);
      } else {
        navigate('/reclamacoes');
      }
      return;
    }

    // 6. Tribunal & overdue fines
    if (action === 'TRIBUNAL' || action === 'ENVIAR_TRIBUNAL' || action === 'FORA_PRAZO' || msg.includes('tribunal') || msg.includes('fora de prazo') || msg.includes('fora do prazo')) {
      if (resourceId) {
        navigate(`/tribunal?multa=${encodeURIComponent(resourceId)}`);
      } else {
        navigate('/tribunal');
      }
      return;
    }

    // 7. Agents & accounts
    if (action === 'RESET_SENHA' || action === 'NOVO_AGENTE' || action === 'AGENTE' || action === 'AGENTE_CRIADO' || action === 'AGENTE_ATUALIZADO' || msg.includes('agente') || msg.includes('senha')) {
      if (canAccess(nivelAcesso, 'admin')) {
        navigate(resourceId ? `/admin?tab=agentes&agentSearch=${encodeURIComponent(resourceId)}` : '/admin?tab=agentes');
      } else {
        navigate(resourceId ? `/agentes-online?search=${encodeURIComponent(resourceId)}` : '/agentes-online');
      }
      return;
    }

    // 8. Productivity & metrics
    if (action === 'PRODUTIVIDADE' || action === 'META' || action === 'RANKING' || msg.includes('produtividade') || msg.includes('meta')) {
      if (canAccess(nivelAcesso, 'supervisor')) {
        navigate('/produtividade');
      } else {
        navigate('/');
      }
      return;
    }

    // 9. Audit log
    if (action === 'AUDITORIA' || action === 'AUDIT_LOG' || msg.includes('auditoria')) {
      if (canAccess(nivelAcesso, 'admin')) {
        navigate('/admin?tab=auditoria');
      } else {
        navigate('/');
      }
      return;
    }

    // 10. Default heuristic fallback
    if (msg.includes('multa') || msg.includes('auto') || msg.includes('infracção') || msg.includes('infracao')) {
      navigate(resourceId ? `/historico?multa=${encodeURIComponent(resourceId)}` : '/historico');
    } else if (msg.includes('backup') || msg.includes('base de dados')) {
      navigate(canAccess(nivelAcesso, 'admin') ? '/admin?tab=backup' : '/');
    } else if (msg.includes('email') || msg.includes('configura')) {
      navigate('/configuracoes');
    } else {
      navigate('/');
    }
  };

  async function handleApproveCancel(action: 'approve' | 'reject') {
    if (!approvalPassword) {
      toast.error(lang === 'en' ? 'Enter your password' : 'Introduza a sua senha');
      return;
    }
    setApproving(true);
    try {
      const { data, error } = await supabase.functions.invoke('approve-cancel-multa', {
        body: {
          requestId: approvalRequestId,
          approverEmail: user?.email,
          approverPassword: approvalPassword,
          action,
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || (lang === 'en' ? 'Error processing' : 'Erro ao processar'));
      } else {
        if (action === 'approve') {
          toast.success(lang === 'en' ? 'Fine cancelled successfully!' : 'Multa cancelada com sucesso!');
          window.dispatchEvent(new CustomEvent('multas-updated'));
          setTimeout(() => navigate('/historico'), 300);
        } else {
          toast.info(lang === 'en' ? 'Cancellation request rejected.' : 'Pedido de cancelamento recusado.');
        }
        setApprovalDialog(false);
      }
    } catch {
      toast.error(lang === 'en' ? 'Unexpected error' : 'Erro inesperado');
    }
    setApproving(false);
  }

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return lang === 'en' ? 'now' : 'agora';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const actionIcon = (action: string, msg: string = '') => {
    const act = (action || '').toUpperCase();
    const text = (msg || '').toLowerCase();
    
    if (act.includes('CANCELAR') || act.includes('CANCELAMENTO') || text.includes('cancelamento')) return '🚫';
    if (act.includes('PAGAMENTO') || act.includes('PAGA') || text.includes('pagamento') || text.includes('paga via')) return '💳';
    if (act.includes('MENSAGEM') || act.includes('CHAT') || text.includes('mensagem')) return '💬';
    if (act.includes('RECLAMACAO') || text.includes('reclamação') || text.includes('reclamacao')) return '⚠️';
    if (act.includes('TRIBUNAL') || act.includes('FORA_PRAZO') || text.includes('tribunal') || text.includes('fora de prazo')) return '⚖️';
    if (act.includes('AGENTE') || text.includes('agente')) return '👤';
    if (act.includes('SENHA') || text.includes('senha')) return '🔑';
    if (act.includes('AUDITORIA') || act.includes('LOG') || text.includes('auditoria')) return '🛡️';
    if (act.includes('PRODUTIVIDADE') || act.includes('META') || act.includes('RANKING') || text.includes('produtividade')) return '🏆';
    if (act.includes('MULTA') || text.includes('multa') || text.includes('auto')) return '📝';
    return '🔔';
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10" title={t('header.notifications')}>
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 sm:w-76 max-w-[88vw] p-0 shadow-lg border-border/80 rounded-xl overflow-hidden">
          <DropdownMenuLabel className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/50">
            <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <Bell className="h-3.5 w-3.5 text-primary" />
              {t('header.notifications')}
              {unreadCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/15 text-primary font-bold">
                  {unreadCount}
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] text-primary hover:underline font-medium cursor-pointer">
                {t('header.markAllRead')}
              </button>
            )}
          </DropdownMenuLabel>
          <ScrollArea className="max-h-[260px]">
            {notifications.length === 0 ? (
              <div className="py-6 px-4 text-center text-[11px] text-muted-foreground flex flex-col items-center justify-center gap-1.5">
                <Bell className="h-6 w-6 text-muted-foreground/30" />
                <span>{t('header.noNotifications')}</span>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-2.5 py-2 border-b border-border/40 last:border-0 hover:bg-muted/60 transition-colors group cursor-pointer ${!readIds.has(n.id) ? 'bg-primary/5' : 'opacity-85'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 flex items-start gap-2">
                      <span className="text-sm shrink-0 select-none pt-0.5 group-hover:scale-105 transition-transform">
                        {actionIcon(n.action, n.message)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1">
                          {!readIds.has(n.id) && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary shrink-0 self-center" />}
                          <span className={`text-[11px] leading-tight break-words text-foreground ${!readIds.has(n.id) ? 'font-medium' : ''}`}>
                            {n.message}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] text-muted-foreground shrink-0 pt-0.5 font-mono">{formatTime(n.created_at)}</span>
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Cancel Approval Dialog with Approve/Reject */}
      <Dialog open={approvalDialog} onOpenChange={setApprovalDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-destructive" />
              {lang === 'en' ? 'Approve Cancellation' : 'Aprovar Cancelamento'}
            </DialogTitle>
            <DialogDescription>{approvalMultaInfo}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {lang === 'en'
                ? 'Enter your password to confirm or reject the cancellation of this fine.'
                : 'Introduza a sua senha para confirmar ou recusar o cancelamento desta multa.'}
            </p>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{lang === 'en' ? 'Your Password' : 'Sua Senha'}</Label>
              <div className="relative">
                <Input
                  type={showApprovalPwd ? 'text' : 'password'}
                  placeholder={lang === 'en' ? 'Your password' : 'A sua senha'}
                  value={approvalPassword}
                  onChange={(e) => setApprovalPassword(e.target.value)}
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowApprovalPwd(!showApprovalPwd)}>
                  {showApprovalPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => handleApproveCancel('reject')} disabled={approving} className="gap-1.5 flex-1">
              <XCircle className="h-4 w-4" /> {lang === 'en' ? 'Reject' : 'Recusar'}
            </Button>
            <Button variant="destructive" onClick={() => handleApproveCancel('approve')} disabled={approving} className="gap-1.5 flex-1">
              {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {lang === 'en' ? 'Approve' : 'Aprovar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
