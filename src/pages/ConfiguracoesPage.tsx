import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, type FontSize, type UiDensity, type ColorPreset } from '@/contexts/ThemeContext';
import { useUserRole, canAccess } from '@/hooks/useUserRole';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sun, Moon, Palette, FileText, Activity, Plus, Pencil, Trash2,
  Loader2, Clock, MapPin, Printer, Bluetooth, BluetoothOff,
  Wifi, Usb, Network, BookOpen, Contrast, Type, LayoutGrid, Zap, RotateCcw, Check,
  Mail, Send, CheckCircle2, AlertCircle, RefreshCw, Server, ShieldCheck
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import PrinterSelectDialog from '@/components/PrinterSelectDialog';
import { type DocumentData } from '@/lib/documentGenerator';
import {
  connectPrinter, disconnectPrinter, isPrinterConnected, getConnectionType,
  type ConnectionType
} from '@/lib/printer';
import { getEmailStatus, sendTestEmail, type EmailStatusInfo } from '@/lib/emailService';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { triggerPowerSyncNow, getPowerSyncStatus } from '@/lib/powersync';
import { toast } from 'sonner';

interface TipoMulta {
  id: string;
  categoria: string;
  tipo: string;
  valor: number;
  activo: boolean;
}

interface LocalPagamento {
  id: string;
  nome: string;
  activo: boolean;
}

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const {
    theme, setTheme,
    readingMode, setReadingMode,
    fontSize, setFontSize,
    uiDensity, setUiDensity,
    highContrast, setHighContrast,
    reduceMotion, setReduceMotion,
    colorPreset, setColorPreset,
    resetAppearance
  } = useTheme();
  const { t } = useLanguage();
  const { nivelAcesso } = useUserRole();
  const isAdmin = canAccess(nivelAcesso, 'admin');

  // Printer
  const [printerConnected, setPrinterConnected] = useState(isPrinterConnected());
  const [connType, setConnType] = useState<ConnectionType>('bluetooth');
  const [printerIp, setPrinterIp] = useState('192.168.1.100');
  const [printerPort, setPrinterPort] = useState('9100');
  const [connecting, setConnecting] = useState(false);
  const [testPrintOpen, setTestPrintOpen] = useState(false);

  const sampleDocument: DocumentData = {
    tipo: 'factura',
    numero: 'FAC-2026-TESTE',
    numeroAuto: 'AUT-2026-0001',
    data: new Date().toLocaleDateString('pt-MZ'),
    hora: new Date().toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' }),
    agente: 'Agente Demonstração #012',
    infrator: 'Condutor Exemplo Teste',
    documentoId: '110293847291B',
    tipoDocumento: 'BI / Cartão de Eleitor',
    contacto: '+258 84 123 4567',
    matricula: 'AFG-890-MC',
    marcaVeiculo: 'Toyota Hilux',
    infracao: 'Excesso de velocidade em zona urbana residencial (75 km/h)',
    artigo: 'Art. 45.º do Regulamento de Trânsito',
    local: 'Av. 25 de Setembro, Posto 4, Matola',
    valor: 2500,
    localPagamento: 'Comando da Polícia Municipal da Matola ou Balcão Único',
    dataLimite: new Date(Date.now() + 15 * 86400000).toLocaleDateString('pt-MZ'),
  };

  // Fine types
  const [tipos, setTipos] = useState<TipoMulta[]>([]);
  const [tiposLoading, setTiposLoading] = useState(true);
  const [showTipoForm, setShowTipoForm] = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoMulta | null>(null);
  const [deleteTipoId, setDeleteTipoId] = useState<string | null>(null);
  const [tipoForm, setTipoForm] = useState({ categoria: 'movel', tipo: '', valor: '' });
  const [savingTipo, setSavingTipo] = useState(false);

  // Users / Agentes
  const [agentes, setAgentes] = useState<any[]>([]);
  const [agentesLoading, setAgentesLoading] = useState(true);

  // Sessions / Audit
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  // Locais de pagamento
  const [locais, setLocais] = useState<LocalPagamento[]>([]);
  const [locaisLoading, setLocaisLoading] = useState(true);
  const [showLocalForm, setShowLocalForm] = useState(false);
  const [editingLocal, setEditingLocal] = useState<LocalPagamento | null>(null);
  const [deleteLocalId, setDeleteLocalId] = useState<string | null>(null);
  const [localForm, setLocalForm] = useState({ nome: '' });
  const [savingLocal, setSavingLocal] = useState(false);

  // Email & Alerts state
  const [emailStatus, setEmailStatus] = useState<EmailStatusInfo | null>(null);
  const [emailStatusLoading, setEmailStatusLoading] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string; simulated?: boolean } | null>(null);

  // PowerSync state & diagnostics
  const { online, pending, pendingItems, syncing, sync, lastSyncTime, powerSyncStatus } = useOfflineSync();
  const [psDiagnosing, setPsDiagnosing] = useState(false);
  const [psDiagResult, setPsDiagResult] = useState<any>(null);

  async function runPowerSyncDiag() {
    setPsDiagnosing(true);
    try {
      const res = await fetch('/api/powersync/status');
      const data = await res.json();
      setPsDiagResult(data);
      toast.success('Diagnóstico PowerSync executado com sucesso!');
    } catch (err: any) {
      setPsDiagResult({
        status: 'local',
        message: 'Motor PowerSync operacional em modo SQLite local (WebAssembly/OPFS).',
        error: err?.message,
      });
      toast.info('PowerSync activo em modo local');
    } finally {
      setPsDiagnosing(false);
    }
  }

  async function handleForcePowerSync() {
    try {
      await sync(false);
      const res = await triggerPowerSyncNow();
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.info(res.message);
      }
    } catch (err: any) {
      toast.error('Erro na sincronização: ' + (err?.message || 'Falha de rede'));
    }
  }

  useEffect(() => {
    loadTipos();
    loadAgentes();
    loadAudit();
    loadLocais();
    loadEmailConfigStatus();
    if (user?.email) {
      setTestEmailAddress(user.email);
    }
  }, [user?.email]);

  async function loadEmailConfigStatus() {
    setEmailStatusLoading(true);
    try {
      const status = await getEmailStatus();
      setEmailStatus(status);
    } catch {
      // Non-blocking
    } finally {
      setEmailStatusLoading(false);
    }
  }

  async function handleTriggerTestEmail() {
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      toast.error('Introduza um endereço de e-mail válido para o teste');
      return;
    }
    setSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await sendTestEmail(testEmailAddress.trim());
      if (res.success) {
        setTestEmailResult({
          success: true,
          message: res.message || `E-mail de teste enviado com sucesso para ${testEmailAddress}!`,
          simulated: res.simulated,
        });
        toast.success(res.simulated ? 'Teste de e-mail processado (modo simulado)' : 'E-mail de teste enviado com sucesso!');
      } else {
        setTestEmailResult({
          success: false,
          message: res.error || 'Falha ao enviar e-mail de teste.',
        });
        toast.error(res.error || 'Falha ao enviar e-mail de teste');
      }
    } catch (err: any) {
      setTestEmailResult({
        success: false,
        message: err.message || 'Erro inesperado ao disparar e-mail de teste.',
      });
      toast.error('Erro ao disparar e-mail');
    } finally {
      setSendingTestEmail(false);
    }
  }

  async function loadTipos() {
    setTiposLoading(true);
    const { data } = await supabase.from('tipos_multa').select('*').order('categoria').order('tipo');
    setTipos((data as TipoMulta[]) ?? []);
    setTiposLoading(false);
  }

  async function loadAgentes() {
    setAgentesLoading(true);
    const { data } = await supabase.from('agentes').select('*').order('nome');
    setAgentes(data ?? []);
    setAgentesLoading(false);
  }

  async function loadAudit() {
    setAuditLoading(true);
    const { data } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(50);
    setAuditLogs(data ?? []);
    setAuditLoading(false);
  }

  async function loadLocais() {
    setLocaisLoading(true);
    const { data } = await supabase.from('locais_pagamento').select('*').order('nome');
    setLocais((data as LocalPagamento[]) ?? []);
    setLocaisLoading(false);
  }

  function openNewLocal() {
    setEditingLocal(null);
    setLocalForm({ nome: '' });
    setShowLocalForm(true);
  }

  function openEditLocal(l: LocalPagamento) {
    setEditingLocal(l);
    setLocalForm({ nome: l.nome });
    setShowLocalForm(true);
  }

  async function saveLocal() {
    if (!localForm.nome.trim()) { toast.error('Preencha o nome'); return; }
    setSavingLocal(true);
    if (editingLocal) {
      const { error } = await supabase.from('locais_pagamento').update({ nome: localForm.nome.trim() }).eq('id', editingLocal.id);
      if (error) { toast.error('Erro ao actualizar'); setSavingLocal(false); return; }
      toast.success('Local actualizado');
    } else {
      const { error } = await supabase.from('locais_pagamento').insert({ nome: localForm.nome.trim() } as any);
      if (error) { toast.error('Erro ao criar'); setSavingLocal(false); return; }
      toast.success('Local criado');
    }
    setSavingLocal(false);
    setShowLocalForm(false);
    loadLocais();
  }

  async function deleteLocal(id: string) {
    const { error } = await supabase.from('locais_pagamento').delete().eq('id', id);
    if (error) { toast.error('Erro ao apagar'); return; }
    toast.success('Local apagado');
    setDeleteLocalId(null);
    loadLocais();
  }

  async function toggleLocalActivo(id: string, activo: boolean) {
    await supabase.from('locais_pagamento').update({ activo: !activo } as any).eq('id', id);
    loadLocais();
  }

  // Fine type CRUD
  function openNewTipo() {
    setEditingTipo(null);
    setTipoForm({ categoria: 'movel', tipo: '', valor: '' });
    setShowTipoForm(true);
  }

  function openEditTipo(t: TipoMulta) {
    setEditingTipo(t);
    setTipoForm({ categoria: t.categoria, tipo: t.tipo, valor: String(t.valor) });
    setShowTipoForm(true);
  }

  async function saveTipo() {
    if (!tipoForm.tipo.trim() || !tipoForm.valor) {
      toast.error('Preencha todos os campos');
      return;
    }
    setSavingTipo(true);
    const payload = {
      categoria: tipoForm.categoria,
      tipo: tipoForm.tipo.trim(),
      valor: parseFloat(tipoForm.valor) || 0,
    };

    if (editingTipo) {
      const { error } = await supabase.from('tipos_multa').update(payload).eq('id', editingTipo.id);
      if (error) { toast.error('Erro ao actualizar'); setSavingTipo(false); return; }
      toast.success('Tipo de multa actualizado');
    } else {
      const { error } = await supabase.from('tipos_multa').insert(payload);
      if (error) { toast.error('Erro ao criar'); setSavingTipo(false); return; }
      toast.success('Tipo de multa criado');
    }
    setSavingTipo(false);
    setShowTipoForm(false);
    loadTipos();
  }

  async function deleteTipo(id: string) {
    const { error } = await supabase.from('tipos_multa').delete().eq('id', id);
    if (error) { toast.error('Erro ao apagar'); return; }
    toast.success('Tipo de multa apagado');
    setDeleteTipoId(null);
    loadTipos();
  }

  async function toggleTipoActivo(id: string, activo: boolean) {
    await supabase.from('tipos_multa').update({ activo: !activo }).eq('id', id);
    loadTipos();
  }

  async function toggleAgenteActivo(id: string, activo: boolean) {
    await supabase.from('agentes').update({ activo: !activo }).eq('id', id);
    loadAgentes();
    toast.success(activo ? 'Agente desactivado' : 'Agente activado');
  }

  // Group audit logs by user for session stats
  const loginStats = auditLogs.reduce((acc: Record<string, number>, log) => {
    if (log.action?.includes('LOGIN') || log.action?.includes('CRIAR_MULTA')) {
      const key = log.details?.match(/[\w.+-]+@[\w.-]+/)?.[0] || log.user_id || 'Desconhecido';
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }, {});

  const sortedLoginStats = Object.entries(loginStats).sort(([, a], [, b]) => (b as number) - (a as number));

  const tiposMoveis = tipos.filter(t => t.categoria === 'movel');
  const tiposImoveis = tipos.filter(t => t.categoria === 'imovel');

  return (
    <div className="space-y-4 animate-fade-in">
      <Tabs defaultValue="aparencia" className="w-full">
        <TabsList className="w-full grid grid-cols-3 sm:grid-cols-7 h-auto p-1 gap-1">
          <TabsTrigger value="aparencia" className="gap-1 text-xs">
            <Palette className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('settings.tabs.aparencia')}</span>
          </TabsTrigger>
          <TabsTrigger value="multas" className="gap-1 text-xs">
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('settings.tabs.multas')}</span>
          </TabsTrigger>
          <TabsTrigger value="locais" className="gap-1 text-xs">
            <MapPin className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('settings.tabs.locais')}</span>
          </TabsTrigger>
          <TabsTrigger value="impressora" className="gap-1 text-xs">
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('settings.tabs.impressora')}</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-1 text-xs">
            <Mail className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('settings.tabs.email') || 'E-mail'}</span>
          </TabsTrigger>
          <TabsTrigger value="powersync" className="gap-1 text-xs font-semibold text-primary">
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
            <span className="hidden sm:inline">PowerSync</span>
          </TabsTrigger>
          <TabsTrigger value="sessoes" className="gap-1 text-xs">
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('settings.tabs.sessoes')}</span>
          </TabsTrigger>
        </TabsList>

        {/* APARÊNCIA & ACESSIBILIDADE */}
        <TabsContent value="aparencia" className="space-y-4 mt-3">
          {/* TEMA CLARO / ESCURO */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Palette className="w-4 h-4 text-primary" />
                Tema do Sistema
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8 px-2.5"
                onClick={resetAppearance}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Repor Padrões
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Card
                className={`p-4 cursor-pointer text-center space-y-2 transition-all ${theme === 'light' ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'hover:border-primary/30'}`}
                onClick={() => setTheme('light')}
              >
                <Sun className={`h-7 w-7 mx-auto ${theme === 'light' ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="text-sm font-semibold">{t('common.light')}</p>
                <p className="text-xs text-muted-foreground">{t('settings.theme.lightDesc')}</p>
              </Card>
              <Card
                className={`p-4 cursor-pointer text-center space-y-2 transition-all ${theme === 'dark' ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'hover:border-primary/30'}`}
                onClick={() => setTheme('dark')}
              >
                <Moon className={`h-7 w-7 mx-auto ${theme === 'dark' ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="text-sm font-semibold">{t('common.dark')}</p>
                <p className="text-xs text-muted-foreground">{t('settings.theme.darkDesc')}</p>
              </Card>
            </div>
          </Card>

          {/* MODO DE LEITURA (PAPEL SUAVE & ANTI-CANSAÇO) */}
          <Card className="p-5 space-y-3 border-l-4 border-l-amber-600 bg-amber-50/20 dark:bg-amber-950/10">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-sm font-semibold text-foreground">Modo de Leitura (Papel Suave)</h3>
                  <Badge variant="outline" className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300">
                    Anti-Cansaço Visual
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Aplica uma tonalidade suave e quente inspirada em papel natural, reduzindo a emissão de luz azul e facilitando a leitura prolongada de relatórios, despachos jurídicos e manuais de posturas.
                </p>
              </div>
              <Switch
                checked={readingMode}
                onCheckedChange={setReadingMode}
              />
            </div>
          </Card>

          {/* ESCALA DE TIPOGRAFIA */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Type className="w-4 h-4 text-primary" />
                Tamanho do Texto & Tipografia
              </h3>
              <span className="text-xs text-muted-foreground capitalize">
                Actual: {fontSize === 'sm' ? 'Pequeno (85%)' : fontSize === 'base' ? 'Padrão (100%)' : fontSize === 'lg' ? 'Grande (115%)' : 'Extra Grande (130%)'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'sm', label: 'Pequeno', desc: 'Compacto', sample: 'Texto Aa' },
                { id: 'base', label: 'Padrão', desc: 'Recomendado', sample: 'Texto Aa' },
                { id: 'lg', label: 'Grande', desc: 'Legibilidade +', sample: 'Texto Aa' },
                { id: 'xl', label: 'Extra', desc: 'Acessibilidade', sample: 'Texto Aa' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFontSize(item.id as FontSize)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    fontSize === item.id
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20 text-primary font-semibold'
                      : 'border-border hover:border-primary/40 hover:bg-muted/40 text-foreground'
                  }`}
                >
                  <p className="text-xs font-semibold">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* PALETA DE CORES DE DESTAQUE */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" />
              Cor de Destaque Institucional
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'emerald', name: 'Verde Matola', color: 'bg-emerald-600', desc: 'Oficial CMM' },
                { id: 'ocean', name: 'Azul Oceano', color: 'bg-blue-600', desc: 'Corporativo' },
                { id: 'slate', name: 'Cinza Executivo', color: 'bg-slate-700', desc: 'Neutro' },
                { id: 'amber', name: 'Âmbar Municipal', color: 'bg-amber-600', desc: 'Destaque' },
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setColorPreset(preset.id as ColorPreset)}
                  className={`p-3 rounded-lg border text-left flex items-center gap-2.5 transition-all ${
                    colorPreset === preset.id
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20 font-semibold'
                      : 'border-border hover:border-primary/40 hover:bg-muted/30'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full ${preset.color} flex-shrink-0 flex items-center justify-center`}>
                    {colorPreset === preset.id && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-foreground font-medium truncate">{preset.name}</p>
                    <p className="text-[10px] text-muted-foreground">{preset.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* DENSIDADE DA INTERFACE & ACESSIBILIDADE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Densidade */}
            <Card className="p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-primary" />
                Densidade dos Elementos
              </h3>
              <p className="text-xs text-muted-foreground">
                Ajusta o espaçamento dos botões, tabelas e cartões de multas.
              </p>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { id: 'compact', label: 'Compacto' },
                  { id: 'normal', label: 'Padrão' },
                  { id: 'spacious', label: 'Confortável' },
                ].map((d) => (
                  <Button
                    key={d.id}
                    type="button"
                    variant={uiDensity === d.id ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs"
                    onClick={() => setUiDensity(d.id as UiDensity)}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </Card>

            {/* Acessibilidade em Campo */}
            <Card className="p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Contrast className="w-4 h-4 text-primary" />
                Acessibilidade e Campo
              </h3>
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-foreground">Alto Contraste</p>
                    <p className="text-[10px] text-muted-foreground">Melhora a visibilidade na rua sob sol intenso</p>
                  </div>
                  <Switch
                    checked={highContrast}
                    onCheckedChange={setHighContrast}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-foreground">Reduzir Animações</p>
                    <p className="text-[10px] text-muted-foreground">Economiza bateria em dispositivos móveis</p>
                  </div>
                  <Switch
                    checked={reduceMotion}
                    onCheckedChange={setReduceMotion}
                  />
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* PARAMETRIZAR MULTAS */}
        <TabsContent value="multas" className="space-y-4 mt-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Tipos de Multa</h3>
            {isAdmin && (
              <Button size="sm" onClick={openNewTipo} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Novo Tipo
              </Button>
            )}
          </div>

          {tiposLoading ? (
            <Card className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </Card>
          ) : (
            <>
              {/* Móveis */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">🚗 Multas Móveis</h4>
                <div className="space-y-1.5">
                  {tiposMoveis.map(t => (
                    <Card key={t.id} className={`p-3 flex items-center justify-between ${!t.activo ? 'opacity-50' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{t.tipo}</p>
                        <p className="text-xs text-primary font-semibold">{Number(t.valor).toFixed(2)} MT</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isAdmin && <Switch checked={t.activo} onCheckedChange={() => toggleTipoActivo(t.id, t.activo)} />}
                        {!isAdmin && <Badge variant={t.activo ? 'default' : 'secondary'} className="text-[10px]">{t.activo ? 'Activo' : 'Inactivo'}</Badge>}
                        {isAdmin && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTipo(t)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTipoId(t.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Imóveis */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">🏢 Multas Imóveis</h4>
                <div className="space-y-1.5">
                  {tiposImoveis.map(t => (
                    <Card key={t.id} className={`p-3 flex items-center justify-between ${!t.activo ? 'opacity-50' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{t.tipo}</p>
                        <p className="text-xs text-primary font-semibold">{Number(t.valor).toFixed(2)} MT</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isAdmin && <Switch checked={t.activo} onCheckedChange={() => toggleTipoActivo(t.id, t.activo)} />}
                        {!isAdmin && <Badge variant={t.activo ? 'default' : 'secondary'} className="text-[10px]">{t.activo ? 'Activo' : 'Inactivo'}</Badge>}
                        {isAdmin && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTipo(t)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTipoId(t.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* LOCAIS DE PAGAMENTO */}
        <TabsContent value="locais" className="space-y-4 mt-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Locais de Pagamento
            </h3>
            {isAdmin && (
              <Button size="sm" onClick={openNewLocal} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Novo Local
              </Button>
            )}
          </div>

          {locaisLoading ? (
            <Card className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </Card>
          ) : locais.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">Nenhum local de pagamento registado.</Card>
          ) : (
            <div className="space-y-1.5">
              {locais.map(l => (
                <Card key={l.id} className={`p-3 flex items-center justify-between ${!l.activo ? 'opacity-50' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      {l.nome}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isAdmin && <Switch checked={l.activo} onCheckedChange={() => toggleLocalActivo(l.id, l.activo)} />}
                    {!isAdmin && <Badge variant={l.activo ? 'default' : 'secondary'} className="text-[10px]">{l.activo ? 'Activo' : 'Inactivo'}</Badge>}
                    {isAdmin && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLocal(l)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteLocalId(l.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* CONTROLE DE USUÁRIOS */}
        {/* IMPRESSORA */}
        <TabsContent value="impressora" className="space-y-4 mt-3">
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary" />
              Impressora Térmica
            </h3>
            <p className="text-xs text-muted-foreground">
              Conecte uma impressora térmica ESC/POS via Bluetooth, Wi-Fi, Rede ou USB para imprimir recibos e multas.
            </p>

            {printerConnected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-primary text-sm p-3 rounded-lg bg-primary/10">
                  <Printer className="w-4 h-4" />
                  <span className="font-medium">Conectada via {({ bluetooth: 'Bluetooth', wifi: 'Wi-Fi', rede: 'Rede (IP)', usb: 'USB' } as Record<ConnectionType, string>)[getConnectionType() || connType]}</span>
                </div>
                <Button variant="outline" onClick={async () => { await disconnectPrinter(); setPrinterConnected(false); toast.info('Impressora desconectada'); }} className="w-full">
                  <BluetoothOff className="mr-2 h-4 w-4" />
                  Desconectar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Tipo de Conexão</Label>
                  <Select value={connType} onValueChange={(v) => setConnType(v as ConnectionType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bluetooth"><span className="flex items-center gap-2"><Bluetooth className="h-3 w-3" /> Bluetooth</span></SelectItem>
                      <SelectItem value="wifi"><span className="flex items-center gap-2"><Wifi className="h-3 w-3" /> Wi-Fi</span></SelectItem>
                      <SelectItem value="rede"><span className="flex items-center gap-2"><Network className="h-3 w-3" /> Rede (IP)</span></SelectItem>
                      <SelectItem value="usb"><span className="flex items-center gap-2"><Usb className="h-3 w-3" /> USB</span></SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(connType === 'wifi' || connType === 'rede') && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Endereço IP</Label>
                      <Input value={printerIp} onChange={(e) => setPrinterIp(e.target.value)} placeholder="192.168.1.100" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Porta</Label>
                      <Input value={printerPort} onChange={(e) => setPrinterPort(e.target.value)} placeholder="9100" />
                    </div>
                  </div>
                )}

                <Button onClick={async () => {
                  setConnecting(true);
                  const config = (connType === 'wifi' || connType === 'rede') ? { ip: printerIp, port: parseInt(printerPort) || 9100 } : undefined;
                  const ok = await connectPrinter(connType, config);
                  setPrinterConnected(ok);
                  toast[ok ? 'success' : 'error'](ok ? 'Impressora conectada!' : 'Falha ao conectar impressora');
                  setConnecting(false);
                }} className="w-full" disabled={connecting}>
                  <Printer className="mr-2 h-4 w-4" />
                  {connecting ? 'Conectando...' : `Conectar via ${({ bluetooth: 'Bluetooth', wifi: 'Wi-Fi', rede: 'Rede (IP)', usb: 'USB' } as Record<ConnectionType, string>)[connType]}`}
                </Button>
              </div>
            )}

            <div className="pt-3 border-t space-y-2">
              <p className="text-xs font-semibold text-foreground">Diálogo Geral de Impressão (A4 e Térmico)</p>
              <p className="text-[11px] text-muted-foreground">
                Abra a janela de pré-visualização para testar a impressão de Autos Oficiais, Recibos, Facturas e Relatórios.
              </p>
              <Button
                variant="outline"
                onClick={() => setTestPrintOpen(true)}
                className="w-full gap-2 border-primary/40 bg-primary/5 hover:bg-primary/10"
              >
                <Printer className="h-4 w-4 text-primary" />
                Testar Diálogo e Formatos de Impressão
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* SESSÕES */}
        <TabsContent value="sessoes" className="space-y-4 mt-3">
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Actividade dos Usuários
            </h3>
            {sortedLoginStats.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sem dados de actividade.</p>
            ) : (
              <div className="space-y-2">
                {sortedLoginStats.map(([email, count], i) => (
                  <div key={email} className="flex items-center justify-between text-xs py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        {i + 1}
                      </span>
                      <span className="text-foreground truncate">{email}</span>
                    </div>
                    <span className="font-bold text-foreground flex-shrink-0">{count as number} acções</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent" />
              Últimas Acções
            </h3>
            {auditLoading ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            ) : (
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {auditLogs.slice(0, 20).map(log => (
                  <div key={log.id} className="flex items-start gap-2 text-xs py-2 border-b border-border last:border-0">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground font-medium">{log.action}</p>
                      <p className="text-muted-foreground truncate">{log.details}</p>
                      <p className="text-muted-foreground/60">{new Date(log.created_at).toLocaleString('pt-MZ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* E-MAIL & NOTIFICAÇÕES */}
        <TabsContent value="email" className="space-y-4 mt-3">
          {/* Status do Subsistema */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <Server className="w-4 h-4 text-primary" />
                  Estado do Subsistema de E-mail
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Monitorização da infraestrutura SMTP / Resend para notificações automáticas
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={loadEmailConfigStatus}
                disabled={emailStatusLoading}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${emailStatusLoading ? 'animate-spin' : ''}`} />
                Actualizar Estado
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-border bg-card flex flex-col justify-between">
                <span className="text-xs text-muted-foreground">Provedor Activo</span>
                <div className="mt-1 flex items-center gap-2">
                  <Badge
                    variant={emailStatus?.configured ? 'default' : 'secondary'}
                    className="capitalize font-semibold text-xs"
                  >
                    {emailStatus?.activeMode === 'resend' && '⚡ Resend API'}
                    {emailStatus?.activeMode === 'smtp' && '📧 Servidor SMTP'}
                    {emailStatus?.activeMode === 'simulado' && '🛠️ Simulado (Dev)'}
                    {!emailStatus && 'A verificar...'}
                  </Badge>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-card flex flex-col justify-between">
                <span className="text-xs text-muted-foreground">Remetente Oficial</span>
                <p className="text-xs font-medium text-foreground truncate mt-1">
                  {emailStatus?.fromAddress || 'notificacoes@matola.gov.mz'}
                </p>
              </div>

              <div className="p-3 rounded-lg border border-border bg-card flex flex-col justify-between">
                <span className="text-xs text-muted-foreground">Host / Porta</span>
                <p className="text-xs font-medium text-foreground truncate mt-1">
                  {emailStatus?.smtpHost ? `${emailStatus.smtpHost}:${emailStatus.smtpPort}` : emailStatus?.hasResendKey ? 'api.resend.com (HTTPS)' : 'Local JSON Mock'}
                </p>
              </div>
            </div>

            {emailStatus && (
              <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span>
                    Autenticação: <strong>{emailStatus.smtpUser || (emailStatus.hasResendKey ? 'Chave Resend Válida' : 'Não configurada')}</strong>
                  </span>
                </div>
                <span>SSL/TLS Seguro: <strong>{emailStatus.smtpSecure ? 'Sim (Porta 465)' : 'STARTTLS / HTTPS'}</strong></span>
              </div>
            )}
          </Card>

          {/* Teste de Envio de E-mail */}
          <Card className="p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                Disparar E-mail de Teste
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Envie um e-mail de teste para verificar a entrega de notificações em tempo real.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="testEmailInput" className="text-xs">Endereço de Destino</Label>
                <Input
                  id="testEmailInput"
                  type="email"
                  placeholder="exemplo@municipio.gov.mz"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
              <div className="sm:self-end">
                <Button
                  onClick={handleTriggerTestEmail}
                  disabled={sendingTestEmail || !testEmailAddress}
                  className="w-full sm:w-auto h-9 text-xs gap-1.5"
                >
                  {sendingTestEmail ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      A Enviar...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Enviar Teste
                    </>
                  )}
                </Button>
              </div>
            </div>

            {testEmailResult && (
              <div
                className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                  testEmailResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : 'bg-destructive/10 border-destructive/20 text-destructive'
                }`}
              >
                {testEmailResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-semibold">{testEmailResult.message}</p>
                  {testEmailResult.simulated && (
                    <p className="mt-1 opacity-80 text-[11px]">
                      Nota: O envio foi simulado com sucesso. Para entrega real nas caixas de correio dos munícipes, configure as variáveis de ambiente SMTP ou RESEND_API_KEY no servidor.
                    </p>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Serviços Integrados */}
          <Card className="p-5 space-y-3">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Notificações Automáticas Activas no SIGEMM
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="p-3 rounded-lg border border-border bg-card/60 space-y-1">
                <p className="text-xs font-semibold text-foreground">🚗 Avisos de Multa</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Envio automático com dados do auto, valor em Meticais, prazo de 15 dias e guia de quitação.
                </p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card/60 space-y-1">
                <p className="text-xs font-semibold text-foreground">🔑 Credenciais de Acesso</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Disparo imediato com o nome de utilizador e senha gerada para novos agentes e operadores.
                </p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card/60 space-y-1">
                <p className="text-xs font-semibold text-foreground">🔒 Redefinição de Senha</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Envio seguro de senha temporária para reposição de contas com forçamento de troca.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* POWERSYNC & SINCRONIZAÇÃO AUTOMÁTICA */}
        <TabsContent value="powersync" className="space-y-4 mt-3">
          {/* Header Card */}
          <Card className="p-5 space-y-4 border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-500/5 via-card to-card">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
                  <Zap className="w-6 h-6 fill-amber-500/20" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-foreground">Motor PowerSync (Sincronização Automática)</h3>
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-semibold">
                      {powerSyncStatus.initialized ? 'Operacional' : 'Inicializando'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Arquitetura Local-First com SQLite no dispositivo do agente e replicação contínua para PostgreSQL central
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runPowerSyncDiag}
                  disabled={psDiagnosing}
                  className="text-xs h-9 gap-1.5 flex-1 sm:flex-none"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${psDiagnosing ? 'animate-spin' : ''}`} />
                  {psDiagnosing ? 'A Testar...' : 'Testar Conexão'}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleForcePowerSync}
                  disabled={syncing}
                  className="text-xs h-9 gap-1.5 bg-primary text-primary-foreground font-semibold flex-1 sm:flex-none"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  {syncing ? 'A Sincronizar...' : 'Sincronizar Agora'}
                </Button>
              </div>
            </div>

            {/* Painel de Métricas Rápidas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-lg border bg-card/60">
                <span className="text-[11px] text-muted-foreground block">Estado da Ligação</span>
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                  <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-destructive'}`} />
                  {online ? 'Online (Conectado)' : 'Offline (SQLite Local)'}
                </span>
              </div>

              <div className="p-3 rounded-lg border bg-card/60">
                <span className="text-[11px] text-muted-foreground block">Base SQLite Local</span>
                <span className="text-xs font-bold text-foreground font-mono mt-0.5 block truncate">
                  {powerSyncStatus.databaseName}
                </span>
              </div>

              <div className="p-3 rounded-lg border bg-card/60">
                <span className="text-[11px] text-muted-foreground block">Fila de Upload Local</span>
                <span className="text-xs font-bold text-foreground mt-0.5 block">
                  {pending === 0 ? '✓ 0 pendentes' : `${pending} registo(s) a enviar`}
                </span>
              </div>

              <div className="p-3 rounded-lg border bg-card/60">
                <span className="text-[11px] text-muted-foreground block">Última Sincronização</span>
                <span className="text-xs font-bold text-foreground mt-0.5 block">
                  {lastSyncTime
                    ? lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : 'Aguardando primeiro sync'}
                </span>
              </div>
            </div>
          </Card>

          {/* Resultado do Teste de Diagnóstico */}
          {psDiagResult && (
            <Card className="p-4 space-y-2 border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Diagnóstico PowerSync do Servidor & Cliente
                </h4>
                <span className="text-[10px] text-muted-foreground">
                  {psDiagResult.timestamp ? new Date(psDiagResult.timestamp).toLocaleString('pt-MZ') : ''}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs pt-1">
                <div className="bg-background/80 p-2.5 rounded border">
                  <span className="text-muted-foreground text-[10px] block">Modo de Operação:</span>
                  <span className="font-semibold text-foreground">{psDiagResult.mode || 'local-first-sqlite'}</span>
                </div>
                <div className="bg-background/80 p-2.5 rounded border">
                  <span className="text-muted-foreground text-[10px] block">Endpoint Configurado:</span>
                  <span className="font-semibold text-foreground truncate block">{psDiagResult.endpoint || 'Local SQLite'}</span>
                </div>
                <div className="bg-background/80 p-2.5 rounded border">
                  <span className="text-muted-foreground text-[10px] block">Tabelas no Esquema:</span>
                  <span className="font-semibold text-foreground">
                    {Array.isArray(psDiagResult.tables) ? psDiagResult.tables.join(', ') : '7 tabelas ativas'}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1">
                {psDiagResult.message || 'Motor operacional para sincronização contínua.'}
              </p>
            </Card>
          )}

          {/* Explicação Didática: Como Funciona o PowerSync no SIGEMM */}
          <Card className="p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Como Funciona a Sincronização Automática com o PowerSync?
              </h3>
              <p className="text-xs text-muted-foreground">
                Compreenda a arquitetura de alta disponibilidade que permite aos agentes autuar na via pública mesmo com cortes de internet.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <h4 className="text-xs font-bold text-foreground">Base de Dados SQLite no Dispositivo (Local-First)</h4>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Em vez de depender de uma chamada de rede para cada consulta ou inserção, o PowerSync instancia uma base de dados relacional SQLite embutida diretamente no navegador ou tablet via WebAssembly (<span className="font-mono text-foreground font-semibold">sigemm_powersync.db</span>). As consultas têm latência zero (0ms) e funcionam 100% offline.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-600 font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <h4 className="text-xs font-bold text-foreground">Sync Stream Bidirecional em Tempo Real</h4>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  O PowerSync monitoriza continuamente as alterações na base de dados central do Município (PostgreSQL / Supabase). Quando um munícipe paga uma multa no balcão ou um novo tipo de infração é criado pelo administrador, o servidor transmite apenas os deltas (mudanças incrementais) para os telemóveis dos agentes de forma compacta.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-xs flex items-center justify-center">
                    3
                  </span>
                  <h4 className="text-xs font-bold text-foreground">Fila de Mutações em Lote (CrudBatch Upload)</h4>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Quando o agente fiscal lavra um auto de trânsito ou obra na rua sem sinal 4G, a multa, fotos comprimidas e assinaturas são gravadas na SQLite local. O PowerSync cria uma transação no log de mutações (<span className="font-mono text-foreground">CrudBatch</span>) e despacha-a automaticamente para o servidor assim que a conectividade for restabelecida.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 font-bold text-xs flex items-center justify-center">
                    4
                  </span>
                  <h4 className="text-xs font-bold text-foreground">Consistência e Resolução de Conflitos</h4>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  O motor garante idempotência: cada auto tem um identificador único permanente gerado no dispositivo. Mesmo que o sinal caia a meio do envio, o PowerSync não duplica registos e mantém a integridade dos dados fiscais e registos de auditoria dos agentes.
                </p>
              </div>
            </div>

            {/* Tabelas Sincronizadas */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                Tabelas Sincronizadas Automaticamente pelo Esquema PowerSync
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded bg-background border flex items-center gap-2">
                  <span className="text-emerald-500">✓</span>
                  <div>
                    <span className="font-bold font-mono text-[11px] block">multas</span>
                    <span className="text-[10px] text-muted-foreground">Autos, fotos e assinaturas</span>
                  </div>
                </div>
                <div className="p-2 rounded bg-background border flex items-center gap-2">
                  <span className="text-emerald-500">✓</span>
                  <div>
                    <span className="font-bold font-mono text-[11px] block">tipos_multa</span>
                    <span className="text-[10px] text-muted-foreground">Posturas e valores em MT</span>
                  </div>
                </div>
                <div className="p-2 rounded bg-background border flex items-center gap-2">
                  <span className="text-emerald-500">✓</span>
                  <div>
                    <span className="font-bold font-mono text-[11px] block">agentes</span>
                    <span className="text-[10px] text-muted-foreground">Perfis e credenciais</span>
                  </div>
                </div>
                <div className="p-2 rounded bg-background border flex items-center gap-2">
                  <span className="text-emerald-500">✓</span>
                  <div>
                    <span className="font-bold font-mono text-[11px] block">pagamentos</span>
                    <span className="text-[10px] text-muted-foreground">Quitações e recibos</span>
                  </div>
                </div>
                <div className="p-2 rounded bg-background border flex items-center gap-2">
                  <span className="text-emerald-500">✓</span>
                  <div>
                    <span className="font-bold font-mono text-[11px] block">reclamacoes</span>
                    <span className="text-[10px] text-muted-foreground">Contestações munícipes</span>
                  </div>
                </div>
                <div className="p-2 rounded bg-background border flex items-center gap-2">
                  <span className="text-emerald-500">✓</span>
                  <div>
                    <span className="font-bold font-mono text-[11px] block">audit_log</span>
                    <span className="text-[10px] text-muted-foreground">Rastreio de operações</span>
                  </div>
                </div>
                <div className="p-2 rounded bg-background border flex items-center gap-2">
                  <span className="text-emerald-500">✓</span>
                  <div>
                    <span className="font-bold font-mono text-[11px] block">notifications</span>
                    <span className="text-[10px] text-muted-foreground">Alertas do município</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Tipo form dialog */}
      <Dialog open={showTipoForm} onOpenChange={setShowTipoForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingTipo ? 'Editar Tipo de Multa' : 'Novo Tipo de Multa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={tipoForm.categoria} onValueChange={(v) => setTipoForm(f => ({ ...f, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="movel">🚗 Móvel</SelectItem>
                  <SelectItem value="imovel">🏢 Imóvel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Infracção *</Label>
              <Input value={tipoForm.tipo} onChange={(e) => setTipoForm(f => ({ ...f, tipo: e.target.value }))} placeholder="Ex: Estacionamento proibido" />
            </div>
            <div className="space-y-2">
              <Label>Valor (MT) *</Label>
              <Input type="number" value={tipoForm.valor} onChange={(e) => setTipoForm(f => ({ ...f, valor: e.target.value }))} placeholder="500" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTipoForm(false)}>Cancelar</Button>
            <Button onClick={saveTipo} disabled={savingTipo}>
              {savingTipo ? 'Guardando...' : editingTipo ? 'Actualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete tipo dialog */}
      <AlertDialog open={!!deleteTipoId} onOpenChange={() => setDeleteTipoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar Tipo de Multa?</AlertDialogTitle>
            <AlertDialogDescription>Esta acção é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteTipoId && deleteTipo(deleteTipoId)}>
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Local form dialog */}
      <Dialog open={showLocalForm} onOpenChange={setShowLocalForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingLocal ? 'Editar Local de Pagamento' : 'Novo Local de Pagamento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Local *</Label>
              <Input value={localForm.nome} onChange={(e) => setLocalForm({ nome: e.target.value })} placeholder="Ex: Balcão Único - Sede" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLocalForm(false)}>Cancelar</Button>
            <Button onClick={saveLocal} disabled={savingLocal}>
              {savingLocal ? 'Guardando...' : editingLocal ? 'Actualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete local dialog */}
      <AlertDialog open={!!deleteLocalId} onOpenChange={() => setDeleteLocalId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar Local de Pagamento?</AlertDialogTitle>
            <AlertDialogDescription>Esta acção é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteLocalId && deleteLocal(deleteLocalId)}>
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PrinterSelectDialog
        open={testPrintOpen}
        onOpenChange={setTestPrintOpen}
        document={sampleDocument}
        initialMode="auto-e-aviso"
      />
    </div>
  );
}
