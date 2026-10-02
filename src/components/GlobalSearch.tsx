import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { getStatusLabel } from '@/i18n/translations';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  PlusCircle,
  History,
  Wallet,
  Gavel,
  Settings,
  User,
  Wifi,
  ShieldCheck,
  FileText,
  Loader2,
  MessageSquare,
  BookOpen,
} from 'lucide-react';

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const [term, setTerm] = useState('');
  const [multas, setMultas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  const PAGINAS = useMemo(() => [
    { label: 'Manual Oficial do Utilizador (SIGEMM)', path: 'action:manual', icon: BookOpen },
    { label: 'Chat & Rádio Interno dos Agentes', path: 'action:chat', icon: MessageSquare },
    { label: t('nav.dashboard'), path: '/', icon: LayoutDashboard },
    { label: t('nav.multas'), path: '/nova-multa', icon: PlusCircle },
    { label: t('nav.historico'), path: '/historico', icon: History },
    { label: t('nav.pagamentos'), path: '/pagamentos', icon: Wallet },
    { label: t('nav.tribunal'), path: '/tribunal', icon: Gavel },
    { label: t('nav.agentesOnline'), path: '/agentes-online', icon: Wifi },
    { label: t('nav.admin'), path: '/admin', icon: ShieldCheck },
    { label: t('nav.configuracoes'), path: '/configuracoes', icon: Settings },
    { label: t('nav.perfil'), path: '/perfil', icon: User },
  ], [t]);

  useEffect(() => {
    if (!open) { setTerm(''); setMultas([]); }
  }, [open]);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) { setMultas([]); setLoading(false); return; }
    setLoading(true);
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      const like = `%${q}%`;
      const { data } = await supabase
        .from('multas')
        .select('id,numero,numero_auto,infrator_nome,infrator_documento,matricula,valor,status,created_at')
        .or(
          `numero.ilike.${like},numero_auto.ilike.${like},infrator_nome.ilike.${like},infrator_documento.ilike.${like},matricula.ilike.${like}`
        )
        .order('created_at', { ascending: false })
        .limit(8);
      if (id !== reqId.current) return;
      setMultas(data ?? []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [term]);

  const paginasFiltradas = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return PAGINAS;
    return PAGINAS.filter(p => p.label.toLowerCase().includes(q));
  }, [term, PAGINAS]);

  const go = (path: string) => {
    onOpenChange(false);
    if (path === 'action:chat') {
      window.dispatchEvent(new CustomEvent('open-user-chat'));
    } else if (path === 'action:manual') {
      window.dispatchEvent(new CustomEvent('open-user-manual'));
    } else {
      navigate(path);
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={lang === 'en' ? "Search fine by Nº, plate, ID or name — or go to a page..." : "Pesquisar multa por nº, matrícula, BI ou nome — ou ir para uma página..."}
        value={term}
        onValueChange={setTerm}
      />
      <CommandList className="max-h-[60vh]">
        {!loading && term.trim().length >= 2 && multas.length === 0 && paginasFiltradas.length === 0 && (
          <CommandEmpty>{t('common.noResults')}</CommandEmpty>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}
          </div>
        )}

        {multas.length > 0 && (
          <>
            <CommandGroup heading={lang === 'en' ? "Fines" : "Multas"}>
              {multas.map(m => (
                <CommandItem
                  key={m.id}
                  value={`multa-${m.id}-${m.numero}-${m.infrator_nome}`}
                  onSelect={() => go(`/historico?multa=${m.id}`)}
                  className="gap-3"
                >
                  <FileText className="text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.infrator_nome}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {m.numero}
                      {m.matricula ? ` · ${m.matricula}` : ''}
                      {m.infrator_documento ? ` · ID ${m.infrator_documento}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-semibold">{Number(m.valor).toFixed(2)} MT</span>
                    <span className="text-[10px] capitalize text-muted-foreground">{getStatusLabel(m.status, lang)}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {paginasFiltradas.length > 0 && (
          <CommandGroup heading={lang === 'en' ? "Go to" : "Ir para"}>
            {paginasFiltradas.map(p => (
              <CommandItem key={p.path} value={`pagina-${p.label}`} onSelect={() => go(p.path)} className="gap-3">
                <p.icon className="text-muted-foreground" />
                <span className="text-sm">{p.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}