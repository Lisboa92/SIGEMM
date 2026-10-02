import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

interface Options {
  onOpenSearch: () => void;
  onOpenHelp: () => void;
}

/**
 * Atalhos globais do SIGEMM:
 *  Ctrl/⌘ + K  → pesquisa global
 *  g d / g m / g p / g t / g a → navegação rápida
 *  n → nova multa · ? → ajuda de atalhos
 */
export function useKeyboardShortcuts({ onOpenSearch, onOpenHelp }: Options) {
  const navigate = useNavigate();

  useEffect(() => {
    let awaitingGoto = false;
    let gotoTimer: ReturnType<typeof setTimeout> | undefined;

    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenSearch();
        return;
      }
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;

      if (awaitingGoto) {
        awaitingGoto = false;
        clearTimeout(gotoTimer);
        const routes: Record<string, string> = {
          d: '/', m: '/historico', p: '/pagamentos', t: '/tribunal',
          a: '/agentes-online', c: '/configuracoes', u: '/perfil',
        };
        const path = routes[e.key.toLowerCase()];
        if (path) { e.preventDefault(); navigate(path); }
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'g') {
        awaitingGoto = true;
        gotoTimer = setTimeout(() => { awaitingGoto = false; }, 1200);
        return;
      }
      if (key === 'n') { e.preventDefault(); navigate('/nova-multa'); return; }
      if (e.key === '?') { e.preventDefault(); onOpenHelp(); }
    };

    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); clearTimeout(gotoTimer); };
  }, [navigate, onOpenSearch, onOpenHelp]);
}