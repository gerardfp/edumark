"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const table_parser_js_1 = require("./table-parser.js");
const table_formatter_js_1 = require("./table-formatter.js");
function isCellSplittingRow(lineText) {
    const trimmed = lineText.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|'))
        return false;
    const parts = trimmed.split('|');
    const colContents = parts.slice(1, parts.length - 1);
    let hasSplitDash = false;
    let hasNonBorderCell = false;
    for (const cell of colContents) {
        const trimmedCell = cell.trim();
        if (trimmedCell.length > 0) {
            const isCompleteBorder = /^[-=_]{2,}$/.test(trimmedCell) && !cell.includes(' ');
            const isSplit = (/^[-=_]+/.test(trimmedCell) || /[-=_]+$/.test(trimmedCell)) && !isCompleteBorder;
            if (isSplit) {
                hasSplitDash = true;
            }
            if (!isCompleteBorder) {
                hasNonBorderCell = true;
            }
        }
        else {
            hasNonBorderCell = true;
        }
    }
    return hasSplitDash && hasNonBorderCell;
}
function isPartialBorderRow(text) {
    if (isCellSplittingRow(text))
        return false;
    const trimmed = text.trim();
    if (!trimmed.startsWith('|'))
        return false;
    if (!/^[|+\-\s=_]+$/.test(trimmed))
        return false;
    if (!/[-=_]/.test(trimmed))
        return false;
    if (!trimmed.endsWith('|'))
        return true;
    if (/\| \s*[-=_]/.test(trimmed) || /\|[-=_]\s+/.test(trimmed) || /\s+[-=_]\s*\|/.test(trimmed)) {
        return true;
    }
    return false;
}
function loadTestCases() {
    const filePath = path.join(__dirname, '../../../table_editing');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split(/\r?\n/);
    const cases = [];
    let currentCase = {};
    let currentSection = null;
    let currentLines = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('BEFORE')) {
            if (currentCase.after) {
                cases.push(currentCase);
                currentCase = {};
            }
            currentSection = 'before';
            currentLines = [];
        }
        else if (line.startsWith('ADD')) {
            if (currentSection && currentLines.length > 0) {
                currentCase[currentSection] = currentLines;
            }
            currentSection = 'add';
            currentLines = [];
        }
        else if (line.startsWith('AFTER')) {
            if (currentSection && currentLines.length > 0) {
                currentCase[currentSection] = currentLines;
            }
            currentSection = 'after';
            currentLines = [];
        }
        else if (line.trim() === '') {
            if (currentSection && currentLines.length > 0) {
                currentCase[currentSection] = currentLines;
                currentSection = null;
                currentLines = [];
            }
        }
        else {
            currentLines.push(line);
        }
    }
    if (currentSection && currentLines.length > 0) {
        currentCase[currentSection] = currentLines;
    }
    if (currentCase.after) {
        cases.push(currentCase);
    }
    return cases;
}
(0, vitest_1.describe)('Table Layout Editing Integration Tests', () => {
    const testCases = loadTestCases();
    console.log("LOADED TEST CASES:", JSON.stringify(testCases, null, 2));
    testCases.forEach((tc, idx) => {
        (0, vitest_1.it)(`should format Case ${idx + 1} correctly`, () => {
            const addLines = tc.add;
            const beforeLines = tc.before;
            // Find the modified line (the line that contains the added dash or differs from BEFORE)
            let currentLineIdx = -1;
            for (let i = 0; i < addLines.length; i++) {
                if (addLines[i] !== beforeLines[i]) {
                    currentLineIdx = i;
                    break;
                }
            }
            if (currentLineIdx === -1) {
                currentLineIdx = 0;
            }
            const beforeText = beforeLines[currentLineIdx];
            const addText = addLines[currentLineIdx];
            let isLeftColumnAddition = false;
            let isRightColumnAddition = false;
            const firstPipeInAdd = addText.indexOf('|');
            if (firstPipeInAdd !== -1 && addText.substring(0, firstPipeInAdd).includes('-')) {
                isLeftColumnAddition = true;
            }
            else {
                const lastPipeBefore = beforeText.lastIndexOf('|');
                if (lastPipeBefore !== -1 && addText.length > beforeText.length) {
                    const trailingPart = addText.substring(lastPipeBefore + 1);
                    if (trailingPart.includes('-')) {
                        isRightColumnAddition = true;
                    }
                }
            }
            const currentLineText = addLines[currentLineIdx];
            const isColumnAddition = isLeftColumnAddition || isRightColumnAddition;
            let tableLines = [];
            const borderChar = currentLineText.includes('=') ? '=' : (currentLineText.includes('_') ? '_' : '-');
            for (let l = 0; l < addLines.length; l++) {
                let originalLine = '';
                if (l === currentLineIdx) {
                    if (isLeftColumnAddition) {
                        originalLine = currentLineText.trim().replace(/^[-=_]+/, '');
                    }
                    else if (isRightColumnAddition) {
                        originalLine = currentLineText.trim().replace(/[-=_]+$/, '');
                    }
                    else {
                        originalLine = currentLineText;
                    }
                }
                else {
                    originalLine = addLines[l];
                }
                const trimmedOriginal = originalLine.trim();
                const isBorder = /^[|+\-\s=_]+$/.test(trimmedOriginal) &&
                    (/[-=_]/.test(trimmedOriginal) || trimmedOriginal.includes('+'));
                if (isLeftColumnAddition) {
                    if (l === currentLineIdx) {
                        if (isBorder) {
                            tableLines.push('|' + borderChar.repeat(3) + originalLine.trim());
                        }
                        else {
                            tableLines.push('|' + borderChar + '  ' + originalLine.trim());
                        }
                    }
                    else {
                        if (isBorder) {
                            tableLines.push('|' + borderChar.repeat(3) + originalLine.trim());
                        }
                        else {
                            tableLines.push('|   ' + originalLine.trim());
                        }
                    }
                }
                else if (isRightColumnAddition) {
                    if (l === currentLineIdx) {
                        if (isBorder) {
                            tableLines.push(originalLine.trimEnd() + borderChar.repeat(3) + '|');
                        }
                        else {
                            tableLines.push(originalLine.trimEnd() + borderChar + '|');
                        }
                    }
                    else {
                        if (isBorder) {
                            tableLines.push(originalLine.trimEnd() + borderChar.repeat(3) + '|');
                        }
                        else {
                            tableLines.push(originalLine.trimEnd() + '   |');
                        }
                    }
                }
                else {
                    tableLines.push(originalLine);
                }
            }
            // Calculate stableVLines by emulating the active document state, skipping the current modified line
            const stableVLinesSet = new Set();
            for (let l = 0; l < tableLines.length; l++) {
                if (l === currentLineIdx)
                    continue;
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
                        }
                        else {
                            alignedLine += rawContent.padEnd(colWidth, ' ').substring(0, colWidth) + '|';
                        }
                    }
                    tableLines[currentLineIdx] = alignedLine;
                }
            }
            // Pre-processing step: Horizontally split cells that contain a split dash
            let updatedTableLines = [];
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
                const splitCols = [];
                const cleanedCols = [];
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
                    }
                    else {
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
                        }
                        else {
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
                }
                else {
                    updatedTableLines.push(lineText);
                }
            }
            tableLines = updatedTableLines;
            if (idx === 11) {
                console.log("DEBUG TABLE LINES:", JSON.stringify(tableLines, null, 2));
            }
            const tableStr = tableLines.join('\n');
            const tableNode = (0, table_parser_js_1.parseGeometricTable)(tableStr);
            const formatted = (0, table_formatter_js_1.formatGeometricTable)(tableNode);
            const expected = tc.after.join('\n');
            (0, vitest_1.expect)(formatted).toBe(expected);
        });
    });
});
//# sourceMappingURL=table-editing-integration.test.js.map