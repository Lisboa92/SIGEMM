import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json({ error: "Nao autenticado" }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Sessao invalida. Volte a iniciar sessao." }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const currentPassword: string = body?.currentPassword ?? "";
    const newPassword: string = body?.newPassword ?? "";

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return json({ error: "A nova senha deve ter pelo menos 8 caracteres" }, 400);
    }
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[!@#$%^&*]/.test(newPassword)) {
      return json({ error: "A senha deve conter maiuscula, numero e caractere especial" }, 400);
    }

    if (currentPassword) {
      const checker = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error: signInErr } = await checker.auth.signInWithPassword({
        email: user.email || "",
        password: currentPassword,
      });
      if (signInErr) return json({ error: "Senha actual incorrecta" }, 401);
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
      password: newPassword,
      user_metadata: { ...(user.user_metadata || {}), must_change_password: false },
    });
    if (updErr) return json({ error: "Erro ao alterar senha: " + updErr.message }, 400);

    await admin.from("audit_log").insert({
      user_id: user.id,
      action: "ALTERAR_SENHA",
      details: "Senha alterada por " + user.email,
    });

    return json({ success: true });
  } catch {
    return json({ error: "Erro inesperado ao alterar senha" }, 500);
  }
});
