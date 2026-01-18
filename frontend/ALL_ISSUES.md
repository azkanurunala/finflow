GLOBAL INSTRUCTION (WAJIB)

Sebelum mengerjakan task apa pun:

Audit terlebih dahulu:

Frontend behavior (UI, UX, navigation, formatting, state)

Backend logic (API, database persistence, default value, reload behavior)

Jika sudah sesuai dengan requirement di bawah, JANGAN DIUBAH

Jika belum sesuai / inkonsisten / partial, lakukan perbaikan minimum necessary change

Semua perubahan harus:

Konsisten lintas entry point

Tidak memecah flow existing yang sudah benar

1. GLOBAL UI & FORMAT RULE (WAJIB SELURUH APP)
1.1 Currency & Number Formatting (KRITIS)

Cek seluruh aplikasi (display & input):

Rupiah (IDR):

Thousand separator: .

Decimal: ,

Non-Rupiah:

Thousand separator: ,

Decimal: .

Wajib berlaku untuk:

Semua display nominal

Semua input nominal (dengan masking)

Manual input

Edit transaksi

Hasil OCR

Hasil audio log

Analytics

Export data

Jika ada 1 saja screen tidak konsisten → perbaiki

2. MODULE: Home
2.1 Font Size Income & Expense

Cek:

Apakah angka Income & Expense menabrak container

Jika ya:

Kurangi ukuran font menjadi ±50% dari ukuran sekarang
Jika sudah rapi:

Jangan diubah

2.2 Home → Transactions Navigation

Cek behavior klik di Home:

Klik Total Balance → Transactions tab All

Klik Income → Transactions tab Income

Klik Expenses → Transactions tab Expenses

Jika:

Salah tab

Tidak konsisten

Selalu ke tab default

→ Perbaiki routing + tab state

3. MODULE: Transactions (Create / Edit / List)
3.1 Currency Default Logic

Cek:

Saat create & edit transaksi, currency otomatis mengikuti:

Setting currency user (global)

Persist setelah logout/login

Berlaku untuk:

Create manual

Edit manual

Edit hasil OCR

Edit hasil audio log

Jika masih default $ → BUG, WAJIB PERBAIKI

3.2 Thousand Separator Input

Cek:

Apakah input nominal sudah ada pemisah ribuan + masking

Berlaku untuk:

Create manual

Edit manual

Edit hasil OCR

Edit hasil audio log

Jika belum → implementasikan

3.3 Expense Category UI & Logic

Cek:

Untuk tipe Expense:

Kategori tersusun horizontal

Bisa scroll kiri/kanan jika overflow

Tambahan wajib:

User bisa menambahkan kategori baru secara manual

Tidak terbatas hanya kategori existing

3.4 Delete Transaction Reload

Cek:

Setelah delete + confirm:

Data benar-benar terhapus

List reload otomatis

Tanpa manual refresh

Jika masih ghost data → perbaiki

3.5 Transactions Tabs, Filter & Sort

Cek:

Tab tersedia: All | Income | Expenses

Filter:

Sehari

Seminggu

Sebulan

Setahun

All

Custom date (from – to)

Sort:

Tanggal terbaru

Tanggal terlama

Transaksi terbesar

Transaksi terkecil

Pastikan:

Filter & sort benar-benar mempengaruhi data

Logic reuseable (dipakai juga Analytics)

4. MODULE: Scan Receipt (OCR)
4.1 Currency Default

Cek:

Hasil scan receipt tidak boleh default $

Harus mengikuti setting currency user

Jika tidak → bug

4.2 OCR → Chat History

Cek:

Hasil OCR otomatis:

Masuk ke history chat

Tidak hanya jadi transaksi terpisah

Jika belum → implementasikan

5. MODULE: Audio Log
5.1 Recorder Initialization

Cek:

Error saat:

Starting recorder

Initializing

Jika:

Masih sering gagal

Error mentah

→ perbaiki handling & retry logic

5.2 Empty Audio Handling

Cek scenario:

User stop recording tanpa bicara

Jika muncul error mentah seperti:

float() argument must be a string or a real number, not 'NoneType'


→ SALAH

Harus:

Error di-handle

Pesan user-friendly:

“Tidak ada audio yang bisa ditranskripsikan”

5.3 Audio Log → Chat History

Cek:

Semua audio log:

Masuk ke history chat

Persist (tidak hilang)

6. MODULE: Chat
6.1 Chat Persistence (KRITIS)

Cek:

Chat tidak reset seperti sekarang

Behavior seperti WhatsApp:

Riwayat tetap ada

Tambahan:

Ada opsi manual reset chat (clear history)

6.2 Chat Entry Point Consistency

Cek:

Klik Audio / OCR dari:

Chat

Home

Create New

Semua harus:

Membuka modal / bottom sheet yang SAMA

Tidak boleh beda behavior

6.3 Chat Icon Behavior

Cek:

Icon Camera → Scanner

Klik → open Scan Receipt modal

Icon Mic → Voice Log modal

Jika redirect ke Home → BUG

7. MODULE: Bottom Navbar
7.1 Add (+) Button Behavior

Cek:

Klik + dari halaman mana pun:

Home

Transactions

Analytics

Profile

Harus:

Selalu tampil bottom sheet pilihan

Chat

Manual Input

Scan Receipt

Voice Log

Jika langsung ke Manual Input → BUG

8. MODULE: Analytics
8.1 Export CSV / JSON

Cek:

Export CSV

Export JSON

Jika muncul:

“Failed to Export Data”

→ WAJIB diperbaiki

8.2 Filter & Sort

Cek:

Filter & sort sama seperti Transactions

Menggunakan logic yang sama

9. MODULE: Onboarding
9.1 Current Account Balance (WAJIB)

Setelah onboarding selesai:

User WAJIB mengisi Current Account Balance

Cek:

Tersimpan ke database

Digunakan sebagai saldo awal

Persist setelah logout/login

Jika hanya di local state → BUG

9.2 Jangan Ubah Flow Lain

Flow onboarding lain tidak boleh berubah

10. MODULE: Profile & Logout
10.1 Logout Logic

Cek:

Logout benar-benar clear session

Tidak meninggalkan state aneh

10.2 Profile Menu Content

Semua menu di Profile WAJIB BERFUNGSI:

Pusat Dukungan

Kebijakan Privasi

About FinFlow

Dan menu lain yang tampil

Tidak boleh placeholder / dead link

11. MODULE: Payment (Apple IAP)
11.1 Apple In-App Purchase

Cek:

Implementasi Apple IAP resmi

Tidak pakai payment provider lain

Package:

Trial 14 hari (full feature)

$2.99:

Unlimited chat

30 audio

30 scan OCR

$9.99:

Unlimited chat

Unlimited audio

Unlimited OCR

Premium Analytics

Export / Import

Upsell:

$99 / tahun (2 bulan free / diskon)

$29 / bulan

11.2 Subscription Management

Cek:

Paket aktif terlihat di:

Profile > Subscription

Bisa upgrade langsung dari sana

11.3 Package Layout

Cek UI:

Semua package 1 kolom (vertical)

Tidak ada layout kiri-kanan

12. MODULE: Notification
12.1 Notification System

Cek:

In-app notification

Email notification

Jika belum ada → implementasikan

PENUTUP (PENTING)

Instruksi ini bukan task list buta, melainkan:

Audit checklist

Gap-based execution

Zero redundant work

AI agent WAJIB membaca ini sebagai PRD audit, bukan sekadar prompt coding.

Kalau kamu mau, langkah berikutnya aku bisa:

Ubah ini jadi QA test case matrix

Atau jadi AI Coding Master Prompt v2 (Claude / Cursor / Copilot ready)

Baik, ini aku tambahkan sebagai ISSUE BARU yang TERPISAH dan FORMAL, supaya bisa langsung dimasukkan ke audit checklist / PRD addendum / AI coding prompt lanjutan tanpa mengganggu struktur sebelumnya.

Aku tulis dengan gaya “cek dulu → jika belum sesuai baru perbaiki” seperti yang kamu minta.

