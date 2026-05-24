import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseGeometricTable } from './table-parser.js';
import { formatGeometricTable, simplifyTable } from './table-formatter.js';

function isCellSplittingRow(lineText: string): boolean {
  const trimmed = lineText.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false;
  const parts = trimmed.split('|');
  const colContents = parts.slice(1, parts.length - 1);
  
  let hasSplitDash = false;
  let hasNonBorderCell = false;
  
  for (const cell of colContents) {
    const trimmedCell = cell.trim();
    if (trimmedCell.length > 0) {
      const isCompleteBorder = /^[-=_]+$/.test(trimmedCell) && !cell.includes(' ');
      const isSplit = (/^[-=_]+/.test(trimmedCell) || /[-=_]+$/.test(trimmedCell)) && !isCompleteBorder;
      if (isSplit) {
        hasSplitDash = true;
      }
      if (!isCompleteBorder) {
        hasNonBorderCell = true;
      }
    } else {
      hasNonBorderCell = true;
    }
  }
  
  return hasSplitDash && hasNonBorderCell;
}

function isPartialBorderRow(text: string): boolean {
  if (isCellSplittingRow(text)) return false;
  const trimmed = text.trim();
  if (!trimmed.startsWith('|')) return false;
  if (!/^[|+\-\s=_]+$/.test(trimmed)) return false;
  if (!/[-=_]/.test(trimmed)) return false;
  if (!trimmed.endsWith('|')) return true;
  
  if (/\| \s*[-=_]/.test(trimmed) || /\|[-=_]\s+/.test(trimmed) || /\s+[-=_]\s*\|/.test(trimmed)) {
    return true;
  }
  return false;
}

interface TestCase {
  before: string[];
  after: string[];
}

function loadTestCases(): TestCase[] {
  const filePath = path.join(__dirname, '../../../test_table_autoadjust');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split(/\r?\n/);

  const cases: TestCase[] = [];
  let currentCase: Partial<TestCase> = {};
  let currentSection: 'before' | 'after' | null = null;
  let currentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('BEFORE')) {
      if (currentCase.after) {
        cases.push(currentCase as TestCase);
        currentCase = {};
      }
      currentSection = 'before';
      currentLines = [];
    } else if (line.startsWith('AFTER')) {
      if (currentSection && currentLines.length > 0) {
        currentCase[currentSection] = currentLines;
      }
      currentSection = 'after';
      currentLines = [];
    } else if (line.trim() === '') {
      if (currentSection && currentLines.length > 0) {
        currentCase[currentSection] = currentLines;
        currentSection = null;
        currentLines = [];
      }
    } else {
      currentLines.push(line);
    }
  }
  if (currentSection && currentLines.length > 0) {
    currentCase[currentSection] = currentLines;
  }
  if (currentCase.after) {
    cases.push(currentCase as TestCase);
  }

  return cases;
}

