# SIGEMM — Sistema Integrado de Gestão de Multas Municipais

**Conselho Municipal da Cidade da Matola**  
*Direcção Municipal de Polícia e Fiscalização*  
**Trabalho Prático Individual · INFC-0015 — Computação na Nuvem**  
Universidade Técnica Diogo Eugénio Guilande · Faculdade de Ciências Tecnológicas  
Licenciatura em Informática · 3.º Ano · II Semestre 2026  

---

## 1. Resumo Executivo

O **SIGEMM** (Sistema Integrado de Gestão de Multas Municipais) é uma plataforma corporativa completa desenvolvida para informatizar, padronizar e auditar todo o ciclo de vida das infrações municipais na Cidade da Matola.

O sistema abrange desde a emissão de autos no terreno pelos agentes da Polícia Municipal (com reconhecimento óptico de caracteres OCR para matrículas, provas fotográficas, GPS e assinatura digital), até à liquidação em caixa multicanal (M-Pesa, E-Mola, POS, Numerário), gestão de contestações, remessa para instâncias judiciais e controlo de arrecadação em tempo real.

---

## 2. Arquitectura do Sistema

O projecto foi projectado segundo uma arquitectura em **Três Camadas (Three-Tier Architecture)**, com suporte a containerização Docker e funcionamento em modo **PWA / Offline-First**:

```
┌────────────────────────────────────────────────────────────────────────┐
│  CAMADA 1 — FRONTEND / CLIENTE (PWA)                                   │
│  React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons            │
│  • Modo Offline com IndexedDB / LocalStorage & Sincronização           │
│  • OCR de Matrículas via Câmera, Assinatura Digital & Bluetooth Print  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP/REST / JSON / WebSockets
┌───────────────────────────────────▼────────────────────────────────────┐
│  CAMADA 2 — BACKEND & SERVIÇOS DE APLICAÇÃO                            │
│  Node.js (Express) + TypeScript + JWT + Nodemailer + Geração DOCX/PDF  │
│  • Autenticação RBAC + MFA (2FA TOTP)                                  │
│  • Fluxo de aprovação hierárquica para cancelamentos                   │
│  • Geração de relatórios Excel (.xlsx) e Manual do Utilizador (.docx)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ PostgreSQL / Supabase Engine
┌───────────────────────────────────▼────────────────────────────────────┐
│  CAMADA 3 — BASE DE DADOS & ARMAZENAMENTO                              │
│  PostgreSQL + Row-Level Security + Storage de Fotografias              │
│  • Tabelas: multas, agentes, pagamentos, reclamacoes, audit_log, chat  │
│  • Auditoria imutável de operações e cópias de segurança (Backup)      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Módulos e Funcionalidades

### 3.1. Autenticação e Segurança (RBAC & 2FA)
- **Login por Nome de Utilizador ou E-mail**: Autenticação com bloqueio automático de contas inativas.
- **Autenticação em Dois Factores (MFA/TOTP)**: Suporte para Google Authenticator e Microsoft Authenticator.
- **Controlo de Acessos (RBAC)**:
  - `Superadmin`: Gestão total do sistema, bases de dados, backups e auditoria.
  - `Admin`: Gestão de agentes, postos, parametrização de infrações e tribunal.
  - `Agente`: Emissão de multas, cobrança, chat operacional e consultas.
  - `Leitor`: Apenas consulta e exportação de relatórios.

### 3.2. Emissão de Autos de Multa (`Multas`)
- **Categorias de Infrações**:
  - **Móvel**: Trânsito, condutores, viaturas ligeiras/pesadas, táxis e motociclos.
  - **Imóvel**: Obras ilegais, saneamento, ocupação do solo, comércio irregular, poluição sonora e ambiental.
- **Leitura Automática de Matrículas (OCR)**: Reconhecimento por câmera com enquadramento no padrão moçambicano (`ABC 123 MC`).
- **Captura Fotográfica**: Anexo de até 5 fotografias probatórias por autuação.
- **Geolocalização GPS**: Registo automático das coordenadas no momento da infração.
- **Assinaturas Digitais**: Assinatura no ecrã táctil pelo agente e pelo infractor (ou registo oficial de recusa).
- **Identificadores Sequenciais Oficiais**: Auto `AUTO-YYYY-XXXXX` e Notificação `MLT-YYYY-XXXXX`.

### 3.3. Impressão Térmica e Documentos Oficiais
- **Talão Térmico Portátil (58mm / 80mm)**: Conexão via **Bluetooth ESC/POS** ou USB/OTG com código QR de autenticidade.
- **Auto de Notícia & Aviso de Multa A4**: Documento institucional completo em formato PDF.

### 3.4. Pagamentos e Caixa
- **Liquidação Multicanal**: M-Pesa, E-Mola, Cartão Bancário (POS), Numerário e Transferência Bancária.
- **Registo de Comprovativo**: Associação do número de transação e emissão instantânea do Recibo de Quitação.

### 3.5. Histórico e Relatórios Analíticos
- **Filtros Avançados**: Por estado (*Pendente*, *Paga*, *Fora do Prazo*, *Enviada ao Tribunal*, *Cancelada*), período e agente.
- **Exportação de Dados**: Geração de ficheiros **Excel (.xlsx)** com resumo estatístico e formato **CSV**.

### 3.6. Gestão de Reclamações
- Registo de contestações dos munícipes com pareceres e decisões (*Deferida*, *Indeferida*, *Em Análise*).

### 3.7. Encaminhamento para o Tribunal
- Monitorização de multas com prazo de pagamento expirado (> 15 dias).
- Remessa em lote para a Secção Judicial do Tribunal da Cidade da Matola.

### 3.8. Cancelamento de Multas com Autorização Superior
- Fluxo de solicitação de anulação com aprovação obrigatória do **Presidente do Município**, validada por senha.

### 3.9. Comunicação Interna e Monitorização
- **Chat Operacional**: Troca de mensagens em tempo real entre brigadas de campo e a central.
- **Agentes Online & Produtividade**: Acompanhamento de efetivo ativo no terreno e ranking mensal de eficiência.

### 3.10. Modo Offline e Sincronização
- Emissão contínua mesmo sem sinal de rede, com sincronização automática transparente ao restabelecer a ligação.

### 3.11. Manual do Utilizador Integrado (PDF & DOCX)
- Geração e disponibilização do manual oficial em formato **PDF (.pdf)** e **Microsoft Word (.docx)**, disponível para download directo no sistema.

---

## 4. Estrutura do Projecto

```
sigemm/
├── public/
│   ├── Manual_do_Utilizador_SIGEMM.pdf   ← Manual oficial gerado em PDF
│   ├── Manual_do_Utilizador_SIGEMM.docx  ← Manual oficial gerado em Word
│   ├── manifest.json                     ← Manifesto PWA
│   └── sw.js                             ← Service Worker (Offline-First)
├── scripts/
│   ├── generate_manual_pdf.ts            ← Gerador programático do manual .pdf
│   └── generate_manual_docx.ts           ← Gerador programático do manual .docx
├── src/
│   ├── assets/                           ← Imagens e logótipos institucionais
│   ├── components/                       ← Componentes reutilizáveis (OCR, Assinatura, Impressão)
│   ├── contexts/                         ← Contextos de Autenticação, Tema e Idioma
│   ├── hooks/                            ← Hooks personalizados (atalhos, papéis, permissões)
│   ├── i18n/                             ← Dicionário de traduções e termos municipais
│   ├── lib/                              ← Utilitários (Supabase, PDF, Excel, validações)
│   ├── pages/                            ← Ecrãs principais da aplicação
│   │   ├── DashboardPage.tsx
│   │   ├── NovaMultaPage.tsx
│   │   ├── PagamentosPage.tsx
│   │   ├── HistoricoPage.tsx
│   │   ├── ReclamacoesPage.tsx
│   │   ├── TribunalPage.tsx
│   │   ├── AgentesOnlinePage.tsx
│   │   ├── ProdutividadePage.tsx
│   │   ├── AdminPage.tsx
│   │   └── ConfiguracoesPage.tsx
│   ├── App.tsx                           ← Roteamento e layout
│   └── main.tsx                          ← Entrada da aplicação
├── docker-compose.yml                    ← Orquestração dos serviços
├── Dockerfile.frontend                   ← Build multi-stage da SPA
├── package.json
└── vite.config.ts
```

---

## 5. Como Executar o Projecto

### Pré-requisitos
- **Node.js 20+** e **npm** instalados.
- Opcional: **Docker** & **Docker Compose**.

### Execução em Ambiente de Desenvolvimento

```bash
# 1. Instalar as dependências
npm install

