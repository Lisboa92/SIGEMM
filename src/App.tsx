import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PowerSyncProvider } from "@/lib/powersync";
import { useUserRole, canAccess } from "@/hooks/useUserRole";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import ForceChangePassword from "@/components/ForceChangePassword";
import DashboardPage from "@/pages/DashboardPage";
import NovaMultaPage from "@/pages/NovaMultaPage";
import HistoricoPage from "@/pages/HistoricoPage";
import PagamentosPage from "@/pages/PagamentosPage";
import PerfilPage from "@/pages/PerfilPage";
import AdminPage from "@/pages/AdminPage";
import ConfiguracoesPage from "@/pages/ConfiguracoesPage";
import AgentesOnlinePage from "@/pages/AgentesOnlinePage";
import TribunalPage from "@/pages/TribunalPage";
import ProdutividadePage from "@/pages/ProdutividadePage";
import ReclamacoesPage from "@/pages/ReclamacoesPage";
import NotFound from "@/pages/NotFound";
import { usePrefetchData } from "@/hooks/usePrefetchData";
import ErrorBoundary from "@/components/ErrorBoundary";

const queryClient = new QueryClient();

function ProtectedRoute({ children, requiredLevel }: { children: React.ReactNode; requiredLevel?: 'superadmin' | 'presidente' | 'admin' | 'supervisor' | 'agente_campo' }) {
  const { user, loading, mustChangePassword } = useAuth();
  const { nivelAcesso, loading: roleLoading } = useUserRole();
  useIdleLogout();

  if (loading || roleLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;

  if (requiredLevel && !canAccess(nivelAcesso, requiredLevel)) {
    return <AppLayout><div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <span className="text-2xl">🔒</span>
      </div>
      <h2 className="text-lg font-bold text-foreground">Acesso Restrito</h2>
      <p className="text-sm text-muted-foreground max-w-xs">Não tem permissões para aceder a esta página. Contacte o administrador.</p>
    </div></AppLayout>;
  }

  return (
    <AppLayout>
      <ErrorBoundary>
        {mustChangePassword && <ForceChangePassword />}
        {children}
      </ErrorBoundary>
    </AppLayout>
  );
}

function AppRoutes() {
  usePrefetchData();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/nova-multa" element={<ProtectedRoute><NovaMultaPage /></ProtectedRoute>} />
      <Route path="/pagamentos" element={<ProtectedRoute><PagamentosPage /></ProtectedRoute>} />
      <Route path="/historico" element={<ProtectedRoute><HistoricoPage /></ProtectedRoute>} />
      <Route path="/reclamacoes" element={<ProtectedRoute><ReclamacoesPage /></ProtectedRoute>} />
      <Route path="/perfil" element={<ProtectedRoute><PerfilPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute requiredLevel="admin"><AdminPage /></ProtectedRoute>} />
      <Route path="/configuracoes" element={<ProtectedRoute><ConfiguracoesPage /></ProtectedRoute>} />
      <Route path="/agentes-online" element={<ProtectedRoute><AgentesOnlinePage /></ProtectedRoute>} />
      <Route path="/tribunal" element={<ProtectedRoute requiredLevel="supervisor"><TribunalPage /></ProtectedRoute>} />
      <Route path="/produtividade" element={<ProtectedRoute requiredLevel="supervisor"><ProdutividadePage /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <PowerSyncProvider>
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AppRoutes />
              </BrowserRouter>
            </PowerSyncProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
