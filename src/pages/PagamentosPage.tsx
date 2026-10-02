import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, CreditCard, Smartphone, CheckCircle, Loader2, AlertCircle, Building2, Upload, MapPin, Camera, X, Banknote, Calculator } from 'lucide-react';
import DocumentActions from '@/components/DocumentActions';
import { buildDocumentData } from '@/lib/documentGenerator';
import { toast } from 'sonner';

const METODOS_PAGAMENTO = [
  { id: 'numerario', label: 'Dinheiro (Numerário)', icon: Banknote, description: 'Pagamento presencial em dinheiro vivo / numerário', color: 'bg-emerald-600', textColor: 'text-emerald-600', bgLight: 'bg-emerald-50 dark:bg-emerald-950/30', borderColor: 'border-emerald-500' },
  { id: 'pos', label: 'POS (Terminal)', icon: CreditCard, description: 'Pagamento via terminal POS (Cartão de Débito/Crédito)', color: 'bg-blue-600', textColor: 'text-blue-600', bgLight: 'bg-blue-50 dark:bg-blue-950/30', borderColor: 'border-blue-500' },
  { id: 'mpesa', label: 'M-Pesa', icon: Smartphone, description: 'Vodacom M-Pesa', color: 'bg-red-600', textColor: 'text-red-600', bgLight: 'bg-red-50 dark:bg-red-950/30', borderColor: 'border-red-500' },
  { id: 'emola', label: 'e-Mola', icon: Smartphone, description: 'Movitel e-Mola', color: 'bg-orange-500', textColor: 'text-orange-500', bgLight: 'bg-orange-50 dark:bg-orange-950/30', borderColor: 'border-orange-500' },
  { id: 'mkesh', label: 'mKesh', icon: Smartphone, description: 'mKesh Millennium BIM', color: 'bg-green-600', textColor: 'text-green-600', bgLight: 'bg-green-50 dark:bg-green-950/30', borderColor: 'border-green-500' },
  { id: 'deposito', label: 'Depósito Bancário', icon: Building2, description: 'Comprovativo de depósito bancário', color: 'bg-indigo-600', textColor: 'text-indigo-600', bgLight: 'bg-indigo-50 dark:bg-indigo-950/30', borderColor: 'border-indigo-500' },
];

