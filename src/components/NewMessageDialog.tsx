import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2, Users, MessageSquare } from 'lucide-react';

interface Agent {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  local_trabalho: string;
  activo: boolean;
}

interface NewMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectUser: (agent: { id: string; email: string; nome: string }) => void;
}

export function NewMessageDialog({ open, onOpenChange, onSelectUser }: NewMessageDialogProps) {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadAgents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('agentes')
      .select('id, nome, email, cargo, local_trabalho, activo')
      .eq('activo', true)
      .order('nome');
    setAgents((data ?? []).filter(a => a.email !== user?.email));
    setLoading(false);
  }, [user?.email]);

  useEffect(() => {
    if (!open) return;
    loadAgents();
  }, [open, loadAgents]);

  const filtered = search.trim()
    ? agents.filter(a =>
        a.nome.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase()) ||
        a.cargo.toLowerCase().includes(search.toLowerCase())
      )
    : agents;

  const handleSelect = async (agent: Agent) => {
    // Get user_id from agent_presence
    const { data: presence } = await supabase
      .from('agent_presence')
      .select('user_id')
      .eq('email', agent.email)
      .maybeSingle();

    if (presence?.user_id) {
      onSelectUser({
        id: presence.user_id,
        email: agent.email,
        nome: agent.nome,
      });
      onOpenChange(false);
      setSearch('');
    } else {
      // Try auth lookup — fallback to creating presence entry
      onSelectUser({
        id: agent.id, // fallback to agent table id
        email: agent.email,
        nome: agent.nome,
      });
      onOpenChange(false);
      setSearch('');
    }
  };

  const localLabel = (val: string) => {
    const map: Record<string, string> = {
      via_publica: 'Via Pública', sede: 'Sede CMM', machava: 'Posto Machava',
      t3: 'Posto T3', escritorio: 'Escritório', campo: 'Campo',
      posto_sede: 'Posto Sede',
    };
    return map[val] || val;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[70vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            Nova Mensagem
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="p-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por nome, email ou cargo..."
              className="pl-9 h-9 text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* User list */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Users className="h-8 w-8 opacity-40" />
              <p className="text-xs">{search ? 'Nenhum utilizador encontrado' : 'Sem utilizadores disponíveis'}</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filtered.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => handleSelect(agent)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/5 transition-all active:scale-[0.98] text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">
                      {agent.nome[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{agent.nome}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{agent.cargo} • {localLabel(agent.local_trabalho)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
