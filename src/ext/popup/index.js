// @ts-check
/**
 * AEGIS-AI Shield v3.2.1 — Modular Popup Controller
 * Shares pure domain, debug, DNR, migration, and constant utilities with the rest of the extension.
 */
import {
  AEGIS_VERSION,
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_HUD_POSITIONS,
  DEFAULT_STATS,
  DEFAULT_TRUSTED_DOMAINS,
  TIMINGS
} from "../shared/constants.js";
import { buildSanitizedFalsePositiveReport } from "../shared/debug.js";
import {
  exportHostlistText,
  getHostname,
  getTemporaryAllowState,
  normalizeDomainEntry,
  parseHostlistText
} from "../shared/domain-utils.js";
import { buildConsolidatedDnrRules } from "../shared/dnr-builder.js";
import { migrateExtensionStorage, sanitizeGlobalSettings } from "../shared/migration.js";

const statusEl = /** @type {HTMLElement} */ (document.getElementById("status"));
const apiKeyEl = /** @type {HTMLInputElement} */ (document.getElementById("apiKey"));
const geminiAuditEnabledEl = /** @type {HTMLInputElement | null} */ (
  document.getElementById("geminiAuditEnabledToggle")
);
const sessionOnlyKeyEl = /** @type {HTMLInputElement} */ (document.getElementById("sessionOnlyKeyToggle"));
const persistentKeyWarningEl = /** @type {HTMLElement | null} */ (
  document.getElementById("persistentKeyWarning")
);
const autoSkipEl = /** @type {HTMLInputElement} */ (document.getElementById("autoSkipToggle"));
const autoSkipConfirmBox = /** @type {HTMLElement | null} */ (
  document.getElementById("autoSkipConfirmBox")
);
const shortlinkAutoClickConfirmBox = /** @type {HTMLElement | null} */ (
  document.getElementById("shortlinkAutoClickConfirmBox")
);
const themeToggleBtn = /** @type {HTMLButtonElement} */ (document.getElementById("themeToggleBtn"));

const modeBalancedBtn = /** @type {HTMLButtonElement} */ (document.getElementById("modeBalancedBtn"));
const modeStrictBtn = /** @type {HTMLButtonElement} */ (document.getElementById("modeStrictBtn"));

// Safe Mode / Temp Allow Bar
const safeModeBar = /** @type {HTMLElement} */ (document.getElementById("safeModeBar"));
const activeHostLabel = /** @type {HTMLElement} */ (document.getElementById("activeHostLabel"));
const safeModeStatusText = /** @type {HTMLElement} */ (document.getElementById("safeModeStatusText"));
const tempAllow15Btn = /** @type {HTMLButtonElement} */ (document.getElementById("tempAllow15Btn"));
const tempAllow60Btn = /** @type {HTMLButtonElement} */ (document.getElementById("tempAllow60Btn"));
const tempAllowClearBtn = /** @type {HTMLButtonElement} */ (document.getElementById("tempAllowClearBtn"));

// Local Stats Strip
const statBlockedEl = /** @type {HTMLElement} */ (document.getElementById("statBlocked"));
const statBypassedEl = /** @type {HTMLElement} */ (document.getElementById("statBypassed"));
const statAllowedEl = /** @type {HTMLElement} */ (document.getElementById("statAllowed"));
const resetStatsBtn = /** @type {HTMLButtonElement} */ (document.getElementById("resetStatsBtn"));

// Lists & DNR
const blacklistInput = /** @type {HTMLInputElement} */ (document.getElementById("blacklistInput"));
const whitelistInput = /** @type {HTMLInputElement} */ (document.getElementById("whitelistInput"));
const blacklistContainer = /** @type {HTMLElement} */ (document.getElementById("blacklistContainer"));
const whitelistContainer = /** @type {HTMLElement} */ (document.getElementById("whitelistContainer"));
const dnrStatsVal = /** @type {HTMLElement} */ (document.getElementById("dnrStatsVal"));
const tabLogs = /** @type {HTMLElement} */ (document.getElementById("tabLogs"));
const tabBlacklist = /** @type {HTMLElement} */ (document.getElementById("tabBlacklist"));
const tabWhitelist = /** @type {HTMLElement} */ (document.getElementById("tabWhitelist"));

// Logs
const logOutputArea = /** @type {HTMLTextAreaElement} */ (document.getElementById("logOutputArea"));
const copyLogBtn = /** @type {HTMLButtonElement} */ (document.getElementById("copyLogBtn"));
const copyFpReportBtn = /** @type {HTMLButtonElement} */ (document.getElementById("copyFpReportBtn"));
const refreshLogBtn = /** @type {HTMLButtonElement} */ (document.getElementById("refreshLogBtn"));
const clearLogBtn = /** @type {HTMLButtonElement} */ (document.getElementById("clearLogBtn"));

// Backup & AI Cache / Status
const aiCacheCountEl = /** @type {HTMLElement} */ (document.getElementById("aiCacheCount"));
const aiStatusBadgeEl = /** @type {HTMLElement | null} */ (document.getElementById("aiStatusBadge"));
const restoreDrawer = /** @type {HTMLElement} */ (document.getElementById("restoreDrawer"));
const backupJsonArea = /** @type {HTMLTextAreaElement} */ (document.getElementById("backupJsonArea"));

// Hostlist .txt Drawers
const importBlacklistDrawer = /** @type {HTMLElement} */ (document.getElementById("importBlacklistDrawer"));
const blacklistTxtArea = /** @type {HTMLTextAreaElement} */ (document.getElementById("blacklistTxtArea"));
const importWhitelistDrawer = /** @type {HTMLElement} */ (document.getElementById("importWhitelistDrawer"));
const whitelistTxtArea = /** @type {HTMLTextAreaElement} */ (document.getElementById("whitelistTxtArea"));

// Position statuses
const posStatusVideoDock = /** @type {HTMLElement} */ (document.getElementById("posStatusVideoDock"));
const posStatusTopHud = /** @type {HTMLElement} */ (document.getElementById("posStatusTopHud"));
const posStatusMiniPip = /** @type {HTMLElement} */ (document.getElementById("posStatusMiniPip"));

