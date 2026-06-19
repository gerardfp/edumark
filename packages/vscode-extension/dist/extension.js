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
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
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
  async function readCssContent(uri) {
    const openDoc = vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === uri.toString());
    if (openDoc) {
      return openDoc.getText();
    }
    const data = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(data).toString("utf8");
  }
  async function loadStylesheets() {
    const rules = [];
    const defaultBaseUri = vscode.Uri.joinPath(context.extensionUri, "..", "..", "highlight", "base.css");
    try {
      const data = await vscode.workspace.fs.readFile(defaultBaseUri);
      const cssText = Buffer.from(data).toString("utf8");
      const parsed = parseCSS(cssText);
      rules.push(...parsed);
      console.log("Cargado base.css de edumark.");
    } catch (e) {
      console.log("No se pudo cargar base.css desde la extensi\xF3n edumark.");
    }
    const edu2elpxExt = vscode.extensions.getExtension("gerardfp.edu2elpx-vscode");
    if (edu2elpxExt) {
      try {
        const possiblePaths = [
          vscode.Uri.file(path.join(edu2elpxExt.extensionPath, "highlight", "edu2elpx.css")),
          vscode.Uri.file(path.join(edu2elpxExt.extensionPath, ".config", "highlight", "edu2elpx.css"))
        ];
        for (const uri of possiblePaths) {
          if (fs.existsSync(uri.fsPath)) {
            const data = await vscode.workspace.fs.readFile(uri);
            const cssText = Buffer.from(data).toString("utf8");
            const parsed = parseCSS(cssText);
            rules.push(...parsed);
            console.log("Cargado highlight de edu2elpx:", uri.fsPath);
            break;
          }
        }
      } catch (e) {
        console.error("Error al cargar highlight de edu2elpx:", e);
      }
    }
    const escola40Ext = vscode.extensions.getExtension("gerardfp.escola40-vscode");
    if (escola40Ext) {
      try {
        const possiblePaths = [
          vscode.Uri.file(path.join(escola40Ext.extensionPath, "highlight", "escola40.css")),
          vscode.Uri.file(path.join(escola40Ext.extensionPath, ".config", "highlight", "escola40.css"))
        ];
        for (const uri of possiblePaths) {
          if (fs.existsSync(uri.fsPath)) {
            const data = await vscode.workspace.fs.readFile(uri);
            const cssText = Buffer.from(data).toString("utf8");
            const parsed = parseCSS(cssText);
            rules.push(...parsed);
            console.log("Cargado highlight de escola40:", uri.fsPath);
            break;
          }
        }
      } catch (e) {
        console.error("Error al cargar highlight de escola40:", e);
      }
    }
    const projectFiles = await vscode.workspace.findFiles("{**/.config/hightlight/**/*.css,**/.config/highlight/**/*.css}");
    for (const file of projectFiles) {
      try {
        const cssText = await readCssContent(file);
        const parsed = parseCSS(cssText);
        rules.push(...parsed);
        console.log("Cargado CSS del proyecto:", file.toString());
      } catch (e) {
        console.error("Error al cargar CSS del proyecto:", file.toString(), e);
      }
    }
    processRules(rules);
    currentRules = rules;
  }
  const SYMBOL_MAP = {
    "!": "excl",
    '"': "quot",
    "#": "num",
    "$": "dollar",
    "%": "percnt",
    "&": "amp",
    "'": "apos",
    "(": "lparen",
    ")": "rparen",
    "*": "ast",
    "+": "plus",
    ",": "comma",
    "-": "minus",
    ".": "period",
    "/": "sol",
    ":": "colon",
    ";": "semi",
    "<": "lt",
    "=": "equals",
    ">": "gt",
    "?": "quest",
    "@": "commat",
    "[": "lsqb",
    "\\": "bsol",
    "]": "rsqb",
    "^": "Hat",
    "_": "lowbar",
    "`": "grave",
    "{": "lcub",
    "|": "verbar",
    "}": "rcub",
    "~": "tilde"
  };
  function getMarkerAliases(symbol) {
    const char = symbol[0];
    const name = SYMBOL_MAP[char];
    const aliases = [];
    if (name) {
      aliases.push(`&${name}`, name);
    }
    return aliases;
  }
  function getStyleForBase(markerSymbol, type, resolvedType) {
    const aliases = getMarkerAliases(markerSymbol);
    const resolved = {};
    const typesToMatch = [type.toLowerCase()];
    if (resolvedType) {
      typesToMatch.push(resolvedType.toLowerCase());
    }
    for (const alias of aliases) {
      for (const rule of currentRules) {
        if (rule.selectors.includes(alias)) {
          Object.assign(resolved, rule.properties);
        }
      }
    }
    if (type && type !== "generic") {
      for (const t of typesToMatch) {
        for (const rule of currentRules) {
          for (const selector2 of rule.selectors) {
            if (selector2 === t) {
              Object.assign(resolved, rule.properties);
            } else if (selector2.includes("*")) {
              const regexStr = "^" + selector2.replace(/\*/g, ".*") + "$";
              if (new RegExp(regexStr).test(t)) {
                Object.assign(resolved, rule.properties);
              }
            }
          }
        }
      }
      for (const alias of aliases) {
        const wildcard = `${alias} *`;
        for (const rule of currentRules) {
          if (rule.selectors.includes(wildcard)) {
            Object.assign(resolved, rule.properties);
          }
        }
      }
      for (const t of typesToMatch) {
        for (const alias of aliases) {
          for (const rule of currentRules) {
            for (const selector2 of rule.selectors) {
              if (selector2 === `${alias} ${t}`) {
                Object.assign(resolved, rule.properties);
              } else if (selector2.includes("*")) {
                const parts = selector2.split(/\s+/);
                if (parts[0] === alias) {
                  const pattern = parts[1];
                  const regexStr = "^" + pattern.replace(/\*/g, ".*") + "$";
                  if (new RegExp(regexStr).test(t)) {
                    Object.assign(resolved, rule.properties);
                  }
                }
              }
            }
          }
        }
      }
      const standardKeys = [
        "pagina",
        "seccion",
        "item",
        "ataula",
        "didyouknow",
        "warning",
        "hint",
        "solution",
        "reflection",
        "activity",
        "note",
        "question",
        "rubric",
        "ask_yourself",
        "generic",
        "preguntate",
        "atencion",
        "sabiasque",
        "sugerencia",
        "solucion",
        "reflexion",
        "actividad",
        "nota",
        "pregunta",
        "rubrica",
        "informacion"
      ];
      const hasSpecificColor = resolved.color || resolved.backgroundColor;
      if (!hasSpecificColor) {
        let isStandard = false;
        for (const t of typesToMatch) {
          if (standardKeys.includes(t)) {
            isStandard = true;
            break;
          }
        }
        if (!isStandard) {
          for (const rule of currentRules) {
            if (rule.selectors.includes("generic")) {
              Object.assign(resolved, rule.properties);
            }
          }
        }
      }
    } else if (type === "generic" || !type) {
      if (!resolved.color && !resolved.backgroundColor) {
        for (const rule of currentRules) {
          if (rule.selectors.includes("generic")) {
            Object.assign(resolved, rule.properties);
          }
        }
      }
    }
    return resolved;
  }
  function getStyleForSymbol(markerSymbol, type, resolvedType) {
    const aliases = getMarkerAliases(markerSymbol);
    const resolved = {};
    const typesToMatch = [];
    if (type) typesToMatch.push(type.toLowerCase());
    if (resolvedType) typesToMatch.push(resolvedType.toLowerCase());
    for (const alias of aliases) {
      for (const rule of currentRules) {
        if (rule.selectors.includes(alias)) {
          Object.assign(resolved, rule.properties);
        }
      }
    }
    if (type && type !== "generic") {
      for (const t of typesToMatch) {
        for (const rule of currentRules) {
          for (const selector2 of rule.selectors) {
            if (selector2 === t) {
              Object.assign(resolved, rule.properties);
            } else if (selector2.includes("*")) {
              const regexStr = "^" + selector2.replace(/\*/g, ".*") + "$";
              if (new RegExp(regexStr).test(t)) {
                Object.assign(resolved, rule.properties);
              }
            }
          }
        }
      }
      for (const alias of aliases) {
        const wildcard = `${alias} *`;
        for (const rule of currentRules) {
          if (rule.selectors.includes(wildcard)) {
            Object.assign(resolved, rule.properties);
          }
        }
      }
      for (const t of typesToMatch) {
        for (const alias of aliases) {
          for (const rule of currentRules) {
            for (const selector2 of rule.selectors) {
              if (selector2 === `${alias} ${t}`) {
                Object.assign(resolved, rule.properties);
              } else if (selector2.includes("*")) {
                const parts = selector2.split(/\s+/);
                if (parts[0] === alias) {
                  const pattern = parts[1];
                  const regexStr = "^" + pattern.replace(/\*/g, ".*") + "$";
                  if (new RegExp(regexStr).test(t)) {
                    Object.assign(resolved, rule.properties);
                  }
                }
              }
            }
          }
        }
      }
      const standardKeys = [
        "pagina",
        "seccion",
        "item",
        "ataula",
        "didyouknow",
        "warning",
        "hint",
        "solution",
        "reflection",
        "activity",
        "note",
        "question",
        "rubric",
        "ask_yourself",
        "generic",
        "preguntate",
        "atencion",
        "sabiasque",
        "sugerencia",
        "solucion",
        "reflexion",
        "actividad",
        "nota",
        "pregunta",
        "rubrica",
        "informacion"
      ];
      const hasSpecificColor = resolved.color || resolved.backgroundColor;
      if (!hasSpecificColor) {
        let isStandard = false;
        for (const t of typesToMatch) {
          if (standardKeys.includes(t)) {
            isStandard = true;
            break;
          }
        }
        if (!isStandard) {
          for (const rule of currentRules) {
            if (rule.selectors.includes("generic")) {
              Object.assign(resolved, rule.properties);
            }
          }
        }
      }
    } else if (type === "generic" || !type) {
      if (!resolved.color && !resolved.backgroundColor) {
        for (const rule of currentRules) {
          if (rule.selectors.includes("generic")) {
            Object.assign(resolved, rule.properties);
          }
        }
      }
    }
    return resolved;
  }
  function attenuateColor(colorStr) {
    if (!colorStr) return "rgba(128, 128, 128, 0.5)";
    const trimmed = colorStr.trim().toLowerCase();
    if (trimmed.startsWith("#")) {
      const hex = trimmed.substring(1);
      if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        return `rgba(${r}, ${g}, ${b}, 0.5)`;
      }
      if (hex.length === 4) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        const a = parseInt(hex[3] + hex[3], 16) / 255;
        return `rgba(${r}, ${g}, ${b}, ${a * 0.5})`;
      }
      if (hex.length === 6) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, 0.5)`;
      }
      if (hex.length === 8) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const a = parseInt(hex.substring(6, 8), 16) / 255;
        return `rgba(${r}, ${g}, ${b}, ${a * 0.5})`;
      }
    }
    if (trimmed.startsWith("rgb")) {
      const match = trimmed.match(/rgba?\s*\(\s*(\d+(?:\.\d+)?%?)\s*,\s*(\d+(?:\.\d+)?%?)\s*,\s*(\d+(?:\.\d+)?%?)(?:\s*,\s*(\d+(?:\.\d+)?%?))?\s*\)/);
      if (match) {
        const r = match[1];
        const g = match[2];
        const b = match[3];
        const a = match[4] !== void 0 ? parseFloat(match[4]) : 1;
        return `rgba(${r}, ${g}, ${b}, ${a * 0.5})`;
      }
    }
    if (trimmed.startsWith("hsl")) {
      const match = trimmed.match(/hsla?\s*\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?%)\s*,\s*(\d+(?:\.\d+)?%)(?:\s*,\s*(\d+(?:\.\d+)?%?))?\s*\)/);
      if (match) {
        const h = match[1];
        const s = match[2];
        const l = match[3];
        const a = match[4] !== void 0 ? parseFloat(match[4]) : 1;
        return `hsla(${h}, ${s}, ${l}, ${a * 0.5})`;
      }
    }
    const colorMap = {
      "red": "rgba(255, 0, 0, 0.5)",
      "blue": "rgba(0, 0, 255, 0.5)",
      "green": "rgba(0, 128, 0, 0.5)",
      "white": "rgba(255, 255, 255, 0.5)",
      "black": "rgba(0, 0, 0, 0.5)",
      "yellow": "rgba(255, 255, 0, 0.5)",
      "magenta": "rgba(255, 0, 255, 0.5)",
      "cyan": "rgba(0, 255, 255, 0.5)",
      "gray": "rgba(128, 128, 128, 0.5)",
      "orange": "rgba(255, 165, 0, 0.5)"
    };
    return colorMap[trimmed] || trimmed;
  }
  function getFinalSymbolStyle(markerSymbol, type, defaultColor, resolvedType) {
    const cssStyle = getStyleForSymbol(markerSymbol, type, resolvedType);
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
  function getStyleForTitle(markerSymbol, type, baseStyle, resolvedType) {
    const aliases = getMarkerAliases(markerSymbol);
    const resolved = { ...baseStyle };
    const typesToMatch = [type.toLowerCase()];
    if (resolvedType) {
      typesToMatch.push(resolvedType.toLowerCase());
    }
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
    for (const t of typesToMatch) {
      for (const rule of currentRules) {
        for (const selector2 of rule.selectors) {
          let matched = selector2 === t;
          if (!matched && selector2.includes("*")) {
            const regexStr = "^" + selector2.replace(/\*/g, ".*") + "$";
            matched = new RegExp(regexStr).test(t);
          }
          if (matched) {
            for (const nest of rule.nested) {
              if (nest.selectors.includes("title")) {
                Object.assign(resolved, nest.properties);
              }
            }
          }
        }
      }
    }
    for (const t of typesToMatch) {
      for (const alias of aliases) {
        const combined = `${alias} ${t}`;
        for (const rule of currentRules) {
          for (const selector2 of rule.selectors) {
            let matched = selector2 === combined;
            if (!matched && selector2.includes("*")) {
              const parts = selector2.split(/\s+/);
              if (parts[0] === alias) {
                const pattern = parts[1];
                const regexStr = "^" + pattern.replace(/\*/g, ".*") + "$";
                matched = new RegExp(regexStr).test(t);
              }
            }
            if (matched) {
              for (const nest of rule.nested) {
                if (nest.selectors.includes("title")) {
                  Object.assign(resolved, nest.properties);
                }
              }
            }
          }
        }
      }
    }
    return resolved;
  }
  function getFinalBaseStyle(markerSymbol, type, resolvedType) {
    const cssStyle = getStyleForBase(markerSymbol, type, resolvedType);
    const config = vscode.workspace.getConfiguration("edumark.colors");
    const standardKeys = [
      "pagina",
      "seccion",
      "item",
      "ataula",
      "didyouknow",
      "warning",
      "hint",
      "solution",
      "reflection",
      "activity",
      "note",
      "question",
      "rubric",
      "ask_yourself",
      "generic",
      "preguntate",
      "atencion",
      "sabiasque",
      "sugerencia",
      "solucion",
      "reflexion",
      "actividad",
      "nota",
      "pregunta",
      "rubrica",
      "informacion"
    ];
    let defaultColor = config.get(type);
    if (!defaultColor) {
      let matchedKey = "";
      for (const t of [type, resolvedType || ""]) {
        if (standardKeys.includes(t.toLowerCase())) {
          matchedKey = t.toLowerCase();
          break;
        }
      }
      if (matchedKey) {
        defaultColor = config.get(matchedKey) || "#3b82f6";
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
  function getFinalTitleStyle(markerSymbol, type, finalBaseStyle, resolvedType) {
    const baseCssStyle = getStyleForBase(markerSymbol, type, resolvedType);
    const cssStyle = getStyleForTitle(markerSymbol, type, baseCssStyle, resolvedType);
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
  function getStyleForNested(markerSymbol, type, subSelector, baseStyle, resolvedType) {
    const aliases = getMarkerAliases(markerSymbol);
    const resolved = { ...baseStyle };
    const typesToMatch = [type.toLowerCase()];
    if (resolvedType) {
      typesToMatch.push(resolvedType.toLowerCase());
    }
    for (const rule of currentRules) {
      if (rule.selectors.includes(subSelector)) {
        Object.assign(resolved, rule.properties);
      }
    }
    for (const alias of aliases) {
      for (const rule of currentRules) {
        if (rule.selectors.includes(alias)) {
          for (const nest of rule.nested) {
            if (nest.selectors.includes(subSelector)) {
              Object.assign(resolved, nest.properties);
            }
          }
        }
      }
    }
    for (const t of typesToMatch) {
      for (const rule of currentRules) {
        for (const selector2 of rule.selectors) {
          let matched = selector2 === t;
          if (!matched && selector2.includes("*")) {
            const regexStr = "^" + selector2.replace(/\*/g, ".*") + "$";
            matched = new RegExp(regexStr).test(t);
          }
          if (matched) {
            for (const nest of rule.nested) {
              if (nest.selectors.includes(subSelector)) {
                Object.assign(resolved, nest.properties);
              }
            }
          }
        }
      }
    }
    for (const t of typesToMatch) {
      for (const alias of aliases) {
        const combined = `${alias} ${t}`;
        for (const rule of currentRules) {
          for (const selector2 of rule.selectors) {
            let matched = selector2 === combined;
            if (!matched && selector2.includes("*")) {
              const parts = selector2.split(/\s+/);
              if (parts[0] === alias) {
                const pattern = parts[1];
                const regexStr = "^" + pattern.replace(/\*/g, ".*") + "$";
                matched = new RegExp(regexStr).test(t);
              }
            }
            if (matched) {
              for (const nest of rule.nested) {
                if (nest.selectors.includes(subSelector)) {
                  Object.assign(resolved, nest.properties);
                }
              }
            }
          }
        }
      }
    }
    return resolved;
  }
  function getFinalNestedStyle(markerSymbol, type, subSelector, finalBaseStyle, resolvedType) {
    const baseCssStyle = getStyleForBase(markerSymbol, type, resolvedType);
    const cssStyle = getStyleForNested(markerSymbol, type, subSelector, baseCssStyle, resolvedType);
    const options = {};
    for (const [key, val] of Object.entries(cssStyle)) {
      options[key] = val;
    }
    if (!options.color) {
      if (type.toLowerCase() === "imagen" && subSelector === "title") {
        options.color = "#ef4444";
      } else if (subSelector === "params") {
        options.color = "#a3a3a3";
      } else {
        options.color = finalBaseStyle.color;
      }
    }
    if (!options.fontWeight && subSelector === "title") {
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
    for (const editor of vscode.window.visibleTextEditors) {
      triggerUpdateDecorations(editor);
    }
  }
  reloadStylesheetsAndForceUpdate();
  const watcher = vscode.workspace.createFileSystemWatcher("{**/.config/hightlight/**/*.css,**/.config/highlight/**/*.css}");
  watcher.onDidChange(() => reloadStylesheetsAndForceUpdate());
  watcher.onDidCreate(() => reloadStylesheetsAndForceUpdate());
  watcher.onDidDelete(() => reloadStylesheetsAndForceUpdate());
  context.subscriptions.push(watcher);
  vscode.workspace.onDidChangeTextDocument((event) => {
    const isCss = event.document.uri.path.endsWith(".css");
    const inHighlightFolder = event.document.uri.path.includes("/.config/highlight/") || event.document.uri.path.includes("/.config/hightlight/");
    if (isCss && inHighlightFolder) {
      reloadStylesheetsAndForceUpdate();
    } else {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        triggerUpdateDecorations(editor);
      }
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
  function getCategory(name) {
    const idx = name.indexOf("-");
    if (idx !== -1) {
      return name.substring(0, idx);
    }
    return name;
  }
  function resolveName(name, aliases) {
    const defaultAliases = {
      "page": "block-page",
      "pagina": "block-page",
      "seccion": "idevice-text",
      "tarea": "idevice-activity",
      "rubrica": "idevice-rubric",
      "cotejo": "idevice-cotejo",
      "idevice-cotejo": "idevice-cotejo",
      "imagen": "media-image",
      "portada": "media-cover",
      "item": "tab-item",
      "actividad": "idevice-activity",
      "activity": "idevice-activity",
      "atencion": "idevice-warning",
      "warning": "idevice-warning",
      "sabiasque": "idevice-didyouknow",
      "didyouknow": "idevice-didyouknow",
      "sugerencia": "idevice-hint",
      "hint": "idevice-hint",
      "solucion": "idevice-solution",
      "solution": "idevice-solution",
      "reflexion": "idevice-reflection",
      "reflection": "idevice-reflection",
      "nota": "idevice-note",
      "note": "idevice-note",
      "pregunta": "idevice-question",
      "question": "idevice-question",
      "preguntate": "idevice-ask_yourself",
      "ask_yourself": "idevice-ask_yourself",
      "informacion": "idevice-generic",
      "generic": "idevice-generic"
    };
    if (aliases && name in aliases) {
      return aliases[name];
    }
    return defaultAliases[name] || name;
  }
  function shouldClose(openItem, newItem, aliases) {
    const rOpen = resolveName(openItem.name, aliases);
    const rNew = resolveName(newItem.name, aliases);
    const categoryOpen = getCategory(rOpen);
    const categoryNew = getCategory(rNew);
    if (categoryNew === "block") {
      if (categoryOpen === "block") {
        return openItem.level !== void 0 && openItem.level >= newItem.level;
      }
      return true;
    } else {
      return categoryOpen === categoryNew;
    }
  }
  function getParameterBalance(str) {
    return getBraceBalance(str);
  }
  function updateEndDecorations(editor) {
    const document = editor.document;
    const combinedDecorations = /* @__PURE__ */ new Map();
    const decorationTypes = /* @__PURE__ */ new Map();
    const stack = [];
    const frontmatterAliases = {};
    let inAliases = false;
    let inParameterBlock = false;
    let parameterBalance = 0;
    let parameterSymbol = "#";
    let parameterTypeName = "generic";
    let parameterResolvedName = "generic";
    let startLineIdx = 0;
    if (document.lineCount > 0 && document.lineAt(0).text.trim() === "---") {
      const sepStyle = { color: "#808080", fontWeight: "bold" };
      const decTypeSep = getDecorationType(sepStyle);
      const cacheKeySep = JSON.stringify(sepStyle);
      decorationTypes.set(cacheKeySep, decTypeSep);
      if (!combinedDecorations.has(cacheKeySep)) {
        combinedDecorations.set(cacheKeySep, []);
      }
      combinedDecorations.get(cacheKeySep).push({
        range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, document.lineAt(0).text.length))
      });
      startLineIdx = 1;
      while (startLineIdx < document.lineCount) {
        const lineText = document.lineAt(startLineIdx).text;
        const trimmed = lineText.trim();
        if (trimmed === "---") {
          combinedDecorations.get(cacheKeySep).push({
            range: new vscode.Range(new vscode.Position(startLineIdx, 0), new vscode.Position(startLineIdx, lineText.length))
          });
          startLineIdx++;
          break;
        }
        if (trimmed === "") {
          startLineIdx++;
          continue;
        }
        const keyMatch = lineText.match(/^([a-zA-Z_][a-zA-Z0-9_]*):(.*)$/);
        if (keyMatch) {
          const key = keyMatch[1].trim();
          const rest = keyMatch[2].trim();
          if (key === "aliases") {
            inAliases = true;
          } else {
            inAliases = false;
            if (key.startsWith("alias_") || key.startsWith("alias-")) {
              const aliasName = key.substring(6);
              frontmatterAliases[aliasName] = rest;
            }
          }
          const keyStyle = { color: "#4fc1ff" };
          const decTypeKey = getDecorationType(keyStyle);
          const cacheKeyKey = JSON.stringify(keyStyle);
          decorationTypes.set(cacheKeyKey, decTypeKey);
          if (!combinedDecorations.has(cacheKeyKey)) {
            combinedDecorations.set(cacheKeyKey, []);
          }
          combinedDecorations.get(cacheKeyKey).push({
            range: new vscode.Range(new vscode.Position(startLineIdx, 0), new vscode.Position(startLineIdx, keyMatch[1].length + 1))
          });
          if (keyMatch[2].length > 0) {
            const stringStyle = { color: "#ce9178" };
            const decTypeStr = getDecorationType(stringStyle);
            const cacheKeyStr = JSON.stringify(stringStyle);
            decorationTypes.set(cacheKeyStr, decTypeStr);
            if (!combinedDecorations.has(cacheKeyStr)) {
              combinedDecorations.set(cacheKeyStr, []);
            }
            combinedDecorations.get(cacheKeyStr).push({
              range: new vscode.Range(new vscode.Position(startLineIdx, keyMatch[1].length + 1), new vscode.Position(startLineIdx, lineText.length))
            });
          }
        } else {
          if (inAliases) {
            const aliasMatch = lineText.match(/^\s+([a-zA-Z0-9_\-]+)\s*:\s*([a-zA-Z0-9_\-]+)\s*$/);
            if (aliasMatch) {
              frontmatterAliases[aliasMatch[1]] = aliasMatch[2];
            }
          }
          const stringStyle = { color: "#ce9178" };
          const decTypeStr = getDecorationType(stringStyle);
          const cacheKeyStr = JSON.stringify(stringStyle);
          decorationTypes.set(cacheKeyStr, decTypeStr);
          if (!combinedDecorations.has(cacheKeyStr)) {
            combinedDecorations.set(cacheKeyStr, []);
          }
          combinedDecorations.get(cacheKeyStr).push({
            range: new vscode.Range(new vscode.Position(startLineIdx, 0), new vscode.Position(startLineIdx, lineText.length))
          });
        }
        startLineIdx++;
      }
    }
    for (let lineIdx = startLineIdx; lineIdx < document.lineCount; lineIdx++) {
      const lineText = document.lineAt(lineIdx).text;
      const trimmed = lineText.trim();
      if (inParameterBlock) {
        parameterBalance += getParameterBalance(lineText);
        const range = new vscode.Range(new vscode.Position(lineIdx, 0), new vscode.Position(lineIdx, lineText.length));
        const finalBaseStyle = getFinalBaseStyle(parameterSymbol, parameterTypeName, parameterResolvedName);
        const finalParamsStyle = getFinalNestedStyle(parameterSymbol, parameterTypeName, "params", finalBaseStyle, parameterResolvedName);
        const decType = getDecorationType(finalParamsStyle);
        const cacheKey = JSON.stringify(finalParamsStyle);
        decorationTypes.set(cacheKey, decType);
        if (!combinedDecorations.has(cacheKey)) {
          combinedDecorations.set(cacheKey, []);
        }
        combinedDecorations.get(cacheKey).push({ range });
        if (parameterBalance <= 0) {
          inParameterBlock = false;
        }
        continue;
      }
      if (trimmed.startsWith("@") && !trimmed.startsWith("@end") && /^[a-zA-Z]/.test(trimmed.substring(1))) {
        const match = trimmed.match(/^@([a-zA-Z0-9_\-]+)(.*)$/);
        if (match) {
          const name = match[1];
          const title = match[2].trim();
          stack.push({ name, title, isBlock: true });
          const cmdIdx = lineText.indexOf("@" + name);
          if (cmdIdx !== -1) {
            const resolvedName = resolveName(name, frontmatterAliases);
            const finalBaseStyle = getFinalBaseStyle("@", name, resolvedName);
            const finalSymbolStyle = getFinalSymbolStyle("@", name, finalBaseStyle.color, resolvedName);
            const symbolStart = new vscode.Position(lineIdx, cmdIdx);
            const symbolEnd = new vscode.Position(lineIdx, cmdIdx + 1);
            const symbolRange = new vscode.Range(symbolStart, symbolEnd);
            const decTypeSymbol = getDecorationType(finalSymbolStyle);
            const cacheKeySymbol = JSON.stringify(finalSymbolStyle);
            decorationTypes.set(cacheKeySymbol, decTypeSymbol);
            if (!combinedDecorations.has(cacheKeySymbol)) {
              combinedDecorations.set(cacheKeySymbol, []);
            }
            combinedDecorations.get(cacheKeySymbol).push({ range: symbolRange });
            const typeStart = new vscode.Position(lineIdx, cmdIdx + 1);
            const typeEnd = new vscode.Position(lineIdx, cmdIdx + 1 + name.length);
            const typeRange = new vscode.Range(typeStart, typeEnd);
            const decTypeNormal = getDecorationType(finalBaseStyle);
            const cacheKeyNormal = JSON.stringify(finalBaseStyle);
            decorationTypes.set(cacheKeyNormal, decTypeNormal);
            if (!combinedDecorations.has(cacheKeyNormal)) {
              combinedDecorations.set(cacheKeyNormal, []);
            }
            combinedDecorations.get(cacheKeyNormal).push({ range: typeRange });
            if (title) {
              const titleIdx = lineText.indexOf(title, cmdIdx + name.length + 1);
              if (titleIdx !== -1) {
                const titleStart = new vscode.Position(lineIdx, titleIdx);
                const titleEnd = new vscode.Position(lineIdx, titleIdx + title.length);
                const titleRange = new vscode.Range(titleStart, titleEnd);
                const finalTitleStyle = getFinalTitleStyle("@", name, finalBaseStyle, resolvedName);
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
          const name = match[2] || (symbol === "#" ? "num" : "generic");
          const title = (match[3] || "").trim();
          const level = hashes.length;
          const newItem = { name, level };
          let closeIdx = -1;
          for (let i = 0; i < stack.length; i++) {
            const openItem = stack[i];
            if (openItem.level !== void 0) {
              if (shouldClose(openItem, newItem, frontmatterAliases)) {
                closeIdx = i;
                break;
              }
            }
          }
          if (closeIdx !== -1) {
            stack.splice(closeIdx);
          }
          stack.push({ name, title, level });
          const cmdText = match[2] ? hashes + name : hashes;
          const cmdIdx = lineText.indexOf(cmdText);
          if (cmdIdx !== -1) {
            const resolvedName = resolveName(name, frontmatterAliases);
            const finalBaseStyle = getFinalBaseStyle(symbol, name, resolvedName);
            const finalSymbolStyle = getFinalSymbolStyle(symbol, name, finalBaseStyle.color, resolvedName);
            const symbolStart = new vscode.Position(lineIdx, cmdIdx);
            const symbolEnd = new vscode.Position(lineIdx, cmdIdx + hashes.length);
            const symbolRange = new vscode.Range(symbolStart, symbolEnd);
            const decTypeSymbol = getDecorationType(finalSymbolStyle);
            const cacheKeySymbol = JSON.stringify(finalSymbolStyle);
            decorationTypes.set(cacheKeySymbol, decTypeSymbol);
            if (!combinedDecorations.has(cacheKeySymbol)) {
              combinedDecorations.set(cacheKeySymbol, []);
            }
            combinedDecorations.get(cacheKeySymbol).push({ range: symbolRange });
            if (match[2]) {
              const typeStart = new vscode.Position(lineIdx, cmdIdx + hashes.length);
              const typeEnd = new vscode.Position(lineIdx, cmdIdx + cmdText.length);
              const typeRange = new vscode.Range(typeStart, typeEnd);
              const decTypeNormal = getDecorationType(finalBaseStyle);
              const cacheKeyNormal = JSON.stringify(finalBaseStyle);
              decorationTypes.set(cacheKeyNormal, decTypeNormal);
              if (!combinedDecorations.has(cacheKeyNormal)) {
                combinedDecorations.set(cacheKeyNormal, []);
              }
              combinedDecorations.get(cacheKeyNormal).push({ range: typeRange });
            }
            let hasSameLineParams = false;
            if (title) {
              const titleIdx = lineText.indexOf(title, cmdIdx + cmdText.length);
              if (titleIdx !== -1) {
                const titleMatch = title.match(/^(.*?)(?:\s*(\{.*))?$/);
                const mainTitleText = titleMatch ? titleMatch[1].trim() : title;
                const paramsText = titleMatch && titleMatch[2] ? titleMatch[2].trim() : "";
                if (paramsText) {
                  hasSameLineParams = true;
                  if (mainTitleText) {
                    const mainTitleIdx = titleIdx + title.indexOf(mainTitleText);
                    const range = new vscode.Range(
                      new vscode.Position(lineIdx, mainTitleIdx),
                      new vscode.Position(lineIdx, mainTitleIdx + mainTitleText.length)
                    );
                    const finalTitleStyle = getFinalNestedStyle(symbol, name, "title", finalBaseStyle, resolvedName);
                    const decType = getDecorationType(finalTitleStyle);
                    const cacheKey = JSON.stringify(finalTitleStyle);
                    decorationTypes.set(cacheKey, decType);
                    if (!combinedDecorations.has(cacheKey)) {
                      combinedDecorations.set(cacheKey, []);
                    }
                    combinedDecorations.get(cacheKey).push({ range });
                  }
                  const paramsIdx = lineText.indexOf(paramsText, titleIdx + mainTitleText.length);
                  if (paramsIdx !== -1) {
                    const range = new vscode.Range(
                      new vscode.Position(lineIdx, paramsIdx),
                      new vscode.Position(lineIdx, paramsIdx + paramsText.length)
                    );
                    const finalParamsStyle = getFinalNestedStyle(symbol, name, "params", finalBaseStyle, resolvedName);
                    const decType = getDecorationType(finalParamsStyle);
                    const cacheKey = JSON.stringify(finalParamsStyle);
                    decorationTypes.set(cacheKey, decType);
                    if (!combinedDecorations.has(cacheKey)) {
                      combinedDecorations.set(cacheKey, []);
                    }
                    combinedDecorations.get(cacheKey).push({ range });
                  }
                  const lineBalance = getParameterBalance(paramsText);
                  if (lineBalance > 0) {
                    inParameterBlock = true;
                    parameterBalance = lineBalance;
                    parameterSymbol = symbol;
                    parameterTypeName = name;
                    parameterResolvedName = resolvedName;
                  }
                } else {
                  const titleStart = new vscode.Position(lineIdx, titleIdx);
                  const titleEnd = new vscode.Position(lineIdx, titleIdx + title.length);
                  const titleRange = new vscode.Range(titleStart, titleEnd);
                  const finalTitleStyle = getFinalNestedStyle(symbol, name, "title", finalBaseStyle, resolvedName);
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
            if (!hasSameLineParams) {
              const nextLineText = lineIdx + 1 < document.lineCount ? document.lineAt(lineIdx + 1).text.trim() : "";
              if (nextLineText.startsWith("{")) {
                inParameterBlock = true;
                parameterBalance = 0;
                parameterSymbol = symbol;
                parameterTypeName = name;
                parameterResolvedName = resolvedName;
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
          let idx = -1;
          for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i].isBlock) {
              if (!closingName || stack[i].name === closingName) {
                idx = i;
                break;
              }
            }
          }
          if (idx !== -1) {
            while (stack.length > idx) {
              openDir = stack.pop();
            }
          }
          if (openDir) {
            const endIdx = lineText.indexOf(trimmed);
            if (endIdx !== -1) {
              const startPos = new vscode.Position(lineIdx, endIdx);
              const endPos = new vscode.Position(lineIdx, endIdx + trimmed.length);
              const range = new vscode.Range(startPos, endPos);
              const resolvedName = resolveName(openDir.name, frontmatterAliases);
              const finalBaseStyle = getFinalBaseStyle("@", openDir.name, resolvedName);
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
                    color: attenuateColor(finalBaseStyle.color),
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
  const edumarkCompletionProvider = vscode.languages.registerCompletionItemProvider(
    "edumark",
    {
      provideCompletionItems(document, position, token, context2) {
        const lineText = document.lineAt(position.line).text;
        const textBeforeCursor = lineText.substring(0, position.character);
        const hashIndex = textBeforeCursor.lastIndexOf("#");
        const atIndex = textBeforeCursor.lastIndexOf("@");
        let triggerChar = "";
        let triggerIndex = -1;
        if (hashIndex !== -1 && (atIndex === -1 || hashIndex > atIndex)) {
          triggerChar = "#";
          triggerIndex = hashIndex;
        } else if (atIndex !== -1 && (hashIndex === -1 || atIndex > hashIndex)) {
          triggerChar = "@";
          triggerIndex = atIndex;
        }
        if (triggerIndex === -1) {
          return [];
        }
        const prefixBeforeTrigger = textBeforeCursor.substring(0, triggerIndex);
        if (prefixBeforeTrigger.trim() !== "") {
          return [];
        }
        const items = [];
        if (triggerChar === "#") {
          const itemPagina = new vscode.CompletionItem("pagina", vscode.CompletionItemKind.Snippet);
          itemPagina.insertText = new vscode.SnippetString("pagina ${1:T\xEDtulo de la p\xE1gina}");
          itemPagina.filterText = "pagina";
          itemPagina.documentation = new vscode.MarkdownString("Define una nueva p\xE1gina.");
          items.push(itemPagina);
          const itemSeccion = new vscode.CompletionItem("seccion", vscode.CompletionItemKind.Snippet);
          itemSeccion.insertText = new vscode.SnippetString("seccion ${1:T\xEDtulo de la secci\xF3n}");
          itemSeccion.filterText = "seccion";
          itemSeccion.documentation = new vscode.MarkdownString("Define una secci\xF3n dentro de la p\xE1gina.");
          items.push(itemSeccion);
        } else if (triggerChar === "@") {
          const standardDirectives = [
            { name: "pestanas", desc: "Bloque de pesta\xF1as FX.", body: "pestanas\n\n#item ${1:T\xEDtulo}\n${2:Contenido...}\n\n#item ${3:T\xEDtulo}\n${4:Contenido...}\n\n@end" },
            { name: "acordeon", desc: "Bloque de acorde\xF3n FX.", body: "acordeon\n\n#item ${1:T\xEDtulo}\n${2:Contenido...}\n\n#item ${3:T\xEDtulo}\n${4:Contenido...}\n\n@end" },
            { name: "carrusel", desc: "Bloque de carrusel FX.", body: "carrusel\n\n#item ${1:T\xEDtulo}\n${2:Contenido...}\n\n#item ${3:T\xEDtulo}\n${4:Contenido...}\n\n@end" },
            { name: "paginacion", desc: "Bloque de paginaci\xF3n FX.", body: "paginacion\n\n#item ${1:T\xEDtulo}\n${2:Contenido...}\n\n#item ${3:T\xEDtulo}\n${4:Contenido...}\n\n@end" },
            { name: "didyouknow", desc: 'Tarjeta did\xE1ctica "Did you know?".', body: "didyouknow ${1:T\xEDtulo opcional}\n${2:Contenido...}\n@end" },
            { name: "warning", desc: "Tarjeta did\xE1ctica de advertencia.", body: "warning ${1:T\xEDtulo opcional}\n${2:Contenido...}\n@end" },
            { name: "hint", desc: "Tarjeta did\xE1ctica de sugerencia.", body: "hint ${1:T\xEDtulo opcional}\n${2:Contenido...}\n@end" },
            { name: "solution", desc: "Tarjeta did\xE1ctica de soluci\xF3n.", body: "solution ${1:T\xEDtulo opcional}\n${2:Contenido...}\n@end" },
            { name: "reflection", desc: "Tarjeta did\xE1ctica de reflexi\xF3n.", body: "reflection ${1:T\xEDtulo opcional}\n${2:Contenido...}\n@end" },
            { name: "activity", desc: "Tarjeta did\xE1ctica de actividad.", body: "activity ${1:T\xEDtulo opcional}\n${2:Contenido...}\n@end" },
            { name: "note", desc: "Tarjeta did\xE1ctica de nota.", body: "note ${1:T\xEDtulo opcional}\n${2:Contenido...}\n@end" },
            { name: "question", desc: "Bloque de pregunta interactiva.", body: "question type=${1|multiple-choice,true-false|}\n${2:Pregunta...}\n@end" },
            { name: "rubric", desc: "Inserta un bloque de r\xFAbrica.", body: "rubric ${1:T\xEDtulo de la r\xFAbrica}\n\n| Criterio | Excelente | A mejorar |\n| :--- | :--- | :--- |\n| ${2:Criterio 1} | ${3:Excelente...} | ${4:A mejorar...} |\n\n@end" },
            { name: "ataula", desc: "Envoltorio para a\xF1adir pie/t\xEDtulo a tablas.", body: "ataula ${1:T\xEDtulo de la tabla}\n${2:Contenido...}\n@end" },
            { name: "end", desc: "Cierra el bloque directivo actual.", body: "end" }
          ];
          for (const dir of standardDirectives) {
            const item = new vscode.CompletionItem(dir.name, vscode.CompletionItemKind.Snippet);
            item.insertText = new vscode.SnippetString(dir.body);
            item.filterText = dir.name;
            item.documentation = new vscode.MarkdownString(dir.desc);
            items.push(item);
          }
        }
        return items;
      }
    },
    "#",
    "@"
  );
  context.subscriptions.push(edumarkCompletionProvider);
  const selector = "edumark";
  context.subscriptions.push(
    vscode.languages.registerDocumentDropEditProvider(
      selector,
      new EdumarkDropEditProvider()
    )
  );
  context.subscriptions.push(
    vscode.languages.registerDocumentPasteEditProvider(
      selector,
      new EdumarkPasteEditProvider(),
      {
        pasteMimeTypes: ["image/*", "text/uri-list", "files"],
        providedPasteEditKinds: [vscode.DocumentDropOrPasteEditKind.Text]
      }
    )
  );
  return {
    parseEdumark(source, aliasesModule) {
      return parseEdumark(source, aliasesModule);
    },
    parseSectionContent(lines, metadata) {
      return parseSectionContent(lines, metadata);
    },
    parseParametersString(str) {
      return parseParametersString(str);
    }
  };
}
function getProjectRoot(document) {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (workspaceFolder) {
    return workspaceFolder.uri;
  }
  return vscode.Uri.joinPath(document.uri, "..");
}
async function getUniqueFilePath(rootUri, baseName, ext) {
  let name = baseName || "imagen";
  if (name.toLowerCase().endsWith(ext.toLowerCase())) {
    name = name.slice(0, -ext.length);
  }
  name = name.replace(/[^a-zA-Z0-9_\-]/g, "_");
  let index = 0;
  let targetUri = vscode.Uri.joinPath(rootUri, `${name}${ext}`);
  while (true) {
    try {
      await vscode.workspace.fs.stat(targetUri);
      index++;
      targetUri = vscode.Uri.joinPath(rootUri, `${name}_${index}${ext}`);
    } catch {
      break;
    }
  }
  return targetUri;
}
async function saveAndInsertImage(document, position, dataOrUri, originalName, ext) {
  try {
    const rootUri = getProjectRoot(document);
    let baseName = originalName || "imagen";
    if (baseName.toLowerCase().endsWith(ext.toLowerCase())) {
      baseName = baseName.slice(0, -ext.length);
    }
    const targetUri = await getUniqueFilePath(rootUri, baseName, ext);
    if (dataOrUri instanceof Uint8Array) {
      await vscode.workspace.fs.writeFile(targetUri, dataOrUri);
    } else {
      await vscode.workspace.fs.copy(dataOrUri, targetUri, { overwrite: false });
    }
    const documentDir = path.dirname(document.uri.fsPath);
    const relPath = path.relative(documentDir, targetUri.fsPath).replace(/\\/g, "/");
    const insertText = `#imagen ${relPath} {ancho: 600, pie: , sombra: no, borde: no}
