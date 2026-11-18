import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Brush,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  MessageCircleQuestion,
  Sparkles,
} from 'lucide-react';
import type {
  SketchBook,
  SketchEntry,
  SketchPrivateState,
  SketchPublicState,
} from '../../shared/gameTypes.js';
import type { Language, PlayerSeat, RoomPublicState } from '../../shared/types.js';
import { soundEngine } from '../audio/soundEngine.js';
import { useI18n } from '../i18n/useI18n.js';
import { AvatarBadge } from '../components/AvatarBadge.js';
import { CountdownPill } from '../components/CountdownPill.js';
import { DrawingCanvas } from './DrawingCanvas.js';

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const clean = text.trim();
  if (!clean) return [''];
  const lines: string[] = [];
  let current = '';

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '\n') {
      lines.push(current);
      current = '';
      continue;
    }
    const candidate = current + ch;
    if (ctx.measureText(candidate).width > maxWidth && current.length > 0) {
      // Break nicely on ASCII word boundaries when possible
      const lastSpace = current.lastIndexOf(' ');
      if (lastSpace > current.length * 0.45 && ch !== ' ') {
        lines.push(current.slice(0, lastSpace).trimEnd());
        current = current.slice(lastSpace + 1) + ch;
      } else {
        lines.push(current);
        current = ch === ' ' ? '' : ch;
      }
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function loadImageDataUrl(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function exportSketchBookPng(
  book: SketchBook,
  seatMap: Map<string, PlayerSeat>,
  lang: Language,
  isWinner: boolean,
): Promise<void> {
  const width = 860;
  const padX = 44;
  const innerW = width - padX * 2;
  const gap = 24;

  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');
  if (!mCtx) return;

  const fontStack =
    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'PingFang SC', 'Microsoft YaHei', sans-serif";

  interface LayoutItem {
    entry: SketchEntry;
    lines: string[];
    height: number;
    img: HTMLImageElement | null;
  }

  mCtx.font = `800 28px ${fontStack}`;
  const items: LayoutItem[] = [];
  for (const entry of book.entries) {
    if (entry.kind === 'draw' && entry.imageDataUrl) {
      const img = await loadImageDataUrl(entry.imageDataUrl);
      const imgBoxW = innerW - 44;
      const imgBoxH = Math.round((imgBoxW * 3) / 4);
      items.push({
        entry,
        lines: [],
        height: 58 + imgBoxH + 40,
        img,
      });
    } else {
      const lines = wrapCanvasText(mCtx, `“${entry.text ?? ''}”`, innerW - 64);
      const textBlockH = Math.max(40, lines.length * 38);
      items.push({
        entry,
        lines,
        height: 62 + textBlockH + 26,
        img: null,
      });
    }
  }

  const headerH = 148;
  const footerH = 88;
  const bodyH =
    items.reduce((acc, it) => acc + it.height, 0) +
    Math.max(0, items.length - 1) * gap;
  const totalHeight = headerH + bodyH + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Velvet dark backdrop
  const bgGrad = ctx.createLinearGradient(0, 0, 0, totalHeight);
  bgGrad.addColorStop(0, '#0B0D13');
  bgGrad.addColorStop(0.5, '#121826');
  bgGrad.addColorStop(1, '#0B0D13');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, totalHeight);

  // Outer gold frame
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
  ctx.lineWidth = 3;
  drawRoundedRectPath(ctx, 18, 18, width - 36, totalHeight - 36, 28);
  ctx.stroke();

  // Header panel
  const ownerName = seatMap.get(book.ownerId)?.name ?? book.ownerId;
  ctx.fillStyle = 'rgba(212, 175, 55, 0.12)';
  drawRoundedRectPath(ctx, padX, 36, innerW, 92, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#F3E09F';
  ctx.font = `800 30px ${fontStack}`;
  const titleText =
    lang === 'zh' ? '🎨 灵魂画手 · 传声晚宴画册' : '🎨 Soul Sketcher · Relay Album';
  ctx.fillText(titleText, width / 2, 78);

  ctx.fillStyle = '#E2E8F0';
  ctx.font = `600 18px ${fontStack}`;
  const mvpBadge = isWinner ? (lang === 'zh' ? '  ·  🏆 本场 MVP' : '  ·  🏆 MVP Winner') : '';
  const subText =
    lang === 'zh'
      ? `出题人：${ownerName}  ·  共 ${book.entries.length} 幕${mvpBadge}`
      : `Started by ${ownerName}  ·  ${book.entries.length} Frames${mvpBadge}`;
  ctx.fillText(subText, width / 2, 110);

  // Entries
  let cursorY = headerH;
  items.forEach((item, idx) => {
    const { entry, height, lines, img } = item;
    const authorName = seatMap.get(entry.authorId)?.name ?? entry.authorId;

    if (entry.kind === 'draw') {
      // Polaroid frame
      ctx.fillStyle = '#FAF6EC';
      drawRoundedRectPath(ctx, padX, cursorY, innerW, height, 22);
      ctx.fill();
      ctx.strokeStyle = '#E5DEC9';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Top metadata inside Polaroid
      ctx.textAlign = 'left';
      ctx.fillStyle = '#92400E';
      ctx.font = `800 18px ${fontStack}`;
      ctx.fillText(
        `#${idx + 1}  ${lang === 'zh' ? '灵魂画作' : 'SKETCH'} · ${authorName}`,
        padX + 22,
        cursorY + 34,
      );

      // White image backing
      const imgX = padX + 22;
      const imgY = cursorY + 48;
      const imgBoxW = innerW - 44;
      const imgBoxH = Math.round((imgBoxW * 3) / 4);
      ctx.fillStyle = '#FFFFFF';
      drawRoundedRectPath(ctx, imgX, imgY, imgBoxW, imgBoxH, 12);
      ctx.fill();
      ctx.strokeStyle = '#E5E7EB';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (img && img.width > 0 && img.height > 0) {
        const scale = Math.min(imgBoxW / img.width, imgBoxH / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const dx = imgX + (imgBoxW - drawW) / 2;
        const dy = imgY + (imgBoxH - drawH) / 2;
        ctx.drawImage(img, dx, dy, drawW, drawH);
      } else {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#6B7280';
        ctx.font = `600 20px ${fontStack}`;
        ctx.fillText(lang === 'zh' ? '画作预览' : 'Sketch', width / 2, imgY + imgBoxH / 2);
      }

      ctx.textAlign = 'right';
      ctx.fillStyle = '#6B7280';
      ctx.font = `600 16px ${fontStack}`;
      ctx.fillText(`🎨 ${authorName}`, padX + innerW - 24, cursorY + height - 14);
    } else {
      const isPrompt = entry.kind === 'prompt';
      ctx.fillStyle = isPrompt ? '#26142A' : '#182136';
      drawRoundedRectPath(ctx, padX, cursorY, innerW, height, 22);
      ctx.fill();
      ctx.strokeStyle = isPrompt
        ? 'rgba(244, 114, 182, 0.65)'
        : 'rgba(212, 175, 55, 0.65)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = isPrompt ? '#F472B6' : '#FACC15';
      ctx.font = `800 17px ${fontStack}`;
      const badge = isPrompt
        ? lang === 'zh'
          ? `🎬 #${idx + 1} 出题卡`
          : `🎬 #${idx + 1} PROMPT`
        : lang === 'zh'
          ? `💬 #${idx + 1} 离谱猜词`
          : `💬 #${idx + 1} WILD GUESS`;
      ctx.fillText(badge, padX + 24, cursorY + 34);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#CBD5E1';
      ctx.font = `700 17px ${fontStack}`;
      ctx.fillText(authorName, padX + innerW - 24, cursorY + 34);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `800 28px ${fontStack}`;
      lines.forEach((line, lIdx) => {
        ctx.fillText(line, width / 2, cursorY + 80 + lIdx * 38);
      });
    }

    cursorY += height;
    if (idx < items.length - 1) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(212, 175, 55, 0.75)';
      ctx.font = `800 18px ${fontStack}`;
      ctx.fillText('↓', width / 2, cursorY + gap - 6);
      cursorY += gap;
    }
  });

  // Footer watermark
  const footerTop = totalHeight - footerH + 14;
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, footerTop);
  ctx.lineTo(width - padX, footerTop);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#D4AF37';
  ctx.font = `800 17px ${fontStack}`;
  ctx.fillText('Velvet Tabletop · 灵魂画手：传声晚宴', width / 2, footerTop + 34);
  ctx.fillStyle = '#94A3B8';
  ctx.font = `500 13px ${fontStack}`;
  ctx.fillText('Offline Souvenir Keepsake', width / 2, footerTop + 56);

  soundEngine.playSfx('shutterClick');

  const pngUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = pngUrl;
  link.download = 'sketch-album.png';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

const SketchComicStrip: React.FC<{
  entries: SketchEntry[];
  seatMap: Map<string, PlayerSeat>;
  lang: Language;
  highlightLast?: boolean;
}> = ({ entries, seatMap, lang, highlightLast }) => {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry, idx) => {
        const author = seatMap.get(entry.authorId);
        const authorName = author?.name ?? entry.authorId;
        const isLatest = Boolean(highlightLast && idx === entries.length - 1);

        if (entry.kind === 'draw') {
          return (
            <div
              key={`${entry.authorId}-${idx}`}
              style={{ animationDelay: `${Math.min(idx * 65, 320)}ms` }}
              className={`animate-card-deal flex flex-col justify-between rounded-2xl border-2 bg-[#FAF6EC] p-3 pb-3.5 text-slate-900 shadow-2xl transition-transform ${
                idx % 2 === 1 ? 'sm:rotate-[0.6deg]' : 'sm:-rotate-[0.6deg]'
              } ${
                isLatest
                  ? 'animate-pulse-gold border-[#D4AF37] ring-2 ring-[#D4AF37]/50'
                  : 'border-[#E5DEC9]'
              }`}
            >
              <div className="mb-2 flex items-center justify-between text-[11px] font-extrabold text-amber-900/80">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-900/10 px-2 py-0.5">
                  🎨 #{idx + 1} {lang === 'zh' ? '灵魂画作' : 'SKETCH'}
                </span>
                <span className="truncate font-bold text-slate-700">{authorName}</span>
              </div>
              {entry.imageDataUrl && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <img
                    src={entry.imageDataUrl}
                    alt={`Sketch by ${authorName}`}
                    className="aspect-[4/3] w-full bg-[#FFFDF7] object-contain"
                  />
                </div>
              )}
              <div className="mt-2.5 flex items-center justify-between border-t border-amber-900/15 pt-1.5 text-xs font-bold text-slate-600">
                <span>{lang === 'zh' ? `画师：${authorName}` : `By ${authorName}`}</span>
                <span className="text-[10px] tracking-wider text-amber-800/70 uppercase">
                  Polaroid #{idx + 1}
                </span>
              </div>
            </div>
          );
        }

        const isPrompt = entry.kind === 'prompt';
        return (
          <div
            key={`${entry.authorId}-${idx}`}
            style={{ animationDelay: `${Math.min(idx * 65, 320)}ms` }}
            className={`animate-card-deal relative flex flex-col justify-between rounded-2xl border p-4 shadow-xl ${
              isPrompt
                ? 'border-pink-400/50 bg-gradient-to-br from-pink-950/75 via-[#1a182d] to-[#121524]'
                : 'border-amber-400/45 bg-gradient-to-br from-amber-500/20 via-[#1a2238] to-[#111728]'
            } ${isLatest ? 'animate-pulse-gold ring-2 ring-[#D4AF37]/55' : ''}`}
          >
            <div className="mb-3 flex items-center justify-between gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                  isPrompt
                    ? 'bg-pink-500/25 text-pink-200'
                    : 'bg-amber-400/20 text-amber-200'
                }`}
              >
                {isPrompt ? (
                  <>
                    <Sparkles className="h-3 w-3" />
                    {lang === 'zh' ? `#${idx + 1} 出题卡` : `#${idx + 1} PROMPT`}
                  </>
                ) : (
                  <>
                    <MessageCircleQuestion className="h-3 w-3" />
                    {lang === 'zh' ? `#${idx + 1} 离谱猜词` : `#${idx + 1} GUESS`}
                  </>
                )}
              </span>
              <span className="truncate font-bold text-[#F3E09F]">{authorName}</span>
            </div>

            <div className="my-auto flex min-h-[112px] items-center justify-center rounded-2xl border border-white/15 bg-black/35 px-4 py-5 text-center">
              <p className="text-base font-black leading-snug text-white sm:text-lg">
                “{entry.text}”
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-300/80">
              <span>
                {isPrompt
                  ? lang === 'zh'
                    ? '传声起点'
                    : 'Chain Origin'
                  : lang === 'zh'
                    ? '脑洞接龙'
                    : 'Relay Guess'}
              </span>
              <span>#{idx + 1}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const SketchView: React.FC<{
  room: RoomPublicState;
  pub: SketchPublicState;
  priv: SketchPrivateState | null;
  isTvMode: boolean;
  isHost: boolean;
  canSpeakStage: boolean;
  onAction: (action: Record<string, unknown>) => void;
  onEmit: (event: string) => void;
}> = ({ room, pub, priv, isTvMode, isHost, canSpeakStage, onAction, onEmit }) => {
  const { lang, pick } = useI18n();
  const seatMap = useMemo(
    () => new Map<string, PlayerSeat>(room.seats.map((s) => [s.id, s])),
    [room.seats],
  );
  const [textInput, setTextInput] = useState('');
  const [selectedBookIdx, setSelectedBookIdx] = useState(0);
  const [exporting, setExporting] = useState(false);
  const lastSpokenRef = useRef<string>('');

  useEffect(() => {
    setTextInput('');
  }, [pub.phase, pub.step]);

  useEffect(() => {
    if (pub.phase !== 'game_over' || !pub.allBooks?.length) return;
    const winnerId = pub.winnerBookOwnerIds?.[0];
    const winnerIdx = winnerId
      ? pub.allBooks.findIndex((b) => b.ownerId === winnerId)
      : 0;
    setSelectedBookIdx(winnerIdx >= 0 ? winnerIdx : 0);
  }, [pub.phase, pub.allBooks, pub.winnerBookOwnerIds]);

  useEffect(() => {
    if (pub.phase !== 'exhibition' || !pub.revealedBook) return;
    const key = `${pub.exhibitionBookIndex}:${pub.exhibitionEntryIndex}`;
    if (lastSpokenRef.current === key) return;
    lastSpokenRef.current = key;
    const newest = pub.revealedBook.entries[pub.exhibitionEntryIndex];
    if (newest?.text) {
      const author = seatMap.get(newest.authorId)?.name ?? '';
      const line =
        lang === 'zh'
          ? `${author} 写的是：${newest.text}`
          : `${author} wrote: ${newest.text}`;
      soundEngine.speakDynamicLine(
        line,
        lang,
        lang === 'zh' ? 'zh_host_female' : 'en_host_female',
        canSpeakStage,
      );
    }
  }, [
    pub.phase,
    pub.exhibitionBookIndex,
    pub.exhibitionEntryIndex,
    pub.revealedBook,
    canSpeakStage,
    lang,
    seatMap,
  ]);

  const voteCounts = useMemo(() => {
    const counts = new Map<string, number>();
    Object.values(pub.mvpVotes).forEach((ownerId) => {
      counts.set(ownerId, (counts.get(ownerId) ?? 0) + 1);
    });
    return counts;
  }, [pub.mvpVotes]);

  const handleSaveBookPng = async (book: SketchBook) => {
    if (exporting) return;
    setExporting(true);
    try {
      const isWinner = Boolean(pub.winnerBookOwnerIds?.includes(book.ownerId));
      await exportSketchBookPng(book, seatMap, lang, isWinner);
    } finally {
      setExporting(false);
    }
  };

  const totalBooks = pub.totalBooks ?? room.seats.length;
  const totalBookEntries = pub.currentBookTotalEntries ?? pub.totalSteps;
  const currentEntryNum = Math.min(
    pub.exhibitionEntryIndex + 1,
    Math.max(1, totalBookEntries),
  );
  const isCurrentBookComplete =
    Boolean(pub.revealedBook) &&
    (pub.revealedBook?.entries.length ?? 0) >= totalBookEntries;
  const isAtVeryEndOfExhibition =
    pub.exhibitionBookIndex + 1 >= totalBooks &&
    currentEntryNum >= totalBookEntries;

  const activeGameOverBook =
    pub.allBooks?.[Math.min(selectedBookIdx, Math.max(0, (pub.allBooks?.length ?? 1) - 1))];

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-4 pb-24 sm:px-6">
      {/* Stage Header */}
      <div className="gold-border rounded-3xl bg-[#141727]/92 p-4 backdrop-blur-md sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold tracking-widest text-pink-400 uppercase">
              {lang === 'zh'
                ? `灵魂画手 · 第 ${Math.min(pub.step + 1, pub.totalSteps)}/${pub.totalSteps} 轮`
                : `Sketch Relay · Round ${Math.min(pub.step + 1, pub.totalSteps)}/${pub.totalSteps}`}
            </div>
            <h2 className="text-lg font-black text-white sm:text-2xl">
              {pub.phase === 'prompt'
                ? lang === 'zh'
                  ? '全员脑洞出题中...'
                  : 'Everyone Writes a Wacky Prompt...'
                : pub.phase === 'draw'
                  ? lang === 'zh'
                    ? '全员同步作画中！看谁画风最清奇'
                    : 'Simultaneous Sketching!'
                  : pub.phase === 'guess'
                    ? lang === 'zh'
                      ? '全员看画猜词中！'
                      : 'Guess That Drawing!'
                    : pub.phase === 'exhibition'
                      ? lang === 'zh'
                        ? '灵魂画展爆笑复盘大赏！'
                        : 'Grand Sketch Exhibition Finale!'
                      : lang === 'zh'
                        ? '最佳画册颁奖典礼'
                        : 'MVP Awards!'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {pub.phase !== 'exhibition' && pub.phase !== 'game_over' && (
              <span className="rounded-full border border-pink-400/40 bg-pink-500/20 px-3 py-1 text-xs font-bold text-pink-200">
                {pub.submittedIds.length} / {room.seats.length} ✓
              </span>
            )}
            {pub.phase === 'exhibition' && (
              <span className="rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-3 py-1 text-xs font-extrabold text-[#F3E09F]">
                {lang === 'zh'
                  ? `第 ${pub.exhibitionBookIndex + 1} / ${totalBooks} 本画册 · 第 ${currentEntryNum} / ${totalBookEntries} 幕`
                  : `Album ${pub.exhibitionBookIndex + 1} / ${totalBooks} · Frame ${currentEntryNum} / ${totalBookEntries}`}
              </span>
            )}
            <CountdownPill deadline={pub.phaseDeadline} paused={room.status === 'paused'} />
          </div>
        </div>

        {/* Simultaneous Progress Seats */}
        {pub.phase !== 'exhibition' && pub.phase !== 'game_over' && (
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            {room.seats.map((seat) => {
              const done = pub.submittedIds.includes(seat.id);
              return (
                <div
                  key={seat.id}
                  className={`flex flex-col items-center rounded-2xl border p-2.5 ${
                    done
                      ? 'border-emerald-400/50 bg-emerald-500/15'
                      : 'border-white/10 bg-black/25'
                  }`}
                >
                  <AvatarBadge
                    seat={seat}
                    size="sm"
                    isMe={seat.id === priv?.playerId}
                    subLabel={done ? '✓ Ready' : '...'}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Exhibition Stage Reveal */}
        {pub.phase === 'exhibition' && pub.revealedBook && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pink-400/40 bg-pink-500/10 px-4 py-3">
              <div className="space-y-1">
                <div className="text-sm font-black text-white">
                  {lang === 'zh'
                    ? `第 ${pub.exhibitionBookIndex + 1} 本画册 · 出题人：${seatMap.get(pub.revealedBook.ownerId)?.name ?? ''}`
                    : `Album #${pub.exhibitionBookIndex + 1} · Started by ${seatMap.get(pub.revealedBook.ownerId)?.name ?? ''}`}
                </div>
                <div className="text-xs font-bold text-pink-200/85">
                  {lang === 'zh'
                    ? `第 ${pub.exhibitionBookIndex + 1} / ${totalBooks} 本画册 · 第 ${currentEntryNum} / ${totalBookEntries} 幕`
                    : `Album ${pub.exhibitionBookIndex + 1} / ${totalBooks} · Frame ${currentEntryNum} / ${totalBookEntries}`}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isCurrentBookComplete && pub.revealedBook && (
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={() => handleSaveBookPng(pub.revealedBook!)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-xs font-extrabold text-emerald-200 hover:bg-emerald-500/35 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {lang === 'zh' ? '保存画册长图' : 'Save Album PNG'}
                  </button>
                )}

                {isHost && (
                  <>
                    <button
                      type="button"
                      disabled={
                        pub.exhibitionBookIndex === 0 && pub.exhibitionEntryIndex === 0
                      }
                      onClick={() => onAction({ type: 'exhibition_prev' })}
                      className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {lang === 'zh' ? '上一步' : 'Prev'}
                    </button>
                    <button
                      type="button"
                      disabled={isAtVeryEndOfExhibition}
                      onClick={() => onAction({ type: 'exhibition_next' })}
                      className="inline-flex items-center gap-1 rounded-xl bg-pink-500 px-3 py-1.5 text-xs font-black text-white disabled:opacity-40"
                    >
                      {isCurrentBookComplete && pub.exhibitionBookIndex + 1 < totalBooks
                        ? lang === 'zh'
                          ? '下一本画册'
                          : 'Next Album'
                        : lang === 'zh'
                          ? '揭晓下一幕'
                          : 'Reveal Next'}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'finish_exhibition' })}
                      className="rounded-xl bg-[#D4AF37] px-3 py-1.5 text-xs font-black text-[#0B0D13]"
                    >
                      {lang === 'zh' ? '结算 MVP 大奖' : 'Finish & Award MVP'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Host Quick Album Switcher */}
            {isHost && totalBooks > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {room.seats.slice(0, totalBooks).map((seat, idx) => {
                  const active = idx === pub.exhibitionBookIndex;
                  const votes = voteCounts.get(seat.id) ?? 0;
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      onClick={() =>
                        onAction({ type: 'exhibition_select_book', bookIndex: idx })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                        active
                          ? 'border-[#D4AF37] bg-[#D4AF37]/25 text-[#F3E09F]'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <span>#{idx + 1}</span>
                      <span>{seat.name}</span>
                      {votes > 0 && (
                        <span className="rounded-full bg-pink-500/30 px-1.5 text-[10px] text-pink-200">
                          ♥ {votes}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <SketchComicStrip
              entries={pub.revealedBook.entries}
              seatMap={seatMap}
              lang={lang}
              highlightLast
            />
          </div>
        )}

        {/* Game Over All Albums Browser */}
        {pub.phase === 'game_over' && (
          <div className="mt-5 space-y-5">
            <div className="rounded-2xl border border-[#D4AF37] bg-[#D4AF37]/15 p-5 text-center">
              <div className="flex flex-wrap items-center justify-center gap-2 text-xl font-black text-[#F3E09F]">
                <Award className="h-6 w-6" />
                <span>{lang === 'zh' ? '今晚爆笑灵魂画册 MVP：' : 'MVP Album Winner:'}</span>
                <span>
                  {pub.winnerBookOwnerIds
                    ?.map((id) => seatMap.get(id)?.name ?? id)
                    .join(' & ')}
                </span>
              </div>
              <p className="mt-1.5 text-xs font-medium text-amber-100/80">
                {lang === 'zh'
                  ? 'MVP 画册出题人 +3 分，每获得 1 票额外 +1 分！'
                  : '+3 pts to MVP album owners, plus +1 pt per vote received!'}
              </p>
              {isHost && (
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => onEmit('room:startGame')}
                    className="rounded-xl bg-[#D4AF37] px-5 py-2 text-xs font-extrabold text-[#0B0D13]"
                  >
                    {lang === 'zh' ? '再来一局' : 'Play Again'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEmit('room:returnToLobby')}
                    className="rounded-xl border border-white/20 bg-white/10 px-5 py-2 text-xs font-bold text-white"
                  >
                    {lang === 'zh' ? '返回大厅' : 'Lobby'}
                  </button>
                </div>
              )}
            </div>

            {pub.allBooks && pub.allBooks.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    {pub.allBooks.map((book, idx) => {
                      const owner = seatMap.get(book.ownerId);
                      const isWinner = Boolean(
                        pub.winnerBookOwnerIds?.includes(book.ownerId),
                      );
                      const votes = voteCounts.get(book.ownerId) ?? 0;
                      const active = idx === selectedBookIdx;
                      return (
                        <button
                          key={book.ownerId}
                          type="button"
                          onClick={() => setSelectedBookIdx(idx)}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                            active
                              ? 'border-[#D4AF37] bg-[#D4AF37] text-[#0B0D13] shadow-lg'
                              : isWinner
                                ? 'border-[#D4AF37]/50 bg-[#D4AF37]/15 text-[#F3E09F] hover:bg-[#D4AF37]/25'
                                : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                          }`}
                        >
                          {isWinner && <span>👑</span>}
                          <span>
                            #{idx + 1} {owner?.name ?? book.ownerId}
                          </span>
                          {votes > 0 && (
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                                active
                                  ? 'bg-black/20 text-[#0B0D13]'
                                  : 'bg-pink-500/25 text-pink-200'
                              }`}
                            >
                              {votes} {lang === 'zh' ? '票' : 'v'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {activeGameOverBook && (
                    <button
                      type="button"
                      disabled={exporting}
                      onClick={() => handleSaveBookPng(activeGameOverBook)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-500/20 px-3.5 py-2 text-xs font-extrabold text-emerald-200 hover:bg-emerald-500/35 disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      {lang === 'zh' ? '保存画册长图' : 'Save Album PNG'}
                    </button>
                  )}
                </div>

                {activeGameOverBook && (
                  <SketchComicStrip
                    entries={activeGameOverBook.entries}
                    seatMap={seatMap}
                    lang={lang}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Private Input / Drawing Canvas */}
      {!isTvMode && priv && (
        <div className="gold-border rounded-3xl bg-[#121724]/95 p-4 sm:p-6">
          {pub.phase === 'prompt' && (
            <div>
              {priv.hasSubmitted ? (
                <div className="py-6 text-center text-sm font-bold text-emerald-300">
                  <Check className="mx-auto mb-2 h-8 w-8" />
                  {lang === 'zh' ? '题目已提交，等待其他画手...' : 'Prompt locked! Waiting...'}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-pink-300">
                      <Sparkles className="h-4 w-4" />
                      {lang === 'zh'
                        ? '输入一个离谱好玩的画面描述，或直接选用下方推荐题卡：'
                        : 'Write a funny prompt or tap a preset below:'}
                    </div>
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'refresh_prompts' })}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-3 py-1.5 text-xs font-extrabold text-[#F3E09F] hover:bg-[#D4AF37]/25"
                    >
                      {lang === 'zh' ? '🎲 换一批题卡' : '🎲 Shuffle Prompts'}
                    </button>
                  </div>
                  {priv.promptChoices && (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {priv.promptChoices.map((pc, i) => (
                        <button
                          key={`${pc.zh}-${i}`}
                          type="button"
                          onClick={() => onAction({ type: 'submit_prompt', text: pick(pc) })}
                          className="animate-card-deal rounded-xl border border-pink-400/35 bg-pink-500/15 p-3 text-left text-xs font-bold text-white hover:bg-pink-500/30"
                        >
                          {pick(pc)}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={50}
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === 'Enter' &&
                          textInput.trim() &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          onAction({ type: 'submit_prompt', text: textInput });
                        }
                      }}
                      placeholder={lang === 'zh' ? '自定义脑洞题目...' : 'Custom prompt...'}
                      className="flex-1 rounded-xl border border-white/15 bg-[#0B0D13] px-3.5 py-2.5 text-sm text-white"
                    />
                    <button
                      type="button"
                      disabled={!textInput.trim()}
                      onClick={() => onAction({ type: 'submit_prompt', text: textInput })}
                      className="rounded-xl bg-pink-500 px-5 py-2.5 text-sm font-black text-white disabled:opacity-40"
                    >
                      {lang === 'zh' ? '发送' : 'Send'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {pub.phase === 'draw' && (
            <div>
              {priv.hasSubmitted ? (
                <div className="py-8 text-center text-sm font-bold text-emerald-300">
                  <Check className="mx-auto mb-2 h-8 w-8" />
                  {lang === 'zh' ? '画作已传给下一位！等待全员交卷...' : 'Sketch passed! Waiting...'}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-pink-400/40 bg-pink-500/15 p-3 text-center">
                    <div className="text-[11px] font-bold text-pink-300 uppercase">
                      <Brush className="mr-1 inline h-3.5 w-3.5" />
                      {lang === 'zh' ? '请画出这个题目：' : 'Draw This Prompt:'}
                    </div>
                    <div className="mt-1 text-lg font-black text-white">
                      “{priv.previousEntry?.text ?? ''}”
                    </div>
                  </div>
                  <DrawingCanvas
                    deadline={room.status === 'paused' ? undefined : pub.phaseDeadline}
                    onSubmit={(imageDataUrl) =>
                      onAction({ type: 'submit_drawing', imageDataUrl })
                    }
                  />
                </div>
              )}
            </div>
          )}

          {pub.phase === 'guess' && (
            <div>
              {priv.hasSubmitted ? (
                <div className="py-8 text-center text-sm font-bold text-emerald-300">
                  <Check className="mx-auto mb-2 h-8 w-8" />
                  {lang === 'zh' ? '猜测已提交，等待其他玩家...' : 'Guess submitted!'}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center text-sm font-bold text-amber-300">
                    {lang === 'zh'
                      ? '上家画了什么鬼？！快猜猜看：'
                      : 'What on earth did they draw? Take a guess!'}
                  </div>
                  {priv.previousEntry?.imageDataUrl && (
                    <img
                      src={priv.previousEntry.imageDataUrl}
                      alt="To Guess"
                      className="mx-auto aspect-[4/3] max-h-80 rounded-2xl border-2 border-[#D4AF37]/40 bg-[#FFFDF7] object-contain"
                    />
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={50}
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === 'Enter' &&
                          textInput.trim() &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          onAction({ type: 'submit_guess', text: textInput });
                        }
                      }}
                      placeholder={lang === 'zh' ? '写下你的猜测...' : 'Your guess...'}
                      className="flex-1 rounded-xl border border-white/15 bg-[#0B0D13] px-3.5 py-3 text-sm text-white"
                    />
                    <button
                      type="button"
                      disabled={!textInput.trim()}
                      onClick={() => onAction({ type: 'submit_guess', text: textInput })}
                      className="rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-black text-[#0B0D13] disabled:opacity-40"
                    >
                      {lang === 'zh' ? '提交猜测' : 'Submit'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {pub.phase === 'exhibition' && pub.revealedBook && (
            <div className="space-y-2.5 text-center">
              <div className="text-xs font-bold text-slate-300">
                {lang === 'zh'
                  ? '觉得哪本画册最搞笑？给它投出 MVP 一票！'
                  : 'Vote for the funniest album as MVP!'}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {room.seats.map((s) => {
                  const votes = voteCounts.get(s.id) ?? 0;
                  const voted = pub.mvpVotes[priv.playerId] === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onAction({ type: 'vote_mvp', ownerId: s.id })}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                        voted
                          ? 'border-[#D4AF37] bg-[#D4AF37] text-[#0B0D13]'
                          : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      <span>🎭 {s.name}</span>
                      {votes > 0 && (
                        <span
                          className={`rounded-full px-1.5 text-[10px] ${
                            voted
                              ? 'bg-black/20 text-[#0B0D13]'
                              : 'bg-pink-500/25 text-pink-200'
                          }`}
                        >
                          {votes}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
