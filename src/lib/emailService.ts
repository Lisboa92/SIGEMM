import { supabase } from '@/integrations/supabase/client';

export interface SendFineEmailParams {
  to: string;
  infratorNome: string;
  numeroAuto: string;
  numeroMulta: string;
  infracaoTipo: string;
  valor: number;
  local: string;
  matriculaOuPorta?: string;
  categoria?: 'movel' | 'imovel';
  agenteNome?: string;
  dataHora?: string;
  prazoPagamento?: string;
  entidade?: string;
  referencia?: string;
}

export interface SendCredentialsEmailParams {
  to: string;
  nome: string;
  username: string;
  password: string;
  systemUrl?: string;
}

export interface SendPasswordResetEmailParams {
  to: string;
  nome?: string;
  tempPassword: string;
  systemUrl?: string;
}

export interface SendGenericEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailDispatchResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

/**
 * Send Fine Notification email to the citizen / infrator
 */
export async function sendFineNoticeEmail(params: SendFineEmailParams): Promise<EmailDispatchResult> {
  try {
    if (!navigator.onLine) {
      return { success: false, error: 'Dispositivo sem ligação à internet. Não foi possível enviar o email.' };
    }

    const res = await fetch('/api/email/fine-notice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        systemUrl: window.location.origin,
      }),
    });

    const data = await res.json().catch(() => ({ error: 'Resposta inválida do servidor de email' }));
    if (!res.ok || data.error) {
      throw new Error(data.error || `Erro HTTP ${res.status}: Falha ao enviar aviso de multa`);
    }

    // Register in Supabase audit log
    try {
      await supabase.from('audit_log').insert({
        action: 'EMAIL_AVISO_MULTA',
        details: `Aviso da Multa ${params.numeroAuto} enviado por email para ${params.to} (${params.infratorNome} - ${params.valor} MT)`,
      });
    } catch {
      // Non-blocking audit failure
    }

    return { success: true, messageId: data.messageId, simulated: data.simulated };
  } catch (err: any) {
    console.warn('[EmailService] Falha ao enviar aviso de multa:', err);
    return { success: false, error: err.message || 'Falha no envio do email de aviso de multa' };
  }
}

/**
 * Send account credentials email when an agent / user is created
 */
export async function sendCredentialsEmail(params: SendCredentialsEmailParams): Promise<EmailDispatchResult> {
  try {
    if (!navigator.onLine) {
      return { success: false, error: 'Dispositivo sem ligação à internet.' };
    }

    const res = await fetch('/api/email/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        systemUrl: params.systemUrl || window.location.origin,
      }),
    });

    const data = await res.json().catch(() => ({ error: 'Resposta inválida do servidor' }));
    if (!res.ok || data.error) {
      throw new Error(data.error || `Erro HTTP ${res.status}: Falha ao enviar credenciais por email`);
    }

    // Register in Supabase audit log
    try {
      await supabase.from('audit_log').insert({
        action: 'EMAIL_CREDENCIAIS',
        details: `Credenciais de acesso enviadas por email para ${params.to} (${params.username})`,
      });
    } catch {
      // Non-blocking
    }

    return { success: true, messageId: data.messageId, simulated: data.simulated };
  } catch (err: any) {
    console.warn('[EmailService] Falha ao enviar credenciais:', err);
    return { success: false, error: err.message || 'Falha no envio do email de credenciais' };
  }
}

/**
 * Send temporary password reset email
 */
export async function sendPasswordResetEmail(params: SendPasswordResetEmailParams): Promise<EmailDispatchResult> {
  try {
    if (!navigator.onLine) {
      return { success: false, error: 'Dispositivo sem ligação à internet. Não foi possível enviar a senha.' };
    }

    const res = await fetch('/api/email/password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        systemUrl: params.systemUrl || window.location.origin,
      }),
    });

    const data = await res.json().catch(() => ({ error: 'Resposta inválida do servidor' }));
    if (!res.ok || data.error) {
      throw new Error(data.error || `Erro HTTP ${res.status}: Falha ao enviar senha provisória`);
    }

    try {
      await supabase.from('audit_log').insert({
        action: 'EMAIL_RESET_SENHA',
        details: `Senha provisória enviada por email para ${params.to}`,
      });
    } catch {
      // Non-blocking
    }

    return { success: true, messageId: data.messageId, simulated: data.simulated };
  } catch (err: any) {
    console.warn('[EmailService] Falha ao enviar email de reposição de senha:', err);
    return { success: false, error: err.message || 'Falha no envio do email de senha' };
  }
}

/**
 * Send generic email
 */
export async function sendGenericEmail(params: SendGenericEmailParams): Promise<EmailDispatchResult> {
  try {
    if (!navigator.onLine) {
      return { success: false, error: 'Dispositivo sem ligação à internet.' };
    }

    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({ error: 'Resposta inválida do servidor' }));
    if (!res.ok || data.error) {
      throw new Error(data.error || `Erro HTTP ${res.status}: Falha ao enviar email`);
    }

    return { success: true, messageId: data.messageId, simulated: data.simulated };
  } catch (err: any) {
    console.warn('[EmailService] Falha ao enviar email:', err);
    return { success: false, error: err.message || 'Falha no envio do email' };
  }
}

export interface EmailStatusInfo {
  activeMode: 'resend' | 'smtp' | 'simulado';
  configured: boolean;
  fromAddress: string;
  smtpHost: string | null;
  smtpPort: string;
  smtpUser: string | null;
  smtpSecure: boolean;
  hasResendKey: boolean;
  timestamp: string;
}

/**
 * Fetch server-side email subsystem configuration status
 */
export async function getEmailStatus(): Promise<EmailStatusInfo | null> {
  try {
    const res = await fetch('/api/email/status');
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[EmailService] Erro ao obter estado do email:', err);
    return null;
  }
}

/**
 * Trigger an email dispatch test to a specific destination
 */
export async function sendTestEmail(to: string): Promise<EmailDispatchResult & { message?: string }> {
  try {
    if (!navigator.onLine) {
      return { success: false, error: 'Dispositivo sem ligação à internet.' };
    }

    const res = await fetch('/api/email/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to }),
    });

    const data = await res.json().catch(() => ({ error: 'Resposta inválida do servidor de teste' }));
    if (!res.ok || data.error) {
      throw new Error(data.error || `Erro HTTP ${res.status}: Falha no teste de email`);
    }

    return {
      success: true,
      messageId: data.messageId,
      simulated: data.simulated,
      message: data.message,
    };
  } catch (err: any) {
    console.warn('[EmailService] Erro no teste de email:', err);
    return { success: false, error: err.message || 'Falha ao enviar e-mail de teste' };
  }
}