// Global Settings Inputs
const gInputs = {
  hudEnabled: /** @type {HTMLInputElement} */ (document.getElementById("hudEnabledToggle")),
  hudDurationRange: /** @type {HTMLInputElement} */ (document.getElementById("hudDurationRange")),
  hudDurationVal: /** @type {HTMLElement} */ (document.getElementById("hudDurationVal")),
  hudPosition: /** @type {HTMLSelectElement} */ (document.getElementById("hudPositionSelect")),
  hudOpacityRange: /** @type {HTMLInputElement} */ (document.getElementById("hudOpacityRange")),
  hudOpacityVal: /** @type {HTMLElement} */ (document.getElementById("hudOpacityVal")),
  hudScaleRange: /** @type {HTMLInputElement} */ (document.getElementById("hudScaleRange")),
  hudScaleVal: /** @type {HTMLElement} */ (document.getElementById("hudScaleVal")),
  hudShowTrust: /** @type {HTMLInputElement} */ (document.getElementById("hudShowTrust")),
  hudShowGroup: /** @type {HTMLInputElement} */ (document.getElementById("hudShowGroup")),
  hudShowOpen: /** @type {HTMLInputElement} */ (document.getElementById("hudShowOpen")),
  hudShowBlock: /** @type {HTMLInputElement} */ (document.getElementById("hudShowBlock")),
  hudShowUrlDetail: /** @type {HTMLInputElement} */ (document.getElementById("hudShowUrlDetail")),
  videoDockEnabled: /** @type {HTMLInputElement} */ (document.getElementById("videoDockEnabledToggle")),
  videoDockDimRange: /** @type {HTMLInputElement} */ (document.getElementById("videoDockDimRange")),
  videoDockDimVal: /** @type {HTMLElement} */ (document.getElementById("videoDockDimVal")),
  videoDockDir: /** @type {HTMLSelectElement} */ (document.getElementById("videoDockDirSelect")),
  videoPillScaleRange: /** @type {HTMLInputElement} */ (document.getElementById("videoPillScaleRange")),
  videoPillScaleVal: /** @type {HTMLElement} */ (document.getElementById("videoPillScaleVal")),
  videoPillOpacityRange: /** @type {HTMLInputElement} */ (document.getElementById("videoPillOpacityRange")),
  videoPillOpacityVal: /** @type {HTMLElement} */ (document.getElementById("videoPillOpacityVal")),
  vpShowPlayPause: /** @type {HTMLInputElement} */ (document.getElementById("vpShowPlayPause")),
  vpShowList: /** @type {HTMLInputElement} */ (document.getElementById("vpShowList")),
  vpShowDownload: /** @type {HTMLInputElement} */ (document.getElementById("vpShowDownload")),
  vpShowPip: /** @type {HTMLInputElement} */ (document.getElementById("vpShowPip")),
  vpShowFullscreen: /** @type {HTMLInputElement} */ (document.getElementById("vpShowFullscreen")),
  pipSize: /** @type {HTMLSelectElement} */ (document.getElementById("pipSizeSelect")),
  pipOpacityRange: /** @type {HTMLInputElement} */ (document.getElementById("pipOpacityRange")),
  pipOpacityVal: /** @type {HTMLElement} */ (document.getElementById("pipOpacityVal")),
  adSkipSpeed: /** @type {HTMLSelectElement} */ (document.getElementById("adSkipSpeedSelect")),
  shortlinkBypassEnabled: /** @type {HTMLInputElement} */ (document.getElementById("shortlinkBypassEnabledToggle")),
  shortlinkAutoClick: /** @type {HTMLInputElement} */ (document.getElementById("shortlinkAutoClickToggle")),
  loggingEnabled: /** @type {HTMLInputElement} */ (document.getElementById("loggingEnabledToggle")),
  debugInternalErrors: /** @type {HTMLInputElement} */ (document.getElementById("debugInternalErrorsToggle")),
  smartUgcSense: /** @type {HTMLInputElement} */ (document.getElementById("smartUgcSenseToggle")),
  removeOverlay: /** @type {HTMLInputElement} */ (document.getElementById("removeOverlayToggle")),
  captchaKillSwitch: /** @type {HTMLInputElement} */ (document.getElementById("captchaKillSwitchToggle")),
  antiHistory: /** @type {HTMLInputElement} */ (document.getElementById("antiHistoryToggle")),
  dnrEnabled: /** @type {HTMLInputElement} */ (document.getElementById("dnrEnabledToggle")),
  redirectWindowRange: /** @type {HTMLInputElement} */ (document.getElementById("redirectWindowRange")),
  redirectWindowVal: /** @type {HTMLElement} */ (document.getElementById("redirectWindowVal"))
};

/** @type {Array<any>} */
let cachedAegisLogs = [];
let activeLogFilter = "ALL";
let currentProtectionMode = "balanced";
let currentTheme = "dark";
let activeTabUrl = "";
let activeTabHost = "";
let cachedStats = { ...DEFAULT_STATS };
/** @type {Record<string, number>} */
let cachedTempAllowMap = {};

let statusTimer = null;
function showStatus(msg, color = "var(--sky)") {
  statusEl.textContent = msg;
  statusEl.style.color = color;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusEl.textContent = "";
  }, 3000);
}

function applyTheme(theme) {
  currentTheme = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", currentTheme);
  themeToggleBtn.textContent = currentTheme === "light" ? "🌙 Gelap" : "☀️ Terang";
}

function applyProtectionModeUI(mode) {
  currentProtectionMode = mode === "strict" ? "strict" : "balanced";
  modeBalancedBtn.classList.toggle("active", currentProtectionMode === "balanced");
  modeStrictBtn.classList.toggle("active", currentProtectionMode === "strict");
}

function updateStatsUI(stats) {
  cachedStats = {
    blocked: Number(stats?.blocked) || 0,
    bypassed: Number(stats?.bypassed) || 0,
    allowed: Number(stats?.allowed) || 0
  };
  statBlockedEl.textContent = String(cachedStats.blocked);
  statBypassedEl.textContent = String(cachedStats.bypassed);
  statAllowedEl.textContent = String(cachedStats.allowed);
}

function updatePersistentKeyWarning() {
  if (!persistentKeyWarningEl) return;
  persistentKeyWarningEl.classList.toggle("open", !sessionOnlyKeyEl.checked);
}

function updateAiStatusUI(aiStatus, hasKey, geminiEnabled = Boolean(geminiAuditEnabledEl?.checked)) {
  if (!aiStatusBadgeEl) return;
  if (!geminiEnabled) {
    aiStatusBadgeEl.textContent = "Nonaktif (Opt-In · Fallback Lokal)";
    aiStatusBadgeEl.style.color = "var(--muted)";
    return;
  }
  if (!aiStatus || typeof aiStatus !== "object") {
    aiStatusBadgeEl.textContent = hasKey ? "Gemini Siap (Opt-In Aktif)" : "Opt-In Aktif (Tanpa Key · Lokal)";
    aiStatusBadgeEl.style.color = hasKey ? "var(--accent)" : "var(--sky)";
    return;
  }
  const st = String(aiStatus.status || "");
  if (st === "ok") {
    aiStatusBadgeEl.textContent = "Gemini OK (Terverifikasi)";
    aiStatusBadgeEl.style.color = "var(--accent)";
  } else if (st === "cache") {
    aiStatusBadgeEl.textContent = "Gemini Cache (Hemat Kuota)";
    aiStatusBadgeEl.style.color = "var(--sky)";
  } else if (st === "fallback_local") {
    aiStatusBadgeEl.textContent = "Fallback Lokal (Aman)";
    aiStatusBadgeEl.style.color = "var(--amber)";
  } else if (st === "timeout" || st === "error") {
    aiStatusBadgeEl.textContent = `Fallback (${String(aiStatus.detail || st).slice(0, 28)})`;
    aiStatusBadgeEl.style.color = "var(--amber)";
  } else {
    aiStatusBadgeEl.textContent = hasKey ? "Gemini Siap" : "Fallback Lokal Aktif";
    aiStatusBadgeEl.style.color = "var(--accent)";
  }
}

