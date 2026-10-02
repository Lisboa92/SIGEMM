import { useState } from 'react';
import { changePassword } from '@/lib/changePassword';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, KeyRound, Eye, EyeOff, Lock } from 'lucide-react';
import { toast } from 'sonner';
import logoMatola from '@/assets/logo-matola.png';

export default function ForceChangePassword() {
  const { setMustChangePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [changing, setChanging] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[!@#$%^&*]/.test(newPassword)) {
      toast.error('A senha deve conter: maiúscula, número e caractere especial');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    setChanging(true);
    const { error } = await changePassword({ newPassword });
    if (error) {
      toast.error(error);
      setChanging(false);
      return;
    }
    toast.success('Senha alterada com sucesso! Bem-vindo ao SIGEMM.');
    setMustChangePassword(false);
    setChanging(false);
  };

  const passwordChecks = [
    { test: newPassword.length >= 8, label: '8+ caracteres' },
    { test: /[A-Z]/.test(newPassword), label: 'Maiúscula' },
    { test: /[0-9]/.test(newPassword), label: 'Número' },
    { test: /[!@#$%^&*]/.test(newPassword), label: 'Especial' },
  ];

  const allValid = passwordChecks.every(c => c.test) && newPassword === confirmNewPassword && newPassword.length > 0;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader className="text-center items-center space-y-3">
          <img src={logoMatola} alt="Logo" className="w-14 h-14 object-contain" />
          <div className="flex items-center gap-2 text-primary">
            <Lock className="h-5 w-5" />
            <DialogTitle className="text-lg">Primeira Vez no Sistema</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            É a sua primeira vez no sistema. Por segurança, troque a sua senha temporária para continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Nova Senha</Label>
            <div className="relative">
              <Input
                type={showNewPwd ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setShowNewPwd(!showNewPwd)}>
                {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {passwordChecks.map(r => (
                <span key={r.label} className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${r.test ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {r.test ? '✓' : '○'} {r.label}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Confirmar Nova Senha</Label>
            <Input
              type="password"
              placeholder="Repita a nova senha"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
            />
            {confirmNewPassword && newPassword !== confirmNewPassword && (
              <p className="text-[10px] text-destructive">As senhas não coincidem</p>
            )}
          </div>
          <Button onClick={handleChangePassword} disabled={changing || !allValid} className="w-full gap-2">
            {changing ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {changing ? 'Alterando...' : 'Alterar Senha e Continuar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
