# Small API

FastAPI app lives in `apps/api/app/main.py`.

Run locally:

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Health endpoints:
- `GET /` -> `{ "status": "ok" }`
- `GET /health` -> `{ "status": "ok" }`
