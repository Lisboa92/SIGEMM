import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, X, ImagePlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PhotoCaptureProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  multaNumero: string;
}

export default function PhotoCapture({ photos, onPhotosChange, multaNumero }: PhotoCaptureProps) {
  const { t, lang } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const readFileAsDataUrl = (file: File | Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    // If device is offline, immediately return local data URL
    if (!navigator.onLine) {
      return await readFileAsDataUrl(file);
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${multaNumero || 'temp'}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

    try {
      const { error } = await supabase.storage.from('multa-fotos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });

      if (error) {
        console.warn('[PhotoCapture] Supabase storage upload falhou, fallback para Data URL:', error.message);
        return await readFileAsDataUrl(file);
      }

      const { data: urlData } = supabase.storage.from('multa-fotos').getPublicUrl(path);
      return urlData.publicUrl || (await readFileAsDataUrl(file));
    } catch {
      // Offline fallback
      return await readFileAsDataUrl(file);
    }
  }, [multaNumero]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (photos.length + files.length > 5) {
      toast.error(lang === 'en' ? 'Maximum 5 photos allowed' : 'Máximo de 5 fotos permitidas');
      return;
    }

    setUploading(true);
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      const url = await uploadFile(file);
      if (url) newUrls.push(url);
    }

    onPhotosChange([...photos, ...newUrls]);
    setUploading(false);
  };

  const openCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setShowCamera(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      toast.error(lang === 'en' ? 'Could not access camera' : 'Não foi possível aceder à câmera');
    }
  }, [lang]);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (photos.length >= 5) {
      toast.error(lang === 'en' ? 'Maximum 5 photos' : 'Máximo de 5 fotos');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setUploading(true);
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const url = await uploadFile(file);
      if (url) onPhotosChange([...photos, url]);
      setUploading(false);
    }, 'image/jpeg', 0.85);
  }, [photos, onPhotosChange, uploadFile, lang]);

  const closeCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }, []);

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  const mobileCameraRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-foreground text-sm">{t('newFine.photos')}</h3>
        <p className="text-xs text-muted-foreground">{t('newFine.photosHelp')}</p>

        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((url, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border shadow-xs">
                <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute top-1.5 right-1.5 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md hover:scale-110 active:scale-95 transition-all"
                  title="Remover foto"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {photos.length < 5 && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 text-xs gap-1.5 active:scale-95 transition-all"
              disabled={uploading}
              onClick={() => {
                // On mobile devices, prefer native camera input for higher resolution and system integration
                const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
                if (isMobile && mobileCameraRef.current) {
                  mobileCameraRef.current.click();
                } else {
                  openCamera();
                }
              }}
            >
              {uploading ? <Loader2 className="animate-spin h-4 w-4" /> : <Camera className="h-4 w-4 text-primary" />}
              {lang === 'en' ? 'Take Photo' : 'Tirar Foto'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 text-xs gap-1.5 active:scale-95 transition-all"
              disabled={uploading}
              onClick={() => galleryRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4 text-accent" />
              {lang === 'en' ? 'Gallery' : 'Galeria'}
            </Button>
          </div>
        )}

        {/* Hidden inputs for gallery and native direct camera */}
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={mobileCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </Card>

      <canvas ref={canvasRef} className="hidden" />

      <Dialog open={showCamera} onOpenChange={(open) => { if (!open) closeCamera(); }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" /> {lang === 'en' ? 'Camera' : 'Câmera'}
            </DialogTitle>
          </DialogHeader>
          <div className="relative bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-video object-cover" />
          </div>
          <div className="p-4 flex gap-2">
            <Button onClick={capturePhoto} disabled={uploading} className="flex-1">
              {uploading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
              {lang === 'en' ? `Capture (${photos.length}/5)` : `Capturar (${photos.length}/5)`}
            </Button>
            <Button variant="outline" onClick={closeCamera}>{t('common.close')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
