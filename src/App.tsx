import { ChangeEvent, DragEvent, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { findRepairSuggestions, RepairSuggestion } from './repairs';
import { drawCell, RenderStyle } from './rendering';
import { paintShape, SHAPES, ShapeId } from './shapes';
import { quantizeRgba } from './imageProcessing';
import { ColorWheel } from './ColorWheel';

type Tool = 'pencil' | 'eraser' | 'fill';
type RepairLogEntry = { id: string; x: number; y: number; before: number; after: number; beforeHex: string; afterHex: string; reason: string; status: 'applied' | 'undone'; createdAt: string };
type Artwork = { id: string; name: string; size: number; pixels: number[]; palette: string[]; renderStyle?: RenderStyle; repairLog?: RepairLogEntry[]; updatedAt: string };
type Snapshot = { size: number; pixels: number[]; palette: string[]; selected: number; repairId?: string };
const COLORS = [
  '#111827','#374151','#6B7280','#B8C0CC','#F8FAFC','#FFFFFF',
  '#7F1D1D','#DC2626','#F97316','#F59E0B','#FDE047','#FEF3C7',
  '#14532D','#16A34A','#84CC16','#A7F3D0','#0F766E','#22D3EE',
  '#1D4ED8','#6366F1','#8B5CF6','#D946EF','#EC4899','#FDA4AF',
];
const LATTE_COLORS = [
  '#303030', '#4A342D', '#A8612D', '#D08A4E', '#EEECEE', '#FFFFFF',
  '#F7F5F4', '#C7C5C5', '#8B8988', '#F0C28D', '#6F3D20', '#E6AD68',
];
const blank = (size: number) => Array.from({ length: size * size }, () => -1);
const starterArt = (size: number) => {
  const art = blank(size);
  const put = (x: number, y: number, color: number) => {
    if (x >= 0 && x < size && y >= 0 && y < size) art[y * size + x] = color;
  };
  const rect = (x1: number, y1: number, x2: number, y2: number, color: number) => {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) put(x, y, color);
  };
  // Minimal steaming coffee cup matching the supplied pixel-art reference.
  // Three steam wisps.
  rect(10, 8, 11, 9, 0); put(9, 10, 0);
  rect(14, 8, 15, 9, 0); put(13, 10, 0);
  rect(18, 8, 19, 9, 0); put(17, 10, 0);
  // Mug rim, dark coffee surface, and warm band.
  rect(7, 12, 21, 12, 0); rect(7, 13, 21, 13, 0);
  rect(8, 13, 20, 14, 2); rect(8, 14, 20, 14, 3);
  // White mug body, outlined with chunky dark pixels.
  rect(7, 14, 8, 22, 0); rect(20, 14, 21, 22, 0);
  rect(9, 15, 19, 21, 5); rect(9, 22, 19, 23, 4);
  rect(19, 15, 19, 21, 7);
  // Square handle on the right, with a white opening.
  rect(21, 15, 24, 16, 0); rect(23, 16, 24, 20, 0);
  rect(21, 20, 24, 21, 0); rect(22, 17, 22, 19, 5);
  // Thick foot and saucer.
  rect(7, 23, 21, 23, 0); rect(8, 24, 20, 24, 0);
  rect(9, 25, 19, 25, 0); rect(10, 24, 18, 24, 4);
  return art;
};
const isArtwork = (value: unknown): value is Artwork => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Artwork>;
  return typeof item.id === 'string' && typeof item.name === 'string'
    && Number.isInteger(item.size) && (item.size as number) >= 8 && (item.size as number) <= 64
    && Array.isArray(item.palette) && item.palette.length > 0 && item.palette.length <= 256 && item.palette.every(color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))
    && Array.isArray(item.pixels) && item.pixels.length === (item.size as number) ** 2
    && item.pixels.every(color => Number.isInteger(color) && color >= -1 && color < (item.palette as string[]).length)
    && (item.renderStyle === undefined || item.renderStyle === 'pixel' || item.renderStyle === 'crochet' || item.renderStyle === 'beads')
    && (item.repairLog === undefined || (Array.isArray(item.repairLog) && item.repairLog.every(entry => Boolean(
      entry && typeof entry.id === 'string' && typeof entry.reason === 'string'
      && Number.isInteger(entry.x) && Number.isInteger(entry.y) && entry.x >= 0 && entry.x < (item.size as number) && entry.y >= 0 && entry.y < (item.size as number)
      && typeof entry.beforeHex === 'string' && typeof entry.afterHex === 'string'
      && (entry.status === 'applied' || entry.status === 'undone'),
    ))));
};
const readArtworks = (): Artwork[] => {
  try {
    const saved = localStorage.getItem('dotmatrix:artworks') || localStorage.getItem('pixelmind:artworks');
    if (saved) {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter(isArtwork) : [];
    }
    const previous = JSON.parse(localStorage.getItem('pixelmind:projects') || '[]');
    return Array.isArray(previous) ? previous.map(item => ({ ...item, id: typeof item?.id === 'string' && item.id ? item.id : crypto.randomUUID() })).filter(isArtwork) : [];
  }
  catch { return []; }
};

