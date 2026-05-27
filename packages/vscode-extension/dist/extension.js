"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../parser/dist/lexer.js
var require_lexer = __commonJS({
  "../parser/dist/lexer.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.tokenize = tokenize;
    function tokenize(source) {
      const rawLines = source.split(/\r?\n/);
      const tokens = [];
      let inFrontmatter = false;
      let inCodeBlock = false;
      let hasFrontmatterStarted = false;
      for (let idx = 0; idx < rawLines.length; idx++) {
        const rawLine = rawLines[idx];
        const line = rawLine.trim();
        const lineNum = idx + 1;
        if (line.startsWith("```")) {
          if (!inFrontmatter) {
            inCodeBlock = !inCodeBlock;
            tokens.push({ type: "CODE_BLOCK_TOGGLE", text: rawLine, lineNum });
            continue;
          }
        }
        if (inCodeBlock) {
          tokens.push({ type: "TEXT_LINE", text: rawLine, lineNum });
          continue;
        }
        if (line === "---") {
          if (!hasFrontmatterStarted && idx === 0) {
            inFrontmatter = true;
            hasFrontmatterStarted = true;
            tokens.push({ type: "FRONTMATTER_BOUNDARY", text: line, lineNum });
            continue;
          } else if (inFrontmatter) {
            inFrontmatter = false;
            tokens.push({ type: "FRONTMATTER_BOUNDARY", text: line, lineNum });
            continue;
          }
        }
        if (inFrontmatter) {
          tokens.push({ type: "FRONTMATTER_LINE", text: rawLine, lineNum });
          continue;
        }
        if (line.startsWith("@") && !line.startsWith("@end") && /^[a-zA-Z]/.test(line.substring(1))) {
          tokens.push({ type: "DIRECTIVE_START", text: line, lineNum });
          continue;
        }
        if (/^@end(-[a-zA-Z0-9_\-]+)?$/.test(line)) {
          tokens.push({ type: "DIRECTIVE_END", text: line, lineNum });
          continue;
        }
        if (line.startsWith("|")) {
          tokens.push({ type: "TABLE_LINE", text: rawLine, lineNum });
          continue;
        }
        if (line.startsWith("- ")) {
          tokens.push({ type: "LIST_ITEM_LINE", text: rawLine, lineNum });
          continue;
        }
        if (line === "") {
          tokens.push({ type: "EMPTY_LINE", text: "", lineNum });
          continue;
        }
        tokens.push({ type: "TEXT_LINE", text: rawLine, lineNum });
      }
      return tokens;
    }
  }
});

