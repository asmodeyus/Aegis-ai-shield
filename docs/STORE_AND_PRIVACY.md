# AEGIS-AI Shield v3.2.4 — Privacy Policy & Chrome Web Store Listing Draft

---

## 1. Privacy Policy (Draft untuk Chrome Web Store)

**Terakhir diperbarui:** v3.2.4  
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
**AEGIS-AI Shield v3.2.4** melindungi aktivitas browsing Anda dari redirect paksa, popup iklan terselubung, modal pemblokir Adblock (*anti-anti-adblock*), pembajakan klik pada pemutar video (*video-tap hijack*), dan pengalihan paksa ke mesin pencari (*search hijack*), tanpa mengganggu proses login OAuth/SSO modern maupun pencarian langsung dari bilah alamat browser.

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

Sebelum mengunggah paket **`aegis-ai-shield-v3.2.4-store.zip`** ke Chrome Web Store, pastikan hal-hal berikut ditinjau:
1. **Paket Store vs Dev:** Selalu unggah `aegis-ai-shield-v3.2.4-store.zip` (hasil `npm run build:ext:store`) yang **tidak** berisi properti `"key"` di `manifest.json` dan **tidak** meminta izin `"tabs"`.
2. **Fitur Opt-In yang Perlu Tinjauan Kebijakan Store:**
   - **Auto-Klik & Submit Shortlink (`shortlinkAutoClick`, default `false`):** Fitur otomasi klik pada halaman pihak ketiga dapat ditinjau ketat di bawah kebijakan *Chrome Web Store Spam / Automated Behavior / Circumvention*. Pastikan tetap opt-in atau pertimbangkan menghapusnya dari varian Store apabila reviewer menolak perilaku auto-click.
   - **Auto-Skip Countdown / Timer Acceleration (`autoSkipCountdown`, default `false`):** Modifikasi `setTimeout`/`setInterval` pada situs pihak ketiga juga bersifat opt-in dengan konfirmasi risiko eksplisit. Dokumentasikan dengan jelas di *Reviewer Notes* bahwa fitur ini nonaktif secara default dan hanya diaktifkan oleh pengguna.
3. **Host Permissions Justification:** Siapkan penjelasan di dashboard CWS bahwa `http://*/*` dan `https://*/*` diperlukan untuk inspeksi redirect lintas-domain, pencegahan video-tap hijack, dan pil kontrol video di sembarang situs yang dikunjungi pengguna.

---

## 4. Changelog v3.2.4, v3.2.3 & v3.2.2

### Perbaikan v3.2.4 (Fix False-Positive Pencarian Omnibox di `onBeforeNavigate`)
- **Fix `BLOCK_BEFORE_NAV_SUSPICIOUS` pada Pencarian Bilah Alamat (Mode Strict & Balanced):** `chrome.webNavigation.onBeforeNavigate` tidak memiliki `transitionType`/`transitionQualifiers`, sehingga sebelumnya pencarian langsung dari Chrome Omnibox (`sourceid=chrome-mobile&source=chrome.ob` maupun pencarian Google/Bing/DuckDuckGo/Yahoo/Yandex lainnya) ikut ditahan sebelum `onCommitted` sempat memverifikasi transisi `generated` / `from_address_bar`. Kini `evaluateBeforeNavigateGuard` mendelegasikan URL mesin pencari bersih, TLD generik, dan situs umum ke `onCommitted` agar pencarian Omnibox, pengetikan URL, bookmark, serta tombol Back/Forward berjalan mulus — sementara Blacklist, domain judi, jaringan iklan eksplisit, arbitrase (`clickid=`), dan tautan `/4/<hex>` tetap diblokir seketika dan pembajakan search dari halaman tetap ditahan di `main_world.js`, `click-guard.js`, dan `onCommitted`.
- **Reset Loop Lock pada Navigasi Omnibox:** `onCommitted` kini mengevaluasi transisi eksternal/Omnibox sebelum batas `lockedUntil` sehingga pencarian baru dari bilah alamat langsung mereset state tab dengan bersih.

### Pembaruan v3.2.3 (Anti-Anti-Adblock Modal)
- **Kontrol Popup Anti-Anti-Adblock:** Menambahkan toggle khusus **Anti-Anti-Adblock** pada tab Setting (default `ON`, tersinkronisasi antara `popup.html`, `content.js`, dan `main_world.js` untuk netralisasi modal overlay dan probe `fetch`).
- **Detektor Modal Modular & Aman:** Menambahkan `src/ext/shared/anti-adblock.js` dan `src/ext/content/anti-adblock.js` untuk menutup modal deteksi Adblock (termasuk AntiAdBlock Core ber-ID acak seperti `#ne8e5602d` / `antiadblockcore.com`), memulihkan kunci scroll (`overflow: hidden`) saat overlay ditutup, serta otomatis berhenti saat situs masuk **Whitelist**, **Safe Mode (Temp-Allow)**, atau **CAPTCHA**. Tidak menutup form login, GDPR/cookie banner, dialog pembayaran, atau pemutar video.
- **Refaktor Gate Terpusat:** Menyatukan pemeriksaan `isSiteShieldBypassed()` di `src/ext/content/state.js` dan menjaga alur shortlink/DropLink (`adl22-flow-heartbeat-v220`) tetap utuh tanpa regresi.

