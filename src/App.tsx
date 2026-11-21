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

const STORAGE_KEY_POSITIONS = 'aegis_v300_hud_positions';
const STORAGE_KEY_SETTINGS = 'aegis_v300_global_settings';

const DEFAULT_GLOBAL_SETTINGS: GlobalSettingsState = {
  protectionMode: 'balanced',
  popupTheme: 'dark',
  sessionOnlyApiKey: false,
  debugInternalErrors: false,
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
    detail: 'Bypass Shortlink Debloated mengekstrak URL tujuan langsung + Toast 800ms (QUERY_BASE64)',
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
    detail: 'HTTP 302 dari tombol CTA shortlink diizinkan (mode=balanced, qualifiers=server_redirect)',
  },
  {
    id: 'seed-4',
    ts: Date.now() - 8000,
    level: 'BLOCK',
    source: 'background',
    code: 'BLOCK_SUSPICIOUS_COMMIT',
    fromUrl: 'https://short.example.net/wait',
    toUrl: 'https://promo-gacor88.top/spin?clickid=99&token=secret12345',
    detail: 'Revert -> https://short.example.net/wait | mode=balanced | reason=suspicious_url | elapsed=420ms',
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
  const [localStats, setLocalStats] = useState({ blocked: 12, bypassed: 5, allowed: 18 });
  const [tempAllowMinutesLeft, setTempAllowMinutesLeft] = useState<number | null>(null);
  const [zipStatus, setZipStatus] = useState<string>(
    'Paket update aegis-ai-shield-v3.2.1.zip siap diunduh (dengan Key ID tetap agar pengaturan lama terbawa · content.js 74.8 KB).'
  );
  const [isBuildingZip, setIsBuildingZip] = useState(false);

  const handleAppendLog = (entry: Omit<AegisLogEntry, 'id' | 'ts'>) => {
    if (entry.level === 'BLOCK') {
      setLocalStats((s) => ({ ...s, blocked: s.blocked + 1 }));
    } else if (entry.level === 'BYPASS') {
      setLocalStats((s) => ({ ...s, bypassed: s.bypassed + 1 }));
    } else if (entry.level === 'ALLOW') {
      setLocalStats((s) => ({ ...s, allowed: s.allowed + 1 }));
    }

    if (globalSettings.loggingEnabled === false && entry.level !== 'DEBUG') return;
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
        'icon-16.png',
        'icon-32.png',
        'icon-48.png',
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
      a.download = 'aegis-ai-shield-v3.2.1.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);

      setZipStatus(
        `Berhasil mengunduh aegis-ai-shield-v3.2.1.zip (${(zipBytes.length / 1024).toFixed(1)} KB · 10 berkas · Key ID tetap terbawa).`
      );
    } catch {
      const a = document.createElement('a');
      a.href = '/aegis-ai-shield-v3.2.1.zip';
      a.download = 'aegis-ai-shield-v3.2.1.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setZipStatus('Mengunduh paket update aegis-ai-shield-v3.2.1.zip (dengan Key ID tetap)...');
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
            Paket ZIP v3.2.1
          </a>
          <a
            href="#evaluation"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Audit v3.2.1
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
            {isBuildingZip ? 'Mempaketkan ZIP...' : 'Unduh ZIP v3.2.1'}
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
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="text-emerald-400 font-semibold">Rilis Perbaikan &amp; Store Hardening v3.2.1</span>
              <span aria-hidden="true">·</span>
              <span>content.js 74.8 KB (&lt; 75 KB Minified)</span>
              <span aria-hidden="true">·</span>
              <span>Update-Safe Key · Embed Video Pil · P1–P8</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight text-balance">
              AEGIS-AI Shield v3.2.1 — Video-Tap Hijack Shield, Filter Judol Presisi &amp; Kepatuhan Store
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              Pembaruan <strong className="text-white">v3.2.1</strong> menyelesaikan seluruh temuan review{' '}
              <strong className="text-emerald-300">P1–P8</strong> sekaligus menutup celah{' '}
              <strong className="text-sky-300">video-tap hijack</strong> (Lemur Android / Chromium Balanced):
              pemisahan regex judol presisi, alur login OAuth aman, validasi ulang isolated world + closed Shadow DOM &amp; 2-langkah Trust,
              penghapusan izin <code>tabs</code>, ikon 16/32/48px, Gemini &amp; auto-click opt-in, deteksi iframe embed video, dan preservasi Key ID saat update.
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
              Unduh ZIP Update v3.2.1 (dengan Key)
            </button>

            <a
              href="/aegis-ai-shield-v3.2.1-store.zip"
              download="aegis-ai-shield-v3.2.1-store.zip"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors whitespace-nowrap text-center"
            >
              Unduh ZIP Store (tanpa Key)
            </a>
          </div>
        </section>

        {/* Interactive HUD Layout Sandbox + Live Popup v3.2.1 Preview */}
        <section id="simulator" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">
                01. Studio Tata Letak HUD Interaktif &amp; Pratinjau Popup v3.2.1
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Uji Tema Gelap/Terang, Safe Mode (15m / 1 Jam), statistik lokal real-time, Mode
                Balanced vs Strict, Laporan False Positive tersensor, &amp; Import/Export Hostlist{' '}
                <code>.txt</code> di Popup v3.2.1.
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
                tempAllowMinutesLeft={tempAllowMinutesLeft}
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
                onBulkAddDenied={(domains) => {
                  setDeniedDomains((prev) => Array.from(new Set([...domains, ...prev])));
                  const set = new Set(domains);
                  setTrustedDomains((prev) => prev.filter((d) => !set.has(d)));
                }}
                onBulkAddTrusted={(domains) => {
                  setTrustedDomains((prev) => Array.from(new Set([...domains, ...prev])));
                  const set = new Set(domains);
                  setDeniedDomains((prev) => prev.filter((d) => !set.has(d)));
                }}
                diagnosticLogs={diagnosticLogs}
                onClearLogs={handleClearLogs}
                localStats={localStats}
                onResetStats={() => setLocalStats({ blocked: 0, bypassed: 0, allowed: 0 })}
                tempAllowMinutesLeft={tempAllowMinutesLeft}
                onSetTempAllow={(mins) => {
                  setTempAllowMinutesLeft(mins);
                  if (mins) {
                    handleAppendLog({
                      level: 'ALLOW',
                      source: 'background',
                      code: 'TEMP_ALLOW_ENABLED',
                      fromUrl: 'https://www.semprot.com/',
                      detail: `Safe Mode / Temporary Allow diaktifkan selama ${mins} menit (Blacklist tetap diblokir senyap)`,
                    });
                  }
                }}
              />
            </div>
          </div>
        </section>

        {/* Ringkasan Audit & Hardening v3.2.1 */}
        <section id="evaluation" className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-white">
              02. Ringkasan Perbaikan Review P1–P8 &amp; Video-Tap Hijack v3.2.1
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Seluruh temuan review diselesaikan di source modular, dibundel ulang via esbuild, dan diverifikasi dengan unit test serta pengujian headless Chromium.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-slate-800 bg-slate-900/80 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                1. Video-Tap Shield, P1 &amp; P2 (OAuth)
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Memisahkan timestamp sentuhan <code>&lt;video&gt;</code> dari klik tautan nyata sehingga iklan sekali-sentuh (termasuk <code>/4/&lt;hex&gt;</code>) ditahan di HUD tanpa melempar tab balik. Filter judol dipisah spesifik vs token utuh hostname (nol false-positive pada <code>smartphone</code>, <code>startpage.com</code>, <code>judiciary.gov</code>).
              </p>
              <p className="text-xs text-emerald-300 leading-relaxed">
                Menghapus <code>redirect</code> telanjang dari parameter arbitrase &amp; mendahulukan OAuth Google/Microsoft/GitHub/Discord.
              </p>
            </div>

            <div className="border border-slate-800 bg-slate-900/80 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                2. P3 Anti-Spoof, P4 Store Build &amp; P6 Timer
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Event <code>main_world → content</code> diklasifikasi ulang di isolated world; Shadow DOM HUD &amp; Video Dock <code>closed</code>, klik tombol wajib <code>ev.isTrusted</code>, dan <code>✓ Trust</code> memakai konfirmasi 2-langkah dengan domain penuh.
              </p>
              <p className="text-xs text-amber-300 leading-relaxed">
                Izin <code>tabs</code> dihapus, <code>minimum_chrome_version: 111</code>, ikon 16/32/48px, split build Dev/Store, &amp; cache timer hook 500ms.
              </p>
            </div>

            <div className="border border-slate-800 bg-slate-900/80 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-sky-400 uppercase tracking-wide">
                3. P5 Privasi Gemini, P7 Netral &amp; P8 Restore
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Audit Gemini, Auto-Skip Countdown, &amp; Auto-Klik Shortlink default <strong>OFF (opt-in)</strong> dengan pengungkapan data eksplisit; API Key default <code>session</code> + peringatan jika permanen; Whitelist awal kosong (<code>[]</code>).
              </p>
              <p className="text-xs text-sky-300 leading-relaxed">
                Restore backup memfilter key <code>globalSettings</code>, memvalidasi tipe/slider, &amp; membatasi jumlah domain (kompatibel v2.2.7–v3.2.0).
              </p>
            </div>
          </div>
        </section>

        {/* Source Code Inspector Section */}
        <section id="source" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">
                03. Inspeksi Kode Sumber &amp; Berkas Ekstensi v3.2.1
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Periksa hasil bundel produksi setiap berkas di dalam paket{' '}
                <code className="text-emerald-400">aegis-ai-shield-v3.2.1.zip</code>.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>esbuild Minified · content.js 74.8 KB · Key ID Stabil</span>
            </div>
          </div>

          <SourceCodeInspector />
        </section>
      </main>

      <footer className="border-t border-slate-800/80 py-5 px-6 text-center text-xs text-slate-500">
        AEGIS-AI Shield v3.2.1 · Anti-Redirect, Video-Tap Hijack Shield &amp; Chrome Web Store Hardened Studio
      </footer>
    </div>
  );
}
