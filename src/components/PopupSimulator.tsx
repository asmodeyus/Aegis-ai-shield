import React, { useState } from 'react';
import { AllHudPositions, SavedHudCoord } from '../utils/hudPositionMath';
import {
  AegisLogEntry,
  AegisLogLevel,
  formatAegisLogsForCopy,
} from '../utils/shortlinkBypassEngine';
import { GlobalSettingsState } from './InteractiveHudSandbox';

interface PopupSimulatorProps {
  hudPositions: AllHudPositions;
  onResetHudPosition: (key: keyof AllHudPositions) => void;
  onResetAllPositions: () => void;
  globalSettings: GlobalSettingsState;
  onUpdateGlobalSettings: (next: GlobalSettingsState) => void;
  onResetGlobalSettings: () => void;
  trustedDomains: string[];
  deniedDomains: string[];
  onAddTrusted: (domain: string) => void;
  onRemoveTrusted: (domain: string) => void;
  onAddDenied: (domain: string) => void;
  onRemoveDenied: (domain: string) => void;
  diagnosticLogs: AegisLogEntry[];
  onClearLogs: () => void;
}

export const PopupSimulator: React.FC<PopupSimulatorProps> = ({
  hudPositions,
  onResetHudPosition,
  onResetAllPositions,
  globalSettings,
  onUpdateGlobalSettings,
  onResetGlobalSettings,
  trustedDomains,
  deniedDomains,
  onAddTrusted,
  onRemoveTrusted,
  onAddDenied,
  onRemoveDenied,
  diagnosticLogs,
  onClearLogs,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'global' | 'logs' | 'blacklist' | 'whitelist'>('global');
  const [logFilter, setLogFilter] = useState<'ALL' | AegisLogLevel>('ALL');
  const [strictCross, setStrictCross] = useState(true);
  const [autoSkip, setAutoSkip] = useState(true);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [blacklistInput, setBlacklistInput] = useState('');
  const [whitelistInput, setWhitelistInput] = useState('');
  const [backupDrawerOpen, setBackupDrawerOpen] = useState(false);
  const [backupText, setBackupText] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
  };

  const formatCoord = (coord: SavedHudCoord | null, fallback: string, showSide = false) => {
    if (!coord) return fallback;
    if (showSide && coord.anchorSide) {
      const sideLabel = coord.anchorSide === 'left' ? 'Kiri→' : '←Kanan';
      return `X:${coord.left}, Y:${coord.top} (${sideLabel})`;
    }
    return `X:${coord.left}px, Y:${coord.top}px`;
  };

  const handleCopyBackup = () => {
    const payload = {
      app: 'AEGIS-AI Shield',
      version: '2.2.7',
      strictCrossOrigin: strictCross,
      autoSkipCountdown: autoSkip,
      globalSettings,
      hudPositions,
      trustedDomains,
      deniedDomains,
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    setBackupText(jsonStr);
    setBackupDrawerOpen(true);
    try {
      navigator.clipboard.writeText(jsonStr);
      showStatus('Backup JSON v2.2.7 (Bypass Debloated + Log + Setting) tersalin!');
    } catch {
      showStatus('JSON Backup ditampilkan di bawah.');
    }
  };

  const formattedLogText = formatAegisLogsForCopy(diagnosticLogs, logFilter, '2.2.7');

  const handleCopyLogs = async () => {
    try {
      await navigator.clipboard.writeText(formattedLogText);
      showStatus('Log diagnostik v2.2.7 tersalin ke Clipboard!');
    } catch {
      showStatus('Silakan pilih teks di kotak log lalu salin (Ctrl+C).');
    }
  };

  const safeVideoPillScale = Math.max(
    0.75,
    Math.min(1.35, Number(globalSettings.videoPillScale) || 1.0)
  );
  const safeVideoPillOpacity = Math.max(
    0.5,
    Math.min(1.0, Number(globalSettings.videoPillOpacity ?? globalSettings.hudOpacity) || 0.95)
  );
  const safeVideoDockDimSec = Math.max(
    0,
    Math.min(10, Number.isFinite(Number(globalSettings.videoDockDimSec)) ? Number(globalSettings.videoDockDimSec) : 2.5)
  );

  const safeHudScale = Math.max(0.75, Math.min(1.3, Number(globalSettings.hudScale) || 1.0));
  const safeHudOpacity = Math.max(0.5, Math.min(1.0, Number(globalSettings.hudOpacity) || 0.95));
  const safeHudDurationSec = Math.max(
    0,
    Math.min(15, Number.isFinite(Number(globalSettings.hudDurationSec)) ? Number(globalSettings.hudDurationSec) : 4.5)
  );

  const safePipOpacity = Math.max(
    0.5,
    Math.min(1.0, Number(globalSettings.pipOpacity ?? globalSettings.hudOpacity) || 0.95)
  );

  const safeRedirectWindowSec = Math.max(
    1,
    Math.min(10, Number.isFinite(Number(globalSettings.redirectWindowSec)) ? Number(globalSettings.redirectWindowSec) : 3.5)
  );

  return (
    <div className="w-full bg-[#0f172a] border border-slate-800 rounded-xl p-4 text-slate-50 shadow-xl">
      {/* Popup Header */}
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="m-0 text-sm font-bold text-emerald-400">⚡ AEGIS-AI Shield</h3>
        <span className="text-[11px] font-mono font-bold text-emerald-300">v2.2.7</span>
      </div>

      {/* 5 Navigation Tabs */}
      <div className="grid grid-cols-5 gap-0.5 bg-slate-950 p-1 rounded-lg border border-slate-800 mb-3">
        <button
          type="button"
          data-testid="popup-tab-general"
          onClick={() => setActiveTab('general')}
          className={`py-1.5 px-0.5 rounded-md text-[9.5px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'general'
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ⚡ Umum
        </button>
        <button
          type="button"
          data-testid="popup-tab-global"
          onClick={() => setActiveTab('global')}
          className={`py-1.5 px-0.5 rounded-md text-[9.5px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'global'
              ? 'bg-slate-800 text-sky-400 border-b-2 border-sky-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🎛️ Setting
        </button>
        <button
          type="button"
          data-testid="popup-tab-logs"
          onClick={() => setActiveTab('logs')}
          className={`py-1.5 px-0.5 rounded-md text-[9.5px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'logs'
              ? 'bg-slate-800 text-amber-300 border-b-2 border-amber-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          📋 Log ({diagnosticLogs.length})
        </button>
        <button
          type="button"
          data-testid="popup-tab-blacklist"
          onClick={() => setActiveTab('blacklist')}
          className={`py-1.5 px-0.5 rounded-md text-[9.5px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'blacklist'
              ? 'bg-slate-800 text-rose-300 border-b-2 border-rose-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🚫 Block ({deniedDomains.length})
        </button>
        <button
          type="button"
          data-testid="popup-tab-whitelist"
          onClick={() => setActiveTab('whitelist')}
          className={`py-1.5 px-0.5 rounded-md text-[9.5px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'whitelist'
              ? 'bg-slate-800 text-emerald-300 border-b-2 border-emerald-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ✅ Trust ({trustedDomains.length})
        </button>
      </div>

      {/* TAB 1: UMUM */}
      {activeTab === 'general' && (
        <div className="space-y-2 text-xs">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Blokir redirect judol, Shopee/affiliate & ad-rotator di level jaringan (DNR) + pengaturan HUD tersusun rapi per kelompok dengan slider timer, ukuran & opasitas di bagian bawah setiap kelompok.
          </p>

          <label className="flex items-center justify-between bg-slate-800/90 border border-slate-700 rounded-md px-2.5 py-2 text-[11px] cursor-pointer">
            <span>Strict Lintas-Domain (Tahan Semua)</span>
            <input
              type="checkbox"
              checked={strictCross}
              onChange={(e) => {
                setStrictCross(e.target.checked);
                showStatus(
                  e.target.checked ? 'Strict Lintas-Domain: AKTIF' : 'Strict Lintas-Domain: NONAKTIF'
                );
              }}
              className="accent-emerald-500"
            />
          </label>

          <label className="flex items-center justify-between bg-slate-800/90 border border-slate-700 rounded-md px-2.5 py-2 text-[11px] cursor-pointer">
            <span>Auto-Skip Countdown Video (5–30d)</span>
            <input
              type="checkbox"
              checked={autoSkip}
              onChange={(e) => {
                setAutoSkip(e.target.checked);
                showStatus(
                  e.target.checked ? 'Auto-Skip Countdown: AKTIF' : 'Auto-Skip Countdown: NONAKTIF'
                );
              }}
              className="accent-emerald-500"
            />
          </label>

          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Opsional: Gemini API Key Lokal"
            className="w-full px-2.5 py-1.5 rounded-md border border-slate-700 bg-slate-800 text-white text-[11.5px] outline-none focus:border-emerald-500"
          />

          <button
            type="button"
            onClick={() => showStatus('Konfigurasi Umum v2.2.7 tersimpan!')}
            className="w-full py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-[11.5px] cursor-pointer"
          >
            Simpan Konfigurasi
          </button>

          <div className="pt-2 border-t border-slate-800">
            <div className="text-[10.5px] font-semibold text-slate-400 mb-1.5">
              Cadangan & Transfer Data (Termasuk Pengaturan Per Kelompok)
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={handleCopyBackup}
                className="py-1.5 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-semibold text-[10.5px] cursor-pointer"
              >
                📋 Salin Backup
              </button>
              <button
                type="button"
                onClick={() => setBackupDrawerOpen((v) => !v)}
                className="py-1.5 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-semibold text-[10.5px] cursor-pointer"
              >
                📥 Tempel Backup
              </button>
            </div>

            {backupDrawerOpen && (
              <div className="mt-2 p-2 rounded-lg bg-slate-950 border border-slate-700">
                <textarea
                  value={backupText}
                  onChange={(e) => setBackupText(e.target.value)}
                  rows={3}
                  placeholder="Tempel JSON cadangan v2.2.7 di sini..."
                  className="w-full p-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-slate-200"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SETTING (PER KELOMPOK + SLIDER TIMER/UKURAN/OPASITAS DI BAWAH) */}
      {activeTab === 'global' && (
        <div className="space-y-3 max-h-[455px] overflow-y-auto pr-1">
          {/* =============================================================== */}
          {/* KELOMPOK 1: 🎬 PIL & DOCK KONTROL VIDEO                         */}
          {/* =============================================================== */}
          <div
            data-testid="setting-group-video"
            className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 space-y-2"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <span className="text-[11px] font-extrabold text-sky-400 uppercase tracking-wide">
                🎬 1. Pil & Dock Kontrol Video
              </span>
              <button
                type="button"
                onClick={() => {
                  onResetHudPosition('videoDock');
                  showStatus('Posisi Pil Video di-reset ke Auto-Anchor!');
                }}
                title="Reset posisi Pil Video"
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-[9.5px] font-bold cursor-pointer"
              >
                ↺ Reset Posisi
              </button>
            </div>

            {/* Pengaturan Toggle, Status Posisi, Arah & Menu Tombol di Atas */}
            <label className="flex items-center justify-between bg-slate-800/80 border border-slate-700/70 rounded-lg px-2.5 py-1.5 text-[11px] cursor-pointer">
              <span>Tampilkan Pil Kontrol Video</span>
              <input
                type="checkbox"
                checked={globalSettings.videoDockEnabled}
                onChange={(e) =>
                  onUpdateGlobalSettings({
                    ...globalSettings,
                    videoDockEnabled: e.target.checked,
                  })
                }
                className="accent-emerald-500"
              />
            </label>

            <div className="flex items-center justify-between bg-slate-950/90 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[10px]">
              <span className="font-semibold text-slate-400">✋ Posisi Geser Pil Video</span>
              <span
                className={`font-mono text-[9.5px] font-bold tabular-nums ${
                  hudPositions.videoDock ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {formatCoord(hudPositions.videoDock, 'Auto-Anchor', true)}
              </span>
            </div>

            {/* Arah Buka Pil Video */}
            <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2">
              <div className="flex items-center justify-between text-[10.5px] font-semibold gap-2">
                <span>Arah Buka Pil Video</span>
                <select
                  aria-label="Arah Buka Pil Video"
                  value={globalSettings.videoDockExpandDir}
                  onChange={(e) => {
                    const nextDir = e.target.value as GlobalSettingsState['videoDockExpandDir'];
                    onUpdateGlobalSettings({
                      ...globalSettings,
                      videoDockExpandDir: nextDir,
                    });
                    showStatus(
                      nextDir === 'ltr'
                        ? 'Pil Video: Buka Kiri ke Kanan (→)'
                        : nextDir === 'rtl'
                        ? 'Pil Video: Buka Kanan ke Kiri (←)'
                        : 'Pil Video: Otomatis mengikuti pinggir layar'
                    );
                  }}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-slate-100"
                >
                  <option value="auto">Otomatis (Ikuti Pinggir)</option>
                  <option value="ltr">Kiri ke Kanan (→)</option>
                  <option value="rtl">Kanan ke Kiri (←)</option>
                </select>
              </div>
            </div>

            {/* Tombol yang Tampil di Menu Pil Video */}
            <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2 space-y-1.5">
              <div className="text-[10.5px] font-semibold text-slate-200">
                Tombol yang Tampil di Menu Pil Video
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <label className="flex items-center justify-between bg-slate-950/90 border border-slate-800 rounded px-2 py-1 cursor-pointer">
                  <span>▶ Putar / Jeda</span>
                  <input
                    type="checkbox"
                    data-testid="toggle-vp-play"
                    checked={globalSettings.videoPillShowPlayPause !== false}
                    onChange={(e) =>
                      onUpdateGlobalSettings({
                        ...globalSettings,
                        videoPillShowPlayPause: e.target.checked,
                      })
                    }
                    className="accent-emerald-500"
                  />
                </label>
                <label className="flex items-center justify-between bg-slate-950/90 border border-slate-800 rounded px-2 py-1 cursor-pointer">
                  <span>☰ Daftar Stream</span>
                  <input
                    type="checkbox"
                    data-testid="toggle-vp-list"
                    checked={globalSettings.videoPillShowList !== false}
                    onChange={(e) =>
                      onUpdateGlobalSettings({
                        ...globalSettings,
                        videoPillShowList: e.target.checked,
                      })
                    }
                    className="accent-emerald-500"
                  />
                </label>
                <label className="flex items-center justify-between bg-slate-950/90 border border-slate-800 rounded px-2 py-1 cursor-pointer">
                  <span>⬇ Unduh / Buka</span>
                  <input
                    type="checkbox"
                    data-testid="toggle-vp-download"
                    checked={globalSettings.videoPillShowDownload !== false}
                    onChange={(e) =>
                      onUpdateGlobalSettings({
                        ...globalSettings,
                        videoPillShowDownload: e.target.checked,
                      })
                    }
                    className="accent-emerald-500"
                  />
                </label>
                <label className="flex items-center justify-between bg-slate-950/90 border border-slate-800 rounded px-2 py-1 cursor-pointer">
                  <span>⧉ Mini PiP</span>
                  <input
                    type="checkbox"
                    data-testid="toggle-vp-pip"
                    checked={globalSettings.videoPillShowPip !== false}
                    onChange={(e) =>
                      onUpdateGlobalSettings({
                        ...globalSettings,
                        videoPillShowPip: e.target.checked,
                      })
                    }
                    className="accent-emerald-500"
                  />
                </label>
                <label className="col-span-2 flex items-center justify-between bg-slate-950/90 border border-slate-800 rounded px-2 py-1 cursor-pointer">
                  <span>⛶ Layar Penuh (Fullscreen)</span>
                  <input
                    type="checkbox"
                    data-testid="toggle-vp-fullscreen"
                    checked={globalSettings.videoPillShowFullscreen !== false}
                    onChange={(e) =>
                      onUpdateGlobalSettings({
                        ...globalSettings,
                        videoPillShowFullscreen: e.target.checked,
                      })
                    }
                    className="accent-emerald-500"
                  />
                </label>
              </div>
            </div>

            {/* SLIDER KELOMPOK 1 DI BAGIAN BAWAH (TIMER DIM, UKURAN, OPASITAS) */}
            <div
              data-testid="sliders-group-video"
              className="pt-2 border-t border-dashed border-slate-700/80 space-y-1.5"
            >
              <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                Slider Timer, Ukuran & Opasitas Pil Video
              </div>

              {/* Slider 1: Timer Dim / Auto-Lipat Pil Video */}
              <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2">
                <div className="flex items-center justify-between text-[10.5px] font-semibold mb-1">
                  <span>⏱️ Timer Dim / Auto-Lipat ke 🎬(N)</span>
                  <span
                    data-testid="popup-videopill-dim-val"
                    className="font-mono text-[10.5px] font-bold text-emerald-400 tabular-nums"
                  >
                    {safeVideoDockDimSec === 0 ? 'Manual' : `${safeVideoDockDimSec.toFixed(1)} detik`}
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="popup-videopill-dim-slider"
                  aria-label="Timer Dim Auto-Lipat Pil Video"
                  min="0"
                  max="10"
                  step="0.5"
                  value={safeVideoDockDimSec}
                  onChange={(e) => {
                    const nextDim = Number(e.target.value);
                    onUpdateGlobalSettings({
                      ...globalSettings,
                      videoDockDimSec: nextDim,
                    });
                    showStatus(
                      nextDim === 0
                        ? 'Timer Dim Pil Video: Manual (Tidak Auto-Lipat)'
                        : `Timer Dim Pil Video diatur ke ${nextDim.toFixed(1)} detik`
                    );
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Slider 2: Ukuran Pil Video */}
              <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2">
                <div className="flex items-center justify-between text-[10.5px] font-semibold mb-1">
                  <span>📐 Ukuran Pil Video</span>
                  <span
                    data-testid="popup-videopill-scale-val"
                    className="font-mono text-[10.5px] font-bold text-emerald-400 tabular-nums"
                  >
                    {Math.round(safeVideoPillScale * 100)}% ({safeVideoPillScale.toFixed(2)}×)
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="popup-videopill-scale-slider"
                  aria-label="Ukuran Pil Video"
                  min="0.75"
                  max="1.35"
                  step="0.05"
                  value={safeVideoPillScale}
                  onChange={(e) => {
                    const nextScale = Number(e.target.value);
                    onUpdateGlobalSettings({
                      ...globalSettings,
                      videoPillScale: nextScale,
                    });
                    showStatus(
                      `Ukuran Pil Video diatur ke ${Math.round(nextScale * 100)}% (${nextScale.toFixed(2)}×)`
                    );
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Slider 3: Opasitas Pil Video */}
              <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2">
                <div className="flex items-center justify-between text-[10.5px] font-semibold mb-1">
                  <span>👁️ Opasitas / Transparansi Pil Video</span>
                  <span
                    data-testid="popup-videopill-opacity-val"
                    className="font-mono text-[10.5px] font-bold text-emerald-400 tabular-nums"
                  >
                    {Math.round(safeVideoPillOpacity * 100)}% ({safeVideoPillOpacity.toFixed(2)})
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="popup-videopill-opacity-slider"
                  aria-label="Opasitas Pil Video"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  value={safeVideoPillOpacity}
                  onChange={(e) => {
                    const nextOp = Number(e.target.value);
                    onUpdateGlobalSettings({
                      ...globalSettings,
                      videoPillOpacity: nextOp,
                    });
                    showStatus(
                      `Opasitas Pil Video diatur ke ${Math.round(nextOp * 100)}% (${nextOp.toFixed(2)})`
                    );
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* KELOMPOK 2: 🛡️ HUD PERINGATAN BLOKIR                            */}
          {/* =============================================================== */}
          <div
            data-testid="setting-group-hud"
            className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 space-y-2"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <span className="text-[11px] font-extrabold text-sky-400 uppercase tracking-wide">
                🛡️ 2. HUD Peringatan Blokir
              </span>
              <button
                type="button"
                onClick={() => {
                  onResetHudPosition('topHud');
                  showStatus('Posisi HUD Blokir di-reset ke Preset!');
                }}
                title="Reset posisi HUD Blokir"
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-[9.5px] font-bold cursor-pointer"
              >
                ↺ Reset Posisi
              </button>
            </div>

            {/* Pengaturan Toggle, Status Posisi, Preset & Menu Tombol di Atas */}
            <label className="flex items-center justify-between bg-slate-800/80 border border-slate-700/70 rounded-lg px-2.5 py-1.5 text-[11px] cursor-pointer">
              <span>Tampilkan HUD Peringatan Blokir</span>
              <input
                type="checkbox"
                checked={globalSettings.hudEnabled}
                onChange={(e) =>
                  onUpdateGlobalSettings({
                    ...globalSettings,
                    hudEnabled: e.target.checked,
                  })
                }
                className="accent-emerald-500"
              />
            </label>

            <div className="flex items-center justify-between bg-slate-950/90 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[10px]">
              <span className="font-semibold text-slate-400">✋ Posisi Geser HUD Blokir</span>
              <span
                className={`font-mono text-[9.5px] font-bold tabular-nums ${
                  hudPositions.topHud ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {formatCoord(hudPositions.topHud, 'Preset Default')}
              </span>
            </div>

            {/* Preset Awal Posisi HUD */}
            <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2">
              <div className="flex items-center justify-between text-[10.5px] font-semibold gap-2">
                <span>Preset Awal Posisi HUD</span>
                <select
                  aria-label="Preset Awal Posisi HUD"
                  value={globalSettings.hudPosition}
                  onChange={(e) => {
                    onResetHudPosition('topHud');
                    onUpdateGlobalSettings({
                      ...globalSettings,
                      hudPosition: e.target.value as GlobalSettingsState['hudPosition'],
                    });
                    showStatus(`Preset posisi HUD diubah ke ${e.target.value}`);
                  }}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-slate-100"
                >
                  <option value="top-center">Atas Tengah</option>
                  <option value="top-left">Atas Kiri</option>
                  <option value="top-right">Atas Kanan</option>
                  <option value="bottom-center">Bawah Tengah</option>
                </select>
              </div>
            </div>

            {/* Tombol yang Tampil di Menu HUD Blokir */}
            <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2 space-y-1.5">
              <div className="text-[10.5px] font-semibold text-slate-200">
                Tombol yang Tampil di Menu HUD Blokir
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <label className="flex items-center justify-between bg-slate-950/90 border border-slate-800 rounded px-2 py-1 cursor-pointer">
                  <span>✓ Tombol Trust</span>
                  <input
                    type="checkbox"
                    data-testid="toggle-hud-trust"
                    checked={globalSettings.hudShowTrust !== false}
                    onChange={(e) =>
                      onUpdateGlobalSettings({
                        ...globalSettings,
                        hudShowTrust: e.target.checked,
                      })
                    }
                    className="accent-emerald-500"
                  />
                </label>
                <label className="flex items-center justify-between bg-slate-950/90 border border-slate-800 rounded px-2 py-1 cursor-pointer">
                  <span>⊞ Tab Grup</span>
                  <input
                    type="checkbox"
                    data-testid="toggle-hud-group"
                    checked={globalSettings.hudShowGroup !== false}
                    onChange={(e) =>
                      onUpdateGlobalSettings({
                        ...globalSettings,
                        hudShowGroup: e.target.checked,
                      })
                    }
                    className="accent-emerald-500"
                  />
                </label>
                <label className="flex items-center justify-between bg-slate-950/90 border border-slate-800 rounded px-2 py-1 cursor-pointer">
                  <span>↗ Tombol Buka</span>
                  <input
                    type="checkbox"
                    data-testid="toggle-hud-open"
                    checked={globalSettings.hudShowOpen !== false}
                    onChange={(e) =>
                      onUpdateGlobalSettings({
                        ...globalSettings,
                        hudShowOpen: e.target.checked,
                      })
                    }
                    className="accent-emerald-500"
                  />
                </label>
                <label className="flex items-center justify-between bg-slate-950/90 border border-slate-800 rounded px-2 py-1 cursor-pointer">
                  <span>🚫 Tombol Blokir</span>
                  <input
                    type="checkbox"
                    data-testid="toggle-hud-block"
                    checked={globalSettings.hudShowBlock !== false}
                    onChange={(e) =>
                      onUpdateGlobalSettings({
                        ...globalSettings,
                        hudShowBlock: e.target.checked,
                      })
                    }
                    className="accent-emerald-500"
                  />
                </label>
                <label className="col-span-2 flex items-center justify-between bg-slate-950/90 border border-slate-800 rounded px-2 py-1 cursor-pointer">
                  <span>🔗 Baris Detail URL Target</span>
                  <input
                    type="checkbox"
                    data-testid="toggle-hud-urldetail"
                    checked={globalSettings.hudShowUrlDetail !== false}
                    onChange={(e) =>
                      onUpdateGlobalSettings({
                        ...globalSettings,
                        hudShowUrlDetail: e.target.checked,
                      })
                    }
                    className="accent-emerald-500"
                  />
                </label>
              </div>
            </div>

            {/* SLIDER KELOMPOK 2 DI BAGIAN BAWAH (TIMER COUNTDOWN, UKURAN, OPASITAS) */}
            <div
              data-testid="sliders-group-hud"
              className="pt-2 border-t border-dashed border-slate-700/80 space-y-1.5"
            >
              <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                Slider Timer Countdown, Ukuran & Opasitas HUD Blokir
              </div>

              {/* Slider 1: Timer Countdown HUD Blokir Tampil */}
              <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2">
                <div className="flex items-center justify-between text-[10.5px] font-semibold mb-1">
                  <span>⏱️ Timer Countdown HUD Blokir Tampil</span>
                  <span
                    data-testid="popup-hud-duration-val"
                    className="font-mono text-[10.5px] font-bold text-emerald-400 tabular-nums"
                  >
                    {safeHudDurationSec === 0 ? 'Manual (∞)' : `${safeHudDurationSec.toFixed(1)} detik`}
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="popup-hud-duration-slider"
                  aria-label="Timer Countdown HUD Blokir Tampil"
                  min="0"
                  max="15"
                  step="0.5"
                  value={safeHudDurationSec}
                  onChange={(e) => {
                    const nextDur = Number(e.target.value);
                    onUpdateGlobalSettings({
                      ...globalSettings,
                      hudDurationSec: nextDur,
                    });
                    showStatus(
                      nextDur === 0
                        ? 'Timer Countdown HUD Blokir: Manual (∞)'
                        : `Timer Countdown HUD Blokir diatur ke ${nextDur.toFixed(1)} detik`
                    );
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Slider 2: Ukuran HUD Blokir */}
              <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2">
                <div className="flex items-center justify-between text-[10.5px] font-semibold mb-1">
                  <span>📐 Ukuran HUD Blokir</span>
                  <span
                    data-testid="popup-hud-scale-val"
                    className="font-mono text-[10.5px] font-bold text-emerald-400 tabular-nums"
                  >
                    {Math.round(safeHudScale * 100)}% ({safeHudScale.toFixed(2)}×)
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="popup-hud-scale-slider"
                  aria-label="Ukuran HUD Blokir"
                  min="0.75"
                  max="1.30"
                  step="0.05"
                  value={safeHudScale}
                  onChange={(e) => {
                    const nextScale = Number(e.target.value);
                    onUpdateGlobalSettings({
                      ...globalSettings,
                      hudScale: nextScale,
                    });
                    showStatus(
                      `Ukuran HUD Blokir diatur ke ${Math.round(nextScale * 100)}% (${nextScale.toFixed(2)}×)`
                    );
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Slider 3: Opasitas HUD Blokir */}
              <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2">
                <div className="flex items-center justify-between text-[10.5px] font-semibold mb-1">
                  <span>👁️ Opasitas / Transparansi HUD Blokir</span>
                  <span
                    data-testid="popup-hud-opacity-val"
                    className="font-mono text-[10.5px] font-bold text-emerald-400 tabular-nums"
                  >
                    {Math.round(safeHudOpacity * 100)}% ({safeHudOpacity.toFixed(2)})
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="popup-hud-opacity-slider"
                  aria-label="Opasitas HUD Blokir"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  value={safeHudOpacity}
                  onChange={(e) => {
                    const nextOpacity = Number(e.target.value);
                    onUpdateGlobalSettings({
                      ...globalSettings,
                      hudOpacity: nextOpacity,
                    });
                    showStatus(
                      `Opasitas HUD Blokir diatur ke ${Math.round(nextOpacity * 100)}% (${nextOpacity.toFixed(2)})`
                    );
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* KELOMPOK 3: 📺 JENDELA MINI-PLAYER PiP                          */}
          {/* =============================================================== */}
          <div
            data-testid="setting-group-pip"
            className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 space-y-2"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <span className="text-[11px] font-extrabold text-sky-400 uppercase tracking-wide">
                📺 3. Jendela Mini-Player PiP
              </span>
              <button
                type="button"
                onClick={() => {
                  onResetHudPosition('miniPip');
                  showStatus('Posisi Mini PiP di-reset ke Kanan Bawah!');
                }}
                title="Reset posisi Mini PiP"
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-[9.5px] font-bold cursor-pointer"
              >
                ↺ Reset Posisi
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-950/90 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[10px]">
              <span className="font-semibold text-slate-400">✋ Posisi Geser Mini PiP</span>
              <span
                className={`font-mono text-[9.5px] font-bold tabular-nums ${
                  hudPositions.miniPip ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {formatCoord(hudPositions.miniPip, 'Kanan Bawah')}
              </span>
            </div>

            {/* Ukuran Jendela Mini PiP */}
            <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2">
              <div className="flex items-center justify-between text-[10.5px] font-semibold">
                <span>Ukuran Jendela Mini PiP</span>
                <select
                  aria-label="Ukuran Jendela Mini PiP"
                  value={globalSettings.pipSize}
                  onChange={(e) =>
                    onUpdateGlobalSettings({
                      ...globalSettings,
                      pipSize: e.target.value as GlobalSettingsState['pipSize'],
                    })
                  }
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-slate-100"
                >
                  <option value="small">Kecil (220×124)</option>
                  <option value="medium">Sedang (260×146)</option>
                  <option value="large">Besar (320×180)</option>
                </select>
              </div>
            </div>

            {/* SLIDER KELOMPOK 3 DI BAGIAN BAWAH (OPASITAS MINI PiP) */}
            <div
              data-testid="sliders-group-pip"
              className="pt-2 border-t border-dashed border-slate-700/80 space-y-1.5"
            >
              <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                Slider Opasitas Mini-Player PiP
              </div>

              <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2">
                <div className="flex items-center justify-between text-[10.5px] font-semibold mb-1">
                  <span>👁️ Opasitas / Transparansi Mini PiP</span>
                  <span
                    data-testid="popup-pip-opacity-val"
                    className="font-mono text-[10.5px] font-bold text-emerald-400 tabular-nums"
                  >
                    {Math.round(safePipOpacity * 100)}% ({safePipOpacity.toFixed(2)})
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="popup-pip-opacity-slider"
                  aria-label="Opasitas Mini PiP"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  value={safePipOpacity}
                  onChange={(e) => {
                    const nextOp = Number(e.target.value);
                    onUpdateGlobalSettings({
                      ...globalSettings,
                      pipOpacity: nextOp,
                    });
                    showStatus(
                      `Opasitas Mini PiP diatur ke ${Math.round(nextOp * 100)}% (${nextOp.toFixed(2)})`
                    );
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* KELOMPOK 4: ⚡ PROTEKSI & KECEPATAN                             */}
          {/* =============================================================== */}
          <div
            data-testid="setting-group-protection"
            className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 space-y-2"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <span className="text-[11px] font-extrabold text-sky-400 uppercase tracking-wide">
                ⚡ 4. Proteksi & Kecepatan
              </span>
              <button
                type="button"
                onClick={() => {
                  onResetAllPositions();
                  showStatus('Semua posisi HUD dikembalikan ke default!');
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 text-[9.5px] font-bold cursor-pointer"
              >
                ↺ Reset Semua Posisi
              </button>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2">
              <div className="flex items-center justify-between text-[10.5px] font-semibold">
                <span>Kecepatan Iklan Pre-Roll</span>
                <select
                  aria-label="Kecepatan Iklan Pre-Roll"
                  value={globalSettings.adSkipSpeed}
                  onChange={(e) =>
                    onUpdateGlobalSettings({
                      ...globalSettings,
                      adSkipSpeed: e.target.value as GlobalSettingsState['adSkipSpeed'],
                    })
                  }
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-slate-100"
                >
                  <option value="8">8× Lebih Cepat</option>
                  <option value="16">16× (Maksimal)</option>
                  <option value="instant">Langsung Lompat Akhir</option>
                </select>
              </div>
            </div>

            <label className="flex items-center justify-between bg-slate-800/80 border border-slate-700/70 rounded-lg px-2.5 py-1.5 text-[10.5px] cursor-pointer">
              <span>⚡ Bypass Shortlink Debloated (BloggerPemula)</span>
              <input
                type="checkbox"
                data-testid="toggle-shortlink-bypass"
                checked={globalSettings.shortlinkBypassEnabled !== false}
                onChange={(e) =>
                  onUpdateGlobalSettings({
                    ...globalSettings,
                    shortlinkBypassEnabled: e.target.checked,
                  })
                }
                className="accent-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between bg-slate-800/80 border border-slate-700/70 rounded-lg px-2.5 py-1.5 text-[10.5px] cursor-pointer">
              <span>Auto-Klik & Submit Langkah Shortlink</span>
              <input
                type="checkbox"
                data-testid="toggle-shortlink-autoclick"
                checked={globalSettings.shortlinkAutoClick !== false}
                onChange={(e) =>
                  onUpdateGlobalSettings({
                    ...globalSettings,
                    shortlinkAutoClick: e.target.checked,
                  })
                }
                className="accent-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between bg-slate-800/80 border border-slate-700/70 rounded-lg px-2.5 py-1.5 text-[10.5px] cursor-pointer">
              <span>📋 Catat Log Diagnostik Navigasi</span>
              <input
                type="checkbox"
                data-testid="toggle-logging-enabled"
                checked={globalSettings.loggingEnabled !== false}
                onChange={(e) =>
                  onUpdateGlobalSettings({
                    ...globalSettings,
                    loggingEnabled: e.target.checked,
                  })
                }
                className="accent-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between bg-slate-800/80 border border-slate-700/70 rounded-lg px-2.5 py-1.5 text-[10.5px] cursor-pointer">
              <span>AI Smart UGC & Deteksi Gambar Tersusupi Iklan</span>
              <input
                type="checkbox"
                data-testid="toggle-smart-ugc-sense"
                checked={globalSettings.smartUgcSense !== false}
                onChange={(e) =>
                  onUpdateGlobalSettings({
                    ...globalSettings,
                    smartUgcSense: e.target.checked,
                  })
                }
                className="accent-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between bg-slate-800/80 border border-slate-700/70 rounded-lg px-2.5 py-1.5 text-[10.5px] cursor-pointer">
              <span>Hapus Overlay Transparan Jebakan</span>
              <input
                type="checkbox"
                checked={globalSettings.removeTransparentOverlay}
                onChange={(e) =>
                  onUpdateGlobalSettings({
                    ...globalSettings,
                    removeTransparentOverlay: e.target.checked,
                  })
                }
                className="accent-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between bg-slate-800/80 border border-slate-700/70 rounded-lg px-2.5 py-1.5 text-[10.5px] cursor-pointer">
              <span>Anti-History Trap (Tombol Back)</span>
              <input
                type="checkbox"
                checked={globalSettings.antiHistoryTrap}
                onChange={(e) =>
                  onUpdateGlobalSettings({
                    ...globalSettings,
                    antiHistoryTrap: e.target.checked,
                  })
                }
                className="accent-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between bg-slate-800/80 border border-slate-700/70 rounded-lg px-2.5 py-1.5 text-[10.5px] cursor-pointer">
              <span>Blokir Jaringan DNR (Blacklist)</span>
              <input
                type="checkbox"
                checked={globalSettings.dnrEnabled}
                onChange={(e) =>
                  onUpdateGlobalSettings({
                    ...globalSettings,
                    dnrEnabled: e.target.checked,
                  })
                }
                className="accent-emerald-500"
              />
            </label>

            {/* SLIDER KELOMPOK 4 DI BAGIAN BAWAH (TIMER BATAS REDIRECT AUTO-REVERT) */}
            <div
              data-testid="sliders-group-protection"
              className="pt-2 border-t border-dashed border-slate-700/80 space-y-1.5"
            >
              <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                Slider Timer Proteksi Redirect
              </div>

              <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2">
                <div className="flex items-center justify-between text-[10.5px] font-semibold mb-1">
                  <span>⏱️ Timer Batas Redirect Auto-Revert</span>
                  <span
                    data-testid="popup-redirect-window-val"
                    className="font-mono text-[10.5px] font-bold text-emerald-400 tabular-nums"
                  >
                    {safeRedirectWindowSec.toFixed(1)} detik
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="popup-redirect-window-slider"
                  aria-label="Timer Batas Redirect Auto-Revert"
                  min="1"
                  max="10"
                  step="0.5"
                  value={safeRedirectWindowSec}
                  onChange={(e) => {
                    const nextSec = Number(e.target.value);
                    onUpdateGlobalSettings({
                      ...globalSettings,
                      redirectWindowSec: nextSec,
                    });
                    showStatus(
                      `Timer Batas Redirect Auto-Revert diatur ke ${nextSec.toFixed(1)} detik`
                    );
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => showStatus('Setting v2.2.7 berhasil disimpan!')}
              className="py-1.5 px-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-[11px] cursor-pointer"
            >
              💾 Simpan Setting
            </button>
            <button
              type="button"
              onClick={() => {
                onResetGlobalSettings();
                showStatus('Setting & posisi HUD dikembalikan ke default!');
              }}
              className="py-1.5 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 font-semibold text-[10.5px] cursor-pointer"
            >
              ↺ Reset Default
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: LOG DIAGNOSTIK (COPY-PASTE) */}
      {activeTab === 'logs' && (
        <div data-testid="popup-panel-logs" className="space-y-2 text-xs">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Salin log ini untuk melihat penyebab pasti gagal lanjut ke link tujuan (<code>transitionType</code>, <code>qualifiers</code>, alasan blokir, atau hasil Bypass Shortlink).
          </p>
          <div className="grid grid-cols-4 gap-1">
            {(
              [
                { id: 'ALL', label: 'Semua' },
                { id: 'BLOCK', label: '🚫 Blokir' },
                { id: 'BYPASS', label: '⚡ Bypass' },
                { id: 'ALLOW', label: '✅ Lolos' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                data-testid={`log-filter-${f.id.toLowerCase()}`}
                onClick={() => setLogFilter(f.id)}
                className={`py-1 px-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                  logFilter === f.id
                    ? 'bg-slate-950 text-amber-300 border-amber-400'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <textarea
            data-testid="popup-log-textarea"
            aria-label="Log Diagnostik AEGIS-AI"
            readOnly
            value={formattedLogText}
            rows={10}
            className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-[9.5px] leading-relaxed text-slate-200 whitespace-pre overflow-auto resize-y"
          />

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              data-testid="popup-copy-log-btn"
              onClick={handleCopyLogs}
              className="py-1.5 px-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-[11px] cursor-pointer"
            >
              📋 Salin Log
            </button>
            <button
              type="button"
              data-testid="popup-clear-log-btn"
              onClick={() => {
                onClearLogs();
                showStatus('Log diagnostik dibersihkan!');
              }}
              className="py-1.5 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 font-semibold text-[10.5px] cursor-pointer"
            >
              🧹 Hapus Log
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: BLACKLIST */}
      {activeTab === 'blacklist' && (
        <div className="space-y-2 text-xs">
          <p className="text-[11px] text-slate-400">
            Domain di Blacklist diblokir langsung di level jaringan (DNR) tanpa membuka koneksi.
          </p>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={blacklistInput}
              onChange={(e) => setBlacklistInput(e.target.value)}
              placeholder="contoh: hai8g.com"
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-slate-700 bg-slate-800 text-white text-[11px]"
            />
            <button
              type="button"
              onClick={() => {
                if (blacklistInput.trim()) {
                  onAddDenied(blacklistInput.trim().toLowerCase());
                  setBlacklistInput('');
                  showStatus('Domain ditambahkan ke Blacklist DNR.');
                }
              }}
              className="px-2.5 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] cursor-pointer shrink-0"
            >
              + Blokir
            </button>
          </div>
          <div className="max-h-[170px] overflow-y-auto bg-slate-950 border border-slate-800 rounded-md p-1.5 space-y-1">
            {deniedDomains.map((dom) => (
              <div
                key={dom}
                className="flex items-center justify-between px-2 py-1 border-b border-slate-900 last:border-b-0 text-[11px]"
              >
                <span className="font-mono text-slate-200">{dom}</span>
                <button
                  type="button"
                  onClick={() => onRemoveDenied(dom)}
                  aria-label={`Hapus ${dom} dari Blacklist`}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-rose-600 text-rose-300 hover:text-white text-[10px] font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: WHITELIST */}
      {activeTab === 'whitelist' && (
        <div className="space-y-2 text-xs">
          <p className="text-[11px] text-slate-400">
            Domain di Whitelist diizinkan bebas tanpa ditahan oleh HUD.
          </p>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={whitelistInput}
              onChange={(e) => setWhitelistInput(e.target.value)}
              placeholder="contoh: drive.google.com"
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-slate-700 bg-slate-800 text-white text-[11px]"
            />
            <button
              type="button"
              onClick={() => {
                if (whitelistInput.trim()) {
                  onAddTrusted(whitelistInput.trim().toLowerCase());
                  setWhitelistInput('');
                  showStatus('Domain ditambahkan ke Whitelist.');
                }
              }}
              className="px-2.5 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-[11px] cursor-pointer shrink-0"
            >
              + Izinkan
            </button>
          </div>
          <div className="max-h-[170px] overflow-y-auto bg-slate-950 border border-slate-800 rounded-md p-1.5 space-y-1">
            {trustedDomains.map((dom) => (
              <div
                key={dom}
                className="flex items-center justify-between px-2 py-1 border-b border-slate-900 last:border-b-0 text-[11px]"
              >
                <span className="font-mono text-slate-200">{dom}</span>
                <button
                  type="button"
                  onClick={() => onRemoveTrusted(dom)}
                  aria-label={`Hapus ${dom} dari Whitelist`}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-rose-600 text-rose-300 hover:text-white text-[10px] font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Footer */}
      <div className="mt-2.5 min-h-[16px] text-center text-[11px] text-sky-400 font-medium">
        {statusMsg}
      </div>
    </div>
  );
};
