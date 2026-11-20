import React, { useEffect, useRef, useState } from 'react';
import {
  AllHudPositions,
  clampHudPosition,
  createSavedHudCoord,
  HudExpandDirection,
  resolveSavedHudCoord,
  resolveVideoDockExpandDirection,
} from '../utils/hudPositionMath';
import {
  classifyContentLinkOrImage,
  evaluateFirstPageOrExternalEntry,
  evaluateShortlinkServerRedirect,
  isDomainMatchedInList,
  isEmptyTrapOverlayElement,
  isShortlinkCtaClick,
  shouldNeutralizeAntiAdblockFetchProbe,
} from '../utils/smartContentClassifier';
import {
  AegisLogEntry,
  detectShortlinkBypassAction,
  extractDirectShortlinkUrl,
} from '../utils/shortlinkBypassEngine';

export interface GlobalSettingsState {
  hudEnabled: boolean;
  hudDurationSec: number;
  hudPosition: 'top-center' | 'top-left' | 'top-right' | 'bottom-center';
  hudOpacity: number;
  hudScale: number;
  hudShowTrust: boolean;
  hudShowGroup: boolean;
  hudShowOpen: boolean;
  hudShowBlock: boolean;
  hudShowUrlDetail: boolean;
  videoDockEnabled: boolean;
  videoDockDimSec: number;
  videoDockExpandDir: HudExpandDirection;
  videoPillScale: number;
  videoPillOpacity: number;
  videoPillShowPlayPause: boolean;
  videoPillShowList: boolean;
  videoPillShowDownload: boolean;
  videoPillShowPip: boolean;
  videoPillShowFullscreen: boolean;
  pipSize: 'small' | 'medium' | 'large';
  pipOpacity: number;
  adSkipSpeed: '8' | '16' | 'instant';
  smartUgcSense?: boolean;
  shortlinkBypassEnabled?: boolean;
  shortlinkAutoClick?: boolean;
  loggingEnabled?: boolean;
  removeTransparentOverlay: boolean;
  antiHistoryTrap: boolean;
  dnrEnabled: boolean;
  redirectWindowSec: number;
}

export interface BlockedPromptItem {
  id: string;
  blockedUrl: string;
  message: string;
  kind: 'redirect' | 'popup';
}

interface InteractiveHudSandboxProps {
  hudPositions: AllHudPositions;
  onUpdateHudPosition: (
    key: keyof AllHudPositions,
    coord: AllHudPositions[keyof AllHudPositions]
  ) => void;
  onResetAllPositions: () => void;
  globalSettings: GlobalSettingsState;
  onUpdateGlobalSettings: (next: GlobalSettingsState) => void;
  trustedDomains?: string[];
  deniedDomains?: string[];
  onTrustDomain: (domain: string) => void;
  onBlockDomain: (domain: string) => void;
  onAppendLog?: (entry: Omit<AegisLogEntry, 'id' | 'ts'>) => void;
}

const SAMPLE_PROMPTS: BlockedPromptItem[] = [
  {
    id: 'p1',
    blockedUrl: 'https://vikuy.click/watch?v=ac033',
    message: 'Konten eksternal (.click/.top) ditahan — Pilih ↗ Buka jika aman',
    kind: 'popup',
  },
  {
    id: 'p2',
    blockedUrl: 'https://rebrand.ly/pascol4d-semprot',
    message: 'Gambar tersusupi tautan iklan/judol ditahan',
    kind: 'popup',
  },
  {
    id: 'p3',
    blockedUrl: 'https://promo-gacor88.top/spin?clickid=adsterra_77',
    message: 'Auto-redirect lintas domain ditahan',
    kind: 'redirect',
  },
];

const DETECTED_STREAMS = [
  'https://cloudcdn.doodstream.com/hls/master_1080p.m3u8?token=8f92a',
  'https://vidcdn.streamtape.com/get_video/episode_04_sub_id.mp4',
  'https://delivery.filemoon.sx/pass_md5/stream_720p.mp4',
];

