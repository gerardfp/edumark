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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const parser_1 = require("@edumark/parser");
const renderer_html_1 = require("@edumark/renderer-html");
function activate(context) {
    console.log('La extensión Edumark está activa.');
    let previewPanel = undefined;
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
        }
        else {
            previewPanel = vscode.window.createWebviewPanel('edumarkPreview', `Vista Previa: ${vscode.workspace.asRelativePath(activeEditor.document.uri)}`, vscode.ViewColumn.Beside, {
                enableScripts: true,
                retainContextWhenHidden: true
            });
            previewPanel.onDidDispose(() => {
                previewPanel = undefined;
            });
            updateWebview(activeEditor.document);
        }
    });
    context.subscriptions.push(showPreviewCommand);
    // Trigger decorations update
    function triggerUpdateDecorations(editor) {
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
    function updateEndDecorations(editor, decorationType) {
        const document = editor.document;
        const decorations = [];
        const stack = [];
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
                    const openDir = stack.pop();
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
    function updateWebview(document) {
        if (!previewPanel)
            return;
        try {
            const source = document.getText();
            const { ast, errors } = (0, parser_1.parse)(source);
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
            }
            else {
                html = (0, renderer_html_1.renderToHTML)(ast);
            }
            previewPanel.webview.html = html;
        }
        catch (err) {
            previewPanel.webview.html = `<h3>Error de renderizado:</h3><pre>${err.message}</pre>`;
        }
    }
}
function deactivate() { }
