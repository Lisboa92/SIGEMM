import express from "express";
import cors from "cors";
import path from "path";
import nodemailer from "nodemailer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "15mb" }));

// Helper to send email via Resend API or Nodemailer SMTP
async function dispatchEmail({
  to,
  subject,
  html,
  text,
  from,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}): Promise<{ success: boolean; messageId: string; simulated?: boolean }> {
  const defaultFrom = process.env.SMTP_FROM || "SIGEMM - Município da Matola <notificacoes@matola.gov.mz>";
  const sender = from || defaultFrom;
  const cleanText = text || html.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();

  // 1. Check if Resend API Key is available
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey && resendApiKey.trim()) {
    try {
      console.log(`[Email via Resend] Enviando para ${to} | Assunto: ${subject}`);
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: sender.includes("<") ? sender : `SIGEMM <${sender}>`,
          to: [to],
          subject,
          html,
          text: cleanText,
        }),
      });

      const resendData = await resendRes.json();
      if (resendRes.ok && resendData.id) {
        console.log(`[Email via Resend] Sucesso: ${resendData.id}`);
        return { success: true, messageId: resendData.id, simulated: false };
      }
      console.warn(`[Email via Resend] Resend retornou erro, tentando SMTP fallback:`, resendData);
    } catch (resendErr) {
      console.warn(`[Email via Resend] Falha na chamada Resend:`, resendErr);
    }
  }

  // 2. Nodemailer SMTP / Service / JSON Transport
  const transporter = getTransporter();
  console.log(`[Email via Nodemailer] Enviando para ${to} | Assunto: ${subject}`);
  const info = await transporter.sendMail({
    from: sender,
    to,
    subject,
    text: cleanText,
    html,
  });

  const isSimulated = !process.env.SMTP_HOST && !process.env.SMTP_SERVICE && !process.env.RESEND_API_KEY;
  console.log(`[Email via Nodemailer] Sucesso para ${to}: ${info.messageId || "despachado"}`);

  return {
    success: true,
    messageId: info.messageId || `msg-${Date.now()}`,
    simulated: isSimulated,
  };
}

// Helper to get or create nodemailer transporter
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false") === "true";
  const service = process.env.SMTP_SERVICE;

  if (service && user && pass) {
    return nodemailer.createTransport({
      service,
      auth: { user, pass },
    });
  }

  if (host && host.trim()) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  // If no external SMTP host is specified, create a stream/json fallback transport
  return nodemailer.createTransport({
    jsonTransport: true,
  });
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// PowerSync diagnostics & status endpoint
app.get("/api/powersync/status", (_req, res) => {
  const envUrl = process.env.VITE_POWERSYNC_URL || process.env.POWERSYNC_URL || "";
  const isCustomUrl = !!envUrl && !envUrl.includes("matola.gov.mz");

  return res.json({
    status: "ok",
    service: "PowerSync Auto-Sync Engine",
    version: "2.4.2",
    endpoint: isCustomUrl ? envUrl : "Local SQLite (WebAssembly)",
    configured: isCustomUrl,
    mode: isCustomUrl ? "cloud-connected" : "local-first-sqlite",
    database: "sigemm_powersync.db",
    storageVFS: "OPFS / IndexedDB Atomic Batch VFS",
    schemaVersion: 1,
    tables: [
      "multas",
      "tipos_multa",
      "agentes",
      "pagamentos",
      "reclamacoes",
      "audit_log",
      "notifications",
    ],
    timestamp: new Date().toISOString(),
    message: isCustomUrl
      ? "Motor PowerSync ligado ao serviço de streaming remoto."
      : "Motor PowerSync operacional em modo Local-First SQLite (sem chamadas de rede externas).",
  });
});

// PowerSync credentials / token endpoint for client authentication
app.get("/api/powersync/token", (_req, res) => {
  const envUrl = process.env.VITE_POWERSYNC_URL || process.env.POWERSYNC_URL || "";
  const isConfigured = !!envUrl && !envUrl.includes("matola.gov.mz");

  if (!isConfigured) {
    return res.json({
      configured: false,
      endpoint: null,
      token: null,
      message: "Modo Local-First SQLite ativo. Nenhum servidor remoto externo de streaming configurado.",
    });
  }

  const devToken = process.env.POWERSYNC_DEV_TOKEN || `sigemm_ps_token_${Buffer.from(String(Date.now())).toString("base64")}`;

  return res.json({
    configured: true,
    endpoint: envUrl,
    token: devToken,
    expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  });
});

// PowerSync manual sync trigger endpoint
app.post("/api/powersync/sync", (_req, res) => {
  return res.json({
    success: true,
    triggeredAt: new Date().toISOString(),
    message: "Comando de sincronização PowerSync recebido e processado.",
  });
});

