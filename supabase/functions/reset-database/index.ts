import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLES = [
  "notification_reads",
  "notifications",
  "reclamacoes",
  "cancel_requests",
  "agent_messages",
  "agent_presence",
  "agent_login_logs",
  "multas",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const authCheck = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const body = await req.json().catch(() => ({}));
    const requesterEmail = String(body.requesterEmail || "").trim().toLowerCase();
    const presidentEmail = String(body.presidentEmail || "").trim().toLowerCase();
    const presidentPassword = String(body.presidentPassword || "");

    if (!requesterEmail || !presidentEmail || !presidentPassword) {
      return json({ error: "Todos os campos são obrigatórios" }, 400);
    }

    // Requester must be admin
    const { data: requester } = await admin
      .from("agentes").select("nivel_acesso, nome").eq("email", requesterEmail).maybeSingle();
    if (!requester || !["admin", "presidente"].includes(requester.nivel_acesso)) {
      return json({ error: "Apenas o administrador pode solicitar a reposição" }, 403);
    }

    // President must exist with the right role
    const { data: president } = await admin
      .from("agentes").select("nivel_acesso, nome").eq("email", presidentEmail).maybeSingle();
    if (!president || president.nivel_acesso !== "presidente") {
      return json({ error: "O email indicado não pertence ao Presidente do Município" }, 403);
    }

    const { error: authError } = await authCheck.auth.signInWithPassword({
      email: presidentEmail, password: presidentPassword,
    });
    if (authError) return json({ error: "Senha do Presidente incorrecta" }, 401);

    const deleted: Record<string, string> = {};
    for (const table of TABLES) {
      const { error } = await admin.from(table).delete().not("id", "is", null);
      deleted[table] = error ? `erro: ${error.message}` : "ok";
    }

    await admin.from("audit_log").insert({
      action: "RESET_BASE_DADOS",
      details: `Reposição da base de dados solicitada por ${requesterEmail} e autorizada por ${presidentEmail}`,
    });

    return json({ success: true, deleted });
  } catch (_err) {
    return json({ error: "Erro inesperado" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}