function updateSafeModeUI() {
  if (!activeTabHost) {
    activeHostLabel.textContent = "Tab internal browser";
    safeModeStatusText.textContent = "Buka situs http/https untuk kontrol per-situs";
    safeModeBar.classList.remove("active");
    tempAllow15Btn.style.display = "none";
    tempAllow60Btn.style.display = "none";
    tempAllowClearBtn.style.display = "none";
    return;
  }

  activeHostLabel.textContent = activeTabHost;
  const st = getTemporaryAllowState(cachedTempAllowMap, activeTabUrl);
  if (st.active) {
    const mins = Math.max(1, Math.ceil(st.remainingMs / 60000));
    safeModeBar.classList.add("active");
    safeModeStatusText.textContent = `⏸ Safe Mode aktif (~${mins} menit tersisa · Blacklist tetap blokir)`;
    tempAllow15Btn.style.display = "none";
    tempAllow60Btn.style.display = "none";
    tempAllowClearBtn.style.display = "inline-block";
  } else {
    safeModeBar.classList.remove("active");
    safeModeStatusText.textContent =
      currentProtectionMode === "strict"
        ? "🔒 Mode Strict aktif pada situs ini"
        : "⚖️ Mode Balanced aktif pada situs ini";
    tempAllow15Btn.style.display = "inline-block";
    tempAllow60Btn.style.display = "inline-block";
    tempAllowClearBtn.style.display = "none";
  }
}

function updateRangeLabels() {
  const hudDur = Number(gInputs.hudDurationRange.value);
  gInputs.hudDurationVal.textContent = hudDur === 0 ? "Manual (Tetap)" : `${hudDur.toFixed(1)} detik`;

  const hudOp = Number(gInputs.hudOpacityRange.value);
  gInputs.hudOpacityVal.textContent = `${Math.round(hudOp * 100)}% (${hudOp.toFixed(2)})`;

  const hudSc = Number(gInputs.hudScaleRange.value);
  gInputs.hudScaleVal.textContent = `${Math.round(hudSc * 100)}% (${hudSc.toFixed(2)}×)`;

  const dimSec = Number(gInputs.videoDockDimRange.value);
  gInputs.videoDockDimVal.textContent = dimSec === 0 ? "Selalu Terbuka" : `${dimSec.toFixed(1)} detik`;

  const vpSc = Number(gInputs.videoPillScaleRange.value);
  gInputs.videoPillScaleVal.textContent = `${Math.round(vpSc * 100)}% (${vpSc.toFixed(2)}×)`;

  const vpOp = Number(gInputs.videoPillOpacityRange.value);
  gInputs.videoPillOpacityVal.textContent = `${Math.round(vpOp * 100)}% (${vpOp.toFixed(2)})`;

  const pipOp = Number(gInputs.pipOpacityRange.value);
  gInputs.pipOpacityVal.textContent = `${Math.round(pipOp * 100)}% (${pipOp.toFixed(2)})`;

  const rw = Number(gInputs.redirectWindowRange.value);
  gInputs.redirectWindowVal.textContent = `${rw.toFixed(1)} detik`;
}

function applyGlobalSettingsToUI(raw) {
  const g = sanitizeGlobalSettings(raw);
  applyProtectionModeUI(g.protectionMode);
  applyTheme(g.popupTheme);
  sessionOnlyKeyEl.checked = g.sessionOnlyApiKey !== false;
  updatePersistentKeyWarning();
  if (geminiAuditEnabledEl) {
    geminiAuditEnabledEl.checked = g.geminiAuditEnabled === true;
  }
  autoSkipEl.checked = g.autoSkipCountdown === true;

  gInputs.hudEnabled.checked = g.hudEnabled !== false;
  gInputs.hudDurationRange.value = String(g.hudDurationSec ?? 4.5);
  gInputs.hudPosition.value = g.hudPosition || "top-center";
  gInputs.hudOpacityRange.value = String(g.hudOpacity ?? 0.95);
  gInputs.hudScaleRange.value = String(g.hudScale ?? 1.0);
  gInputs.hudShowTrust.checked = g.hudShowTrust !== false;
  gInputs.hudShowGroup.checked = g.hudShowGroup !== false;
  gInputs.hudShowOpen.checked = g.hudShowOpen !== false;
  gInputs.hudShowBlock.checked = g.hudShowBlock !== false;
  gInputs.hudShowUrlDetail.checked = g.hudShowUrlDetail !== false;

  gInputs.videoDockEnabled.checked = g.videoDockEnabled !== false;
  gInputs.videoDockDimRange.value = String(g.videoDockDimSec ?? 2.5);
  gInputs.videoDockDir.value = g.videoDockExpandDir || "auto";
  gInputs.videoPillScaleRange.value = String(g.videoPillScale ?? 1.0);
  gInputs.videoPillOpacityRange.value = String(g.videoPillOpacity ?? 0.95);
  gInputs.vpShowPlayPause.checked = g.videoPillShowPlayPause !== false;
  gInputs.vpShowList.checked = g.videoPillShowList !== false;
  gInputs.vpShowDownload.checked = g.videoPillShowDownload !== false;
  gInputs.vpShowPip.checked = g.videoPillShowPip !== false;
  gInputs.vpShowFullscreen.checked = g.videoPillShowFullscreen !== false;

  gInputs.pipSize.value = g.pipSize || "medium";
  gInputs.pipOpacityRange.value = String(g.pipOpacity ?? 0.95);

  gInputs.adSkipSpeed.value = String(g.adSkipSpeed || "16");
  gInputs.shortlinkBypassEnabled.checked = g.shortlinkBypassEnabled !== false;
  gInputs.shortlinkAutoClick.checked = g.shortlinkAutoClick === true;
  gInputs.loggingEnabled.checked = g.loggingEnabled !== false;
  gInputs.debugInternalErrors.checked = Boolean(g.debugInternalErrors);
  gInputs.smartUgcSense.checked = g.smartUgcSense !== false;
  gInputs.removeOverlay.checked = g.removeTransparentOverlay !== false;
  if (gInputs.captchaKillSwitch) {
    gInputs.captchaKillSwitch.checked = g.captchaKillSwitchEnabled !== false;
  }
  gInputs.antiHistory.checked = g.antiHistoryTrap !== false;
  gInputs.dnrEnabled.checked = g.dnrEnabled !== false;
  gInputs.redirectWindowRange.value = String(g.redirectWindowSec ?? 3.5);
  updateRangeLabels();
  updateSafeModeUI();
}

