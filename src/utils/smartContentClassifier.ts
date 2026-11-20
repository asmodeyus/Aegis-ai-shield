export type ContentLinkCategory =
  | 'AUTH_OR_SAME_ORIGIN'
  | 'SAFE_MEDIA_OR_UGC'
  | 'SUSPICIOUS_EXTERNAL_UGC_HOLD'
  | 'AD_INFILTRATED_IMAGE_OR_BANNER'
  | 'BLACKLISTED_SILENT_BLOCK';

export interface ContentLinkContext {
  pageUrl: string;
  rawHref: string;
  isInsideUserPostContent: boolean;
  isInsideRealAdSlot: boolean;
  hasAntiAdblockBaitClass?: boolean;
  cssClassSignature?: string;
  hasImgChild?: boolean;
  imgSrc?: string;
  hasSuspiciousInlineOnclick?: boolean;
  trustedDomains?: string[];
  deniedDomains?: string[];
  smartUgcSense?: boolean;
}

export interface ContentClassificationVerdict {
  category: ContentLinkCategory;
  resolvedUrl: string;
  shouldAllowDirectly: boolean;
  shouldHoldInHud: boolean;
  shouldSilentBlock: boolean;
  neverDisablePointerEvents: boolean;
  thumbnailMatchesDestDomain: boolean;
  reason: string;
}

export interface FirstPageEntryContext {
  targetUrl: string;
  previousTabUrl?: string;
  referrerUrl?: string;
  transitionType?: string;
  transitionQualifiers?: string[];
  isTabStackEmpty?: boolean;
  trustedDomains?: string[];
  deniedDomains?: string[];
}

export interface FirstPageEntryVerdict {
  shouldAllowEntry: boolean;
  isBlacklisted: boolean;
  entrySource:
    | 'BLACKLISTED'
    | 'FIRST_TAB_PAGE'
    | 'SEARCH_ENGINE_RESULT'
    | 'MESSENGER_OR_SOCIAL_APP'
    | 'DIRECT_OR_BOOKMARK'
    | 'IN_TAB_NAVIGATION';
}

export const GAMBLING_REGEX =
  /(slot|gacor|maxwin|zeus|pragmatic|togel|judol|casino|betting|scatter|rtp|deposit|wd|bonus100|situsresmi|linkalternatif|sbobet|poker|judi|bandar|pascol4d|dewadora|toto4d)/i;

export const SUSPICIOUS_HOST_REGEX =
  /\.(cfd|xyz|top|cyou|icu|buzz|click|link|monster|quest|rest|sbs|shop|site|tokyo|vip|wang|win|work|wtf|zone|live|asia|online|store|fun|pro|club|cam|cc|me|pw|tk|ml|ga|cf|gq)$/i;

export const COMMERCE_AFFILIATE_REGEX =
  /(shopee\.|shope\.ee|tokopedia\.|lazada\.|blibli\.|bukalapak\.|tiktok\.com\/t\/|invol\.co|accesstrade|admitad|ecotrack|go2cloud|onclickalgo|popads|popcash|propellerads|adsterra|hilltopads|exoclick|juicyads|trafficjunky|monetag|richads|wpadmngr|clickadu)/i;

export const RANDOM_SHORT_DOMAIN_REGEX =
  /^[a-z0-9]{2,4}[0-9][a-z0-9]{1,4}\.(com|net|org|co|id|io|info|biz)$/i;

export const SEARCH_ARBITRAGE_PARAMS_REGEX =
  /(utm_source=.*ad|utm_medium=affiliate|af_siteid=|af_sub|clickid=|click_id=|subid=|sub_id=|aff_id=|zoneid=|bannerid=|popunder|redirect|gclid=)/i;

export const SAFE_MEDIA_HOST_REGEX =
  /(^|\.)(ibb\.co|ibb\.co\.com|imgur\.com|postimg\.cc|pixhost\.to|imgbox\.com|imagebam\.com|prnt\.sc|prntscr\.com|gyazo\.com|flickr\.com|staticflickr\.com|wikimedia\.org|tenor\.com|giphy\.com|redgifs\.com|catbox\.moe|bunkr\.(si|ru|is|la|sk|ax|ac|black|red|media|site)|cyberdrop\.(me|to|cc)|pixeldrain\.com|gofile\.io|mega\.nz|mediafire\.com|drive\.google\.com|docs\.google\.com|dropbox\.com)$/i;

