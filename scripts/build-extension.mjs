import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "public", "extension-v2.1.6");
const manifestBasePath = path.join(rootDir, "src", "ext", "manifest.base.json");
const manifestDevKeyPath = path.join(rootDir, "src", "ext", "manifest.dev-key.json");

const VERSION = "3.2.1";
const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
const buildTarget = targetArg ? targetArg.split("=")[1] : "dev"; // "dev" (default, preserves key/ID) | "store"

const zipStoreOutPath = path.join(rootDir, "public", `aegis-ai-shield-v${VERSION}-store.zip`);
const zipPrimaryOutPath = path.join(rootDir, "public", `aegis-ai-shield-v${VERSION}.zip`);
const zipDevOutPath = path.join(rootDir, "public", `aegis-ai-shield-v${VERSION}-dev.zip`);

const ENTRYPOINTS = [
  {
    name: "background.js",
    entry: path.join(rootDir, "src", "ext", "background", "index.js"),
    out: path.join(outDir, "background.js"),
    banner: `// AEGIS-AI Shield v${VERSION} — Bundled MV3 Background Service Worker (esbuild minified)`
  },
  {
    name: "main_world.js",
    entry: path.join(rootDir, "src", "ext", "main_world", "index.js"),
    out: path.join(outDir, "main_world.js"),
    banner: `// AEGIS-AI Shield v${VERSION} — Bundled MAIN World Native Guard (esbuild minified)`
  },
  {
    name: "content.js",
    entry: path.join(rootDir, "src", "ext", "content", "index.js"),
    out: path.join(outDir, "content.js"),
    banner: `// AEGIS-AI Shield v${VERSION} — Bundled Modular Content Script (esbuild minified)`
  },
  {
    name: "popup.js",
    entry: path.join(rootDir, "src", "ext", "popup", "index.js"),
    out: path.join(outDir, "popup.js"),
    banner: `// AEGIS-AI Shield v${VERSION} — Bundled Modular Popup Controller (esbuild minified)`
  }
];

const ASSET_FILES = [
  "background.js",
  "main_world.js",
  "content.js",
  "popup.html",
  "popup.js",
  "icon-16.png",
  "icon-32.png",
  "icon-48.png",
  "icon.png"
];

// Standard PKZIP STORE writer (zero external runtime dependencies)
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

