import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

    // Find agents who haven't been online in 2 days and are still active
    const { data: inactiveAgents } = await supabaseAdmin
      .from("agent_presence")
      .select("user_id, email, nome")
      .lt("last_seen", twoDaysAgo);

    if (!inactiveAgents || inactiveAgents.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum agente inactivo encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deactivated: string[] = [];

    for (const agent of inactiveAgents) {
      // Check if the agent is active
      const { data: agenteRecord } = await supabaseAdmin
        .from("agentes")
        .select("id, activo, nivel_acesso, local_trabalho")
        .eq("email", agent.email)
        .eq("activo", true)
        .maybeSingle();

      if (!agenteRecord || agenteRecord.nivel_acesso === 'admin') continue;

      // Deactivate
      await supabaseAdmin
        .from("agentes")
        .update({ activo: false })
        .eq("id", agenteRecord.id);

      // Notify admins
      await supabaseAdmin.from("notifications").insert({
        message: `⚠️ Agente ${agent.nome || agent.email} desactivado automaticamente — 2 dias sem aceder ao sistema`,
        action: "AGENTE",
        local_trabalho: agenteRecord.local_trabalho || "via_publica",
        created_by: null,
      });

      // Audit log
      await supabaseAdmin.from("audit_log").insert({
        action: "DESACTIVAR_AGENTE_AUTO",
        details: `Agente ${agent.nome || agent.email} desactivado por inactividade (2 dias)`,
        resource_id: agenteRecord.id,
      });

      deactivated.push(agent.email);
    }

    return new Response(JSON.stringify({ 
      message: `${deactivated.length} agente(s) desactivado(s)`,
      deactivated 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
