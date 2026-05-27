"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
var activeDecorations = {};
function activate(context) {
  console.log("La extensi\xF3n Edumark est\xE1 activa.");
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
    const files = await vscode.workspace.findFiles("**/highlight/**/*.css");
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
  const watcher = vscode.workspace.createFileSystemWatcher("**/highlight/**/*.css");
  watcher.onDidChange(() => reloadStylesheetsAndForceUpdate());
  watcher.onDidCreate(() => reloadStylesheetsAndForceUpdate());
  watcher.onDidDelete(() => reloadStylesheetsAndForceUpdate());
  context.subscriptions.push(watcher);
  vscode.workspace.onDidChangeTextDocument((event) => {
    const editor = vscode.window.activeTextEditor;
    if (editor && event.document === editor.document) {
      triggerUpdateDecorations(editor);
    }
  });
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    triggerUpdateDecorations(editor);
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
