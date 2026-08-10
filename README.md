# Find the Evidence

SAT-style Reading & Writing practice. Learners highlight evidence in a shared
passage, submit selections, and receive a transparent score. The API keeps
answer keys server-side.

## Stack

- React + Vite frontend
- FastAPI grading API
- Nginx reverse proxy
- Docker Compose runtime
- Optional OpenAI exercise generation

## Docker

Requirements: Docker Desktop and Docker Compose.

```bash
cp .env.example .env
docker compose up --build
```

Open <http://localhost:8080>.

The web container publishes the host port. The API is internal and is exposed
through Nginx at `/api`.

Useful commands:

```bash
docker compose logs -f web api
docker compose down
```

Configure `WEB_PORT` in `.env` to change the host port. Generation is optional:

```dotenv
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-4o-mini
```

## Local development

```bash
npm ci
npm run web:dev
```

Run the API separately:

```bash
npm run api:dev
```

The frontend uses Vite's default port. The API runs at
<http://localhost:8000>.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET` | `/api/exercises/rw-evidence-1` | Public exercise without answer key |
| `POST` | `/api/exercises/rw-evidence-1/submissions` | Server-side grading |
| `POST` | `/api/exercises/generated` | Optional OpenAI-backed generation |

Generated exercises accept only `difficulty`: `easy`, `medium`, or `hard`.

## Verification

```bash
npm run web:test
npm run web:build
npm run api:test
cd apps/api && uv run ruff check .
```

## Project map

```text
apps/web/       React + Vite frontend
apps/api/       FastAPI service and tests
infra/nginx/    Reverse proxy
compose.yaml    Docker runtime
```
