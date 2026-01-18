# Panduan Deployment Backend (FinFlow API)

Dokumen ini berisi langkah-langkah untuk melakukan deployment aplikasi backend FinFlow (FastAPI) ke production.

---

## 📋 Prerequisites

Sebelum deploy, pastikan Anda memiliki:
- Akun di platform hosting (Render, Railway, atau lainnya)
- Akun MongoDB Atlas (untuk database)
- API keys yang diperlukan (Emergent, OpenAI)

---

## 🗄️ Setup MongoDB Atlas

### 1. Buat Cluster Gratis
1. Buka [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Klik "Try Free" dan buat akun
3. Pilih **M0 Sandbox (FREE)**
4. Pilih region terdekat (Singapore/Australia)
5. Klik "Create Deployment"

### 2. Buat Database User
1. Di popup "Security Quickstart", buat username dan password
2. **Catat credentials ini!**
3. Contoh: `finflow_user` / `securepassword123`

### 3. Allow Network Access
1. Pergi ke **Network Access** → **Add IP Address**
2. Pilih **"Allow Access from Anywhere"** (0.0.0.0/0)

### 4. Dapatkan Connection String
1. Klik **Connect** → **Drivers**
2. Copy connection string:
   ```
   mongodb+srv://finflow_user:<password>@cluster0.xxxxx.mongodb.net/
   ```
3. Ganti `<password>` dengan password yang Anda buat

---

## 🚀 Deploy ke Render.com (Rekomendasi)

### 1. Persiapan Repository
Pastikan folder `backend/` memiliki file-file berikut:
- `server.py` - Main application
- `requirements.txt` - Python dependencies
- `.env` (jangan commit, akan diset di Render)

### 2. Buat Web Service di Render
1. Buka [render.com](https://render.com) dan login
2. Klik **New** → **Web Service**
3. Connect repository GitHub Anda
4. Konfigurasi:
   - **Name**: `finflow-api`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`

### 3. Set Environment Variables
Di tab **Environment**, tambahkan:

| Key | Value |
|-----|-------|
| `MONGO_URL` | `mongodb+srv://user:pass@cluster.mongodb.net/` |
| `DB_NAME` | `finflow` |
| `EMERGENT_LLM_KEY` | `sk-emergent-xxxx` |
| `OPENAI_API_KEY` | `sk-proj-xxxx` |

### 4. Deploy
Klik **Create Web Service**. Render akan otomatis build dan deploy.

---

## 🚂 Deploy ke Railway (Alternatif)

### 1. Setup Railway
1. Buka [railway.app](https://railway.app) dan login
2. Klik **New Project** → **Deploy from GitHub repo**
3. Pilih repository dan folder `backend`

### 2. Konfigurasi
1. Railway akan auto-detect Python project
2. Tambahkan environment variables di tab **Variables**
3. Set **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`

---

## ✅ Verifikasi Deployment

### 1. Health Check
Buka URL deployment Anda dan akses:
```
https://your-backend-url.com/health
```

Response yang diharapkan:
```json
{"status": "ok"}
```

### 2. API Health
```
https://your-backend-url.com/api/health
```

Response yang diharapkan:
```json
{"status": "healthy", "app": "FinFlow API", "version": "1.0.0"}
```

---

## 🔧 Troubleshooting

### Error: MongoDB Authorization
```
not authorized on database to execute command
```
**Solusi**: Pastikan MongoDB user memiliki role `readWriteAnyDatabase` atau `Atlas Admin`.

### Error: Module Not Found
**Solusi**: Pastikan semua dependencies ada di `requirements.txt`.

### Error: Port Already in Use
**Solusi**: Gunakan `$PORT` environment variable, bukan hardcoded port.

---

## 🔄 Update Frontend `.env`

Setelah backend berhasil di-deploy, update frontend `.env`:
```
EXPO_PUBLIC_BACKEND_URL=https://your-backend-url.com/
```

Kemudian rebuild aplikasi iOS untuk TestFlight.