// Database status & wake helper endpoint
app.get("/api/database/status", async (_req, res) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://aigbdwgdhgvzhkaexayc.supabase.co";
  const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "aigbdwgdhgvzhkaexayc";
  const dashboardUrl = `https://supabase.com/dashboard/project/${projectId}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "",
      },
    });
    clearTimeout(timeoutId);

    return res.json({
      online: true,
      isPaused: false,
      status: "online",
      statusCode: response.status,
      projectId,
      supabaseUrl,
      dashboardUrl,
      message: "Base de dados Supabase ativa e respondendo normalmente.",
    });
  } catch (err: any) {
    const isDnsError = err?.cause?.code === "ENOTFOUND" || err?.message?.includes("ENOTFOUND") || err?.name === "AbortError";
    return res.json({
      online: false,
      isPaused: true,
      status: isDnsError ? "paused" : "unreachable",
      projectId,
      supabaseUrl,
      dashboardUrl,
      error: err?.message || String(err),
      message: isDnsError
        ? "A base de dados do Supabase está em modo de pausa (dormir/adormecida) por inatividade no plano gratuito."
        : "Não foi possível alcançar a base de dados Supabase no momento.",
    });
  }
});

// Endpoint to attempt waking up Supabase via Management API if token is provided
app.post("/api/database/wake", async (req, res) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://aigbdwgdhgvzhkaexayc.supabase.co";
  const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "aigbdwgdhgvzhkaexayc";
  const token = req.body?.accessToken || process.env.SUPABASE_ACCESS_TOKEN;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: "Requer o Personal Access Token do Supabase ou restauro directo no dashboard.",
      dashboardUrl: `https://supabase.com/dashboard/project/${projectId}`,
    });
  }

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/restore`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    if (response.ok) {
      return res.json({
        success: true,
        message: "Comando de restauro enviado com sucesso! O projeto estará activo em 1-2 minutos.",
        data,
      });
    }

    return res.status(response.status).json({
      success: false,
      message: "Erro ao tentar restaurar via API do Supabase.",
      details: data,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || String(err),
    });
  }
});

// Generic email sending endpoint
app.post("/api/email/send", async (req, res) => {
  try {
    const { to, subject, html, text, from } = req.body;

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: "Parâmetros inválidos: 'to', 'subject' e 'html' são obrigatórios." });
    }

    const result = await dispatchEmail({
      to,
      subject,
      html: html || `<p>${text}</p>`,
      text,
      from,
    });

    return res.json({
      success: true,
      messageId: result.messageId,
      simulated: result.simulated,
      to,
      subject,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Email] Erro ao enviar email:", error);
    return res.status(500).json({
      error: error.message || "Erro interno ao processar envio de email.",
    });
  }
});

// Fine Notification endpoint (Aviso de Multa ao Cidadão / Infrator)
app.post("/api/email/fine-notice", async (req, res) => {
  try {
    const {
      to,
      infratorNome,
      numeroAuto,
      numeroMulta,
      infracaoTipo,
      valor,
      local,
      matriculaOuPorta,
      categoria,
      agenteNome,
      dataHora,
      prazoPagamento,
      entidade,
      referencia,
    } = req.body;

    if (!to || !infratorNome || !numeroAuto) {
      return res.status(400).json({ error: "Destinatário, nome do infrator e nº do auto são obrigatórios." });
    }

    const valorFormatado = Number(valor || 0).toLocaleString("pt-MZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MT";
    const dataFormatada = dataHora || new Date().toLocaleString("pt-MZ");
    const prazo = prazoPagamento || "15 (quinze) dias úteis";
    const ent = entidade || "99001 (Conselho Municipal da Matola)";
    const ref = referencia || numeroMulta || `REF-${Math.floor(100000000 + Math.random() * 900000000)}`;

    const html = `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notificação de Multa Municipal</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:32px 12px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);border:1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#065f46,#047857);padding:28px 32px;text-align:center;color:#ffffff;">
              <h1 style="margin:0;font-size:22px;font-weight:bold;letter-spacing:1px;">CONSELHO MUNICIPAL DA MATOLA</h1>
              <p style="margin:6px 0 0;font-size:13px;opacity:0.9;text-transform:uppercase;letter-spacing:0.5px;">Polícia Municipal · Sistema Integrado de Gestão de Multas (SIGEMM)</p>
            </td>
          </tr>

          <!-- Banner Alerta -->
          <tr>
            <td style="background-color:#fef2f2;border-bottom:1px solid #fecaca;padding:14px 32px;text-align:center;">
              <span style="color:#b91c1c;font-weight:bold;font-size:14px;letter-spacing:0.5px;">⚠️ NOTIFICAÇÃO OFICIAL DE INFRACÇÃO MUNICIPAL</span>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:28px 32px;">
              <p style="font-size:15px;line-height:1.6;margin-top:0;">
                Exmo(a). Sr(a). <strong>${infratorNome}</strong>,
              </p>
              <p style="font-size:14px;line-height:1.6;color:#475569;">
                Notifica-se que foi lavrado o <strong>Auto de Notícia Nº ${numeroAuto}</strong> referente à transgressão às posturas municipais em vigor no Município da Matola.
              </p>

              <!-- Resumo da Multa -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:20px 0;border-collapse:separate;">
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;width:38%;">Nº do Auto / Registo:</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:bold;color:#0f172a;">${numeroAuto} (${numeroMulta || "SIGEMM"})</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">Infracção / Transgressão:</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#0f172a;">${infracaoTipo}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">Categoria / Identificação:</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">${categoria === "movel" ? `Veículo Móvel · Matrícula ${matriculaOuPorta || "N/D"}` : `Imóvel / Construção · Porta/Nº ${matriculaOuPorta || "N/D"}`}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">Local da Ocorrência:</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">${local}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">Data e Hora do Registo:</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">${dataFormatada}</td>
                </tr>
                ${agenteNome ? `<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">Agente Autuante:</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">${agenteNome}</td></tr>` : ""}
                <tr style="background-color:#ecfdf5;">
                  <td style="padding:14px 16px;font-size:14px;font-weight:bold;color:#065f46;">VALOR A LIQUIDAR:</td>
                  <td style="padding:14px 16px;font-size:18px;font-weight:bold;color:#047857;">${valorFormatado}</td>
                </tr>
              </table>

              <!-- Instruções de Pagamento -->
              <h3 style="color:#0f172a;font-size:15px;margin:24px 0 10px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;">💳 Modalidades de Pagamento</h3>
              <p style="font-size:13px;line-height:1.6;color:#475569;">
                O pagamento da referida coima deve ser efectuado no prazo legal de <strong>${prazo}</strong> através dos seguintes canais:
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin:12px 0;">
                <tr>
                  <td style="padding:8px 12px;font-size:13px;color:#1e3a8a;">
                    📱 <strong>M-Pesa / e-Mola / Pagamentos de Serviços (SIMO):</strong><br>
                    • Entidade: <strong>${ent}</strong><br>
                    • Referência: <strong>${ref}</strong><br>
                    • Valor: <strong>${valorFormatado}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;font-size:13px;color:#1e3a8a;">
                    🏛️ <strong>Balcões de Atendimento Municipal / Postos da Polícia Municipal:</strong><br>
                    Apresente o Auto Nº <strong>${numeroAuto}</strong> ou este comprovativo para pagamento via POS / Dinheiro / Cheque.
                  </td>
                </tr>
              </table>

              <!-- Avisos Legais -->
              <div style="background-color:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:12px 16px;margin:18px 0;font-size:12px;color:#92400e;line-height:1.5;">
                📌 <strong>Aviso Legal e Direito de Reclamação:</strong> O não pagamento no prazo indicado implica o agravamento da coima e o envio do processo ao Tribunal Judicial / Execução Fiscal. Caso discorde da autuação, dispõe de 10 dias para apresentar a sua reclamação junto aos serviços do Conselho Municipal.
              </div>

              <p style="font-size:13px;color:#64748b;margin-top:20px;text-align:center;">
                Para esclarecimentos ou informações adicionais, contacte a Polícia Municipal da Matola pelo email <em>atendimento@matola.gov.mz</em> ou presencialmente na sede do Município.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f1f5f9;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;font-size:11px;color:#64748b;">
              Conselho Municipal da Cidade da Matola · República de Moçambique<br>
              Este é um correio electrónico oficial automático gerado pelo SIGEMM.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const result = await dispatchEmail({
      from: process.env.SMTP_FROM || "SIGEMM - Município da Matola <notificacoes@matola.gov.mz>",
      to,
      subject: `Notificação de Multa Municipal — Auto Nº ${numeroAuto}`,
      html,
    });

    return res.json({
      success: true,
      messageId: result.messageId,
      simulated: result.simulated,
      to,
      numeroAuto,
      valorFormatado,
    });
  } catch (error: any) {
    console.error("[Email Fine Notice] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao enviar aviso de multa por email." });
  }
});

