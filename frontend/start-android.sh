#!/usr/bin/env bash
# Nyalakan emulator Android (kalau belum jalan), lalu jalankan Expo (Expo Go).
# Pemakaian:  npm run android:dev        (pakai AVD default Pixel_7_API_36)
#             npm run android:dev Pixel_7   (pakai AVD lain)
set -euo pipefail

# Set env inline supaya tetap jalan walau terminal belum me-load ~/.zshrc
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"

AVD="${1:-Pixel_7_API_36}"

# Sudah ada emulator/device yang aktif?
if adb devices | awk 'NR>1 && $2=="device"{found=1} END{exit !found}'; then
  echo "✅ Emulator sudah jalan."
else
  echo "▶  Menyalakan emulator: $AVD ..."
  # -gpu host: render lewat GPU Metal Mac (jauh lebih ringan & stabil daripada software render).
  # -no-boot-anim: hemat resource saat boot. Cocok untuk Mac RAM kecil.
  nohup emulator -avd "$AVD" -gpu host -no-boot-anim -no-snapshot-load >/tmp/finflow-emulator.log 2>&1 &
  adb wait-for-device
  echo "⏳ Menunggu boot selesai..."
  until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
    sleep 2
  done
  echo "✅ Emulator siap."
fi

# Jalankan Expo dengan cache bersih. Tekan 'a' untuk membuka di emulator.
exec npx expo start -c