🔴 ISSUE BARU (DITEMUKAN SETELAH REVIEW LANJUTAN)
ISSUE 13 — GLOBAL: Currency Inconsistency (KRITIS)
Deskripsi Masalah

Masih ditemukan inkonsistensi mata uang di beberapa halaman:

User sudah memilih Rupiah (IDR) di setting

Namun di beberapa halaman:

Simbol masih $

Formatting masih mengikuti USD

Ini menandakan:

Ada hardcoded currency

Atau state currency tidak dipropagasikan secara global

Atau fallback default $ masih aktif di sebagian module

Instruksi Audit (WAJIB)

AI agent HARUS mengecek seluruh halaman, termasuk tapi tidak terbatas pada:

Home

Transactions (All / Income / Expenses)

Create Transaction (Manual)

Edit Transaction

OCR Result

Audio Log Result

Chat History

Analytics

AI Analytics

Export Preview (jika ada)

Profile / Subscription (jika menampilkan harga / nominal)

Expected Behavior (WAJIB)

Jika currency user = Rupiah (IDR):

Symbol: Rp

Thousand separator: .

Decimal: ,

Jika currency ≠ Rupiah:

Symbol sesuai currency

Thousand separator: ,

Decimal: .

⚠️ Tidak boleh ada satu pun halaman yang:

Masih menampilkan $

Atau format USD

Ketika setting user = Rupiah

Instruksi Eksekusi

Jika sudah konsisten → JANGAN DIUBAH

Jika ditemukan 1 saja halaman salah →
perbaiki source of truth currency & formatting secara global, bukan patch per halaman

ISSUE 14 — MODULE: AI Analytics — Export Error (BLOCKER)
Deskripsi Masalah

Saat melakukan Export di halaman AI Analytics:

Export CSV ❌

Export JSON ❌

Error yang muncul:

Export Error: Cannot read property 'UTF8' of Undefined

Analisis Awal (Bukan Asumsi, Tapi Indikasi)

Kemungkinan penyebab:

Encoding library tidak ter-load dengan benar

Reference ke UTF8 undefined

Salah penggunaan encoder (misalnya CSV / JSON serializer)

Environment mismatch (web vs mobile)

Dependency tidak ter-include saat build

⚠️ AI agent wajib memastikan root cause, bukan sekadar try-catch.

Instruksi Audit

Cek:

Logic export di AI Analytics (berbeda atau shared dengan Analytics biasa?)

Dependency encoding / file writer

Apakah:

CSV export

JSON export
memakai util yang sama atau berbeda

Expected Behavior

Export CSV → sukses, file valid, encoding aman (UTF-8)

Export JSON → sukses, JSON valid

Tidak ada error runtime

Tidak ada silent failure

Instruksi Eksekusi

Jika export sudah berhasil tanpa error → JANGAN DIUBAH

Jika error masih muncul →

Perbaiki encoding handling

Pastikan UTF8 reference tidak undefined

Tambahkan validasi sebelum export

📌 CATATAN PENTING UNTUK AI AGENT

Dua issue ini bersifat:

High Impact

User-facing

Merusak trust aplikasi finansial

⚠️ Currency inconsistency & export failure tidak boleh masuk production

🔴 ISSUE 15 — MODULE: Home — Font Size Income & Expense (ADJUSTMENT)
Deskripsi Masalah

Setelah penyesuaian sebelumnya, kini ditemukan bahwa:

Ukuran angka Income & Expense di halaman Home terlalu kecil

Mengurangi keterbacaan dan visual hierarchy

Ini berarti:

Adjustment sebelumnya overshoot

Perlu fine-tuning, bukan rollback total

Instruksi Audit (WAJIB)

AI agent harus mengecek:

Halaman: Home

Elemen:

Angka Income

Angka Expense

Cek apakah:

Terlalu kecil dibanding konteks visual

Tidak seimbang dengan elemen lain (label, card, padding)

Expected Behavior

Ukuran font angka ditambah ±20% dari ukuran saat ini

Tetap:

