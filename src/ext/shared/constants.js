// @ts-check
/**
 * AEGIS-AI Shield v3.2.4 — Centralized Configuration & Pattern Constants
 * Single source of truth shared across background, main_world, content, and popup.
 */

export const AEGIS_VERSION = "3.2.4";
export const GEMINI_MODEL = "gemini-2.5-flash";

// P7: Neutral default whitelist (zero pre-whitelisted third-party sites on fresh installs)
/** @type {string[]} */
export const DEFAULT_TRUSTED_DOMAINS = [];

export const TIMINGS = Object.freeze({
  DNR_DEBOUNCE_MS: 350,
  DNR_BATCH_SIZE: 150,
  DNR_FALLBACK_MAX_RULES: 5000,
  TAB_HISTORY_TTL_MS: 2 * 60 * 60 * 1000,
  TAB_HISTORY_CLEANUP_INTERVAL_MS: 15 * 60 * 1000,
  WORKER_STATE_FLUSH_MS: 250,
  LOG_FLUSH_DEBOUNCE_MS: 220,
  MAX_LOGS: 120,
  OBSERVER_DEBOUNCE_MS: 220,
  OVERLAY_SWEEP_THROTTLE_MS: 900,
  AUTO_SKIP_INTERVAL_MS: 1000,
  CAPTCHA_RECOVERY_POLL_MS: 2000,
  BYPASS_TOAST_MS: 800,
  BYPASS_TOAST_MAX_WAIT_MS: 1100,
  SHORTLINK_CTA_GRACE_MS: 9000,
  AUTH_GRACE_MS: 30000,
  FIRST_PAGE_GRACE_MS: 6000,
  REVERT_COOLDOWN_MS: 2200,
  LOOP_LOCK_MS: 15000,
  REDIRECT_CHAIN_WINDOW_MS: 6000,
  REDIRECT_CHAIN_MAX_HOPS: 3,
  USER_GESTURE_WINDOW_MS: 1800,
  MEDIA_TAP_GUARD_MS: 2000,
  AUTH_GESTURE_WINDOW_MS: 6000,
  TIMER_SCAN_CACHE_TTL_MS: 500,
  HISTORY_FLOOD_WINDOW_MS: 1500,
  HISTORY_FLOOD_MAX_CALLS: 6,
  HISTORY_FLOOD_MAX_DUPES: 3,
  HISTORY_REPLACE_MAX_CALLS: 5,
  POPSTATE_GRACE_MS: 1200,
  GEMINI_TIMEOUT_MS: 8000,
  GEMINI_MAX_RETRIES: 2,
  AI_CACHE_TTL_MS: 6 * 60 * 60 * 1000,
  AI_CACHE_MAX_ENTRIES: 60,
  BRIDGE_MAX_EVENTS_PER_SEC: 25,
  HUD_MAX_PROMPTS_PER_MIN: 8,
  HUD_MAX_PROMPTS_PER_PAGE: 20,
  VIDEO_DOCK_MAX_ITEMS_PER_PAGE: 12,
  VIDEO_DOCK_MAX_ADDS_PER_MIN: 20,
  MAIN_LOG_MAX_PER_MIN: 30,
  MAX_DENIED_DOMAINS: 5000,
  MAX_TRUSTED_DOMAINS: 2000
});

export const BRIDGE_EVENTS = Object.freeze({
  HANDSHAKE_INIT: "__AEGIS_HANDSHAKE_INIT__",
  HANDSHAKE_ACK: "__AEGIS_HANDSHAKE_ACK__",
  REQUEST_RULES: "__AEGIS_REQUEST_RULES__",
  SYNC_RULES: "__AEGIS_SYNC_RULES__",
  CAPTCHA_SIGNAL: "__AEGIS_CAPTCHA_SIGNAL__",
  SHORTLINK_CTA_CLICK: "__AEGIS_SHORTLINK_CTA_CLICK__",
  AUTH_GESTURE: "__AEGIS_AUTH_GESTURE__",
  BLOCKED_EVENT: "__AEGIS_BLOCKED_EVENT__",
  VIDEO_DETECTED: "__AEGIS_VIDEO_DETECTED__",
  AUTO_SKIPPED: "__AEGIS_AUTO_SKIPPED__",
  LOG_EVENT: "__AEGIS_LOG_EVENT__"
});

