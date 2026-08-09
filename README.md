# Find the Evidence (Monorepo)

This repo is structured as a lightweight monorepo for a React frontend and a small Python API.

## Structure

- `apps/web` — Vite + React frontend (existing UI)
- `apps/api` — FastAPI backend scaffold

## Frontend scripts

From repo root:

```bash
npm run web:dev         # start Vite app
npm run web:build       # type-check + production build
npm run web:test        # run vitest suite
npm run web:preview     # preview production build
```

## API scripts

```bash
npm run api:dev        # uvicorn with auto-reload
npm run api:start      # uvicorn for stable process
```

Install API deps from `apps/api/requirements.txt` and start from that folder if preferred.
