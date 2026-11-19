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
    name: 'popup.html',
    path: '/extension-v2.1.6/popup.html',
    summary:
      'v2.2.2: Pengaturan di Tab Setting disusun rapi per kelompok (1. Pil & Dock Video, 2. HUD Peringatan Blokir, 3. Jendela Mini-Player PiP, 4. Proteksi & Kecepatan) dengan seluruh slider (Timer Dim/Countdown, Ukuran & Opasitas) ditempatkan di bagian bawah setiap kelompok.',
    changedIn221: true,
  },
  {
    name: 'popup.js',
    path: '/extension-v2.1.6/popup.js',
    summary:
      'v2.2.2: Sinkronisasi real-time seluruh slider per kelompok (Timer Dim Pil Video, Timer Countdown HUD Blokir, Timer Redirect Auto-Revert, Ukuran Skala & Opasitas per kelompok).',
    changedIn221: true,
  },
  {
    name: 'content.js',
    path: '/extension-v2.1.6/content.js',
    summary:
      'v2.2.2: Penerapan timer, skala ukuran, dan opasitas terpisah per kelompok: videoPillOpacity & videoDockDimSec pada Pil Video, hudOpacity & hudDurationSec pada HUD Blokir, serta pipOpacity pada Mini-Player PiP.',
    changedIn221: true,
  },
  {
    name: 'background.js',
    path: '/extension-v2.1.6/background.js',
    summary:
      'v2.2.2: Inisialisasi default globalSettings lengkap dengan timer, skala ukuran, dan opasitas per kelompok.',
    changedIn221: true,
  },
  {
    name: 'manifest.json',
    path: '/extension-v2.1.6/manifest.json',
    summary: 'Pembaruan versi ekstensi menjadi 2.2.2 dengan key & permission Manifest V3 tetap utuh.',
    changedIn221: true,
  },
  {
    name: 'main_world.js',
    path: '/extension-v2.1.6/main_world.js',
    summary: 'Proteksi main-world intercept, anti-history trap, dan auto-skip countdown 5–30 detik.',
    changedIn221: false,
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
