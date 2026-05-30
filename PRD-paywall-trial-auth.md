# PRD — Paywall, Kode Trial Gratis 3 Hari, & Login Google/Apple (Hapus Emergent)

**Produk:** FinFlow (Expo/React Native + FastAPI + MongoDB)
**Status:** Draft v1
**Pemilik:** Azka Nurun Ala
**Tanggal:** 2026-05-30

---

## 1. Ringkasan

Dokumen ini mendefinisikan tiga inisiatif yang saling terkait:

1. **Auth baru:** ganti login berbasis **Emergent** dengan **Sign in with Google** dan **Sign in with Apple** asli (native), pertahankan email/password.
2. **Paywall + pembayaran nyata:** kunci fitur premium di balik langganan, dengan pembelian via **In-App Purchase** (App Store / Google Play).
3. **Kode trial gratis 3 hari:** sistem **kode redeem** yang memberi akses penuh 3 hari (untuk marketing/influencer/beta), terpisah dari trial otomatis.

Ketiganya bermuara pada satu sumber kebenaran **entitlement** di backend (`subscription_tier` + `subscription_expires_at`).

---

## 2. Kondisi Saat Ini (baseline kode)

### 2.1 Autentikasi
- **Email/password:** `POST /api/auth/register`, `POST /api/auth/login` di [backend/server.py](backend/server.py) (hash `sha256(salt+password)`, `session_token` acak disimpan di koleksi `user_sessions`, masa berlaku 7 hari, juga di-set sebagai cookie httpOnly).
- **"Login Google" = Emergent:** [AuthContext.tsx](frontend/contexts/AuthContext.tsx) membuka `https://auth.emergentagent.com/?redirect=...`, callback mengembalikan `session_id`, lalu `POST /api/auth/session` → backend memanggil `https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data`. **Tidak ada integrasi Google/Apple langsung.**
- **Apple:** tombol ada tapi `disabled` di [login.tsx](frontend/app/login.tsx) & [signup.tsx](frontend/app/signup.tsx).
- **Sesi:** Bearer token (`Authorization: Bearer <session_token>`) + `require_auth` dependency.

### 2.2 Langganan & Trial
- `SUBSCRIPTION_TIERS` di server.py: `free_trial` (10 aksi/hari, 3 hari, $0), `basic` ($1.99/bln, 30 chat, 20 upload), `pro` ($4.99, 100/100), `power` ($9.99, unlimited).
- User baru via OAuth otomatis diberi `free_trial` (expiry 3 hari) di `POST /api/auth/session`.
- `POST /api/auth/start-trial` men-set `free_trial`.
- `check_quota()` membatasi aksi: free_trial = 10 aksi/hari; tier berbayar = limit bulanan; saat kedaluwarsa → balik ke `free_trial`.
- **Pembayaran:** belum ada. Tombol upgrade di [subscription.tsx](frontend/app/(app)/subscription.tsx) hanya menampilkan alert "coming soon". `react-native-iap` (frontend) & `stripe` (backend) sudah jadi dependency namun belum diimplementasikan.

### 2.3 Paywall
- [app/(app)/_layout.tsx](frontend/app/(app)/_layout.tsx) me-redirect ke `/(app)/subscription` jika `!user.is_subscription_active`. Tidak ada penegakan pembelian.

### 2.4 Ketergantungan Emergent yang akan dihapus
- **Auth:** `auth.emergentagent.com`, `demobackend.emergentagent.com/.../session-data`, endpoint `POST /api/auth/session`, fungsi `login()` lama.
- **LLM (opsional, fase lanjutan):** `from emergentintegrations.llm.chat import LlmChat` dipakai untuk chat/OCR/insights. Saat ini sudah jalan dengan **OpenAI key biasa** (`EMERGENT_LLM_KEY` fallback ke `OPENAI_API_KEY`). Untuk benar-benar bebas Emergent, ganti `LlmChat` dengan panggilan OpenAI/litellm langsung dan hapus paket `emergentintegrations` dari `requirements.txt` (+ `--extra-index-url`).

---

## 3. Tujuan & Non-Tujuan

### Tujuan
- G1: Hapus seluruh ketergantungan **Emergent untuk autentikasi**; pengguna bisa login dengan **Google** & **Apple** asli.
- G2: Paywall yang menegakkan langganan dengan **pembelian nyata via IAP**, termasuk **restore purchases**.
- G3: **Kode trial 3 hari** yang bisa di-redeem, sekali pakai per user, dengan kontrol kuota & kedaluwarsa.
- G4: Satu **sumber kebenaran entitlement** di backend yang dipakai paywall, kuota, dan tampilan.

