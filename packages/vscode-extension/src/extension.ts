import * as vscode from 'vscode';
import * as path from 'path';

let activeDecorations: { [key: string]: vscode.TextEditorDecorationType } = {};

export function activate(context: vscode.ExtensionContext) {
  console.log('La extensión Edumark está activa.');

  // CSS Dynamic Highlights Engine
  interface Rule {
    selectors: string[];
    properties: Record<string, string>;
    nested: Rule[];
  }

  let currentRules: Rule[] = [];

  function kebabToCamel(str: string): string {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }

  function convertProperties(props: Record<string, string>): Record<string, string> {
    const converted: Record<string, string> = {};
    for (const [key, val] of Object.entries(props)) {
      converted[kebabToCamel(key)] = val;
    }
    return converted;
  }

  function processRules(rules: Rule[]) {
    rules.forEach(rule => {
      rule.properties = convertProperties(rule.properties);
      processRules(rule.nested);
    });
  }

  function parseCSS(cssText: string): Rule[] {
    const cleanCss = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
    let pos = 0;
    const len = cleanCss.length;
    
    function skipWhitespace() {
      while (pos < len && /\s/.test(cleanCss[pos])) {
        pos++;
      }
    }
    
    function parseBlock(): { properties: Record<string, string>; nested: Rule[] } {
      const properties: Record<string, string> = {};
      const nested: Rule[] = [];
      
      while (pos < len) {
        skipWhitespace();
        if (pos >= len) break;
        
        if (cleanCss[pos] === '}') {
          pos++; // consume '}'
          break;
        }
        
        let start = pos;
        let hasColon = false;
        
        while (pos < len && cleanCss[pos] !== '{' && cleanCss[pos] !== '}' && cleanCss[pos] !== ';') {
          if (cleanCss[pos] === ':' && !hasColon) {
            hasColon = true;
          }
          pos++;
        }
        
        if (pos >= len) break;
        
        const char = cleanCss[pos];
        if (char === '{') {
          const selectorText = cleanCss.substring(start, pos).trim();
          pos++; // consume '{'
          const block = parseBlock();
          if (selectorText) {
            const selectors = selectorText.split(',').map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
            nested.push({ selectors, properties: block.properties, nested: block.nested });
          }
        } else if (char === ';' || char === '}') {
          const statement = cleanCss.substring(start, pos).trim();
          if (char === ';') {
            pos++; // consume ';'
          }
          
          if (statement) {
            const cIdx = statement.indexOf(':');
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
    
    const rootRules: Rule[] = [];
    while (pos < len) {
      skipWhitespace();
      if (pos >= len) break;
      
      let start = pos;
      while (pos < len && cleanCss[pos] !== '{' && cleanCss[pos] !== '}') {
        pos++;
      }
      if (pos >= len) break;
      
      const selectorText = cleanCss.substring(start, pos).trim();
      if (cleanCss[pos] === '{') {
        pos++; // consume '{'
        const block = parseBlock();
        if (selectorText) {
          const selectors = selectorText.split(',').map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
          rootRules.push({ selectors, properties: block.properties, nested: block.nested });
        }
      } else {
        pos++;
      }
    }
    
    return rootRules;
  }

  async function readCssContent(uri: vscode.Uri): Promise<string> {
    // Check if the document is currently open in VS Code (which gives us unsaved buffer content!)
    const openDoc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
    if (openDoc) {
      return openDoc.getText();
    }
    // Otherwise read from disk
    const data = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(data).toString('utf8');
  }

  async function loadStylesheets() {
    const rules: Rule[] = [];
    let loadedProjectCss = false;

    // 1. Buscar en la carpeta del proyecto ".config/hightlight" o ".config/highlight"
    const projectFiles = await vscode.workspace.findFiles('{**/.config/hightlight/**/*.css,**/.config/highlight/**/*.css}');
    for (const file of projectFiles) {
      try {
        const cssText = await readCssContent(file);
        const parsed = parseCSS(cssText);
        rules.push(...parsed);
        loadedProjectCss = true;
        console.log('Cargado CSS del proyecto:', file.toString());
      } catch (e) {
        console.error('Error al cargar CSS del proyecto:', file.toString(), e);
      }
    }

    // 2. Si no se cargó ningún CSS de proyecto, cargar el base.css de la extensión por defecto
    if (!loadedProjectCss) {
      const defaultBaseUri = vscode.Uri.joinPath(context.extensionUri, '..', '..', 'highlight', 'base.css');
      try {
        const data = await vscode.workspace.fs.readFile(defaultBaseUri);
        const cssText = Buffer.from(data).toString('utf8');
        const parsed = parseCSS(cssText);
        rules.push(...parsed);
        console.log('Cargado base.css de la extensión por defecto.');
      } catch (e) {
        console.log('No se pudo cargar base.css desde la extensión.');
      }
    }

    processRules(rules);
    currentRules = rules;
  }

  const SYMBOL_MAP: Record<string, string> = {
    '!': 'excl',
    '"': 'quot',
    '#': 'num',
    '$': 'dollar',
    '%': 'percnt',
    '&': 'amp',
    "'": 'apos',
    '(': 'lparen',
    ')': 'rparen',
    '*': 'ast',
    '+': 'plus',
    ',': 'comma',
    '-': 'minus',
    '.': 'period',
    '/': 'sol',
    ':': 'colon',
    ';': 'semi',
    '<': 'lt',
    '=': 'equals',
    '>': 'gt',
    '?': 'quest',
    '@': 'commat',
    '[': 'lsqb',
    '\\': 'bsol',
    ']': 'rsqb',
    '^': 'Hat',
    '_': 'lowbar',
    '`': 'grave',
    '{': 'lcub',
    '|': 'verbar',
    '}': 'rcub',
    '~': 'tilde'
  };

  function getMarkerAliases(symbol: string): string[] {
    const char = symbol[0];
    const name = SYMBOL_MAP[char];
    const aliases: string[] = [];
    if (name) {
      aliases.push(`&${name}`, name);
    }
    return aliases;
  }

  function getStyleForBase(markerSymbol: string, type: string, resolvedType?: string): Record<string, string> {
    const aliases = getMarkerAliases(markerSymbol);
    const resolved: Record<string, string> = {};
    const typesToMatch = [type.toLowerCase()];
    if (resolvedType) {
      typesToMatch.push(resolvedType.toLowerCase());
    }
    
    // 1. Reglas de símbolo independientes (menor prioridad)
    for (const alias of aliases) {
      for (const rule of currentRules) {
        if (rule.selectors.includes(alias)) {
          Object.assign(resolved, rule.properties);
        }
      }
    }
    
    if (type && type !== 'generic') {
      // 2. Reglas de tipo específicas (ej. page o idevice-*)
      for (const t of typesToMatch) {
        for (const rule of currentRules) {
          for (const selector of rule.selectors) {
            if (selector === t) {
              Object.assign(resolved, rule.properties);
            } else if (selector.includes('*')) {
              const regexStr = '^' + selector.replace(/\*/g, '.*') + '$';
              if (new RegExp(regexStr).test(t)) {
                Object.assign(resolved, rule.properties);
              }
            }
          }
        }
      }

      // 3. Regla comodín (alias *)
      for (const alias of aliases) {
        const wildcard = `${alias} *`;
        for (const rule of currentRules) {
          if (rule.selectors.includes(wildcard)) {
            Object.assign(resolved, rule.properties);
          }
        }
      }
      
      // 4. Reglas combinadas símbolo + tipo (ej. num page) (mayor prioridad)
      for (const t of typesToMatch) {
        for (const alias of aliases) {
          for (const rule of currentRules) {
            for (const selector of rule.selectors) {
              if (selector === `${alias} ${t}`) {
                Object.assign(resolved, rule.properties);
              } else if (selector.includes('*')) {
                const parts = selector.split(/\s+/);
                if (parts[0] === alias) {
                  const pattern = parts[1];
                  const regexStr = '^' + pattern.replace(/\*/g, '.*') + '$';
                  if (new RegExp(regexStr).test(t)) {
                    Object.assign(resolved, rule.properties);
                  }
                }
              }
            }
          }
        }
      }

      // 5. Fallback para tipos personalizados no estándar -> regla 'generic' (si no se ha establecido un color específico)
      const standardKeys = [
        'pagina', 'seccion', 'item', 'ataula',
        'didyouknow', 'warning', 'hint', 'solution', 'reflection', 'activity', 'note', 'question', 'rubric', 'ask_yourself', 'generic',
        'preguntate', 'atencion', 'sabiasque', 'sugerencia', 'solucion', 'reflexion', 'actividad', 'nota', 'pregunta', 'rubrica', 'informacion'
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
            if (rule.selectors.includes('generic')) {
              Object.assign(resolved, rule.properties);
            }
          }
        }
      }
    } else if (type === 'generic' || !type) {
      if (!resolved.color && !resolved.backgroundColor) {
        for (const rule of currentRules) {
          if (rule.selectors.includes('generic')) {
            Object.assign(resolved, rule.properties);
          }
        }
      }
    }
    
    return resolved;
  }

  function getStyleForSymbol(markerSymbol: string, type?: string, resolvedType?: string): Record<string, string> {
    const aliases = getMarkerAliases(markerSymbol);
    const resolved: Record<string, string> = {};
    const typesToMatch: string[] = [];
    if (type) typesToMatch.push(type.toLowerCase());
    if (resolvedType) typesToMatch.push(resolvedType.toLowerCase());
    
    // 1. Reglas de símbolo independientes (menor prioridad)
    for (const alias of aliases) {
      for (const rule of currentRules) {
        if (rule.selectors.includes(alias)) {
          Object.assign(resolved, rule.properties);
        }
      }
    }

    if (type && type !== 'generic') {
      // 2. Reglas de tipo específicas (ej. page)
      for (const t of typesToMatch) {
        for (const rule of currentRules) {
          for (const selector of rule.selectors) {
            if (selector === t) {
              Object.assign(resolved, rule.properties);
            } else if (selector.includes('*')) {
              const regexStr = '^' + selector.replace(/\*/g, '.*') + '$';
              if (new RegExp(regexStr).test(t)) {
                Object.assign(resolved, rule.properties);
              }
            }
          }
        }
      }

      // 3. Regla comodín (alias *)
      for (const alias of aliases) {
        const wildcard = `${alias} *`;
        for (const rule of currentRules) {
          if (rule.selectors.includes(wildcard)) {
            Object.assign(resolved, rule.properties);
          }
        }
      }

      // 4. Reglas combinadas símbolo + tipo (ej. num page) (mayor prioridad)
      for (const t of typesToMatch) {
        for (const alias of aliases) {
          for (const rule of currentRules) {
            for (const selector of rule.selectors) {
              if (selector === `${alias} ${t}`) {
                Object.assign(resolved, rule.properties);
              } else if (selector.includes('*')) {
                const parts = selector.split(/\s+/);
                if (parts[0] === alias) {
                  const pattern = parts[1];
                  const regexStr = '^' + pattern.replace(/\*/g, '.*') + '$';
                  if (new RegExp(regexStr).test(t)) {
                    Object.assign(resolved, rule.properties);
                  }
                }
              }
            }
          }
        }
      }

      // 5. Fallback para tipos personalizados no estándar -> regla 'generic' (si no se ha establecido un color específico)
      const standardKeys = [
        'pagina', 'seccion', 'item', 'ataula',
        'didyouknow', 'warning', 'hint', 'solution', 'reflection', 'activity', 'note', 'question', 'rubric', 'ask_yourself', 'generic',
        'preguntate', 'atencion', 'sabiasque', 'sugerencia', 'solucion', 'reflexion', 'actividad', 'nota', 'pregunta', 'rubrica', 'informacion'
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
            if (rule.selectors.includes('generic')) {
              Object.assign(resolved, rule.properties);
            }
          }
        }
      }
    } else if (type === 'generic' || !type) {
      if (!resolved.color && !resolved.backgroundColor) {
        for (const rule of currentRules) {
          if (rule.selectors.includes('generic')) {
            Object.assign(resolved, rule.properties);
          }
        }
      }
    }
    return resolved;
  }

  function attenuateColor(colorStr: string): string {
    if (!colorStr) return 'rgba(128, 128, 128, 0.5)';
    const trimmed = colorStr.trim().toLowerCase();

    // 1. Hex color
    if (trimmed.startsWith('#')) {
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

    // 2. rgb / rgba
    if (trimmed.startsWith('rgb')) {
      const match = trimmed.match(/rgba?\s*\(\s*(\d+(?:\.\d+)?%?)\s*,\s*(\d+(?:\.\d+)?%?)\s*,\s*(\d+(?:\.\d+)?%?)(?:\s*,\s*(\d+(?:\.\d+)?%?))?\s*\)/);
      if (match) {
        const r = match[1];
        const g = match[2];
        const b = match[3];
        const a = match[4] !== undefined ? parseFloat(match[4]) : 1.0;
        return `rgba(${r}, ${g}, ${b}, ${a * 0.5})`;
      }
    }

    // 3. hsl / hsla
    if (trimmed.startsWith('hsl')) {
      const match = trimmed.match(/hsla?\s*\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?%)\s*,\s*(\d+(?:\.\d+)?%)(?:\s*,\s*(\d+(?:\.\d+)?%?))?\s*\)/);
      if (match) {
        const h = match[1];
        const s = match[2];
        const l = match[3];
        const a = match[4] !== undefined ? parseFloat(match[4]) : 1.0;
        return `hsla(${h}, ${s}, ${l}, ${a * 0.5})`;
      }
    }

    const colorMap: Record<string, string> = {
      'red': 'rgba(255, 0, 0, 0.5)',
      'blue': 'rgba(0, 0, 255, 0.5)',
      'green': 'rgba(0, 128, 0, 0.5)',
      'white': 'rgba(255, 255, 255, 0.5)',
      'black': 'rgba(0, 0, 0, 0.5)',
      'yellow': 'rgba(255, 255, 0, 0.5)',
      'magenta': 'rgba(255, 0, 255, 0.5)',
      'cyan': 'rgba(0, 255, 255, 0.5)',
      'gray': 'rgba(128, 128, 128, 0.5)',
      'orange': 'rgba(255, 165, 0, 0.5)'
    };

    return colorMap[trimmed] || trimmed;
  }

  function getFinalSymbolStyle(markerSymbol: string, type: string, defaultColor: string, resolvedType?: string): vscode.DecorationRenderOptions {
    const cssStyle = getStyleForSymbol(markerSymbol, type, resolvedType);
    const options: vscode.DecorationRenderOptions = {};
    for (const [key, val] of Object.entries(cssStyle)) {
      (options as any)[key] = val;
    }
    if (!options.color) {
      options.color = defaultColor;
    }
    if (!options.fontWeight) {
      options.fontWeight = 'normal';
    }
    return options;
  }

  function getStyleForTitle(markerSymbol: string, type: string, baseStyle: Record<string, string>, resolvedType?: string): Record<string, string> {
    const aliases = getMarkerAliases(markerSymbol);
    const resolved = { ...baseStyle };
    const typesToMatch = [type.toLowerCase()];
    if (resolvedType) {
      typesToMatch.push(resolvedType.toLowerCase());
    }
    
    for (const rule of currentRules) {
      if (rule.selectors.includes('title')) {
        Object.assign(resolved, rule.properties);
      }
    }
    
    for (const alias of aliases) {
      for (const rule of currentRules) {
        if (rule.selectors.includes(alias)) {
          for (const nest of rule.nested) {
            if (nest.selectors.includes('title')) {
              Object.assign(resolved, nest.properties);
            }
          }
        }
      }
    }
    
    for (const t of typesToMatch) {
      for (const rule of currentRules) {
        for (const selector of rule.selectors) {
          let matched = selector === t;
          if (!matched && selector.includes('*')) {
            const regexStr = '^' + selector.replace(/\*/g, '.*') + '$';
            matched = new RegExp(regexStr).test(t);
          }
          if (matched) {
            for (const nest of rule.nested) {
              if (nest.selectors.includes('title')) {
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
          for (const selector of rule.selectors) {
            let matched = selector === combined;
            if (!matched && selector.includes('*')) {
              const parts = selector.split(/\s+/);
              if (parts[0] === alias) {
                const pattern = parts[1];
                const regexStr = '^' + pattern.replace(/\*/g, '.*') + '$';
                matched = new RegExp(regexStr).test(t);
              }
            }
            if (matched) {
              for (const nest of rule.nested) {
                if (nest.selectors.includes('title')) {
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

  function getFinalBaseStyle(markerSymbol: string, type: string, resolvedType?: string): vscode.DecorationRenderOptions {
    const cssStyle = getStyleForBase(markerSymbol, type, resolvedType);
    
    const config = vscode.workspace.getConfiguration('edumark.colors');
    const standardKeys = [
      'pagina', 'seccion', 'item', 'ataula',
      'didyouknow', 'warning', 'hint', 'solution', 'reflection', 'activity', 'note', 'question', 'rubric', 'ask_yourself', 'generic',
      'preguntate', 'atencion', 'sabiasque', 'sugerencia', 'solucion', 'reflexion', 'actividad', 'nota', 'pregunta', 'rubrica', 'informacion'
    ];
    let defaultColor = config.get<string>(type);
    if (!defaultColor) {
      let matchedKey = '';
      for (const t of [type, resolvedType || '']) {
        if (standardKeys.includes(t.toLowerCase())) {
          matchedKey = t.toLowerCase();
          break;
        }
      }
      if (matchedKey) {
        defaultColor = config.get<string>(matchedKey) || '#3b82f6';
      } else {
        defaultColor = config.get<string>('generic') || '#8e8e8e';
      }
    }
    
    const options: vscode.DecorationRenderOptions = {};
    for (const [key, val] of Object.entries(cssStyle)) {
      (options as any)[key] = val;
    }
    
    if (!options.color) {
      options.color = defaultColor;
    }
    if (!options.fontWeight) {
      options.fontWeight = 'normal';
    }
    
    return options;
  }

  function getFinalTitleStyle(markerSymbol: string, type: string, finalBaseStyle: vscode.DecorationRenderOptions, resolvedType?: string): vscode.DecorationRenderOptions {
    const baseCssStyle = getStyleForBase(markerSymbol, type, resolvedType);
    const cssStyle = getStyleForTitle(markerSymbol, type, baseCssStyle, resolvedType);
    
    const options: vscode.DecorationRenderOptions = {};
    for (const [key, val] of Object.entries(cssStyle)) {
      (options as any)[key] = val;
    }
    
    if (!options.color) {
      options.color = finalBaseStyle.color;
    }
    if (!options.fontWeight) {
      options.fontWeight = 'bold';
    }
    
    return options;
  }

  function getStyleForNested(markerSymbol: string, type: string, subSelector: string, baseStyle: Record<string, string>, resolvedType?: string): Record<string, string> {
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
        for (const selector of rule.selectors) {
          let matched = selector === t;
          if (!matched && selector.includes('*')) {
            const regexStr = '^' + selector.replace(/\*/g, '.*') + '$';
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
          for (const selector of rule.selectors) {
            let matched = selector === combined;
            if (!matched && selector.includes('*')) {
              const parts = selector.split(/\s+/);
              if (parts[0] === alias) {
                const pattern = parts[1];
                const regexStr = '^' + pattern.replace(/\*/g, '.*') + '$';
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

  function getFinalNestedStyle(markerSymbol: string, type: string, subSelector: string, finalBaseStyle: vscode.DecorationRenderOptions, resolvedType?: string): vscode.DecorationRenderOptions {
    const baseCssStyle = getStyleForBase(markerSymbol, type, resolvedType);
    const cssStyle = getStyleForNested(markerSymbol, type, subSelector, baseCssStyle, resolvedType);
    
    const options: vscode.DecorationRenderOptions = {};
    for (const [key, val] of Object.entries(cssStyle)) {
      (options as any)[key] = val;
    }
    
    if (!options.color) {
      if (type.toLowerCase() === 'imagen' && subSelector === 'title') {
        options.color = '#ef4444'; // Red default for imagen title
      } else if (subSelector === 'params') {
        options.color = '#a3a3a3'; // Gray default for params
      } else {
        options.color = finalBaseStyle.color;
      }
    }
    if (!options.fontWeight && subSelector === 'title') {
      options.fontWeight = 'bold';
    }
    
    return options;
  }

  function getDecorationType(options: vscode.DecorationRenderOptions): vscode.TextEditorDecorationType {
    const sortedOptions: any = {};
    Object.keys(options).sort().forEach(key => {
      sortedOptions[key] = (options as any)[key];
    });
    
    const cacheKey = JSON.stringify(sortedOptions);
    if (!activeDecorations[cacheKey]) {
      activeDecorations[cacheKey] = vscode.window.createTextEditorDecorationType(options);
      context.subscriptions.push(activeDecorations[cacheKey]);
    }
    return activeDecorations[cacheKey];
  }

  // Trigger decorations update
  function triggerUpdateDecorations(editor: vscode.TextEditor | undefined) {
    if (editor && (editor.document.languageId === 'edumark' || editor.document.fileName.endsWith('.edu'))) {
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

  // Initial stylesheet load and update
  reloadStylesheetsAndForceUpdate();

  // Watcher for any CSS in project highlight folders (filesystem events)
  const watcher = vscode.workspace.createFileSystemWatcher('{**/.config/hightlight/**/*.css,**/.config/highlight/**/*.css}');

  watcher.onDidChange(() => reloadStylesheetsAndForceUpdate());
  watcher.onDidCreate(() => reloadStylesheetsAndForceUpdate());
  watcher.onDidDelete(() => reloadStylesheetsAndForceUpdate());

  context.subscriptions.push(watcher);

  // Update when any document changes (real-time keystroke rendering!)
  vscode.workspace.onDidChangeTextDocument(event => {
    const isCss = event.document.uri.path.endsWith('.css');
    const inHighlightFolder = event.document.uri.path.includes('/.config/highlight/') || event.document.uri.path.includes('/.config/hightlight/');

    if (isCss && inHighlightFolder) {
      // Keystroke-level updates for custom highlights! Reloads stylesheets from memory and refreshes visible editors.
      reloadStylesheetsAndForceUpdate();
    } else {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        triggerUpdateDecorations(editor);
      }
    }
  });

  // Update when active editor changes
  vscode.window.onDidChangeActiveTextEditor(editor => {
    triggerUpdateDecorations(editor);
  });

  // Update when settings change
  vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('edumark.colors')) {
      reloadStylesheetsAndForceUpdate();
    }
  });

  function getCategory(name: string): string {
    const idx = name.indexOf('-');
    if (idx !== -1) {
      return name.substring(0, idx);
    }
    return name;
  }

  function resolveName(name: string, aliases?: Record<string, string>): string {
    const defaultAliases: Record<string, string> = {
      'page': 'block-page',
      'pagina': 'block-page',
      'seccion': 'idevice-text',
      'tarea': 'idevice-activity',
      'rubrica': 'idevice-rubric',
      'imagen': 'media-image',
      'portada': 'media-cover',
      'item': 'tab-item',
      'actividad': 'idevice-activity',
      'activity': 'idevice-activity',
      'atencion': 'idevice-warning',
      'warning': 'idevice-warning',
      'sabiasque': 'idevice-didyouknow',
      'didyouknow': 'idevice-didyouknow',
      'sugerencia': 'idevice-hint',
      'hint': 'idevice-hint',
      'solucion': 'idevice-solution',
      'solution': 'idevice-solution',
      'reflexion': 'idevice-reflection',
      'reflection': 'idevice-reflection',
      'nota': 'idevice-note',
      'note': 'idevice-note',
      'pregunta': 'idevice-question',
      'question': 'idevice-question',
      'preguntate': 'idevice-ask_yourself',
      'ask_yourself': 'idevice-ask_yourself',
      'informacion': 'idevice-generic',
      'generic': 'idevice-generic'
    };
    if (aliases && name in aliases) {
      return aliases[name];
    }
    return defaultAliases[name] || name;
  }

  function shouldClose(
    openItem: { name: string; level?: number },
    newItem: { name: string; level: number },
    aliases?: Record<string, string>
  ): boolean {
    const rOpen = resolveName(openItem.name, aliases);
    const rNew = resolveName(newItem.name, aliases);
    
    const categoryOpen = getCategory(rOpen);
    const categoryNew = getCategory(rNew);
    
    if (categoryNew === 'block') {
      if (categoryOpen === 'block') {
        return openItem.level !== undefined && openItem.level >= newItem.level;
      }
      return true;
    } else {
      return categoryOpen === categoryNew;
    }
  }

  function updateEndDecorations(editor: vscode.TextEditor) {
    const document = editor.document;
    const combinedDecorations = new Map<string, vscode.DecorationOptions[]>();
    const decorationTypes = new Map<string, vscode.TextEditorDecorationType>();
    const stack: { name: string; title: string; level?: number; isBlock?: boolean }[] = [];
    const frontmatterAliases: Record<string, string> = {};
    let inAliases = false;

    let startLineIdx = 0;
    if (document.lineCount > 0 && document.lineAt(0).text.trim() === '---') {
      const sepStyle = { color: '#808080', fontWeight: 'bold' };
      const decTypeSep = getDecorationType(sepStyle);
      const cacheKeySep = JSON.stringify(sepStyle);
      decorationTypes.set(cacheKeySep, decTypeSep);
      if (!combinedDecorations.has(cacheKeySep)) {
        combinedDecorations.set(cacheKeySep, []);
      }
      combinedDecorations.get(cacheKeySep)!.push({
        range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, document.lineAt(0).text.length))
      });

      startLineIdx = 1;
      while (startLineIdx < document.lineCount) {
        const lineText = document.lineAt(startLineIdx).text;
        const trimmed = lineText.trim();
        if (trimmed === '---') {
          combinedDecorations.get(cacheKeySep)!.push({
            range: new vscode.Range(new vscode.Position(startLineIdx, 0), new vscode.Position(startLineIdx, lineText.length))
          });
          startLineIdx++;
          break;
        }
        if (trimmed === '') {
          startLineIdx++;
          continue;
        }

        const keyMatch = lineText.match(/^([a-zA-Z_][a-zA-Z0-9_]*):(.*)$/);
        if (keyMatch) {
          const key = keyMatch[1].trim();
          const rest = keyMatch[2].trim();

          if (key === 'aliases') {
            inAliases = true;
          } else {
            inAliases = false;
            if (key.startsWith('alias_') || key.startsWith('alias-')) {
              const aliasName = key.substring(6);
              frontmatterAliases[aliasName] = rest;
            }
          }

          // 1. Key range (light blue)
          const keyStyle = { color: '#4fc1ff' };
          const decTypeKey = getDecorationType(keyStyle);
          const cacheKeyKey = JSON.stringify(keyStyle);
          decorationTypes.set(cacheKeyKey, decTypeKey);
          if (!combinedDecorations.has(cacheKeyKey)) {
            combinedDecorations.set(cacheKeyKey, []);
          }
          combinedDecorations.get(cacheKeyKey)!.push({
            range: new vscode.Range(new vscode.Position(startLineIdx, 0), new vscode.Position(startLineIdx, keyMatch[1].length + 1))
          });

          // 2. Rest of line range (orange/brown string)
          if (keyMatch[2].length > 0) {
            const stringStyle = { color: '#ce9178' };
            const decTypeStr = getDecorationType(stringStyle);
            const cacheKeyStr = JSON.stringify(stringStyle);
            decorationTypes.set(cacheKeyStr, decTypeStr);
            if (!combinedDecorations.has(cacheKeyStr)) {
              combinedDecorations.set(cacheKeyStr, []);
            }
            combinedDecorations.get(cacheKeyStr)!.push({
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
          // Wildcard string line range
          const stringStyle = { color: '#ce9178' };
          const decTypeStr = getDecorationType(stringStyle);
          const cacheKeyStr = JSON.stringify(stringStyle);
          decorationTypes.set(cacheKeyStr, decTypeStr);
          if (!combinedDecorations.has(cacheKeyStr)) {
            combinedDecorations.set(cacheKeyStr, []);
          }
          combinedDecorations.get(cacheKeyStr)!.push({
            range: new vscode.Range(new vscode.Position(startLineIdx, 0), new vscode.Position(startLineIdx, lineText.length))
          });
        }
        startLineIdx++;
      }
    }

    for (let lineIdx = startLineIdx; lineIdx < document.lineCount; lineIdx++) {
      const lineText = document.lineAt(lineIdx).text;
      const trimmed = lineText.trim();

      // Check directive start
      if (trimmed.startsWith('@') && !trimmed.startsWith('@end') && /^[a-zA-Z]/.test(trimmed.substring(1))) {
        const match = trimmed.match(/^@([a-zA-Z0-9_\-]+)(.*)$/);
        if (match) {
          const name = match[1];
          const title = match[2].trim();
          stack.push({ name, title, isBlock: true });

          const cmdIdx = lineText.indexOf('@' + name);
          if (cmdIdx !== -1) {
            const resolvedName = resolveName(name, frontmatterAliases);
            const finalBaseStyle = getFinalBaseStyle('@', name, resolvedName);
            const finalSymbolStyle = getFinalSymbolStyle('@', name, finalBaseStyle.color as string, resolvedName);

            // 1a. Marker symbol range (e.g. '@')
            const symbolStart = new vscode.Position(lineIdx, cmdIdx);
            const symbolEnd = new vscode.Position(lineIdx, cmdIdx + 1);
            const symbolRange = new vscode.Range(symbolStart, symbolEnd);

            const decTypeSymbol = getDecorationType(finalSymbolStyle);
            const cacheKeySymbol = JSON.stringify(finalSymbolStyle);
            decorationTypes.set(cacheKeySymbol, decTypeSymbol);
            if (!combinedDecorations.has(cacheKeySymbol)) {
              combinedDecorations.set(cacheKeySymbol, []);
            }
            combinedDecorations.get(cacheKeySymbol)!.push({ range: symbolRange });

            // 1b. Type range (e.g. 'page')
            const typeStart = new vscode.Position(lineIdx, cmdIdx + 1);
            const typeEnd = new vscode.Position(lineIdx, cmdIdx + 1 + name.length);
            const typeRange = new vscode.Range(typeStart, typeEnd);

            const decTypeNormal = getDecorationType(finalBaseStyle);
            const cacheKeyNormal = JSON.stringify(finalBaseStyle);
            decorationTypes.set(cacheKeyNormal, decTypeNormal);
            if (!combinedDecorations.has(cacheKeyNormal)) {
              combinedDecorations.set(cacheKeyNormal, []);
            }
            combinedDecorations.get(cacheKeyNormal)!.push({ range: typeRange });

            // 2. Title -> bold style
            if (title) {
              const titleIdx = lineText.indexOf(title, cmdIdx + name.length + 1);
              if (titleIdx !== -1) {
                const titleStart = new vscode.Position(lineIdx, titleIdx);
                const titleEnd = new vscode.Position(lineIdx, titleIdx + title.length);
                const titleRange = new vscode.Range(titleStart, titleEnd);
                
                const finalTitleStyle = getFinalTitleStyle('@', name, finalBaseStyle, resolvedName);
                const decTypeBold = getDecorationType(finalTitleStyle);
                const cacheKeyBold = JSON.stringify(finalTitleStyle);
                decorationTypes.set(cacheKeyBold, decTypeBold);
                
                if (!combinedDecorations.has(cacheKeyBold)) {
                  combinedDecorations.set(cacheKeyBold, []);
                }
                combinedDecorations.get(cacheKeyBold)!.push({ range: titleRange });
              }
            }
          }
        }
      } 
      // Check hierarchical directive start
      else if (/^[#>%]/.test(trimmed)) {
        const match = trimmed.match(/^([#>%]+)(?:([a-zA-Z0-9_\-]+))?(?:\s+(.*))?$/);
        if (match) {
          const hashes = match[1];
          const symbol = hashes[0];
          const name = match[2] || (symbol === '#' ? 'num' : 'generic');
          const title = (match[3] || '').trim();
          const level = hashes.length;

          // Cerrar todas las directivas jerárquicas activas usando shouldClose logic
          const newItem = { name, level };
          let closeIdx = -1;
          for (let i = 0; i < stack.length; i++) {
            const openItem = stack[i];
            if (openItem.level !== undefined) {
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
            const finalSymbolStyle = getFinalSymbolStyle(symbol, name, finalBaseStyle.color as string, resolvedName);

            // 1a. Marker symbol range (e.g. '>')
            const symbolStart = new vscode.Position(lineIdx, cmdIdx);
            const symbolEnd = new vscode.Position(lineIdx, cmdIdx + hashes.length);
            const symbolRange = new vscode.Range(symbolStart, symbolEnd);

            const decTypeSymbol = getDecorationType(finalSymbolStyle);
            const cacheKeySymbol = JSON.stringify(finalSymbolStyle);
            decorationTypes.set(cacheKeySymbol, decTypeSymbol);
            if (!combinedDecorations.has(cacheKeySymbol)) {
              combinedDecorations.set(cacheKeySymbol, []);
            }
            combinedDecorations.get(cacheKeySymbol)!.push({ range: symbolRange });

            // 1b. Type range (e.g. 'page' if present)
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
              combinedDecorations.get(cacheKeyNormal)!.push({ range: typeRange });
            }

            // 2. Title -> bold style, or split title & parameters if parameters exist
            if (title) {
              const titleIdx = lineText.indexOf(title, cmdIdx + cmdText.length);
              if (titleIdx !== -1) {
                const titleMatch = title.match(/^(.*?)(?:\s*(\{.*))?$/);
                const mainTitleText = titleMatch ? titleMatch[1].trim() : title;
                const paramsText = (titleMatch && titleMatch[2]) ? titleMatch[2].trim() : '';

                if (paramsText) {
                  // Style main title text (using 'title' selector)
                  if (mainTitleText) {
                    const mainTitleIdx = titleIdx + title.indexOf(mainTitleText);
                    const range = new vscode.Range(
                      new vscode.Position(lineIdx, mainTitleIdx),
                      new vscode.Position(lineIdx, mainTitleIdx + mainTitleText.length)
                    );
                    const finalTitleStyle = getFinalNestedStyle(symbol, name, 'title', finalBaseStyle, resolvedName);
                    const decType = getDecorationType(finalTitleStyle);
                    const cacheKey = JSON.stringify(finalTitleStyle);
                    decorationTypes.set(cacheKey, decType);
                    if (!combinedDecorations.has(cacheKey)) {
                      combinedDecorations.set(cacheKey, []);
                    }
                    combinedDecorations.get(cacheKey)!.push({ range });
                  }

                  // Style params block (using 'params' selector)
                  const paramsIdx = lineText.indexOf(paramsText, titleIdx + mainTitleText.length);
                  if (paramsIdx !== -1) {
                    const range = new vscode.Range(
                      new vscode.Position(lineIdx, paramsIdx),
                      new vscode.Position(lineIdx, paramsIdx + paramsText.length)
                    );
                    const finalParamsStyle = getFinalNestedStyle(symbol, name, 'params', finalBaseStyle, resolvedName);
                    const decType = getDecorationType(finalParamsStyle);
                    const cacheKey = JSON.stringify(finalParamsStyle);
                    decorationTypes.set(cacheKey, decType);
                    if (!combinedDecorations.has(cacheKey)) {
                      combinedDecorations.set(cacheKey, []);
                    }
                    combinedDecorations.get(cacheKey)!.push({ range });
                  }
                } else {
                  // No parameters, style the entire title as 'title'
                  const titleStart = new vscode.Position(lineIdx, titleIdx);
                  const titleEnd = new vscode.Position(lineIdx, titleIdx + title.length);
                  const titleRange = new vscode.Range(titleStart, titleEnd);
                  
                  const finalTitleStyle = getFinalNestedStyle(symbol, name, 'title', finalBaseStyle, resolvedName);
                  const decTypeBold = getDecorationType(finalTitleStyle);
                  const cacheKeyBold = JSON.stringify(finalTitleStyle);
                  decorationTypes.set(cacheKeyBold, decTypeBold);
                  
                  if (!combinedDecorations.has(cacheKeyBold)) {
                    combinedDecorations.set(cacheKeyBold, []);
                  }
                  combinedDecorations.get(cacheKeyBold)!.push({ range: titleRange });
                }
              }
            }
          }
        }
      }
      // Check directive end
      else if (trimmed.startsWith('@end')) {
        let closingName: string | undefined = undefined;
        if (trimmed.startsWith('@end-')) {
          closingName = trimmed.substring(5).trim();
        }

        if (stack.length > 0) {
          let openDir: { name: string; title: string; level?: number; isBlock?: boolean } | undefined = undefined;
          
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
              const finalBaseStyle = getFinalBaseStyle('@', openDir.name, resolvedName);
              const decTypeNormal = getDecorationType(finalBaseStyle);
              const cacheKeyNormal = JSON.stringify(finalBaseStyle);
              decorationTypes.set(cacheKeyNormal, decTypeNormal);
              
              if (!combinedDecorations.has(cacheKeyNormal)) {
                combinedDecorations.set(cacheKeyNormal, []);
              }

              const label = `[-${openDir.name}${openDir.title ? ' ' + openDir.title : ''}]`;
              
              combinedDecorations.get(cacheKeyNormal)!.push({
                range: range,
                renderOptions: {
                  after: {
                    contentText: ` ${label}`,
                    color: attenuateColor(finalBaseStyle.color as string),
                    fontStyle: 'italic',
                    margin: '0 0 0 10px'
                  }
                }
              });
            }
          }
        }
      }
    }

    // Clear previous runs of all known decorations
    for (const decType of Object.values(activeDecorations)) {
      editor.setDecorations(decType, []);
    }

    // Apply new ranges grouped by decoration type key
    for (const [cacheKey, options] of combinedDecorations.entries()) {
      const decType = decorationTypes.get(cacheKey)!;
      editor.setDecorations(decType, options);
    }
  }

  // Completion provider for standard Edumark directives
  const edumarkCompletionProvider = vscode.languages.registerCompletionItemProvider(
    'edumark',
    {
      provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
      ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const lineText = document.lineAt(position.line).text;
        const textBeforeCursor = lineText.substring(0, position.character);

        const hashIndex = textBeforeCursor.lastIndexOf('#');
        const atIndex = textBeforeCursor.lastIndexOf('@');

        let triggerChar = '';
        let triggerIndex = -1;

        if (hashIndex !== -1 && (atIndex === -1 || hashIndex > atIndex)) {
          triggerChar = '#';
          triggerIndex = hashIndex;
        } else if (atIndex !== -1 && (hashIndex === -1 || atIndex > hashIndex)) {
          triggerChar = '@';
          triggerIndex = atIndex;
        }

        if (triggerIndex === -1) {
          return [];
        }

        const prefixBeforeTrigger = textBeforeCursor.substring(0, triggerIndex);
        if (prefixBeforeTrigger.trim() !== '') {
          return [];
        }

        const items: vscode.CompletionItem[] = [];

        if (triggerChar === '#') {
          // #pagina
          const itemPagina = new vscode.CompletionItem('pagina', vscode.CompletionItemKind.Snippet);
          itemPagina.insertText = new vscode.SnippetString('pagina ${1:Título de la página}');
          itemPagina.filterText = 'pagina';
          itemPagina.documentation = new vscode.MarkdownString('Define una nueva página.');
          items.push(itemPagina);

          // #seccion
          const itemSeccion = new vscode.CompletionItem('seccion', vscode.CompletionItemKind.Snippet);
          itemSeccion.insertText = new vscode.SnippetString('seccion ${1:Título de la sección}');
          itemSeccion.filterText = 'seccion';
          itemSeccion.documentation = new vscode.MarkdownString('Define una sección dentro de la página.');
          items.push(itemSeccion);
        } else if (triggerChar === '@') {
          const standardDirectives = [
            { name: 'pestanas', desc: 'Bloque de pestañas FX.', body: 'pestanas\n\n#item ${1:Título}\n${2:Contenido...}\n\n#item ${3:Título}\n${4:Contenido...}\n\n@end' },
            { name: 'acordeon', desc: 'Bloque de acordeón FX.', body: 'acordeon\n\n#item ${1:Título}\n${2:Contenido...}\n\n#item ${3:Título}\n${4:Contenido...}\n\n@end' },
            { name: 'carrusel', desc: 'Bloque de carrusel FX.', body: 'carrusel\n\n#item ${1:Título}\n${2:Contenido...}\n\n#item ${3:Título}\n${4:Contenido...}\n\n@end' },
            { name: 'paginacion', desc: 'Bloque de paginación FX.', body: 'paginacion\n\n#item ${1:Título}\n${2:Contenido...}\n\n#item ${3:Título}\n${4:Contenido...}\n\n@end' },
            { name: 'didyouknow', desc: 'Tarjeta didáctica "Did you know?".', body: 'didyouknow ${1:Título opcional}\n${2:Contenido...}\n@end' },
            { name: 'warning', desc: 'Tarjeta didáctica de advertencia.', body: 'warning ${1:Título opcional}\n${2:Contenido...}\n@end' },
            { name: 'hint', desc: 'Tarjeta didáctica de sugerencia.', body: 'hint ${1:Título opcional}\n${2:Contenido...}\n@end' },
            { name: 'solution', desc: 'Tarjeta didáctica de solución.', body: 'solution ${1:Título opcional}\n${2:Contenido...}\n@end' },
            { name: 'reflection', desc: 'Tarjeta didáctica de reflexión.', body: 'reflection ${1:Título opcional}\n${2:Contenido...}\n@end' },
            { name: 'activity', desc: 'Tarjeta didáctica de actividad.', body: 'activity ${1:Título opcional}\n${2:Contenido...}\n@end' },
            { name: 'note', desc: 'Tarjeta didáctica de nota.', body: 'note ${1:Título opcional}\n${2:Contenido...}\n@end' },
            { name: 'question', desc: 'Bloque de pregunta interactiva.', body: 'question type=${1|multiple-choice,true-false|}\n${2:Pregunta...}\n@end' },
            { name: 'rubric', desc: 'Inserta un bloque de rúbrica.', body: 'rubric ${1:Título de la rúbrica}\n\n| Criterio | Excelente | A mejorar |\n| :--- | :--- | :--- |\n| ${2:Criterio 1} | ${3:Excelente...} | ${4:A mejorar...} |\n\n@end' },
            { name: 'ataula', desc: 'Envoltorio para añadir pie/título a tablas.', body: 'ataula ${1:Título de la tabla}\n${2:Contenido...}\n@end' },
            { name: 'end', desc: 'Cierra el bloque directivo actual.', body: 'end' }
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
    '#', '@'
  );

  context.subscriptions.push(edumarkCompletionProvider);

  // Register image drop and paste providers for .edu files (language: 'edumark')
  const selector: vscode.DocumentSelector = 'edumark';

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
        pasteMimeTypes: ['image/*', 'text/uri-list', 'files'],
        providedPasteEditKinds: [vscode.DocumentDropOrPasteEditKind.Text]
      }
    )
  );
}

function getProjectRoot(document: vscode.TextDocument): vscode.Uri {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (workspaceFolder) {
    return workspaceFolder.uri;
  }
  return vscode.Uri.joinPath(document.uri, '..');
}

async function getUniqueFilePath(rootUri: vscode.Uri, baseName: string, ext: string): Promise<vscode.Uri> {
  let name = baseName || 'imagen';
  if (name.toLowerCase().endsWith(ext.toLowerCase())) {
    name = name.slice(0, -ext.length);
  }
  name = name.replace(/[^a-zA-Z0-9_\-]/g, '_');
  
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
async function saveAndInsertImage(
  document: vscode.TextDocument,
  position: vscode.Position,
  dataOrUri: Uint8Array | vscode.Uri,
  originalName: string,
  ext: string
): Promise<boolean> {
  try {
    const rootUri = getProjectRoot(document);
    let baseName = originalName || 'imagen';
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
    const relPath = path.relative(documentDir, targetUri.fsPath).replace(/\\/g, '/');
    
    const insertText = `#imagen ${relPath} {ancho: 600, pie: , sombra: no, borde: no}\n`;
    
    const workspaceEdit = new vscode.WorkspaceEdit();
    workspaceEdit.insert(document.uri, position, insertText);
    return await vscode.workspace.applyEdit(workspaceEdit);
  } catch (err) {
    console.error('Error saving image and applying edit:', err);
    return false;
  }
}

class EdumarkDropEditProvider implements vscode.DocumentDropEditProvider {
  async provideDocumentDropEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentDropEdit | undefined> {
    const uriListItem = dataTransfer.get('text/uri-list');
    if (uriListItem) {
      const uriList = await uriListItem.asString();
      const uris = uriList.split('\n').map(u => u.trim()).filter(Boolean);
      for (const uriStr of uris) {
        try {
          const sourceUri = vscode.Uri.parse(uriStr);
          const ext = path.extname(sourceUri.path).toLowerCase();
          if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
            const baseName = path.basename(sourceUri.fsPath, ext);
            await saveAndInsertImage(document, position, sourceUri, baseName, ext);
            return undefined;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }

    for (const [mimeType, item] of dataTransfer) {
      if (mimeType.startsWith('image/')) {
        const file = item.asFile();
        if (file) {
          const ext = '.' + (mimeType.split('/')[1] || 'png');
          const binaryData = await file.data();
          await saveAndInsertImage(document, position, binaryData, file.name || `image${ext}`, ext);
          return undefined;
        }
      }
    }
    return undefined;
  }
}

class EdumarkPasteEditProvider implements vscode.DocumentPasteEditProvider {
  async provideDocumentPasteEdits(
    document: vscode.TextDocument,
    ranges: readonly vscode.Range[],
    dataTransfer: vscode.DataTransfer,
    context: vscode.DocumentPasteEditContext,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentPasteEdit[] | undefined> {
    const position = ranges[0].start;

    for (const [mimeType, item] of dataTransfer) {
      if (mimeType.startsWith('image/')) {
        const file = item.asFile();
        if (file) {
          const ext = '.' + (mimeType.split('/')[1] || 'png');
          const binaryData = await file.data();
          await saveAndInsertImage(document, position, binaryData, file.name || `image${ext}`, ext);
          return [];
        }
      }
    }

    const uriListItem = dataTransfer.get('text/uri-list');
    if (uriListItem) {
      const uriList = await uriListItem.asString();
      const uris = uriList.split('\n').map(u => u.trim()).filter(Boolean);
      for (const uriStr of uris) {
        try {
          const sourceUri = vscode.Uri.parse(uriStr);
          const ext = path.extname(sourceUri.path).toLowerCase();
          if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
            const baseName = path.basename(sourceUri.fsPath, ext);
            await saveAndInsertImage(document, position, sourceUri, baseName, ext);
            return [];
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    return undefined;
  }
}

export function deactivate() {
  for (const decType of Object.values(activeDecorations)) {
    decType.dispose();
  }
  activeDecorations = {};
}