function findEditedLine(tableLines: string[]): number {
  const isBorderRow = (rowStr: string): boolean => {
    const trimmed = rowStr.trim();
    return /^[|+\-\s=_]+$/.test(trimmed) && (/[-=_]/.test(trimmed) || trimmed.includes('+'));
  };

  const borderRowIndices: number[] = [];
  for (let i = 0; i < tableLines.length; i++) {
    if (isBorderRow(tableLines[i])) {
      borderRowIndices.push(i);
    }
  }

  if (borderRowIndices.length >= 2) {
    const pipeCounts = borderRowIndices.map(idx => {
      return (tableLines[idx].match(/\|/g) || []).length;
    });
    const maxCount = Math.max(...pipeCounts);
    const minCount = Math.min(...pipeCounts);
    if (maxCount > minCount) {
      const maxIndices = borderRowIndices.filter((_, i) => pipeCounts[i] === maxCount);
      if (maxIndices.length === 1) {
        return maxIndices[0];
      }
    }
  }

  for (let i = 0; i < tableLines.length; i++) {
    const line = tableLines[i].trim();
    const firstPipe = line.indexOf('|');
    if (firstPipe > 0 && /[-=_]/.test(line.substring(0, firstPipe))) {
      return i;
    }
  }

  for (let i = 0; i < tableLines.length; i++) {
    const line = tableLines[i].trim();
    const lastPipe = line.lastIndexOf('|');
    if (lastPipe !== -1 && lastPipe < line.length - 1 && /[-=_]/.test(line.substring(lastPipe + 1))) {
      return i;
    }
  }

  for (let i = 0; i < tableLines.length; i++) {
    const line = tableLines[i];
    const parts = line.split('|');
    if (parts.length >= 2) {
      const colContents = parts.slice(1, parts.length - 1);
      for (const cell of colContents) {
        const trimmed = cell.trim();
        const isCompleteBorder = /^[-=_]{2,}$/.test(trimmed) && !cell.includes(' ');
        const hasSplitDash = trimmed.length > 0 &&
          (/^[-=_]+/.test(trimmed) || /[-=_]+$/.test(trimmed)) &&
          !isCompleteBorder;
        if (hasSplitDash) {
          return i;
        }
      }
    }
  }

  return 0;
}

function getLineBoundaryPos(lineText: string, vLines: number[]): number[] {
  const lineVLines: number[] = [];
  for (let colIdx = 0; colIdx < lineText.length; colIdx++) {
    if (lineText[colIdx] === '|') {
      lineVLines.push(colIdx);
    }
  }

  const boundaryPos = Array(vLines.length).fill(-1);
  if (lineVLines.length >= 2 && vLines.length >= 2) {
    boundaryPos[0] = lineVLines[0];
    boundaryPos[vLines.length - 1] = lineVLines[lineVLines.length - 1];
    for (let k = 1; k < lineVLines.length - 1; k++) {
      const s = lineVLines[k];
      let closestIdx = 1;
      let minDiff = Math.abs(s - vLines[1]);
      for (let idx = 2; idx < vLines.length - 1; idx++) {
        const diff = Math.abs(s - vLines[idx]);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      }
      boundaryPos[closestIdx] = s;
    }
  }
  return boundaryPos;
}

