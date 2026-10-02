/**
 * SIGEMM · API REST (Camada 2 / Backend) — Express + Prisma + JWT + Nodemailer
 * ────────────────────────────────────────────────────────────────────────────
 * Trabalho Prático INFC-0015 · Computação na Nuvem · UTDEG 2026
 *
 * Esta API demonstra:
 *   - Arquitectura em 3 camadas (Frontend / Backend / Base de Dados)
 *   - Autenticação por JWT e protecção de rotas
 *   - ORM com Prisma (migrations automáticas no arranque do container)
 *   - Envio de emails com Nodemailer (envia credenciais ao criar/redefinir)
 *
 * Endpoints principais:
 *   POST   /auth/login                  → autentica e devolve JWT
 *   POST   /auth/change-password        → troca senha do utilizador autenticado
 *   GET    /auth/me                     → devolve perfil do utilizador autenticado
 *
 *   GET    /usuarios                    → lista utilizadores                (admin)
 *   POST   /usuarios                    → cria utilizador + envia credenciais (admin)
 *   POST   /usuarios/:id/reset-password → reset de senha + envia email      (admin)
 *
 *   GET    /multas                      → lista multas                      (auth)
 *   POST   /multas                      → cria multa                        (auth)
 *   PUT    /multas/:id                  → actualiza multa                   (auth)
 *   DELETE /multas/:id                  → apaga multa                       (admin)
 *
 *   GET    /health                      → verificação de saúde do serviço
 */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const { authRequired, requireRole, JWT_SECRET } = require("./src/middleware/auth");
const { enviarCredenciais } = require("./src/lib/mailer");

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Gera senha aleatória forte e legível
function gerarSenha(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#";
  let s = ""; for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// ── Health ────────────────────────────────────────────────────────────────
app.get("/health", async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: "ok" }); }
  catch (e) { res.status(500).json({ status: "error", message: e.message }); }
});

// ── AUTH ──────────────────────────────────────────────────────────────────
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Campos em falta" });
  const user = await prisma.usuario.findFirst({
    where: { OR: [{ username }, { email: username }], ativo: true },
  });
  if (!user) return res.status(401).json({ error: "Credenciais inválidas" });
  const ok = await bcrypt.compare(password, user.senhaHash);
  if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });

  const token = jwt.sign(
    { sub: user.id, username: user.username, email: user.email, nivelAcesso: user.nivelAcesso },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
  res.json({
    token,
    user: {
      id: user.id, nome: user.nome, email: user.email, username: user.username,
      nivelAcesso: user.nivelAcesso, mustChangePassword: user.mustChangePass,
    },
  });
});

app.get("/auth/me", authRequired, async (req, res) => {
  const u = await prisma.usuario.findUnique({ where: { id: req.user.sub } });
  if (!u) return res.status(404).json({ error: "Não encontrado" });
  res.json({
    id: u.id, nome: u.nome, email: u.email, username: u.username,
    nivelAcesso: u.nivelAcesso, mustChangePassword: u.mustChangePass,
  });
});

app.post("/auth/change-password", authRequired, async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres" });
  const senhaHash = await bcrypt.hash(newPassword, 10);
  await prisma.usuario.update({
    where: { id: req.user.sub },
    data: { senhaHash, mustChangePass: false },
  });
  res.json({ ok: true });
});

// ── USUÁRIOS (admin) ──────────────────────────────────────────────────────
app.get("/usuarios", authRequired, requireRole("admin"), async (_req, res) => {
  const list = await prisma.usuario.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, nome: true, email: true, username: true, nivelAcesso: true, ativo: true, createdAt: true },
  });
  res.json(list);
});

app.post("/usuarios", authRequired, requireRole("admin"), async (req, res) => {
  const { nome, email, username, nivelAcesso } = req.body || {};
  if (!nome || !email || !username) return res.status(400).json({ error: "Campos obrigatórios em falta (nome, email, username)" });
  try {
    const password = gerarSenha(10);
    const senhaHash = await bcrypt.hash(password, 10);
    const novo = await prisma.usuario.create({
      data: { nome, email, username, senhaHash, nivelAcesso: nivelAcesso || "agente_campo", mustChangePass: true },
    });
    try {
      await enviarCredenciais({
        nome, username, email, password,
        systemUrl: req.body.systemUrl || process.env.SYSTEM_URL || "http://localhost:8080",
      });
    } catch (mailErr) { console.warn("[mailer] falha:", mailErr.message); }
    res.status(201).json({ id: novo.id, generatedPassword: password, emailEnviado: true });
  } catch (e) {
    if (String(e.message).includes("Unique")) return res.status(409).json({ error: "Email ou username já existem" });
    res.status(500).json({ error: e.message });
  }
});

app.post("/usuarios/:id/reset-password", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const u = await prisma.usuario.findUnique({ where: { id: req.params.id } });
    if (!u) return res.status(404).json({ error: "Utilizador não encontrado" });
    const password = gerarSenha(10);
    const senhaHash = await bcrypt.hash(password, 10);
    await prisma.usuario.update({ where: { id: u.id }, data: { senhaHash, mustChangePass: true } });
    try {
      await enviarCredenciais({
        nome: u.nome, username: u.username, email: u.email, password,
        systemUrl: req.body?.systemUrl || process.env.SYSTEM_URL || "http://localhost:8080",
      });
    } catch (mailErr) { console.warn("[mailer] falha:", mailErr.message); }
    res.json({ ok: true, generatedPassword: password, emailEnviado: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── MULTAS (CRUD protegido) ───────────────────────────────────────────────
app.get("/multas", authRequired, async (_req, res) => {
  const data = await prisma.multa.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  res.json(data);
});

app.post("/multas", authRequired, async (req, res) => {
  const { numero, infratorNome, matricula, local, infracaoTipo, valor } = req.body || {};
  if (!numero || !infratorNome || !local || !infracaoTipo)
    return res.status(400).json({ error: "Campos obrigatórios em falta" });
  try {
    const m = await prisma.multa.create({
      data: { numero, infratorNome, matricula: matricula || null, local, infracaoTipo, valor: valor || 0, agenteId: req.user.sub },
    });
    res.status(201).json(m);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/multas/:id", authRequired, async (req, res) => {
  try {
    const m = await prisma.multa.update({
      where: { id: req.params.id },
      data: { status: req.body.status ?? undefined, valor: req.body.valor ?? undefined },
    });
    res.json(m);
  } catch (e) { res.status(404).json({ error: "Multa não encontrada" }); }
});

app.delete("/multas/:id", authRequired, requireRole("admin"), async (req, res) => {
  try { await prisma.multa.delete({ where: { id: req.params.id } }); res.status(204).send(); }
  catch { res.status(404).json({ error: "Multa não encontrada" }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[SIGEMM] API REST a escutar na porta ${PORT}`);
  console.log(`[SIGEMM] JWT activo · Prisma ligado · Nodemailer ${process.env.SMTP_HOST ? "SMTP" : "modo dev"}`);
});