// ../parser/dist/table-parser.js
var require_table_parser = __commonJS({
  "../parser/dist/table-parser.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.parseGeometricTable = parseGeometricTable;
    var DSU = class {
      parent;
      constructor(size) {
        this.parent = Array.from({ length: size }, (_, i) => i);
      }
      find(i) {
        if (this.parent[i] === i)
          return i;
        this.parent[i] = this.find(this.parent[i]);
        return this.parent[i];
      }
      union(i, j) {
        const rootI = this.find(i);
        const rootJ = this.find(j);
        if (rootI !== rootJ) {
          this.parent[rootI] = rootJ;
        }
      }
    };
    function parseGeometricTable(tableStr, isRubric = false, preserveEmptyLines = false) {
      const rawLines = tableStr.split(/\r?\n/).map((line) => line.trimEnd());
      const lines = rawLines.filter((line) => line.length > 0);
      if (lines.length === 0) {
        return { type: "table", rowsCount: 0, colsCount: 0, cells: [], isRubric };
      }
      const maxLength = Math.max(...lines.map((line) => line.length));
      const grid = lines.map((line) => line.padEnd(maxLength, " "));
      const hLines = [];
      for (let r = 0; r < grid.length; r++) {
        const rowStr = grid[r];
        const isBorderRow = /^[|+\-\s=_]+$/.test(rowStr) && (/[-=_]/.test(rowStr) || rowStr.includes("+"));
        if (isBorderRow) {
          hLines.push(r);
        }
      }
      if (hLines.length < 2) {
        return { type: "table", rowsCount: 0, colsCount: 0, cells: [], isRubric };
      }
      const vLinesSet = /* @__PURE__ */ new Set();
      for (const r of hLines) {
        const rowStr = grid[r];
        for (let c = 0; c < rowStr.length; c++) {
          if (rowStr[c] === "|" || rowStr[c] === "+") {
            vLinesSet.add(c);
          }
        }
      }
      const vLines = Array.from(vLinesSet).sort((a, b) => a - b);
      if (vLines.length < 2) {
        return { type: "table", rowsCount: 0, colsCount: 0, cells: [], isRubric };
      }
      const H = hLines.length;
      const V = vLines.length;
      const rowIntervalsCount = H - 1;
      const colIntervalsCount = V - 1;
      const getUnitId = (j, i) => j * colIntervalsCount + i;
      const dsu = new DSU(rowIntervalsCount * colIntervalsCount);
      for (let j = 0; j < rowIntervalsCount; j++) {
        const rStart = hLines[j] + 1;
        const rEnd = hLines[j + 1] - 1;
        const activeBoundaries = /* @__PURE__ */ new Set();
        if (rStart > rEnd) {
          let targetJ = -1;
          if (j > 0) {
            targetJ = j - 1;
          } else if (rowIntervalsCount > 1) {
            targetJ = j + 1;
          }
          if (targetJ !== -1) {
            const adjStart = hLines[targetJ] + 1;
            const adjEnd = hLines[targetJ + 1] - 1;
            for (let r = adjStart; r <= adjEnd; r++) {
              const lineText = grid[r];
              const lineVLines = [];
              for (let c = 0; c < lineText.length; c++) {
                if (lineText[c] === "|") {
                  lineVLines.push(c);
                }
              }
              if (lineVLines.length >= 2) {
                if (lineVLines.length >= vLines.length) {
                  for (let idx = 1; idx < lineVLines.length - 1; idx++) {
                    const s = lineVLines[idx];
                    if (vLines.length > 2) {
                      let closestVal = vLines[1];
                      let minDiff = Math.abs(s - vLines[1]);
                      for (let vIdx = 2; vIdx < vLines.length - 1; vIdx++) {
                        const diff = Math.abs(s - vLines[vIdx]);
                        if (diff < minDiff) {
                          minDiff = diff;
                          closestVal = vLines[vIdx];
                        }
                      }
                      activeBoundaries.add(closestVal);
                    }
                  }
                } else {
                  for (const s of lineVLines) {
                    let closestVal = vLines[0];
                    let minDiff = Math.abs(s - vLines[0]);
                    for (let vIdx = 1; vIdx < vLines.length; vIdx++) {
                      const diff = Math.abs(s - vLines[vIdx]);
                      if (diff < minDiff) {
                        minDiff = diff;
                        closestVal = vLines[vIdx];
                      }
                    }
                    if (closestVal !== vLines[0] && closestVal !== vLines[vLines.length - 1]) {
                      activeBoundaries.add(closestVal);
                    }
                  }
                }
              }
            }
          } else {
            for (const v of vLines) {
              activeBoundaries.add(v);
            }
          }
        } else {
          for (let r = rStart; r <= rEnd; r++) {
            const lineText = grid[r];
            const lineVLines = [];
            for (let c = 0; c < lineText.length; c++) {
              if (lineText[c] === "|") {
                lineVLines.push(c);
              }
            }
            if (lineVLines.length >= 2) {
              if (lineVLines.length >= vLines.length) {
                for (let idx = 1; idx < lineVLines.length - 1; idx++) {
                  const s = lineVLines[idx];
                  if (vLines.length > 2) {
                    let closestVal = vLines[1];
                    let minDiff = Math.abs(s - vLines[1]);
                    for (let vIdx = 2; vIdx < vLines.length - 1; vIdx++) {
                      const diff = Math.abs(s - vLines[vIdx]);
                      if (diff < minDiff) {
                        minDiff = diff;
                        closestVal = vLines[vIdx];
                      }
                    }
                    activeBoundaries.add(closestVal);
                  }
                }
              } else {
                for (const s of lineVLines) {
                  let closestVal = vLines[0];
                  let minDiff = Math.abs(s - vLines[0]);
                  for (let vIdx = 1; vIdx < vLines.length; vIdx++) {
                    const diff = Math.abs(s - vLines[vIdx]);
                    if (diff < minDiff) {
                      minDiff = diff;
                      closestVal = vLines[vIdx];
                    }
                  }
                  if (closestVal !== vLines[0] && closestVal !== vLines[vLines.length - 1]) {
                    activeBoundaries.add(closestVal);
                  }
                }
              }
            }
          }
        }
        for (let i = 0; i < colIntervalsCount - 1; i++) {
          const boundaryColVal = vLines[i + 1];
          if (!activeBoundaries.has(boundaryColVal)) {
            dsu.union(getUnitId(j, i), getUnitId(j, i + 1));
          }
        }
      }
      for (let j = 0; j < rowIntervalsCount - 1; j++) {
        const boundaryRow = hLines[j + 1];
        for (let i = 0; i < colIntervalsCount; i++) {
          const cStart = vLines[i] + 1;
          const cEnd = vLines[i + 1] - 1;
          let borderExists = false;
          for (let c = cStart; c <= cEnd; c++) {
            const char = grid[boundaryRow][c];
            if (char === "-" || char === "=" || char === "+" || char === "_") {
              borderExists = true;
              break;
            }
          }
          if (!borderExists) {
            dsu.union(getUnitId(j, i), getUnitId(j + 1, i));
          }
        }
      }
      const groups = /* @__PURE__ */ new Map();
      for (let j = 0; j < rowIntervalsCount; j++) {
        for (let i = 0; i < colIntervalsCount; i++) {
          const unitId = getUnitId(j, i);
          const root = dsu.find(unitId);
          if (!groups.has(root)) {
            groups.set(root, []);
          }
          groups.get(root).push({ j, i });
        }
      }
      const cells = [];
      let cellCounter = 1;
      for (const group of groups.values()) {
        const minJ = Math.min(...group.map((g) => g.j));
        const maxJ = Math.max(...group.map((g) => g.j));
        const minI = Math.min(...group.map((g) => g.i));
        const maxI = Math.max(...group.map((g) => g.i));
        const rowspan = maxJ - minJ + 1;
        const colspan = maxI - minI + 1;
        const contentLines = [];
        for (let j = minJ; j <= maxJ; j++) {
          const rStart = hLines[j] + 1;
          const rEnd = hLines[j + 1] - 1;
          for (let r = rStart; r <= rEnd; r++) {
            const lineText = grid[r];
            const lineVLines = [];
            for (let c = 0; c < lineText.length; c++) {
              if (lineText[c] === "|") {
                lineVLines.push(c);
              }
            }
            let slice = "";
            if (lineVLines.length >= 2) {
              const boundaryPos = Array(vLines.length).fill(-1);
              if (lineVLines.length >= vLines.length) {
                boundaryPos[0] = lineVLines[0];
                boundaryPos[vLines.length - 1] = lineVLines[lineVLines.length - 1];
                for (let idx = 1; idx < lineVLines.length - 1; idx++) {
                  const s = lineVLines[idx];
                  if (vLines.length > 2) {
                    let closestIdx = 1;
                    let minDiff = Math.abs(s - vLines[1]);
                    for (let vIdx = 2; vIdx < vLines.length - 1; vIdx++) {
                      const diff = Math.abs(s - vLines[vIdx]);
                      if (diff < minDiff) {
                        minDiff = diff;
                        closestIdx = vIdx;
                      }
                    }
                    boundaryPos[closestIdx] = s;
                  }
                }
              } else {
                for (const s of lineVLines) {
                  let closestIdx = 0;
                  let minDiff = Math.abs(s - vLines[0]);
                  for (let vIdx = 1; vIdx < vLines.length; vIdx++) {
                    const diff = Math.abs(s - vLines[vIdx]);
                    if (diff < minDiff) {
                      minDiff = diff;
                      closestIdx = vIdx;
                    }
                  }
                  boundaryPos[closestIdx] = s;
                }
              }
              const startPos = boundaryPos[minI];
              const endPos = boundaryPos[maxI + 1];
              if (startPos !== -1 && endPos !== -1) {
                slice = lineText.substring(startPos + 1, endPos);
              } else {
                const colStart = vLines[minI] + 1;
                const colEnd = vLines[maxI + 1] - 1;
                slice = lineText.substring(colStart, colEnd + 1);
              }
            } else {
              const colStart = vLines[minI] + 1;
              const colEnd = vLines[maxI + 1] - 1;
              slice = lineText.substring(colStart, colEnd + 1);
            }
            contentLines.push(slice);
          }
        }
        let classes = [];
        const styles = {};
        const processedLines = [...contentLines];
        if (processedLines.length > 0) {
          const firstLineTrimmed = processedLines[0].trim();
          const match = firstLineTrimmed.match(/^\{([^}]+)\}$/);
          if (match) {
            processedLines.shift();
            const propStr = match[1];
            const parts = propStr.split(";").map((p) => p.trim());
            for (const part of parts) {
              if (part.startsWith(".")) {
                classes.push(part.substring(1));
              } else if (part.includes(":")) {
                const idx = part.indexOf(":");
                const key = part.substring(0, idx).trim();
                const val = part.substring(idx + 1).trim();
                styles[key] = val;
              }
            }
          }
        }
        let minLeadingSpaces = Infinity;
        for (const line of processedLines) {
          if (line.trim() !== "") {
            const match = line.match(/^( *)/);
            const leading = match ? match[1].length : 0;
            if (leading < minLeadingSpaces) {
              minLeadingSpaces = leading;
            }
          }
        }
        if (minLeadingSpaces === Infinity) {
          minLeadingSpaces = 0;
        }
        const finalContent = processedLines.map((line) => {
          if (line.trim() === "")
            return "";
          const leftStripped = line.substring(minLeadingSpaces);
          return leftStripped.trimEnd();
        });
        if (!preserveEmptyLines) {
          while (finalContent.length > 0 && finalContent[finalContent.length - 1] === "") {
            finalContent.pop();
          }
          while (finalContent.length > 0 && finalContent[0] === "") {
            finalContent.shift();
          }
        }
        cells.push({
          id: `cell-${cellCounter++}`,
          row: minJ,
          column: minI,
          rowspan,
          colspan,
          content: finalContent,
          classes,
          styles
        });
      }
      const colWidths = [];
      for (let i = 0; i < colIntervalsCount; i++) {
        colWidths.push(vLines[i + 1] - vLines[i] - 1);
      }
      return {
        type: "table",
        rowsCount: rowIntervalsCount,
        colsCount: colIntervalsCount,
        cells,
        isRubric,
        colWidths
      };
    }
  }
});

