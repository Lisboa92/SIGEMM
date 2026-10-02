import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PasswordResetRequests from '@/components/PasswordResetRequests';
import CancelRequestDialog from '@/components/CancelRequestDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Search, FileText, XCircle, BarChart3, TrendingUp, Users, Ban, Plus, Pencil, Trash2, UserCheck, UserX, Download, Upload, Filter, ShieldAlert, Loader2, KeyRound, Eye, EyeOff, Database, Camera, ImageIcon, Mail, Send, CheckCircle2, DatabaseBackup, BookOpen, Printer } from 'lucide-react';
import logoMatola from '@/assets/logo-matola.png';
import DatabaseBackupReset from '@/components/DatabaseBackupReset';
import PrinterSelectDialog from '@/components/PrinterSelectDialog';
import { type ReportPrintData } from '@/lib/printService';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { sendCredentialsEmail, sendPasswordResetEmail } from '@/lib/emailService';

interface Multa {
  id: string;
  numero: string;
  infrator_nome: string;
  infrator_documento: string | null;
  matricula: string | null;
  infracao_tipo: string;
  valor: number;
  local: string;
  status: string;
  agente_email: string | null;
  created_at: string;
  observacoes: string | null;
}

interface Agente {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  numero_agente: string;
  cargo: string;
  activo: boolean;
  created_at: string;
}

const emptyAgente = { nome: '', email: '', telefone: '', numero_agente: '', cargo: 'agente', local_trabalho: 'via_publica', nivel_acesso: 'agente_campo', senha: '', confirmarSenha: '', username: '', newPassword: '', confirmNewPassword: '', foto_url: '' };

function generateUsernameSuggestions(nome: string): string[] {
  if (!nome.trim()) return [];
  const clean = nome.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '');
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [];
  const suggestions = new Set<string>();
  if (parts.length >= 2) {
    suggestions.add(`${parts[0]}.${parts[parts.length - 1]}`);
    if (parts.length >= 3) suggestions.add(`${parts[0]}.${parts[1]}`);
    if (parts.length >= 3) suggestions.add(`${parts[0]}.${parts[1]}.${parts[parts.length - 1]}`);
  }
  suggestions.add(parts.join('.'));
  if (parts.length >= 2) suggestions.add(`${parts[0][0]}.${parts[parts.length - 1]}`);
  if (parts.length >= 2) suggestions.add(`${parts[0]}.${parts[parts.length - 1][0]}`);
  return Array.from(suggestions).slice(0, 5);
}

