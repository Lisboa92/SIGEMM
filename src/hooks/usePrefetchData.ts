import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function usePrefetchData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    // Prefetch all core data in parallel
    const prefetch = async () => {
      await Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: ['multas'],
          queryFn: async () => {
            const { data } = await supabase.from('multas').select('*').order('created_at', { ascending: false });
            return data ?? [];
          },
          staleTime: 2 * 60 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['agente-info', user.email],
          queryFn: async () => {
            const { data } = await supabase.from('agentes').select('*').eq('email', user.email || '').maybeSingle();
            return data;
          },
          staleTime: 5 * 60 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['tipos-multa'],
          queryFn: async () => {
            const { data } = await supabase.from('tipos_multa').select('tipo, valor, categoria').eq('activo', true);
            return data ?? [];
          },
          staleTime: 10 * 60 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['locais-pagamento'],
          queryFn: async () => {
            const { data } = await supabase.from('locais_pagamento').select('nome').eq('activo', true);
            return (data ?? []).map(l => l.nome);
          },
          staleTime: 10 * 60 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['agentes'],
          queryFn: async () => {
            const { data } = await supabase.from('agentes').select('*').order('nome');
            return data ?? [];
          },
          staleTime: 5 * 60 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['agent-presence'],
          queryFn: async () => {
            const { data } = await supabase.from('agent_presence').select('*');
            return data ?? [];
          },
          staleTime: 60 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['multas-stats'],
          queryFn: async () => {
            const [total, pagas, pendentes, hoje] = await Promise.all([
              supabase.from('multas').select('*', { count: 'exact', head: true }),
              supabase.from('multas').select('*', { count: 'exact', head: true }).eq('status', 'paga'),
              supabase.from('multas').select('*', { count: 'exact', head: true }).eq('status', 'pendente'),
              supabase.from('multas').select('*', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().split('T')[0]),
            ]);
            return {
              total: total.count ?? 0,
              pagas: pagas.count ?? 0,
              pendentes: pendentes.count ?? 0,
              hoje: hoje.count ?? 0,
            };
          },
          staleTime: 2 * 60 * 1000,
        }),
      ]);
    };

    prefetch();
  }, [user, queryClient]);
}