### Perbaikan v3.2.2 (Pil Video & Drawer Daftar Stream)
- **Fix Bug Tap Pil Memicu Fullscreen (`#vpFs`):** Memindahkan toggle `🎬(N)` ke event `click` (setelah `position-manager.js` menunda `setPointerCapture` hanya saat drag melebihi threshold), menambahkan cooldown klik tombol aksi `350ms` (`shouldAcceptPillActionClick`), dan memakai `flex-direction: row-reverse` pada mode RTL sehingga `🎬(N)` tetap jangkar di kanan dan `#vpFs` tidak pernah tertindih tap awal.
- **Fix Bug Daftar Stream Video Kosong (`#vpList`):** Membuka drawer kini menghentikan timer auto-dim (`clearTimeout(videoDimTimer)`) serta mempertahankan `videoDockDimmed = false`, menyetel reset CSS inherited pada `:host`, membungkus `.stream-lbl` (`flex: 1; min-width: 0; display: block`) dengan `formatVideoStreamLabel` agar host + ID embed tampil terbaca, serta menyinkronkan posisi `column-reverse` dekat tepi atas viewport.

### Security & Anti-Hijack (v3.2.1)
- **Video-Tap Hijack Fix (Lemur Android / Chromium Balanced Mode):** Memisahkan timestamp sentuhan `<video>`/`<audio>` dari klik tautan nyata; mencegah `Navigation API` (`event.userInitiated`) meloloskan redirect iklan sekali-sentuh pada elemen `<video>` (termasuk pola direct-link `/4/<hex>` seperti `asiafilm.org/4/...`); menonaktifkan pelemparan balik paksa (`forceRevertTab`) pada tap video tunggal.
- **P1 — Filter Judol Presisi:** Memecah regex judi menjadi daftar spesifik (substring hostname) dan ambigu (token utuh per label hostname yang dipisah `.`/`-`/`_`, tidak lagi memicu path/query seperti `smartphone`, `startpage.com`, `judiciary.gov`, `bandara`, `pragmaticengineer.com`, `depositphotos.com`).
- **P2 — Fix OAuth Login Blocking:** Menghapus `redirect` telanjang dari `SEARCH_ARBITRAGE_PARAMS` (agar `redirect_uri=`/`redirect_url=`/`redirect_to=` aman) dan mengevaluasi alur OAuth/IdP sah (Google, Microsoft, GitHub, Discord) sebelum pemeriksaan generik/affiliate/TLD di `main_world.js`, `content.js`, dan `background.js`.
- **P3 — Bridge & HUD Anti-Spoof Hardening:** Seluruh event `main_world -> content` diperlakukan sebagai hint tidak tepercaya dan diklasifikasi ulang di isolated world; Shadow DOM HUD & Video Dock kini `mode: "closed"`; tombol HUD mewajibkan `ev.isTrusted`; `↗ Buka Sekali` menjadi aksi utama dan `✓ Trust` memakai konfirmasi 2-langkah dengan domain penuh; rate limit per-menit & per-halaman untuk HUD/Video Dock/log.
- **P4 — Manifest, Icons, & Build Split:** Menghapus izin `"tabs"` yang tidak dibutuhkan; menambahkan `"minimum_chrome_version": "111"`; memisahkan build `dev` (dengan `"key"`) dan `store` (tanpa `"key"`); membuat ikon sederhana tajam `16px`, `32px`, `48px` senada `icon.png`; menambahkan sanitasi/pengecekan anti-`_aistudio-iframe.js` saat build.
- **P5 — Privasi Gemini & Penyimpanan Key:** Audit Gemini kini **opt-in** (`geminiAuditEnabled: false`), `sessionOnlyApiKey` default `true`, peringatan penyimpanan tidak terenkripsi saat memilih mode permanen, pengungkapan data eksplisit di popup, dan koreksi label "Zero Telemetry".
- **P6 — Optimasi Performa Timer Hook:** Menambahkan cache deteksi countdown (~500ms TTL), mempersempit selector DOM & regex batas kata (`\b`, tidak lagi cocok dengan `"discount"`/`"account"`), serta bail-out cepat pada halaman non-video/non-shortlink.
- **P7 — Default Netral & Kepatuhan Store:** Mengosongkan `DEFAULT_TRUSTED_DOMAINS = []`, merampingkan `SAFE_MEDIA_HOST_REGEX`, serta menjadikan `shortlinkAutoClick` dan `autoSkipCountdown` default `false` dengan konfirmasi opt-in inline.
- **P8 — Hardening Restore Backup:** `migrateExtensionStorage` dan `sanitizeGlobalSettings` memfilter hanya key yang dikenal, memvalidasi tipe/enum/rentang slider, membersihkan `hudPositions`, dan membatasi ukuran daftar (`denied <= 5000`, `trusted <= 2000`) dengan kompatibilitas penuh backup v2.2.7–v3.2.0.