# 2. Iniciar o servidor de desenvolvimento
npm run dev

# 3. Aceder à aplicação
# Abrir no navegador: http://localhost:3000
```

### Compilação para Produção

```bash
# Executar a verificação de tipos e build optimizado
npm run build

# Iniciar o servidor de produção
npm run start
```

### Geração / Atualização do Manual do Utilizador (PDF & Word)

```bash
# Gerar o manual em formato PDF
npx tsx scripts/generate_manual_pdf.ts

# Gerar o manual em formato Word (.docx)
npx tsx scripts/generate_manual_docx.ts
```

### Execução via Docker Compose

```bash
# Construir e arrancar todos os containers
docker compose up --build -d

# Parar os serviços
docker compose down
```

---

## 6. Atalhos de Teclado no Sistema

| Atalho | Ação |
|---|---|
| `Ctrl + K` | Abrir a Pesquisa Global (Multas, Páginas e Agentes) |
| `N` | Abrir formulário de Registo de Multa |
| `?` | Abrir diálogo de Ajuda e Atalhos (com download do Manual .docx) |
| `G + D` | Navegar para o Painel Principal (Dashboard) |
| `G + M` | Navegar para Multas / Histórico |
| `G + P` | Navegar para Pagamentos |
| `G + T` | Navegar para o Tribunal |
| `G + A` | Navegar para Agentes Online |
| `G + C` | Navegar para Configurações |

---

## 7. Autoria e Licença

Projecto desenvolvido no âmbito da disciplina de trabalho de final de curso - Licenciatura em Informatica — II Semestre de 2026.  
Propriedade institucional: **Conselho Municipal da Cidade da Matola**.