function readGlobalSettingsFromUI() {
  return sanitizeGlobalSettings({
    protectionMode: currentProtectionMode,
    popupTheme: currentTheme,
    sessionOnlyApiKey: sessionOnlyKeyEl.checked,
    geminiAuditEnabled: Boolean(geminiAuditEnabledEl?.checked),
    autoSkipCountdown: autoSkipEl.checked,
    debugInternalErrors: gInputs.debugInternalErrors.checked,
    hudEnabled: gInputs.hudEnabled.checked,
    hudDurationSec: Number(gInputs.hudDurationRange.value),
    hudPosition: gInputs.hudPosition.value,
    hudOpacity: Number(gInputs.hudOpacityRange.value),
    hudScale: Number(gInputs.hudScaleRange.value),
    hudShowTrust: gInputs.hudShowTrust.checked,
    hudShowGroup: gInputs.hudShowGroup.checked,
    hudShowOpen: gInputs.hudShowOpen.checked,
    hudShowBlock: gInputs.hudShowBlock.checked,
    hudShowUrlDetail: gInputs.hudShowUrlDetail.checked,
    videoDockEnabled: gInputs.videoDockEnabled.checked,
    videoDockDimSec: Number(gInputs.videoDockDimRange.value),
    videoDockExpandDir: gInputs.videoDockDir.value,
    videoPillScale: Number(gInputs.videoPillScaleRange.value),
    videoPillOpacity: Number(gInputs.videoPillOpacityRange.value),
    videoPillShowPlayPause: gInputs.vpShowPlayPause.checked,
    videoPillShowList: gInputs.vpShowList.checked,
    videoPillShowDownload: gInputs.vpShowDownload.checked,
    videoPillShowPip: gInputs.vpShowPip.checked,
    videoPillShowFullscreen: gInputs.vpShowFullscreen.checked,
    pipSize: gInputs.pipSize.value,
    pipOpacity: Number(gInputs.pipOpacityRange.value),
    adSkipSpeed: gInputs.adSkipSpeed.value,
    shortlinkBypassEnabled: gInputs.shortlinkBypassEnabled.checked,
    shortlinkAutoClick: gInputs.shortlinkAutoClick.checked,
    loggingEnabled: gInputs.loggingEnabled.checked,
    smartUgcSense: gInputs.smartUgcSense.checked,
    removeTransparentOverlay: gInputs.removeOverlay.checked,
    captchaKillSwitchEnabled: gInputs.captchaKillSwitch ? gInputs.captchaKillSwitch.checked : true,
    antiHistoryTrap: gInputs.antiHistory.checked,
    dnrEnabled: gInputs.dnrEnabled.checked,
    redirectWindowSec: Number(gInputs.redirectWindowRange.value)
  });
}

function formatPosCoord(pos, fallbackLabel) {
  if (!pos || typeof pos !== "object") return fallbackLabel;
  if (typeof pos.xRatio === "number" && typeof pos.yRatio === "number") {
    const xPct = Math.round(pos.xRatio * 100);
    const yPct = Math.round(pos.yRatio * 100);
    const side = pos.anchorX === "right" ? "Kanan" : "Kiri";
    return `${side} (${xPct}%, ${yPct}%)`;
  }
  if (typeof pos.left === "number" && typeof pos.top === "number") {
    return `${Math.round(pos.left)}px, ${Math.round(pos.top)}px`;
  }
  return fallbackLabel;
}

function renderHudPositions(posObj) {
  const p = { ...DEFAULT_HUD_POSITIONS, ...(posObj || {}) };
  posStatusVideoDock.textContent = formatPosCoord(p.videoDock, "Auto-Anchor");
  posStatusTopHud.textContent = formatPosCoord(p.topHud, "Preset Default");
  posStatusMiniPip.textContent = formatPosCoord(p.miniPip, "Kanan Bawah");
}

function renderList(container, items, storageKey, emptyText) {
  container.innerHTML = "";
  if (!items || items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-msg";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  items.forEach((domain) => {
    const row = document.createElement("div");
    row.className = "domain-item";
    const span = document.createElement("span");
    span.className = "domain-name";
    span.textContent = domain;

    const del = document.createElement("button");
    del.className = "del-btn";
    del.textContent = "✕";
    del.title = `Hapus ${domain}`;
    del.onclick = () => removeDomain(storageKey, domain);

    row.appendChild(span);
    row.appendChild(del);
    container.appendChild(row);
  });
}

function updateDnrStatsDisplay(deniedList, storedDnrStats) {
  if (storedDnrStats && typeof storedDnrStats.ruleCount === "number") {
    const trunc = storedDnrStats.truncatedCount > 0 ? ` · ${storedDnrStats.truncatedCount} terpotong` : "";
    dnrStatsVal.textContent = `${storedDnrStats.totalDomains} domain · ${storedDnrStats.ruleCount}/${storedDnrStats.maxRules} rule${trunc}`;
    return;
  }
  const built = buildConsolidatedDnrRules(deniedList, TIMINGS.DNR_FALLBACK_MAX_RULES, TIMINGS.DNR_BATCH_SIZE);
  dnrStatsVal.textContent = `${built.totalDomains} domain · ${built.ruleCount}/${built.maxRules} rule`;
}

