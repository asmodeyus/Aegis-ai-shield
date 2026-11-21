import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "..", "public", "extension-v2.1.6");

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([lenBuf, combined, crcBuf]);
}

function encodePngRgba(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function clamp(v, lo = 0, hi = 1) {
  return v < lo ? lo : v > hi ? hi : v;
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function sdRoundedBox(px, py, bx, by, r) {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - r;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const denom = bax * bax + bay * bay || 1e-6;
  const h = clamp((pax * bax + pay * bay) / denom);
  return Math.hypot(pax - bax * h, pay - bay * h);
}

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function sdPolygon(px, py, poly) {
  let minD = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const d = distToSegment(px, py, poly[j][0], poly[j][1], poly[i][0], poly[i][1]);
    if (d < minD) minD = d;
  }
  return pointInPolygon(px, py, poly) ? -minD : minD;
}

/**
 * Render simplified, high-contrast AEGIS shield/lightning badge matching icon.png's
 * storm-navy, metallic gold border, and electric cyan-white bolt palette.
 * Coordinates normalized in [-1, 1].
 */
function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const samples = 4; // 4x4 supersampling for razor-sharp edges
  const invSamples = 1 / samples;

  // Bold classic lightning bolt polygon (normalized [-1, 1]) tilted slightly right like icon.png
  const boltPoly = [
    [0.18, -0.66],
    [-0.40, 0.05],
    [-0.04, 0.05],
    [-0.22, 0.68],
    [0.42, -0.08],
    [0.05, -0.08]
  ];

  // Adjust border thickness slightly thicker at 16px so gold frame stays legible
  const borderWidth = size <= 16 ? 0.165 : size <= 32 ? 0.135 : 0.12;
  const cornerR = 0.36;
  const halfExtent = 0.94;
  const aa = 1.6 / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let accR = 0;
      let accG = 0;
      let accB = 0;
      let accA = 0;

      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const u = ((x + (sx + 0.5) * invSamples) / size) * 2 - 1;
          const v = ((y + (sy + 0.5) * invSamples) / size) * 2 - 1;

          const dBox = sdRoundedBox(u, v, halfExtent, halfExtent, cornerR);
          const alphaMask = 1 - smoothstep(-aa, aa, dBox);
          if (alphaMask <= 0.001) continue;

          // Deep storm-navy radial backdrop matching icon.png
          const distCenter = Math.hypot(u * 0.95, v * 0.95);
          const bgGlow = clamp(1 - distCenter * 0.88);
          let r = mix(10, 24, bgGlow);
          let g = mix(22, 58, bgGlow);
          let b = mix(48, 118, bgGlow);

          // Subtle concentric golden ring halo only on 48px (clean, non-ornate)
          if (size >= 48) {
            const dRing = Math.abs(Math.hypot(u, v) - 0.62);
            const ringMask = (1 - smoothstep(0.015, 0.042, dRing)) * 0.38;
            r = mix(r, 234, ringMask);
            g = mix(g, 186, ringMask);
            b = mix(b, 78, ringMask);
          }

          // Electric cyan glow + pure white core lightning bolt
          const dBolt = sdPolygon(u, v, boltPoly);
          const glowRadius = size <= 16 ? 0.24 : 0.20;
          const boltGlow = Math.pow(clamp(1 - Math.max(dBolt, 0) / glowRadius), 2.0);
          r = mix(r, 42, boltGlow * 0.72);
          g = mix(g, 208, boltGlow * 0.85);
          b = mix(b, 255, boltGlow * 0.96);

          // Cyan crisp outline around bolt
          const outlineMask = 1 - smoothstep(-aa * 0.5, 0.042, dBolt);
          r = mix(r, 96, outlineMask * 0.9);
          g = mix(g, 232, outlineMask * 0.95);
          b = mix(b, 255, outlineMask);

          // Pure luminous white core of lightning bolt
          const coreMask = 1 - smoothstep(-aa * 0.6, aa * 0.6, dBolt + (size <= 16 ? 0.008 : 0.018));
          r = mix(r, 255, coreMask);
          g = mix(g, 255, coreMask);
          b = mix(b, 255, coreMask);

          // Metallic gold rounded-square border (top-left bright gold -> bottom-right warm bronze gold)
          const innerBox = dBox + borderWidth;
          const borderMask = smoothstep(-aa, aa, innerBox);
          if (borderMask > 0.001) {
            const gradT = clamp((u + v + 1.6) / 3.2);
            const bezel = 1 - Math.abs((dBox + borderWidth * 0.5) / (borderWidth * 0.5));
            const br = mix(246, 184, gradT) + bezel * 14;
            const bg = mix(210, 134, gradT) + bezel * 12;
            const bb = mix(106, 46, gradT) + bezel * 6;
            r = mix(r, clamp(br, 0, 255), borderMask);
            g = mix(g, clamp(bg, 0, 255), borderMask);
            b = mix(b, clamp(bb, 0, 255), borderMask);
          }

          accR += r * alphaMask;
          accG += g * alphaMask;
          accB += b * alphaMask;
          accA += alphaMask;
        }
      }

      const norm = samples * samples;
      const outA = accA / norm;
      const idx = (y * size + x) * 4;
      if (outA > 0.001) {
        rgba[idx] = Math.round(clamp(accR / accA, 0, 255));
        rgba[idx + 1] = Math.round(clamp(accG / accA, 0, 255));
        rgba[idx + 2] = Math.round(clamp(accB / accA, 0, 255));
        rgba[idx + 3] = Math.round(clamp(outA * 255, 0, 255));
      } else {
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 0;
      }
    }
  }

  return encodePngRgba(size, size, rgba);
}

for (const sz of [16, 32, 48]) {
  const png = renderIcon(sz);
  const outPath = path.join(outDir, `icon-${sz}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Generated ${path.basename(outPath)} (${png.length} bytes)`);
}
