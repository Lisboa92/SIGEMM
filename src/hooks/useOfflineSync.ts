import { useCallback, useEffect, useRef, useState } from 'react';
import { getQueue, queueSize, syncQueue, QueuedMulta } from '@/lib/offlineQueue';
import {
  getPowerSyncStatus,
  triggerPowerSyncNow,
  initPowerSync,
  PowerSyncSystemStatus,
} from '@/lib/powersync';
import { toast } from 'sonner';

export function useOfflineSync() {
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pending, setPending] = useState<number>(queueSize());
  const [pendingItems, setPendingItems] = useState<QueuedMulta[]>(getQueue());
  const [syncing, setSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [swActive, setSwActive] = useState<boolean>(false);
  const [powerSyncStatus, setPowerSyncStatus] = useState<PowerSyncSystemStatus>(getPowerSyncStatus());
  const syncingRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      setSwActive(!!navigator.serviceWorker.controller);
      navigator.serviceWorker.ready.then(() => setSwActive(true));
    }

    // Inicializar PowerSync em segundo plano
    initPowerSync().then(() => {
      setPowerSyncStatus(getPowerSyncStatus());
    });
  }, []);

  const checkRealConnection = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    try {
      const res = await fetch('/api/health', { method: 'GET', cache: 'no-store' });
      return res.ok;
    } catch {
      return typeof navigator !== 'undefined' ? navigator.onLine : true;
    }
  }, []);

  const sync = useCallback(async (silent = false) => {
    if (syncingRef.current) return;
    const currentPending = queueSize();

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setOnline(false);
      return;
    }

    syncingRef.current = true;
    setSyncing(true);

    try {
      // 1. Sincronizar via motor PowerSync
      try {
        await triggerPowerSyncNow();
      } catch (psErr) {
        console.warn('[useOfflineSync] Falha no gatilho PowerSync:', psErr);
      }

      // 2. Sincronizar via fila de contingência
      if (currentPending > 0) {
        const { enviadas, falhadas } = await syncQueue();
        const remaining = queueSize();
        setPending(remaining);
        setPendingItems(getQueue());

        if (enviadas > 0) {
          toast.success(
            enviadas === 1
              ? '1 multa sincronizada automaticamente com o servidor (PowerSync).'
              : `${enviadas} multas sincronizadas com sucesso com o servidor (PowerSync)!`
          );
        }
        if (falhadas > 0 && !silent) {
          toast.error(`${falhadas} registo(s) não puderam ser sincronizados agora. O PowerSync tentará novamente em breve.`);
        }
      }

      setLastSyncTime(new Date());
      setPowerSyncStatus(getPowerSyncStatus());
    } catch (err) {
      console.error('[useOfflineSync] Erro no sync:', err);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const handleQueueChange = (e: Event) => {
      const count = (e as CustomEvent).detail ?? queueSize();
      setPending(count);
      setPendingItems(getQueue());
      if (count > 0 && navigator.onLine) {
        sync(true);
      }
    };

    const handleTriggerSync = () => {
      console.log('[useOfflineSync] Sinal de sincronização recebido');
      if (navigator.onLine) {
        sync(false);
      }
    };

    const handlePowerSyncStatus = () => {
      setPowerSyncStatus(getPowerSyncStatus());
    };

    const handlePowerSyncSynced = (e: Event) => {
      const count = (e as CustomEvent).detail?.count || 1;
      setLastSyncTime(new Date());
      setPowerSyncStatus(getPowerSyncStatus());
      toast.success(`PowerSync: ${count} actualização(ões) sincronizadas automaticamente.`);
    };

    const handleOnline = async () => {
      setOnline(true);
      toast.info('Ligação à rede restabelecida. PowerSync a sincronizar dados...');
      await sync(false);
    };

    const handleOffline = () => {
      setOnline(false);
      toast.warning('Dispositivo offline. PowerSync a operar em modo SQLite local seguro.');
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        sync(true);
      }
    };

    window.addEventListener('sigemm-queue-changed', handleQueueChange);
    window.addEventListener('sigemm-trigger-sync', handleTriggerSync);
    window.addEventListener('powersync-status-changed', handlePowerSyncStatus);
    window.addEventListener('powersync-synced', handlePowerSyncSynced);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    // Initial check
    if (navigator.onLine) {
      sync(true);
    }

    // Heartbeat: checar a cada 15s se houver pendentes, ou a cada 45s para manter o PowerSync atualizado
    const interval = setInterval(() => {
      if (navigator.onLine) {
        sync(true);
      }
    }, queueSize() > 0 ? 15000 : 45000);

    return () => {
      window.removeEventListener('sigemm-queue-changed', handleQueueChange);
      window.removeEventListener('sigemm-trigger-sync', handleTriggerSync);
      window.removeEventListener('powersync-status-changed', handlePowerSyncStatus);
      window.removeEventListener('powersync-synced', handlePowerSyncSynced);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [sync]);

  return {
    online,
    pending,
    pendingItems,
    syncing,
    sync,
    checkRealConnection,
    lastSyncTime,
    swActive,
    powerSyncStatus,
  };
}
