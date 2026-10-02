import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bot,
  Send,
  X,
  Sparkles,
  Minimize2,
  Maximize2,
  Trash2,
  Copy,
  Check,
  Volume2,
  VolumeX,
  BookOpen,
  ArrowRight,
  Shield,
  Loader2,
  RefreshCw,
  MessageSquareQuote,
  Radio,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import UserManualViewer from '@/components/UserManualViewer';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  actions?: Array<{ label: string; path?: string; actionType?: 'nav' | 'manual' }>;
}

const QUICK_PROMPTS = [
  { label: '📋 Como emitir uma nova multa', prompt: 'Explique o passo a passo completo para lavrar uma nova multa no SIGEMM' },
  { label: '⚖️ Tabela de infrações e valores (MT)', prompt: 'Quais são os principais tipos de infrações, códigos, artigos legais e valores em Meticais na Matola?' },
  { label: '💳 Como liquidar multas e gerar recibo', prompt: 'Como funciona a liquidação de multas no SIGEMM (M-Pesa, e-Mola, balcão) e emissão de recibo de quitação?' },
  { label: '📝 Prazos e gestão de Reclamações', prompt: 'Como funciona o processo de contestação e reclamação de multas? Quais são os prazos legais?' },
  { label: '🏛️ Prazos e envio para Tribunal', prompt: 'Quando e como um processo é remetido para execução fiscal no Tribunal Judicial?' },
  { label: '👥 Níveis de acesso e agentes', prompt: 'Quais são os perfis de acesso do sistema e como criar agentes com envio de senha por e-mail?' },
  { label: '🖨️ Conectar impressora térmica Bluetooth', prompt: 'Como configurar e conectar uma impressora térmica portátil via Bluetooth para impressão de talões?' },
  { label: '📡 Como funciona o Modo Offline', prompt: 'Como o agente pode emitir multas na via pública sem sinal de internet ou rede móvel?' },
];

