import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  MessageSquare, Users, X, Send, Search, Image as ImageIcon,
  Paperclip, Phone, MapPin, Minimize2, Maximize2, Check,
  CheckCheck, Volume2, VolumeX, Sparkles, Radio, Loader2,
  ArrowLeft, Circle, Clock, ShieldCheck, UserCheck, AlertCircle,
  Mic, MicOff, Square, Trash2, User as UserIcon, Video,
  FileText, Download, Play, Film
} from 'lucide-react';
import { AudioMessagePlayer } from '@/components/AudioMessagePlayer';
import { UserProfileDialog, UserProfileData } from '@/components/UserProfileDialog';

interface AgentInfo {
  id: string;
  user_id?: string;
  email: string;
  nome: string;
  cargo?: string;
  nivel_acesso?: string;
  foto_url?: string;
  telefone?: string;
  posto?: string;
  local_trabalho?: string;
  is_online: boolean;
  last_seen?: string;
  latitude?: number | null;
  longitude?: number | null;
  numero_agente?: string;
  unreadCount?: number;
  lastMessage?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
}

interface ChatMessage {
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
  pending?: boolean;
}

// Gentle pleasant audio beep synthesized via Web Audio API
function playChatNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08); // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {
    // AudioContext blocked or not supported
  }
}

const QUICK_OPERATIONAL_PHRASES = [
  '📢 Solicito apoio de viatura na via pública.',
  '🚗 Viatura em patrulha e fiscalização regular.',
  '📍 A caminho do posto de controlo.',
  '⚖️ Auto de notícia lavrado com sucesso.',
  '🚨 Ocorrência prioritária registada.',
  '👍 Recebido e compreendido, colega.',
];

// Fallback municipal system agents if none exist in DB
const DEFAULT_MUNICIPAL_USERS: Partial<AgentInfo>[] = [
  {
    email: 'central.operacoes@matola.gov.mz',
    nome: 'Central de Operações & Rádio',
    cargo: 'Central de Despacho Operacional',
    posto: 'Comando Central Matola',
    local_trabalho: 'central_comando',
    is_online: false,
  },
  {
    email: 'fiscalizacao.transito@matola.gov.mz',
    nome: 'Brigada de Trânsito & Fiscalização',
    cargo: 'Chefe de Piquete Operacional',
    posto: 'Posto Móvel N4 / EN4',
    local_trabalho: 'via_publica',
    is_online: false,
  },
  {
    email: 'secretaria.multas@matola.gov.mz',
    nome: 'Secretaria Municipal de Trânsito',
    cargo: 'Atendimento & Registo de Autos',
    posto: 'Edifício Municipal Matola',
    local_trabalho: 'secretaria',
    is_online: false,
  }
];

