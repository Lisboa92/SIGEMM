import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { email, new_password } = await req.json();

    if (!email || !new_password) {
      return new Response(
        JSON.stringify({ error: "Email e nova senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new_password.length < 8) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter pelo menos 8 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find user by email (percorre todas as páginas — listUsers devolve 50 por defeito)
    const alvo = String(email).trim().toLowerCase();
    let targetUser: any = null;
    for (let page = 1; page <= 40 && !targetUser; page++) {
      const { data: users, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (listErr) {
        return new Response(JSON.stringify({ error: "Erro ao consultar utilizadores: " + listErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const lista = users?.users ?? [];
      targetUser = lista.find((u: any) => (u.email ?? "").toLowerCase() === alvo) ?? null;
      if (lista.length < 200) break;
    }

    if (!targetUser) {
      // O agente existe no sistema mas ainda não tem conta de autenticação criada.
      const { data: agente } = await supabaseAdmin
        .from("agentes")
        .select("nome, numero_agente, nivel_acesso")
        .eq("email", alvo)
        .maybeSingle();

      if (!agente) {
        return new Response(
          JSON.stringify({ error: "Utilizador não encontrado no sistema" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: alvo,
        password: new_password,
        email_confirm: true,
        user_metadata: {
          nome: agente.nome,
          numero_agente: agente.numero_agente,
          nivel_acesso: agente.nivel_acesso,
          must_change_password: true,
        },
      });

      if (createErr || !created?.user) {
        return new Response(
          JSON.stringify({ error: "Não foi possível criar a conta de acesso: " + (createErr?.message ?? "erro desconhecido") }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ message: "Conta criada e senha provisória definida com sucesso" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update password and set must_change_password flag
    const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
      password: new_password,
      user_metadata: { ...targetUser.user_metadata, must_change_password: true },
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ message: "Senha actualizada com sucesso" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
