import * as vscode from 'vscode';
import { parse } from '@edumark/parser';
import { renderToHTML } from '@edumark/renderer-html';

export function activate(context: vscode.ExtensionContext) {
  console.log('La extensión Edumark está activa.');

  let previewPanel: vscode.WebviewPanel | undefined = undefined;

  // Create decoration type for @end helper hints
  const endDecorationType = vscode.window.createTextEditorDecorationType({});
  context.subscriptions.push(endDecorationType);

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
      updateEndDecorations(editor, endDecorationType);
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

  function updateEndDecorations(editor: vscode.TextEditor, decorationType: vscode.TextEditorDecorationType) {
    const document = editor.document;
    const decorations: vscode.DecorationOptions[] = [];
    const stack: { name: string; title: string }[] = [];

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
        }
      } 
      // Check directive end
      else if (trimmed.startsWith('@end')) {
        if (stack.length > 0) {
          const openDir = stack.pop()!;
          const endIdx = lineText.indexOf(trimmed);
          if (endIdx !== -1) {
            const label = `[-${openDir.name}${openDir.title ? ' ' + openDir.title : ''}]`;
            const startPos = new vscode.Position(lineIdx, endIdx);
            const endPos = new vscode.Position(lineIdx, endIdx + trimmed.length);

            decorations.push({
              range: new vscode.Range(startPos, endPos),
              renderOptions: {
                after: {
                  contentText: ` ${label}`,
                  color: 'rgba(150, 150, 150, 0.65)',
                  fontStyle: 'italic',
                  margin: '0 0 0 10px'
                }
              }
            });
          }
        }
      }
    }

    editor.setDecorations(decorationType, decorations);
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

export function deactivate() {}
