import { useState } from 'react';
import { LayoutDashboard, Siren, History, ShieldCheck, User, Wallet, Settings, Radio, LogOut, AlertTriangle, Gavel, Trophy, MessageSquareWarning, BadgeCheck } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole, canAccess } from '@/hooks/useUserRole';
import { useIsMobile } from '@/hooks/use-mobile';
import logoMatola from '@/assets/logo-matola.png';

import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const menuPrincipal = [
  { key: 'nav.dashboard', url: '/', icon: LayoutDashboard, minLevel: 'agente_campo' as const },
  { key: 'nav.multas', url: '/nova-multa', icon: Siren, minLevel: 'agente_campo' as const },
  { key: 'nav.pagamentos', url: '/pagamentos', icon: Wallet, minLevel: 'agente_campo' as const },
  { key: 'nav.historico', url: '/historico', icon: History, minLevel: 'agente_campo' as const },
  { key: 'nav.reclamacoes', url: '/reclamacoes', icon: MessageSquareWarning, minLevel: 'agente_campo' as const },
];

const menuAdmin = [
  { key: 'nav.tribunal', url: '/tribunal', icon: Gavel, minLevel: 'supervisor' as const },
  { key: 'nav.produtividade', url: '/produtividade', icon: Trophy, minLevel: 'supervisor' as const },
  { key: 'nav.admin', url: '/admin', icon: ShieldCheck, minLevel: 'admin' as const },
  { key: 'nav.configuracoes', url: '/configuracoes', icon: Settings, minLevel: 'agente_campo' as const },
];

const menuPessoal = [
  { key: 'nav.perfil', url: '/perfil', icon: BadgeCheck, minLevel: 'agente_campo' as const },
  { key: 'nav.agentesOnline', url: '/agentes-online', icon: Radio, minLevel: 'agente_campo' as const },
];

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { signOut } = useAuth();
  const { t } = useLanguage();
  const { nivelAcesso, loading: roleLoading } = useUserRole();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const renderGroup = (label: string, items: Array<{ key: string; url: string; icon: React.ElementType; minLevel: 'presidente' | 'admin' | 'supervisor' | 'agente_campo' }>) => {
    const effectiveNivel = roleLoading ? 'agente_campo' : nivelAcesso;
    const visibleItems = items.filter(item => canAccess(effectiveNivel, item.minLevel));
    if (visibleItems.length === 0) return null;

    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-bold text-sidebar-foreground/40">
          {label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {visibleItems.map((item) => (
              <SidebarMenuItem key={item.key}>
                <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                  <NavLink
                    to={item.url}
                    end
                    className="hover:bg-sidebar-accent/50 text-[13px] transition-colors"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold border-l-2 border-sidebar-primary"
                    onClick={handleNavClick}
                  >
                    <item.icon className="h-4 w-4" />
                    {!collapsed && <span>{t(item.key)}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <img src={logoMatola} alt="Brasão do Conselho Municipal da Matola" className="w-10 h-10 object-contain flex-shrink-0 drop-shadow" />
            {!collapsed && (
              <div className="min-w-0">
                <h2 className="text-sm font-extrabold text-sidebar-foreground leading-tight tracking-[0.15em]">SIGEMM</h2>
                <p className="text-[10px] text-sidebar-foreground/50 leading-tight">{t('nav.subtitle')}</p>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent className="py-2">
          {renderGroup(t('nav.principal'), menuPrincipal)}
          {renderGroup(t('nav.gestao'), menuAdmin)}
          {renderGroup(t('nav.conta'), menuPessoal)}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-3 space-y-2">
          <Button
            variant="ghost"
            onClick={() => setLogoutOpen(true)}
            className={`w-full text-destructive hover:text-destructive hover:bg-destructive/10 ${collapsed ? 'justify-center px-0' : 'justify-start gap-2'}`}
            size="sm"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span className="text-xs font-medium">{t('nav.logout')}</span>}
          </Button>
          {!collapsed && (
            <p className="text-[9px] text-sidebar-foreground/40 text-center leading-tight">
              Conselho Municipal da Matola
              <br />
              <a
                href="https://www.facebook.com/sideoutstudios"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-sidebar-foreground transition-colors"
              >
                Sideout Studios
              </a>{' '}
              © {new Date().getFullYear()}
            </p>
          )}
        </SidebarFooter>
      </Sidebar>

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('header.logoutConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('header.logoutConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={signOut}>
              {t('header.logoutConfirmBtn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
