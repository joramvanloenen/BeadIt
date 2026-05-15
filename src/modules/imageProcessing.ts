import { BeadGrid, HexColor } from '../types/bead';
import { createEmptyGrid } from './beadGrid';

function clampColor(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function rgbToHex(r: number, g: number, b: number): HexColor {
  const toHex = (value: number) => clampColor(value).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex: HexColor): [number, number, number] {
  const raw = hex.replace('#', '');
  return [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16)
  ];
}

function sqDistance(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

async function fileToImageBitmap(file: File): Promise<ImageBitmap> {
  const data = await file.arrayBuffer();
  const blob = new Blob([data], { type: file.type });
  return createImageBitmap(blob);
}

function nearestPaletteIndex(color: [number, number, number], palette: [number, number, number][]): number {
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < palette.length; i += 1) {
    const dist = sqDistance(color, palette[i]);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  return bestIdx;
}

function kMeans(colors: [number, number, number][], k: number, iterations: number): [number, number, number][] {
  if (colors.length === 0) {
    return [];
  }

  const step = Math.max(1, Math.floor(colors.length / k));
  let centroids = Array.from({ length: k }, (_, i) => colors[Math.min(colors.length - 1, i * step)]);

  for (let iter = 0; iter < iterations; iter += 1) {
    const clusters = centroids.map(() => ({
      sumR: 0,
      sumG: 0,
      sumB: 0,
      count: 0
    }));

    for (const color of colors) {
      const idx = nearestPaletteIndex(color, centroids);
      clusters[idx].sumR += color[0];
      clusters[idx].sumG += color[1];
      clusters[idx].sumB += color[2];
      clusters[idx].count += 1;
    }

    centroids = centroids.map((center, idx) => {
      const c = clusters[idx];
      if (c.count === 0) {
        return center;
      }
      return [c.sumR / c.count, c.sumG / c.count, c.sumB / c.count].map((v) => clampColor(v)) as [number, number, number];
    });
  }

  return centroids;
}

export async function pixelateImageToGrid(
  file: File,
  width: number,
  height: number,
  maxColors: number
): Promise<{ grid: BeadGrid; palette: HexColor[] }> {
  const bitmap = await fileToImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Cannot create 2D rendering context');
  }

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const rgba = imageData.data;

  const opaquePixels: [number, number, number][] = [];
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3];
    if (alpha < 32) {
      continue;
    }
    opaquePixels.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
  }

  const centroidCount = Math.max(1, Math.min(maxColors, opaquePixels.length || 1));
  const paletteRgb = kMeans(opaquePixels, centroidCount, 8);
  const paletteHex = paletteRgb.map(([r, g, b]) => rgbToHex(r, g, b));

  const grid = createEmptyGrid(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const alpha = rgba[idx + 3];
      if (alpha < 32) {
        grid.cells[y][x] = null;
        continue;
      }

      const color: [number, number, number] = [rgba[idx], rgba[idx + 1], rgba[idx + 2]];
      const bestPaletteIdx = nearestPaletteIndex(color, paletteRgb);
      const [r, g, b] = hexToRgb(paletteHex[bestPaletteIdx]);
      grid.cells[y][x] = rgbToHex(r, g, b);
    }
  }

  return { grid, palette: paletteHex };
}
