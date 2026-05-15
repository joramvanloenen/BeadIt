import { BeadGrid, HexColor, PatternInstructions, RowInstruction } from '../types/bead';

function collapseRowIntoRuns(colors: HexColor[]): Array<{ color: HexColor; count: number }> {
  const runs: Array<{ color: HexColor; count: number }> = [];
  for (const color of colors) {
    const last = runs[runs.length - 1];
    if (last && last.color === color) {
      last.count += 1;
    } else {
      runs.push({ color, count: 1 });
    }
  }
  return runs;
}

export function generatePatternInstructions(grid: BeadGrid): PatternInstructions {
  const rows: RowInstruction[] = [];
  const colorCounts: Record<HexColor, number> = {};
  const threadPath: Array<{ x: number; y: number }> = [];

  // Square stitch is rendered in alternating directions so each row has a clear weaving pass.
  for (let y = 0; y < grid.height; y += 1) {
    const leftToRight = y % 2 === 0;
    const xOrder = leftToRight
      ? Array.from({ length: grid.width }, (_, x) => x)
      : Array.from({ length: grid.width }, (_, index) => grid.width - 1 - index);

    const usedColors: HexColor[] = [];
    for (const x of xOrder) {
      const color = grid.cells[y][x];
      if (!color) {
        continue;
      }

      usedColors.push(color);
      colorCounts[color] = (colorCounts[color] ?? 0) + 1;
      threadPath.push({ x, y });
    }

    rows.push({
      rowNumber: y + 1,
      direction: leftToRight ? 'left-to-right' : 'right-to-left',
      sequence: collapseRowIntoRuns(usedColors)
    });
  }

  return { rows, colorCounts, threadPath };
}
