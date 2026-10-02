import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { ScanLine, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PlateOCR({ onDetected }: { onDetected: (matricula: string) => void }) {
  const { lang } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File) => {
    if (!navigator.onLine) {
      toast.error(lang === 'en' ? 'OCR requires an active internet connection.' : 'O OCR precisa de ligação à internet.');
      return;
    }
    setLoading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke('ocr-matricula', {
        body: { imageBase64: base64 },
      });

      if (error || data?.error) {
        toast.error(data?.error || (lang === 'en' ? 'Could not read license plate.' : 'Não foi possível ler a matrícula.'));
      } else if (data?.matricula) {
        onDetected(data.matricula);
        toast.success(lang === 'en' ? `License plate read: ${data.matricula}` : `Matrícula lida: ${data.matricula}`);
      } else {
        toast.warning(lang === 'en' ? 'Plate not legible. Please enter manually.' : 'Matrícula não legível. Introduza manualmente.');
      }
    } catch {
      toast.error(lang === 'en' ? 'Error processing image.' : 'Erro ao processar a imagem.');
    }
    setLoading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <Button type="button" variant="secondary" size="sm" disabled={loading} onClick={() => inputRef.current?.click()}>
        {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ScanLine className="h-3.5 w-3.5 mr-1" />}
        {loading ? (lang === 'en' ? 'Reading...' : 'A ler...') : (lang === 'en' ? 'Scan plate (OCR)' : 'Ler matrícula (OCR)')}
      </Button>
    </>
  );
}