export const DEFAULT_GLOBAL_SETTINGS = Object.freeze({
  protectionMode: "balanced", // "balanced" | "strict"
  popupTheme: "dark", // "dark" | "light"
  sessionOnlyApiKey: true, // P5: Session-only storage is default
  geminiAuditEnabled: false, // P5: Opt-in & default OFF
  autoSkipCountdown: false, // P7: Opt-in timer acceleration (default OFF)
  debugInternalErrors: false,
  captchaKillSwitchEnabled: true,
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
  smartUgcSense: true,
  shortlinkBypassEnabled: true,
  shortlinkAutoClick: false, // P7: Opt-in auto-click CTA (default OFF)
  loggingEnabled: true,
  antiAntiAdblock: true,
  removeTransparentOverlay: true,
  antiHistoryTrap: true,
  dnrEnabled: true,
  redirectWindowSec: 3.5
});

export const DEFAULT_HUD_POSITIONS = Object.freeze({
  topHud: null,
  videoDock: null,
  miniPip: null
});

export const DEFAULT_STATS = Object.freeze({
  blocked: 0,
  bypassed: 0,
  allowed: 0
});

// =========================================================================
// SHARED DETECTION PATTERNS (P1, P2, P7 & Direct-Link Video Ad Guard)
// =========================================================================

export const SUSPICIOUS_TLD =
  /\.(cfd|xyz|top|cyou|icu|buzz|click|link|monster|quest|rest|sbs|shop|site|tokyo|vip|wang|win|work|wtf|zone|live|asia|online|store|fun|pro|club|cam|cc|me|pw|tk|ml|ga|cf|gq)$/i;

// P1: Specific unambiguous gambling terms (may match as hostname substring or whole word in query/text)
export const GAMBLING_SPECIFIC_REGEX =
  /(gacor|maxwin|togel|judol|sbobet|slot88|gacor88|maxwin88|pascol4d|dewadora|toto4d|situsresmi|linkalternatif|bonus100|slotgacor|judionline|bandartogel|pragmaticplay|pgsoft88|rtpslot|depo88|wd88|mpo88|olympus88|zeus88|jp88|mahjongways|sensational88|bola88|poker88|casino88|rajagacor|hoki88)/i;

// P1: Ambiguous gambling terms — ONLY matched as whole delimited tokens on hostname labels (never free path/query substring!)
export const GAMBLING_AMBIGUOUS_TOKEN_REGEX =
  /^(rtp|wd|judi|bandar|deposit|pragmatic|zeus|scatter|poker|slot|casino|betting|bonus)\d*$/i;

// P1: Whole-word / phrase gambling matcher for search queries & CTA button text (prevents smartphone/startpage/judiciary/bandara/pragmaticengineer/depositphotos false positives)
export const GAMBLING_SEARCH_WORD_REGEX =
  /\b(gacor|maxwin|togel|judol|sbobet|slot88|gacor88|maxwin88|pascol4d|dewadora|toto4d|situs\s*resmi|link\s*alternatif|bonus\s*100|slot\s*gacor|slot\s*online|judi\s*online|judi\s*bola|judi\s*slot|bandar\s*togel|bandar\s*judi|bandar\s*bola|pragmatic\s*play|rtp\s*(live|slot|gacor|hari\s*ini)|scatter\s*(hitam|slot|zeus)|zeus\s*(slot|gacor|maxwin|88)|deposit\s*(pulsa|dana|slot|qris|tanpa\s*potongan)|wd\s*(kilat|cepat|slot|gacor)|poker\s*online|live\s*casino|casino\s*online|daftar\s*(slot|judi|togel)|claim\s*bonus\s*slot|judi|casino|betting|poker|slot)\b/i;

export const GAMBLING_TEXT_STRICT_REGEX =
  /\b(gacor|maxwin|togel|judol|sbobet|slot88|gacor88|maxwin88|pascol4d|dewadora|toto4d|situsresmi|linkalternatif|bonus100|slot\s*gacor|slot\s*online|judi\s*online|judi\s*slot|judi\s*bola|bandar\s*togel|bandar\s*judi|pragmatic\s*play|rtp\s*(live|slot|gacor)|scatter\s*(hitam|slot)|zeus\s*(slot|88|gacor)|deposit\s*(pulsa|dana|slot|qris)|wd\s*(cepat|kilat|slot)|bonus\s*(new\s*member|100%|slot|deposit)|daftar\s*(slot|judi|togel)|claim\s*bonus\s*slot|live\s*casino|casino\s*online|poker\s*online|sports?\s*betting)\b/i;