// ../parser/dist/parser.js
var require_parser = __commonJS({
  "../parser/dist/parser.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.parse = parse2;
    var lexer_js_1 = require_lexer();
    var table_parser_js_1 = require_table_parser();
    function parseFrontmatter(lines) {
      const meta = {};
      for (const line of lines) {
        const trim = line.trim();
        if (!trim)
          continue;
        const idx = trim.indexOf(":");
        if (idx !== -1) {
          const k = trim.substring(0, idx).trim();
          const v = trim.substring(idx + 1).trim();
          meta[k] = v;
        }
      }
      return meta;
    }
    function parse2(source) {
      const tokens = (0, lexer_js_1.tokenize)(source);
      const errors = [];
      let tokenIdx = 0;
      let frontmatter = {};
      if (tokens.length > 0 && tokens[0].type === "FRONTMATTER_BOUNDARY") {
        tokenIdx++;
        const fmLines = [];
        let closed = false;
        while (tokenIdx < tokens.length) {
          const tok = tokens[tokenIdx];
          if (tok.type === "FRONTMATTER_BOUNDARY") {
            closed = true;
            tokenIdx++;
            break;
          } else if (tok.type === "FRONTMATTER_LINE") {
            fmLines.push(tok.text);
            tokenIdx++;
          } else {
            fmLines.push(tok.text);
            tokenIdx++;
          }
        }
        if (!closed) {
          errors.push({
            message: 'Frontmatter sin cerrar. Se esperaba "---".',
            lineNum: tokens[0].lineNum
          });
        }
        frontmatter = parseFrontmatter(fmLines);
      }
      const { nodes: astChildren } = parseBlocks(tokens.slice(tokenIdx), errors);
      const ast = {
        type: "document",
        frontmatter,
        children: astChildren
      };
      return { ast, errors };
    }
    function parseBlocks(tokens, errors, state = { idx: 0 }, parentDirectives = []) {
      const nodes = [];
      while (state.idx < tokens.length) {
        const tok = tokens[state.idx];
        if (tok.type === "EMPTY_LINE") {
          state.idx++;
          continue;
        }
        if (tok.type === "CODE_BLOCK_TOGGLE") {
          const startLine = tok.lineNum;
          const langMatch = tok.text.trim().match(/^```([a-zA-Z0-9+\-#_]+)?/);
          const language = langMatch ? langMatch[1] : void 0;
          state.idx++;
          const codeLines = [];
          let closed = false;
          while (state.idx < tokens.length) {
            const nextTok = tokens[state.idx];
            if (nextTok.type === "CODE_BLOCK_TOGGLE") {
              closed = true;
              state.idx++;
              break;
            } else {
              codeLines.push(nextTok.text);
              state.idx++;
            }
          }
          if (!closed) {
            errors.push({
              message: 'Bloque de c\xF3digo sin cerrar con "```".',
              lineNum: startLine
            });
          }
          nodes.push({
            type: "code-block",
            language,
            content: codeLines.join("\n")
          });
          continue;
        }
        if (tok.type === "TABLE_LINE") {
          const tableLines = [];
          const startLine = tok.lineNum;
          while (state.idx < tokens.length && tokens[state.idx].type === "TABLE_LINE") {
            tableLines.push(tokens[state.idx].text);
            state.idx++;
          }
          try {
            const tableNode = (0, table_parser_js_1.parseGeometricTable)(tableLines.join("\n"));
            if (tableNode.cells.length > 0) {
              nodes.push(tableNode);
            } else {
              errors.push({
                message: "Estructura de tabla inv\xE1lida o vac\xEDa.",
                lineNum: startLine
              });
            }
          } catch (err) {
            errors.push({
              message: `Error al procesar la tabla geom\xE9trica: ${err.message}`,
              lineNum: startLine
            });
          }
          continue;
        }
        if (tok.type === "LIST_ITEM_LINE") {
          const itemText = tok.text.trim().substring(2);
          let checked = void 0;
          let content = itemText;
          if (itemText.startsWith("[ ]")) {
            checked = false;
            content = itemText.substring(3).trim();
          } else if (itemText.startsWith("[x]") || itemText.startsWith("[X]")) {
            checked = true;
            content = itemText.substring(3).trim();
          }
          nodes.push({
            type: "list-item",
            checked,
            content
          });
          state.idx++;
          continue;
        }
        if (tok.type === "DIRECTIVE_START") {
          const startLine = tok.lineNum;
          const lineText = tok.text.trim();
          const match = lineText.match(/^@([a-zA-Z0-9_\-]+)(.*)$/);
          if (!match) {
            state.idx++;
            continue;
          }
          const dirName = match[1];
          const dirArgsStr = match[2].trim();
          const args = {};
          const argPairs = dirArgsStr.split(/\s+/).filter(Boolean);
          for (const pair of argPairs) {
            const eqIdx = pair.indexOf("=");
            if (eqIdx !== -1) {
              args[pair.substring(0, eqIdx).trim()] = pair.substring(eqIdx + 1).trim();
            } else {
              args["title"] = (args["title"] ? args["title"] + " " : "") + pair;
            }
          }
          if (dirName === "section") {
            const title = dirArgsStr || void 0;
            nodes.push({
              type: "directive",
              name: "section",
              title,
              children: []
            });
            state.idx++;
            continue;
          }
          state.idx++;
          const { nodes: children, closed: innerClosed } = parseBlocks(tokens, errors, state, [...parentDirectives, dirName]);
          if (!innerClosed) {
            errors.push({
              message: `Bloque did\xE1ctico "@${dirName}" sin cerrar. Se esperaba "@end" o "@end-${dirName}".`,
              lineNum: startLine
            });
          }
          if (dirName === "question") {
            const questionType = args["type"] || "multiple-choice";
            let promptLines = [];
            const options = [];
            let explanation = void 0;
            for (const child of children) {
              if (child.type === "paragraph") {
                promptLines.push(child.content);
              } else if (child.type === "list-item") {
                options.push({
                  checked: child.checked || false,
                  text: child.content
                });
              } else if (child.type === "directive" && child.name === "solution") {
                const solPara = child.children.find((c) => c.type === "paragraph");
                if (solPara) {
                  explanation = solPara.content;
                }
              }
            }
            nodes.push({
              type: "question",
              questionType,
              prompt: promptLines.join("\n\n"),
              options,
              explanation
            });
          } else {
            const title = dirArgsStr || void 0;
            if (dirName === "rubric") {
              for (const child of children) {
                if (child.type === "table") {
                  child.isRubric = true;
                }
              }
            }
            nodes.push({
              type: "directive",
              name: dirName,
              title,
              children
            });
          }
          continue;
        }
        if (tok.type === "DIRECTIVE_END") {
          const endText = tok.text.trim();
          if (endText === "@end") {
            if (parentDirectives.length > 0) {
              state.idx++;
              return { nodes, closed: true };
            } else {
              state.idx++;
              continue;
            }
          } else if (endText.startsWith("@end-")) {
            const endName = endText.substring(5).trim();
            const foundIdx = parentDirectives.lastIndexOf(endName);
            if (foundIdx !== -1) {
              if (foundIdx === parentDirectives.length - 1) {
                state.idx++;
                return { nodes, closed: true };
              } else {
                return { nodes, closed: true };
              }
            } else {
              state.idx++;
              continue;
            }
          }
        }
        if (tok.type === "TEXT_LINE") {
          const paragraphLines = [];
          while (state.idx < tokens.length && tokens[state.idx].type === "TEXT_LINE") {
            paragraphLines.push(tokens[state.idx].text);
            state.idx++;
          }
          nodes.push({
            type: "paragraph",
            content: paragraphLines.join("\n")
          });
          continue;
        }
        state.idx++;
      }
      return { nodes, closed: false };
    }
  }
});

