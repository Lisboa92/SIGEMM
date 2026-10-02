import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * SIGEMM · Envio de notificações por email.
 * Enquanto o domínio de envio não estiver configurado, o pedido é registado
 * no log de auditoria (para rastreabilidade) e devolve sent=false.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { to, subject, message } = await req.json();

    if (typeof to !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return new Response(JSON.stringify({ error: "Email inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof subject !== "string" || subject.length === 0 || subject.length > 200) {
      return new Response(JSON.stringify({ error: "Assunto inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof message !== "string" || message.length === 0 || message.length > 5000) {
      return new Response(JSON.stringify({ error: "Mensagem inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let sent = false;
    let detalhe = "domínio de envio ainda não configurado";

    try {
      const { error } = await admin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "notificacao-sigemm",
          recipientEmail: to,
          idempotencyKey: `${subject}-${to}-${Date.now()}`,
          templateData: { subject, message },
        },
      });
      if (!error) { sent = true; detalhe = "email enviado"; }
      else detalhe = String(error.message ?? error);
    } catch (e) {
      detalhe = String((e as Error).message);
    }

    await admin.from("audit_log").insert({
      action: "EMAIL_NOTIFICACAO",
      details: `Para: ${to} · ${subject} · ${sent ? "enviado" : `não enviado (${detalhe})`}`,
    });

    return new Response(JSON.stringify({ sent, detalhe }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Erro inesperado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
