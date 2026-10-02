import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, History, Wallet, Menu } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSidebar } from '@/components/ui/sidebar';

export default function BottomNav() {
  const location = useLocation();
  const { t } = useLanguage();
  const { setOpenMobile } = useSidebar();

  const isMoreActive = [
    '/admin',
    '/reclamacoes',
    '/tribunal',
    '/produtividade',
    '/configuracoes',
    '/perfil',
    '/agentes-online',
  ].some((path) => location.pathname.startsWith(path));

  return (
    <nav
      id="mobile-bottom-navigation"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-card/95 backdrop-blur-xl border-t border-border/80 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] safe-area-bottom select-none"
    >
      <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto relative">
        {/* 1. Início / Dashboard */}
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all duration-200 active:scale-95 ${
              isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-primary/10' : ''}`}>
                <LayoutDashboard className={`w-5 h-5 ${isActive ? 'text-primary scale-110' : ''}`} />
              </div>
              <span className="text-[10px] tracking-tight leading-none mt-0.5">{t('nav.dashboard')}</span>
            </>
          )}
        </NavLink>

        {/* 2. Histórico */}
        <NavLink
          to="/historico"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all duration-200 active:scale-95 ${
              isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-primary/10' : ''}`}>
                <History className={`w-5 h-5 ${isActive ? 'text-primary scale-110' : ''}`} />
              </div>
              <span className="text-[10px] tracking-tight leading-none mt-0.5">{t('nav.historico')}</span>
            </>
          )}
        </NavLink>

        {/* 3. HERO CENTER BUTTON: Nova Multa */}
        <div className="flex-1 flex flex-col items-center justify-center -mt-6">
          <NavLink
            to="/nova-multa"
            className={({ isActive }) =>
              `relative group flex items-center justify-center w-14 h-14 rounded-full shadow-lg border-3 border-background transition-all duration-300 active:scale-90 ${
                isActive
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white ring-4 ring-primary/25 scale-105'
                  : 'bg-gradient-to-tr from-primary to-emerald-600 text-white hover:shadow-xl'
              }`
            }
            title={t('nav.multas')}
          >
            <PlusCircle className="w-7 h-7 text-white stroke-[2.2]" />
            <span className="sr-only">{t('nav.multas')}</span>
          </NavLink>
          <span className="text-[10px] font-semibold text-foreground tracking-tight mt-1">
            {t('nav.multas')}
          </span>
        </div>

        {/* 4. Pagamentos */}
        <NavLink
          to="/pagamentos"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all duration-200 active:scale-95 ${
              isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-primary/10' : ''}`}>
                <Wallet className={`w-5 h-5 ${isActive ? 'text-primary scale-110' : ''}`} />
              </div>
              <span className="text-[10px] tracking-tight leading-none mt-0.5">{t('nav.pagamentos')}</span>
            </>
          )}
        </NavLink>

        {/* 5. Menu / Mais */}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all duration-200 active:scale-95 cursor-pointer ${
            isMoreActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Menu e Opções"
        >
          <div className={`p-1 rounded-xl transition-all ${isMoreActive ? 'bg-primary/10' : ''}`}>
            <Menu className={`w-5 h-5 ${isMoreActive ? 'text-primary scale-110' : ''}`} />
          </div>
          <span className="text-[10px] tracking-tight leading-none mt-0.5">Mais</span>
        </button>
      </div>
    </nav>
  );
}
