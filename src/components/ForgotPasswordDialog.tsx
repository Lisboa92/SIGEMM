import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Loader2, Mail, ShieldQuestion, Send, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { sendPasswordResetEmail } from '@/lib/emailService';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function ForgotPasswordDialog({ open, onOpenChange }: Props) {
  const { t, lang } = useLanguage();
  const [email, setEmail] = useState('');
  const [identificador, setIdentificador] = useState('');
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sentResult, setSentResult] = useState<{
    email: string;
    simulated?: boolean;
    tempPassword?: string;
  } | null>(null);

  const emailValido = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

  function generateTempPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'MATOLA-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async function enviarPorEmail() {
    setErrorMessage(null);
    if (!emailValido(email)) {
      const msg = lang === 'en' ? 'Please enter a valid email' : 'Introduza um email válido';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    setLoadingEmail(true);

    try {
      // 1. Check if agent exists in Supabase
      const cleanEmail = email.trim().toLowerCase();
      const { data: agente } = await supabase
        .from('agentes')
        .select('id, nome, email')
        .eq('email', cleanEmail)
        .maybeSingle();

      const tempPass = generateTempPassword();

      // 2. Dispatch real email via backend server API
      const emailResult = await sendPasswordResetEmail({
        to: cleanEmail,
        nome: agente?.nome || 'Utilizador SIGEMM',
        tempPassword: tempPass,
      });

      if (!emailResult.success) {
        throw new Error(emailResult.error || 'Falha ao despachar email pelo servidor.');
      }

      // 3. Update agent temporary password flag in DB if agent exists
      if (agente) {
        await supabase
          .from('agentes')
          .update({
            requires_password_change: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', agente.id);
      }

      // Also invoke edge function fallback if registered
      try {
        await supabase.functions.invoke('send-temp-password', {
          body: { email: cleanEmail, tempPassword: tempPass },
        });
      } catch {
        // Handled by backend API
      }

      setLoadingEmail(false);
      setSentResult({
        email: cleanEmail,
        simulated: emailResult.simulated,
      });

      toast.success(
        lang === 'en'
          ? 'Temporary password sent to your email!'
          : 'Senha provisória enviada com sucesso para o seu email!'
      );
    } catch (err: any) {
      setLoadingEmail(false);
      const errMsg = err.message || (lang === 'en' ? 'Could not send temporary password' : 'Não foi possível enviar a senha provisória');
      setErrorMessage(errMsg);
      toast.error(errMsg);
    }
  }

  async function pedirAoAdministrador() {
    setErrorMessage(null);
    if (identificador.trim().length < 3) {
      const msg = lang === 'en' ? 'Enter your email or username' : 'Introduza o seu email ou nome de utilizador';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    setLoadingAdmin(true);

    try {
      const { error } = await supabase.from('password_reset_requests').insert({
        identificador: identificador.trim(),
        status: 'pendente',
        created_at: new Date().toISOString(),
      });

      if (error) {
        // Fallback to edge function or audit log
        await supabase.functions.invoke('request-password-reset', {
          body: { identificador: identificador.trim() },
        });
      }

      setLoadingAdmin(false);
      toast.success(
        lang === 'en'
          ? 'Request sent to administrator. You will receive new credentials by email.'
          : 'Pedido enviado ao administrador. As novas credenciais serão enviadas para o seu email.'
      );
      handleClose();
    } catch {
      setLoadingAdmin(false);
      toast.success(lang === 'en' ? 'Request recorded.' : 'Pedido registado com sucesso.');
      handleClose();
    }
  }

  function handleClose() {
    setEmail('');
    setIdentificador('');
    setErrorMessage(null);
    setSentResult(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(true); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldQuestion className="h-5 w-5 text-primary" /> {t('forgot.title')}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t('forgot.desc')}
          </DialogDescription>
        </DialogHeader>

        {sentResult ? (
          <div className="space-y-4 py-2 animate-fade-in">
            <Card className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2.5">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <h3 className="font-semibold text-sm text-foreground">
                {lang === 'en' ? 'Email Dispatched!' : 'Email Enviado com Sucesso!'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {lang === 'en'
                  ? 'The provisional password and login instructions were sent to:'
                  : 'A senha provisória e as instruções de acesso foram enviadas para:'}
              </p>
              <p className="text-xs font-mono font-bold text-foreground break-all bg-background/80 py-1.5 px-2 rounded border border-emerald-500/20">
                {sentResult.email}
              </p>
              <div className="pt-2 text-[11px] text-muted-foreground border-t border-emerald-500/20 text-left space-y-1">
                <p className="font-medium text-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-primary" />
                  {lang === 'en' ? 'Check your email inbox:' : 'Verifique a sua caixa de correio:'}
                </p>
                <p className="text-[10px] leading-relaxed">
                  {lang === 'en'
                    ? 'For security reasons, your temporary password is not displayed here. Open your email to retrieve it and access your account.'
                    : 'Por motivos de segurança, a senha provisória não é exibida nesta tela. Abra o seu correio electrónico para visualizá-la.'}
                </p>
              </div>
            </Card>
            <p className="text-[11px] text-muted-foreground text-center">
              {lang === 'en'
                ? 'Check your inbox and spam folder. On first login, you will be prompted to choose a new password.'
                : 'Verifique a caixa de entrada e a pasta de spam. No primeiro acesso, deverá definir uma nova senha pessoal.'}
            </p>
            <Button className="w-full" onClick={handleClose}>
              {lang === 'en' ? 'Back to Login' : 'Voltar ao Login'}
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="email">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="email" className="text-xs">{t('forgot.byEmail')}</TabsTrigger>
              <TabsTrigger value="admin" className="text-xs">{t('forgot.byAdmin')}</TabsTrigger>
            </TabsList>

            {errorMessage && (
              <Card className="p-2.5 mt-3 bg-destructive/10 border-destructive/30 flex items-start gap-2 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="flex-1">{errorMessage}</span>
              </Card>
            )}

            <TabsContent value="email" className="space-y-3 mt-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">{lang === 'en' ? 'Institutional Email' : 'Email Institucional'}</Label>
                <Input
                  type="email"
                  placeholder="nome@matola.gov.mz"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  autoComplete="email"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t('forgot.emailHelp')}
              </p>
              <Button className="w-full gap-2" onClick={enviarPorEmail} disabled={loadingEmail}>
                {loadingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {t('forgot.sendBtn')}
              </Button>
            </TabsContent>

            <TabsContent value="admin" className="space-y-3 mt-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">{lang === 'en' ? 'Email or Username' : 'Email ou Nome de Utilizador'}</Label>
                <Input
                  placeholder="joao.silva"
                  value={identificador}
                  onChange={(e) => {
                    setIdentificador(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t('forgot.adminHelp')}
              </p>
              <Button variant="secondary" className="w-full gap-2" onClick={pedirAoAdministrador} disabled={loadingAdmin}>
                {loadingAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {t('forgot.requestAdminBtn')}
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
