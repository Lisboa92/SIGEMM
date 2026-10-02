/**
 * SIGEMM · Middleware de protecção de rotas com JWT
 * Verifica o cabeçalho `Authorization: Bearer <token>` e injecta `req.user`.
 */
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "sigemm-dev-secret-change-me";

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Token em falta" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Não autenticado" });
    if (!roles.includes(req.user.nivelAcesso)) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    next();
  };
}

module.exports = { authRequired, requireRole, JWT_SECRET };