export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agent_login_logs: {
        Row: {
          duration_minutes: number | null
          email: string
          id: string
          latitude: number | null
          local_trabalho: string | null
          login_at: string
          logout_at: string | null
          longitude: number | null
          multas_pagas: number | null
          multas_registadas: number | null
          nome: string | null
          user_id: string
        }
        Insert: {
          duration_minutes?: number | null
          email: string
          id?: string
          latitude?: number | null
          local_trabalho?: string | null
          login_at?: string
          logout_at?: string | null
          longitude?: number | null
          multas_pagas?: number | null
          multas_registadas?: number | null
          nome?: string | null
          user_id: string
        }
        Update: {
          duration_minutes?: number | null
          email?: string
          id?: string
          latitude?: number | null
          local_trabalho?: string | null
          login_at?: string
          logout_at?: string | null
          longitude?: number | null
          multas_pagas?: number | null
          multas_registadas?: number | null
          nome?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agent_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean
          receiver_email: string
          receiver_id: string
          receiver_nome: string | null
          sender_email: string
          sender_id: string
          sender_nome: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean
          receiver_email: string
          receiver_id: string
          receiver_nome?: string | null
          sender_email: string
          sender_id: string
          sender_nome?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          receiver_email?: string
          receiver_id?: string
          receiver_nome?: string | null
          sender_email?: string
          sender_id?: string
          sender_nome?: string | null
        }
        Relationships: []
      }
      agent_presence: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_online: boolean | null
          last_seen: string | null
          latitude: number | null
          local_trabalho: string | null
          longitude: number | null
          nome: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_online?: boolean | null
          last_seen?: string | null
          latitude?: number | null
          local_trabalho?: string | null
          longitude?: number | null
          nome?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_online?: boolean | null
          last_seen?: string | null
          latitude?: number | null
          local_trabalho?: string | null
          longitude?: number | null
          nome?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agentes: {
        Row: {
          activo: boolean
          cargo: string
          created_at: string
          email: string
          foto_url: string | null
          id: string
          local_trabalho: string
          nivel_acesso: string
          nome: string
          numero_agente: string
          telefone: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          activo?: boolean
          cargo?: string
          created_at?: string
          email: string
          foto_url?: string | null
          id?: string
          local_trabalho?: string
          nivel_acesso?: string
          nome: string
          numero_agente: string
          telefone?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          activo?: boolean
          cargo?: string
          created_at?: string
          email?: string
          foto_url?: string | null
          id?: string
          local_trabalho?: string
          nivel_acesso?: string
          nome?: string
          numero_agente?: string
          telefone?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          resource_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          resource_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          resource_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cancel_requests: {
        Row: {
          approved_by_email: string | null
          approver_email: string | null
          approver_nome: string | null
          approver_role: string
          approver_user_id: string | null
          created_at: string
          id: string
          motivo: string | null
          multa_id: string
          requester_email: string
          requester_role: string
          requester_user_id: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          approved_by_email?: string | null
          approver_email?: string | null
          approver_nome?: string | null
          approver_role: string
          approver_user_id?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
          multa_id: string
          requester_email: string
          requester_role: string
          requester_user_id: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          approved_by_email?: string | null
          approver_email?: string | null
          approver_nome?: string | null
          approver_role?: string
          approver_user_id?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
          multa_id?: string
          requester_email?: string
          requester_role?: string
          requester_user_id?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: []
      }
      locais_pagamento: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      multas: {
        Row: {
          agente_email: string | null
          agente_id: string
          agente_nome: string | null
          alinea_punicao: string | null
          alinea_transgredida: string | null
          artigo_punicao: string | null
          artigo_transgredido: string | null
          assinado_em: string | null
          assinatura_agente: string | null
          assinatura_infrator: string | null
          categoria: string
          comprovativo_url: string | null
          created_at: string
          data_nascimento: string | null
          descricao_imovel: string | null
          dimensoes: string | null
          estado_civil: string | null
          estagio_obra: string | null
          forma_pagamento: string | null
          foto_documento: string | null
          fotos: string[] | null
          id: string
          infracao_tipo: string
          infrator_documento: string | null
          infrator_nome: string
          latitude: number | null
          legislacao: string | null
          local: string
          local_avenida: string | null
          local_casa: string | null
          local_pagamento: string | null
          local_quarteirao: string | null
          local_trabalho: string | null
          longitude: number | null
          matricula: string | null
          natural_de: string | null
          nome_mae: string | null
          nome_pai: string | null
          numero: string
          numero_auto: string | null
          numero_processo: string | null
          numero_punicao: string | null
          numero_transgredido: string | null
          observacoes: string | null
          offline_sync: boolean
          posto_administrativo: string | null
          profissao: string | null
          referencia_deposito: string | null
          residencia_avenida: string | null
          residencia_bairro: string | null
          residencia_casa: string | null
          residencia_quarteirao: string | null
          status: string
          tribunal_nome: string | null
          updated_at: string
          valor: number
          valor_extenso: string | null
        }
        Insert: {
          agente_email?: string | null
          agente_id: string
          agente_nome?: string | null
          alinea_punicao?: string | null
          alinea_transgredida?: string | null
          artigo_punicao?: string | null
          artigo_transgredido?: string | null
          assinado_em?: string | null
          assinatura_agente?: string | null
          assinatura_infrator?: string | null
          categoria?: string
          comprovativo_url?: string | null
          created_at?: string
          data_nascimento?: string | null
          descricao_imovel?: string | null
          dimensoes?: string | null
          estado_civil?: string | null
          estagio_obra?: string | null
          forma_pagamento?: string | null
          foto_documento?: string | null
          fotos?: string[] | null
          id?: string
          infracao_tipo: string
          infrator_documento?: string | null
          infrator_nome: string
          latitude?: number | null
          legislacao?: string | null
          local: string
          local_avenida?: string | null
          local_casa?: string | null
          local_pagamento?: string | null
          local_quarteirao?: string | null
          local_trabalho?: string | null
          longitude?: number | null
          matricula?: string | null
          natural_de?: string | null
          nome_mae?: string | null
          nome_pai?: string | null
          numero: string
          numero_auto?: string | null
          numero_processo?: string | null
          numero_punicao?: string | null
          numero_transgredido?: string | null
          observacoes?: string | null
          offline_sync?: boolean
          posto_administrativo?: string | null
          profissao?: string | null
          referencia_deposito?: string | null
          residencia_avenida?: string | null
          residencia_bairro?: string | null
          residencia_casa?: string | null
          residencia_quarteirao?: string | null
          status?: string
          tribunal_nome?: string | null
          updated_at?: string
          valor?: number
          valor_extenso?: string | null
        }
        Update: {
          agente_email?: string | null
          agente_id?: string
          agente_nome?: string | null
          alinea_punicao?: string | null
          alinea_transgredida?: string | null
          artigo_punicao?: string | null
          artigo_transgredido?: string | null
          assinado_em?: string | null
          assinatura_agente?: string | null
          assinatura_infrator?: string | null
          categoria?: string
          comprovativo_url?: string | null
          created_at?: string
          data_nascimento?: string | null
          descricao_imovel?: string | null
          dimensoes?: string | null
          estado_civil?: string | null
          estagio_obra?: string | null
          forma_pagamento?: string | null
          foto_documento?: string | null
          fotos?: string[] | null
          id?: string
          infracao_tipo?: string
          infrator_documento?: string | null
          infrator_nome?: string
          latitude?: number | null
          legislacao?: string | null
          local?: string
          local_avenida?: string | null
          local_casa?: string | null
          local_pagamento?: string | null
          local_quarteirao?: string | null
          local_trabalho?: string | null
          longitude?: number | null
          matricula?: string | null
          natural_de?: string | null
          nome_mae?: string | null
          nome_pai?: string | null
          numero?: string
          numero_auto?: string | null
          numero_processo?: string | null
          numero_punicao?: string | null
          numero_transgredido?: string | null
          observacoes?: string | null
          offline_sync?: boolean
          posto_administrativo?: string | null
          profissao?: string | null
          referencia_deposito?: string | null
          residencia_avenida?: string | null
          residencia_bairro?: string | null
          residencia_casa?: string | null
          residencia_quarteirao?: string | null
          status?: string
          tribunal_nome?: string | null
          updated_at?: string
          valor?: number
          valor_extenso?: string | null
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          id: string
          notification_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          notification_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          notification_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action: string
          created_at: string | null
          created_by: string | null
          id: string
          local_trabalho: string
          message: string
          resource_id: string | null
          target_role: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          local_trabalho: string
          message: string
          resource_id?: string | null
          target_role?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          local_trabalho?: string
          message?: string
          resource_id?: string | null
          target_role?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      password_reset_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          metodo: string
          nome: string | null
          resolved_at: string | null
          resolved_by_email: string | null
          status: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metodo?: string
          nome?: string | null
          resolved_at?: string | null
          resolved_by_email?: string | null
          status?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metodo?: string
          nome?: string | null
          resolved_at?: string | null
          resolved_by_email?: string | null
          status?: string
          username?: string | null
        }
        Relationships: []
      }
      reclamacoes: {
        Row: {
          created_at: string
          criado_por: string | null
          criado_por_email: string | null
          descricao: string
          id: string
          motivo: string
          multa_id: string | null
          multa_numero: string | null
          reclamante_contacto: string | null
          reclamante_documento: string | null
          reclamante_nome: string
          respondido_em: string | null
          respondido_por_email: string | null
          resposta: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          criado_por_email?: string | null
          descricao: string
          id?: string
          motivo: string
          multa_id?: string | null
          multa_numero?: string | null
          reclamante_contacto?: string | null
          reclamante_documento?: string | null
          reclamante_nome: string
          respondido_em?: string | null
          respondido_por_email?: string | null
          resposta?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          criado_por_email?: string | null
          descricao?: string
          id?: string
          motivo?: string
          multa_id?: string | null
          multa_numero?: string | null
          reclamante_contacto?: string | null
          reclamante_documento?: string | null
          reclamante_nome?: string
          respondido_em?: string | null
          respondido_por_email?: string | null
          resposta?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reclamacoes_multa_id_fkey"
            columns: ["multa_id"]
            isOneToOne: false
            referencedRelation: "multas"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_multa: {
        Row: {
          activo: boolean
          categoria: string
          created_at: string
          id: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          activo?: boolean
          categoria?: string
          created_at?: string
          id?: string
          tipo: string
          updated_at?: string
          valor?: number
        }
        Update: {
          activo?: boolean
          categoria?: string
          created_at?: string
          id?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_username: { Args: { p_nome: string }; Returns: string }
      marcar_multas_fora_prazo: { Args: never; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
