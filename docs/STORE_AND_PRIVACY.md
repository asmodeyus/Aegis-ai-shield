# AEGIS-AI Shield v3.2.1 — Privacy Policy & Chrome Web Store Listing Draft

---

## 1. Privacy Policy (Draft untuk Chrome Web Store)

**Terakhir diperbarui:** v3.2.1  
**Pengembang:** AEGIS-AI Shield

### Ringkasan Singkat
AEGIS-AI Shield dirancang dengan prinsip **local-first**: seluruh pemblokiran redirect, pencegahan video-tap hijack, aturan Blacklist/Whitelist, dan statistik penghitung berjalan secara lokal di browser Anda. **Tidak ada telemetri, analitik, atau data pengguna yang dikirim ke server pengembang.**

### Data yang Diproses Secara Lokal (Tidak Meninggalkan Browser)
- **Daftar Domain & Pengaturan (`chrome.storage.local`):** Blacklist (`deniedDomains`), Whitelist (`trustedDomains`), konfigurasi tampilan HUD/Pil Video (`globalSettings`), posisi geser (`hudPositions`), statistik lokal (`aegisStats`), dan log diagnostik (`aegisLogs`, dapat dihapus kapan saja).
- **Safe Mode Sementara (`chrome.storage.session` / fallback `local`):** Domain dan waktu kedaluwarsa jeda sementara (15 menit / 1 jam).
- **Gemini API Key (Opsional):** Jika pengguna memasukkan kunci API Gemini pribadi, secara default kunci disimpan di `chrome.storage.session` (otomatis terhapus saat browser ditutup). Jika pengguna secara eksplisit menonaktifkan opsi *Sesi Ini Saja*, kunci disimpan di `chrome.storage.local` (tanpa enkripsi bawaan Chrome pada profil lokal) dengan peringatan eksplisit di antarmuka popup. Content script dan halaman web **tidak pernah** memiliki akses ke kunci API ini.

### Data yang Dikirim ke Pihak Ketiga (Hanya Jika Diaktifkan / Opt-In)
AEGIS-AI Shield **tidak mengirim data apa pun ke layanan eksternal secara default**.

Pengiriman data ke pihak ketiga **hanya** terjadi apabila pengguna secara manual:
1. Mengaktifkan tombol opt-in **Audit Tombol via Gemini API**, **dan**
2. Memasukkan Gemini API Key miliknya sendiri.

Ketika fitur opt-in tersebut aktif pada halaman yang memenuhi kriteria audit, ekstensi mengirimkan permintaan langsung dari background service worker ke endpoint resmi Google (`https://generativelanguage.googleapis.com`) menggunakan header `x-goog-api-key` dengan payload terbatas berikut:
- Judul halaman (`document.title`, dipotong maksimal 120 karakter)
- `origin + pathname` halaman aktif (**tanpa** query string, hash, cookie, atau token)
- Daftar ringkas tombol/tautan kandidat pada halaman (teks tombol, atribut `href` yang telah dibersihkan, `id`, dan `class`)

