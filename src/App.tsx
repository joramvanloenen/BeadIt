import { ChangeEvent, PointerEvent, useEffect, useMemo, useState } from 'react';
import { cloneGrid, createEmptyGrid, floodFill, setCellColor } from './modules/beadGrid';
import { exportSvgAsPdf, exportSvgAsPng } from './modules/exportTools';
import { pixelateImageToGrid } from './modules/imageProcessing';
import { generatePatternInstructions } from './modules/instructionGeneration';
import { renderPatternSvg } from './modules/svgRenderer';
import { BeadGrid, ExtremityAttachment, HexColor, PixelationSettings, Tool } from './types/bead';

const DEFAULT_GRID_WIDTH = 30;
const DEFAULT_GRID_HEIGHT = 20;
const SVG_BEAD_WIDTH = 13;
const SVG_BEAD_HEIGHT = 16;
const SVG_BEAD_GAP_X = 3;
const SVG_BEAD_GAP_Y = 5;
const SVG_LEFT_MARGIN = 80;
const SVG_TOP_MARGIN = 108;
const CENTERED_EDITOR_TOP_MARGIN = 64;
const DEFAULT_START_COLOR: HexColor = '#1a1a1a';

const TOOL_LABELS: Record<Tool, string> = {
  paint: 'Paint',
  erase: 'Erase',
  fill: 'Fill'
};

const PRESET_BEAD_COLORS: Array<{ code: string; name: string; hex: HexColor }> = [
  { code: '0401', name: 'Opaque Black', hex: '#1b1b1b' },
  { code: '0402', name: 'Opaque White', hex: '#f4f4f2' },
  { code: '0403', name: 'Opaque Red', hex: '#b32126' },
  { code: '0404', name: 'Opaque Cobalt Blue', hex: '#2d5da8' },
  { code: '0405', name: 'Opaque Green', hex: '#2f7a4f' },
  { code: '0406', name: 'Opaque Yellow', hex: '#e2b81d' },
  { code: '0407', name: 'Opaque Orange', hex: '#d96a1e' },
  { code: '0408', name: 'Opaque Purple', hex: '#6d4c97' },
  { code: '0409', name: 'Opaque Pink', hex: '#d979a4' },
  { code: '0410', name: 'Crystal Transparent', hex: '#e9eef2' },
  { code: '0411', name: 'Silver Lined Crystal', hex: '#d9e1e8' },
  { code: '0412', name: 'Metallic Bronze', hex: '#8b5b3c' },
  { code: '0413', name: 'Metallic Gold', hex: '#c9a23a' },
  { code: '0414', name: 'Metallic Silver', hex: '#b9bec5' },
  { code: '0415', name: 'Transparent Aqua', hex: '#67c8d9' },
  { code: '0416', name: 'Transparent Emerald', hex: '#1f9b68' },
  { code: '0417', name: 'Transparent Ruby', hex: '#b2182d' },
  { code: '0418', name: 'Transparent Sapphire', hex: '#3056c8' },
  { code: '0419', name: 'Transparent Topaz', hex: '#d6a03b' },
  { code: '0420', name: 'Transparent Amethyst', hex: '#7e57b1' },
  { code: '0421', name: 'Matte Black', hex: '#232323' },
  { code: '0422', name: 'Matte White', hex: '#e8e6e2' },
  { code: '0423', name: 'Matte Navy', hex: '#243a63' },
  { code: '0424', name: 'Matte Olive', hex: '#677043' },
  { code: '0425', name: 'Matte Terracotta', hex: '#a3523b' },
  { code: '0426', name: 'Ceylon Cream', hex: '#f2e6cc' },
  { code: '0427', name: 'Ceylon Peach', hex: '#f1c7af' },
  { code: '0428', name: 'Ceylon Lavender', hex: '#c6b4d9' },
  { code: '0429', name: 'Ceylon Sky Blue', hex: '#a7c7e8' },
  { code: '0430', name: 'Ceylon Seafoam', hex: '#a9d6c2' },
  { code: '0431', name: 'Luster Ivory', hex: '#e8dcc2' },
  { code: '0432', name: 'Luster Rose', hex: '#c97a8b' },
  { code: '0433', name: 'Luster Teal', hex: '#2e7d83' },
  { code: '0434', name: 'Luster Plum', hex: '#65406d' },
  { code: '0435', name: 'Luster Amber', hex: '#b06d2c' },
  { code: '0436', name: 'Duracoat Galvanized Gold', hex: '#b8912e' },
  { code: '0437', name: 'Duracoat Galvanized Silver', hex: '#aeb5bd' },
  { code: '0438', name: 'Duracoat Galvanized Copper', hex: '#a45a3a' },
  { code: '0439', name: 'Duracoat Galvanized Dark Blue', hex: '#324d85' },
  { code: '0440', name: 'Duracoat Galvanized Berry', hex: '#8a3c66' },
  { code: '0441', name: 'Opaque Turquoise', hex: '#27b4b8' },
  { code: '0442', name: 'Opaque Mint', hex: '#7ac8a4' },
  { code: '0443', name: 'Opaque Coral', hex: '#e36d5b' },
  { code: '0444', name: 'Opaque Mustard', hex: '#b88a1c' },
  { code: '0445', name: 'Opaque Chocolate', hex: '#5c3a2b' },
  { code: '0446', name: 'Transparent Lime', hex: '#93c83e' },
  { code: '0447', name: 'Transparent Smoke', hex: '#7b7f86' },
  { code: '0448', name: 'Transparent Rose', hex: '#d77c9a' },
  { code: '0449', name: 'Transparent Denim', hex: '#4b6faf' },
  { code: '0450', name: 'Transparent Moss', hex: '#617b4b' }
];

