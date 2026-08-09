# API

FastAPI grading service. Dependencies are managed by `uv` and pinned in `uv.lock`.

```bash
uv sync
uv run uvicorn app.main:app --reload
uv run pytest
uv run ruff check .
```

Endpoints:

- `GET /health` — service health.
- `GET /api/exercises/rw-evidence-1` — public exercise data; no answer key.
- `POST /api/exercises/rw-evidence-1/submissions` — server-side grading.
