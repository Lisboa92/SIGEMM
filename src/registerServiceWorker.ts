/**
 * SIGEMM · Registo e Gestão do Service Worker (PWA)
 * Suporte a emissão offline e sincronização em segundo plano
 */

export interface SWRegistrationState {
  registered: boolean;
  swRegistration: ServiceWorkerRegistration | null;
  hasBackgroundSync: boolean;
}

let registrationInstance: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('[SW Client] Service Worker não suportado neste navegador.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    registrationInstance = registration;

    console.log('[SW Client] Service Worker registado com sucesso:', registration.scope);

    // Verificar se há actualização pendente
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW Client] Nova versão do SIGEMM disponível em cache.');
            window.dispatchEvent(new CustomEvent('sigemm-sw-updated'));
          }
        });
      }
    });

    // Escutar mensagens vindas do Service Worker (ex: gatilho de sincronização em segundo plano)
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SIGEMM_TRIGGER_SYNC') {
        console.log('[SW Client] Mensagem recebida do Service Worker para sincronizar multas pendentes');
        window.dispatchEvent(new CustomEvent('sigemm-trigger-sync', { detail: event.data }));
      }
    });

    return registration;
  } catch (error) {
    console.warn('[SW Client] Erro ao registar Service Worker:', error);
    return null;
  }
}

/**
 * Solicita registo de Background Sync no Service Worker para envio de multas
 */
export async function requestBackgroundSync(tag = 'sync-multas'): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;

  try {
    const reg = registrationInstance || (await navigator.serviceWorker.ready);
    if (reg && 'sync' in reg) {
      await (reg as any).sync.register(tag);
      console.log(`[SW Client] Background Sync registado com a tag: ${tag}`);
      return true;
    } else if (reg && reg.active) {
      reg.active.postMessage({ type: 'QUEUE_UPDATED', tag });
    }
  } catch (err) {
    console.warn('[SW Client] Falha ao registar background sync:', err);
  }
  return false;
}

/**
 * Envia notificação ao Service Worker que a fila de multas foi alterada
 */
export function notifyServiceWorkerQueueUpdated(count: number) {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'QUEUE_UPDATED',
      count,
    });
  }
  requestBackgroundSync('sync-multas').catch(() => {});
}
