type Sample = { r: number; g: number; b: number; weight: number };

function distance(a: Sample, b: Sample): number {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
}

function hex(sample: Sample): string {
  return `#${[sample.r, sample.g, sample.b].map(value => Math.round(value).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function quantizeRgba(rgba: Uint8ClampedArray, maxColors = 24): { palette: string[]; pixels: number[] } {
  const samplesByColor = new Map<number, Sample>();
  const transparent = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < rgba.length; i += 4) {
    const pixel = i / 4;
    if (rgba[i + 3] < 80) { transparent[pixel] = 1; continue; }
    const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
    const found = samplesByColor.get(key);
    if (found) found.weight++;
    else samplesByColor.set(key, { r: rgba[i], g: rgba[i + 1], b: rgba[i + 2], weight: 1 });
  }
  const samples = [...samplesByColor.values()];
  if (!samples.length) return { palette: ['#000000'], pixels: Array.from(transparent, () => -1) };
  const buckets: Sample[][] = [samples];
  while (buckets.length < Math.max(1, maxColors)) {
    let splitIndex = -1, splitScore = -1, splitAxis: 'r' | 'g' | 'b' = 'r';
    buckets.forEach((bucket, index) => {
      if (bucket.length < 2) return;
      const ranges = (['r', 'g', 'b'] as const).map(axis => Math.max(...bucket.map(item => item[axis])) - Math.min(...bucket.map(item => item[axis])));
      const axis = (['r', 'g', 'b'] as const)[ranges.indexOf(Math.max(...ranges))];
      const score = ranges[['r', 'g', 'b'].indexOf(axis)] * bucket.reduce((sum, item) => sum + item.weight, 0);
      if (score > splitScore) { splitIndex = index; splitScore = score; splitAxis = axis; }
    });
    if (splitIndex < 0) break;
    const sorted = [...buckets[splitIndex]].sort((a, b) => a[splitAxis] - b[splitAxis]);
    const total = sorted.reduce((sum, item) => sum + item.weight, 0);
    let running = 0, cut = 1;
    for (; cut < sorted.length; cut++) { running += sorted[cut - 1].weight; if (running >= total / 2) break; }
    buckets.splice(splitIndex, 1, sorted.slice(0, cut), sorted.slice(cut));
  }
  const centers = buckets.map(bucket => {
    const weight = bucket.reduce((sum, item) => sum + item.weight, 0);
    return bucket.reduce((sum, item) => ({ r: sum.r + item.r * item.weight / weight, g: sum.g + item.g * item.weight / weight, b: sum.b + item.b * item.weight / weight, weight }), { r: 0, g: 0, b: 0, weight: 0 });
  });
  const palette: string[] = [], indexes = new Map<number, number>(), pixels: number[] = [];
  for (let i = 0; i < rgba.length; i += 4) {
    const pixel = i / 4;
    if (transparent[pixel]) { pixels.push(-1); continue; }
    const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
    let index = indexes.get(key);
    if (index === undefined) {
      const sample = { r: rgba[i], g: rgba[i + 1], b: rgba[i + 2], weight: 1 };
      let nearest = 0, nearestDistance = Infinity;
      centers.forEach((center, candidate) => { const d = distance(sample, center); if (d < nearestDistance) { nearestDistance = d; nearest = candidate; } });
      index = nearest; indexes.set(key, index);
    }
    pixels.push(index);
  }
  const used = [...new Set(pixels.filter(index => index >= 0))];
  const remap = new Map(used.map((index, next) => [index, next]));
  return { palette: used.map(index => hex(centers[index])), pixels: pixels.map(index => index < 0 ? -1 : remap.get(index)!) };
}
