import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole, canAccess } from '@/hooks/useUserRole';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DatabaseBackup, ShieldAlert, Loader2, Download, Siren, BookOpen, Eye,
  FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Database, RefreshCw, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import UserManualViewer from '@/components/UserManualViewer';
import * as XLSX from 'xlsx';

const BACKUP_TABLES = [
  'agentes', 'multas', 'tipos_multa', 'locais_pagamento', 'reclamacoes',
  'cancel_requests', 'notifications', 'audit_log', 'agent_login_logs',
] as const;

export default function DatabaseBackupReset({ onDataChanged }: { onDataChanged?: () => void }) {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { nivelAcesso } = useUserRole();
  const isAdmin = canAccess(nivelAcesso, 'admin');

  const [backingUp, setBackingUp] = useState(false);
  const [backingUpExcel, setBackingUpExcel] = useState(false);
  const [importing, setImporting] = useState(false);
  const [manualViewerOpen, setManualViewerOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [presidentEmail, setPresidentEmail] = useState('');
  const [presidentPassword, setPresidentPassword] = useState('');
  const [confirmWord, setConfirmWord] = useState('');
  const [resetting, setResetting] = useState(false);

  // Table row counts
  const [tableStats, setTableStats] = useState<Record<string, number>>({});
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setStatsLoading(true);
    const stats: Record<string, number> = {};
    for (const table of BACKUP_TABLES) {
      try {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (!error && count !== null) {
          stats[table] = count;
        }
      } catch {
        stats[table] = 0;
      }
    }
    setTableStats(stats);
    setStatsLoading(false);
  }

  async function generateJsonBackup() {
    setBackingUp(true);
    try {
      const dump: Record<string, unknown[]> = {};
      for (const table of BACKUP_TABLES) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) throw error;
        dump[table] = data ?? [];
      }
      const payload = {
        sistema: 'SIGEMM — Conselho Municipal da Matola',
        gerado_em: new Date().toISOString(),
        gerado_por: user?.email ?? null,
        tabelas: dump,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sigemm_backup_${new Date().toISOString().split('T')[0]}_${Date.now().toString().slice(-4)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('backup.success') || 'Cópia de segurança JSON exportada com sucesso.');
    } catch (err: any) {
      toast.error((t('backup.error') || 'Erro ao exportar backup') + ': ' + (err?.message ?? err));
    } finally {
      setBackingUp(false);
    }
  }

  async function generateExcelBackup() {
    setBackingUpExcel(true);
    try {
      const wb = XLSX.utils.book_new();
      for (const table of BACKUP_TABLES) {
        const { data, error } = await supabase.from(table).select('*');
        if (!error && data) {
          const ws = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(wb, ws, table.slice(0, 31));
        }
      }
      XLSX.writeFile(wb, `sigemm_dados_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Backup em Excel (.XLSX) exportado com sucesso.');
    } catch (err: any) {
      toast.error('Erro ao gerar Excel: ' + (err?.message || err));
    } finally {
      setBackingUpExcel(false);
    }
  }

  async function handleImportJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      const tablesData = importData.tabelas || importData;
      let imported = 0;
      let errors = 0;

      for (const table of BACKUP_TABLES) {
        if (tablesData[table] && Array.isArray(tablesData[table])) {
          for (const row of tablesData[table]) {
            const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' });
            if (error) errors++;
            else imported++;
          }
        }
      }
      toast.success(`Importação concluída com sucesso: ${imported} registos actualizados/inseridos${errors > 0 ? ` (${errors} erros)` : ''}.`);
      loadStats();
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      toast.error('Erro ao importar JSON: ' + (err?.message || err));
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  async function runReset() {
    if (confirmWord.trim().toUpperCase() !== 'REPOR') {
      toast.error(lang === 'en' ? 'Type REPOR to confirm' : 'Escreva REPOR para confirmar');
      return;
    }
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-database', {
        body: { requesterEmail: user?.email, presidentEmail, presidentPassword },
      });
      const errMsg = (data as any)?.error;
      if (error || errMsg) {
        toast.error(errMsg || error?.message || (lang === 'en' ? 'Error resetting database' : 'Erro ao repor base de dados'));
        return;
      }
      toast.success(t('reset.success') || 'Base de dados restaurada com sucesso.');
      setResetOpen(false);
      setPresidentEmail(''); setPresidentPassword(''); setConfirmWord('');
      loadStats();
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      toast.error(err?.message ?? (lang === 'en' ? 'Unexpected error' : 'Erro inesperado'));
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 1. USER MANUAL CARD */}
      <Card className="p-5 space-y-4 border-l-4 border-l-emerald-600 bg-emerald-50/20 dark:bg-emerald-950/10">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              {t('settings.manual.title') || 'Manual de Operações & Legislação do SIGEMM'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('settings.manual.desc') || 'Consulte o manual oficial do Conselho Municipal da Matola com instruções de autos móveis, imóveis, modo offline, tabela de infrações, tribunal e impressoras térmicas.'}
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded flex-shrink-0">
            OFICIAL CMM
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => setManualViewerOpen(true)}
            className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
          >
            <Eye className="h-4 w-4" />
            {t('settings.manual.button') || 'Abrir Manual Interativo'}
          </Button>
          <span className="text-xs text-muted-foreground">
            Inclui capítulos detalhados, matriz de permissões RBAC, fluxos de fiscalização e guias de contingência.
          </span>
        </div>
      </Card>

      <UserManualViewer open={manualViewerOpen} onOpenChange={setManualViewerOpen} />

      {/* 2. STATS & DATA INTEGRITY OVERVIEW */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            Integridade e Volume de Dados do Sistema
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 gap-1"
            onClick={loadStats}
            disabled={statsLoading}
          >
            <RefreshCw className={`w-3 h-3 ${statsLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
          {[
            { key: 'multas', label: 'Multas Registadas', icon: '📋' },
            { key: 'agentes', label: 'Utilizadores & Agentes', icon: '👮' },
            { key: 'tipos_multa', label: 'Tipos de Infracção', icon: '⚖️' },
            { key: 'locais_pagamento', label: 'Locais / Balcões', icon: '🏢' },
            { key: 'reclamacoes', label: 'Contestações / Reclamações', icon: '📝' },
            { key: 'cancel_requests', label: 'Pedidos Cancelamento', icon: '🚫' },
            { key: 'audit_log', label: 'Logs de Auditoria', icon: '🛡️' },
            { key: 'notifications', label: 'Notificações', icon: '🔔' },
          ].map(item => (
            <div key={item.key} className="p-2.5 rounded-lg border border-border bg-muted/20">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                <span>{item.icon}</span> {item.label}
              </p>
              <p className="text-sm font-bold text-foreground mt-0.5">
                {statsLoading ? '...' : (tableStats[item.key] ?? 0)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* 3. EXPORTAR CÓPIA DE SEGURANÇA */}
      <Card className="p-5 space-y-4 border-l-4 border-l-primary">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <DatabaseBackup className="w-4 h-4 text-primary" />
          {t('backup.title') || 'Cópia de Segurança (Backup)'}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t('backup.desc') || 'Exporte todos os registos do SIGEMM num ficheiro seguro para arquivo institucional ou salvaguarda periódica.'}
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Button onClick={generateJsonBackup} disabled={backingUp} className="gap-2">
            {backingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {backingUp ? 'Gerando JSON...' : 'Exportar Backup JSON (Completo)'}
          </Button>
          <Button variant="outline" onClick={generateExcelBackup} disabled={backingUpExcel} className="gap-2">
            {backingUpExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
            {backingUpExcel ? 'Gerando Excel...' : 'Exportar Planilha Excel (.xlsx)'}
          </Button>
        </div>
      </Card>

      {/* 4. IMPORTAR DADOS JSON */}
      <Card className="p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" />
          Restaurar / Importar Dados JSON
        </h3>
        <p className="text-xs text-muted-foreground">
          Importe registos a partir de um ficheiro JSON de backup previamente gerado pelo SIGEMM. O sistema insere novos registos e actualiza os existentes sem perda de integridade.
        </p>
        <div className="flex items-center gap-3">
          <Input
            type="file"
            accept=".json"
            className="text-xs max-w-sm"
            disabled={importing}
            onChange={handleImportJson}
          />
          {importing && (
            <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processando importação...
            </div>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground/80 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          Verificação automática de chaves primárias e prevenção de duplicações activa.
        </p>
      </Card>

      {/* 5. DATABASE RESET (ADMIN ONLY) */}
      <Card className="p-5 space-y-4 border-l-4 border-l-destructive bg-destructive/[0.03]">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-destructive">
          <ShieldAlert className="w-4 h-4 text-destructive" />
          {t('reset.title') || 'Reposição de Emergência da Base de Dados'}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t('reset.desc') || 'Restaura as tabelas para a configuração inicial limpa. Exige autorização formal e confirmação de credenciais do Presidente do Município.'}
        </p>
        <p className="text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md p-2.5 flex items-center gap-2">
          <Siren className="h-4 w-4 text-amber-600 flex-shrink-0" />
          {t('reset.backupFirst') || 'Recomendado: Faça sempre o download de um backup completo antes de qualquer reposição.'}
        </p>
        {isAdmin ? (
          <Button variant="destructive" onClick={() => setResetOpen(true)} className="gap-2">
            <ShieldAlert className="h-4 w-4" />
            {t('reset.button') || 'Solicitar Reposição de Emergência'}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            {t('reset.adminOnly') || 'Apenas administradores com credenciais institucionais podem executar este procedimento.'}
          </p>
        )}
      </Card>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              {t('reset.dialogTitle') || 'Confirmar Reposição de Base de Dados'}
            </DialogTitle>
            <DialogDescription>
              {t('reset.dialogDesc') || 'Esta operação de emergência reinicializa a base de dados. Introduza as credenciais institucionais autorizadas.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('reset.presidentEmail') || 'Email do SuperAdmin / Presidente / Administrador Master'}</Label>
              <Input type="email" value={presidentEmail} onChange={e => setPresidentEmail(e.target.value)} placeholder="lisboacossa@gmail.com ou presidente@cmm.gov.mz" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('reset.presidentPassword') || 'Senha de Confirmação'}</Label>
              <Input type="password" value={presidentPassword} onChange={e => setPresidentPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Para confirmar, digite <strong>REPOR</strong></Label>
              <Input value={confirmWord} onChange={e => setConfirmWord(e.target.value)} placeholder="REPOR" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>{t('common.cancel') || 'Cancelar'}</Button>
            <Button variant="destructive" onClick={runReset} disabled={resetting} className="gap-2">
              {resetting && <Loader2 className="h-4 w-4 animate-spin" />}
              {resetting ? (t('reset.processing') || 'Repondo...') : (t('reset.confirm') || 'Confirmar e Repor')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