function projectNewColumns(tableLines: string[], currentLineIdx: number): string[] {
  const currentLineText = tableLines[currentLineIdx];
  if (!currentLineText) return tableLines;
  
  // 1. Find pipes in the edited line
  const editPipes: number[] = [];
  for (let c = 0; c < currentLineText.length; c++) {
    if (currentLineText[c] === '|' || currentLineText[c] === '+') {
      editPipes.push(c);
    }
  }
  if (editPipes.length < 2) return tableLines;

  // 2. Find stable pipes from other rows
  const stableVLinesSet = new Set<number>();
  for (let l = 0; l < tableLines.length; l++) {
    if (l === currentLineIdx) continue;
    const lineText = tableLines[l];
    for (let c = 0; c < lineText.length; c++) {
      if (lineText[c] === '|') {
        stableVLinesSet.add(c);
      }
    }
  }
  const stableVLines = Array.from(stableVLinesSet).sort((a, b) => a - b);
  if (stableVLines.length < 2) return tableLines;

  // 3. Check if we added columns.
  if (editPipes.length <= stableVLines.length) {
    return tableLines;
  }

  // 4. Map stableVLines to editPipes.
  const mapping = new Map<number, number>();
  mapping.set(0, 0); // stable index -> edit index
  mapping.set(stableVLines.length - 1, editPipes.length - 1);

  for (let i = 1; i < stableVLines.length - 1; i++) {
    const sVal = stableVLines[i];
    let closestIdx = 1;
    let minDiff = Infinity;
    for (let j = 1; j < editPipes.length - 1; j++) {
      const diff = Math.abs(sVal - editPipes[j]);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = j;
      } else if (diff === minDiff) {
        if (i >= stableVLines.length / 2) {
          closestIdx = j;
        }
      }
    }
    mapping.set(i, closestIdx);
  }

  // 5. Identify new pipes in editPipes
  const insertions: { colIdx: number; relPos: number }[] = [];
  for (let i = 0; i < stableVLines.length - 1; i++) {
    const startEditIdx = mapping.get(i)!;
    const endEditIdx = mapping.get(i + 1)!;
    if (endEditIdx > startEditIdx + 1) {
      const stableColWidth = stableVLines[i + 1] - stableVLines[i] - 1;
      for (let k = startEditIdx + 1; k < endEditIdx; k++) {
        const newPipePos = editPipes[k];
        const distFromLeft = newPipePos - editPipes[startEditIdx] - 1;
        const relPos = Math.min(distFromLeft, stableColWidth);
        insertions.push({ colIdx: i, relPos });
      }
    }
  }

  if (insertions.length === 0) return tableLines;

  // Sort insertions in descending order of colIdx and relPos to avoid shifting indices
  insertions.sort((a, b) => {
    if (a.colIdx !== b.colIdx) return b.colIdx - a.colIdx;
    return b.relPos - a.relPos;
  });

  const borderChar = currentLineText.includes('=') ? '=' : (currentLineText.includes('_') ? '_' : '-');

  // 6. Apply insertions to all other rows
  const newTableLines = [...tableLines];
  for (let l = 0; l < tableLines.length; l++) {
    if (l === currentLineIdx) continue;
    let lineText = tableLines[l];
    
    const boundaryPos = getLineBoundaryPos(lineText, stableVLines);
    const trimmed = lineText.trim();
    const isBorder = /^[|+\-\s=_]+$/.test(trimmed) &&
      (/[-=_]/.test(trimmed) || trimmed.includes('+'));

    for (const inst of insertions) {
      const leftBoundaryPos = boundaryPos[inst.colIdx];
      const rightBoundaryPos = boundaryPos[inst.colIdx + 1];

      let insertIdx = -1;
      let insertChar = isBorder ? borderChar : ' ';

      if (leftBoundaryPos !== -1) {
        insertIdx = leftBoundaryPos + 1 + inst.relPos;
        if (rightBoundaryPos !== -1) {
          insertChar = isBorder ? borderChar : '|';
        }
      } else {
        let p = inst.colIdx - 1;
        while (p >= 0 && boundaryPos[p] === -1) {
          p--;
        }
        if (p >= 0) {
          const offset = stableVLines[inst.colIdx] - stableVLines[p];
          insertIdx = boundaryPos[p] + 1 + offset + inst.relPos;
        }
      }

      if (insertIdx !== -1 && insertIdx <= lineText.length) {
        lineText = lineText.substring(0, insertIdx) + insertChar + lineText.substring(insertIdx);
        for (let idx = 0; idx < boundaryPos.length; idx++) {
          if (boundaryPos[idx] !== -1 && boundaryPos[idx] >= insertIdx) {
            boundaryPos[idx]++;
          }
        }
      }
    }
    newTableLines[l] = lineText;
  }

  return newTableLines;
}

