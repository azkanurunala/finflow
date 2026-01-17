# Panduan Deployment Backend FinFlow

Backend FinFlow ini adalah aplikasi **FastAPI** yang menggunakan **MongoDB**. Berikut adalah langkah-langkah untuk mendeploynya.

## 1. Persiapan Database (MongoDB Atlas)
Sebelum deploy aplikasi, Anda memerlukan database MongoDB yang bisa diakses secara online.

1. Buat akun di [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Buat **Cluster** baru (pilih yang Free/Shared).
3. Di tab `Database Access`, buat user database (username & password).
4. Di tab `Network Access`, klik "Add IP Address" dan pilih "Allow Access from Anywhere" (`0.0.0.0/0`) agar server cloud bisa mengaksesnya.
5. Dapatkan **Connection String** (pilih "Connect" > "Drivers"). Formatnya mirip:
   `mongodb+srv://user:password@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`

## 2. Pilihan Deployment

### Opsi A: Render (Direkomendasikan - Gratis/Murah)
Render sangat mudah untuk Python/Docker.

1. Push kode terbaru ke GitHub/GitLab.
2. Buka [Render Dashboard](https://dashboard.render.com/).
3. Klik **New +** dan pilih **Web Service**.
4. Connect repository `finflow` Anda.
5. Atur konfigurasi berikut:
   - **Name**: `finflow-backend`
   - **Root Directory**: `backend` (PENTING! Karena kode ada di folder backend)
   - **Runtime**: `Python 3` (Render akan membaca `requirements.txt` otomatis) atau `Docker` (jika ingin menggunakan Dockerfile yang sudah saya buat).
     - *Saran: Pilih 'Docker' agar lebih stabil karena saya sudah buatkan Dockerfile.*
6. Scroll ke bawah ke section **Environment Variables** dan tambahkan:
   - `MONGO_URL`: Connection string dari langkah 1.
   - `DB_NAME`: `finflow_prod` (atau nama lain).
   - `EMERGENT_LLM_KEY`: API key Anda.
   - `OPENAI_API_KEY`: API key Anda.
7. Klik **Create Web Service**.

### Opsi B: Railway
1. Buka [Railway](https://railway.app/).
2. "New Project" > "Deploy from GitHub repo".
3. Pilih repo `finflow`.
4. Railway otomatis mendeteksi folder `backend`. Jika tidak, masuk ke Settings > Root Directory: `backend`.
5. Masuk ke tab **Variables** dan masukkan `MONGO_URL`, `EMERGENT_LLM_KEY`, dll.

## 3. Verifikasi
Setelah deploy berhasil, Render/Railway akan memberikan URL (misalkan `https://finflow-backend.onrender.com`).
Coba buka endpoint health check:
`https://finflow-backend.onrender.com/health`

Jika responnya `{"status": "ok"}`, maka deployment berhasil!
