export type HexColor = `#${string}`;

export type GridCell = HexColor | null;

export interface BeadGrid {
  width: number;
  height: number;
  cells: GridCell[][];
}

export interface RowInstruction {
  rowNumber: number;
  direction: 'left-to-right' | 'right-to-left';
  sequence: Array<{ color: HexColor; count: number }>;
}

export interface PatternInstructions {
  rows: RowInstruction[];
  colorCounts: Record<HexColor, number>;
  threadPath: Array<{ x: number; y: number }>;
}

export interface ExtremityAttachment {
  id: string;
  fromRow: number;
  side: 'left' | 'right';
  thread: 'teal' | 'orange';
  branch: number[]; // Each number is the bead count for a segment, e.g. [1,1,1,1,2,1,2,1]
  color: HexColor;
  rotationDeg: number;
}

export type Tool = 'paint' | 'erase' | 'fill';

export interface PixelationSettings {
  width: number;
  height: number;
  maxColors: number;
}
