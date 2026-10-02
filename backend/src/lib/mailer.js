/**
 * SIGEMM · Envio de emails (Nodemailer)
 * Usado para enviar credenciais ao criar utilizadores e ao redefinir senha.
 * Em ambiente de desenvolvimento, se SMTP_HOST não estiver definido, usa
 * um transporte JSON que apenas regista no console (útil em Docker local).
 */
const nodemailer = require("nodemailer");

function getTransporter() {
  if (!process.env.SMTP_HOST) {
    return nodemailer.createTransport({ jsonTransport: true });
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

function buildHtml({ nome, username, email, password, systemUrl }) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:28px;text-align:center;color:#fff">
      <h1 style="margin:0;font-size:22px">SIGEMM</h1>
      <p style="margin:6px 0 0;opacity:.85;font-size:13px">Sistema de Gestão de Multas Municipais</p>
    </div>
    <div style="padding:28px">
      <h2 style="color:#1e3a5f;margin:0 0 8px">Bem-vindo(a), ${nome}!</h2>
      <p style="color:#444;line-height:1.5">As suas credenciais de acesso ao SIGEMM foram criadas. Utilize-as para entrar e, no primeiro acesso, será solicitado que altere a senha.</p>
      <table style="width:100%;background:#f0f4ff;border-radius:8px;border:1px solid #dbeafe;margin:16px 0">
        <tr><td style="padding:14px 18px"><b>Utilizador:</b> ${username}</td></tr>
        <tr><td style="padding:0 18px 6px"><b>Email:</b> ${email}</td></tr>
        <tr><td style="padding:0 18px 14px"><b>Senha:</b> <code style="color:#dc2626">${password}</code></td></tr>
      </table>
      <a href="${systemUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">Aceder ao SIGEMM →</a>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">Conselho Municipal da Matola · ${new Date().getFullYear()}</p>
    </div>
  </div>`;
}

async function enviarCredenciais({ nome, username, email, password, systemUrl }) {
  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || "SIGEMM <no-reply@matola.gov.mz>",
    to: email,
    subject: "As suas credenciais SIGEMM",
    html: buildHtml({ nome, username, email, password, systemUrl: systemUrl || "http://localhost:8080" }),
  });
  if (info.message) console.log("[mailer:dev]", info.message.toString());
  return info;
}

module.exports = { enviarCredenciais };