### Non-Tujuan
- Pembayaran web/Stripe untuk barang digital di iOS/Android (dilarang aturan store) — Stripe hanya jika nanti ada versi web murni.
- Family sharing, refund self-service, multi-seat.
- Migrasi LLM dari Emergent (dijadikan **fase opsional**, lihat §4.6).

---

## 4. Fitur 1 — Login Google & Apple (Hapus Emergent)

### 4.1 User Stories
- Sebagai pengguna baru, saya bisa daftar/masuk dengan **akun Google** dalam satu ketukan.
- Sebagai pengguna iOS, saya bisa masuk dengan **Apple ID** (Face ID/Touch ID).
- Sebagai pengguna lama (email/password), login saya tetap berfungsi.
- Jika email Google/Apple sama dengan akun yang sudah ada, akun **ditautkan**, bukan duplikat.

### 4.2 Requirement Fungsional
1. Tombol **Continue with Google** dan **Continue with Apple** aktif di [login.tsx](frontend/app/login.tsx) & [signup.tsx](frontend/app/signup.tsx). Apple hanya tampil di iOS (guideline) atau tampil semua dengan fallback.
2. Frontend mendapat **ID token** dari SDK native, mengirim ke backend untuk diverifikasi; backend membuat/menemukan user lalu mengembalikan `session_token` (format sama seperti sekarang).
3. Penautan akun berdasarkan **email terverifikasi**. Simpan `auth_provider` & `provider_sub` (subject id) per metode.
4. Logout & cek sesi (`/api/auth/me`) tidak berubah.
5. **Hapus** `login()` lama (Emergent) + `POST /api/auth/session` + konstanta `AUTH_URL`.

### 4.3 Desain Teknis — Frontend
- **Apple:** paket `expo-apple-authentication` (config plugin, iOS). Dapatkan `identityToken`, kirim ke backend.
- **Google:** `@react-native-google-signin/google-signin` (UX native, butuh dev/production build — sudah pakai EAS) **atau** `expo-auth-session` + Google provider (jalan di Expo Go juga). Dapatkan `idToken`.
- Tambah method di [AuthContext.tsx](frontend/contexts/AuthContext.tsx): `loginWithGoogle()`, `loginWithApple()` → `POST /api/auth/oauth/{provider}` `{ id_token, ...optional name }` → simpan `session_token`.
- Hapus deep-link/`WebBrowser` flow Emergent.

### 4.4 Desain Teknis — Backend
- Endpoint baru:
  - `POST /api/auth/oauth/google` `{ id_token }` → verifikasi via **google-auth** (`verify_oauth2_token` dengan audience = Google client ID). Ambil `sub`, `email`, `email_verified`, `name`, `picture`.
  - `POST /api/auth/oauth/apple` `{ identity_token, full_name? }` → verifikasi **JWT** Apple: ambil JWKS dari `https://appleid.apple.com/auth/keys`, validasi `iss=https://appleid.apple.com`, `aud=<bundleId>` (`com.azkanura.finflow`), `exp`. Ambil `sub`, `email`. (Apple hanya kirim nama saat pertama → simpan `full_name` dari klien jika ada.)
- Logika user: cari `users` by `email` → jika ada, tautkan provider; jika tidak, buat user baru (tanpa auto-trial — lihat §6 soal trial). Buat sesi seperti `register/login`.
- Lib sudah tersedia: `google-auth`, `python-jose`/`PyJWT`.
- **Hapus** `POST /api/auth/session` + pemanggilan `demobackend.emergentagent.com`.

### 4.5 Perubahan Data — koleksi `users`
Tambah: `auth_providers: [{ provider: "google|apple|password", sub: str, linked_at }]`, `email_verified: bool`. Pertahankan field lama.

### 4.6 (Opsional) Hapus Emergent dari LLM
- Ganti `LlmChat`/`UserMessage`/`ImageContent` dengan SDK `openai` (sudah ada di requirements) untuk chat/OCR(vision)/insights & Whisper untuk suara.
- Hapus `emergentintegrations` + baris `--extra-index-url` dari `requirements.txt`.
- **Efek positif deploy:** Render tak perlu index privat lagi → build lebih andal & ringan.

### 4.7 Edge Cases & Kepatuhan
- **Guideline Apple 4.8:** jika menawarkan login pihak ketiga (Google) di iOS, **wajib** juga menyediakan **Sign in with Apple** → terpenuhi karena keduanya ada.
- Email Apple "Hide My Email" (relay) → tetap email valid; tangani sebagai email unik.
- Token kedaluwarsa/invalid → 401 dengan pesan jelas.
- Akun email/password lalu login Google dengan email sama → tautkan (jangan buat ganda).

