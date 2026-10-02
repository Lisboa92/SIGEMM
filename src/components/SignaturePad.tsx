import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Eraser, PenLine, CheckCircle2 } from 'lucide-react';

interface Props {
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

export default function SignaturePad({ label, value, onChange }: Props) {
  const { lang } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(!!value);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';

    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
    }
  }, [value]);

  useEffect(() => {
    initCanvas();
    const handleResize = () => initCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initCanvas]);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
    try {
      canvasRef.current!.setPointerCapture(e.pointerId);
    } catch {}
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  };

  const end = () => {
    if (drawing.current && canvasRef.current) {
      drawing.current = false;
      try {
        const dataUrl = canvasRef.current.toDataURL('image/png');
        onChange(dataUrl);
      } catch {}
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className="space-y-2 select-none">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <PenLine className="h-3.5 w-3.5 text-primary" /> {label}
        </span>
        {(hasInk || value) && (
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> {lang === 'en' ? 'Signature recorded' : 'Assinatura capturada'}
          </span>
        )}
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="w-full h-36 rounded-xl border-2 border-dashed border-primary/30 bg-slate-50 dark:bg-slate-900/60 touch-none shadow-inner cursor-crosshair"
        />
        {!hasInk && !value && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-xs text-muted-foreground/60 font-medium">
            {lang === 'en' ? 'Sign with finger or stylus here' : 'Assine com o dedo ou caneta aqui'}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clear}
          className="flex-1 h-9 text-xs font-medium cursor-pointer"
        >
          <Eraser className="h-3.5 w-3.5 mr-1" /> {lang === 'en' ? 'Clear' : 'Limpar'}
        </Button>
      </div>
    </div>
  );
}
