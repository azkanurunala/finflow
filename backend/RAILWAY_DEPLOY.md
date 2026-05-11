# Railway deploy — FinFlow backend

These are the exact clicks. Total time ~10 minutes.

## 0. Rotate the leaked OpenAI key first

`backend/server.py` previously hardcoded `sk-proj-QYu2xMColjGmjh_I1u8...` and that key is now in public git history. Go to https://platform.openai.com/api-keys, revoke that key, generate a new one. Hold onto the new key for step 3.

## 1. Create the Railway project

1. Open https://railway.app and log in as `azkanura` (same GitHub user that owns the repo).
2. **New Project → Deploy from GitHub repo → `azkanurunala/finflow`**.
3. After Railway introspects the repo, in **Settings → Service**:
   - **Root Directory**: `backend`
   - Build/start commands: leave default. Nixpacks reads `Procfile` and `runtime.txt`.

## 2. MongoDB Atlas (if not already done)

Either:
- Use the Atlas free tier at https://mongodb.com/cloud/atlas — see [DEPLOY_BACKEND.md](DEPLOY_BACKEND.md) for the click-by-click.
- Or use Railway's **Add Plugin → MongoDB** (provisions a hosted Mongo in the same project; the `MONGO_URL` env var is auto-injected). Simpler.

## 3. Set environment variables

In Railway **Settings → Variables**, paste these:

| Variable | Value |
|---|---|
| `MONGO_URL` | Atlas connection string (or auto-injected by Railway Mongo plugin) |
| `DB_NAME` | `finflow` |
| `OPENAI_API_KEY` | The new key from step 0 |

Optional:

| Variable | Default | Purpose |
|---|---|---|
| `LLM_TEXT_MODEL` | `gpt-4o-mini` | Text-only LLM model |
| `LLM_VISION_MODEL` | `gpt-4o` | Receipt OCR / vision |

## 4. Generate a public URL

In **Settings → Networking → Generate Domain**. Railway gives you a URL like `https://finflow-production-XXXX.up.railway.app`.

## 5. Verify the deploy

```
GET https://<your-railway-url>/health           → {"status":"ok"}
GET https://<your-railway-url>/api/health       → {"status":"healthy","app":"FinFlow API","version":"1.0.0"}
```

## 6. Hand the URL to the frontend

Reply with the Railway URL. Claude will:
- Update [frontend/constants/Config.ts](../frontend/constants/Config.ts) `BACKEND_URL`
- Commit + push
- Fire `eas build --profile production --platform all`