---

## 5. Fitur 2 — Paywall + Pembelian (IAP)

### 5.1 Prinsip & Kepatuhan
- Barang digital (langganan) di iOS **wajib** Apple IAP; di Android **wajib** Google Play Billing. **Tidak boleh** Stripe/eksternal untuk ini di app mobile.
- Backend tetap **sumber kebenaran entitlement** (status divalidasi server-side, bukan hanya klien).

### 5.2 Entitlement Model
- `subscription_tier` ∈ {`free` (tanpa akses premium), `free_trial`, `basic`, `pro`, `power`} + `subscription_expires_at` + `subscription_source` ∈ {`iap_apple`, `iap_google`, `trial_code`, `auto_trial`, `none`}.
- Helper `is_premium(user)` = tier ≠ `free` dan belum kedaluwarsa.

### 5.3 Kapan Paywall Muncul
- Saat membuka fitur premium tanpa entitlement aktif (mis. melebihi kuota free, atau tier `free`).
- Saat trial habis (`subscription_expires_at < now`).
- Layar paywall = [subscription.tsx](frontend/app/(app)/subscription.tsx) yang dirombak: menampilkan paket, harga lokal dari store, tombol beli, **Restore Purchases**, dan tautan **"Punya kode?"** (Fitur 3).
- Pertahankan redirect di [_layout.tsx](frontend/app/(app)/_layout.tsx) namun berdasarkan `is_premium`.

### 5.4 Opsi Implementasi
- **Opsi A — RevenueCat (REKOMENDASI):** SDK `react-native-purchases`. Menangani validasi receipt Apple/Google, cross-platform, restore, dan **webhook** ke backend untuk update entitlement. Paling cepat & minim kode server.
- **Opsi B — DIY:** `react-native-iap` (sudah jadi dependency) + validasi server-side: Apple **App Store Server API** (notifikasi v2) & **Google Play Developer API**. Lebih banyak kerja & maintenance.

### 5.5 Produk IAP
- Definisikan subscription products di App Store Connect & Play Console agar cocok dengan tier: `basic_monthly/yearly`, `pro_monthly/yearly`, `power_monthly/yearly` (harga dari §2.2).
- Map `productId` → `tier` di backend.

### 5.6 Backend
- `POST /api/billing/validate` (DIY) atau **webhook RevenueCat** `POST /api/billing/webhook` → verifikasi, set `subscription_tier`, `subscription_expires_at`, `subscription_source`.
- `GET /api/subscription` (sudah ada) dikembalikan dari entitlement nyata.
- Tangani: perpanjangan, pembatalan, refund/chargeback (turunkan ke `free`), grace period.

### 5.7 Restore & Multi-perangkat
- Tombol **Restore Purchases** memanggil store → kirim ke backend → pulihkan entitlement.
- Entitlement mengikuti **akun FinFlow** (server), bukan device.

---

## 6. Fitur 3 — Kode Trial Gratis 3 Hari

### 6.1 Deskripsi
Kode alfanumerik (mis. `FINFLOW-3DAY-XXXX`) yang bila di-redeem memberi akses penuh (tier `pro` atau `free_trial` dengan kuota penuh) selama **3 hari**. Untuk kampanye/influencer/beta. Berbeda dari **promo code milik Apple/Google** (itu untuk IAP); ini entitlement internal.

### 6.2 Data Model — koleksi `redeem_codes`
`{ code, type:"trial", grant_tier:"pro", duration_days:3, max_uses, used_count, per_user_once:true, active:true, valid_from, valid_until, created_by, created_at }`
Koleksi `redemptions`: `{ code, user_id, redeemed_at, expires_at }`.

### 6.3 Endpoint
- `POST /api/codes/redeem` (auth) `{ code }` →
  - Validasi: kode ada & `active`; dalam rentang `valid_from..valid_until`; `used_count < max_uses`; user belum pernah pakai (jika `per_user_once`); user belum punya langganan berbayar aktif (opsional).
  - Aksi: set `subscription_tier=grant_tier`, `subscription_expires_at=now+duration_days`, `subscription_source="trial_code"`; `used_count++`; catat di `redemptions`.
  - Respons: entitlement terbaru.
- `POST /api/admin/codes` (admin-only) → generate kode batch. (Otentikasi admin sederhana via env `ADMIN_TOKEN` di fase awal.)

### 6.4 UX Frontend
- Field/`screen` "Redeem code" yang bisa diakses dari **paywall** dan **Profil**.
- Sukses → toast + langsung buka akses (refresh `user`). Gagal → pesan spesifik (kadaluarsa/terpakai/invalid).