// =========================================================================
// DIAGNOSTIC LOGS & SANITIZED FALSE POSITIVE REPORT
// =========================================================================
function formatLogTimestamp(ts) {
  const d = new Date(ts || Date.now());
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatLogsForCopyPaste(logs, filterLevel) {
  const list = Array.isArray(logs) ? logs : [];
  const filtered =
    filterLevel === "ALL"
      ? list
      : list.filter((item) => String(item.level || "").toUpperCase() === filterLevel);

  if (filtered.length === 0) {
    return `=== AEGIS-AI SHIELD v${AEGIS_VERSION} DIAGNOSTIC LOG ===\nFilter: ${filterLevel} | Total: 0 entri\n\n(Belum ada entri log. Buka situs shortlink atau link yang bermasalah lalu klik Refresh.)`;
  }

  const header = [
    `=== AEGIS-AI SHIELD v${AEGIS_VERSION} DIAGNOSTIC LOG ===`,
    `Filter: ${filterLevel} | Menampilkan ${filtered.length} dari ${list.length} entri`,
    `Mode: ${currentProtectionMode} | Dibuat: ${new Date().toLocaleString("id-ID")}`,
    "------------------------------------------------------------"
  ].join("\n");

  const body = filtered
    .map((item) => {
      const ts = formatLogTimestamp(item.ts);
      const lvl = String(item.level || "WARN").toUpperCase();
      const src = item.source || "background";
      const code = item.code || "EVENT";
      const fromLine = item.fromUrl ? `\n  From   : ${item.fromUrl}` : "";
      const toLine = item.toUrl ? `\n  To     : ${item.toUrl}` : "";
      const detailLine = item.detail ? `\n  Detail : ${item.detail}` : "";
      return `[${ts}] [${lvl}/${src}] ${code}${fromLine}${toLine}${detailLine}`;
    })
    .join("\n\n");

  return `${header}\n${body}`;
}

function renderAegisLogs() {
  const count = Array.isArray(cachedAegisLogs) ? cachedAegisLogs.length : 0;
  tabLogs.textContent = `📋 Log (${count})`;
  logOutputArea.value = formatLogsForCopyPaste(cachedAegisLogs, activeLogFilter);
}

function loadAegisLogs(silent = true) {
  chrome.runtime.sendMessage({ type: "GET_AEGIS_LOGS" }, (res) => {
    if (chrome.runtime.lastError) {
      chrome.storage.local.get(["aegisLogs"], (data) => {
        cachedAegisLogs = Array.isArray(data.aegisLogs) ? data.aegisLogs : [];
        renderAegisLogs();
      });
      return;
    }
    cachedAegisLogs = res && Array.isArray(res.logs) ? res.logs : [];
    renderAegisLogs();
    if (!silent) showStatus(`🔄 ${cachedAegisLogs.length} entri log dimuat`, "var(--amber)");
  });
}

async function loadActiveTabInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabUrl = tab && tab.url && tab.url.startsWith("http") ? tab.url : "";
    activeTabHost = activeTabUrl ? getHostname(activeTabUrl) : "";
  } catch {
    activeTabUrl = "";
    activeTabHost = "";
  }
  updateSafeModeUI();
}

async function loadState() {
  await loadActiveTabInfo();
  const data = await chrome.storage.local.get([
    "geminiApiKey",
    "strictCrossOrigin",
    "autoSkipCountdown",
    "deniedDomains",
    "trustedDomains",
    "globalSettings",
    "hudPositions",
    "aiAuditCache",
    "aegisLogs",
    "aegisStats",
    "dnrStats",
    "tempAllowMap",
    "aiLastStatus"
  ]);

  let sessionKey = "";
  if (chrome.storage.session) {
    try {
      const sess = await chrome.storage.session.get(["geminiApiKey", "tempAllowMap"]);
      if (sess.geminiApiKey) sessionKey = String(sess.geminiApiKey);
      if (sess.tempAllowMap && typeof sess.tempAllowMap === "object") {
        cachedTempAllowMap = sess.tempAllowMap;
      }
    } catch {
      // session storage unavailable
    }
  }
  if (!Object.keys(cachedTempAllowMap).length && data.tempAllowMap) {
    cachedTempAllowMap = data.tempAllowMap;
  }

  const g = sanitizeGlobalSettings(
    data.globalSettings,
    typeof data.strictCrossOrigin === "boolean" ? data.strictCrossOrigin : undefined,
    typeof data.autoSkipCountdown === "boolean" ? data.autoSkipCountdown : undefined
  );
  const rawGlobal =
    data.globalSettings && typeof data.globalSettings === "object" ? data.globalSettings : {};
  const hasLocalKey = typeof data.geminiApiKey === "string" && data.geminiApiKey.trim().length > 0;
  if (hasLocalKey) {
    if (typeof rawGlobal.sessionOnlyApiKey !== "boolean") g.sessionOnlyApiKey = false;
    if (typeof rawGlobal.geminiAuditEnabled !== "boolean") g.geminiAuditEnabled = true;
  }

  const resolvedKey = g.sessionOnlyApiKey ? sessionKey : sessionKey || data.geminiApiKey || "";
  apiKeyEl.value = resolvedKey;
  autoSkipEl.checked = g.autoSkipCountdown === true;

  const denied = Array.isArray(data.deniedDomains) ? data.deniedDomains : [];
  const trusted = Array.isArray(data.trustedDomains) ? data.trustedDomains : [...DEFAULT_TRUSTED_DOMAINS];
  const cacheCount =
    data.aiAuditCache && typeof data.aiAuditCache === "object" ? Object.keys(data.aiAuditCache).length : 0;

  aiCacheCountEl.textContent = String(cacheCount);
  tabBlacklist.textContent = `🚫 Block (${denied.length})`;
  tabWhitelist.textContent = `✅ Trust (${trusted.length})`;

  updateStatsUI(data.aegisStats || DEFAULT_STATS);
  applyGlobalSettingsToUI(g);
  updateAiStatusUI(data.aiLastStatus, Boolean(resolvedKey), g.geminiAuditEnabled === true);
  updateDnrStatsDisplay(denied, data.dnrStats);
  renderList(blacklistContainer, denied, "deniedDomains", "Belum ada domain yang diblokir permanen.");
  renderList(whitelistContainer, trusted, "trustedDomains", "Belum ada domain yang dipercaya.");
  renderHudPositions(data.hudPositions);
  cachedAegisLogs = Array.isArray(data.aegisLogs) ? data.aegisLogs : [];
  renderAegisLogs();
}

function addDomain(storageKey, rawValue, oppositeKey) {
  const clean = normalizeDomainEntry(rawValue);
  if (!clean) {
    showStatus("⚠️ Format domain tidak valid!", "#f87171");
    return;
  }
  chrome.storage.local.get([storageKey, oppositeKey], (data) => {
    const list = Array.isArray(data[storageKey]) ? data[storageKey] : [];
    const opp = Array.isArray(data[oppositeKey]) ? data[oppositeKey] : [];
    const nextList = Array.from(new Set([clean, ...list]));
    const nextOpp = opp.filter((d) => d !== clean);
    chrome.storage.local.set({ [storageKey]: nextList, [oppositeKey]: nextOpp }, () => {
      showStatus(
        storageKey === "deniedDomains" ? `🚫 ${clean} diblokir via DNR!` : `✅ ${clean} masuk Whitelist!`,
        storageKey === "deniedDomains" ? "#f87171" : "var(--accent)"
      );
      loadState();
    });
  });
}

function removeDomain(storageKey, domain) {
  chrome.storage.local.get([storageKey], (data) => {
    const list = Array.isArray(data[storageKey]) ? data[storageKey] : [];
    const next = list.filter((d) => d !== domain);
    chrome.storage.local.set({ [storageKey]: next }, () => {
      showStatus(`🗑️ ${domain} dihapus`, "var(--amber)");
      loadState();
    });
  });
}

