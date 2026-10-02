import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const email = "lisboa.cossa@cmm.gov.mz";
  const password = "lisboa123";
  const nome = "Lisboa Cossa";
  const username = "lisboa.cossa";

  // Create or update auth user
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find((u: any) => u.email === email);

  let userId: string;

  if (existingUser) {
    await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
      user_metadata: { nome, must_change_password: false },
    });
    userId = existingUser.id;
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome, must_change_password: false },
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    userId = data.user?.id || '';
  }

  // Upsert agente record
  const { data: existingAgent } = await supabaseAdmin
    .from("agentes")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingAgent) {
    await supabaseAdmin.from("agentes").update({
      nome, username, nivel_acesso: "admin", cargo: "admin", activo: true,
    }).eq("id", existingAgent.id);
  } else {
    await supabaseAdmin.from("agentes").insert({
      nome, email, username, numero_agente: "ADM-001",
      nivel_acesso: "admin", cargo: "admin", local_trabalho: "posto_sede",
      activo: true,
    });
  }

  return new Response(JSON.stringify({ 
    message: "Superuser criado!", 
    user: email, 
    username,
    password: "lisboa123" 
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
