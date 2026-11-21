import React, { useState } from 'react';
import { AllHudPositions, SavedHudCoord } from '../utils/hudPositionMath';
import {
  AegisLogEntry,
  AegisLogLevel,
  formatAegisLogsForCopy,
} from '../utils/shortlinkBypassEngine';
import { buildSanitizedFalsePositiveReport } from '../ext/shared/debug.js';
import { exportHostlistText, parseHostlistText } from '../ext/shared/domain-utils.js';
import { buildConsolidatedDnrRules } from '../ext/shared/dnr-builder.js';
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
  onBulkAddDenied?: (domains: string[]) => void;
  onBulkAddTrusted?: (domains: string[]) => void;
  diagnosticLogs: AegisLogEntry[];
  onClearLogs: () => void;
  localStats?: { blocked: number; bypassed: number; allowed: number };
  onResetStats?: () => void;
  tempAllowMinutesLeft?: number | null;
  onSetTempAllow?: (minutes: number | null) => void;
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
  onBulkAddDenied,
  onBulkAddTrusted,
  diagnosticLogs,
  onClearLogs,
  localStats = { blocked: 0, bypassed: 0, allowed: 0 },
  onResetStats,
  tempAllowMinutesLeft = null,
  onSetTempAllow,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'global' | 'logs' | 'blacklist' | 'whitelist'>('general');
  const [logFilter, setLogFilter] = useState<'ALL' | AegisLogLevel>('ALL');
  const [autoSkip, setAutoSkip] = useState(true);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [blacklistInput, setBlacklistInput] = useState('');
  const [whitelistInput, setWhitelistInput] = useState('');
  const [backupDrawerOpen, setBackupDrawerOpen] = useState(false);
  const [backupText, setBackupText] = useState('');
  const [blImportOpen, setBlImportOpen] = useState(false);
  const [blImportText, setBlImportText] = useState('');
  const [wlImportOpen, setWlImportOpen] = useState(false);
  const [wlImportText, setWlImportText] = useState('');
  const [fpPreview, setFpPreview] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  const isLight = globalSettings.popupTheme === 'light';
  const protectionMode = globalSettings.protectionMode === 'strict' ? 'strict' : 'balanced';

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
      version: '3.2.1',
      strictCrossOrigin: protectionMode === 'strict',
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
      showStatus('Backup JSON v3.2.1 (API Key tidak ikut) tersalin!');
    } catch {
      showStatus('JSON Backup v3.2.1 ditampilkan di bawah.');
    }
  };

  const formattedLogText = formatAegisLogsForCopy(diagnosticLogs, logFilter, '3.2.1');

  const handleCopyLogs = async () => {
    setFpPreview(null);
    try {
      await navigator.clipboard.writeText(formattedLogText);
      showStatus('Log diagnostik v3.2.1 tersalin ke Clipboard!');
    } catch {
      showStatus('Silakan pilih teks di kotak log lalu salin (Ctrl+C).');
    }
  };

  const handleCopyFpReport = async () => {
    const report = buildSanitizedFalsePositiveReport({
      version: '3.2.1',
      activeUrl: 'https://www.semprot.com/threads/demo?token=secret12345',
      protectionMode,
      tempAllowActive: Boolean(tempAllowMinutesLeft),
      logs: diagnosticLogs,
      stats: localStats,
    });
    setFpPreview(report);
    try {
      await navigator.clipboard.writeText(report);
      showStatus('🛡️ Laporan False Positive (tersensor) tersalin!');
    } catch {
      showStatus('🛡️ Laporan FP tersensor ditampilkan di kotak log.');
    }
  };

  const dnrBuilt = buildConsolidatedDnrRules(deniedDomains, 5000, 150);

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
    <div
      data-testid="popup-simulator-root"
      data-theme={isLight ? 'light' : 'dark'}
      className={`w-full rounded-xl p-4 shadow-xl border transition-colors ${
        isLight
          ? 'bg-slate-50 border-slate-300 text-slate-900'
          : 'bg-[#0f172a] border-slate-800 text-slate-50'
      }`}
    >
      {/* Popup Header + Theme Toggle */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2">
          <h3 className={`m-0 text-sm font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
            ⚡ AEGIS-AI Shield
          </h3>
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
              isLight
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
            }`}
          >
            v3.2.1
          </span>
        </div>
        <button
          type="button"
          data-testid="popup-theme-toggle"
          onClick={() => {
            const nextTheme = isLight ? 'dark' : 'light';
            onUpdateGlobalSettings({ ...globalSettings, popupTheme: nextTheme });
            showStatus(nextTheme === 'light' ? 'Tema Popup: Terang ☀️' : 'Tema Popup: Gelap 🌙');
          }}
          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer ${
            isLight
              ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
          }`}
        >
          {isLight ? '🌙 Gelap' : '☀️ Terang'}
        </button>
      </div>

      {/* Quick Safe Mode / Temporary Allow Bar */}
      <div
        data-testid="popup-safe-mode-bar"
        className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 mb-2 border text-[10px] ${
          tempAllowMinutesLeft
            ? 'bg-amber-500/15 border-amber-500/60'
            : isLight
            ? 'bg-white border-slate-300'
            : 'bg-slate-900/90 border-slate-800'
        }`}
      >
        <div className="min-w-0">
          <div className="font-mono font-bold truncate">semprot.com</div>
          <div className={`text-[9.5px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            {tempAllowMinutesLeft
              ? `⏸ Safe Mode aktif (${tempAllowMinutesLeft}m · Blacklist tetap blokir)`
              : protectionMode === 'strict'
              ? '🔒 Mode Strict aktif'
              : '⚖️ Mode Balanced aktif'}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!tempAllowMinutesLeft ? (
            <>
              <button
                type="button"
                data-testid="popup-temp-allow-15"
                onClick={() => {
                  onSetTempAllow?.(15);
                  showStatus('⏸ Safe Mode aktif 15 menit untuk semprot.com');
                }}
                className={`px-1.5 py-1 rounded border text-[9.5px] font-bold cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 border-slate-300 text-slate-800 hover:border-emerald-600'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-emerald-400'
                }`}
              >
                ⏸ 15m
              </button>
              <button
                type="button"
                data-testid="popup-temp-allow-60"
                onClick={() => {
                  onSetTempAllow?.(60);
                  showStatus('⏸ Safe Mode aktif 1 jam untuk semprot.com');
                }}
                className={`px-1.5 py-1 rounded border text-[9.5px] font-bold cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 border-slate-300 text-slate-800 hover:border-emerald-600'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-emerald-400'
                }`}
              >
                1 Jam
              </button>
            </>
          ) : (
            <button
              type="button"
              data-testid="popup-temp-allow-clear"
              onClick={() => {
                onSetTempAllow?.(null);
                showStatus('🛡️ Proteksi diaktifkan kembali untuk semprot.com');
              }}
              className="px-2 py-1 rounded border border-amber-500 bg-amber-500/20 text-amber-400 text-[9.5px] font-bold cursor-pointer"
            >
              ▶ Aktifkan
            </button>
          )}
        </div>
      </div>

      {/* Local Zero-Telemetry Stats Strip */}
      <div
        data-testid="popup-stats-strip"
        className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 mb-2.5 border text-[10px] ${
          isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-950 border-slate-800'
        }`}
      >
        <div className="flex items-center gap-3 font-bold tabular-nums">
          <span className="text-rose-400" data-testid="stat-blocked">
            🚫 {localStats.blocked}
          </span>
          <span className="text-amber-400" data-testid="stat-bypassed">
            ⚡ {localStats.bypassed}
          </span>
          <span className="text-emerald-400" data-testid="stat-allowed">
            ✅ {localStats.allowed}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            onResetStats?.();
            showStatus('↺ Statistik lokal direset');
          }}
          className="text-[9.5px] text-slate-400 hover:text-sky-400 cursor-pointer"
        >
          ↺ Reset
        </button>
      </div>

      {/* 5 Navigation Tabs */}
      <div
        className={`grid grid-cols-5 gap-0.5 p-1 rounded-lg border mb-3 ${
          isLight ? 'bg-slate-200 border-slate-300' : 'bg-slate-950 border-slate-800'
        }`}
      >
        <button
          type="button"
          data-testid="popup-tab-general"
          onClick={() => setActiveTab('general')}
          className={`py-1.5 px-0.5 rounded-md text-[9.5px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'general'
              ? isLight
                ? 'bg-white text-slate-900 shadow-xs'
                : 'bg-slate-800 text-white'
              : isLight
              ? 'text-slate-600 hover:text-slate-900'
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
              ? isLight
                ? 'bg-white text-sky-700 border-b-2 border-sky-600'
                : 'bg-slate-800 text-sky-400 border-b-2 border-sky-400'
              : isLight
              ? 'text-slate-600 hover:text-slate-900'
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
              ? isLight
                ? 'bg-white text-amber-700 border-b-2 border-amber-500'
                : 'bg-slate-800 text-amber-300 border-b-2 border-amber-400'
              : isLight
              ? 'text-slate-600 hover:text-slate-900'
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
              ? isLight
                ? 'bg-white text-rose-700 border-b-2 border-rose-500'
                : 'bg-slate-800 text-rose-300 border-b-2 border-rose-500'
              : isLight
              ? 'text-slate-600 hover:text-slate-900'
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
              ? isLight
                ? 'bg-white text-emerald-700 border-b-2 border-emerald-600'
                : 'bg-slate-800 text-emerald-300 border-b-2 border-emerald-500'
              : isLight
              ? 'text-slate-600 hover:text-slate-900'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ✅ Trust ({trustedDomains.length})
        </button>
      </div>

      {/* TAB 1: UMUM */}
      {activeTab === 'general' && (
        <div className="space-y-2 text-xs">
          {/* Balanced vs Strict Selector */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              data-testid="popup-mode-balanced"
              onClick={() => {
                onUpdateGlobalSettings({ ...globalSettings, protectionMode: 'balanced' });
                showStatus('⚖️ Mode Balanced aktif (ramah OAuth & SPA)');
              }}
              className={`p-2 rounded-lg border text-left cursor-pointer transition-colors ${
                protectionMode === 'balanced'
                  ? 'border-emerald-500 bg-emerald-500/15'
                  : isLight
                  ? 'border-slate-300 bg-white'
                  : 'border-slate-700 bg-slate-800/80'
              }`}
            >
              <div className="text-[10.5px] font-extrabold">⚖️ Balanced</div>
              <div className={`text-[9.5px] mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Rekomendasi. Ramah SPA/OAuth.
              </div>
            </button>
            <button
              type="button"
              data-testid="popup-mode-strict"
              onClick={() => {
                onUpdateGlobalSettings({ ...globalSettings, protectionMode: 'strict' });
                showStatus('🔒 Mode Strict aktif (tahan semua lintas-domain)');
              }}
              className={`p-2 rounded-lg border text-left cursor-pointer transition-colors ${
                protectionMode === 'strict'
                  ? 'border-emerald-500 bg-emerald-500/15'
                  : isLight
                  ? 'border-slate-300 bg-white'
                  : 'border-slate-700 bg-slate-800/80'
              }`}
            >
              <div className="text-[10.5px] font-extrabold">🔒 Strict</div>
              <div className={`text-[9.5px] mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Tahan semua non-whitelist.
              </div>
            </button>
          </div>

          <label
            className={`flex items-center justify-between border rounded-md px-2.5 py-2 text-[11px] cursor-pointer ${
              isLight ? 'bg-white border-slate-300' : 'bg-slate-800/90 border-slate-700'
            }`}
          >
            <span>Auto-Skip Countdown Video (Lazy)</span>
            <input
              type="checkbox"
              checked={autoSkip}
              onChange={(e) => {
                setAutoSkip(e.target.checked);
                showStatus(
                  e.target.checked ? 'Lazy Auto-Skip: AKTIF' : 'Lazy Auto-Skip: NONAKTIF'
                );
              }}
              className="accent-emerald-500"
            />
          </label>

          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Opsional: Gemini API Key (AIza...)"
            className={`w-full px-2.5 py-1.5 rounded-md border text-[11.5px] outline-none focus:border-emerald-500 ${
              isLight
                ? 'border-slate-300 bg-white text-slate-900'
                : 'border-slate-700 bg-slate-800 text-white'
            }`}
          />

          <label
            className={`flex items-center justify-between border rounded-md px-2.5 py-1.5 text-[10.5px] cursor-pointer ${
              isLight ? 'bg-white border-slate-300' : 'bg-slate-800/90 border-slate-700'
            }`}
          >
            <span>🔒 Simpan Key Sesi Ini Saja (storage.session)</span>
            <input
              type="checkbox"
              data-testid="popup-session-only-key"
              checked={Boolean(globalSettings.sessionOnlyApiKey)}
              onChange={(e) => {
                onUpdateGlobalSettings({
                  ...globalSettings,
                  sessionOnlyApiKey: e.target.checked,
                });
                showStatus(
                  e.target.checked
                    ? '🔒 API Key disimpan di memori sesi saja'
                    : '💾 API Key disimpan di storage lokal'
                );
              }}
              className="accent-emerald-500"
            />
          </label>

          <button
            type="button"
            onClick={() => showStatus('Konfigurasi Umum v3.2.1 tersimpan!')}
            className="w-full py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-[11.5px] cursor-pointer"
          >
            Simpan Konfigurasi
          </button>

          <div className={`pt-2 border-t ${isLight ? 'border-slate-300' : 'border-slate-800'}`}>
            <div className="text-[10.5px] font-semibold text-slate-400 mb-1.5">
              Cadangan & Transfer Data JSON v3.2.1
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={handleCopyBackup}
                className={`py-1.5 px-2 rounded-md border font-semibold text-[10.5px] cursor-pointer ${
                  isLight
                    ? 'bg-white hover:bg-slate-100 text-sky-700 border-slate-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-sky-300 border-slate-700'
                }`}
              >
                📋 Salin Backup
              </button>
              <button
                type="button"
                onClick={() => setBackupDrawerOpen((v) => !v)}
                className={`py-1.5 px-2 rounded-md border font-semibold text-[10.5px] cursor-pointer ${
                  isLight
                    ? 'bg-white hover:bg-slate-100 text-sky-700 border-slate-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-sky-300 border-slate-700'
                }`}
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
                  placeholder="Tempel JSON cadangan v3.2.1 di sini..."
                  className="w-full p-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-slate-200"
                />
              </div>
            )}
          </div>

          <details
            className={`rounded-lg border px-2.5 py-2 text-[10px] ${
              isLight ? 'bg-white border-slate-300 text-slate-600' : 'bg-slate-900/90 border-slate-800 text-slate-400'
            }`}
          >
            <summary className="cursor-pointer font-bold text-sky-400">
              📘 Panduan Singkat: Grace Period, Safe Mode &amp; Bypass
            </summary>
            <ul className="mt-1.5 pl-4 list-disc space-y-1">
              <li>
                <strong>Balanced vs Strict:</strong> Balanced blokir judol/affiliate sambil ramah
                login OAuth &amp; SPA.
              </li>
              <li>
                <strong>Safe Mode 15m/1j:</strong> Jeda proteksi agresif sementara pada 1 situs
                tanpa melepas Blacklist.
              </li>
              <li>
                <strong>CAPTCHA Kill-Switch:</strong> Mematikan timer acceleration &amp; auto-click
                saat Turnstile/reCAPTCHA muncul.
              </li>
            </ul>
          </details>
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
              <span>🐞 Catat Error Internal (Level DEBUG)</span>
              <input
                type="checkbox"
                data-testid="toggle-debug-errors"
                checked={Boolean(globalSettings.debugInternalErrors)}
                onChange={(e) =>
                  onUpdateGlobalSettings({
                    ...globalSettings,
                    debugInternalErrors: e.target.checked,
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
              onClick={() => showStatus('Setting v3.2.1 berhasil disimpan!')}
              className="py-1.5 px-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-[11px] cursor-pointer"
            >
              💾 Simpan Setting
            </button>
            <button
              type="button"
              onClick={() => {
                onResetGlobalSettings();
                showStatus('Setting & posisi HUD dikembalikan ke default v3.2.1!');
              }}
              className="py-1.5 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 font-semibold text-[10.5px] cursor-pointer"
            >
              ↺ Reset Default
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: LOG DIAGNOSTIK + LAPORAN FALSE POSITIVE TERSENSOR */}
      {activeTab === 'logs' && (
        <div data-testid="popup-panel-logs" className="space-y-2 text-xs">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Salin log diagnostik atau klik <strong>🛡️ Laporan FP (Aman)</strong> untuk menyalin
            laporan False Positive dengan query sensitif &amp; API key otomatis disensor.
          </p>
          <div className="grid grid-cols-5 gap-1">
            {(
              [
                { id: 'ALL', label: 'Semua' },
                { id: 'BLOCK', label: '🚫 Blok' },
                { id: 'BYPASS', label: '⚡ Byp' },
                { id: 'ALLOW', label: '✅ Lolos' },
                { id: 'DEBUG', label: '🐞 Dbg' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                data-testid={`log-filter-${f.id.toLowerCase()}`}
                onClick={() => {
                  setFpPreview(null);
                  setLogFilter(f.id);
                }}
                className={`py-1 px-0.5 rounded text-[9.5px] font-bold border transition-colors cursor-pointer ${
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
            value={fpPreview ?? formattedLogText}
            rows={10}
            className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-[9.5px] leading-relaxed text-slate-200 whitespace-pre overflow-auto resize-y"
          />

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              data-testid="popup-copy-log-btn"
              onClick={handleCopyLogs}
              className="py-1.5 px-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-[10.5px] cursor-pointer"
            >
              📋 Salin Log
            </button>
            <button
              type="button"
              data-testid="popup-copy-fp-btn"
              onClick={handleCopyFpReport}
              className="py-1.5 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/50 font-bold text-[10.5px] cursor-pointer"
            >
              🛡️ Laporan FP (Aman)
            </button>
          </div>
          <button
            type="button"
            data-testid="popup-clear-log-btn"
            onClick={() => {
              setFpPreview(null);
              onClearLogs();
              showStatus('Log diagnostik dibersihkan!');
            }}
            className="w-full py-1.5 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 font-semibold text-[10.5px] cursor-pointer"
          >
            🧹 Hapus Log
          </button>
        </div>
      )}

      {/* TAB 4: BLACKLIST + DNR CONSOLIDATION + HOSTLIST .TXT */}
      {activeTab === 'blacklist' && (
        <div className="space-y-2 text-xs">
          <div
            data-testid="popup-dnr-stats"
            className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-[10px]"
          >
            <span className="text-slate-400">DNR Terkonsolidasi (150/rule):</span>
            <strong className="font-mono text-emerald-400">
              {dnrBuilt.totalDomains} domain · {dnrBuilt.ruleCount}/{dnrBuilt.maxRules} rule
            </strong>
          </div>
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
          <div className="max-h-[150px] overflow-y-auto bg-slate-950 border border-slate-800 rounded-md p-1.5 space-y-1">
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
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              data-testid="popup-export-bl-txt"
              onClick={() => {
                const txt = exportHostlistText(deniedDomains, 'AEGIS-AI Shield v3.2.1 Blacklist');
                setBlImportText(txt);
                setBlImportOpen(true);
                try {
                  navigator.clipboard.writeText(txt);
                  showStatus('📤 Hostlist Blacklist (.txt) tersalin!');
                } catch {
                  showStatus('📤 Hostlist .txt ditampilkan di bawah.');
                }
              }}
              className="py-1.5 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-semibold text-[10px] cursor-pointer"
            >
              📤 Export .txt
            </button>
            <button
              type="button"
              data-testid="popup-toggle-import-bl-txt"
              onClick={() => setBlImportOpen((v) => !v)}
              className="py-1.5 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-semibold text-[10px] cursor-pointer"
            >
              📥 Import .txt
            </button>
          </div>
          {blImportOpen && (
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-700 space-y-1.5">
              <textarea
                data-testid="popup-bl-txt-area"
                value={blImportText}
                onChange={(e) => setBlImportText(e.target.value)}
                rows={3}
                placeholder="0.0.0.0 ads.example.top&#10;||tracker.xyz^"
                className="w-full p-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-slate-200"
              />
              <button
                type="button"
                data-testid="popup-apply-import-bl-txt"
                onClick={() => {
                  const parsed = parseHostlistText(blImportText);
                  if (parsed.length > 0) {
                    onBulkAddDenied?.(parsed);
                    setBlImportText('');
                    setBlImportOpen(false);
                    showStatus(`✅ ${parsed.length} domain diimport ke Blacklist!`);
                  } else {
                    showStatus('⚠️ Tidak ada domain valid di Hostlist.');
                  }
                }}
                className="w-full py-1 rounded bg-emerald-500 text-emerald-950 font-bold text-[10.5px] cursor-pointer"
              >
                ✓ Import Hostlist ke Blacklist
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: WHITELIST + HOSTLIST .TXT */}
      {activeTab === 'whitelist' && (
        <div className="space-y-2 text-xs">
          <p className="text-[11px] text-slate-400">
            Domain di Whitelist diizinkan bebas di mode Balanced maupun Strict.
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
          <div className="max-h-[150px] overflow-y-auto bg-slate-950 border border-slate-800 rounded-md p-1.5 space-y-1">
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
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                const txt = exportHostlistText(trustedDomains, 'AEGIS-AI Shield v3.2.1 Whitelist');
                setWlImportText(txt);
                setWlImportOpen(true);
                try {
                  navigator.clipboard.writeText(txt);
                  showStatus('📤 Hostlist Whitelist (.txt) tersalin!');
                } catch {
                  showStatus('📤 Hostlist Whitelist ditampilkan di bawah.');
                }
              }}
              className="py-1.5 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-semibold text-[10px] cursor-pointer"
            >
              📤 Export .txt
            </button>
            <button
              type="button"
              onClick={() => setWlImportOpen((v) => !v)}
              className="py-1.5 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-semibold text-[10px] cursor-pointer"
            >
              📥 Import .txt
            </button>
          </div>
          {wlImportOpen && (
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-700 space-y-1.5">
              <textarea
                value={wlImportText}
                onChange={(e) => setWlImportText(e.target.value)}
                rows={3}
                placeholder="semprot.com&#10;kaskus.co.id"
                className="w-full p-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-slate-200"
              />
              <button
                type="button"
                onClick={() => {
                  const parsed = parseHostlistText(wlImportText);
                  if (parsed.length > 0) {
                    onBulkAddTrusted?.(parsed);
                    setWlImportText('');
                    setWlImportOpen(false);
                    showStatus(`✅ ${parsed.length} domain diimport ke Whitelist!`);
                  }
                }}
                className="w-full py-1 rounded bg-emerald-500 text-emerald-950 font-bold text-[10.5px] cursor-pointer"
              >
                ✓ Import Hostlist ke Whitelist
              </button>
            </div>
          )}
        </div>
      )}

      {/* Status Footer */}
      <div className="mt-2.5 min-h-[16px] text-center text-[11px] text-sky-400 font-medium">
        {statusMsg}
      </div>
    </div>
  );
};
