import { column, Schema, Table } from '@powersync/web';

/**
 * Esquema de Base de Dados PowerSync para o SIGEMM
 * 
 * Espelha a base de dados PostgreSQL / Supabase para armazenamento SQLite
 * local de alto desempenho no dispositivo do agente municipal, permitindo
 * leitura e escrita ultra-rápidas e sincronização automática bidirecional.
 */

// Tabela de Multas
export const MultasTable = new Table(
  {
    numero: column.text,
    numero_auto: column.text,
    infrator_nome: column.text,
    infrator_documento: column.text,
    infracao_tipo: column.text,
    categoria: column.text,
    matricula: column.text,
    local: column.text,
    local_avenida: column.text,
    local_casa: column.text,
    local_quarteirao: column.text,
    local_trabalho: column.text,
    posto_administrativo: column.text,
    residencia_bairro: column.text,
    residencia_avenida: column.text,
    residencia_casa: column.text,
    residencia_quarteirao: column.text,
    valor: column.real,
    valor_extenso: column.text,
    status: column.text,
    forma_pagamento: column.text,
    local_pagamento: column.text,
    referencia_deposito: column.text,
    comprovativo_url: column.text,
    agente_id: column.text,
    agente_nome: column.text,
    agente_email: column.text,
    latitude: column.real,
    longitude: column.real,
    legislacao: column.text,
    artigo_transgredido: column.text,
    alinea_transgredida: column.text,
    numero_transgredido: column.text,
    artigo_punicao: column.text,
    alinea_punicao: column.text,
    numero_punicao: column.text,
    fotos: column.text, // JSON string
    foto_documento: column.text,
    assinatura_infrator: column.text,
    assinatura_agente: column.text,
    assinado_em: column.text,
    observacoes: column.text,
    offline_sync: column.integer,
    tribunal_nome: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      idx_multas_numero: ['numero'],
      idx_multas_status: ['status'],
      idx_multas_agente: ['agente_id'],
      idx_multas_created: ['created_at'],
    },
  }
);

// Tabela de Tipos de Multa / Enquadramento Legal
export const TiposMultaTable = new Table(
  {
    codigo: column.text,
    descricao: column.text,
    valor: column.real,
    categoria: column.text,
    artigo: column.text,
    alinea: column.text,
    numero: column.text,
    activo: column.integer,
    created_at: column.text,
  },
  {
    indexes: {
      idx_tipos_codigo: ['codigo'],
      idx_tipos_categoria: ['categoria'],
    },
  }
);

// Tabela de Agentes e Utilizadores
export const AgentesTable = new Table(
  {
    nome: column.text,
    username: column.text,
    numero_agente: column.text,
    cargo: column.text,
    nivel_acesso: column.text,
    local_trabalho: column.text,
    email: column.text,
    telefone: column.text,
    foto_url: column.text,
    activo: column.integer,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      idx_agentes_email: ['email'],
      idx_agentes_username: ['username'],
      idx_agentes_numero: ['numero_agente'],
    },
  }
);

// Tabela de Pagamentos e Quitações
export const PagamentosTable = new Table(
  {
    multa_id: column.text,
    numero_recibo: column.text,
    valor: column.real,
    forma_pagamento: column.text,
    referencia: column.text,
    agente_id: column.text,
    agente_nome: column.text,
    comprovativo_url: column.text,
    status: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      idx_pagamentos_multa: ['multa_id'],
      idx_pagamentos_recibo: ['numero_recibo'],
    },
  }
);

// Tabela de Reclamações e Contestações
export const ReclamacoesTable = new Table(
  {
    multa_id: column.text,
    numero_auto: column.text,
    requerente_nome: column.text,
    requerente_documento: column.text,
    requerente_telefone: column.text,
    motivo: column.text,
    parecer: column.text,
    status: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      idx_reclamacoes_multa: ['multa_id'],
      idx_reclamacoes_status: ['status'],
    },
  }
);

// Tabela de Auditoria (Audit Log)
export const AuditLogTable = new Table(
  {
    action: column.text,
    details: column.text,
    resource_id: column.text,
    user_id: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      idx_audit_resource: ['resource_id'],
      idx_audit_user: ['user_id'],
    },
  }
);

// Tabela de Notificações
export const NotificationsTable = new Table(
  {
    message: column.text,
    action: column.text,
    local_trabalho: column.text,
    user_id: column.text,
    read: column.integer,
    created_at: column.text,
  },
  {
    indexes: {
      idx_notif_user: ['user_id'],
      idx_notif_read: ['read'],
    },
  }
);

// Esquema Global do PowerSync
export const AppSchema = new Schema({
  multas: MultasTable,
  tipos_multa: TiposMultaTable,
  agentes: AgentesTable,
  pagamentos: PagamentosTable,
  reclamacoes: ReclamacoesTable,
  audit_log: AuditLogTable,
  notifications: NotificationsTable,
});

export type DatabaseSchema = typeof AppSchema;
