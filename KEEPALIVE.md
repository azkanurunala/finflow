# Keep-alive: jaga backend Render free tier tetap nyala

Backend FinFlow di Render **free tier** (lihat `render.yaml`, `plan: free`) otomatis
**tidur setelah ~15 menit** tanpa request HTTP masuk, lalu butuh ~50 detik cold-start
saat dibangunkan. Supaya pengguna tidak kena loading lama, kita ping endpoint ringan
secara berkala dari luar.

## Endpoint yang di-ping

```
GET|HEAD https://finflow-backend-fshd.onrender.com/health  ->  {"status":"ok"}
```

Endpoint ini sengaja dipilih karena **tidak menyentuh database maupun LLM**
(lihat `backend/server.py`, fungsi `health_check`), jadi tiap ping nyaris nol biaya.
Endpoint menerima **GET dan HEAD** — penting karena UptimeRobot free tier nge-ping
pakai HEAD (route GET-only akan balas `405 Method Not Allowed`).

## Interval: tiap 5 menit (jangan lebih sering)

Backend statusnya biner — nyala atau tidur. Ping lebih sering **tidak** membuatnya
"lebih nyala"; yang penting hanya ada request **sebelum** timer idle 15 menit habis.

- **Tiap 5 menit** = rekomendasi. Margin 3x aman, gratis di semua pinger, beban minim.
- Tiap 1 menit = boleh, tapi 5x lebih banyak request tanpa manfaat tambahan.
- Tiap 10 menit = paling irit, masih aman.
- Per detik / 3-4 detik = **mubazir & tidak gratis** (butuh paket berbayar), nol manfaat.

## Cara setup (gratis) — cron-job.org

1. Daftar di https://cron-job.org (gratis).
2. **Create cronjob**:
   - **URL**: `https://finflow-backend-fshd.onrender.com/health`
   - **Schedule**: Every 5 minutes (`*/5 * * * *`).
   - Method: `GET`. Timeout: naikkan ke ~30 detik supaya tahan cold-start.
3. Save. Selesai — backend akan tetap hangat 24/7, nol biaya.

Alternatif: **UptimeRobot** (https://uptimerobot.com) — monitor HTTP(s) gratis,
interval minimum 5 menit. Sama saja: arahkan ke URL `/health` di atas.

## Kenapa bukan GitHub Actions?

Repo ini **private**. Cron GitHub Actions tiap 5-10 menit = ribuan run/bulan, dan
repo private menagih minimum 1 menit per run -> melewati jatah 2.000 menit gratis ->
kena biaya overage. Untuk repo private, pinger eksternal di atas jauh lebih hemat.
(Kalau suatu saat repo dibuat public, GitHub Actions jadi unlimited & gratis, dan
workflow cron bisa dipakai sebagai gantinya.)

## Catatan kuota Render

Free tier memberi **750 instance-hours/bulan**; satu bulan ~720 jam, jadi menjaga
**satu** service nyala 24/7 masih di dalam jatah gratis. Kalau punya lebih dari satu
free service yang berbagi kuota ini, total bisa lewat 750 jam.