Tidak menabrak container

Tidak overflow

Tetap responsif di berbagai ukuran layar

Instruksi Eksekusi

Jika ukuran sudah proporsional & mudah dibaca → JANGAN DIUBAH

Jika terlalu kecil → naikkan ±20% dari current font size, bukan dari ukuran awal sebelum perubahan

⚠️ Fokus ke readability + layout balance, bukan angka absolut font-size.

🔴 ISSUE 16 — GLOBAL: Internationalization (i18n) Tidak Konsisten (KRITIS)
Deskripsi Masalah

Meskipun bahasa sudah diset ke Bahasa Indonesia, masih ditemukan:

Banyak teks berbahasa Inggris

Tersebar di berbagai halaman & modul

Ini menunjukkan:

Modul i18n tidak bekerja secara menyeluruh

Masih ada:

Hardcoded string

Missing translation key

Fallback ke English

Instruksi Audit (WAJIB & MENYELURUH)

AI agent HARUS mengecek semua teks UI tanpa terkecuali, termasuk tapi tidak terbatas pada:

Home

Transactions

Create / Edit Transaction

Chat

Audio Log

Scan Receipt

Analytics & AI Analytics

Export dialog / error message

Onboarding

Profile

Subscription / Payment

Notification

Empty state

Error state

Modal / Bottom Sheet

Button, label, helper text, tooltip

Expected Behavior (WAJIB)

Jika bahasa = Indonesia:

SEMUA teks UI tampil dalam Bahasa Indonesia

Tidak boleh ada:

Campuran English–Indonesia

Fallback English diam-diam

Hardcoded English string

Jika translation key belum tersedia:

WAJIB ditambahkan ke sistem i18n

Bukan dibiarkan tampil English

Instruksi Eksekusi

Jika teks sudah melalui i18n dan tampil sesuai → JANGAN DIUBAH

Jika ditemukan 1 saja teks English saat language = ID:

Refactor ke i18n

Tambahkan translation key

Pastikan key dipakai, bukan hardcoded

⚠️ Tidak ada pengecualian untuk i18n
Semua teks = i18n managed

📌 CATATAN PENTING

ISSUE 15 = UX fine-tuning

ISSUE 16 = GLOBAL QUALITY & TRUST ISSUE

Khusus ISSUE 16:

Aplikasi finansial tidak boleh multilingual setengah-setengah

Ini juga berdampak ke:

User trust

App Store review

Skalabilitas region lain

🔴 ISSUE 17 — MODULE: Scan Receipt — Entry Flow Tidak Sesuai
Deskripsi Masalah

Saat ini, ketika user memilih Scan Receipt dari berbagai entry point:

Home

Bottom Navbar (+)

Chat

Aplikasi langsung membuka kamera, tanpa memberi pilihan sumber gambar.

Padahal flow yang diharapkan:

User harus memilih terlebih dahulu:

Ambil foto dari Kamera

Pilih dari Gallery HP

Instruksi Audit (WAJIB)

AI agent HARUS mengecek seluruh entry point Scan Receipt, termasuk:

Home (button / shortcut)

Bottom Navbar → Add (+)

Chat (icon scanner)

Create Transaction flow (jika ada)

Cek apakah:

Semuanya mengarah ke flow yang sama

Tidak ada entry point yang bypass bottom sheet

Expected Behavior (WAJIB)

Untuk SEMUA entry point Scan Receipt:

Munculkan bottom sheet / modal pemilihan sumber:

Kamera

Gallery

Setelah user memilih:

Baru buka kamera atau

Buka gallery picker

Flow harus:

Konsisten

Reusable

Tidak tergantung halaman asal

⚠️ Tidak boleh ada perbedaan flow antar entry point.

Instruksi Eksekusi

Jika bottom sheet sudah muncul di semua entry point → JANGAN DIUBAH

Jika masih ada 1 entry point yang:

Langsung buka kamera

Melewati modal pemilihan

→ Refactor ke 1 shared Scan Receipt entry handler

Catatan Teknis (Arah, Bukan Asumsi)

