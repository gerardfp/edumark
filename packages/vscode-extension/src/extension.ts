import * as vscode from 'vscode';

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

  async function loadStylesheets() {
    const rules: Rule[] = [];
    
    // Cargar base.css por defecto desde la carpeta highlight de la extensión
    const defaultBaseUri = vscode.Uri.joinPath(context.extensionUri, '..', '..', 'highlight', 'base.css');
    try {
      const data = await vscode.workspace.fs.readFile(defaultBaseUri);
      const cssText = Buffer.from(data).toString('utf8');
      const parsed = parseCSS(cssText);
      rules.push(...parsed);
    } catch (e) {
      console.log('No se pudo cargar base.css desde la extensión, se buscará solo en el espacio de trabajo.');
    }

    // Cargar cualquier otra hoja de estilo en el espacio de trabajo
    const files = await vscode.workspace.findFiles('**/highlight/**/*.css');
    for (const file of files) {
      // Evitar cargar base.css dos veces si es el mismo archivo
      if (file.toString() === defaultBaseUri.toString()) {
        continue;
      }
      try {
        const data = await vscode.workspace.fs.readFile(file);
        const cssText = Buffer.from(data).toString('utf8');
        const parsed = parseCSS(cssText);
        rules.push(...parsed);
      } catch (e) {
        console.error('Error loading CSS file:', file.toString(), e);
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

  function getStyleForBase(markerSymbol: string, type: string): Record<string, string> {
    const aliases = getMarkerAliases(markerSymbol);
    const resolved: Record<string, string> = {};
    
    // 1. Reglas de símbolo independientes (menor prioridad)
    for (const alias of aliases) {
      for (const rule of currentRules) {
        if (rule.selectors.includes(alias)) {
          Object.assign(resolved, rule.properties);
        }
      }
    }
    
    if (type && type !== 'generic') {
      const typeLower = type.toLowerCase();

      // 2. Regla comodín (alias *)
      for (const alias of aliases) {
        const wildcard = `${alias} *`;
        for (const rule of currentRules) {
          if (rule.selectors.includes(wildcard)) {
            Object.assign(resolved, rule.properties);
          }
        }
      }

      // 3. Reglas de tipo específicas (ej. page)
      for (const rule of currentRules) {
        if (rule.selectors.includes(typeLower)) {
          Object.assign(resolved, rule.properties);
        }
      }
      
      // 4. Reglas combinadas símbolo + tipo (ej. num page) (mayor prioridad)
      for (const alias of aliases) {
        const combined = `${alias} ${typeLower}`;
        for (const rule of currentRules) {
          if (rule.selectors.includes(combined)) {
            Object.assign(resolved, rule.properties);
          }
        }
      }

      // 5. Fallback para tipos personalizados no estándar -> regla 'generic' (si no se ha establecido un color específico)
      const standardKeys = [
        'page', 'section', 'didyouknow', 'warning', 'hint',
        'solution', 'reflection', 'activity', 'note', 'question', 'rubric'
      ];
      if (!standardKeys.includes(typeLower) && !resolved.color) {
        for (const rule of currentRules) {
          if (rule.selectors.includes('generic')) {
            Object.assign(resolved, rule.properties);
          }
        }
      }
    } else if (type === 'generic' || !type) {
      if (!resolved.color) {
        for (const rule of currentRules) {
          if (rule.selectors.includes('generic')) {
            Object.assign(resolved, rule.properties);
          }
        }
      }
    }
    
    return resolved;
  }

  function getStyleForSymbol(markerSymbol: string, type?: string): Record<string, string> {
    const aliases = getMarkerAliases(markerSymbol);
    const resolved: Record<string, string> = {};
    
    // 1. Reglas de símbolo independientes (menor prioridad)
    for (const alias of aliases) {
      for (const rule of currentRules) {
        if (rule.selectors.includes(alias)) {
          Object.assign(resolved, rule.properties);
        }
      }
    }

    if (type && type !== 'generic') {
      const typeLower = type.toLowerCase();

      // 2. Regla comodín (alias *)
      for (const alias of aliases) {
        const wildcard = `${alias} *`;
        for (const rule of currentRules) {
          if (rule.selectors.includes(wildcard)) {
            Object.assign(resolved, rule.properties);
          }
        }
      }

      // 3. Reglas de tipo específicas (ej. page)
      for (const rule of currentRules) {
        if (rule.selectors.includes(typeLower)) {
          Object.assign(resolved, rule.properties);
        }
      }

      // 4. Reglas combinadas símbolo + tipo (ej. num page) (mayor prioridad)
      for (const alias of aliases) {
        const combined = `${alias} ${typeLower}`;
        for (const rule of currentRules) {
          if (rule.selectors.includes(combined)) {
            Object.assign(resolved, rule.properties);
          }
        }
      }

      // 5. Fallback para tipos personalizados no estándar -> regla 'generic' (si no se ha establecido un color específico)
      const standardKeys = [
        'page', 'section', 'didyouknow', 'warning', 'hint',
        'solution', 'reflection', 'activity', 'note', 'question', 'rubric'
      ];
      if (!standardKeys.includes(typeLower) && !resolved.color) {
        for (const rule of currentRules) {
          if (rule.selectors.includes('generic')) {
            Object.assign(resolved, rule.properties);
          }
        }
      }
    } else if (type === 'generic' || !type) {
      if (!resolved.color) {
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

  function getFinalSymbolStyle(markerSymbol: string, type: string, defaultColor: string): vscode.DecorationRenderOptions {
    const cssStyle = getStyleForSymbol(markerSymbol, type);
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

  function getStyleForTitle(markerSymbol: string, type: string, baseStyle: Record<string, string>): Record<string, string> {
    const aliases = getMarkerAliases(markerSymbol);
    const resolved = { ...baseStyle };
    
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
    
    if (type) {
      const typeLower = type.toLowerCase();
      for (const rule of currentRules) {
        if (rule.selectors.includes(typeLower)) {
          for (const nest of rule.nested) {
            if (nest.selectors.includes('title')) {
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
              if (nest.selectors.includes('title')) {
                Object.assign(resolved, nest.properties);
              }
            }
          }
        }
      }
    }
    
    return resolved;
  }

  function getFinalBaseStyle(markerSymbol: string, type: string): vscode.DecorationRenderOptions {
    const cssStyle = getStyleForBase(markerSymbol, type);
    
    const config = vscode.workspace.getConfiguration('edumark.colors');
    const standardKeys = [
      'page', 'section', 'didyouknow', 'warning', 'hint',
      'solution', 'reflection', 'activity', 'note', 'question', 'rubric'
    ];
    let defaultColor = config.get<string>(type);
    if (!defaultColor) {
      if (standardKeys.includes(type)) {
        defaultColor = config.get<string>(type) || '#3b82f6';
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

  function getFinalTitleStyle(markerSymbol: string, type: string, finalBaseStyle: vscode.DecorationRenderOptions): vscode.DecorationRenderOptions {
    const baseCssStyle = getStyleForBase(markerSymbol, type);
    const cssStyle = getStyleForTitle(markerSymbol, type, baseCssStyle);
    
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
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      triggerUpdateDecorations(editor);
    }
  }

  // Initial stylesheet load and update
  reloadStylesheetsAndForceUpdate();

  // Watcher for any CSS in highlight folders
  const watcher = vscode.workspace.createFileSystemWatcher('**/highlight/**/*.css');

  watcher.onDidChange(() => reloadStylesheetsAndForceUpdate());
  watcher.onDidCreate(() => reloadStylesheetsAndForceUpdate());
  watcher.onDidDelete(() => reloadStylesheetsAndForceUpdate());

  context.subscriptions.push(watcher);

  // Update when active document changes
  vscode.workspace.onDidChangeTextDocument(event => {
    const editor = vscode.window.activeTextEditor;
    if (editor && event.document === editor.document) {
      triggerUpdateDecorations(editor);
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

  function updateEndDecorations(editor: vscode.TextEditor) {
    const document = editor.document;
    const combinedDecorations = new Map<string, vscode.DecorationOptions[]>();
    const decorationTypes = new Map<string, vscode.TextEditorDecorationType>();
    const stack: { name: string; title: string; level?: number; isBlock?: boolean }[] = [];

    for (let lineIdx = 0; lineIdx < document.lineCount; lineIdx++) {
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
            const finalBaseStyle = getFinalBaseStyle('@', name);
            const finalSymbolStyle = getFinalSymbolStyle('@', name, finalBaseStyle.color as string);

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
                
                const finalTitleStyle = getFinalTitleStyle('@', name, finalBaseStyle);
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
          const name = match[2] || 'generic';
          const title = (match[3] || '').trim();
          const level = hashes.length;

          // Cerrar todas las directivas jerárquicas activas cuyo nivel sea mayor o igual al nuevo nivel
          for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i].level !== undefined && stack[i].level! >= level) {
              stack.splice(i, 1);
            }
          }

          stack.push({ name, title, level });

          const cmdText = match[2] ? hashes + name : hashes;
          const cmdIdx = lineText.indexOf(cmdText);
          if (cmdIdx !== -1) {
            const finalBaseStyle = getFinalBaseStyle(symbol, name);
            const finalSymbolStyle = getFinalSymbolStyle(symbol, name, finalBaseStyle.color as string);

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

            // 2. Title -> bold style
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
                combinedDecorations.get(cacheKeyBold)!.push({ range: titleRange });
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
              
              const finalBaseStyle = getFinalBaseStyle('@', openDir.name);
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
}

export function deactivate() {
  for (const decType of Object.values(activeDecorations)) {
    decType.dispose();
  }
  activeDecorations = {};
}
