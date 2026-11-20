import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyContentLinkOrImage,
  evaluateFirstPageOrExternalEntry,
  evaluateShortlinkServerRedirect,
  isDomainMatchedInList,
  isEmptyTrapOverlayElement,
  isShortlinkCtaClick,
  shouldNeutralizeAntiAdblockFetchProbe,
} from './smartContentClassifier.ts';

test('Post #10,235 (ibb.co.com image with anti-adblock bait class="bbImage adUnit" inside .bbWrapper) opens directly (Option 1)', () => {
  const verdict = classifyContentLinkOrImage({
    pageUrl: 'https://www.semprot.com/threads/ponakan-pemuas-nafsu.1545645/page-512',
    rawHref: 'https://ibb.co.com/cK57k0fZ',
    isInsideUserPostContent: true,
    isInsideRealAdSlot: false,
    hasAntiAdblockBaitClass: true,
    hasImgChild: true,
    imgSrc: 'https://i.ibb.co.com/KcMGv01D/Lanjutkan-10.jpg',
  });

  assert.equal(verdict.category, 'SAFE_MEDIA_OR_UGC');
  assert.equal(verdict.shouldAllowDirectly, true);
  assert.equal(verdict.shouldHoldInHud, false);
  assert.equal(verdict.shouldSilentBlock, false);
  assert.equal(verdict.neverDisablePointerEvents, true);
});

test('Post #10,237 (vikuy.click GAMGER thumbnail image inside .bbWrapper) stays clickable and triggers HUD on click (Option 2)', () => {
  const verdict = classifyContentLinkOrImage({
    pageUrl: 'https://www.semprot.com/threads/ponakan-pemuas-nafsu.1545645/page-512',
    rawHref: 'https://vikuy.click/watch?v=ac033',
    isInsideUserPostContent: true,
    isInsideRealAdSlot: false,
    hasAntiAdblockBaitClass: true,
    hasImgChild: true,
    imgSrc: 'https://cdn.vikuy.click/thumbnails/thumb_64efc538dbe75fcaf8020a72.webp',
  });

  assert.equal(verdict.category, 'SUSPICIOUS_EXTERNAL_UGC_HOLD');
  assert.equal(verdict.neverDisablePointerEvents, true);
  assert.equal(verdict.shouldAllowDirectly, false);
  assert.equal(verdict.shouldHoldInHud, true);
  assert.equal(verdict.shouldSilentBlock, false);
  assert.equal(verdict.thumbnailMatchesDestDomain, true);
  assert.match(verdict.reason, /Pilih ↗ Buka jika aman/);
});

test('Blacklisted domain (including subdomain) is silently blocked and NEVER triggers HUD Block Menu', () => {
  const verdict = classifyContentLinkOrImage({
    pageUrl: 'https://www.semprot.com/threads/ponakan-pemuas-nafsu.1545645/page-512',
    rawHref: 'https://rotator.sub.hai8g.com/jump?id=99',
    isInsideUserPostContent: true,
    isInsideRealAdSlot: false,
    deniedDomains: ['hai8g.com'],
  });

  assert.equal(verdict.category, 'BLACKLISTED_SILENT_BLOCK');
  assert.equal(verdict.shouldAllowDirectly, false);
  assert.equal(verdict.shouldHoldInHud, false);
  assert.equal(verdict.shouldSilentBlock, true);
  assert.equal(isDomainMatchedInList('https://rotator.sub.hai8g.com/jump', ['hai8g.com']), true);
});

test('First page opened from Telegram, WhatsApp, or Google Search is allowed directly even if domain uses .click or .top', () => {
  const fromTelegram = evaluateFirstPageOrExternalEntry({
    targetUrl: 'https://vikuy.click/watch?v=ac033',
    referrerUrl: 'https://t.me/channel_share',
    isTabStackEmpty: true,
    deniedDomains: ['hai8g.com'],
  });
  assert.equal(fromTelegram.shouldAllowEntry, true);
  assert.equal(fromTelegram.entrySource, 'MESSENGER_OR_SOCIAL_APP');

  const fromWhatsApp = evaluateFirstPageOrExternalEntry({
    targetUrl: 'https://berita-viral.top/artikel-1',
    referrerUrl: 'https://l.wl.co/l?u=https://berita-viral.top/artikel-1',
    transitionQualifiers: ['from_api'],
    deniedDomains: ['hai8g.com'],
  });
  assert.equal(fromWhatsApp.shouldAllowEntry, true);
  assert.equal(fromWhatsApp.entrySource, 'MESSENGER_OR_SOCIAL_APP');

  const fromGoogleSearch = evaluateFirstPageOrExternalEntry({
    targetUrl: 'https://forum-komunitas.xyz/thread/123',
    previousTabUrl: 'https://www.google.co.id/search?q=forum+komunitas',
    deniedDomains: ['hai8g.com'],
  });
  assert.equal(fromGoogleSearch.shouldAllowEntry, true);
  assert.equal(fromGoogleSearch.entrySource, 'SEARCH_ENGINE_RESULT');

  const blacklistedFromTelegram = evaluateFirstPageOrExternalEntry({
    targetUrl: 'https://ads.hai8g.com/landing',
    referrerUrl: 'https://t.me/spam',
    isTabStackEmpty: true,
    deniedDomains: ['hai8g.com'],
  });
  assert.equal(blacklistedFromTelegram.shouldAllowEntry, false);
  assert.equal(blacklistedFromTelegram.isBlacklisted, true);
});

