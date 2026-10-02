import { useState, useEffect, useRef } from 'react';
import { changePassword } from '@/lib/changePassword';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { LogOut, User, KeyRound, Clock, CalendarDays, Eye, EyeOff, AlertTriangle, Camera, MessageSquare, BookOpen } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { NotificationBell } from '@/components/NotificationBell';

function useRealtimeClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function HeaderUserMenu() {
  const { user, signOut } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const now = useRealtimeClock();

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agenteName, setAgenteName] = useState<string | null>(null);
  const [agenteCargo, setAgenteCargo] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.email) return;
    const isLisboa =
      user.email.toLowerCase() === 'lisboacossa@gmail.com' ||
      user.email.toLowerCase().startsWith('lisboa.cossa') ||
      user.user_metadata?.username?.toLowerCase() === 'lisboa.cossa' ||
      user.user_metadata?.username?.toLowerCase() === 'lisboacossa' ||
      user.user_metadata?.nivel_acesso === 'superadmin';

    if (isLisboa) {
      setAgenteName('Lisboa Cossa');
      setAgenteCargo('SuperAdmin');
    }

    supabase.from('agentes').select('nome, cargo, foto_url').eq('email', user.email).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAgenteName(data.nome || (isLisboa ? 'Lisboa Cossa' : null));
          setAgenteCargo(isLisboa ? 'SuperAdmin' : (data.cargo || null));
          setFotoUrl(data.foto_url);
        }
      });
  }, [user?.email, user?.user_metadata]);

  const handlePhotoUpload = async (file: File) => {
    if (!user?.email) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = urlData.publicUrl + '?t=' + Date.now();
      await supabase.from('agentes').update({ foto_url: publicUrl }).eq('email', user.email!);
      setFotoUrl(publicUrl);
      toast.success(lang === 'en' ? 'Photo updated!' : 'Foto actualizada!');
      setPhotoDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const initials = agenteName
    ? agenteName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : user?.email ? user.email.substring(0, 2).toUpperCase() : 'U';

  const formattedDate = now.toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-MZ', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });

  const formattedTime = now.toLocaleTimeString(lang === 'en' ? 'en-US' : 'pt-MZ', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error(lang === 'en' ? 'New password must have at least 8 characters' : 'A nova senha deve ter pelo menos 8 caracteres');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[!@#$%^&*]/.test(newPassword)) {
      toast.error(lang === 'en' ? 'Password must contain uppercase letter, number and symbol' : 'A senha deve conter maiúscula, número e caractere especial');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(lang === 'en' ? 'Passwords do not match' : 'As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      const { error } = await changePassword({ newPassword, currentPassword });
      if (error) { toast.error(error); }
      else {
        toast.success(lang === 'en' ? 'Password updated successfully!' : 'Senha alterada com sucesso!');
        setPasswordDialogOpen(false);
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      }
    } catch {
      toast.error(lang === 'en' ? 'Failed to update password' : 'Erro inesperado ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Date & Time */}
        <div className="hidden sm:flex items-center gap-2 text-primary-foreground/80 text-xs">
          <div className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="font-medium">{formattedDate}</span>
          </div>
          <span className="text-primary-foreground/40">|</span>
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-mono font-semibold tabular-nums">{formattedTime}</span>
          </div>
        </div>

        {/* Notification Bell */}
        <NotificationBell />

        {/* User Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 w-9 rounded-full border-2 border-primary-foreground/20 hover:border-primary-foreground/50 hover:bg-primary-foreground/10 p-0 transition-all"
            >
              <Avatar className="h-8 w-8">
                {fotoUrl && <AvatarImage src={fotoUrl} alt="Avatar" className="object-cover" />}
                <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64 p-2">
            <DropdownMenuLabel className="font-normal p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-primary/20">
                  {fotoUrl && <AvatarImage src={fotoUrl} alt="Avatar" className="object-cover" />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-semibold text-foreground truncate">{agenteName || user?.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{agenteCargo || (lang === 'en' ? 'Municipal Officer' : 'Agente Municipal')}</p>
                  <p className="text-[10px] text-muted-foreground/70 truncate">{user?.email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 py-2.5 px-3 cursor-pointer rounded-md" onClick={() => navigate('/perfil')}>
              <User className="h-4 w-4 text-muted-foreground" /><span>{t('header.myProfile')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 py-2.5 px-3 cursor-pointer rounded-md text-emerald-700 dark:text-emerald-400 font-medium"
              onClick={() => window.dispatchEvent(new CustomEvent('open-user-chat'))}
            >
              <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Chat Interno dos Agentes</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 py-2.5 px-3 cursor-pointer rounded-md text-primary font-medium"
              onClick={() => window.dispatchEvent(new CustomEvent('open-user-manual'))}
            >
              <BookOpen className="h-4 w-4 text-primary" />
              <span>Manual do Utilizador</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 py-2.5 px-3 cursor-pointer rounded-md" onClick={() => setPhotoDialogOpen(true)}>
              <Camera className="h-4 w-4 text-muted-foreground" /><span>{t('header.changePhoto')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 py-2.5 px-3 cursor-pointer rounded-md" onClick={() => setPasswordDialogOpen(true)}>
              <KeyRound className="h-4 w-4 text-muted-foreground" /><span>{t('header.changePassword')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 py-2.5 px-3 cursor-pointer rounded-md text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => setLogoutDialogOpen(true)}>
              <LogOut className="h-4 w-4" /><span className="font-medium">{t('nav.logout')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> {t('header.changePassword')}</DialogTitle>
            <DialogDescription>{lang === 'en' ? 'Enter your current password and choose a new password.' : 'Introduza a sua senha actual e a nova senha.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{lang === 'en' ? 'Current Password' : 'Senha Actual'}</Label>
              <Input type="password" placeholder="••••••••" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{lang === 'en' ? 'New Password' : 'Nova Senha'}</Label>
              <div className="relative">
                <Input type={showNew ? 'text' : 'password'} placeholder={lang === 'en' ? 'Min 8 characters' : 'Mínimo 8 caracteres'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowNew(!showNew)}>
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{lang === 'en' ? 'Confirm Password' : 'Confirmar Senha'}</Label>
              <div className="relative">
                <Input type={showConfirm ? 'text' : 'password'} placeholder={lang === 'en' ? 'Repeat new password' : 'Repita a nova senha'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowConfirm(!showConfirm)}>
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleChangePassword} disabled={loading}>{loading ? t('common.loading') : t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logout Confirmation */}
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
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

      {/* Photo Upload Dialog */}
      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5 text-primary" /> {t('header.changePhoto')}</DialogTitle>
            <DialogDescription>{lang === 'en' ? 'Select a photo from gallery or take one with camera.' : 'Seleccione uma foto da galeria ou tire uma foto com a câmara.'}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <Avatar className="h-24 w-24 border-4 border-primary/20">
              {fotoUrl && <AvatarImage src={fotoUrl} alt="Avatar" className="object-cover" />}
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">{initials}</AvatarFallback>
            </Avatar>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoUpload(file);
              }}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={() => {
                if (photoInputRef.current) {
                  photoInputRef.current.removeAttribute('capture');
                  photoInputRef.current.click();
                }
              }} disabled={uploadingPhoto}>
                <User className="h-4 w-4" /> {lang === 'en' ? 'Gallery' : 'Galeria'}
              </Button>
              <Button className="gap-2" onClick={() => {
                if (photoInputRef.current) {
                  photoInputRef.current.setAttribute('capture', 'environment');
                  photoInputRef.current.click();
                }
              }} disabled={uploadingPhoto}>
                <Camera className="h-4 w-4" /> {lang === 'en' ? 'Camera' : 'Câmara'}
              </Button>
            </div>
            {uploadingPhoto && <p className="text-xs text-muted-foreground">{t('common.loading')}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

