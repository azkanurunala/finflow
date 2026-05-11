# FinFlow — Living PRD

> Evolutionary, additive-only product spec. Every iteration adds; nothing protected is removed or behaviorally changed.
> Iteration cursor: **Iterations 0–4 — SHIPPED.** Tags: `iteration-0-complete` … `iteration-4-complete`. Latest run: 27 suites / 242 tests / 0 fail. i18n audit: 76 findings (down from 108 — 29.6% reduction).
> **Iteration 5 — IN PROGRESS (performance focus).** Slices 1–3 **SHIPPED**: PG1 telemetry → PG3 SQLite + PG6 Mongo indexes → PG2 FlatList virtualization + PG12 single-query summary. Frontend suite 27/242 → **31/281** (four new suites, 39 new tests). Backend pytest 3/3 → **6/6**. 25 snapshots clean across all 3 slices. Remaining: PG10 lazy locales → PG5/PG7 compression + insights cache → carry-overs.
> **Deploy-prep:** finished migration off `emergentintegrations` (private SDK, dead PyPI) to direct `openai` SDK calls — backend now boots in any clean Python env. Railway artifacts (`backend/Procfile`, `runtime.txt`, `.env.example`, `RAILWAY_DEPLOY.md`) shipped. Awaiting user-paste of Atlas + OpenAI creds into Railway dashboard.

---

## Iteration 0 — Outcome (retrospective)

Captured 2026-05-10. Source-of-truth for what landed: [feature-registry.json](feature-registry.json).

### Shipped (9 of 14 gaps)