export const KNOWN_AD_SHORTENER_REGEX =
  /(^|\.)(optional\.me|see\.optional\.me|rebrand\.ly|bit\.ly|t\.ly|tinyurl\.com|is\.gd|v\.gd|cutt\.ly|shorturl\.at|ouo\.io|shrinkme\.io|exe\.io|bc\.vc|adf\.ly|linkvertise\.com)$/i;

export const DISGUISED_AD_CSS_CLASS_REGEX =
  /\b(samBannerUnit|samCodeUnit|adsbygoogle|floating-ad|popup-ad|banner-ad|iklan-banner|sponsor-banner|sticky-ad|exo-native|mgid-widget|taboola|outbrain|popunder-layer)\b/i;

export const SEARCH_ENGINE_HOST_REGEX =
  /(^|\.)(google\.(com|co\.id|com\.sg|com\.my|co\.uk|co\.jp|de|fr|ru|ca|com\.au)|bing\.com|duckduckgo\.com|search\.yahoo\.com|yandex\.(com|ru|kz|by|tr)|ya\.ru|search\.brave\.com|ecosia\.org|startpage\.com|baidu\.com)$/i;

export const MESSENGER_OR_SOCIAL_ENTRY_REGEX =
  /(^|\.)(t\.me|telegram\.me|telegram\.org|telegra\.ph|tdesktop\.com|wa\.me|whatsapp\.com|l\.wl\.co|line\.me|discord\.com|discordapp\.com|l\.facebook\.com|lm\.facebook\.com|m\.facebook\.com|facebook\.com|l\.instagram\.com|instagram\.com|t\.co|twitter\.com|x\.com|out\.reddit\.com|reddit\.com)$/i;

export const EXTERNAL_APP_REFERRER_REGEX =
  /^(android-app:\/\/(org\.telegram|com\.whatsapp|com\.google\.android\.googlequicksearchbox|com\.google\.android\.gm|com\.facebook|com\.twitter|com\.discord|jp\.naver\.line)|telegram:|whatsapp:)/i;

export const AUTH_URL_REGEX =
  /(\/(login|signin|sign-in|log-in|auth|oauth|oauth2|sso|saml|openid|oidc|authorize|callback|session|account|accounts|passport|idp|cas|connect\/authorize|v2\/auth)(\/|$)|[?&](client_id|redirect_uri|response_type|state|scope|openid|code_challenge|samlrequest|return_to|continue|_xfRedirect)=)/i;

export const AUTH_SUBDOMAIN_REGEX = /^(accounts|auth|login|signin|sso|id|oauth|passport|idp|iam)\./i;