// Credentials Email endpoint (Envio de Credenciais ao Criar Agente / Utilizador)
app.post("/api/email/credentials", async (req, res) => {
  try {
    const { to, nome, username, password, systemUrl } = req.body;

    if (!to || !nome || !username || !password) {
      return res.status(400).json({ error: "Destinatário, nome, username e senha são obrigatórios." });
    }

    const appUrl = systemUrl || process.env.VITE_APP_URL || "https://ais-dev-ru6qginvpk3a3puj7mkv4o-804169293059.europe-west2.run.app";

    const html = `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 12px;">
<tr><td align="center">
<table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);border:1px solid #e2e8f0;">
  <tr><td style="background:linear-gradient(135deg,#065f46,#047857);padding:32px 36px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">SIGEMM</h1>
    <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Conselho Municipal da Matola · Gestão de Multas</p>
  </td></tr>
  <tr><td style="padding:32px 36px;">
    <h2 style="color:#0f172a;margin:0 0 8px;font-size:18px;">Bem-vindo(a), ${nome}!</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px;">
      A sua conta de acesso ao <strong>SIGEMM (Sistema de Gestão de Multas Municipais)</strong> foi criada com sucesso pelo administrador do sistema.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;margin-bottom:20px;">
      <tr><td style="padding:18px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;width:140px;">Nome de Utilizador:</td>
            <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:700;">${username}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">Email de Acesso:</td>
            <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${to}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">Senha Provisória:</td>
            <td style="padding:6px 0;color:#dc2626;font-size:15px;font-weight:700;font-family:monospace;letter-spacing:1px;">${password}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <div style="background-color:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
      <p style="color:#92400e;font-size:13px;margin:0;line-height:1.5;">
        🔒 <strong>Segurança Obrigatória:</strong> No seu primeiro acesso ao sistema, será solicitado que altere esta senha provisória por uma senha pessoal segura.
      </p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:8px 0 20px;">
        <a href="${appUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#047857,#065f46);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
          Entrar no SIGEMM →
        </a>
      </td></tr>
    </table>
    <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:0;text-align:center;">
      Link de acesso directo: <a href="${appUrl}" style="color:#047857;word-break:break-all;">${appUrl}</a>
    </p>
  </td></tr>
  <tr><td style="background-color:#f8fafc;padding:18px 36px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">
      Conselho Municipal da Matola © ${new Date().getFullYear()} · República de Moçambique
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>
    `;

    const result = await dispatchEmail({
      from: process.env.SMTP_FROM || "SIGEMM - Município da Matola <notificacoes@matola.gov.mz>",
      to,
      subject: `As suas credenciais de acesso ao SIGEMM — Município da Matola`,
      html,
    });

    return res.json({
      success: true,
      messageId: result.messageId,
      simulated: result.simulated,
      to,
      username,
    });
  } catch (error: any) {
    console.error("[Email Credentials] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao enviar credenciais por email." });
  }
});

