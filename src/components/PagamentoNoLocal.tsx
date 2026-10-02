import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Smartphone, CheckCircle, Loader2, Globe, Banknote } from 'lucide-react';

const METODOS = [
  { id: 'numerario', label: 'Dinheiro (Numerário)', icon: Banknote },
  { id: 'pos', label: 'POS (Terminal)', icon: CreditCard },
  { id: 'mpesa', label: 'M-Pesa', icon: Smartphone },
  { id: 'emola', label: 'e-Mola', icon: Smartphone },
  { id: 'mkesh', label: 'mKesh', icon: Smartphone },
];

interface PagamentoNoLocalProps {
  valor: number;
  onPagamentoCompleto: (metodo: string, referencia: string) => void;
  onActiveChange?: (active: boolean) => void;
  disabled?: boolean;
}

export default function PagamentoNoLocal({ valor, onPagamentoCompleto, onActiveChange, disabled }: PagamentoNoLocalProps) {
  const [ativo, setAtivo] = useState(false);
  const [metodo, setMetodo] = useState('');
  const [referencia, setReferencia] = useState('');
  const [valorEntregue, setValorEntregue] = useState('');
  const [processing, setProcessing] = useState(false);

  const numEntregue = parseFloat(valorEntregue.replace(',', '.')) || 0;

  const handleConfirmar = async () => {
    if (!metodo) return;
    setProcessing(true);
    await new Promise(r => setTimeout(r, 1000));
    const refFinal = metodo === 'numerario' && numEntregue > 0
      ? `Entregue: ${numEntregue.toFixed(2)} MT${referencia ? ` | ${referencia}` : ''}`
      : referencia;
    onPagamentoCompleto(metodo, refFinal);
    setProcessing(false);
  };

  return (
    <Card className="p-4 space-y-4 border-2 border-dashed border-accent/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-accent" />
          <Label className="font-semibold text-sm">Pagamento no Local</Label>
          <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent border-accent/30">
            Qualquer Infractor
          </Badge>
        </div>
        <Switch
          checked={ativo}
          onCheckedChange={(v) => {
            setAtivo(v);
            onActiveChange?.(v);
            if (!v) {
              setMetodo('');
              setReferencia('');
              setValorEntregue('');
            }
          }}
          disabled={disabled}
        />
      </div>

      {ativo && (
        <div className="space-y-3 animate-fade-in">
          <div className="rounded-lg bg-accent/10 p-3 text-center">
            <p className="text-xs text-muted-foreground">Valor a Cobrar</p>
            <p className="text-2xl font-bold text-foreground">{valor.toFixed(2)} MT</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {METODOS.map(m => (
              <Card
                key={m.id}
                className={`p-3 cursor-pointer text-center transition-all ${
                  metodo === m.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'hover:border-primary/30'
                }`}
                onClick={() => {
                  setMetodo(m.id);
                  if (m.id === 'numerario') setValorEntregue(valor.toFixed(2));
                }}
              >
                <m.icon className={`h-5 w-5 mx-auto ${metodo === m.id ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="text-xs font-semibold mt-1">{m.label}</p>
              </Card>
            ))}
          </div>

          {metodo === 'numerario' && (
            <div className="space-y-2.5 p-3 rounded-lg bg-muted/40 border text-left">
              <div className="space-y-1">
                <Label className="text-xs">Valor Entregue em Numerário (MT)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={`Ex: ${valor.toFixed(2)}`}
                  value={valorEntregue}
                  onChange={(e) => setValorEntregue(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              {/* Botões de atalho */}
              <div className="flex gap-1 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px] px-2"
                  onClick={() => setValorEntregue(valor.toFixed(2))}
                >
                  Exacto
                </Button>
                {[500, 1000, 2000].map((v) => (
                  <Button
                    key={v}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] px-2"
                    onClick={() => setValorEntregue(v.toString())}
                  >
                    {v} MT
                  </Button>
                ))}
              </div>

              {numEntregue > 0 && (
                <div className="pt-1 text-xs">
                  {numEntregue >= valor ? (
                    <div className="p-2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold flex justify-between">
                      <span>Troco a Devolver:</span>
                      <span>{(numEntregue - valor).toFixed(2)} MT</span>
                    </div>
                  ) : (
                    <div className="p-2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold flex justify-between">
                      <span>Faltam:</span>
                      <span>{(valor - numEntregue).toFixed(2)} MT</span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1 pt-1">
                <Label className="text-xs text-muted-foreground">Nº Talão de Caixa / Obs (Opcional)</Label>
                <Input
                  placeholder="Ex: Talão Manual nº..."
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          {metodo && metodo !== 'numerario' && (
            <div className="space-y-1">
              <Label className="text-xs">
                {metodo === 'pos' ? 'Nº de Autorização POS' : 'Referência da Transacção'}
              </Label>
              <Input
                placeholder="Nº de referência..."
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          )}

          <Button
            onClick={handleConfirmar}
            disabled={!metodo || processing || disabled}
            className="w-full"
          >
            {processing ? (
              <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Processando...</>
            ) : (
              <><CheckCircle className="mr-2 h-4 w-4" /> Confirmar Pagamento no Local</>
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}
