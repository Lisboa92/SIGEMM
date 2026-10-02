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

    const { multaId, userEmail, userPassword, crossEmail, crossPassword } = await req.json();

    if (!multaId || !userEmail || !userPassword || !crossEmail || !crossPassword) {
      return new Response(JSON.stringify({ error: "Todos os campos são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the requesting user's credentials
    const { error: userAuthError } = await supabaseAdmin.auth.signInWithPassword({
      email: userEmail,
      password: userPassword,
    });
    if (userAuthError) {
      return new Response(JSON.stringify({ error: "Sua senha está incorrecta" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get requesting user's role
    const { data: userAgent } = await supabaseAdmin
      .from("agentes")
      .select("nivel_acesso")
      .eq("email", userEmail)
      .maybeSingle();

    const userRole = userAgent?.nivel_acesso;

    if (userRole !== "admin" && userRole !== "supervisor") {
      return new Response(JSON.stringify({ error: "Apenas supervisores e administradores podem cancelar multas" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the cross-role user's credentials
    const { error: crossAuthError } = await supabaseAdmin.auth.signInWithPassword({
      email: crossEmail,
      password: crossPassword,
    });
    if (crossAuthError) {
      return new Response(JSON.stringify({ error: "Senha do segundo autorizante está incorrecta" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get cross user's role
    const { data: crossAgent } = await supabaseAdmin
      .from("agentes")
      .select("nivel_acesso")
      .eq("email", crossEmail)
      .maybeSingle();

    const crossRole = crossAgent?.nivel_acesso;

    // Supervisor needs admin password, admin needs supervisor password
    if (userRole === "supervisor" && crossRole !== "admin") {
      return new Response(JSON.stringify({ error: "O segundo autorizante deve ser um administrador" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (userRole === "admin" && crossRole !== "supervisor") {
      return new Response(JSON.stringify({ error: "O segundo autorizante deve ser um supervisor" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Both verified — cancel the multa
    const { error: updateError } = await supabaseAdmin
      .from("multas")
      .update({ status: "cancelada" })
      .eq("id", multaId);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Erro ao cancelar multa: " + updateError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the action
    await supabaseAdmin.from("audit_log").insert({
      action: "CANCELAR_MULTA",
      details: `Multa ${multaId} cancelada por ${userEmail} (${userRole}) com autorização de ${crossEmail} (${crossRole})`,
      resource_id: multaId,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro inesperado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
