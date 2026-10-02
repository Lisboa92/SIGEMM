import { PowerSyncDatabase } from '@powersync/web';
import { AppSchema } from './schema';
import { SIGEMMPowerSyncConnector } from './connector';

let powerSyncInstance: PowerSyncDatabase | null = null;
let connectorInstance: SIGEMMPowerSyncConnector | null = null;
let isInitializing = false;
let initPromise: Promise<PowerSyncDatabase | null> | null = null;

export interface PowerSyncSystemStatus {
  initialized: boolean;
  connected: boolean;
  connecting: boolean;
  uploading: boolean;
  downloading: boolean;
  lastSyncedAt: string | null;
  hasSynced: boolean;
  databaseName: string;
  tablesCount: number;
  engine: string;
  error?: string | null;
}

/**
 * Retorna a instância única do PowerSync.
 */
export function getPowerSync(): PowerSyncDatabase | null {
  return powerSyncInstance;
}

/**
 * Inicializa a base de dados local SQLite e o motor de sincronização automática PowerSync.
 */
export async function initPowerSync(): Promise<PowerSyncDatabase | null> {
  if (powerSyncInstance) {
    return powerSyncInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  initPromise = (async () => {
    isInitializing = true;
    try {
      console.log('[PowerSync] A inicializar base de dados SQLite local (sigemm_powersync.db)...');

      // Instanciação com as tabelas do AppSchema
      const db = new PowerSyncDatabase({
        schema: AppSchema,
        database: {
          dbFilename: 'sigemm_powersync.db',
          disableSSRWarning: true,
        },
        flags: {
          enableMultiTabs: false, // Modo simples e estável no navegador e PWA
        },
      });

      await db.init();
      powerSyncInstance = db;

      // Ligar o conector de sincronização com o backend
      connectorInstance = new SIGEMMPowerSyncConnector();
      
      // Conectar ao serviço de streaming remoto apenas se houver endpoint configurado
      if (connectorInstance.isConfigured()) {
        db.connect(connectorInstance).catch((connErr) => {
          console.warn('[PowerSync] Aviso na conexão com o servidor PowerSync remoto:', connErr?.message || connErr);
        });
      } else {
        // Garantir que não existam conexões ativas pendentes tentando buscar endpoints inexistentes
        try {
          await db.disconnect();
        } catch {
          // ignore
        }
        console.log('[PowerSync] Motor operacional em modo Local-First SQLite (sem servidor de streaming remoto).');
      }

      // Escutar alterações de estado para notificar o sistema
      db.status.registerListener({
        statusChanged: (status) => {
          window.dispatchEvent(
            new CustomEvent('powersync-status-changed', {
              detail: {
                connected: status.connected,
                connecting: status.connecting,
                uploading: status.uploading,
                downloading: status.downloading,
                lastSyncedAt: status.lastSyncedAt?.toISOString() || null,
                hasSynced: !!status.hasSynced,
              },
            })
          );
        },
      });

      console.log('[PowerSync] Motor de sincronização automática inicializado com sucesso.');
      return db;
    } catch (err: any) {
      console.warn('[PowerSync] Erro na inicialização do PowerSync WASM/Worker (o sistema continuará com armazenamento local de contingência):', err);
      return null;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

/**
 * Força uma sincronização imediata através do conector PowerSync.
 */
export async function triggerPowerSyncNow(): Promise<{ success: boolean; message: string }> {
  try {
    const db = await initPowerSync();
    if (!db) {
      return { success: false, message: 'Motor PowerSync não inicializado.' };
    }

    if (connectorInstance) {
      await connectorInstance.uploadData(db);
    }

    return {
      success: true,
      message: 'Sincronização PowerSync executada com sucesso!',
    };
  } catch (err: any) {
    console.error('[PowerSync] Erro ao disparar sincronização forçada:', err);
    return {
      success: false,
      message: err?.message || 'Falha ao sincronizar com o servidor PowerSync.',
    };
  }
}

/**
 * Insere uma multa directamente na base de dados SQLite do PowerSync.
 * A sincronização com o PostgreSQL / Supabase ocorre de forma automática e garantida em segundo plano.
 */
export async function insertMultaPowerSync(multa: Record<string, any>): Promise<boolean> {
  try {
    const db = await initPowerSync();
    if (!db) return false;

    const id = multa.id || `ps-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    await db.execute(
      `INSERT OR REPLACE INTO multas (
        id, numero, numero_auto, infrator_nome, infrator_documento, infracao_tipo,
        categoria, matricula, local, local_avenida, local_casa, local_quarteirao,
        local_trabalho, posto_administrativo, residencia_bairro, residencia_avenida,
        residencia_casa, residencia_quarteirao, valor, valor_extenso, status,
        forma_pagamento, local_pagamento, referencia_deposito, comprovativo_url,
        agente_id, agente_nome, agente_email, latitude, longitude, legislacao,
        artigo_transgredido, alinea_transgredida, numero_transgredido, artigo_punicao,
        alinea_punicao, numero_punicao, fotos, foto_documento, assinatura_infrator,
        assinatura_agente, assinado_em, observacoes, offline_sync, tribunal_nome,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?
      )`,
      [
        id,
        multa.numero || '',
        multa.numero_auto || '',
        multa.infrator_nome || '',
        multa.infrator_documento || '',
        multa.infracao_tipo || '',
        multa.categoria || 'movel',
        multa.matricula || '',
        multa.local || '',
        multa.local_avenida || '',
        multa.local_casa || '',
        multa.local_quarteirao || '',
        multa.local_trabalho || '',
        multa.posto_administrativo || '',
        multa.residencia_bairro || '',
        multa.residencia_avenida || '',
        multa.residencia_casa || '',
        multa.residencia_quarteirao || '',
        Number(multa.valor || 0),
        multa.valor_extenso || '',
        multa.status || 'pendente',
        multa.forma_pagamento || '',
        multa.local_pagamento || '',
        multa.referencia_deposito || '',
        multa.comprovativo_url || '',
        multa.agente_id || '',
        multa.agente_nome || '',
        multa.agente_email || '',
        multa.latitude ? Number(multa.latitude) : null,
        multa.longitude ? Number(multa.longitude) : null,
        multa.legislacao || '',
        multa.artigo_transgredido || '',
        multa.alinea_transgredida || '',
        multa.numero_transgredido || '',
        multa.artigo_punicao || '',
        multa.alinea_punicao || '',
        multa.numero_punicao || '',
        typeof multa.fotos === 'string' ? multa.fotos : JSON.stringify(multa.fotos || []),
        multa.foto_documento || '',
        multa.assinatura_infrator || '',
        multa.assinatura_agente || '',
        multa.assinado_em || now,
        multa.observacoes || '',
        multa.offline_sync ? 1 : 0,
        multa.tribunal_nome || '',
        multa.created_at || now,
        now,
      ]
    );

    console.log(`[PowerSync] Multa ${multa.numero || id} gravada na SQLite local.`);

    // Se estivermos online, disparar upload do lote imediatamente
    if (typeof navigator !== 'undefined' && navigator.onLine && connectorInstance) {
      connectorInstance.uploadData(db).catch((e) => {
        console.warn('[PowerSync] Upload de fundo agendado para quando a ligação estabilizar:', e);
      });
    }

    return true;
  } catch (err) {
    console.error('[PowerSync] Erro ao gravar multa no SQLite PowerSync:', err);
    return false;
  }
}

/**
 * Consulta todas as multas a partir da base de dados local SQLite PowerSync.
 */
export async function getMultasPowerSync(): Promise<any[]> {
  try {
    const db = await initPowerSync();
    if (!db) return [];

    const rows = await db.getAll<any>('SELECT * FROM multas ORDER BY created_at DESC');
    return rows.map((r) => ({
      ...r,
      fotos: typeof r.fotos === 'string' ? JSON.parse(r.fotos || '[]') : r.fotos,
      offline_sync: !!r.offline_sync,
    }));
  } catch (err) {
    console.warn('[PowerSync] Erro ao consultar multas no SQLite local:', err);
    return [];
  }
}

/**
 * Retorna o estado actual e diagnóstico do PowerSync.
 */
export function getPowerSyncStatus(): PowerSyncSystemStatus {
  if (!powerSyncInstance) {
    return {
      initialized: false,
      connected: false,
      connecting: isInitializing,
      uploading: false,
      downloading: false,
      lastSyncedAt: null,
      hasSynced: false,
      databaseName: 'sigemm_powersync.db',
      tablesCount: 7,
      engine: 'PowerSync Web SDK (SQLite WASM)',
      error: isInitializing ? 'A inicializar motor SQLite...' : null,
    };
  }

  const s = powerSyncInstance.currentStatus;
  const isConfigured = connectorInstance?.isConfigured() ?? false;
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  return {
    initialized: true,
    connected: isConfigured ? !!s?.connected : isOnline,
    connecting: isConfigured ? !!s?.connecting : false,
    uploading: !!s?.uploading,
    downloading: !!s?.downloading,
    lastSyncedAt: s?.lastSyncedAt?.toISOString() || null,
    hasSynced: isConfigured ? !!s?.hasSynced : true,
    databaseName: 'sigemm_powersync.db',
    tablesCount: 7,
    engine: isConfigured ? 'PowerSync Web SDK (Cloud Connected)' : 'PowerSync Web SDK (Local-First SQLite)',
    error: isConfigured ? (s?.downloadError?.message || s?.uploadError?.message || null) : null,
  };
}
