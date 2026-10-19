export type RepairSuggestion = {
  id: string;
  index: number;
  x: number;
  y: number;
  before: number;
  after: number;
  reason: string;
};

/** Find only high-confidence one-pixel anomalies; callers must ask before applying them. */
export function findRepairSuggestions(pixels: number[], size: number, limit = 60): RepairSuggestion[] {
  if (!Number.isInteger(size) || size < 1 || pixels.length !== size * size) return [];
  const suggestions: RepairSuggestion[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      const before = pixels[index];
      if (before < 0) continue;

      let occupied = 0;
      let sameColor = 0;
      let neighbors = 0;
      let commonColor = -2;
      let allSame = true;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
          neighbors++;
          const color = pixels[ny * size + nx];
          if (color >= 0) occupied++;
          if (color === before) sameColor++;
          if (color < 0) allSame = false;
          else if (commonColor === -2) commonColor = color;
          else if (commonColor !== color) allSame = false;
        }
      }

      if (occupied === 0 && neighbors > 0) {
        suggestions.push({
          id: `isolated-${index}`, index, x, y, before, after: -1,
          reason: 'This pixel has no colored neighbors and may be stray.',
        });
      } else if (neighbors === 8 && occupied === 8 && allSame && sameColor === 0 && commonColor >= 0) {
        suggestions.push({
          id: `speck-${index}`, index, x, y, before, after: commonColor,
          reason: 'This pixel is surrounded by one color and may be an accidental color speck.',
        });
      }
      if (suggestions.length >= limit) return suggestions;
    }
  }
  return suggestions;
}
