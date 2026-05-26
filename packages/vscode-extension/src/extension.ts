import * as vscode from 'vscode';
import { parse } from '@edumark/parser';
import { renderToHTML } from '@edumark/renderer-html';

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

  // Update preview when active document changes
  vscode.workspace.onDidChangeTextDocument(event => {
    if (previewPanel && event.document === vscode.window.activeTextEditor?.document) {
      updateWebview(event.document);
    }
  });

  // Update preview when active editor changes
  vscode.window.onDidChangeActiveTextEditor(editor => {
    if (previewPanel && editor && (editor.document.languageId === 'edumark' || editor.document.fileName.endsWith('.edu'))) {
      previewPanel.title = `Vista Previa: ${vscode.workspace.asRelativePath(editor.document.uri)}`;
      updateWebview(editor.document);
    }
  });

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
