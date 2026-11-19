const DEFAULT_GLOBAL_SETTINGS = {
  hudEnabled: true,
  hudDurationSec: 4.5,
  hudPosition: "top-center",
  hudOpacity: 0.95,
  hudScale: 1.0,
  hudShowTrust: true,
  hudShowGroup: true,
  hudShowOpen: true,
  hudShowBlock: true,
  hudShowUrlDetail: true,
  videoDockEnabled: true,
  videoDockDimSec: 2.5,
  videoDockExpandDir: "auto",
  videoPillScale: 1.0,
  videoPillOpacity: 0.95,
  videoPillShowPlayPause: true,
  videoPillShowList: true,
  videoPillShowDownload: true,
  videoPillShowPip: true,
  videoPillShowFullscreen: true,
  pipSize: "medium",
  pipOpacity: 0.95,
  adSkipSpeed: "16",
  removeTransparentOverlay: true,
  antiHistoryTrap: true,
  dnrEnabled: true,
  redirectWindowSec: 3.5
};

const DEFAULT_HUD_POSITIONS = {
  topHud: null,
  videoDock: null,
  miniPip: null
};

document.addEventListener("DOMContentLoaded", async () => {
  const apiInput = document.getElementById("apiKey");
  const strictToggle = document.getElementById("strictCrossToggle");
  const autoSkipToggle = document.getElementById("autoSkipToggle");
  const statusEl = document.getElementById("status");
  const aiCacheCountEl = document.getElementById("aiCacheCount");

  // Per-Group Opacity & Size / Scale sliders
  const videoPillScaleRange = document.getElementById("videoPillScaleRange");
  const videoPillScaleVal = document.getElementById("videoPillScaleVal");
  const videoPillOpacityRange = document.getElementById("videoPillOpacityRange");
  const videoPillOpacityVal = document.getElementById("videoPillOpacityVal");

  const hudScaleRange = document.getElementById("hudScaleRange");
  const hudScaleVal = document.getElementById("hudScaleVal");
  const hudOpacityRange = document.getElementById("hudOpacityRange");
  const hudOpacityVal = document.getElementById("hudOpacityVal");

  const pipOpacityRange = document.getElementById("pipOpacityRange");
  const pipOpacityVal = document.getElementById("pipOpacityVal");

  // HUD menu item visibility checkboxes
  const vpShowPlayPause = document.getElementById("vpShowPlayPause");
  const vpShowList = document.getElementById("vpShowList");
  const vpShowDownload = document.getElementById("vpShowDownload");
  const vpShowPip = document.getElementById("vpShowPip");
  const vpShowFullscreen = document.getElementById("vpShowFullscreen");

  const hudShowTrust = document.getElementById("hudShowTrust");
  const hudShowGroup = document.getElementById("hudShowGroup");
  const hudShowOpen = document.getElementById("hudShowOpen");
  const hudShowBlock = document.getElementById("hudShowBlock");
  const hudShowUrlDetail = document.getElementById("hudShowUrlDetail");

  // Global setting controls
  const hudEnabledToggle = document.getElementById("hudEnabledToggle");
  const hudDurationRange = document.getElementById("hudDurationRange");
  const hudDurationVal = document.getElementById("hudDurationVal");
  const hudPositionSelect = document.getElementById("hudPositionSelect");

  const videoDockEnabledToggle = document.getElementById("videoDockEnabledToggle");
  const videoDockDirSelect = document.getElementById("videoDockDirSelect");
  const videoDockDimRange = document.getElementById("videoDockDimRange");
  const videoDockDimVal = document.getElementById("videoDockDimVal");
  const pipSizeSelect = document.getElementById("pipSizeSelect");

  const adSkipSpeedSelect = document.getElementById("adSkipSpeedSelect");
  const removeOverlayToggle = document.getElementById("removeOverlayToggle");
  const antiHistoryToggle = document.getElementById("antiHistoryToggle");
  const dnrEnabledToggle = document.getElementById("dnrEnabledToggle");
  const redirectWindowRange = document.getElementById("redirectWindowRange");
  const redirectWindowVal = document.getElementById("redirectWindowVal");

  // HUD Custom Position status
  const posStatusTopHud = document.getElementById("posStatusTopHud");
  const posStatusVideoDock = document.getElementById("posStatusVideoDock");
  const posStatusMiniPip = document.getElementById("posStatusMiniPip");

  // Backup / Restore controls
  const restoreDrawer = document.getElementById("restoreDrawer");
  const backupJsonArea = document.getElementById("backupJsonArea");

  const blacklistInput = document.getElementById("blacklistInput");
  const whitelistInput = document.getElementById("whitelistInput");
  const blacklistContainer = document.getElementById("blacklistContainer");
  const whitelistContainer = document.getElementById("whitelistContainer");
  const tabBlacklistBtn = document.getElementById("tabBlacklist");
  const tabWhitelistBtn = document.getElementById("tabWhitelist");

  let trustedDomains = [];
  let deniedDomains = [];
  let hudPositions = { ...DEFAULT_HUD_POSITIONS };

  function showStatus(msg) {
    statusEl.textContent = msg;
    clearTimeout(window.__stTimer);
    window.__stTimer = setTimeout(() => { statusEl.textContent = ""; }, 3200);
  }

  function formatCoordLabel(posObj, fallbackText) {
    if (!posObj || typeof posObj.left !== "number" || typeof posObj.top !== "number") {
      return fallbackText;
    }
    const sideHint = posObj.anchorSide === "left" ? " (Kiri→)" : posObj.anchorSide === "right" ? " (←Kanan)" : "";
    return `X:${Math.round(posObj.left)}px, Y:${Math.round(posObj.top)}px${sideHint}`;
  }

  function renderHudPositionStatus() {
    if (posStatusTopHud) {
      posStatusTopHud.textContent = formatCoordLabel(hudPositions.topHud, "Preset Default");
      posStatusTopHud.style.color = hudPositions.topHud ? "#34d399" : "#94a3b8";
    }
    if (posStatusVideoDock) {
      posStatusVideoDock.textContent = formatCoordLabel(hudPositions.videoDock, "Auto-Anchor");
      posStatusVideoDock.style.color = hudPositions.videoDock ? "#34d399" : "#94a3b8";
    }
    if (posStatusMiniPip) {
      posStatusMiniPip.textContent = formatCoordLabel(hudPositions.miniPip, "Kanan Bawah");
      posStatusMiniPip.style.color = hudPositions.miniPip ? "#34d399" : "#94a3b8";
    }
  }

  function updateSliderLabels() {
    if (videoPillScaleRange && videoPillScaleVal) {
      const vpScale = Math.max(0.75, Math.min(1.35, parseFloat(videoPillScaleRange.value) || 1.0));
      videoPillScaleVal.textContent = `${Math.round(vpScale * 100)}% (${vpScale.toFixed(2)}×)`;
    }
    if (videoPillOpacityRange && videoPillOpacityVal) {
      const vpOp = Math.max(0.5, Math.min(1.0, parseFloat(videoPillOpacityRange.value) || 0.95));
      videoPillOpacityVal.textContent = `${Math.round(vpOp * 100)}% (${vpOp.toFixed(2)})`;
    }
    if (hudScaleRange && hudScaleVal) {
      const hScale = Math.max(0.75, Math.min(1.3, parseFloat(hudScaleRange.value) || 1.0));
      hudScaleVal.textContent = `${Math.round(hScale * 100)}% (${hScale.toFixed(2)}×)`;
    }
    if (hudOpacityRange && hudOpacityVal) {
      const hOp = Math.max(0.5, Math.min(1.0, parseFloat(hudOpacityRange.value) || 0.95));
      hudOpacityVal.textContent = `${Math.round(hOp * 100)}% (${hOp.toFixed(2)})`;
    }
    if (pipOpacityRange && pipOpacityVal) {
      const pOp = Math.max(0.5, Math.min(1.0, parseFloat(pipOpacityRange.value) || 0.95));
      pipOpacityVal.textContent = `${Math.round(pOp * 100)}% (${pOp.toFixed(2)})`;
    }

    const hudSec = parseFloat(hudDurationRange.value);
    hudDurationVal.textContent = hudSec === 0 ? "Manual (∞)" : `${hudSec.toFixed(1)} detik`;

    const dimSec = parseFloat(videoDockDimRange.value);
    videoDockDimVal.textContent = dimSec === 0 ? "Manual" : `${dimSec.toFixed(1)} detik`;

    const redSec = parseFloat(redirectWindowRange.value);
    redirectWindowVal.textContent = `${redSec.toFixed(1)} detik`;
  }

  function applyGlobalForm(cfg) {
    const g = { ...DEFAULT_GLOBAL_SETTINGS, ...(cfg || {}) };
    if (videoPillScaleRange) videoPillScaleRange.value = String(g.videoPillScale ?? 1.0);
    if (videoPillOpacityRange) videoPillOpacityRange.value = String(g.videoPillOpacity ?? g.hudOpacity ?? 0.95);
    if (hudScaleRange) hudScaleRange.value = String(g.hudScale ?? 1.0);
    if (hudOpacityRange) hudOpacityRange.value = String(g.hudOpacity ?? 0.95);
    if (pipOpacityRange) pipOpacityRange.value = String(g.pipOpacity ?? g.hudOpacity ?? 0.95);

    if (vpShowPlayPause) vpShowPlayPause.checked = g.videoPillShowPlayPause !== false;
    if (vpShowList) vpShowList.checked = g.videoPillShowList !== false;
    if (vpShowDownload) vpShowDownload.checked = g.videoPillShowDownload !== false;
    if (vpShowPip) vpShowPip.checked = g.videoPillShowPip !== false;
    if (vpShowFullscreen) vpShowFullscreen.checked = g.videoPillShowFullscreen !== false;

    if (hudShowTrust) hudShowTrust.checked = g.hudShowTrust !== false;
    if (hudShowGroup) hudShowGroup.checked = g.hudShowGroup !== false;
    if (hudShowOpen) hudShowOpen.checked = g.hudShowOpen !== false;
    if (hudShowBlock) hudShowBlock.checked = g.hudShowBlock !== false;
    if (hudShowUrlDetail) hudShowUrlDetail.checked = g.hudShowUrlDetail !== false;

    hudEnabledToggle.checked = g.hudEnabled !== false;
    hudDurationRange.value = String(g.hudDurationSec ?? 4.5);
    hudPositionSelect.value = g.hudPosition || "top-center";
    videoDockEnabledToggle.checked = g.videoDockEnabled !== false;
    if (videoDockDirSelect) videoDockDirSelect.value = g.videoDockExpandDir || "auto";
    videoDockDimRange.value = String(g.videoDockDimSec ?? 2.5);
    pipSizeSelect.value = g.pipSize || "medium";
    adSkipSpeedSelect.value = String(g.adSkipSpeed || "16");
    removeOverlayToggle.checked = g.removeTransparentOverlay !== false;
    antiHistoryToggle.checked = g.antiHistoryTrap !== false;
    dnrEnabledToggle.checked = g.dnrEnabled !== false;
    redirectWindowRange.value = String(g.redirectWindowSec ?? 3.5);
    updateSliderLabels();
  }

  function collectGlobalForm() {
    const rawVpScale = videoPillScaleRange ? parseFloat(videoPillScaleRange.value) : 1.0;
    const rawVpOp = videoPillOpacityRange ? parseFloat(videoPillOpacityRange.value) : 0.95;
    const rawHudScale = hudScaleRange ? parseFloat(hudScaleRange.value) : 1.0;
    const rawHudOp = hudOpacityRange ? parseFloat(hudOpacityRange.value) : 0.95;
    const rawPipOp = pipOpacityRange ? parseFloat(pipOpacityRange.value) : 0.95;
    return {
      hudEnabled: hudEnabledToggle.checked,
      hudDurationSec: parseFloat(hudDurationRange.value),
      hudPosition: hudPositionSelect.value,
      hudOpacity: Number(Math.max(0.5, Math.min(1.0, Number.isFinite(rawHudOp) ? rawHudOp : 0.95)).toFixed(2)),
      hudScale: Number(Math.max(0.75, Math.min(1.3, Number.isFinite(rawHudScale) ? rawHudScale : 1.0)).toFixed(2)),
      hudShowTrust: hudShowTrust ? hudShowTrust.checked : true,
      hudShowGroup: hudShowGroup ? hudShowGroup.checked : true,
      hudShowOpen: hudShowOpen ? hudShowOpen.checked : true,
      hudShowBlock: hudShowBlock ? hudShowBlock.checked : true,
      hudShowUrlDetail: hudShowUrlDetail ? hudShowUrlDetail.checked : true,
      videoDockEnabled: videoDockEnabledToggle.checked,
      videoDockExpandDir: videoDockDirSelect ? videoDockDirSelect.value : "auto",
      videoDockDimSec: parseFloat(videoDockDimRange.value),
      videoPillScale: Number(Math.max(0.75, Math.min(1.35, Number.isFinite(rawVpScale) ? rawVpScale : 1.0)).toFixed(2)),
      videoPillOpacity: Number(Math.max(0.5, Math.min(1.0, Number.isFinite(rawVpOp) ? rawVpOp : 0.95)).toFixed(2)),
      videoPillShowPlayPause: vpShowPlayPause ? vpShowPlayPause.checked : true,
      videoPillShowList: vpShowList ? vpShowList.checked : true,
      videoPillShowDownload: vpShowDownload ? vpShowDownload.checked : true,
      videoPillShowPip: vpShowPip ? vpShowPip.checked : true,
      videoPillShowFullscreen: vpShowFullscreen ? vpShowFullscreen.checked : true,
      pipSize: pipSizeSelect.value,
      pipOpacity: Number(Math.max(0.5, Math.min(1.0, Number.isFinite(rawPipOp) ? rawPipOp : 0.95)).toFixed(2)),
      adSkipSpeed: adSkipSpeedSelect.value,
      removeTransparentOverlay: removeOverlayToggle.checked,
      antiHistoryTrap: antiHistoryToggle.checked,
      dnrEnabled: dnrEnabledToggle.checked,
      redirectWindowSec: parseFloat(redirectWindowRange.value)
    };
  }

  [
    videoPillScaleRange,
    videoPillOpacityRange,
    hudScaleRange,
    hudOpacityRange,
    pipOpacityRange,
    hudDurationRange,
    videoDockDimRange,
    redirectWindowRange
  ].forEach((slider) => {
    if (slider) {
      slider.addEventListener("input", () => {
        updateSliderLabels();
        const globalSettings = collectGlobalForm();
        chrome.storage.local.set({ globalSettings });
      });
    }
  });

  [
    vpShowPlayPause,
    vpShowList,
    vpShowDownload,
    vpShowPip,
    vpShowFullscreen,
    hudShowTrust,
    hudShowGroup,
    hudShowOpen,
    hudShowBlock,
    hudShowUrlDetail
  ].forEach((chk) => {
    if (chk) {
      chk.addEventListener("change", async () => {
        const globalSettings = collectGlobalForm();
        await chrome.storage.local.set({ globalSettings });
        showStatus("Tampilan tombol menu HUD diperbarui!");
      });
    }
  });

  if (videoDockDirSelect) {
    videoDockDirSelect.addEventListener("change", async () => {
      const globalSettings = collectGlobalForm();
      await chrome.storage.local.set({ globalSettings });
      showStatus("Arah buka pil video diperbarui!");
    });
  }

  hudPositionSelect.addEventListener("change", async () => {
    if (hudPositions.topHud) {
      hudPositions.topHud = null;
      await chrome.storage.local.set({ hudPositions });
      renderHudPositionStatus();
    }
  });

  // Reset posisi masing-masing HUD
  document.querySelectorAll("[data-reset-hud]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.getAttribute("data-reset-hud");
      if (key && Object.prototype.hasOwnProperty.call(hudPositions, key)) {
        hudPositions[key] = null;
        await chrome.storage.local.set({ hudPositions: { ...hudPositions } });
        renderHudPositionStatus();
        const labelMap = {
          topHud: "HUD Blokir",
          videoDock: "Pil Video",
          miniPip: "Mini PiP"
        };
        showStatus(`Posisi ${labelMap[key] || key} dikembalikan ke default!`);
      }
    });
  });

  // Reset semua posisi HUD sekaligus
  const resetAllHudPosBtn = document.getElementById("resetAllHudPosBtn");
  if (resetAllHudPosBtn) {
    resetAllHudPosBtn.addEventListener("click", async () => {
      hudPositions = { ...DEFAULT_HUD_POSITIONS };
      await chrome.storage.local.set({ hudPositions: { ...hudPositions } });
      renderHudPositionStatus();
      showStatus("Semua posisi HUD dikembalikan ke tata letak default!");
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.hudPositions) {
      hudPositions = {
        ...DEFAULT_HUD_POSITIONS,
        ...(changes.hudPositions.newValue || {})
      };
      renderHudPositionStatus();
    }
    if (areaName === "local" && changes.globalSettings) {
      applyGlobalForm(changes.globalSettings.newValue);
    }
  });

  function cleanDomain(raw) {
    if (!raw) return "";
    let val = String(raw).trim().toLowerCase();
    try {
      if (val.includes("://")) {
        val = new URL(val).hostname.toLowerCase();
      } else {
        val = val.split("/")[0].split("?")[0].split("#")[0];
      }
    } catch {}
    val = val.replace(/^www\./, "").trim();
    if (!val || !val.includes(".")) return "";
    return val;
  }

  function renderLists() {
    tabBlacklistBtn.textContent = `🚫 Block (${deniedDomains.length})`;
    tabWhitelistBtn.textContent = `✅ Trust (${trustedDomains.length})`;

    if (deniedDomains.length === 0) {
      blacklistContainer.innerHTML = `<div class="empty-msg">Belum ada domain di Blacklist.</div>`;
    } else {
      blacklistContainer.innerHTML = deniedDomains.map((dom) => `
        <div class="domain-item">
          <span class="domain-name">${dom}</span>
          <button class="del-btn" data-type="blacklist" data-dom="${dom}" title="Hapus">✕</button>
        </div>
      `).join("");
    }

    if (trustedDomains.length === 0) {
      whitelistContainer.innerHTML = `<div class="empty-msg">Belum ada domain di Whitelist.</div>`;
    } else {
      whitelistContainer.innerHTML = trustedDomains.map((dom) => `
        <div class="domain-item">
          <span class="domain-name">${dom}</span>
          <button class="del-btn" data-type="whitelist" data-dom="${dom}" title="Hapus">✕</button>
        </div>
      `).join("");
    }

    document.querySelectorAll(".del-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const type = btn.getAttribute("data-type");
        const dom = btn.getAttribute("data-dom");
        if (type === "blacklist") {
          deniedDomains = deniedDomains.filter((d) => d !== dom);
          await chrome.storage.local.set({ deniedDomains });
          showStatus(`Dihapus dari Blacklist: ${dom}`);
        } else {
          trustedDomains = trustedDomains.filter((d) => d !== dom);
          await chrome.storage.local.set({ trustedDomains });
          showStatus(`Dihapus dari Whitelist: ${dom}`);
        }
        renderLists();
      });
    });
  }

  async function addDomain(type, rawInput) {
    const dom = cleanDomain(rawInput);
    if (!dom) {
      showStatus("Masukkan nama domain yang valid (misal: hai8g.com)");
      return;
    }

    if (type === "blacklist") {
      if (!deniedDomains.includes(dom)) deniedDomains.push(dom);
      trustedDomains = trustedDomains.filter((d) => d !== dom);
      blacklistInput.value = "";
      await chrome.storage.local.set({ deniedDomains, trustedDomains });
      showStatus(`Diblokir permanen: ${dom}`);
    } else {
      if (!trustedDomains.includes(dom)) trustedDomains.push(dom);
      deniedDomains = deniedDomains.filter((d) => d !== dom);
      whitelistInput.value = "";
      await chrome.storage.local.set({ trustedDomains, deniedDomains });
      showStatus(`Diizinkan (Whitelist): ${dom}`);
    }
    renderLists();
  }

  // Tab Switching
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const tabId = btn.getAttribute("data-tab");
      document.getElementById(`panel-${tabId}`).classList.add("active");
    });
  });

  async function refreshCacheCount() {
    const { aiAuditCache } = await chrome.storage.local.get(["aiAuditCache"]);
    const count = aiAuditCache && typeof aiAuditCache === "object" ? Object.keys(aiAuditCache).length : 0;
    if (aiCacheCountEl) aiCacheCountEl.textContent = String(count);
  }

  // Load Initial Data
  const stored = await chrome.storage.local.get([
    "geminiApiKey",
    "strictCrossOrigin",
    "autoSkipCountdown",
    "trustedDomains",
    "deniedDomains",
    "globalSettings",
    "hudPositions"
  ]);
  if (stored.geminiApiKey) apiInput.value = stored.geminiApiKey;
  strictToggle.checked = stored.strictCrossOrigin !== false;
  autoSkipToggle.checked = stored.autoSkipCountdown !== false;
  trustedDomains = Array.isArray(stored.trustedDomains) ? stored.trustedDomains : [];
  deniedDomains = Array.isArray(stored.deniedDomains) ? stored.deniedDomains : [];
  hudPositions = { ...DEFAULT_HUD_POSITIONS, ...(stored.hudPositions || {}) };
  applyGlobalForm(stored.globalSettings);
  renderHudPositionStatus();
  renderLists();
  refreshCacheCount();

  document.getElementById("saveBtn").addEventListener("click", async () => {
    const key = apiInput.value.trim();
    await chrome.storage.local.set({
      geminiApiKey: key,
      strictCrossOrigin: strictToggle.checked,
      autoSkipCountdown: autoSkipToggle.checked
    });
    showStatus(key ? "API Key & pengaturan tersimpan!" : "Mode Lokal tersimpan!");
  });

  // Save & Reset Setting
  document.getElementById("saveGlobalBtn").addEventListener("click", async () => {
    const globalSettings = collectGlobalForm();
    await chrome.storage.local.set({ globalSettings });
    showStatus("Setting v2.2.2 berhasil disimpan!");
  });

  document.getElementById("resetGlobalBtn").addEventListener("click", async () => {
    applyGlobalForm(DEFAULT_GLOBAL_SETTINGS);
    hudPositions = { ...DEFAULT_HUD_POSITIONS };
    await chrome.storage.local.set({
      globalSettings: { ...DEFAULT_GLOBAL_SETTINGS },
      hudPositions: { ...DEFAULT_HUD_POSITIONS }
    });
    renderHudPositionStatus();
    showStatus("Setting & posisi HUD dikembalikan ke default!");
  });

  // Salin Backup ke Clipboard
  document.getElementById("copyBackupBtn").addEventListener("click", async () => {
    const payload = {
      app: "AEGIS-AI Shield",
      version: "2.2.2",
      geminiApiKey: apiInput.value.trim(),
      strictCrossOrigin: strictToggle.checked,
      autoSkipCountdown: autoSkipToggle.checked,
      globalSettings: collectGlobalForm(),
      hudPositions,
      trustedDomains,
      deniedDomains
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    backupJsonArea.value = jsonStr;
    try {
      await navigator.clipboard.writeText(jsonStr);
      showStatus("Backup JSON tersalin ke Clipboard!");
    } catch {
      restoreDrawer.classList.add("open");
      backupJsonArea.select();
      showStatus("Salin teks JSON dari kotak di bawah.");
    }
  });

  document.getElementById("toggleRestoreBtn").addEventListener("click", async () => {
    restoreDrawer.classList.toggle("open");
    if (restoreDrawer.classList.contains("open")) {
      try {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim().startsWith("{")) {
          backupJsonArea.value = clipText.trim();
        }
      } catch {}
      backupJsonArea.focus();
    }
  });

  document.getElementById("closeRestoreBtn").addEventListener("click", () => {
    restoreDrawer.classList.remove("open");
  });

  document.getElementById("applyRestoreBtn").addEventListener("click", async () => {
    const rawText = backupJsonArea.value.trim();
    if (!rawText) {
      showStatus("Tempel (Paste) teks JSON cadangan terlebih dahulu!");
      return;
    }
    try {
      const parsed = JSON.parse(rawText);
      if (typeof parsed !== "object" || !parsed) throw new Error("Invalid JSON");

      if (typeof parsed.geminiApiKey === "string") apiInput.value = parsed.geminiApiKey;
      if (typeof parsed.strictCrossOrigin === "boolean") strictToggle.checked = parsed.strictCrossOrigin;
      if (typeof parsed.autoSkipCountdown === "boolean") autoSkipToggle.checked = parsed.autoSkipCountdown;
      if (Array.isArray(parsed.trustedDomains)) {
        trustedDomains = [...new Set(parsed.trustedDomains.map(cleanDomain).filter(Boolean))];
      }
      if (Array.isArray(parsed.deniedDomains)) {
        deniedDomains = [...new Set(parsed.deniedDomains.map(cleanDomain).filter(Boolean))];
      }
      if (parsed.globalSettings && typeof parsed.globalSettings === "object") {
        applyGlobalForm(parsed.globalSettings);
      }
      if (parsed.hudPositions && typeof parsed.hudPositions === "object") {
        hudPositions = {
          ...DEFAULT_HUD_POSITIONS,
          ...parsed.hudPositions
        };
      }

      await chrome.storage.local.set({
        geminiApiKey: apiInput.value.trim(),
        strictCrossOrigin: strictToggle.checked,
        autoSkipCountdown: autoSkipToggle.checked,
        globalSettings: collectGlobalForm(),
        hudPositions,
        trustedDomains,
        deniedDomains
      });

      renderHudPositionStatus();
      renderLists();
      restoreDrawer.classList.remove("open");
      showStatus("Data cadangan berhasil dipulihkan!");
    } catch {
      showStatus("Format JSON tidak valid!");
    }
  });

  document.getElementById("clearAiCacheBtn").addEventListener("click", async () => {
    await chrome.storage.local.set({ aiAuditCache: {} });
    await refreshCacheCount();
    showStatus("Cache AI berhasil dibersihkan!");
  });

  document.getElementById("addBlacklistBtn").addEventListener("click", () => {
    addDomain("blacklist", blacklistInput.value);
  });

  blacklistInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addDomain("blacklist", blacklistInput.value);
  });

  document.getElementById("addWhitelistBtn").addEventListener("click", () => {
    addDomain("whitelist", whitelistInput.value);
  });

  whitelistInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addDomain("whitelist", whitelistInput.value);
  });

  document.getElementById("blockCurrentSiteBtn").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.startsWith("http")) {
      addDomain("blacklist", tab.url);
    } else {
      showStatus("Tab aktif bukan halaman web http/https.");
    }
  });

  document.getElementById("trustCurrentSiteBtn").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.startsWith("http")) {
      addDomain("whitelist", tab.url);
    } else {
      showStatus("Tab aktif bukan halaman web http/https.");
    }
  });
});