function importHostlistInto(storageKey, oppositeKey, rawText) {
  const parsed = parseHostlistText(rawText);
  if (parsed.length === 0) {
    showStatus("⚠️ Tidak ada domain valid di teks Hostlist", "#f87171");
    return;
  }
  const maxCap = storageKey === "deniedDomains" ? TIMINGS.MAX_DENIED_DOMAINS : TIMINGS.MAX_TRUSTED_DOMAINS;
  chrome.storage.local.get([storageKey, oppositeKey], (data) => {
    const existing = Array.isArray(data[storageKey]) ? data[storageKey] : [];
    const opp = Array.isArray(data[oppositeKey]) ? data[oppositeKey] : [];
    const merged = Array.from(new Set([...parsed, ...existing])).slice(0, maxCap);
    const parsedSet = new Set(merged);
    const nextOpp = opp.filter((d) => !parsedSet.has(d));
    chrome.storage.local.set({ [storageKey]: merged, [oppositeKey]: nextOpp }, () => {
      showStatus(`✅ ${Math.min(parsed.length, maxCap)} domain diimport (maks ${maxCap})!`, "var(--accent)");
      loadState();
    });
  });
}

// =========================================================================
// EVENT LISTENERS
// =========================================================================

// Tabs
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.getAttribute("data-tab");
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`panel-${tab}`)?.classList.add("active");
    if (tab === "logs") loadAegisLogs(true);
  });
});

// Theme Toggle
themeToggleBtn.addEventListener("click", () => {
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  chrome.storage.local.get(["globalSettings"], (data) => {
    const merged = { ...DEFAULT_GLOBAL_SETTINGS, ...(data.globalSettings || {}), popupTheme: nextTheme };
    chrome.storage.local.set({ globalSettings: merged });
  });
});

// Protection Mode Cards (Balanced / Strict)
[modeBalancedBtn, modeStrictBtn].forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.getAttribute("data-mode") === "strict" ? "strict" : "balanced";
    applyProtectionModeUI(mode);
    updateSafeModeUI();
  });
});

// Safe Mode / Temporary Allow Quick Actions
function setTempAllow(minutes) {
  if (!activeTabHost) return;
  chrome.runtime.sendMessage({ type: "SET_TEMP_ALLOW", domain: activeTabHost, minutes }, (res) => {
    if (res && res.ok) {
      cachedTempAllowMap = res.tempAllowMap || cachedTempAllowMap;
      updateSafeModeUI();
      showStatus(`⏸ Safe Mode aktif ${minutes}m untuk ${activeTabHost}`, "var(--amber)");
    }
  });
}

tempAllow15Btn.addEventListener("click", () => setTempAllow(15));
tempAllow60Btn.addEventListener("click", () => setTempAllow(60));
tempAllowClearBtn.addEventListener("click", () => {
  if (!activeTabHost) return;
  chrome.runtime.sendMessage({ type: "CLEAR_TEMP_ALLOW", domain: activeTabHost }, (res) => {
    if (res && res.ok) {
      cachedTempAllowMap = res.tempAllowMap || {};
      updateSafeModeUI();
      showStatus(`🛡️ Proteksi diaktifkan kembali untuk ${activeTabHost}`, "var(--accent)");
    }
  });
});

// Stats Reset
resetStatsBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "RESET_AEGIS_STATS" }, (res) => {
    updateStatsUI(res?.stats || DEFAULT_STATS);
    showStatus("↺ Statistik lokal direset", "var(--sky)");
  });
});

// P5: Persistent key warning & Gemini opt-in badge sync
sessionOnlyKeyEl.addEventListener("change", updatePersistentKeyWarning);
geminiAuditEnabledEl?.addEventListener("change", () => {
  updateAiStatusUI(null, Boolean(apiKeyEl.value.trim()), Boolean(geminiAuditEnabledEl.checked));
});

// P7: Inline opt-in confirmation for Auto-Skip Countdown (zero window.confirm)
autoSkipEl.addEventListener("change", () => {
  if (autoSkipEl.checked && autoSkipConfirmBox) {
    autoSkipEl.checked = false;
    autoSkipConfirmBox.classList.add("open");
  } else if (autoSkipConfirmBox) {
    autoSkipConfirmBox.classList.remove("open");
  }
});
document.getElementById("autoSkipConfirmAccept")?.addEventListener("click", () => {
  autoSkipEl.checked = true;
  autoSkipConfirmBox?.classList.remove("open");
  showStatus("⚡ Auto-Skip diaktifkan — klik Simpan Konfigurasi untuk menerapkan", "var(--amber)");
});
document.getElementById("autoSkipConfirmCancel")?.addEventListener("click", () => {
  autoSkipEl.checked = false;
  autoSkipConfirmBox?.classList.remove("open");
});

// P7: Inline opt-in confirmation for Shortlink Auto-Click (zero window.confirm)
gInputs.shortlinkAutoClick.addEventListener("change", () => {
  if (gInputs.shortlinkAutoClick.checked && shortlinkAutoClickConfirmBox) {
    gInputs.shortlinkAutoClick.checked = false;
    shortlinkAutoClickConfirmBox.classList.add("open");
  } else if (shortlinkAutoClickConfirmBox) {
    shortlinkAutoClickConfirmBox.classList.remove("open");
  }
});
document.getElementById("shortlinkAutoClickAccept")?.addEventListener("click", () => {
  gInputs.shortlinkAutoClick.checked = true;
  shortlinkAutoClickConfirmBox?.classList.remove("open");
  showStatus("⚡ Auto-Klik Shortlink diaktifkan — klik Simpan Setting untuk menerapkan", "var(--amber)");
});
document.getElementById("shortlinkAutoClickCancel")?.addEventListener("click", () => {
  gInputs.shortlinkAutoClick.checked = false;
  shortlinkAutoClickConfirmBox?.classList.remove("open");
});

