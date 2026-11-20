import React, { useEffect, useState } from 'react';
import { Download, RotateCcw, CheckCircle2, PackageCheck } from 'lucide-react';
import { AllHudPositions, DEFAULT_HUD_POSITIONS } from './utils/hudPositionMath';
import {
  AegisLogEntry,
  DEFAULT_TRUSTED_COMMUNITY_DOMAINS,
} from './utils/shortlinkBypassEngine';
import { buildZipArchive } from './utils/zipBuilder';
import { GlobalSettingsState, InteractiveHudSandbox } from './components/InteractiveHudSandbox';
import { PopupSimulator } from './components/PopupSimulator';
import { SourceCodeInspector } from './components/SourceCodeInspector';

const STORAGE_KEY_POSITIONS = 'aegis_v221_hud_positions';
const STORAGE_KEY_SETTINGS = 'aegis_v221_global_settings';

const DEFAULT_GLOBAL_SETTINGS: GlobalSettingsState = {
  hudEnabled: true,
  hudDurationSec: 4.5,
  hudPosition: 'top-center',
  hudOpacity: 0.95,
  hudScale: 1.0,
  hudShowTrust: true,
  hudShowGroup: true,
  hudShowOpen: true,
  hudShowBlock: true,
  hudShowUrlDetail: true,
  videoDockEnabled: true,
  videoDockDimSec: 2.5,
  videoDockExpandDir: 'auto',
  videoPillScale: 1.0,
  videoPillOpacity: 0.95,
  videoPillShowPlayPause: true,
  videoPillShowList: true,
  videoPillShowDownload: true,
  videoPillShowPip: true,
  videoPillShowFullscreen: true,
  pipSize: 'medium',
  pipOpacity: 0.95,
  adSkipSpeed: '16',
  smartUgcSense: true,
  shortlinkBypassEnabled: true,
  shortlinkAutoClick: true,
  loggingEnabled: true,
  removeTransparentOverlay: true,
  antiHistoryTrap: true,
  dnrEnabled: true,
  redirectWindowSec: 3.5,
};

const INITIAL_DENIED_DOMAINS = ['hai8g.com', 'maxwin-zeus88.cfd', 'shope.ee'];
const INITIAL_TRUSTED_DOMAINS = [
  ...DEFAULT_TRUSTED_COMMUNITY_DOMAINS,
  'drive.google.com',
  'github.com',
];

const INITIAL_DIAGNOSTIC_LOGS: AegisLogEntry[] = [
  {
    id: 'seed-1',
    ts: Date.now() - 45000,
    level: 'BYPASS',
    source: 'content',
    code: 'BYPASS_QUERY_BASE64',
    fromUrl: 'https://safelink-blogger.example.net/?go=aHR0cHM6Ly9kcml2ZS5nb29nbGUuY29tL2ZpbGUvZC8xMjM=',
    toUrl: 'https://drive.google.com/file/d/123',
    detail: 'Bypass Shortlink Debloated mengekstrak URL tujuan langsung (QUERY_BASE64)',
  },
  {
    id: 'seed-2',
    ts: Date.now() - 32000,
    level: 'BYPASS',
    source: 'main_world',
    code: 'BYPASS_ANTI_ADBLOCK_FETCH',
    fromUrl: 'https://go.short-redirect.net/step-2',
    toUrl: 'https://js.wpadmngr.com/?t=1732100000',
    detail: 'Probe anti-adblock fetch(no-cors) dinetralkan -> respons 200 OK palsu',
  },
  {
    id: 'seed-3',
    ts: Date.now() - 18000,
    level: 'ALLOW',
    source: 'background',
    code: 'ALLOW_SHORTLINK_302',
    fromUrl: 'https://go.short-redirect.net/?download=1&t=498109fe',
    toUrl: 'https://files.example-cdn.org/video/episode.mp4',
    detail: 'HTTP 302 dari tombol CTA shortlink diizinkan (transition=link, qualifiers=server_redirect)',
  },
  {
    id: 'seed-4',
    ts: Date.now() - 8000,
    level: 'BLOCK',
    source: 'background',
    code: 'BLOCK_RAPID_REDIRECT_REVERT',
    fromUrl: 'https://short.example.net/wait',
    toUrl: 'https://promo-gacor88.top/spin?clickid=99',
    detail: 'Revert -> https://short.example.net/wait | reason=suspicious_url | transition=link | qualifiers=client_redirect | elapsed=420ms | shortlinkGrace=false',
  },
];

