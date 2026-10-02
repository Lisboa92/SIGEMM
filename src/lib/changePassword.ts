import { supabase } from '@/integrations/supabase/client';

/**
 * Altera a senha do utilizador autenticado de forma fiável.
 * Tenta primeiro a Edge Function (privilégios de administrador, evita bloqueios
 * de política do cliente) e, em caso de indisponibilidade, recorre ao cliente.
 */
export async function changePassword(opts: {
  newPassword: string;
  currentPassword?: string;
}): Promise<{ error: string | null }> {
  const { newPassword, currentPassword } = opts;

  try {
    const { data, error } = await supabase.functions.invoke('change-password', {
      body: { newPassword, currentPassword },
    });

    if (!error && data?.success) {
      // Sincroniza a sessão local (metadados actualizados no servidor)
      await supabase.auth.refreshSession().catch(() => {});
      return { error: null };
    }

    // Erro de validação devolvido pela função (senha actual errada, etc.)
    if (data?.error) return { error: data.error as string };

    // Falha de rede/função — tenta o caminho directo
    const { error: updErr } = await supabase.auth.updateUser({
      password: newPassword,
      data: { must_change_password: false },
    });
    if (updErr) return { error: traduzir(updErr.message) };
    return { error: null };
  } catch {
    const { error: updErr } = await supabase.auth.updateUser({
      password: newPassword,
      data: { must_change_password: false },
    });
    if (updErr) return { error: traduzir(updErr.message) };
    return { error: null };
  }
}

function traduzir(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes('should be different')) return 'A nova senha deve ser diferente da actual.';
  if (m.includes('pwned') || m.includes('compromised') || m.includes('leaked'))
    return 'Esta senha aparece em fugas de dados conhecidas. Escolha outra.';
  if (m.includes('weak') || m.includes('characters')) return 'Senha demasiado fraca. Use 8+ caracteres, maiúscula, número e símbolo.';
  if (m.includes('session') || m.includes('jwt')) return 'Sessão expirada. Volte a iniciar sessão e tente novamente.';
  return msg;
}
