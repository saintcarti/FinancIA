# FinancIA Chile

> Tu derecho financiero explicado simple, donde ya estás.

Agente conversacional de IA que responde preguntas financieras y regulatorias en lenguaje simple por **Instagram DM** y **WhatsApp**, usando datos en vivo de la **CMF** (Comisión para el Mercado Financiero de Chile). En paralelo, genera **Reels educativos diarios** que invitan a chatear, creando un loop autosostenible.

Construido para el **Chile Fintech Forum 2026**.

---

## 📁 Estructura

```
financia-chile/
├── 01_STRATEGY/        # Visión, OKRs, GTM, ICP, posicionamiento, costos
├── 02_ARCHITECTURE/    # Specs técnicas, ADRs, RAG, LLM, security, n8n
├── 03_BUILD/
│   ├── app/
│   │   ├── backend/    # Express + TypeScript (incluye prompts/, scripts/, tests/)
│   │   └── frontend/   # Next.js admin dashboard
│   ├── n8n-workflows/  # 4 workflows JSON exportables
│   └── migrations/     # SQL Supabase (all.sql consolidado)
├── 04_GTM/             # Landing copy, social, PR, Product Hunt
├── 05_DEPLOY/          # Manifests, runbooks, ENV vars
├── docker-compose.yml  # Dev local
├── railway.json        # Config deploy Railway
└── nixpacks.toml       # Config build Nixpacks
```

---

## 🚀 Setup local en < 10 min

### Prerrequisitos
- Node 20+
- Docker + Docker Compose
- Cuenta Supabase (free tier)
- API key Anthropic
- API key Google AI Studio (embeddings, free)
- Cuenta **Zernio** (gestiona Instagram + WhatsApp con 1 sola key, sin developer app de Meta)
- (Opcional) ElevenLabs free tier para Reels

### 1. Clonar y configurar
```bash
git clone <repo-url> financia-chile
cd financia-chile

# Backend env
cp 03_BUILD/app/backend/.env.example 03_BUILD/app/backend/.env
# Edita y pega tus credenciales reales

# Frontend env
cp 03_BUILD/app/frontend/.env.example 03_BUILD/app/frontend/.env
```

### 2. Crear schema en Supabase
- Crea proyecto en supabase.com
- Habilita extensión `vector` en Database → Extensions
- Copia y ejecuta `03_BUILD/migrations/001_initial_schema.sql` en el SQL Editor
- Agrega tu email a `admin_emails` (o ya está si eres b.calderan2008@gmail.com)

### 3. Ingestar corpus inicial CMF
```bash
cd 03_BUILD/app/backend
npm install
npm run ingest:cmf
```
Esto carga 10 documentos iniciales (glosario, leyes, guías de reclamos) y genera embeddings.

### 4. Levantar con Docker
```bash
# Desde la raíz
docker compose up
```
- Backend → http://localhost:3001
- Frontend → http://localhost:3000
- n8n → http://localhost:5678 (admin/changeme)

### 5. Configurar webhook Zernio
- Necesitas URL pública. Usa `ngrok http 3001` para dev.
- En zernio.com → Settings → Webhooks → Create:
  - URL: `https://tu-ngrok.ngrok.io/webhook/zernio`
  - Eventos: `message.received`
  - Copia el signing secret → pégalo como `ZERNIO_WEBHOOK_SECRET` en `.env`
- En zernio.com → Connect → conecta tu cuenta IG Business + WhatsApp Business via Embedded Signup

### 6. Probar
- DM al perfil de IG → recibes respuesta del agente en < 8s
- Login admin: http://localhost:3000 → magic link a tu email autorizado
- Ver conversación, override manual si necesario

---

## 🏗️ Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 + Tailwind + shadcn/ui + recharts |
| Backend | Node 20 + Express + TypeScript estricto |
| DB + Vector | Supabase (Postgres + pgvector + Auth + Storage) |
| Cache + Queue | Redis (Upstash) + BullMQ |
| LLM | Claude Haiku 4.5 (90%) + Sonnet 4.6 (10%) |
| Embeddings | Google text-embedding-004 (free) |
| IG + WhatsApp | Zernio (1 API key abstrae Meta) |
| Workflows | n8n self-hosted (Railway) |
| Deploy | Vercel (frontend) + Railway (backend + n8n) |
| Logging | pino + Railway logs |

---

## 🧪 Tests

```bash
cd 03_BUILD/app/backend
npm test         # vitest
npm run lint
```

Coverage threshold: 60% (lógica crítica: webhooks HMAC, guardrails, tools).

---

## 📊 Métricas que importan

Ver `01_STRATEGY/SUCCESS_METRICS.md`.

| Métrica | Target Q1 |
|---|---|
| DMs únicos iniciados | 1.000 en 90 días |
| Conversaciones útiles / DMs | ≥ 60% |
| First-response p95 | < 8s |
| Costo por conversación | < $0.02 USD |
| Hallucination rate | < 1% |
| Disclaimer presente | 100% |

---

## ⚠️ Disclaimer regulatorio

FinancIA Chile **educa** sobre finanzas y regulación. NO da asesoría financiera personalizada, NO recomienda productos ni decisiones de inversión. Cada respuesta del agente incluye un footer automático recordándolo. Cumplimos con la Ley 19.628 de protección de datos personales y operamos en línea con la normativa CMF.

---

## 📜 Licencia

MIT — pero el corpus normativo CMF es público y sigue su propia licencia oficial.

---

## 👤 Equipo

- **Benjamin Caldera** — Founder QUANT24
- 📧 b.calderan2008@gmail.com