// Save General Configuration (supports Session-Only Gemini API Key + key format validation)
document.getElementById("saveBtn")?.addEventListener("click", async () => {
  const key = apiKeyEl.value.trim();
  if (key && (/[\s\r\n]/.test(key) || key.length < 16 || key.length > 128)) {
    showStatus("⚠️ Format Gemini API Key tidak valid (tanpa spasi, 16-128 karakter).", "#f87171");
    return;
  }
  const sessionOnly = sessionOnlyKeyEl.checked;
  const globalSettings = readGlobalSettingsFromUI();

  if (sessionOnly && chrome.storage.session) {
    await chrome.storage.session.set({ geminiApiKey: key });
    await chrome.storage.local.set({
      geminiApiKey: "",
      strictCrossOrigin: currentProtectionMode === "strict",
      autoSkipCountdown: autoSkipEl.checked,
      globalSettings
    });
    updateAiStatusUI(null, Boolean(key), globalSettings.geminiAuditEnabled === true);
    showStatus("🔒 Konfigurasi & API Key (Sesi Saja) tersimpan!", "var(--accent)");
  } else {
    if (chrome.storage.session) {
      await chrome.storage.session.remove(["geminiApiKey"]).catch(() => {});
    }
    await chrome.storage.local.set({
      geminiApiKey: key,
      strictCrossOrigin: currentProtectionMode === "strict",
      autoSkipCountdown: autoSkipEl.checked,
      globalSettings
    });
    updateAiStatusUI(null, Boolean(key), globalSettings.geminiAuditEnabled === true);
    showStatus(`✅ Konfigurasi v${AEGIS_VERSION} tersimpan (Key permanen)!`, "var(--accent)");
  }
});

// Slider live labels
[
  gInputs.hudDurationRange,
  gInputs.hudOpacityRange,
  gInputs.hudScaleRange,
  gInputs.videoDockDimRange,
  gInputs.videoPillScaleRange,
  gInputs.videoPillOpacityRange,
  gInputs.pipOpacityRange,
  gInputs.redirectWindowRange
].forEach((el) => el.addEventListener("input", updateRangeLabels));

// Save & Reset Global Settings
document.getElementById("saveGlobalBtn")?.addEventListener("click", () => {
  const globalSettings = readGlobalSettingsFromUI();
  chrome.storage.local.set(
    {
      globalSettings,
      strictCrossOrigin: globalSettings.protectionMode === "strict"
    },
    () => {
      showStatus(`✅ Semua Setting v${AEGIS_VERSION} tersimpan & diterapkan!`, "var(--accent)");
    }
  );
});

document.getElementById("resetGlobalBtn")?.addEventListener("click", () => {
  chrome.storage.local.set(
    {
      globalSettings: { ...DEFAULT_GLOBAL_SETTINGS },
      hudPositions: { ...DEFAULT_HUD_POSITIONS },
      strictCrossOrigin: false,
      autoSkipCountdown: false
    },
    () => {
      applyGlobalSettingsToUI(DEFAULT_GLOBAL_SETTINGS);
      renderHudPositions(DEFAULT_HUD_POSITIONS);
      updateAiStatusUI(null, Boolean(apiKeyEl.value.trim()), false);
      showStatus(`↺ Setting & posisi dikembalikan ke default v${AEGIS_VERSION}!`, "var(--amber)");
    }
  );
});

document.querySelectorAll("[data-reset-hud]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.getAttribute("data-reset-hud");
    if (!key) return;
    chrome.storage.local.get(["hudPositions"], (data) => {
      const nextPos = { ...DEFAULT_HUD_POSITIONS, ...(data.hudPositions || {}), [key]: null };
      chrome.storage.local.set({ hudPositions: nextPos }, () => {
        renderHudPositions(nextPos);
        showStatus("↺ Posisi HUD direset ke default!", "var(--amber)");
      });
    });
  });
});

document.getElementById("resetAllHudPosBtn")?.addEventListener("click", () => {
  chrome.storage.local.set({ hudPositions: { ...DEFAULT_HUD_POSITIONS } }, () => {
    renderHudPositions(DEFAULT_HUD_POSITIONS);
    showStatus("↺ Semua posisi geser HUD berhasil direset!", "var(--amber)");
  });
});

// Log Filters & Actions
document.querySelectorAll(".log-filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeLogFilter = btn.getAttribute("data-log-filter") || "ALL";
    document.querySelectorAll(".log-filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderAegisLogs();
  });
});

copyLogBtn.addEventListener("click", async () => {
  const txt = logOutputArea.value || "";
  try {
    await navigator.clipboard.writeText(txt);
    showStatus("📋 Log diagnostik disalin ke clipboard!", "var(--accent)");
  } catch {
    logOutputArea.select();
    document.execCommand("copy");
    showStatus("📋 Log diagnostik disalin!", "var(--accent)");
  }
});

copyFpReportBtn.addEventListener("click", async () => {
  const st = getTemporaryAllowState(cachedTempAllowMap, activeTabUrl);
  const report = buildSanitizedFalsePositiveReport({
    version: AEGIS_VERSION,
    activeUrl: activeTabUrl || "-",
    protectionMode: currentProtectionMode,
    tempAllowActive: st.active,
    logs: cachedAegisLogs,
    stats: cachedStats
  });
  try {
    await navigator.clipboard.writeText(report);
    showStatus("🛡️ Laporan False Positive (tersensor) disalin!", "var(--accent)");
  } catch {
    logOutputArea.value = report;
    logOutputArea.select();
    document.execCommand("copy");
    showStatus("🛡️ Laporan FP tersensor disalin!", "var(--accent)");
  }
});

refreshLogBtn.addEventListener("click", () => loadAegisLogs(false));

clearLogBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "CLEAR_AEGIS_LOGS" }, () => {
    cachedAegisLogs = [];
    renderAegisLogs();
    showStatus("🧹 Log diagnostik dikosongkan!", "var(--amber)");
  });
});

// Backup & Restore JSON v3.2.1 (backward compatible with v2.2.7–v3.2.0)
document.getElementById("copyBackupBtn")?.addEventListener("click", () => {
  chrome.storage.local.get(
    ["strictCrossOrigin", "autoSkipCountdown", "deniedDomains", "trustedDomains", "globalSettings", "hudPositions"],
    async (data) => {
      const cleanGlobal = sanitizeGlobalSettings(
        data.globalSettings,
        typeof data.strictCrossOrigin === "boolean" ? data.strictCrossOrigin : undefined,
        typeof data.autoSkipCountdown === "boolean" ? data.autoSkipCountdown : undefined
      );
      const payload = {
        app: "AEGIS-AI Shield",
        version: AEGIS_VERSION,
        exportedAt: new Date().toISOString(),
        strictCrossOrigin: cleanGlobal.protectionMode === "strict",
        autoSkipCountdown: cleanGlobal.autoSkipCountdown === true,
        deniedDomains: Array.isArray(data.deniedDomains) ? data.deniedDomains : [],
        trustedDomains: Array.isArray(data.trustedDomains) ? data.trustedDomains : [...DEFAULT_TRUSTED_DOMAINS],
        globalSettings: cleanGlobal,
        hudPositions: { ...DEFAULT_HUD_POSITIONS, ...(data.hudPositions || {}) }
      };
      const jsonStr = JSON.stringify(payload, null, 2);
      try {
        await navigator.clipboard.writeText(jsonStr);
        showStatus(`📋 JSON Backup v${AEGIS_VERSION} disalin (API Key tidak ikut)!`, "var(--accent)");
      } catch {
        restoreDrawer.classList.add("open");
        backupJsonArea.value = jsonStr;
        backupJsonArea.select();
        showStatus("📋 Salin teks JSON di kotak bawah secara manual.", "var(--sky)");
      }
    }
  );
});

