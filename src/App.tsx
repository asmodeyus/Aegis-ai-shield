import React, { useEffect, useState } from 'react';
import { Download, RotateCcw, CheckCircle2, PackageCheck } from 'lucide-react';
import { AllHudPositions, DEFAULT_HUD_POSITIONS } from './utils/hudPositionMath';
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
  removeTransparentOverlay: true,
  antiHistoryTrap: true,
  dnrEnabled: true,
  redirectWindowSec: 3.5,
};

const INITIAL_DENIED_DOMAINS = ['hai8g.com', 'maxwin-zeus88.cfd', 'shope.ee'];
const INITIAL_TRUSTED_DOMAINS = ['drive.google.com', 'github.com'];

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
  const [zipStatus, setZipStatus] = useState<string>(
    'Paket aegis-ai-shield-v2.2.2.zip siap diunduh (7 berkas ekstensi lengkap).'
  );
  const [isBuildingZip, setIsBuildingZip] = useState(false);

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
      a.download = 'aegis-ai-shield-v2.2.2.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);

      setZipStatus(
        `Berhasil mengunduh aegis-ai-shield-v2.2.2.zip (${(zipBytes.length / 1024).toFixed(1)} KB · 7 berkas).`
      );
    } catch {
      const a = document.createElement('a');
      a.href = '/aegis-ai-shield-v2.2.2.zip';
      a.download = 'aegis-ai-shield-v2.2.2.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setZipStatus('Mengunduh paket aegis-ai-shield-v2.2.2.zip...');
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
            Paket ZIP v2.2.2
          </a>
          <a
            href="#changelog"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Daftar Perubahan
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
            {isBuildingZip ? 'Mempaketkan ZIP...' : 'Unduh ZIP v2.2.2'}
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
              <span className="text-emerald-400 font-semibold">Rilis Pembaruan v2.2.2</span>
              <span aria-hidden="true">·</span>
              <span>Pengaturan Tersusun Rapi Per Kelompok</span>
              <span aria-hidden="true">·</span>
              <span>Opasitas & Ukuran Terpisah untuk Pil Video, HUD Blokir & Mini PiP</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight text-balance">
              Tata Letak Setting Rapi Per Kelompok & Opasitas Terpisah untuk Setiap HUD
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              Pada versi <strong className="text-white">2.2.2</strong>, seluruh daftar pengaturan di
              tab <strong className="text-sky-300">🎛️ Setting</strong> dikelompokkan secara bersih &
              rapi menjadi 4 kartu mandiri:{' '}
              <strong className="text-emerald-300">1. Pil & Dock Kontrol Video</strong>,{' '}
              <strong className="text-emerald-300">2. HUD Peringatan Blokir</strong>,{' '}
              <strong className="text-emerald-300">3. Jendela Mini-Player PiP</strong>, dan{' '}
              <strong className="text-emerald-300">4. Proteksi & Kecepatan</strong>. Pengaturan{' '}
              <strong className="text-white">Opasitas / Transparansi (50%–100%)</strong> kini juga
              dipisah per kelompok sehingga setiap HUD dapat memiliki tingkat transparansi dan ukuran
              masing-masing.
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
              Unduh aegis-ai-shield-v2.2.2.zip
            </button>

            <a
              href="/aegis-ai-shield-v2.2.2.zip"
              download="aegis-ai-shield-v2.2.2.zip"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors whitespace-nowrap text-center"
            >
              Tautan Langsung ZIP Statis v2.2.2
            </a>
          </div>
        </section>

        {/* Interactive HUD Layout Sandbox + Live Popup v2.2.2 Preview */}
        <section id="simulator" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">
                01. Studio Tata Letak HUD Interaktif & Pratinjau Popup v2.2.2
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Setiap kelompok di panel <strong>🎛️ Setting</strong> sebelah kanan kini memiliki
                kontrol posisi geser, ukuran, opasitas, dan menu tombolnya sendiri.
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
              />
            </div>
          </div>
        </section>

        {/* Detailed v2.2.2 Technical Changelog Table */}
        <section id="changelog" className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-white">
              02. Rincian Struktur Pengaturan Per Kelompok di Versi 2.2.2
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Setiap kelompok komponen memiliki kartu pengaturan mandiri beserta slider opasitasnya masing-masing.
            </p>
          </div>

          <div className="border border-slate-800 bg-slate-900/80 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400">
                  <th className="py-3 px-4 font-semibold">Kelompok Pengaturan</th>
                  <th className="py-3 px-4 font-semibold">Kontrol di Dalam Kelompok</th>
                  <th className="py-3 px-4 font-semibold">Key Opasitas & Ukuran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                <tr className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-semibold text-emerald-300">
                    🎬 1. Pil & Dock Kontrol Video
                  </td>
                  <td className="py-3 px-4">
                    Toggle Aktif, Status Posisi Geser + Reset ↺, Slider Ukuran Pil (75%–135%), Slider Opasitas Pil (50%–100%), Arah Buka Pil, Jeda Auto-Lipat, & 5 Centang Tombol Menu Pil Video.
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-sky-300 tabular-nums">
                    videoPillScale, videoPillOpacity
                  </td>
                </tr>
                <tr className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-semibold text-emerald-300">
                    🛡️ 2. HUD Peringatan Blokir
                  </td>
                  <td className="py-3 px-4">
                    Toggle Aktif, Status Posisi Geser + Reset ↺, Preset Awal Posisi, Slider Ukuran HUD (75%–130%), Slider Opasitas HUD (50%–100%), Lama Popup Tampil, & 5 Centang Tombol Menu HUD Blokir.
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-sky-300 tabular-nums">
                    hudScale, hudOpacity
                  </td>
                </tr>
                <tr className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-semibold text-emerald-300">
                    📺 3. Jendela Mini-Player PiP
                  </td>
                  <td className="py-3 px-4">
                    Status Posisi Geser + Reset ↺, Pilihan Ukuran Jendela Mini PiP (Kecil / Sedang / Besar), & Slider Opasitas Mini PiP (50%–100%).
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-sky-300 tabular-nums">
                    pipSize, pipOpacity
                  </td>
                </tr>
                <tr className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-semibold text-emerald-300">
                    ⚡ 4. Proteksi & Kecepatan
                  </td>
                  <td className="py-3 px-4">
                    Reset Semua Posisi HUD, Kecepatan Iklan Pre-Roll (8× / 16× / Instan), Batas Redirect Auto-Revert, Hapus Overlay Transparan, Anti-History Trap, & Blokir Jaringan DNR.
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-sky-300 tabular-nums">
                    adSkipSpeed, redirectWindowSec, dnrEnabled
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Source Code Inspector Section */}
        <section id="source" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">
                03. Inspeksi Kode Sumber & Berkas Ekstensi v2.2.2
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Periksa kode lengkap setiap berkas yang ada di dalam paket{' '}
                <code className="text-emerald-400">aegis-ai-shield-v2.2.2.zip</code>.
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
        AEGIS-AI Shield v2.2.2 · Anti-Redirect, Video & Search Hijack Shield · Paket Ekstensi
        Manifest V3
      </footer>
    </div>
  );
}
