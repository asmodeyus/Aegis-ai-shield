const DEFAULT_GLOBAL_SETTINGS = {
  hudEnabled: true,
  hudDurationSec: 4.5,
  hudPosition: "top-center",
  videoDockEnabled: true,
  videoDockDimSec: 2.5,
  pipSize: "medium",
  adSkipSpeed: "16",
  removeTransparentOverlay: true,
  antiHistoryTrap: true,
  dnrEnabled: true,
  redirectWindowSec: 3.5
};

document.addEventListener("DOMContentLoaded", async () => {
  const apiInput = document.getElementById("apiKey");
  const strictToggle = document.getElementById("strictCrossToggle");
  const autoSkipToggle = document.getElementById("autoSkipToggle");
  const statusEl = document.getElementById("status");
  const aiCacheCountEl = document.getElementById("aiCacheCount");

  // Global setting controls
  const hudEnabledToggle = document.getElementById("hudEnabledToggle");
  const hudDurationRange = document.getElementById("hudDurationRange");
  const hudDurationVal = document.getElementById("hudDurationVal");
  const hudPositionSelect = document.getElementById("hudPositionSelect");

  const videoDockEnabledToggle = document.getElementById("videoDockEnabledToggle");
  const videoDockDimRange = document.getElementById("videoDockDimRange");
  const videoDockDimVal = document.getElementById("videoDockDimVal");
  const pipSizeSelect = document.getElementById("pipSizeSelect");

  const adSkipSpeedSelect = document.getElementById("adSkipSpeedSelect");
  const removeOverlayToggle = document.getElementById("removeOverlayToggle");
  const antiHistoryToggle = document.getElementById("antiHistoryToggle");
  const dnrEnabledToggle = document.getElementById("dnrEnabledToggle");
  const redirectWindowRange = document.getElementById("redirectWindowRange");
  const redirectWindowVal = document.getElementById("redirectWindowVal");

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

  function showStatus(msg) {
    statusEl.textContent = msg;
    clearTimeout(window.__stTimer);
    window.__stTimer = setTimeout(() => { statusEl.textContent = ""; }, 3200);
  }

  function updateSliderLabels() {
    const hudSec = parseFloat(hudDurationRange.value);
    hudDurationVal.textContent = hudSec === 0 ? "Manual (∞)" : `${hudSec.toFixed(1)} detik`;

    const dimSec = parseFloat(videoDockDimRange.value);
    videoDockDimVal.textContent = dimSec === 0 ? "Selalu Terang" : `${dimSec.toFixed(1)} detik`;

    const redSec = parseFloat(redirectWindowRange.value);
    redirectWindowVal.textContent = `${redSec.toFixed(1)} detik`;
  }

  function applyGlobalForm(cfg) {
    const g = { ...DEFAULT_GLOBAL_SETTINGS, ...(cfg || {}) };
    hudEnabledToggle.checked = g.hudEnabled !== false;
    hudDurationRange.value = String(g.hudDurationSec ?? 4.5);
    hudPositionSelect.value = g.hudPosition || "top-center";
    videoDockEnabledToggle.checked = g.videoDockEnabled !== false;
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
    return {
      hudEnabled: hudEnabledToggle.checked,
      hudDurationSec: parseFloat(hudDurationRange.value),
      hudPosition: hudPositionSelect.value,
      videoDockEnabled: videoDockEnabledToggle.checked,
      videoDockDimSec: parseFloat(videoDockDimRange.value),
      pipSize: pipSizeSelect.value,
      adSkipSpeed: adSkipSpeedSelect.value,
      removeTransparentOverlay: removeOverlayToggle.checked,
      antiHistoryTrap: antiHistoryToggle.checked,
      dnrEnabled: dnrEnabledToggle.checked,
      redirectWindowSec: parseFloat(redirectWindowRange.value)
    };
  }

  hudDurationRange.addEventListener("input", updateSliderLabels);
  videoDockDimRange.addEventListener("input", updateSliderLabels);
  redirectWindowRange.addEventListener("input", updateSliderLabels);

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

  async function addToList(type, rawVal) {
    const dom = cleanDomain(rawVal);
    if (!dom) {
      showStatus("Masukkan nama domain yang valid!");
      return;
    }

    if (type === "blacklist") {
      if (!deniedDomains.includes(dom)) deniedDomains.push(dom);
      trustedDomains = trustedDomains.filter((d) => d !== dom);
      await chrome.storage.local.set({ deniedDomains, trustedDomains });
      blacklistInput.value = "";
      showStatus(`Ditambahkan ke Blacklist & DNR: ${dom}`);
    } else {
      if (!trustedDomains.includes(dom)) trustedDomains.push(dom);
      deniedDomains = deniedDomains.filter((d) => d !== dom);
      await chrome.storage.local.set({ trustedDomains, deniedDomains });
      whitelistInput.value = "";
      showStatus(`Ditambahkan ke Whitelist: ${dom}`);
    }
    renderLists();
  }

  // Tab navigation
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`panel-${btn.getAttribute("data-tab")}`).classList.add("active");
    });
  });

  // Load initial data
  const data = await chrome.storage.local.get([
    "geminiApiKey",
    "strictCrossOrigin",
    "autoSkipCountdown",
    "trustedDomains",
    "deniedDomains",
    "aiAuditCache",
    "globalSettings"
  ]);
  if (data.geminiApiKey) apiInput.value = data.geminiApiKey;
  strictToggle.checked = data.strictCrossOrigin !== false;
  autoSkipToggle.checked = data.autoSkipCountdown !== false;
  trustedDomains = Array.isArray(data.trustedDomains) ? data.trustedDomains : [];
  deniedDomains = Array.isArray(data.deniedDomains) ? data.deniedDomains : [];
  applyGlobalForm(data.globalSettings);

  const cacheObj = data.aiAuditCache && typeof data.aiAuditCache === "object" ? data.aiAuditCache : {};
  aiCacheCountEl.textContent = String(Object.keys(cacheObj).length);
  renderLists();

  strictToggle.addEventListener("change", async () => {
    await chrome.storage.local.set({ strictCrossOrigin: strictToggle.checked });
    showStatus(strictToggle.checked ? "Strict Lintas-Domain: AKTIF" : "Strict Lintas-Domain: NONAKTIF");
  });

  autoSkipToggle.addEventListener("change", async () => {
    await chrome.storage.local.set({ autoSkipCountdown: autoSkipToggle.checked });
    showStatus(autoSkipToggle.checked ? "Auto-Skip Countdown: AKTIF" : "Auto-Skip Countdown: NONAKTIF");
  });

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
    showStatus("Setting berhasil disimpan!");
  });

  document.getElementById("resetGlobalBtn").addEventListener("click", async () => {
    applyGlobalForm(DEFAULT_GLOBAL_SETTINGS);
    await chrome.storage.local.set({ globalSettings: { ...DEFAULT_GLOBAL_SETTINGS } });
    showStatus("Setting dikembalikan ke default!");
  });

  // Salin Backup ke Clipboard (aman 100% di popup Android & Desktop)
  document.getElementById("copyBackupBtn").addEventListener("click", async () => {
    const payload = {
      app: "AEGIS-AI Shield",
      version: "2.1.3",
      geminiApiKey: apiInput.value.trim(),
      strictCrossOrigin: strictToggle.checked,
      autoSkipCountdown: autoSkipToggle.checked,
      globalSettings: collectGlobalForm(),
      trustedDomains,
      deniedDomains
    };
    const jsonStr = JSON.stringify(payload);
    backupJsonArea.value = jsonStr;
    restoreDrawer.classList.add("open");
    backupJsonArea.select();
    try {
      await navigator.clipboard.writeText(jsonStr);
      showStatus("Backup JSON tersalin ke Clipboard!");
    } catch {
      try {
        document.execCommand("copy");
        showStatus("Backup JSON tersalin!");
      } catch {
        showStatus("Teks backup siap disalin dari kotak di bawah.");
      }
    }
  });

  // Buka panel Tempel Backup
  document.getElementById("toggleRestoreBtn").addEventListener("click", async () => {
    restoreDrawer.classList.toggle("open");
    if (restoreDrawer.classList.contains("open")) {
      backupJsonArea.value = "";
      backupJsonArea.focus();
      try {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim().startsWith("{")) {
          backupJsonArea.value = clipText.trim();
        }
      } catch {}
    }
  });

  document.getElementById("closeRestoreBtn").addEventListener("click", () => {
    restoreDrawer.classList.remove("open");
  });

  // Terapkan Backup JSON dari textarea
  document.getElementById("applyRestoreBtn").addEventListener("click", async () => {
    const rawText = backupJsonArea.value.trim();
    if (!rawText) {
      showStatus("Tempel teks JSON cadangan terlebih dahulu!");
      return;
    }
    try {
      const parsed = JSON.parse(rawText);
      const rawTrusted = Array.isArray(parsed.trustedDomains) ? parsed.trustedDomains : [];
      const rawDenied = Array.isArray(parsed.deniedDomains) ? parsed.deniedDomains : [];

      const mergedTrusted = new Set(trustedDomains);
      const mergedDenied = new Set(deniedDomains);

      rawDenied.forEach((d) => {
        const c = cleanDomain(d);
        if (c) {
          mergedDenied.add(c);
          mergedTrusted.delete(c);
        }
      });
      rawTrusted.forEach((d) => {
        const c = cleanDomain(d);
        if (c && !mergedDenied.has(c)) {
          mergedTrusted.add(c);
        }
      });

      trustedDomains = Array.from(mergedTrusted);
      deniedDomains = Array.from(mergedDenied);

      const updates = { trustedDomains, deniedDomains };
      if (typeof parsed.geminiApiKey === "string" && parsed.geminiApiKey.trim()) {
        apiInput.value = parsed.geminiApiKey.trim();
        updates.geminiApiKey = parsed.geminiApiKey.trim();
      }
      if (typeof parsed.strictCrossOrigin === "boolean") {
        strictToggle.checked = parsed.strictCrossOrigin;
        updates.strictCrossOrigin = parsed.strictCrossOrigin;
      }
      if (typeof parsed.autoSkipCountdown === "boolean") {
        autoSkipToggle.checked = parsed.autoSkipCountdown;
        updates.autoSkipCountdown = parsed.autoSkipCountdown;
      }
      if (parsed.globalSettings && typeof parsed.globalSettings === "object") {
        const mergedGlobal = { ...DEFAULT_GLOBAL_SETTINGS, ...parsed.globalSettings };
        applyGlobalForm(mergedGlobal);
        updates.globalSettings = mergedGlobal;
      }

      await chrome.storage.local.set(updates);
      renderLists();
      restoreDrawer.classList.remove("open");
      showStatus(`Pulih: ${trustedDomains.length} Trust, ${deniedDomains.length} Block!`);
    } catch {
      showStatus("Format JSON tidak valid!");
    }
  });

  // Clear AI Cache
  document.getElementById("clearAiCacheBtn").addEventListener("click", async () => {
    await chrome.storage.local.set({ aiAuditCache: {} });
    aiCacheCountEl.textContent = "0";
    showStatus("Cache Audit AI berhasil dibersihkan!");
  });

  document.getElementById("addBlacklistBtn").addEventListener("click", () => addToList("blacklist", blacklistInput.value));
  blacklistInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addToList("blacklist", blacklistInput.value); });

  document.getElementById("addWhitelistBtn").addEventListener("click", () => addToList("whitelist", whitelistInput.value));
  whitelistInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addToList("whitelist", whitelistInput.value); });

  async function getActiveTabHost() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0] && tabs[0].url && tabs[0].url.startsWith("http")) {
      return new URL(tabs[0].url).hostname.replace(/^www\./, "");
    }
    return "";
  }

  document.getElementById("addCurrentToBlacklistBtn").addEventListener("click", async () => {
    const host = await getActiveTabHost();
    if (host) addToList("blacklist", host);
    else showStatus("Tab aktif bukan halaman web.");
  });

  document.getElementById("addCurrentToWhitelistBtn").addEventListener("click", async () => {
    const host = await getActiveTabHost();
    if (host) addToList("whitelist", host);
    else showStatus("Tab aktif bukan halaman web.");
  });
});
