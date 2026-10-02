import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import PhotoCapture from '@/components/PhotoCapture';
import DocumentActions from '@/components/DocumentActions';
import PlateOCR from '@/components/PlateOCR';
import SignaturePad from '@/components/SignaturePad';
import InfratorHistorico from '@/components/InfratorHistorico';
import { enqueueMulta, getQueue, cacheGet, cacheSet } from '@/lib/offlineQueue';
import { insertMultaPowerSync } from '@/lib/powersync';
import { buildDocumentData } from '@/lib/documentGenerator';
import { Loader2, CheckCircle, MapPin, Car, Building2, PlusCircle, Search, Eye, Gavel, Send, Mail, AlertCircle, CheckCircle2, RefreshCw, CloudOff } from 'lucide-react';
import { useUserRole, canAccess } from '@/hooks/useUserRole';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { sendFineNoticeEmail } from '@/lib/emailService';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function NovaMultaPage() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { nivelAcesso } = useUserRole();
  const { online, pending, syncing, sync } = useOfflineSync();
  const canSendTribunal = canAccess(nivelAcesso, 'supervisor');
  const [multas, setMultas] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailMulta, setDetailMulta] = useState<any>(null);
  const [tribunalOpen, setTribunalOpen] = useState(false);
  const [tribunalNome, setTribunalNome] = useState('');
  const [enviandoTribunal, setEnviandoTribunal] = useState(false);

  // Form state
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastMulta, setLastMulta] = useState<any>(null);
  const [sendingEmailNotice, setSendingEmailNotice] = useState(false);
  const [emailNoticeSent, setEmailNoticeSent] = useState(false);
  const [emailNoticeError, setEmailNoticeError] = useState<string | null>(null);
  const [emailNoticeRecipient, setEmailNoticeRecipient] = useState('');
  const [customEmailDest, setCustomEmailDest] = useState('');
  const [detailEmailDest, setDetailEmailDest] = useState('');
  const [sendingDetailEmail, setSendingDetailEmail] = useState(false);
  const [categoria, setCategoria] = useState<'movel' | 'imovel'>('movel');
  const [assinaturaInfrator, setAssinaturaInfrator] = useState<string | null>(null);
  const [assinaturaAgente, setAssinaturaAgente] = useState<string | null>(null);
  const [infracoesMoveis, setInfracoesMoveis] = useState<{ tipo: string; valor: number }[]>([]);
  const [infracoesImoveis, setInfracoesImoveis] = useState<{ tipo: string; valor: number }[]>([]);

  const [form, setForm] = useState({
    numero_auto: '',
    infrator_nome: '', infrator_documento: '', matricula: '', infracao_tipo: '',
    local: '', observacoes: '', valor: 0,
    telefone_infrator: '+258 ',
    infrator_email: '',
    marca_veiculo: '', modelo_veiculo: '', cor_veiculo: '', carta_conducao: '',
    tipo_imovel: '', numero_porta: '', bairro: '', proprietario: '',
    dimensoes: '', estagio_obra: '', descricao_imovel: '',
    // Identificação completa do infractor (Auto de Notícia)
    estado_civil: '', data_nascimento: '', natural_de: '',
    nome_pai: '', nome_mae: '', profissao: '', local_trabalho: '',
    // Residência do infractor
    residencia_bairro: '', residencia_quarteirao: '', residencia_avenida: '', residencia_casa: '',
    // Localização detalhada da infracção
    posto_administrativo: '', local_quarteirao: '', local_avenida: '', local_casa: '',
    // Base legal
    alinea_transgredida: '', numero_transgredido: '', artigo_transgredido: '', legislacao: '',
    alinea_punicao: '', numero_punicao: '', artigo_punicao: '',
    valor_extenso: '',
  });

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [fotoDocumento, setFotoDocumento] = useState<string[]>([]);
  const [showSugestoes, setShowSugestoes] = useState(false);

  // Sugestões filtradas: combinam móveis + imóveis, dão prioridade à categoria activa
  const sugestoesFiltradas = (() => {
    const termo = form.infracao_tipo.trim().toLowerCase();
    if (!termo) return [] as { tipo: string; valor: number; categoria: 'movel' | 'imovel' }[];
    const todas = [
      ...infracoesMoveis.map(i => ({ ...i, categoria: 'movel' as const })),
      ...infracoesImoveis.map(i => ({ ...i, categoria: 'imovel' as const })),
    ];
    const matches = todas.filter(i => i.tipo.toLowerCase().includes(termo) && i.tipo.toLowerCase() !== termo);
    // ordenar: começa-com primeiro, depois categoria activa
    matches.sort((a, b) => {
      const aStarts = a.tipo.toLowerCase().startsWith(termo) ? 0 : 1;
      const bStarts = b.tipo.toLowerCase().startsWith(termo) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      const aCat = a.categoria === categoria ? 0 : 1;
      const bCat = b.categoria === categoria ? 0 : 1;
      return aCat - bCat;
    });
    return matches.slice(0, 6);
  })();

  const aplicarSugestao = (s: { tipo: string; valor: number; categoria: 'movel' | 'imovel' }) => {
    setForm(prev => ({ ...prev, infracao_tipo: s.tipo, valor: s.valor }));
    if (s.categoria !== categoria) setCategoria(s.categoria);
    setShowSugestoes(false);
  };

  const formatDateSafe = (dateVal: any, pattern = 'dd/MM/yy') => {
    if (!dateVal) return '—';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '—';
      return format(d, pattern);
    } catch {
      return '—';
    }
  };

  const loadMultas = async () => {
    setLoadingList(true);
    let queueItems: any[] = [];
    try {
      const rawQueue = getQueue();
      if (Array.isArray(rawQueue)) {
        queueItems = rawQueue.map(q => ({
          ...(q.payload || {}),
          id: q.id || `queue-${Math.random().toString(36).slice(2, 7)}`,
          status: 'offline_pendente',
          created_at: q.createdAt || (q.payload && q.payload.created_at) || new Date().toISOString(),
          isOfflineQueue: true,
        }));
      }
    } catch (e) {
      console.warn('[NovaMulta] Erro ao obter fila offline:', e);
    }

    try {
      if (navigator.onLine) {
        const { data, error } = await supabase.from('multas').select('*').order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) {
          cacheSet('multas_list', data);
          setMultas([...queueItems, ...data]);
          setLoadingList(false);
          return;
        }
      }
    } catch (err) {
      console.warn('[NovaMulta] Falha ao carregar multas online:', err);
    }

    const cached = cacheGet<any[]>('multas_list');
    const safeCached = Array.isArray(cached) ? cached : [];
    setMultas([...queueItems, ...safeCached]);
    setLoadingList(false);
  };

  useEffect(() => {
    loadMultas();

    const cachedTipos = cacheGet<any[]>('tipos_multa');
    if (cachedTipos && cachedTipos.length > 0) {
      setInfracoesMoveis(cachedTipos.filter(t => t.categoria === 'movel').map(t => ({ tipo: t.tipo, valor: Number(t.valor) })));
      setInfracoesImoveis(cachedTipos.filter(t => t.categoria === 'imovel').map(t => ({ tipo: t.tipo, valor: Number(t.valor) })));
    }

    supabase.from('tipos_multa').select('*').eq('activo', true).order('tipo').then(({ data }) => {
      if (data && data.length > 0) {
        cacheSet('tipos_multa', data);
        setInfracoesMoveis(data.filter(t => t.categoria === 'movel').map(t => ({ tipo: t.tipo, valor: Number(t.valor) })));
        setInfracoesImoveis(data.filter(t => t.categoria === 'imovel').map(t => ({ tipo: t.tipo, valor: Number(t.valor) })));
      }
    }).catch(() => {});

    const handler = () => loadMultas();
    window.addEventListener('multas-updated', handler);
    window.addEventListener('sigemm-queue-changed', handler);
    return () => {
      window.removeEventListener('multas-updated', handler);
      window.removeEventListener('sigemm-queue-changed', handler);
    };
  }, []);

  const infracoes = categoria === 'movel' ? infracoesMoveis : infracoesImoveis;

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); toast.success('Localização capturada'); },
        () => toast.error('Não foi possível obter localização')
      );
    }
  };

  const handleInfracaoChange = (tipo: string) => {
    const infracao = infracoes.find(i => i.tipo === tipo);
    setForm(prev => ({ ...prev, infracao_tipo: tipo, valor: infracao?.valor ?? 0 }));
  };

  const handleCategoriaChange = (cat: string) => {
    setCategoria(cat as 'movel' | 'imovel');
    setForm(prev => ({ ...prev, infracao_tipo: '', valor: 0 }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.numero_auto.trim()) {
      toast.error('Nº do Auto de Notícia é obrigatório');
      return;
    }
    if (!form.infrator_nome || !form.infracao_tipo || !form.local) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (Number(form.valor) <= 0) {
      toast.error('Defina um valor para a multa');
      return;
    }
    if (fotoDocumento.length === 0) {
      toast.error('Capture a foto do documento de identificação do infractor');
      return;
    }
    if (photos.length < 2) {
      toast.error('São necessárias, no mínimo, 2 fotografias do local/objecto da infracção');
      return;
    }

    setLoading(true);
    const numero = `MLT-${Date.now().toString(36).toUpperCase()}`;

    const observacoesCompletas = [
      form.observacoes,
      categoria === 'movel'
        ? `[MÓVEL] Marca: ${form.marca_veiculo}, Modelo: ${form.modelo_veiculo}, Cor: ${form.cor_veiculo}, Carta: ${form.carta_conducao}`
        : `[IMÓVEL] Tipo: ${form.tipo_imovel}, Porta: ${form.numero_porta}, Bairro: ${form.bairro}, Proprietário: ${form.proprietario}`,
    ].filter(Boolean).join(' | ');

    // Buscar nome completo do agente para preencher documentos oficiais
    const agenteRow = await supabase.from('agentes').select('nome').eq('email', user?.email || '').maybeSingle();
    const agenteNome = agenteRow.data?.nome || null;

    const payload: Record<string, any> = {
      numero, agente_id: user?.id, agente_email: user?.email, agente_nome: agenteNome,
      infrator_nome: form.infrator_nome, infrator_documento: form.infrator_documento,
      infrator_email: form.infrator_email?.trim() || null,
      matricula: categoria === 'movel' ? form.matricula : form.numero_porta,
      infracao_tipo: form.infracao_tipo, local: form.local, observacoes: observacoesCompletas,
      valor: form.valor, status: 'pendente',
      latitude: location?.lat, longitude: location?.lng, fotos: photos,
      numero_auto: form.numero_auto.trim(),
      foto_documento: fotoDocumento[0],
      categoria,
      dimensoes: categoria === 'imovel' ? form.dimensoes : null,
      estagio_obra: categoria === 'imovel' ? form.estagio_obra : null,
      descricao_imovel: categoria === 'imovel' ? form.descricao_imovel : null,
      estado_civil: form.estado_civil || null,
      data_nascimento: form.data_nascimento || null,
      natural_de: form.natural_de || null,
      nome_pai: form.nome_pai || null,
      nome_mae: form.nome_mae || null,
      profissao: form.profissao || null,
      local_trabalho: form.local_trabalho || null,
      residencia_bairro: form.residencia_bairro || null,
      residencia_quarteirao: form.residencia_quarteirao || null,
      residencia_avenida: form.residencia_avenida || null,
      residencia_casa: form.residencia_casa || null,
      posto_administrativo: form.posto_administrativo || null,
      local_quarteirao: form.local_quarteirao || null,
      local_avenida: form.local_avenida || null,
      local_casa: form.local_casa || null,
      alinea_transgredida: form.alinea_transgredida || null,
      numero_transgredido: form.numero_transgredido || null,
      artigo_transgredido: form.artigo_transgredido || null,
      legislacao: form.legislacao || null,
      alinea_punicao: form.alinea_punicao || null,
      numero_punicao: form.numero_punicao || null,
      artigo_punicao: form.artigo_punicao || null,
      valor_extenso: form.valor_extenso || null,
      assinatura_infrator: assinaturaInfrator,
      assinatura_agente: assinaturaAgente,
      assinado_em: (assinaturaInfrator || assinaturaAgente) ? new Date().toISOString() : null,
    };

    // Sanitizar payload para o banco (remover campos virtuais como infrator_email se não fizerem parte da tabela)
    const { infrator_email: _, ...dbPayload } = payload;

    // Modo offline ou fallback automático em caso de falha de conexão
    const saveOfflineFallback = () => {
      // 1. Gravar no motor PowerSync local SQLite
      insertMultaPowerSync(payload).catch((err) => {
        console.warn('[NovaMulta] Aviso ao inserir no PowerSync:', err);
      });

      // 2. Gravar na fila de contingência
      enqueueMulta({
        payload,
        audit: {
          user_id: user?.id,
          action: 'CRIAR_MULTA',
          details: `Multa ${numero} (${categoria}) criada offline para ${form.infrator_nome}`,
        },
        notification: {
          message: `Nova multa registada (offline): ${form.infrator_nome} — ${form.infracao_tipo} (${Number(form.valor).toFixed(2)} MT)`,
          action: 'CRIAR_MULTA',
          local_trabalho: 'via_publica',
          created_by: user?.id,
        },
      });
      setLastMulta({ ...payload, id: numero, created_at: new Date().toISOString(), status: 'offline_pendente', isOfflineQueue: true });
      setSuccess(true);
      setLoading(false);
      loadMultas();
      toast.success(
        lang === 'en'
          ? 'Fine registered offline! It is saved locally in PowerSync SQLite and will sync automatically when connected.'
          : 'Multa registada offline com sucesso! Guardada localmente no SQLite PowerSync com sincronização automática garantida.'
      );
    };

    if (!navigator.onLine) {
      saveOfflineFallback();
      return;
    }

    try {
      // Race com timeout de 5 segundos para não travar o ecrã do agente em zonas de fraca cobertura
      const insertPromise = supabase.from('multas').insert(dbPayload as any).select().single();
      const timeoutPromise = new Promise<{ data: null; error: any }>((_, reject) =>
        setTimeout(() => reject(new Error('Tempo limite de rede excedido')), 5000)
      );

      const { data, error } = await Promise.race([insertPromise, timeoutPromise]);

      if (error) {
        console.warn('[NovaMulta] Erro ao gravar online, guardando na fila offline:', error);
        saveOfflineFallback();
        return;
      }

      const agentInfo = await supabase.from('agentes').select('local_trabalho').eq('email', user?.email || '').maybeSingle();
      const localTrabalho = agentInfo.data?.local_trabalho || 'via_publica';

      await Promise.all([
        supabase.from('audit_log').insert({
          user_id: user?.id, action: 'CRIAR_MULTA',
          details: `Multa ${numero} (${categoria}) criada para ${form.infrator_nome}`, resource_id: data.id,
        }),
        supabase.from('notifications').insert({
          message: `Nova multa registada: ${form.infrator_nome} — ${form.infracao_tipo} (${form.valor.toFixed(2)} MT)`,
          action: 'CRIAR_MULTA', resource_id: data.id, local_trabalho: localTrabalho, created_by: user?.id,
        } as any),
      ]);

      setLastMulta({ ...data, numero });
      insertMultaPowerSync({ ...payload, id: data.id, numero }).catch(() => {});
      setSuccess(true);
      setLoading(false);
      toast.success(t('fine.createSuccess'));
    } catch (netErr) {
      console.warn('[NovaMulta] Falha de rede durante inserção, salvando offline:', netErr);
      saveOfflineFallback();
      return;
    }
    setSuccess(true);
    setLoading(false);
    toast.success(lang === 'en' ? 'Fine issued successfully!' : 'Multa registada com sucesso!');

    // Enviar notificação oficial por email ao munícipe caso o email tenha sido preenchido
    if (form.infrator_email && form.infrator_email.trim()) {
      const emailTarget = form.infrator_email.trim();
      setEmailNoticeRecipient(emailTarget);
      setSendingEmailNotice(true);
      setEmailNoticeError(null);

      sendFineNoticeEmail({
        to: emailTarget,
        infratorNome: form.infrator_nome,
        numeroAuto: form.numero_auto.trim(),
        numeroMulta: numero,
        infracaoTipo: form.infracao_tipo,
        valor: Number(form.valor),
        local: form.local,
        matriculaOuPorta: categoria === 'movel' ? form.matricula : form.numero_porta,
        categoria,
        agenteNome: agenteNome || user?.email || undefined,
        dataHora: new Date().toLocaleString(lang === 'en' ? 'en-US' : 'pt-MZ'),
      })
        .then((res) => {
          setSendingEmailNotice(false);
          if (res.success) {
            setEmailNoticeSent(true);
            setEmailNoticeError(null);
            toast.success(
              lang === 'en'
                ? `Official fine notice dispatched to ${emailTarget}`
                : `Aviso oficial de multa enviado por email para ${emailTarget}`
            );
          } else {
            setEmailNoticeSent(false);
            setEmailNoticeError(res.error || 'Falha ao enviar email');
            toast.warning(
              lang === 'en'
                ? `Fine created, but email could not be sent: ${res.error}`
                : `Multa registada, mas falhou o envio do email: ${res.error}`
            );
          }
        })
        .catch((err) => {
          setSendingEmailNotice(false);
          setEmailNoticeSent(false);
          setEmailNoticeError(err?.message || 'Erro inesperado no envio de email');
        });
    }

    // Guardar a infracção livremente descrita como sugestão futura
    try {
      const tipoDescrito = form.infracao_tipo.trim();
      const jaExiste = infracoes.some(i => i.tipo.toLowerCase() === tipoDescrito.toLowerCase());
      if (tipoDescrito && !jaExiste) {
        const { error: tipoErr } = await supabase.from('tipos_multa').insert({
          tipo: tipoDescrito, valor: Number(form.valor) || 0, categoria, activo: true,
        } as any);
        if (!tipoErr) {
          const novo = { tipo: tipoDescrito, valor: Number(form.valor) || 0 };
          if (categoria === 'movel') setInfracoesMoveis(prev => [...prev, novo]);
          else setInfracoesImoveis(prev => [...prev, novo]);
        }
      }
    } catch {}

    loadMultas();
  };

  const resetForm = () => {
    setForm({
      numero_auto: '',
      infrator_nome: '', infrator_documento: '', matricula: '', infracao_tipo: '',
      local: '', observacoes: '', valor: 0,
      telefone_infrator: '+258 ',
      infrator_email: '',
      marca_veiculo: '', modelo_veiculo: '', cor_veiculo: '', carta_conducao: '',
      tipo_imovel: '', numero_porta: '', bairro: '', proprietario: '',
      dimensoes: '', estagio_obra: '', descricao_imovel: '',
      estado_civil: '', data_nascimento: '', natural_de: '',
      nome_pai: '', nome_mae: '', profissao: '', local_trabalho: '',
      residencia_bairro: '', residencia_quarteirao: '', residencia_avenida: '', residencia_casa: '',
      posto_administrativo: '', local_quarteirao: '', local_avenida: '', local_casa: '',
      alinea_transgredida: '', numero_transgredido: '', artigo_transgredido: '', legislacao: '',
      alinea_punicao: '', numero_punicao: '', artigo_punicao: '',
      valor_extenso: '',
    });
    setSuccess(false);
    setLastMulta(null);
    setLocation(null);
    setPhotos([]);
    setFotoDocumento([]);
    setAssinaturaInfrator(null);
    setAssinaturaAgente(null);
    setCategoria('movel');
    setEmailNoticeSent(false);
    setEmailNoticeError(null);
    setEmailNoticeRecipient('');
    setCustomEmailDest('');
  };

  const handleOpenNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'paga': return 'bg-green-500/10 text-green-700 border-green-200';
      case 'pendente': return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
      case 'offline_pendente': return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300';
      case 'cancelada': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'fora_prazo': return 'bg-orange-500/10 text-orange-700 border-orange-200';
      case 'enviada_tribunal': return 'bg-purple-500/10 text-purple-700 border-purple-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const filtered = multas.filter(m => {
    if (!m) return false;
    const term = (searchTerm || '').toLowerCase().trim();
    if (!term) return true;
    return (
      (m.numero || '').toLowerCase().includes(term) ||
      (m.infrator_nome || '').toLowerCase().includes(term) ||
      (m.matricula || '').toLowerCase().includes(term) ||
      (m.infracao_tipo || '').toLowerCase().includes(term) ||
      (m.local || '').toLowerCase().includes(term)
    );
  });

  // Success content inside dialog
  const renderSuccess = () => {
    if (!lastMulta) return null;
    const docData = buildDocumentData(lastMulta, 'factura', user?.email);

    const handleSendCustomEmail = async () => {
      const targetEmail = customEmailDest.trim() || form.infrator_email?.trim() || emailNoticeRecipient;
      if (!targetEmail || !targetEmail.includes('@')) {
        toast.error(lang === 'en' ? 'Please enter a valid email address' : 'Introduza um endereço de email válido');
        return;
      }
      setSendingEmailNotice(true);
      setEmailNoticeError(null);

      const res = await sendFineNoticeEmail({
        to: targetEmail,
        infratorNome: lastMulta.infrator_nome || form.infrator_nome,
        numeroAuto: lastMulta.numero_auto || form.numero_auto,
        numeroMulta: lastMulta.numero,
        infracaoTipo: lastMulta.infracao_tipo || form.infracao_tipo,
        valor: Number(lastMulta.valor || form.valor),
        local: lastMulta.local || form.local,
        matriculaOuPorta: lastMulta.matricula || form.matricula || form.numero_porta,
        categoria,
        agenteNome: user?.email,
        dataHora: new Date().toLocaleString(lang === 'en' ? 'en-US' : 'pt-MZ'),
      });

      setSendingEmailNotice(false);
      if (res.success) {
        setEmailNoticeSent(true);
        setEmailNoticeRecipient(targetEmail);
        setEmailNoticeError(null);
        toast.success(lang === 'en' ? `Email notice sent to ${targetEmail}!` : `Aviso enviado com sucesso para ${targetEmail}!`);
      } else {
        setEmailNoticeError(res.error || 'Falha ao despachar email');
        toast.error(res.error || (lang === 'en' ? 'Failed to send email' : 'Falha ao enviar email'));
      }
    };

    return (
      <div className="space-y-5 animate-slide-up">
        <div className="text-center space-y-4">
          <CheckCircle className="w-14 h-14 text-primary mx-auto" />
          <h2 className="text-lg font-bold text-foreground">{t('fine.successTitle')}</h2>
          <p className="text-muted-foreground text-sm">
            Nº: <span className="font-mono font-bold text-foreground">{lastMulta.numero}</span>
          </p>
          <p className="text-muted-foreground text-sm">
            {t('fine.autoNumber')}: <span className="font-mono font-bold text-foreground">{form.numero_auto}</span>
          </p>
          <p className="text-muted-foreground text-sm">
            {t('common.value')}: <span className="font-bold text-foreground">{Number(form.valor).toFixed(2)} MT</span>
          </p>

          <Card className="p-3 bg-muted/50 text-left space-y-1">
            <p className="text-xs font-semibold text-foreground">📋 {t('common.status')}: {t('common.pending')}</p>
            <p className="text-[10px] text-muted-foreground">{t('fine.successNotice')}</p>
          </Card>

          {/* Email Notification Card */}
          <Card className={`p-3.5 text-left space-y-2.5 transition-all ${
            emailNoticeSent 
              ? 'border-emerald-500/40 bg-emerald-500/10' 
              : emailNoticeError 
              ? 'border-destructive/40 bg-destructive/10' 
              : 'border-primary/30 bg-primary/5'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold">
                {emailNoticeSent ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-700 dark:text-emerald-300">
                      {lang === 'en' ? 'Fine Notice Sent by Email' : 'Aviso de Multa Despachado'}
                    </span>
                  </>
                ) : emailNoticeError ? (
                  <>
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-destructive">
                      {lang === 'en' ? 'Email Dispatch Failed' : 'Falha no Envio do Email'}
                    </span>
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 text-primary" />
                    <span className="text-primary">
                      {lang === 'en' ? 'Send Fine Notice by Email' : 'Enviar Aviso de Multa por Email'}
                    </span>
                  </>
                )}
              </div>
              {sendingEmailNotice && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
            </div>

            {emailNoticeSent ? (
              <div className="space-y-1.5">
                <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
                  {lang === 'en'
                    ? `Official notice and payment reference dispatched to ${emailNoticeRecipient || form.infrator_email}.`
                    : `Aviso oficial com referência de pagamento enviado para ${emailNoticeRecipient || form.infrator_email}.`}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    type="email"
                    placeholder={lang === 'en' ? 'Send to another email...' : 'Enviar para outro email...'}
                    value={customEmailDest}
                    onChange={(e) => setCustomEmailDest(e.target.value)}
                    className="h-8 text-xs bg-background/80"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs shrink-0"
                    onClick={handleSendCustomEmail}
                    disabled={sendingEmailNotice}
                  >
                    {sendingEmailNotice ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    {lang === 'en' ? 'Resend' : 'Reenviar'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {emailNoticeError ? (
                  <p className="text-[11px] text-destructive font-medium">
                    {emailNoticeError}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    {lang === 'en'
                      ? 'Send official notice with SIMO / M-Pesa reference and legal terms to the citizen.'
                      : 'Envie a notificação oficial com instruções para pagamento via M-Pesa / SIMO.'}
                  </p>
                )}
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder={form.infrator_email || 'cidadao@exemplo.com'}
                    value={customEmailDest}
                    onChange={(e) => {
                      setCustomEmailDest(e.target.value);
                      if (emailNoticeError) setEmailNoticeError(null);
                    }}
                    className="h-8 text-xs bg-background/80"
                  />
                  <Button
                    size="sm"
                    className="h-8 gap-1 text-xs shrink-0"
                    onClick={handleSendCustomEmail}
                    disabled={sendingEmailNotice}
                  >
                    {sendingEmailNotice ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    {emailNoticeError ? (lang === 'en' ? 'Retry' : 'Tentar Novamente') : (lang === 'en' ? 'Send' : 'Enviar')}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <DocumentActions document={docData} />

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { resetForm(); }} className="flex-1">{t('dashboard.newFineBtn')}</Button>
            <Button variant="secondary" onClick={() => { setDialogOpen(false); resetForm(); }} className="flex-1">{lang === 'en' ? 'Close' : 'Fechar'}</Button>
          </div>
        </div>
      </div>
    );
  };

  // Form content inside dialog
  const renderForm = () => (
    <ScrollArea className="max-h-[75vh] sm:max-h-[70vh] pr-1 sm:pr-2">
      <Tabs value={categoria} onValueChange={handleCategoriaChange} className="w-full">
        <TabsList className="w-full grid grid-cols-2 h-12">
          <TabsTrigger value="movel" className="flex items-center gap-2 text-sm font-semibold">
            <Car className="h-4 w-4" /> Multa Móvel
          </TabsTrigger>
          <TabsTrigger value="imovel" className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4" /> Multa Imóvel
          </TabsTrigger>
        </TabsList>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <Card className="p-4 space-y-2 border-primary/40">
            <Label className="text-sm font-semibold">Nº Auto de Notícia *</Label>
            <Input
              value={form.numero_auto}
              onChange={(e) => setForm(prev => ({ ...prev, numero_auto: e.target.value }))}
              placeholder="Ex: 02712"
              required
            />
            <p className="text-[10px] text-muted-foreground">Número único impresso no auto físico.</p>
          </Card>

          <Card className="p-4 space-y-4">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              {categoria === 'movel' ? <Car className="h-4 w-4 text-primary" /> : <Building2 className="h-4 w-4 text-primary" />}
              Dados do {categoria === 'movel' ? 'Condutor / Proprietário' : 'Responsável'}
            </h3>
            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input value={form.infrator_nome} onChange={(e) => setForm(prev => ({ ...prev, infrator_nome: e.target.value }))} placeholder="Nome do infrator" required />
            </div>
            <div className="space-y-2">
              <Label>Documento de Identificação</Label>
              <Input value={form.infrator_documento} onChange={(e) => setForm(prev => ({ ...prev, infrator_documento: e.target.value }))} placeholder="BI / Passaporte / NUIT" />
            </div>
            <div className="space-y-2">
              <Label>Foto do Documento de Identificação *</Label>
              <PhotoCapture
                photos={fotoDocumento}
                onPhotosChange={(p) => setFotoDocumento(p.slice(0, 1))}
                multaNumero={`DOC-${Date.now().toString(36).toUpperCase()}`}
              />
              <p className="text-[10px] text-muted-foreground">Captura obrigatória do BI/Passaporte do infractor.</p>
            </div>
            <InfratorHistorico
              documento={form.infrator_documento}
              nome={form.infrator_nome}
              matricula={categoria === 'movel' ? form.matricula : undefined}
            />
            <div className="space-y-2">
              <Label>{t('fine.infratorPhone')} <span className="text-[10px] text-muted-foreground font-normal">(+258)</span></Label>
              <Input 
                value={form.telefone_infrator} 
                onChange={(e) => {
                  let val = e.target.value;
                  if (!val.startsWith('+258')) val = '+258 ' + val.replace(/^\+258\s*/, '');
                  setForm(prev => ({ ...prev, telefone_infrator: val }));
                }}
                placeholder="+258 84 123 4567"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" />
                {t('fine.infratorEmail')}
              </Label>
              <Input
                type="email"
                value={form.infrator_email}
                onChange={(e) => setForm(prev => ({ ...prev, infrator_email: e.target.value }))}
                placeholder="cidadao@exemplo.com"
                autoComplete="email"
              />
              <p className="text-[11px] text-muted-foreground">
                {t('fine.infratorEmailHelp')}
              </p>
            </div>
          </Card>

          <Card className="p-4 space-y-4">
            <h3 className="font-semibold text-foreground text-sm">Identificação Civil do Infractor <span className="text-[10px] text-muted-foreground font-normal">(Auto de Notícia)</span></h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Estado Civil</Label>
                <Select value={form.estado_civil} onValueChange={(v) => setForm(prev => ({ ...prev, estado_civil: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solteiro(a)">Solteiro(a)</SelectItem>
                    <SelectItem value="casado(a)">Casado(a)</SelectItem>
                    <SelectItem value="divorciado(a)">Divorciado(a)</SelectItem>
                    <SelectItem value="viúvo(a)">Viúvo(a)</SelectItem>
                    <SelectItem value="união de facto">União de facto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Data de Nascimento</Label>
                <Input type="date" value={form.data_nascimento} onChange={(e) => setForm(prev => ({ ...prev, data_nascimento: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2"><Label>Natural de</Label>
              <Input value={form.natural_de} onChange={(e) => setForm(prev => ({ ...prev, natural_de: e.target.value }))} placeholder="Local de naturalidade" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nome do Pai</Label>
                <Input value={form.nome_pai} onChange={(e) => setForm(prev => ({ ...prev, nome_pai: e.target.value }))} />
              </div>
              <div className="space-y-2"><Label>Nome da Mãe</Label>
                <Input value={form.nome_mae} onChange={(e) => setForm(prev => ({ ...prev, nome_mae: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Profissão</Label>
                <Input value={form.profissao} onChange={(e) => setForm(prev => ({ ...prev, profissao: e.target.value }))} />
              </div>
              <div className="space-y-2"><Label>Local de Trabalho</Label>
                <Input value={form.local_trabalho} onChange={(e) => setForm(prev => ({ ...prev, local_trabalho: e.target.value }))} />
              </div>
            </div>
            <h4 className="text-xs font-semibold text-muted-foreground pt-1">Residência</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Bairro</Label>
                <Input value={form.residencia_bairro} onChange={(e) => setForm(prev => ({ ...prev, residencia_bairro: e.target.value }))} />
              </div>
              <div className="space-y-2"><Label>Quarteirão</Label>
                <Input value={form.residencia_quarteirao} onChange={(e) => setForm(prev => ({ ...prev, residencia_quarteirao: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2"><Label>Avenida / Rua</Label>
                <Input value={form.residencia_avenida} onChange={(e) => setForm(prev => ({ ...prev, residencia_avenida: e.target.value }))} />
              </div>
              <div className="space-y-2"><Label>Casa nº</Label>
                <Input value={form.residencia_casa} onChange={(e) => setForm(prev => ({ ...prev, residencia_casa: e.target.value }))} />
              </div>
            </div>
          </Card>

          <TabsContent value="movel" className="mt-0 space-y-4">
            <Card className="p-4 space-y-4">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" /> Dados do Veículo
              </h3>
              <div className="space-y-2">
                <Label>Matrícula *</Label>
                <div className="flex gap-2">
                <Input
                  value={form.matricula} 
                  onChange={(e) => {
                    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
                    const clean = val.replace(/\s/g, '');
                    if (clean.length <= 3) val = clean;
                    else if (clean.length <= 6) val = clean.slice(0, 3) + ' ' + clean.slice(3);
                    else val = clean.slice(0, 3) + ' ' + clean.slice(3, 6) + ' ' + clean.slice(6, 8);
                    setForm(prev => ({ ...prev, matricula: val }));
                  }}
                  placeholder="ABC 123 XX"
                  maxLength={10}
                />
                <PlateOCR onDetected={(m) => setForm(prev => ({ ...prev, matricula: m }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Marca</Label><Input value={form.marca_veiculo} onChange={(e) => setForm(prev => ({ ...prev, marca_veiculo: e.target.value }))} placeholder="Toyota" /></div>
                <div className="space-y-2"><Label>Modelo</Label><Input value={form.modelo_veiculo} onChange={(e) => setForm(prev => ({ ...prev, modelo_veiculo: e.target.value }))} placeholder="Corolla" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Cor</Label><Input value={form.cor_veiculo} onChange={(e) => setForm(prev => ({ ...prev, cor_veiculo: e.target.value }))} placeholder="Branco" /></div>
                <div className="space-y-2"><Label>Carta de Condução</Label><Input value={form.carta_conducao} onChange={(e) => setForm(prev => ({ ...prev, carta_conducao: e.target.value }))} placeholder="Nº" /></div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="imovel" className="mt-0 space-y-4">
            <Card className="p-4 space-y-4">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Dados do Imóvel
              </h3>
              <div className="space-y-2">
                <Label>Tipo de Imóvel</Label>
                <Select value={form.tipo_imovel} onValueChange={(v) => setForm(prev => ({ ...prev, tipo_imovel: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residencial">Residencial</SelectItem>
                    <SelectItem value="comercial">Comercial</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                    <SelectItem value="terreno">Terreno baldio</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Nº Porta / Talhão</Label><Input value={form.numero_porta} onChange={(e) => setForm(prev => ({ ...prev, numero_porta: e.target.value }))} placeholder="Nº 123" /></div>
                <div className="space-y-2"><Label>Bairro</Label><Input value={form.bairro} onChange={(e) => setForm(prev => ({ ...prev, bairro: e.target.value }))} placeholder="Machava" /></div>
              </div>
              <div className="space-y-2"><Label>Proprietário</Label><Input value={form.proprietario} onChange={(e) => setForm(prev => ({ ...prev, proprietario: e.target.value }))} placeholder="Nome" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Dimensões</Label><Input value={form.dimensoes} onChange={(e) => setForm(prev => ({ ...prev, dimensoes: e.target.value }))} placeholder="Ex: 12m x 8m" /></div>
                <div className="space-y-2">
                  <Label>Estágio da Obra</Label>
                  <Select value={form.estagio_obra} onValueChange={(v) => setForm(prev => ({ ...prev, estagio_obra: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fundacoes">Fundações</SelectItem>
                      <SelectItem value="alvenaria">Alvenaria</SelectItem>
                      <SelectItem value="cobertura">Cobertura</SelectItem>
                      <SelectItem value="acabamentos">Acabamentos</SelectItem>
                      <SelectItem value="concluida">Concluída</SelectItem>
                      <SelectItem value="abandonada">Abandonada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Descrição adicional</Label><Textarea value={form.descricao_imovel} onChange={(e) => setForm(prev => ({ ...prev, descricao_imovel: e.target.value }))} placeholder="Elementos relevantes da infracção..." rows={2} /></div>
            </Card>
          </TabsContent>

          <Card className="p-4 space-y-4">
            <h3 className="font-semibold text-foreground text-sm">Infracção</h3>
            <div className="space-y-2">
              <Label>Sugestões de Infracção</Label>
              <Select value={infracoes.some(i => i.tipo === form.infracao_tipo) ? form.infracao_tipo : ''} onValueChange={handleInfracaoChange}>
                <SelectTrigger><SelectValue placeholder="Seleccione uma sugestão (opcional)" /></SelectTrigger>
                <SelectContent>
                  {infracoes.map((inf) => (
                    <SelectItem key={inf.tipo} value={inf.tipo}>{inf.tipo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="infracao_livre">Ou descreva livremente a infracção *</Label>
              <div className="relative">
                <textarea
                  id="infracao_livre"
                  name="infracao_livre"
                  value={form.infracao_tipo}
                  onChange={(e) => { setForm(prev => ({ ...prev, infracao_tipo: e.target.value })); setShowSugestoes(true); }}
                  onFocus={() => setShowSugestoes(true)}
                  onBlur={() => setTimeout(() => setShowSugestoes(false), 150)}
                  placeholder="Descreva a infracção cometida pelo infractor"
                  rows={3}
                  autoComplete="off"
                  spellCheck={false}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                {showSugestoes && sugestoesFiltradas.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95">
                    <div className="px-3 py-2 border-b border-border bg-muted/40 flex items-center gap-2">
                      <Search className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Sugestões existentes ({sugestoesFiltradas.length})
                      </span>
                    </div>
                    <ul className="max-h-60 overflow-y-auto">
                      {sugestoesFiltradas.map((s) => {
                        const termo = form.infracao_tipo.trim();
                        const idx = s.tipo.toLowerCase().indexOf(termo.toLowerCase());
                        const antes = idx >= 0 ? s.tipo.slice(0, idx) : s.tipo;
                        const match = idx >= 0 ? s.tipo.slice(idx, idx + termo.length) : '';
                        const depois = idx >= 0 ? s.tipo.slice(idx + termo.length) : '';
                        return (
                          <li key={`${s.categoria}-${s.tipo}`}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => aplicarSugestao(s)}
                              className="w-full text-left px-3 py-2 hover:bg-accent flex items-center justify-between gap-3 transition-colors"
                            >
                              <span className="text-sm text-foreground flex-1 min-w-0 truncate">
                                {antes}<mark className="bg-primary/20 text-primary font-semibold rounded px-0.5">{match}</mark>{depois}
                              </span>
                              <span className="flex items-center gap-2 shrink-0">
                                <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4">
                                  {s.categoria === 'movel' ? 'Móvel' : 'Imóvel'}
                                </Badge>
                                <span className="text-xs font-mono font-bold text-primary">{s.valor.toFixed(2)} MT</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">Escreva livremente — as sugestões aparecem automaticamente. Se não houver correspondência, a descrição será guardada como nova sugestão após o registo.</p>
            </div>
            <div className="space-y-2">
              <Label>Valor da Multa (MT) *</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.valor || ''}
                onChange={(e) => setForm(prev => ({ ...prev, valor: parseFloat(e.target.value) || 0 }))}
                placeholder="Ex: 1500.00"
                required
              />
              <p className="text-[10px] text-muted-foreground">
                O valor é definido pelo agente, considerando a gravidade, circunstâncias e eventuais atenuantes.
              </p>
            </div>
          </Card>

          <Card className="p-4 space-y-4">
            <h3 className="font-semibold text-foreground text-sm">Localização</h3>
            <div className="space-y-2">
              <Label>Local da Infracção *</Label>
              <Input value={form.local} onChange={(e) => setForm(prev => ({ ...prev, local: e.target.value }))} placeholder="Av. 25 de Setembro, Matola" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Posto Administrativo</Label>
                <Input value={form.posto_administrativo} onChange={(e) => setForm(prev => ({ ...prev, posto_administrativo: e.target.value }))} placeholder="Ex: Machava" />
              </div>
              <div className="space-y-2"><Label>Quarteirão</Label>
                <Input value={form.local_quarteirao} onChange={(e) => setForm(prev => ({ ...prev, local_quarteirao: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2"><Label>Avenida / Rua</Label>
                <Input value={form.local_avenida} onChange={(e) => setForm(prev => ({ ...prev, local_avenida: e.target.value }))} />
              </div>
              <div className="space-y-2"><Label>Casa nº</Label>
                <Input value={form.local_casa} onChange={(e) => setForm(prev => ({ ...prev, local_casa: e.target.value }))} />
              </div>
            </div>
            <Button type="button" variant="outline" onClick={getLocation} className="w-full">
              <MapPin className="mr-2 h-4 w-4" />
              {location ? `GPS: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Capturar GPS'}
            </Button>
          </Card>

          <Card className="p-4 space-y-4">
            <h3 className="font-semibold text-foreground text-sm">Base Legal da Infracção <span className="text-[10px] text-muted-foreground font-normal">(opcional, mas necessário para preencher os autos oficiais)</span></h3>
            <div className="space-y-2"><Label>Legislação / Postura aplicável</Label>
              <Input value={form.legislacao} onChange={(e) => setForm(prev => ({ ...prev, legislacao: e.target.value }))} placeholder="Ex: Postura Municipal sobre Limpeza Urbana" />
            </div>
            <h4 className="text-xs font-semibold text-muted-foreground">Disposição transgredida</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Alínea</Label>
                <Input value={form.alinea_transgredida} onChange={(e) => setForm(prev => ({ ...prev, alinea_transgredida: e.target.value }))} placeholder="a" />
              </div>
              <div className="space-y-2"><Label>Nº</Label>
                <Input value={form.numero_transgredido} onChange={(e) => setForm(prev => ({ ...prev, numero_transgredido: e.target.value }))} placeholder="1" />
              </div>
              <div className="space-y-2"><Label>Artigo</Label>
                <Input value={form.artigo_transgredido} onChange={(e) => setForm(prev => ({ ...prev, artigo_transgredido: e.target.value }))} placeholder="12" />
              </div>
            </div>
            <h4 className="text-xs font-semibold text-muted-foreground">Disposição que pune</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Alínea</Label>
                <Input value={form.alinea_punicao} onChange={(e) => setForm(prev => ({ ...prev, alinea_punicao: e.target.value }))} placeholder="b" />
              </div>
              <div className="space-y-2"><Label>Nº</Label>
                <Input value={form.numero_punicao} onChange={(e) => setForm(prev => ({ ...prev, numero_punicao: e.target.value }))} placeholder="2" />
              </div>
              <div className="space-y-2"><Label>Artigo</Label>
                <Input value={form.artigo_punicao} onChange={(e) => setForm(prev => ({ ...prev, artigo_punicao: e.target.value }))} placeholder="25" />
              </div>
            </div>
            <div className="space-y-2"><Label>Valor por extenso</Label>
              <Input value={form.valor_extenso} onChange={(e) => setForm(prev => ({ ...prev, valor_extenso: e.target.value }))} placeholder="Ex: Mil e quinhentos meticais" />
            </div>
          </Card>

          <Card className="p-2">
            <p className="text-xs font-semibold text-foreground px-2 pt-1">Fotografias do local/objecto * (mínimo 2)</p>
            <PhotoCapture photos={photos} onPhotosChange={setPhotos} multaNumero={`MLT-${Date.now().toString(36).toUpperCase()}`} />
          </Card>

          <Card className="p-4 space-y-4">
            <h3 className="font-semibold text-foreground text-sm">Assinaturas digitais <span className="text-xs font-normal text-muted-foreground">(opcional)</span></h3>
            <p className="text-[11px] text-muted-foreground">
              As assinaturas digitais são facultativas. Caso não seja possível assinar no sistema, imprima o Auto de Notícia e o Aviso de Multa e recolha as assinaturas em papel.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SignaturePad label="Assinatura do infractor" value={assinaturaInfrator} onChange={setAssinaturaInfrator} />
              <SignaturePad label="Assinatura do agente" value={assinaturaAgente} onChange={setAssinaturaAgente} />
            </div>
            <p className="text-[10px] text-muted-foreground">Quando preenchidas, as assinaturas ficam anexadas ao Auto de Notícia e ao Aviso de Multa. Se ficarem em branco, os documentos são impressos com linhas para assinatura manual.</p>
          </Card>

          <Card className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm(prev => ({ ...prev, observacoes: e.target.value }))} placeholder="Notas adicionais..." rows={3} />
            </div>
          </Card>

          <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
            {loading ? <Loader2 className="animate-spin mr-2" /> : null}
            Registar Multa
          </Button>
        </form>
      </Tabs>
    </ScrollArea>
  );

  // Detail dialog
  const renderDetail = () => {
    if (!detailMulta) return null;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Número:</span><p className="font-mono font-bold">{detailMulta.numero}</p></div>
          <div><span className="text-muted-foreground">Auto de Notícia:</span><p className="font-mono font-bold">{detailMulta.numero_auto || '—'}</p></div>
          {detailMulta.numero_processo && (
            <div><span className="text-muted-foreground">Nº Processo:</span><p className="font-mono font-bold">{detailMulta.numero_processo}</p></div>
          )}
          <div><span className="text-muted-foreground">Status:</span><div className="pt-0.5"><Badge className={statusColor(detailMulta.status)}>{detailMulta.status?.toUpperCase()}</Badge></div></div>
          <div><span className="text-muted-foreground">Infrator:</span><p className="font-semibold">{detailMulta.infrator_nome}</p></div>
          <div><span className="text-muted-foreground">Documento:</span><p>{detailMulta.infrator_documento || '—'}</p></div>
          <div><span className="text-muted-foreground">{(detailMulta.categoria === 'imovel' || detailMulta.observacoes?.includes('[IMÓVEL]')) ? 'Nº Porta / Talhão:' : 'Matrícula:'}</span><p>{detailMulta.matricula || '—'}</p></div>
          <div><span className="text-muted-foreground">Infracção:</span><p>{detailMulta.infracao_tipo}</p></div>
          <div><span className="text-muted-foreground">Local:</span><p>{detailMulta.local}</p></div>
          <div><span className="text-muted-foreground">Valor:</span><p className="font-bold text-primary">{Number(detailMulta.valor).toFixed(2)} MT</p></div>
          {detailMulta.categoria === 'imovel' && (
            <>
              {detailMulta.dimensoes && <div><span className="text-muted-foreground">Dimensões:</span><p>{detailMulta.dimensoes}</p></div>}
              {detailMulta.estagio_obra && <div><span className="text-muted-foreground">Estágio da Obra:</span><p>{detailMulta.estagio_obra}</p></div>}
              {detailMulta.descricao_imovel && <div className="col-span-2"><span className="text-muted-foreground">Descrição:</span><p className="text-xs">{detailMulta.descricao_imovel}</p></div>}
            </>
          )}
          <div className="col-span-2"><span className="text-muted-foreground">Data:</span><p>{formatDateSafe(detailMulta.created_at, 'dd/MM/yyyy HH:mm')}</p></div>
          {detailMulta.observacoes && (
            <div className="col-span-2"><span className="text-muted-foreground">Observações:</span><p className="text-xs">{detailMulta.observacoes}</p></div>
          )}
        </div>
        {/* Document actions: Auto+Aviso, Imprimir Factura/Recibo, Baixar, Partilhar */}
        <DocumentActions
          document={buildDocumentData(
            detailMulta,
            detailMulta.status === 'paga' ? 'recibo' : 'factura',
            detailMulta.agente_nome || user?.email
          )}
        />

        {/* Email Notification in Detail Modal */}
        <Card className="p-3 border-primary/20 bg-muted/30 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Mail className="h-3.5 w-3.5 text-primary" />
            <span>Notificação Oficial por Email</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {detailMulta.infrator_email 
              ? `Email registado: ${detailMulta.infrator_email}`
              : 'Introduza o email do munícipe para enviar o auto e aviso de multa:'}
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder={detailMulta.infrator_email || 'cidadao@exemplo.com'}
              value={detailEmailDest}
              onChange={(e) => setDetailEmailDest(e.target.value)}
              className="h-8 text-xs bg-background"
            />
            <Button
              size="sm"
              className="h-8 gap-1 text-xs shrink-0"
              disabled={sendingDetailEmail}
              onClick={async () => {
                const target = detailEmailDest.trim() || detailMulta.infrator_email?.trim();
                if (!target || !target.includes('@')) {
                  toast.error(lang === 'en' ? 'Enter a valid email' : 'Introduza um email válido');
                  return;
                }
                setSendingDetailEmail(true);
                const res = await sendFineNoticeEmail({
                  to: target,
                  infratorNome: detailMulta.infrator_nome,
                  numeroAuto: detailMulta.numero_auto || detailMulta.numero,
                  numeroMulta: detailMulta.numero,
                  infracaoTipo: detailMulta.infracao_tipo,
                  valor: Number(detailMulta.valor),
                  local: detailMulta.local,
                  matriculaOuPorta: detailMulta.matricula,
                  categoria: detailMulta.categoria || 'movel',
                  agenteNome: detailMulta.agente_nome || user?.email,
                  dataHora: formatDateSafe(detailMulta.created_at, 'dd/MM/yyyy HH:mm'),
                });
                setSendingDetailEmail(false);
                if (res.success) {
                  toast.success(
                    lang === 'en'
                      ? `Fine notice emailed to ${target}!`
                      : `Aviso oficial de multa enviado por email para ${target}!`
                  );
                  setDetailEmailDest('');
                } else {
                  toast.error(res.error || (lang === 'en' ? 'Failed to send email' : 'Falha ao enviar email'));
                }
              }}
            >
              {sendingDetailEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {lang === 'en' ? 'Send Email' : 'Enviar Email'}
            </Button>
          </div>
        </Card>

        {canSendTribunal && (detailMulta.status === 'pendente' || detailMulta.status === 'fora_prazo') && (
          <Button
            variant="outline"
            className="w-full gap-2 border-purple-300 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40"
            onClick={() => { setTribunalNome(''); setTribunalOpen(true); }}
          >
            <Gavel className="h-4 w-4" /> Enviar ao Tribunal
          </Button>
        )}
        {detailMulta.status === 'enviada_tribunal' && (
          <Card className="p-3 bg-purple-500/10 text-center border border-purple-200">
            <p className="text-xs font-semibold text-purple-700 flex items-center justify-center gap-1">
              <Gavel className="h-3 w-3" /> Enviado ao Tribunal{detailMulta.tribunal_nome ? ` — ${detailMulta.tribunal_nome}` : ''}
            </p>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Banner de Sincronização Offline */}
      {pending > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-200">
          <div className="flex items-center gap-2.5 text-xs font-medium">
            <CloudOff className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              {pending === 1
                ? 'Existe 1 multa registada offline pendente de sincronização.'
                : `Existem ${pending} multas registadas offline pendentes de sincronização.`}
              {online ? ' O dispositivo está online e o sistema sincronizará automaticamente.' : ' O sistema sincronizará automaticamente assim que houver rede.'}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => sync()}
            disabled={!online || syncing}
            className="h-8 text-xs gap-1.5 border-amber-500/40 bg-background/80 hover:bg-amber-500/20 shrink-0 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'A sincronizar...' : 'Sincronizar Agora'}
          </Button>
        </div>
      )}

      {/* Header with search, count and new button */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar multas (nº, nome, matrícula, infracção...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => loadMultas()}
            className="h-10 w-10 shrink-0"
            title="Actualizar lista"
          >
            <RefreshCw className={`h-4 w-4 ${loadingList ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <Button onClick={handleOpenNew} className="gap-2 whitespace-nowrap">
          <PlusCircle className="h-4 w-4" />
          Nova Multa
        </Button>
      </div>

      {/* Multas list */}
      <div className="space-y-3">
        {loadingList ? (
          <Card className="flex items-center justify-center p-8">
            <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="text-center p-8 text-muted-foreground text-sm">
            {searchTerm ? 'Nenhuma multa encontrada para esta pesquisa.' : 'Nenhuma multa registada ainda.'}
          </Card>
        ) : (
          <>
            {/* Mobile Card List (sm / mobile phones) */}
            <div className="space-y-2.5 md:hidden">
              {filtered.map((m) => (
                <Card
                  key={m.id || m.numero}
                  className="p-3.5 space-y-2 cursor-pointer hover:border-primary/50 active:scale-[0.99] transition-all bg-card/95 shadow-sm"
                  onClick={() => setDetailMulta(m)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-foreground bg-muted px-1.5 py-0.5 rounded">
                          {m.numero || '—'}
                        </span>
                        {m.matricula && (
                          <span className="font-mono text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded">
                            {m.matricula}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground truncate mt-1">
                        {m.infrator_nome || 'Infractor não identificado'}
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${statusColor(m.status)}`}>
                      {m.status === 'offline_pendente' || m.isOfflineQueue ? 'OFFLINE' : (m.status || 'PENDENTE').toUpperCase()}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                    <span className="truncate max-w-[190px]">{m.infracao_tipo || '—'}</span>
                    <span className="font-bold text-foreground text-sm">{Number(m.valor || 0).toFixed(2)} MT</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 border-t border-border/50 pt-1.5">
                    <span className="truncate max-w-[160px] flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" /> {m.local || '—'}
                    </span>
                    <span>{formatDateSafe(m.created_at, 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop Table View (tablets & desktop) */}
            <Card className="hidden md:block overflow-hidden">
              <div className="w-full overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
                <Table className="min-w-[1100px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Número</TableHead>
                      <TableHead className="text-xs">Infrator</TableHead>
                      <TableHead className="text-xs">Infracção</TableHead>
                      <TableHead className="text-xs">Local</TableHead>
                      <TableHead className="text-xs">Valor (MT)</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Tribunal</TableHead>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((m) => (
                      <TableRow key={m.id || m.numero} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailMulta(m)}>
                        <TableCell className="font-mono text-xs font-semibold">{m.numero || '—'}</TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">{m.infrator_nome || '—'}</TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate">{m.infracao_tipo || '—'}</TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">{m.local || '—'}</TableCell>
                        <TableCell className="text-xs font-semibold">{Number(m.valor || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${statusColor(m.status)}`}>
                            {m.status === 'offline_pendente' || m.isOfflineQueue ? 'OFFLINE (PENDENTE)' : (m.status || 'PENDENTE').toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[140px] truncate">
                          {m.status === 'enviada_tribunal' ? (
                            <span className="inline-flex items-center gap-1 text-purple-700">
                              <Gavel className="h-3 w-3" /> {m.tribunal_nome || '—'}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{formatDateSafe(m.created_at, 'dd/MM/yy')}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDetailMulta(m); }}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* New Multa Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" />
              {success ? 'Multa Registada' : 'Nova Multa'}
            </DialogTitle>
          </DialogHeader>
          {success ? renderSuccess() : renderForm()}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailMulta} onOpenChange={(open) => { if (!open) setDetailMulta(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Detalhes da Multa
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-4 flex-1">
            {renderDetail()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Enviar ao Tribunal */}
      <Dialog open={tribunalOpen} onOpenChange={setTribunalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700">
              <Gavel className="h-5 w-5" /> Enviar ao Tribunal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Card className="p-3 bg-muted/40">
              <p className="text-sm font-semibold">{detailMulta?.infrator_nome}</p>
              <p className="text-xs text-muted-foreground">{detailMulta?.infracao_tipo}</p>
              <p className="text-sm font-bold mt-1">{detailMulta && Number(detailMulta.valor).toFixed(2)} MT</p>
            </Card>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Nome do Tribunal *</Label>
              <Input value={tribunalNome} onChange={(e) => setTribunalNome(e.target.value)} placeholder="Ex: Tribunal Judicial da Matola" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTribunalOpen(false)}>Cancelar</Button>
            <Button
              className="gap-2 bg-purple-600 hover:bg-purple-700"
              disabled={enviandoTribunal}
              onClick={async () => {
                if (!tribunalNome.trim()) { toast.error('Introduza o nome do Tribunal'); return; }
                if (!detailMulta) return;
                setEnviandoTribunal(true);
                const { error } = await supabase.from('multas').update({
                  status: 'enviada_tribunal', tribunal_nome: tribunalNome.trim(),
                } as any).eq('id', detailMulta.id);
                if (error) { toast.error('Erro: ' + error.message); setEnviandoTribunal(false); return; }
                await supabase.from('audit_log').insert({
                  action: 'ENVIAR_TRIBUNAL', resource_id: detailMulta.id, user_id: user?.id,
                  details: `Multa ${detailMulta.numero} (Auto ${detailMulta.numero_auto || '—'}) enviada ao ${tribunalNome.trim()}`,
                });
                toast.success('Multa enviada ao tribunal');
                setEnviandoTribunal(false);
                setTribunalOpen(false);
                setDetailMulta(null);
                loadMultas();
              }}
            >
              {enviandoTribunal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Encaminhar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
