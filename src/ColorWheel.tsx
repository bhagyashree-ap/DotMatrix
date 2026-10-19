import { PointerEvent, useEffect, useRef } from 'react';

type Hsv = { h: number; s: number; v: number };

function toHsv(hex: string): Hsv {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let h = 0;
  if (delta) h = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : delta / max, v: max };
}

function toHex({ h, s, v }: Hsv): string {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  const section = Math.floor(h / 60), pairs = [[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][section] || [c,0,x];
  return `#${pairs.map(value => Math.round((value + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function ColorWheel({ color, onChange }: { color: string; onChange: (color: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hsv = toHsv(/^#[0-9a-f]{6}$/i.test(color) ? color : '#FFFFFF');

  useEffect(() => {
    const canvas = ref.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const scale = canvas.width / 160;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, 160, 160);
    for (let degree = 0; degree < 360; degree++) {
      ctx.beginPath(); ctx.strokeStyle = `hsl(${degree} 100% 50%)`; ctx.lineWidth = 14;
      ctx.arc(80, 80, 68, (degree - 1) * Math.PI / 180, (degree + 1) * Math.PI / 180); ctx.stroke();
    }
    const x = 48, y = 48, side = 64;
    ctx.fillStyle = `hsl(${hsv.h} 100% 50%)`; ctx.fillRect(x, y, side, side);
    const white = ctx.createLinearGradient(x, y, x + side, y); white.addColorStop(0, '#fff'); white.addColorStop(1, '#fff0');
    ctx.fillStyle = white; ctx.fillRect(x, y, side, side);
    const black = ctx.createLinearGradient(x, y, x, y + side); black.addColorStop(0, '#0000'); black.addColorStop(1, '#000');
    ctx.fillStyle = black; ctx.fillRect(x, y, side, side);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(x, y, side, side);
    const satX = x + hsv.s * side, valY = y + (1 - hsv.v) * side;
    ctx.beginPath(); ctx.arc(satX, valY, 4, 0, Math.PI * 2); ctx.strokeStyle = '#17161b'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(satX, valY, 4, 0, Math.PI * 2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    const angle = hsv.h * Math.PI / 180;
    ctx.beginPath(); ctx.arc(80 + Math.cos(angle) * 68, 80 + Math.sin(angle) * 68, 6, 0, Math.PI * 2);
    ctx.fillStyle = toHex({ h: hsv.h, s: 1, v: 1 }); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  }, [hsv.h, hsv.s, hsv.v]);

  const pick = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) * 160 / rect.width, py = (event.clientY - rect.top) * 160 / rect.height;
    const dx = px - 80, dy = py - 80, radius = Math.hypot(dx, dy);
    if (radius >= 54 && radius <= 78) onChange(toHex({ ...hsv, h: (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360 }));
    else if (px >= 48 && px <= 112 && py >= 48 && py <= 112) onChange(toHex({ ...hsv, s: (px - 48) / 64, v: 1 - (py - 48) / 64 }));
  };
  return <canvas ref={ref} className="color-wheel" width={320} height={320} role="group" tabIndex={0} aria-label="Choose a color from the hue wheel and shade square. Use arrow keys; hold Shift to change hue." onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); pick(event); }} onPointerMove={event => { if (event.buttons === 1) pick(event); }} onKeyDown={event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 2 : 0.025;
    if (event.shiftKey) onChange(toHex({ ...hsv, h: (hsv.h + (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -2 : 2) + 360) % 360 }));
    else onChange(toHex({ ...hsv, s: Math.max(0, Math.min(1, hsv.s + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0))), v: Math.max(0, Math.min(1, hsv.v + (event.key === 'ArrowDown' ? -step : event.key === 'ArrowUp' ? step : 0))) }));
  }} />;
}