export function getBaseDomain(hostname: string): string {
  const clean = hostname.toLowerCase().replace(/^www\./, '');
  const parts = clean.split('.').filter(Boolean);
  if (parts.length <= 2) return clean;
  const sld = parts[parts.length - 2];
  if (['co', 'com', 'net', 'org', 'ac', 'go', 'or', 'web', 'sch'].includes(sld) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

export function normalizeDomainRule(rawRule: string): string {
  if (!rawRule) return '';
  let val = String(rawRule).trim().toLowerCase();
  try {
    if (val.includes('://')) {
      val = new URL(val).hostname.toLowerCase();
    } else {
      val = val.split('/')[0].split('?')[0].split('#')[0];
    }
  } catch {
    // ignore URL parse error
  }
  return val.replace(/^www\./, '').replace(/^\.+|\.+$/g, '');
}

export function isDomainMatchedInList(urlOrHost: string, domainList: string[] = []): boolean {
  if (!urlOrHost || !Array.isArray(domainList) || domainList.length === 0) return false;
  let host = String(urlOrHost).trim().toLowerCase();
  try {
    if (host.includes('://')) {
      host = new URL(host).hostname.toLowerCase();
    } else {
      host = host.split('/')[0].split('?')[0].split('#')[0];
    }
  } catch {
    return false;
  }
  host = host.replace(/^www\./, '');
  if (!host) return false;
  const base = getBaseDomain(host);

  return domainList.some((entry) => {
    const cleanEntry = normalizeDomainRule(entry);
    if (!cleanEntry) return false;
    const entryBase = getBaseDomain(cleanEntry);
    return (
      host === cleanEntry ||
      base === cleanEntry ||
      base === entryBase ||
      host.endsWith('.' + cleanEntry) ||
      host.endsWith('.' + entryBase)
    );
  });
}

export function evaluateFirstPageOrExternalEntry(ctx: FirstPageEntryContext): FirstPageEntryVerdict {
  const denied = ctx.deniedDomains || [];
  if (isDomainMatchedInList(ctx.targetUrl, denied)) {
    return {
      shouldAllowEntry: false,
      isBlacklisted: true,
      entrySource: 'BLACKLISTED',
    };
  }

  const qualifiers = ctx.transitionQualifiers || [];
  const tType = ctx.transitionType || '';

  // 1. Direct external app launch (Android Telegram/WhatsApp/Chrome Custom Tab / API / Address bar / Bookmark)
  if (
    qualifiers.includes('from_api') ||
    qualifiers.includes('from_address_bar') ||
    tType === 'typed' ||
    tType === 'auto_bookmark' ||
    tType === 'generated' ||
    tType === 'start_page' ||
    tType === 'auto_toplevel'
  ) {
    return {
      shouldAllowEntry: true,
      isBlacklisted: false,
      entrySource: qualifiers.includes('from_api') ? 'MESSENGER_OR_SOCIAL_APP' : 'DIRECT_OR_BOOKMARK',
    };
  }

  // 2. Check referrer or previous tab URL for Telegram, WhatsApp, or Search Engines
  const refRaw = (ctx.referrerUrl || '').trim();
  const prevRaw = (ctx.previousTabUrl || '').trim();

  if (EXTERNAL_APP_REFERRER_REGEX.test(refRaw) || EXTERNAL_APP_REFERRER_REGEX.test(prevRaw)) {
    const isSearchApp = /googlequicksearchbox/i.test(refRaw + ' ' + prevRaw);
    return {
      shouldAllowEntry: true,
      isBlacklisted: false,
      entrySource: isSearchApp ? 'SEARCH_ENGINE_RESULT' : 'MESSENGER_OR_SOCIAL_APP',
    };
  }

  const checkSourceHost = (rawUrl: string): 'SEARCH' | 'MESSENGER' | null => {
    if (!rawUrl || !rawUrl.startsWith('http')) return null;
    try {
      const u = new URL(rawUrl);
      const h = u.hostname.toLowerCase();
      if (SEARCH_ENGINE_HOST_REGEX.test(h)) return 'SEARCH';
      if (MESSENGER_OR_SOCIAL_ENTRY_REGEX.test(h)) return 'MESSENGER';
    } catch {
      // ignore
    }
    return null;
  };

  const prevKind = checkSourceHost(prevRaw);
  const refKind = checkSourceHost(refRaw);

  if (prevKind === 'SEARCH' || refKind === 'SEARCH') {
    return {
      shouldAllowEntry: true,
      isBlacklisted: false,
      entrySource: 'SEARCH_ENGINE_RESULT',
    };
  }

  if (prevKind === 'MESSENGER' || refKind === 'MESSENGER') {
    return {
      shouldAllowEntry: true,
      isBlacklisted: false,
      entrySource: 'MESSENGER_OR_SOCIAL_APP',
    };
  }

  // 3. First webpage in a brand-new tab (stack is empty and no previous in-tab page)
  if (ctx.isTabStackEmpty && !prevRaw) {
    return {
      shouldAllowEntry: true,
      isBlacklisted: false,
      entrySource: 'FIRST_TAB_PAGE',
    };
  }

  return {
    shouldAllowEntry: false,
    isBlacklisted: false,
    entrySource: 'IN_TAB_NAVIGATION',
  };
}

export function classifyContentLinkOrImage(ctx: ContentLinkContext): ContentClassificationVerdict {
  const trusted = ctx.trustedDomains || [];
  const denied = ctx.deniedDomains || [];
  const smartUgc = ctx.smartUgcSense !== false;

  const raw = (ctx.rawHref || '').trim();
  if (!raw || raw.startsWith('#') || raw.startsWith('javascript:')) {
    return {
      category: 'AUTH_OR_SAME_ORIGIN',
      resolvedUrl: raw,
      shouldAllowDirectly: true,
      shouldHoldInHud: false,
      shouldSilentBlock: false,
      neverDisablePointerEvents: true,
      thumbnailMatchesDestDomain: false,
      reason: 'Tautan internal halaman',
    };
  }

  if (/^(intent|shopeeid|tokopedia|lazada|market):/i.test(raw)) {
    return {
      category: 'AD_INFILTRATED_IMAGE_OR_BANNER',
      resolvedUrl: raw,
      shouldAllowDirectly: false,
      shouldHoldInHud: true,
      shouldSilentBlock: false,
      neverDisablePointerEvents: true,
      thumbnailMatchesDestDomain: false,
      reason: 'Deep-link aplikasi belanja/iklan ditahan',
    };
  }

  let target: URL;
  let page: URL;
  try {
    page = new URL(ctx.pageUrl);
    target = new URL(raw, page.href);
  } catch {
    return {
      category: 'AUTH_OR_SAME_ORIGIN',
      resolvedUrl: raw,
      shouldAllowDirectly: true,
      shouldHoldInHud: false,
      shouldSilentBlock: false,
      neverDisablePointerEvents: true,
      thumbnailMatchesDestDomain: false,
      reason: 'Format URL lokal',
    };
  }

  const curHost = page.hostname.toLowerCase();
  const curBase = getBaseDomain(curHost);
  const host = target.hostname.toLowerCase();
  const baseHost = getBaseDomain(host);

  // Check if thumbnail img src shares the same base domain as destination URL
  let thumbnailMatchesDestDomain = false;
  if (ctx.imgSrc) {
    try {
      const imgUrl = new URL(ctx.imgSrc, page.href);
      const imgBase = getBaseDomain(imgUrl.hostname.toLowerCase());
      thumbnailMatchesDestDomain = Boolean(imgBase && imgBase === baseHost);
    } catch {
      thumbnailMatchesDestDomain = false;
    }
  }

  // 1. Blacklisted Domain -> SILENT BLOCK (NEVER show HUD Block Menu!)
  if (isDomainMatchedInList(target.href, denied)) {
    return {
      category: 'BLACKLISTED_SILENT_BLOCK',
      resolvedUrl: target.href,
      shouldAllowDirectly: false,
      shouldHoldInHud: false,
      shouldSilentBlock: true,
      neverDisablePointerEvents: true,
      thumbnailMatchesDestDomain,
      reason: 'Domain di Blacklist (Diblokir senyap tanpa HUD)',
    };
  }

  // 2. Whitelisted / Same-Origin / Auth URL
  if (
    baseHost === curBase ||
    isDomainMatchedInList(target.href, trusted) ||
    AUTH_SUBDOMAIN_REGEX.test(host) ||
    AUTH_URL_REGEX.test(target.pathname + target.search)
  ) {
    return {
      category: 'AUTH_OR_SAME_ORIGIN',
      resolvedUrl: target.href,
      shouldAllowDirectly: true,
      shouldHoldInHud: false,
      shouldSilentBlock: false,
      neverDisablePointerEvents: true,
      thumbnailMatchesDestDomain,
      reason: 'Domain tepercaya / satu domain',
    };
  }

  const isHardAdOrGambling =
    GAMBLING_REGEX.test(target.href) ||
    COMMERCE_AFFILIATE_REGEX.test(target.href) ||
    SEARCH_ARBITRAGE_PARAMS_REGEX.test(target.href) ||
    RANDOM_SHORT_DOMAIN_REGEX.test(baseHost) ||
    (host.includes('google.') && target.pathname === '/search');

  const isKnownAdShortener = KNOWN_AD_SHORTENER_REGEX.test(host);
  const isSuspiciousTld = SUSPICIOUS_HOST_REGEX.test(host);
  const isSafeMediaHost = SAFE_MEDIA_HOST_REGEX.test(host);
  const hasDisguisedAdCss = Boolean(
    ctx.cssClassSignature && DISGUISED_AD_CSS_CLASS_REGEX.test(ctx.cssClassSignature)
  );

  // 3. Inside Explicit Real Ad Slot Container (.itr, #header_sp, .samBannerUnit) or Disguised Ad CSS
  // Note: Anti-adblock bait classes (.message-main.ads, img.bbImage.adUnit) do NOT trigger this
  if (ctx.isInsideRealAdSlot || hasDisguisedAdCss || ctx.hasSuspiciousInlineOnclick) {
    return {
      category: 'AD_INFILTRATED_IMAGE_OR_BANNER',
      resolvedUrl: target.href,
      shouldAllowDirectly: false,
      shouldHoldInHud: true,
      shouldSilentBlock: false,
      neverDisablePointerEvents: true,
      thumbnailMatchesDestDomain,
      reason: 'Banner iklan / elemen iklan terselubung ditahan',
    };
  }

  // 4. Hard Ad / Gambling / Affiliate / Ad Shortener (even if wrapping a safe image host like i.imgur.com)
  if (isHardAdOrGambling || isKnownAdShortener) {
    const reasonMsg = ctx.hasImgChild
      ? 'Gambar tersusupi tautan iklan/judol ditahan'
      : 'Tautan iklan/affiliate/judol ditahan';
    return {
      category: 'AD_INFILTRATED_IMAGE_OR_BANNER',
      resolvedUrl: target.href,
      shouldAllowDirectly: false,
      shouldHoldInHud: true,
      shouldSilentBlock: false,
      neverDisablePointerEvents: true,
      thumbnailMatchesDestDomain,
      reason: reasonMsg,
    };
  }

  // 5. Option 1: Safe Media & Image Hosting (ibb.co.com, imgur.com, postimg.cc, pixhost.to, etc.)
  if (isSafeMediaHost) {
    return {
      category: 'SAFE_MEDIA_OR_UGC',
      resolvedUrl: target.href,
      shouldAllowDirectly: true,
      shouldHoldInHud: false,
      shouldSilentBlock: false,
      neverDisablePointerEvents: true,
      thumbnailMatchesDestDomain,
      reason: 'Gambar / media hosting aman (Dibuka langsung)',
    };
  }

  // 6. Inside User Post Content (.bbWrapper, .message-body, rel~="ugc", img.bbImage)
  if (smartUgc && ctx.isInsideUserPostContent) {
    if (isSuspiciousTld) {
      // Option 2: Suspicious TLD (.click like vikuy.click, .top like smallurl.top) inside user post
      return {
        category: 'SUSPICIOUS_EXTERNAL_UGC_HOLD',
        resolvedUrl: target.href,
        shouldAllowDirectly: false,
        shouldHoldInHud: true,
        shouldSilentBlock: false,
        neverDisablePointerEvents: true,
        thumbnailMatchesDestDomain,
        reason: thumbnailMatchesDestDomain
          ? 'Media eksternal (.click/.top) ditahan — Pilih ↗ Buka jika aman'
          : 'Konten eksternal (.click/.top) ditahan — Pilih ↗ Buka jika aman',
      };
    }

    // Standard non-suspicious link/image inside user post -> Option 1: Allow directly
    return {
      category: 'SAFE_MEDIA_OR_UGC',
      resolvedUrl: target.href,
      shouldAllowDirectly: true,
      shouldHoldInHud: false,
      shouldSilentBlock: false,
      neverDisablePointerEvents: true,
      thumbnailMatchesDestDomain,
      reason: 'Konten postingan member aman (Dibuka langsung)',
    };
  }

  // 7. Outside user post content with suspicious TLD
  if (isSuspiciousTld) {
    return {
      category: 'SUSPICIOUS_EXTERNAL_UGC_HOLD',
      resolvedUrl: target.href,
      shouldAllowDirectly: false,
      shouldHoldInHud: true,
      shouldSilentBlock: false,
      neverDisablePointerEvents: true,
      thumbnailMatchesDestDomain,
      reason: 'Tautan eksternal (.click/.top) ditahan — Pilih ↗ Buka jika aman',
    };
  }

  return {
    category: 'SAFE_MEDIA_OR_UGC',
    resolvedUrl: target.href,
    shouldAllowDirectly: true,
    shouldHoldInHud: false,
    shouldSilentBlock: false,
    neverDisablePointerEvents: true,
    thumbnailMatchesDestDomain,
    reason: 'Tautan standar aman',
  };
}

// =========================================================================
// v2.2.5: SHORTLINK CTA HTTP 302 GRACE, EMPTY TRAP #overlay & ANTI-ADBLOCK FETCH
// =========================================================================
export const SHORTLINK_CTA_TEXT_REGEX =
  /\b(go\s*to\s*link|get\s*link|continue|proceed|download|unduh|lanjut|lanjutkan|menuju\s*link|open\s*link|visit\s*link|unlock\s*link|generate\s*link|buka\s*link|ambil\s*link)\b/i;

export const SHORTLINK_CTA_HREF_REGEX =
  /([?&](download|dl|go|out|url|link|target|redirect|token|t)=|\/(go|out|redirect|download|dl|get-link|visit|jump|r|l)(\/|$|\?))/i;

export const ANTI_ADBLOCK_PROBE_HOST_REGEX =
  /(^|\.)(wpadmngr\.com|googletagmanager\.com|googlesyndication\.com|doubleclick\.net|google-analytics\.com|adservice\.google\.com|adsterra\.com|propellerads\.com|onclickalgo\.com|clickadu\.com|popads\.net|popcash\.net)$/i;

export interface ShortlinkCtaClickInput {
  rawHref: string;
  buttonText: string;
  elementId?: string;
  cardText?: string;
}

export function isShortlinkCtaClick(input: ShortlinkCtaClickInput): boolean {
  const href = String(input.rawHref || '').trim();
  const label = `${input.buttonText || ''} ${input.elementId || ''}`.trim();
  if (href && SHORTLINK_CTA_HREF_REGEX.test(href)) return true;
  if (label && SHORTLINK_CTA_TEXT_REGEX.test(label)) return true;
  if (
    input.cardText &&
    /(redirect\s*ready|please\s*wait|link\s*ready|link\s*siap|go\s*to\s*link|get\s*link)/i.test(
      input.cardText
    )
  ) {
    return true;
  }
  return false;
}

export interface ShortlinkServerRedirectContext {
  destinationUrl: string;
  shortlinkCtaGraceActive: boolean;
  transitionQualifiers?: string[];
  deniedDomains?: string[];
  trustedDomains?: string[];
}

export interface ShortlinkServerRedirectVerdict {
  decision: 'ALLOW_DESTINATION' | 'SILENT_BLOCK_BLACKLIST' | 'HOLD_MALICIOUS_IN_HUD' | 'BLOCK_UNPROMPTED_REDIRECT';
  shouldAllow: boolean;
  shouldShowHud: boolean;
  reason: string;
}

export function evaluateShortlinkServerRedirect(
  ctx: ShortlinkServerRedirectContext
): ShortlinkServerRedirectVerdict {
  const denied = ctx.deniedDomains || [];
  const trusted = ctx.trustedDomains || [];

  if (isDomainMatchedInList(ctx.destinationUrl, denied)) {
    return {
      decision: 'SILENT_BLOCK_BLACKLIST',
      shouldAllow: false,
      shouldShowHud: false,
      reason: 'Domain tujuan ada di Blacklist — diblokir senyap tanpa HUD',
    };
  }

  if (isDomainMatchedInList(ctx.destinationUrl, trusted)) {
    return {
      decision: 'ALLOW_DESTINATION',
      shouldAllow: true,
      shouldShowHud: false,
      reason: 'Domain tujuan ada di Whitelist',
    };
  }

  let host = '';
  let baseHost = '';
  try {
    const u = new URL(ctx.destinationUrl);
    host = u.hostname.toLowerCase();
    baseHost = getBaseDomain(host);
  } catch {
    return {
      decision: 'BLOCK_UNPROMPTED_REDIRECT',
      shouldAllow: false,
      shouldShowHud: true,
      reason: 'URL tujuan tidak valid',
    };
  }

  const isHardMalicious =
    GAMBLING_REGEX.test(ctx.destinationUrl) ||
    COMMERCE_AFFILIATE_REGEX.test(ctx.destinationUrl) ||
    RANDOM_SHORT_DOMAIN_REGEX.test(baseHost) ||
    SEARCH_ARBITRAGE_PARAMS_REGEX.test(ctx.destinationUrl) ||
    KNOWN_AD_SHORTENER_REGEX.test(host);

  if (isHardMalicious) {
    return {
      decision: 'HOLD_MALICIOUS_IN_HUD',
      shouldAllow: false,
      shouldShowHud: true,
      reason: 'Tujuan 302 adalah iklan/judol/popunder — tetap ditahan oleh AEGIS',
    };
  }

  if (ctx.shortlinkCtaGraceActive) {
    return {
      decision: 'ALLOW_DESTINATION',
      shouldAllow: true,
      shouldShowHud: false,
      reason: 'Klik CTA shortlink sah — redirect HTTP 302 ke tujuan bersih diizinkan',
    };
  }

  return {
    decision: 'BLOCK_UNPROMPTED_REDIRECT',
    shouldAllow: false,
    shouldShowHud: true,
    reason: 'Auto-redirect lintas domain tanpa klik tombol CTA ditahan',
  };
}

export function shouldNeutralizeAntiAdblockFetchProbe(
  requestUrl: string,
  mode?: string,
  deniedDomains: string[] = []
): boolean {
  if (!requestUrl) return false;
  try {
    const u = new URL(requestUrl);
    const host = u.hostname.toLowerCase();
    const isProbeHost = ANTI_ADBLOCK_PROBE_HOST_REGEX.test(host);
    const isDenied = isDomainMatchedInList(u.href, deniedDomains);
    if (!isProbeHost && !isDenied) return false;
    if (String(mode || '').toLowerCase() === 'no-cors') return true;
    return isProbeHost && (u.pathname === '/' || u.search.includes('t='));
  } catch {
    return false;
  }
}

export interface EmptyTrapOverlaySpec {
  id?: string;
  className?: string;
  textContent: string;
  hasInteractiveChildren: boolean;
  position: string;
  display: string;
  widthRatio: number;
  heightRatio: number;
  opacity: number;
  backgroundColor: string;
}

export function isEmptyTrapOverlayElement(spec: EmptyTrapOverlaySpec): boolean {
  if (spec.display === 'none') return false;
  if (spec.position !== 'fixed' && spec.position !== 'absolute') return false;
  if (spec.hasInteractiveChildren) return false;
  if ((spec.textContent || '').trim().length > 0) return false;
  if (spec.widthRatio < 0.65 || spec.heightRatio < 0.65) return false;

  const bg = (spec.backgroundColor || '').trim();
  const isTransparentOrLight =
    spec.opacity < 0.25 ||
    bg === 'transparent' ||
    bg === 'rgba(0, 0, 0, 0)' ||
    /^rgba\([^,]+,[^,]+,[^,]+,\s*0(\.[0-4]\d*)?\s*\)$/i.test(bg);

  const idCls = `${spec.id || ''} ${spec.className || ''}`.toLowerCase();
  const isExplicitTrap = /(^|\b)(overlay|click-?overlay|ad-?overlay|pop-?overlay|backdrop-?trap)(\b|$)/i.test(
    idCls
  );

  return isTransparentOrLight || isExplicitTrap;
}