export default function PagamentosPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [multas, setMultas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMulta, setSelectedMulta] = useState<any | null>(null);
  const [metodoPagamento, setMetodoPagamento] = useState('');
  const [referencia, setReferencia] = useState('');
  const [valorEntregue, setValorEntregue] = useState('');
  const [comprovativoFile, setComprovativoFile] = useState<File | null>(null);
  const [comprovativoUrl, setComprovativoUrl] = useState('');
  const [uploadingComp, setUploadingComp] = useState(false);
  const [locais, setLocais] = useState<string[]>([]);
  const [localPagamento, setLocalPagamento] = useState('');
  const [processing, setProcessing] = useState(false);
  const [paidMulta, setPaidMulta] = useState<any | null>(null); // Show receipt after payment
  const [camOpen, setCamOpen] = useState(false);
  const [compPreview, setCompPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const pararCamara = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOpen(false);
  };

  const abrirCamara = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      streamRef.current = stream;
      setCamOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch {
      toast.error('Não foi possível aceder à câmara do dispositivo');
    }
  };

  const capturarComprovativo = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) { toast.error('Falha ao capturar a foto'); return; }
      const file = new File([blob], `comprovativo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setComprovativoFile(file);
      setCompPreview(URL.createObjectURL(blob));
      pararCamara();
      toast.success('Foto do comprovativo capturada');
    }, 'image/jpeg', 0.9);
  };

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  useEffect(() => {
    loadMultas();
    supabase.from('locais_pagamento').select('nome').eq('activo', true).order('nome').then(({ data }) => {
      if (data) {
        const nomes = data.map((d: any) => d.nome);
        setLocais(nomes);
        if (nomes.length > 0) setLocalPagamento(nomes[0]);
      }
    });
  }, []);

  // Handle direct navigation via notification or search (?multa=<id> or ?id=<id>)
  useEffect(() => {
    const multaParam = searchParams.get('multa') || searchParams.get('id') || searchParams.get('numero');
    if (!multaParam) return;
    (async () => {
      let data: any = null;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(multaParam);
      
      if (isUuid) {
        const res = await supabase.from('multas').select('*').eq('id', multaParam).maybeSingle();
        data = res.data;
      }
      
      if (!data) {
        const res = await supabase
          .from('multas')
          .select('*')
          .or(`numero.eq.${multaParam},numero_auto.eq.${multaParam}`)
          .maybeSingle();
        data = res.data;
      }

      if (!data) {
        const res = await supabase
          .from('multas')
          .select('*')
          .or(`numero.ilike.%${multaParam}%,numero_auto.ilike.%${multaParam}%,infrator_nome.ilike.%${multaParam}%`)
          .limit(1)
          .maybeSingle();
        data = res.data;
      }

      if (data) {
        if (data.status === 'paga') {
          setPaidMulta(data);
        } else {
          setSelectedMulta(data);
        }
      }
      searchParams.delete('multa');
      searchParams.delete('id');
      searchParams.delete('numero');
      setSearchParams(searchParams, { replace: true });
    })();
  }, [searchParams, setSearchParams]);

  const formatDateSafe = (dateVal: any) => {
    if (!dateVal) return '—';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('pt-MZ');
    } catch {
      return '—';
    }
  };

  async function loadMultas() {
    setLoading(true);
    const { data } = await supabase.from('multas').select('*').in('status', ['pendente', 'fora_prazo']).order('created_at', { ascending: false });
    setMultas(data ?? []);
    setLoading(false);
  }

  const filtered = multas.filter(m => {
    if (!m) return false;
    const term = (search || '').toLowerCase().trim();
    if (!term) return true;
    return (
      (m.infrator_nome || '').toLowerCase().includes(term) ||
      (m.matricula || '').toLowerCase().includes(term) ||
      (m.numero || '').toLowerCase().includes(term)
    );
  });

  async function processarPagamento() {
    if (!selectedMulta || !metodoPagamento) { toast.error('Seleccione o método de pagamento'); return; }
    if (!localPagamento) { toast.error('Seleccione o local de pagamento'); return; }
    if (metodoPagamento === 'deposito' && (!referencia || !comprovativoFile)) {
      toast.error('Para depósito bancário introduza a referência e anexe o comprovativo');
      return;
    }
    setProcessing(true);

    let compUrl = comprovativoUrl;
    if (metodoPagamento === 'deposito' && comprovativoFile) {
      setUploadingComp(true);
      const ext = comprovativoFile.name.split('.').pop();
      const path = `comprovativos/${selectedMulta.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('multa-fotos').upload(path, comprovativoFile);
      setUploadingComp(false);
      if (upErr) {
        toast.error('Erro ao enviar comprovativo');
        setProcessing(false);
        return;
      }
      compUrl = supabase.storage.from('multa-fotos').getPublicUrl(path).data.publicUrl;
      setComprovativoUrl(compUrl);
    }

    const isCash = metodoPagamento === 'numerario' || metodoPagamento === 'dinheiro';
    const numEntregue = parseFloat(valorEntregue.replace(',', '.')) || 0;
    const trocoCalc = numEntregue >= Number(selectedMulta.valor) ? (numEntregue - Number(selectedMulta.valor)).toFixed(2) : '0.00';
    const metodoLabel = isCash ? 'DINHEIRO (NUMERÁRIO)' : metodoPagamento.toUpperCase();

    const obs = [
      selectedMulta.observacoes || '',
      `Pagamento: ${metodoLabel}`,
      isCash && numEntregue > 0 ? `Entregue: ${numEntregue.toFixed(2)} MT | Troco: ${trocoCalc} MT` : '',
      referencia ? `Ref: ${referencia}` : '',
      `Local pagamento: ${localPagamento}`,
      compUrl ? `Comprovativo: ${compUrl}` : '',
      `Processado por: ${user?.email}`,
      `Data pagamento: ${new Date().toLocaleString('pt-MZ')}`,
    ].filter(Boolean).join(' | ');

    // Use edge function to bypass RLS (agent may not own the multa)
    const { data: payResult, error: payError } = await supabase.functions.invoke('process-payment', {
      body: { multaId: selectedMulta.id, observacoes: obs, userId: user?.id, userEmail: user?.email },
    });

    if (payError || payResult?.error) {
      toast.error(payResult?.error || 'Erro ao processar pagamento');
      setProcessing(false);
      return;
    }

    // Get agent local for notification
    const agentInfo = await supabase.from('agentes').select('local_trabalho').eq('email', user?.email || '').maybeSingle();
    const localTrabalho = agentInfo.data?.local_trabalho || 'via_publica';

    await Promise.all([
      supabase.from('audit_log').insert({
        action: 'PAGAMENTO_MULTA', resource_id: selectedMulta.id, user_id: user?.id,
        details: `Multa ${selectedMulta.numero} paga via ${metodoLabel}${referencia ? ` (Ref: ${referencia})` : ''} - ${Number(selectedMulta.valor).toFixed(2)} MT`,
      }),
      supabase.from('notifications').insert({
        message: `Pagamento processado: ${selectedMulta.infrator_nome} — ${Number(selectedMulta.valor).toFixed(2)} MT via ${metodoLabel}`,
        action: 'PAGAMENTO_MULTA', resource_id: selectedMulta.id, local_trabalho: localTrabalho, created_by: user?.id,
      } as any),
    ]);

    // Also write structured columns
    await supabase.from('multas').update({
      forma_pagamento: metodoPagamento,
      referencia_deposito: referencia || null,
      comprovativo_url: compUrl || null,
      local_pagamento: localPagamento,
    } as any).eq('id', selectedMulta.id);

    toast.success('Pagamento processado com sucesso!');
    const paidData = { ...selectedMulta, status: 'paga', observacoes: obs, forma_pagamento: metodoPagamento, local_pagamento: localPagamento, referencia_deposito: referencia, comprovativo_url: compUrl };
    setPaidMulta(paidData);
    setProcessing(false);
    setSelectedMulta(null);
    setMetodoPagamento('');
    setReferencia('');
    setValorEntregue('');
    setComprovativoFile(null);
    setComprovativoUrl('');
    loadMultas();
  }

  const metodoInfo = METODOS_PAGAMENTO.find(m => m.id === metodoPagamento);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Payment Methods Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {METODOS_PAGAMENTO.map(m => (
          <Card key={m.id} className={`p-3 text-center space-y-1 border-l-4 ${m.borderColor} ${m.bgLight}`}>
            <m.icon className={`h-5 w-5 mx-auto ${m.textColor}`} />
            <p className={`text-xs font-semibold ${m.textColor}`}>{m.label}</p>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pesquisar multa pendente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} multas pendentes</p>

      {/* Multas List */}
      <div className="space-y-2">
        {loading ? (
          <Card className="p-8 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />Carregando...
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-primary opacity-50" />
            <p className="font-semibold">Sem multas pendentes</p>
          </Card>
        ) : (
          filtered.map((multa) => (
            <Card
              key={multa.id}
              className="p-4 space-y-2 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
              onClick={() => { setSelectedMulta(multa); setMetodoPagamento(''); setReferencia(''); setValorEntregue(''); }}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">{multa.infrator_nome}</p>
                  <p className="text-xs font-mono text-muted-foreground">{multa.numero}</p>
                </div>
                <Badge variant="outline" className="status-badge status-pending flex-shrink-0">Pendente</Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{multa.infracao_tipo}</span>
                <span className="font-bold text-lg text-foreground">{Number(multa.valor).toFixed(2)} MT</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{multa.local}</span>
                <span>{formatDateSafe(multa.created_at)}</span>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Payment Dialog */}
      <Dialog open={!!selectedMulta} onOpenChange={(open) => { if (!open) { setSelectedMulta(null); setMetodoPagamento(''); setReferencia(''); setValorEntregue(''); setComprovativoFile(null); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Processar Pagamento</DialogTitle>
            <DialogDescription>{selectedMulta?.numero}</DialogDescription>
          </DialogHeader>

          {selectedMulta && (
            <div className="space-y-4">
              <Card className="p-4 bg-muted/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Infrator</span>
                  <span className="font-semibold text-foreground">{selectedMulta.infrator_nome}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Infracção</span>
                  <span className="font-medium text-foreground">{selectedMulta.infracao_tipo}</span>
                </div>
                {selectedMulta.matricula && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {selectedMulta.observacoes?.includes('[IMÓVEL]') ? 'Nº Porta / Talhão' : 'Matrícula'}
                    </span>
                    <span className="font-mono text-foreground">{selectedMulta.matricula}</span>
                  </div>
                )}
              </Card>

              <div className="rounded-xl bg-primary/10 p-4 text-center">
                <p className="text-xs text-muted-foreground">Valor a Pagar</p>
                <p className="text-3xl font-bold text-foreground">{Number(selectedMulta.valor).toFixed(2)} MT</p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold">Método de Pagamento *</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {METODOS_PAGAMENTO.map(m => (
                    <Card
                      key={m.id}
                      className={`p-3 cursor-pointer transition-all text-center space-y-1 border-l-4 ${m.borderColor} ${
                        metodoPagamento === m.id ? `${m.bgLight} ring-2 ring-offset-1` : 'hover:shadow-md'
                      }`}
                      onClick={() => { setMetodoPagamento(m.id); if (m.id === 'numerario') setValorEntregue(Number(selectedMulta.valor).toFixed(2)); }}
                    >
                      <m.icon className={`h-5 w-5 mx-auto ${m.textColor}`} />
                      <p className={`text-xs font-semibold ${m.textColor}`}>{m.label}</p>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Local de Pagamento *</Label>
                <Select value={localPagamento} onValueChange={setLocalPagamento}>
                  <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>
                    {locais.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Dinheiro (Numerário) - Controlo de Caixa e Troco */}
              {metodoPagamento === 'numerario' && (
                <div className="space-y-3 p-3.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/40 animate-fade-in">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-xs">
                    <Banknote className="h-4 w-4" />
                    <span>Controlo de Caixa & Troco</span>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Valor Entregue pelo Munícipe (MT)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={`Ex: ${Number(selectedMulta.valor).toFixed(2)}`}
                      value={valorEntregue}
                      onChange={(e) => setValorEntregue(e.target.value)}
                      className="bg-background text-base font-semibold"
                    />
                  </div>

                  {/* Botões Rápidos */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-muted-foreground mr-1">Atalhos:</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2 cursor-pointer"
                      onClick={() => setValorEntregue(Number(selectedMulta.valor).toFixed(2))}
                    >
                      Exacto ({Number(selectedMulta.valor).toFixed(0)} MT)
                    </Button>
                    {[500, 1000, 2000, 5000].map((v) => (
                      <Button
                        key={v}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2 cursor-pointer"
                        onClick={() => setValorEntregue(v.toString())}
                      >
                        {v} MT
                      </Button>
                    ))}
                  </div>

                  {/* Resultado do Troco */}
                  {parseFloat(valorEntregue) > 0 && (
                    <div className="pt-1">
                      {parseFloat(valorEntregue) >= Number(selectedMulta.valor) ? (
                        <div className="p-2.5 rounded-md bg-emerald-100/90 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100 flex items-center justify-between">
                          <span className="text-xs font-medium">Troco a Devolver:</span>
                          <span className="text-base font-bold">
                            {(parseFloat(valorEntregue) - Number(selectedMulta.valor)).toFixed(2)} MT
                          </span>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 flex items-center justify-between">
                          <span className="text-xs font-medium">Valor Insuficiente (Faltam):</span>
                          <span className="text-sm font-bold">
                            {(Number(selectedMulta.valor) - parseFloat(valorEntregue)).toFixed(2)} MT
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs font-medium">Nº do Talão de Caixa / Recibo Manual (Opcional)</Label>
                    <Input
                      placeholder="Ex: CX-2026-00123 / Balcão Sede"
                      value={referencia}
                      onChange={(e) => setReferencia(e.target.value)}
                      className="bg-background text-sm"
                    />
                  </div>
                </div>
              )}

              {metodoPagamento && metodoPagamento !== 'numerario' && (
                <div className="space-y-2 animate-fade-in">
                  <Label>
                    {metodoPagamento === 'pos' ? 'Nº do Terminal / Autorização' :
                     metodoPagamento === 'deposito' ? 'Nº de Referência do Depósito *' :
                     'Nº de Referência / Transacção'}
                  </Label>
                  <Input
                    placeholder={
                      metodoPagamento === 'pos' ? 'Ex: AUTH-123456' :
                      metodoPagamento === 'mpesa' ? 'Ex: MP2A1234567' :
                      metodoPagamento === 'emola' ? 'Ex: EM-9876543' :
                      metodoPagamento === 'deposito' ? 'Ex: DEP-2026-001234' :
                      'Ex: MK-5678901'
                    }
                    value={referencia} onChange={(e) => setReferencia(e.target.value)}
                  />
                </div>
              )}

              {metodoPagamento === 'deposito' && (
                <div className="space-y-2 animate-fade-in">
                  <Label>Comprovativo de Depósito *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setComprovativoFile(f);
                        setCompPreview(f && f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
                      }}
                      className="flex-1"
                    />
                    {uploadingComp && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={abrirCamara} className="w-full gap-2">
                    <Camera className="h-4 w-4" /> Tirar foto do comprovativo
                  </Button>
                  {compPreview && (
                    <div className="relative w-full">
                      <img src={compPreview} alt="Comprovativo de depósito" className="w-full max-h-52 object-contain rounded-md border" />
                      <Button
                        type="button" size="icon" variant="destructive"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => { setComprovativoFile(null); setCompPreview(null); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {comprovativoFile && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Upload className="h-3 w-3" /> {comprovativoFile.name}
                    </p>
                  )}
                </div>
              )}

              {metodoInfo && (
                <Card className="p-3 bg-muted/30 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">{metodoInfo.description}</p>
                </Card>
              )}

              <Button onClick={processarPagamento} disabled={processing || !metodoPagamento} className="w-full h-12 text-base">
                {processing ? <><Loader2 className="animate-spin mr-2" /> Processando...</> : <><CheckCircle className="mr-2 h-5 w-5" /> Confirmar Pagamento</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Câmara para o comprovativo de depósito */}
      <Dialog open={camOpen} onOpenChange={(o) => { if (!o) pararCamara(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5 text-primary" /> Fotografar Comprovativo</DialogTitle>
            <DialogDescription className="text-xs">Enquadre o talão de depósito e capture.</DialogDescription>
          </DialogHeader>
          <video ref={videoRef} playsInline muted className="w-full rounded-md bg-black aspect-[3/4] object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={pararCamara}>Cancelar</Button>
            <Button className="flex-1 gap-2" onClick={capturarComprovativo}><Camera className="h-4 w-4" /> Capturar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog after payment */}
      <Dialog open={!!paidMulta} onOpenChange={(open) => !open && setPaidMulta(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" /> Pagamento Confirmado
            </DialogTitle>
            <DialogDescription>{paidMulta?.numero}</DialogDescription>
          </DialogHeader>
          {paidMulta && (
            <div className="space-y-4">
              <div className="rounded-xl bg-primary/10 p-4 text-center space-y-1">
                <p className="text-xs text-muted-foreground">Valor Pago</p>
                <p className="text-2xl font-bold text-foreground">{Number(paidMulta.valor).toFixed(2)} MT</p>
                <p className="text-xs text-primary font-semibold">✅ Pago</p>
              </div>

              <DocumentActions document={buildDocumentData(paidMulta, 'recibo', paidMulta.agente_nome || user?.email)} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
