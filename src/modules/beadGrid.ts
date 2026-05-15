import { BeadGrid, GridCell, HexColor } from '../types/bead';

export function createEmptyGrid(width: number, height: number): BeadGrid {
  return {
    width,
    height,
    cells: Array.from({ length: height }, () => Array.from({ length: width }, () => null as GridCell))
  };
}

export function cloneGrid(grid: BeadGrid): BeadGrid {
  return {
    width: grid.width,
    height: grid.height,
    cells: grid.cells.map((row) => [...row])
  };
}

export function setCellColor(grid: BeadGrid, x: number, y: number, color: HexColor | null): BeadGrid {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) {
    return grid;
  }

  const next = cloneGrid(grid);
  next.cells[y][x] = color;
  return next;
}

export function floodFill(grid: BeadGrid, startX: number, startY: number, fillColor: HexColor | null): BeadGrid {
  if (startX < 0 || startY < 0 || startX >= grid.width || startY >= grid.height) {
    return grid;
  }

  const sourceColor = grid.cells[startY][startX];
  if (sourceColor === fillColor) {
    return grid;
  }

  const next = cloneGrid(grid);
  const stack: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];

  while (stack.length > 0) {
    const point = stack.pop();
    if (!point) {
      break;
    }

    const { x, y } = point;
    if (x < 0 || y < 0 || x >= next.width || y >= next.height) {
      continue;
    }

    if (next.cells[y][x] !== sourceColor) {
      continue;
    }

    next.cells[y][x] = fillColor;
    stack.push({ x: x + 1, y });
    stack.push({ x: x - 1, y });
    stack.push({ x, y: y + 1 });
    stack.push({ x, y: y - 1 });
  }

  return next;
}
