<div align="center">

# Find the Evidence

### Reading & Writing practice built around proof, not guessing.

Select the words that support an answer. Submit them. Get a transparent score.

<p>
  <img alt="React" src="https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB" />
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.141-009688?logo=fastapi&logoColor=white" />
  <img alt="Python" src="https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white" />
  <img alt="Docker" src="https://img.shields.io/badge/Docker-first-2496ED?logo=docker&logoColor=white" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-Vitest%20%2B%20pytest-6E9F18" />
</p>

<p>
  <a href="README.md"><img alt="English" src="https://img.shields.io/badge/English-current-2563EB?style=for-the-badge" /></a>
  <a href="README.ru.md"><img alt="Русский" src="https://img.shields.io/badge/Russian-translation-64748B?style=for-the-badge" /></a>
</p>

</div>

<p align="center">
  <img src="docs/evidence-demo.gif" alt="Short demo of selecting evidence and receiving a score" width="960" />
</p>

## Stack

- React + Vite frontend
- FastAPI grading API
- Nginx reverse proxy
- Docker Compose runtime
- Optional OpenAI exercise generation

## Proposed Global Generation feature set

An extension for the Global Generation SAT Portal: a focused Digital SAT
Reading & Writing practice mode that makes students prove their answers rather
than guess them.

- **Evidence-first questions:** students highlight the exact words or sentences
  that support an answer before submitting it.
- **Transparent feedback:** show correctness, evidence coverage, and a concise
  explanation so learners can identify whether the mistake was in reasoning or
  proof selection.
- **Adaptive daily practice:** use performance by Reading & Writing domain and
  difficulty to recommend the next short practice set or targeted review.
- **Progress that supports a study plan:** surface accuracy, recurring error
  patterns, completion streaks, and a score-oriented forecast alongside the
  portal's existing curriculum and timed practice modes.
- **Teacher-ready content workflow:** generate draft exercises by difficulty,
  then keep answer keys and grading on the server so published practice remains
  reviewable and resistant to answer leakage.

This repository is a technical prototype for that evidence-first practice
experience. It currently demonstrates the exercise, selection UI, and
server-side grading boundary; portal integration, learner profiles, analytics,
and adaptive recommendations are proposed work.

## Docker

Requirements: Docker Desktop and Docker Compose.

```bash
cp .env.example .env
docker compose up --build
```

> [!IMPORTANT]
> **Set `OPENAI_API_KEY` in `.env` before starting Docker.** It is required for
> generated exercises. Without it, the app uses the deterministic fallback.

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
