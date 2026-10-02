// Fila de operações pendentes para funcionamento offline com sincronização automática robusta.
import { supabase } from '@/integrations/supabase/client';
import { notifyServiceWorkerQueueUpdated } from '@/registerServiceWorker';

const KEY = 'sigemm_offline_queue_v1';

export interface QueuedMulta {
  id: string;
  createdAt: string;
  payload: Record<string, any>;
  audit?: { user_id?: string; action: string; details: string };
  notification?: { message: string; action: string; local_trabalho: string; created_by?: string };
}

export function getQueue(): QueuedMulta[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function setQueue(items: QueuedMulta[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch (e) {
    console.error('[offlineQueue] Erro ao persistir fila no localStorage:', e);
  }
  window.dispatchEvent(new CustomEvent('sigemm-queue-changed', { detail: items.length }));
  notifyServiceWorkerQueueUpdated(items.length);
}

export function enqueueMulta(item: Omit<QueuedMulta, 'id' | 'createdAt'>): QueuedMulta {
  const entry: QueuedMulta = {
    id: `off-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    ...item,
  };
  const current = getQueue();
  // Evitar duplicados pelo número da multa se já estiver na fila
  const filtered = current.filter(i => (i.payload?.numero && item.payload?.numero) ? i.payload.numero !== item.payload.numero : true);
  setQueue([...filtered, entry]);

  // Persistir também no armazém local imediato (sigemm_db_multas) para que apareça em todas as listagens locais
  try {
    const rawLocal = localStorage.getItem('sigemm_db_multas');
    const localMultas = rawLocal ? JSON.parse(rawLocal) : [];
    const localEntry = {
      ...item.payload,
      id: entry.id,
      status: 'offline_pendente',
      created_at: entry.createdAt,
      updated_at: entry.createdAt,
      isOfflineQueue: true,
    };
    const withoutDup = localMultas.filter((m: any) => m.numero !== item.payload?.numero && m.id !== entry.id);
    localStorage.setItem('sigemm_db_multas', JSON.stringify([localEntry, ...withoutDup]));
    window.dispatchEvent(new CustomEvent('sigemm_db_update', { detail: { table: 'multas' } }));
    window.dispatchEvent(new CustomEvent('multas-updated'));
  } catch (err) {
    console.warn('[offlineQueue] Erro ao gravar em sigemm_db_multas:', err);
  }

  return entry;
}

export function removeFromQueue(id: string) {
  setQueue(getQueue().filter(i => i.id !== id));
}

export function clearQueue() {
  setQueue([]);
}

export function queueSize(): number {
  return getQueue().length;
}

// Timeout helper para não prender a sincronização em redes lentas
function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout de rede')), ms)),
  ]);
}

// Conjunto de colunas válidas da tabela 'multas' no Supabase
const VALID_MULTAS_COLUMNS = new Set([
  'agente_email',
  'agente_id',
  'agente_nome',
  'alinea_punicao',
  'alinea_transgredida',
  'artigo_punicao',
  'artigo_transgredido',
  'assinado_em',
  'assinatura_agente',
  'assinatura_infrator',
  'categoria',
  'comprovativo_url',
  'created_at',
  'data_nascimento',
  'descricao_imovel',
  'dimensoes',
  'estado_civil',
  'estagio_obra',
  'forma_pagamento',
  'foto_documento',
  'fotos',
  'id',
  'infracao_tipo',
  'infrator_documento',
  'infrator_nome',
  'latitude',
  'legislacao',
  'local',
  'local_avenida',
  'local_casa',
  'local_pagamento',
  'local_quarteirao',
  'local_trabalho',
  'longitude',
  'matricula',
  'natural_de',
  'nome_mae',
  'nome_pai',
  'numero',
  'numero_auto',
  'numero_processo',
  'numero_punicao',
  'numero_transgredido',
  'observacoes',
  'offline_sync',
  'posto_administrativo',
  'profissao',
  'referencia_deposito',
  'residencia_avenida',
  'residencia_bairro',
  'residencia_casa',
  'residencia_quarteirao',
  'status',
  'tribunal_nome',
  'updated_at',
  'valor',
  'valor_extenso',
]);

/** Envia tudo o que está em fila de forma segura e idempotente. */
export async function syncQueue(): Promise<{ enviadas: number; falhadas: number }> {
  const items = getQueue();
  if (items.length === 0) return { enviadas: 0, falhadas: 0 };

  let enviadas = 0;
  let falhadas = 0;

  for (const item of items) {
    try {
      const rawPayload = { ...item.payload };

      // Se existir email do infrator ou telefone não incorporado, colocar nas observações
      if (rawPayload.infrator_email && typeof rawPayload.infrator_email === 'string') {
        const emailNote = `[Email: ${rawPayload.infrator_email}]`;
        if (!rawPayload.observacoes) rawPayload.observacoes = emailNote;
        else if (!rawPayload.observacoes.includes(emailNote)) rawPayload.observacoes += ` | ${emailNote}`;
      }

      // 1. Tentar fazer upload das fotos base64 para o storage com timeout seguro
      if (Array.isArray(rawPayload.fotos) && rawPayload.fotos.length > 0) {
        const updatedFotos: string[] = [];
        for (let i = 0; i < rawPayload.fotos.length; i++) {
          const photo = rawPayload.fotos[i];
          if (typeof photo === 'string' && photo.startsWith('data:image/')) {
            try {
              const res = await withTimeout(fetch(photo), 5000);
              const blob = await res.blob();
              const ext = blob.type.split('/')[1] || 'jpg';
              const path = `${rawPayload.numero || 'multa'}/${Date.now()}_${i}.${ext}`;
              const { error: upErr } = await withTimeout(
                supabase.storage.from('multa-fotos').upload(path, blob, {
                  cacheControl: '3600',
                  upsert: true,
                }),
                6000
              );
              if (!upErr) {
                const { data: uData } = supabase.storage.from('multa-fotos').getPublicUrl(path);
                updatedFotos.push(uData.publicUrl);
                continue;
              }
            } catch (e) {
              console.warn('[SyncQueue] Falha upload foto storage, mantendo imagem:', e);
            }
          }
          updatedFotos.push(photo);
        }
        rawPayload.fotos = updatedFotos;
      }

      // 2. Foto do documento
      if (typeof rawPayload.foto_documento === 'string' && rawPayload.foto_documento.startsWith('data:image/')) {
        try {
          const res = await withTimeout(fetch(rawPayload.foto_documento), 5000);
          const blob = await res.blob();
          const ext = blob.type.split('/')[1] || 'jpg';
          const path = `DOC_${rawPayload.numero || 'multa'}/${Date.now()}.${ext}`;
          const { error: upErr } = await withTimeout(
            supabase.storage.from('multa-fotos').upload(path, blob, {
              cacheControl: '3600',
              upsert: true,
            }),
            6000
          );
          if (!upErr) {
            const { data: uData } = supabase.storage.from('multa-fotos').getPublicUrl(path);
            rawPayload.foto_documento = uData.publicUrl;
          }
        } catch (e) {
          console.warn('[SyncQueue] Falha upload doc storage, mantendo:', e);
        }
      }

      // 3. Sanitizar payload para conter APENAS colunas existentes da tabela multas
      const cleanInsert: Record<string, any> = {
        offline_sync: true,
      };

      for (const [k, v] of Object.entries(rawPayload)) {
        if (VALID_MULTAS_COLUMNS.has(k)) {
          // Se for 'id' e não for um UUID padrão válido (ex: 'off-...'), remover para que o Postgres gere um UUID
          if (k === 'id') {
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v));
            if (isUUID) cleanInsert.id = v;
          } else {
            cleanInsert[k] = v;
          }
        }
      }

      // Se agente_id estiver vazio, obter do utilizador atual autenticado
      if (!cleanInsert.agente_id) {
        const { data: authData } = await supabase.auth.getUser();
        cleanInsert.agente_id = authData.user?.id || '00000000-0000-0000-0000-000000000000';
        if (!cleanInsert.agente_email && authData.user?.email) {
          cleanInsert.agente_email = authData.user.email;
        }
      }

      // 4. Verificar se a multa já foi inserida anteriormente pelo seu número
      let insertedRecord: any = null;
      if (cleanInsert.numero) {
        const { data: existing } = await supabase
          .from('multas')
          .select('id, numero')
          .eq('numero', cleanInsert.numero)
          .maybeSingle();

        if (existing) {
          insertedRecord = existing;
        }
      }

      // Se ainda não existe, inserir no Supabase
      if (!insertedRecord) {
        const { data, error } = await supabase
          .from('multas')
          .insert(cleanInsert as any)
          .select()
          .single();

        if (error) {
          console.error('[SyncQueue] Erro ao sincronizar multa:', error, cleanInsert);
          falhadas++;
          continue;
        }
        insertedRecord = data;
      }

      // 5. Inserir auditoria e notificações associadas
      if (insertedRecord?.id) {
        if (item.audit) {
          try {
            await supabase.from('audit_log').insert({
              ...item.audit,
              resource_id: insertedRecord.id,
            } as any);
          } catch {}
        }
        if (item.notification) {
          try {
            await supabase.from('notifications').insert({
              ...item.notification,
              resource_id: insertedRecord.id,
            } as any);
          } catch {}
        }
      }

      // Sucesso: remover este item da fila
      removeFromQueue(item.id);

      // Actualizar estado no armazenamento local de offline_pendente para pendente
      try {
        const rawLocal = localStorage.getItem('sigemm_db_multas');
        if (rawLocal) {
          const localMultas = JSON.parse(rawLocal);
          const updatedLocal = localMultas.map((m: any) => {
            if (m.numero === item.payload?.numero || m.id === item.id) {
              return {
                ...m,
                id: insertedRecord?.id || m.id,
                status: 'pendente',
                offline_sync: false,
                isOfflineQueue: false,
              };
            }
            return m;
          });
          localStorage.setItem('sigemm_db_multas', JSON.stringify(updatedLocal));
          window.dispatchEvent(new CustomEvent('sigemm_db_update', { detail: { table: 'multas' } }));
        }
      } catch (e) {
        console.warn('[SyncQueue] Erro ao actualizar status local após sync:', e);
      }

      enviadas++;
    } catch (err) {
      console.error('[SyncQueue] Exceção durante sincronização:', err);
      falhadas++;
    }
  }

  if (enviadas > 0) {
    window.dispatchEvent(new CustomEvent('multas-updated'));
  }

  return { enviadas, falhadas };
}

/** Cache local de leitura (multas, tipos de multa) para consulta offline. */
export function cacheSet(key: string, value: unknown) {
  try {
    localStorage.setItem(`sigemm_cache_${key}`, JSON.stringify({ at: Date.now(), value }));
  } catch {}
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`sigemm_cache_${key}`);
    if (!raw) return null;
    return JSON.parse(raw).value as T;
  } catch {
    return null;
  }
}
