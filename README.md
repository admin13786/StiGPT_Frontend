# StiGPT Frontent

`frontent` contains the deployable frontend apps and the canonical Docker Compose entrypoint for the whole StiGPT stack.

The directory name `frontent` is kept intentionally to match the current project layout.

## Canonical Docker Start

```bash
cp .env.example .env
docker compose -p stigpt up -d --build
docker compose -p stigpt ps
```

Fill `.env` before starting production. Do not commit `.env`.

## Default Ports

- Admin portal: `http://localhost:32111`
- Player app: `http://localhost:32112`
- Backend API: `http://localhost:32101/api/v1`
- Swagger admin docs: `http://localhost:32101/api/v1/docs/admin`
- Swagger player docs: `http://localhost:32101/api/v1/docs/player`
- PostgreSQL: `localhost:32113`
- Redis: `localhost:32114`
- Milvus gRPC: `localhost:32115`
- Milvus health: `http://localhost:32116/healthz`

## Local Frontend Development

```bash
npm run dev:admin
npm run dev:player
```

The Vite dev ports remain:

- Admin portal: `http://localhost:20101`
- Player app: `http://localhost:20102`

The backend allows both local Vite ports and Docker host ports by default in development.

## Main Player Routes

- `/apps`
- `/apps/ai-hub`
- `/apps/stigpt/webIdx`
- `/apps/stigpt/write`
- `/apps/stigpt/check`
- `/apps/stigpt/review`

## Deployment

See `docs/DEPLOYMENT.md`.
