import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type NivelAcesso = 'superadmin' | 'presidente' | 'admin' | 'supervisor' | 'agente_campo' | 'agente_cobranca' | 'agente_fiscalizacao';

export const NIVEL_LABELS: Record<string, string> = {
  superadmin: 'SuperAdmin (Supremo)',
  presidente: 'Presidente do Município',
  admin: 'Administrador',
  supervisor: 'Supervisor',
  agente_campo: 'Agente de Campo',
  agente_cobranca: 'Agente de Cobrança',
  agente_fiscalizacao: 'Agente de Fiscalização',
};

interface UserRoleData {
  nivelAcesso: NivelAcesso;
  nome: string | null;
  cargo: string | null;
  username: string | null;
  loading: boolean;
}

// Module-level cache shared across all useUserRole consumers to prevent
// flicker / "Acesso Restrito" flashes during re-mounts and navigation.
const roleCache = new Map<string, Omit<UserRoleData, 'loading'>>();
const inflight = new Map<string, Promise<Omit<UserRoleData, 'loading'>>>();

export function useUserRole(): UserRoleData {
  const { user } = useAuth();
  const cached = user?.email ? roleCache.get(user.email) : null;
  const [data, setData] = useState<UserRoleData>(
    cached
      ? { ...cached, loading: false }
      : { nivelAcesso: 'agente_campo', nome: null, cargo: null, username: null, loading: true }
  );

  useEffect(() => {
    if (!user?.email) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    const email = user.email;
    const hit = roleCache.get(email);
    if (hit) {
      setData({ ...hit, loading: false });
      return;
    }

    const fetchRole = async () => {
      // Try by email first
      let { data: agent } = await supabase
        .from('agentes')
        .select('nivel_acesso, nome, cargo, username')
        .eq('email', email)
        .maybeSingle();

      // If not found by email, try by username from user metadata
      if (!agent && user.user_metadata?.username) {
        const { data: agentByUsername } = await supabase
          .from('agentes')
          .select('nivel_acesso, nome, cargo, username')
          .eq('username', user.user_metadata.username)
          .maybeSingle();
        agent = agentByUsername;
      }

      const isLisboa =
        email?.toLowerCase() === 'lisboacossa@gmail.com' ||
        email?.toLowerCase().startsWith('lisboa.cossa') ||
        user?.user_metadata?.username?.toLowerCase() === 'lisboa.cossa' ||
        user?.user_metadata?.username?.toLowerCase() === 'lisboacossa' ||
        user?.user_metadata?.nivel_acesso === 'superadmin';

      const resolved = {
        nivelAcesso: (isLisboa ? 'superadmin' : ((agent?.nivel_acesso as NivelAcesso) || 'agente_campo')),
        nome: agent?.nome || (isLisboa ? 'Lisboa Cossa' : null),
        cargo: isLisboa ? 'SuperAdmin' : (agent?.cargo || null),
        username: (agent as any)?.username || (isLisboa ? 'lisboa.cossa' : null),
      };
      roleCache.set(email, resolved);
      return resolved;
    };

    let active = true;
    let promise = inflight.get(email);
    if (!promise) {
      promise = fetchRole();
      inflight.set(email, promise);
      promise.finally(() => inflight.delete(email));
    }
    promise.then((resolved) => {
      if (active) setData({ ...resolved, loading: false });
    });
    return () => { active = false; };
  }, [user?.email, user?.user_metadata?.username, user?.user_metadata?.nivel_acesso]);

  return data;
}

export function canAccess(nivel: NivelAcesso, requiredLevel: 'superadmin' | 'presidente' | 'admin' | 'supervisor' | 'agente_campo'): boolean {
  // SuperAdmin possui autoridade suprema irrestrita sobre todas as secções e funcionalidades
  if (nivel === 'superadmin') return true;

  const hierarchy: Record<string, number> = {
    superadmin: 5,
    presidente: 4,
    admin: 3,
    supervisor: 2,
    agente_campo: 1,
    agente_cobranca: 1,
    agente_fiscalizacao: 1,
  };
  if (requiredLevel === 'superadmin') return nivel === 'superadmin';
  if (requiredLevel === 'presidente') return nivel === 'superadmin' || nivel === 'presidente';
  return (hierarchy[nivel] || 1) >= (hierarchy[requiredLevel] || 0);
}
