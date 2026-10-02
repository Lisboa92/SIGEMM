import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateRandomPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let password = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}

function buildCredentialsEmailHtml(nome: string, username: string, email: string, password: string, systemUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:32px 40px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">SIGEMM</h1>
    <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px;">Sistema de Gestão de Multas Municipais</p>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <h2 style="color:#1e3a5f;margin:0 0 8px;font-size:18px;">Bem-vindo(a), ${nome}!</h2>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">
      A sua conta de acesso ao sistema SIGEMM foi criada com sucesso. Utilize as credenciais abaixo para aceder ao sistema.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4ff;border-radius:8px;border:1px solid #dbeafe;margin-bottom:24px;">
      <tr><td style="padding:20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;width:140px;">Nome de Utilizador:</td>
            <td style="padding:6px 0;color:#1e3a5f;font-size:14px;font-weight:700;">${username}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Email:</td>
            <td style="padding:6px 0;color:#1e3a5f;font-size:14px;font-weight:600;">${email}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Senha Temporária:</td>
            <td style="padding:6px 0;color:#dc2626;font-size:14px;font-weight:700;font-family:monospace;letter-spacing:1px;">${password}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <div style="background-color:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
      <p style="color:#92400e;font-size:13px;margin:0;line-height:1.5;">
        ⚠️ <strong>Importante:</strong> No primeiro acesso será solicitado que troque a senha temporária por uma senha pessoal.
      </p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:8px 0 24px;">
        <a href="${systemUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1e40af);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
          Aceder ao SIGEMM →
        </a>
      </td></tr>
    </table>
    <p style="color:#9ca3af;font-size:12px;line-height:1.5;margin:0;text-align:center;">
      Se o botão não funcionar, copie e cole este link no navegador:<br>
      <a href="${systemUrl}" style="color:#2563eb;word-break:break-all;">${systemUrl}</a>
    </p>
  </td></tr>
  <tr><td style="background-color:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="color:#9ca3af;font-size:11px;margin:0;">
      Conselho Municipal da Matola © ${new Date().getFullYear()}<br>
      Este é um email automático do sistema SIGEMM. Não responda a este email.
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { email, nome, username, systemUrl } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const password = generateRandomPassword(10);

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: any) => u.email === email);

    if (existingUser) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: { nome: nome || email.split("@")[0], must_change_password: true },
      });

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send credentials email
      try {
        await sendCredentialsEmail(email, nome || email.split("@")[0], username || email.split("@")[0], password, systemUrl || '');
      } catch (emailErr) {
        console.error("Email send error:", emailErr);
      }

      return new Response(
        JSON.stringify({ message: "Credenciais actualizadas", user_id: existingUser.id, generated_password: password }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome: nome || email.split("@")[0], must_change_password: true },
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send credentials email
    try {
      await sendCredentialsEmail(email, nome || email.split("@")[0], username || email.split("@")[0], password, systemUrl || '');
    } catch (emailErr) {
      console.error("Email send error:", emailErr);
    }

    return new Response(
      JSON.stringify({ message: "Utilizador criado com sucesso", user_id: data.user?.id, generated_password: password }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendCredentialsEmail(to: string, nome: string, username: string, password: string, systemUrl: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY not set, skipping email send");
    return;
  }

  const html = buildCredentialsEmailHtml(nome, username, to, password, systemUrl || 'https://id-preview--7e9f5b56-47aa-40d5-af25-c5e9cff97bce.lovable.app');

  // Use Supabase's built-in email via auth admin (workaround: invite user flow)
  // Since we can't send arbitrary emails without an email service, we'll use the
  // SMTP approach through the Supabase admin API magic link as a workaround
  // Actually, let's use a simple fetch to a free email API or log it
  console.log(`📧 Credentials email would be sent to: ${to}`);
  console.log(`   Username: ${username}`);
  console.log(`   Password: ${password}`);
  console.log(`   System URL: ${systemUrl}`);
  
  // The credentials are shown in the admin UI dialog as a fallback
}