export const COMMERCE_AFFILIATE_REGEX =
  /(shopee\.|shope\.ee|tokopedia\.|lazada\.|blibli\.|bukalapak\.|tiktok\.com\/t\/|invol\.co|accesstrade|admitad|ecotrack|go2cloud|onclickalgo|popads|popcash|propellerads|adsterra|hilltopads|exoclick|juicyads|trafficjunky|monetag|richads|wpadmngr|clickadu|doubleclick\.net|googlesyndication\.com|adservice\.google\.)/i;

export const EXPLICIT_AD_NETWORK_HOST_REGEX =
  /(^|\.)(invol\.co|accesstrade\.[^.]+|admitad\.com|ecotrack\.[^.]+|go2cloud\.org|onclickalgo\.com|popads\.net|popcash\.net|propellerads\.com|adsterra\.com|hilltopads\.net|exoclick\.com|juicyads\.com|trafficjunky\.net|monetag\.com|richads\.com|wpadmngr\.com|clickadu\.com|doubleclick\.net|googlesyndication\.com|adservice\.google\.[a-z.]+)$/i;

export const RANDOM_SHORT_DOMAIN_REGEX =
  /^(?:[0-9][a-z0-9]{3,7}|[a-z]{1,3}[0-9][a-z0-9]*[0-9][a-z0-9]{0,3})\.(com|net|org|co|id|io|info|biz)$/i;

// P2: Anchored strictly to actual ad/affiliate arbitrage query params — NEVER matches redirect_uri/redirect_url/redirect_to
export const SEARCH_ARBITRAGE_PARAMS =
  /[?&](utm_source=[^&]*ad|utm_medium=affiliate|af_siteid=|af_sub\d*=|clickid=|click_id=|subid=|sub_id=|aff_id=|affid=|zoneid=|bannerid=|popunder=|ad_redirect=|aff_redirect=|gclid=|fbclid=[^&]*ad)/i;

// Video-tap / direct-link ad network smartlink path (e.g., https://asiafilm.org/4/0a81c13285160c8c8cf50a40daa3adcb)
export const DIRECT_LINK_AD_PATH_REGEX = /^\/\d{1,2}\/[a-f0-9]{24,64}(\/|$)/i;

// P7: Trimmed safe media hosts — mainstream, verifiable image/cloud/media platforms only
export const SAFE_MEDIA_HOST_REGEX =
  /(^|\.)(imgur\.com|ibb\.co|postimg\.cc|flickr\.com|staticflickr\.com|wikimedia\.org|tenor\.com|giphy\.com|drive\.google\.com|docs\.google\.com|dropbox\.com|mega\.nz|mediafire\.com)$/i;

export const KNOWN_AD_SHORTENER_REGEX =
  /(^|\.)(optional\.me|see\.optional\.me|rebrand\.ly|bit\.ly|t\.ly|tinyurl\.com|is\.gd|v\.gd|cutt\.ly|shorturl\.at|ouo\.io|ouo\.press|shrinkme\.io|exe\.io|bc\.vc|adf\.ly|linkvertise\.com|loot-link\.com|lootdest\.org|adfly\.site|fc\.lc|za\.gl|gplinks\.co|safelinku\.com|semawur\.com|sfl\.gl)$/i;

export const ANTI_ADBLOCK_PROBE_HOST_REGEX =
  /(^|\.)(wpadmngr\.com|googletagmanager\.com|googlesyndication\.com|doubleclick\.net|google-analytics\.com|adservice\.google\.com|adsterra\.com|propellerads\.com|onclickalgo\.com|clickadu\.com|popads\.net|popcash\.net)$/i;

export const SEARCH_ENGINE_HOST_REGEX =
  /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|yandex\.[a-z.]+|ya\.ru|search\.brave\.com|ecosia\.org|startpage\.com|baidu\.com)$/i;

export const MESSENGER_OR_SOCIAL_ENTRY_REGEX =
  /(^|\.)(t\.me|telegram\.me|telegram\.org|telegra\.ph|wa\.me|whatsapp\.com|l\.wl\.co|l\.facebook\.com|lm\.facebook\.com|l\.instagram\.com|t\.co|redd\.it|out\.reddit\.com|discord\.com|discordapp\.com|line\.me)$/i;

