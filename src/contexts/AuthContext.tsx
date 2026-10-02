import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  mustChangePassword: boolean;
  setMustChangePassword: (v: boolean) => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, metadata?: Record<string, any>) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const loginLogIdRef = useRef<string | null>(null);

  // Create login log entry
  const createLoginLog = async (loggedUser: User) => {
    try {
      const { data: agent } = await supabase
        .from('agentes')
        .select('nome, local_trabalho')
        .eq('email', loggedUser.email || '')
        .maybeSingle();

      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {}

      const { data } = await supabase.from('agent_login_logs').insert({
        user_id: loggedUser.id,
        email: loggedUser.email || '',
        nome: agent?.nome || loggedUser.user_metadata?.nome || '',
        local_trabalho: agent?.local_trabalho || 'via_publica',
        latitude: lat,
        longitude: lng,
      } as any).select('id').single();

      if (data?.id) {
        loginLogIdRef.current = data.id;
      }
    } catch (e) {
      console.warn('Log de login:', e);
    }
  };

  // Update logout time on login log
  const updateLogoutLog = async () => {
    if (!loginLogIdRef.current) return;
    const logId = loginLogIdRef.current;
    loginLogIdRef.current = null;

    try {
      const now = new Date();
      const { data: logEntry } = await supabase
        .from('agent_login_logs')
        .select('login_at')
        .eq('id', logId)
        .single();

      let duration: number | null = null;
      if (logEntry?.login_at) {
        duration = Math.floor((now.getTime() - new Date(logEntry.login_at).getTime()) / 60000);
      }

      await supabase.from('agent_login_logs').update({
        logout_at: now.toISOString(),
        duration_minutes: duration,
      } as any).eq('id', logId);
    } catch (e) {
      console.warn('Log de logout:', e);
    }
  };

  // Update presence when user changes
  useEffect(() => {
    if (!user) return;

    const updatePresence = async () => {
      try {
        const { data: agent } = await supabase
          .from('agentes')
          .select('nome, local_trabalho')
          .eq('email', user.email || '')
          .maybeSingle();

        const nome = agent?.nome || user.user_metadata?.nome || user.email?.split('@')[0] || '';
        const local = agent?.local_trabalho || 'via_publica';

        await supabase.from('agent_presence').upsert({
          user_id: user.id,
          email: user.email || '',
          nome,
          local_trabalho: local,
          is_online: true,
          last_seen: new Date().toISOString(),
        } as any, { onConflict: 'user_id' });

        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          await supabase.from('agent_presence').update({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          } as any).eq('user_id', user.id);
        } catch {}
      } catch (e) {
        console.warn('Presença de agente:', e);
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (_event === 'SIGNED_IN' && session?.user) {
        if (session.user.user_metadata?.must_change_password) {
          setMustChangePassword(true);
        }
        createLoginLog(session.user);
      }
      if (_event === 'USER_UPDATED' && session?.user?.user_metadata?.must_change_password === false) {
        setMustChangePassword(false);
      }
      if (_event === 'SIGNED_OUT') {
        await updateLogoutLog();
      }
      
      setLoading(false);
    });

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user?.user_metadata?.must_change_password) {
          setMustChangePassword(true);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Falha na sessão auth:', err);
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, metadata?: Record<string, any>) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    if (user) {
      await supabase.from('agent_presence').update({ is_online: false } as any).eq('user_id', user.id);
    }
    setMustChangePassword(false);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, mustChangePassword, setMustChangePassword, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
