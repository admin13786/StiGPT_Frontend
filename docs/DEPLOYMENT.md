# StiGPT Deployment

This stack is isolated under `/opt/stigpt` and Docker Compose project name `stigpt`.
It does not create fixed `container_name` values, so it should not collide with other projects on the same server.

## Repositories

- Backend: `https://github.com/admin13786/StiGPT_backend.git`
- Frontend and compose entrypoint: `https://github.com/admin13786/StiGPT_Frontend.git`

## Server Layout

```text
/opt/stigpt/
  backend/
  frontent/
    docker-compose.yml
    .env
```

## Public Ports

- Backend API: `32101`
- Admin portal: `32111`
- Player app: `32112`
- PostgreSQL: `32113`
- Redis: `32114`
- Milvus gRPC: `32115`
- Milvus HTTP health: `32116`

If the server already uses any of these ports, change the matching values in `/opt/stigpt/frontent/.env`.

## Required GitHub Secrets

Use an SSH key instead of putting passwords in workflows.

- `ALIYUN_HOST`
- `ALIYUN_USER`
- `ALIYUN_SSH_KEY`

## Required Runtime Secrets

Put these in `/opt/stigpt/frontent/.env` on the server. Do not commit them.

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `DIFY_API_KEY`
- `ENCRYPTION_SECRET_KEY`
- `ENCRYPTION_SALT`
- `BAIDU_TRANSLATE_APP_ID`
- `BAIDU_TRANSLATE_SECRET`
- `ALIYUN_API_KEY`
- `ALIYUN_ACCESS_KEY_ID`
- `ALIYUN_ACCESS_KEY_SECRET`

Optional:

- `ALIYUN_TTS_APP_KEY`

## First Server Start

```bash
mkdir -p /opt/stigpt
cd /opt/stigpt
git clone https://github.com/admin13786/StiGPT_backend.git backend
git clone https://github.com/admin13786/StiGPT_Frontend.git frontent
cd frontent
cp .env.example .env
vi .env
docker compose -p stigpt up -d --build
docker compose -p stigpt ps
```

## CI/CD Behavior

Both repositories contain GitHub Actions workflows.

- Pull requests and pushes to `develop`/`main` run build verification.
- Pushes to `main` deploy by SSH to `/opt/stigpt`.
- Deploy runs `docker compose -p stigpt up -d --build`.
- Existing non-StiGPT containers are not stopped or removed.

## Manual Verification

```bash
docker compose -p stigpt ps
curl -I http://127.0.0.1:32111
curl -I http://127.0.0.1:32112
curl -I http://127.0.0.1:32101/api/v1/docs/player
```