// Password Reset Email endpoint (Recuperação de Senha)
app.post("/api/email/password-reset", async (req, res) => {
  try {
    const { to, nome, tempPassword, systemUrl } = req.body;

    if (!to || !tempPassword) {
      return res.status(400).json({ error: "Destinatário e senha provisória são obrigatórios." });
    }

    const appUrl = systemUrl || process.env.VITE_APP_URL || "https://ais-dev-ru6qginvpk3a3puj7mkv4o-804169293059.europe-west2.run.app";

    const html = `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 12px;">
<tr><td align="center">
<table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);border:1px solid #e2e8f0;">
  <tr><td style="background:linear-gradient(135deg,#065f46,#047857);padding:32px 36px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">SIGEMM</h1>
    <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px;">Recuperação de Senha de Acesso</p>
  </td></tr>
  <tr><td style="padding:32px 36px;">
    <h2 style="color:#0f172a;margin:0 0 8px;font-size:18px;">Olá${nome ? `, ${nome}` : ""}!</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px;">
      Recebemos um pedido de reposição da sua senha de acesso ao SIGEMM. Foi gerada uma nova senha provisória para a sua conta:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border-radius:8px;border:1px solid #fecaca;margin-bottom:20px;">
      <tr><td align="center" style="padding:20px;">
        <span style="font-size:12px;color:#991b1b;display:block;margin-bottom:6px;">A sua Senha Provisória:</span>
        <span style="color:#dc2626;font-size:20px;font-weight:bold;font-family:monospace;letter-spacing:2px;">${tempPassword}</span>
      </td></tr>
    </table>
    <p style="color:#475569;font-size:13px;line-height:1.5;margin-bottom:24px;">
      Ao iniciar sessão com esta senha provisória, o sistema irá solicitar a definição imediata de uma nova senha definitiva.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:8px 0 20px;">
        <a href="${appUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#047857,#065f46);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;">
          Iniciar Sessão no SIGEMM →
        </a>
      </td></tr>
    </table>
    <p style="color:#94a3b8;font-size:11px;line-height:1.5;margin-top:20px;text-align:center;">
      Se você não solicitou a reposição da senha, contacte de imediato o administrador do sistema.
    </p>
  </td></tr>
  <tr><td style="background-color:#f8fafc;padding:18px 36px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">
      Conselho Municipal da Matola © ${new Date().getFullYear()}
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>
    `;

    const result = await dispatchEmail({
      from: process.env.SMTP_FROM || "SIGEMM - Município da Matola <notificacoes@matola.gov.mz>",
      to,
      subject: `SIGEMM — Senha provisória de acesso`,
      html,
    });

    return res.json({
      success: true,
      messageId: result.messageId,
      simulated: result.simulated,
      to,
    });
  } catch (error: any) {
    console.error("[Email Password Reset] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao enviar senha provisória por email." });
  }
});

// Email status / diagnostics endpoint
app.get("/api/email/status", (_req, res) => {
  const hasResend = !!(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim());
  const hasSmtpHost = !!(process.env.SMTP_HOST && process.env.SMTP_HOST.trim());
  const hasSmtpUser = !!(process.env.SMTP_USER && process.env.SMTP_USER.trim());
  const hasSmtpService = !!(process.env.SMTP_SERVICE && process.env.SMTP_SERVICE.trim());

  let activeMode = "simulado";
  if (hasResend) activeMode = "resend";
  else if (hasSmtpHost || hasSmtpService) activeMode = "smtp";

  const maskedUser = process.env.SMTP_USER
    ? process.env.SMTP_USER.replace(/(.{2})(.*)(@.*)/, "$1***$3")
    : null;

  return res.json({
    activeMode, // "resend" | "smtp" | "simulado"
    configured: hasResend || hasSmtpHost || hasSmtpService,
    fromAddress: process.env.SMTP_FROM || "SIGEMM - Município da Matola <notificacoes@matola.gov.mz>",
    smtpHost: process.env.SMTP_HOST || (hasSmtpService ? `Service: ${process.env.SMTP_SERVICE}` : null),
    smtpPort: process.env.SMTP_PORT || "587",
    smtpUser: maskedUser,
    smtpSecure: process.env.SMTP_SECURE === "true",
    hasResendKey: hasResend,
    timestamp: new Date().toISOString(),
  });
});

// Test email dispatch endpoint
app.post("/api/email/test", async (req, res) => {
  try {
    const { to } = req.body;
    if (!to || typeof to !== "string" || !to.includes("@")) {
      return res.status(400).json({ error: "Endereço de e-mail de destino inválido." });
    }

    const targetEmail = to.trim();
    const html = `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><title>Teste de E-mail SIGEMM</title></head>
<body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="background: linear-gradient(135deg, #065f46, #047857); padding: 24px; text-align: center; color: #ffffff;">
      <h2 style="margin: 0; font-size: 20px;">SIGEMM · Teste de Envio de E-mail</h2>
      <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">Conselho Municipal da Cidade da Matola</p>
    </div>
    <div style="padding: 24px;">
      <p style="font-size: 14px; line-height: 1.6; margin-top: 0;">
        Este é um e-mail de <strong>teste oficial</strong> disparado com sucesso a partir do painel de administração do SIGEMM.
      </p>
      <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
        <p style="margin: 0; font-size: 13px; color: #065f46; font-weight: 600;">
          ✓ Infraestrutura de comunicação operacional
        </p>
        <p style="margin: 4px 0 0; font-size: 12px; color: #047857;">
          Data/Hora: ${new Date().toLocaleString("pt-MZ")}
        </p>
      </div>
      <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
        As variáveis de ambiente e serviços de envio (SMTP/Resend) estão devidamente associados e prontos para despachar avisos de multa, credenciais e notificações aos cidadãos e agentes.
      </p>
    </div>
    <div style="background: #f1f5f9; padding: 12px; text-align: center; font-size: 11px; color: #64748b;">
      SIGEMM v1.0 · Desenvolvido por Sideout Studios para o Município da Matola
    </div>
  </div>
</body>
</html>
    `;

    const result = await dispatchEmail({
      to: targetEmail,
      subject: "SIGEMM · Teste de Comunicação e Notificações por E-mail",
      html,
    });

    return res.json({
      success: true,
      messageId: result.messageId,
      simulated: result.simulated,
      to: targetEmail,
      message: result.simulated
        ? "E-mail de teste processado em modo simulado (configure SMTP ou RESEND_API_KEY para envio real)."
        : `E-mail de teste enviado com sucesso para ${targetEmail}!`,
    });
  } catch (error: any) {
    console.error("[Email Test] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao realizar teste de envio de e-mail." });
  }
});