### 6.5 Edge Cases
- Kode sudah dipakai user yang sama → tolak ("sudah pernah dipakai").
- Kuota `max_uses` habis → tolak.
- User sedang trial/berbayar → kebijakan: tolak **atau** perpanjang (default: hanya berlaku jika tier `free`/expired; tampilkan info).
- Anti-brute force: rate-limit endpoint redeem.

---

## 7. Ringkasan Perubahan Data Model
- `users`: + `auth_providers[]`, `email_verified`, `subscription_source`, set default `subscription_tier="free"` untuk user tanpa entitlement.
- Baru: `redeem_codes`, `redemptions`.
- (RevenueCat) opsional: `rc_app_user_id` pada user.

---

## 8. Ringkasan Endpoint API

| Metode | Endpoint | Status | Keterangan |
|---|---|---|---|
| POST | `/api/auth/oauth/google` | **baru** | verifikasi Google ID token |
| POST | `/api/auth/oauth/apple` | **baru** | verifikasi Apple identity token |
| POST | `/api/auth/session` | **hapus** | flow Emergent |
| POST | `/api/auth/register` `/login` `/logout` | tetap | email/password |
| GET | `/api/auth/me` | tetap | cek sesi |
| POST | `/api/billing/webhook` atau `/api/billing/validate` | **baru** | update entitlement dari IAP/RevenueCat |
| GET | `/api/subscription` | ubah | dari entitlement nyata |
| POST | `/api/codes/redeem` | **baru** | redeem kode trial |
| POST | `/api/admin/codes` | **baru** | generate kode (admin) |
| POST | `/api/auth/start-trial` | tinjau | selaraskan dgn entitlement baru |

---

## 9. Dependensi & Konfigurasi
- **Frontend (baru):** `expo-apple-authentication`, `@react-native-google-signin/google-signin` (atau `expo-auth-session`), `react-native-purchases` (jika RevenueCat). `react-native-iap` sudah ada (Opsi B).
- **Config plugin** di `app.json` + entitlement iOS (Sign in with Apple capability), Google `iosUrlScheme`/`webClientId`.
- **Backend (baru env):** `GOOGLE_CLIENT_ID` (iOS/Android/web), `APPLE_BUNDLE_ID=com.azkanura.finflow`, `APPLE_TEAM_ID`, (RevenueCat) `REVENUECAT_WEBHOOK_SECRET`, `ADMIN_TOKEN`.
- **App Store Connect / Play Console:** definisikan produk langganan + (opsional) App Store Server API key / Play service account untuk validasi DIY.

---

## 10. Keamanan & Privasi
- Verifikasi token OAuth **selalu di server** (jangan percaya klaim klien).
- Hash password sudah ada; pertimbangkan upgrade ke `bcrypt`/`argon2` (bcrypt sudah di requirements).
- Rate-limit `redeem`, `oauth`, `login`.
- Validasi entitlement di server untuk setiap aksi berkuota (`check_quota`).
- Hapus rahasia Emergent yang tak terpakai.

## 11. Analitik & Metrik Sukses
- Konversi: % trial→berbayar, % paywall→beli, redemptions per kampanye.
- Auth: % sukses login per provider, error rate.
- Retensi D1/D7 untuk pengguna trial-code vs auto-trial.

## 12. Rollout (fase)
- **Fase 0:** Login Google+Apple + hapus Emergent auth. (Buka akses tanpa paywall keras dulu.)
- **Fase 1:** Kode trial 3 hari (redeem + admin generate).
- **Fase 2:** Paywall + IAP (RevenueCat) + restore.
- **Fase 3 (opsional):** Hapus Emergent dari LLM; bersihkan `requirements.txt`.

## 13. Risiko & Mitigasi
- **Penolakan App Store:** patuhi 4.8 (Apple sign-in) & wajib IAP → tercakup.
- **Validasi receipt rumit** → pakai RevenueCat (Opsi A).
- **Penyalahgunaan kode** → `max_uses`, `per_user_once`, rate-limit, kedaluwarsa.
- **Akun ganda** saat ganti provider → tautkan via email terverifikasi.

## 14. Pertanyaan Terbuka
- IAP: **RevenueCat** atau DIY `react-native-iap`? (rekomendasi: RevenueCat).
- Trial-code memberi tier `pro` atau `free_trial`+kuota penuh? (default: `pro` 3 hari).
- Trial otomatis untuk semua user baru tetap ada, atau **hanya** via kode? (default: pertahankan auto-trial + tambah kode).
- Hapus Emergent LLM sekarang atau Fase 3?

## 15. Out of Scope
- Web payments/Stripe, family sharing, refund self-service, kupon diskon harga IAP (gunakan promo code store bila perlu).
