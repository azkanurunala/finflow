# Panduan Deployment & Pengujian iOS (FinFlow)

Dokumen ini berisi langkah-langkah untuk menguji aplikasi di Simulator macOS dan mengunggah (submit) versi baru ke Apple TestFlight menggunakan Expo Application Services (EAS).

---

## 💻 Pengujian di iOS Simulator (macOS)

Sebelum melakukan deployment ke TestFlight, disarankan untuk menguji perubahan kode di Simulator untuk memastikan UI dan fungsionalitas berjalan dengan benar.

### 1. Persiapan Simulator
- Pastikan **Xcode** sudah terinstall dari App Store.
- Buka Xcode, lalu buka menu **Settings > Platforms** dan pastikan SDK iOS sudah terdownload.
- Install Command Line Tools: `xcode-select --install`.

### 2. Menjalankan Aplikasi
Jalankan perintah berikut di dalam direktori `frontend`:

```bash
# Menginstall dependencies jika belum
npm install

# Menjalankan aplikasi di iOS Simulator
npm run ios
```

- Expo akan mendeteksi Simulator yang tersedia dan membukanya secara otomatis.
- Jika Simulator belum terbuka, Expo akan menanyakan apakah ingin membuka Simulator. Tekan `i` di terminal.

### 3. Tips Troubleshooting Simulator
- **Reset Simulator**: Jika aplikasi crash atau lambat, pilih **Device > Erase All Content and Settings** di menu Simulator.
- **Deep Links**: Untuk mengetes login atau redirect, Anda bisa drag & drop URL ke jendela Simulator.
- **Permissions**: Untuk mengetes Kamera atau Microfon di Simulator, pastikan Anda memberikan izin saat diminta (Pop-up Xcode).

---

## ⚠️ Perhatian: Environment Variables

> [!IMPORTANT]
> **PENTING**: File `.env` Anda saat ini kemungkinan masih berisi URL backend preview. Pastikan `EXPO_PUBLIC_BACKEND_URL` sudah diganti ke URL **Backend Produksi** sebelum melakukan build untuk TestFlight.
>
> Contoh: `EXPO_PUBLIC_BACKEND_URL=https://nama-backend-anda.onrender.com`

---

## 🚀 Langkah-Langkah Build & Submit (TestFlight)

### 1. Persiapan Deployment
- Pastikan semua perubahan kode sudah di-commit ke repository.
- Cek `app.json` jika ingin mengubah nomor versi (`version`). Nomor build (`ios.buildNumber`) akan otomatis bertambah karena konfigurasi `autoIncrement: true` di `eas.json`.
- Pastikan Anda sudah login ke akun Expo di terminal: `eas login`.

### 2. Build untuk TestFlight
Jalankan perintah ini di dalam direktori `frontend`:

```bash
# Build production bundle
eas build --platform ios --profile production
```

- Perintah ini akan memulai proses build di server Expo (EAS Build).
- EAS akan menangani *code signing* secara otomatis.
- Tunggu hingga build selesai (bisa dipantau di [Expo Dashboard](https://expo.dev/)).

### 3. Submit ke TestFlight
Setelah build selesai (berstatus `finished`), Anda bisa mengunggah file `.ipa` ke App Store Connect:

```bash
eas submit --platform ios --profile production
```

- Ikuti petunjuk di terminal jika diminta memilih build mana yang ingin di-submit.

### 💡 Tips: One-Step Build & Submit
Jika Anda ingin build dan langsung otomatis submit setelah selesai, gunakan perintah ini:

```bash
eas build --platform ios --profile production --auto-submit
```

---

## ✅ Verifikasi Setelah Submit

1.  **App Store Connect**: Tunggu hingga status build menjadi "Waiting for Review" atau "Ready to Test".
2.  **TestFlight App**: Buka aplikasi TestFlight di perangkat iOS fisik Anda.
3.  **Update & Test**: Install versi terbaru dan pastikan aplikasi terhubung ke backend produksi dengan benar.
