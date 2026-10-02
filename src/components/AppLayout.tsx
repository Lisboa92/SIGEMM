import { useCallback, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { HeaderUserMenu } from '@/components/HeaderUserMenu';
import OfflineIndicator from '@/components/OfflineIndicator';
import PWAInstallButton from '@/components/PWAInstallButton';
import BottomNav from '@/components/BottomNav';

import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import GlobalSearch from '@/components/GlobalSearch';
import ShortcutsHelpDialog from '@/components/ShortcutsHelpDialog';
import UserChatWidget from '@/components/UserChatWidget';
import UserManualViewer from '@/components/UserManualViewer';
import { useLanguage } from '@/contexts/LanguageContext';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { LayoutDashboard, Siren, History, ShieldCheck, User, Wallet, Settings, Radio, Sun, Moon, Search, Gavel, MessageSquareWarning, Trophy } from 'lucide-react';

const pageMeta: Record<string, { key: string; icon: React.ElementType }> = {
  '/': { key: 'nav.dashboard', icon: LayoutDashboard },
  '/nova-multa': { key: 'nav.multas', icon: Siren },
  '/pagamentos': { key: 'nav.pagamentos', icon: Wallet },
  '/historico': { key: 'nav.historico', icon: History },
  '/reclamacoes': { key: 'nav.reclamacoes', icon: MessageSquareWarning },
  '/admin': { key: 'nav.admin', icon: ShieldCheck },
  '/configuracoes': { key: 'nav.configuracoes', icon: Settings },
  '/perfil': { key: 'nav.perfil', icon: User },
  '/agentes-online': { key: 'nav.agentesOnline', icon: Radio },
  '/tribunal': { key: 'nav.tribunal', icon: Gavel },
  '/produtividade': { key: 'nav.produtividade', icon: Trophy },
};

export default function AppLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const { t } = useLanguage();
  const currentPage = pageMeta[location.pathname];
  const pageTitle = currentPage ? t(currentPage.key) : 'SIGEMM';
  const PageIcon = currentPage?.icon ?? ShieldCheck;
  const { theme, toggleTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    const handleOpenManual = () => setManualOpen(true);
    window.addEventListener('open-user-manual', handleOpenManual);
    return () => window.removeEventListener('open-user-manual', handleOpenManual);
  }, []);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  useKeyboardShortcuts({ onOpenSearch: openSearch, onOpenHelp: openHelp });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-h-screen">
          <header className="gradient-header sticky top-0 z-40 h-14 flex items-center justify-between px-2 md:px-4 shadow-md border-b-2 border-secondary/60">
            <div className="flex items-center gap-2 md:gap-3">
              <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10 h-9 w-9" />
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-foreground/10 ring-1 ring-primary-foreground/20">
                  <PageIcon className="h-4 w-4 text-secondary" />
                </span>
                <div className="leading-tight">
                  <h1 className="text-sm md:text-base font-bold text-primary-foreground tracking-wide">{pageTitle}</h1>
                  <p className="hidden md:block text-[9px] text-primary-foreground/60 tracking-[0.18em] uppercase">Polícia Municipal · Matola</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <OfflineIndicator />
              <PWAInstallButton
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-primary-foreground hover:bg-primary-foreground/15 bg-primary-foreground/10 rounded-lg hidden sm:flex"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={openSearch}
                className="h-9 gap-2 px-2 text-primary-foreground hover:bg-primary-foreground/10"
                title={`${t('common.search')} (Ctrl + K)`}
              >
                <Search className="h-4 w-4" />
                <kbd className="hidden md:inline rounded border border-primary-foreground/30 px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10"
                title={theme === 'light' ? t('header.changeThemeDark') : t('header.changeThemeLight')}
              >
                {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
              
              <HeaderUserMenu />
            </div>
          </header>
          <main className="flex-1 p-3.5 pb-28 sm:p-4 sm:pb-24 md:p-6 md:pb-6 max-w-5xl w-full mx-auto">
            {children}
          </main>
          <footer className="border-t border-border bg-card px-4 py-3 hidden md:block">
            <p className="text-[10px] md:text-xs text-muted-foreground text-center leading-relaxed">
              {t('login.welcome')} — <span className="font-semibold">SIGEMM</span> — {t('login.devCredit').includes('Developed') ? 'Developed by' : 'Desenvolvido pela'}{' '}
              <a
                href="https://www.facebook.com/sideoutstudios"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-foreground hover:text-primary transition-colors"
              >
                Sideout Studios
              </a>
            </p>
          </footer>
          <BottomNav />
        </div>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <ShortcutsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <UserChatWidget />
      <UserManualViewer open={manualOpen} onOpenChange={setManualOpen} />
    </SidebarProvider>
  );
}
