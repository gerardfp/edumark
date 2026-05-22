import { TableNode, TableCell } from '@edumark/shared';

export function formatGeometricTable(table: TableNode): string {
  if (table.rowsCount === 0 || table.colsCount === 0 || table.cells.length === 0) {
    return '';
  }

  const { rowsCount, colsCount, cells } = table;

  // 1. Initialize Column Widths to a minimum width of 3
  const colWidths = Array(colsCount).fill(3);

  // 2. Compile cell lines (including properties if defined)
  const cellLinesMap = new Map<string, string[]>();
  for (const cell of cells) {
    const lines: string[] = [];
    // Check if we need to write properties block
    const hasClasses = cell.classes && cell.classes.length > 0;
    const hasStyles = cell.styles && Object.keys(cell.styles).length > 0;
    if (hasClasses || hasStyles) {
      const parts: string[] = [];
      if (hasClasses) {
        parts.push(...cell.classes.map(c => `.${c}`));
      }
      if (hasStyles) {
        parts.push(...Object.entries(cell.styles).map(([k, v]) => `${k}: ${v}`));
      }
      lines.push(`{${parts.join('; ')}}`);
    }

    lines.push(...cell.content);
    cellLinesMap.set(cell.id, lines);
  }

  // 3. Resolve Column Widths dynamically to ensure all content fits
  // First pass: colspan = 1
  for (const cell of cells) {
    if (cell.colspan === 1) {
      const lines = cellLinesMap.get(cell.id) || [];
      const maxLength = Math.max(...lines.map(l => l.length), 0);
      // Pad by 2 (1 space on each side)
      colWidths[cell.column] = Math.max(colWidths[cell.column], maxLength + 2);
    }
  }

  // Second pass: colspan > 1 (distribute extra width if needed)
  for (const cell of cells) {
    if (cell.colspan > 1) {
      const lines = cellLinesMap.get(cell.id) || [];
      const maxLength = Math.max(...lines.map(l => l.length), 0);
      const minCellWidth = maxLength + 2;

      // Sum current widths of spanned columns plus the separators (|)
      let currentWidth = 0;
      for (let c = cell.column; c < cell.column + cell.colspan; c++) {
        currentWidth += colWidths[c];
      }
      currentWidth += cell.colspan - 1; // For the | separators

      if (currentWidth < minCellWidth) {
        const deficiency = minCellWidth - currentWidth;
        const addPerCol = Math.ceil(deficiency / cell.colspan);
        for (let c = cell.column; c < cell.column + cell.colspan; c++) {
          colWidths[c] += addPerCol;
        }
      }
    }
  }

  // 4. Resolve Row Heights
  const rowHeights = Array(rowsCount).fill(1);

  // Establish minimum heights based on colspan/rowspan = 1 cells
  for (const cell of cells) {
    if (cell.rowspan === 1) {
      const lines = cellLinesMap.get(cell.id) || [];
      rowHeights[cell.row] = Math.max(rowHeights[cell.row], lines.length);
    }
  }

  // Ensure rowspan > 1 cells fit their content
  for (const cell of cells) {
    if (cell.rowspan > 1) {
      const lines = cellLinesMap.get(cell.id) || [];
      const requiredHeight = lines.length;
      let currentHeight = 0;
      for (let r = cell.row; r < cell.row + cell.rowspan; r++) {
        currentHeight += rowHeights[r];
      }

      if (currentHeight < requiredHeight) {
        const deficiency = requiredHeight - currentHeight;
        const addPerRow = Math.ceil(deficiency / cell.rowspan);
        for (let r = cell.row; r < cell.row + cell.rowspan; r++) {
          rowHeights[r] += addPerRow;
        }
      }
    }
  }

  // 4. Distribute cell lines across their row span
  const cellAllocatedLines = new Map<string, string[]>();
  for (const cell of cells) {
    const lines = cellLinesMap.get(cell.id) || [];
    // Sum the heights of the rows spanned by this cell
    let totalHeight = 0;
    for (let r = cell.row; r < cell.row + cell.rowspan; r++) {
      totalHeight += rowHeights[r];
    }
    // Pad lines with empty strings up to totalHeight
    const padded = [...lines];
    while (padded.length < totalHeight) {
      padded.push('');
    }
    cellAllocatedLines.set(cell.id, padded);
  }

  // Helper to get grid cell at (j, i)
  const getCellAt = (j: number, i: number): TableCell | undefined => {
    return cells.find(
      c => c.row <= j && j < c.row + c.rowspan && c.column <= i && i < c.column + c.colspan
    );
  };

  // Helper to slice allocated lines for a cell at a specific row interval and line offset
  const getCellLine = (cell: TableCell, j: number, lineOffset: number): string => {
    const allLines = cellAllocatedLines.get(cell.id) || [];
    // Calculate the start index in allLines for row interval j
    let startIndex = 0;
    for (let r = cell.row; r < j; r++) {
      startIndex += rowHeights[r];
    }
    return allLines[startIndex + lineOffset] || '';
  };

  const outputLines: string[] = [];

  // 5. Draw the table
  // Top border
  let topBorder = '|';
  for (let i = 0; i < colsCount; i++) {
    topBorder += '-'.repeat(colWidths[i]) + '|';
  }
  outputLines.push(topBorder);

  // Draw content rows and mid/bottom borders
  for (let j = 0; j < rowsCount; j++) {
    // Content lines for row interval j
    const height = rowHeights[j];
    for (let k = 0; k < height; k++) {
      let contentLine = '|';
      for (let i = 0; i < colsCount; i++) {
        const cell = getCellAt(j, i);
        if (!cell) {
          contentLine += ' '.repeat(colWidths[i]) + '|';
          continue;
        }

        // Only draw if this is the start of the cell (top-left) in this column interval
        if (cell.column === i) {
          const rawLine = getCellLine(cell, j, k);
          // Calculate cell width spanning multiple columns
          let cellWidth = 0;
          for (let c = cell.column; c < cell.column + cell.colspan; c++) {
            cellWidth += colWidths[c];
          }
          cellWidth += cell.colspan - 1; // include intermediate borders

          // Format line (left-aligned with padding)
          const formatted = rawLine.trim().padEnd(cellWidth - 1, ' ');
          contentLine += ' ' + formatted; // 1 space padding on left
        }

        // Draw vertical border on the right of column i
        // If the cell at (j, i) is merged horizontally with (j, i+1), don't draw |
        const nextCell = i < colsCount - 1 ? getCellAt(j, i + 1) : undefined;
        if (nextCell && nextCell.id === cell.id) {
          // merged, do nothing (we already printed its space as part of cellWidth)
        } else {
          contentLine += '|';
        }
      }
      outputLines.push(contentLine);
    }

    // Draw border line below row interval j
    let borderLine = '|';
    for (let i = 0; i < colsCount; i++) {
      const cellAbove = getCellAt(j, i);
      const cellBelow = j < rowsCount - 1 ? getCellAt(j + 1, i) : undefined;

      // If cellAbove is merged vertically with cellBelow (rowspan), do not draw a border
      if (cellAbove && cellBelow && cellAbove.id === cellBelow.id) {
        borderLine += ' '.repeat(colWidths[i]);
      } else {
        borderLine += '-'.repeat(colWidths[i]);
      }

      // Intersection border on the right of column i
      const nextCellAbove = i < colsCount - 1 ? getCellAt(j, i + 1) : undefined;
      const nextCellBelow = i < colsCount - 1 && j < rowsCount - 1 ? getCellAt(j + 1, i + 1) : undefined;

      const isRightBorderMerged =
        cellAbove && nextCellAbove && cellAbove.id === nextCellAbove.id &&
        (!cellBelow || !nextCellBelow || cellBelow.id !== nextCellBelow.id || cellBelow.id !== cellAbove.id);

      const isBottomRightMerged =
        cellAbove && cellBelow && cellAbove.id === cellBelow.id &&
        nextCellAbove && nextCellBelow && nextCellAbove.id === nextCellBelow.id &&
        cellAbove.id === nextCellAbove.id;

      if (isBottomRightMerged) {
        borderLine += ' ';
      } else if (cellAbove && cellBelow && cellAbove.id === cellBelow.id &&
                 nextCellAbove && nextCellBelow && nextCellAbove.id === nextCellBelow.id) {
        // Vertical borders on left and right are active, but horizontal is empty
        borderLine += '|';
      } else {
        borderLine += '|';
      }
    }
    outputLines.push(borderLine);
  }

  return outputLines.join('\n');
}
