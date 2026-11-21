import React, { useEffect, useState } from 'react';
import { Copy, Check, Download, FileCode } from 'lucide-react';

export interface ExtensionFileMeta {
  name: string;
  path: string;
  summary: string;
  changedIn221: boolean;
}

export const EXTENSION_FILES: ExtensionFileMeta[] = [
  {
    name: 'content.js',
    path: '/extension-v2.1.6/content.js',
    summary:
      'v3.2.1 (74.8 KB minified < 75 KB): Re-validasi untrusted bridge, closed Shadow DOM HUD/Video Dock, deteksi embed iframe video, ev.isTrusted + 2-langkah Trust, rate-limit UI, & video-tap shield.',
    changedIn221: true,
  },
  {
    name: 'background.js',
    path: '/extension-v2.1.6/background.js',
    summary:
      'v3.2.1 (53.3 KB minified): OAuth precedence (P2), filter judol presisi (P1), opt-in Gemini gate (P5), relay video iframe, & migrasi storage termasuk geminiApiKey lama (P8).',
    changedIn221: true,
  },
  {
    name: 'main_world.js',
    path: '/extension-v2.1.6/main_world.js',
    summary:
      'v3.2.1 (31.6 KB minified): Video-tap hijack shield (Navigation API + fallback native video), P6 timer hook cache 500ms + regex batas kata, P1/P2 unified classifier, & CAPTCHA restore.',
    changedIn221: true,
  },
  {
    name: 'popup.html',
    path: '/extension-v2.1.6/popup.html',
    summary:
      'v3.2.1: Toggle opt-in Gemini + disclosure data Google, peringatan persistent API key, konfirmasi inline Auto-Skip & Auto-Klik, copy anti-spoof jujur, & bebas _aistudio-iframe.js.',
    changedIn221: true,
  },
  {
    name: 'popup.js',
    path: '/extension-v2.1.6/popup.js',
    summary:
      'v3.2.1 (38.2 KB minified): Kontrol opt-in Gemini/Auto-Skip/Auto-Klik, pelestarian geminiApiKey lama saat update, sanitasi & limitasi restore backup JSON (P8), & Laporan FP tersensor.',
    changedIn221: true,
  },
  {
    name: 'manifest.json',
    path: '/extension-v2.1.6/manifest.json',
    summary:
      'v3.2.1 (Update-Safe): Menyertakan "key" tetap agar ID ekstensi & seluruh settingan/storage lama terbawa saat update (varian -store.zip tanpa "key" tetap tersedia).',
    changedIn221: true,
  },
];

export const SourceCodeInspector: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<ExtensionFileMeta>(EXTENSION_FILES[0]);
  const [fileContent, setFileContent] = useState<string>('Memuat kode sumber...');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setFileContent('Memuat kode sumber...');
    fetch(selectedFile.path)
      .then((res) => res.text())
      .then((txt) => {
        if (active) setFileContent(txt);
      })
      .catch(() => {
        if (active) setFileContent('Gagal memuat berkas.');
      });
    return () => {
      active = false;
    };
  }, [selectedFile]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fileContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="border border-slate-800 bg-slate-900/90 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          {EXTENSION_FILES.map((file) => (
            <button
              key={file.name}
              type="button"
              onClick={() => setSelectedFile(file)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedFile.name === file.name
                  ? 'bg-emerald-500 text-emerald-950 font-bold'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {file.name}
              {file.changedIn221 ? ' *' : ''}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Tersalin' : 'Salin Kode'}
          </button>
          <a
            href={selectedFile.path}
            download={selectedFile.name}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Unduh {selectedFile.name}
          </a>
        </div>
      </div>

      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{selectedFile.summary}</span>
        </div>
        <span className="font-mono text-[11px] text-slate-400 shrink-0 ml-3 tabular-nums">
          {fileContent.split('\n').length} baris
        </span>
      </div>

      <pre className="p-4 m-0 max-h-[460px] overflow-auto bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed">
        <code>{fileContent}</code>
      </pre>
    </div>
  );
};
