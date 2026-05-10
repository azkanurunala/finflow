# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project layout

Two independent apps live side-by-side; each has its own dependencies and its own `package.json`:

- [backend/](backend/) — FastAPI + MongoDB (Motor) Python service. Single-file app: [backend/server.py](backend/server.py) (~3000 lines, all routes mounted under `/api`).
- [frontend/](frontend/) — React Native / Expo Router app (TypeScript). Targets iOS, Android, and web (via Metro).
- The repo-root [package.json](package.json) only pins two deps for ad-hoc tooling — **do not run `npm install` from the root** for app work; cd into `frontend/` or `backend/`.

Test scripts at the repo root (`auth_test.py`, `backend_test.py`, `transaction_flow_test.py`, `voice_test_specific.py`, `final_voice_test.py`) hit the running backend over HTTP — they are integration scripts, not pytest suites.

## Common commands

### Backend (run from `backend/`)
```bash
python -m venv venv && venv\Scripts\activate    # Windows
pip install -r requirements.txt
uvicorn server:app --reload                     # dev server on :8000
```
Requires env vars `MONGO_URL`, `DB_NAME`, `EMERGENT_LLM_KEY` (loaded from `backend/.env` via `python-dotenv`).

### Frontend (run from `frontend/`)
```bash
npm install                # postinstall runs apply-expo-patch.js
npm start                  # expo start
npm run ios | android | web
npm run lint               # expo lint (eslint-config-expo)
npm test                   # jest
npm run test:watch
npm run test:coverage
npm run test:pbt           # property-based tests only (fast-check)
```
Single test file: `npx jest __tests__/AuthContext.test.ts`. Single test name: `npx jest -t "name fragment"`.

EAS builds are configured in [frontend/eas.json](frontend/eas.json) (`eas build --profile production|preview|development`). Android submission uses `google-services.json`; deployment runbooks live in [frontend/DEPLOY_ANDROID.md](frontend/DEPLOY_ANDROID.md), [frontend/DEPLOY_IOS.md](frontend/DEPLOY_IOS.md), and [backend/DEPLOY_BACKEND.md](backend/DEPLOY_BACKEND.md).

## Architecture

### Backend — single-file FastAPI (`backend/server.py`)

All routes are defined on one `api_router = APIRouter(prefix="/api")` and mounted at the bottom with `app.include_router(api_router)`. Sections (in file order): auth (session/email/Apple/Google), user settings & onboarding, subscription/coupon, notifications, chat persistence, transactions (chat / receipt / voice / voice-text / manual), insights, export, and **sync** (`/api/sync/migrate`, `/sync/prune`, `/sync/restore/{id}`, `/sync/deleted`).

Key shared state defined near the top of `server.py`:
- `SUBSCRIPTION_TIERS` and `PRODUCT_TIER_MAP` — source of truth for tier definitions, limits, and iOS/Android product ID → tier mapping (used by `/subscription/validate` for receipt validation).
- `US_CATEGORIES` — fixed transaction category list returned by `/api/categories`.
- `format_currency(amount, currency)` — locale-aware formatting helper (USD/EUR/GBP/JPY/SGD/IDR).
- `get_user_entitlement(user_id)` — central function for resolving a user's effective tier (handles expiry, trial, coupon).

AI calls go through `LlmChat` from `emergentintegrations` (chat / receipt OCR / voice transcription) — keys are abstracted server-side; the mobile client never sees them.

Auth is session-token-based: `Depends(require_auth)` reads bearer token, looks up `user_sessions`, enforces 30-day expiry, returns 401 on expiry. On the client, `apiClient` interceptor in [frontend/api/client.ts](frontend/api/client.ts) catches 401 and redirects to `/login`.

The data model treats `transactions` as the canonical store with **soft-delete** (`is_deleted`) + `updated_at` to enable delta sync. `/api/sync/migrate` backfills these fields for older rows.

### Frontend — Expo Router with offline-first SQLite

Routing is file-based in [frontend/app/](frontend/app/):
- [app/_layout.tsx](frontend/app/_layout.tsx) wraps the whole app in providers (order matters): `Network → Language → Currency → Auth → Subscription`. It also calls `initDb()` and imports `services/syncService` for its side effect (the singleton hooks `NetInfo`).
- `app/(app)/` — authenticated screens (tabs, add, chat, history, insights, profile, subscription, etc.).
- `app/onboarding-*.tsx` and `app/login.tsx`, `app/signup.tsx` — pre-auth flows.

Offline-first sync (the most subtle piece — read before touching transactions):
- [services/localDb.ts](frontend/services/localDb.ts) — `expo-sqlite` schema with three tables: `transactions` (mirror, with `sync_status: synced | pending | deleted`), `sync_outbox` (queued create/update/delete actions), `sync_metadata` (last sync timestamp). Exposes a `waitForDb()` promise so consumers can block until init.
- [services/syncService.ts](frontend/services/syncService.ts) — singleton instantiated at import time. Subscribes to `NetInfo`, debounces a sync when connectivity returns, drains `sync_outbox` to the backend, then pulls deltas via `/api/sync/...`. UI subscribes via `subscribe(listener)` and a Zustand store ([store/useRefreshStore.ts](frontend/store/useRefreshStore.ts)) signals lists to refetch.
- Writes from the UI go through `addPendingTransaction` (local-first) and reconcile on next sync. Don't write directly to `apiClient` for transaction CRUD — go through the sync layer.

Subscriptions use **RevenueCat** ([services/PaymentService.ts](frontend/services/PaymentService.ts)) for native purchase flow, with backend receipt validation via [services/SubscriptionApiClient.ts](frontend/services/SubscriptionApiClient.ts) (which has built-in retry/backoff config). Tier state is held in [contexts/SubscriptionContext.tsx](frontend/contexts/SubscriptionContext.tsx) via `useReducer`, with a cached snapshot in `AsyncStorage`.

Auth: Google/Apple sign-in plus email/password, all funneled through [contexts/AuthContext.tsx](frontend/contexts/AuthContext.tsx). OAuth-derived profile data is normalized in [services/ProfileExtractor.ts](frontend/services/ProfileExtractor.ts) and persisted via [services/ProfileStorageManager.ts](frontend/services/ProfileStorageManager.ts) — there's an active `social-auth-profile-fix` spec in [.kiro/specs/](.kiro/specs/) driving that area.

i18n: [utils/i18n.ts](frontend/utils/i18n.ts) loads 18 locales from [locales/](frontend/locales/) (en, id, es, fr, de, it, pt, zh, ja, ko, ar, hi, th, vi, ms, ru, tr, nl). Language is persisted under `user_locale` in `AsyncStorage`.

### Backend URL

[frontend/constants/Config.ts](frontend/constants/Config.ts) hardcodes `BACKEND_URL = "https://bugfix-brigade-3.emergent.host"` — change here to point the app at a local backend.

## Conventions worth knowing

- **Don't hand-edit `.pen` files** if any appear (encrypted; use the `pencil` MCP tools instead).
- All backend routes must be added to `api_router` (prefix `/api`), not `app` directly — the trailing `app.include_router(api_router)` is what mounts them.
- New transaction fields must respect the soft-delete + `updated_at` invariants used by the sync endpoints; if you add a column on the client, mirror it in `localDb.ts` schema and in `saveTransactionsLocally`/`addPendingTransaction`.
- Subscription tier changes: update `SUBSCRIPTION_TIERS` *and* `PRODUCT_TIER_MAP` in `server.py` together — receipt validation depends on both.
- Property-based tests use `fast-check` and are filtered by name pattern (`test:pbt` matches `'Property'`).
