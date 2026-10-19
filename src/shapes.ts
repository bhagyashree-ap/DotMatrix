export const SHAPES = [
  { id: 'line', label: 'Line', icon: '━' },
  { id: 'circle', label: 'Circle', icon: '●' },
  { id: 'square', label: 'Square', icon: '■' },
  { id: 'rectangle', label: 'Rectangle', icon: '▰' },
  { id: 'triangle', label: 'Triangle', icon: '▲' },
] as const;

export type ShapeId = typeof SHAPES[number]['id'];

export function paintShape(pixels: number[], gridSize: number, shape: ShapeId, centerX: number, centerY: number, color: number, span: number): number[] {
  const result = [...pixels];
  const width = Math.max(1, Math.min(gridSize, Math.round(span)));
  const height = shape === 'line' ? 1 : shape === 'rectangle' ? Math.max(2, Math.round(width * 0.6)) : width;
  const left = centerX - Math.floor(width / 2), top = centerY - Math.floor(height / 2);
  for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) {
    const x = (dx + 0.5) / width * 2 - 1, y = (dy + 0.5) / height * 2 - 1;
    const gx = left + dx, gy = top + dy;
    const inside = shape !== 'circle' || x * x + y * y <= 1;
    const inTriangle = shape !== 'triangle' || Math.abs(x) <= (y + 1) / 2;
    if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize && inside && inTriangle) result[gy * gridSize + gx] = color;
  }
  return result;
}
