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
      'v2.2.7: Perbaikan memory leak drag Pil Video via setPointerCapture (tanpa window listener), Toast Bypass Safelink (~800ms), smart fallback kuota runAiDomAudit(), & penghapusan regex domain komunitas hardcoded.',
    changedIn221: true,
  },
  {
    name: 'background.js',
    path: '/extension-v2.1.6/background.js',
    summary:
      'v2.2.7: Gemini API Key pindah ke HTTP Header x-goog-api-key + parser JSON anti-markdown, debounce 350ms DNR sync, auto-cleanup tabHistory (>2 jam/tab tutup), & seed default Whitelist komunitas.',
    changedIn221: true,
  },
  {
    name: 'main_world.js',
    path: '/extension-v2.1.6/main_world.js',
    summary:
      'v2.2.7: Penghapusan nukeTimers() agar buffer video HLS/DASH & sesi SPA tetap aman + penghapusan regex komunitas hardcoded (kini mengikuti daftar Trust di storage).',
    changedIn221: true,
  },
  {
    name: 'popup.html',
    path: '/extension-v2.1.6/popup.html',
    summary:
      'v2.2.7: Sinkronisasi label versi v2.2.7 dengan 5 tab lengkap (Umum, Setting per kelompok, Log Diagnostik Copy-Paste, Block, & Trust).',
    changedIn221: true,
  },
  {
    name: 'popup.js',
    path: '/extension-v2.1.6/popup.js',
    summary:
      'v2.2.7: Header log diagnostik v2.2.7, backup JSON v2.2.7, kontroler Tab Log copy-paste, & sinkronisasi real-time daftar Trust/Block.',
    changedIn221: true,
  },
  {
    name: 'manifest.json',
    path: '/extension-v2.1.6/manifest.json',
    summary: 'Pembaruan versi ekstensi menjadi 2.2.7 dengan seluruh permission Manifest V3 tetap utuh.',
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
