import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { NIVEL_LABELS } from '@/hooks/useUserRole';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TwoFactorSettings from '@/components/TwoFactorSettings';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ChatDialog } from '@/components/ChatDialog';
import { NewMessageDialog } from '@/components/NewMessageDialog';
import {
  Shield, Mail, Phone, Hash, Calendar, UserCheck, Briefcase, MapPin, Award,
  MessageSquare, Send, Inbox, Loader2, Pencil, Save, X, Lock, Reply, PlusCircle, Camera, ImageIcon
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface AgenteInfo {
  nome: string;
  email: string;
  numero_agente: string;
  cargo: string;
  telefone: string | null;
  activo: boolean;
  created_at: string;
  local_trabalho: string;
  nivel_acesso: string;
  foto_url: string | null;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_email: string;
  receiver_email: string;
  sender_nome: string | null;
  receiver_nome: string | null;
  content: string;
  read: boolean;
  created_at: string;
}

export default function PerfilPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [agente, setAgente] = useState<AgenteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [receivedMessages, setReceivedMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const editDataRef = useRef({ nome: '', telefone: '', cargo: '' });
  const [saving, setSaving] = useState(false);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState<{ id: string; email: string; nome: string } | null>(null);
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Handle direct navigation from notification (e.g. ?tab=mensagens&sender=...)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
    const senderParam = searchParams.get('sender') || searchParams.get('chatUserId') || searchParams.get('chatUserEmail');
    if (senderParam && user) {
      setActiveTab('mensagens');
      (async () => {
        // Try looking up in agentes
        let query = supabase.from('agentes').select('id, email, nome');
        if (senderParam.includes('@')) {
          query = query.eq('email', senderParam);
        } else {
          query = query.eq('id', senderParam);
        }
        const { data: targetAgent } = await query.maybeSingle();
        if (targetAgent) {
          setChatTarget({
            id: targetAgent.id,
            email: targetAgent.email,
            nome: targetAgent.nome || targetAgent.email,
          });
          setChatOpen(true);
        } else {
          // If not in agentes, check in messages table
          const { data: msg } = await supabase
            .from('agent_messages')
            .select('sender_id, sender_email, sender_nome')
            .or(`sender_id.eq.${senderParam},sender_email.eq.${senderParam}`)
            .limit(1)
            .maybeSingle();
          if (msg) {
            setChatTarget({
              id: msg.sender_id,
              email: msg.sender_email,
              nome: msg.sender_nome || msg.sender_email,
            });
            setChatOpen(true);
          }
        }
        searchParams.delete('sender');
        searchParams.delete('chatUserId');
        searchParams.delete('chatUserEmail');
        searchParams.delete('tab');
        setSearchParams(searchParams, { replace: true });
      })();
    }
  }, [searchParams, setSearchParams, user]);

  useEffect(() => {
    async function fetchAgente() {
      if (!user?.email) { setLoading(false); return; }
      const { data } = await supabase
        .from('agentes')
        .select('nome, email, numero_agente, cargo, telefone, activo, created_at, local_trabalho, nivel_acesso, foto_url')
        .eq('email', user.email)
        .maybeSingle();
      setAgente(data);
      if (data) {
        editDataRef.current = { nome: data.nome || '', telefone: data.telefone || '', cargo: data.cargo || '' };
      }
      setLoading(false);
    }
    fetchAgente();
  }, [user?.email]);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    setMessagesLoading(true);
    const [{ data: sent }, { data: received }] = await Promise.all([
      supabase.from('agent_messages').select('*').eq('sender_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('agent_messages').select('*').eq('receiver_id', user.id).order('created_at', { ascending: false }).limit(50),
    ]);
    setSentMessages((sent as Message[]) ?? []);
    setReceivedMessages((received as Message[]) ?? []);
    await supabase.from('agent_messages').update({ read: true } as any).eq('receiver_id', user.id).eq('read', false);
    setMessagesLoading(false);
  }, [user]);

  useEffect(() => {
    if (activeTab === 'mensagens') loadMessages();
  }, [activeTab, loadMessages]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('my-messages')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'agent_messages',
      }, (payload) => {
        const msg = payload.new as Message;
        if (msg.receiver_id === user.id) {
          setReceivedMessages(prev => [msg, ...prev]);
        }
        if (msg.sender_id === user.id) {
          setSentMessages(prev => [msg, ...prev]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleStartEdit = () => {
    if (agente) {
      editDataRef.current = { nome: agente.nome || '', telefone: agente.telefone || '', cargo: agente.cargo || '' };
    }
    setEditKey(k => k + 1);
    setEditing(true);
  };

  const handleCancelEdit = () => setEditing(false);

  const handleSave = async () => {
    const ed = editDataRef.current;
    if (!user?.email || !ed.nome.trim()) {
      toast.error('O nome não pode estar vazio.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('agentes')
      .update({
        nome: ed.nome.trim(),
        telefone: ed.telefone.trim() || null,
        cargo: ed.cargo.trim(),
      })
      .eq('email', user.email);

    if (error) {
      toast.error('Erro ao guardar alterações.');
    } else {
      setAgente(prev => prev ? {
        ...prev,
        nome: ed.nome.trim(),
        telefone: ed.telefone.trim() || null,
        cargo: ed.cargo.trim(),
      } : prev);
      toast.success('Perfil actualizado com sucesso!');
      setEditing(false);
    }
    setSaving(false);
  };

  const handlePhotoUpload = async (file: File) => {
    if (!user?.id || !user?.email) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = urlData.publicUrl + '?t=' + Date.now();
      await supabase.from('agentes').update({ foto_url: publicUrl }).eq('email', user.email!);
      setAgente(prev => prev ? { ...prev, foto_url: publicUrl } : prev);
      toast.success('Foto de perfil actualizada!');
      setPhotoDialogOpen(false);
    } catch (err: any) {
      toast.error('Erro ao enviar foto: ' + (err.message || err));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const openChat = (msg: Message) => {
    const isReceived = msg.receiver_id === user?.id;
    const targetId = isReceived ? msg.sender_id : msg.receiver_id;
    const targetEmail = isReceived ? msg.sender_email : msg.receiver_email;
    const targetNome = (isReceived ? msg.sender_nome : msg.receiver_nome) || targetEmail;
    window.dispatchEvent(new CustomEvent('open-user-chat', {
      detail: {
        targetUserId: targetId,
        targetUserEmail: targetEmail,
        targetUserNome: targetNome,
      }
    }));
  };

  const initials = agente?.nome
    ? agente.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || 'U';

  const memberSince = agente?.created_at
    ? new Date(agente.created_at).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'long', year: 'numeric' })
    : user?.created_at
      ? new Date(user.created_at).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'long', year: 'numeric' })
      : '—';

  const localTrabalhoLabel = (val: string) => {
    const map: Record<string, string> = { via_publica: 'Via Pública', escritorio: 'Escritório', campo: 'Campo', sede: 'Sede CMM', machava: 'Posto Machava', t3: 'Posto T3' };
    return map[val] || val;
  };

  const nivelAcessoLabel = (val: string) => NIVEL_LABELS[val] || val;

  const formatMsgTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' }) + ' ' +
      d.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' });
  };

  const InfoRow = ({ icon: Icon, label, value, locked }: { icon: React.ElementType; label: string; value: string | null | undefined; locked?: boolean }) => (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1">
          {label}
          {locked && <Lock className="h-2.5 w-2.5 text-muted-foreground/50" />}
        </p>
        <p className="text-sm font-semibold text-foreground truncate mt-0.5">{value || '—'}</p>
      </div>
    </div>
  );

  const EditRow = ({ icon: Icon, label, field, placeholder }: {
    icon: React.ElementType; label: string; field: 'nome' | 'telefone' | 'cargo'; placeholder?: string;
  }) => (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-1">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">{label}</p>
        <Input
          key={editKey}
          defaultValue={editDataRef.current[field]}
          onChange={(e) => {
            editDataRef.current[field] = e.target.value;
          }}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
      </div>
    </div>
  );

  const MessageCard = ({ msg, type }: { msg: Message; type: 'sent' | 'received' }) => (
    <button
      onClick={() => openChat(msg)}
      className={`w-full text-left p-3 rounded-xl border transition-all hover:shadow-md active:scale-[0.98] ${
        type === 'received' && !msg.read
          ? 'bg-primary/5 border-primary/20'
          : 'bg-card border-border hover:border-primary/20'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary">
              {(type === 'sent' ? msg.receiver_nome : msg.sender_nome)?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
          <p className="text-xs font-semibold text-foreground truncate">
            {type === 'sent'
              ? msg.receiver_nome || msg.receiver_email
              : msg.sender_nome || msg.sender_email}
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{formatMsgTime(msg.created_at)}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 pl-9">{msg.content}</p>
      {type === 'received' && (
        <div className="flex justify-end mt-1.5">
          <span className="text-[10px] text-primary flex items-center gap-0.5">
            <Reply className="h-3 w-3" /> Responder
          </span>
        </div>
      )}
    </button>
  );

  const unreadCount = receivedMessages.filter(m => !m.read).length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Profile Header Card */}
      <Card className="overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10" />
        <div className="relative p-6 flex flex-col sm:flex-row items-center gap-5">
          <div className="relative group cursor-pointer" onClick={() => setPhotoDialogOpen(true)}>
            <Avatar className="h-24 w-24 border-4 border-primary/30 shadow-xl ring-4 ring-primary/10">
              {agente?.foto_url && <AvatarImage src={agente.foto_url} alt="Avatar" className="object-cover" />}
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-3xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="h-6 w-6 text-white" />
            </div>
            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-background ${agente?.activo !== false ? 'bg-green-500' : 'bg-destructive'}`} />
          </div>
           <div className="text-center sm:text-left space-y-1.5 min-w-0">
            <h2 className="text-xl font-bold text-foreground truncate">
              {loading ? '...' : agente?.nome || user?.email}
            </h2>
            <p className="text-sm text-muted-foreground font-medium">{agente?.cargo || 'Agente Municipal'}</p>
            <p className="text-xs text-muted-foreground/70">{agente?.email || user?.email}</p>
            <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
              <Badge variant={agente?.activo !== false ? 'default' : 'destructive'} className="text-xs">
                {agente?.activo !== false ? '● Activo' : '● Inactivo'}
              </Badge>
              {agente?.nivel_acesso && (
                <Badge variant="secondary" className="text-xs">
                  {nivelAcessoLabel(agente.nivel_acesso)}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="info" className="text-xs">
            <Shield className="h-3.5 w-3.5 mr-1.5" />
            Informações
          </TabsTrigger>
          <TabsTrigger value="mensagens" className="text-xs relative">
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            Mensagens
            {unreadCount > 0 && (
              <span className="ml-1.5 h-4 w-4 rounded-full bg-destructive text-[9px] text-destructive-foreground flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info" className="space-y-4 mt-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Informações Pessoais
              </h3>
              {!editing ? (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={handleStartEdit}>
                  <Pencil className="h-3 w-3 mr-1" /> Editar
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={handleCancelEdit} disabled={saving}>
                    <X className="h-3 w-3 mr-1" /> Cancelar
                  </Button>
                  <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                    Guardar
                  </Button>
                </div>
              )}
            </div>
            <div>
              {editing ? (
                <>
                  <EditRow icon={UserCheck} label="Nome Completo" field="nome" placeholder="Seu nome completo" />
                  <InfoRow icon={Mail} label="Email" value={agente?.email || user?.email} locked />
                  <InfoRow icon={Hash} label="Número de Agente" value={agente?.numero_agente} locked />
                  <EditRow icon={Phone} label="Telefone" field="telefone" placeholder="+258 84 000 0000" />
                </>
              ) : (
                <>
                  <InfoRow icon={UserCheck} label="Nome Completo" value={agente?.nome} />
                  <InfoRow icon={Mail} label="Email" value={agente?.email || user?.email} locked />
                  <InfoRow icon={Hash} label="Número de Agente" value={agente?.numero_agente} locked />
                  <InfoRow icon={Phone} label="Telefone" value={agente?.telefone} />
                </>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" />
              Informações Profissionais
            </h3>
            <div>
              {editing ? (
                <EditRow icon={Briefcase} label="Cargo" field="cargo" placeholder="Ex: Agente de Trânsito" />
              ) : (
                <InfoRow icon={Briefcase} label="Cargo" value={agente?.cargo} />
              )}
              <InfoRow icon={MapPin} label="Local de Trabalho" value={agente?.local_trabalho ? localTrabalhoLabel(agente.local_trabalho) : undefined} locked />
              <InfoRow icon={Award} label="Nível de Acesso" value={agente?.nivel_acesso ? nivelAcessoLabel(agente.nivel_acesso) : undefined} locked />
              <InfoRow icon={Calendar} label="Membro desde" value={memberSince} locked />
            </div>
          </Card>

          <TwoFactorSettings />
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="mensagens" className="mt-4">
          {/* Nova Mensagem button */}
          <div className="mb-3">
            <Button
              onClick={() => window.dispatchEvent(new CustomEvent('open-user-chat'))}
              className="w-full h-10 text-sm gap-2 bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              <PlusCircle className="h-4 w-4" />
              Nova Conversa no Chat dos Agentes
            </Button>
          </div>

          {messagesLoading ? (
            <Card className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Carregando mensagens...
            </Card>
          ) : (
            <Tabs defaultValue="recebidas">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="recebidas" className="text-xs">
                  <Inbox className="h-3.5 w-3.5 mr-1" /> Recebidas ({receivedMessages.length})
                </TabsTrigger>
                <TabsTrigger value="enviadas" className="text-xs">
                  <Send className="h-3.5 w-3.5 mr-1" /> Enviadas ({sentMessages.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="recebidas" className="mt-3">
                {receivedMessages.length === 0 ? (
                  <Card className="p-6 text-center text-muted-foreground">
                    <Inbox className="h-7 w-7 mx-auto opacity-50 mb-2" />
                    <p className="text-xs">Sem mensagens recebidas</p>
                  </Card>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-2">
                      {receivedMessages.map(msg => (
                        <MessageCard key={msg.id} msg={msg} type="received" />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="enviadas" className="mt-3">
                {sentMessages.length === 0 ? (
                  <Card className="p-6 text-center text-muted-foreground">
                    <Send className="h-7 w-7 mx-auto opacity-50 mb-2" />
                    <p className="text-xs">Sem mensagens enviadas</p>
                  </Card>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-2">
                      {sentMessages.map(msg => (
                        <MessageCard key={msg.id} msg={msg} type="sent" />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>
      </Tabs>

      {/* Chat Dialog */}
      {chatTarget && (
        <ChatDialog
          open={chatOpen}
          onOpenChange={setChatOpen}
          otherUserId={chatTarget.id}
          otherUserEmail={chatTarget.email}
          otherUserNome={chatTarget.nome}
          onClose={() => loadMessages()}
        />
      )}

      {/* New Message Dialog */}
      <NewMessageDialog
        open={newMsgOpen}
        onOpenChange={setNewMsgOpen}
        onSelectUser={(agent) => {
          setChatTarget(agent);
          setChatOpen(true);
        }}
      />

      {/* Photo Upload Dialog */}
      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5 text-primary" /> Trocar Foto de Perfil</DialogTitle>
            <DialogDescription>Seleccione uma foto da galeria ou tire uma foto com a câmera.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <Avatar className="h-28 w-28 border-4 border-primary/20">
              {agente?.foto_url && <AvatarImage src={agente.foto_url} alt="Avatar" className="object-cover" />}
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-3xl font-bold">{initials}</AvatarFallback>
            </Avatar>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoUpload(file);
              }}
            />
            <div className="flex gap-3">
              <Button variant="outline" className="gap-2" onClick={() => {
                if (photoInputRef.current) {
                  photoInputRef.current.removeAttribute('capture');
                  photoInputRef.current.click();
                }
              }} disabled={uploadingPhoto}>
                <ImageIcon className="h-4 w-4" /> Galeria
              </Button>
              <Button className="gap-2" onClick={() => {
                if (photoInputRef.current) {
                  photoInputRef.current.setAttribute('capture', 'environment');
                  photoInputRef.current.click();
                }
              }} disabled={uploadingPhoto}>
                <Camera className="h-4 w-4" /> Câmera
              </Button>
            </div>
            {uploadingPhoto && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> A enviar foto...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