function ArtworkThumb({ artwork }: { artwork: Artwork }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const style = artwork.renderStyle || 'pixel';
  const cell = style === 'pixel' ? 1 : 12;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, artwork.size * cell, artwork.size * cell);
    artwork.pixels.forEach((color, i) => {
      if (color >= 0) {
        drawCell(ctx, artwork.palette[color] || '#000000', (i % artwork.size) * cell, Math.floor(i / artwork.size) * cell, cell, style);
      }
    });
  }, [artwork, cell, style]);
  return <canvas ref={ref} width={artwork.size * cell} height={artwork.size * cell} />;
}

export default function App() {
  const [view, setView] = useState<'editor' | 'collection'>('editor');
  const [size, setSize] = useState(32);
  const [pixels, setPixels] = useState(() => starterArt(32));
  const [palette, setPalette] = useState(LATTE_COLORS);
  const [selected, setSelected] = useState(2);
  const [renderStyle, setRenderStyle] = useState<RenderStyle>('pixel');
  const [colorDraft, setColorDraft] = useState('#22D3EE');
  const [tool, setTool] = useState<Tool>('pencil');
  const [shapeSpan, setShapeSpan] = useState(12);
  const [pendingShape, setPendingShape] = useState<ShapeId | null>(null);
  const [zoom, setZoom] = useState(18);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiError, setAiError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('Coffee Cup');
  const [nameEditing, setNameEditing] = useState(false);
  const [artworks, setArtworks] = useState<Artwork[]>(readArtworks);
  const [activeId, setActiveId] = useState('');
  const [repairLog, setRepairLog] = useState<RepairLogEntry[]>([]);
  const [repairOpen, setRepairOpen] = useState(false);
  const [dismissedRepairs, setDismissedRepairs] = useState<string[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const changed = useRef(false);
  const conversionApiAvailable = useRef<boolean | null>(null);
  const strokeStart = useRef<Snapshot>({ size: 32, pixels: [], palette: COLORS, selected: 7 });
  const fileRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const previousNameRef = useRef(name);

  useEffect(() => {
    if (nameEditing) nameInputRef.current?.focus();
  }, [nameEditing]);

  const finishNameEdit = () => {
    setName(current => current.trim() || 'Coffee Cup');
    setNameEditing(false);
  };

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const color = pixels[y * size + x];
      if (color >= 0) drawCell(ctx, palette[color] || '#000000', x * zoom, y * zoom, zoom, renderStyle);
    }
    if (renderStyle === 'pixel') {
      ctx.strokeStyle = 'rgba(255,255,255,.10)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= size; i++) {
        ctx.beginPath(); ctx.moveTo(i * zoom + .5, 0); ctx.lineTo(i * zoom + .5, size * zoom); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * zoom + .5); ctx.lineTo(size * zoom, i * zoom + .5); ctx.stroke();
      }
    }
  }, [pixels, size, zoom, palette, renderStyle]);
  useEffect(() => {
    try { localStorage.setItem('dotmatrix:artworks', JSON.stringify(artworks)); }
    catch { setNotice('Browser storage is full. Export artwork or delete collection items to free space.'); }
  }, [artworks]);
  useEffect(() => { setColorDraft(palette[selected] || '#FFFFFF'); }, [palette, selected]);

  const repairSuggestions = useMemo(() => findRepairSuggestions(pixels, size).filter(item => !dismissedRepairs.includes(item.id)), [pixels, size, dismissedRepairs]);
  const validColorDraft = /^#[0-9a-f]{6}$/i.test(colorDraft);

  const commit = (next: number[]) => { setHistory(h => [...h, { size, pixels, palette: [...palette], selected }].slice(-100)); setFuture([]); setPixels(next); };
  const commitPalette = (nextPalette: string[]) => {
    setHistory(h => [...h, { size, pixels: [...pixels], palette: [...palette], selected }].slice(-100));
    setFuture([]); setPalette(nextPalette);
  };
  const resetPalette = () => {
    const remapped = pixels.map(index => {
      if (index < 0) return -1;
      const hex = palette[index] || '#000000';
      const rgb = [1, 3, 5].map(position => parseInt(hex.slice(position, position + 2), 16));
      let bestIndex = 0, bestDistance = Infinity;
      COLORS.forEach((candidate, candidateIndex) => {
        const candidateRgb = [1, 3, 5].map(position => parseInt(candidate.slice(position, position + 2), 16));
        const distance = (rgb[0] - candidateRgb[0]) ** 2 + (rgb[1] - candidateRgb[1]) ** 2 + (rgb[2] - candidateRgb[2]) ** 2;
        if (distance < bestDistance) { bestDistance = distance; bestIndex = candidateIndex; }
      });
      return bestIndex;
    });
    setHistory(h => [...h, { size, pixels: [...pixels], palette: [...palette], selected }].slice(-100));
    setFuture([]); setPixels(remapped); setPalette(LATTE_COLORS); setSelected(2);
  };
  const paint = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) * size / r.width), y = Math.floor((e.clientY - r.top) * size / r.height);
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const index = y * size + x;
    if (tool === 'fill') {
      const old = pixels[index], next = [...pixels];
      if (old === selected) return;
      const queue = [index];
      while (queue.length) {
        const at = queue.pop()!;
        if (next[at] !== old) continue;
        next[at] = selected;
        const ax = at % size, ay = Math.floor(at / size);
        if (ax) queue.push(at - 1); if (ax < size - 1) queue.push(at + 1);
        if (ay) queue.push(at - size); if (ay < size - 1) queue.push(at + size);
      }
      commit(next);
      return;
    }
    const next = [...pixels];
    next[index] = tool === 'eraser' ? -1 : selected;
    setPixels(next);
    changed.current = true;
  };
  const placeShape = (shape: ShapeId, clientX: number, clientY: number, element: HTMLCanvasElement) => {
    const rect = element.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) * size / rect.width), y = Math.floor((clientY - rect.top) * size / rect.height);
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    commit(paintShape(pixels, size, shape, x, y, selected, shapeSpan));
    setPendingShape(null);
  };
  const pointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (pendingShape) { placeShape(pendingShape, e.clientX, e.clientY, e.currentTarget); return; }
    drawing.current = true;
    changed.current = false;
    strokeStart.current = { size, pixels: [...pixels], palette: [...palette], selected };
    e.currentTarget.setPointerCapture(e.pointerId);
    paint(e);
  };
  const pointerMove = (e: PointerEvent<HTMLCanvasElement>) => { if (drawing.current && tool !== 'fill') paint(e); };
  const pointerUp = () => {
    drawing.current = false;
    if (changed.current) { setHistory(h => [...h, strokeStart.current].slice(-100)); setFuture([]); changed.current = false; }
  };
  const dropShape = (e: DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const shape = e.dataTransfer.getData('application/x-dotmatrix-shape') as ShapeId;
    if (SHAPES.some(item => item.id === shape)) placeShape(shape, e.clientX, e.clientY, e.currentTarget);
  };
  const resize = (nextSize: number) => {
    if (nextSize === size) return;
    setHistory(h => [...h, { size, pixels, palette: [...palette], selected }]); setFuture([]); setPixels(blank(nextSize)); setSize(nextSize);
  };
  const undo = () => {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setFuture(f => [{ size, pixels, palette: [...palette], selected, repairId: previous.repairId }, ...f]);
    if (previous.repairId) setRepairLog(log => log.map(entry => entry.id === previous.repairId ? { ...entry, status: 'undone' } : entry));
    setPixels(previous.pixels); setPalette(previous.palette); setSelected(previous.selected); setSize(previous.size); setHistory(history.slice(0, -1));
  };
  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setHistory(h => [...h, { size, pixels, palette: [...palette], selected, repairId: next.repairId }]);
    if (next.repairId) setRepairLog(log => log.map(entry => entry.id === next.repairId ? { ...entry, status: 'applied' } : entry));
    setPixels(next.pixels); setPalette(next.palette); setSelected(next.selected); setSize(next.size); setFuture(future.slice(1));
  };
  const applyRepair = (suggestion: RepairSuggestion) => {
    if (pixels[suggestion.index] !== suggestion.before) return;
    const id = crypto.randomUUID(), next = [...pixels];
    next[suggestion.index] = suggestion.after;
    setHistory(h => [...h, { size, pixels, palette: [...palette], selected, repairId: id }].slice(-100));
    setFuture([]); setPixels(next);
    setRepairLog(log => [{ id, x: suggestion.x, y: suggestion.y, before: suggestion.before, after: suggestion.after, beforeHex: palette[suggestion.before] || '#000000', afterHex: suggestion.after < 0 ? 'transparent' : palette[suggestion.after] || '#000000', reason: suggestion.reason, status: 'applied' as const, createdAt: new Date().toISOString() }, ...log].slice(0, 50));
  };
  const addColor = () => {
    if (!/^#[0-9a-f]{6}$/i.test(colorDraft)) { setNotice('Enter a valid six-digit hex color.'); return; }
    const color = colorDraft.toUpperCase();
    const existing = palette.indexOf(color);
    if (existing >= 0) setSelected(existing);
    else if (palette.length >= 256) {
      commitPalette(palette.map((entry, index) => index === selected ? color : entry));
      setNotice('Palette full: replaced the selected swatch with your new shade.');
    }
    else { commitPalette([...palette, color]); setSelected(palette.length); }
  };
  const updateSelectedColor = () => {
    if (!/^#[0-9a-f]{6}$/i.test(colorDraft)) { setNotice('Enter a valid six-digit hex color.'); return; }
    const color = colorDraft.toUpperCase();
    if (palette[selected] !== color) commitPalette(palette.map((entry, index) => index === selected ? color : entry));
  };
  const exportPng = () => {
    const cell = renderStyle === 'pixel' ? 1 : 12;
    const out = document.createElement('canvas'); out.width = size * cell; out.height = size * cell;
    const ctx = out.getContext('2d')!;
    pixels.forEach((color, i) => {
      if (color >= 0) drawCell(ctx, palette[color] || '#000000', (i % size) * cell, Math.floor(i / size) * cell, cell, renderStyle);
    });
    const link = document.createElement('a');
    link.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${size}x${size}-${renderStyle}.png`;
    link.href = out.toDataURL('image/png'); link.click();
  };
  const saveToCollection = () => {
    const title = prompt('Name this artwork', name);
    if (title === null) return;
    const artwork: Artwork = { id: crypto.randomUUID(), name: title.trim() || 'Untitled artwork', size, pixels: [...pixels], palette: [...palette], renderStyle, repairLog: [...repairLog], updatedAt: new Date().toISOString() };
    setArtworks(items => [artwork, ...items]);
    setActiveId(artwork.id); setName(artwork.name); setNotice('Saved to your art collection.'); setView('collection');
  };
  const loadArtwork = (artwork: Artwork) => {
    setActiveId(artwork.id); setName(artwork.name); setSize(artwork.size); setPixels([...artwork.pixels]);
    setPalette([...artwork.palette]); setSelected(Math.min(7, artwork.palette.length - 1)); setRenderStyle(artwork.renderStyle || 'pixel'); setRepairLog(artwork.repairLog || []); setHistory([]); setFuture([]); setNotice(''); setView('editor');
  };
  const deleteArtwork = (id: string) => {
    setArtworks(items => items.filter(item => item.id !== id));
    if (activeId === id) setActiveId('');
  };
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setNotice('Choose an image smaller than 10 MB.'); e.target.value = ''; return; }
    const importSize = Math.max(size, 64);
    setBusy(true);
    try {
      let data: { palette: string[]; pixels: number[][] } | undefined;
      if (conversionApiAvailable.current !== false) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 1200);
        try {
        const form = new FormData(); form.append('file', file); form.append('size', String(importSize)); form.append('colors', '64');
        const response = await fetch('/api/convert', { method: 'POST', body: form, signal: controller.signal });
        if (!response.ok) throw new Error('API unavailable');
        data = await response.json();
        conversionApiAvailable.current = true;
        } catch {
          conversionApiAvailable.current = false;
        } finally {
          window.clearTimeout(timeout);
        }
      }
      if (!data) {
        data = await new Promise((resolve, reject) => {
          const url = URL.createObjectURL(file), image = new Image();
          image.onload = () => {
            try {
              if (image.width * image.height > 40_000_000) throw new Error('Image dimensions are too large.');
              const c = document.createElement('canvas'); c.width = importSize; c.height = importSize;
              const ctx = c.getContext('2d'); if (!ctx) throw new Error('Canvas is unavailable.');
              const scale = Math.min(importSize / image.width, importSize / image.height);
              const width = Math.max(1, Math.round(image.width * scale)), height = Math.max(1, Math.round(image.height * scale));
              ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(image, Math.floor((importSize - width) / 2), Math.floor((importSize - height) / 2), width, height);
              const converted = quantizeRgba(ctx.getImageData(0, 0, importSize, importSize).data, 64);
              resolve({ palette: converted.palette, pixels: Array.from({ length: importSize }, (_, y) => converted.pixels.slice(y * importSize, (y + 1) * importSize)) });
            } catch (error) { reject(error); }
            finally { URL.revokeObjectURL(url); }
          };
          image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not open this image.')); };
          image.src = url;
        });
      }
      const convertedData = data;
      if (!convertedData || !Array.isArray(convertedData.palette) || !Array.isArray(convertedData.pixels) || convertedData.pixels.length !== importSize || convertedData.pixels.some(row => !Array.isArray(row) || row.length !== importSize)) throw new Error('Image converter returned an invalid pixel grid.');
      if (importSize !== size) {
        setHistory(h => [...h, { size, pixels: [...pixels], palette: [...palette], selected }].slice(-100));
        setFuture([]); setPixels(convertedData.pixels.flat()); setSize(importSize); setZoom(z => Math.max(8, Math.floor(z * size / importSize)));
      } else commit(convertedData.pixels.flat());
      setPalette(convertedData.palette); setSelected(0);
      setNotice(`Imported at ${importSize}×${importSize} with up to 64 colors for sharper detail.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Image conversion failed.');
    } finally { setBusy(false); e.target.value = ''; }
  };

  const generateWithAi = async (e: ChangeEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!aiPrompt.trim()) { setAiError('Describe the sprite you want to create.'); return; }
    setAiBusy(true); setAiError('');
    try {
      const response = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.trim(), size }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'AI generation failed.');
      if (!Array.isArray(data.palette) || data.palette.length < 1 || data.palette.length > 16
        || !Array.isArray(data.pixels) || data.pixels.length !== size
        || data.pixels.some((row: unknown) => !Array.isArray(row) || row.length !== size
          || row.some((color: unknown) => !Number.isInteger(color) || (color as number) < -1 || (color as number) >= data.palette.length))
        || !data.palette.every((color: unknown) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))) {
        throw new Error('AI returned an invalid sprite grid. Please try again.');
      }
      commit(data.pixels.flat()); setPalette(data.palette); setSelected(0);
      setName(typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 60) : 'AI sprite');
      setNotice('AI sprite created. You can edit every pixel and color.'); setAiOpen(false);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI generation failed.');
    } finally { setAiBusy(false); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input,select,textarea')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if (e.key.toLowerCase() === 'b') setTool('pencil');
      else if (e.key.toLowerCase() === 'e') setTool('eraser');
      else if (e.key.toLowerCase() === 'g') setTool('fill');
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveToCollection(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  return <main className="app">
    <header className="topbar">
      <button type="button" className="brand" onClick={() => setView('editor')} aria-label="DotMatrix Studio home"><span className="brand-mark">✳</span> DotMatrix</button>
      <div className="crumb"><button type="button" onClick={() => setView('editor')} aria-label="Go to the editor">Studio</button><span>/</span>{view === 'editor' && nameEditing ? <input ref={nameInputRef} className="crumb-name-input" aria-label="Artwork name" value={name} maxLength={60} onChange={e => setName(e.target.value)} onBlur={finishNameEdit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setName(previousNameRef.current); e.currentTarget.blur(); } }} /> : <button type="button" className="crumb-name" onClick={() => { previousNameRef.current = name; setNameEditing(true); }} aria-label={`Rename ${view === 'editor' ? name : 'art collection'}`} disabled={view !== 'editor'}>{view === 'editor' ? name : 'Art collection'}</button>}</div>
      <nav className="main-nav" aria-label="Main navigation"><button aria-current={view === 'editor' ? 'page' : undefined} className={view === 'editor' ? 'nav-active' : ''} onClick={() => setView('editor')}>Editor</button><button aria-current={view === 'collection' ? 'page' : undefined} className={view === 'collection' ? 'nav-active' : ''} onClick={() => setView('collection')}>Art collection <span>{artworks.length}</span></button></nav>
      {view === 'editor' && <div className="top-actions"><button className="quiet" onClick={saveToCollection}>Save to collection</button><button className="quiet" onClick={() => commit(blank(size))}>Reset canvas</button><button className="export" onClick={exportPng}>Export PNG</button></div>}
    </header>
    {view === 'editor' ? <section className="workspace">
      <aside className="sidebar">
        <div className="side-title">TOOLS <span>SHORTCUTS</span></div>
        <div className="tool-list">{([['pencil','✎','Pencil','B'],['eraser','◩','Eraser','E'],['fill','◩','Bucket','G']] as const).map(([id,icon,label,key]) => <button className={`tool ${tool === id ? 'active' : ''}`} onClick={() => setTool(id)} key={id} title={`${label} (${key})`}><span>{icon}</span>{label}<kbd>{key}</kbd></button>)}</div>
        <div className="shape-heading"><div className="side-title">SHAPES</div><select aria-label="Shape size" value={shapeSpan} onChange={e => setShapeSpan(Number(e.target.value))}>{[8,12,16,24,32].map(n => <option key={n} value={n}>{n}px</option>)}</select></div>
        <div className="shape-grid">{SHAPES.map(shape => <button key={shape.id} className={`shape-button ${pendingShape === shape.id ? 'shape-selected' : ''}`} title={`Drag ${shape.label} onto the canvas; uses selected palette color`} draggable onClick={() => setPendingShape(pendingShape === shape.id ? null : shape.id)} onDragStart={e => { e.dataTransfer.setData('application/x-dotmatrix-shape', shape.id); e.dataTransfer.effectAllowed = 'copy'; setPendingShape(null); }}><span>{shape.icon}</span>{shape.label}</button>)}</div>
        {pendingShape && <p className="shape-hint">Click canvas to place {pendingShape}. Uses selected color.</p>}
        <div className="side-title palette-title">COLORS <div className="palette-actions"><button onClick={resetPalette} title="Reset palette; remap artwork to starter colors" aria-label="Reset palette">↻</button></div></div>
        <div className="selected-color"><span style={{ background: palette[selected] }} /><div><b>{palette[selected]?.toUpperCase()}</b><small>Selected swatch</small></div></div>
        <section className="color-picker-panel" aria-label="Color picker"><div className="side-title">COLOR WHEEL</div><ColorWheel color={colorDraft} onChange={setColorDraft}/><div className="color-preview" aria-live="polite"><span className={validColorDraft ? '' : 'checker'} style={validColorDraft ? { background: colorDraft } : undefined}/><div><small>Color preview</small><b>{validColorDraft ? colorDraft.toUpperCase() : 'Enter a 6-digit hex'}</b></div></div><label className="hex-field"><span>HEX</span><input aria-label="Hex color" value={colorDraft} onChange={e => setColorDraft(e.target.value)} maxLength={7}/></label><div className="color-actions"><button onClick={addColor} disabled={!validColorDraft}>Add shade</button><button onClick={updateSelectedColor} disabled={!validColorDraft}>Update selected</button></div></section>
        <div className="side-title palette-title">PALETTE <span>{palette.length} color{palette.length === 1 ? '' : 's'}</span></div>
        <div className="palette">{palette.map((color,i) => <button key={i} aria-label={`Color ${i + 1}`} title={color} onClick={() => setSelected(i)} className={`swatch ${selected === i ? 'chosen' : ''}`} style={{ background: color }} />)}</div>
        <div className="side-bottom"><div className="tip-icon">✦</div><b>Quick tips</b><p>Drag to paint. Use B, E, G to switch tools.</p><span>⌘/Ctrl Z to undo</span></div>
      </aside>
      <section className="editor">
        <div className="editor-head"><div className="head-tools"><button className="icon-button" title="Undo" onClick={undo}>↶</button><button className="icon-button" title="Redo" onClick={redo}>↷</button><span className="divider"/><select aria-label="Grid size" value={size} onChange={e => resize(Number(e.target.value))}>{[8,16,32,64].map(n => <option key={n} value={n}>{n} × {n}</option>)}</select><select aria-label="Art texture" value={renderStyle} onChange={e => setRenderStyle(e.target.value as RenderStyle)}><option value="pixel">Pixel grid</option><option value="crochet">Crochet stitches</option><option value="beads">Round beads</option></select><button className="icon-button grid-button" title="Zoom out" onClick={() => setZoom(z => Math.max(8,z - 2))}>−</button><span className="zoom">{Math.round(zoom / 18 * 100)}%</span><button className="icon-button grid-button" title="Zoom in" onClick={() => setZoom(z => Math.min(32,z + 2))}>+</button></div></div>
        <div className="canvas-stage"><div className="canvas-wrap" style={{ width: size * zoom, height: size * zoom }}><div className="checker"/><canvas ref={canvas} width={size * zoom} height={size * zoom} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onDragOver={e => e.preventDefault()} onDrop={dropShape} style={{ cursor: pendingShape ? 'copy' : undefined }}/></div></div>
      </section>
      <aside className="inspector"><div className="inspector-head">CANVAS</div><div className="preview-card"><div className="preview checker"><ArtworkThumb artwork={{ id: 'current', name, size, pixels, palette, renderStyle, updatedAt: '' }}/></div><div className="preview-meta"><b>{name}</b><span>{size} × {size} px</span></div></div><div className="property"><label>GRID SIZE</label><select value={size} onChange={e => resize(Number(e.target.value))}>{[8,16,32,64].map(n => <option key={n} value={n}>{n} × {n}</option>)}</select></div><div className="property"><button className="upload-btn" onClick={() => { setDismissedRepairs([]); setRepairOpen(true); }}>Check sprite · {repairSuggestions.length}</button></div><div className="property"><label>COLOR RANGE</label><small>24-bit RGB picker · up to 16.7M selectable shades</small></div><div className="property"><label>BACKGROUND</label><div className="transparent-btn"><span className="checker mini"/> Transparent</div></div><div className="property"><label>CREATE WITH AI</label><button className="upload-btn" onClick={() => { setAiError(''); setAiOpen(true); }}>✦ &nbsp; Generate a sprite</button></div><div className="property"><label>IMPORT IMAGE</label><button className="upload-btn" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? 'Converting…' : '↑  Upload an image'}</button><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={upload}/><small>PNG, JPG or WEBP · up to 10 MB</small></div><div className="property"><label>EXPORT</label><button className="upload-btn" onClick={exportPng}>↓ &nbsp; Download {renderStyle === 'pixel' ? 'PNG' : 'styled PNG'}</button></div>{notice && <p className="notice">{notice}</p>}<div className="inspector-footer"><span>DotMatrix Studio</span><span>v0.4.0</span></div></aside>
    </section> : <section className="collection-page"><div className="collection-head"><div><h1>Art collection</h1><p>Your saved pixel art, all in one place.</p></div><button className="export" onClick={() => setView('editor')}>Create artwork</button></div>{artworks.length ? <div className="art-grid">{artworks.map(art => <article className="art-card" key={art.id}><button className="art-open checker" onClick={() => loadArtwork(art)} aria-label={`Open ${art.name}`}><ArtworkThumb artwork={art}/></button><div className="art-card-info"><div><b>{art.name}</b><span>{art.size} × {art.size} px · {art.renderStyle || 'pixel'}</span></div><button className="delete-art" title="Delete artwork" onClick={() => deleteArtwork(art.id)}>×</button></div></article>)}</div> : <div className="collection-empty"><div className="empty-mark">✳</div><h2>Your collection is empty</h2><p>Create a sprite and save it here.</p><button className="export" onClick={() => setView('editor')}>Open editor</button></div>}</section>}
    {repairOpen && <div className="repair-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setRepairOpen(false); }}><section className="repair-dialog" role="dialog" aria-modal="true" aria-labelledby="repair-title"><header className="repair-dialog-head"><div><h2 id="repair-title">Sprite check</h2><p>Possible one-pixel issues. Review each suggestion before changing your art.</p></div><button className="delete-art" aria-label="Close" onClick={() => setRepairOpen(false)}>×</button></header><div className="repair-content"><section><h3>Suggestions <span>{repairSuggestions.length}</span></h3>{repairSuggestions.length ? <div className="repair-list">{repairSuggestions.map(item => <article className="repair-card" key={item.id}><div className="repair-description"><b>Pixel ({item.x + 1}, {item.y + 1})</b><p>{item.reason}</p><div className="repair-change"><span className="repair-chip" style={{ background: palette[item.before] }} title={palette[item.before]}/><span>→</span><span className={`repair-chip ${item.after < 0 ? 'transparent-chip' : ''}`} style={item.after < 0 ? undefined : { background: palette[item.after] }} title={item.after < 0 ? 'Transparent' : palette[item.after]}/></div></div><div className="repair-actions"><button className="repair-apply" onClick={() => applyRepair(item)}>{item.after < 0 ? 'Remove pixel' : 'Change color'}</button><button className="repair-ignore" onClick={() => setDismissedRepairs(ids => [...ids, item.id])}>Ignore</button></div></article>)}</div> : <p className="repair-empty">No likely one-pixel issues found.</p>}</section><section className="repair-ledger"><h3>Repair history <span>{repairLog.length}</span></h3>{repairLog.length ? <div className="repair-list">{repairLog.slice(0, 10).map(entry => <article className="ledger-entry" key={entry.id}><div><b>Pixel ({entry.x + 1}, {entry.y + 1})</b><p>{entry.reason}</p><div className="repair-change"><span className="repair-chip" style={entry.beforeHex === 'transparent' ? undefined : { background: entry.beforeHex }}/><span>→</span><span className={`repair-chip ${entry.afterHex === 'transparent' ? 'transparent-chip' : ''}`} style={entry.afterHex === 'transparent' ? undefined : { background: entry.afterHex }}/><small>{entry.status === 'applied' ? 'Applied' : 'Undone'}</small></div></div></article>)}</div> : <p className="repair-empty">Accepted changes will be recorded here.</p>}</section></div><footer className="repair-dialog-foot">Suggestions are heuristic; small isolated pixels may be intentional. Every accepted change can be undone with the editor’s Undo control.</footer></section></div>}
    {aiOpen && <div className="repair-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !aiBusy) setAiOpen(false); }}><form className="ai-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-title" onSubmit={generateWithAi}><button type="button" className="delete-art ai-close" aria-label="Close" disabled={aiBusy} onClick={() => setAiOpen(false)}>×</button><h2 id="ai-title">Create pixel art with AI</h2><p>Describe one sprite. It will use your current {size} × {size} grid and up to 16 colors.</p><label htmlFor="ai-prompt">Sprite description</label><textarea id="ai-prompt" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} maxLength={500} placeholder="A tiny orange cat sitting in a flower pot" autoFocus/><div className="ai-dialog-meta"><span>{aiPrompt.length}/500</span><span>Generated art stays editable</span></div>{aiError && <p className="ai-error" role="alert">{aiError}</p>}<div className="ai-dialog-actions"><button type="button" className="repair-ignore" disabled={aiBusy} onClick={() => setAiOpen(false)}>Cancel</button><button type="submit" className="repair-apply" disabled={aiBusy || !aiPrompt.trim()}>{aiBusy ? 'Generating…' : 'Generate sprite'}</button></div></form></div>}
  </main>;
}
