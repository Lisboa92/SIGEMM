/**
 * SIGEMM · Seed inicial da base de dados
 * Cria o super-utilizador (lisboa.cossa) e dados de demonstração.
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash("lisboa123", 10);

  await prisma.usuario.upsert({
    where: { username: "lisboa.cossa" },
    update: {},
    create: {
      nome: "Lisboa Cossa",
      email: "lisboa.cossa@matola.gov.mz",
      username: "lisboa.cossa",
      senhaHash,
      nivelAcesso: "admin",
      mustChangePass: false,
    },
  });

  const demos = [
    { numero: "M-0001", infratorNome: "João Cossa",     matricula: "AAA-123-MC", local: "Av. das FPLM",   infracaoTipo: "Estacionamento proibido", valor: 1500, status: "pendente" },
    { numero: "M-0002", infratorNome: "Maria Mucavele", matricula: "BBB-456-MC", local: "Rua da Matola",  infracaoTipo: "Excesso de velocidade",   valor: 3000, status: "paga"     },
    { numero: "M-0003", infratorNome: "Carlos Sitoe",   matricula: null,         local: "Bairro T3",      infracaoTipo: "Construção sem licença",  valor: 5000, status: "pendente" },
  ];
  for (const m of demos) {
    await prisma.multa.upsert({ where: { numero: m.numero }, update: {}, create: m });
  }

  console.log("[seed] Super-utilizador e dados de demonstração prontos.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => prisma.$disconnect());