describe('Table Layout Editing Integration Tests', () => {
  const testCases = loadTestCases();
  console.log("LOADED TEST CASES:", JSON.stringify(testCases, null, 2));

  testCases.forEach((tc, idx) => {
    it(`should format Case ${idx + 1} correctly`, () => {
      const addLines = tc.before;
      const currentLineIdx = findEditedLine(addLines);

      // Check for middle column addition intent
      const isBorderRow = (rowStr: string): boolean => {
        const trimmed = rowStr.trim();
        return /^[|+\-\s=_]+$/.test(trimmed) && (/[-=_]/.test(trimmed) || trimmed.includes('+'));
      };

      let isMiddleColumnAddition = false;
      let newColIdx = -1;
      let originalTableLines: string[] = [];

      if (isBorderRow(addLines[currentLineIdx])) {
        // Find other border rows to compare
        const otherBorderIdxs = addLines
          .map((_, i) => i)
          .filter(i => i !== currentLineIdx && isBorderRow(addLines[i]));

        if (otherBorderIdxs.length > 0) {
          const stableBorderRowIdx = otherBorderIdxs[0];
          const stableLine = addLines[stableBorderRowIdx];
          const editedLine = addLines[currentLineIdx];

          const stablePipes: number[] = [];
          for (let c = 0; c < stableLine.length; c++) {
            if (stableLine[c] === '|') stablePipes.push(c);
          }

          const editedPipes: number[] = [];
          for (let c = 0; c < editedLine.length; c++) {
            if (editedLine[c] === '|' || editedLine[c] === '+') editedPipes.push(c);
          }

          if (editedPipes.length > stablePipes.length) {
            // Find the extra pipe
            let bestExtraIdx = -1;
            let minAlignError = Infinity;
            for (let e = 1; e < editedPipes.length - 1; e++) {
              let error = 0;
              for (let idx = 0; idx < e; idx++) {
                error += Math.abs(editedPipes[idx] - stablePipes[idx]);
              }
              for (let idx = e; idx < stablePipes.length; idx++) {
                error += Math.abs(editedPipes[idx + 1] - stablePipes[idx]);
              }
              if (error < minAlignError) {
                minAlignError = error;
                bestExtraIdx = e;
              }
            }

            if (bestExtraIdx !== -1) {
              const extraPipePos = editedPipes[bestExtraIdx];
              let stableColIdx = -1;
              let relPipePos = -1;
              let cellTextLen = -1;

              for (let c = 0; c < stablePipes.length - 1; c++) {
                if (stablePipes[c] < extraPipePos && extraPipePos < stablePipes[c + 1]) {
                  stableColIdx = c;
                  const leftEditPipe = editedPipes[bestExtraIdx - 1];
                  const rightEditPipe = editedPipes[bestExtraIdx + 1];
                  const cellText = editedLine.substring(leftEditPipe + 1, rightEditPipe);
                  cellTextLen = cellText.length;
                  relPipePos = extraPipePos - leftEditPipe - 1;
                  break;
                }
              }

              if (stableColIdx !== -1) {
                isMiddleColumnAddition = true;
                const isLeftHalf = relPipePos < (cellTextLen / 2);
                if (isLeftHalf) {
                  newColIdx = stableColIdx;
                } else {
                  newColIdx = stableColIdx + 1;
                }

                // Reconstruct original stable lines
                originalTableLines = [...addLines];
                originalTableLines[currentLineIdx] = stableLine;
              }
            }
          }
        }
      }

      if (isMiddleColumnAddition) {
        const tableStr = originalTableLines.join('\n');
        let tableNode = parseGeometricTable(tableStr);

        // 1. Shift or expand existing cells
        const newCells = tableNode.cells.map(cell => ({ ...cell }));
        for (const cell of newCells) {
          if (cell.column >= newColIdx) {
            cell.column += 1;
          } else if (cell.column + cell.colspan > newColIdx) {
            cell.colspan += 1;
          }
        }

        // 2. Identify gaps in each row and insert empty cells
        for (let r = 0; r < tableNode.rowsCount; r++) {
          const isCovered = newCells.some(
            cell => cell.row <= r && r < cell.row + cell.rowspan &&
                    cell.column <= newColIdx && newColIdx < cell.column + cell.colspan
          );
          if (!isCovered) {
            newCells.push({
              id: `cell_${r}_${newColIdx}`,
              row: r,
              column: newColIdx,
              rowspan: 1,
              colspan: 1,
              content: [],
              classes: [],
              styles: {}
            });
          }
        }

        tableNode.colsCount += 1;
        tableNode.cells = newCells;

        tableNode = simplifyTable(tableNode);
        const formatted = formatGeometricTable(tableNode);
        const expected = tc.after.join('\n');
        expect(formatted).toBe(expected);
        return;
      }

      const addText = addLines[currentLineIdx] || '';
      
      let isLeftColumnAddition = false;
      let isRightColumnAddition = false;
      
      const pipeCount = (addText.match(/\|/g) || []).length;
      if (pipeCount >= 2) {
        const firstPipeInAdd = addText.indexOf('|');
        if (firstPipeInAdd !== -1 && /[-=_]/.test(addText.substring(0, firstPipeInAdd))) {
          isLeftColumnAddition = true;
        } else {
          const lastPipeInAdd = addText.lastIndexOf('|');
          if (lastPipeInAdd !== -1 && lastPipeInAdd < addText.length - 1) {
            const trailingPart = addText.substring(lastPipeInAdd + 1);
            if (/[-=_]/.test(trailingPart)) {
              isRightColumnAddition = true;
            }
          }
        }
      }

      const currentLineText = addLines[currentLineIdx];
      const isColumnAddition = isLeftColumnAddition || isRightColumnAddition;

      let tableLines: string[] = [];
      const borderChar = currentLineText.includes('=') ? '=' : (currentLineText.includes('_') ? '_' : '-');

      for (let l = 0; l < addLines.length; l++) {
        let originalLine = '';
        if (l === currentLineIdx) {
          if (isLeftColumnAddition) {
            originalLine = currentLineText.trim().replace(/^[-=_]+/, '');
          } else if (isRightColumnAddition) {
            originalLine = currentLineText.trim().replace(/[-=_]+$/, '');
          } else {
            originalLine = currentLineText;
          }
        } else {
          originalLine = addLines[l];
        }

        const trimmedOriginal = originalLine.trim();
        const isBorder = /^[|+\-\s=_]+$/.test(trimmedOriginal) &&
          (/[-=_]/.test(trimmedOriginal) || trimmedOriginal.includes('+'));

        if (isLeftColumnAddition) {
          if (l === currentLineIdx) {
            if (isBorder) {
              tableLines.push('|' + borderChar.repeat(3) + originalLine.trim());
            } else {
              tableLines.push('|' + borderChar + '  ' + originalLine.trim());
            }
          } else {
            if (isBorder) {
              tableLines.push('|' + borderChar.repeat(3) + originalLine.trim());
            } else {
              tableLines.push('|   ' + originalLine.trim());
            }
          }
        } else if (isRightColumnAddition) {
          if (l === currentLineIdx) {
            if (isBorder) {
              tableLines.push(originalLine.trimEnd() + borderChar.repeat(3) + '|');
            } else {
              tableLines.push(originalLine.trimEnd() + borderChar + '|');
            }
          } else {
            if (isBorder) {
              tableLines.push(originalLine.trimEnd() + borderChar.repeat(3) + '|');
            } else {
              tableLines.push(originalLine.trimEnd() + '   |');
            }
          }
        } else {
          tableLines.push(originalLine);
        }
      }

      tableLines = projectNewColumns(tableLines, currentLineIdx);

      // Calculate stableVLines by emulating the active document state, skipping the current modified line
      const stableVLinesSet = new Set<number>();
      for (let l = 0; l < tableLines.length; l++) {
        if (l === currentLineIdx) continue;
        const lineText = tableLines[l];
        for (let c = 0; c < lineText.length; c++) {
          if (lineText[c] === '|') {
            stableVLinesSet.add(c);
          }
        }
      }
      const stableVLines = Array.from(stableVLinesSet).sort((a, b) => a - b);
      const isPartialBorder = isPartialBorderRow(currentLineText) && !isColumnAddition;
      if (isPartialBorder) {
        if (stableVLines.length >= 2) {
          const rawParts = currentLineText.split('|');
          const colContents = rawParts.slice(1, rawParts.length - 1);

          let alignedLine = '|';
          for (let i = 0; i < stableVLines.length - 1; i++) {
            const colWidth = stableVLines[i + 1] - stableVLines[i] - 1;
            const rawContent = colContents[i] !== undefined ? colContents[i] : (currentLineText.includes('-') ? '-' : '');
            const trimmedCol = rawContent.trim();
            
            const isColBorder = trimmedCol.length > 0 &&
              /^[|+\-\s=_]+$/.test(rawContent) &&
              /[-=_]/.test(rawContent);

            if (isColBorder || currentLineText.trim() === '|-' || currentLineText.trim() === '|') {
              const borderChar = trimmedCol.includes('=') ? '=' : (trimmedCol.includes('_') ? '_' : '-');
              alignedLine += borderChar.repeat(colWidth) + '|';
            } else {
              alignedLine += rawContent.padEnd(colWidth, ' ').substring(0, colWidth) + '|';
            }
          }
          tableLines[currentLineIdx] = alignedLine;
        }
      }

      // Pre-processing step: Horizontally split cells that contain a split dash
      let updatedTableLines: string[] = [];
      for (let r = 0; r < tableLines.length; r++) {
        const lineText = tableLines[r];
        const isBorder = /^[|+\-\s=_]+$/.test(lineText.trim()) &&
          (/[-=_]/.test(lineText.trim()) || lineText.includes('+')) &&
          !isCellSplittingRow(lineText);

        if (isBorder) {
          updatedTableLines.push(lineText);
          continue;
        }

        const parts = lineText.split('|');
        if (parts.length < 2) {
          updatedTableLines.push(lineText);
          continue;
        }

        const colContents = parts.slice(1, parts.length - 1);
        const splitCols: number[] = [];
        const cleanedCols: string[] = [];

        for (let i = 0; i < colContents.length; i++) {
          const cellText = colContents[i];
          const trimmedCell = cellText.trim();
          const isCompleteBorder = /^[-=_]{2,}$/.test(trimmedCell) && !cellText.includes(' ');
          const hasSplitDash = trimmedCell.length > 0 && 
            (/^[-=_]+/.test(trimmedCell) || /[-=_]+$/.test(trimmedCell)) &&
            !isCompleteBorder;

          if (hasSplitDash) {
            splitCols.push(i);
            let cleaned = cellText;
            cleaned = cleaned.replace(/^[-=_]+/, '');
            cleaned = cleaned.replace(/[-=_]+$/, '');
            cleanedCols.push(cleaned);
          } else {
            cleanedCols.push(cellText);
          }
        }

        if (splitCols.length > 0) {
          const cleanedLine = '|' + cleanedCols.join('|') + '|';
          updatedTableLines.push(cleanedLine);

          let borderRow = '|';
          for (let i = 0; i < colContents.length; i++) {
            const colWidth = (stableVLines[i + 1] !== undefined && stableVLines[i] !== undefined)
              ? (stableVLines[i + 1] - stableVLines[i] - 1)
              : colContents[i].length;
            if (splitCols.includes(i)) {
              const trimmedCell = colContents[i].trim();
              const borderChar = trimmedCell.includes('=') ? '=' : (trimmedCell.includes('_') ? '_' : '-');
              borderRow += borderChar.repeat(colWidth) + '|';
            } else {
              borderRow += ' '.repeat(colWidth) + '|';
            }
          }
          updatedTableLines.push(borderRow);

          let emptyRow = '|';
          for (let i = 0; i < colContents.length; i++) {
            const colWidth = (stableVLines[i + 1] !== undefined && stableVLines[i] !== undefined)
              ? (stableVLines[i + 1] - stableVLines[i] - 1)
              : colContents[i].length;
            emptyRow += ' '.repeat(colWidth) + '|';
          }
          updatedTableLines.push(emptyRow);
        } else {
          updatedTableLines.push(lineText);
        }
      }
      tableLines = updatedTableLines;
      const tableStr = tableLines.join('\n');

      let tableNode = parseGeometricTable(tableStr);
      tableNode = simplifyTable(tableNode);
      const formatted = formatGeometricTable(tableNode);
      const expected = tc.after.join('\n');
      expect(formatted).toBe(expected);
    });
  });
});
