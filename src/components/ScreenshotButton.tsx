import { useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function ScreenshotButton() {
  const [capturing, setCapturing] = useState(false);

  const handleScreenshot = async () => {
    setCapturing(true);
    try {
      // Use html2canvas approach via canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const el = document.documentElement;
      
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }

      // Use the native getDisplayMedia API
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: { displaySurface: 'browser' } as any 
        });
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx?.drawImage(video, 0, 0);
        
        stream.getTracks().forEach(t => t.stop());
        
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `SIGEMM_screenshot_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.png`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Screenshot guardado com sucesso!');
          }
        }, 'image/png');
      } catch {
        toast.error('Screenshot cancelado ou não suportado.');
      }
    } catch {
      toast.error('Erro ao capturar screenshot.');
    }
    setCapturing(false);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10"
      onClick={handleScreenshot}
      disabled={capturing}
      title="Capturar Ecrã"
    >
      {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
    </Button>
  );
}
