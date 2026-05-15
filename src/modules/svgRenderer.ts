import { BeadGrid, ExtremityAttachment, HexColor, PatternInstructions } from '../types/bead';

interface RenderOptions {
  showThreadPath: boolean;
  extremities: ExtremityAttachment[];
  showHeaderText?: boolean;
  topMarginOverride?: number;
  showLegend?: boolean;
}

function getLegendEntries(colorCounts: Record<HexColor, number>): Array<{ color: HexColor; count: number }> {
  return Object.entries(colorCounts)
    .map(([color, count]) => ({ color: color as HexColor, count }))
    .sort((a, b) => b.count - a.count);
}

function pickSegmentSidePoint(
  segment: { entry: { x: number; y: number }; exit: { x: number; y: number } },
  side: 'left' | 'right'
): { x: number; y: number } {
  if (side === 'left') {
    return segment.entry.x <= segment.exit.x ? segment.entry : segment.exit;
  }
  return segment.entry.x >= segment.exit.x ? segment.entry : segment.exit;
}

export function renderPatternSvg(
  grid: BeadGrid,
  instructions: PatternInstructions,
  options: RenderOptions
): {
  svg: string;
  width: number;
  height: number;
  leftMargin: number;
  topMargin: number;
  patternWidth: number;
} {
  const beadWidth = 13;
  const beadHeight = 16;
  const beadGapX = 3;
  const beadGapY = 5;
  const extremityStep = beadWidth + beadGapX;
  // Bring extremities closer by reducing offset
  const extremityStartOffset = beadWidth + 8;
  const extremityLaneOffset = 2.2;

  const showLegend = options.showLegend !== false;
  const baseLeftMargin = 80;
  const baseTopMargin = options.topMarginOverride ?? 108;
  const baseRightMargin = showLegend ? 260 : 70;
  const baseBottomMargin = 70;

  let leftExtra = 0;
  let rightExtra = 0;
  let topExtra = 0;
  let bottomExtra = 0;
  for (const extremity of options.extremities) {
    // Each branch entry is a position: 1 = single bead, 2 = side-by-side pair
    const branch = Array.isArray(extremity.branch) && extremity.branch.length > 0
      ? extremity.branch.map((n) => Math.max(1, Math.min(2, Math.floor(n))))
      : [1];
    const angleRad = ((extremity.rotationDeg ?? 0) * Math.PI) / 180;
    const pairOffset = 11; // perpendicular offset for count=2 pairs
    // Reach is based on number of positions, plus perpendicular extent for pairs
    const reach = extremityStartOffset + Math.max(0, branch.length - 1) * extremityStep + beadWidth + 32;
    // Also account for perpendicular spread of pairs
    const hasPairs = branch.some((n) => n === 2);
    const horizontalReach = Math.abs(Math.cos(angleRad)) * reach;
    const verticalReach = Math.sin(angleRad) * reach;

    if (extremity.side === 'left') {
      leftExtra = Math.max(leftExtra, horizontalReach);
    } else {
      rightExtra = Math.max(rightExtra, horizontalReach);
    }

    if (verticalReach < 0) {
      topExtra = Math.max(topExtra, -verticalReach + (hasPairs ? pairOffset : 0));
    } else {
      bottomExtra = Math.max(bottomExtra, verticalReach + (hasPairs ? pairOffset : 0));
    }
  }

  const leftMargin = baseLeftMargin + Math.ceil(leftExtra);
  const topMargin = baseTopMargin + Math.ceil(topExtra);
  const rightMargin = baseRightMargin + Math.ceil(rightExtra);
  const bottomMargin = baseBottomMargin + Math.ceil(bottomExtra);

  const rowsWithBeads = grid.cells
    .map((row, sourceRow) => ({
      sourceRow,
      leftToRight: sourceRow % 2 === 0,
      beads: row
        .map((color, x) => ({ color, x }))
        .filter((entry): entry is { color: HexColor; x: number } => entry.color !== null)
        .sort((a, b) => a.x - b.x)
    }))
    .filter((row) => row.beads.length > 0);

  const maxBeadCount = rowsWithBeads.reduce((max, row) => Math.max(max, row.beads.length), 1);
  const patternWidth = maxBeadCount * (beadWidth + beadGapX) - beadGapX;
  const patternHeight = rowsWithBeads.length * (beadHeight + beadGapY) - beadGapY;

  const legendColumnWidth = showLegend ? 220 : 0;
  const legendX = Math.max(leftMargin + patternWidth + 30, leftMargin + 320);
  const minimumWidth = leftMargin + patternWidth + rightMargin;
  const width = showLegend ? Math.max(minimumWidth, legendX + legendColumnWidth) : minimumWidth;
  const height = topMargin + patternHeight + bottomMargin;

  let beadShapes = '';
  let rowLabels = '';
  let rowWireHints = '';
  let extremityBeads = '';
  let extremityThreadPaths = '';
  const rowThreadSegments: Array<{
    rowIndex: number;
    sourceRow: number;
    leftToRight: boolean;
    entry: { x: number; y: number };
    centers: Array<{ x: number; y: number }>;
    exit: { x: number; y: number };
  }> = [];

  rowsWithBeads.forEach((row, rowIndex) => {
    const rowY = topMargin + rowIndex * (beadHeight + beadGapY);
    const rowWidth = row.beads.length * (beadWidth + beadGapX) - beadGapX;
    const rowX = leftMargin + (patternWidth - rowWidth) / 2;
    const rowCenterY = rowY + beadHeight * 0.55;
    const beadCenters: Array<{ x: number; y: number; rowIndex: number }> = [];

    rowLabels += `<text x="${leftMargin - 30}" y="${rowY + beadHeight * 0.72}" font-size="12" font-family="Georgia, serif" fill="#253341">${row.sourceRow + 1}</text>`;

    const leftOuterX = rowX - 14;
    const leftInnerX = rowX - 2;
    const rightInnerX = rowX + rowWidth + 2;
    const rightOuterX = rowX + rowWidth + 14;

    if (rowIndex > 0) {
      rowWireHints += `<line x1="${leftOuterX}" y1="${rowCenterY}" x2="${leftInnerX}" y2="${rowCenterY}" stroke="#4f6274" stroke-width="1.5"/>`;
      rowWireHints += `<polygon points="${leftInnerX},${rowCenterY} ${leftInnerX - 5},${rowCenterY - 3} ${leftInnerX - 5},${rowCenterY + 3}" fill="#4f6274"/>`;
      rowWireHints += `<line x1="${rightOuterX}" y1="${rowCenterY}" x2="${rightInnerX}" y2="${rowCenterY}" stroke="#4f6274" stroke-width="1.5"/>`;
      rowWireHints += `<polygon points="${rightInnerX},${rowCenterY} ${rightInnerX + 5},${rowCenterY - 3} ${rightInnerX + 5},${rowCenterY + 3}" fill="#4f6274"/>`;
    }

    row.beads.forEach((bead, beadIndex) => {
      const px = rowX + beadIndex * (beadWidth + beadGapX);
      const cy = rowY + beadHeight / 2;
      const cx = px + beadWidth / 2;

      beadShapes += `<rect x="${px}" y="${rowY}" width="${beadWidth}" height="${beadHeight}" rx="4.2" ry="4.2" fill="${bead.color}" stroke="#8b8b8b" stroke-width="0.8"/>`;
      beadShapes += `<ellipse cx="${px + beadWidth * 0.38}" cy="${rowY + beadHeight * 0.36}" rx="${beadWidth * 0.2}" ry="${beadHeight * 0.18}" fill="rgba(255,255,255,0.35)"/>`;
      beadCenters.push({ x: cx, y: cy, rowIndex });
    });

    const orderedCenters = row.leftToRight ? beadCenters : [...beadCenters].reverse();
    const outsideOffset = beadWidth * 0.5 + beadGapX + 2;
    const entry = {
      x: orderedCenters[0].x + (row.leftToRight ? -outsideOffset : outsideOffset),
      y: orderedCenters[0].y
    };
    const lastCenter = orderedCenters[orderedCenters.length - 1];
    const exit = {
      x: lastCenter.x + (row.leftToRight ? outsideOffset : -outsideOffset),
      y: lastCenter.y
    };

    rowThreadSegments.push({
      rowIndex,
      sourceRow: row.sourceRow,
      leftToRight: row.leftToRight,
      entry,
      centers: orderedCenters.map((point) => ({ x: point.x, y: point.y })),
      exit
    });
  });

  const segmentBySourceRow = new Map<number, (typeof rowThreadSegments)[number]>();
  rowThreadSegments.forEach((segment) => {
    segmentBySourceRow.set(segment.sourceRow, segment);
  });

  const extremityColorCounts: Record<HexColor, number> = {};
  for (const extremity of options.extremities) {
    const startSegment = segmentBySourceRow.get(extremity.fromRow);
    const nextSegment = segmentBySourceRow.get(extremity.fromRow + 1);
    if (!startSegment || !nextSegment) {
      continue;
    }

    const branch = Array.isArray(extremity.branch) && extremity.branch.length > 0
      ? extremity.branch.map((n) => Math.max(1, Math.min(2, Math.floor(n))))
      : [1];
    const direction = extremity.side === 'left' ? -1 : 1;
    const strandColor = extremity.side === 'left' ? '#2f7285' : '#d94926';
    const start = pickSegmentSidePoint(startSegment, extremity.side);
    const end = pickSegmentSidePoint(nextSegment, extremity.side);

    const angleRad = ((extremity.rotationDeg ?? 0) * Math.PI) / 180;
    const ux = direction * Math.cos(angleRad);
    const uy = Math.sin(angleRad);
    // Perpendicular unit vector (for side-by-side pair offset)
    const nx = -uy;
    const ny = ux;
    const step = extremityStep;
    const midY = (start.y + end.y) / 2;
    const pairOffset = 11;

    // Each branch[i] is a position along the extremity:
    //   1 = single bead, both thread lanes converge through it
    //   2 = pair of beads side-by-side (perpendicular), threads split
    // forwardThreadPoints: outbound thread passes through these
    // returnThreadPoints: inbound (return) thread passes through these
    const forwardThreadPoints: Array<{ x: number; y: number }> = [];
    const returnThreadPoints: Array<{ x: number; y: number }> = [];

    branch.forEach((count, posIndex) => {
      const cx = start.x + ux * (extremityStartOffset + posIndex * step);
      const cy = midY + uy * (extremityStartOffset + posIndex * step);

      if (count === 1) {
        // Single bead on center line
        extremityBeads += `<rect x="${cx - beadWidth / 2}" y="${cy - beadHeight / 2}" width="${beadWidth}" height="${beadHeight}" rx="4.2" ry="4.2" fill="${extremity.color}" stroke="#8b8b8b" stroke-width="0.8"/>`;
        extremityBeads += `<ellipse cx="${cx - beadWidth * 0.12}" cy="${cy - beadHeight * 0.14}" rx="${beadWidth * 0.2}" ry="${beadHeight * 0.18}" fill="rgba(255,255,255,0.35)"/>`;
        // Both thread lanes pass through the same bead (small offset for visual clarity)
        forwardThreadPoints.push({ x: cx + nx * extremityLaneOffset, y: cy + ny * extremityLaneOffset });
        returnThreadPoints.push({ x: cx - nx * extremityLaneOffset, y: cy - ny * extremityLaneOffset });
      } else {
        // Pair: two beads offset perpendicular to direction
        // Forward bead (+nx offset), return bead (-nx offset)
        const beadA = { x: cx + nx * pairOffset, y: cy + ny * pairOffset };
        const beadB = { x: cx - nx * pairOffset, y: cy - ny * pairOffset };
        extremityBeads += `<rect x="${beadA.x - beadWidth / 2}" y="${beadA.y - beadHeight / 2}" width="${beadWidth}" height="${beadHeight}" rx="4.2" ry="4.2" fill="${extremity.color}" stroke="#8b8b8b" stroke-width="0.8"/>`;
        extremityBeads += `<ellipse cx="${beadA.x - beadWidth * 0.12}" cy="${beadA.y - beadHeight * 0.14}" rx="${beadWidth * 0.2}" ry="${beadHeight * 0.18}" fill="rgba(255,255,255,0.35)"/>`;
        extremityBeads += `<rect x="${beadB.x - beadWidth / 2}" y="${beadB.y - beadHeight / 2}" width="${beadWidth}" height="${beadHeight}" rx="4.2" ry="4.2" fill="${extremity.color}" stroke="#8b8b8b" stroke-width="0.8"/>`;
        extremityBeads += `<ellipse cx="${beadB.x - beadWidth * 0.12}" cy="${beadB.y - beadHeight * 0.14}" rx="${beadWidth * 0.2}" ry="${beadHeight * 0.18}" fill="rgba(255,255,255,0.35)"/>`;
        forwardThreadPoints.push(beadA);
        returnThreadPoints.push(beadB);
      }
    });

    if (options.showThreadPath && forwardThreadPoints.length > 0) {
      const lastFwd = forwardThreadPoints[forwardThreadPoints.length - 1];
      const lastRtn = returnThreadPoints[returnThreadPoints.length - 1];
      const approachPull = 11;
      const loopRadius = Math.max(beadWidth * 0.48, 4.5);

      // Outbound path: start → forward through all positions
      let pathData = `M ${start.x} ${start.y}`;
      pathData += ` C ${start.x + ux * approachPull} ${start.y + uy * approachPull}, ${forwardThreadPoints[0].x - ux * (approachPull * 0.6)} ${forwardThreadPoints[0].y - uy * (approachPull * 0.6)}, ${forwardThreadPoints[0].x} ${forwardThreadPoints[0].y}`;
      for (let i = 1; i < forwardThreadPoints.length; i += 1) {
        pathData += ` L ${forwardThreadPoints[i].x} ${forwardThreadPoints[i].y}`;
      }
      // Loop: arc from last forward point around to last return point
      pathData += ` C ${lastFwd.x + ux * loopRadius} ${lastFwd.y + uy * loopRadius}, ${lastRtn.x + ux * loopRadius} ${lastRtn.y + uy * loopRadius}, ${lastRtn.x} ${lastRtn.y}`;
      // Return path: back through positions in reverse
      for (let i = returnThreadPoints.length - 2; i >= 0; i -= 1) {
        pathData += ` L ${returnThreadPoints[i].x} ${returnThreadPoints[i].y}`;
      }
      // Smooth return to end of row segment
      const firstRtn = returnThreadPoints[0];
      pathData += ` C ${firstRtn.x - ux * (approachPull * 0.6)} ${firstRtn.y - uy * (approachPull * 0.6)}, ${end.x - ux * approachPull} ${end.y - uy * approachPull}, ${end.x} ${end.y}`;

      extremityThreadPaths += `<path d="${pathData}" fill="none" stroke="${strandColor}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" opacity="0.86"/>`;
    }
    // Count all beads (1 per single position, 2 per pair position)
    extremityColorCounts[extremity.color] = (extremityColorCounts[extremity.color] ?? 0) + branch.reduce((a, b) => a + b, 0);
  }

  let legend = '';
  if (showLegend) {
    const legendTitleY = topMargin + 18;
    legend = `<text x="${legendX}" y="${legendTitleY}" font-size="16" font-family="Georgia, serif" fill="#122230">Legend</text>`;

    const legendCounts: Record<HexColor, number> = { ...instructions.colorCounts };
    Object.entries(extremityColorCounts).forEach(([color, count]) => {
      const colorKey = color as HexColor;
      legendCounts[colorKey] = (legendCounts[colorKey] ?? 0) + count;
    });

    const legendEntries = getLegendEntries(legendCounts);
    legendEntries.forEach((entry, index) => {
      const y = legendTitleY + 24 + index * 20;
      legend += `<rect x="${legendX}" y="${y - 11}" width="13" height="11" rx="3" ry="3" fill="${entry.color}" stroke="#666" stroke-width="0.6"/>`;
      legend += `<text x="${legendX + 20}" y="${y}" font-size="11" font-family="Arial, sans-serif" fill="#1c2a35">${entry.color} (${entry.count})</text>`;
    });
  }

  let threadPathSvg = '';
  let firstRowSplitSvg = '';
  if (options.showThreadPath && rowThreadSegments.length > 0) {
    const extremityTransitionsBySide = new Set<string>();
    for (const extremity of options.extremities) {
      const startSegment = segmentBySourceRow.get(extremity.fromRow);
      const nextSegment = segmentBySourceRow.get(extremity.fromRow + 1);
      if (startSegment && nextSegment) {
        extremityTransitionsBySide.add(`${extremity.fromRow}:${extremity.side}`);
      }
    }

    const firstSegment = rowThreadSegments[0];
    const firstCenterX = (firstSegment.entry.x + firstSegment.exit.x) / 2;
    const firstCenterY = firstSegment.entry.y;
    const splitOffset = 1.5;
    const splitCurvePull = Math.max((firstSegment.exit.x - firstSegment.entry.x) * 0.22, beadWidth * 1.4);
    const leftGuide = `M ${firstCenterX} ${firstCenterY - splitOffset} C ${firstCenterX - splitCurvePull} ${firstCenterY - splitOffset}, ${firstSegment.entry.x + splitCurvePull * 0.2} ${firstSegment.entry.y - splitOffset}, ${firstSegment.entry.x} ${firstSegment.entry.y - splitOffset}`;
    const rightGuide = `M ${firstCenterX} ${firstCenterY + splitOffset} C ${firstCenterX + splitCurvePull} ${firstCenterY + splitOffset}, ${firstSegment.exit.x - splitCurvePull * 0.2} ${firstSegment.exit.y + splitOffset}, ${firstSegment.exit.x} ${firstSegment.exit.y + splitOffset}`;
    firstRowSplitSvg = `<path d="${leftGuide}" fill="none" stroke="#2f7285" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" opacity="0.86"/>`;
    firstRowSplitSvg += `<path d="${rightGuide}" fill="none" stroke="#d94926" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" opacity="0.86"/>`;
    firstRowSplitSvg += `<circle cx="${firstCenterX}" cy="${firstCenterY}" r="1.6" fill="#3c4550" opacity="0.85"/>`;

    const buildContinuationPath = (
      startSide: 'entry' | 'exit',
      yOffset: number,
      mirroredAcrossRows: boolean
    ): string => {
      if (rowThreadSegments.length <= 1) {
        return '';
      }

      const startPoint = startSide === 'entry' ? firstSegment.entry : firstSegment.exit;
      let pathData = `M ${startPoint.x} ${startPoint.y + yOffset}`;

      let previousTerminal: { x: number; y: number } = startPoint;
      let previousSideSign =
        startSide === 'entry'
          ? firstSegment.leftToRight
            ? -1
            : 1
          : firstSegment.leftToRight
            ? 1
            : -1;

      for (let rowIndex = 1; rowIndex < rowThreadSegments.length; rowIndex += 1) {
        const previousSegment = rowThreadSegments[rowIndex - 1];
        const currentSegment = rowThreadSegments[rowIndex];

        const currentStart = mirroredAcrossRows ? currentSegment.exit : currentSegment.entry;
        const currentEnd = mirroredAcrossRows ? currentSegment.entry : currentSegment.exit;
        const currentCenters = mirroredAcrossRows
          ? [...currentSegment.centers].reverse()
          : currentSegment.centers;

        const currentStartSideSign = mirroredAcrossRows
          ? currentSegment.leftToRight
            ? 1
            : -1
          : currentSegment.leftToRight
            ? -1
            : 1;
        const currentEndSideSign = mirroredAcrossRows
          ? currentSegment.leftToRight
            ? -1
            : 1
          : currentSegment.leftToRight
            ? 1
            : -1;

        const previousLeft = pickSegmentSidePoint(previousSegment, 'left');
        const previousRight = pickSegmentSidePoint(previousSegment, 'right');
        const currentLeft = pickSegmentSidePoint(currentSegment, 'left');
        const currentRight = pickSegmentSidePoint(currentSegment, 'right');
        const previousDistLeft = Math.hypot(previousTerminal.x - previousLeft.x, previousTerminal.y - previousLeft.y);
        const previousDistRight = Math.hypot(previousTerminal.x - previousRight.x, previousTerminal.y - previousRight.y);
        const currentDistLeft = Math.hypot(currentStart.x - currentLeft.x, currentStart.y - currentLeft.y);
        const currentDistRight = Math.hypot(currentStart.x - currentRight.x, currentStart.y - currentRight.y);
        const previousIsLeft = previousDistLeft <= previousDistRight;
        const currentIsLeft = currentDistLeft <= currentDistRight;
        const transitionSide = previousIsLeft === currentIsLeft
          ? previousIsLeft
            ? 'left'
            : 'right'
          : (previousTerminal.x + currentStart.x) / 2 < (previousLeft.x + previousRight.x + currentLeft.x + currentRight.x) / 4
            ? 'left'
            : 'right';

        const transitionUsesExtremity = extremityTransitionsBySide.has(`${previousSegment.sourceRow}:${transitionSide}`);
        if (transitionUsesExtremity) {
          pathData += ` M ${currentStart.x} ${currentStart.y + yOffset}`;
        } else {
          const dy = currentStart.y - previousTerminal.y;
          const dx = currentStart.x - previousTerminal.x;
          const outward = beadWidth * 0.85;
          const verticalPull = dy * 0.38;
          const horizontalBlend = dx * 0.2;
          const controlA = `${previousTerminal.x + previousSideSign * outward + horizontalBlend} ${previousTerminal.y + verticalPull + yOffset}`;
          const controlB = `${currentStart.x + currentStartSideSign * outward - horizontalBlend} ${currentStart.y - verticalPull + yOffset}`;
          pathData += ` C ${controlA}, ${controlB}, ${currentStart.x} ${currentStart.y + yOffset}`;
        }

        pathData += ` L ${currentCenters[0].x} ${currentCenters[0].y + yOffset}`;
        for (let i = 1; i < currentCenters.length; i += 1) {
          pathData += ` L ${currentCenters[i].x} ${currentCenters[i].y + yOffset}`;
        }
        pathData += ` L ${currentEnd.x} ${currentEnd.y + yOffset}`;

        previousTerminal = currentEnd;
        previousSideSign = currentEndSideSign;
      }

      return pathData;
    };

    const tealPathData = buildContinuationPath('entry', -splitOffset, true);
    const orangePathData = buildContinuationPath('exit', splitOffset, false);
    if (tealPathData) {
      threadPathSvg += `<path d="${tealPathData}" fill="none" stroke="#2f7285" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" opacity="0.78"/>`;
    }
    if (orangePathData) {
      threadPathSvg += `<path d="${orangePathData}" fill="none" stroke="#d94926" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" opacity="0.78"/>`;
    }
  }

  const headerText = options.showHeaderText === false
    ? ''
    : `<text x="${leftMargin}" y="${topMargin - 28}" font-size="18" font-family="Georgia, serif" fill="#142534">Miyuki 11/0 - Square Stitch Pattern</text>
  <text x="${leftMargin}" y="${topMargin - 11}" font-size="12" font-family="Arial, sans-serif" fill="#3a4d5e">Only filled beads are shown; rows are centered by bead count.</text>`;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#fffdf8"/>
  ${headerText}
  ${rowLabels}
  ${rowWireHints}
  ${beadShapes}
  ${extremityBeads}
  ${firstRowSplitSvg}
  ${threadPathSvg}
  ${extremityThreadPaths}
  ${legend}
</svg>`;

  return { svg: svg.trim(), width, height, leftMargin, topMargin, patternWidth };
}
