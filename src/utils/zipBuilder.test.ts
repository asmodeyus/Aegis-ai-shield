import test from 'node:test';
import assert from 'node:assert/strict';
import { buildZipArchive, computeCrc32 } from './zipBuilder';

test('computeCrc32 computes expected IEEE 802.3 CRC32 for ASCII string', () => {
  const bytes = new TextEncoder().encode('123456789');
  assert.equal(computeCrc32(bytes), 0xcbf43926);
});

test('buildZipArchive produces valid PKZIP headers and EOCD signature', () => {
  const archive = buildZipArchive([
    { name: 'manifest.json', data: new TextEncoder().encode('{"version":"2.1.6"}') },
    { name: 'content.js', data: new TextEncoder().encode('(() => {})();') },
  ]);

  // Starts with PK\x03\x04
  assert.equal(archive[0], 0x50);
  assert.equal(archive[1], 0x4b);
  assert.equal(archive[2], 0x03);
  assert.equal(archive[3], 0x04);

  // Ends with EOCD signature PK\x05\x06 at archive.length - 22
  const eocdOffset = archive.length - 22;
  assert.equal(archive[eocdOffset], 0x50);
  assert.equal(archive[eocdOffset + 1], 0x4b);
  assert.equal(archive[eocdOffset + 2], 0x05);
  assert.equal(archive[eocdOffset + 3], 0x06);
});
