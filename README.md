# Find the Evidence

Docker-first React and FastAPI application. The browser receives public exercise content from the API, submits selected ranges to `/api`, and receives server-side grading feedback. Correct answer ranges are not included in the initial browser payload.

## Runtime structure

- `apps/web` — npm workspace with the Vite/React source and multi-stage Nginx image.
- `apps/api` — `uv`-managed FastAPI service, locked in `uv.lock`.
- `infra/nginx/nginx.conf` — SPA fallback, `/api` reverse proxy, and web health endpoint.
- `compose.yaml` — public web service and private API service with health checks and read-only filesystems.

## Run with Docker

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:8080`. Only the web container publishes a host port. The API is reachable only through the web reverse proxy at `/api`.

```bash
docker compose down
docker compose logs -f web api
```

## Local development

Use Node `22.14.x` (`.nvmrc`) and npm workspaces:

```bash
npm ci
npm run web:dev
npm run web:test
npm run web:build
```

Use `uv`; do not activate a virtual environment manually:

```bash
npm run api:dev
npm run api:test
cd apps/api && uv run ruff check .
```
