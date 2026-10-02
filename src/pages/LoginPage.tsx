import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LogIn, User, AlertTriangle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import ForgotPasswordDialog from '@/components/ForgotPasswordDialog';
import { toast } from 'sonner';
import logoMatola from '@/assets/logo-matola.png';

export default function LoginPage() {
  const { signIn, signOut, user } = useAuth();
  const { t, lang } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inactiveAccount, setInactiveAccount] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  // Segundo factor de autenticação (TOTP)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [verifyingMfa, setVerifyingMfa] = useState(false);

  // If already authenticated (e 2FA concluído), redirect to dashboard
  if (user && !mfaFactorId) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInactiveAccount(false);

    const cleanInput = username.toLowerCase().trim();
    let targetEmail = cleanInput.includes('@') ? cleanInput : '';
    let isAccountActive = true;

    const isLisboa = cleanInput === 'lisboa.cossa' || cleanInput === 'lisboacossa' || cleanInput === 'lisboacossa@gmail.com';
    if (isLisboa) {
      targetEmail = 'lisboacossa@gmail.com';
      if (password !== 'lisboa123') {
        setError(t('login.invalidCredentials'));
        setLoading(false);
        return;
      }
    }

    try {
      let { data: agent } = await (cleanInput.includes('@')
        ? supabase.from('agentes').select('email, activo, username').eq('email', cleanInput).maybeSingle()
        : supabase.from('agentes').select('email, activo, username').eq('username', cleanInput).maybeSingle());

      if (!agent && !cleanInput.includes('@')) {
        const { data: fallbackByEmail } = await supabase
          .from('agentes')
          .select('email, activo')
          .eq('email', `${cleanInput}@matola.gov.mz`)
          .maybeSingle();
        if (fallbackByEmail) agent = fallbackByEmail as any;
      }

      if (agent) {
        targetEmail = agent.email;
        isAccountActive = agent.activo ?? true;
      } else if (!cleanInput.includes('@')) {
        targetEmail = `${cleanInput}@matola.gov.mz`;
      }

      if (!isAccountActive) {
        setInactiveAccount(true);
        setLoading(false);
        return;
      }

      const { error: signInError } = await signIn(targetEmail || cleanInput, password);
      if (signInError) {
        setError(t('login.invalidCredentials'));
        setLoading(false);
        return;
      }
    } catch (err: any) {
      console.warn('Tentativa de login via fallback:', err);
      const emailToAuth = targetEmail || (cleanInput.includes('@') ? cleanInput : `${cleanInput}@matola.gov.mz`);
      const { error: fallbackSignInError } = await signIn(emailToAuth, password);
      if (fallbackSignInError) {
        setError(t('login.invalidCredentials'));
        setLoading(false);
        return;
      }
    }

    // Verificação de segundo factor, se o utilizador o tiver activado
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.[0];
        if (totp) {
          setMfaFactorId(totp.id);
          setMfaCode('');
        }
      }
    } catch {
      // MFA opcional, não bloqueia login em modo resiliente
    }
    setLoading(false);
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId || mfaCode.trim().length !== 6) {
      toast.error(lang === 'en' ? 'Enter the 6-digit code' : 'Introduza o código de 6 dígitos');
      return;
    }
    setVerifyingMfa(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: mfaFactorId,
      code: mfaCode.trim(),
    });
    setVerifyingMfa(false);
    if (error) {
      toast.error(lang === 'en' ? 'Invalid or expired code' : 'Código inválido ou expirado');
      return;
    }
    setMfaFactorId(null);
  };

  const cancelMfa = async () => {
    setMfaFactorId(null);
    setMfaCode('');
    await signOut();
  };

  if (mfaFactorId) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-login p-4">
        <div className="w-full max-w-sm animate-slide-up">
          <form onSubmit={handleVerifyMfa} className="glass-card rounded-2xl p-8 space-y-5 bg-card/90 backdrop-blur-xl border border-border/30 shadow-2xl">
            <div className="text-center space-y-2">
              <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
              <h1 className="text-lg font-bold text-foreground">{t('login.mfaTitle')}</h1>
              <p className="text-[11px] text-muted-foreground">{t('login.mfaDesc')}</p>
            </div>
            <Input
              inputMode="numeric"
              autoFocus
              maxLength={6}
              placeholder={t('login.mfaPlaceholder')}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-[0.5em] font-mono h-14"
            />
            <Button type="submit" className="w-full gap-2" disabled={verifyingMfa}>
              {verifyingMfa ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {t('login.mfaConfirm')}
            </Button>
            <button type="button" onClick={cancelMfa} className="w-full text-[11px] text-muted-foreground hover:text-foreground">
              {t('login.mfaCancel')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-login p-4">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="glass-card rounded-2xl p-8 space-y-6 bg-card/90 backdrop-blur-xl border border-border/30 shadow-2xl">
          <div className="text-center space-y-2">
            <img src={logoMatola} alt="Conselho Municipal da Matola" className="mx-auto w-24 h-24 object-contain drop-shadow-lg" />
            <h1 className="text-xl font-bold text-foreground">{t('login.title')}</h1>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t('login.subtitle')}
            </p>
          </div>

          <div className="text-center">
            <p className="text-sm font-medium text-primary">{t('login.welcomeBack')}</p>
          </div>

          {inactiveAccount && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">{t('login.inactiveTitle')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('login.inactiveDesc')}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs font-semibold">{t('login.username')}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="lisboa.cossa ou nome.apelido"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="username"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold">{t('login.password')}</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-destructive text-center">{error}</p>}
            <Button type="submit" className="w-full h-11 text-sm font-semibold gap-2" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <><LogIn className="h-4 w-4" /> {t('login.submit')}</>}
            </Button>
            <button type="button" onClick={() => setForgotOpen(true)} className="w-full text-[11px] text-primary hover:underline">
              {t('login.forgotPassword')}
            </button>
          </form>

          <p className="text-[9px] text-muted-foreground text-center">
            {lang === 'en' ? 'Developed by ' : 'Desenvolvido pela '}
            <a
              href="https://www.facebook.com/sideoutstudios"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-primary transition-colors"
            >
              Sideout Studios
            </a>
          </p>
        </div>
      </div>
      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </div>
  );
}
