// @ts-check
/**
 * AEGIS-AI Shield v3.2.0 — Structured Internal Error Logging & Universal Secret Redactor
 * Ensures API keys, bearer tokens, JWTs, and sensitive query values NEVER reach logs or reports.
 */

let debugEnabled = false;
/** @type {((entry: { scope: string, message: string }) => void) | null} */
let debugSink = null;

/**
 * Enable or disable internal debug error capture.
 * @param {boolean} enabled
 */
export function setDebugEnabled(enabled) {
  debugEnabled = Boolean(enabled);
}

/**
 * Register a sink callback that receives internal debug errors when enabled.
 * @param {((entry: { scope: string, message: string }) => void) | null} sinkFn
 */
export function setDebugSink(sinkFn) {
  debugSink = typeof sinkFn === "function" ? sinkFn : null;
}

const SENSITIVE_QUERY_KEYS =
  /^(token|t|key|api_?key|auth|sig|signature|session|sid|code|access_token|id_token|refresh_token|email|pass|password|pwd|secret|hash|cookie|jwt|x-goog-api-key)$/i;

/**
 * Redact API keys, Bearer tokens, JWTs, and inline credential key-value pairs from free text.
 * @param {string} rawText
 * @param {number} [maxLen]
 * @returns {string}
 */
export function redactSensitiveText(rawText, maxLen = 320) {
  if (!rawText || typeof rawText !== "string") return "";
  return rawText
    .replace(/AIza[0-9A-Za-z\-_]{16,}/g, "[REDACTED_API_KEY]")
    .replace(/\b(sk-[A-Za-z0-9\-_]{16,}|ghp_[A-Za-z0-9]{20,})\b/g, "[REDACTED_SECRET]")
    .replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}\b/g, "[REDACTED_JWT]")
    .replace(
      /([?&](?:token|key|api_?key|auth|access_token|id_token|refresh_token|session|sid|secret|password|pwd)=)[^&#\s]+/gi,
      "$1[REDACTED]"
    )
    .slice(0, maxLen);
}

/**
 * Report an internal error when debug mode is active (always redacted).
 * @param {string} scope
 * @param {unknown} err
 */
export function logInternalError(scope, err) {
  if (!debugEnabled || !debugSink) return;
  try {
    const rawMsg =
      err instanceof Error
        ? `${err.name}: ${err.message}`
        : String(err || "Unknown internal error");
    debugSink({
      scope: String(scope || "internal"),
      message: redactSensitiveText(rawMsg, 260)
    });
  } catch {
    // Never let debug logging crash the host page or worker
  }
}

/**
 * Safely execute a function without silent swallowing when debug mode is active.
 * @template T
 * @param {string} scope
 * @param {() => T} fn
 * @param {T} [fallback]
 * @returns {T}
 */
export function safeTry(scope, fn, fallback) {
  try {
    return fn();
  } catch (err) {
    logInternalError(scope, err);
    return /** @type {T} */ (fallback);
  }
}

/**
 * Sanitize URLs before storing in diagnostic logs or exporting in a False Positive report.
 * Masks sensitive query parameters, credentials in userinfo, and API keys (AIza...).
 * @param {string} rawUrl
 * @returns {string}
 */
export function sanitizeUrlForReport(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "-";
  const redactedKeys = redactSensitiveText(rawUrl, 500);
  return safeTry(
    "debug.sanitizeUrl",
    () => {
      const u = new URL(redactedKeys);
      const nextParams = new URLSearchParams();
      for (const [k, v] of u.searchParams.entries()) {
        if (SENSITIVE_QUERY_KEYS.test(k) || v.length > 48) {
          nextParams.set(k, "[REDACTED]");
        } else {
          nextParams.set(k, redactSensitiveText(v, 48));
        }
      }
      const qs = nextParams.toString();
      // Always strip embedded URL username:password credentials if present
      return `${u.protocol}//${u.host}${u.pathname}${qs ? "?" + qs : ""}`;
    },
    redactedKeys.slice(0, 180)
  );
}

/**
 * Build a sanitized, opt-in local False Positive diagnostic report ready for manual copy-paste.
 * @param {object} params
 * @param {string} [params.version]
 * @param {string} [params.activeUrl]
 * @param {string} [params.protectionMode]
 * @param {boolean} [params.tempAllowActive]
 * @param {Array<any>} [params.logs]
 * @param {{ blocked?: number, bypassed?: number, allowed?: number }} [params.stats]
 * @returns {string}
 */
export function buildSanitizedFalsePositiveReport({
  version = "3.2.0",
  activeUrl = "",
  protectionMode = "balanced",
  tempAllowActive = false,
  logs = [],
  stats = {}
}) {
  const recent = (Array.isArray(logs) ? logs : []).slice(0, 20);
  const lines = [
    `=== AEGIS-AI SHIELD v${version} FALSE POSITIVE REPORT (SANITIZED) ===`,
    `Mode Proteksi : ${protectionMode} | Temporary Allow: ${tempAllowActive ? "AKTIF" : "NONAKTIF"}`,
    `Halaman Aktif : ${sanitizeUrlForReport(activeUrl)}`,
    `Statistik Sesi: Blokir=${stats.blocked || 0}, Bypass=${stats.bypassed || 0}, Lolos=${stats.allowed || 0}`,
    "Privasi       : Query sensitif, token & API key otomatis disensor. Laporan ini tidak dikirim otomatis.",
    "------------------------------------------------------------------"
  ];

  if (recent.length === 0) {
    lines.push("(Tidak ada entri log terbaru.)");
    return lines.join("\n");
  }

  for (const entry of recent) {
    const dt = new Date(entry.ts || Date.now());
    /** @param {number} n */
    const pad = (n) => String(n).padStart(2, "0");
    const tsStr = `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
    const safeFrom = sanitizeUrlForReport(entry.fromUrl || "");
    const safeTo = entry.toUrl ? ` -> ${sanitizeUrlForReport(entry.toUrl)}` : "";
    const safeDetail = redactSensitiveText(String(entry.detail || "-"), 220);
    lines.push(
      `[${tsStr}] [${entry.level || "WARN"}/${entry.source || "background"}] ${entry.code || "EVENT"}\n  URL    : ${safeFrom}${safeTo}\n  Detail : ${safeDetail}`
    );
  }

  return lines.join("\n\n");
}
