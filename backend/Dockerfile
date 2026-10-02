# ─────────────────────────────────────────────────────────────────────────────
# CAMADA 2 — Backend: API REST em Node.js + Express
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Dependências do sistema necessárias ao Prisma (OpenSSL)
RUN apk add --no-cache openssl

# 1) Manifestos primeiro → cache de dependências
COPY package.json ./
COPY prisma ./prisma
RUN npm install --omit=dev && npx prisma generate

# 2) Resto do código
COPY . .

EXPOSE 3000
# Aplica migrations + seed e arranca a API
CMD ["npm", "start"]