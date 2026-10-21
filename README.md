# Calma · Psicólogo con IA

Chat de apoyo emocional hecho con Next.js, la API de Claude (`claude-opus-5-5`), PostgreSQL y Prisma. No tiene login: cada navegador recibe un id anónimo en una cookie y sus conversaciones se guardan con ese id.

> Calma es una herramienta de apoyo y **no sustituye a un profesional de salud mental**.

## Requisitos

- Node.js 20+
- PostgreSQL (puedes usar el `docker-compose.yml` incluido)
- Una API key de Anthropic

## Puesta en marcha

```bash
npm install
cp .env.example .env          # rellena ANTHROPIC_API_KEY y DATABASE_URL
docker compose up -d          # levanta Postgres en localhost:5432
npm run db:migrate            # aplica las migraciones de Prisma
npm run dev
```

Abre http://localhost:3000.

## Scripts útiles

| Script | Qué hace |
|---|---|
| `npm run db:migrate` | Crea/aplica migraciones en desarrollo (`prisma migrate dev`) |
| `npm run db:deploy` | Aplica migraciones en producción (`prisma migrate deploy`) |
| `npm run db:studio` | Abre Prisma Studio para ver los datos |

## Estructura

- `prisma/schema.prisma` — modelos `Conversation` y `Message`
- `src/lib/claude.ts` — cliente de Anthropic, modelo y prompt de sistema
- `src/app/api/chat/route.ts` — envía el mensaje a Claude y devuelve la respuesta en streaming
- `src/app/api/conversations` — listar, abrir y borrar conversaciones
- `src/components/Chat.tsx` — interfaz del chat
