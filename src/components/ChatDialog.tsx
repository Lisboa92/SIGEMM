import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Send, Loader2, MessageSquare, Image, Mic, Video, FileText, Paperclip, X,
} from 'lucide-react';
import { AudioMessagePlayer } from '@/components/AudioMessagePlayer';

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

interface ChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otherUserId: string;
  otherUserEmail: string;
  otherUserNome: string;
  onClose?: () => void;
}

export function ChatDialog({ open, onOpenChange, otherUserId, otherUserEmail, otherUserNome, onClose }: ChatDialogProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attachment, setAttachment] = useState<{ file: File; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadConversation = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from('agent_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(100);

    setMessages((data as Message[]) ?? []);

    // Mark received as read
    await supabase.from('agent_messages')
      .update({ read: true } as any)
      .eq('sender_id', otherUserId)
      .eq('receiver_id', user.id)
      .eq('read', false);

    setLoading(false);
  }, [user, otherUserId]);

  useEffect(() => {
    if (!open || !user) return;
    loadConversation();

    const channel = supabase
      .channel(`chat-${otherUserId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'agent_messages',
      }, (payload) => {
        const msg = payload.new as Message;
        if (
          (msg.sender_id === user.id && msg.receiver_id === otherUserId) ||
          (msg.sender_id === otherUserId && msg.receiver_id === user.id)
        ) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (msg.sender_id === otherUserId) {
            supabase.from('agent_messages').update({ read: true } as any).eq('id', msg.id);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [open, otherUserId, user, loadConversation]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    if ((!text.trim() && !attachment) || !user) return;
    setSending(true);

    let content = text.trim();

    // Handle file upload
    if (attachment) {
      setUploading(true);
      const ext = attachment.file.name.split('.').pop();
      const path = `chat/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('multa-fotos')
        .upload(path, attachment.file);

      if (uploadError) {
        toast.error('Erro ao enviar ficheiro.');
        setUploading(false);
        setSending(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('multa-fotos').getPublicUrl(path);
      const fileTag = attachment.type === 'image' ? `[📷 Foto]` :
        attachment.type === 'video' ? `[🎥 Vídeo]` :
          attachment.type === 'audio' ? `[🎤 Áudio]` : `[📎 Ficheiro]`;
      content = `${fileTag} ${urlData.publicUrl}${content ? '\n' + content : ''}`;
      setUploading(false);
    }

    const { data: senderData } = await supabase
      .from('agentes')
      .select('nome')
      .eq('email', user.email || '')
      .maybeSingle();

    const { data: inserted, error } = await supabase.from('agent_messages').insert({
      sender_id: user.id,
      receiver_id: otherUserId,
      sender_email: user.email || '',
      receiver_email: otherUserEmail,
      sender_nome: senderData?.nome || user.email,
      receiver_nome: otherUserNome,
      content,
    } as any).select().single();

    if (error) {
      toast.error('Erro ao enviar mensagem.');
    } else {
      if (inserted) {
        setMessages(prev => {
          if (prev.some(m => m.id === (inserted as any).id)) return prev;
          return [...prev, inserted as Message];
        });
      }
      setText('');
      setAttachment(null);

      // Create notification for receiver
      try {
        const { data: receiverAgent } = await supabase
          .from('agentes')
          .select('local_trabalho')
          .eq('email', otherUserEmail)
          .maybeSingle();

        await supabase.from('notifications').insert({
          message: `Nova mensagem de ${senderData?.nome || user.email}`,
          action: 'MENSAGEM',
          local_trabalho: receiverAgent?.local_trabalho || 'via_publica',
          created_by: user.id,
          resource_id: user.id,
        } as any);
      } catch {}
    }
    setSending(false);
  }

  const handleFileSelect = (type: string, accept: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.dataset.type = type;
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const type = e.target.dataset.type || 'file';
      setAttachment({ file, type });
    }
    e.target.value = '';
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' });
  };

  const renderContent = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const hasFileTag = content.startsWith('[📷') || content.startsWith('[🎥') || content.startsWith('[🎤') || content.startsWith('[📎');

    if (hasFileTag) {
      const parts = content.split('\n');
      const firstLine = parts[0];
      const rest = parts.slice(1).join('\n');
      const urlMatch = firstLine.match(urlRegex);

      if (urlMatch) {
        const url = urlMatch[0];
        if (content.startsWith('[📷')) {
          return (
            <div>
              <img src={url} alt="Foto" className="max-w-[200px] rounded-lg mb-1 cursor-pointer" onClick={() => window.open(url, '_blank')} />
              {rest && <p className="text-xs">{rest}</p>}
            </div>
          );
        }
        if (content.startsWith('[🎥')) {
          return (
            <div>
              <video src={url} controls className="max-w-[200px] rounded-lg mb-1" />
              {rest && <p className="text-xs">{rest}</p>}
            </div>
          );
        }
        if (content.startsWith('[🎤')) {
          return (
            <div className="my-1">
              <AudioMessagePlayer src={url} />
              {rest && <p className="text-xs mt-1">{rest}</p>}
            </div>
          );
        }
        return (
          <div>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs underline">📎 Abrir ficheiro</a>
            {rest && <p className="text-xs mt-1">{rest}</p>}
          </div>
        );
      }
    }

    return <p className="text-xs leading-relaxed whitespace-pre-wrap">{content}</p>;
  };

  let lastDate = '';

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v && onClose) onClose(); }}>
      <DialogContent className="max-w-lg h-[70vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border bg-card shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">{otherUserNome[0]?.toUpperCase()}</span>
            </div>
            <div>
              <p className="font-semibold">{otherUserNome}</p>
              <p className="text-[10px] text-muted-foreground font-normal">{otherUserEmail}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 bg-muted/30">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <MessageSquare className="h-8 w-8 opacity-40" />
              <p className="text-xs">Inicie a conversa</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === user?.id;
              const msgDate = formatDate(msg.created_at);
              let showDate = false;
              if (msgDate !== lastDate) {
                lastDate = msgDate;
                showDate = true;
              }

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="text-center my-3">
                      <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{msgDate}</span>
                    </div>
                  )}
                  <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
                    <div className={`max-w-[75%] px-3 py-2 rounded-2xl ${
                      isMine
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-card border border-border text-foreground rounded-bl-md'
                    }`}>
                      {renderContent(msg.content)}
                      <p className={`text-[9px] mt-1 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'} text-right`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Attachment preview */}
        {attachment && (
          <div className="px-4 py-2 bg-muted/50 border-t border-border flex items-center gap-2 shrink-0">
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-foreground truncate flex-1">{attachment.file.name}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAttachment(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Input area */}
        <div className="p-3 border-t border-border bg-card shrink-0">
          <div className="flex items-center gap-1.5 mb-2">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleFileSelect('image', 'image/*')}>
              <Image className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleFileSelect('video', 'video/*')}>
              <Video className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleFileSelect('audio', 'audio/*')}>
              <Mic className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleFileSelect('file', '*/*')}>
              <FileText className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escreva uma mensagem..."
              className="flex-1 h-9 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleSend}
              disabled={(!text.trim() && !attachment) || sending || uploading}
            >
              {sending || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
      </DialogContent>
    </Dialog>
  );
}