function crc32(bytes) {
  let c = -1;
  for (let i = 0; i < bytes.length; i++) {
    c = (c >>> 8) ^ crcTable[(c ^ bytes[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

function writeU16LE(buf, offset, val) {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
}

function writeU32LE(buf, offset, val) {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
  buf[offset + 2] = (val >>> 16) & 0xff;
  buf[offset + 3] = (val >>> 24) & 0xff;
}

function buildZip(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeU32LE(localHeader, 0, 0x04034b50);
    writeU16LE(localHeader, 4, 20);
    writeU16LE(localHeader, 6, 0);
    writeU16LE(localHeader, 8, 0);
    writeU16LE(localHeader, 10, 0);
    writeU16LE(localHeader, 12, 0);
    writeU32LE(localHeader, 14, crc);
    writeU32LE(localHeader, 18, data.length);
    writeU32LE(localHeader, 22, data.length);
    writeU16LE(localHeader, 26, nameBytes.length);
    writeU16LE(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeU32LE(centralHeader, 0, 0x02014b50);
    writeU16LE(centralHeader, 4, 20);
    writeU16LE(centralHeader, 6, 20);
    writeU16LE(centralHeader, 8, 0);
    writeU16LE(centralHeader, 10, 0);
    writeU16LE(centralHeader, 12, 0);
    writeU16LE(centralHeader, 14, 0);
    writeU32LE(centralHeader, 16, crc);
    writeU32LE(centralHeader, 20, data.length);
    writeU32LE(centralHeader, 24, data.length);
    writeU16LE(centralHeader, 28, nameBytes.length);
    writeU16LE(centralHeader, 30, 0);
    writeU16LE(centralHeader, 32, 0);
    writeU16LE(centralHeader, 34, 0);
    writeU16LE(centralHeader, 36, 0);
    writeU32LE(centralHeader, 38, 0);
    writeU32LE(centralHeader, 42, offset);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  writeU32LE(eocd, 0, 0x06054b50);
  writeU16LE(eocd, 4, 0);
  writeU16LE(eocd, 6, 0);
  writeU16LE(eocd, 8, entries.length);
  writeU16LE(eocd, 10, entries.length);
  writeU32LE(eocd, 12, centralSize);
  writeU32LE(eocd, 16, offset);
  writeU16LE(eocd, 20, 0);

  const output = new Uint8Array(offset + centralSize + eocd.length);
  let cursor = 0;
  for (const part of localParts) {
    output.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centralParts) {
    output.set(part, cursor);
    cursor += part.length;
  }
  output.set(eocd, cursor);
  return output;
}

function sanitizePopupHtml(popupPath) {
  const raw = fs.readFileSync(popupPath, "utf8");
  // P4: Strip any injected preview/iframe helper script (e.g., _aistudio-iframe.js) if ever present
  const cleaned = raw.replace(
    /<script\b[^>]*src=["'][^"']*_aistudio-iframe[^"']*["'][^>]*>\s*<\/script>\s*/gi,
    ""
  );
  if (cleaned !== raw) {
    fs.writeFileSync(popupPath, cleaned, "utf8");
    console.warn("Stripped injected _aistudio-iframe script tag from popup.html");
  }
  if (/_aistudio-iframe/i.test(cleaned)) {
    throw new Error("popup.html still contains disallowed _aistudio-iframe reference!");
  }
}

function buildManifestObject(includeDevKey) {
  const base = JSON.parse(fs.readFileSync(manifestBasePath, "utf8"));
  if (base.version !== VERSION) {
    throw new Error(`manifest.base.json version (${base.version}) !== build VERSION (${VERSION})`);
  }
  if ("key" in base) {
    throw new Error("manifest.base.json MUST NOT contain a 'key' field (Store build rule)");
  }
  if (Array.isArray(base.permissions) && base.permissions.includes("tabs")) {
    throw new Error("manifest.base.json MUST NOT request unused 'tabs' permission");
  }
  if (includeDevKey) {
    const devOverlay = JSON.parse(fs.readFileSync(manifestDevKeyPath, "utf8"));
    return {
      manifest_version: base.manifest_version,
      name: base.name,
      version: base.version,
      minimum_chrome_version: base.minimum_chrome_version,
      key: devOverlay.key,
      ...Object.fromEntries(
        Object.entries(base).filter(
          ([k]) => !["manifest_version", "name", "version", "minimum_chrome_version"].includes(k)
        )
      )
    };
  }
  return base;
}

async function run() {
  for (const target of ENTRYPOINTS) {
    await esbuild.build({
      entryPoints: [target.entry],
      outfile: target.out,
      bundle: true,
      format: "iife",
      target: ["chrome111"],
      platform: "browser",
      minify: true,
      treeShaking: true,
      legalComments: "none",
      charset: "utf8",
      banner: { js: target.banner }
    });
    const stat = fs.statSync(target.out);
    const kb = stat.size / 1024;
    console.log(`Built ${target.name} (${kb.toFixed(1)} KB)`);
    if (target.name === "content.js" && kb >= 75) {
      throw new Error(`Bundle budget exceeded: content.js is ${kb.toFixed(1)} KB (limit < 75 KB)`);
    }
  }

  sanitizePopupHtml(path.join(outDir, "popup.html"));

  const storeManifestJson = `${JSON.stringify(buildManifestObject(false), null, 2)}\n`;
  const devManifestJson = `${JSON.stringify(buildManifestObject(true), null, 2)}\n`;

  // Write manifest.json into unpacked folder according to --target (default: store = no "key")
  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    buildTarget === "dev" ? devManifestJson : storeManifestJson,
    "utf8"
  );
  console.log(`Wrote public/extension-v2.1.6/manifest.json (target=${buildTarget})`);

  const sharedEntries = ASSET_FILES.map((fileName) => {
    const filePath = path.join(outDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing required extension file: ${filePath}`);
    }
    return {
      name: fileName,
      data: new Uint8Array(fs.readFileSync(filePath))
    };
  });

  const encoder = new TextEncoder();
  const storeZipBytes = buildZip([
    { name: "manifest.json", data: encoder.encode(storeManifestJson) },
    ...sharedEntries
  ]);
  const devZipBytes = buildZip([
    { name: "manifest.json", data: encoder.encode(devManifestJson) },
    ...sharedEntries
  ]);

  fs.writeFileSync(zipStoreOutPath, storeZipBytes);
  fs.writeFileSync(zipPrimaryOutPath, devZipBytes);
  fs.writeFileSync(zipDevOutPath, devZipBytes);

  console.log(
    `Packaged ${path.basename(zipStoreOutPath)} (${(storeZipBytes.length / 1024).toFixed(1)} KB, store-ready: no 'key')`
  );
  console.log(
    `Packaged ${path.basename(zipDevOutPath)} (${(devZipBytes.length / 1024).toFixed(1)} KB, dev unpacked: with 'key')`
  );
}

run().catch((err) => {
  console.error("Extension build failed:", err);
  process.exit(1);
});