Indikasi masalah biasanya karena:

Handler Scan Receipt langsung memanggil camera intent

Tidak lewat controller / service yang sama

Entry point berbeda memanggil function berbeda

Solusi yang benar:

Centralized Scan Receipt launcher

Semua entry point → satu function → satu bottom sheet

📌 POSISI ISSUE INI DALAM PRIORITAS

UX blocker ❌

Inkonsistensi flow ❌

Bertentangan dengan prinsip predictable UX

ISSUE 17 ini harus disejajarkan prioritasnya dengan:

Konsistensi modal audio & OCR

Bottom navbar add behavior

🔴 ISSUE 18 (MERGED) — GLOBAL: Authentication Token Lifecycle & Transaction Data Reload Failure (CLOSED)
Deskripsi Masalah

Ditemukan masalah kritis di mana:

User sudah login

Namun data transaksi tidak muncul / gagal reload

User terpaksa logout lalu login ulang agar data transaksi tampil normal

Setelah analisis lanjutan, masalah ini sangat kuat terindikasi berasal dari kegagalan token lifecycle, khususnya:

Access token expired terlalu cepat

Tidak ada / tidak konsisten auto refresh token

API request gagal (401) tetapi:

Tidak di-refresh

Tidak di-retry

Tidak memicu fetch ulang data

State transaksi menjadi stale / kosong

⚠️ Ini adalah bug arsitektural, bukan sekadar bug UI.

Dampak ke Aplikasi (KRITIS)

Data finansial user tampak “hilang”

Trust user turun drastis

User menganggap aplikasi tidak reliable

Tidak layak untuk production fintech / finance app

Instruksi Audit (WAJIB & MENYELURUH)

AI agent WAJIB melakukan audit end-to-end pada dua lapisan berikut:

A. Backend — Authentication & Token System

Cek dan pastikan:

Apakah sistem menggunakan:

Access token

Refresh token

Masa berlaku:

Access token (berapa menit?)

Refresh token (berapa hari?)

Apakah tersedia endpoint refresh token resmi

Apakah refresh token:

Valid

Tidak expired terlalu cepat

Bisa diperpanjang (rolling / rotation)

B. Frontend / Mobile App — Runtime Behavior

Cek apakah sudah ada:

Global API interceptor

Handling response 401 Unauthorized

Mekanisme:

Auto refresh token

Retry request setelah refresh sukses

Penyimpanan token:

Secure storage (bukan hanya memory/state)

Lifecycle app:

Login sukses → fetch transaksi langsung

App reopen (user masih login) → fetch ulang transaksi

Expected Behavior (WAJIB)
1. Token Strategy (Best Practice Mobile)

Access Token

Short-lived (±15–30 menit)

Digunakan untuk semua API bisnis

Refresh Token

Long-lived (±14–30 hari atau rolling)

Hanya untuk mendapatkan access token baru

2. Runtime Flow (KRITIS)

Saat access token expired:

API request mengembalikan 401

Interceptor otomatis:

Call refresh token

Mendapatkan access token baru

Request awal diulang otomatis

Data transaksi tampil normal

Tanpa logout

Tanpa interaksi user

3. Login & App Resume Behavior

Setelah login sukses:

Transaksi langsung ter-fetch

Saat app dibuka ulang (token masih valid):

Transaksi tetap muncul

User tidak pernah diwajibkan logout → login ulang hanya untuk refresh data

4. Logout Behavior

Logout hanya terjadi jika:

Refresh token invalid / expired

Refresh gagal berulang

Access token expired TIDAK BOLEH langsung memicu logout

Instruksi Eksekusi

Jika seluruh behavior di atas sudah berjalan stabil → JANGAN DIUBAH

Jika ditemukan salah satu dari kondisi berikut:

Token expired tanpa refresh

401 tidak di-handle

Request gagal tanpa retry

Data transaksi kosong setelah login

→ WAJIB memperbaiki token lifecycle & data fetch flow

⚠️ Dilarang:

Menyiasati dengan tombol refresh manual

Memperpanjang access token ekstrem tanpa refresh token