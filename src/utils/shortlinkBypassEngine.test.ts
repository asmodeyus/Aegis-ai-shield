import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TRUSTED_COMMUNITY_DOMAINS,
  detectShortlinkBypassAction,
  extractDirectShortlinkUrl,
  formatAegisLogsForCopy,
  parseGeminiAuditResponse,
  pruneStaleTabHistory,
  shouldRunAiDomAuditFallback,
  type AegisLogEntry,
} from './shortlinkBypassEngine.ts';

test('Decodes BloggerPemula / Safelink single & double Base64 query parameter URLs safely', () => {
  const target = 'https://drive.google.com/file/d/1AbCDefGhI/view';
  const b64Once = Buffer.from(target, 'utf8').toString('base64');
  const b64Twice = Buffer.from(b64Once, 'utf8').toString('base64');

  const resOnce = extractDirectShortlinkUrl({
    pageUrl: `https://safelink-blog.example.com/p/go.html?to=${encodeURIComponent(b64Once)}`,
  });
  assert.equal(resOnce.found, true);
  assert.equal(resOnce.method, 'QUERY_BASE64');
  assert.equal(resOnce.decodedUrl, target);

  const resTwice = extractDirectShortlinkUrl({
    pageUrl: `https://safelink-blog.example.com/p/go.html?url=${encodeURIComponent(b64Twice)}`,
  });
  assert.equal(resTwice.found, true);
  assert.equal(resTwice.method, 'QUERY_DOUBLE_BASE64');
  assert.equal(resTwice.decodedUrl, target);
});

test('Decodes hidden WordPress safelink JSON Base64 input (newwpsafelink) and meta-refresh targets', () => {
  const jsonPayload = JSON.stringify({ url: 'https://gofile.io/d/XyZ123' });
  const encodedPayload = Buffer.from(jsonPayload, 'utf8').toString('base64');

  const fromHidden = extractDirectShortlinkUrl({
    pageUrl: 'https://wp-safelink.example.net/artikel-teknologi/',
    hiddenInputValues: [{ name: 'newwpsafelink', value: encodedPayload }],
  });
  assert.equal(fromHidden.found, true);
  assert.equal(fromHidden.method, 'HIDDEN_INPUT_PAYLOAD');
  assert.equal(fromHidden.decodedUrl, 'https://gofile.io/d/XyZ123');

  const fromMeta = extractDirectShortlinkUrl({
    pageUrl: 'https://jump.example.net/wait',
    metaRefreshContent: '5;url=https://pixeldrain.com/u/abc987',
  });
  assert.equal(fromMeta.found, true);
  assert.equal(fromMeta.method, 'META_REFRESH');
  assert.equal(fromMeta.decodedUrl, 'https://pixeldrain.com/u/abc987');
});

test('Refuses to bypass into blacklisted or gambling/popunder decoded destinations', () => {
  const gamblingB64 = Buffer.from('https://slot-gacor88.xyz/bonus', 'utf8').toString('base64');
  const blockedGambling = extractDirectShortlinkUrl({
    pageUrl: `https://safelink.example.com/?go=${encodeURIComponent(gamblingB64)}`,
  });
  assert.equal(blockedGambling.found, false);
  assert.match(blockedGambling.blockedReason || '', /iklan\/judol\/affiliate/i);

  const blacklistedB64 = Buffer.from('https://sub.hai8g.com/landing', 'utf8').toString('base64');
  const blockedDenied = extractDirectShortlinkUrl({
    pageUrl: `https://safelink.example.com/?url=${encodeURIComponent(blacklistedB64)}`,
    deniedDomains: ['hai8g.com'],
  });
  assert.equal(blockedDenied.found, false);
  assert.match(blockedDenied.blockedReason || '', /Blacklist/i);
});

test('Shortlink step detector waits for CAPTCHA, waits for disabled timer, and auto-clicks ready Go To Link CTA', () => {
  const captchaWait = detectShortlinkBypassAction({
    pageUrl: 'https://short.example.com/step1',
    hasVisibleUnsolvedCaptcha: true,
    hasAdLinkFlyForm: true,
    ctaHref: '?download=1&t=abc',
    ctaText: 'Go To Link',
  });
  assert.equal(captchaWait.action, 'WAIT_FOR_CAPTCHA');

  const timerWait = detectShortlinkBypassAction({
    pageUrl: 'https://short.example.com/step1',
    hasVisibleUnsolvedCaptcha: false,
    hasAdLinkFlyForm: false,
    ctaHref: '?download=1&t=abc',
    ctaText: 'Go To Link',
    ctaDisabled: true,
  });
  assert.equal(timerWait.action, 'WAIT_FOR_TIMER');

  const readyClick = detectShortlinkBypassAction({
    pageUrl: 'https://short.example.com/step1',
    hasVisibleUnsolvedCaptcha: false,
    hasAdLinkFlyForm: false,
    ctaHref: '?download=1&t=498109fe-e3a2-4cc6-96b4-702a66caa45b',
    ctaText: 'Go To Link',
    ctaId: 'babay',
    ctaDisabled: false,
  });
  assert.equal(readyClick.action, 'AUTO_CLICK_CTA');
  assert.equal(
    readyClick.targetUrl,
    'https://short.example.com/step1?download=1&t=498109fe-e3a2-4cc6-96b4-702a66caa45b'
  );
});

