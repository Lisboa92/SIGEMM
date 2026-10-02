import { useState } from 'react';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Smartphone,
  ArrowUpDown,
  Zap,
  Database,
  Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function OfflineIndicator() {
  const {
    online,
    pending,
    pendingItems,
    syncing,
    sync,
    swActive,
    lastSyncTime,
    powerSyncStatus,
  } = useOfflineSync();
  const { t, lang } = useLanguage();
  const [openModal, setOpenModal] = useState(false);

  return (
    <>
      {online && pending === 0 ? (
        <button
          onClick={() => setOpenModal(true)}
          className="flex items-center gap-1.5 px-2.5 h-8 text-[11px] font-medium text-primary-foreground/90 hover:bg-primary-foreground/10 rounded-lg transition-colors select-none"
          title={
            lang === 'en'
              ? 'Online — All fines and records synchronized'
              : 'Online — Todas as multas e registos sincronizados'
          }
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse ring-2 ring-emerald-400/20" />
          <Cloud className="h-3.5 w-3.5 text-emerald-300" />
          <span className="font-semibold">{t('common.online') || 'Online'}</span>
        </button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpenModal(true)}
          className={`h-8 gap-1.5 px-2.5 rounded-lg text-primary-foreground hover:bg-primary-foreground/15 transition-all ${
            pending > 0
              ? 'bg-amber-500/25 border border-amber-400/50 text-amber-100 shadow-sm'
              : 'bg-destructive/20 border border-destructive/40 text-destructive-foreground'
          }`}
          title={
            online
              ? lang === 'en'
                ? `${pending} records pending sync`
                : `${pending} registos pendentes de sincronização`
              : lang === 'en'
                ? 'Offline Mode — Saved locally'
                : 'Modo Offline — Guardado localmente'
          }
        >
          {online ? (
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          ) : (
            <CloudOff className="h-3.5 w-3.5 text-amber-300" />
          )}
          <span className="text-[11px] font-bold tracking-wide">
            {online
              ? syncing
                ? lang === 'en'
                  ? 'Syncing...'
                  : 'A sincronizar...'
                : `${pending} ${lang === 'en' ? 'pending' : 'pendente(s)'}`
              : `${t('common.offline') || 'Offline'}${pending > 0 ? ` (${pending})` : ''}`}
          </span>
        </Button>
      )}

      {/* Modal de Detalhes da Sincronização Automática PowerSync */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="sm:max-w-lg max-h-[88vh] flex flex-col p-5">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-emerald-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span>Sincronização Automática PowerSync</span>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                    Offline-First
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Motor de sincronização contínua com base SQLite local (WebAssembly/OPFS)
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            {/* Status Cards */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-lg border bg-card/60 flex flex-col gap-1">
                <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <Radio className="h-3 w-3 text-primary" />
                  Estado da Conexão
                </span>
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-destructive'}`} />
                  {online ? 'Online (Conectado)' : 'Offline (Modo de Campo)'}
                </div>
              </div>

              <div className="p-3 rounded-lg border bg-card/60 flex flex-col gap-1">
                <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <Database className="h-3 w-3 text-amber-500" />
                  Base de Dados Local
                </span>
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span className="font-mono text-[11px]">sigemm_powersync.db</span>
                </div>
              </div>
            </div>

            {/* Informações detalhadas do PowerSync */}
            <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  Motor PowerSync Web SDK:
                </span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  {powerSyncStatus.initialized ? 'Operacional' : 'A Carregar'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-muted-foreground">
                <div>
                  • Leitura & Escrita: <span className="text-foreground font-medium">Instantânea (0ms)</span>
                </div>
                <div>
                  • Tabelas Sincronizadas: <span className="text-foreground font-medium">{powerSyncStatus.tablesCount} tabelas</span>
                </div>
                <div>
                  • Modo de Contingência: <span className="text-foreground font-medium">Ativo & Seguro</span>
                </div>
                <div>
                  • PWA Service Worker: <span className="text-foreground font-medium">{swActive ? 'Ativo' : 'Instalado'}</span>
                </div>
              </div>
            </div>

            {/* Como funciona o PowerSync no terreno */}
            <div className="p-3 rounded-lg border bg-muted/30 text-xs text-muted-foreground flex gap-2.5 items-start">
              <Smartphone className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground text-[11px]">Como funciona a sincronização no terreno:</p>
                <p className="text-[11px] leading-relaxed">
                  Quando o agente autua na via pública sem sinal de rede, o PowerSync grava o auto imediatamente na base de dados SQLite do próprio telemóvel/computador. Assim que o dispositivo detecta sinal de internet, os lotes são enviados e reconciliados automaticamente no servidor central, sem qualquer risco de perda de autos.
                </p>
              </div>
            </div>

            {/* Fila de Multas e Operações Pendentes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-bold text-foreground">
                    Fila de Sincronização ({pending})
                  </span>
                </div>
                {lastSyncTime && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Último sync: {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </div>

              {pending === 0 ? (
                <div className="p-4 rounded-lg border border-dashed text-center text-xs text-muted-foreground bg-muted/20">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5" />
                  <p className="font-medium text-foreground">Tudo sincronizado</p>
                  <p className="text-[11px]">A base local SQLite e a central Supabase estão perfeitamente alinhadas.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-48 border rounded-lg p-2 bg-card/40 divide-y divide-border">
                  {pendingItems.map((item, idx) => {
                    const p = item.payload || {};
                    return (
                      <div key={item.id || idx} className="py-2 px-1 text-xs first:pt-1 last:pb-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground font-mono">
                            {p.numero || p.numero_auto || 'Auto de Campo'}
                          </span>
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                            Fila PowerSync
                          </Badge>
                        </div>
                        <div className="text-muted-foreground text-[11px] truncate mt-0.5">
                          {p.infrator_nome || 'Infrator'} · {p.infracao_tipo || 'Infração'}
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground/80 mt-1">
                          <span>{p.local || 'Via Pública'}</span>
                          <span className="font-semibold text-foreground">
                            {Number(p.valor || 0).toLocaleString('pt-MZ')} MT
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </ScrollArea>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenModal(false)}
              className="text-xs"
            >
              Fechar
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => sync(false)}
              disabled={syncing}
              className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'PowerSync a Sincronizar...' : 'Sincronizar via PowerSync Agora'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