function isHexColor(value: string): value is HexColor {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function formatRowText(sequence: Array<{ color: HexColor; count: number }>): string {
  if (sequence.length === 0) {
    return 'No beads in this row';
  }
  return sequence.map((run) => `${run.count}x ${run.color}`).join(', ');
}

function extractPalette(grid: BeadGrid): HexColor[] {
  const set = new Set<HexColor>();
  for (const row of grid.cells) {
    for (const color of row) {
      if (color) {
        set.add(color);
      }
    }
  }
  return [...set];
}

function getExtremityThreadForSide(side: 'left' | 'right'): 'teal' | 'orange' {
  return side === 'left' ? 'teal' : 'orange';
}

function createSeededGrid(width: number, height: number, color: HexColor): BeadGrid {
  const next = createEmptyGrid(width, height);
  if (width > 0 && height > 0) {
    const centerX = Math.floor(width / 2);
    next.cells[0][centerX] = color;
  }
  return next;
}

export default function App() {
  const [grid, setGrid] = useState<BeadGrid>(() => createSeededGrid(DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT, DEFAULT_START_COLOR));
  const [tool, setTool] = useState<Tool>('paint');
  const [selectedColor, setSelectedColor] = useState<HexColor>(DEFAULT_START_COLOR);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<BeadGrid[]>([]);
  const [future, setFuture] = useState<BeadGrid[]>([]);
  const [zoom, setZoom] = useState(1);
  const [showThreadPath, setShowThreadPath] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PixelationSettings>({ width: 30, height: 20, maxColors: 12 });
  const [editorView, setEditorView] = useState<'grid' | 'centered'>('grid');
  const [rowEdgeMode, setRowEdgeMode] = useState<'add' | 'remove'>('add');
  const [showPatternDiagram, setShowPatternDiagram] = useState(false);
  const [showExtremityPopup, setShowExtremityPopup] = useState(false);
  const [showImportPopup, setShowImportPopup] = useState(false);
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [extremities, setExtremities] = useState<ExtremityAttachment[]>([]);
  const [extremityDraft, setExtremityDraft] = useState<{
    fromRow: number;
    side: 'left' | 'right';
    thread: 'teal' | 'orange';
    branch: string; // space-separated numbers, e.g. "1 1 1 1 2 1 2 1"
  }>({
    fromRow: 0,
    side: 'left',
    thread: 'orange',
    branch: '1 1 1 1 2 1 2 1'
  });

  useEffect(() => {
    const stopDrawing = () => setIsDrawing(false);
    window.addEventListener('pointerup', stopDrawing);
    return () => window.removeEventListener('pointerup', stopDrawing);
  }, []);

  useEffect(() => {
    const maxFromRow = Math.max(grid.height - 2, 0);
    setExtremityDraft((previous) => ({
      ...previous,
      fromRow: Math.min(previous.fromRow, maxFromRow),
      thread: getExtremityThreadForSide(previous.side)
    }));
  }, [grid.height]);

  function commitGrid(transform: (current: BeadGrid) => BeadGrid): void {
    setGrid((current) => {
      const next = transform(current);
      if (next === current) {
        return current;
      }

      setHistory((prev) => [...prev, cloneGrid(current)]);
      setFuture([]);
      return next;
    });
  }

  function applyToolAt(x: number, y: number): void {
    if (tool === 'paint') {
      commitGrid((current) => setCellColor(current, x, y, selectedColor));
      return;
    }

    if (tool === 'erase') {
      commitGrid((current) => setCellColor(current, x, y, null));
      return;
    }

    commitGrid((current) => floodFill(current, x, y, selectedColor));
  }

  function onCellPointerDown(event: PointerEvent<HTMLButtonElement>, x: number, y: number): void {
    event.preventDefault();
    applyToolAt(x, y);
    setIsDrawing(tool !== 'fill');
  }

  function onCellPointerEnter(x: number, y: number): void {
    if (!isDrawing) {
      return;
    }
    if (tool === 'fill') {
      return;
    }
    applyToolAt(x, y);
  }

  function undo(): void {
    setHistory((previousHistory) => {
      const previous = previousHistory[previousHistory.length - 1];
      if (!previous) {
        return previousHistory;
      }

      setGrid((current) => {
        setFuture((previousFuture) => [cloneGrid(current), ...previousFuture]);
        return cloneGrid(previous);
      });

      return previousHistory.slice(0, -1);
    });
  }

  function redo(): void {
    setFuture((previousFuture) => {
      const next = previousFuture[0];
      if (!next) {
        return previousFuture;
      }

      setGrid((current) => {
        setHistory((previousHistory) => [...previousHistory, cloneGrid(current)]);
        return cloneGrid(next);
      });

      return previousFuture.slice(1);
    });
  }

  function clearGrid(): void {
    commitGrid((current) => createSeededGrid(current.width, current.height, selectedColor));
  }

  function changeGridSize(width: number, height: number): void {
    const next = createEmptyGrid(width, height);
    const copyHeight = Math.min(height, grid.height);
    const copyWidth = Math.min(width, grid.width);
    for (let y = 0; y < copyHeight; y += 1) {
      for (let x = 0; x < copyWidth; x += 1) {
        next.cells[y][x] = grid.cells[y][x];
      }
    }
    commitGrid(() => next);
  }

  async function importImage(): Promise<void> {
    if (!uploadFile) {
      return;
    }

    try {
      setImportError(null);
      setIsImporting(true);
      const result = await pixelateImageToGrid(uploadFile, settings.width, settings.height, settings.maxColors);
      commitGrid(() => result.grid);
      if (result.palette.length > 0) {
        setSelectedColor(result.palette[0]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process image.';
      setImportError(message);
    } finally {
      setIsImporting(false);
    }
  }

  function replaceColor(oldColor: HexColor, newColor: HexColor): void {
    if (oldColor === newColor) {
      return;
    }

    commitGrid((current) => {
      const next = cloneGrid(current);
      for (let y = 0; y < next.height; y += 1) {
        for (let x = 0; x < next.width; x += 1) {
          if (next.cells[y][x] === oldColor) {
            next.cells[y][x] = newColor;
          }
        }
      }
      return next;
    });

    if (selectedColor === oldColor) {
      setSelectedColor(newColor);
    }
  }

  function addBeadAtRowEdge(sourceRow: number, side: 'left' | 'right'): void {
    commitGrid((current) => {
      const row = current.cells[sourceRow];
      if (!row) {
        return current;
      }

      let minX = current.width;
      let maxX = -1;
      for (let x = 0; x < current.width; x += 1) {
        if (row[x]) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }

      if (maxX < 0) {
        return current;
      }

      const targetX = side === 'left' ? minX - 1 : maxX + 1;
      if (targetX < 0 || targetX >= current.width) {
        return current;
      }

      return setCellColor(current, targetX, sourceRow, selectedColor);
    });
  }

  function removeBeadAtRowEdge(sourceRow: number, side: 'left' | 'right'): void {
    commitGrid((current) => {
      const row = current.cells[sourceRow];
      if (!row) {
        return current;
      }

      let minX = current.width;
      let maxX = -1;
      for (let x = 0; x < current.width; x += 1) {
        if (row[x]) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }

      if (maxX < 0) {
        return current;
      }

      const targetX = side === 'left' ? minX : maxX;
      return setCellColor(current, targetX, sourceRow, null);
    });
  }

  function setNearestEmptyInRow(current: BeadGrid, rowIndex: number, preferredX: number): BeadGrid {
    const row = current.cells[rowIndex];
    if (!row) {
      return current;
    }

    const startX = Math.max(0, Math.min(current.width - 1, preferredX));
    if (row[startX] === null) {
      return setCellColor(current, startX, rowIndex, selectedColor);
    }

    for (let offset = 1; offset < current.width; offset += 1) {
      const left = startX - offset;
      if (left >= 0 && row[left] === null) {
        return setCellColor(current, left, rowIndex, selectedColor);
      }

      const right = startX + offset;
      if (right < current.width && row[right] === null) {
        return setCellColor(current, right, rowIndex, selectedColor);
      }
    }

    return current;
  }

  function addBeadAtRowFromAnchor(rowIndex: number, anchorX: number): void {
    if (rowIndex < 0 || rowIndex >= grid.height) {
      return;
    }

    commitGrid((current) => setNearestEmptyInRow(current, rowIndex, anchorX));
  }

  function isRowEmpty(current: BeadGrid, rowIndex: number): boolean {
    const row = current.cells[rowIndex];
    if (!row) {
      return false;
    }
    return row.every((cell) => cell === null);
  }

  function findNextEmptyRow(rowIndex: number, direction: 'up' | 'down'): number {
    if (direction === 'up') {
      for (let y = rowIndex - 1; y >= 0; y -= 1) {
        if (isRowEmpty(grid, y)) {
          return y;
        }
      }
      return -1;
    }

    for (let y = rowIndex + 1; y < grid.height; y += 1) {
      if (isRowEmpty(grid, y)) {
        return y;
      }
    }
    return -1;
  }

  function addExtremity(): void {
    if (grid.height < 2) {
      return;
    }

    const maxFromRow = Math.max(grid.height - 2, 0);
    const clampedFromRow = Math.max(0, Math.min(extremityDraft.fromRow, maxFromRow));
    // Parse branch string into array of numbers, clamp each to [1, 24], max 16 segments
    const branch = extremityDraft.branch
      .split(/\s+/)
      .map((n) => Math.max(1, Math.min(24, Math.round(Number(n) || 1))))
      .slice(0, 16);
    setExtremities((previous) => [
      ...previous,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fromRow: clampedFromRow,
        side: extremityDraft.side,
        thread: getExtremityThreadForSide(extremityDraft.side),
        branch,
        color: selectedColor,
        rotationDeg: 0
      }
    ]);
  }

  function removeExtremity(id: string): void {
    setExtremities((previous) => previous.filter((entry) => entry.id !== id));
  }

  function adjustExtremityRotation(id: string, deltaDeg: number): void {
    setExtremities((previous) =>
      previous.map((entry) => {
        if (entry.id !== id) {
          return entry;
        }
        const nextRotation = Math.max(-85, Math.min(85, entry.rotationDeg + deltaDeg));
        return { ...entry, rotationDeg: nextRotation };
      })
    );
  }

  const instructions = useMemo(() => generatePatternInstructions(grid), [grid]);
  const palette = useMemo(() => extractPalette(grid), [grid]);
  const pattern = useMemo(
    () => renderPatternSvg(grid, instructions, { showThreadPath, extremities }),
    [grid, instructions, showThreadPath, extremities]
  );
  const centeredEditorPattern = useMemo(
    () =>
      renderPatternSvg(grid, instructions, {
        showThreadPath,
        extremities,
        showHeaderText: false,
        topMarginOverride: CENTERED_EDITOR_TOP_MARGIN,
        showLegend: false
      }),
    [grid, instructions, showThreadPath, extremities]
  );
  const selectedColorInPreset = useMemo(
    () => PRESET_BEAD_COLORS.some((entry) => entry.hex === selectedColor),
    [selectedColor]
  );

  const centeredRows = useMemo(() => {
    const rowsWithBeads = grid.cells
      .map((row, sourceRow) => {
        const beads = row
          .map((color, x) => ({ color, x }))
          .filter((entry): entry is { color: HexColor; x: number } => entry.color !== null)
          .sort((a, b) => a.x - b.x);

        if (beads.length === 0) {
          return null;
        }

        return {
          sourceRow,
          beads,
          beadCount: beads.length,
          minGridX: beads[0].x,
          maxGridX: beads[beads.length - 1].x
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const patternWidth = centeredEditorPattern.patternWidth;
    const leftMargin = centeredEditorPattern.leftMargin;
    const topMargin = centeredEditorPattern.topMargin;

    return rowsWithBeads.map((row, rowIndex) => {
      const rowWidth = row.beads.length * (SVG_BEAD_WIDTH + SVG_BEAD_GAP_X) - SVG_BEAD_GAP_X;
      const rowX = leftMargin + (patternWidth - rowWidth) / 2;
      const rowY = topMargin + rowIndex * (SVG_BEAD_HEIGHT + SVG_BEAD_GAP_Y);
      return {
        ...row,
        rowX,
        rowY,
        rowWidth
      };
    });
  }, [grid, centeredEditorPattern.leftMargin, centeredEditorPattern.patternWidth, centeredEditorPattern.topMargin]);

  const firstCenteredRow = centeredRows[0] ?? null;
  const firstCenteredRowAnchorX = firstCenteredRow
    ? Math.round((firstCenteredRow.minGridX + firstCenteredRow.maxGridX) / 2)
    : Math.floor(grid.width / 2);
  const nextEmptyAboveFirstRow = firstCenteredRow ? findNextEmptyRow(firstCenteredRow.sourceRow, 'up') : -1;
  const nextEmptyBelowFirstRow = firstCenteredRow ? findNextEmptyRow(firstCenteredRow.sourceRow, 'down') : -1;

  const centeredRowSegments = useMemo(() => {
    const segments = new Map<number, { entry: { x: number; y: number }; exit: { x: number; y: number } }>();
    const outsideOffset = SVG_BEAD_WIDTH * 0.5 + SVG_BEAD_GAP_X + 2;

    centeredRows.forEach((row) => {
      const rowCenterY = row.rowY + SVG_BEAD_HEIGHT * 0.55;
      const leftToRight = row.sourceRow % 2 === 0;
      const firstCenterX = leftToRight ? row.rowX + SVG_BEAD_WIDTH / 2 : row.rowX + row.rowWidth - SVG_BEAD_WIDTH / 2;
      const lastCenterX = leftToRight ? row.rowX + row.rowWidth - SVG_BEAD_WIDTH / 2 : row.rowX + SVG_BEAD_WIDTH / 2;

      segments.set(row.sourceRow, {
        entry: { x: firstCenterX + (leftToRight ? -outsideOffset : outsideOffset), y: rowCenterY },
        exit: { x: lastCenterX + (leftToRight ? outsideOffset : -outsideOffset), y: rowCenterY }
      });
    });

    return segments;
  }, [centeredRows]);

  const extremityGizmos = useMemo(() => {
    const spacing = SVG_BEAD_WIDTH + SVG_BEAD_GAP_X;
    // Must match extremityStartOffset in svgRenderer.ts
    const startOffset = SVG_BEAD_WIDTH + 8;
    const pickSidePoint = (
      segment: { entry: { x: number; y: number }; exit: { x: number; y: number } },
      side: 'left' | 'right'
    ): { x: number; y: number } => {
      if (side === 'left') {
        return segment.entry.x <= segment.exit.x ? segment.entry : segment.exit;
      }
      return segment.entry.x >= segment.exit.x ? segment.entry : segment.exit;
    };

    return extremities
      .map((entry) => {
        const startSegment = centeredRowSegments.get(entry.fromRow);
        const nextSegment = centeredRowSegments.get(entry.fromRow + 1);
        if (!startSegment || !nextSegment) {
          return null;
        }

        const direction = entry.side === 'left' ? -1 : 1;
        const angleRad = (entry.rotationDeg * Math.PI) / 180;
        const ux = direction * Math.cos(angleRad);
        const uy = Math.sin(angleRad);
        const branchLength = Array.isArray(entry.branch) ? entry.branch.length : 1;
        const runLength = startOffset + Math.max(0, branchLength - 1) * spacing;
        const start = pickSidePoint(startSegment, entry.side);
        const end = pickSidePoint(nextSegment, entry.side);
        const midY = (start.y + end.y) / 2;

        const tipX = start.x + ux * runLength;
        const tipY = midY + uy * runLength;

        // Place gizmo past the tip, in the extremity direction
        const gizmoOffset = SVG_BEAD_WIDTH + 24;
        return {
          id: entry.id,
          rotationDeg: entry.rotationDeg,
          x: tipX + ux * gizmoOffset - 24,
          y: tipY + uy * gizmoOffset - 12
        };
      })
      .filter((entry): entry is { id: string; rotationDeg: number; x: number; y: number } => entry !== null);
  }, [extremities, centeredRowSegments]);

  const editorCellWidth = 14 * zoom;
  const editorCellHeight = 18 * zoom;

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>BeadIt</h1>
        <p>Miyuki 11/0 square stitch pattern builder</p>
      </header>

      <section className="controls-panel card">
        <div className="control-group group-edit">
          <h2>Edit</h2>
          <div className="button-row">
            <button type="button" onClick={undo} disabled={history.length === 0}>
              Undo
            </button>
            <button type="button" onClick={redo} disabled={future.length === 0}>
              Redo
            </button>
            <button type="button" onClick={clearGrid}>
              Clear
            </button>
          </div>
        </div>

        <div className="control-group group-extremities">
          <h2>Extremities</h2>
          <button type="button" onClick={() => setShowExtremityPopup(true)}>
            {extremities.length > 0 ? `Manage (${extremities.length})` : 'Add Extremity'}
          </button>
        </div>

        <div className="control-group group-import">
          <h2>Image Import</h2>
          <button type="button" onClick={() => setShowImportPopup(true)}>Import Image</button>
        </div>

        <div className="control-group group-export">
          <h2>Export</h2>
          <button type="button" onClick={() => setShowExportPopup(true)}>Export Options</button>
        </div>
      </section>

      <section className="workspace-grid">
        <article className="card editor-card">
          <div className="editor-toolbar">
            <h2>Pixel Grid Editor</h2>
            <div className="editor-toolbar-controls">
              <div className="editor-toolbar-tools">
                {(Object.keys(TOOL_LABELS) as Tool[]).map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    className={entry === tool ? 'active' : ''}
                    onClick={() => setTool(entry)}
                  >
                    {TOOL_LABELS[entry]}
                  </button>
                ))}
                <input
                  type="color"
                  value={selectedColor}
                  aria-label="Brush color"
                  onChange={(event) => setSelectedColor(event.target.value as HexColor)}
                />
              </div>
              <span className="toolbar-sep" aria-hidden="true" />
              <select
                className="palette-select"
                value={selectedColor}
                aria-label="Bead palette"
                onChange={(event) => setSelectedColor(event.target.value as HexColor)}
              >
                {!selectedColorInPreset && <option value={selectedColor}>Custom ({selectedColor.toUpperCase()})</option>}
                {PRESET_BEAD_COLORS.map((entry) => (
                  <option key={entry.code} value={entry.hex}>
                    {entry.code} - {entry.name} ({entry.hex.toUpperCase()})
                  </option>
                ))}
              </select>
              <span className="toolbar-sep" aria-hidden="true" />
              <div className="editor-view-toggle" aria-label="Editor view mode">
                <button type="button" className={editorView === 'grid' ? 'active' : ''} onClick={() => setEditorView('grid')}>
                  Grid View
                </button>
                <button
                  type="button"
                  className={editorView === 'centered' ? 'active' : ''}
                  onClick={() => setEditorView('centered')}
                >
                  Centered View
                </button>
              </div>
            </div>
          </div>
          <div className="editor-scroll-wrap">
            <div className="editor-zoom-float">
              <button type="button" onClick={() => setZoom((z) => Math.min(2.2, Math.round((z + 0.1) * 10) / 10))} aria-label="Zoom in">+</button>
              <span className="zoom-label">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.1) * 10) / 10))} aria-label="Zoom out">−</button>
            </div>
          {editorView === 'grid' ? (
            <div className="grid-scroll grid-scroll-centered">
              <div
                className="pixel-grid"
                style={{
                  gridTemplateColumns: `repeat(${grid.width}, ${editorCellWidth}px)`,
                  gridTemplateRows: `repeat(${grid.height}, ${editorCellHeight}px)`,
                  touchAction: 'none'
                }}
              >
                {grid.cells.flatMap((row, y) =>
                  row.map((color, x) => (
                    <button
                      key={`${x}-${y}`}
                      type="button"
                      className="pixel-cell"
                      style={{
                        width: editorCellWidth,
                        height: editorCellHeight,
                        background: color ?? '#f6f1ea'
                      }}
                      onPointerDown={(event) => onCellPointerDown(event, x, y)}
                      onPointerEnter={() => onCellPointerEnter(x, y)}
                      aria-label={`Cell ${x + 1}, ${y + 1}`}
                    />
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="grid-scroll">
              <div className="row-edge-mode-toggle" role="group" aria-label="Row edge bead mode">
                <button
                  type="button"
                  className={rowEdgeMode === 'add' ? 'active' : ''}
                  onClick={() => setRowEdgeMode('add')}
                >
                  Add Beads
                </button>
                <button
                  type="button"
                  className={rowEdgeMode === 'remove' ? 'active' : ''}
                  onClick={() => setRowEdgeMode('remove')}
                >
                  Remove Beads
                </button>
              </div>
              {firstCenteredRow && (
                <div className="first-row-actions" role="group" aria-label="First row actions">
                  <button
                    type="button"
                    onClick={() => addBeadAtRowFromAnchor(firstCenteredRow.sourceRow, firstCenteredRowAnchorX)}
                    aria-label={`Add bead in first row ${firstCenteredRow.sourceRow + 1}`}
                    title={`Add bead in first row ${firstCenteredRow.sourceRow + 1}`}
                  >
                    + Bead
                  </button>
                  <button
                    type="button"
                    onClick={() => addBeadAtRowFromAnchor(nextEmptyAboveFirstRow, firstCenteredRowAnchorX)}
                    disabled={nextEmptyAboveFirstRow < 0}
                    aria-label={`Add row above row ${firstCenteredRow.sourceRow + 1} with bead`}
                    title={`Add row above row ${firstCenteredRow.sourceRow + 1} with bead`}
                  >
                    + Row Above
                  </button>
                  <button
                    type="button"
                    onClick={() => addBeadAtRowFromAnchor(nextEmptyBelowFirstRow, firstCenteredRowAnchorX)}
                    disabled={nextEmptyBelowFirstRow < 0}
                    aria-label={`Add row below row ${firstCenteredRow.sourceRow + 1} with bead`}
                    title={`Add row below row ${firstCenteredRow.sourceRow + 1} with bead`}
                  >
                    + Row Below
                  </button>
                </div>
              )}
              <div className="centered-editor-wrap">
                <div
                  className="centered-editor-canvas"
                  style={{
                    width: centeredEditorPattern.width * zoom,
                    height: centeredEditorPattern.height * zoom
                  }}
                >
                  <div
                    className="centered-editor-inner"
                    style={{
                      width: centeredEditorPattern.width,
                      height: centeredEditorPattern.height,
                      transform: `scale(${zoom})`
                    }}
                  >
                    <div
                      className="pattern-preview centered-editor-svg"
                      dangerouslySetInnerHTML={{ __html: centeredEditorPattern.svg }}
                    />
                    {centeredRows.map((row) => {
                      const canAddLeft = row.minGridX > 0;
                      const canAddRight = row.maxGridX < grid.width - 1;
                      const canRemoveLeft = row.beadCount > 0;
                      const canRemoveRight = row.beadCount > 0;
                      const showLeftControl = rowEdgeMode === 'add' ? canAddLeft : canRemoveLeft;
                      const showRightControl = rowEdgeMode === 'add' ? canAddRight : canRemoveRight;
                      const edgeSymbol = rowEdgeMode === 'add' ? '+' : '-';
                      const rowCenterY = row.rowY + SVG_BEAD_HEIGHT / 2;
                      const btnSize = 16; // must match .row-edge-add width/height in CSS

                      return (
                        <div key={`row-controls-${row.sourceRow}`}>
                          {showLeftControl && (
                            <button
                              type="button"
                              className="row-edge-add"
                              style={{ left: row.rowX - btnSize - 4, top: rowCenterY - btnSize / 2 }}
                              onClick={() =>
                                rowEdgeMode === 'add'
                                  ? addBeadAtRowEdge(row.sourceRow, 'left')
                                  : removeBeadAtRowEdge(row.sourceRow, 'left')
                              }
                              aria-label={`${rowEdgeMode === 'add' ? 'Add' : 'Remove'} bead at left edge of row ${row.sourceRow + 1}`}
                              title={`${rowEdgeMode === 'add' ? 'Add' : 'Remove'} bead ${rowEdgeMode === 'add' ? 'to' : 'from'} left edge of row ${row.sourceRow + 1}`}
                            >
                              {edgeSymbol}
                            </button>
                          )}
                          {showRightControl && (
                            <button
                              type="button"
                              className="row-edge-add"
                              style={{ left: row.rowX + row.rowWidth + 4, top: rowCenterY - btnSize / 2 }}
                              onClick={() =>
                                rowEdgeMode === 'add'
                                  ? addBeadAtRowEdge(row.sourceRow, 'right')
                                  : removeBeadAtRowEdge(row.sourceRow, 'right')
                              }
                              aria-label={`${rowEdgeMode === 'add' ? 'Add' : 'Remove'} bead at right edge of row ${row.sourceRow + 1}`}
                              title={`${rowEdgeMode === 'add' ? 'Add' : 'Remove'} bead ${rowEdgeMode === 'add' ? 'to' : 'from'} right edge of row ${row.sourceRow + 1}`}
                            >
                              {edgeSymbol}
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {extremityGizmos.map((gizmo) => (
                      <div key={`extremity-gizmo-${gizmo.id}`} className="extremity-gizmo" style={{ left: gizmo.x, top: gizmo.y }}>
                        <button
                          type="button"
                          onClick={() => adjustExtremityRotation(gizmo.id, -8)}
                          aria-label="Rotate extremity counterclockwise"
                          title="Rotate extremity counterclockwise"
                        >
                          -
                        </button>
                        <span>{Math.round(gizmo.rotationDeg)}deg</span>
                        <button
                          type="button"
                          onClick={() => adjustExtremityRotation(gizmo.id, 8)}
                          aria-label="Rotate extremity clockwise"
                          title="Rotate extremity clockwise"
                        >
                          +
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>

          <div className="pattern-toggle-row">
            <button type="button" onClick={() => setShowPatternDiagram((previous) => !previous)}>
              {showPatternDiagram ? 'Hide Pattern Diagram' : 'Show Pattern Diagram'}
            </button>
          </div>

          {showPatternDiagram && (
            <div className="pattern-diagram-inline">
              <h3>Pattern Diagram (SVG)</h3>
              <div className="pattern-preview" dangerouslySetInnerHTML={{ __html: pattern.svg }} />
            </div>
          )}
        </article>
      </section>

      {showImportPopup && (
        <div className="popup-overlay" onClick={() => setShowImportPopup(false)}>
          <div className="popup-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Image Import">
            <div className="popup-header">
              <h3>Image Import</h3>
              <button type="button" className="popup-close" onClick={() => setShowImportPopup(false)} aria-label="Close">✕</button>
            </div>
            <input
              type="file"
              accept="image/*"
              className="group-import-file"
              onChange={(event: ChangeEvent<HTMLInputElement>) => setUploadFile(event.target.files?.[0] ?? null)}
            />
            <div className="inline-fields">
              <label>
                W
                <input
                  type="number"
                  min={4}
                  max={200}
                  value={settings.width}
                  onChange={(event) => setSettings((prev) => ({ ...prev, width: Number(event.target.value) || prev.width }))}
                />
              </label>
              <label>
                H
                <input
                  type="number"
                  min={4}
                  max={200}
                  value={settings.height}
                  onChange={(event) => setSettings((prev) => ({ ...prev, height: Number(event.target.value) || prev.height }))}
                />
              </label>
              <label>
                Colors
                <input
                  type="number"
                  min={2}
                  max={64}
                  value={settings.maxColors}
                  onChange={(event) =>
                    setSettings((prev) => ({ ...prev, maxColors: Number(event.target.value) || prev.maxColors }))
                  }
                />
              </label>
            </div>
            <div className="button-row">
              <button type="button" onClick={importImage} disabled={!uploadFile || isImporting}>
                {isImporting ? 'Processing...' : 'Pixelate + Reduce Colors'}
              </button>
              <button type="button" onClick={() => changeGridSize(settings.width, settings.height)}>
                Resize Grid
              </button>
            </div>
            {importError && <p className="error-text">{importError}</p>}
          </div>
        </div>
      )}

      {showExportPopup && (
        <div className="popup-overlay" onClick={() => setShowExportPopup(false)}>
          <div className="popup-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Export Options">
            <div className="popup-header">
              <h3>Export Options</h3>
              <button type="button" className="popup-close" onClick={() => setShowExportPopup(false)} aria-label="Close">✕</button>
            </div>
            <button type="button" onClick={() => exportSvgAsPng(pattern.svg, pattern.width, pattern.height, 'bead-pattern.png')}>
              Export PNG
            </button>
            <button
              type="button"
              onClick={() => {
                const lines: string[] = [
                  '## Row-by-Row Weaving Instructions',
                  '',
                  ...instructions.rows.map(
                    (row) =>
                      `Row ${row.rowNumber} (${row.direction === 'left-to-right' ? 'L to R' : 'R to L'}): ${formatRowText(row.sequence)}`
                  ),
                  ...extremities.map(
                    (entry) =>
                      `Extremity rows ${entry.fromRow + 1}\u2013${entry.fromRow + 2} (${entry.side}, ${entry.thread}): [${Array.isArray(entry.branch) ? entry.branch.join(' ') : ''}]`
                  ),
                  '',
                  '## Bead Counts by Color',
                  '',
                  ...palette.map((color) => `${color}: ${instructions.colorCounts[color] ?? 0} beads`)
                ];
                exportSvgAsPdf(pattern.svg, pattern.width, pattern.height, 'bead-pattern.pdf', lines);
              }}
            >
              Export PDF
            </button>
            <label className="label-inline">
              <input
                type="checkbox"
                checked={showThreadPath}
                onChange={(event) => setShowThreadPath(event.target.checked)}
              />
              Show thread path overlay
            </label>
          </div>
        </div>
      )}

      {showExtremityPopup && (
        <div className="popup-overlay" onClick={() => setShowExtremityPopup(false)}>
          <div className="popup-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Extremity Attachment">
            <div className="popup-header">
              <h3>Extremity Attachment</h3>
              <button type="button" className="popup-close" onClick={() => setShowExtremityPopup(false)} aria-label="Close">✕</button>
            </div>
            <label className="label-inline">
              From row
              <select
                value={extremityDraft.fromRow}
                onChange={(event) =>
                  setExtremityDraft((previous) => ({ ...previous, fromRow: Number(event.target.value) || 0 }))
                }
                disabled={grid.height < 2}
              >
                {Array.from({ length: Math.max(grid.height - 1, 1) }, (_, index) => (
                  <option key={`transition-row-${index}`} value={index}>
                    {index + 1} to {index + 2}
                  </option>
                ))}
              </select>
            </label>
            <label className="label-inline">
              Side
              <select
                value={extremityDraft.side}
                onChange={(event) =>
                  setExtremityDraft((previous) => ({ ...previous, side: event.target.value as 'left' | 'right' }))
                }
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </label>
            <label className="label-inline">
              Thread strand
              <select value={getExtremityThreadForSide(extremityDraft.side)} disabled>
                <option value="orange">Orange strand</option>
                <option value="teal">Teal strand</option>
              </select>
            </label>
            <label className="label-inline">
              Branch (beads per segment)
              <input
                type="text"
                value={extremityDraft.branch}
                onChange={(event) =>
                  setExtremityDraft((previous) => ({ ...previous, branch: event.target.value }))
                }
                placeholder="e.g. 1 1 1 1 2 1 2 1"
                pattern="[0-9 ]*"
                title="Space-separated bead counts, e.g. 1 1 1 1 2 1 2 1"
              />
            </label>
            <button type="button" onClick={addExtremity} disabled={grid.height < 2}>
              Add Extremity (Brush Color)
            </button>
            <div className="extremity-list">
              {extremities.length === 0 && <p className="extremity-empty">No off-grid extremities yet.</p>}
              {extremities.map((entry) => (
                <div key={entry.id} className="extremity-row">
                  <span>
                    R{entry.fromRow + 1} to R{entry.fromRow + 2} {entry.side} {entry.thread} [
                    {Array.isArray(entry.branch) ? entry.branch.join(' ') : ''}
                    ] {entry.color}
                  </span>
                  <button type="button" onClick={() => removeExtremity(entry.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
