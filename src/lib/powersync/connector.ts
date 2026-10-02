import {
  CommonPowerSyncDatabase,
  CrudBatch,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
  UpdateType,
} from '@powersync/web';
import { supabase } from '@/integrations/supabase/client';

export class SIGEMMPowerSyncConnector implements PowerSyncBackendConnector {
  private endpoint: string | null;

  constructor() {
    const raw = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_POWERSYNC_URL : null;
    // Usar apenas se uma URL real for fornecida e não for placeholder
    this.endpoint = raw && raw.trim() && !raw.includes('matola.gov.mz') ? raw.trim() : null;
  }

  isConfigured(): boolean {
    return !!this.endpoint;
  }

  getEndpoint(): string {
    return this.endpoint || 'local-first-sqlite';
  }

  /**
   * Obtém credenciais de autenticação JWT para ligação ao serviço PowerSync.
   * Se não houver servidor de streaming remoto configurado, retorna null de modo a não disparar tentativas de conexão.
   */
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    if (!this.endpoint) {
      return null;
    }

    try {
      // 1. Tentar obter token da API interna do servidor se configurado
      if (typeof window !== 'undefined' && navigator.onLine) {
        try {
          const res = await fetch('/api/powersync/token', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.configured && data?.endpoint && data?.token) {
              return {
                endpoint: data.endpoint,
                token: data.token,
                expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
              };
            }
          }
        } catch {
          // Servidor em fallback ou offline
        }
      }

      // 2. Se houver sessão Supabase, gerar credenciais cliente
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;

      if (!token) {
        return null;
      }

      const expiresAt = authData.session?.expires_at
        ? new Date(authData.session.expires_at * 1000)
        : new Date(Date.now() + 3600 * 1000);

      return {
        endpoint: this.endpoint,
        token: token,
        expiresAt,
      };
    } catch (err) {
      console.warn('[PowerSyncConnector] Erro ao obter credenciais:', err);
      return null;
    }
  }

  /**
   * Envia as mutações locais geradas em SQLite (CrudBatch) para o PostgreSQL / Supabase.
   */
  async uploadData(database: CommonPowerSyncDatabase): Promise<void> {
    const batch: CrudBatch | null = await database.getCrudBatch();

    if (!batch || !batch.crud || batch.crud.length === 0) {
      return;
    }

    console.log(`[PowerSync] A descarregar lote de mutações locais: ${batch.crud.length} operação(ões)`);

    try {
      for (const op of batch.crud) {
        const table = op.table;
        const opType = op.op;
        const data = op.opData || {};
        const recordId = op.id;

        if (table === 'multas') {
          if (opType === UpdateType.PUT || opType === UpdateType.PATCH) {
            const payload: Record<string, any> = { ...data };

            // Tratar fotos em JSON se for string
            if (typeof payload.fotos === 'string') {
              try {
                payload.fotos = JSON.parse(payload.fotos);
              } catch {
                payload.fotos = [];
              }
            }

            // Normalizar booleano de offline_sync
            if ('offline_sync' in payload) {
              payload.offline_sync = false;
            }

            // Upsert na tabela multas do Supabase
            const { error } = await supabase.from('multas').upsert(
              {
                id: recordId,
                ...payload,
                updated_at: new Date().toISOString(),
              } as any,
              { onConflict: 'id' }
            );

            if (error) {
              console.error(`[PowerSync] Erro ao sincronizar multa ${recordId}:`, error);
            }
          } else if (opType === UpdateType.DELETE) {
            await supabase.from('multas').delete().eq('id', recordId);
          }
        } else if (table === 'pagamentos') {
          if (opType === UpdateType.PUT || opType === UpdateType.PATCH) {
            await supabase.from('pagamentos' as any).upsert({
              id: recordId,
              ...data,
            } as any);
          } else if (opType === UpdateType.DELETE) {
            await supabase.from('pagamentos' as any).delete().eq('id', recordId);
          }
        } else if (table === 'reclamacoes') {
          if (opType === UpdateType.PUT || opType === UpdateType.PATCH) {
            await supabase.from('reclamacoes' as any).upsert({
              id: recordId,
              ...data,
            } as any);
          } else if (opType === UpdateType.DELETE) {
            await supabase.from('reclamacoes' as any).delete().eq('id', recordId);
          }
        } else if (table === 'audit_log') {
          if (opType === UpdateType.PUT || opType === UpdateType.PATCH) {
            await supabase.from('audit_log').insert({
              ...data,
            } as any);
          }
        } else if (table === 'notifications') {
          if (opType === UpdateType.PUT || opType === UpdateType.PATCH) {
            await supabase.from('notifications').insert({
              ...data,
            } as any);
          }
        }
      }

      // Marcar o lote local como completamente enviado
      await batch.complete();
      console.log(`[PowerSync] Lote de ${batch.crud.length} operações concluído com sucesso.`);

      // Disparar evento de actualização para a interface React
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('powersync-synced', { detail: { count: batch.crud.length } }));
        window.dispatchEvent(new CustomEvent('multas-updated'));
      }
    } catch (err) {
      console.error('[PowerSync] Falha no uploadData do lote:', err);
      throw err; // Forçar o PowerSync a reagendar o lote após intervalo seguro
    }
  }
}