| Gap | Surface | Tests | Status in registry |
|---|---|---|---|
| **G1** session rotation | `POST /api/auth/refresh-session` (BE) + [services/SessionManager.ts](frontend/services/SessionManager.ts) + [api/client.ts](frontend/api/client.ts) interceptor | 5 | `evolving / shipped-soaking` |
| **G2** onboarding-balance sync | 3 sites in [contexts/AuthContext.tsx](frontend/contexts/AuthContext.tsx) re-pointed to `POST /api/auth/onboarding-balance` (was 404'ing on `/api/transactions`) | 4 | `evolving / shipped-soaking` |
| **G3** currency parity | [utils/currency.ts](frontend/utils/currency.ts) byte-mirrors backend `format_currency` for USD/EUR/GBP/JPY/SGD/IDR | 18 | `evolving / shipped-soaking` |
| **G4** i18n audit | [scripts/audit-i18n.ts](frontend/scripts/audit-i18n.ts) — heuristic scanner + CI hook | 7 | `evolving / shipped-soaking` |
| **G5** export fix | [utils/exportFile.ts](frontend/utils/exportFile.ts) (expo-file-system v19 `File` API) + [insights.tsx](frontend/app/(app)/insights.tsx) wiring | 4 | `evolving / shipped-soaking` |
| **G6** ReceiptSourcePicker | [components/ReceiptSourcePicker.tsx](frontend/components/ReceiptSourcePicker.tsx) + helpers | 5 | `evolving / shipped-soaking` |
| **G7** ChatApiClient | [services/ChatApiClient.ts](frontend/services/ChatApiClient.ts) — `/api/chat/*` wrapper | 6 | `evolving / shipped-soaking` |
| **G10** Profile real screens | [profile-personal-info.tsx](frontend/app/(app)/profile-personal-info.tsx) + [profile-about.tsx](frontend/app/(app)/profile-about.tsx); profile menu wired through | (snapshot infra deferred) | `evolving / shipped-soaking` |
| **G14** health-ping | `pingBackend()` + `isBackendHealthy` on [NetworkContext](frontend/contexts/NetworkContext.tsx) | 4 | `evolving / shipped-soaking` |

### Gate 0 — pre-iteration baseline repair

The dev-frontend baseline arrived with **35 failing tests across 4 suites**. Root causes and fixes (all additive scaffolding / bug-fix scope):

1. **Mock factory TDZ under jest@30 + babel-preset-expo** — `const mockX = jest.fn()` outer references resolved to `undefined` when the mock factory ran. Fix: define `jest.fn()`s inside the factory and retrieve via `jest.requireMock`. Applied to `PaymentService.test.ts`, `SubscriptionApiClient.test.ts`, `SubscriptionContext.test.ts`.
2. **Default-import interop** — babel-preset-expo emits `_module.default`, so mocks must expose `default: <surface>`.
3. **RevenueCat ESM bleeding into SubscriptionContext.test.ts** — added explicit mocks for `react-native-purchases`, `PaymentService`, `SubscriptionApiClient`.
4. **Empty `SubscriptionApiClient.retry.test.ts`** — populated with one passing placeholder + one `it.skip` documenting future G1 retry coverage.
5. **`createUserFriendlyError` flattened backend errors** — Direction-A code patch in [services/SubscriptionApiClient.ts](frontend/services/SubscriptionApiClient.ts): now surfaces `error.response.data.detail` verbatim; canonicalises offline (`NETWORK_ERROR`) and timeout (`TIMEOUT_ERROR`) messages to match contract tests.
6. **Stale `startTrial` signature test** — updated to current `{platform, language, currency}` body (Direction B; product evolved, test was old).

### Test-suite trajectory

| Stage | Suites | Tests pass / fail / skip |
|---|---|---|
| Initial run on `dev-frontend` HEAD | 4 fail / 7 pass | 116 / 35 / 0 |
| After Gate 0 baseline repair | 0 fail / 11 pass | 162 / 0 / 1 |
| After Iteration 0 G-work | 0 fail / 19 pass | 215 / 0 / 1 |
| Backend pytest (`backend/test_sync_logic.py`) | 0 fail / 1 pass | 3 / 0 / 0 |

### Deferred — moved to `planned` in registry with rationale

| Gap | Why deferred |
|---|---|
| **G8** IAP receipt verifier | Needs Apple App Store Connect shared secret + Google Play service account; sandbox tests blocked on creds |
| **G9** Email notification channel | Needs SES/SendGrid creds + DKIM domain; FE pref toggle blocked until BE channel exists |
| **G11/G12** Layout/font snapshot replacements | Snapshot infrastructure (jest-image-snapshot or RN serializers) does not yet exist in repo — Iteration 1 must land it before snapshot replacements can be certified |
| **G13** Coupon admin UI | Intentionally back-office, web-only, out of mobile scope |
| **i18n-bulk-migrate** | G4 audit script shipped; bulk replacement of every hardcoded string across 24 screens warrants its own pass |
| **receipt-picker-rollout** | Component exists; per-entry-point integration + verification is a follow-up |
| **chat-screen-hydration** | `ChatApiClient` shipped; wiring `chat.tsx` to hydrate on mount is a follow-up |
| **profile-security-screen** | Blocked on missing BE endpoints (`PUT /api/auth/password`, `DELETE /api/auth/me`) |

### Files changed in Iteration 0

**Source (additive or bug-fix scope, no protected entries removed):**
- BE: [backend/server.py](backend/server.py) (added `POST /api/auth/refresh-session` + `SESSION_GRACE_DAYS`)
- FE source: `services/SessionManager.ts` (new), `services/ChatApiClient.ts` (new), `services/SubscriptionApiClient.ts` (patched), `utils/exportFile.ts` (new), `utils/currency.ts` (extended), `components/ReceiptSourcePicker.tsx` (new), `contexts/NetworkContext.tsx` (extended), `contexts/AuthContext.tsx` (3-site bug fix), `api/client.ts` (extended), `app/(app)/insights.tsx` (wired through new helper), `app/(app)/profile.tsx` (wired through new routes), `app/(app)/profile-personal-info.tsx` (new), `app/(app)/profile-about.tsx` (new), `scripts/audit-i18n.ts` (new)

**Tests (8 new files + 4 scaffolding patches):**
- New: `OnboardingBalanceSync.test.ts`, `currencyFormat.test.ts`, `NetworkBackendPing.test.ts`, `ReceiptSourcePicker.test.ts`, `ChatApiClient.test.ts`, `SessionManager.test.ts`, `exportFile.test.ts`, `auditI18n.test.ts`
- Scaffolding fix: `PaymentService.test.ts`, `SubscriptionApiClient.test.ts`, `SubscriptionContext.test.ts`, `SubscriptionApiClient.retry.test.ts` (was empty)

### Tags placed

- `pre-iteration-0` — rollback anchor
- `iteration-0-complete` — milestone

---

## Iteration 5 — Plan (performance focus)

Theme: **measurable performance under the additive-only constraint.** Iter 0–4 closed all 14 functional sync gaps that had inputs available; the remaining drag on the app is not feature-shaped, it's runtime-shaped — list scroll on long histories, cold-start bundle size, un-indexed Mongo + SQLite reads, full-resolution receipt uploads. Iter 5 makes those measurable and then closes the largest ones.

**Recon findings backing this iteration** (verified pre-plan):

- [frontend/app/(app)/history.tsx:310](frontend/app/(app)/history.tsx) — uses `FlatList` but with **zero virtualization props** (no `windowSize`, no `getItemLayout`, no `initialNumToRender`, no `removeClippedSubviews`). Default windowSize=21 wastes layout work past ~200 rows.
- [frontend/services/localDb.ts:43-69](frontend/services/localDb.ts) — `transactions`, `sync_outbox`, `sync_metadata` schema has **no `CREATE INDEX`** anywhere. Hot queries (`WHERE sync_status != 'deleted' ORDER BY date DESC`, sync delta lookups) full-scan.
- [backend/server.py](backend/server.py) — no `create_index` / `create_indexes` calls. Every Mongo query against `transactions`, `user_sessions`, `notifications`, `coupons` is unindexed.
- [frontend/utils/i18n.ts:1-20](frontend/utils/i18n.ts) — static `import` of all 18 locale modules at app boot; locale switching never needs more than 1 active + the `en` fallback at any moment.
- [frontend/services/localDb.ts](frontend/services/localDb.ts) `getSummaryLocally` — runs two separate `SELECT SUM(...)` queries; one `CASE WHEN` would do.
- `/api/insights` and `/api/insights/ai` ([backend/server.py:2551, :2703](backend/server.py)) recompute aggregations every call; per-user 60s cache is invisible to clients.

### New gaps — PG series

| # | Surface | Owner | Priority | Complexity | Mode |
|---|---|---|---|---|---|
| **PG1** | App perf telemetry (cold-start TTI, route-mount, sync drain duration) → `perf-baseline.json` | FE | **Critical (prereq)** | M | new evolving |
| **PG2** | `FlatList` virtualization tuning on history.tsx (+ any other long-list screens) | FE | High | S | bug-fix scope |
| **PG3** | SQLite indexes on `transactions(sync_status, date)` and `transactions(updated_at)` and `sync_outbox(timestamp)` | FE | High | S | new evolving (additive DDL) |
| **PG6** | Mongo compound indexes on `transactions`, `user_sessions`, `notifications`, `coupons` (created in FastAPI startup hook) | BE | High | S | new evolving |
| **PG10** | Lazy-load locale dictionaries — keep `en` + active locale statically imported, dynamic-import the other 16 on language switch | FE | Medium | M | service-extension on `utils/i18n.ts` |
| **PG12** | Single-query home summary (combined `SUM(CASE WHEN ...)`) + memoize result for 1s window across mount-flurries | FE | Low | XS | bug-fix scope |
| **PG5** | Receipt image compress + resize (≤1600px long edge, JPEG q=0.85) before base64 → `/api/transactions/receipt` | FE | Medium | S | new evolving |
| **PG7** | Per-user 60s cache for `/api/insights` and `/api/insights/ai`; invalidated by any tx mutation on the same `user_id` | BE | Medium | M | new evolving |

> No protected entry is removed by any PG-item. PG3/PG6 are pure index additions (`CREATE INDEX IF NOT EXISTS`, `create_indexes(...)` are idempotent). PG10 keeps `utils/i18n.ts` exports byte-identical — only the import strategy changes behind it. PG12 preserves `getSummaryLocally`'s return-shape. PG7 invalidation is the only semantic change and is bounded by TTL.

### Evolution detail (per gap)

#### PG1 — Perf telemetry baseline (Critical, FE — gates everything else)

- **What to build:** Lightweight measurement layer that records timestamps at four anchors and emits them to (a) `console.info('[perf]', payload)` for local + Sentry breadcrumb in dev/prod, and (b) a local AsyncStorage ring buffer (`perf_samples`, max 50) for in-app inspection.
  - Anchors: `app.bootStart` (in [app/_layout.tsx](frontend/app/_layout.tsx) top-level effect), `app.firstRouteMount` (in each `app/(app)/*` `useEffect(() => {…}, [])`), `db.initComplete` (in [localDb.ts](frontend/services/localDb.ts) `initDb` tail), `sync.drainComplete` (in [syncService.ts](frontend/services/syncService.ts) after outbox drain).
- **Files to create:**
  - `frontend/utils/perf.ts` (new) — `mark(name)`, `measure(from, to)`, `flushSamples()`, in-memory + AsyncStorage ring buffer.
  - `frontend/__tests__/perf.test.ts` (new) — verifies anchor ordering, ring-buffer eviction, monotonic clock guards.
  - `perf-baseline.json` (new, repo root) — committed at end of iteration with the first measured medians. Future iterations diff against this.
- **Files to extend (additive only):** the four anchor sites above. Each becomes a single-line `perf.mark('…')` insertion; existing behavior unchanged.
- **Acceptance criteria:** `flushSamples()` returns a JSON array; `app.bootStart → app.firstRouteMount` median over 5 runs is recorded; CI gate compares post-iteration median ≤ 1.10× baseline (Gate 6 — see below).
- **Complexity:** M.
- **New tests required:** unit (perf helper) + integration (anchors fire in expected order on a happy-path render).

#### PG2 — FlatList virtualization (High, FE — bug-fix scope)

- **What to build:** Add `windowSize={7}`, `initialNumToRender={12}`, `maxToRenderPerBatch={8}`, `removeClippedSubviews` (Android only — leave iOS default), and `getItemLayout` (transaction rows are fixed-height per current styles) to the `<FlatList>` at [history.tsx:310](frontend/app/(app)/history.tsx). Row height is constant — compute it once from the existing `styles.transactionRow` heights and export the constant from a sibling helper for reuse.
- **Files to extend:** `frontend/app/(app)/history.tsx`.
- **Files to create:** `frontend/utils/listLayout.ts` (new) — exports `TRANSACTION_ROW_HEIGHT` constant + `getTransactionItemLayout` helper.
- **Acceptance criteria:**
  - Existing snapshot of `history.tsx` continues to match (bug-fix scope, but the rendered DOM is byte-identical for the same data).
  - On a synthetic 1000-row dataset, scroll-to-bottom completes in ≤2s on iPhone 12 emulator (recorded via PG1 telemetry as `history.scrollEnd`).
- **Complexity:** S.
- **New tests required:** unit (`getTransactionItemLayout` is pure math) + perf assertion (`history.scrollEnd` recorded).

#### PG3 — SQLite indexes (High, FE)

- **What to build:** Append three `CREATE INDEX IF NOT EXISTS` statements at the end of `initDb` in [localDb.ts](frontend/services/localDb.ts):
  - `idx_tx_sync_date` on `transactions(sync_status, date DESC)` — primary list query.
  - `idx_tx_updated` on `transactions(last_updated)` — delta sync candidate set.
  - `idx_outbox_ts` on `sync_outbox(timestamp)` — drain ordering.
- **Files to extend:** [frontend/services/localDb.ts](frontend/services/localDb.ts) — only the `execAsync` DDL string grows; exported function signatures unchanged.
- **Acceptance criteria:** Indexes exist after `initDb` (asserted via `PRAGMA index_list('transactions')`); `EXPLAIN QUERY PLAN` on the two hot queries reports `SEARCH … USING INDEX` rather than `SCAN`. Existing local-db tests still pass byte-identical.
- **Complexity:** S.
- **New tests required:** unit (`PRAGMA index_list` assertion) + regression (`getTransactionsLocally` return values unchanged across schema-upgrade boundary).

#### PG6 — MongoDB indexes (High, BE)

- **What to build:** Add an `@app.on_event("startup")` hook in [backend/server.py](backend/server.py) (the file already has a `@app.on_event("shutdown")` at line ~2999 — mirror it) that calls `await db.<col>.create_indexes([...])` with:
  - `transactions`: `[(user_id, 1), (date, -1)]`, `[(user_id, 1), (updated_at, 1)]`, `[(user_id, 1), (is_deleted, 1)]`
  - `user_sessions`: `[(session_token, 1)] unique`, `[(expires_at, 1)] TTL`
  - `notifications`: `[(user_id, 1), (created_at, -1)]`
  - `coupons`: `[(code, 1)] unique`
- **Files to extend:** [backend/server.py](backend/server.py) — additive startup hook only.
- **Acceptance criteria:** all `db.<col>.index_information()` post-startup contains the new keys. Existing `backend/test_sync_logic.py` (3 tests) stays green. No removal of the default `_id_` indexes. OpenAPI snapshot byte-identical (this change is pure storage-layer).
- **Complexity:** S.
- **New tests required:** pytest fixture that boots the app, asserts indexes present.

#### PG10 — Lazy locale loading (Medium, FE)

- **What to build:** Refactor [frontend/utils/i18n.ts](frontend/utils/i18n.ts) so that:
  - Only `en` is statically imported at module load.
  - `i18n.translations` is seeded with `{ en }`.
  - On `setLocale(code)`, if `code !== 'en'` and not already in `i18n.translations`, dynamically `await import(`../locales/${code}`)` and merge before flipping the active locale.
  - Public exports (`initI18n`, `setLocale`, the `i18n` default) keep identical signatures.
- **Files to extend:** [frontend/utils/i18n.ts](frontend/utils/i18n.ts).
- **Files to reference (read-only):** all 18 locale files — none renamed, none deleted.
- **Acceptance criteria:** Bundle size (Metro `expo export --platform ios --analyze` or equivalent) shrinks by the sum of 17 non-active locale modules at boot; cold-boot TTI measured by PG1 improves ≥5%. Language switch on first use of a non-active locale completes within 100ms on emulator.
- **Complexity:** M (async coordination + cache).
- **New tests required:** unit (mocked dynamic import) + integration (switch from `en → id` triggers exactly one dynamic load; second switch is a no-op).

#### PG12 — Single-query home summary (Low, FE — bug-fix scope)

- **What to build:** Replace the two-`SELECT SUM(...)` pattern in [localDb.ts](frontend/services/localDb.ts) `getSummaryLocally` with one `SELECT SUM(CASE WHEN transaction_type='income' THEN amount ELSE 0 END) AS income, SUM(CASE WHEN transaction_type='expense' THEN amount ELSE 0 END) AS expenses FROM transactions WHERE sync_status != 'deleted'`. Memoize result in-module for 1s to absorb mount-burst (home, history, insights all re-call on focus).
- **Files to extend:** [frontend/services/localDb.ts](frontend/services/localDb.ts).
- **Acceptance criteria:** function returns identical shape `{ total_income, total_expenses }`; under property test with 100 random tx-sets, output matches the pre-refactor implementation byte-for-byte.
- **Complexity:** XS.
- **New tests required:** property test (parity vs. legacy two-query impl) + unit (1s memo expires correctly).

#### PG5 — Receipt compression before upload (Medium, FE)

- **What to build:** Before any call to `POST /api/transactions/receipt`, route the image through `expo-image-manipulator` to resize to ≤1600px on the long edge and re-encode JPEG at quality 0.85. Wrap as `frontend/utils/imageCompress.ts`. Hook into the existing receipt entry points (`ReceiptSourcePicker` consumers, `manual.tsx` if it accepts attachments, chat-attach if applicable).
- **Files to create:** `frontend/utils/imageCompress.ts`, `frontend/__tests__/imageCompress.test.ts`.
- **Files to extend:** call sites of `ReceiptSourcePicker.launchCamera` / `launchLibrary` consumers — additive (pass the result through the new helper before base64-encoding).
- **Acceptance criteria:** A 4032×3024 receipt photo is reduced to ≤1600×1200 with file size ≤500KB; OCR result on a fixture image is functionally equivalent (same merchant + amount + category extracted) within the existing OCR test corpus.
- **Complexity:** S.
- **New tests required:** unit (helper output dimensions + size) + integration smoke against the `/api/transactions/receipt` mock.

#### PG7 — Insights endpoint caching (Medium, BE)

- **What to build:** In-process per-user TTL cache (60s) around `/api/insights` and `/api/insights/ai`. Stored as `dict[str, tuple[float, dict]]` keyed by `user_id`. Any of `POST /api/transactions/{chat,receipt,voice,voice-text,manual}`, `PUT /api/transactions/{id}`, `DELETE /api/transactions/{id}` invalidates the corresponding user entry before returning. Headers: emit `X-Cache: HIT|MISS` for observability.
- **Files to extend:** [backend/server.py](backend/server.py) — new module-level dict, helper `_invalidate_insights(user_id)` called at the end of each tx-mutating handler. Existing response shapes unchanged.
- **Acceptance criteria:**
  - Two consecutive `GET /api/insights` calls within 60s for the same user → second is `X-Cache: HIT`, identical body.
  - A `POST /api/transactions/manual` between them → next `GET /api/insights` is `X-Cache: MISS`.
  - Cache is per-user (cross-user requests do not see each other's data — tested with two mock users).
- **Complexity:** M (invalidation hooks span 7 handlers; care needed to not break existing 200 contracts).
- **New tests required:** pytest (hit/miss/invalidate matrix, cross-user isolation, TTL expiry).

### Iteration 5 acceptance gates (extends the standard 5)

- **Gate 6 — Perf-regression gate.** New file `perf-baseline.json` at repo root. CI step compares `perf_samples` medians collected by PG1 against baseline. Reject PR if any tracked metric regresses >10%. First iteration to ship PG1 *sets* the baseline; subsequent iterations *defend* it.
- All other gates (1–5) unchanged.

### Files registered in `feature-registry.json` (additions only)

```jsonc
"evolving": [
  { "id": "pg1.perf-telemetry",    "layer": "frontend", "type": "service",   "ref": "frontend/utils/perf.ts",         "status": "in-progress", "added_in": "iteration-5" },
  { "id": "pg2.tx-list-virtual",   "layer": "frontend", "type": "page",      "ref": "frontend/app/(app)/history.tsx", "status": "bug-fix",     "added_in": "iteration-5" },
  { "id": "pg3.sqlite-indexes",    "layer": "frontend", "type": "service",   "ref": "frontend/services/localDb.ts",   "status": "in-progress", "added_in": "iteration-5" },
  { "id": "pg5.receipt-compress",  "layer": "frontend", "type": "service",   "ref": "frontend/utils/imageCompress.ts","status": "in-progress", "added_in": "iteration-5" },
  { "id": "pg6.mongo-indexes",     "layer": "backend",  "type": "service",   "ref": "backend/server.py startup hook", "status": "in-progress", "added_in": "iteration-5" },
  { "id": "pg7.insights-cache",    "layer": "backend",  "type": "service",   "ref": "backend/server.py insights TTL", "status": "in-progress", "added_in": "iteration-5" },
  { "id": "pg10.lazy-locales",     "layer": "frontend", "type": "service",   "ref": "frontend/utils/i18n.ts",         "status": "in-progress", "added_in": "iteration-5" },
  { "id": "pg12.home-summary-1q",  "layer": "frontend", "type": "service",   "ref": "frontend/services/localDb.ts",   "status": "bug-fix",     "added_in": "iteration-5" }
]
```

### Carried over (non-perf, deferred from Iter 4)

- BottomNavWithAddModal + TransactionFilter snapshot baselines (still deferred due to `@react-native-community/datetimepicker` + `date-fns` mocking complexity — Iter 5 should land at least BottomNavWithAddModal since it has no native-date dep).
- First three route-level snapshot baselines: `login.tsx`, `signup.tsx`, `onboarding-language.tsx`.
- i18n batch 5: chat screen interior labels (`AI Assistant`, `Selected Package`, `Initiating`, `Processing`, `Validating`, `Retry`, `Cancel`). Target audit: 76 → ≤69.

### Promotions this iteration

- Iter 4 added baselines (CouponRedeemModal, ReceiptSourcePicker UI snapshots) — promote `shipped-soaking → protected` per Rule (one full iteration without regression).
- No PG-item is promoted in Iter 5; they all enter as `evolving` and soak through Iter 6.

### Sequencing inside the iteration

PG1 must land first — every other PG-item's acceptance criterion references metrics it produces. Recommended slice order:

1. **Slice 1 — PG1 telemetry + `perf-baseline.json` seed.** No behavior change; only marks + measurements.
2. **Slice 2 — PG3 + PG6 indexes.** Pure additive DDL on both sides. Measure index impact via PG1.
3. **Slice 3 — PG2 virtualization + PG12 single-query summary.** Visible UX improvements; bug-fix scope keeps snapshots intact.
4. **Slice 4 — PG10 lazy locales.** Biggest cold-start win; standalone so it can be rolled back independently if dynamic-import surfaces issues under Hermes.
5. **Slice 5 — PG5 receipt compression + PG7 insights cache.** Both are pure additions to the request/response flow with TTL bounds.
6. **Slice 6 — carry-overs (snapshot baselines + i18n batch 5).**

### Risks / known unknowns

- **Hermes + dynamic `import()` interaction** for PG10. Metro should resolve dynamic imports of static string-literal paths at build time, but `import(`../locales/${code}`)` uses template interpolation. Verify with `expo export` analyze before relying on it; fall back to a `switch(code)` over 17 static dynamic-imports if template-interpolation isn't bundled.
- **expo-sqlite index migration** for PG3. Adding `CREATE INDEX IF NOT EXISTS` on an existing user's DB is safe (idempotent), but on first run after upgrade the indexes are built synchronously on app launch; with very large local DBs this could add visible latency. Measure via PG1 — if `db.initComplete` regresses >50% for users with >5000 rows, defer index build to a background task post-`initDb` resolve.
- **PG7 invalidation completeness.** 7 mutation handlers need invalidation calls; missing one creates a stale-insights bug. Mitigate with a `pytest` matrix that exercises each mutation endpoint and asserts the next `/api/insights` is `X-Cache: MISS`.

### Tags to place

- `pre-iteration-5` — before any Iter 5 slice lands.
- `iteration-5-complete` — at end.

### Slice 1 — SHIPPED (PG1 perf telemetry + baseline)

| | |
|---|---|
| Files added | [frontend/utils/perf.ts](frontend/utils/perf.ts), [frontend/__tests__/perf.test.ts](frontend/__tests__/perf.test.ts), [perf-baseline.json](perf-baseline.json) |
| Files extended (additive only) | [frontend/app/_layout.tsx](frontend/app/_layout.tsx) (boot + first-route-mount marks), [frontend/services/localDb.ts](frontend/services/localDb.ts) (db.initComplete mark after `initDb` resolves), [frontend/services/syncService.ts](frontend/services/syncService.ts) (drainStart/drainComplete marks bracketing `syncWithRemote`) |
| API surface | `mark(anchor)`, `measure(from, to, name?)`, `flushSamples()`, `clearSamples()`, `getMark(anchor)`, `resetMarksForTest()` — all from `utils/perf` |
| Anchor union | `app.bootStart`, `app.firstRouteMount`, `db.initComplete`, `sync.drainStart`, `sync.drainComplete`, `history.scrollEnd` (reserved for PG2), `locale.dynamicLoad` (reserved for PG10) |
| Persistence | AsyncStorage ring buffer `perf_samples`, max 50 entries; eviction is FIFO; reads/writes are crash-safe (telemetry never throws into the host) |
| Clock source | `globalThis.performance.now()` preferred (Hermes provides it, monotonic), `Date.now()` fallback; negative deltas clamped to 0 (clock-jump guard) |
| Tests added | 14 — clock-source selection, mark/measure pairing, missing-mark guard, negative-delta clamp, ring-buffer eviction at 50, AsyncStorage persistence, `flushSamples` empty case, `clearSamples` round-trip, crash-safety under storage rejection |
| Baseline file | [perf-baseline.json](perf-baseline.json) seeded with 5 metric placeholders (`boot.tti`, `db.initFromBoot`, `sync.drainDuration`, `history.scrollEnd`, `locale.dynamicLoad`) — values null until first capture; Gate 6 informational this iteration, enforces from Iter 6 |
| Suite trajectory | 27 / 242 / 1 → **28 / 256 / 1**. No snapshot drift. Backend pytest unchanged (3/3). |
| Typecheck | `tsc --noEmit` reports zero new errors on changed files; pre-existing errors in `payment-processing.tsx`, `profile.tsx`, `subscription.tsx`, `free-trial.tsx`, `RecordingModal.tsx` are unchanged. |

### Slice 2 — SHIPPED (PG3 SQLite indexes + PG6 Mongo indexes)

| | |
|---|---|
| Files extended (additive only) | [frontend/services/localDb.ts](frontend/services/localDb.ts) — three `CREATE INDEX IF NOT EXISTS` statements appended to the existing DDL block (one round-trip), [backend/server.py](backend/server.py) — new `@app.on_event("startup") async def ensure_mongo_indexes()` mirroring the existing shutdown hook |
| Files added | [frontend/__tests__/localDbIndexes.test.ts](frontend/__tests__/localDbIndexes.test.ts), [backend/test_pg6_indexes.py](backend/test_pg6_indexes.py) |
| SQLite indexes (PG3) | `idx_tx_sync_date` on `transactions(sync_status, date DESC)` — history list; `idx_tx_last_updated` on `transactions(last_updated)` — sync delta candidate set; `idx_outbox_ts` on `sync_outbox(timestamp)` — drain ordering. All `IF NOT EXISTS` (idempotent on upgrade). |
| Mongo indexes (PG6) | `transactions` × 3 compound (user_id, date DESC / updated_at / is_deleted); `user_sessions` (session_token UNIQUE + expires_at TTL with `expireAfterSeconds=0`); `notifications` (user_id, created_at DESC); `coupons` (code UNIQUE). |
| Per-spec resilience | Each create_index is wrapped in try/except — a single stale-spec conflict logs a warning and is skipped, never crashes Render boot. Test `test_one_failing_spec_does_not_abort_others` asserts this. |
| Tests added | PG3: 5 — DDL regex match for each index name + table, single-round-trip assertion, IF-NOT-EXISTS count = 3. PG6: 3 — all 7 indexes created across 4 collections, unique/TTL flags pass through, one-failing-spec resilience. |
| Suite trajectory | Frontend 28/256/1 → **29/261/1**. Backend 3/3 → **6/6**. No snapshot drift. |
| Mock-factory note | localDbIndexes.test.ts hit the documented jest@30 + babel-preset-expo TDZ trap; fixed by inlining `jest.fn()` declarations inside the factory and retrieving via `jest.requireMock` (same pattern as Iter 0 Gate-0 repairs to `PaymentService.test.ts` et al). |
| Deprecation warnings | The new startup hook uses `@app.on_event("startup")` deliberately to mirror the existing shutdown hook idiom. FastAPI now prefers lifespan handlers but migrating both events is a non-additive change reserved for a future cleanup iteration. |

### Slice 3 — SHIPPED (PG2 FlatList virtualization + PG12 single-query home summary)

| | |
|---|---|
| Files added | [frontend/utils/listLayout.ts](frontend/utils/listLayout.ts), [frontend/__tests__/listLayout.test.ts](frontend/__tests__/listLayout.test.ts), [frontend/__tests__/localDbSummary.test.ts](frontend/__tests__/localDbSummary.test.ts) |
| Files extended (additive / bug-fix scope) | [frontend/app/(app)/history.tsx](frontend/app/(app)/history.tsx) — spread `{...LONG_LIST_VIRTUALIZATION}` onto the FlatList + `onEndReached` perf mark; [frontend/services/localDb.ts](frontend/services/localDb.ts) — single-query `getSummaryLocally` with 1s mount-flurry memo + new `invalidateSummaryMemo` helper wired into all 5 mutation paths (add/update/delete/save/purge) |
| PG2 prop bundle | `windowSize=7`, `initialNumToRender=12`, `maxToRenderPerBatch=8`, `removeClippedSubviews` Android-only (iOS has known re-mount issues), `updateCellsBatchingPeriod=50` |
| PG2 deviation from plan | `getItemLayout` **not** applied to history.tsx: rows are variable-height (optional notes line). `makeFixedItemLayout` factory still exported from `utils/listLayout.ts` for future fixed-height lists; documented inline. |
| PG12 query shape | one `getFirstAsync` with `SUM(CASE WHEN transaction_type='income'/'expense' THEN amount ELSE 0 END)`; preserves `{ total_income, total_expenses }` byte-for-byte |
| PG12 memo invariant | 1s TTL absorbs mount-flurry across Home / History / Insights focusing in sequence; ANY mutation flushes it so callers never observe a stale total |
| Tests added | listLayout: 8 — windowSize/initial/batch bounds, Android-only clipping, factory purity. localDbSummary: 12 — single-call assertion, CASE-WHEN SQL match, shape preservation, null-coalesce, TTL hit/miss, 5 mutation-invalidation cases (one `it.each` row per mutation path), fast-check property test asserting parity with the legacy two-query implementation across 30 random tx-sets. |
| Perf instrumentation | New `history.scrollEnd` mark fires on `onEndReached` (threshold 0.1); `measure("app.firstRouteMount", "history.scrollEnd", "history.scrollEndFromMount")` is captured into the PG1 ring buffer for the Gate 6 baseline. |
| Suite trajectory | Frontend 29/261/1 → **31/281/1** (two new suites, 20 new tests). Backend pytest unchanged (6/6). |
| Snapshot impact | Zero — bug-fix scope preserves visual output. History.tsx has no snapshot baseline yet (route-level snapshots are Iter 5 Slice 6 work); if/when one lands, the rendered DOM is byte-identical for the same data. |

### Iteration 5 progress checklist

- [x] **Slice 1** — PG1 telemetry + baseline.
- [x] **Slice 2** — PG3 (SQLite indexes) + PG6 (Mongo indexes via FastAPI startup hook).
- [x] **Slice 3** — PG2 (FlatList virtualization) + PG12 (single-query home summary).
- [ ] **Slice 4** — PG10 (lazy locale loading).
- [ ] **Slice 5** — PG5 (receipt compression) + PG7 (insights TTL cache).
- [ ] **Slice 6** — carry-overs (BottomNavWithAddModal snapshot, three route-level baselines, i18n batch 5).

---

## Iteration 4 — Outcome (retrospective)

Tag: `iteration-4-complete`. Two slices.

| Slice | Surface | Commit |
|---|---|---|
| 1 | CouponRedeemModal (2 prop variants) + ReceiptSourcePicker UI (3 variants) snapshot baselines | `d0275461` |
| 2 | i18n batch 4: 13 home-screen labels migrated (Total Balance, FAB action labels, Recent Activity, View All, success-modal field labels, Done, Tap to edit); audit 89 → 76 | `928a3bf6` |

End state: **27 suites / 242 pass / 1 skipped** under `--ci`. Backend pytest 3/3. i18n audit: **76 findings** (108 → 76 cumulative, ~30% reduction).

### Cumulative snapshot coverage (8 components, 25 prop variants)

PricingDisplay · OfflineBanner · SubscriptionStatusCard · SubscriptionTierCard · BottomNavigation · CouponInput · CouponRedeemModal · ReceiptSourcePicker. All 10 components in the original registry now have at least one snapshot baseline except 2: **BottomNavWithAddModal** and **TransactionFilter** (the latter pulls in `@react-native-community/datetimepicker` and `date-fns` and is more involved).

### Iteration 5 candidates

- The last two component snapshots (BottomNavWithAddModal, TransactionFilter — non-trivial due to native deps).
- Begin route-level snapshot baselines (24 screens). Start with the simpler ones: `login.tsx`, `signup.tsx`, `onboarding-language.tsx`.
- i18n batch 5: chat screen interior labels (`AI Assistant`, `Selected Package`, `Initiating`, `Processing`, `Validating`, `Retry`, `Cancel`).
- G8 / G9 / profile-security — still blocked on external prerequisites.

---

## Iteration 3 — Outcome (retrospective)

Tag: `iteration-3-complete`. Three slices.

| Slice | Surface | Commit |
|---|---|---|
| 1 | Promoted 4 Iter-1 capabilities (receipt-picker-rollout, chat-screen-hydration, G11, G12) from `shipped-soaking` to `protected` | `c848d9ca` |
| 2 | CouponInput snapshot baseline (2 prop variants) + pre-existing **missing `Platform` import bug fixed** (line 167 would crash at render) | `95bb1494` |
| 3 | i18n batch 3: 7 currency/language screen header strings → `t(...)`; audit 96 → 89 | `17783cdd` |

End state: **25 suites / 237 pass / 1 skipped** under `--ci`. Backend pytest 3/3.

### Promoted to `protected` this iteration

`receipt-picker-rollout` · `chat-screen-hydration` · G11 sub-layout · G12 home-fontsize.

13 capability-level entries are now `protected` (9 from Iter 0 + 4 from Iter 1). No `shipped-soaking` entries remain at the end of Iter 3 — Iter 2 added file-level entries only, no new capabilities to soak.

### Bug found and fixed in baseline

`components/CouponInput.tsx:167` referenced `Platform.OS` without importing `Platform`. The component would crash at render. Caught by the snapshot pipeline. Bug-fix scope per Rule A. This is exactly the kind of latent issue the additive evolution loop is designed to surface.

### Iteration 4 candidates

- Continue snapshot expansion: CouponRedeemModal, TransactionFilter, RecordingModal, BottomNavWithAddModal, then move to route-level baselines.
- Continue i18n bulk-migrate (89 → fewer); next batch could be the home-screen action labels (`Chat`, `Voice Log`, `Scan`, `Recent Activity`, `View All`, etc.) which all live in one file.
- Once snapshot pipeline has covered all 10 components and several screens, capabilities like `snapshot-infra` itself become candidates for `protected` promotion.
- G8 IAP verifier and G9 email channel — still blocked on external creds.
- profile-security-screen — still blocked on BE password-change + delete-account endpoints.

---

## Iteration 2 — Outcome (retrospective)

Tag: `iteration-2-complete`. Three focused slices.

| Slice | Surface | Commit |
|---|---|---|
| Gate 1 repair | Pinned system clock in `SubscriptionStatusCard.snapshot.test.tsx` (snapshot drifted with day change: 235 → 234 days remaining) | `8de92f22` |
| 1 | Promoted 9 Iteration 0 capabilities (G1–G7, G10, G14) from `shipped-soaking` to `protected` after one-cycle soak | `6419e38b` |
| 2 | 8 new visual baselines: SubscriptionTierCard (5 prop variants) + BottomNavigation (3 active-route variants) | `3d94198f` |
| 3 | i18n batch 2: last `Alert.alert("Error", ...)` site + Notes label/placeholder pair across 2 screens; audit 101 → 96 | `919775e5` |

End state: **24 suites / 235 pass / 1 skipped** under `--ci`. Backend pytest 3/3. i18n audit: **96 findings** (down 12 since Iter 0).

### Promoted to `protected` this iteration

G1 session-rotation · G2 onboarding-balance · G3 currency parity · G4 i18n audit · G5 export-file · G6 receipt-picker · G7 chat-api-client · G10 profile routes · G14 health-ping.

Still `shipped-soaking` (will soak through Iter 3): receipt-picker-rollout, chat-screen-hydration, G11 sub-layout, G12 home-fontsize.

### Iteration 3 candidates

- Continue snapshot expansion (CouponInput, CouponRedeemModal, TransactionFilter, PricingDisplay alternate variants, route-level baselines).
- Continue i18n bulk-migrate (96 → fewer); next mechanical target is the `[jsx-text]` headers (`Select Currency`, `Apply Language`, `Confirm Selection`, `Display Language`, `All Languages`, etc.) which each appear once but cluster in language/currency screens.
- Promote Iter 1 `shipped-soaking` capabilities to `protected`.
- G8 IAP verifier and G9 email channel — still blocked on external creds.
- profile-security-screen — still blocked on BE password-change + delete-account endpoints.

---

## Iteration 1 — Outcome (retrospective)

Tag: `iteration-1-complete`. Six slices, six commits, all green.

| Slice | Surface | Tests | Commit |
|---|---|---|---|
| 1a | Snapshot infra (renderToSnapshot helper, PricingDisplay baseline 3 variants) | 3 | `c3b269d7` |
| 1b | Snapshot expansion (OfflineBanner 3 + SubscriptionStatusCard 4) | 7 | `fe6222df` |
| 2/3 | G11 explicit 1-column tier layout + G12 income/expense font bump 16→22 | covered by suite | `85667ccb` |
| 4 | chat.tsx routed through ChatApiClient (3 sites) | regression | `def99048` |
| 5 | i18n: 8 `Alert.alert("Error", ...)` sites → `t('common.error')`; audit count 108 → 101; `npm run audit:i18n` script added | regression | `3dfcf60e` |
| 6 | RecordingModal routed through ReceiptSourcePicker helpers (`includeBase64` option added; 50+ lines of duplicated permission/launch logic removed) | 2 | `1968ef03` |

End state: **22 suites / 227 pass / 1 skipped** under `--ci`. Backend pytest 3/3.

### Iteration 2 candidates
- Continue snapshot expansion to remaining components (CouponInput, CouponRedeemModal, BottomNavigation, etc.) and screens.
- Continue i18n bulk-migrate (101 → fewer); next batch could be the `[jsx-text]` placeholders/headers (`AI Assistant`, `Confirm Selection`, `Apply Language`, `Selected Package`, etc.).
- Promote Iteration 0 + 1 `evolving / shipped-soaking` entries to `protected` once they've ridden through one production cycle without regression.
- G8 IAP verifier and G9 email channel — when external creds land.
- profile-security-screen — when backend `PUT /api/auth/password` + `DELETE /api/auth/me` land.

---

## Iteration 1 — Snapshot infrastructure detail

### Snapshot infrastructure (shipped)

The first slice of Iteration 1 lands the snapshot harness so Gate 3 has content to enforce.

- **Helper:** [frontend/__tests__/helpers/renderToSnapshot.ts](frontend/__tests__/helpers/renderToSnapshot.ts) wraps `@testing-library/react-native`'s `render().toJSON()`. (We use RTL because `react-test-renderer` 19 returns `null` for intrinsic elements under our jest preset.)
- **Convention:** snapshot tests live alongside other tests, suffixed `.snapshot.test.tsx`. Snapshot artifacts go to `__tests__/__snapshots__/<test-name>.tsx.snap`.
- **First baseline:** [frontend/__tests__/PricingDisplay.snapshot.test.tsx](frontend/__tests__/PricingDisplay.snapshot.test.tsx) covers PricingDisplay across 3 prop variations.
- **How to add another:** copy the PricingDisplay snapshot test, swap the imported component + props, run `npx jest <new-test>` once locally to seed the `.snap` file, then commit both the test and the `.snap`. Subsequent runs (under `--ci`) will fail if the rendered tree drifts.
- **Mocking pattern (additive):** any RN-bridge surface a component touches must be mocked in the snapshot test file using the `make(tag)` forwardRef pattern from PricingDisplay so RTL can render it. Don't widen the global jest setup — keep mocks local to each snapshot file so component scope is explicit.
- **Gate 3 enforcement:** the existing `scripts/check-registry-additive.js --mode=snapshots` check now has real artifacts to validate against. Any snapshot diff on a `protected` baseline rejects the PR unless the screen is listed in `feature-registry.json::snapshot_replacements_iteration_N`.

### Remaining Iteration 1 work — recommended order

1. **Expand snapshot coverage** — follow the documented pattern to add baselines for the remaining 9 components and 24 routes. Each addition is purely additive (new test + new `.snap`).
2. **G11** subscription tier 1-column layout — additive baseline replacement, scope tracked in registry.
3. **G12** home-screen Income/Expense font readability — same.
4. **i18n-bulk-migrate** — drive the audit script to 0 findings; append missing keys across all 18 locales (English fallback + `// TODO: translate` for non-en).
5. **chat-screen-hydration** — wire [chat.tsx](frontend/app/(app)/chat.tsx) to `ChatApiClient.getHistory` on mount + `saveMessage` on send.
6. **receipt-picker-rollout** — replace each existing camera-only / gallery-only entry point with `ReceiptSourcePicker`.
7. **G8** IAP verifier (when creds available).
8. **G9** Email notif (when creds available).
9. **profile-security-screen** (when BE endpoints land).

The Iteration 0 `evolving / shipped-soaking` entries promote to `protected` after one cycle if no regression appears.

---

## Application Context

| | |
|---|---|
| Application Name | **FinFlow** — voice/receipt/chat-driven personal finance tracker |
| Frontend Stack | Expo SDK 54 + React Native 0.81 + Expo Router 6 + TypeScript 5.9 (strict) + Zustand 5 + axios + i18n-js + react-native-purchases (RevenueCat) |
| Backend Stack | FastAPI 0.110 + Motor 3.3 (async MongoDB) + Pydantic v2 + python-jose/PyJWT + bcrypt |
| Database | MongoDB (Atlas in production, local Mongo in dev). **Note:** template's Postgres assumption does not apply — schema-on-read, no SQL migrations. |
| Auth Mechanism | **Server-side session tokens** (30-day expiry, stored in `user_sessions` Mongo collection) + Apple/Google OAuth + email/password. `Depends(require_auth)` reads bearer token, returns 401 on expiry. Frontend [api/client.ts](frontend/api/client.ts) interceptor catches 401 → `/login`. **No silent rotation yet** (see Issue #18). |
| Frontend Surface | 24 routes in [frontend/app/](frontend/app/), 10 components, 6 contexts (Auth/Subscription/Currency/Language/Network/AddModal), 7 services, 18 locales, 13 Jest tests |
| Backend Surface | 44 endpoints under `/api` in [backend/server.py](backend/server.py), 25 Pydantic models, health checks at `/health` and `/api/health` |
| Mobile Deployment | EAS → TestFlight (iOS) + Google Play (Android). Web build via Metro static export. See [frontend/DEPLOY_IOS.md](frontend/DEPLOY_IOS.md), [frontend/DEPLOY_ANDROID.md](frontend/DEPLOY_ANDROID.md). |
| Backend Deployment | Render / Railway / Fly.io (any FastAPI-compatible PaaS) + MongoDB Atlas. See [backend/DEPLOY_BACKEND.md](backend/DEPLOY_BACKEND.md). **Primary target: Render** (already-documented path). Railway is secondary-compatible. |

---

## Core Philosophy: Additive-Only Evolution

| Allowed ✅ | Forbidden ❌ |
|---|---|
| Add new screen/route/component | Delete or rename existing one |
| Add new `/api/*` endpoint | Remove, rename, or change method/path of existing endpoint |
| Add optional field to request/response schema | Remove or change semantics of existing field |
| Fix broken/incomplete feature (with regression test proof) | Refactor a working stable feature |
| Add new Mongo collection or document field | Drop a collection, rename a field that clients read |
| Improve visuals of new UI | Restyle a stable screen unless purely additive (e.g. add dark-mode CSS) |
| Add new locale string keys | Remove or rename existing string keys |

The constraint is enforced **programmatically** by Gates 2–4 below, not by reviewer convention.

### Project Invariants (Always Protected)

These are derived from [CLAUDE.md](CLAUDE.md) and the working architecture. Any iteration that violates one is **automatically rejected** at Gate 5 (registry-additive check) regardless of test outcomes.

1. **Backend routing**: every new route must be defined on `api_router = APIRouter(prefix="/api")` in [backend/server.py](backend/server.py), never on `app` directly. The `/api` prefix is part of the contract.
2. **Provider order** in [frontend/app/_layout.tsx](frontend/app/_layout.tsx): `Network → Language → Currency → Auth → Subscription`. New providers may be added but cannot reorder existing ones.
3. **Soft-delete invariant**: `transactions` use `is_deleted` + `updated_at` to enable delta sync. Any new transaction field must be reflected in [frontend/services/localDb.ts](frontend/services/localDb.ts) schema **and** in `saveTransactionsLocally`/`addPendingTransaction`.
4. **Subscription tier coupling**: `SUBSCRIPTION_TIERS` and `PRODUCT_TIER_MAP` in [backend/server.py](backend/server.py) must be updated together. Receipt validation depends on both.
5. **Sync-layer write path**: client transaction CRUD goes through `addPendingTransaction` (local-first, outbox-queued), never directly through `apiClient`.
6. **AI keys are server-only**: `LlmChat` from `emergentintegrations` is invoked exclusively in `backend/server.py`. The mobile client must never carry `EMERGENT_LLM_KEY` or `OPENAI_API_KEY`.
7. **Backend URL configuration**: [frontend/constants/Config.ts](frontend/constants/Config.ts) is the single source of truth for `BACKEND_URL`. The PRD's `EXPO_PUBLIC_API_URL` env-var pattern in Section 5 is an additive enhancement (Iteration ≥1), not a replacement — the existing constant must keep working until the env-var path is rolled out behind a fallback.
8. **Root-level `*_test.py` files are integration scripts** (require a running backend), not pytest unit suites. Gate 1 must invoke `pytest backend/` only — never `pytest` from repo root.

---

# Section 1 — Sync Gap Analysis (Iteration 0)

Driven by [frontend/ALL_ISSUES.md](frontend/ALL_ISSUES.md), live grep of FE↔BE call sites, and the recon report.

| # | Feature | Exists in FE | Exists in BE | Priority | Owner | Source |
|---|---|---|---|---|---|---|
| G1 | **Token auto-refresh** (no `/auth/refresh`; expired JWT requires logout/login) | ❌ | ❌ | **Critical** | Both | Issue #18, AuthContext TODOs |
| G2 | **Onboarding starting balance persists to BE** (currently local-only after onboarding-balance screen) | ⚠️ partial | ✅ (`POST /api/auth/onboarding-balance` exists) | **Critical** | FE | ALL_ISSUES audit |
| G3 | **Currency formatting consistency** ($ shown when IDR selected on some screens) | ⚠️ broken | ✅ user settings stored | **Critical** | FE | Issue #13 |
| G4 | **i18n string coverage** — many screens contain hardcoded English despite `id` selected | ⚠️ broken | n/a | **Critical** | FE | Issue #16 |
| G5 | **AI insights export** — `/api/export/transactions` returns; FE crashes with `Cannot read property 'UTF8' of undefined` | ⚠️ broken | ✅ | **High** | FE | Issue #14 |
| G6 | **Receipt scan source picker** — Camera-only on some entry points, should always offer Camera + Gallery | ⚠️ inconsistent | ✅ (`POST /api/transactions/receipt`) | **High** | FE | Issue #17 |
| G7 | **Chat history persistence** (resets between sessions like WhatsApp) | ⚠️ broken | ✅ (`GET/POST/DELETE /api/chat/history`) | **High** | FE | ALL_ISSUES audit |
| G8 | **Server-side receipt verification for IAP** (Apple/Google receipts trusted client-side) | n/a | ⚠️ stub (TODO in `server.py`) | **High** | BE | Code TODO |
| G9 | **Email notification channel** — only in-app notifications exist; audit calls for email too | ❌ | ❌ | Medium | Both | ALL_ISSUES audit |
| G10 | **Profile menu functional links** (some entries are placeholders) | ⚠️ partial | ✅ where applicable | Medium | FE | ALL_ISSUES audit |
| G11 | **Subscription tier layout** — should be 1-column vertical (currently horizontal) | ⚠️ wrong layout | ✅ | Medium | FE | ALL_ISSUES audit |
| G12 | **Home page Income/Expense font readability** | ⚠️ small | n/a | Low | FE | Issue #15 |
| G13 | **Coupon admin UI** (BE has `POST /api/coupon/generate`, `GET /api/coupon/list`; no admin screen) | ❌ | ✅ | Low (intentionally back-office) | FE (deferred) | Recon |
| G14 | **`/api/health` aliasing** — root `/health` and `/api/health` both exist; FE doesn't call either | n/a | ✅ | Low | FE | Recon |

> **Protected entries** (added to registry as `protected`, untouchable): all 44 BE endpoints currently in production, all 24 FE routes, all 18 locale files, all 25 Pydantic models, the local SQLite outbox schema (`transactions`, `sync_outbox`, `sync_metadata`).

---

# Section 2 — Evolution Plan (Per Gap)

### G1 — Silent session-token rotation (Critical, Both)

- **What to build:** Add `POST /api/auth/refresh-session` (additive endpoint) that accepts the current bearer session token if it is **within its grace window** (e.g. last 7 days of the 30-day life), and returns a freshly-issued session token. Existing `user_sessions` semantics preserved — old token expiration is not extended; instead a new row is created and the old one revoked atomically. Frontend [api/client.ts](frontend/api/client.ts) interceptor (already exists) is **extended** to attempt one silent rotation on 401 before falling back to its current `/login` redirect — additive code path, the redirect behavior remains intact for failure cases.
- **Files to create:**
  - `backend/server.py` — append `RefreshSessionResponse` model, `@api_router.post("/auth/refresh-session")` handler, helper `rotate_session(old_token) -> new_token`.
  - `frontend/services/SessionManager.ts` (new) — secure-store read/write of current session token, in-flight rotation deduplication.
  - `frontend/__tests__/SessionManager.test.ts` (new).
  - `frontend/__tests__/SessionRotation.integration.test.ts` (new).
- **Files to extend (additive only — no behavior change to existing branches):**
  - [frontend/api/client.ts](frontend/api/client.ts) — add a rotation attempt **before** the existing 401-→-/login branch. The existing branch must remain reachable when rotation fails.
- **Files to reference (read-only):** [frontend/contexts/AuthContext.tsx](frontend/contexts/AuthContext.tsx), [backend/server.py](backend/server.py) `Depends(require_auth)` and `user_sessions` collection logic.
- **Acceptance criteria:**
  - Existing `/api/auth/login` response shape unchanged.
  - Token within grace window → silent rotation; user stays logged in.
  - Token already past 30-day expiry → 401 → existing `/login` redirect path fires unchanged.
  - Existing AuthContext.test.ts and AuthFlow.integration.test.ts pass byte-identical.
- **Complexity:** L
- **New tests required:** unit (SessionManager) + integration (rotation flow + fallback to existing redirect) + contract (new endpoint OpenAPI schema)

### G2 — Onboarding balance persists to backend (Critical, FE)

- **What to build:** [frontend/app/onboarding-balance.tsx](frontend/app/onboarding-balance.tsx) `Continue` handler must call `POST /api/auth/onboarding-balance` before navigating. Show inline error if call fails; do not advance.
- **Files to create:** `frontend/__tests__/OnboardingBalance.test.tsx` (new).
- **Files to reference (read-only):** existing onboarding-balance screen, [frontend/services/SubscriptionApiClient.ts](frontend/services/SubscriptionApiClient.ts) (pattern for API client), [backend/server.py](backend/server.py) (`POST /api/auth/onboarding-balance`).
- **Acceptance criteria:** mock backend returns 200 → user reaches next screen; returns 500 → user stays + error visible; balance is persisted (verified via `GET /api/auth/me`).
- **Complexity:** S
- **New tests required:** unit + snapshot

### G3 — Currency formatting consistency (Critical, FE)

- **What to build:** Mirror the backend's existing `format_currency(amount, currency)` (USD/EUR/GBP/JPY/SGD/IDR — see [backend/server.py](backend/server.py)) on the frontend. **Extend** the existing [frontend/utils/currency.ts](frontend/utils/currency.ts) — do not create a parallel helper. Replace ad-hoc `$` literals on the screens that violate. **Editing the broken screens is permitted bug-fix scope per Rule A** with regression-test proof that previously-correct cases render identically.
- **Files to extend:** [frontend/utils/currency.ts](frontend/utils/currency.ts) — add any missing currencies in the FE↔BE matrix as additive exports; keep all existing exports untouched.
- **Files to create:** `frontend/__tests__/currencyFormat.test.ts` (new) — table-driven parity test against the backend's documented behavior.
- **Files to edit (bug-fix scope, snapshot-locked):** only the screens flagged in Issue #13. Each edit must produce no snapshot diff for users whose locale was previously rendering correctly.
- **Acceptance criteria:** helper output matches `backend/server.py::format_currency` byte-for-byte across the full matrix (USD/EUR/GBP/JPY/SGD/IDR). All flagged screens render `Rp` prefix when locale=IDR.
- **Complexity:** M
- **New tests required:** unit (parity matrix, ≥12 cases) + snapshot (per-screen for both currencies)

### G4 — i18n string coverage (Critical, FE)

- **What to build:** Audit script that greps for hardcoded user-visible strings in [frontend/app/](frontend/app/) and [frontend/components/](frontend/components/), reports keys missing from [frontend/locales/en.ts](frontend/locales/en.ts). Migrate the offenders to `t(...)` calls.
- **Files to create:** `frontend/scripts/audit-i18n.ts` (new), missing key entries appended to all 18 locale files (English fallback for non-translated languages, with `// TODO: translate` sentinel comment).
- **Files to reference:** [frontend/utils/i18n.ts](frontend/utils/i18n.ts), all 18 locale files.
- **Acceptance criteria:** `npm run audit:i18n` exits 0 → no hardcoded user-visible strings remaining. Existing translation keys are not modified — only new ones appended.
- **Complexity:** L
- **New tests required:** unit (audit script self-test) + snapshot (every screen in `id` locale)

### G5 — AI insights export crash (High, FE)

- **What to build:** Root cause is `CryptoJS.enc.Utf8` referenced before `crypto-js` is bundled, or `Buffer` polyfill missing in Hermes. Fix by switching export download to `expo-file-system` + `expo-sharing` with native string→bytes encoding.
- **Files to create:** `frontend/utils/exportFile.ts` (new) wrapping FS write + share. `frontend/__tests__/exportFile.test.ts`.
- **Files to edit:** the insights export call site (single function in [frontend/app/(app)/insights.tsx](frontend/app/(app)/insights.tsx) or wherever export currently triggers — bug fix scope).
- **Acceptance criteria:** CSV export downloads and opens; JSON export downloads and parses. No reliance on `crypto-js` or `Buffer`. Existing insights snapshot unchanged.
- **Complexity:** S
- **New tests required:** unit + e2e smoke

### G6 — Receipt scan source picker uniformity (High, FE)

- **What to build:** Single `<ReceiptSourcePicker />` component (Camera | Gallery action sheet). Replace direct camera launches at all entry points with the picker. Additive component; the bug fix is rerouting through it.
- **Files to create:** `frontend/components/ReceiptSourcePicker.tsx`, `frontend/__tests__/ReceiptSourcePicker.test.tsx`.
- **Acceptance criteria:** every entry point (FAB, manual screen, chat attach, profile menu) opens the same picker. Snapshot of each unchanged otherwise.
- **Complexity:** S
- **New tests required:** snapshot (component) + integration (each entry path)

### G7 — Chat history persistence (High, FE)

- **What to build:** [frontend/app/(app)/chat.tsx](frontend/app/(app)/chat.tsx) loads history via `GET /api/chat/history` on mount and writes new messages via `POST /api/chat/message`. Currently the screen rehydrates from in-memory state only.
- **Files to create:** `frontend/services/ChatApiClient.ts`, `frontend/__tests__/ChatApiClient.test.ts`.
- **Acceptance criteria:** kill app → reopen → chat shows previous messages. `DELETE /api/chat/history` wired to existing "Clear" affordance (no new UI).
- **Complexity:** M
- **New tests required:** unit + integration (mocked backend round-trip)

### G8 — Server-side IAP receipt verification (High, BE)

- **What to build:** Replace the TODO stub in [backend/server.py](backend/server.py) (subscription validate path) with calls to Apple `/verifyReceipt` and Google Play Developer API. Existing endpoint contract (`POST /api/subscription/validate`) is preserved — only internal logic changes.
- **Files to create:** `backend/services/iap_verifier.py`, `backend/test_iap_verifier.py`.
- **Acceptance criteria:** invalid receipt → 400 with stable error code. Valid receipt → existing 200 response shape unchanged. Apple sandbox path covered. Existing `test_sync_logic.py` still green.
- **Complexity:** L
- **New tests required:** unit (mocked Apple/Google responses) + contract (response schema unchanged)

### G9 — Email notifications (Medium, Both)

- **What to build:** New `POST /api/notifications/email-prefs` (opt-in) + worker that sends weekly digest via SES/SendGrid. New FE toggle in Profile → Notifications. Fully additive.
- **Files to create:** `backend/services/email_sender.py`, `backend/jobs/weekly_digest.py`, `frontend/app/(app)/notification-prefs.tsx`, tests for each.
- **Complexity:** L
- **New tests required:** unit (sender, mocked) + integration (FE toggle round-trip) + contract

### G10 — Profile menu functional links (Medium, FE)

- **What to build:** Replace each placeholder Profile entry with a real route. Each placeholder becomes a new `frontend/app/(app)/profile-*.tsx` screen. **No protected screen is renamed.**
- **Complexity:** M
- **New tests required:** snapshot per new screen

### G11 — Subscription tier 1-column layout (Medium, FE)

- **What to build:** Layout-only change to [frontend/app/(app)/subscription.tsx](frontend/app/(app)/subscription.tsx) flexbox. Snapshot is expected to differ → **this is a permitted UI bug fix** since the audit identifies the current layout as a defect; the new snapshot becomes the locked baseline.
- **Complexity:** S
- **New tests required:** snapshot replaced + visual diff documented in iteration notes

### G12 — Home Income/Expense font readability (Low, FE)

- **What to build:** Bump `fontSize` of the two summary numbers on [frontend/app/(app)/index.tsx](frontend/app/(app)/index.tsx); same as G11 — bug-fix scope, new snapshot baseline.
- **Complexity:** XS
- **New tests required:** snapshot replaced

### G13 — Coupon admin UI (deferred)

- **Status:** moved to `planned` — back-office tool intentionally web-only / out of mobile scope. Keep BE endpoints `protected`, do not build FE this iteration.

### G14 — Health-check FE call (Low, FE)

- **What to build:** Optional — `NetworkContext` ping `GET /api/health` on cold-boot for "backend reachable" indicator. Pure addition.
- **Complexity:** XS
- **New tests required:** unit

---

# Section 3 — Testing Plan

Mandatory checklist for **Iteration 0**:

- [ ] Backend unit tests (pytest) — new tests for G1, G8, G9; existing [backend/test_sync_logic.py](backend/test_sync_logic.py) and root `*_test.py` files stay green.
- [ ] Frontend unit tests (Jest) — new tests under [frontend/__tests__/](frontend/__tests__/) for G1–G7, G9, G10, G14. Existing 13 tests stay green.
- [ ] **Snapshot tests** — capture baseline for every screen in [frontend/app/](frontend/app/) (24 files). After iteration: only G11 and G12 snapshots differ; all others byte-identical.
- [ ] **Contract tests** — extract OpenAPI from FastAPI `/openapi.json` pre- and post-iteration; diff must be **purely additive** (only new paths or new optional fields). Tool: `openapi-diff` in CI.
- [ ] **E2E smoke** — Detox or Maestro flow: signup → onboarding (with balance persistence G2) → add manual transaction → view insights → export CSV (G5) → logout (with token refresh path G1 exercised by token expiry simulation).
- [ ] **Rollback test** — perform `git checkout pre-iteration-0` on a throwaway worktree, run `pytest` + `npm test`, confirm all green within 2 minutes.
- [ ] **i18n coverage gate** — `npm run audit:i18n` exits 0.
- [ ] **Lint/type gate** — `tsc --noEmit` + `eslint .` zero errors; `ruff` / `mypy` on backend zero errors.

---

# Section 4 — Iteration 0 Milestone

**Iteration 0 complete when** all of the following are true:

- [ ] `feature-registry.json` exists at repo root with the seed contents shown in Appendix A (44 BE endpoints + 24 FE routes + 18 locales + 25 Pydantic models classified `protected`; G1–G12, G14 classified `evolving`; G13 + future items `planned`).
- [ ] All 14 gaps G1–G14 either implemented (G1–G12, G14) or formally deferred to `planned` with rationale (G13).
- [ ] All 4 gates pass on a clean run: tests green, snapshot diff empty (except G11/G12 documented replacements), OpenAPI diff additive-only, rollback drill under 2 min.
- [ ] CI workflow `.github/workflows/iteration-gates.yml` enforces gates on every PR (additive-only diff bot blocks merges that delete protected paths).

**Synchronized state at end of Iteration 0:**

A user installs FinFlow → completes onboarding (language → currency → balance persisted to BE) → uses voice/chat/receipt entry → views insights → exports CSV → token auto-refreshes silently after 30 min → reopens app, chat history restored → all UI text appears in selected locale.

**Feature registry transitions:**
- `planned` → `evolving`: G1 token-refresh, G7 chat-persistence, G9 email-channel, G10 profile-routes, G14 health-ping.
- `evolving` → `protected`: G2, G3, G4, G5, G6, G8, G11, G12 once their gates pass twice on consecutive iterations.

**Next iteration target (Iteration 1 focus):**
- Promote Iteration 0's `evolving` entries to `protected` after a soak window.
- Pull next gap-analysis pass: web admin app for G13 coupon, multi-device sync conflict resolution, biometric login.

---

# Section 5 — Docker & Deployment Spec

> **Important deviation from template:** the mobile frontend (Expo/React Native) does **not** run inside Docker — it ships as native binaries via EAS Build. Docker Compose covers the **backend + database + optional web export** only. Railway/Render are equivalent targets; Render is the documented primary.

### `docker-compose.yml` (new, repo root)

```yaml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      - MONGO_URL=mongodb://db:27017
      - DB_NAME=${DB_NAME}
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - EMERGENT_LLM_KEY=${EMERGENT_LLM_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - APPLE_SHARED_SECRET=${APPLE_SHARED_SECRET}
      - GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=${GOOGLE_PLAY_SERVICE_ACCOUNT_JSON}
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 10s
      timeout: 3s
      retries: 5

  db:
    image: mongo:7
    ports: ["27017:27017"]
    environment:
      - MONGO_INITDB_DATABASE=${DB_NAME}
    volumes:
      - mongodata:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
      interval: 10s
      timeout: 3s
      retries: 5

  # Optional: web export of the Expo app for browser preview (not the mobile binary)
  web:
    build:
      context: ./frontend
      dockerfile: Dockerfile.web
    ports: ["3000:3000"]
    environment:
      - EXPO_PUBLIC_API_URL=http://localhost:8000
    depends_on:
      - backend

volumes:
  mongodata:
```

### `backend/Dockerfile` (new)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
```

### `frontend/Dockerfile.web` (new, optional)

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx expo export --platform web

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
```

### `.env.example` (new, repo root)

```
DB_NAME=finflow
JWT_SECRET=change_me_in_production
JWT_REFRESH_SECRET=change_me_in_production_too
EMERGENT_LLM_KEY=
OPENAI_API_KEY=
APPLE_SHARED_SECRET=
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=
EXPO_PUBLIC_API_URL=http://localhost:8000
```

### Render (primary backend) deployment checklist

- [x] `Dockerfile` present in `backend/`.
- [ ] All secrets configured as Render env vars; nothing hardcoded.
- [x] Health check: `GET /api/health` returns 200 (already implemented at [backend/server.py:47](backend/server.py)).
- [ ] Mongo connection lazy-initialized (FastAPI startup event), not at import time.
- [ ] CORS allowlist includes `https://*.expo.dev`, mobile bundle IDs not relevant (native HTTP).
- [ ] `render.yaml` blueprint added.
- [ ] No DB migrations required (MongoDB schema-on-read); document collection-version stamping policy in BACKEND_REQUIREMENTS.md instead.

### Railway (secondary, equivalent path)

- [ ] `railway.toml` mirrors `render.yaml`.
- [ ] Same env vars, same health check, same Dockerfile.
- [ ] MongoDB plugin or external Atlas URL.

### Mobile (EAS) deployment checklist — out-of-Docker

- [x] [frontend/eas.json](frontend/eas.json) configured for `development | preview | production` profiles.
- [ ] `EXPO_PUBLIC_API_URL` baked per channel.
- [ ] iOS: signing identity + provisioning profile via EAS; submit via TestFlight.
- [ ] Android: `google-services.json` + Play service account (already configured per recent commit `02bf1285`).

---

# Section 6 — Self-Healing Rules (Append-Only Across Iterations)

### Rule A — Feature breaks after a sync iteration

1. Run full test suite to reproduce.
2. Classify the failing surface against `feature-registry.json`:
   - **Protected** → roll back the entire iteration via `git reset --hard pre-iteration-N`. Open an incident note. Do **not** patch protected code in-place.
   - **Evolving / new** → fix the specific feature, re-run all 4 gates, only then commit.
3. **Never** "fix" by deleting the feature.

### Rule B — A new feature is added externally to one side

1. The developer adds a `planned` entry to `feature-registry.json` describing the new surface (FE-only, BE-only, or both).
2. The next iteration's gap analysis automatically discovers the unmatched side.
3. The new feature flows through full gates before being promoted to `protected`.

### Rule C — Snapshot drift on a stable component

If a snapshot diff appears on a `protected` component without a corresponding `bug-fix` entry in the iteration plan, **the iteration is rejected**. Permitted snapshot updates (G11, G12 this cycle) must list the screen in the iteration's "Replaced Snapshots" section before Gate 3 will accept them.

### Rule D — OpenAPI breaking change detected

`openapi-diff` on the pre/post `/openapi.json` is part of Gate 4. Any of the following = breaking and triggers immediate rollback:
- Removed path
- Removed/renamed required field
- Type narrowing of an existing field
- Auth requirement added to an existing endpoint (auth removal is also forbidden)

### Rule E — Rollback drill

Every iteration must demonstrate (in CI or locally) that:
```bash
git tag pre-iteration-N    # before
# ... iteration work ...
git reset --hard pre-iteration-N   # rollback
pytest && cd frontend && npm test  # green within 2 min
```

---

## Self-Healing Flow (visual reference)

```
TRIGGER → [GATE 1: existing tests green?]
            ├── NO  → STOP, fix first
            └── YES → [SNAPSHOT baseline] → [GAP ANALYSIS vs registry]
                       → [PLAN additive task list]
                       → [GENERATE code, never touch protected]
                       → [GATE 2: full suite green?]
                            ├── NO  → rollback to snapshot
                            └── YES → [GATE 3: snapshot diff clean?]
                                       ├── NO  → rollback
                                       └── YES → [GATE 4: OpenAPI additive-only?]
                                                  ├── NO  → rollback
                                                  └── YES → COMMIT + tag iteration-N-complete
                                                            → update feature-registry.json
                                                            → evaluate completion criteria
```

---

# Completion Criteria (system end-state)

- [ ] `feature-registry.json` has zero `planned` entries (G13 either built or formally descoped).
- [ ] All `evolving` entries have soaked through ≥1 iteration without regression and are `protected`.
- [ ] 100% pass: pytest + Jest + snapshot + OpenAPI contract + Detox/Maestro e2e.
- [ ] `docker compose up` brings backend + db (+ optional web) up clean; mobile builds via `eas build` succeed for both iOS and Android profiles.
- [ ] Render deploy is live with all checklist items checked; Railway dry-run succeeds.
- [ ] Zero TypeScript errors (`tsc --noEmit`), zero eslint errors, zero `ruff`/`mypy` errors.
- [ ] No broken imports, no unimplemented stubs (`grep -r "TODO" --include="*.py" --include="*.ts" --include="*.tsx"` returns no items tagged `TODO(blocking)`).

> **Next Evolution Trigger:** new feature request enters the backlog **OR** a `protected` feature alarms in production (Render logs / Sentry / RevenueCat dashboard).

---

# Appendix A — Initial `feature-registry.json` seed

> Place at repo root. Iteration 0 commits this file alongside the gates CI workflow.

```json
{
  "version": "0.0.0-iteration-0",
  "protected": [
    { "id": "be.health.api",        "layer": "backend",  "type": "endpoint", "ref": "GET /api/health",                       "status": "stable", "added_in": "v1.0" },
    { "id": "be.auth.session",      "layer": "backend",  "type": "endpoint", "ref": "POST /api/auth/session",                "status": "stable", "added_in": "v1.0" },
    { "id": "be.auth.apple",        "layer": "backend",  "type": "endpoint", "ref": "POST /api/auth/apple",                  "status": "stable", "added_in": "v1.0" },
    { "id": "be.auth.register",     "layer": "backend",  "type": "endpoint", "ref": "POST /api/auth/register",               "status": "stable", "added_in": "v1.0" },
    { "id": "be.auth.login",        "layer": "backend",  "type": "endpoint", "ref": "POST /api/auth/login",                  "status": "stable", "added_in": "v1.0" },
    { "id": "be.auth.logout",       "layer": "backend",  "type": "endpoint", "ref": "POST /api/auth/logout",                 "status": "stable", "added_in": "v1.0" },
    { "id": "be.auth.me",           "layer": "backend",  "type": "endpoint", "ref": "GET /api/auth/me",                      "status": "stable", "added_in": "v1.0" },
    { "id": "be.auth.onboarding",   "layer": "backend",  "type": "endpoint", "ref": "PUT /api/auth/onboarding",              "status": "stable", "added_in": "v1.0" },
    { "id": "be.auth.onb-balance",  "layer": "backend",  "type": "endpoint", "ref": "POST /api/auth/onboarding-balance",     "status": "stable", "added_in": "v1.0" },
    { "id": "be.auth.start-trial",  "layer": "backend",  "type": "endpoint", "ref": "POST /api/auth/start-trial",            "status": "stable", "added_in": "v1.0" },
    { "id": "be.sub.get",           "layer": "backend",  "type": "endpoint", "ref": "GET /api/subscription",                 "status": "stable", "added_in": "v1.0" },
    { "id": "be.sub.status",        "layer": "backend",  "type": "endpoint", "ref": "GET /api/subscription/status",          "status": "stable", "added_in": "v1.0" },
    { "id": "be.sub.tiers",         "layer": "backend",  "type": "endpoint", "ref": "GET /api/subscription/tiers",           "status": "stable", "added_in": "v1.0" },
    { "id": "be.sub.validate",      "layer": "backend",  "type": "endpoint", "ref": "POST /api/subscription/validate",       "status": "stable", "added_in": "v1.0" },
    { "id": "be.sub.trial",         "layer": "backend",  "type": "endpoint", "ref": "POST /api/subscription/trial",          "status": "stable", "added_in": "v1.0" },
    { "id": "be.sub.verify-apple",  "layer": "backend",  "type": "endpoint", "ref": "POST /api/subscription/verify-apple",   "status": "stable", "added_in": "v1.0" },
    { "id": "be.coupon.redeem",     "layer": "backend",  "type": "endpoint", "ref": "POST /api/coupon/redeem",               "status": "stable", "added_in": "v1.0" },
    { "id": "be.coupon.generate",   "layer": "backend",  "type": "endpoint", "ref": "POST /api/coupon/generate",             "status": "stable", "added_in": "v1.0" },
    { "id": "be.coupon.list",       "layer": "backend",  "type": "endpoint", "ref": "GET /api/coupon/list",                  "status": "stable", "added_in": "v1.0" },
    { "id": "be.tx.chat",           "layer": "backend",  "type": "endpoint", "ref": "POST /api/transactions/chat",           "status": "stable", "added_in": "v1.0" },
    { "id": "be.tx.receipt",        "layer": "backend",  "type": "endpoint", "ref": "POST /api/transactions/receipt",        "status": "stable", "added_in": "v1.0" },
    { "id": "be.tx.voice",          "layer": "backend",  "type": "endpoint", "ref": "POST /api/transactions/voice",          "status": "stable", "added_in": "v1.0" },
    { "id": "be.tx.voice-text",     "layer": "backend",  "type": "endpoint", "ref": "POST /api/transactions/voice-text",     "status": "stable", "added_in": "v1.0" },
    { "id": "be.tx.manual",         "layer": "backend",  "type": "endpoint", "ref": "POST /api/transactions/manual",         "status": "stable", "added_in": "v1.0" },
    { "id": "be.tx.update",         "layer": "backend",  "type": "endpoint", "ref": "PUT /api/transactions/{id}",            "status": "stable", "added_in": "v1.0" },
    { "id": "be.tx.list",           "layer": "backend",  "type": "endpoint", "ref": "GET /api/transactions",                 "status": "stable", "added_in": "v1.0" },
    { "id": "be.tx.get",            "layer": "backend",  "type": "endpoint", "ref": "GET /api/transactions/{id}",            "status": "stable", "added_in": "v1.0" },
    { "id": "be.tx.delete",         "layer": "backend",  "type": "endpoint", "ref": "DELETE /api/transactions/{id}",         "status": "stable", "added_in": "v1.0" },
    { "id": "be.chat.history.get",  "layer": "backend",  "type": "endpoint", "ref": "GET /api/chat/history",                 "status": "stable", "added_in": "v1.0" },
    { "id": "be.chat.message",      "layer": "backend",  "type": "endpoint", "ref": "POST /api/chat/message",                "status": "stable", "added_in": "v1.0" },
    { "id": "be.chat.history.del",  "layer": "backend",  "type": "endpoint", "ref": "DELETE /api/chat/history",              "status": "stable", "added_in": "v1.0" },
    { "id": "be.notif.list",        "layer": "backend",  "type": "endpoint", "ref": "GET /api/notifications",                "status": "stable", "added_in": "v1.0" },
    { "id": "be.notif.read",        "layer": "backend",  "type": "endpoint", "ref": "POST /api/notifications/{id}/read",     "status": "stable", "added_in": "v1.0" },
    { "id": "be.notif.read-all",    "layer": "backend",  "type": "endpoint", "ref": "POST /api/notifications/read-all",      "status": "stable", "added_in": "v1.0" },
    { "id": "be.insights",          "layer": "backend",  "type": "endpoint", "ref": "GET /api/insights",                     "status": "stable", "added_in": "v1.0" },
    { "id": "be.insights.ai",       "layer": "backend",  "type": "endpoint", "ref": "GET /api/insights/ai",                  "status": "stable", "added_in": "v1.0" },
    { "id": "be.export.tx",         "layer": "backend",  "type": "endpoint", "ref": "GET /api/export/transactions",          "status": "stable", "added_in": "v1.0" },
    { "id": "be.sync.migrate",      "layer": "backend",  "type": "endpoint", "ref": "POST /api/sync/migrate",                "status": "stable", "added_in": "v1.0" },
    { "id": "be.sync.prune",        "layer": "backend",  "type": "endpoint", "ref": "POST /api/sync/prune",                  "status": "stable", "added_in": "v1.0" },
    { "id": "be.sync.restore",      "layer": "backend",  "type": "endpoint", "ref": "POST /api/sync/restore/{id}",           "status": "stable", "added_in": "v1.0" },
    { "id": "be.sync.deleted",      "layer": "backend",  "type": "endpoint", "ref": "GET /api/sync/deleted",                 "status": "stable", "added_in": "v1.0" },
    { "id": "be.user.settings.put", "layer": "backend",  "type": "endpoint", "ref": "PUT /api/user/settings",                "status": "stable", "added_in": "v1.0" },
    { "id": "be.user.settings.get", "layer": "backend",  "type": "endpoint", "ref": "GET /api/user/settings",                "status": "stable", "added_in": "v1.0" },
    { "id": "be.categories",        "layer": "backend",  "type": "endpoint", "ref": "GET /api/categories",                   "status": "stable", "added_in": "v1.0" },

    { "id": "fe.route.index",            "layer": "frontend", "type": "page", "ref": "frontend/app/index.tsx",                       "status": "stable", "added_in": "v1.0" },
    { "id": "fe.route.login",            "layer": "frontend", "type": "page", "ref": "frontend/app/login.tsx",                       "status": "stable", "added_in": "v1.0" },
    { "id": "fe.route.signup",           "layer": "frontend", "type": "page", "ref": "frontend/app/signup.tsx",                      "status": "stable", "added_in": "v1.0" },
    { "id": "fe.route.onb-language",     "layer": "frontend", "type": "page", "ref": "frontend/app/onboarding-language.tsx",         "status": "stable", "added_in": "v1.0" },
    { "id": "fe.route.onb-currency",     "layer": "frontend", "type": "page", "ref": "frontend/app/onboarding-currency.tsx",         "status": "stable", "added_in": "v1.0" },
    { "id": "fe.route.onb-balance",      "layer": "frontend", "type": "page", "ref": "frontend/app/onboarding-balance.tsx",          "status": "stable", "added_in": "v1.0" },
    { "id": "fe.route.onb-trial",        "layer": "frontend", "type": "page", "ref": "frontend/app/onboarding-trial.tsx",            "status": "stable", "added_in": "v1.0" },
    { "id": "fe.route.app.index",        "layer": "frontend", "type": "page", "ref": "frontend/app/(app)/index.tsx",                 "status": "stable", "added_in": "v1.0" },
    { "id": "fe.route.app.add",          "layer": "frontend", "type": "page", "ref": "frontend/app/(app)/add.tsx",                   "status": "stable", "added_in": "v1.0" },
    { "id": "fe.route.app.chat",         "layer": "frontend", "type": "page", "ref": "frontend/app/(app)/chat.tsx",                  "status": "stable", "added_in": "v1.0" },
    { "id": "fe.route.app.edit-tx",      "layer": "frontend", "type": "page", "ref": "frontend/app/(app)/edit-transaction.tsx",      "status": "stable", "added_in": "v1.0" },
    { "id": "fe.route.app.manual",       "layer": "frontend", "type": "page", "ref": "frontend/app/(app)/manual.tsx",                "status": "stable", "added_in": "v1.0" },
    { "id": "fe.route.app.history",      "layer": "frontend", "type": "page", "ref": "frontend/app/(app)/history.tsx",               "status": "stable", "added_in": "v1.0" },
    { "id": "fe.route.app.insights",     "layer": "frontend", "type": "page", "ref": "frontend/app/(app)/insights.tsx",              "status": "stable", "added_in": "v1.0" },
    { "id": "fe.route.app.currency",     "layer": "frontend", "type": "page", "ref": "frontend/app/(app)/currency.tsx",              "status": "stable", "added_in": "v1.0" },
    { "id": "fe.route.app.language",     "layer": "frontend", "type": "page", "ref": "frontend/app/(app)/language.tsx",              "status": "stable", "added_in": "v1.0" },
    { "id": "fe.route.app.profile",      "layer": "frontend", "type": "page", "ref": "frontend/app/(app)/profile.tsx",               "status": "stable", "added_in": "v1.0" },
    { "id": "fe.route.app.subscription", "layer": "frontend", "type": "page", "ref": "frontend/app/(app)/subscription.tsx",          "status": "stable", "added_in": "v1.0" },
    { "id": "fe.route.app.payment",      "layer": "frontend", "type": "page", "ref": "frontend/app/(app)/payment-processing.tsx",   "status": "stable", "added_in": "v1.0" },
    { "id": "fe.route.app.notifications","layer": "frontend", "type": "page", "ref": "frontend/app/(app)/notifications.tsx",         "status": "stable", "added_in": "v1.0" },

    { "id": "fe.svc.subapi",         "layer": "frontend", "type": "service", "ref": "frontend/services/SubscriptionApiClient.ts", "status": "stable", "added_in": "v1.0" },
    { "id": "fe.svc.oauth",          "layer": "frontend", "type": "service", "ref": "frontend/services/OAuthService.ts",          "status": "stable", "added_in": "v1.0" },
    { "id": "fe.svc.payment",        "layer": "frontend", "type": "service", "ref": "frontend/services/PaymentService.ts",        "status": "stable", "added_in": "v1.0" },
    { "id": "fe.svc.localdb",        "layer": "frontend", "type": "service", "ref": "frontend/services/localDb.ts",               "status": "stable", "added_in": "v1.0" },
    { "id": "fe.svc.sync",           "layer": "frontend", "type": "service", "ref": "frontend/services/syncService.ts",           "status": "stable", "added_in": "v1.0" },
    { "id": "fe.svc.profile-extr",   "layer": "frontend", "type": "service", "ref": "frontend/services/ProfileExtractor.ts",      "status": "stable", "added_in": "v1.0" },
    { "id": "fe.svc.profile-store",  "layer": "frontend", "type": "service", "ref": "frontend/services/ProfileStorageManager.ts", "status": "stable", "added_in": "v1.0" },

    { "id": "fe.locales.en", "layer": "frontend", "type": "component", "ref": "frontend/locales/en.ts", "status": "stable", "added_in": "v1.0" }
  ],
  "evolving": [
    { "id": "g1.token-refresh",     "layer": "both",     "type": "endpoint",  "ref": "POST /api/auth/refresh + axios interceptor", "status": "in-progress", "added_in": "iteration-0" },
    { "id": "g2.onb-balance-call",  "layer": "frontend", "type": "page",      "ref": "frontend/app/onboarding-balance.tsx",        "status": "in-progress", "added_in": "iteration-0" },
    { "id": "g3.currency-helper",   "layer": "frontend", "type": "component", "ref": "frontend/utils/formatCurrency.ts",           "status": "in-progress", "added_in": "iteration-0" },
    { "id": "g4.i18n-coverage",     "layer": "frontend", "type": "service",   "ref": "frontend/scripts/audit-i18n.ts",             "status": "in-progress", "added_in": "iteration-0" },
    { "id": "g5.export-fix",        "layer": "frontend", "type": "service",   "ref": "frontend/utils/exportFile.ts",               "status": "in-progress", "added_in": "iteration-0" },
    { "id": "g6.receipt-picker",    "layer": "frontend", "type": "component", "ref": "frontend/components/ReceiptSourcePicker.tsx","status": "in-progress", "added_in": "iteration-0" },
    { "id": "g7.chat-persist",      "layer": "frontend", "type": "service",   "ref": "frontend/services/ChatApiClient.ts",         "status": "in-progress", "added_in": "iteration-0" },
    { "id": "g8.iap-verify",        "layer": "backend",  "type": "service",   "ref": "backend/services/iap_verifier.py",           "status": "in-progress", "added_in": "iteration-0" },
    { "id": "g9.email-notif",       "layer": "both",     "type": "service",   "ref": "backend/services/email_sender.py + frontend/app/(app)/notification-prefs.tsx", "status": "in-progress", "added_in": "iteration-0" },
    { "id": "g10.profile-routes",   "layer": "frontend", "type": "page",      "ref": "frontend/app/(app)/profile-*.tsx",           "status": "in-progress", "added_in": "iteration-0" },
    { "id": "g11.sub-layout",       "layer": "frontend", "type": "page",      "ref": "frontend/app/(app)/subscription.tsx",        "status": "bug-fix",     "added_in": "iteration-0" },
    { "id": "g12.home-fontsize",    "layer": "frontend", "type": "page",      "ref": "frontend/app/(app)/index.tsx",               "status": "bug-fix",     "added_in": "iteration-0" },
    { "id": "g14.health-ping",      "layer": "frontend", "type": "service",   "ref": "frontend/contexts/NetworkContext.tsx",       "status": "in-progress", "added_in": "iteration-0" }
  ],
  "planned": [
    { "id": "g13.coupon-admin-ui",  "layer": "frontend", "type": "page",      "ref": "(deferred — back-office, web-only)",         "status": "deferred",    "added_in": "iteration-1?" }
  ]
}
```

> **Note:** the 25 Pydantic models, all 18 locale files (en.ts shown as exemplar), and the 10 components are also `protected` — registry above abridges them; full enumeration is generated by `scripts/build-registry.ts` (Iteration 0 deliverable).

---

# Appendix B — CI Gates Workflow Sketch

`.github/workflows/iteration-gates.yml` (new):

```yaml
name: iteration-gates
on: [pull_request]
jobs:
  gate-1-existing-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { ref: ${{ github.base_ref }} }
      - run: pip install -r backend/requirements.txt && pytest backend/
      - run: cd frontend && npm ci && npm test
  gate-2-new-tests:
    needs: gate-1-existing-tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r backend/requirements.txt && pytest
      - run: cd frontend && npm ci && npm test
  gate-3-snapshot-diff:
    needs: gate-2-new-tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd frontend && npm ci && npm test -- -u=false   # fail on any unexpected snapshot drift
  gate-4-openapi-additive:
    needs: gate-2-new-tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r backend/requirements.txt
      - run: |
          python -c "from server import app; import json; print(json.dumps(app.openapi()))" > new.json
          git show ${{ github.base_ref }}:openapi.snapshot.json > old.json
          npx @apidevtools/swagger-cli validate new.json
          npx openapi-diff old.json new.json --fail-on-incompatible
  gate-5-registry-additive:
    needs: gate-2-new-tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: node scripts/check-registry-additive.js   # ensures no `protected` entry was removed/renamed in this PR
```

---

*End of Iteration 0 PRD. Tag at completion: `iteration-0-complete`.*