test('Real gambling ad banner using safe i.imgur.com GIF image but linking to rebrand.ly/pascol4d-semprot is caught as AD_INFILTRATED_IMAGE_OR_BANNER', () => {
  const verdict = classifyContentLinkOrImage({
    pageUrl: 'https://www.semprot.com/threads/ponakan-pemuas-nafsu.1545645/page-512',
    rawHref: 'https://rebrand.ly/pascol4d-semprot',
    isInsideUserPostContent: false,
    isInsideRealAdSlot: true,
    hasImgChild: true,
    imgSrc: 'https://i.imgur.com/zOfaFQf.gif',
  });

  assert.equal(verdict.category, 'AD_INFILTRATED_IMAGE_OR_BANNER');
  assert.equal(verdict.shouldAllowDirectly, false);
  assert.equal(verdict.shouldHoldInHud, true);
  assert.equal(verdict.shouldSilentBlock, false);
});

test('v2.2.5: Clicking same-origin Go To Link (?download=1&t=...) CTA allows clean HTTP 302 destination while still blocking malicious or blacklisted redirects', () => {
  const isCta = isShortlinkCtaClick({
    rawHref: '?download=1&t=498109fe-e3a2-4cc6-96b4-702a66caa45b',
    buttonText: 'Go To Link',
    elementId: 'babay',
    cardText: 'Redirect Ready Please wait a moment...',
  });
  assert.equal(isCta, true);

  const cleanDest = evaluateShortlinkServerRedirect({
    destinationUrl: 'https://files.example-cdn.org/archive/video-part1.mp4',
    shortlinkCtaGraceActive: true,
    transitionQualifiers: ['server_redirect'],
    deniedDomains: ['hai8g.com'],
  });
  assert.equal(cleanDest.decision, 'ALLOW_DESTINATION');
  assert.equal(cleanDest.shouldAllow, true);
  assert.equal(cleanDest.shouldShowHud, false);

  const popunderDest = evaluateShortlinkServerRedirect({
    destinationUrl: 'https://js.wpadmngr.com/static/popunder?pid=439635',
    shortlinkCtaGraceActive: true,
    transitionQualifiers: ['server_redirect'],
    deniedDomains: ['hai8g.com'],
  });
  assert.equal(popunderDest.decision, 'HOLD_MALICIOUS_IN_HUD');
  assert.equal(popunderDest.shouldAllow, false);

  const blacklistedDest = evaluateShortlinkServerRedirect({
    destinationUrl: 'https://jump.hai8g.com/out',
    shortlinkCtaGraceActive: true,
    transitionQualifiers: ['server_redirect'],
    deniedDomains: ['hai8g.com'],
  });
  assert.equal(blacklistedDest.decision, 'SILENT_BLOCK_BLACKLIST');
  assert.equal(blacklistedDest.shouldAllow, false);
  assert.equal(blacklistedDest.shouldShowHud, false);
});

test('v2.2.5: Empty fullscreen trap <div id="overlay" style="display: flex;"> is auto-bypassed while real modals with interactive children are preserved', () => {
  assert.equal(
    isEmptyTrapOverlayElement({
      id: 'overlay',
      className: '',
      textContent: '',
      hasInteractiveChildren: false,
      position: 'fixed',
      display: 'flex',
      widthRatio: 1.0,
      heightRatio: 1.0,
      opacity: 1,
      backgroundColor: 'rgba(0, 0, 0, 0)',
    }),
    true
  );

  assert.equal(
    isEmptyTrapOverlayElement({
      id: 'loginModal',
      className: 'modal-overlay',
      textContent: 'Sign in to continue',
      hasInteractiveChildren: true,
      position: 'fixed',
      display: 'flex',
      widthRatio: 1.0,
      heightRatio: 1.0,
      opacity: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
    }),
    false
  );
});

test('v2.2.5: Anti-adblock no-cors fetch probes (googletagmanager / js.wpadmngr.com) are neutralized while regular API calls are untouched', () => {
  assert.equal(
    shouldNeutralizeAntiAdblockFetchProbe('https://js.wpadmngr.com?t=1732100000', 'no-cors'),
    true
  );
  assert.equal(
    shouldNeutralizeAntiAdblockFetchProbe('https://www.googletagmanager.com?t=1732100000', 'no-cors'),
    true
  );
  assert.equal(
    shouldNeutralizeAntiAdblockFetchProbe('https://api.example.com/v1/video/info', 'cors'),
    false
  );
});
