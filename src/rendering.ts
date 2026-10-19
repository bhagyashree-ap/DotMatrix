export type RenderStyle = 'pixel' | 'crochet' | 'beads';

export function shade(hex: string, amount: number): string {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  return `#${channels.map(value => Math.max(0, Math.min(255, value + amount)).toString(16).padStart(2, '0')).join('')}`;
}

export function drawCell(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  cell: number,
  style: RenderStyle,
): void {
  if (style === 'pixel') {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, cell, cell);
    return;
  }

  ctx.fillStyle = shade(color, -42);
  ctx.fillRect(x, y, cell, cell);
  if (style === 'crochet') {
    ctx.fillStyle = shade(color, -13);
    ctx.fillRect(x + cell * 0.08, y + cell * 0.08, cell * 0.84, cell * 0.84);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, cell * 0.13);
    ctx.strokeStyle = shade(color, 28);
    ctx.beginPath();
    ctx.moveTo(x + cell * 0.24, y + cell * 0.55);
    ctx.bezierCurveTo(x + cell * 0.23, y + cell * 0.17, x + cell * 0.77, y + cell * 0.17, x + cell * 0.76, y + cell * 0.55);
    ctx.bezierCurveTo(x + cell * 0.74, y + cell * 0.86, x + cell * 0.29, y + cell * 0.86, x + cell * 0.24, y + cell * 0.55);
    ctx.stroke();
    ctx.strokeStyle = shade(color, -30);
    ctx.lineWidth = Math.max(0.7, cell * 0.07);
    ctx.beginPath();
    ctx.moveTo(x + cell * 0.32, y + cell * 0.60);
    ctx.bezierCurveTo(x + cell * 0.37, y + cell * 0.38, x + cell * 0.63, y + cell * 0.38, x + cell * 0.68, y + cell * 0.60);
    ctx.stroke();
    return;
  }

  const cx = x + cell * 0.5, cy = y + cell * 0.47, radius = cell * 0.41;
  const gradient = ctx.createRadialGradient(cx - radius * 0.32, cy - radius * 0.38, cell * 0.02, cx, cy, radius * 1.35);
  gradient.addColorStop(0, shade(color, 65));
  gradient.addColorStop(0.38, color);
  gradient.addColorStop(1, shade(color, -65));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.25)';
  ctx.lineWidth = Math.max(0.6, cell * 0.035);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath();
  ctx.arc(cx - radius * 0.3, cy - radius * 0.35, Math.max(0.6, cell * 0.07), 0, Math.PI * 2);
  ctx.fill();
}