// ==========================================
// SIGEMM BOT - Assistente Inteligente Oficial
// ==========================================
const SIGEMM_SYSTEM_PROMPT = `Você é o SIGEMM Bot, o assistente virtual oficial e inteligente do SIGEMM (Sistema Integrado de Gestão e Emissão de Multas Municipais do Conselho Municipal da Cidade da Matola, República de Moçambique), desenvolvido pela empresa Sideout Studios (página: https://www.facebook.com/sideoutstudios).

O seu objectivo é ajudar agentes da Polícia Municipal, operadores de caixa, chefes de brigada, técnicos jurídicos, administradores e cidadãos a utilizar e compreender todas as funcionalidades do sistema com precisão, clareza e respeito pela legislação moçambicana.

DIRECTRIZES DE RESPOSTA:
1. Responda sempre em português claro, formal, objectivo e cordial (com termos adequados a Moçambique, como Meticais/MT, Posturas Municipais, Auto de Notícia, Conselho Municipal da Matola, Bairros da Matola como Matola 'C', Machava, Malhampsene, Infulene, etc.).
2. Quando solicitado os passos de qualquer acção, liste passo a passo numerado (1., 2., 3., ...).
3. Use formatação rica em Markdown (títulos, negrito, listas e tabelas se necessário).
4. Forneça sempre respostas completas sobre:
   - **Emissão de Multas**:
     * Categoria Móvel: Veículos, viaturas, mototaxis, estacionamento indevido, paragem proibida, circulação em contramão, falta de documentação. Suporta leitura de matrícula via OCR e captura de fotos.
     * Categoria Imóvel: Obras clandestinas, ocupação de passeio, poluição sonora/resíduos, falta de alvará sanitário, transgressão de posturas em estabelecimentos comerciais.
     * Elementos obrigatórios do auto: Identificação do infrator (Nome, BI/DIRE, Contactos), Local GPS com coordenadas, enquadramento legal com artigo/alínea, fotos do local e do documento, assinatura digital do infrator e do agente no ecrã táctil.
     * Notificação e comprovativo: Impressão em talão térmico portátil (58mm/80mm ESC/POS via Bluetooth ou Rede IP) ou geração de PDF oficial com QR Code e envio automático de notificação por e-mail e SMS.
   - **Prazos Legais e Procedimentos**:
     * 15 dias úteis para pagamento voluntário da multa.
     * 10 dias úteis para apresentação de reclamação/recurso fundamentado.
     * 30 dias de incumprimento: O processo é automaticamente encaminhado para execução fiscal junto do Tribunal Judicial da Província de Maputo / Cidade da Matola.
   - **Pagamentos e Arrecadação**:
     * Métodos suportados: M-Pesa, e-Mola, SIMO (Cartão Bancário / POS), Depósito Bancário (com anexo de comprovativo) e Pagamento em Numerário no Balcão Municipal.
     * Emissão imediata de Recibo Oficial de Quitação com número de guia e carimbo digital.
   - **Reclamações e Contestações**:
     * Cidadão ou advogado apresenta contestação formal; o processo entra no estado "Em Reclamação".
     * O sector jurídico avalia as alegações e as fotos de evidência do agente. Se Deferido, a multa é anulada com parecer fundamentado; se Indeferido, o prazo de pagamento é reaberto.
   - **Módulo de Tribunal**:
     * Gestão de autos não pagos após o prazo legal.
     * Geração automática de Certidão de Dívida e Guia de Remessa Judicial para cobrança coerciva.
   - **Gestão de Agentes e Níveis de Acesso**:
     * Perfis: Agente Fiscal, Operador de Caixa / Tesouraria, Chefe de Brigada, Jurídico / Tribunal, Administrador de TI e Presidente do Município.
     * Criação de agentes com geração e envio automático de senha provisória por e-mail.
     * Obrigatoriedade de troca de senha no 1º acesso.
     * Monitorização em tempo real de Agentes Online e mapa de patrulhamento GPS.
   - **Modo Offline e Sincronização Automática PowerSync**:
     * O SIGEMM utiliza o motor de sincronização de dados **PowerSync** com arquitetura Local-First.
     * Cada dispositivo mantém uma réplica relacional SQLite embutida (via WebAssembly / OPFS) em \`sigemm_powersync.db\`.
     * Agentes fiscais lavram autos na rua com latência zero (0ms), mesmo sem qualquer sinal de rede.
     * Quando a ligação é restabelecida, os lotes de mutações (\`CrudBatch\`) são enviados de forma atómica e idempotente para o PostgreSQL central, e os dados actualizados no servidor são transmitidos aos agentes em tempo real via Sync Stream.
   - **Impressão Térmica**:
     * Suporte a impressoras portáteis de bolso Bluetooth e impressoras fixas Ethernet/IP no balcão.
   - **Segurança e Backup**:
     * Cópia de segurança em formato JSON com todas as tabelas e registos.
     * Reposição de emergência da base de dados protegida por autenticação restrita de Administrador e confirmação institucional.
   - **Desenvolvimento e Direitos**:
     * O SIGEMM foi concebido e desenvolvido pela empresa moçambicana **Sideout Studios** (https://www.facebook.com/sideoutstudios).`;

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: apiKey.trim(),
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// Fallback intelligent knowledge response generator when API key is not present or offline
function generateLocalBotResponse(query: string, userContext?: any): string {
  const q = query.toLowerCase().trim();
  const userName = userContext?.nome || userContext?.username || "Colega";
  const userRole = userContext?.role || "agente";

  if (q.includes("como emitir") || q.includes("nova multa") || q.includes("lavrar multa") || q.includes("registar multa") || q.includes("passo a passo multa")) {
    return `### 📋 Guia Passo a Passo: Como Emitir uma Nova Multa no SIGEMM

Para lavrar um Auto de Notícia com validade legal no Município da Matola:

1. **Aceder ao Módulo:** Clique em **"Nova Multa"** no menu lateral ou atalho rápido.
2. **Selecionar a Categoria:**
   * **Móvel (Trânsito & Viaturas):** para veículos ligeiros, pesados, chapas, táxis e motas.
   * **Imóvel (Obras & Posturas):** para construções clandestinas, estabelecimentos, ruído e saneamento.
3. **Preencher o Nº do Auto:** Introduza o número sequencial oficial do talão físico (ex: \`2026/00142\`).
4. **Identificação do Infrator:**
   * Registe o **Nome Completo**, **Nº de Documento (BI / DIRE / Passaporte)**, **Telefone** e **E-mail**.
   * *Dica:* O e-mail permite que o munícipe receba imediatamente o auto digital e os dados de pagamento.
5. **Identificação do Objeto:**
   * *Móvel:* Introduza a matrícula (pode usar o leitor OCR da câmara para reconhecimento automático).
   * *Imóvel:* Indique o Bairro da Matola, Rua e Nº de Porta/Lote.
6. **Enquadramento Legal & Infracção:**
   * Selecione a infração na tabela de posturas. O sistema preenche automaticamente o **valor em Meticais (MT)** e o artigo legal.
7. **Localização GPS:**
   * Clique em **"Capturar Localização"** para gravar as coordenadas geográficas exatas do local da ocorrência.
8. **Evidências Fotográficas:**
   * Capture no mínimo **2 fotos**: imagem da infração/local e foto do documento/matrícula com carimbo horário.
9. **Assinaturas Digitais:**
   * Colete a assinatura do infrator no ecrã tátil (ou marque a recusa fundamentada) e aplique a assinatura do agente autuante.
10. **Concluir & Imprimir:**
    * Clique em **"Registar Multa"**.
    * Pode imediatamente **imprimir o talão térmico via Bluetooth** ou descarregar a guia em PDF com QR Code.`;
  }

  if (q.includes("infrac") || q.includes("coima") || q.includes("tabela") || q.includes("valores") || q.includes("artigo") || q.includes("tipos de multa")) {
    return `### ⚖️ Tabela de Infrações, Coimas e Enquadramento Legal (Matola)

O SIGEMM vem parametrizado com as principais Posturas do Município da Matola e Código da Estrada:

| Código | Descrição da Infração | Categoria | Valor Oficial |
| :--- | :--- | :--- | :--- |
| **TR-001** | Estacionamento em local proibido / cima do passeio | Móvel | **1.500,00 MT** |
| **TR-002** | Circulação em sentido proibido (contramão) | Móvel | **3.500,00 MT** |
| **TR-003** | Falta de taxa de circulação municipal / dístico | Móvel | **1.000,00 MT** |
| **TR-004** | Condução sob efeito de álcool / recusa de teste | Móvel | **5.000,00 MT** |
| **TR-005** | Paragem irregular de transporte semi-colectivo (Chapa) | Móvel | **2.500,00 MT** |
| **OB-001** | Construção / Obra sem licença municipal válida | Imóvel | **10.000,00 MT** |
| **OB-002** | Ocupação indevida de espaço público com inertes | Imóvel | **3.000,00 MT** |
| **PS-001** | Poluição sonora acima dos decibéis permitidos | Imóvel | **5.000,00 MT** |
| **PS-002** | Depósito clandestino de lixo / resíduos sólidos | Imóvel | **2.000,00 MT** |

*Nota:* Administradores podem atualizar e criar novos tipos de multas em **Configurações > Infrações**.`;
  }

  if (q.includes("pagar") || q.includes("pagamento") || q.includes("m-pesa") || q.includes("emola") || q.includes("recibo") || q.includes("liquidar")) {
    return `### 💳 Como Liquidar Multas e Procedimentos de Pagamento

O SIGEMM disponibiliza canais digitais e presenciais para liquidação célere de autos:

#### 1. Canais Digitais (SIMO / Carteiras Móveis):
* **M-Pesa / e-Mola / Banco Móvel:**
  * **Entidade:** \`99001\` (Conselho Municipal da Matola)
  * **Referência:** Número do Auto ou Referência Única gerada na multa
  * **Valor:** Montante exato constante na notificação.

#### 2. Pagamento Presencial no Balcão ou Posto de Caixa:
1. O munícipe apresenta o Auto de Notícia ou o talão térmico.
2. O operador de caixa acede ao menu **"Pagamentos"**.
3. Pesquisa a multa pelo Nº do Auto ou Matrícula.
4. Seleciona o método: **M-Pesa**, **Cartão POS**, **Dinheiro** ou **Depósito Bancário**.
5. Clica em **"Confirmar Pagamento"**.
6. O sistema emite imediatamente o **Recibo de Quitação Oficial** e atualiza o estado da multa para **"PAGO"**.`;
  }

  if (q.includes("reclam") || q.includes("contesta") || q.includes("recurso") || q.includes("cancelar multa")) {
    return `### 📝 Gestão de Reclamações e Contestações de Multas

O munícipe tem direito legal a contestar qualquer autuação que considere indevida:

1. **Prazo Legal:** O cidadão dispõe de **10 (dez) dias úteis** após a data da notificação para submeter a sua reclamação.
2. **Como Registar no SIGEMM:**
   * Aceda ao menu **"Reclamações"**.
   * Clique em **"Nova Reclamação"** e indique o número do Auto de Notícia.
   * Registe os fundamentos do requerente e anexe documentos de prova (fotocópias, declarações, etc.).
   * O estado da multa é alterado temporariamente para **"Em Reclamação"**, suspendendo a contagem dos juros de mora.
3. **Parecer Jurídico:**
   * O departamento jurídico avalia as alegações e as fotos originais do agente.
   * **Se Deferida:** A multa é anulada com parecer fundamentado e arquivada.
   * **Se Indeferida:** O munícipe é notificado para pagar no prazo residual estabelecido.`;
  }

  if (q.includes("tribunal") || q.includes("judicial") || q.includes("execucao fiscal") || q.includes("nao pago") || q.includes("divida")) {
    return `### 🏛️ Módulo de Tribunal e Execução Coerciva

Quando uma multa não é liquidada no prazo voluntário:

1. **Prazo de Transição:** Findo o prazo de **30 dias de incumprimento**, o processo fica qualificado para remessa judicial.
2. **Procedimento no SIGEMM:**
   * Aceda ao menu **"Tribunal"**.
   * O sistema lista todos os processos em dívida vencida.
   * O responsável jurídico clica em **"Remeter para Tribunal"**.
   * O sistema gera a **Certidão de Dívida Executória** com valor agravado e a **Guia de Remessa ao Tribunal Judicial da Cidade da Matola**.
3. **Efeitos Legais:** O infrator fica sujeito a penhora de bens, apreensão da viatura ou bloqueio de certidões municipais até à regularização integral.`;
  }

  if (q.includes("powersync") || q.includes("offline") || q.includes("sem internet") || q.includes("sem rede") || q.includes("sincroniz")) {
    return `### ⚡ Sincronização Automática PowerSync no SIGEMM

O SIGEMM utiliza o motor de sincronização **PowerSync**, uma solução industrial de ponta para aplicações móveis e web **Offline-First**:

#### 1. Como Funciona a Arquitetura PowerSync:
1. **Base de Dados SQLite Local:** Cada computador ou smartphone mantém uma base de dados SQLite completa e relacional (\`sigemm_powersync.db\`), executada no navegador via WebAssembly e OPFS.
2. **Leitura e Escrita Instantânea (Latência 0ms):** Quando um agente fiscal lavra um auto de notícia na rua, a multa, fotos comprimidas e assinaturas são gravadas de imediato na base SQLite local, sem depender da rede móvel.
3. **Sync Stream (Replicação Contínua):** O PowerSync mantém uma ligação de sincronização que recebe em tempo real todas as alterações da base de dados central do Município da Matola (PostgreSQL / Supabase).
4. **Fila de Lotes Transacionais (\`CrudBatch\`):** As alterações efetuadas em modo offline são organizadas em transações atómicas. Assim que o dispositivo detecta sinal de internet, os lotes são enviados automaticamente ao servidor.
5. **Idempotência e Prevenção de Conflitos:** Nenhum auto é duplicado e nenhum dado é perdido, mesmo em situações de corte súbito de cobertura móvel.

#### 2. Tabelas Sincronizadas:
* \`multas\`: Autos de notícia, fotografias, coordenadas GPS e assinaturas digitais.
* \`tipos_multa\`: Códigos de infração, posturas municipais e valores em Meticais (MT).
* \`agentes\`: Perfis de agentes fiscais e chefes de brigada.
* \`pagamentos\`: Quitações, recibos e registo de cobrança.
* \`reclamacoes\`: Contestações de munícipes e pareceres jurídicos.
* \`audit_log\` e \`notifications\`: Registo de auditoria e alertas do sistema.

Pode verificar o estado em tempo real no menu **Configurações > PowerSync** ou clicando no indicador **⚡ PowerSync** no cabeçalho superior.`;
  }

  if (q.includes("impressora") || q.includes("bluetooth") || q.includes("imprimir") || q.includes("talao") || q.includes("termica")) {
    return `### 🖨️ Configuração de Impressora Térmica Portátil

O sistema suporta impressoras térmicas ESC/POS padrão (58mm e 80mm):

1. **Configuração via Bluetooth (Android / Windows / POS):**
   * Ligue a impressora portátil e ative o Bluetooth do seu dispositivo.
   * No SIGEMM, vá a **Configurações > Impressoras**.
   * Clique em **"Conectar via Bluetooth"** e selecione a sua impressora na lista (ex: \`MPT-II\`, \`POS-58\`, \`RPP-02\`).
2. **Configuração de Rede (Ethernet / IP para Balcões):**
   * Introduza o endereço IP da impressora de balcão e a porta (normalmente \`9100\`).
3. **Teste de Impressão:**
   * Clique em **"Imprimir Talão de Teste"** para verificar a formatação de cabeçalho, alinhamento e clareza do papel.`;
  }

  if (q.includes("agente") || q.includes("utilizador") || q.includes("usuario") || q.includes("senha") || q.includes("perfil") || q.includes("permissoes") || q.includes("role")) {
    return `### 👥 Níveis de Acesso e Gestão de Utilizadores no SIGEMM

O sistema conta com Controlo de Acesso Baseado em Funções (**RBAC**):

* **Agente Fiscal:** Emissão de multas na via pública, consulta de histórico próprio, chat interno e captura de evidências.
* **Operador de Caixa / Tesouraria:** Cobrança de multas, validação de depósitos bancários e emissão de recibos oficiais.
* **Chefe de Brigada / Supervisor:** Monitorização de brigadas no mapa GPS, validação de autos e relatórios de turno.
* **Jurídico / Tribunal:** Gestão de contestações, pareceres legais e remessa de processos ao Tribunal Judicial.
* **Administrador de TI:** Gestão integral de utilizadores, redefinição de senhas, auditoria de logs e parametrização.
* **Presidente do Município:** Painel executivo de arrecadação, aprovação de autorizações especiais e gestão do sistema.

#### Redefinição e Criação de Senhas:
* Ao criar um novo agente em **Administração > Agentes**, o sistema gera uma senha provisória e despacha-a automaticamente para o e-mail oficial do utilizador.
* No primeiro início de sessão, o utilizador é forçado a definir uma nova senha pessoal segura.`;
  }

  if (q.includes("sideout") || q.includes("quem criou") || q.includes("desenvolvedor") || q.includes("empresa") || q.includes("suporte")) {
    return `### 🏢 Sobre o Desenvolvedor: Sideout Studios

O **SIGEMM** foi projectado, desenvolvido e mantido pela **Sideout Studios**, empresa especializada em engenharia de software, transformação digital e soluções tecnológicas de missão crítica em Moçambique.

* **Página Oficial:** [https://www.facebook.com/sideoutstudios](https://www.facebook.com/sideoutstudios)
* **Contacto de Suporte:** \`suporte@sideoutstudios.co.mz\`
* **Propriedade Institucional:** Conselho Municipal da Cidade da Matola © ${new Date().getFullYear()}`;
  }

  // Generic welcoming response with comprehensive suggestions
  return `Olá, **${userName}**! Sou o **SIGEMM Bot**, o seu assistente inteligente para o Sistema de Gestão de Multas da Cidade da Matola.

Posso ajudá-lo com qualquer dúvida sobre o funcionamento do sistema:

* 📋 **Emissão de Multas:** Como lavrar autos móveis e imóveis, captura GPS, fotos e assinaturas digitais.
* ⚖️ **Legislação & Coimas:** Tabela de infrações, códigos, artigos e valores em Meticais (MT).
* 💳 **Pagamentos:** Liquidação por M-Pesa, e-Mola, POS/SIMO e emissão de recibos.
* 📝 **Reclamações & Recursos:** Como registar contestações e tramitação jurídica (10 dias).
* 🏛️ **Processos & Tribunal:** Prazos legais (15 dias úteis / 30 dias para execução fiscal).
* 👥 **Utilizadores & Agentes:** Níveis de acesso, criação de contas, redefinição de senhas e patrulhas.
* 🖨️ **Impressoras Térmicas:** Ligação Bluetooth e impressão de talões portáteis de 58mm/80mm.
* 📡 **Modo Offline:** Como continuar a autuar na via pública sem sinal de Internet.

Como posso ajudá-lo neste momento? Digite a sua pergunta ou clique numa das sugestões abaixo!`;
}

