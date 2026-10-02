import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Loader2, KeyRound, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { changePassword } from '@/lib/changePassword';
import logoMatola from '@/assets/logo-matola.png';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  const checks = [
    { test: password.length >= 8, label: '8+ caracteres' },
    { test: /[A-Z]/.test(password), label: 'Maiúscula' },
    { test: /[0-9]/.test(password), label: 'Número' },
    { test: /[!@#$%^&*]/.test(password), label: 'Especial' },
  ];
  const valid = checks.every(c => c.test) && password === confirm && password.length > 0;

  async function guardar() {
    if (!valid) return;
    setSaving(true);
    const { error } = await changePassword({ newPassword: password });
    setSaving(false);
    if (error) { toast.error(error); return; }
    toast.success('Senha alterada com sucesso.');
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-login p-4">
      <Card className="w-full max-w-sm p-8 space-y-6 bg-card/90 backdrop-blur-xl">
        <div className="text-center space-y-2">
          <img src={logoMatola} alt="Conselho Municipal da Matola" className="mx-auto w-20 h-20 object-contain" />
          <h1 className="text-lg font-bold text-foreground">Definir Nova Senha</h1>
          <p className="text-[11px] text-muted-foreground">
            {ready ? 'Escolha uma senha forte para a sua conta SIGEMM.' : 'A validar o link de recuperação...'}
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">{t('header.newPassword')}</Label>
            <div className="relative">
              <Input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('header.minCharacters')} disabled={!ready} />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {checks.map(c => (
                <span key={c.label} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.test ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {c.test ? '✓' : '○'} {c.label}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">{t('header.confirmPassword')}</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t('header.repeatPassword')} disabled={!ready} />
          </div>
          <Button className="w-full gap-2" onClick={guardar} disabled={!ready || !valid || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {lang === 'en' ? 'Save new password' : 'Guardar nova senha'}
          </Button>
          <button type="button" onClick={() => navigate('/login')} className="w-full text-[11px] text-muted-foreground hover:text-foreground">
            {t('forgot.backToLogin')}
          </button>
        </div>
      </Card>
    </div>
  );
}