Penggunaan Google Gemini API tunduk pada [Google API Terms of Service](https://developers.google.com/terms) dan [Google Privacy Policy](https://policies.google.com/privacy). Pengembang AEGIS-AI Shield tidak pernah menerima, menyimpan, atau melihat API Key maupun payload tersebut.

### Izin Ekstensi (Permissions)
- `storage`: Menyimpan pengaturan lokal, Blacklist/Whitelist, dan log diagnostik.
- `webNavigation`: Mendeteksi perpindahan tab/redirect lintas-domain otomatis dan multi-hop redirect chain.
- `declarativeNetRequest`: Menerapkan aturan pemblokiran jaringan secara lokal untuk domain di Blacklist pengguna.
- `host_permissions` (`http://*/*`, `https://*/*`): Diperlukan agar pelindung redirect, deteksi video-tap hijack, dan pil kontrol video dapat bekerja pada situs web yang dikunjungi pengguna.

---

## 2. Deskripsi Chrome Web Store (Draft)

### Ringkasan Singkat (<= 132 karakter)
Pelindung anti-redirect, anti-popup, video-tap hijack, search-hijack, blacklist DNR, & pil kontrol video dengan desain ramah OAuth.

### Deskripsi Lengkap
**AEGIS-AI Shield v3.2.1** melindungi aktivitas browsing Anda dari redirect paksa, popup iklan terselubung, pembajakan klik pada pemutar video (*video-tap hijack*), dan pengalihan paksa ke mesin pencari (*search hijack*), tanpa mengganggu proses login OAuth/SSO modern.

**Fitur Utama:**
- **Anti-Redirect & Video-Tap Hijack Shield:** Menahan redirect lintas-domain tanpa interaksi sah dan mencegah klik pada elemen `<video>` melempar Anda ke tautan iklan.
- **Ramah OAuth & Mode Balanced/Strict:** Alur login Google, Microsoft, GitHub, dan Discord ditangani dengan aman pada mode *Balanced*; mode *Strict* tersedia bagi pengguna yang ingin menahan seluruh perpindahan lintas-domain.
- **HUD Konfirmasi Aman 2-Langkah:** Aksi utama adalah **Buka Sekali**; penambahan permanen ke Whitelist (*Trust*) memerlukan konfirmasi kedua yang menampilkan domain target penuh.
- **Filter Presisi & Blacklist DNR Wildcard:** Mendukung pemblokiran tingkat jaringan berbasis `declarativeNetRequest` (terkonsolidasi hingga 150 domain/rule + wildcard) dengan Whitelist awal kosong (netral).
- **CAPTCHA Guard Pulih Otomatis:** Menghentikan intervensi agresif sementara saat CAPTCHA/Turnstile/hCaptcha aktif, dan pulih otomatis setelah selesai.
- **Pil Kontrol Video & Mini PiP:** Kontrol cepat putar/jeda, daftar stream video, fullscreen, dan Mini Picture-in-Picture.
- **Audit Tombol AI Opsional (Opt-In):** Default nonaktif; dapat diaktifkan dengan Gemini API Key pribadi (tersimpan di `chrome.storage.session` secara default).

---

## 3. Catatan Kepatuhan Chrome Web Store (Wajib Review Sebelum Publish — P7)

Sebelum mengunggah paket **`aegis-ai-shield-v3.2.1-store.zip`** ke Chrome Web Store, pastikan hal-hal berikut ditinjau:
1. **Paket Store vs Dev:** Selalu unggah `aegis-ai-shield-v3.2.1-store.zip` (hasil `npm run build:ext:store`) yang **tidak** berisi properti `"key"` di `manifest.json` dan **tidak** meminta izin `"tabs"`.
2. **Fitur Opt-In yang Perlu Tinjauan Kebijakan Store:**
   - **Auto-Klik & Submit Shortlink (`shortlinkAutoClick`, default `false`):** Fitur otomasi klik pada halaman pihak ketiga dapat ditinjau ketat di bawah kebijakan *Chrome Web Store Spam / Automated Behavior / Circumvention*. Pastikan tetap opt-in atau pertimbangkan menghapusnya dari varian Store apabila reviewer menolak perilaku auto-click.
   - **Auto-Skip Countdown / Timer Acceleration (`autoSkipCountdown`, default `false`):** Modifikasi `setTimeout`/`setInterval` pada situs pihak ketiga juga bersifat opt-in dengan konfirmasi risiko eksplisit. Dokumentasikan dengan jelas di *Reviewer Notes* bahwa fitur ini nonaktif secara default dan hanya diaktifkan oleh pengguna.
3. **Host Permissions Justification:** Siapkan penjelasan di dashboard CWS bahwa `http://*/*` dan `https://*/*` diperlukan untuk inspeksi redirect lintas-domain, pencegahan video-tap hijack, dan pil kontrol video di sembarang situs yang dikunjungi pengguna.

---

## 4. Changelog v3.2.1

### Security & Anti-Hijack
- **Video-Tap Hijack Fix (Lemur Android / Chromium Balanced Mode):** Memisahkan timestamp sentuhan `<video>`/`<audio>` dari klik tautan nyata; mencegah `Navigation API` (`event.userInitiated`) meloloskan redirect iklan sekali-sentuh pada elemen `<video>` (termasuk pola direct-link `/4/<hex>` seperti `asiafilm.org/4/...`); menonaktifkan pelemparan balik paksa (`forceRevertTab`) pada tap video tunggal.
- **P1 — Filter Judol Presisi:** Memecah regex judi menjadi daftar spesifik (substring hostname) dan ambigu (token utuh per label hostname yang dipisah `.`/`-`/`_`, tidak lagi memicu path/query seperti `smartphone`, `startpage.com`, `judiciary.gov`, `bandara`, `pragmaticengineer.com`, `depositphotos.com`).
- **P2 — Fix OAuth Login Blocking:** Menghapus `redirect` telanjang dari `SEARCH_ARBITRAGE_PARAMS` (agar `redirect_uri=`/`redirect_url=`/`redirect_to=` aman) dan mengevaluasi alur OAuth/IdP sah (Google, Microsoft, GitHub, Discord) sebelum pemeriksaan generik/affiliate/TLD di `main_world.js`, `content.js`, dan `background.js`.
- **P3 — Bridge & HUD Anti-Spoof Hardening:** Seluruh event `main_world -> content` diperlakukan sebagai hint tidak tepercaya dan diklasifikasi ulang di isolated world; Shadow DOM HUD & Video Dock kini `mode: "closed"`; tombol HUD mewajibkan `ev.isTrusted`; `↗ Buka Sekali` menjadi aksi utama dan `✓ Trust` memakai konfirmasi 2-langkah dengan domain penuh; rate limit per-menit & per-halaman untuk HUD/Video Dock/log.
- **P4 — Manifest, Icons, & Build Split:** Menghapus izin `"tabs"` yang tidak dibutuhkan; menambahkan `"minimum_chrome_version": "111"`; memisahkan build `dev` (dengan `"key"`) dan `store` (tanpa `"key"`); membuat ikon sederhana tajam `16px`, `32px`, `48px` senada `icon.png`; menambahkan sanitasi/pengecekan anti-`_aistudio-iframe.js` saat build.
- **P5 — Privasi Gemini & Penyimpanan Key:** Audit Gemini kini **opt-in** (`geminiAuditEnabled: false`), `sessionOnlyApiKey` default `true`, peringatan penyimpanan tidak terenkripsi saat memilih mode permanen, pengungkapan data eksplisit di popup, dan koreksi label "Zero Telemetry".
- **P6 — Optimasi Performa Timer Hook:** Menambahkan cache deteksi countdown (~500ms TTL), mempersempit selector DOM & regex batas kata (`\b`, tidak lagi cocok dengan `"discount"`/`"account"`), serta bail-out cepat pada halaman non-video/non-shortlink.
- **P7 — Default Netral & Kepatuhan Store:** Mengosongkan `DEFAULT_TRUSTED_DOMAINS = []`, merampingkan `SAFE_MEDIA_HOST_REGEX`, serta menjadikan `shortlinkAutoClick` dan `autoSkipCountdown` default `false` dengan konfirmasi opt-in inline.
- **P8 — Hardening Restore Backup:** `migrateExtensionStorage` dan `sanitizeGlobalSettings` memfilter hanya key yang dikenal, memvalidasi tipe/enum/rentang slider, membersihkan `hudPositions`, dan membatasi ukuran daftar (`denied <= 5000`, `trusted <= 2000`) dengan kompatibilitas penuh backup v2.2.7–v3.2.0.
