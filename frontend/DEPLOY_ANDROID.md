# Panduan Deployment & Pengujian Android (FinFlow)

Dokumen ini berisi langkah-langkah untuk menguji aplikasi di Android Emulator dan mengunggah (submit) versi baru ke Google Play Console menggunakan Expo Application Services (EAS).

---

## 💻 Pengujian di Android Emulator

Sebelum melakukan deployment, disarankan untuk menguji perubahan kode di Emulator untuk memastikan fungsionalitas berjalan dengan benar.

### 1. Persiapan Emulator
- Pastikan **Android Studio** sudah terinstall.
- Buka Android Studio, pergi ke **Device Manager** dan buat Virtual Device (AVD) jika belum ada.
- Pastikan `ANDROID_HOME` environment variable sudah dikonfigurasi di shell Anda (`.zshrc` atau `.bash_profile`).
- Jalankan emulator dari Android Studio.

### 2. Menjalankan Aplikasi
Jalankan perintah berikut di dalam direktori `frontend`:

```bash
# Menginstall dependencies jika belum
npm install

# Menjalankan aplikasi di Android Emulator
npm run android
```

- Expo akan mendeteksi emulator yang sedang berjalan dan menginstall aplikasi Expo Go (atau development build) secara otomatis.

---

## ⚠️ Perhatian: Environment Variables

> [!IMPORTANT]
> **PENTING**: Pastikan `EXPO_PUBLIC_BACKEND_URL` di file `.env` sudah diarahkan ke URL **Backend Produksi** sebelum membuat build untuk rilis.
> 
> Khusus Android Emulator: Jika mengetes ke backend lokal, gunakan IP `10.0.2.2` bukan `localhost`. Namun untuk build rilis, selalu gunakan URL produksi (misal: HTTPS).

---

## 🚀 Langkah-Langkah Build & Submit (Google Play)

### 1. Persiapan Deployment
- Pastikan Anda sudah login ke akun Expo: `eas login`.
- Akun Google Play Console harus sudah aktif dan terbayar.
- Cek nomor versi di `app.json` (`version` dan `android.versionCode`).

### 2. Build untuk Produksi (AAB)
Android App Bundle (.aab) adalah format standar untuk Google Play. Jalankan perintah ini:

```bash
eas build --platform android --profile production
```

- EAS akan mengelola **Keystore** (kunci tanda tangan digital) secara otomatis. Jika ini pertama kali, ikuti instruksi untuk membuat keystore baru.
- Tunggu hingga proses build selesai di server Expo.

### 3. Submit ke Google Play Store
Setelah build selesai, Anda bisa mengirimkan file `.aab` ke Google Play Console:

```bash
eas submit --platform android --profile production
```

- Anda akan diminta memilih build yang ingin dikirim.
- Jika Anda belum mengonfigurasi `serviceAccountKeyPath` di `eas.json`, Anda mungkin perlu mengunggah file `.aab` secara manual ke Google Play Console pada percobaan pertama.

### 💡 Tips: Automasi Build & Submit
Untuk melakukan proses build dan submit dalam satu langkah:

```bash
eas build --platform android --profile production --auto-submit
```

---

## ✅ Verifikasi Setelah Submit

1.  **Google Play Console**: Cek menu **Internal Testing** atau **Production**. Tunggu proses "App Integrity" selesai.
2.  **Google Play Store**: Jika menggunakan jalur Internal Testing, tambahkan email penguji dan buka link join yang diberikan.
3.  **Instalasi**: Install aplikasi di perangkat Android fisik dan pastikan koneksi ke API lancar.
