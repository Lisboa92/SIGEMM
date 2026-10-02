import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * SIGEMM · Pedido de reposição de senha dirigido ao Administrador.
 * Não expõe se a conta existe (resposta genérica) para evitar enumeração de utilizadores.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { identificador } = await req.json();

    if (typeof identificador !== "string" || identificador.trim().length < 3 || identificador.length > 200) {
      return new Response(JSON.stringify({ error: "Introduza o seu email ou nome de utilizador" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const valor = identificador.trim().toLowerCase();
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const coluna = valor.includes("@") ? "email" : "username";
    const { data: agente } = await admin
      .from("agentes")
      .select("nome, email, username, local_trabalho")
      .eq(coluna, valor)
      .maybeSingle();

    if (agente) {
      await admin.from("password_reset_requests").insert({
        email: agente.email,
        username: agente.username,
        nome: agente.nome,
        metodo: "admin",
      });

      await admin.from("notifications").insert({
        message: `Pedido de reposição de senha: ${agente.nome} (${agente.email}). Defina uma senha provisória e envie-a por email.`,
        action: "RESET_SENHA",
        local_trabalho: agente.local_trabalho ?? "via_publica",
        target_role: "admin",
      });

      await admin.from("audit_log").insert({
        action: "PEDIDO_RESET_SENHA",
        details: `Pedido de reposição de senha submetido para ${agente.email}`,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, message: "Se a conta existir, o administrador foi notificado e receberá instruções." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch {
    return new Response(JSON.stringify({ error: "Erro inesperado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});