document.getElementById("toggleRestoreBtn")?.addEventListener("click", () => {
  restoreDrawer.classList.toggle("open");
  if (restoreDrawer.classList.contains("open")) backupJsonArea.focus();
});

document.getElementById("closeRestoreBtn")?.addEventListener("click", () => {
  restoreDrawer.classList.remove("open");
});

document.getElementById("applyRestoreBtn")?.addEventListener("click", () => {
  try {
    const parsed = JSON.parse(backupJsonArea.value.trim());
    if (!parsed || typeof parsed !== "object") throw new Error("Invalid JSON");
    const migrated = migrateExtensionStorage(parsed);
    chrome.storage.local.set(migrated, () => {
      restoreDrawer.classList.remove("open");
      backupJsonArea.value = "";
      showStatus(
        `✅ Restore selesai (${migrated.deniedDomains.length} block, ${migrated.trustedDomains.length} trust)!`,
        "var(--accent)"
      );
      loadState();
    });
  } catch {
    showStatus("❌ Format JSON cadangan tidak valid!", "#f87171");
  }
});

document.getElementById("clearAiCacheBtn")?.addEventListener("click", () => {
  chrome.storage.local.set({ aiAuditCache: {} }, () => {
    aiCacheCountEl.textContent = "0";
    showStatus("🧹 Cache keputusan AI dibersihkan!", "var(--amber)");
  });
});

// Blacklist & Whitelist Add / Active Tab / Hostlist .txt Import-Export
document.getElementById("addBlacklistBtn")?.addEventListener("click", () => {
  addDomain("deniedDomains", blacklistInput.value, "trustedDomains");
  blacklistInput.value = "";
});

document.getElementById("addWhitelistBtn")?.addEventListener("click", () => {
  addDomain("trustedDomains", whitelistInput.value, "deniedDomains");
  whitelistInput.value = "";
});

document.getElementById("blockCurrentSiteBtn")?.addEventListener("click", () => {
  if (!activeTabUrl) {
    showStatus("⚠️ Tab ini bukan situs web http/https.", "#f87171");
    return;
  }
  addDomain("deniedDomains", activeTabUrl, "trustedDomains");
});

document.getElementById("trustCurrentSiteBtn")?.addEventListener("click", () => {
  if (!activeTabUrl) {
    showStatus("⚠️ Tab ini bukan situs web http/https.", "#f87171");
    return;
  }
  addDomain("trustedDomains", activeTabUrl, "deniedDomains");
});

// Hostlist .txt Export / Import (Blacklist)
document.getElementById("exportBlacklistTxtBtn")?.addEventListener("click", () => {
  chrome.storage.local.get(["deniedDomains"], async (data) => {
    const txt = exportHostlistText(data.deniedDomains || [], `AEGIS-AI Shield v${AEGIS_VERSION} Blacklist`);
    try {
      await navigator.clipboard.writeText(txt);
      showStatus("📤 Hostlist Blacklist (.txt) disalin!", "var(--accent)");
    } catch {
      importBlacklistDrawer.classList.add("open");
      blacklistTxtArea.value = txt;
      blacklistTxtArea.select();
      showStatus("📤 Salin daftar Hostlist dari kotak bawah.", "var(--sky)");
    }
  });
});

document.getElementById("toggleImportBlacklistBtn")?.addEventListener("click", () => {
  importBlacklistDrawer.classList.toggle("open");
  if (importBlacklistDrawer.classList.contains("open")) blacklistTxtArea.focus();
});

document.getElementById("closeImportBlacklistBtn")?.addEventListener("click", () => {
  importBlacklistDrawer.classList.remove("open");
});

document.getElementById("applyImportBlacklistBtn")?.addEventListener("click", () => {
  importHostlistInto("deniedDomains", "trustedDomains", blacklistTxtArea.value);
  blacklistTxtArea.value = "";
  importBlacklistDrawer.classList.remove("open");
});

// Hostlist .txt Export / Import (Whitelist)
document.getElementById("exportWhitelistTxtBtn")?.addEventListener("click", () => {
  chrome.storage.local.get(["trustedDomains"], async (data) => {
    const txt = exportHostlistText(data.trustedDomains || [], `AEGIS-AI Shield v${AEGIS_VERSION} Whitelist`);
    try {
      await navigator.clipboard.writeText(txt);
      showStatus("📤 Hostlist Whitelist (.txt) disalin!", "var(--accent)");
    } catch {
      importWhitelistDrawer.classList.add("open");
      whitelistTxtArea.value = txt;
      whitelistTxtArea.select();
      showStatus("📤 Salin daftar Whitelist dari kotak bawah.", "var(--sky)");
    }
  });
});

document.getElementById("toggleImportWhitelistBtn")?.addEventListener("click", () => {
  importWhitelistDrawer.classList.toggle("open");
  if (importWhitelistDrawer.classList.contains("open")) whitelistTxtArea.focus();
});

document.getElementById("closeImportWhitelistBtn")?.addEventListener("click", () => {
  importWhitelistDrawer.classList.remove("open");
});

document.getElementById("applyImportWhitelistBtn")?.addEventListener("click", () => {
  importHostlistInto("trustedDomains", "deniedDomains", whitelistTxtArea.value);
  whitelistTxtArea.value = "";
  importWhitelistDrawer.classList.remove("open");
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.hudPositions && changes.hudPositions.newValue) {
    renderHudPositions(changes.hudPositions.newValue);
  }
  if (changes.aegisLogs && changes.aegisLogs.newValue) {
    cachedAegisLogs = Array.isArray(changes.aegisLogs.newValue) ? changes.aegisLogs.newValue : [];
    renderAegisLogs();
  }
  if (changes.aegisStats && changes.aegisStats.newValue) {
    updateStatsUI(changes.aegisStats.newValue);
  }
  if (changes.dnrStats && changes.dnrStats.newValue) {
    updateDnrStatsDisplay([], changes.dnrStats.newValue);
  }
  if (changes.tempAllowMap && changes.tempAllowMap.newValue) {
    cachedTempAllowMap = changes.tempAllowMap.newValue;
    updateSafeModeUI();
  }
  if (changes.aiLastStatus && changes.aiLastStatus.newValue) {
    updateAiStatusUI(
      changes.aiLastStatus.newValue,
      Boolean(apiKeyEl.value.trim()),
      Boolean(geminiAuditEnabledEl?.checked)
    );
  }
});

loadState();
