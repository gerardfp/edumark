import * as vscode from 'vscode';
import { parse } from '@edumark/parser';
import { renderToHTML } from '@edumark/renderer-html';

let activeDecorations: { [key: string]: vscode.TextEditorDecorationType } = {};

export function activate(context: vscode.ExtensionContext) {
  console.log('La extensión Edumark está activa.');

  let previewPanel: vscode.WebviewPanel | undefined = undefined;

  const showPreviewCommand = vscode.commands.registerCommand('edumark.showPreview', () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || activeEditor.document.languageId !== 'edumark') {
      vscode.window.showInformationMessage('Abre un archivo .edu para ver la vista previa.');
      return;
    }

    if (previewPanel) {
      previewPanel.reveal(vscode.ViewColumn.Beside);
      updateWebview(activeEditor.document);
    } else {
      previewPanel = vscode.window.createWebviewPanel(
        'edumarkPreview',
        `Vista Previa: ${vscode.workspace.asRelativePath(activeEditor.document.uri)}`,
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      previewPanel.onDidDispose(() => {
        previewPanel = undefined;
      });

      updateWebview(activeEditor.document);
    }
  });

  context.subscriptions.push(showPreviewCommand);

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
    const files = await vscode.workspace.findFiles('{**/tal.css,**/edumark.css}');
    for (const file of files) {
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

  function getMarkerAliases(symbol: string): string[] {
    if (symbol.startsWith('@')) return ['arroba', 'a'];
    if (symbol.startsWith('#')) return ['almohadilla', 'h'];
    if (symbol.startsWith('>')) return ['mayor', 'm'];
    if (symbol.startsWith('%')) return ['porcentaje', 'p'];
    return [];
  }

  function getStyleForBase(markerSymbol: string, type: string): Record<string, string> {
    const aliases = getMarkerAliases(markerSymbol);
    const resolved: Record<string, string> = {};
    
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

  // Watchers for tal.css and edumark.css
  const watcher1 = vscode.workspace.createFileSystemWatcher('**/tal.css');
  const watcher2 = vscode.workspace.createFileSystemWatcher('**/edumark.css');

  watcher1.onDidChange(() => reloadStylesheetsAndForceUpdate());
  watcher1.onDidCreate(() => reloadStylesheetsAndForceUpdate());
  watcher1.onDidDelete(() => reloadStylesheetsAndForceUpdate());

  watcher2.onDidChange(() => reloadStylesheetsAndForceUpdate());
  watcher2.onDidCreate(() => reloadStylesheetsAndForceUpdate());
  watcher2.onDidDelete(() => reloadStylesheetsAndForceUpdate());

  context.subscriptions.push(watcher1, watcher2);

  // Update when active document changes
  vscode.workspace.onDidChangeTextDocument(event => {
    const editor = vscode.window.activeTextEditor;
    if (editor && event.document === editor.document) {
      triggerUpdateDecorations(editor);
    }
    if (previewPanel && event.document === vscode.window.activeTextEditor?.document) {
      updateWebview(event.document);
    }
  });

  // Update when active editor changes
  vscode.window.onDidChangeActiveTextEditor(editor => {
    triggerUpdateDecorations(editor);
    if (previewPanel && editor && (editor.document.languageId === 'edumark' || editor.document.fileName.endsWith('.edu'))) {
      previewPanel.title = `Vista Previa: ${vscode.workspace.asRelativePath(editor.document.uri)}`;
      updateWebview(editor.document);
    }
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
    const stack: { name: string; title: string; level?: number }[] = [];

    for (let lineIdx = 0; lineIdx < document.lineCount; lineIdx++) {
      const lineText = document.lineAt(lineIdx).text;
      const trimmed = lineText.trim();

      // Check directive start
      if (trimmed.startsWith('@') && !trimmed.startsWith('@end') && /^[a-zA-Z]/.test(trimmed.substring(1))) {
        const match = trimmed.match(/^@([a-zA-Z0-9_\-]+)(.*)$/);
        if (match) {
          const name = match[1];
          const title = match[2].trim();
          stack.push({ name, title });

          const cmdIdx = lineText.indexOf('@' + name);
          if (cmdIdx !== -1) {
            // 1. Marker and type -> normal style
            const startPos = new vscode.Position(lineIdx, cmdIdx);
            const endPos = new vscode.Position(lineIdx, cmdIdx + name.length + 1);
            const range = new vscode.Range(startPos, endPos);
            
            const finalBaseStyle = getFinalBaseStyle('@', name);
            const decTypeNormal = getDecorationType(finalBaseStyle);
            const cacheKeyNormal = JSON.stringify(finalBaseStyle);
            decorationTypes.set(cacheKeyNormal, decTypeNormal);
            
            if (!combinedDecorations.has(cacheKeyNormal)) {
              combinedDecorations.set(cacheKeyNormal, []);
            }
            combinedDecorations.get(cacheKeyNormal)!.push({ range });

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

          // Find the last hierarchical directive on the stack with level >= new level
          let popIdx = -1;
          for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i].level !== undefined && stack[i].level! >= level) {
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
            // 1. Marker and type -> normal style
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
            combinedDecorations.get(cacheKeyNormal)!.push({ range });

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
          let openDir: { name: string; title: string; level?: number } | undefined = undefined;
          if (closingName) {
            const idx = stack.map(d => d.name).lastIndexOf(closingName);
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
                    color: (finalBaseStyle.color as string) + 'b0', // opacity
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

  function updateWebview(document: vscode.TextDocument) {
    if (!previewPanel) return;

    try {
      const source = document.getText();
      const { ast, errors } = parse(source);

      let html = '';
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
  <h2>❌ Errores de sintaxis detectados</h2>
  <ul>
    ${errors.map(err => `<li><strong>Línea ${err.lineNum}:</strong> ${err.message}</li>`).join('')}
  </ul>
</body>
</html>`;
      } else {
        html = renderToHTML(ast);
      }

      previewPanel.webview.html = html;
    } catch (err: any) {
      previewPanel.webview.html = `<h3>Error de renderizado:</h3><pre>${err.message}</pre>`;
    }
  }
}

export function deactivate() {
  for (const decType of Object.values(activeDecorations)) {
    decType.dispose();
  }
  activeDecorations = {};
}