`;
    const workspaceEdit = new vscode.WorkspaceEdit();
    workspaceEdit.insert(document.uri, position, insertText);
    return await vscode.workspace.applyEdit(workspaceEdit);
  } catch (err) {
    console.error("Error saving image and applying edit:", err);
    return false;
  }
}
var EdumarkDropEditProvider = class {
  async provideDocumentDropEdits(document, position, dataTransfer, token) {
    const uriListItem = dataTransfer.get("text/uri-list");
    if (uriListItem) {
      const uriList = await uriListItem.asString();
      const uris = uriList.split("\n").map((u) => u.trim()).filter(Boolean);
      for (const uriStr of uris) {
        try {
          const sourceUri = vscode.Uri.parse(uriStr);
          const ext = path.extname(sourceUri.path).toLowerCase();
          if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(ext)) {
            const baseName = path.basename(sourceUri.fsPath, ext);
            await saveAndInsertImage(document, position, sourceUri, baseName, ext);
            return void 0;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    for (const [mimeType, item] of dataTransfer) {
      if (mimeType.startsWith("image/")) {
        const file = item.asFile();
        if (file) {
          const ext = "." + (mimeType.split("/")[1] || "png");
          const binaryData = await file.data();
          await saveAndInsertImage(document, position, binaryData, file.name || `image${ext}`, ext);
          return void 0;
        }
      }
    }
    return void 0;
  }
};
var EdumarkPasteEditProvider = class {
  async provideDocumentPasteEdits(document, ranges, dataTransfer, context, token) {
    const position = ranges[0].start;
    for (const [mimeType, item] of dataTransfer) {
      if (mimeType.startsWith("image/")) {
        const file = item.asFile();
        if (file) {
          const ext = "." + (mimeType.split("/")[1] || "png");
          const binaryData = await file.data();
          await saveAndInsertImage(document, position, binaryData, file.name || `image${ext}`, ext);
          return [];
        }
      }
    }
    const uriListItem = dataTransfer.get("text/uri-list");
    if (uriListItem) {
      const uriList = await uriListItem.asString();
      const uris = uriList.split("\n").map((u) => u.trim()).filter(Boolean);
      for (const uriStr of uris) {
        try {
          const sourceUri = vscode.Uri.parse(uriStr);
          const ext = path.extname(sourceUri.path).toLowerCase();
          if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(ext)) {
            const baseName = path.basename(sourceUri.fsPath, ext);
            await saveAndInsertImage(document, position, sourceUri, baseName, ext);
            return [];
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    return void 0;
  }
};
function generateId() {
  return Math.random().toString(36).substring(2, 9) + "_" + Math.random().toString(36).substring(2, 9);
}
function getBraceBalance(str) {
  let balance = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplateLiteral = false;
  let escape = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === "'" && !inDoubleQuote && !inTemplateLiteral) {
      const isApostrophe = i > 0 && i < str.length - 1 && /[a-zA-Z0-9]/.test(str[i - 1]) && /[a-zA-Z0-9]/.test(str[i + 1]);
      if (!isApostrophe) {
        inSingleQuote = !inSingleQuote;
      }
      continue;
    }
    if (char === '"' && !inSingleQuote && !inTemplateLiteral) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (char === "`" && !inSingleQuote && !inDoubleQuote) {
      inTemplateLiteral = !inTemplateLiteral;
      continue;
    }
    if (!inSingleQuote && !inDoubleQuote && !inTemplateLiteral) {
      if (char === "{") {
        balance++;
      } else if (char === "}") {
        balance--;
      }
    }
  }
  return balance;
}
function generateSlug(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function parseParametersString(str) {
  let cleanStr = str.trim();
  if (cleanStr.startsWith("{") && cleanStr.endsWith("}")) {
    cleanStr = cleanStr.substring(1, cleanStr.length - 1).trim();
  }
  const firstKeyMatch = cleanStr.match(/^([a-zA-Z0-9_\-]+)\s*:/);
  if (!firstKeyMatch) {
    return {};
  }
  const keys = [];
  keys.push({
    name: firstKeyMatch[1],
    startIndex: 0,
    valueStartIndex: firstKeyMatch[0].length
  });
  const keyRegex = /,\s*([a-zA-Z0-9_\-]+)\s*:/g;
  let match;
  while ((match = keyRegex.exec(cleanStr)) !== null) {
    const prevKey = keys[keys.length - 1];
    prevKey.endIndex = match.index;
    keys.push({
      name: match[1],
      startIndex: match.index,
      valueStartIndex: match.index + match[0].length
    });
  }
  keys[keys.length - 1].endIndex = cleanStr.length;
  const attrs = {};
  for (const key of keys) {
    const k = key.name.trim().toLowerCase();
    let v = cleanStr.substring(key.valueStartIndex, key.endIndex).trim();
    if (v.startsWith('"') && v.endsWith('"') || v.startsWith("'") && v.endsWith("'")) {
      v = v.substring(1, v.length - 1).trim();
    }
    if (v.toLowerCase() === "true") {
      attrs[k] = true;
    } else if (v.toLowerCase() === "false") {
      attrs[k] = false;
    } else if (/^\d+(\.\d+)?$/.test(v)) {
      attrs[k] = Number(v);
    } else {
      attrs[k] = v;
    }
  }
  return attrs;
}
function extractParameters(lines, currentIdx, titleWithParams) {
  let title = titleWithParams.trim();
  let params = "";
  let nextIdx = currentIdx;
  const braceIdx = title.indexOf("{");
  if (braceIdx !== -1) {
    const mainTitle = title.substring(0, braceIdx).trim();
    const startParams = title.substring(braceIdx);
    let balance = getBraceBalance(startParams);
    let paramsLines = [startParams];
    while (balance > 0 && nextIdx + 1 < lines.length) {
      nextIdx++;
      const nextLine = lines[nextIdx];
      paramsLines.push(nextLine);
      balance += getBraceBalance(nextLine);
    }
    const fullParams = paramsLines.join("\n");
    const firstBrace = fullParams.indexOf("{");
    const lastBrace = fullParams.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      params = fullParams.substring(firstBrace + 1, lastBrace).trim();
    } else {
      params = fullParams.substring(firstBrace + 1).trim();
    }
    return { title: mainTitle, params, nextIdx };
  }
  if (currentIdx + 1 < lines.length) {
    const nextLine = lines[currentIdx + 1];
    if (nextLine.trim().startsWith("{")) {
      nextIdx++;
      let balance = getBraceBalance(nextLine);
      let paramsLines = [nextLine];
      while (balance > 0 && nextIdx + 1 < lines.length) {
        nextIdx++;
        const nextLine2 = lines[nextIdx];
        paramsLines.push(nextLine2);
        balance += getBraceBalance(nextLine2);
      }
      const fullParams = paramsLines.join("\n");
      const firstBrace = fullParams.indexOf("{");
      const lastBrace = fullParams.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        params = fullParams.substring(firstBrace + 1, lastBrace).trim();
      } else {
        params = fullParams.substring(firstBrace + 1).trim();
      }
      return { title, params, nextIdx };
    }
  }
  return { title, params, nextIdx };
}
function parseSectionContent(lines, metadata) {
  const rootBlocks = [];
  const stack = [];
  const defaultAliases = {
    "page": "block-page",
    "pagina": "block-page",
    "seccion": "idevice-text",
    "tarea": "idevice-activity",
    "rubrica": "idevice-rubric",
    "cotejo": "idevice-cotejo",
    "idevice-cotejo": "idevice-cotejo",
    "imagen": "media-image",
    "portada": "media-cover",
    "item": "tab-item",
    "actividad": "idevice-activity",
    "activity": "idevice-activity",
    "atencion": "idevice-warning",
    "warning": "idevice-warning",
    "sabiasque": "idevice-didyouknow",
    "didyouknow": "idevice-didyouknow",
    "sugerencia": "idevice-hint",
    "hint": "idevice-hint",
    "solucion": "idevice-solution",
    "solution": "idevice-solution",
    "reflexion": "idevice-reflection",
    "reflection": "idevice-reflection",
    "nota": "idevice-note",
    "note": "idevice-note",
    "pregunta": "idevice-question",
    "question": "idevice-question",
    "preguntate": "idevice-ask_yourself",
    "ask_yourself": "idevice-ask_yourself",
    "informacion": "idevice-generic",
    "generic": "idevice-generic"
  };
  function resolveName(name) {
    if (metadata && metadata.aliases && typeof metadata.aliases === "object") {
      if (name in metadata.aliases) {
        return String(metadata.aliases[name]);
      }
    }
    return defaultAliases[name] || name;
  }
  function getCategory(name) {
    const idx = name.indexOf("-");
    return idx !== -1 ? name.substring(0, idx) : name;
  }
  function shouldClose(openBlock, newBlock) {
    const rOpen = resolveName(openBlock.name || "");
    const rNew = resolveName(newBlock.name || "");
    const catOpen = getCategory(rOpen);
    const catNew = getCategory(rNew);
    if (catNew === "block") {
      if (catOpen === "block") {
        return (openBlock.level || 1) >= (newBlock.level || 1);
      }
      return true;
    }
    return catOpen === catNew;
  }
  let inComponent = false;
  let componentName = "";
  let componentLevel = void 0;
  let componentLinesAccumulator = [];
  let braceBalance = 0;
  function getCurrentContainer() {
    if (stack.length > 0) {
      return stack[stack.length - 1].children;
    }
    return rootBlocks;
  }
  function appendTextLine(line) {
    const container = getCurrentContainer();
    if (container.length > 0 && container[container.length - 1].type === "text") {
      container[container.length - 1].content.push(line);
    } else {
      container.push({ type: "text", content: [line] });
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (inComponent) {
      componentLinesAccumulator.push(line);
      braceBalance += getBraceBalance(line);
      if (braceBalance <= 0) {
        const literalStr = componentLinesAccumulator.join("\n");
        getCurrentContainer().push({
          type: "component",
          name: componentName,
          level: componentLevel,
          literalStr
        });
        inComponent = false;
        componentName = "";
        componentLevel = void 0;
        componentLinesAccumulator = [];
        braceBalance = 0;
      }
      continue;
    }
    let isComp = false;
    let hashes = void 0;
    let level = void 0;
    let rest = void 0;
    let compMatch = trimmed.match(/^:::([a-zA-Z0-9_\-]+)(?:\s*(\{.*))?$/);
    if (compMatch) {
      isComp = true;
      componentName = compMatch[1];
      rest = compMatch[2];
    } else {
      compMatch = trimmed.match(/^(#{1,5})([a-zA-Z0-9_\-]+)(?:\s*(\{.*))$/);
      if (compMatch) {
        isComp = true;
        hashes = compMatch[1];
        level = hashes.length;
        componentName = compMatch[2];
        rest = compMatch[3];
      }
    }
    if (isComp) {
      if (!rest) {
        getCurrentContainer().push({
          type: "component",
          name: componentName,
          level,
          literalStr: "{}"
        });
      } else {
        braceBalance = getBraceBalance(rest);
        if (braceBalance <= 0) {
          getCurrentContainer().push({
            type: "component",
            name: componentName,
            level,
            literalStr: rest
          });
        } else {
          inComponent = true;
          componentLevel = level;
          componentLinesAccumulator = [rest];
        }
      }
      continue;
    }
    if (trimmed.startsWith("@") && !trimmed.startsWith("@end") && /^[a-zA-Z_]/.test(trimmed.substring(1))) {
      const match = trimmed.match(/^@([a-zA-Z0-9_\-]+)(?:\s+(.*))?$/);
      if (match) {
        const name = match[1];
        const ext = extractParameters(lines, i, match[2] || "");
        const title = ext.title || void 0;
        const paramsStr = ext.params;
        i = ext.nextIdx;
        const newBlock = {
          type: "directive",
          name,
          title,
          children: [],
          literalStr: paramsStr
        };
        getCurrentContainer().push(newBlock);
        stack.push(newBlock);
      } else {
        appendTextLine(line);
      }
      continue;
    }
    if (trimmed.startsWith("@end")) {
      let foundIdx = -1;
      for (let j = stack.length - 1; j >= 0; j--) {
        if (stack[j].type === "directive" && stack[j].level === void 0) {
          foundIdx = j;
          break;
        }
      }
      if (foundIdx !== -1) {
        stack.splice(foundIdx);
      } else if (stack.length > 0) {
        stack.pop();
      }
      continue;
    }
    const mName = trimmed.match(/^(#{1,5})([a-zA-Z0-9_\-]+)(?:\s+(.+))?$/);
    if (mName && mName[2].toLowerCase() !== "pagina") {
      const level2 = mName[1].length;
      const name = mName[2].toLowerCase();
      const ext = extractParameters(lines, i, mName[3] || "");
      const title = ext.title;
      const paramsStr = ext.params;
      i = ext.nextIdx;
      const newBlock = {
        type: "directive",
        name,
        title,
        level: level2,
        children: [],
        literalStr: paramsStr
      };
      let closeIdx = -1;
      for (let j = 0; j < stack.length; j++) {
        if (stack[j].type === "directive" && stack[j].level !== void 0) {
          if (shouldClose(stack[j], newBlock)) {
            closeIdx = j;
            break;
          }
        }
      }
      if (closeIdx !== -1) {
        stack.splice(closeIdx);
      }
      getCurrentContainer().push(newBlock);
      const rName = resolveName(name);
      const category = getCategory(rName);
      if (category !== "media") {
        stack.push(newBlock);
      }
      continue;
    }
    appendTextLine(line);
  }
  if (inComponent && componentLinesAccumulator.length > 0) {
    getCurrentContainer().push({
      type: "component",
      name: componentName,
      literalStr: componentLinesAccumulator.join("\n")
    });
  }
  return rootBlocks;
}
function parseEdumark(source, aliasesModule) {
  const defaultAliases = {
    "page": "block-page",
    "pagina": "block-page",
    "seccion": "idevice-text",
    "tarea": "idevice-activity",
    "rubrica": "idevice-rubric",
    "cotejo": "idevice-cotejo",
    "idevice-cotejo": "idevice-cotejo",
    "imagen": "media-image",
    "portada": "media-cover",
    "item": "tab-item"
  };
  function resolveName(name) {
    if (metadata && metadata.aliases && typeof metadata.aliases === "object") {
      if (name in metadata.aliases) {
        return String(metadata.aliases[name]);
      }
    }
    return defaultAliases[name] || name;
  }
  function getCategory(name) {
    const idx = name.indexOf("-");
    return idx !== -1 ? name.substring(0, idx) : name;
  }
  const lines = source.split(/\r?\n/);
  const metadata = {};
  let lineIdx = 0;
  if (lines.length > 0 && lines[0].trim() === "---") {
    lineIdx++;
    while (lineIdx < lines.length) {
      const line = lines[lineIdx];
      const trimmed = line.trim();
      if (trimmed === "---") {
        break;
      }
      if (trimmed === "") {
        lineIdx++;
        continue;
      }
      const keyMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):(.*)$/);
      if (keyMatch) {
        const k = keyMatch[1].toLowerCase();
        const rest = keyMatch[2];
        const restTrim = rest.trim();
        if (restTrim.startsWith('"""')) {
          if (restTrim.length > 6 && restTrim.endsWith('"""')) {
            metadata[k] = restTrim.substring(3, restTrim.length - 3);
            lineIdx++;
          } else {
            const accum = [];
            const firstLineContent = restTrim.substring(3);
            if (firstLineContent.trim() !== "") {
              accum.push(firstLineContent);
            }
            lineIdx++;
            let foundEnd = false;
            while (lineIdx < lines.length) {
              const curLine = lines[lineIdx];
              const curTrimmed = curLine.trim();
              if (curTrimmed === "---") {
                break;
              }
              if (curTrimmed.endsWith('"""')) {
                const lastLineContent = curLine.substring(0, curLine.lastIndexOf('"""'));
                if (lastLineContent.trim() !== "") {
                  accum.push(lastLineContent);
                }
                foundEnd = true;
                lineIdx++;
                break;
              }
              accum.push(curLine);
              lineIdx++;
            }
            metadata[k] = accum.join("\n");
          }
        } else {
          const accum = [];
          if (restTrim !== "") {
            accum.push(restTrim);
          }
          lineIdx++;
          while (lineIdx < lines.length) {
            const curLine = lines[lineIdx];
            const curTrimmed = curLine.trim();
            if (curTrimmed === "---") {
              break;
            }
            const nextKeyMatch = curLine.match(/^([a-zA-Z_][a-zA-Z0-9_]*):/);
            if (nextKeyMatch) {
              break;
            }
            accum.push(curLine);
            lineIdx++;
          }
          let finalVal = accum.join("\n");
          if (!finalVal.includes("\n")) {
            if (finalVal.startsWith('"') && finalVal.endsWith('"')) {
              finalVal = finalVal.substring(1, finalVal.length - 1);
            } else if (finalVal.startsWith("'") && finalVal.endsWith("'")) {
              finalVal = finalVal.substring(1, finalVal.length - 1);
            }
          }
          metadata[k] = finalVal;
        }
      } else {
        lineIdx++;
      }
    }
    if (lineIdx < lines.length && lines[lineIdx].trim() === "---") {
      lineIdx++;
    }
  }
  const pages = [];
  let currentPage = null;
  let currentSection = null;
  function startNewPage(title, level, type = "pagina") {
    const slug = generateSlug(title);
    const id = "page_" + generateId();
    const filename = pages.length === 0 ? "index.html" : `html/${slug}.html`;
    const newPage = {
      id,
      title,
      level,
      slug,
      filename,
      parent: null,
      children: [],
      sections: [],
      type
    };
    pages.push(newPage);
    currentPage = newPage;
    startNewSection("");
    return newPage;
  }
  function startNewSection(title, options) {
    if (!currentPage) {
      currentPage = startNewPage("Portada", 1);
    }
    const blockId = "block_" + generateId();
    const componentId = "component_" + generateId();
    const newSection = {
      blockId,
      componentId,
      title,
      contentLines: [],
      options: options || {}
    };
    currentPage.sections.push(newSection);
    currentSection = newSection;
  }
  for (; lineIdx < lines.length; lineIdx++) {
    let line = lines[lineIdx];
    if (aliasesModule && typeof aliasesModule.transformLine === "function") {
      try {
        line = aliasesModule.transformLine(line);
      } catch (err) {
        console.error("Error in transformLine:", err);
      }
    }
    const trimmed = line.trim();
    let isPage = false;
    let pageTitle = "";
    let pageLevel = 1;
    let pageType = "pagina";
    const m1 = trimmed.match(/^(#+)\s*(?:pagina|page)\s+(.+)$/);
    if (m1) {
      isPage = true;
      pageLevel = m1[1].length;
      pageType = "pagina";
      const ext = extractParameters(lines, lineIdx, m1[2]);
      pageTitle = ext.title;
      let pageOptions = {};
      if (ext.params) {
        try {
          pageOptions = parseParametersString(ext.params);
        } catch (e) {
        }
      }
      currentPage = startNewPage(pageTitle, pageLevel, pageType);
      if (currentPage) {
        currentPage.options = pageOptions;
      }
      lineIdx = ext.nextIdx;
      continue;
    }
    let isSection = false;
    let isPureSection = false;
    let secTitle = "";
    let secOptions = {};
    const mSec1 = trimmed.match(/^>\s+(.+)$/);
    if (mSec1 && !trimmed.startsWith(">>")) {
      isSection = true;
      isPureSection = true;
      const ext = extractParameters(lines, lineIdx, mSec1[1]);
      secTitle = ext.title;
      if (ext.params) {
        try {
          secOptions = parseParametersString(ext.params);
        } catch (e) {
        }
      }
      lineIdx = ext.nextIdx;
    } else {
      const mSec2 = trimmed.match(/^(#{1,5})([a-zA-Z0-9_\-]+)(?:\s+(.+))?$/);
      if (mSec2) {
        const name = mSec2[2].toLowerCase();
        if (name !== "pagina" && name !== "page") {
          const resolved = resolveName(name);
          const category = getCategory(resolved);
          if (category === "idevice") {
            isSection = true;
            isPureSection = name === "seccion";
            const rawTitle = mSec2[3] ? mSec2[3].trim() : "";
            const ext = extractParameters(lines, lineIdx, rawTitle);
            secTitle = ext.title || (rawTitle ? "" : name.charAt(0).toUpperCase() + name.slice(1));
            if (ext.params) {
              try {
                secOptions = parseParametersString(ext.params);
              } catch (e) {
              }
            }
            lineIdx = ext.nextIdx;
          }
        }
      }
    }
    if (isSection) {
      let overwrote = false;
      if (currentPage && currentPage.sections.length > 0) {
        const lastSec = currentPage.sections[currentPage.sections.length - 1];
        const isSectionTrulyEmpty = lastSec.contentLines.every((l) => l.trim() === "");
        if (lastSec.title === "" && isSectionTrulyEmpty) {
          lastSec.title = secTitle;
          lastSec.contentLines = [];
          lastSec.options = secOptions;
          currentSection = lastSec;
          overwrote = true;
        }
      }
      if (!overwrote) {
        startNewSection(secTitle, secOptions);
      }
      if (isPureSection) {
        continue;
      }
    }
    if (!currentPage && trimmed === "") {
      continue;
    }
    if (!currentSection) {
      startNewSection("");
    }
    currentSection.contentLines.push(line);
  }
  const lastPagesByLevel = {};
  for (const p of pages) {
    const lvl = p.level;
    lastPagesByLevel[lvl] = p;
    if (lvl > 1) {
      let parentLvl = lvl - 1;
      while (parentLvl > 0 && !lastPagesByLevel[parentLvl]) {
        parentLvl--;
      }
      if (parentLvl > 0) {
        const parent = lastPagesByLevel[parentLvl];
        p.parent = parent;
        parent.children.push(p);
      }
    }
  }
  return { metadata, pages };
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