export default function AdminPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('multas');

  // Multas state
  const [multas, setMultas] = useState<Multa[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Pedido de cancelamento (autorizado pelo Presidente do Município)
  const [cancelMulta, setCancelMulta] = useState<Multa | null>(null);

  // Filter multas state
  const [filterType, setFilterType] = useState('');
  const [filterValue, setFilterValue] = useState('');

  // Agentes state
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [agentesLoading, setAgentesLoading] = useState(true);
  const [agentSearch, setAgentSearch] = useState('');
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agente | null>(null);
  const [deleteAgentId, setDeleteAgentId] = useState<string | null>(null);
  const [agentForm, setAgentForm] = useState(emptyAgente);
  const [savingAgent, setSavingAgent] = useState(false);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [usernameAvailability, setUsernameAvailability] = useState<Record<string, boolean | null>>({});
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Created credentials dialog
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{nome: string; username: string; email: string; password: string} | null>(null);
  const [sendingCredentialsEmail, setSendingCredentialsEmail] = useState(false);
  const [credentialsEmailSent, setCredentialsEmailSent] = useState(false);

  // Handle URL query params (?tab=agentes or ?agentSearch=...)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'dados' || tab === 'backup') {
      setActiveTab('backup');
    } else if (tab) {
      setActiveTab(tab);
    }
    const agentQuery = searchParams.get('agentSearch') || searchParams.get('agentEmail') || searchParams.get('agent');
    if (agentQuery) {
      setActiveTab('agentes');
      setAgentSearch(agentQuery);
    }
    if (tab || agentQuery) {
      searchParams.delete('tab');
      searchParams.delete('agentSearch');
      searchParams.delete('agentEmail');
      searchParams.delete('agent');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Check username availability when suggestions change
  async function checkUsernames(suggestions: string[]) {
    if (suggestions.length === 0) return;
    setCheckingUsername(true);
    const availability: Record<string, boolean | null> = {};
    const { data } = await supabase.from('agentes').select('username').in('username', suggestions);
    const taken = new Set((data || []).map((d: any) => d.username));
    suggestions.forEach(s => { availability[s] = !taken.has(s); });
    setUsernameAvailability(availability);
    setCheckingUsername(false);
  }

  const loadMultas = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('multas').select('*').order('created_at', { ascending: false });
    if (statusFilter !== 'todos') query = query.eq('status', statusFilter);
    const { data } = await query;
    setMultas((data as Multa[]) ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { loadMultas(); }, [loadMultas]);
  useEffect(() => { loadAgentes(); }, []);

  async function toggleAgenteActivo(id: string, activo: boolean) {
    const target = agentes.find(a => a.id === id);
    if (
      (target as any)?.nivel_acesso === 'superadmin' ||
      (target as any)?.username === 'lisboa.cossa' ||
      target?.email === 'lisboacossa@gmail.com'
    ) {
      toast.error('O SuperAdmin Supremo (Lisboa Cossa) não pode ser desactivado.');
      return;
    }
    const { error } = await supabase.from('agentes').update({ activo: !activo }).eq('id', id);
    if (error) { toast.error('Erro ao actualizar o utilizador'); return; }
    toast.success(activo ? 'Utilizador desactivado' : 'Utilizador activado');
    loadAgentes();
  }

  // Filter logic
  const filtered = useMemo(() => {
    let result = multas.filter(m =>
      m.infrator_nome?.toLowerCase().includes(search.toLowerCase()) ||
      m.matricula?.toLowerCase().includes(search.toLowerCase()) ||
      m.numero?.toLowerCase().includes(search.toLowerCase()) ||
      m.agente_email?.toLowerCase().includes(search.toLowerCase())
    );

    if (filterType && filterValue.trim()) {
      const val = filterValue.toLowerCase().trim();
      if (filterType === 'agente') {
        result = result.filter(m => m.agente_email?.toLowerCase().includes(val));
      } else if (filterType === 'regiao') {
        result = result.filter(m => m.local?.toLowerCase().includes(val));
      } else if (filterType === 'tipo') {
        result = result.filter(m => m.infracao_tipo?.toLowerCase().includes(val));
      }
    }

    return result;
  }, [multas, search, filterType, filterValue]);

  // --- Agentes ---
  async function loadAgentes() {
    setAgentesLoading(true);
    const { data } = await supabase.from('agentes').select('*').order('nome');
    setAgentes((data as Agente[]) ?? []);
    setAgentesLoading(false);
  }

  function openNewAgent() {
    setEditingAgent(null);
    setAgentForm(emptyAgente);
    setShowAgentForm(true);
  }

  function openEditAgent(agent: Agente) {
    setEditingAgent(agent);
    setAgentForm({
      nome: agent.nome, email: agent.email, telefone: agent.telefone || '',
      numero_agente: agent.numero_agente, cargo: agent.cargo,
      local_trabalho: (agent as any).local_trabalho || 'via_publica',
      nivel_acesso: (agent as any).nivel_acesso || 'agente_campo',
      senha: '', confirmarSenha: '', username: (agent as any).username || '',
      newPassword: '', confirmNewPassword: '', foto_url: (agent as any).foto_url || '',
    });
    setShowAgentForm(true);
  }

  async function saveAgent() {
    if (!agentForm.nome.trim() || !agentForm.email.trim() || !agentForm.numero_agente.trim()) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    // Validate username for new agents
    if (!editingAgent && !agentForm.username.trim()) {
      toast.error('Seleccione um nome de utilizador');
      return;
    }

    // Check if username is available
    if (!editingAgent && agentForm.username.trim()) {
      const { data: existing } = await supabase.from('agentes').select('id').eq('username', agentForm.username.trim()).maybeSingle();
      if (existing) {
        toast.error('Este nome de utilizador já existe. Escolha outro.');
        return;
      }
    }

    setSavingAgent(true);
    const payload: any = {
      nome: agentForm.nome.trim(), email: agentForm.email.trim(),
      telefone: agentForm.telefone.trim() || null, numero_agente: agentForm.numero_agente.trim(),
      cargo: agentForm.cargo, local_trabalho: agentForm.local_trabalho, nivel_acesso: agentForm.nivel_acesso,
      foto_url: agentForm.foto_url || null,
    };
    if (!editingAgent && agentForm.username.trim()) {
      payload.username = agentForm.username.trim();
    }

    if (editingAgent) {
      const { error } = await supabase.from('agentes').update(payload).eq('id', editingAgent.id);
      if (error) { toast.error('Erro: ' + error.message); setSavingAgent(false); return; }

      // Reset password if provided
      if (agentForm.newPassword.trim()) {
        if (agentForm.newPassword !== agentForm.confirmNewPassword) {
          toast.error('As novas senhas não coincidem');
          setSavingAgent(false);
          return;
        }
        if (agentForm.newPassword.length < 8) {
          toast.error('A senha deve ter pelo menos 8 caracteres');
          setSavingAgent(false);
          return;
        }
        const { data: resetData, error: resetError } = await supabase.functions.invoke('reset-agent-password', {
          body: { email: editingAgent.email, new_password: agentForm.newPassword },
        });
        if (resetError || resetData?.error) {
          toast.error('Erro ao redefinir senha: ' + (resetData?.error || resetError?.message));
          setSavingAgent(false);
          return;
        }

        // Notify user via email
        sendPasswordResetEmail({
          to: editingAgent.email,
          nome: editingAgent.nome,
          tempPassword: agentForm.newPassword,
        }).then((res) => {
          if (res.success) {
            toast.success(`Notificação de nova senha enviada para ${editingAgent.email}`);
          } else {
            toast.warning(`Senha alterada, mas o envio de email falhou: ${res.error}`);
          }
        });

        toast.success('Senha do agente redefinida. Ele deverá trocá-la no próximo login.');
      }

      await supabase.from('audit_log').insert({
        action: 'actualizar_agente', resource_id: editingAgent.id, user_id: user?.id,
        details: `Agente ${payload.nome} actualizado por ${user?.email}`,
      });
      toast.success('Agente actualizado');
    } else {
      // Create auth user via edge function (generates random password)
      const { data: fnData, error: fnError } = await supabase.functions.invoke('create-agent-user', {
        body: { email: agentForm.email.trim(), nome: agentForm.nome.trim(), username: agentForm.username.trim(), systemUrl: window.location.origin },
      });

      if (fnError || fnData?.error) {
        toast.error('Erro ao criar utilizador: ' + (fnData?.error || fnError?.message));
        setSavingAgent(false);
        return;
      }

      const { error } = await supabase.from('agentes').insert(payload);
      if (error) { toast.error('Erro: ' + error.message); setSavingAgent(false); return; }
      await supabase.from('audit_log').insert({
        action: 'criar_agente', user_id: user?.id,
        details: `Agente ${payload.nome} criado por ${user?.email}`,
      });

      const generatedPassword = fnData?.generated_password || '';
      
      // Auto-dispatch credentials email
      setCredentialsEmailSent(false);
      sendCredentialsEmail({
        to: agentForm.email.trim(),
        nome: agentForm.nome.trim(),
        username: agentForm.username.trim(),
        password: generatedPassword,
      }).then((res) => {
        if (res.success) {
          setCredentialsEmailSent(true);
          toast.success(`Credenciais de acesso enviadas para ${agentForm.email.trim()}`);
        } else {
          toast.warning(`Conta criada, mas falhou o envio de credenciais por email: ${res.error}`);
        }
      });

      // Show credential dialog
      setCreatedCredentials({
        nome: agentForm.nome.trim(),
        username: agentForm.username.trim(),
        email: agentForm.email.trim(),
        password: generatedPassword,
      });
      setShowCredentialsDialog(true);
    }

    setSavingAgent(false);
    setShowAgentForm(false);
    loadAgentes();
  }

  async function deleteAgent(id: string) {
    const agent = agentes.find(a => a.id === id);
    if (
      (agent as any)?.nivel_acesso === 'superadmin' ||
      (agent as any)?.username === 'lisboa.cossa' ||
      agent?.email === 'lisboacossa@gmail.com'
    ) {
      toast.error('O SuperAdmin Supremo (Lisboa Cossa) não pode ser excluído.');
      setDeleteAgentId(null);
      return;
    }
    const { error } = await supabase.from('agentes').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir agente'); return; }
    await supabase.from('audit_log').insert({
      action: 'excluir_agente', resource_id: id, user_id: user?.id,
      details: `Agente ${agent?.nome} excluído por ${user?.email}`,
    });
    toast.success('Agente excluído');
    setDeleteAgentId(null);
    loadAgentes();
  }

  const filteredAgentes = agentes.filter(a =>
    a.nome.toLowerCase().includes(agentSearch.toLowerCase()) ||
    a.email.toLowerCase().includes(agentSearch.toLowerCase()) ||
    a.numero_agente.toLowerCase().includes(agentSearch.toLowerCase())
  );

  // --- Reports ---
  const reports = useMemo(() => {
    const total = multas.length;
    const pendentes = multas.filter(m => m.status === 'pendente').length;
    const pagas = multas.filter(m => m.status === 'paga').length;
    const canceladas = multas.filter(m => m.status === 'cancelada').length;
    const valorTotal = multas.reduce((sum, m) => sum + Number(m.valor), 0);
    const valorPago = multas.filter(m => m.status === 'paga').reduce((sum, m) => sum + Number(m.valor), 0);
    const valorPendente = multas.filter(m => m.status === 'pendente').reduce((sum, m) => sum + Number(m.valor), 0);

    const byType: Record<string, { count: number; valor: number }> = {};
    multas.forEach(m => {
      if (!byType[m.infracao_tipo]) byType[m.infracao_tipo] = { count: 0, valor: 0 };
      byType[m.infracao_tipo].count++;
      byType[m.infracao_tipo].valor += Number(m.valor);
    });

    const byAgent: Record<string, number> = {};
    multas.forEach(m => {
      const agent = m.agente_email || 'Desconhecido';
      byAgent[agent] = (byAgent[agent] || 0) + 1;
    });

    const byMonth: Record<string, { count: number; valor: number }> = {};
    multas.forEach(m => {
      const month = new Date(m.created_at).toLocaleDateString('pt-MZ', { year: 'numeric', month: 'short' });
      if (!byMonth[month]) byMonth[month] = { count: 0, valor: 0 };
      byMonth[month].count++;
      byMonth[month].valor += Number(m.valor);
    });

    return { total, pendentes, pagas, canceladas, valorTotal, valorPago, valorPendente, byType, byAgent, byMonth };
  }, [multas]);

  async function exportPDF() {
    const doc = new jsPDF();

    // Add logo
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          canvas.getContext('2d')?.drawImage(img, 0, 0);
          const base64 = canvas.toDataURL('image/png');
          doc.addImage(base64, 'PNG', 14, 8, 18, 18);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = logoMatola;
      });
    } catch {}

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('CONSELHO MUNICIPAL DA MATOLA', 36, 16);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('SIGEMM - Relatório de Multas', 36, 22);
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-MZ')} às ${new Date().toLocaleTimeString('pt-MZ')}`, 36, 27);
    doc.text(`Total: ${reports.total} | Pagas: ${reports.pagas} | Pendentes: ${reports.pendentes} | Canceladas: ${reports.canceladas}`, 14, 34);

    const rows = multas.map(m => [
      m.numero, m.infrator_nome, m.infracao_tipo, m.local,
      Number(m.valor).toFixed(2) + ' MT', m.status, m.agente_email || '—',
      new Date(m.created_at).toLocaleDateString('pt-MZ'),
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Nº', 'Infrator', 'Infracção', 'Local', 'Valor', 'Estado', 'Agente', 'Data']],
      body: rows,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [30, 100, 180] },
      didDrawPage: (data: any) => {
        const pageCount = doc.getNumberOfPages();
        const pageNum = data.pageNumber || 1;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Página ${pageNum} de ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
        doc.text('Conselho Municipal da Matola — SIGEMM', 14, doc.internal.pageSize.getHeight() - 10);
      },
    });

    // Update page count on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Página ${i} de ${totalPages}`,
        doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    doc.save(`multas_relatorio_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF exportado');
  }

  function exportExcel() {
    const data = multas.map(m => ({
      'Número': m.numero, 'Infrator': m.infrator_nome, 'Documento': m.infrator_documento || '',
      'Matrícula': m.matricula || '', 'Infracção': m.infracao_tipo, 'Valor (MT)': Number(m.valor),
      'Local': m.local, 'Estado': m.status, 'Agente': m.agente_email || '',
      'Data': new Date(m.created_at).toLocaleDateString('pt-MZ'),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Multas');
    XLSX.writeFile(wb, `multas_relatorio_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel exportado');
  }

  const [reportPrintOpen, setReportPrintOpen] = useState(false);
  const [reportPrintData, setReportPrintData] = useState<ReportPrintData | undefined>(undefined);

  function handlePrintReport() {
    const data: ReportPrintData = {
      titulo: 'Relatório Geral de Multas e Cobranças',
      subtitulo: 'Conselho Municipal da Matola — Comando da Polícia Municipal',
      periodo: 'Histórico Completo',
      geradoPor: user?.email || 'Administrador',
      resumo: [
        { label: 'Total de Multas', valor: reports.total },
        { label: 'Valor Total', valor: `${reports.valorTotal.toFixed(2)} MT` },
        { label: 'Total Cobrado', valor: `${reports.valorPago.toFixed(2)} MT` },
        { label: 'Total Pendente', valor: `${reports.valorPendente.toFixed(2)} MT` },
        { label: 'Multas Pagas', valor: reports.pagas },
        { label: 'Multas Pendentes', valor: reports.pendentes },
      ],
      colunas: ['Nº Multa', 'Infractor', 'Infracção', 'Local', 'Valor (MT)', 'Estado', 'Agente', 'Data'],
      linhas: multas.slice(0, 200).map(m => [
        m.numero,
        m.infrator_nome,
        m.infracao_tipo,
        m.local,
        Number(m.valor).toFixed(2),
        m.status.toUpperCase(),
        m.agente_email || '—',
        new Date(m.created_at).toLocaleDateString('pt-MZ'),
      ]),
    };
    setReportPrintData(data);
    setReportPrintOpen(true);
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-5 h-11">
          <TabsTrigger value="multas" className="gap-1 text-xs">
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Multas</span>
          </TabsTrigger>
          <TabsTrigger value="filtros" className="gap-1 text-xs">
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filtrar</span>
          </TabsTrigger>
          <TabsTrigger value="agentes" className="gap-1 text-xs">
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Usuários</span>
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1 text-xs">
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Relatórios</span>
          </TabsTrigger>
          <TabsTrigger value="backup" className="gap-1 text-xs">
            <DatabaseBackup className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Backup e Manuais</span>
          </TabsTrigger>
        </TabsList>

        {/* MULTAS TAB */}
        <TabsContent value="multas" className="space-y-3 mt-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Nome, matrícula, nº ou agente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="paga">Paga</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
                <SelectItem value="fora_prazo">Fora do Prazo</SelectItem>
                <SelectItem value="enviada_tribunal">Enviada ao Tribunal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">{filtered.length} multas encontradas</p>
          <div className="space-y-2">
            {loading ? (
              <Card className="p-8 text-center text-muted-foreground">Carregando...</Card>
            ) : filtered.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Nenhuma multa encontrada.
              </Card>
            ) : (
              filtered.map((multa) => (
                <Card key={multa.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">{multa.infrator_nome}</p>
                      <p className="text-xs font-mono text-muted-foreground">{multa.numero}</p>
                    </div>
                    <span className={`status-badge flex-shrink-0 ${multa.status === 'paga' ? 'status-paid' : multa.status === 'pendente' ? 'status-pending' : 'status-cancelled'}`}>
                      {multa.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <span>{multa.infracao_tipo}</span>
                    <span className="text-right font-semibold text-foreground">{Number(multa.valor).toFixed(2)} MT</span>
                    <span>{multa.local}</span>
                    <span className="text-right">{new Date(multa.created_at).toLocaleDateString('pt-MZ')}</span>
                    <span>Agente: {multa.agente_email || '—'}</span>
                  </div>
                  {multa.status === 'pendente' && (
                    <Button variant="destructive" size="sm" className="w-full mt-1 gap-1.5" onClick={() => setCancelMulta(multa)}>
                      <XCircle className="w-3.5 h-3.5" />
                      Solicitar Cancelamento
                    </Button>
                  )}
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* FILTROS TAB */}
        <TabsContent value="filtros" className="space-y-4 mt-3">
          <Card className="p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              Filtrar Multas
            </h3>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Filtrar por</Label>
                <Select value={filterType} onValueChange={(v) => { setFilterType(v); setFilterValue(''); }}>
                  <SelectTrigger><SelectValue placeholder="Seleccione o tipo de filtro" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agente">Multas por Agente</SelectItem>
                    <SelectItem value="regiao">Multas por Região</SelectItem>
                    <SelectItem value="tipo">Multas por Tipo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {filterType && (
                <div className="space-y-2 animate-fade-in">
                  <Label className="text-xs font-semibold">
                    {filterType === 'agente' ? 'Nome/Email do Agente' : filterType === 'regiao' ? 'Nome da Região/Local' : 'Tipo de Infracção'}
                  </Label>
                  <Input
                    placeholder={filterType === 'agente' ? 'Ex: joao@cmm.gov.mz' : filterType === 'regiao' ? 'Ex: Machava' : 'Ex: Estacionamento'}
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Filtered Results */}
          <p className="text-xs text-muted-foreground">{filtered.length} resultados encontrados</p>
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Nenhum resultado para o filtro aplicado.
              </Card>
            ) : (
              filtered.map((multa) => (
                <Card key={multa.id} className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground truncate">{multa.infrator_nome}</p>
                    <span className={`status-badge text-[10px] ${multa.status === 'paga' ? 'status-paid' : multa.status === 'pendente' ? 'status-pending' : 'status-cancelled'}`}>
                      {multa.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                    <span className="truncate">{multa.infracao_tipo}</span>
                    <span className="text-center truncate">{multa.local}</span>
                    <span className="text-right font-semibold text-foreground">{Number(multa.valor).toFixed(2)} MT</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Agente: {multa.agente_email || '—'} • {new Date(multa.created_at).toLocaleDateString('pt-MZ')}</p>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* AGENTES TAB */}
        <TabsContent value="agentes" className="space-y-3 mt-3">
          <PasswordResetRequests />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Pesquisar agente..." value={agentSearch} onChange={(e) => setAgentSearch(e.target.value)} className="pl-9" />
            </div>
            <Button onClick={openNewAgent} className="gap-1.5 flex-shrink-0">
              <Plus className="w-4 h-4" />
              Novo
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{filteredAgentes.length} agentes</p>
          <div className="space-y-2">
            {agentesLoading ? (
              <Card className="p-8 text-center text-muted-foreground">Carregando...</Card>
            ) : filteredAgentes.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Nenhum agente encontrado.
              </Card>
            ) : (
              filteredAgentes.map((agent) => (
                <Card key={agent.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {(agent as any).foto_url ? (
                          <img src={(agent as any).foto_url} alt={agent.nome} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-primary">{agent.nome[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground">{agent.nome}</p>
                          {agent.activo ? (
                            <span className="status-badge status-paid text-[10px]"><UserCheck className="w-3 h-3" /> Activo</span>
                          ) : (
                            <span className="status-badge status-cancelled text-[10px]"><UserX className="w-3 h-3" /> Inactivo</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">👤 {(agent as any).username || '—'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <span>Nº: {agent.numero_agente}</span>
                    <span className="text-right font-medium">{agent.cargo}</span>
                    <span>{(agent as any).local_trabalho === 'via_publica' ? '🚦 Via Pública' : `🏢 ${(agent as any).local_trabalho}`}</span>
                    <span className="text-right">
                      {(agent as any).nivel_acesso === 'superadmin' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded text-[11px]">
                          👑 SuperAdmin
                        </span>
                      ) : (agent as any).nivel_acesso === 'presidente' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded text-[11px]">
                          🏛️ Presidente
                        </span>
                      ) : (
                        (agent as any).nivel_acesso || 'agente_campo'
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
                    <span className="text-xs text-muted-foreground">
                      {(agent as any).nivel_acesso === 'superadmin'
                        ? 'SuperAdmin (Sempre Activo)'
                        : agent.activo ? 'Utilizador activo' : 'Utilizador inactivo'}
                    </span>
                    <Switch
                      checked={agent.activo}
                      disabled={(agent as any).nivel_acesso === 'superadmin' || (agent as any).username === 'lisboa.cossa'}
                      onCheckedChange={() => toggleAgenteActivo(agent.id, agent.activo)}
                    />
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => openEditAgent(agent)}>
                      <Pencil className="w-3 h-3" /> Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1 gap-1"
                      disabled={(agent as any).nivel_acesso === 'superadmin' || (agent as any).username === 'lisboa.cossa'}
                      onClick={() => setDeleteAgentId(agent.id)}
                    >
                      <Trash2 className="w-3 h-3" /> Excluir
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* REPORTS TAB */}
        <TabsContent value="relatorios" className="space-y-4 mt-3">
          <div className="flex gap-2 flex-wrap">
            <Button variant="default" className="flex-1 min-w-[160px] gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" onClick={handlePrintReport}>
              <Printer className="w-4 h-4" /> Imprimir Relatório
            </Button>
            <Button variant="outline" className="flex-1 min-w-[100px] gap-1.5" onClick={exportPDF}>
              <Download className="w-4 h-4" /> PDF
            </Button>
            <Button variant="outline" className="flex-1 min-w-[100px] gap-1.5" onClick={exportExcel}>
              <Download className="w-4 h-4" /> Excel
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 space-y-1">
              <span className="text-xs text-muted-foreground">Total</span>
              <p className="text-2xl font-bold text-foreground">{reports.total}</p>
            </Card>
            <Card className="p-4 space-y-1">
              <span className="text-xs text-muted-foreground">Valor Total</span>
              <p className="text-xl font-bold text-foreground">{reports.valorTotal.toFixed(0)} MT</p>
            </Card>
            <Card className="p-4 space-y-1">
              <span className="text-xs text-muted-foreground">Cobrado</span>
              <p className="text-xl font-bold text-accent">{reports.valorPago.toFixed(0)} MT</p>
            </Card>
            <Card className="p-4 space-y-1">
              <span className="text-xs text-muted-foreground">Pendente</span>
              <p className="text-xl font-bold text-secondary">{reports.valorPendente.toFixed(0)} MT</p>
            </Card>
          </div>

          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Por Estado</h3>
            {[
              { label: 'Pendentes', value: reports.pendentes, total: reports.total, cls: 'bg-secondary' },
              { label: 'Pagas', value: reports.pagas, total: reports.total, cls: 'bg-accent' },
              { label: 'Canceladas', value: reports.canceladas, total: reports.total, cls: 'bg-destructive' },
            ].map(item => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium text-foreground">{item.value} ({item.total ? Math.round((item.value / item.total) * 100) : 0}%)</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${item.cls} transition-all`} style={{ width: `${item.total ? (item.value / item.total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </Card>

          <Card className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Ban className="w-4 h-4 text-primary" /> Por Tipo
            </h3>
            {Object.entries(reports.byType).sort(([, a], [, b]) => b.count - a.count).map(([type, data]) => (
              <div key={type} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                <span className="text-muted-foreground truncate mr-2">{type}</span>
                <div className="flex gap-3 flex-shrink-0">
                  <span className="font-medium text-foreground">{data.count}×</span>
                  <span className="font-semibold text-foreground w-20 text-right">{data.valor.toFixed(0)} MT</span>
                </div>
              </div>
            ))}
          </Card>

          <Card className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Por Agente
            </h3>
            {Object.entries(reports.byAgent).sort(([, a], [, b]) => b - a).map(([agent, count]) => (
              <div key={agent} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                <span className="text-muted-foreground truncate mr-2">{agent}</span>
                <span className="font-medium text-foreground">{count} multas</span>
              </div>
            ))}
          </Card>
        </TabsContent>

        {/* BACKUP & MANUAIS TAB */}
        <TabsContent value="backup" className="space-y-4 mt-3">
          <DatabaseBackupReset onDataChanged={() => { loadMultas(); loadAgentes(); }} />
        </TabsContent>
      </Tabs>

      {/* Pedido de cancelamento ao Presidente do Município */}
      <CancelRequestDialog
        multa={cancelMulta}
        open={!!cancelMulta}
        onOpenChange={(v) => { if (!v) setCancelMulta(null); }}
        onSubmitted={loadMultas}
      />

      {/* Delete agent dialog */}
      <AlertDialog open={!!deleteAgentId} onOpenChange={() => setDeleteAgentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Agente?</AlertDialogTitle>
            <AlertDialogDescription>Esta acção é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteAgentId && deleteAgent(deleteAgentId)}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Agent form dialog */}
      <Dialog open={showAgentForm} onOpenChange={setShowAgentForm}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAgent ? 'Editar Agente' : 'Novo Agente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Photo Upload */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
                {agentForm.foto_url ? (
                  <img src={agentForm.foto_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.capture = 'environment';
                  input.onchange = async (ev) => {
                    const file = (ev.target as HTMLInputElement).files?.[0];
                    if (!file) return;
                    const ext = file.name.split('.').pop() || 'jpg';
                    const path = `agent-${Date.now()}.${ext}`;
                    const { error } = await supabase.storage.from('avatars').upload(path, file, { cacheControl: '3600', upsert: true });
                    if (error) { toast.error('Erro ao carregar foto'); return; }
                    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
                    setAgentForm(f => ({ ...f, foto_url: urlData.publicUrl }));
                    toast.success('Foto carregada');
                  };
                  input.click();
                }}>
                  <Camera className="w-3.5 h-3.5" /> Câmera
                </Button>
                <Button type="button" variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = async (ev) => {
                    const file = (ev.target as HTMLInputElement).files?.[0];
                    if (!file) return;
                    const ext = file.name.split('.').pop() || 'jpg';
                    const path = `agent-${Date.now()}.${ext}`;
                    const { error } = await supabase.storage.from('avatars').upload(path, file, { cacheControl: '3600', upsert: true });
                    if (error) { toast.error('Erro ao carregar foto'); return; }
                    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
                    setAgentForm(f => ({ ...f, foto_url: urlData.publicUrl }));
                    toast.success('Foto carregada');
                  };
                  input.click();
                }}>
                  <ImageIcon className="w-3.5 h-3.5" /> Galeria
                </Button>
                {agentForm.foto_url && (
                  <Button type="button" variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => setAgentForm(f => ({ ...f, foto_url: '' }))}>
                    Remover
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nome *</Label>
              <Input placeholder="Nome completo" value={agentForm.nome} onChange={(e) => {
                const nome = e.target.value;
                setAgentForm(f => ({ ...f, nome, username: '' }));
                const suggestions = generateUsernameSuggestions(nome);
                setUsernameSuggestions(suggestions);
                setUsernameAvailability({});
                if (suggestions.length > 0) checkUsernames(suggestions);
              }} />
            </div>

            {/* Username suggestions */}
            {!editingAgent && usernameSuggestions.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Nome de Utilizador * <span className="text-muted-foreground font-normal">(seleccione um)</span></Label>
                <div className="grid grid-cols-1 gap-1.5">
                  {usernameSuggestions.map((suggestion) => {
                    const available = usernameAvailability[suggestion];
                    const selected = agentForm.username === suggestion;
                    return (
                      <button
                        key={suggestion}
                        type="button"
                        disabled={available === false}
                        onClick={() => setAgentForm(f => ({ ...f, username: suggestion }))}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left text-sm font-mono transition-all ${
                          selected
                            ? 'border-primary bg-primary/10 ring-2 ring-primary/20 text-primary font-semibold'
                            : available === false
                              ? 'border-border bg-muted/50 text-muted-foreground line-through opacity-60 cursor-not-allowed'
                              : 'border-border hover:border-primary/40 hover:bg-muted/30 cursor-pointer text-foreground'
                        }`}
                      >
                        <span>👤 {suggestion}</span>
                        {checkingUsername ? (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        ) : available === true ? (
                          <span className="text-[10px] text-primary font-semibold">✓ Disponível</span>
                        ) : available === false ? (
                          <span className="text-[10px] text-destructive font-semibold">✗ Em uso</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {agentForm.username && (
                  <p className="text-[10px] text-primary font-medium">
                    ✓ Seleccionado: <span className="font-mono font-bold">{agentForm.username}</span>
                  </p>
                )}
              </div>
            )}

            {editingAgent && (
              <div className="space-y-1.5">
                <Label className="text-xs">Nome de Utilizador</Label>
                <Input value={agentForm.username} disabled className="font-mono bg-muted/50" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input type="email" placeholder="agente@cmm.gov.mz" value={agentForm.email} onChange={(e) => setAgentForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nº Agente *</Label>
                <Input placeholder="AG-001" value={agentForm.numero_agente} onChange={(e) => setAgentForm(f => ({ ...f, numero_agente: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input placeholder="+258 84 xxx" value={agentForm.telefone} onChange={(e) => setAgentForm(f => ({ ...f, telefone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cargo</Label>
              <Select value={agentForm.cargo} onValueChange={(v) => setAgentForm(f => ({ ...f, cargo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SuperAdmin">👑 SuperAdmin</SelectItem>
                  <SelectItem value="Presidente">Presidente</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="agente">Agente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Local de Trabalho *</Label>
              <Select value={agentForm.local_trabalho} onValueChange={(v) => setAgentForm(f => ({ ...f, local_trabalho: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="via_publica">🚦 Via Pública</SelectItem>
                  <SelectItem value="posto_sede">🏢 Posto - Sede CMM</SelectItem>
                  <SelectItem value="posto_machava">🏢 Posto - Machava</SelectItem>
                  <SelectItem value="posto_t3">🏢 Posto - T3</SelectItem>
                  <SelectItem value="posto_matola_rio">🏢 Posto - Matola Rio</SelectItem>
                  <SelectItem value="posto_km15">🏢 Posto - KM 15</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nível de Acesso</Label>
              <Select value={agentForm.nivel_acesso} onValueChange={(v) => setAgentForm(f => ({ ...f, nivel_acesso: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="superadmin">👑 SuperAdmin (Supremo)</SelectItem>
                  <SelectItem value="presidente">Presidente do Município</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="agente_campo">Agente de Campo</SelectItem>
                  <SelectItem value="agente_cobranca">Agente de Cobrança</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!editingAgent && (
              <Card className="p-3 bg-muted/30 border-dashed">
                <p className="text-xs text-muted-foreground">🔐 Uma senha aleatória será gerada automaticamente e apresentada após a criação do agente. O utilizador deverá alterá-la no primeiro login.</p>
              </Card>
            )}
            {editingAgent && (
              <div className="space-y-3 border-t border-border pt-3">
                <h4 className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <KeyRound className="w-3.5 h-3.5 text-primary" />
                  Redefinir Senha do Utilizador
                </h4>
                <p className="text-[10px] text-muted-foreground">Deixe em branco para manter a senha actual. O utilizador será obrigado a trocar no próximo login.</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      type={agentForm.senha === 'show' ? 'text' : 'password'}
                      placeholder="Mínimo 8 caracteres"
                      value={agentForm.newPassword}
                      onChange={(e) => setAgentForm(f => ({ ...f, newPassword: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Confirmar Nova Senha</Label>
                  <Input
                    type="password"
                    placeholder="Repita a nova senha"
                    value={agentForm.confirmNewPassword}
                    onChange={(e) => setAgentForm(f => ({ ...f, confirmNewPassword: e.target.value }))}
                  />
                  {agentForm.confirmNewPassword && agentForm.newPassword !== agentForm.confirmNewPassword && (
                    <p className="text-[10px] text-destructive">As senhas não coincidem</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAgentForm(false)}>Cancelar</Button>
            <Button onClick={saveAgent} disabled={savingAgent}>
              {savingAgent ? 'Guardando...' : editingAgent ? 'Actualizar' : 'Criar Agente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Created Credentials Dialog */}
      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <UserCheck className="h-5 w-5" />
              Agente Criado com Sucesso!
            </DialogTitle>
          </DialogHeader>
          {createdCredentials && (
            <div className="space-y-4 py-2">
              <Card className="p-4 space-y-2 bg-muted/30">
                <div className="text-xs space-y-1.5">
                  <div className="flex justify-between"><span className="text-muted-foreground">Nome:</span><span className="font-semibold">{createdCredentials.nome}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Utilizador:</span><span className="font-mono font-semibold">{createdCredentials.username}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Email:</span><span className="font-mono">{createdCredentials.email}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Senha:</span><span className="font-mono font-bold text-primary">{createdCredentials.password}</span></div>
                </div>
              </Card>
              <p className="text-[10px] text-muted-foreground text-center">⚠️ O utilizador deve trocar a senha no primeiro login.</p>

              {/* Status do envio por email */}
              <div className="p-2.5 rounded-lg border text-xs flex items-center justify-between bg-background">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  <span>
                    {credentialsEmailSent 
                      ? 'Credenciais enviadas por email' 
                      : 'Envio para: ' + createdCredentials.email}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant={credentialsEmailSent ? 'ghost' : 'default'}
                  className="h-7 text-xs gap-1"
                  disabled={sendingCredentialsEmail}
                  onClick={async () => {
                    setSendingCredentialsEmail(true);
                    const res = await sendCredentialsEmail({
                      to: createdCredentials.email,
                      nome: createdCredentials.nome,
                      username: createdCredentials.username,
                      password: createdCredentials.password,
                    });
                    setSendingCredentialsEmail(false);
                    if (res.success) {
                      setCredentialsEmailSent(true);
                      toast.success(`Credenciais enviadas com sucesso para ${createdCredentials.email}`);
                    } else {
                      toast.error(res.error || 'Falha ao enviar email');
                    }
                  }}
                >
                  {sendingCredentialsEmail ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : credentialsEmailSent ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  {credentialsEmailSent ? 'Reenviar' : 'Enviar Email'}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() => {
                  const text = `SIGEMM - Dados de Acesso\n========================\nNome: ${createdCredentials.nome}\nUtilizador: ${createdCredentials.username}\nEmail: ${createdCredentials.email}\nSenha temporária: ${createdCredentials.password}\n\n⚠️ IMPORTANTE: Troque a sua senha no primeiro acesso ao sistema.\n\nSistema: SIGEMM - Conselho Municipal da Matola`;
                  const blob = new Blob([text], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `credenciais_${createdCredentials.username}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success('Ficheiro de credenciais descarregado');
                }}>
                  <Download className="w-3.5 h-3.5" /> Guardar .txt
                </Button>
                <Button variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() => {
                  const text = `Dados de acesso SIGEMM:\nUtilizador: ${createdCredentials.username}\nSenha: ${createdCredentials.password}\nTroque a senha no primeiro login.`;
                  if (navigator.share) {
                    navigator.share({ title: 'Credenciais SIGEMM', text });
                  } else {
                    navigator.clipboard.writeText(text);
                    toast.success('Credenciais copiadas!');
                  }
                }}>
                  <FileText className="w-3.5 h-3.5" /> Partilhar
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowCredentialsDialog(false)} className="w-full">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrinterSelectDialog
        open={reportPrintOpen}
        onOpenChange={setReportPrintOpen}
        reportData={reportPrintData}
        initialMode="report"
      />
    </div>
  );
}
