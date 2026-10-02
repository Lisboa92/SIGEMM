import { useState } from 'react';
import { Download, Share, Smartphone, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PWAInstallButton({ variant = 'ghost', size = 'sm', className = '' }: { variant?: 'ghost' | 'outline' | 'default'; size?: 'sm' | 'default' | 'icon'; className?: string }) {
  const { isInstallable, isInstalled, isIOS, installPWA } = usePWAInstall();
  const { lang } = useLanguage();
  const [showIosGuide, setShowIosGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIosGuide(true);
      return;
    }
    await installPWA();
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleInstallClick}
        className={`gap-1.5 text-xs font-semibold ${className}`}
        title={lang === 'en' ? 'Install SIGEMM on your device for fast offline access' : 'Instalar SIGEMM no telemóvel para acesso offline'}
      >
        <Download className="h-3.5 w-3.5" />
        <span>{lang === 'en' ? 'Install App' : 'Instalar App'}</span>
      </Button>

      {/* iOS Installation Guide Dialog */}
      <Dialog open={showIosGuide} onOpenChange={setShowIosGuide}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-5 w-5 text-primary" />
              <span>{lang === 'en' ? 'Install on iPhone / iPad' : 'Instalar no iPhone / iPad'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {lang === 'en'
                ? 'Follow these steps to add SIGEMM to your home screen:'
                : 'Siga estes 2 passos simples no Safari para instalar:'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="flex items-start gap-3 p-2.5 rounded-lg border bg-card">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                1
              </span>
              <div className="leading-tight">
                <p className="font-semibold text-foreground">
                  {lang === 'en' ? 'Tap the Share button' : 'Toque no botão Partilhar'}
                </p>
                <p className="text-muted-foreground text-[11px] mt-0.5 flex items-center gap-1">
                  <Share className="h-3 w-3 inline" /> {lang === 'en' ? 'at the bottom of Safari' : 'na barra inferior do Safari'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-lg border bg-card">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                2
              </span>
              <div className="leading-tight">
                <p className="font-semibold text-foreground">
                  {lang === 'en' ? 'Select "Add to Home Screen"' : 'Selecione "Ecrã Principal"'}
                </p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  {lang === 'en' ? 'Scroll down and tap the + icon' : 'Deslize para baixo e toque no ícone +'}
                </p>
              </div>
            </div>
          </div>

          <Button size="sm" variant="default" onClick={() => setShowIosGuide(false)} className="w-full text-xs">
            {lang === 'en' ? 'Understood' : 'Entendido'}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
