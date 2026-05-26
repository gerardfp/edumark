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

  // Trigger decorations update
  function triggerUpdateDecorations(editor: vscode.TextEditor | undefined) {
    if (editor && (editor.document.languageId === 'edumark' || editor.document.fileName.endsWith('.edu'))) {
      updateEndDecorations(editor);
    }
  }

  // Initial update
  triggerUpdateDecorations(vscode.window.activeTextEditor);

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
      // Clear cached decorations and dispose them
      for (const decType of Object.values(activeDecorations)) {
        decType.dispose();
      }
      activeDecorations = {};
      triggerUpdateDecorations(vscode.window.activeTextEditor);
    }
  });

  function getDecorationTypeFor(name: string, bold = false): vscode.TextEditorDecorationType {
    const config = vscode.workspace.getConfiguration('edumark.colors');
    const standardKeys = [
      'page',
      'section',
      'didyouknow',
      'warning',
      'hint',
      'solution',
      'reflection',
      'activity',
      'note',
      'question',
      'rubric'
    ];

    let color = config.get<string>(name);
    let key = name;
    if (!color) {
      if (standardKeys.includes(name)) {
        color = config.get<string>(name) || '#3b82f6';
      } else {
        color = config.get<string>('generic') || '#8e8e8e';
        key = 'generic';
      }
    }

    const cacheKey = `${key}-${color}-${bold ? 'bold' : 'normal'}`;
    if (!activeDecorations[cacheKey]) {
      activeDecorations[cacheKey] = vscode.window.createTextEditorDecorationType({
        color: color,
        fontWeight: bold ? 'bold' : 'normal'
      });
      context.subscriptions.push(activeDecorations[cacheKey]);
    }
    return activeDecorations[cacheKey];
  }

  function updateEndDecorations(editor: vscode.TextEditor) {
    const document = editor.document;
    const combinedDecorations = new Map<string, vscode.DecorationOptions[]>();
    const decorationTypes = new Map<string, vscode.TextEditorDecorationType>();
    const stack: { name: string; title: string; level?: number }[] = [];

    const config = vscode.workspace.getConfiguration('edumark.colors');
    const standardKeys = [
      'page',
      'section',
      'didyouknow',
      'warning',
      'hint',
      'solution',
      'reflection',
      'activity',
      'note',
      'question',
      'rubric'
    ];

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
            // 1. Marker and type -> normal
            const startPos = new vscode.Position(lineIdx, cmdIdx);
            const endPos = new vscode.Position(lineIdx, cmdIdx + name.length + 1);
            const range = new vscode.Range(startPos, endPos);
            
            let color = config.get<string>(name);
            let key = name;
            if (!color) {
              if (standardKeys.includes(name)) {
                color = config.get<string>(name) || '#3b82f6';
              } else {
                color = config.get<string>('generic') || '#8e8e8e';
                key = 'generic';
              }
            }
            const cacheKeyNormal = `${key}-${color}-normal`;
            
            const decTypeNormal = getDecorationTypeFor(name, false);
            decorationTypes.set(cacheKeyNormal, decTypeNormal);
            
            if (!combinedDecorations.has(cacheKeyNormal)) {
              combinedDecorations.set(cacheKeyNormal, []);
            }
            combinedDecorations.get(cacheKeyNormal)!.push({ range });

            // 2. Title -> bold
            if (title) {
              const titleIdx = lineText.indexOf(title, cmdIdx + name.length + 1);
              if (titleIdx !== -1) {
                const titleStart = new vscode.Position(lineIdx, titleIdx);
                const titleEnd = new vscode.Position(lineIdx, titleIdx + title.length);
                const titleRange = new vscode.Range(titleStart, titleEnd);
                
                const cacheKeyBold = `${key}-${color}-bold`;
                const decTypeBold = getDecorationTypeFor(name, true);
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
      // Check hierarchical directive start (e.g. #page or ##page)
      else if (trimmed.startsWith('#')) {
        const match = trimmed.match(/^(#+)([a-zA-Z0-9_\-]+)(.*)$/);
        if (match) {
          const hashes = match[1];
          const name = match[2];
          const title = match[3].trim();
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

          const cmdIdx = lineText.indexOf(hashes + name);
          if (cmdIdx !== -1) {
            // 1. Marker and type -> normal
            const startPos = new vscode.Position(lineIdx, cmdIdx);
            const endPos = new vscode.Position(lineIdx, cmdIdx + hashes.length + name.length);
            const range = new vscode.Range(startPos, endPos);
            
            let color = config.get<string>(name);
            let key = name;
            if (!color) {
              if (standardKeys.includes(name)) {
                color = config.get<string>(name) || '#3b82f6';
              } else {
                color = config.get<string>('generic') || '#8e8e8e';
                key = 'generic';
              }
            }
            const cacheKeyNormal = `${key}-${color}-normal`;
            
            const decTypeNormal = getDecorationTypeFor(name, false);
            decorationTypes.set(cacheKeyNormal, decTypeNormal);
            
            if (!combinedDecorations.has(cacheKeyNormal)) {
              combinedDecorations.set(cacheKeyNormal, []);
            }
            combinedDecorations.get(cacheKeyNormal)!.push({ range });

            // 2. Title -> bold
            if (title) {
              const titleIdx = lineText.indexOf(title, cmdIdx + hashes.length + name.length);
              if (titleIdx !== -1) {
                const titleStart = new vscode.Position(lineIdx, titleIdx);
                const titleEnd = new vscode.Position(lineIdx, titleIdx + title.length);
                const titleRange = new vscode.Range(titleStart, titleEnd);
                
                const cacheKeyBold = `${key}-${color}-bold`;
                const decTypeBold = getDecorationTypeFor(name, true);
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
              
              let color = config.get<string>(openDir.name);
              let key = openDir.name;
              if (!color) {
                if (standardKeys.includes(openDir.name)) {
                  color = config.get<string>(openDir.name) || '#3b82f6';
                } else {
                  color = config.get<string>('generic') || '#8e8e8e';
                  key = 'generic';
                }
              }
              const cacheKeyNormal = `${key}-${color}-normal`;
              
              const decTypeNormal = getDecorationTypeFor(openDir.name, false);
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
                    color: color + 'b0', // opacity
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
