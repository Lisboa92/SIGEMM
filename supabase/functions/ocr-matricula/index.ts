import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(JSON.stringify({ error: 'Imagem em falta' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Serviço de OCR indisponível' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              'És um leitor de matrículas de veículos de Moçambique. Devolve APENAS a matrícula lida, em maiúsculas, no formato "ABC 123 XX" quando possível. Se não conseguires ler, devolve exactamente NAO_LEGIVEL.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Qual é a matrícula visível nesta fotografia?' },
              { type: 'image_url', image_url: { url: imageBase64 } },
            ],
          },
        ],
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: 'Limite de pedidos atingido. Tente daqui a pouco.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: 'Créditos de IA esgotados.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Falha ao ler a matrícula' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content?.trim() ?? '';
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();

    if (!cleaned || cleaned.includes('NAO')) {
      return new Response(JSON.stringify({ matricula: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const chars = cleaned.replace(/\s/g, '');
    const formatted = chars.length > 6
      ? `${chars.slice(0, 3)} ${chars.slice(3, 6)} ${chars.slice(6, 8)}`
      : chars.length > 3
        ? `${chars.slice(0, 3)} ${chars.slice(3)}`
        : chars;

    return new Response(JSON.stringify({ matricula: formatted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Erro inesperado' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
