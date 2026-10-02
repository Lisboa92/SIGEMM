import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Keyboard, BookOpen, Eye, MessageSquare, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import UserManualViewer from '@/components/UserManualViewer';

export default function ShortcutsHelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t, lang } = useLanguage();
  const [manualOpen, setManualOpen] = useState(false);

  const GRUPOS = [
    {
      titulo: lang === 'en' ? 'General' : 'Geral',
      itens: [
        { teclas: ['Ctrl', 'K'], label: lang === 'en' ? 'Global search (fines & pages)' : 'Pesquisa global (multas e páginas)' },
        { teclas: ['N'], label: lang === 'en' ? 'New fine' : 'Nova multa' },
        { teclas: ['?'], label: lang === 'en' ? 'Show this help' : 'Mostrar esta ajuda' },
      ],
    },
    {
      titulo: lang === 'en' ? 'Quick Navigation' : 'Navegação rápida',
      itens: [
        { teclas: ['G', 'D'], label: t('nav.dashboard') },
        { teclas: ['G', 'M'], label: `${t('nav.multas')} / ${t('nav.historico')}` },
        { teclas: ['G', 'P'], label: t('nav.pagamentos') },
        { teclas: ['G', 'T'], label: t('nav.tribunal') },
        { teclas: ['G', 'A'], label: t('nav.agentesOnline') },
        { teclas: ['G', 'C'], label: t('nav.configuracoes') },
        { teclas: ['G', 'U'], label: t('nav.perfil') },
      ],
    },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-primary" /> {t('shortcuts.title')}
            </DialogTitle>
            <DialogDescription>{t('shortcuts.desc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Manual Oficial do Utilizador</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">INTERACTIVO</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Guia completo de procedimentos operacionais, fiscalização, emissão de multas e regras do sistema.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2 text-xs border-primary/30"
                  onClick={() => {
                    onOpenChange(false);
                    setManualOpen(true);
                  }}
                >
                  <Eye className="h-3.5 w-3.5" /> Manual do Utilizador
                </Button>
                <Button
                  size="sm"
                  className="w-full gap-2 text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
                  onClick={() => {
                    onOpenChange(false);
                    window.dispatchEvent(new CustomEvent('open-user-chat'));
                  }}
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Chat dos Agentes
                </Button>
              </div>
            </div>

            {GRUPOS.map(g => (
              <div key={g.titulo} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.titulo}</p>
                <div className="space-y-1">
                  {g.itens.map(i => (
                    <div key={i.label} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60">
                      <span className="text-sm text-foreground">{i.label}</span>
                      <span className="flex items-center gap-1">
                        {i.teclas.map(t => (
                          <kbd key={t} className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                            {t}
                          </kbd>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <UserManualViewer open={manualOpen} onOpenChange={setManualOpen} />
    </>
  );
}