// P2: Comprehensive OAuth/SSO/IdP path & parameter patterns
export const AUTH_PATH_OR_PARAM_REGEX =
  /(\/(login|signin|sign-in|log-in|auth|oauth|oauth2|sso|saml|openid|oidc|authorize|callback|session|sessions|account|accounts|passport|idp|cas|connect\/authorize|v2\/auth|login\/oauth|oauth2\/authorize|api\/oauth2|dialog\/oauth|cdn-cgi\/challenge-platform)(\/|$)|[?&](client_id|redirect_uri|redirect_url|response_type|state|scope|openid|code_challenge|samlrequest|return_to|continue|_xfRedirect|__cf_chl_tk|__cf_chl_rt_tk|__cf_chl_f_tk)=)/i;

export const AUTH_SUBDOMAIN_REGEX =
  /^(accounts|auth|login|signin|sso|id|oauth|passport|idp|iam|auth0|okta)\./i;

export const AUTH_PROVIDER_HOST_REGEX =
  /(^|\.)(auth0\.com|okta\.com|onelogin\.com|cloudflareaccess\.com|login\.microsoftonline\.com|login\.live\.com|login\.windows\.net|accounts\.google\.com|oauth2\.googleapis\.com|appleid\.apple\.com|id\.atlassian\.com|github\.com|discord\.com)$/i;

export const AUTH_BUTTON_REGEX =
  /\b(log\s?in|sign\s?in|masuk|daftar|register|sign\s?up|sso|oauth|continue with|lanjutkan dengan|google|microsoft|apple|github|facebook|yandex|discord)\b/i;

export const CHALLENGE_HOST_REGEX =
  /(challenges\.cloudflare\.com|cloudflarecaptcha\.com|hcaptcha\.com|recaptcha\.net|gstatic\.com\/recaptcha|arkoselabs\.com|funcaptcha\.com|captcha-delivery\.com|datadome\.co|perimeterx\.net|dnstest\.dev)/i;

export const SAFE_ECOSYSTEM_GROUPS = [
  /(^|\.)(yandex\.(com|ru|kz|by|uz|ua|tr|net)|ya\.ru|yastatic\.net)$/i,
  /(^|\.)(google\.(com|co\.id|com\.sg|com\.my)|googleapis\.com|gstatic\.com|youtube\.com|youtu\.be)$/i,
  /(^|\.)(microsoft\.com|live\.com|bing\.com|msn\.com|microsoftonline\.com|login\.windows\.net)$/i,
  /(^|\.)(apple\.com|icloud\.com)$/i,
  /(^|\.)(github\.com|githubusercontent\.com)$/i,
  /(^|\.)(facebook\.com|fb\.com|instagram\.com)$/i,
  /(^|\.)(discord\.com|discordapp\.com)$/i
];

export const NON_VIDEO_ASSET_REGEX =
  /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|avif|css|js|json|woff2?|ttf|eot|vtt|srt)(\?|#|$)/i;

export const VIDEO_EXT_REGEX =
  /\.(mp4|m3u8|mkv|webm|mov|avi|flv|ts|mpd)(\?|#|$)/i;

export const VIDEO_STREAM_HINT_REGEX =
  /(\/pass_md5\/|\/hls\/|\/stream\/|\/get_video|mime=video|videoplayback|master\.txt|index\.txt|doodcdn|cloudcdn|vidcdn|\/token\/|\/delivery\/)/i;

export const VIDEO_MIME_REGEX =
  /^(video\/|application\/(vnd\.apple\.mpegurl|x-mpegurl|dash\+xml))/i;

export const DISGUISED_AD_CLASS_REGEX =
  /\b(itr|sambannerunit|samitem|samcodeunit|samad|ad-banner|adbanner|banner-ads|sponsored-slot|promo-banner|slot-banner|judol-banner|ad-rotator|popunder-trigger|aff-banner)\b/i;

export const AD_SLOT_CLASS_ID_REGEX =
  /\b(sambannerunit|samcodeunit|samitem|samad|ad-container|ads-wrapper|banner-iklan|slot-iklan|iklan-banner|sponsor-banner|floating-ad|sticky-ad)\b/i;
