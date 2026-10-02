import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function gerarSenhaProvisoria() {
  const maiusc = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const minusc = "abcdefghijkmnopqrstuvwxyz";
  const nums = "23456789";
  const esp = "!@#$%^&*";
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const base = [pick(maiusc), pick(minusc), pick(esp), pick(nums), pick(nums)];
  while (base.length < 12) base.push(pick(maiusc + minusc + nums));
  return base.sort(() => Math.random() - 0.5).join("");
}

/**
 * SIGEMM · Recuperação de senha por email.
 * Gera uma senha provisória, aplica-a à conta e envia-a por email.
 * Resposta genérica para não revelar se a conta existe.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const generic = () =>
    new Response(
      JSON.stringify({ ok: true, message: "Se a conta existir, foi enviada uma senha provisória para o email indicado." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  try {
    const { email } = await req.json();
    if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      return new Response(JSON.stringify({ error: "Email inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const alvo = email.trim().toLowerCase();
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    let targetUser: any = null;
    for (let page = 1; page <= 40 && !targetUser; page++) {
      const { data: users } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      const lista = users?.users ?? [];
      targetUser = lista.find((u: any) => (u.email ?? "").toLowerCase() === alvo) ?? null;
      if (lista.length < 200) break;
    }

    if (!targetUser) return generic();

    const senha = gerarSenhaProvisoria();
    const { error: updErr } = await admin.auth.admin.updateUserById(targetUser.id, {
      password: senha,
      user_metadata: { ...targetUser.user_metadata, must_change_password: true },
    });
    if (updErr) {
      return new Response(JSON.stringify({ error: "Não foi possível repor a senha: " + updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: agente } = await admin.from("agentes").select("nome").eq("email", alvo).maybeSingle();

    await admin.functions.invoke("notify-email", {
      body: {
        to: alvo,
        subject: "SIGEMM — Senha provisória de acesso",
        message: `Olá ${agente?.nome ?? ""},\n\nFoi solicitada a reposição da sua senha do SIGEMM.\n\nSenha provisória: ${senha}\n\nEntre com esta senha e o sistema pedir-lhe-á que a altere imediatamente no primeiro acesso.\n\nSe não foi você a solicitar, contacte de imediato o administrador do sistema.`,
      },
    }).catch(() => {});

    await admin.from("password_reset_requests").insert({
      email: alvo,
      nome: agente?.nome ?? null,
      metodo: "email",
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by_email: "sistema",
    });

    await admin.from("audit_log").insert({
      action: "RESET_SENHA_EMAIL",
      details: `Senha provisória gerada e enviada por email para ${alvo}`,
    });

    return generic();
  } catch {
    return new Response(JSON.stringify({ error: "Erro inesperado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
