import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons for leaflet + bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MultaLocation {
  id: string;
  numero: string;
  infrator_nome: string;
  infracao_tipo: string;
  valor: number;
  local: string;
  status: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export default function MapaPage() {
  const [multas, setMultas] = useState<MultaLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMultas();
  }, []);

  async function loadMultas() {
    const { data } = await supabase
      .from('multas')
      .select('id, numero, infrator_nome, infracao_tipo, valor, local, status, latitude, longitude, created_at')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('created_at', { ascending: false });

    setMultas((data as MultaLocation[]) ?? []);
    setLoading(false);
  }

  // Center on Maputo
  const center: [number, number] = [-25.9692, 32.5732];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mapa de Multas</h1>
        <p className="text-sm text-muted-foreground">{multas.length} multas com localização GPS</p>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">Carregando mapa...</Card>
      ) : multas.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
          Nenhuma multa com coordenadas GPS encontrada.
        </Card>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border" style={{ height: 'calc(100vh - 220px)', minHeight: '400px' }}>
          <MapContainer
            center={multas.length > 0 ? [multas[0].latitude, multas[0].longitude] : center}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {multas.map((multa) => (
              <Marker key={multa.id} position={[multa.latitude, multa.longitude]}>
                <Popup>
                  <div className="space-y-1 text-sm min-w-[180px]">
                    <p className="font-bold">{multa.infrator_nome}</p>
                    <p className="text-xs font-mono">{multa.numero}</p>
                    <p className="text-xs">{multa.infracao_tipo}</p>
                    <p className="text-xs">{multa.local}</p>
                    <div className="flex justify-between items-center pt-1">
                      <span className="font-semibold">{Number(multa.valor).toFixed(2)} MT</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        multa.status === 'paga' ? 'bg-green-100 text-green-700' :
                        multa.status === 'pendente' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>{multa.status}</span>
                    </div>
                    <p className="text-xs text-gray-500">{new Date(multa.created_at).toLocaleDateString('pt-MZ')}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
