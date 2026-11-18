import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Brush,
  Circle,
  Eraser,
  Minus,
  PaintBucket,
  Redo2,
  Square,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';

const PALETTE = [
  '#111827',
  '#EF4444',
  '#F97316',
  '#FACC15',
  '#22C55E',
  '#06B6D4',
  '#3B82F6',
  '#A855F7',
  '#EC4899',
  '#92400E',
  '#9CA3AF',
  '#FFFFFF',
];

const BRUSH_SIZES = [4, 9, 16, 28];

type DrawTool = 'brush' | 'line' | 'rect' | 'circle' | 'fill' | 'eraser';

interface Point {
  x: number;
  y: number;
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b, 255];
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  tool: 'line' | 'rect' | 'circle',
  start: Point,
  end: Point,
  strokeColor: string,
  lineWidth: number,
) {
  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  if (tool === 'line') {
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  } else if (tool === 'rect') {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    ctx.strokeRect(x, y, w, h);
  } else {
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.max(1, Math.abs(end.x - start.x) / 2);
    const ry = Math.max(1, Math.abs(end.y - start.y) / 2);
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

export const DrawingCanvas: React.FC<{
  onSubmit: (dataUrl: string) => void;
  disabled?: boolean;
  deadline?: number;
}> = ({ onSubmit, disabled, deadline }) => {
  const { lang } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const pointsRef = useRef<Point[]>([]);
  const lastMidRef = useRef<Point | null>(null);
  const shapeStartRef = useRef<Point | null>(null);
  const shapeSnapshotRef = useRef<ImageData | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);
  const redoStackRef = useRef<ImageData[]>([]);
  const hasDrawnRef = useRef(false);
  const submittedRef = useRef(false);
  const disabledRef = useRef(Boolean(disabled));
  const onSubmitRef = useRef(onSubmit);

  const [color, setColor] = useState('#111827');
  const [size, setSize] = useState(9);
  const [tool, setTool] = useState<DrawTool>('brush');
  const [historyCounts, setHistoryCounts] = useState({ undo: 0, redo: 0 });

  useEffect(() => {
    disabledRef.current = Boolean(disabled);
  }, [disabled]);

  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.fillStyle = '#FFFDF7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    undoStackRef.current = [];
    redoStackRef.current = [];
    hasDrawnRef.current = false;
    submittedRef.current = false;
    setHistoryCounts({ undo: 0, redo: 0 });
  }, []);

  const syncHistoryCounts = () => {
    setHistoryCounts({
      undo: undoStackRef.current.length,
      redo: redoStackRef.current.length,
    });
  };

  const pushHistoryBeforeEdit = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStackRef.current = [...undoStackRef.current.slice(-19), snap];
    redoStackRef.current = [];
    syncHistoryCounts();
  };

  const getCoords = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const floodFill = (startX: number, startY: number, fillHex: string): boolean => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return false;

    const w = canvas.width;
    const h = canvas.height;
    const x0 = Math.max(0, Math.min(w - 1, Math.floor(startX)));
    const y0 = Math.max(0, Math.min(h - 1, Math.floor(startY)));
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    const idx0 = (y0 * w + x0) * 4;
    const sr = data[idx0];
    const sg = data[idx0 + 1];
    const sb = data[idx0 + 2];
    const [fr, fg, fb, fa] = hexToRgba(fillHex);

    if (Math.abs(sr - fr) < 8 && Math.abs(sg - fg) < 8 && Math.abs(sb - fb) < 8) {
      return false;
    }

    pushHistoryBeforeEdit();

    const visited = new Uint8Array(w * h);
    const stack = [x0, y0];
    const tol = 32;

    while (stack.length > 0) {
      const y = stack.pop()!;
      const x = stack.pop()!;
      const pos = y * w + x;
      if (visited[pos]) continue;
      const p = pos * 4;
      if (
        Math.abs(data[p] - sr) > tol ||
        Math.abs(data[p + 1] - sg) > tol ||
        Math.abs(data[p + 2] - sb) > tol
      ) {
        continue;
      }
      visited[pos] = 1;
      data[p] = fr;
      data[p + 1] = fg;
      data[p + 2] = fb;
      data[p + 3] = fa;
      if (x > 0) stack.push(x - 1, y);
      if (x < w - 1) stack.push(x + 1, y);
      if (y > 0) stack.push(x, y - 1);
      if (y < h - 1) stack.push(x, y + 1);
    }
    ctx.putImageData(img, 0, 0);
    return true;
  };

  const handleExport = useCallback(() => {
    if (submittedRef.current || disabledRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    submittedRef.current = true;
    let url = canvas.toDataURL('image/webp', 0.78);
    if (!url.startsWith('data:image/webp')) {
      url = canvas.toDataURL('image/png');
    }
    onSubmitRef.current(url);
  }, []);

  useEffect(() => {
    if (!deadline || disabled) return;
    const checkDeadline = () => {
      if (
        deadline - Date.now() <= 1500 &&
        hasDrawnRef.current &&
        !submittedRef.current &&
        !disabledRef.current
      ) {
        handleExport();
      }
    };
    checkDeadline();
    const timer = window.setInterval(checkDeadline, 250);
    return () => window.clearInterval(timer);
  }, [deadline, disabled, handleExport]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || submittedRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getCoords(e);

    if (tool === 'fill') {
      if (floodFill(pt.x, pt.y, color)) {
        hasDrawnRef.current = true;
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;

    if (tool === 'line' || tool === 'rect' || tool === 'circle') {
      pushHistoryBeforeEdit();
      shapeStartRef.current = pt;
      shapeSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      drawingRef.current = true;
      hasDrawnRef.current = true;
      return;
    }

    pushHistoryBeforeEdit();
    drawingRef.current = true;
    hasDrawnRef.current = true;
    pointsRef.current = [pt];
    lastMidRef.current = null;

    const strokeWidth = tool === 'eraser' ? size * 1.4 : size;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, strokeWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = tool === 'eraser' ? '#FFFDF7' : color;
    ctx.fill();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled || submittedRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;
    const pt = getCoords(e);

    if (tool === 'line' || tool === 'rect' || tool === 'circle') {
      if (!shapeStartRef.current || !shapeSnapshotRef.current) return;
      ctx.putImageData(shapeSnapshotRef.current, 0, 0);
      drawShape(ctx, tool, shapeStartRef.current, pt, color, size);
      return;
    }

    const pts = pointsRef.current;
    const last = pts[pts.length - 1];
    if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 1.2) return;

    pts.push(pt);
    ctx.strokeStyle = tool === 'eraser' ? '#FFFDF7' : color;
    ctx.lineWidth = tool === 'eraser' ? size * 1.4 : size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (pts.length === 2) {
      const prevPt = pts[0];
      const currPt = pts[1];
      const mid = midpoint(prevPt, currPt);
      ctx.beginPath();
      ctx.moveTo(prevPt.x, prevPt.y);
      ctx.lineTo(mid.x, mid.y);
      ctx.stroke();
      lastMidRef.current = mid;
      return;
    }

    if (pts.length >= 3) {
      const prevPt = pts[pts.length - 3];
      const currPt = pts[pts.length - 2];
      const nextPt = pts[pts.length - 1];
      const mid1 = lastMidRef.current ?? midpoint(prevPt, currPt);
      const mid2 = midpoint(currPt, nextPt);

      ctx.beginPath();
      ctx.moveTo(mid1.x, mid1.y);
      ctx.quadraticCurveTo(currPt.x, currPt.y, mid2.x, mid2.y);
      ctx.stroke();
      lastMidRef.current = mid2;
    }
  };

  const finishStroke = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });

    if (ctx && (tool === 'line' || tool === 'rect' || tool === 'circle')) {
      if (shapeStartRef.current && shapeSnapshotRef.current && e) {
        const pt = getCoords(e);
        ctx.putImageData(shapeSnapshotRef.current, 0, 0);
        drawShape(ctx, tool, shapeStartRef.current, pt, color, size);
      }
      shapeStartRef.current = null;
      shapeSnapshotRef.current = null;
      drawingRef.current = false;
      return;
    }

    if (ctx && pointsRef.current.length >= 2 && lastMidRef.current) {
      const lastPt = pointsRef.current[pointsRef.current.length - 1];
      ctx.strokeStyle = tool === 'eraser' ? '#FFFDF7' : color;
      ctx.lineWidth = tool === 'eraser' ? size * 1.4 : size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lastMidRef.current.x, lastMidRef.current.y);
      ctx.lineTo(lastPt.x, lastPt.y);
      ctx.stroke();
    }

    drawingRef.current = false;
    pointsRef.current = [];
    lastMidRef.current = null;
  };

  const handleUndo = () => {
    if (disabled || submittedRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx || undoStackRef.current.length === 0) return;

    const currentSnap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    redoStackRef.current = [...redoStackRef.current.slice(-19), currentSnap];
    const previousSnap = undoStackRef.current.pop()!;
    ctx.putImageData(previousSnap, 0, 0);
    syncHistoryCounts();
  };

  const handleRedo = () => {
    if (disabled || submittedRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx || redoStackRef.current.length === 0) return;

    const currentSnap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStackRef.current = [...undoStackRef.current.slice(-19), currentSnap];
    const nextSnap = redoStackRef.current.pop()!;
    ctx.putImageData(nextSnap, 0, 0);
    syncHistoryCounts();
  };

  const handleClear = () => {
    if (disabled || submittedRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;
    pushHistoryBeforeEdit();
    ctx.fillStyle = '#FFFDF7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const toolItems: Array<{
    id: DrawTool;
    zh: string;
    en: string;
    icon: React.ReactNode;
    activeClass?: string;
  }> = [
    {
      id: 'brush',
      zh: '画笔',
      en: 'Brush',
      icon: <Brush className="h-3.5 w-3.5" />,
    },
    {
      id: 'line',
      zh: '直线',
      en: 'Line',
      icon: <Minus className="h-3.5 w-3.5 -rotate-45" />,
    },
    {
      id: 'rect',
      zh: '方框',
      en: 'Rect',
      icon: <Square className="h-3.5 w-3.5" />,
    },
    {
      id: 'circle',
      zh: '圆圈',
      en: 'Circle',
      icon: <Circle className="h-3.5 w-3.5" />,
    },
    {
      id: 'fill',
      zh: '油漆桶',
      en: 'Fill',
      icon: <PaintBucket className="h-3.5 w-3.5" />,
    },
    {
      id: 'eraser',
      zh: '橡皮',
      en: 'Eraser',
      icon: <Eraser className="h-3.5 w-3.5" />,
      activeClass: 'bg-pink-500 text-white border-pink-400',
    },
  ];

  return (
    <div className="space-y-3">
      {/* Studio Toolbar */}
      <div className="space-y-2.5 rounded-2xl border border-white/10 bg-black/35 p-2.5 sm:p-3">
        {/* Palette & Brush Size */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => {
                  setColor(c);
                  if (tool === 'eraser') setTool('brush');
                }}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${
                  color === c && tool !== 'eraser'
                    ? 'scale-115 border-[#D4AF37] ring-2 ring-[#D4AF37]/40'
                    : 'border-white/30'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {BRUSH_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                aria-label={`Size ${s}`}
                onClick={() => setSize(s)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                  size === s
                    ? 'border-[#D4AF37] bg-[#D4AF37]/20'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <span
                  className="rounded-full bg-white"
                  style={{ width: Math.min(20, s), height: Math.min(20, s) }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Drawing Modes & History */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-white/10 pt-2">
          <div className="flex flex-wrap items-center gap-1">
            {toolItems.map((item) => {
              const active = tool === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={lang === 'zh' ? item.zh : item.en}
                  onClick={() => setTool(item.id)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-colors ${
                    active
                      ? item.activeClass ?? 'border-[#D4AF37] bg-[#D4AF37] text-[#0B0D13]'
                      : 'border-white/10 bg-white/10 text-slate-200 hover:bg-white/15'
                  }`}
                >
                  {item.icon}
                  <span>{lang === 'zh' ? item.zh : item.en}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              title={lang === 'zh' ? '撤销' : 'Undo'}
              disabled={disabled || historyCounts.undo === 0}
              onClick={handleUndo}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-white/20 disabled:opacity-35"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span>{lang === 'zh' ? '撤销' : 'Undo'}</span>
            </button>
            <button
              type="button"
              title={lang === 'zh' ? '重做' : 'Redo'}
              disabled={disabled || historyCounts.redo === 0}
              onClick={handleRedo}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-white/20 disabled:opacity-35"
            >
              <Redo2 className="h-3.5 w-3.5" />
              <span>{lang === 'zh' ? '重做' : 'Redo'}</span>
            </button>
            <button
              type="button"
              title={lang === 'zh' ? '清空' : 'Clear'}
              disabled={disabled}
              onClick={handleClear}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-400/20 bg-rose-500/20 px-2 py-1.5 text-[11px] font-bold text-rose-200 hover:bg-rose-500/35 disabled:opacity-35"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{lang === 'zh' ? '清空' : 'Clear'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Touch-locked Canvas */}
      <div className="mx-auto w-full max-w-[560px] overflow-hidden rounded-2xl border-2 border-[#D4AF37]/40 bg-[#FFFDF7] shadow-xl">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={() => finishStroke()}
          className="block aspect-[4/3] w-full cursor-crosshair touch-none"
        />
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={handleExport}
        className="min-h-[48px] w-full rounded-xl bg-gradient-to-r from-pink-500 to-amber-400 py-3 text-sm font-black text-slate-950 shadow-lg hover:brightness-105 disabled:opacity-40"
      >
        {lang === 'zh' ? '提交我的灵魂大作！' : 'Submit My Masterpiece!'}
      </button>
    </div>
  );
};