test('Formats AEGIS diagnostic logs cleanly for copy-paste with filter support (v2.2.7)', () => {
  const logs: AegisLogEntry[] = [
    {
      id: '1',
      ts: new Date('2026-11-20T12:00:05Z').getTime(),
      level: 'BLOCK',
      source: 'background',
      code: 'BLOCK_REDIRECT_REVERT',
      fromUrl: 'https://short.example.com/r/123',
      toUrl: 'https://ads.example.xyz/jump',
      detail: 'strictCrossOrigin=true, qualifiers=server_redirect, isSuspicious=true',
    },
    {
      id: '2',
      ts: new Date('2026-11-20T12:00:08Z').getTime(),
      level: 'BYPASS',
      source: 'content',
      code: 'BYPASS_DECODED_URL',
      fromUrl: 'https://safelink.example.com/?to=aHR0c...',
      toUrl: 'https://gofile.io/d/XyZ123',
      detail: 'Decoded QUERY_BASE64 -> direct redirect',
    },
  ];

  const allText = formatAegisLogsForCopy(logs, 'ALL', '2.2.7');
  assert.match(allText, /AEGIS-AI SHIELD v2\.2\.7 DIAGNOSTIC LOG/);
  assert.match(allText, /BLOCK_REDIRECT_REVERT/);
  assert.match(allText, /BYPASS_DECODED_URL/);

  const blockOnly = formatAegisLogsForCopy(logs, 'BLOCK', '2.2.7');
  assert.match(blockOnly, /Filter: BLOCK \| Total Tercatat: 1 entri/);
  assert.match(blockOnly, /BLOCK_REDIRECT_REVERT/);
  assert.doesNotMatch(blockOnly, /BYPASS_DECODED_URL/);
});

test('v2.2.7 parseGeminiAuditResponse strips markdown fences and recovers safely from truncated JSON', () => {
  const fenced = '```json\n{"realIndex": 2, "blockedIndices": [0, 1, 4]}\n```';
  assert.deepEqual(parseGeminiAuditResponse(fenced), {
    realIndex: 2,
    blockedIndices: [0, 1, 4],
  });

  const wrappedWithNoise = 'Hasil analisis:\n{"realIndex": 1, "blockedIndices": [0, "bad", -1]}\nSelesai.';
  assert.deepEqual(parseGeminiAuditResponse(wrappedWithNoise), {
    realIndex: 1,
    blockedIndices: [0],
  });

  const truncated = '```json\n{"realIndex": 3, "blockedIndi';
  assert.deepEqual(parseGeminiAuditResponse(truncated), {
    realIndex: -1,
    blockedIndices: [],
  });
});

test('v2.2.7 pruneStaleTabHistory removes entries older than 2 hours and closed tab IDs', () => {
  const now = 10_000_000_000;
  const twoHours = 2 * 60 * 60 * 1000;
  const map = new Map<number, { lastTimestamp: number }>([
    [1, { lastTimestamp: now - 10_000 }], // active & fresh
    [2, { lastTimestamp: now - twoHours - 5000 }], // expired (>2h)
    [3, { lastTimestamp: now - 5000 }], // closed tab
  ]);

  const removed = pruneStaleTabHistory(map, now, twoHours, new Set([1, 2]));
  assert.equal(removed, 2);
  assert.equal(map.has(1), true);
  assert.equal(map.has(2), false);
  assert.equal(map.has(3), false);
});

test('v2.2.7 AI DOM Audit fallback saves quota when shortlink bypass already succeeded and seeds community defaults', () => {
  assert.equal(
    shouldRunAiDomAuditFallback({
      shortlinkAutoClick: true,
      shortlinkDirectBypassTriggered: true,
      bypassStepExecuted: true,
    }),
    false
  );
  assert.equal(
    shouldRunAiDomAuditFallback({
      shortlinkAutoClick: true,
      shortlinkDirectBypassTriggered: false,
      bypassStepExecuted: true,
    }),
    false
  );
  assert.equal(
    shouldRunAiDomAuditFallback({
      shortlinkAutoClick: true,
      shortlinkDirectBypassTriggered: false,
      bypassStepExecuted: false,
    }),
    true
  );
  assert.equal(
    shouldRunAiDomAuditFallback({
      shortlinkAutoClick: false,
      shortlinkDirectBypassTriggered: false,
      bypassStepExecuted: false,
    }),
    true
  );
  assert.deepEqual([...DEFAULT_TRUSTED_COMMUNITY_DOMAINS], [
    'semprot.com',
    'kaskus.co.id',
    'reddit.com',
  ]);
});