export const InteractiveHudSandbox: React.FC<InteractiveHudSandboxProps> = ({
  hudPositions,
  onUpdateHudPosition,
  onResetAllPositions,
  globalSettings,
  onUpdateGlobalSettings,
  trustedDomains = [],
  deniedDomains = [],
  onTrustDomain,
  onBlockDomain,
  onAppendLog,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const topHudRef = useRef<HTMLDivElement>(null);
  const videoDockRef = useRef<HTMLDivElement>(null);
  const miniPipRef = useRef<HTMLDivElement>(null);

  const [prompts, setPrompts] = useState<BlockedPromptItem[]>(SAMPLE_PROMPTS);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [videoDrawerOpen, setVideoDrawerOpen] = useState(false);
  const [videoDockDimmed, setVideoDockDimmed] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isMiniPipOpen, setIsMiniPipOpen] = useState(true);
  const [bypassToast, setBypassToast] = useState<{ host: string; method: string } | null>(null);
  const bypassToastTimerRef = useRef<number | null>(null);
  const [activeActionLog, setActiveActionLog] = useState<string>(
    'v2.2.7: Drag Pil Video anti-leak (setPointerCapture), Toast Bypass Safelink, default Whitelist komunitas, & Log Diagnostik aktif. Klik skenario uji di bawah.'
  );

  useEffect(() => {
    return () => {
      if (bypassToastTimerRef.current) {
        window.clearTimeout(bypassToastTimerRef.current);
      }
    };
  }, []);

  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({
    width: 820,
    height: 520,
  });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({
          width: Math.max(320, Math.round(rect.width)),
          height: Math.max(420, Math.round(rect.height)),
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const pipDimensions = (() => {
    if (globalSettings.pipSize === 'small') return { width: 200, height: 114 };
    if (globalSettings.pipSize === 'large') return { width: 280, height: 158 };
    return { width: 240, height: 136 };
  })();

  const safeHudOpacity = Math.max(0.5, Math.min(1.0, Number(globalSettings.hudOpacity) || 0.95));
  const safeVideoPillOpacity = Math.max(
    0.5,
    Math.min(1.0, Number(globalSettings.videoPillOpacity ?? globalSettings.hudOpacity) || 0.95)
  );
  const safePipOpacity = Math.max(
    0.5,
    Math.min(1.0, Number(globalSettings.pipOpacity ?? globalSettings.hudOpacity) || 0.95)
  );

  const safeHudScale = Math.max(0.75, Math.min(1.3, Number(globalSettings.hudScale) || 1.0));
  const safeVideoPillScale = Math.max(
    0.75,
    Math.min(1.35, Number(globalSettings.videoPillScale) || 1.0)
  );

  const suppressClickRef = useRef(false);

  // Generic Pointer Drag Hook for each HUD inside the sandbox container
  const startHudDrag = (
    e: React.PointerEvent,
    hudKey: keyof AllHudPositions,
    elRef: React.RefObject<HTMLDivElement | null>,
    hudLabel: string,
    allowStartOnButton = false,
    edgeMargin = 6
  ) => {
    const target = e.target as HTMLElement;
    if (!allowStartOnButton && target.closest('button')) return;
    if (!containerRef.current || !elRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const elRect = elRef.current.getBoundingClientRect();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialLeft = elRect.left - containerRect.left;
    const initialTop = elRect.top - containerRect.top;
    let didDrag = false;

    const handleMove = (moveEv: PointerEvent) => {
      if (!containerRef.current || !elRef.current) return;
      const dx = moveEv.clientX - startX;
      const dy = moveEv.clientY - startY;
      if (!didDrag && Math.hypot(dx, dy) >= 4) {
        didDrag = true;
        suppressClickRef.current = true;
      }
      if (!didDrag) return;

      const cRect = containerRef.current.getBoundingClientRect();
      const eRect = elRef.current.getBoundingClientRect();

      const saved = createSavedHudCoord(
        initialLeft + dx,
        initialTop + dy,
        eRect.width,
        eRect.height,
        cRect.width,
        cRect.height,
        edgeMargin
      );
      onUpdateHudPosition(hudKey, saved);
    };

    const handleUp = (upEv: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      if (!containerRef.current || !elRef.current) return;
      const dx = upEv.clientX - startX;
      const dy = upEv.clientY - startY;
      if (didDrag || Math.hypot(dx, dy) >= 4) {
        const cRect = containerRef.current.getBoundingClientRect();
        const eRect = elRef.current.getBoundingClientRect();
        const finalCoord = createSavedHudCoord(
          initialLeft + dx,
          initialTop + dy,
          eRect.width,
          eRect.height,
          cRect.width,
          cRect.height,
          edgeMargin
        );
        onUpdateHudPosition(hudKey, finalCoord);
        const sideInfo =
          hudKey === 'videoDock'
            ? finalCoord.anchorSide === 'left'
              ? ' · Pinggir Kiri (Buka Kiri→Kanan)'
              : ' · Pinggir Kanan (Buka Kanan→Kiri)'
            : '';
        setActiveActionLog(
          `Posisi ${hudLabel} disimpan (X: ${finalCoord.left}px, Y: ${finalCoord.top}px${sideInfo}).`
        );
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 60);
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  // Compute Top Manual HUD styles
  const resolvedTopHud = resolveSavedHudCoord(
    hudPositions.topHud,
    370,
    136,
    canvasSize.width,
    canvasSize.height,
    8
  );

  const getTopHudStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      opacity: safeHudOpacity,
      transformOrigin: 'top center',
    };
    if (resolvedTopHud) {
      return {
        ...base,
        left: `${resolvedTopHud.left}px`,
        top: `${resolvedTopHud.top}px`,
        transform: `scale(${safeHudScale})`,
      };
    }
    switch (globalSettings.hudPosition) {
      case 'top-left':
        return {
          ...base,
          top: '12px',
          left: '12px',
          transformOrigin: 'top left',
          transform: `scale(${safeHudScale})`,
        };
      case 'top-right':
        return {
          ...base,
          top: '12px',
          right: '12px',
          transformOrigin: 'top right',
          transform: `scale(${safeHudScale})`,
        };
      case 'bottom-center':
        return {
          ...base,
          bottom: '58px',
          left: '50%',
          transformOrigin: 'bottom center',
          transform: `translateX(-50%) scale(${safeHudScale})`,
        };
      default:
        return {
          ...base,
          top: '12px',
          left: '50%',
          transformOrigin: 'top center',
          transform: `translateX(-50%) scale(${safeHudScale})`,
        };
    }
  };

  // Compute Floating Video Dock direction ('ltr' | 'rtl') and edge-aware styles
  const activeVideoExpandDir = resolveVideoDockExpandDirection(
    globalSettings.videoDockExpandDir,
    hudPositions.videoDock,
    canvasSize.width
  );

  const estVideoDockWidth = videoDrawerOpen
    ? 310
    : videoDockDimmed
    ? 68
    : 245;
  const estVideoDockHeight = videoDrawerOpen ? 190 : 40;

  const resolvedVideoDock = resolveSavedHudCoord(
    hudPositions.videoDock,
    estVideoDockWidth,
    estVideoDockHeight,
    canvasSize.width,
    canvasSize.height,
    4
  );

  const isVideoDockNearTop = resolvedVideoDock ? resolvedVideoDock.top < 190 : false;

  const getVideoDockStyle = (): React.CSSProperties => {
    const originY = isVideoDockNearTop ? 'top' : 'bottom';
    const originX = activeVideoExpandDir === 'ltr' ? 'left' : 'right';
    const base: React.CSSProperties = {
      opacity: safeVideoPillOpacity,
      transform: `scale(${safeVideoPillScale})`,
      transformOrigin: `${originY} ${originX}`,
    };
    if (resolvedVideoDock) {
      if (activeVideoExpandDir === 'rtl') {
        return {
          ...base,
          right: `${resolvedVideoDock.right}px`,
          left: 'auto',
          top: `${resolvedVideoDock.top}px`,
          bottom: 'auto',
        };
      }
      return {
        ...base,
        left: `${resolvedVideoDock.left}px`,
        right: 'auto',
        top: `${resolvedVideoDock.top}px`,
        bottom: 'auto',
      };
    }
    if (activeVideoExpandDir === 'ltr') {
      return {
        ...base,
        left: '8px',
        right: 'auto',
        bottom: '14px',
      };
    }
    return {
      ...base,
      right: '8px',
      left: 'auto',
      bottom: '14px',
    };
  };

  const handleToggleVideoExpandDir = () => {
    const nextDir: 'ltr' | 'rtl' = activeVideoExpandDir === 'ltr' ? 'rtl' : 'ltr';
    onUpdateGlobalSettings({
      ...globalSettings,
      videoDockExpandDir: nextDir,
    });
    if (hudPositions.videoDock) {
      onUpdateHudPosition('videoDock', {
        ...hudPositions.videoDock,
        anchorSide: nextDir === 'ltr' ? 'left' : 'right',
      });
    }
    setActiveActionLog(
      nextDir === 'ltr'
        ? 'Arah buka Pil Video: Kiri ke Kanan (→) — cocok ditempel di pinggir kiri layar.'
        : 'Arah buka Pil Video: Kanan ke Kiri (←) — cocok ditempel di pinggir kanan layar.'
    );
  };

  const snapVideoDockToEdge = (edge: 'left' | 'right') => {
    const targetTop = resolvedVideoDock
      ? resolvedVideoDock.top
      : Math.max(40, canvasSize.height - 58);
    const targetLeft = edge === 'left' ? 4 : Math.max(4, canvasSize.width - estVideoDockWidth - 4);
    const saved = createSavedHudCoord(
      targetLeft,
      targetTop,
      estVideoDockWidth,
      40,
      canvasSize.width,
      canvasSize.height,
      4
    );
    saved.anchorSide = edge;
    if (edge === 'right') {
      saved.rightOffset = 4;
    }
    onUpdateHudPosition('videoDock', saved);
    onUpdateGlobalSettings({
      ...globalSettings,
      videoDockExpandDir: 'auto',
    });
    setActiveActionLog(
      edge === 'left'
        ? 'Pil Video ditempel ke Pinggir Kiri (4px) — membuka dari Kiri ke Kanan (→).'
        : 'Pil Video ditempel ke Pinggir Kanan (4px) — membuka dari Kanan ke Kiri (←).'
    );
  };

  // Compute Mini PiP styles
  const resolvedMiniPip = resolveSavedHudCoord(
    hudPositions.miniPip,
    pipDimensions.width,
    pipDimensions.height + 22,
    canvasSize.width,
    canvasSize.height,
    8
  );

  const getMiniPipStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      opacity: safePipOpacity,
      width: `${pipDimensions.width}px`,
    };
    if (resolvedMiniPip) {
      return {
        ...base,
        left: `${resolvedMiniPip.left}px`,
        top: `${resolvedMiniPip.top}px`,
      };
    }
    const defaultPos = clampHudPosition(
      canvasSize.width - pipDimensions.width - 16,
      canvasSize.height - pipDimensions.height - 86,
      pipDimensions.width,
      pipDimensions.height + 22,
      canvasSize.width,
      canvasSize.height,
      8
    );
    return {
      ...base,
      left: `${defaultPos.left}px`,
      top: `${defaultPos.top}px`,
    };
  };

  // Purge any prompts whose domain is already in deniedDomains or trustedDomains (Silent Blacklist Rule)
  const activePrompts = prompts.filter(
    (p) =>
      !isDomainMatchedInList(p.blockedUrl, deniedDomains) &&
      !isDomainMatchedInList(p.blockedUrl, trustedDomains)
  );

  const currentPrompt = activePrompts[0] || null;
  const currentHost = (() => {
    if (!currentPrompt) return '';
    try {
      return new URL(currentPrompt.blockedUrl).hostname.replace(/^www\./, '');
    } catch {
      return currentPrompt.blockedUrl;
    }
  })();

  const handlePromptAction = (action: 'trust' | 'redirect' | 'group' | 'blacklist' | 'dismiss') => {
    if (!currentPrompt) return;
    if (action === 'trust') {
      onTrustDomain(currentHost);
      setActiveActionLog(`Domain ${currentHost} ditambahkan ke Whitelist (Trust) & dibuka.`);
    } else if (action === 'blacklist') {
      onBlockDomain(currentHost);
      setActiveActionLog(
        `Domain ${currentHost} dimasukkan ke Blacklist — mulai sekarang diblokir senyap tanpa memunculkan HUD lagi!`
      );
    } else if (action === 'redirect') {
      setActiveActionLog(`Navigasi sekali (Buka) diizinkan ke ${currentHost}.`);
    } else if (action === 'group') {
      setActiveActionLog(`Membuka ${currentHost} di Tab Grup latar belakang.`);
    } else {
      setActiveActionLog(`Peringatan untuk ${currentHost} ditutup.`);
    }
    setPrompts((prev) => prev.filter((item) => item.id !== currentPrompt.id));
    setPreviewOpen(false);
  };

  const triggerSimulatedBlock = () => {
    setPrompts(SAMPLE_PROMPTS);
    setActiveActionLog(
      'Simulasi redirect/popup dipicu (domain yang sudah ada di Blacklist otomatis disaring & tidak memunculkan HUD).'
    );
  };

  const visibleTopHudActions = [
    globalSettings.hudShowTrust !== false && {
      key: 'trust',
      label: '✓ Trust',
      action: () => handlePromptAction('trust'),
      className:
        'py-1.5 px-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-[10.5px] cursor-pointer',
    },
    globalSettings.hudShowGroup !== false && {
      key: 'group',
      label: '⊞ Tab Grup',
      action: () => handlePromptAction('group'),
      className:
        'py-1.5 px-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-600 font-bold text-[10.5px] cursor-pointer',
    },
    globalSettings.hudShowOpen !== false && {
      key: 'redirect',
      label: '↗ Buka',
      action: () => handlePromptAction('redirect'),
      className:
        'py-1.5 px-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10.5px] cursor-pointer',
    },
    globalSettings.hudShowBlock !== false && {
      key: 'blacklist',
      label: '🚫 Blokir',
      action: () => handlePromptAction('blacklist'),
      className:
        'py-1.5 px-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/50 font-bold text-[10.5px] cursor-pointer',
    },
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    action: () => void;
    className: string;
  }>;

  return (
    <div className="flex flex-col border border-slate-800 bg-slate-900/90 rounded-xl overflow-hidden">
      {/* Sandbox Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="font-semibold text-white">Simulasi Halaman Web & Video Player</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-400">
            Pil: <strong className="text-sky-400">{Math.round(safeVideoPillScale * 100)}%</strong> ({Math.round(safeVideoPillOpacity * 100)}%)
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-400">
            HUD: <strong className="text-emerald-400">{Math.round(safeHudScale * 100)}%</strong> ({Math.round(safeHudOpacity * 100)}%)
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-400">
            PiP: <strong className="text-emerald-400">{Math.round(safePipOpacity * 100)}%</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => snapVideoDockToEdge('left')}
            className="px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Tempel Pil Video ke Pinggir Kiri (Buka Kiri ke Kanan)"
          >
            ⇥ Pil Pinggir Kiri (→)
          </button>
          <button
            type="button"
            onClick={() => snapVideoDockToEdge('right')}
            className="px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Tempel Pil Video ke Pinggir Kanan (Buka Kanan ke Kiri)"
          >
            Pil Pinggir Kanan (←) ⇤
          </button>
          <button
            type="button"
            onClick={triggerSimulatedBlock}
            className="px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            + Picu HUD ({activePrompts.length})
          </button>
          <button
            type="button"
            onClick={() => {
              onResetAllPositions();
              setActiveActionLog('Semua posisi HUD dikembalikan ke tata letak default.');
            }}
            className="px-2.5 py-1.5 text-xs font-medium bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-800/60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            ↺ Reset Posisi
          </button>
        </div>
      </div>

      {/* Simulated Webpage Viewport Canvas */}
      <div
        ref={containerRef}
        data-testid="hud-sandbox-canvas"
        className="relative w-full h-[520px] bg-slate-950 overflow-hidden select-none"
      >
        {/* Background Simulated Streaming & Forum Webpage Content */}
        <div className="p-5 max-w-2xl space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span>https://www.semprot.com/threads/ponakan-pemuas-nafsu.1545645/page-512</span>
            <span>·</span>
            <span className="text-emerald-400">AEGIS Shield v2.2.7 Active</span>
          </div>

          {/* Simulated Primary Video Player Box */}
          <div className="relative w-full max-w-[460px] h-[165px] rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col justify-between p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium text-slate-300">Pemutar Video Utama (HLS 1080p)</span>
              <span className="font-mono text-[11px] text-emerald-400">
                {isVideoPlaying ? 'PLAYING · 14:28 / 24:00' : 'PAUSED · 14:28 / 24:00'}
              </span>
            </div>

            <div className="my-auto flex flex-col items-center justify-center text-center">
              <button
                type="button"
                onClick={() => setIsVideoPlaying((p) => !p)}
                aria-label={isVideoPlaying ? 'Jeda simulasi video' : 'Putar simulasi video'}
                className="w-9 h-9 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-600 text-white flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
              >
                {isVideoPlaying ? '❚❚' : '▶'}
              </button>
              <p className="text-xs text-slate-400 mt-1">
                Auto-Skip Countdown 5–30d Aktif ({globalSettings.adSkipSpeed === 'instant' ? 'Instan' : `${globalSettings.adSkipSpeed}×`})
              </p>
            </div>

            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full w-3/5" />
            </div>
          </div>

          {/* Simulated Shortlink Bypass Debloated, 302 CTA, First-Page Entry & Silent Blacklist Test Bench (v2.2.7) */}
          <div
            data-testid="smart-ugc-test-bench"
            className="w-full max-w-[535px] rounded-xl bg-slate-900/90 border border-slate-800 p-2.5 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-300">
                🧠 Uji Logika v2.2.7: Toast Bypass Shortlink, Log Diagnostik & AI UGC
              </span>
              <span className="text-[10px] font-mono text-emerald-400">
                v2.2.7 Ready
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              {/* Case 1: First Page Entry from Telegram / WhatsApp / Google Search */}
              <button
                type="button"
                data-testid="test-first-page-entry"
                onClick={() => {
                  const res = evaluateFirstPageOrExternalEntry({
                    targetUrl: 'https://vikuy.click/watch?v=ac033',
                    previousTabUrl: 'https://t.me/s/channel_film',
                    referrerUrl: 'https://t.me/',
                    transitionType: 'link',
                    transitionQualifiers: [],
                    isTabStackEmpty: false,
                    trustedDomains,
                    deniedDomains,
                  });
                  if (res.shouldAllowEntry) {
                    setActiveActionLog(
                      `✅ [Halaman Pertama TG/WA/Google] Membuka link pertama (vikuy.click) dari Telegram/WhatsApp/Google Search langsung diizinkan (${res.entrySource})!`
                    );
                  }
                }}
                className="flex flex-col items-start justify-between p-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 text-left transition-colors cursor-pointer"
              >
                <span className="font-bold text-emerald-300">📲 1. Link TG/WA</span>
                <span className="font-mono text-[9px] text-slate-300 truncate w-full my-0.5">
                  t.me → vikuy.click
                </span>
                <span className="text-[8.5px] text-emerald-400 font-semibold">
                  Langsung Buka →
                </span>
              </button>

              {/* Case 2: Blacklisted Domain Silent Block (No HUD) */}
              <button
                type="button"
                data-testid="test-blacklist-silent-block"
                onClick={() => {
                  const targetDomain = deniedDomains[0] || 'hai8g.com';
                  const verdict = classifyContentLinkOrImage({
                    pageUrl: 'https://www.semprot.com/threads/ponakan-pemuas-nafsu.1545645/page-512',
                    rawHref: `https://rotator.${targetDomain}/jump?aff_id=99`,
                    isInsideUserPostContent: true,
                    isInsideRealAdSlot: false,
                    trustedDomains,
                    deniedDomains,
                  });
                  if (verdict.shouldSilentBlock && !verdict.shouldHoldInHud) {
                    setActiveActionLog(
                      `🔇 [Blokir Senyap Blacklist] Domain ${targetDomain} sudah ada di Blacklist — langsung diblokir tanpa memunculkan HUD Block Menu!`
                    );
                  }
                }}
                className="flex flex-col items-start justify-between p-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 text-left transition-colors cursor-pointer"
              >
                <span className="font-bold text-amber-300">🔇 2. Blacklist</span>
                <span className="font-mono text-[9px] text-slate-300 truncate w-full my-0.5">
                  {deniedDomains[0] || 'hai8g.com'}
                </span>
                <span className="text-[8.5px] text-amber-400 font-semibold">
                  Senyap Tanpa HUD
                </span>
              </button>

              {/* Case 3: Safe UGC Image Host with Anti-Adblock Bait Class */}
              <button
                type="button"
                data-testid="test-ugc-safe-image"
                onClick={() => {
                  const verdict = classifyContentLinkOrImage({
                    pageUrl: 'https://www.semprot.com/threads/ponakan-pemuas-nafsu.1545645/page-512',
                    rawHref: 'https://ibb.co.com/cK57k0fZ',
                    isInsideUserPostContent: true,
                    isInsideRealAdSlot: false,
                    hasAntiAdblockBaitClass: true,
                    cssClassSignature: 'bbImage adUnit',
                    hasImgChild: true,
                    imgSrc: 'https://i.ibb.co.com/KcMGv01D/Lanjutkan-10.jpg',
                    smartUgcSense: globalSettings.smartUgcSense !== false,
                    trustedDomains,
                    deniedDomains,
                  });
                  if (verdict.shouldAllowDirectly) {
                    setActiveActionLog(
                      '✅ [AI Smart UGC] Gambar Post #10,235 (ibb.co.com · class="bbImage adUnit") dikenali sebagai Konten Asli & langsung dibuka!'
                    );
                  }
                }}
                className="flex flex-col items-start justify-between p-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 text-left transition-colors cursor-pointer"
              >
                <span className="font-bold text-emerald-300">🖼️ 3. Gambar UGC</span>
                <span className="font-mono text-[9px] text-slate-300 truncate w-full my-0.5">
                  ibb.co.com/cK57k0fZ
                </span>
                <span className="text-[8.5px] text-emerald-400 font-semibold">
                  Konten Asli →
                </span>
              </button>

              {/* Case 4: Suspicious TLD (.click) Thumbnail Image inside User Post */}
              <button
                type="button"
                data-testid="test-ugc-suspicious-click"
                onClick={() => {
                  const verdict = classifyContentLinkOrImage({
                    pageUrl: 'https://www.semprot.com/threads/ponakan-pemuas-nafsu.1545645/page-512',
                    rawHref: 'https://vikuy.click/watch?v=ac033',
                    isInsideUserPostContent: true,
                    isInsideRealAdSlot: false,
                    hasAntiAdblockBaitClass: true,
                    cssClassSignature: 'js-lbImage',
                    hasImgChild: true,
                    imgSrc: 'https://cdn.vikuy.click/thumbnails/thumb_64efc538dbe75fcaf8020a72.webp',
                    smartUgcSense: globalSettings.smartUgcSense !== false,
                    trustedDomains,
                    deniedDomains,
                  });
                  if (verdict.shouldHoldInHud) {
                    setPrompts((prev) => [
                      {
                        id: `ugc-${Date.now()}`,
                        blockedUrl: verdict.resolvedUrl,
                        message: verdict.reason,
                        kind: 'popup',
                      },
                      ...prev.filter((p) => p.blockedUrl !== verdict.resolvedUrl),
                    ]);
                    setActiveActionLog(
                      '🛡️ [AI Smart UGC .click/.top] Gambar GAMGER (vikuy.click) ditahan dengan aman di HUD atas — pilih ↗ Buka / ⊞ Tab Grup!'
                    );
                  }
                }}
                className="flex flex-col items-start justify-between p-1.5 rounded-lg bg-sky-950/40 hover:bg-sky-900/50 border border-sky-500/40 text-left transition-colors cursor-pointer"
              >
                <span className="font-bold text-sky-300">🎬 4. Link .click</span>
                <span className="font-mono text-[9px] text-slate-300 truncate w-full my-0.5">
                  vikuy.click/watch
                </span>
                <span className="text-[8.5px] text-sky-400 font-semibold">
                  Tanya di HUD ↑
                </span>
              </button>

              {/* Case 5: Disguised Ad Element scanned by CSS Class (.itr / .samBannerUnit) & Shortener URL */}
              <button
                type="button"
                data-testid="test-ad-infiltrated-image"
                onClick={() => {
                  const verdict = classifyContentLinkOrImage({
                    pageUrl: 'https://www.semprot.com/threads/ponakan-pemuas-nafsu.1545645/page-512',
                    rawHref: 'https://rebrand.ly/pascol4d-semprot',
                    isInsideUserPostContent: true,
                    isInsideRealAdSlot: false,
                    cssClassSignature: 'itr samBannerUnit',
                    hasImgChild: true,
                    imgSrc: 'https://i.imgur.com/zOfaFQf.gif',
                    smartUgcSense: globalSettings.smartUgcSense !== false,
                    trustedDomains,
                    deniedDomains,
                  });
                  if (verdict.shouldHoldInHud) {
                    setPrompts((prev) => [
                      {
                        id: `ad-${Date.now()}`,
                        blockedUrl: verdict.resolvedUrl,
                        message: verdict.reason,
                        kind: 'popup',
                      },
                      ...prev.filter((p) => p.blockedUrl !== verdict.resolvedUrl),
                    ]);
                    setActiveActionLog(
                      '🚫 [AI CSS + URL Scan] Elemen iklan terselubung (class=".itr .samBannerUnit" + shortlink rebrand.ly/pascol4d) tertangkap & ditahan!'
                    );
                  }
                }}
                className="flex flex-col items-start justify-between p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/40 text-left transition-colors cursor-pointer"
              >
                <span className="font-bold text-rose-300">🎰 5. Iklan CSS</span>
                <span className="font-mono text-[9px] text-slate-300 truncate w-full my-0.5">
                  .itr / rebrand.ly
                </span>
                <span className="text-[8.5px] text-rose-400 font-semibold">
                  Tertangkap AI 🚫
                </span>
              </button>

              {/* Case 6: v2.2.5 Shortlink Redirect Ready (#overlay + #babay ?download=1&t=... HTTP 302 + Anti-Adblock fetch) */}
              <button
                type="button"
                data-testid="test-shortlink-302-cta"
                onClick={() => {
                  const trapBypassed = isEmptyTrapOverlayElement({
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
                  });
                  const probeNeutralized = shouldNeutralizeAntiAdblockFetchProbe(
                    'https://js.wpadmngr.com?t=1732100000',
                    'no-cors'
                  );
                  const ctaDetected = isShortlinkCtaClick({
                    rawHref: '?download=1&t=498109fe-e3a2-4cc6-96b4-702a66caa45b',
                    buttonText: 'Go To Link',
                    elementId: 'babay',
                    cardText: 'Redirect Ready Please wait a moment...',
                  });
                  const verdict = evaluateShortlinkServerRedirect({
                    destinationUrl: 'https://files.example-cdn.org/video/download-target.mp4',
                    shortlinkCtaGraceActive: ctaDetected,
                    transitionQualifiers: ['server_redirect'],
                    deniedDomains,
                    trustedDomains,
                  });
                  if (trapBypassed && probeNeutralized && verdict.shouldAllow) {
                    onAppendLog?.({
                      level: 'ALLOW',
                      source: 'background',
                      code: 'ALLOW_SHORTLINK_302',
                      fromUrl: 'https://go.short-redirect.net/?download=1&t=498109fe',
                      toUrl: 'https://files.example-cdn.org/video/download-target.mp4',
                      detail: 'HTTP 302 dari tombol CTA Go To Link diizinkan (overlay #overlay & probe fetch dinetralkan)',
                    });
                    setActiveActionLog(
                      '🔗 [Shortlink 302] #overlay jebakan di-bypass otomatis, anti-adblock fetch() dinetralkan, & klik "Go To Link" (?download=1&t=...) lolos HTTP 302 (tercatat di Tab 📋 Log)!'
                    );
                  }
                }}
                className="flex flex-col items-start justify-between p-1.5 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-400/50 text-left transition-colors cursor-pointer"
              >
                <span className="font-bold text-emerald-300">🔗 6. Shortlink 302</span>
                <span className="font-mono text-[9px] text-slate-300 truncate w-full my-0.5">
                  #overlay + Go To Link
                </span>
                <span className="text-[8.5px] text-emerald-300 font-semibold">
                  Lolos 302 ✓
                </span>
              </button>

              {/* Case 7: v2.2.6 Bypass All Shortlinks Debloated (BloggerPemula / Amm0ni4 Engine) */}
              <button
                type="button"
                data-testid="test-bypass-debloated"
                onClick={() => {
                  const target = 'https://drive.google.com/file/d/1AegisBypassDemo/view';
                  const doubleB64 = btoa(btoa(target));
                  const extracted = extractDirectShortlinkUrl({
                    pageUrl: `https://safelink-blogger.example.net/p/verify.html?go=${encodeURIComponent(doubleB64)}`,
                    deniedDomains,
                  });
                  const stepVerdict = detectShortlinkBypassAction({
                    hasVisibleUnsolvedCaptcha: false,
                    hasAdLinkFlyForm: false,
                    ctaHref: '?download=1&t=498109fe',
                    ctaText: 'Go To Link',
                    ctaDisabled: false,
                    ctaId: 'babay',
                    pageUrl: 'https://safelink-blogger.example.net/p/verify.html',
                    deniedDomains,
                  });
                  if (extracted.found && stepVerdict.action === 'AUTO_CLICK_CTA') {
                    let targetHost = extracted.decodedUrl;
                    try {
                      targetHost = new URL(extracted.decodedUrl).hostname;
                    } catch {
                      // fallback to full string
                    }
                    if (bypassToastTimerRef.current) {
                      window.clearTimeout(bypassToastTimerRef.current);
                    }
                    setBypassToast({ host: targetHost, method: extracted.method });
                    bypassToastTimerRef.current = window.setTimeout(() => {
                      setBypassToast(null);
                    }, 2400);
                    onAppendLog?.({
                      level: 'BYPASS',
                      source: 'content',
                      code: `BYPASS_${extracted.method}`,
                      fromUrl: 'https://safelink-blogger.example.net/p/verify.html?go=***',
                      toUrl: extracted.decodedUrl,
                      detail: `Bypass Shortlink Debloated mengekstrak URL tujuan langsung dengan Toast 800ms (${extracted.method})`,
                    });
                    setActiveActionLog(
                      `⚡ [Bypass Toast v2.2.7] Double-Base64 Safelink didekode (${extracted.method}) → Toast tampil ~800ms sebelum lompat ke ${extracted.decodedUrl} & dicatat ke Tab 📋 Log!`
                    );
                  }
                }}
                className="col-span-3 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-amber-950/50 hover:bg-amber-900/50 border border-amber-400/50 text-left transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <span className="font-bold text-amber-300">
                    ⚡ 7. Uji Bypass Shortlink Debloated (BloggerPemula Engine)
                  </span>
                  <span className="ml-2 font-mono text-[9px] text-slate-300">
                    ?go=DoubleBase64 → drive.google.com + Auto-Step + Catat Log
                  </span>
                </div>
                <span className="text-[9px] text-amber-300 font-bold shrink-0 ml-2">
                  Decode Instan ⚡
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* HUD 1: #aegis-top-manual-hud (Draggable Redirect / Popup Shield)  */}
        {/* v2.2.4: Never renders for domains in deniedDomains (Blacklist)    */}
        {/* ================================================================= */}
        {globalSettings.hudEnabled && currentPrompt && (
          <div
            ref={topHudRef}
            data-testid="hud-top-manual"
            style={getTopHudStyle()}
            className="absolute z-30 w-[370px] max-w-[calc(100%-16px)] bg-slate-900/95 backdrop-blur-md text-slate-50 border border-emerald-400/40 rounded-[14px] p-3 shadow-2xl transition-all"
          >
            {/* Draggable Header Row */}
            <div
              onPointerDown={(e) => startHudDrag(e, 'topHud', topHudRef, 'HUD Blokir', false, 6)}
              className="flex items-center justify-between gap-2 mb-2 cursor-grab active:cursor-grabbing touch-none"
              title="Geser untuk memindahkan posisi HUD (Tersimpan otomatis)"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-emerald-400 font-bold text-sm select-none">⠿</span>
                <span className="font-bold text-xs text-slate-100 truncate">
                  {currentPrompt.message}
                </span>
                {prompts.length > 1 && (
                  <span className="text-[10px] font-bold text-sky-400 ml-1 shrink-0">
                    1 dari {prompts.length}
                  </span>
                )}
                <span
                  data-testid="hud-top-timer-badge"
                  className="text-[9.5px] font-mono font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded px-1.5 py-0.5 shrink-0"
                >
                  ⏱️ {globalSettings.hudDurationSec === 0 ? '∞' : `${Number(globalSettings.hudDurationSec).toFixed(1)}d`}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {hudPositions.topHud && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateHudPosition('topHud', null);
                      setActiveActionLog('Posisi HUD Blokir dikembalikan ke preset.');
                    }}
                    title="Reset posisi HUD Blokir ke preset"
                    className="w-5 h-5 rounded-full bg-slate-800 hover:bg-sky-900/60 text-sky-300 text-[11px] font-bold flex items-center justify-center cursor-pointer"
                  >
                    ↺
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handlePromptAction('dismiss')}
                  title="Abaikan & Tutup"
                  className="w-5 h-5 rounded-full bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-200 text-[11px] font-bold flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Target Domain Box */}
            {globalSettings.hudShowUrlDetail !== false ? (
              <div className="flex items-center justify-between gap-2 bg-slate-950/80 border border-slate-700/70 rounded-lg px-2.5 py-1.5 mb-2">
                <span className="font-mono text-[11px] font-semibold text-slate-100 truncate">
                  {currentHost}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewOpen((v) => !v)}
                  className="text-[10px] font-bold text-sky-400 hover:underline shrink-0 cursor-pointer"
                >
                  {previewOpen ? 'Sembunyikan URL ▲' : 'Detail URL ▼'}
                </button>
              </div>
            ) : (
              <div className="bg-slate-950/80 border border-slate-700/70 rounded-lg px-2.5 py-1 mb-2">
                <span className="font-mono text-[11px] font-semibold text-slate-100 truncate block">
                  {currentHost}
                </span>
              </div>
            )}

            {/* Dynamic Action Buttons based on globalSettings.hudShow* */}
            {visibleTopHudActions.length > 0 && (
              <div
                data-testid="top-hud-actions"
                style={{
                  gridTemplateColumns: `repeat(${visibleTopHudActions.length}, minmax(0, 1fr))`,
                }}
                className="grid gap-1.5"
              >
                {visibleTopHudActions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={item.action}
                    className={item.className}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {globalSettings.hudShowUrlDetail !== false && previewOpen && (
              <div className="mt-2 p-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[10px] text-sky-300 break-all">
                {currentPrompt.blockedUrl}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* HUD 2: #aegis-miniplayer-dragbar + Mini PiP Window                */}
        {/* v2.2.1: Dedicated pipOpacity & pipSize                            */}
        {/* ================================================================= */}
        {isMiniPipOpen && (
          <div
            ref={miniPipRef}
            data-testid="hud-mini-pip"
            style={getMiniPipStyle()}
            className="absolute z-20 shadow-2xl transition-opacity"
          >
            {/* Drag Bar */}
            <div
              onPointerDown={(e) => startHudDrag(e, 'miniPip', miniPipRef, 'Mini PiP', false, 6)}
              className="h-[24px] bg-slate-900/95 border border-emerald-500/70 border-b-0 rounded-t-[10px] px-2 flex items-center justify-between text-[10px] font-bold text-slate-200 cursor-grab active:cursor-grabbing touch-none"
              title="Geser jendela Mini PiP (Tersimpan otomatis)"
            >
              <span className="text-emerald-400 select-none">⠿ Mini PiP (Geser)</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onUpdateHudPosition('miniPip', null);
                    setActiveActionLog('Posisi Mini PiP dikembalikan ke kanan bawah.');
                  }}
                  title="Reset Posisi Tersimpan ke Kanan Bawah"
                  className="bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded px-1.5 text-[9px] font-bold cursor-pointer"
                >
                  ↺
                </button>
                <button
                  type="button"
                  onClick={() => setIsMiniPipOpen(false)}
                  title="Tutup Mini PiP"
                  className="bg-rose-600 hover:bg-rose-500 text-white rounded px-1.5 text-[9px] font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Mini Player Video Surface */}
            <div
              style={{ height: `${pipDimensions.height}px` }}
              className="bg-black border-[1.5px] border-emerald-500/75 rounded-b-[12px] p-2.5 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-[10px] text-slate-300 font-mono">
                <span>PiP ({globalSettings.pipSize})</span>
                <span className="text-emerald-400">
                  {hudPositions.miniPip
                    ? `X:${hudPositions.miniPip.left}, Y:${hudPositions.miniPip.top}`
                    : 'Default'}
                </span>
              </div>
              <div className="text-center text-[11px] text-slate-300 font-medium">
                🎬 Stream Episode 04
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full w-2/3" />
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* HUD 3: #aegis-video-bottom-dock (Edge-Aware LTR / RTL Video Pill) */}
        {/* v2.2.1: Dedicated videoPillOpacity & videoPillScale + Menu        */}
        {/* ================================================================= */}
        {globalSettings.videoDockEnabled && (
          <div
            ref={videoDockRef}
            data-testid="hud-video-dock"
            data-expand-dir={activeVideoExpandDir}
            style={getVideoDockStyle()}
            className={`absolute z-30 flex gap-2 transition-all ${
              isVideoDockNearTop ? 'flex-col-reverse' : 'flex-col'
            } ${activeVideoExpandDir === 'ltr' ? 'items-start' : 'items-end'}`}
          >
            {/* Stream List Drawer */}
            {videoDrawerOpen && (
              <div className="w-[310px] max-w-[calc(100vw-20px)] bg-slate-900/95 backdrop-blur-md border border-slate-700/70 rounded-[14px] p-2.5 shadow-2xl text-slate-100">
                <div
                  onPointerDown={(e) =>
                    startHudDrag(e, 'videoDock', videoDockRef, 'Dock Video', false, 4)
                  }
                  className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-800 text-[10.5px] cursor-grab active:cursor-grabbing touch-none"
                  title="Geser untuk memindahkan posisi Dock Video"
                >
                  <span className="font-bold text-emerald-400">
                    ⠿ ⚡ Auto-Skip 5–30d AKTIF (2×)
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">{DETECTED_STREAMS.length} Stream</span>
                    <button
                      type="button"
                      onClick={handleToggleVideoExpandDir}
                      title="Ubah arah buka Pil Video (Kiri→Kanan / Kanan→Kiri)"
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-[10px] cursor-pointer"
                    >
                      {activeVideoExpandDir === 'ltr' ? 'Kiri→Kanan' : 'Kanan→Kiri'}
                    </button>
                    {hudPositions.videoDock && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateHudPosition('videoDock', null);
                          setActiveActionLog('Posisi Dock Video dikembalikan ke Auto-Anchor.');
                        }}
                        title="Reset posisi Dock Video"
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-[10px] cursor-pointer"
                      >
                        ↺
                      </button>
                    )}
                  </div>
                </div>

                {/* Stream Rows — "Tab Grup ↗" di kiri, "Buka" di kanan */}
                <div data-testid="video-drawer-streams" className="space-y-1.5 max-h-[120px] overflow-y-auto">
                  {DETECTED_STREAMS.map((streamUrl, idx) => {
                    const shortName = streamUrl.split('/').pop() || streamUrl;
                    return (
                      <div
                        key={streamUrl}
                        className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/80 last:border-b-0"
                      >
                        <span className="text-[10.5px] text-slate-200 truncate font-mono">
                          {idx + 1}. {shortName}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveActionLog(
                                `Membuka stream #${idx + 1} di Tab Grup latar belakang.`
                              )
                            }
                            className="px-2 py-0.5 rounded bg-sky-400 hover:bg-sky-300 text-sky-950 font-bold text-[9.5px] cursor-pointer"
                          >
                            Tab Grup ↗
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveActionLog(
                                `Memutar stream #${idx + 1} langsung (Buka) di tab aktif.`
                              )
                            }
                            className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-[9.5px] cursor-pointer"
                          >
                            Buka
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Floating Pill Control Bar — Ringkas (Default 🎬(N)) dengan Skala & Opasitas Kustom */}
            <div
              data-testid="hud-video-pill"
              data-pill-state={videoDockDimmed && !videoDrawerOpen ? 'compact' : 'expanded'}
              onPointerDown={(e) =>
                startHudDrag(e, 'videoDock', videoDockRef, 'Dock Video', true, 4)
              }
              onClickCapture={(e) => {
                if (suppressClickRef.current) {
                  e.stopPropagation();
                  e.preventDefault();
                }
              }}
              className={`inline-flex items-center rounded-full shadow-xl border backdrop-blur-md transition-all cursor-grab active:cursor-grabbing touch-none ${
                activeVideoExpandDir === 'rtl' ? 'flex-row-reverse' : 'flex-row'
              } ${
                videoDockDimmed && !videoDrawerOpen
                  ? 'gap-0 px-3 py-1.5 bg-slate-900/95 border-sky-400/50'
                  : 'gap-1.5 px-2.5 py-1.5 bg-slate-900/95 border-emerald-400/50'
              }`}
              title={`Tekan untuk membuka/meringkas Pil Video (${
                activeVideoExpandDir === 'ltr' ? 'Buka Kiri→Kanan' : 'Buka Kanan→Kiri'
              }) · Geser untuk memindahkan`}
            >
              {videoDockDimmed && !videoDrawerOpen ? (
                <button
                  type="button"
                  data-testid="video-pill-compact-trigger"
                  onClick={() => {
                    setVideoDockDimmed(false);
                    setActiveActionLog(
                      `Pil Video dibuka manual (${
                        activeVideoExpandDir === 'ltr' ? 'Kiri→Kanan' : 'Kanan→Kiri'
                      }). Tekan 🎬(${DETECTED_STREAMS.length}) lagi untuk meringkas.`
                    );
                  }}
                  className="text-xs font-extrabold text-slate-100 leading-none tracking-tight cursor-pointer whitespace-nowrap px-0.5 py-0.5"
                >
                  🎬({DETECTED_STREAMS.length})
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    data-testid="video-pill-collapse-trigger"
                    onClick={() => {
                      setVideoDrawerOpen(false);
                      setVideoDockDimmed(true);
                      setActiveActionLog(
                        `Pil Video diringkas kembali ke 🎬(${DETECTED_STREAMS.length}).`
                      );
                    }}
                    title="Tekan untuk meringkas kembali ke 🎬(N) · Geser untuk memindahkan"
                    className="px-2.5 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-extrabold text-xs leading-none cursor-pointer whitespace-nowrap"
                  >
                    🎬({DETECTED_STREAMS.length})
                  </button>

                  {globalSettings.videoPillShowPlayPause !== false && (
                    <button
                      type="button"
                      data-testid="vp-btn-play"
                      onClick={() => setIsVideoPlaying((p) => !p)}
                      title={isVideoPlaying ? 'Jeda Video' : 'Putar Video'}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer ${
                        isVideoPlaying
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      {isVideoPlaying ? '❚❚' : '▶'}
                    </button>
                  )}

                  {globalSettings.videoPillShowList !== false && (
                    <button
                      type="button"
                      data-testid="vp-btn-list"
                      onClick={() => setVideoDrawerOpen((v) => !v)}
                      title="Daftar Stream Video"
                      className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer ${
                        videoDrawerOpen
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      ☰
                      <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-emerald-500 text-emerald-950 font-extrabold text-[9.5px] leading-[15px]">
                        {DETECTED_STREAMS.length}
                      </span>
                    </button>
                  )}

                  {globalSettings.videoPillShowDownload !== false && (
                    <button
                      type="button"
                      data-testid="vp-btn-download"
                      onClick={() =>
                        setActiveActionLog(
                          `Mengunduh / membuka stream utama (${DETECTED_STREAMS[0].split('/').pop()}) di Tab Grup.`
                        )
                      }
                      title="Unduh / Buka Stream Video"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-slate-200 hover:bg-white/10 cursor-pointer"
                    >
                      ⬇
                    </button>
                  )}

                  {globalSettings.videoPillShowPip !== false && (
                    <button
                      type="button"
                      data-testid="vp-btn-pip"
                      onClick={() => setIsMiniPipOpen((v) => !v)}
                      title="Toggle Mini PiP"
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer ${
                        isMiniPipOpen
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      ⧉
                    </button>
                  )}

                  {globalSettings.videoPillShowFullscreen !== false && (
                    <button
                      type="button"
                      data-testid="vp-btn-fullscreen"
                      onClick={() =>
                        setActiveActionLog('Mode Layar Penuh (Fullscreen) dipicu pada video utama.')
                      }
                      title="Layar Penuh (Fullscreen)"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-slate-200 hover:bg-white/10 cursor-pointer"
                    >
                      ⛶
                    </button>
                  )}

                  <button
                    type="button"
                    data-testid="video-pill-dir-toggle"
                    onClick={handleToggleVideoExpandDir}
                    title={
                      activeVideoExpandDir === 'ltr'
                        ? 'Arah Buka: Kiri → Kanan (Klik untuk ubah ke Kanan → Kiri)'
                        : 'Arah Buka: Kanan → Kiri (Klik untuk ubah ke Kiri → Kanan)'
                    }
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold text-sky-300 hover:bg-sky-500/20 cursor-pointer"
                  >
                    {activeVideoExpandDir === 'ltr' ? '→' : '←'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {/* v2.2.7 Brief Corner Toast Notification on Early Direct Shortlink Bypass */}
        {bypassToast && (
          <div
            data-testid="sandbox-bypass-toast"
            className="absolute bottom-3 right-3 z-40 max-w-[330px] rounded-xl bg-slate-900/95 border border-emerald-400/50 px-3.5 py-2.5 shadow-2xl backdrop-blur-md flex items-center gap-2.5"
          >
            <span className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-sm shrink-0">
              ⚡
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold text-emerald-300 leading-tight">
                ⚡ AEGIS Bypass: Melompati Safelink...
              </div>
              <div className="text-[10px] font-mono text-slate-300 truncate mt-0.5">
                → {bypassToast.host} ({bypassToast.method})
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-950 border-t border-slate-800 text-xs">
        <span className="text-slate-300">{activeActionLog}</span>
        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400 tabular-nums">
          <span>
            Pil:{' '}
            <strong className="text-sky-400">
              {Math.round(safeVideoPillScale * 100)}% · Op:{Math.round(safeVideoPillOpacity * 100)}%
            </strong>
          </span>
          <span>·</span>
          <span>
            HUD:{' '}
            <strong className="text-emerald-400">
              {Math.round(safeHudScale * 100)}% · Op:{Math.round(safeHudOpacity * 100)}%
            </strong>
          </span>
          <span>·</span>
          <span>
            PiP:{' '}
            <strong className="text-emerald-400">Op:{Math.round(safePipOpacity * 100)}%</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