// ../parser/dist/index.js
var require_dist = __commonJS({
  "../parser/dist/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    __exportStar(require_lexer(), exports2);
    __exportStar(require_parser(), exports2);
  }
});

// ../renderer-html/dist/renderer.js
var require_renderer = __commonJS({
  "../renderer-html/dist/renderer.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.formatInline = formatInline;
    exports2.renderToHTML = renderToHTML2;
    function escapeHTML(str) {
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    function formatInline(text) {
      let html = escapeHTML(text);
      html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="edu-img" />');
      html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="edu-link">$1</a>');
      html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
      html = html.replace(/`(.*?)`/g, '<code class="edu-inline-code">$1</code>');
      return html;
    }
    function renderToHTML2(doc, customStyles = "") {
      const frontmatterHTML = renderFrontmatter(doc.frontmatter);
      const childrenHTML = renderNodes(doc.children);
      return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=scale=1.0">
  <title>${escapeHTML(doc.frontmatter.title || "Recurso Educativo Edumark")}</title>
  <style>
    /* Reset & CSS Variables for harmonious colors and rich typography */
    :root {
      --primary-color: #3b82f6;
      --primary-dark: #2563eb;
      --bg-color: #f8fafc;
      --text-color: #1e293b;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
      
      --card-bg: #ffffff;
      --didyouknow-bg: #eff6ff;
      --didyouknow-border: #bfdbfe;
      --warning-bg: #fff7ed;
      --warning-border: #ffedd5;
      --hint-bg: #f0fdf4;
      --hint-border: #bbf7d0;
      --solution-bg: #faf5ff;
      --solution-border: #f3e8ff;
      --reflection-bg: #f5f3ff;
      --reflection-border: #edd9ff;
      --activity-bg: #fff1f2;
      --activity-border: #ffe4e6;
      --note-bg: #f8fafc;
      --note-border: #cbd5e1;
    }

    body {
      font-family: 'Outfit', 'Inter', system-ui, -apple-system, sans-serif;
      line-height: 1.6;
      color: var(--text-color);
      background-color: var(--bg-color);
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    header.edu-header {
      margin-bottom: 3rem;
      padding-bottom: 1.5rem;
      border-bottom: 2px solid var(--border-color);
    }

    h1.edu-title {
      font-size: 2.5rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 0.5rem 0;
      background: linear-gradient(to right, #2563eb, #3b82f6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .edu-meta {
      display: flex;
      gap: 1.5rem;
      font-size: 0.95rem;
      color: var(--text-muted);
    }

    .edu-section {
      margin: 2.5rem 0 1.5rem 0;
    }

    .edu-section h2 {
      font-size: 1.75rem;
      font-weight: 700;
      color: #1e293b;
      border-left: 5px solid var(--primary-color);
      padding-left: 0.75rem;
      margin: 0;
    }

    p.edu-paragraph {
      margin: 0 0 1.25rem 0;
      font-size: 1.05rem;
    }

    /* PREMIUM DIDACTICAL CARDS */
    .edu-card {
      border-radius: 12px;
      border: 1px solid var(--border-color);
      margin: 1.5rem 0;
      padding: 1.25rem 1.5rem;
      background-color: var(--card-bg);
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .edu-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .card-header h3 {
      font-size: 1.15rem;
      font-weight: 700;
      margin: 0;
      color: #0f172a;
    }

    .card-header .icon {
      font-size: 1.5rem;
    }

    /* CARD THEMES */
    .edu-card.didyouknow { background-color: var(--didyouknow-bg); border-color: var(--didyouknow-border); }
    .edu-card.warning { background-color: var(--warning-bg); border-color: var(--warning-border); }
    .edu-card.hint { background-color: var(--hint-bg); border-color: var(--hint-border); }
    .edu-card.solution { background-color: var(--solution-bg); border-color: var(--solution-border); }
    .edu-card.reflection { background-color: var(--reflection-bg); border-color: var(--reflection-border); }
    .edu-card.activity { background-color: var(--activity-bg); border-color: var(--activity-border); }
    .edu-card.note { background-color: var(--note-bg); border-color: var(--note-border); }

    /* LISTS & CHECKLISTS */
    ul.edu-list {
      margin: 0 0 1.25rem 1.5rem;
      padding: 0;
    }

    li.edu-list-item {
      margin-bottom: 0.5rem;
      font-size: 1.05rem;
    }

    li.checklist-item {
      list-style: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-left: -1.5rem;
      margin-bottom: 0.5rem;
    }

    li.checklist-item input[type="checkbox"] {
      width: 1.15rem;
      height: 1.15rem;
      accent-color: var(--primary-color);
      cursor: not-allowed;
    }

    /* CODE BLOCKS */
    pre.edu-code {
      background-color: #0f172a;
      color: #f8fafc;
      padding: 1.25rem;
      border-radius: 8px;
      overflow-x: auto;
      font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
      font-size: 0.95rem;
      margin: 1.5rem 0;
      border: 1px solid #1e293b;
    }

    code.edu-inline-code {
      font-family: 'Fira Code', Consolas, monospace;
      font-size: 0.9rem;
      background-color: #f1f5f9;
      color: #0f172a;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      border: 1px solid var(--border-color);
    }

    /* QUESTION BLOCKS */
    .edu-question {
      border: 2px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      margin: 2rem 0;
      background-color: #ffffff;
    }

    .edu-question-prompt {
      font-weight: 700;
      font-size: 1.2rem;
      margin-bottom: 1rem;
      color: #0f172a;
    }

    .edu-question-options {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }

    .edu-question-option {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background-color: var(--bg-color);
    }

    .edu-question-option.correct {
      border-color: #86efac;
      background-color: #f0fdf4;
    }

    .edu-question-option input[type="checkbox"],
    .edu-question-option input[type="radio"] {
      width: 1.2rem;
      height: 1.2rem;
      accent-color: var(--primary-color);
    }

    .edu-explanation {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px dashed var(--border-color);
      font-style: italic;
      color: var(--text-muted);
    }

    /* GEOMETRIC TABLES */
    table.edu-table {
      width: 100%;
      border-collapse: collapse;
      margin: 2rem 0;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
    }

    table.edu-table th, 
    table.edu-table td {
      border: 1px solid var(--border-color);
      padding: 0.85rem 1.15rem;
      font-size: 1rem;
      text-align: left;
    }

    table.edu-table th,
    table.edu-table td.header {
      background-color: #f1f5f9;
      font-weight: 700;
      color: #0f172a;
    }

    table.edu-table tr:nth-child(even) {
      background-color: #fafbfd;
    }

    /* RUBRIC TABLES SPECIFIC STYLING */
    table.edu-table.rubric {
      border: 2px solid #6366f1;
    }
    table.edu-table.rubric th {
      background-color: #e0e7ff;
      color: #312e81;
    }

    /* PRINT AND DARK MODE */
    @media print {
      body {
        background-color: #ffffff;
        color: #000000;
        max-width: 100%;
        padding: 0;
      }
      .edu-card {
        box-shadow: none !important;
        page-break-inside: avoid;
      }
    }

    ${customStyles}
  </style>
</head>
<body>
  ${frontmatterHTML}
  <main>
    ${childrenHTML}
  </main>
</body>
</html>`;
    }
    function renderFrontmatter(meta) {
      if (!meta.title && !meta.author && !meta.level)
        return "";
      return `<header class="edu-header">
  ${meta.title ? `<h1 class="edu-title">${escapeHTML(meta.title)}</h1>` : ""}
  <div class="edu-meta">
    ${meta.author ? `<span class="edu-author"><strong>Autor:</strong> ${escapeHTML(meta.author)}</span>` : ""}
    ${meta.level ? `<span class="edu-level"><strong>Nivel:</strong> ${escapeHTML(meta.level)}</span>` : ""}
  </div>
</header>`;
    }
    function renderNodes(nodes) {
      let html = "";
      let i = 0;
      while (i < nodes.length) {
        const node = nodes[i];
        if (node.type === "list-item") {
          const listItems = [];
          while (i < nodes.length && nodes[i].type === "list-item") {
            listItems.push(nodes[i]);
            i++;
          }
          html += `<ul class="edu-list">
`;
          for (const item of listItems) {
            if (item.checked !== void 0) {
              html += `  <li class="checklist-item"><input type="checkbox" ${item.checked ? "checked" : ""} disabled /> ${formatInline(item.content)}</li>
`;
            } else {
              html += `  <li class="edu-list-item">${formatInline(item.content)}</li>
`;
            }
          }
          html += `</ul>
`;
          continue;
        }
        html += renderNode(node);
        i++;
      }
      return html;
    }
    function renderNode(node) {
      switch (node.type) {
        case "paragraph":
          return `<p class="edu-paragraph">${formatInline(node.content)}</p>
`;
        case "code-block":
          return `<pre class="edu-code"><code class="language-${escapeHTML(node.language || "text")}">${escapeHTML(node.content)}</code></pre>
`;
        case "directive":
          return renderDirective(node);
        case "table":
          return renderTable(node);
        case "question":
          return renderQuestion(node);
        default:
          return "";
      }
    }
    function renderDirective(node) {
      if (node.name === "section") {
        return `<section class="edu-section">
  <h2>${escapeHTML(node.title || "")}</h2>
</section>
`;
      }
      let titleText = "";
      let icon = "\u{1F4DD}";
      switch (node.name) {
        case "didyouknow":
          titleText = "\xBFSab\xEDas que...?";
          icon = "\u{1F4A1}";
          break;
        case "warning":
          titleText = "Atenci\xF3n";
          icon = "\u26A0\uFE0F";
          break;
        case "hint":
          titleText = "Sugerencia";
          icon = "\u{1F50D}";
          break;
        case "solution":
          titleText = "Soluci\xF3n";
          icon = "\u{1F511}";
          break;
        case "reflection":
          titleText = "Reflexi\xF3n";
          icon = "\u{1F4AD}";
          break;
        case "activity":
          titleText = "Actividad";
          icon = "\u270D\uFE0F";
          break;
        case "note":
          titleText = "Nota";
          icon = "\u{1F4DD}";
          break;
        default:
          titleText = node.name.charAt(0).toUpperCase() + node.name.slice(1);
          icon = "\u{1F4DD}";
          break;
      }
      if (node.title) {
        titleText += ` \u2014 ${node.title}`;
      }
      const childHTML = renderNodes(node.children);
      return `<div class="edu-card ${node.name}">
  <div class="card-header">
    <span class="icon">${icon}</span>
    <h3>${escapeHTML(titleText)}</h3>
  </div>
  <div class="card-body">
    ${childHTML}
  </div>
</div>
`;
    }
    function renderQuestion(node) {
      let optionsHTML = "";
      if (node.options && node.options.length > 0) {
        optionsHTML += `<div class="edu-question-options">
`;
        for (const opt of node.options) {
          const inputType = node.questionType === "multiple-choice" ? "checkbox" : "radio";
          const cssClass = opt.checked ? "edu-question-option correct" : "edu-question-option";
          optionsHTML += `  <div class="${cssClass}">
    <input type="${inputType}" ${opt.checked ? "checked" : ""} disabled />
    <span>${formatInline(opt.text)}</span>
  </div>
`;
        }
        optionsHTML += `</div>
`;
      }
      const promptHTML = node.prompt ? `<div class="edu-question-prompt">${formatInline(node.prompt)}</div>
` : "";
      const explanationHTML = node.explanation ? `<div class="edu-explanation"><strong>Explicaci\xF3n:</strong> ${formatInline(node.explanation)}</div>
` : "";
      return `<div class="edu-question">
  ${promptHTML}
  ${optionsHTML}
  ${explanationHTML}
</div>
`;
    }
    function renderTable(node) {
      const { rowsCount, colsCount, cells, isRubric } = node;
      if (rowsCount === 0 || colsCount === 0)
        return "";
      const covered = Array.from({ length: rowsCount }, () => Array(colsCount).fill(false));
      let html = `<table class="edu-table${isRubric ? " rubric" : ""}">
`;
      for (let r = 0; r < rowsCount; r++) {
        html += `  <tr>
`;
        for (let c = 0; c < colsCount; c++) {
          if (covered[r][c])
            continue;
          const cell = cells.find((cell2) => cell2.row === r && cell2.column === c);
          if (cell) {
            for (let row = r; row < r + cell.rowspan; row++) {
              for (let col = c; col < c + cell.colspan; col++) {
                if (row < rowsCount && col < colsCount) {
                  covered[row][col] = true;
                }
              }
            }
            const tag = cell.classes.includes("header") || r === 0 ? "th" : "td";
            const rowspanAttr = cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : "";
            const colspanAttr = cell.colspan > 1 ? ` colspan="${cell.colspan}"` : "";
            const classList = ["edu-cell", ...cell.classes].join(" ");
            const classAttr = ` class="${escapeHTML(classList)}"`;
            const styleKeys = Object.keys(cell.styles);
            const styleAttr = styleKeys.length > 0 ? ` style="${styleKeys.map((k) => `${escapeHTML(k)}: ${escapeHTML(cell.styles[k])}`).join("; ")}"` : "";
            const cellText = cell.content.map((line) => formatInline(line)).join("<br/>");
            html += `    <${tag}${rowspanAttr}${colspanAttr}${classAttr}${styleAttr}>${cellText}</${tag}>
`;
          } else {
            html += `    <td></td>
`;
          }
        }
        html += `  </tr>
`;
      }
      html += `</table>
`;
      return html;
    }
  }
});

// ../renderer-html/dist/index.js
var require_dist2 = __commonJS({
  "../renderer-html/dist/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    __exportStar(require_renderer(), exports2);
  }
});

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
var import_parser = __toESM(require_dist());
var import_renderer_html = __toESM(require_dist2());
var activeDecorations = {};
function activate(context) {
  console.log("La extensi\xF3n Edumark est\xE1 activa.");
  let previewPanel = void 0;
  const showPreviewCommand = vscode.commands.registerCommand("edumark.showPreview", () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || activeEditor.document.languageId !== "edumark") {
      vscode.window.showInformationMessage("Abre un archivo .edu para ver la vista previa.");
      return;
    }
    if (previewPanel) {
      previewPanel.reveal(vscode.ViewColumn.Beside);
      updateWebview(activeEditor.document);
    } else {
      previewPanel = vscode.window.createWebviewPanel(
        "edumarkPreview",
        `Vista Previa: ${vscode.workspace.asRelativePath(activeEditor.document.uri)}`,
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );
      previewPanel.onDidDispose(() => {
        previewPanel = void 0;
      });
      updateWebview(activeEditor.document);
    }
  });
  context.subscriptions.push(showPreviewCommand);
  let currentRules = [];
  function kebabToCamel(str) {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }
  function convertProperties(props) {
    const converted = {};
    for (const [key, val] of Object.entries(props)) {
      converted[kebabToCamel(key)] = val;
    }
    return converted;
  }
  function processRules(rules) {
    rules.forEach((rule) => {
      rule.properties = convertProperties(rule.properties);
      processRules(rule.nested);
    });
  }
  function parseCSS(cssText) {
    const cleanCss = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
    let pos = 0;
    const len = cleanCss.length;
    function skipWhitespace() {
      while (pos < len && /\s/.test(cleanCss[pos])) {
        pos++;
      }
    }
    function parseBlock() {
      const properties = {};
      const nested = [];
      while (pos < len) {
        skipWhitespace();
        if (pos >= len) break;
        if (cleanCss[pos] === "}") {
          pos++;
          break;
        }
        let start = pos;
        let hasColon = false;
        while (pos < len && cleanCss[pos] !== "{" && cleanCss[pos] !== "}" && cleanCss[pos] !== ";") {
          if (cleanCss[pos] === ":" && !hasColon) {
            hasColon = true;
          }
          pos++;
        }
        if (pos >= len) break;
        const char = cleanCss[pos];
        if (char === "{") {
          const selectorText = cleanCss.substring(start, pos).trim();
          pos++;
          const block = parseBlock();
          if (selectorText) {
            const selectors = selectorText.split(",").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
            nested.push({ selectors, properties: block.properties, nested: block.nested });
          }
        } else if (char === ";" || char === "}") {
          const statement = cleanCss.substring(start, pos).trim();
          if (char === ";") {
            pos++;
          }
          if (statement) {
            const cIdx = statement.indexOf(":");
            if (cIdx !== -1) {
              const name = statement.substring(0, cIdx).trim().toLowerCase();
              const value = statement.substring(cIdx + 1).trim();
              properties[name] = value;
            }
          }
        }
      }
      return { properties, nested };
    }
    const rootRules = [];
    while (pos < len) {
      skipWhitespace();
      if (pos >= len) break;
      let start = pos;
      while (pos < len && cleanCss[pos] !== "{" && cleanCss[pos] !== "}") {
        pos++;
      }
      if (pos >= len) break;
      const selectorText = cleanCss.substring(start, pos).trim();
      if (cleanCss[pos] === "{") {
        pos++;
        const block = parseBlock();
        if (selectorText) {
          const selectors = selectorText.split(",").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
          rootRules.push({ selectors, properties: block.properties, nested: block.nested });
        }
      } else {
        pos++;
      }
    }
    return rootRules;
  }
  async function loadStylesheets() {
    const rules = [];
    const files = await vscode.workspace.findFiles("{**/tal.css,**/edumark.css}");
    for (const file of files) {
      try {
        const data = await vscode.workspace.fs.readFile(file);
        const cssText = Buffer.from(data).toString("utf8");
        const parsed = parseCSS(cssText);
        rules.push(...parsed);
      } catch (e) {
        console.error("Error loading CSS file:", file.toString(), e);
      }
    }
    processRules(rules);
    currentRules = rules;
  }
  function getMarkerAliases(symbol) {
    if (symbol.startsWith("@")) return ["arroba", "a"];
    if (symbol.startsWith("#")) return ["almohadilla", "h"];
    if (symbol.startsWith(">")) return ["mayor", "m"];
    if (symbol.startsWith("%")) return ["porcentaje", "p"];
    return [];
  }
  function getStyleForBase(markerSymbol, type) {
    const aliases = getMarkerAliases(markerSymbol);
    const resolved = {};
    for (const alias of aliases) {
      for (const rule of currentRules) {
        if (rule.selectors.includes(alias)) {
          Object.assign(resolved, rule.properties);
        }
      }
    }
    if (type) {
      const typeLower = type.toLowerCase();
      for (const rule of currentRules) {
        if (rule.selectors.includes(typeLower)) {
          Object.assign(resolved, rule.properties);
        }
      }
    }
    if (type) {
      const typeLower = type.toLowerCase();
      for (const alias of aliases) {
        const combined = `${alias} ${typeLower}`;
        for (const rule of currentRules) {
          if (rule.selectors.includes(combined)) {
            Object.assign(resolved, rule.properties);
          }
        }
      }
    }
    return resolved;
  }
  function getStyleForTitle(markerSymbol, type, baseStyle) {
    const aliases = getMarkerAliases(markerSymbol);
    const resolved = { ...baseStyle };
    for (const rule of currentRules) {
      if (rule.selectors.includes("title")) {
        Object.assign(resolved, rule.properties);
      }
    }
    for (const alias of aliases) {
      for (const rule of currentRules) {
        if (rule.selectors.includes(alias)) {
          for (const nest of rule.nested) {
            if (nest.selectors.includes("title")) {
              Object.assign(resolved, nest.properties);
            }
          }
        }
      }
    }
    if (type) {
      const typeLower = type.toLowerCase();
      for (const rule of currentRules) {
        if (rule.selectors.includes(typeLower)) {
          for (const nest of rule.nested) {
            if (nest.selectors.includes("title")) {
              Object.assign(resolved, nest.properties);
            }
          }
        }
      }
    }
    if (type) {
      const typeLower = type.toLowerCase();
      for (const alias of aliases) {
        const combined = `${alias} ${typeLower}`;
        for (const rule of currentRules) {
          if (rule.selectors.includes(combined)) {
            for (const nest of rule.nested) {
              if (nest.selectors.includes("title")) {
                Object.assign(resolved, nest.properties);
              }
            }
          }
        }
      }
    }
    return resolved;
  }
  function getFinalBaseStyle(markerSymbol, type) {
    const cssStyle = getStyleForBase(markerSymbol, type);
    const config = vscode.workspace.getConfiguration("edumark.colors");
    const standardKeys = [
      "page",
      "section",
      "didyouknow",
      "warning",
      "hint",
      "solution",
      "reflection",
      "activity",
      "note",
      "question",
      "rubric"
    ];
    let defaultColor = config.get(type);
    if (!defaultColor) {
      if (standardKeys.includes(type)) {
        defaultColor = config.get(type) || "#3b82f6";
      } else {
        defaultColor = config.get("generic") || "#8e8e8e";
      }
    }
    const options = {};
    for (const [key, val] of Object.entries(cssStyle)) {
      options[key] = val;
    }
    if (!options.color) {
      options.color = defaultColor;
    }
    if (!options.fontWeight) {
      options.fontWeight = "normal";
    }
    return options;
  }
  function getFinalTitleStyle(markerSymbol, type, finalBaseStyle) {
    const baseCssStyle = getStyleForBase(markerSymbol, type);
    const cssStyle = getStyleForTitle(markerSymbol, type, baseCssStyle);
    const options = {};
    for (const [key, val] of Object.entries(cssStyle)) {
      options[key] = val;
    }
    if (!options.color) {
      options.color = finalBaseStyle.color;
    }
    if (!options.fontWeight) {
      options.fontWeight = "bold";
    }
    return options;
  }
  function getDecorationType(options) {
    const sortedOptions = {};
    Object.keys(options).sort().forEach((key) => {
      sortedOptions[key] = options[key];
    });
    const cacheKey = JSON.stringify(sortedOptions);
    if (!activeDecorations[cacheKey]) {
      activeDecorations[cacheKey] = vscode.window.createTextEditorDecorationType(options);
      context.subscriptions.push(activeDecorations[cacheKey]);
    }
    return activeDecorations[cacheKey];
  }
  function triggerUpdateDecorations(editor) {
    if (editor && (editor.document.languageId === "edumark" || editor.document.fileName.endsWith(".edu"))) {
      updateEndDecorations(editor);
    }
  }
  async function reloadStylesheetsAndForceUpdate() {
    await loadStylesheets();
    for (const decType of Object.values(activeDecorations)) {
      decType.dispose();
    }
    activeDecorations = {};
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      triggerUpdateDecorations(editor);
    }
  }
  reloadStylesheetsAndForceUpdate();
  const watcher1 = vscode.workspace.createFileSystemWatcher("**/tal.css");
  const watcher2 = vscode.workspace.createFileSystemWatcher("**/edumark.css");
  watcher1.onDidChange(() => reloadStylesheetsAndForceUpdate());
  watcher1.onDidCreate(() => reloadStylesheetsAndForceUpdate());
  watcher1.onDidDelete(() => reloadStylesheetsAndForceUpdate());
  watcher2.onDidChange(() => reloadStylesheetsAndForceUpdate());
  watcher2.onDidCreate(() => reloadStylesheetsAndForceUpdate());
  watcher2.onDidDelete(() => reloadStylesheetsAndForceUpdate());
  context.subscriptions.push(watcher1, watcher2);
  vscode.workspace.onDidChangeTextDocument((event) => {
    const editor = vscode.window.activeTextEditor;
    if (editor && event.document === editor.document) {
      triggerUpdateDecorations(editor);
    }
    if (previewPanel && event.document === vscode.window.activeTextEditor?.document) {
      updateWebview(event.document);
    }
  });
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    triggerUpdateDecorations(editor);
    if (previewPanel && editor && (editor.document.languageId === "edumark" || editor.document.fileName.endsWith(".edu"))) {
      previewPanel.title = `Vista Previa: ${vscode.workspace.asRelativePath(editor.document.uri)}`;
      updateWebview(editor.document);
    }
  });
  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("edumark.colors")) {
      reloadStylesheetsAndForceUpdate();
    }
  });
  function updateEndDecorations(editor) {
    const document = editor.document;
    const combinedDecorations = /* @__PURE__ */ new Map();
    const decorationTypes = /* @__PURE__ */ new Map();
    const stack = [];
    for (let lineIdx = 0; lineIdx < document.lineCount; lineIdx++) {
      const lineText = document.lineAt(lineIdx).text;
      const trimmed = lineText.trim();
      if (trimmed.startsWith("@") && !trimmed.startsWith("@end") && /^[a-zA-Z]/.test(trimmed.substring(1))) {
        const match = trimmed.match(/^@([a-zA-Z0-9_\-]+)(.*)$/);
        if (match) {
          const name = match[1];
          const title = match[2].trim();
          stack.push({ name, title });
          const cmdIdx = lineText.indexOf("@" + name);
          if (cmdIdx !== -1) {
            const startPos = new vscode.Position(lineIdx, cmdIdx);
            const endPos = new vscode.Position(lineIdx, cmdIdx + name.length + 1);
            const range = new vscode.Range(startPos, endPos);
            const finalBaseStyle = getFinalBaseStyle("@", name);
            const decTypeNormal = getDecorationType(finalBaseStyle);
            const cacheKeyNormal = JSON.stringify(finalBaseStyle);
            decorationTypes.set(cacheKeyNormal, decTypeNormal);
            if (!combinedDecorations.has(cacheKeyNormal)) {
              combinedDecorations.set(cacheKeyNormal, []);
            }
            combinedDecorations.get(cacheKeyNormal).push({ range });
            if (title) {
              const titleIdx = lineText.indexOf(title, cmdIdx + name.length + 1);
              if (titleIdx !== -1) {
                const titleStart = new vscode.Position(lineIdx, titleIdx);
                const titleEnd = new vscode.Position(lineIdx, titleIdx + title.length);
                const titleRange = new vscode.Range(titleStart, titleEnd);
                const finalTitleStyle = getFinalTitleStyle("@", name, finalBaseStyle);
                const decTypeBold = getDecorationType(finalTitleStyle);
                const cacheKeyBold = JSON.stringify(finalTitleStyle);
                decorationTypes.set(cacheKeyBold, decTypeBold);
                if (!combinedDecorations.has(cacheKeyBold)) {
                  combinedDecorations.set(cacheKeyBold, []);
                }
                combinedDecorations.get(cacheKeyBold).push({ range: titleRange });
              }
            }
          }
        }
      } else if (/^[#>%]/.test(trimmed)) {
        const match = trimmed.match(/^([#>%]+)(?:([a-zA-Z0-9_\-]+))?(?:\s+(.*))?$/);
        if (match) {
          const hashes = match[1];
          const symbol = hashes[0];
          const name = match[2] || "generic";
          const title = (match[3] || "").trim();
          const level = hashes.length;
          let popIdx = -1;
          for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i].level !== void 0 && stack[i].level >= level) {
              popIdx = i;
              break;
            }
          }
          if (popIdx !== -1) {
            while (stack.length > popIdx) {
              stack.pop();
            }
          }
          stack.push({ name, title, level });
          const cmdText = match[2] ? hashes + name : hashes;
          const cmdIdx = lineText.indexOf(cmdText);
          if (cmdIdx !== -1) {
            const startPos = new vscode.Position(lineIdx, cmdIdx);
            const endPos = new vscode.Position(lineIdx, cmdIdx + cmdText.length);
            const range = new vscode.Range(startPos, endPos);
            const finalBaseStyle = getFinalBaseStyle(symbol, name);
            const decTypeNormal = getDecorationType(finalBaseStyle);
            const cacheKeyNormal = JSON.stringify(finalBaseStyle);
            decorationTypes.set(cacheKeyNormal, decTypeNormal);
            if (!combinedDecorations.has(cacheKeyNormal)) {
              combinedDecorations.set(cacheKeyNormal, []);
            }
            combinedDecorations.get(cacheKeyNormal).push({ range });
            if (title) {
              const titleIdx = lineText.indexOf(title, cmdIdx + cmdText.length);
              if (titleIdx !== -1) {
                const titleStart = new vscode.Position(lineIdx, titleIdx);
                const titleEnd = new vscode.Position(lineIdx, titleIdx + title.length);
                const titleRange = new vscode.Range(titleStart, titleEnd);
                const finalTitleStyle = getFinalTitleStyle(symbol, name, finalBaseStyle);
                const decTypeBold = getDecorationType(finalTitleStyle);
                const cacheKeyBold = JSON.stringify(finalTitleStyle);
                decorationTypes.set(cacheKeyBold, decTypeBold);
                if (!combinedDecorations.has(cacheKeyBold)) {
                  combinedDecorations.set(cacheKeyBold, []);
                }
                combinedDecorations.get(cacheKeyBold).push({ range: titleRange });
              }
            }
          }
        }
      } else if (trimmed.startsWith("@end")) {
        let closingName = void 0;
        if (trimmed.startsWith("@end-")) {
          closingName = trimmed.substring(5).trim();
        }
        if (stack.length > 0) {
          let openDir = void 0;
          if (closingName) {
            const idx = stack.map((d) => d.name).lastIndexOf(closingName);
            if (idx !== -1) {
              while (stack.length > idx) {
                openDir = stack.pop();
              }
            }
          } else {
            openDir = stack.pop();
          }
          if (openDir) {
            const endIdx = lineText.indexOf(trimmed);
            if (endIdx !== -1) {
              const startPos = new vscode.Position(lineIdx, endIdx);
              const endPos = new vscode.Position(lineIdx, endIdx + trimmed.length);
              const range = new vscode.Range(startPos, endPos);
              const finalBaseStyle = getFinalBaseStyle("@", openDir.name);
              const decTypeNormal = getDecorationType(finalBaseStyle);
              const cacheKeyNormal = JSON.stringify(finalBaseStyle);
              decorationTypes.set(cacheKeyNormal, decTypeNormal);
              if (!combinedDecorations.has(cacheKeyNormal)) {
                combinedDecorations.set(cacheKeyNormal, []);
              }
              const label = `[-${openDir.name}${openDir.title ? " " + openDir.title : ""}]`;
              combinedDecorations.get(cacheKeyNormal).push({
                range,
                renderOptions: {
                  after: {
                    contentText: ` ${label}`,
                    color: finalBaseStyle.color + "b0",
                    // opacity
                    fontStyle: "italic",
                    margin: "0 0 0 10px"
                  }
                }
              });
            }
          }
        }
      }
    }
    for (const decType of Object.values(activeDecorations)) {
      editor.setDecorations(decType, []);
    }
    for (const [cacheKey, options] of combinedDecorations.entries()) {
      const decType = decorationTypes.get(cacheKey);
      editor.setDecorations(decType, options);
    }
  }
  function updateWebview(document) {
    if (!previewPanel) return;
    try {
      const source = document.getText();
      const { ast, errors } = (0, import_parser.parse)(source);
      let html = "";
      if (errors.length > 0) {
        html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #fff5f5; color: #c53030; }
    h2 { margin-top: 0; }
    ul { padding-left: 1.25rem; }
    li { margin-bottom: 0.5rem; }
  </style>
</head>
<body>
  <h2>\u274C Errores de sintaxis detectados</h2>
  <ul>
    ${errors.map((err) => `<li><strong>L\xEDnea ${err.lineNum}:</strong> ${err.message}</li>`).join("")}
  </ul>
</body>
</html>`;
      } else {
        html = (0, import_renderer_html.renderToHTML)(ast);
      }
      previewPanel.webview.html = html;
    } catch (err) {
      previewPanel.webview.html = `<h3>Error de renderizado:</h3><pre>${err.message}</pre>`;
    }
  }
}
function deactivate() {
  for (const decType of Object.values(activeDecorations)) {
    decType.dispose();
  }
  activeDecorations = {};
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