export default function SigemmBotWidget() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role, nome } = useUserRole();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<Message[]>(() => {
    return [
      {
        id: 'welcome-1',
        sender: 'bot',
        text: `Olá! Sou o **SIGEMM Bot**, o assistente virtual oficial do **Conselho Municipal da Matola**.\n\nEstou aqui para esclarecer dúvidas sobre:\n* **Passo a passo** para emitir multas móveis (trânsito) e imóveis (posturas)\n* **Legislação**, infrações e coimas em Meticais (MT)\n* **Pagamentos** (M-Pesa, e-Mola, SIMO, Depósitos) e emissão de recibos\n* **Prazos legais**, Reclamações e processos em Tribunal\n* **Impressoras térmicas** Bluetooth e **Modo Offline**.\n\nComo posso ajudá-lo hoje?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: [
          { label: 'Ver Manual do Utilizador', actionType: 'manual' },
          { label: 'Ir para Nova Multa', path: '/nova-multa', actionType: 'nav' },
        ],
      },
    ];
  });

  // Auto-scroll when messages change or loading
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const sendRef = useRef(handleSendMessage);
  useEffect(() => {
    sendRef.current = handleSendMessage;
  });

  // Listen to external open events (from header, shortcuts, etc.)
  useEffect(() => {
    const handleOpenEvent = (e: any) => {
      setIsOpen(true);
      if (e.detail?.prompt) {
        sendRef.current(e.detail.prompt);
      }
    };
    window.addEventListener('open-sigemm-bot', handleOpenEvent);
    return () => window.removeEventListener('open-sigemm-bot', handleOpenEvent);
  }, []);

  // Stop speaking when closed
  useEffect(() => {
    if (!isOpen && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    }
  }, [isOpen]);

  function handleSpeechToggle(msg: Message) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('O seu navegador não suporta síntese de voz.');
      return;
    }

    if (speakingId === msg.id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown symbols for cleaner speech
    const cleanText = msg.text
      .replace(/[#*`_~[\]()|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'pt-PT';
    utterance.rate = 1.0;

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(msg.id);
    window.speechSynthesis.speak(utterance);
  }

  function handleCopy(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Resposta copiada para a área de transferência!');
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleClearChat() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'bot',
        text: 'A conversa foi reiniciada. Em que posso ser útil agora?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    toast.info('Histórico de conversa limpo.');
  }

  function parseBotActions(text: string): Array<{ label: string; path?: string; actionType?: 'nav' | 'manual' }> {
    const actions: Array<{ label: string; path?: string; actionType?: 'nav' | 'manual' }> = [];
    const lower = text.toLowerCase();

    if (lower.includes('nova multa') || lower.includes('lavrar')) {
      actions.push({ label: 'Abrir Nova Multa', path: '/nova-multa', actionType: 'nav' });
    }
    if (lower.includes('pagamento') || lower.includes('recibo') || lower.includes('m-pesa')) {
      actions.push({ label: 'Ir para Pagamentos', path: '/pagamentos', actionType: 'nav' });
    }
    if (lower.includes('reclama') || lower.includes('contesta')) {
      actions.push({ label: 'Consultar Reclamações', path: '/reclamacoes', actionType: 'nav' });
    }
    if (lower.includes('tribunal') || lower.includes('execu')) {
      actions.push({ label: 'Módulo de Tribunal', path: '/tribunal', actionType: 'nav' });
    }
    if (lower.includes('impressora') || lower.includes('configura')) {
      actions.push({ label: 'Configurações', path: '/configuracoes', actionType: 'nav' });
    }
    if (lower.includes('agente') || lower.includes('utilizador') || lower.includes('perfil')) {
      actions.push({ label: 'Administração', path: '/admin', actionType: 'nav' });
    }
    if (lower.includes('manual') || actions.length === 0) {
      actions.push({ label: 'Manual Oficial', actionType: 'manual' });
    }

    return actions.slice(0, 3);
  }

  async function handleSendMessage(customPrompt?: string) {
    const textToSend = customPrompt || inputMessage;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInputMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/bot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend.trim(),
          history: messages.slice(-6).map((m) => ({ sender: m.sender, text: m.text })),
          userContext: {
            nome: nome || user?.user_metadata?.nome || user?.email?.split('@')[0],
            username: user?.user_metadata?.username,
            role: role || 'agente',
          },
        }),
      });

      const data = await res.json();
      const botReply = data.reply || 'Não foi possível obter resposta no momento. Por favor tente novamente.';
      const actions = parseBotActions(botReply);

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: botReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions,
      };

      setMessages((prev) => [...prev, botMsg]);

      if (!isOpen) {
        setUnreadCount((c) => c + 1);
      }
    } catch (err: any) {
      console.error('[Bot Client Error]:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: 'Ocorreu um erro ao comunicar com o assistente. Por favor verifique a sua ligação ou consulte o Manual do Utilizador.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actions: [{ label: 'Abrir Manual do Utilizador', actionType: 'manual' }],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function renderFormattedMessage(text: string) {
    // Process markdown-like lines for crisp rendering
    const lines = text.split('\n');
    return (
      <div className="space-y-1.5 text-xs leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1" />;

          // Heading 3
          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-bold text-sm text-foreground pt-1 pb-0.5 border-b border-border/50">
                {trimmed.replace('### ', '')}
              </h4>
            );
          }
          // Heading 4
          if (trimmed.startsWith('#### ')) {
            return (
              <h5 key={idx} className="font-semibold text-xs text-foreground pt-1">
                {trimmed.replace('#### ', '')}
              </h5>
            );
          }
          // Bullet point
          if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            const content = trimmed.substring(2);
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1.5">
                <span className="text-primary font-bold">•</span>
                <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(content) }} />
              </div>
            );
          }
          // Numbered point
          if (/^\d+\.\s/.test(trimmed)) {
            const match = trimmed.match(/^(\d+\.)\s(.*)/);
            if (match) {
              return (
                <div key={idx} className="flex items-start gap-2 pl-1.5">
                  <span className="font-bold text-primary text-[11px] shrink-0">{match[1]}</span>
                  <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(match[2]) }} />
                </div>
              );
            }
          }

          // Table row separator or table row
          if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            if (trimmed.includes('---')) return null;
            const cells = trimmed
              .split('|')
              .slice(1, -1)
              .map((c) => c.trim());
            return (
              <div key={idx} className="grid grid-cols-4 gap-1 p-1 bg-muted/40 rounded text-[10px] font-mono">
                {cells.map((cell, cIdx) => (
                  <div key={cIdx} className={cIdx === 0 ? 'font-bold text-primary col-span-1' : 'col-span-1'}>
                    <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(cell) }} />
                  </div>
                ))}
              </div>
            );
          }

          return (
            <p key={idx} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed) }} />
          );
        })}
      </div>
    );
  }

  function formatInlineMarkdown(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.2 rounded font-mono text-[10px] text-primary border border-border/40">$1</code>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline font-medium">$1</a>');
  }

  return (
    <>
      {/* FLOATING TRIGGER BUTTON */}
      {!isOpen && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 group">
          <Button
            onClick={() => setIsOpen(true)}
            className="h-14 px-4 rounded-full shadow-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white border-2 border-white/20 flex items-center gap-3 transition-all transform hover:scale-105"
            title="Abrir SIGEMM Bot — Assistente Inteligente Oficial"
          >
            <div className="relative">
              <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center ring-2 ring-white/30">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
              </span>
            </div>
            <div className="text-left leading-none pr-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-wide">SIGEMM Bot</span>
                <Sparkles className="h-3 w-3 text-amber-300 animate-pulse" />
              </div>
              <span className="text-[10px] text-white/80 font-normal">Assistente Oficial</span>
            </div>
            {unreadCount > 0 && (
              <Badge className="bg-red-500 hover:bg-red-600 text-white text-[10px] px-1.5 py-0 h-4 rounded-full">
                {unreadCount}
              </Badge>
            )}
          </Button>
        </div>
      )}

      {/* FLOATING CHAT DIALOG WINDOW */}
      {isOpen && (
        <Card
          className={`fixed bottom-4 right-4 z-50 flex flex-col shadow-2xl border-2 border-primary/30 overflow-hidden bg-background transition-all duration-200 ${
            isExpanded
              ? 'w-[95vw] md:w-[760px] h-[90vh] max-h-[820px]'
              : 'w-[92vw] sm:w-[420px] md:w-[460px] h-[580px] max-h-[85vh]'
          }`}
        >
          {/* HEADER */}
          <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white p-3.5 flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center ring-1 ring-white/40">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-white"></span>
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs md:text-sm font-bold tracking-wide">SIGEMM Bot</h3>
                  <Badge className="bg-white/20 text-white hover:bg-white/30 text-[9px] px-1.5 py-0 border-0">
                    Matola
                  </Badge>
                </div>
                <p className="text-[10px] text-white/80 flex items-center gap-1">
                  <Radio className="h-2.5 w-2.5 text-emerald-300 animate-pulse" />
                  Online • Assistente de Apoio
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setManualOpen(true)}
                className="h-7 w-7 text-white hover:bg-white/20"
                title="Abrir Manual Oficial do Utilizador"
              >
                <BookOpen className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearChat}
                className="h-7 w-7 text-white hover:bg-white/20"
                title="Limpar Conversa"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-7 w-7 text-white hover:bg-white/20 hidden sm:flex"
                title={isExpanded ? 'Restaurar Tamanho' : 'Maximizar'}
              >
                {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 text-white hover:bg-white/20"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* QUICK PROMPT CHIPS */}
          <div className="bg-muted/40 border-b border-border px-3 py-2 shrink-0 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 text-nowrap w-max">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mr-1 flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5 text-primary" /> Sugestões:
              </span>
              {QUICK_PROMPTS.map((qp, index) => (
                <button
                  key={index}
                  onClick={() => handleSendMessage(qp.prompt)}
                  disabled={loading}
                  className="text-[11px] bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/40 border border-border/80 px-2.5 py-1 rounded-full transition-all text-foreground/90 font-medium cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>

          {/* MESSAGES SCROLL AREA */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-muted/10">
            {messages.map((msg) => {
              const isBot = msg.sender === 'bot';
              return (
                <div key={msg.id} className={`flex gap-2.5 ${isBot ? 'items-start' : 'items-end justify-end'}`}>
                  {isBot && (
                    <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <Bot className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                    </div>
                  )}

                  <div className={`space-y-1.5 max-w-[85%] ${isBot ? 'text-left' : 'text-right'}`}>
                    <div
                      className={`p-3 rounded-2xl shadow-xs text-xs ${
                        isBot
                          ? 'bg-card border border-border/70 text-card-foreground rounded-tl-xs'
                          : 'bg-emerald-700 text-white rounded-br-xs'
                      }`}
                    >
                      {isBot ? renderFormattedMessage(msg.text) : <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>}

                      {/* QUICK ACTION BUTTONS */}
                      {isBot && msg.actions && msg.actions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2 mt-2 border-t border-border/50">
                          {msg.actions.map((act, aIdx) => (
                            <Button
                              key={aIdx}
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (act.actionType === 'manual') {
                                  setManualOpen(true);
                                } else if (act.path) {
                                  navigate(act.path);
                                  if (window.innerWidth < 768) setIsOpen(false);
                                }
                              }}
                              className="h-6 px-2 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary hover:text-white"
                            >
                              {act.actionType === 'manual' ? <BookOpen className="h-2.5 w-2.5" /> : <ArrowRight className="h-2.5 w-2.5" />}
                              {act.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* METADATA & CONTROLS */}
                    <div className={`flex items-center gap-2 text-[9px] text-muted-foreground px-1 ${isBot ? 'justify-start' : 'justify-end'}`}>
                      <span>{msg.timestamp}</span>
                      {isBot && (
                        <>
                          <button
                            onClick={() => handleCopy(msg.id, msg.text)}
                            className="hover:text-foreground flex items-center gap-0.5 transition-colors"
                            title="Copiar texto"
                          >
                            {copiedId === msg.id ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <Copy className="h-2.5 w-2.5" />}
                            <span>{copiedId === msg.id ? 'Copiado' : 'Copiar'}</span>
                          </button>
                          <button
                            onClick={() => handleSpeechToggle(msg)}
                            className={`hover:text-foreground flex items-center gap-0.5 transition-colors ${speakingId === msg.id ? 'text-primary font-bold' : ''}`}
                            title={speakingId === msg.id ? 'Parar leitura' : 'Ouvir resposta'}
                          >
                            {speakingId === msg.id ? <VolumeX className="h-2.5 w-2.5 text-red-500 animate-pulse" /> : <Volume2 className="h-2.5 w-2.5" />}
                            <span>{speakingId === msg.id ? 'A falar...' : 'Ouvir'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-2.5 items-start">
                <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-emerald-700 dark:text-emerald-300 animate-pulse" />
                </div>
                <div className="bg-card border border-border/70 p-3 rounded-2xl rounded-tl-xs shadow-xs">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span>SIGEMM Bot a consultar legislação e procedimentos...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* INPUT FORM */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 bg-card border-t border-border shrink-0"
          >
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Pergunte sobre multas, infractores, prazos, impressora..."
                className="text-xs h-10 bg-background"
                disabled={loading}
              />
              <Button
                type="submit"
                disabled={loading || !inputMessage.trim()}
                className="h-10 px-4 bg-emerald-700 hover:bg-emerald-800 text-white shrink-0 gap-1.5 shadow-sm"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="hidden sm:inline text-xs">Enviar</span>
              </Button>
            </div>
            <div className="flex items-center justify-between text-[9px] text-muted-foreground mt-1.5 px-1">
              <span>Conselho Municipal da Matola • SIGEMM v5.0</span>
              <a
                href="https://www.facebook.com/sideoutstudios"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Sideout Studios
              </a>
            </div>
          </form>
        </Card>
      )}

      {/* MANUAL VIEWER COMPONENT */}
      <UserManualViewer open={manualOpen} onOpenChange={setManualOpen} />
    </>
  );
}