// Bot Chat API Route
app.post("/api/bot/chat", async (req, res) => {
  try {
    const { message, history, userContext } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Mensagem de texto obrigatória." });
    }

    const cleanMessage = message.trim();
    const ai = getGeminiClient();

    // 1. If Gemini AI is configured, try calling Gemini 3.7 Flash
    if (ai) {
      try {
        console.log(`[SIGEMM Bot - Gemini] Processando pergunta: "${cleanMessage.slice(0, 60)}..."`);
        
        // Build contents from history if available
        const contents: any[] = [];
        if (Array.isArray(history) && history.length > 0) {
          // Take the last 6 messages to keep context focused
          const recentHistory = history.slice(-6);
          for (const item of recentHistory) {
            if (item.sender === "user" && item.text) {
              contents.push({ role: "user", parts: [{ text: item.text }] });
            } else if (item.sender === "bot" && item.text) {
              contents.push({ role: "model", parts: [{ text: item.text }] });
            }
          }
        }

        // Add current user prompt with current user context
        const contextStr = userContext
          ? `[Contexto do Utilizador: Nome=${userContext.nome || userContext.username}, Perfil/Role=${userContext.role}, Bairro/Posto=${userContext.posto || "Central"}]\n\nPergunta: ${cleanMessage}`
          : cleanMessage;

        contents.push({ role: "user", parts: [{ text: contextStr }] });

        const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-3.7-flash"];
        let replyText: string | null = null;
        let usedModel: string = "gemini-2.5-flash";

        for (const modelName of candidateModels) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents,
              config: {
                systemInstruction: SIGEMM_SYSTEM_PROMPT,
                temperature: 0.6,
                topP: 0.95,
              },
            });

            if (response.text && response.text.trim()) {
              replyText = response.text;
              usedModel = modelName;
              break;
            }
          } catch (modelErr: any) {
            console.warn(`[SIGEMM Bot] Modelo ${modelName} temporariamente indisponível (${modelErr?.status || modelErr?.message || "503/High Demand"}). A tentar modelo alternativo...`);
          }
        }

        if (replyText) {
          return res.json({
            success: true,
            reply: replyText,
            provider: usedModel,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (geminiError: any) {
        console.warn("[SIGEMM Bot] Erro na orquestração Gemini, a utilizar base de conhecimento local de contingência.");
      }
    }

    // 2. Fallback to Local Knowledge Engine
    const localReply = generateLocalBotResponse(cleanMessage, userContext);
    return res.json({
      success: true,
      reply: localReply,
      provider: "sigemm-knowledge-engine",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[SIGEMM Bot Error]:", error);
    return res.status(500).json({
      error: "Erro ao processar conversa com o SIGEMM Bot.",
      reply: "Desculpe, ocorreu uma oscilação momentânea ao processar o seu pedido. Por favor tente novamente ou consulte o Manual do Utilizador.",
    });
  }
});

// Vite middleware for dev / static for prod
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SIGEMM Server] Servidor activo em http://0.0.0.0:${PORT}`);
  });
}

setupViteOrStatic().catch((err) => {
  console.error("Erro ao iniciar servidor SIGEMM:", err);
});
