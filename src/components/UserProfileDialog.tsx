import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  User, Mail, Phone, MapPin, ShieldCheck, Calendar, Clock,
  MessageSquare, Copy, Check, ExternalLink, Radio, Building2,
  Car, Eye, Smartphone
} from 'lucide-react';
import { NIVEL_LABELS } from '@/hooks/useUserRole';

export interface UserProfileData {
  id?: string;
  user_id?: string;
  email: string;
  nome: string;
  cargo?: string;
  nivel_acesso?: string;
  foto_url?: string | null;
  telefone?: string | null;
  posto?: string;
  local_trabalho?: string;
  is_online?: boolean;
  last_seen?: string;
  latitude?: number | null;
  longitude?: number | null;
  numero_agente?: string;
  created_at?: string;
}

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfileData | null;
  currentUserId?: string;
  onStartChat?: (user: UserProfileData) => void;
}

export function UserProfileDialog({
  open,
  onOpenChange,
  user,
  currentUserId,
  onStartChat,
}: UserProfileDialogProps) {
  const navigate = useNavigate();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showFullPhoto, setShowFullPhoto] = useState(false);

  if (!user) return null;

  const isMe =
    (currentUserId && (user.user_id === currentUserId || user.id === currentUserId)) ||
    false;

  const getInitials = (name: string) => {
    if (!name) return 'AG';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`${label} copiado para a área de transferência`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatLastSeen = (dateStr?: string) => {
    if (!dateStr) return 'Sem registo recente';
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'há instantes';
      if (mins < 60) return `há ${mins} minutos`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `há ${hrs} horas`;
      return `há ${Math.floor(hrs / 24)} dias`;
    } catch {
      return dateStr;
    }
  };

  const nivelLabel = user.nivel_acesso
    ? (NIVEL_LABELS as any)[user.nivel_acesso] || user.nivel_acesso
    : 'Agente';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card">
          {/* Header Banner */}
          <div className="relative h-28 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 p-4 flex items-end justify-between">
            <div className="absolute top-3 left-4 flex items-center gap-1.5 text-white/80 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>SIGEMM · Perfil do Agente</span>
            </div>

            {user.numero_agente && (
              <span className="absolute top-3 right-10 bg-black/40 backdrop-blur-sm text-white text-[11px] font-mono font-bold px-2.5 py-1 rounded-md border border-white/25 shadow-xs flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                Nº do Agente: {user.numero_agente.toUpperCase().startsWith('AG-') || user.numero_agente.toUpperCase().startsWith('PM-')
                  ? user.numero_agente.toUpperCase()
                  : `AG-${user.numero_agente.padStart(3, '0')}`}
              </span>
            )}
          </div>

          {/* Profile Content Body */}
          <div className="px-5 pt-0 pb-5 space-y-4">
            {/* Avatar & Main Identity */}
            <div className="flex items-end justify-between -mt-12 mb-2">
              <div className="relative group">
                <Avatar
                  className="h-20 w-20 border-4 border-card rounded-2xl shadow-lg cursor-pointer transition-transform group-hover:scale-105 bg-background"
                  onClick={() => user.foto_url && setShowFullPhoto(true)}
                >
                  {user.foto_url && <AvatarImage src={user.foto_url} alt={user.nome} className="object-cover" />}
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                    {getInitials(user.nome)}
                  </AvatarFallback>
                </Avatar>

                {/* Online indicator badge */}
                <span
                  className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-card ${
                    user.is_online ? 'bg-green-500 shadow-sm ring-1 ring-green-400' : 'bg-slate-400'
                  }`}
                  title={user.is_online ? 'Utilizador Online' : 'Utilizador Offline'}
                />
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs px-2.5 py-0.5 font-semibold ${
                    user.is_online
                      ? 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {user.is_online ? '● Online Agora' : `Offline (${formatLastSeen(user.last_seen)})`}
                </Badge>

                {isMe && (
                  <Badge className="bg-primary text-primary-foreground text-xs">
                    Meu Perfil
                  </Badge>
                )}
              </div>
            </div>

            {/* Name, Role & Access Level */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-foreground leading-tight">{user.nome}</h3>
              </div>
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                {user.cargo || 'Polícia Municipal de Maputo'}
              </p>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-[11px] bg-muted px-2 py-0.5 rounded text-muted-foreground font-medium">
                  Nível: <strong>{nivelLabel}</strong>
                </span>
                {user.posto && (
                  <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                    Posto: {user.posto}
                  </span>
                )}
              </div>
            </div>

            {/* Details Cards */}
            <div className="grid grid-cols-1 gap-2 pt-2 border-t border-border">
              {/* Numero do Agente */}
              {user.numero_agente && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shadow-xs shrink-0 font-mono">
                      AG
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground font-medium">Número do Agente</p>
                      <p className="text-xs font-bold text-foreground font-mono">
                        {user.numero_agente.toUpperCase().startsWith('AG-') || user.numero_agente.toUpperCase().startsWith('PM-')
                          ? user.numero_agente.toUpperCase()
                          : `AG-${user.numero_agente.padStart(3, '0')}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => copyToClipboard(
                      user.numero_agente!.toUpperCase().startsWith('AG-') || user.numero_agente!.toUpperCase().startsWith('PM-')
                        ? user.numero_agente!.toUpperCase()
                        : `AG-${user.numero_agente!.padStart(3, '0')}`,
                      'Número do Agente'
                    )}
                    title="Copiar número do agente"
                  >
                    {copiedField === 'Número do Agente' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              )}

              {/* Email */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center text-primary shadow-xs shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground font-medium">Email Institucional</p>
                    <p className="text-xs font-semibold text-foreground truncate">{user.email}</p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() => copyToClipboard(user.email, 'Email')}
                  title="Copiar email"
                >
                  {copiedField === 'Email' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>

              {/* Telefone */}
              {user.telefone ? (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center text-emerald-600 shadow-xs shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground font-medium">Telefone / Contacto</p>
                      <p className="text-xs font-semibold text-foreground">{user.telefone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                      onClick={() => window.open(`tel:${user.telefone}`, '_self')}
                      title="Ligar para o agente"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => copyToClipboard(user.telefone!, 'Telefone')}
                      title="Copiar telefone"
                    >
                      {copiedField === 'Telefone' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              ) : null}

              {/* Local de Trabalho & Localização */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center text-accent shadow-xs shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground font-medium">Local de Actuação</p>
                    <p className="text-xs font-semibold text-foreground truncate">
                      {user.local_trabalho || 'Posto Operacional Municipal'}
                    </p>
                  </div>
                </div>
                {user.latitude && user.longitude && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1 px-2"
                    onClick={() => window.open(`https://maps.google.com/?q=${user.latitude},${user.longitude}`, '_blank')}
                  >
                    <ExternalLink className="w-3 h-3" /> Mapa
                  </Button>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              {!isMe && onStartChat && (
                <Button
                  className="flex-1 h-10 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs gap-2 rounded-xl"
                  onClick={() => {
                    onOpenChange(false);
                    onStartChat(user);
                  }}
                >
                  <MessageSquare className="w-4 h-4" />
                  Enviar Mensagem
                </Button>
              )}

              {isMe && (
                <Button
                  className="flex-1 h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-2 rounded-xl"
                  onClick={() => {
                    onOpenChange(false);
                    navigate('/perfil');
                  }}
                >
                  <User className="w-4 h-4" />
                  Editar Meu Perfil Completo
                </Button>
              )}

              {user.telefone && (
                <Button
                  variant="outline"
                  className="h-10 text-xs gap-1.5 px-3 rounded-xl border-emerald-600/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                  onClick={() => window.open(`tel:${user.telefone}`, '_self')}
                >
                  <Phone className="w-3.5 h-3.5" />
                  Ligar
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Photo Preview Dialog */}
      {showFullPhoto && user.foto_url && (
        <Dialog open={showFullPhoto} onOpenChange={setShowFullPhoto}>
          <DialogContent className="max-w-lg p-2 bg-black/90 border-none">
            <div className="relative">
              <img
                src={user.foto_url}
                alt={user.nome}
                className="w-full max-h-[80vh] object-contain rounded-lg"
              />
              <div className="absolute bottom-2 left-2 right-2 p-2 bg-black/60 backdrop-blur-md rounded text-white text-xs">
                <p className="font-bold">{user.nome}</p>
                <p className="text-[11px] text-white/80">{user.cargo || 'Polícia Municipal'}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
