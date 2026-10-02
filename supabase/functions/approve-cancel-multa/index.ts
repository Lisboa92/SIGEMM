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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Cliente separado só para validar credenciais (não pode contaminar o admin)
    const supabaseAuthCheck = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { requestId, approverEmail, approverPassword, action } = await req.json();

    if (!requestId || !approverEmail || !approverPassword) {
      return new Response(JSON.stringify({ error: "Todos os campos são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the cancel request
    const { data: request } = await supabaseAdmin
      .from("cancel_requests")
      .select("*")
      .eq("id", requestId)
      .eq("status", "pending")
      .maybeSingle();

    if (!request) {
      return new Response(JSON.stringify({ error: "Pedido não encontrado ou já processado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify approver credentials
    const { error: authError } = await supabaseAuthCheck.auth.signInWithPassword({
      email: approverEmail,
      password: approverPassword,
    });
    if (authError) {
      return new Response(JSON.stringify({ error: "Senha incorrecta" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify approver role
    const { data: approverAgent } = await supabaseAdmin
      .from("agentes")
      .select("nivel_acesso, local_trabalho")
      .eq("email", approverEmail)
      .maybeSingle();

    if (approverAgent?.nivel_acesso !== request.approver_role) {
      const labels: Record<string, string> = {
        presidente: "Presidente do Município",
        admin: "administrador",
        supervisor: "supervisor",
      };
      const roleLabel = labels[request.approver_role] ?? request.approver_role;
      return new Response(JSON.stringify({ error: `Apenas um ${roleLabel} pode aprovar` }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isApproved = action !== 'reject';
    const newStatus = isApproved ? "approved" : "rejected";

    if (isApproved) {
      // Cancel the multa
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("multas")
        .update({ status: "cancelada", updated_at: new Date().toISOString() })
        .eq("id", request.multa_id)
        .select("id, status");

      if (updateError || !updated || updated.length === 0) {
        return new Response(JSON.stringify({ error: "Erro ao cancelar multa: " + updateError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update cancel request
    await supabaseAdmin
      .from("cancel_requests")
      .update({ status: newStatus, approved_by_email: approverEmail, resolved_at: new Date().toISOString() })
      .eq("id", requestId);

    // Log
    await supabaseAdmin.from("audit_log").insert({
      action: "CANCELAR_MULTA",
      details: `Multa ${request.multa_id} ${isApproved ? 'cancelada' : 'recusada'}. Solicitado por ${request.requester_email}, ${isApproved ? 'aprovado' : 'recusado'} por ${approverEmail}`,
      resource_id: request.multa_id,
    });

    // Send notification back to requester
    const localTrabalho = approverAgent?.local_trabalho || 'via_publica';
    const statusMsg = isApproved 
      ? `✅ Multa cancelada com sucesso — aprovado por ${approverEmail}`
      : `❌ Pedido de cancelamento recusado por ${approverEmail}`;

    await supabaseAdmin.from("notifications").insert({
      message: statusMsg,
      action: "CANCELAR_MULTA",
      resource_id: request.multa_id,
      local_trabalho: localTrabalho,
      created_by: null,
      target_user_id: request.requester_user_id,
    });

    // Email ao agente que solicitou
    try {
      await supabaseAdmin.functions.invoke("notify-email", {
        body: {
          to: request.requester_email,
          subject: `SIGEMM — Pedido de cancelamento ${isApproved ? "aprovado" : "recusado"}`,
          message: isApproved
            ? `O Presidente do Município (${approverEmail}) autorizou o cancelamento da multa. A multa encontra-se agora com o estado "Cancelada".`
            : `O Presidente do Município (${approverEmail}) recusou o pedido de cancelamento da multa. A multa mantém-se activa.`,
        },
      });
    } catch { /* email é best-effort */ }

    return new Response(JSON.stringify({ success: true, status: newStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro inesperado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