export default function App() {
  const [hudPositions, setHudPositions] = useState<AllHudPositions>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_POSITIONS);
      if (raw) {
        return { ...DEFAULT_HUD_POSITIONS, ...JSON.parse(raw) };
      }
    } catch {
      // ignore storage error
    }
    return { ...DEFAULT_HUD_POSITIONS };
  });

  const [globalSettings, setGlobalSettings] = useState<GlobalSettingsState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (raw) {
        return { ...DEFAULT_GLOBAL_SETTINGS, ...JSON.parse(raw) };
      }
    } catch {
      // ignore storage error
    }
    return { ...DEFAULT_GLOBAL_SETTINGS };
  });

  const [trustedDomains, setTrustedDomains] = useState<string[]>(INITIAL_TRUSTED_DOMAINS);
  const [deniedDomains, setDeniedDomains] = useState<string[]>(INITIAL_DENIED_DOMAINS);
  const [diagnosticLogs, setDiagnosticLogs] = useState<AegisLogEntry[]>(INITIAL_DIAGNOSTIC_LOGS);
  const [zipStatus, setZipStatus] = useState<string>(
    'Paket aegis-ai-shield-v2.2.7.zip siap diunduh (7 berkas ekstensi lengkap).'
  );
  const [isBuildingZip, setIsBuildingZip] = useState(false);

  const handleAppendLog = (entry: Omit<AegisLogEntry, 'id' | 'ts'>) => {
    if (globalSettings.loggingEnabled === false) return;
    setDiagnosticLogs((prev) => [
      {
        ...entry,
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ts: Date.now(),
      },
      ...prev.slice(0, 119),
    ]);
  };

  const handleClearLogs = () => {
    setDiagnosticLogs([]);
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(hudPositions));
    } catch {
      // ignore storage error
    }
  }, [hudPositions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(globalSettings));
    } catch {
      // ignore storage error
    }
  }, [globalSettings]);

  const handleUpdateHudPosition = (
    key: keyof AllHudPositions,
    coord: AllHudPositions[keyof AllHudPositions]
  ) => {
    setHudPositions((prev) => ({
      ...prev,
      [key]: coord,
    }));
  };

  const handleResetAllPositions = () => {
    setHudPositions({ ...DEFAULT_HUD_POSITIONS });
  };

  const handleResetGlobalSettings = () => {
    setGlobalSettings({ ...DEFAULT_GLOBAL_SETTINGS });
    setHudPositions({ ...DEFAULT_HUD_POSITIONS });
  };

  const handleDownloadUpdatedZip = async () => {
    setIsBuildingZip(true);
    try {
      const fileNames = [
        'manifest.json',
        'background.js',
        'content.js',
        'main_world.js',
        'popup.html',
        'popup.js',
        'icon.png',
      ];
      const entries = await Promise.all(
        fileNames.map(async (name) => {
          const res = await fetch(`/extension-v2.1.6/${name}`);
          const buf = await res.arrayBuffer();
          return {
            name,
            data: new Uint8Array(buf),
          };
        })
      );

      const zipBytes = buildZipArchive(entries);
      const blob = new Blob([zipBytes.buffer as ArrayBuffer], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'aegis-ai-shield-v2.2.7.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);

      setZipStatus(
        `Berhasil mengunduh aegis-ai-shield-v2.2.7.zip (${(zipBytes.length / 1024).toFixed(1)} KB · 7 berkas).`
      );
    } catch {
      const a = document.createElement('a');
      a.href = '/aegis-ai-shield-v2.2.7.zip';
      a.download = 'aegis-ai-shield-v2.2.7.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setZipStatus('Mengunduh paket aegis-ai-shield-v2.2.7.zip...');
    } finally {
      setIsBuildingZip(false);
    }
  };

  const customHudCount = [
    hudPositions.topHud,
    hudPositions.videoDock,
    hudPositions.miniPip,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800/90 bg-slate-950/90 sticky top-0 z-40 backdrop-blur-md">
        <a
          href="#top"
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          AEGIS-AI Shield
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <a
            href="#simulator"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Simulasi HUD
          </a>
          <a
            href="#package"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Paket ZIP v2.2.7
          </a>
          <a
            href="#evaluation"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Refactoring & Keamanan
          </a>
          <a
            href="#source"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Kode Sumber
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDownloadUpdatedZip}
            disabled={isBuildingZip}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-emerald-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {isBuildingZip ? 'Mempaketkan ZIP...' : 'Unduh ZIP v2.2.7'}
          </button>
        </div>
      </header>

      <main id="top" className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-8 space-y-10">
        {/* Release Overview & Direct ZIP Download Section */}
        <section
          id="package"
          className="border border-slate-800 bg-slate-900/75 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6"
        >
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-emerald-400 font-semibold">Rilis Pembaruan v2.2.7</span>
              <span aria-hidden="true">·</span>
              <span>Refactoring MV3 & Zero Memory Leak</span>
              <span aria-hidden="true">·</span>
              <span>Gemini Header Auth & Toast Bypass</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight text-balance">
              Refactoring Performa, Keamanan Gemini API, & Toast Bypass Shortlink (v2.2.7)
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              Versi <strong className="text-white">2.2.7</strong> menyempurnakan arsitektur
              Manifest V3 tanpa menghapus fitur v2.2.6 (Log Diagnostik Copy-Paste, Bypass All
              Shortlinks Debloated, HTTP 302 CTA Grace, Floating Video Pill, &amp; Mini PiP):
              memperbaiki <em>memory leak</em> drag Pil Video via{' '}
              <code className="text-sky-300">setPointerCapture</code>, menghapus{' '}
              <code className="text-rose-300">nukeTimers()</code> agar buffer HLS/DASH tetap aman,
              memindahkan <code className="text-emerald-300">x-goog-api-key</code> ke HTTP Header +
              parsing JSON aman + <em>smart fallback</em> kuota, menambahkan{' '}
              <em>debounce</em> DNR 350ms &amp; pembersihan <code className="text-sky-300">tabHistory</code>,
              memindahkan domain komunitas ke default Whitelist (<strong>Trust</strong>), serta
              menampilkan Toast singkat saat melompati Safelink.
            </p>

            <div className="pt-1 flex items-center gap-2 text-xs text-emerald-300">
              <PackageCheck className="w-4 h-4 shrink-0" />
              <span>{zipStatus}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <button
              type="button"
              onClick={handleDownloadUpdatedZip}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Unduh aegis-ai-shield-v2.2.7.zip
            </button>

            <a
              href="/aegis-ai-shield-v2.2.7.zip"
              download="aegis-ai-shield-v2.2.7.zip"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors whitespace-nowrap text-center"
            >
              Tautan Langsung ZIP Statis v2.2.7
            </a>
          </div>
        </section>

        {/* Interactive HUD Layout Sandbox + Live Popup v2.2.7 Preview */}
        <section id="simulator" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">
                01. Studio Tata Letak HUD Interaktif & Pratinjau Popup v2.2.7
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Uji 7 skenario logika v2.2.7 (termasuk Toast Bypass Shortlink Debloated &amp; default
                Whitelist komunitas di tab <strong>✅ Trust</strong>) lalu lihat tab{' '}
                <strong>📋 Log</strong> di popup kanan.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-300">
              <span className="font-mono tabular-nums">
                HUD Kustom Aktif: <strong className="text-emerald-400">{customHudCount} / 3</strong>
              </span>
              {customHudCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetAllPositions}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-xs font-medium cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Semua
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8">
              <InteractiveHudSandbox
                hudPositions={hudPositions}
                onUpdateHudPosition={handleUpdateHudPosition}
                onResetAllPositions={handleResetAllPositions}
                globalSettings={globalSettings}
                onUpdateGlobalSettings={setGlobalSettings}
                trustedDomains={trustedDomains}
                deniedDomains={deniedDomains}
                onTrustDomain={(dom) => {
                  if (!trustedDomains.includes(dom)) {
                    setTrustedDomains((prev) => [...prev, dom]);
                  }
                  setDeniedDomains((prev) => prev.filter((d) => d !== dom));
                }}
                onBlockDomain={(dom) => {
                  if (!deniedDomains.includes(dom)) {
                    setDeniedDomains((prev) => [...prev, dom]);
                  }
                  setTrustedDomains((prev) => prev.filter((d) => d !== dom));
                }}
                onAppendLog={handleAppendLog}
              />
            </div>

            <div className="lg:col-span-4 flex justify-center">
              <PopupSimulator
                hudPositions={hudPositions}
                onResetHudPosition={(key) => handleUpdateHudPosition(key, null)}
                onResetAllPositions={handleResetAllPositions}
                globalSettings={globalSettings}
                onUpdateGlobalSettings={setGlobalSettings}
                onResetGlobalSettings={handleResetGlobalSettings}
                trustedDomains={trustedDomains}
                deniedDomains={deniedDomains}
                onAddTrusted={(dom) => {
                  if (!trustedDomains.includes(dom)) setTrustedDomains((prev) => [...prev, dom]);
                  setDeniedDomains((prev) => prev.filter((d) => d !== dom));
                }}
                onRemoveTrusted={(dom) =>
                  setTrustedDomains((prev) => prev.filter((d) => d !== dom))
                }
                onAddDenied={(dom) => {
                  if (!deniedDomains.includes(dom)) setDeniedDomains((prev) => [...prev, dom]);
                  setTrustedDomains((prev) => prev.filter((d) => d !== dom));
                }}
                onRemoveDenied={(dom) =>
                  setDeniedDomains((prev) => prev.filter((d) => d !== dom))
                }
                diagnosticLogs={diagnosticLogs}
                onClearLogs={handleClearLogs}
              />
            </div>
          </div>
        </section>

        {/* Ringkasan 7 Perbaikan Teknis & Optimasi v2.2.7 */}
        <section id="evaluation" className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-white">
              02. Ringkasan 7 Refactoring & Optimasi Arsitektur MV3 (v2.2.7)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Seluruh fitur v2.2.6 (Diagnostic Log copy-paste, Bypass All Shortlinks Debloated,
              HTTP 302 CTA Grace, Floating Video Pill, &amp; Mini PiP) tetap utuh dengan stabilitas
              memori, keamanan API, dan kontrol pengguna yang lebih baik.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-slate-800 bg-slate-900/80 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                1. Zero Memory Leak & Buffer Video Aman
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                <code>attachVideoDockDrag</code> di <code>content.js</code> kini memakai{' '}
                <code>handleEl.setPointerCapture(e.pointerId)</code> dan memasang{' '}
                <code>pointermove</code>/<code>pointerup</code>/<code>pointercancel</code> langsung
                di <code>handleEl</code> tanpa menumpuk listener di <code>window</code>.
              </p>
              <p className="text-xs text-emerald-300 leading-relaxed">
                <code>nukeTimers()</code> dihapus dari <code>main_world.js</code> sehingga buffer
                pemutar video HLS/DASH dan sesi SPA tidak pernah rusak saat blokir navigasi aktif.
              </p>
            </div>

            <div className="border border-slate-800 bg-slate-900/80 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                2. Keamanan & Kuota Gemini API + DNR Debounce
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                <code>geminiApiKey</code> dipindahkan dari query URL ke header{' '}
                <code>x-goog-api-key</code> dengan pembersih blok markdown + <code>try-catch</code>{' '}
                parsing JSON. <code>runAiDomAudit()</code> hanya berjalan sebagai fallback saat
                auto-bypass tidak mengambil tindakan.
              </p>
              <p className="text-xs text-amber-300 leading-relaxed">
                <code>syncBlacklistToDnr()</code> kini di-<em>debounce</em> 350ms untuk mencegah{' '}
                <em>race condition</em> DNR, dan <code>tabHistory</code> dibersihkan otomatis (&gt;2
                jam / tab tertutup).
              </p>
            </div>

            <div className="border border-slate-800 bg-slate-900/80 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-sky-400 uppercase tracking-wide">
                3. Default Whitelist Dinamis & Toast Bypass
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                <code>semprot.com</code>, <code>kaskus.co.id</code>, dan <code>reddit.com</code>{' '}
                tidak lagi di-hardcode di <code>content.js</code>/<code>main_world.js</code>,
                melainkan di-seed ke <code>trustedDomains</code> saat instalasi agar bebas diubah di
                Tab <strong>✅ Trust</strong>.
              </p>
              <p className="text-xs text-sky-300 leading-relaxed">
                Sebelum <code>location.replace()</code> pada bypass Safelink, ekstensi menampilkan
                Toast elegan (<code>⚡ AEGIS Bypass: Melompati Safelink...</code>) selama ~800ms.
              </p>
            </div>
          </div>
        </section>

        {/* Source Code Inspector Section */}
        <section id="source" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">
                03. Inspeksi Kode Sumber & Berkas Ekstensi v2.2.7
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Periksa kode lengkap setiap berkas yang ada di dalam paket{' '}
                <code className="text-emerald-400">aegis-ai-shield-v2.2.7.zip</code>.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Bebas CSP · Shadow DOM Terisolasi · Siap Pasang</span>
            </div>
          </div>

          <SourceCodeInspector />
        </section>
      </main>

      <footer className="border-t border-slate-800/80 py-5 px-6 text-center text-xs text-slate-500">
        AEGIS-AI Shield v2.2.7 · Anti-Redirect, Bypass Shortlink Debloated & Diagnostic Log · Paket
        Ekstensi Manifest V3
      </footer>
    </div>
  );
}