export default function UserChatWidget() {
  const { user } = useAuth();
  const { lang } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Active chat state
  const [activeAgent, setActiveAgent] = useState<AgentInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Agents & Presence list
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'todos' | 'online' | 'offline' | 'unreads'>('todos');
  const [totalUnread, setTotalUnread] = useState(0);

  // Real-time typing and audio recording state (keys: user_id or email)
  const [typingUsers, setTypingUsers] = useState<Record<string, { nome: string; expiresAt: number }>>({});
  const [recordingUsers, setRecordingUsers] = useState<Record<string, { nome: string; expiresAt: number }>>({});

  // Audio Recording (Voice Notes)
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Profile Dialog state
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<UserProfileData | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const globalChannelRef = useRef<any>(null);

  // Scroll to bottom when messages update
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, scrollToBottom]);

  // Listen to custom open events (from header, search, shortcuts, agent cards)
  useEffect(() => {
    const handleOpenChatEvent = (e: any) => {
      setIsOpen(true);
      if (e.detail?.targetUserId || e.detail?.targetUserEmail) {
        const target = agents.find(
          a => (e.detail.targetUserId && a.user_id === e.detail.targetUserId) ||
               (e.detail.targetUserEmail && a.email.toLowerCase() === e.detail.targetUserEmail.toLowerCase())
        );
        if (target) {
          setActiveAgent(target);
        } else if (e.detail.targetUserEmail) {
          // Construct temporary agent item
          setActiveAgent({
            id: e.detail.targetUserId || e.detail.targetUserEmail,
            user_id: e.detail.targetUserId,
            email: e.detail.targetUserEmail,
            nome: e.detail.targetUserNome || e.detail.targetUserEmail,
            is_online: false,
          });
        }
      }
    };

    window.addEventListener('open-user-chat', handleOpenChatEvent);
    return () => window.removeEventListener('open-user-chat', handleOpenChatEvent);
  }, [agents]);

  // Load all agents and presence (both online and offline)
  const fetchAgentsAndPresence = useCallback(async () => {
    if (!user) return;
    setLoadingAgents(true);
    try {
      // 1. Fetch registered agentes
      const { data: dbAgentes } = await supabase
        .from('agentes')
        .select('id, nome, email, cargo, nivel_acesso, foto_url, telefone, local_trabalho, activo, numero_agente');

      // 2. Fetch presence records
      const { data: dbPresence } = await supabase
        .from('agent_presence')
        .select('user_id, email, nome, local_trabalho, latitude, longitude, last_seen, is_online');

      // 3. Fetch recent messages to calculate unread counts and last message
      const { data: recentMsgs } = await supabase
        .from('agent_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id},sender_email.eq.${user.email},receiver_email.eq.${user.email}`)
        .order('created_at', { ascending: false });

      const now = Date.now();
      const myEmail = (user.email || '').toLowerCase();

      // Maps to index data
      const presenceByUserId = new Map<string, any>();
      const presenceByEmail = new Map<string, any>();
      (dbPresence || []).forEach(p => {
        if (p.user_id) presenceByUserId.set(p.user_id, p);
        if (p.email) presenceByEmail.set(p.email.toLowerCase(), p);
      });

      // Gather all distinct users
      const distinctUsers = new Map<string, AgentInfo>();

      // 1) Add from dbAgentes
      (dbAgentes || []).forEach(a => {
        const em = (a.email || '').toLowerCase();
        if (!em || em === myEmail) return;

        const pres = (a.user_id ? presenceByUserId.get(a.user_id) : null) || presenceByEmail.get(em);
        const isOnline = pres?.is_online && pres.last_seen ? (now - new Date(pres.last_seen).getTime() < 180000) : false;

        distinctUsers.set(em, {
          id: a.id || a.user_id || em,
          user_id: a.user_id,
          email: a.email,
          nome: a.nome || a.email.split('@')[0],
          cargo: a.cargo || 'Agente da Polícia Municipal',
          nivel_acesso: a.nivel_acesso,
          foto_url: a.foto_url,
          telefone: a.telefone,
          posto: a.posto,
          local_trabalho: pres?.local_trabalho || a.local_trabalho,
          is_online: isOnline,
          last_seen: pres?.last_seen,
          latitude: pres?.latitude,
          longitude: pres?.longitude,
          numero_agente: a.numero_agente,
        });
      });

      // 2) Add any presence users who weren't in dbAgentes
      (dbPresence || []).forEach(p => {
        const em = (p.email || '').toLowerCase();
        if (!em || em === myEmail) return;

        if (!distinctUsers.has(em)) {
          const isOnline = p.is_online && p.last_seen ? (now - new Date(p.last_seen).getTime() < 180000) : false;
          distinctUsers.set(em, {
            id: p.user_id || em,
            user_id: p.user_id,
            email: p.email,
            nome: p.nome || em.split('@')[0],
            cargo: 'Agente em Serviço',
            local_trabalho: p.local_trabalho,
            is_online: isOnline,
            last_seen: p.last_seen,
            latitude: p.latitude,
            longitude: p.longitude,
          });
        }
      });

      // 3) Add any chat counterpart users from messages
      (recentMsgs || []).forEach(m => {
        const otherEmail = (m.sender_email?.toLowerCase() === myEmail ? m.receiver_email : m.sender_email)?.toLowerCase();
        const otherId = m.sender_email?.toLowerCase() === myEmail ? m.receiver_id : m.sender_id;
        const otherNome = m.sender_email?.toLowerCase() === myEmail ? m.receiver_nome : m.sender_nome;

        if (otherEmail && otherEmail !== myEmail && !distinctUsers.has(otherEmail)) {
          const pres = (otherId ? presenceByUserId.get(otherId) : null) || presenceByEmail.get(otherEmail);
          const isOnline = pres?.is_online && pres.last_seen ? (now - new Date(pres.last_seen).getTime() < 180000) : false;

          distinctUsers.set(otherEmail, {
            id: otherId || otherEmail,
            user_id: otherId,
            email: otherEmail,
            nome: otherNome || otherEmail.split('@')[0],
            cargo: 'Utilizador do Sistema',
            is_online: isOnline,
            last_seen: pres?.last_seen,
          });
        }
      });

      // 4) If list is very small, include municipal fallback units
      if (distinctUsers.size < 3) {
        DEFAULT_MUNICIPAL_USERS.forEach((df, idx) => {
          const dfEmail = (df.email || '').toLowerCase();
          if (dfEmail !== myEmail && !distinctUsers.has(dfEmail)) {
            distinctUsers.set(dfEmail, {
              id: `fallback-${idx}`,
              email: df.email!,
              nome: df.nome!,
              cargo: df.cargo!,
              posto: df.posto,
              local_trabalho: df.local_trabalho,
              is_online: false,
              last_seen: undefined,
            });
          }
        });
      }

      // Compute messages, unreads and last interaction for each distinct user
      const agentList: AgentInfo[] = Array.from(distinctUsers.values()).map(a => {
        const relatedMsgs = (recentMsgs || []).filter(
          m => (m.sender_id === a.user_id || m.sender_email?.toLowerCase() === a.email.toLowerCase()) ||
               (m.receiver_id === a.user_id || m.receiver_email?.toLowerCase() === a.email.toLowerCase())
        );

        const unreads = relatedMsgs.filter(
          m => (m.sender_id === a.user_id || m.sender_email?.toLowerCase() === a.email.toLowerCase()) && !m.read
        ).length;

        const lastMsg = relatedMsgs[0];

        return {
          ...a,
          unreadCount: unreads,
          lastMessage: lastMsg ? {
            content: lastMsg.content,
            created_at: lastMsg.created_at,
            sender_id: lastMsg.sender_id,
          } : undefined,
        };
      });

      // Sorting order:
      // 1. Unread conversations first
      // 2. Online users next
      // 3. Most recent message
      // 4. Alphabetical by name
      agentList.sort((a, b) => {
        if ((b.unreadCount || 0) !== (a.unreadCount || 0)) {
          return (b.unreadCount || 0) - (a.unreadCount || 0);
        }
        if (a.is_online !== b.is_online) {
          return a.is_online ? -1 : 1;
        }
        if (a.lastMessage && b.lastMessage) {
          return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
        }
        if (a.lastMessage) return -1;
        if (b.lastMessage) return 1;
        return a.nome.localeCompare(b.nome);
      });

      setAgents(agentList);
      const totalUnreads = agentList.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0);
      setTotalUnread(totalUnreads);
    } catch (err) {
      console.error('Error fetching agents:', err);
    } finally {
      setLoadingAgents(false);
    }
  }, [user]);

  const loadConversation = useCallback(async (target: AgentInfo) => {
    if (!user) return;
    setLoadingMessages(true);
    try {
      const targetId = target.user_id || target.id;
      const targetEmail = target.email;

      const { data, error } = await supabase
        .from('agent_messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${targetId}),` +
          `and(sender_id.eq.${targetId},receiver_id.eq.${user.id}),` +
          `and(sender_email.eq.${user.email},receiver_email.eq.${targetEmail}),` +
          `and(sender_email.eq.${targetEmail},receiver_email.eq.${user.email})`
        )
        .order('created_at', { ascending: true })
        .limit(150);

      if (!error && data) {
        setMessages(data as ChatMessage[]);
      }

      // Mark received as read
      await supabase
        .from('agent_messages')
        .update({ read: true } as any)
        .or(`and(sender_id.eq.${targetId},receiver_id.eq.${user.id}),and(sender_email.eq.${targetEmail},receiver_email.eq.${user.email})`)
        .eq('read', false);

      fetchAgentsAndPresence();
    } catch (err) {
      console.error('Error loading conversation:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, [user, fetchAgentsAndPresence]);

  const agentsRef = useRef<AgentInfo[]>([]);
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  const activeAgentRef = useRef<AgentInfo | null>(null);
  useEffect(() => {
    activeAgentRef.current = activeAgent;
  }, [activeAgent]);

  const localBroadcastRef = useRef<BroadcastChannel | null>(null);
  const recordingHeartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  // Clean expired typing / recording indicators periodically
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => {
        let changed = false;
        const next = { ...prev };
        Object.entries(next).forEach(([key, val]) => {
          if (val.expiresAt < now) {
            delete next[key];
            changed = true;
          }
        });
        return changed ? next : prev;
      });

      setRecordingUsers(prev => {
        let changed = false;
        const next = { ...prev };
        Object.entries(next).forEach(([key, val]) => {
          if (val.expiresAt < now) {
            delete next[key];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 800);

    return () => clearInterval(timer);
  }, []);

  // Broadcast live chat events through local BroadcastChannel AND Supabase Realtime channel
  const broadcastLiveEvent = useCallback((eventType: 'typing' | 'recording_audio' | 'new_message', payload: any) => {
    // 1. Instant cross-tab/window BroadcastChannel
    try {
      if (localBroadcastRef.current) {
        localBroadcastRef.current.postMessage({ event: eventType, payload });
      }
    } catch {}

    // 2. Supabase Realtime Global Broadcast
    try {
      if (globalChannelRef.current) {
        globalChannelRef.current.send({
          type: 'broadcast',
          event: eventType,
          payload,
        });
      }
    } catch {}
  }, []);

  // Handle new incoming messages (both via postgres changes and live broadcast)
  const handleNewIncomingMessage = useCallback((newMsg: ChatMessage) => {
    if (!user) return;
    const myEmail = (user.email || '').toLowerCase();
    const currentActive = activeAgentRef.current;

    const isForMe =
      newMsg.receiver_id === user.id ||
      newMsg.receiver_email?.toLowerCase() === myEmail;

    const isFromActive =
      currentActive &&
      (newMsg.sender_id === currentActive.user_id ||
       newMsg.sender_id === currentActive.id ||
       newMsg.sender_email?.toLowerCase() === currentActive.email.toLowerCase());

    const isFromMe =
      newMsg.sender_id === user.id ||
      newMsg.sender_email?.toLowerCase() === myEmail;

    // Clear typing and recording state for this sender
    const senderKeys = [
      newMsg.sender_id,
      newMsg.sender_email?.toLowerCase(),
      (newMsg.sender_email || '').split('@')[0],
    ].filter(Boolean) as string[];

    setTypingUsers(prev => {
      let changed = false;
      const next = { ...prev };
      senderKeys.forEach(k => {
        if (next[k]) {
          delete next[k];
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    setRecordingUsers(prev => {
      let changed = false;
      const next = { ...prev };
      senderKeys.forEach(k => {
        if (next[k]) {
          delete next[k];
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    // If message belongs to active conversation, append immediately or replace optimistic pending message
    if (currentActive && (isFromActive || isFromMe)) {
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;

        // Check if there is a pending optimistic message matching this message
        const optimisticMatchIdx = prev.findIndex(
          m => m.pending && (
            m.content === newMsg.content ||
            (m.sender_id === newMsg.sender_id && m.receiver_id === newMsg.receiver_id)
          )
        );

        if (optimisticMatchIdx !== -1) {
          const next = [...prev];
          next[optimisticMatchIdx] = { ...newMsg, pending: false };
          return next;
        }

        return [...prev, newMsg];
      });

      if (isForMe) {
        supabase.from('agent_messages').update({ read: true } as any).eq('id', newMsg.id);
      }
    }

    if (isForMe) {
      if (soundEnabled) playChatNotificationSound();

      if (!currentActive || !isFromActive) {
        toast.info(`Nova mensagem de ${newMsg.sender_nome || newMsg.sender_email}`, {
          description: newMsg.content.startsWith('[🎤 Áudio]')
            ? '🎙️ Mensagem de voz recebida'
            : newMsg.content.startsWith('[📷 Foto]')
            ? '📷 Foto recebida'
            : newMsg.content.startsWith('[🎥 Vídeo]')
            ? '🎥 Vídeo recebido'
            : newMsg.content.slice(0, 60),
          action: {
            label: 'Responder',
            onClick: () => {
              setIsOpen(true);
              const senderAgent = agentsRef.current.find(
                a => a.id === newMsg.sender_id || a.user_id === newMsg.sender_id || a.email.toLowerCase() === newMsg.sender_email?.toLowerCase()
              );
              if (senderAgent) {
                setActiveAgent(senderAgent);
              }
            },
          },
        });
      }
    }

    fetchAgentsAndPresence();
  }, [user, soundEnabled, fetchAgentsAndPresence]);

  // Handle incoming live events (typing, recording audio, or new message)
  const handleIncomingLiveEvent = useCallback((eventData: { event: string; payload: any }) => {
    const { event, payload } = eventData || {};
    if (!payload || !user) return;
    const myEmail = (user.email || '').toLowerCase();
    const myId = user.id;

    const { sender_id, sender_email, sender_nome, receiver_id, receiver_email, is_typing, is_recording } = payload;
    const targetEmail = (receiver_email || '').toLowerCase();

    // Ignore self-broadcasts
    if (sender_id === myId || (sender_email && sender_email.toLowerCase() === myEmail)) {
      return;
    }

    // If targeted to someone else specifically, ignore
    if (receiver_id && receiver_id !== myId && targetEmail && targetEmail !== myEmail) {
      return;
    }

    const senderEmailLower = (sender_email || '').toLowerCase();
    const senderKeys = [
      sender_id,
      senderEmailLower,
      senderEmailLower.split('@')[0],
    ].filter(Boolean) as string[];

    if (event === 'typing') {
      setTypingUsers(prev => {
        const next = { ...prev };
        if (is_typing) {
          senderKeys.forEach(k => {
            next[k] = { nome: sender_nome || 'Agente', expiresAt: Date.now() + 4500 };
          });
        } else {
          senderKeys.forEach(k => {
            delete next[k];
          });
        }
        return next;
      });
    } else if (event === 'recording_audio') {
      setRecordingUsers(prev => {
        const next = { ...prev };
        if (is_recording) {
          senderKeys.forEach(k => {
            next[k] = { nome: sender_nome || 'Agente', expiresAt: Date.now() + 10000 };
          });
        } else {
          senderKeys.forEach(k => {
            delete next[k];
          });
        }
        return next;
      });
    } else if (event === 'new_message' && payload.message) {
      const newMsg = payload.message as ChatMessage;
      handleNewIncomingMessage(newMsg);
    }
  }, [user, handleNewIncomingMessage]);

  // Fast background poller for active conversation when widget is open
  const pollActiveConversation = useCallback(async (target: AgentInfo) => {
    if (!user) return;
    const targetId = target.user_id || target.id;
    const targetEmail = target.email;

    try {
      const { data, error } = await supabase
        .from('agent_messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${targetId}),` +
          `and(sender_id.eq.${targetId},receiver_id.eq.${user.id}),` +
          `and(sender_email.eq.${user.email},receiver_email.eq.${targetEmail}),` +
          `and(sender_email.eq.${targetEmail},receiver_email.eq.${user.email})`
        )
        .order('created_at', { ascending: true })
        .limit(150);

      if (!error && data) {
        setMessages(prev => {
          // Keep pending optimistic messages while taking updated server records
          const pendingMessages = prev.filter(m => m.pending);
          const stillPending = pendingMessages.filter(
            p => !data.some(d => d.content === p.content && (d.sender_id === p.sender_id || d.sender_email === p.sender_email))
          );
          return [...(data as ChatMessage[]), ...stillPending];
        });

        // Mark unread as read
        const unreads = data.filter(
          m => (m.sender_id === targetId || m.sender_email?.toLowerCase() === targetEmail.toLowerCase()) && !m.read
        );
        if (unreads.length > 0) {
          await supabase
            .from('agent_messages')
            .update({ read: true } as any)
            .in('id', unreads.map(m => m.id));
        }
      }
    } catch {}
  }, [user]);

  // Periodic polling when chat is open
  useEffect(() => {
    if (!isOpen || !user) return;
    const interval = setInterval(() => {
      if (activeAgentRef.current) {
        pollActiveConversation(activeAgentRef.current);
      } else {
        fetchAgentsAndPresence();
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isOpen, user, pollActiveConversation, fetchAgentsAndPresence]);

  // GLOBAL REALTIME CHANNELS (BroadcastChannel + Supabase Realtime)
  useEffect(() => {
    if (!user) return;
    fetchAgentsAndPresence();

    // 1. Initialize local BroadcastChannel for instant browser synchronization
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('sigemm_chat_live_sync');
        localBroadcastRef.current = bc;
        bc.onmessage = (event) => {
          handleIncomingLiveEvent(event.data);
        };
      } catch {}
    }

    // 2. Initialize Supabase Realtime Channel
    const channel = supabase.channel('sigemm-chat-global-room', {
      config: { broadcast: { self: false } },
    });
    globalChannelRef.current = channel;

    channel
      // A. Listen for new messages inserted in DB
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_messages' }, (payload) => {
        handleNewIncomingMessage(payload.new as ChatMessage);
      })
      // B. Listen for message updates (e.g. read receipts)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'agent_messages' }, (payload) => {
        const updatedMsg = payload.new as ChatMessage;
        setMessages(prev =>
          prev.map(m => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
        );
      })
      // C. Listen for agent presence updates (online/offline/location)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_presence' }, () => {
        fetchAgentsAndPresence();
      })
      // D. Realtime Broadcast: User Typing Event
      .on('broadcast', { event: 'typing' }, (payload) => {
        handleIncomingLiveEvent({ event: 'typing', payload: payload.payload });
      })
      // E. Realtime Broadcast: User Recording Audio Event
      .on('broadcast', { event: 'recording_audio' }, (payload) => {
        handleIncomingLiveEvent({ event: 'recording_audio', payload: payload.payload });
      })
      // F. Realtime Broadcast: User Sent New Message Event
      .on('broadcast', { event: 'new_message' }, (payload) => {
        handleIncomingLiveEvent({ event: 'new_message', payload: payload.payload });
      })
      .subscribe();

    const presenceInterval = setInterval(fetchAgentsAndPresence, 15000);

    return () => {
      if (localBroadcastRef.current) {
        localBroadcastRef.current.close();
        localBroadcastRef.current = null;
      }
      supabase.removeChannel(channel);
      clearInterval(presenceInterval);
    };
  }, [user, fetchAgentsAndPresence, handleIncomingLiveEvent, handleNewIncomingMessage]);

  // Load conversation when activeAgent changes
  useEffect(() => {
    if (!activeAgent || !user) return;
    loadConversation(activeAgent);
  }, [activeAgent, user, loadConversation]);

  // Broadcast typing state helper
  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (!user || !activeAgent) return;
    broadcastLiveEvent('typing', {
      sender_id: user.id,
      sender_email: user.email,
      sender_nome: user.user_metadata?.nome || user.email?.split('@')[0],
      receiver_id: activeAgent.user_id || activeAgent.id,
      receiver_email: activeAgent.email,
      is_typing: isTyping,
    });
  }, [user, activeAgent, broadcastLiveEvent]);

  // Broadcast recording audio state helper
  const sendRecordingAudioStatus = useCallback((isRecording: boolean) => {
    if (!user || !activeAgent) return;
    broadcastLiveEvent('recording_audio', {
      sender_id: user.id,
      sender_email: user.email,
      sender_nome: user.user_metadata?.nome || user.email?.split('@')[0],
      receiver_id: activeAgent.user_id || activeAgent.id,
      receiver_email: activeAgent.email,
      is_recording: isRecording,
    });
  }, [user, activeAgent, broadcastLiveEvent]);

  // Handle typing input changes with debouncing and throttled updates
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (val.trim()) {
      const now = Date.now();
      if (now - lastTypingSentRef.current > 1500) {
        sendTypingStatus(true);
        lastTypingSentRef.current = now;
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingStatus(false);
        lastTypingSentRef.current = 0;
      }, 3000);
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      sendTypingStatus(false);
      lastTypingSentRef.current = 0;
    }
  };

  // Send text or custom formatted message with 0ms optimistic latency
  async function handleSendMessage(customText?: string) {
    const textToSend = customText || inputText.trim();
    if (!textToSend || !user || !activeAgent) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTypingStatus(false);
    lastTypingSentRef.current = 0;

    const tempId = `opt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();
    const receiverId = activeAgent.user_id || activeAgent.id;
    const senderNome = user.user_metadata?.nome || user.email?.split('@')[0] || 'Agente';

    const optimisticMsg: ChatMessage = {
      id: tempId,
      sender_id: user.id,
      receiver_id: receiverId,
      sender_email: user.email || '',
      receiver_email: activeAgent.email,
      sender_nome: senderNome,
      receiver_nome: activeAgent.nome,
      content: textToSend,
      read: false,
      created_at: nowIso,
      pending: true,
    };

    // 1. INSTANT LOCAL UPDATE (0ms)
    setMessages(prev => [...prev, optimisticMsg]);
    setInputText('');
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 10);

    // 2. INSTANT PEER BROADCAST
    broadcastLiveEvent('new_message', { message: optimisticMsg });

    // 3. PERSIST ASYNCHRONOUSLY TO SUPABASE
    try {
      const dbPayload = {
        sender_id: user.id,
        receiver_id: receiverId,
        sender_email: user.email || '',
        receiver_email: activeAgent.email,
        sender_nome: senderNome,
        receiver_nome: activeAgent.nome,
        content: textToSend,
        read: false,
      };

      const { data: inserted, error } = await supabase
        .from('agent_messages')
        .insert(dbPayload as any)
        .select()
        .single();

      if (error) throw error;

      if (inserted) {
        const fullMsg = inserted as ChatMessage;
        setMessages(prev => prev.map(m => m.id === tempId ? { ...fullMsg, pending: false } : m));
        // Broadcast confirmed persistent record
        broadcastLiveEvent('new_message', { message: fullMsg });
      }
      fetchAgentsAndPresence();
    } catch (err: any) {
      console.error('Error inserting chat message:', err);
      toast.error('Erro ao enviar mensagem: ' + (err?.message || err));
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  }

  // Voice recording handlers
  const startRecordingAudio = async () => {
    if (!activeAgent) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecordingAudio(true);
      setRecordingSeconds(0);

      // Send initial recording status and maintain live heartbeat
      sendRecordingAudioStatus(true);
      if (recordingHeartbeatRef.current) clearInterval(recordingHeartbeatRef.current);
      recordingHeartbeatRef.current = setInterval(() => {
        sendRecordingAudioStatus(true);
      }, 3000);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone error:', err);
      toast.error('Não foi possível aceder ao microfone. Verifique as permissões do navegador.');
    }
  };

  const cancelRecordingAudio = () => {
    if (recordingHeartbeatRef.current) clearInterval(recordingHeartbeatRef.current);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    audioChunksRef.current = [];
    setIsRecordingAudio(false);
    setRecordingSeconds(0);
    sendRecordingAudioStatus(false);
  };

  const stopAndSendRecordingAudio = async () => {
    if (!mediaRecorderRef.current || !activeAgent || !user) return;

    if (recordingHeartbeatRef.current) clearInterval(recordingHeartbeatRef.current);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    sendRecordingAudioStatus(false);

    const recorder = mediaRecorderRef.current;
    const durationSec = recordingSeconds;

    recorder.onstop = async () => {
      recorder.stream.getTracks().forEach(t => t.stop());
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      audioChunksRef.current = [];
      setIsRecordingAudio(false);
      setRecordingSeconds(0);

      if (audioBlob.size < 400) {
        toast.info('Áudio muito curto descartado.');
        return;
      }

      // 1. INSTANT LOCAL AUDIO PREVIEW (0ms)
      const localAudioUrl = URL.createObjectURL(audioBlob);
      const tempId = `opt_audio_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const receiverId = activeAgent.user_id || activeAgent.id;
      const senderNome = user.user_metadata?.nome || user.email?.split('@')[0] || 'Agente';
      const optimisticContent = `[🎤 Áudio] ${localAudioUrl}|${durationSec}`;

      const optimisticMsg: ChatMessage = {
        id: tempId,
        sender_id: user.id,
        receiver_id: receiverId,
        sender_email: user.email || '',
        receiver_email: activeAgent.email,
        sender_nome: senderNome,
        receiver_nome: activeAgent.nome,
        content: optimisticContent,
        read: false,
        created_at: new Date().toISOString(),
        pending: true,
      };

      setMessages(prev => [...prev, optimisticMsg]);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 10);

      // 2. UPLOAD IN BACKGROUND
      try {
        const filename = `chat_audio_${user.id}_${Date.now()}.webm`;
        const path = `chat/${user.id}/${filename}`;

        const { error: upErr } = await supabase.storage
          .from('multa-fotos')
          .upload(path, audioBlob, { contentType: 'audio/webm' });

        let audioUrl = '';
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('multa-fotos').getPublicUrl(path);
          audioUrl = urlData.publicUrl;
        } else {
          // Fallback to data URL base64 if storage bucket has issues
          const reader = new FileReader();
          audioUrl = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(audioBlob);
          });
        }

        const finalTag = `[🎤 Áudio] ${audioUrl}|${durationSec}`;

        const dbPayload = {
          sender_id: user.id,
          receiver_id: receiverId,
          sender_email: user.email || '',
          receiver_email: activeAgent.email,
          sender_nome: senderNome,
          receiver_nome: activeAgent.nome,
          content: finalTag,
          read: false,
        };

        const { data: inserted, error: insErr } = await supabase
          .from('agent_messages')
          .insert(dbPayload as any)
          .select()
          .single();

        if (insErr) throw insErr;

        if (inserted) {
          const fullMsg = inserted as ChatMessage;
          setMessages(prev => prev.map(m => m.id === tempId ? { ...fullMsg, pending: false } : m));
          broadcastLiveEvent('new_message', { message: fullMsg });
        }
      } catch (err: any) {
        console.error('Audio upload error:', err);
        toast.error('Erro ao enviar áudio: ' + (err?.message || err));
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    };

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user || !activeAgent) return;

    // Reset input right away so user can select another file later
    e.target.value = '';

    const receiverId = activeAgent.user_id || activeAgent.id;
    const senderNome = user.user_metadata?.nome || user.email?.split('@')[0] || 'Agente';
    const tempId = `opt_file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const localUrl = URL.createObjectURL(file);

    const isImg = file.type.startsWith('image/');
    const isVid = file.type.startsWith('video/');
    const isAud = file.type.startsWith('audio/');

    let optimisticTag = `[📎 Ficheiro: ${file.name}] ${localUrl}`;
    if (isImg) optimisticTag = `[📷 Foto] ${localUrl}`;
    else if (isVid) optimisticTag = `[🎥 Vídeo] ${localUrl}`;
    else if (isAud) optimisticTag = `[🎤 Áudio] ${localUrl}|0`;

    const optimisticMsg: ChatMessage = {
      id: tempId,
      sender_id: user.id,
      receiver_id: receiverId,
      sender_email: user.email || '',
      receiver_email: activeAgent.email,
      sender_nome: senderNome,
      receiver_nome: activeAgent.nome,
      content: optimisticTag,
      read: false,
      created_at: new Date().toISOString(),
      pending: true,
    };

    // 1. INSTANT LOCAL PREVIEW (0ms)
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 10);

    // 2. BACKGROUND STORAGE UPLOAD
    try {
      const ext = file.name.split('.').pop() || 'dat';
      const path = `chat/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('multa-fotos').upload(path, file);

      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('multa-fotos').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      let finalTag = `[📎 Ficheiro: ${file.name}] ${publicUrl}`;
      if (isImg) finalTag = `[📷 Foto] ${publicUrl}`;
      else if (isVid) finalTag = `[🎥 Vídeo] ${publicUrl}`;
      else if (isAud) finalTag = `[🎤 Áudio] ${publicUrl}|0`;

      const dbPayload = {
        sender_id: user.id,
        receiver_id: receiverId,
        sender_email: user.email || '',
        receiver_email: activeAgent.email,
        sender_nome: senderNome,
        receiver_nome: activeAgent.nome,
        content: finalTag,
        read: false,
      };

      const { data: inserted, error: insErr } = await supabase
        .from('agent_messages')
        .insert(dbPayload as any)
        .select()
        .single();

      if (insErr) throw insErr;

      if (inserted) {
        const fullMsg = inserted as ChatMessage;
        setMessages(prev => prev.map(m => m.id === tempId ? { ...fullMsg, pending: false } : m));
        broadcastLiveEvent('new_message', { message: fullMsg });
      }
    } catch (err: any) {
      console.error('File upload error:', err);
      toast.error('Erro ao enviar ficheiro: ' + (err?.message || err));
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  }

  const onlineCount = useMemo(() => agents.filter(a => a.is_online).length, [agents]);

  const filteredAgents = useMemo(() => {
    let list = agents;
    if (activeFilter === 'online') list = list.filter(a => a.is_online);
    if (activeFilter === 'offline') list = list.filter(a => !a.is_online);
    if (activeFilter === 'unreads') list = list.filter(a => (a.unreadCount || 0) > 0);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(a =>
        a.nome.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.cargo || '').toLowerCase().includes(q) ||
        (a.posto || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [agents, activeFilter, searchQuery]);

  const getInitials = (name: string) => {
    if (!name) return 'AG';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const formatMessageTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatLastSeen = (dateStr?: string) => {
    if (!dateStr) return 'Offline';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'há instantes';
    if (mins < 60) return `há ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `há ${hrs}h`;
    return `há ${Math.floor(hrs / 24)}d`;
  };

  const formatRecordingTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Helper to reliably check if a user is typing across any identifier key
  const getTypingInfo = useCallback((agent: AgentInfo | null | undefined) => {
    if (!agent) return null;
    const emailLower = (agent.email || '').toLowerCase();
    const emailUser = emailLower.split('@')[0];
    const keys = [
      agent.user_id,
      agent.id,
      emailLower,
      emailUser,
    ].filter(Boolean) as string[];

    for (const key of keys) {
      if (typingUsers[key]) return typingUsers[key];
    }
    return null;
  }, [typingUsers]);

  // Helper to reliably check if a user is recording audio across any identifier key
  const getRecordingInfo = useCallback((agent: AgentInfo | null | undefined) => {
    if (!agent) return null;
    const emailLower = (agent.email || '').toLowerCase();
    const emailUser = emailLower.split('@')[0];
    const keys = [
      agent.user_id,
      agent.id,
      emailLower,
      emailUser,
    ].filter(Boolean) as string[];

    for (const key of keys) {
      if (recordingUsers[key]) return recordingUsers[key];
    }
    return null;
  }, [recordingUsers]);

  // Check if active counterpart is currently typing or recording audio
  const isOtherTyping = getTypingInfo(activeAgent);
  const isOtherRecordingAudio = getRecordingInfo(activeAgent);

  // Open profile dialog helper
  const handleOpenUserProfile = (agentOrData: AgentInfo | UserProfileData) => {
    setSelectedProfile({
      id: agentOrData.id,
      user_id: agentOrData.user_id,
      email: agentOrData.email,
      nome: agentOrData.nome,
      cargo: agentOrData.cargo,
      nivel_acesso: agentOrData.nivel_acesso,
      foto_url: agentOrData.foto_url,
      telefone: agentOrData.telefone,
      posto: agentOrData.posto,
      local_trabalho: agentOrData.local_trabalho,
      is_online: agentOrData.is_online,
      last_seen: agentOrData.last_seen,
      latitude: agentOrData.latitude,
      longitude: agentOrData.longitude,
      numero_agente: agentOrData.numero_agente,
    });
    setProfileDialogOpen(true);
  };

  // Open own profile helper
  const handleOpenMyProfile = async () => {
    if (!user) return;
    try {
      const { data: myProfile } = await supabase
        .from('agentes')
        .select('*')
        .eq('email', user.email || '')
        .maybeSingle();

      setSelectedProfile({
        id: myProfile?.id || user.id,
        user_id: user.id,
        email: user.email || '',
        nome: myProfile?.nome || user.user_metadata?.nome || user.email?.split('@')[0] || 'Meu Utilizador',
        cargo: myProfile?.cargo || 'Agente da Polícia Municipal',
        nivel_acesso: myProfile?.nivel_acesso || 'agente',
        foto_url: myProfile?.foto_url || null,
        telefone: myProfile?.telefone || null,
        local_trabalho: myProfile?.local_trabalho || 'Matola',
        is_online: true,
        numero_agente: myProfile?.numero_agente,
      });
      setProfileDialogOpen(true);
    } catch {
      toast.error('Não foi possível carregar o perfil.');
    }
  };

  return (
    <>
      {/* Hidden file input for chat attachments */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* FLOATING LAUNCHER BUTTON (Bottom-Right, responsive & compact for mobile/tablets) */}
      {!isOpen && (
        <div className="fixed bottom-20 md:bottom-5 right-3 sm:right-4 md:right-5 z-40 flex items-center group animate-fade-in">
          <Button
            onClick={() => setIsOpen(true)}
            className="relative h-11 w-11 sm:h-10 sm:w-auto sm:px-3 lg:h-11 lg:px-3.5 rounded-full shadow-xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white flex items-center justify-center gap-2 border border-white/25 transition-all duration-200 active:scale-95 cursor-pointer"
            aria-label="Abrir Chat dos Agentes"
            title="Chat dos Agentes"
          >
            {/* Icon + Online Indicator */}
            <div className="relative flex items-center justify-center">
              <MessageSquare className="w-5 h-5 sm:w-4 sm:h-4 lg:w-4.5 lg:h-4.5 text-white" />
              {onlineCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-emerald-800 animate-pulse" />
              )}
            </div>

            {/* Label - hidden on mobile smartphones (<sm), compact on tablets/desktops */}
            <div className="hidden sm:flex items-center gap-1.5 text-left">
              <span className="text-xs font-semibold tracking-tight text-white whitespace-nowrap">
                Chat
              </span>
              <span className="text-[10px] font-medium bg-black/25 text-emerald-100 px-1.5 py-0.5 rounded-full font-mono">
                {onlineCount}
              </span>
            </div>

            {/* Unread message count badge */}
            {totalUnread > 0 && (
              <Badge className="absolute -top-1.5 -right-1.5 sm:static sm:top-auto sm:right-auto bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] h-5 min-w-[20px] px-1 flex items-center justify-center rounded-full shadow-md animate-bounce">
                {totalUnread}
              </Badge>
            )}
          </Button>
        </div>
      )}

      {/* CHAT FLOATING WINDOW / DRAWER */}
      {isOpen && (
        <Card
          className={`fixed inset-x-2 bottom-18 top-16 sm:top-auto sm:inset-auto sm:bottom-4 sm:right-4 z-50 flex flex-col bg-card/95 backdrop-blur-md shadow-2xl border-2 border-primary/30 rounded-2xl overflow-hidden transition-all duration-300 ${
            isExpanded
              ? 'sm:w-[720px] sm:h-[85vh] sm:max-h-[750px]'
              : 'sm:w-[440px] sm:h-[580px] sm:max-h-[90vh]'
          }`}
        >
          {/* HEADER */}
          <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 px-4 py-3 text-white flex items-center justify-between shadow-md flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {activeAgent ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/15 rounded-full -ml-1 flex-shrink-0 cursor-pointer"
                    onClick={() => setActiveAgent(null)}
                    title="Voltar à lista de agentes"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>

                  {/* Clickable Counterpart Avatar to view Profile */}
                  <div
                    className="relative flex-shrink-0 cursor-pointer group"
                    onClick={() => handleOpenUserProfile(activeAgent)}
                    title="Clique para ver o perfil completo deste agente"
                  >
                    <Avatar className="h-9 w-9 border-2 border-white/40 shadow-xs transition-transform group-hover:scale-105">
                      {activeAgent.foto_url && <AvatarImage src={activeAgent.foto_url} alt={activeAgent.nome} />}
                      <AvatarFallback className="bg-white/20 text-white font-bold text-xs">
                        {getInitials(activeAgent.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-emerald-900 ${
                        activeAgent.is_online ? 'bg-green-400' : 'bg-slate-400'
                      }`}
                    />
                  </div>

                  {/* Clickable Name to view Profile */}
                  <div
                    className="min-w-0 cursor-pointer group"
                    onClick={() => handleOpenUserProfile(activeAgent)}
                    title="Clique para ver o perfil completo"
                  >
                    <p className="text-xs font-bold truncate leading-tight group-hover:underline flex items-center gap-1.5">
                      <span>{activeAgent.nome}</span>
                      <UserIcon className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                    </p>

                    {/* Dynamic Real-time Status Header */}
                    <div className="text-[10px] text-emerald-100/90 truncate flex items-center gap-1.5 h-4">
                      {isOtherRecordingAudio ? (
                        <span className="text-amber-300 font-bold flex items-center gap-1 animate-pulse">
                          <Mic className="w-3 h-3 text-amber-300 animate-bounce" />
                          Gravando áudio...
                        </span>
                      ) : isOtherTyping ? (
                        <span className="text-green-300 font-bold flex items-center gap-1">
                          <span className="flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-bounce" />
                          </span>
                          A escrever...
                        </span>
                      ) : activeAgent.is_online ? (
                        <span className="text-green-300 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Online agora
                        </span>
                      ) : (
                        <span className="text-emerald-100/70">Visto {formatLastSeen(activeAgent.last_seen)}</span>
                      )}
                      {activeAgent.cargo && !isOtherTyping && !isOtherRecordingAudio && (
                        <span className="text-white/60 truncate">· {activeAgent.cargo}</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-emerald-200" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-wide flex items-center gap-2 leading-tight">
                      Chat dos Agentes
                      <Badge className="bg-emerald-500/30 hover:bg-emerald-500/30 text-emerald-100 text-[10px] px-1.5 py-0 border-none">
                        {onlineCount} Online
                      </Badge>
                    </h3>
                    <p className="text-[10px] text-emerald-100/70">Comunicação e Rádio SIGEMM Matola</p>
                  </div>
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1">
              {!activeAgent && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] text-emerald-100 hover:bg-white/15 rounded-lg flex items-center gap-1"
                  onClick={handleOpenMyProfile}
                  title="Ver meu próprio perfil"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Meu Perfil</span>
                </Button>
              )}

              {activeAgent?.telefone && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-emerald-100 hover:bg-white/15 rounded-full cursor-pointer"
                  onClick={() => window.open(`tel:${activeAgent.telefone}`, '_self')}
                  title={`Ligar para ${activeAgent.telefone}`}
                >
                  <Phone className="w-3.5 h-3.5" />
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-emerald-100 hover:bg-white/15 rounded-full cursor-pointer"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? 'Silenciar notificações sonoras' : 'Ativar notificações sonoras'}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-red-300" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-emerald-100 hover:bg-white/15 rounded-full hidden sm:flex cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Restaurar tamanho' : 'Expandir janela'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-emerald-100 hover:bg-white/15 rounded-full cursor-pointer"
                onClick={() => setIsOpen(false)}
                title="Fechar chat"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* BODY: AGENT LIST OR CONVERSATION */}
          {!activeAgent ? (
            <div className="flex-1 flex flex-col min-h-0 bg-background">
              {/* Search & Filter bar */}
              <div className="p-3 border-b border-border space-y-2 bg-muted/20">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar utilizador por nome, cargo ou posto..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 text-xs h-8 bg-card"
                  />
                </div>

                {/* Filter chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                  <button
                    onClick={() => setActiveFilter('todos')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                      activeFilter === 'todos'
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    Todos ({agents.length})
                  </button>
                  <button
                    onClick={() => setActiveFilter('online')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                      activeFilter === 'online'
                        ? 'bg-green-600 text-white font-semibold shadow-xs'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Online ({onlineCount})
                  </button>
                  <button
                    onClick={() => setActiveFilter('offline')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                      activeFilter === 'offline'
                        ? 'bg-slate-700 text-white font-semibold shadow-xs'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    Offline ({agents.length - onlineCount})
                  </button>
                  {totalUnread > 0 && (
                    <button
                      onClick={() => setActiveFilter('unreads')}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                        activeFilter === 'unreads'
                          ? 'bg-red-600 text-white font-semibold shadow-xs'
                          : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                      }`}
                    >
                      Não Lidas ({totalUnread})
                    </button>
                  )}
                </div>
              </div>

              {/* Agents List */}
              <ScrollArea className="flex-1 px-2 py-2">
                {!loadingAgents && filteredAgents.length === 0 && (
                  <div className="text-center py-10 px-4 space-y-2">
                    <Users className="w-8 h-8 mx-auto text-muted-foreground/40" />
                    <p className="text-xs font-medium text-foreground">Nenhum utilizador encontrado</p>
                    <p className="text-[11px] text-muted-foreground">
                      Tente alterar os termos de pesquisa ou o filtro seleccionado.
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  {filteredAgents.map(agent => {
                    const isTyping = getTypingInfo(agent);
                    const isRecording = getRecordingInfo(agent);

                    return (
                      <div
                        key={agent.id || agent.email}
                        className={`p-2.5 rounded-xl flex items-center gap-3 cursor-pointer transition-all border group ${
                          agent.unreadCount && agent.unreadCount > 0
                            ? 'bg-primary/5 border-primary/30 hover:bg-primary/10'
                            : 'bg-card border-transparent hover:border-border hover:bg-muted/40'
                        }`}
                      >
                        {/* Clickable Avatar to view Profile */}
                        <div
                          className="relative flex-shrink-0 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenUserProfile(agent);
                          }}
                          title="Clique para ver perfil do utilizador"
                        >
                          <Avatar className="h-10 w-10 border border-border shadow-xs group-hover:scale-105 transition-transform">
                            {agent.foto_url && <AvatarImage src={agent.foto_url} alt={agent.nome} className="object-cover" />}
                            <AvatarFallback className={`font-bold text-xs ${agent.is_online ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                              {getInitials(agent.nome)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                              agent.is_online ? 'bg-green-500 shadow-xs ring-1 ring-green-400' : 'bg-slate-400'
                            }`}
                          />
                        </div>

                        {/* Agent details (Click to open chat conversation) */}
                        <div
                          className="min-w-0 flex-1"
                          onClick={() => setActiveAgent(agent)}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                              {agent.nome}
                            </p>
                            {agent.lastMessage && !isTyping && !isRecording && (
                              <span className="text-[10px] text-muted-foreground flex-shrink-0 font-mono">
                                {formatMessageTime(agent.lastMessage.created_at)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground truncate">
                              {agent.cargo || agent.posto || agent.email}
                            </span>
                          </div>

                          {/* Last message snippet OR live typing / audio status */}
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <p className="text-[11px] text-muted-foreground/80 truncate">
                              {isRecording ? (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 animate-pulse">
                                  <Mic className="w-3 h-3 text-amber-500 animate-bounce" /> A gravar áudio...
                                </span>
                              ) : isTyping ? (
                                <span className="text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                                  <span className="flex items-center gap-0.5">
                                    <span className="w-1 h-1 bg-green-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <span className="w-1 h-1 bg-green-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <span className="w-1 h-1 bg-green-500 rounded-full animate-bounce" />
                                  </span>
                                  A escrever...
                                </span>
                              ) : agent.lastMessage ? (
                                <span className="truncate">
                                  {agent.lastMessage.content.startsWith('[🎤 Áudio]')
                                    ? '🎙️ Mensagem de voz'
                                    : agent.lastMessage.content.startsWith('[📷 Foto]')
                                    ? '📷 Foto'
                                    : agent.lastMessage.content.startsWith('[🎥 Vídeo]')
                                    ? '🎥 Vídeo'
                                    : agent.lastMessage.content.startsWith('[📎 Ficheiro:')
                                    ? '📎 Ficheiro anexado'
                                    : agent.lastMessage.content}
                                </span>
                              ) : (
                                <span className={agent.is_online ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground'}>
                                  {agent.is_online ? '🟢 Online agora' : `⚪ Offline (${formatLastSeen(agent.last_seen)})`}
                                </span>
                              )}
                            </p>

                            {agent.unreadCount && agent.unreadCount > 0 ? (
                              <Badge className="bg-red-500 hover:bg-red-500 text-white font-bold text-[10px] h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full flex-shrink-0">
                                {agent.unreadCount}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Bottom Quick info footer */}
              <div className="p-2.5 border-t border-border bg-muted/10 text-center flex items-center justify-between text-[11px] text-muted-foreground px-4">
                <span className="flex items-center gap-1">
                  <Radio className="w-3 h-3 text-primary animate-pulse" /> Canal Operacional Activo
                </span>
                <span>Matola · Polícia Municipal</span>
              </div>
            </div>
          ) : (
            /* CONVERSATION VIEW */
            <div className="flex-1 flex flex-col min-h-0 bg-background">
              {/* Offline indicator banner */}
              {!activeAgent.is_online && (
                <div className="mx-3 mt-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-900 dark:text-amber-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 flex-shrink-0" />
                  <span>
                    <strong>{activeAgent.nome}</strong> está offline no momento. A mensagem será entregue e sincronizada assim que entrar no sistema.
                  </span>
                </div>
              )}

              {/* Message Feed */}
              <ScrollArea className="flex-1 p-3">
                {loadingMessages && (
                  <div className="flex items-center justify-center py-10 gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    Carregando mensagens...
                  </div>
                )}

                {!loadingMessages && messages.length === 0 && (
                  <div className="text-center py-12 px-4 space-y-3">
                    <Avatar
                      className="h-14 w-14 mx-auto border-2 border-primary/30 cursor-pointer shadow-md hover:scale-105 transition-transform"
                      onClick={() => handleOpenUserProfile(activeAgent)}
                      title="Clique para ver perfil do agente"
                    >
                      {activeAgent.foto_url && <AvatarImage src={activeAgent.foto_url} alt={activeAgent.nome} />}
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-base">
                        {getInitials(activeAgent.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-foreground">Início da conversa com {activeAgent.nome}</p>
                      <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                        Envie mensagens de texto instantâneas, notas de voz, fotos de ocorrências ou relatórios operacionais em tempo real.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-3 pb-2">
                  {messages.map((msg, index) => {
                    const isMe =
                      msg.sender_id === user?.id ||
                      msg.sender_email?.toLowerCase() === user?.email?.toLowerCase();

                    const isImg = msg.content.includes('[📷 Foto]');
                    const imgUrl = isImg ? msg.content.replace('[📷 Foto]', '').trim() : null;

                    const isVid = msg.content.includes('[🎥 Vídeo]');
                    const vidUrl = isVid ? msg.content.replace('[🎥 Vídeo]', '').trim() : null;

                    const isFile = msg.content.includes('[📎 Ficheiro:');
                    let fileName = 'Ficheiro';
                    let fileUrl = '';
                    if (isFile) {
                      const match = msg.content.match(/\[📎 Ficheiro:\s*([^\]]+)\]\s*(.+)/i);
                      if (match) {
                        fileName = match[1];
                        fileUrl = match[2].trim();
                      } else {
                        fileUrl = msg.content.replace(/\[📎 Ficheiro:[^\]]+\]/, '').trim();
                      }
                    }

                    const isAudio = msg.content.startsWith('[🎤 Áudio]');
                    let audioUrl: string | null = null;
                    let durationHint = 0;
                    if (isAudio) {
                      const raw = msg.content.replace('[🎤 Áudio]', '').trim();
                      const parts = raw.split('|');
                      audioUrl = parts[0];
                      durationHint = parts[1] ? Number(parts[1]) : 0;
                    }

                    return (
                      <div
                        key={msg.id || index}
                        className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'} group`}
                      >
                        {!isMe && (
                          <Avatar
                            className="h-7 w-7 flex-shrink-0 mb-0.5 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all"
                            onClick={() => handleOpenUserProfile(activeAgent)}
                            title={`Clique para ver o perfil de ${activeAgent.nome}`}
                          >
                            {activeAgent.foto_url && <AvatarImage src={activeAgent.foto_url} alt={activeAgent.nome} />}
                            <AvatarFallback className="bg-muted text-[10px] font-bold">
                              {getInitials(activeAgent.nome)}
                            </AvatarFallback>
                          </Avatar>
                        )}

                        <div
                          className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 py-2 space-y-1 shadow-xs transition-all ${
                            isMe
                              ? 'bg-emerald-700 text-white rounded-br-xs'
                              : 'bg-muted/80 text-foreground rounded-bl-xs border border-border/50'
                          }`}
                        >
                          {/* Audio Player */}
                          {isAudio && audioUrl ? (
                            <AudioMessagePlayer src={audioUrl} isMe={isMe} durationHint={durationHint} />
                          ) : isImg && imgUrl ? (
                            <div className="space-y-1.5">
                              <img
                                src={imgUrl}
                                alt="Anexo"
                                className="rounded-lg max-h-52 max-w-full object-cover cursor-pointer hover:opacity-90 transition-opacity border border-black/10 shadow-xs"
                                onClick={() => window.open(imgUrl, '_blank')}
                              />
                              <p className="text-[10px] opacity-80 flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" /> Foto anexada
                              </p>
                            </div>
                          ) : isVid && vidUrl ? (
                            <div className="space-y-1.5">
                              <video
                                src={vidUrl}
                                controls
                                preload="metadata"
                                className="rounded-lg max-h-60 max-w-full bg-black shadow-xs"
                              />
                              <p className="text-[10px] opacity-80 flex items-center gap-1">
                                <Video className="w-3 h-3" /> Vídeo anexado
                              </p>
                            </div>
                          ) : isFile && fileUrl ? (
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                                isMe
                                  ? 'bg-emerald-800/70 border-emerald-500/40 text-white hover:bg-emerald-800'
                                  : 'bg-background border-border text-foreground hover:bg-muted'
                              }`}
                            >
                              <FileText className="w-5 h-5 flex-shrink-0 text-primary" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{fileName}</p>
                                <p className="text-[10px] opacity-70 flex items-center gap-1">
                                  <Download className="w-3 h-3" /> Baixar / Abrir
                                </p>
                              </div>
                            </a>
                          ) : (
                            <p className="text-xs whitespace-pre-wrap leading-relaxed break-words">
                              {msg.content}
                            </p>
                          )}

                          <div className={`flex items-center justify-end gap-1 text-[9px] ${isMe ? 'text-emerald-100/75' : 'text-muted-foreground'} font-mono`}>
                            <span>{formatMessageTime(msg.created_at)}</span>
                            {isMe && (
                              <span>
                                {msg.pending ? (
                                  <Clock className="w-3 h-3 animate-pulse opacity-80" title="A enviar..." />
                                ) : msg.read ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-emerald-200" title="Lida" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 opacity-70" title="Entregue" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Real-time Counterpart Typing Bubble */}
                  {isOtherTyping && (
                    <div className="flex items-end gap-2 justify-start animate-fade-in">
                      <Avatar className="h-6 w-6 flex-shrink-0 mb-0.5">
                        {activeAgent.foto_url && <AvatarImage src={activeAgent.foto_url} alt={activeAgent.nome} />}
                        <AvatarFallback className="bg-muted text-[9px] font-bold">
                          {getInitials(activeAgent.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-muted text-foreground rounded-2xl rounded-bl-xs px-3 py-2 border border-border/50 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                        </span>
                        <span className="text-[11px] font-medium text-foreground">{activeAgent.nome.split(' ')[0]} está a escrever...</span>
                      </div>
                    </div>
                  )}

                  {/* Real-time Counterpart Recording Audio Bubble */}
                  {isOtherRecordingAudio && (
                    <div className="flex items-end gap-2 justify-start animate-fade-in">
                      <Avatar className="h-6 w-6 flex-shrink-0 mb-0.5">
                        {activeAgent.foto_url && <AvatarImage src={activeAgent.foto_url} alt={activeAgent.nome} />}
                        <AvatarFallback className="bg-muted text-[9px] font-bold">
                          {getInitials(activeAgent.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 rounded-2xl rounded-bl-xs px-3 py-2 flex items-center gap-2 text-xs">
                        <Mic className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                        <span className="text-[11px] font-bold">{activeAgent.nome.split(' ')[0]} está a gravar áudio...</span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Quick Operational Reply Chips */}
              <div className="px-3 py-1.5 border-t border-border bg-muted/20 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-semibold text-muted-foreground flex-shrink-0 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary" /> Rápido:
                </span>
                {QUICK_OPERATIONAL_PHRASES.map((phrase, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(phrase)}
                    disabled={sending}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-card hover:bg-primary/10 hover:border-primary/30 text-foreground whitespace-nowrap transition-all cursor-pointer"
                  >
                    {phrase}
                  </button>
                ))}
              </div>

              {/* Message Input Box & Voice Recording Bar */}
              <div className="p-3 border-t border-border bg-card">
                {isRecordingAudio ? (
                  /* LIVE AUDIO RECORDING BAR */
                  <div className="flex items-center justify-between gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-2 animate-fade-in">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-full bg-red-500 animate-ping shrink-0" />
                      <span className="text-xs font-bold text-red-600 dark:text-red-400 font-mono">
                        Gravando ({formatRecordingTimer(recordingSeconds)})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1 rounded-lg"
                        onClick={cancelRecordingAudio}
                        title="Cancelar e descartar áudio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Cancelar</span>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        className="h-8 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs gap-1.5 rounded-lg shadow-sm font-semibold"
                        onClick={stopAndSendRecordingAudio}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Enviar Áudio</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* STANDARD TEXT & VOICE INPUT BAR */
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full flex-shrink-0 cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || sending}
                      title="Anexar foto ou documento"
                    >
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Paperclip className="w-4 h-4" />}
                    </Button>

                    <Input
                      placeholder={`Mensagem para ${activeAgent.nome.split(' ')[0]}...`}
                      value={inputText}
                      onChange={handleInputChange}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="text-xs h-9 bg-muted/30 focus-visible:ring-1"
                      disabled={sending}
                    />

                    {/* Microphone button (Voice Note) */}
                    {!inputText.trim() ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-full flex-shrink-0 cursor-pointer"
                        onClick={startRecordingAudio}
                        title="Gravar mensagem de voz"
                      >
                        <Mic className="w-4 h-4" />
                      </Button>
                    ) : (
                      /* Send text button */
                      <Button
                        type="button"
                        size="icon"
                        className="h-9 w-9 bg-emerald-700 hover:bg-emerald-800 text-white rounded-full flex-shrink-0 shadow-sm cursor-pointer"
                        onClick={() => handleSendMessage()}
                        disabled={sending}
                        title="Enviar mensagem"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* USER PROFILE DIALOG */}
      <UserProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        user={selectedProfile}
        currentUserId={user?.id}
        onStartChat={(targetUser) => {
          setIsOpen(true);
          const found = agents.find(
            a => a.id === targetUser.id || a.email.toLowerCase() === targetUser.email.toLowerCase()
          );
          if (found) {
            setActiveAgent(found);
          } else {
            setActiveAgent({
              id: targetUser.id || targetUser.email,
              user_id: targetUser.user_id,
              email: targetUser.email,
              nome: targetUser.nome,
              cargo: targetUser.cargo,
              nivel_acesso: targetUser.nivel_acesso,
              foto_url: targetUser.foto_url || undefined,
              telefone: targetUser.telefone || undefined,
              posto: targetUser.posto,
              local_trabalho: targetUser.local_trabalho,
              is_online: targetUser.is_online || false,
            });
          }
        }}
      />
    </>
  );
}
