import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldOff, Loader2, QrCode } from 'lucide-react';
import { toast } from 'sonner';

/** Autenticação de dois factores (TOTP) — Google Authenticator, Authy, etc. */
export default function TwoFactorSettings() {
  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    const totp = data?.totp?.[0];
    setFactorId(totp?.id ?? null);
    setVerified(totp?.status === 'verified');
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  async function iniciar() {
    setBusy(true);
    // Remove inscrições não concluídas antes de criar uma nova
    const { data: existentes } = await supabase.auth.mfa.listFactors();
    for (const f of existentes?.all ?? []) {
      if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `SIGEMM-${Date.now()}`,
    });
    setBusy(false);
    if (error) { toast.error('Erro ao activar 2FA: ' + error.message); return; }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
  }

  async function confirmar() {
    if (!factorId || code.trim().length !== 6) { toast.error('Introduza o código de 6 dígitos'); return; }
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (error) { toast.error('Código inválido. Tente novamente.'); return; }
    toast.success('Autenticação de dois factores activada.');
    setQr(null); setSecret(null); setCode('');
    refresh();
  }

  async function desactivar() {
    if (!factorId) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) { toast.error('Erro ao desactivar: ' + error.message); return; }
    toast.success('2FA desactivado.');
    setQr(null); setSecret(null);
    refresh();
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-bold text-foreground">Autenticação de Dois Factores</h3>
            <p className="text-[11px] text-muted-foreground">Protege a conta com um código temporário de 6 dígitos.</p>
          </div>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <Badge className={verified ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground'}>
            {verified ? 'Activo' : 'Inactivo'}
          </Badge>
        )}
      </div>

      {!loading && verified && (
        <Button variant="outline" className="w-full gap-2" onClick={desactivar} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
          Desactivar 2FA
        </Button>
      )}

      {!loading && !verified && !qr && (
        <Button className="w-full gap-2" onClick={iniciar} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
          Activar 2FA
        </Button>
      )}

      {qr && (
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Leia o código QR com o Google Authenticator (ou equivalente) e introduza o código gerado.
          </p>
          <img src={qr} alt="Código QR para configurar a autenticação de dois factores" className="mx-auto w-40 h-40 bg-white rounded-lg p-2" />
          {secret && <p className="text-[10px] text-center font-mono break-all text-muted-foreground">{secret}</p>}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Código de verificação</Label>
            <Input
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-xl tracking-[0.4em] font-mono"
            />
          </div>
          <Button className="w-full gap-2" onClick={confirmar} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Confirmar e activar
          </Button>
        </div>
      )}
    </Card>
  );
}