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
let activeDecorations = {};
function activate(context) {
    console.log('La extensión Edumark está activa.');
    let previewPanel = undefined;
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
    function getDecorationTypeFor(name) {
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
        let color = config.get(name);
        let key = name;
        if (!color) {
            if (standardKeys.includes(name)) {
                color = config.get(name) || '#3b82f6';
            }
            else {
                color = config.get('generic') || '#8e8e8e';
                key = 'generic';
            }
        }
        const cacheKey = `${key}-${color}`;
        if (!activeDecorations[cacheKey]) {
            activeDecorations[cacheKey] = vscode.window.createTextEditorDecorationType({
                color: color,
                fontWeight: 'bold'
            });
            context.subscriptions.push(activeDecorations[cacheKey]);
        }
        return activeDecorations[cacheKey];
    }
    function updateEndDecorations(editor) {
        const document = editor.document;
        const combinedDecorations = new Map();
        const decorationTypes = new Map();
        const stack = [];
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
                        const startPos = new vscode.Position(lineIdx, cmdIdx);
                        const endPos = new vscode.Position(lineIdx, cmdIdx + name.length + 1);
                        const range = new vscode.Range(startPos, endPos);
                        let color = config.get(name);
                        let key = name;
                        if (!color) {
                            if (standardKeys.includes(name)) {
                                color = config.get(name) || '#3b82f6';
                            }
                            else {
                                color = config.get('generic') || '#8e8e8e';
                                key = 'generic';
                            }
                        }
                        const cacheKey = `${key}-${color}`;
                        const decType = getDecorationTypeFor(name);
                        decorationTypes.set(cacheKey, decType);
                        if (!combinedDecorations.has(cacheKey)) {
                            combinedDecorations.set(cacheKey, []);
                        }
                        combinedDecorations.get(cacheKey).push({ range });
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
                        if (stack[i].level !== undefined && stack[i].level >= level) {
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
                        const startPos = new vscode.Position(lineIdx, cmdIdx);
                        const endPos = new vscode.Position(lineIdx, cmdIdx + hashes.length + name.length);
                        const range = new vscode.Range(startPos, endPos);
                        let color = config.get(name);
                        let key = name;
                        if (!color) {
                            if (standardKeys.includes(name)) {
                                color = config.get(name) || '#3b82f6';
                            }
                            else {
                                color = config.get('generic') || '#8e8e8e';
                                key = 'generic';
                            }
                        }
                        const cacheKey = `${key}-${color}`;
                        const decType = getDecorationTypeFor(name);
                        decorationTypes.set(cacheKey, decType);
                        if (!combinedDecorations.has(cacheKey)) {
                            combinedDecorations.set(cacheKey, []);
                        }
                        combinedDecorations.get(cacheKey).push({ range });
                    }
                }
            }
            // Check directive end
            else if (trimmed.startsWith('@end')) {
                let closingName = undefined;
                if (trimmed.startsWith('@end-')) {
                    closingName = trimmed.substring(5).trim();
                }
                if (stack.length > 0) {
                    let openDir = undefined;
                    if (closingName) {
                        const idx = stack.map(d => d.name).lastIndexOf(closingName);
                        if (idx !== -1) {
                            while (stack.length > idx) {
                                openDir = stack.pop();
                            }
                        }
                    }
                    else {
                        openDir = stack.pop();
                    }
                    if (openDir) {
                        const endIdx = lineText.indexOf(trimmed);
                        if (endIdx !== -1) {
                            const startPos = new vscode.Position(lineIdx, endIdx);
                            const endPos = new vscode.Position(lineIdx, endIdx + trimmed.length);
                            const range = new vscode.Range(startPos, endPos);
                            let color = config.get(openDir.name);
                            let key = openDir.name;
                            if (!color) {
                                if (standardKeys.includes(openDir.name)) {
                                    color = config.get(openDir.name) || '#3b82f6';
                                }
                                else {
                                    color = config.get('generic') || '#8e8e8e';
                                    key = 'generic';
                                }
                            }
                            const cacheKey = `${key}-${color}`;
                            const decType = getDecorationTypeFor(openDir.name);
                            decorationTypes.set(cacheKey, decType);
                            if (!combinedDecorations.has(cacheKey)) {
                                combinedDecorations.set(cacheKey, []);
                            }
                            const label = `[-${openDir.name}${openDir.title ? ' ' + openDir.title : ''}]`;
                            combinedDecorations.get(cacheKey).push({
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
            const decType = decorationTypes.get(cacheKey);
            editor.setDecorations(decType, options);
        }
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
function deactivate() {
    for (const decType of Object.values(activeDecorations)) {
        decType.dispose();
    }
    activeDecorations = {};
}
