import * as vscode from 'vscode';
import { parse } from '@edumark/parser';
import { renderToHTML } from '@edumark/renderer-html';
import { parseGeometricTable, formatGeometricTable } from '@edumark/table-engine';
import * as fs from 'fs';
import * as path from 'path';

function logToFile(msg: string) {
  try {
    const logPath = 'c:\\Users\\gerard\\Desktop\\edumark\\extension_log.txt';
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {
    // Ignore
  }
}

export function activate(context: vscode.ExtensionContext) {
  logToFile('Extension activated');
  console.log('La extensión Edumark está activa.');

  // 1. Live Preview WebView
  let previewPanel: vscode.WebviewPanel | undefined = undefined;

  const showPreviewCommand = vscode.commands.registerCommand('edumark.showPreview', () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || activeEditor.document.languageId !== 'edumark') {
      vscode.window.showInformationMessage('Abre un archivo .did para ver la vista previa.');
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

  let isFormatting = false;
  let isApplyingExtensionEdit = false;
  let pendingFormat = false;
  let currentFormattedTable: string | undefined = undefined;
  let bufferedChanges: { range: vscode.Range; text: string }[] = [];
  let debounceTimer: NodeJS.Timeout | undefined = undefined;

  async function formatAllTablesInDocument(document: vscode.TextDocument) {
    logToFile(`formatAllTablesInDocument called for ${document.fileName}, languageId: ${document.languageId}, isFormatting: ${isFormatting}`);
    if (isFormatting) return;
    if (document.languageId !== 'edumark' && !document.fileName.endsWith('.did')) return;

    const text = document.getText();
    const lines = text.split(/\r?\n/);

    let inTable = false;
    let tableLines: string[] = [];
    let startLineIdx = -1;
    const tablesToReplace: { range: vscode.Range; formatted: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isTableLine = line.trim().startsWith('|');

      if (isTableLine) {
        if (!inTable) {
          inTable = true;
          startLineIdx = i;
        }
        tableLines.push(line);
      } else {
        if (inTable) {
          try {
            const tableStr = tableLines.join('\n');
            const node = parseGeometricTable(tableStr);
            if (node.cells.length > 0) {
              const formatted = formatGeometricTable(node);
              if (formatted !== tableStr) {
                const range = new vscode.Range(
                  new vscode.Position(startLineIdx, 0),
                  new vscode.Position(i - 1, lines[i - 1].length)
                );
                tablesToReplace.push({ range, formatted });
              }
            }
          } catch (e: any) {
            logToFile(`Error parsing mid-table: ${e.message}`);
          }
          inTable = false;
          tableLines = [];
          startLineIdx = -1;
        }
      }
    }

    if (inTable && startLineIdx !== -1) {
      try {
        const tableStr = tableLines.join('\n');
        const node = parseGeometricTable(tableStr);
        if (node.cells.length > 0) {
          const formatted = formatGeometricTable(node);
          if (formatted !== tableStr) {
            const range = new vscode.Range(
              new vscode.Position(startLineIdx, 0),
              new vscode.Position(lines.length - 1, lines[lines.length - 1].length)
            );
            tablesToReplace.push({ range, formatted });
          }
        }
      } catch (e: any) {
        logToFile(`Error parsing end-table: ${e.message}`);
      }
    }

    logToFile(`tablesToReplace length: ${tablesToReplace.length}`);
    if (tablesToReplace.length === 0) return;

    try {
      isFormatting = true;
      isApplyingExtensionEdit = true;
      const workspaceEdit = new vscode.WorkspaceEdit();
      // Apply edits bottom-up to prevent line-shifting issues
      for (let i = tablesToReplace.length - 1; i >= 0; i--) {
        const { range, formatted } = tablesToReplace[i];
        workspaceEdit.replace(document.uri, range, formatted);
      }
      const success = await vscode.workspace.applyEdit(workspaceEdit);
      logToFile(`workspace.applyEdit success: ${success}`);
    } catch (err: any) {
      logToFile(`Error pre-formatting tables: ${err.message}`);
      console.error('Error pre-formatting tables:', err);
    } finally {
      isApplyingExtensionEdit = false;
      isFormatting = false;
    }
  }

  async function runLiveFormatting(currentEditor: vscode.TextEditor, document: vscode.TextDocument) {
    if (isFormatting) return;

    const position = currentEditor.selection.active;
    const currentLineIdx = position.line;
    const currentLineText = document.lineAt(currentLineIdx).text;

    // Trigger formatting if we edit a content row starting with '|'
    if (!currentLineText.trim().startsWith('|')) return;

    // Find table boundaries
    let startLineIdx = currentLineIdx;
    while (startLineIdx > 0 && document.lineAt(startLineIdx - 1).text.trim().startsWith('|')) {
      startLineIdx--;
    }

    let endLineIdx = currentLineIdx;
    while (endLineIdx < document.lineCount - 1 && document.lineAt(endLineIdx + 1).text.trim().startsWith('|')) {
      endLineIdx++;
    }

    const tableLines: string[] = [];
    for (let l = startLineIdx; l <= endLineIdx; l++) {
      tableLines.push(document.lineAt(l).text);
    }

    const tableStr = tableLines.join('\n');
    let tableNode;
    try {
      tableNode = parseGeometricTable(tableStr);
    } catch (e) {
      return;
    }

    if (!tableNode || tableNode.cells.length === 0) return;

    const r = currentLineIdx - startLineIdx;
    const c = position.character;

    const maxLength = Math.max(...tableLines.map(line => line.length));
    const grid = tableLines.map(line => line.padEnd(maxLength, ' '));

    const hLines: number[] = [];
    for (let row = 0; row < grid.length; row++) {
      const rowStr = grid[row];
      const isRowBorder =
        /^[|+\-\s=_]+$/.test(rowStr) &&
        (/[-=_]/.test(rowStr) || rowStr.includes('+'));
      if (isRowBorder) {
        hLines.push(row);
      }
    }

    // Ignore if it's a border row
    if (hLines.includes(r)) return;

    const vLinesSet = new Set<number>();
    for (const borderRow of hLines) {
      const rowStr = grid[borderRow];
      for (let col = 0; col < rowStr.length; col++) {
        if (rowStr[col] === '|' || rowStr[col] === '+') {
          vLinesSet.add(col);
        }
      }
    }
    const vLines = Array.from(vLinesSet).sort((a, b) => a - b);

    if (hLines.length < 2 || vLines.length < 2) return;

    let j = -1;
    for (let idx = 0; idx < hLines.length - 1; idx++) {
      if (r > hLines[idx] && r < hLines[idx + 1]) {
        j = idx;
        break;
      }
    }

    const currentLineBoundaryPos = getLineBoundaryPos(currentLineText, vLines);
    let i = -1;
    for (let idx = 0; idx < vLines.length - 1; idx++) {
      const left = currentLineBoundaryPos[idx] !== -1 ? currentLineBoundaryPos[idx] : vLines[idx];
      const right = currentLineBoundaryPos[idx + 1] !== -1 ? currentLineBoundaryPos[idx + 1] : vLines[idx + 1];
      if (c > left && c <= right) {
        i = idx;
        break;
      }
    }

    // Strict cursor check: must be in a valid cell and indices must be valid
    if (j === -1 || i === -1) return;

    const cell = tableNode.cells.find(
      (cell: any) => cell.row <= j && j < cell.row + cell.rowspan && cell.column <= i && i < cell.column + cell.colspan
    );

    if (!cell) return;

    // 1. Calculate non-whitespace character count and trailing spaces before the cursor inside this cell
    const cellStartRow = startLineIdx + hLines[cell.row] + 1;
    const cellEndRow = startLineIdx + hLines[cell.row + cell.rowspan] - 1;

    let textBeforeCursor = '';
    for (let rowIdx = cellStartRow; rowIdx <= cellEndRow; rowIdx++) {
      const lineText = document.lineAt(rowIdx).text;
      const boundaryPos = getLineBoundaryPos(lineText, vLines);

      const leftSep = boundaryPos[cell.column] !== -1 ? boundaryPos[cell.column] : vLines[cell.column];
      const rightSep = boundaryPos[cell.column + cell.colspan] !== -1 ? boundaryPos[cell.column + cell.colspan] : vLines[cell.column + cell.colspan];

      if (leftSep !== -1 && rightSep !== -1) {
        const slice = lineText.substring(leftSep + 1, rightSep);
        if (rowIdx < currentLineIdx) {
          textBeforeCursor += slice + '\n';
        } else if (rowIdx === currentLineIdx) {
          const relCursor = c - (leftSep + 1);
          textBeforeCursor += slice.substring(0, relCursor);
        }
      }
    }

    const targetNonSpaceCount = textBeforeCursor.replace(/\s/g, '').length;
    const trailingSpaceMatch = textBeforeCursor.match(/ *$/);
    const trailingSpaceCount = trailingSpaceMatch ? trailingSpaceMatch[0].length : 0;

    // 2. Format the table
    let formattedTable;
    try {
      formattedTable = formatGeometricTable(tableNode);
    } catch (e: any) {
      logToFile(`Error formatting table in runLiveFormatting: ${e.message}`);
      return;
    }

    logToFile(`runLiveFormatting: table formatted. Length: ${formattedTable.length}`);

    // 3. Apply the edit
    let success = false;
    try {
      isFormatting = true;
      isApplyingExtensionEdit = true;
      currentFormattedTable = formattedTable;
      const range = new vscode.Range(
        new vscode.Position(startLineIdx, 0),
        new vscode.Position(endLineIdx, document.lineAt(endLineIdx).text.length)
      );

      const workspaceEdit = new vscode.WorkspaceEdit();
      workspaceEdit.replace(document.uri, range, formattedTable);
      success = await vscode.workspace.applyEdit(workspaceEdit);
      logToFile(`runLiveFormatting: workspace.applyEdit success: ${success}`);
    } catch (err: any) {
      logToFile(`Error applying live format edit: ${err.message}`);
      console.error('Error applying live format edit:', err);
    } finally {
      isApplyingExtensionEdit = false;
      isFormatting = false;
      currentFormattedTable = undefined;

      // Write any keystrokes that were buffered during formatting
      if (bufferedChanges.length > 0) {
        const textToInsert = bufferedChanges.map(ch => ch.text).join('');
        logToFile(`runLiveFormatting: writing ${bufferedChanges.length} buffered changes: "${textToInsert}"`);
        bufferedChanges = [];
        try {
          const bufferEdit = new vscode.WorkspaceEdit();
          bufferEdit.insert(document.uri, currentEditor.selection.active, textToInsert);
          isApplyingExtensionEdit = true;
          await vscode.workspace.applyEdit(bufferEdit);
        } catch (e: any) {
          logToFile(`Error writing buffered changes: ${e.message}`);
          console.error('Error writing buffered changes:', e);
        } finally {
          isApplyingExtensionEdit = false;
        }
      }

      if (pendingFormat) {
        logToFile(`runLiveFormatting: pendingFormat is true, scheduling follow-up in 100ms`);
        pendingFormat = false;
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            runLiveFormatting(editor, editor.document);
          }
        }, 100);
      }
    }

    if (success) {
      // 4. Recalculate new cursor position
      const newHLines: number[] = [];
      const newRawLines = formattedTable.split('\n');
      const newMaxLength = Math.max(...newRawLines.map(line => line.length));
      const newGrid = newRawLines.map(line => line.padEnd(newMaxLength, ' '));
      for (let row = 0; row < newGrid.length; row++) {
        const rowStr = newGrid[row];
        const isRowBorder =
          /^[|+\-\s=_]+$/.test(rowStr) &&
          (/[-=_]/.test(rowStr) || rowStr.includes('+'));
        if (isRowBorder) {
          newHLines.push(row);
        }
      }

      const newVLinesSet = new Set<number>();
      for (const borderRow of newHLines) {
        const rowStr = newGrid[borderRow];
        for (let col = 0; col < rowStr.length; col++) {
          if (rowStr[col] === '|' || rowStr[col] === '+') {
            newVLinesSet.add(col);
          }
        }
      }
      const newVLines = Array.from(newVLinesSet).sort((a, b) => a - b);

      // Extract content lines of formatted cell
      const formattedCellContent: string[] = [];
      const fCellStartRow = newHLines[cell.row] + 1;
      const fCellEndRow = newHLines[cell.row + cell.rowspan] - 1;
      for (let rowIdx = fCellStartRow; rowIdx <= fCellEndRow; rowIdx++) {
        const lineText = newRawLines[rowIdx];
        const leftSep = newVLines[cell.column];
        const rightSep = newVLines[cell.column + cell.colspan];
        const slice = lineText.substring(leftSep + 1, rightSep);
        formattedCellContent.push(slice.trim());
      }

      let accumNonSpace = 0;
      let targetLine = 0;
      let targetChar = 0;

      for (let idx = 0; idx < formattedCellContent.length; idx++) {
        const W_line = formattedCellContent[idx];
        const lineNonSpace = W_line.replace(/\s/g, '').length;
        if (accumNonSpace + lineNonSpace >= targetNonSpaceCount) {
          const rem = targetNonSpaceCount - accumNonSpace;
          let nonSpaceInLine = 0;
          let charIdx = 0;
          while (charIdx < W_line.length && nonSpaceInLine < rem) {
            if (W_line[charIdx] !== ' ') {
              nonSpaceInLine++;
            }
            charIdx++;
          }
          targetLine = idx;
          targetChar = charIdx;
          break;
        } else {
          accumNonSpace += lineNonSpace;
          if (idx === formattedCellContent.length - 1) {
            targetLine = idx;
            targetChar = W_line.length;
          }
        }
      }

      // Limit targetChar + trailingSpaceCount to the padded width of the cell
      let cellWidth = 0;
      for (let c = cell.column; c < cell.column + cell.colspan; c++) {
        cellWidth += newVLines[c + 1] - newVLines[c] - 1;
      }
      cellWidth += cell.colspan - 1;
      const maxTargetChar = Math.max(0, cellWidth - 1);
      const finalTargetChar = Math.min(targetChar + trailingSpaceCount, maxTargetChar);

      const newCursorLine = startLineIdx + fCellStartRow + targetLine;
      const newCursorChar = newVLines[cell.column] + 2 + finalTargetChar;

      const newPosition = new vscode.Position(newCursorLine, newCursorChar);
      currentEditor.selection = new vscode.Selection(newPosition, newPosition);
    }
  }

  // Pre-format visible editors and open documents on launch with staggered delays to ensure readiness
  const startupDelays = [0, 100, 500, 1000, 2000, 5000];
  startupDelays.forEach(delay => {
    setTimeout(() => {
      logToFile(`Startup staggered timeout ${delay}ms firing`);
      for (const editor of vscode.window.visibleTextEditors) {
        formatAllTablesInDocument(editor.document);
      }
      for (const document of vscode.workspace.textDocuments) {
        formatAllTablesInDocument(document);
      }
    }, delay);
  });

  // Auto-update Webview and format tables live when text document changes
  vscode.workspace.onDidChangeTextDocument(async event => {
    if (previewPanel && event.document === vscode.window.activeTextEditor?.document) {
      updateWebview(event.document);
    }

    if (isApplyingExtensionEdit) {
      return;
    }

    if (isFormatting) {
      pendingFormat = true;
      for (const change of event.contentChanges) {
        bufferedChanges.push(change);
      }
      return;
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || event.document !== activeEditor.document) return;
    if (activeEditor.document.languageId !== 'edumark' && !activeEditor.document.fileName.endsWith('.did')) return;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      logToFile(`onDidChangeTextDocument: live format debounce timeout firing`);
      if (isFormatting) {
        pendingFormat = true;
        return;
      }
      const currentEditor = vscode.window.activeTextEditor;
      if (!currentEditor || currentEditor.document !== event.document) return;

      await runLiveFormatting(currentEditor, event.document);
    }, 100);
  });

  // Auto-update Webview and preformat when active editor changes
  vscode.window.onDidChangeActiveTextEditor(editor => {
    logToFile(`onDidChangeActiveTextEditor fired for ${editor ? editor.document.fileName : 'undefined'}`);
    if (previewPanel && editor && (editor.document.languageId === 'edumark' || editor.document.fileName.endsWith('.did'))) {
      previewPanel.title = `Vista Previa: ${vscode.workspace.asRelativePath(editor.document.uri)}`;
      updateWebview(editor.document);
    }
    if (editor) {
      const delays = [0, 50, 100, 300, 500, 1000, 2000];
      delays.forEach(delay => {
        setTimeout(() => {
          logToFile(`Active editor change timeout ${delay}ms firing`);
          if (vscode.window.activeTextEditor === editor) {
            formatAllTablesInDocument(editor.document);
          }
        }, delay);
      });
    }
  });

  // Pre-format when a text document is opened
  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(document => {
    logToFile(`onDidOpenTextDocument fired for ${document.fileName}`);
    const delays = [0, 50, 100, 300, 500, 1000, 2000];
    delays.forEach(delay => {
      setTimeout(() => {
        logToFile(`Document open timeout ${delay}ms firing for ${document.fileName}`);
        formatAllTablesInDocument(document);
      }, delay);
    });
  }));

  // Pre-format when visible text editors change
  context.subscriptions.push(vscode.window.onDidChangeVisibleTextEditors(editors => {
    logToFile(`onDidChangeVisibleTextEditors fired with ${editors.length} editors`);
    for (const editor of editors) {
      const delays = [0, 50, 100, 300, 500, 1000, 2000];
      delays.forEach(delay => {
        setTimeout(() => {
          logToFile(`Visible editors change timeout ${delay}ms firing for ${editor.document.fileName}`);
          formatAllTablesInDocument(editor.document);
        }, delay);
      });
    }
  }));

  function updateWebview(document: vscode.TextDocument) {
    if (!previewPanel) return;

    try {
      const source = document.getText();
      const { ast, errors } = parse(source);

      let html = '';
      if (errors.length > 0) {
        // Output styled errors
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

  // 2. Table Auto-Formatter Edit Provider
  const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider('edumark', {
    provideDocumentFormattingEdits(
      document: vscode.TextDocument,
      options: vscode.FormattingOptions,
      token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.TextEdit[]> {
      const edits: vscode.TextEdit[] = [];
      const text = document.getText();
      const lines = text.split(/\r?\n/);

      let inTable = false;
      let tableLines: string[] = [];
      let startLineIdx = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isTableLine = line.trim().startsWith('|');

        if (isTableLine) {
          if (!inTable) {
            inTable = true;
            startLineIdx = i;
          }
          tableLines.push(line);
        } else {
          if (inTable) {
            // Process the accumulated table
            try {
              const tableStr = tableLines.join('\n');
              const node = parseGeometricTable(tableStr);
              if (node.cells.length > 0) {
                const formatted = formatGeometricTable(node);
                const range = new vscode.Range(
                  new vscode.Position(startLineIdx, 0),
                  new vscode.Position(i - 1, lines[i - 1].length)
                );
                edits.push(vscode.TextEdit.replace(range, formatted));
              }
            } catch (e) {
              console.error('Error auto-formatting table', e);
            }
            inTable = false;
            tableLines = [];
            startLineIdx = -1;
          }
        }
      }

      // Check if table ends at the very last line of the file
      if (inTable && startLineIdx !== -1) {
        try {
          const tableStr = tableLines.join('\n');
          const node = parseGeometricTable(tableStr);
          if (node.cells.length > 0) {
            const formatted = formatGeometricTable(node);
            const range = new vscode.Range(
              new vscode.Position(startLineIdx, 0),
              new vscode.Position(lines.length - 1, lines[lines.length - 1].length)
            );
            edits.push(vscode.TextEdit.replace(range, formatted));
          }
        } catch (e) {
          console.error('Error auto-formatting table', e);
        }
      }

      return edits;
    }
  });

  // 3. Table Enter Command
  const tableEnterCommand = vscode.commands.registerCommand('edumark.tableEnter', async () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || activeEditor.document.languageId !== 'edumark') {
      await vscode.commands.executeCommand('type', { text: '\n' });
      return;
    }

    const document = activeEditor.document;
    const position = activeEditor.selection.active;
    const currentLineIdx = position.line;
    const currentLineText = document.lineAt(currentLineIdx).text;

    // Check if current line starts with '|'
    if (!currentLineText.trim().startsWith('|')) {
      await vscode.commands.executeCommand('type', { text: '\n' });
      return;
    }

    // Find table boundaries
    let startLineIdx = currentLineIdx;
    while (startLineIdx > 0 && document.lineAt(startLineIdx - 1).text.trim().startsWith('|')) {
      startLineIdx--;
    }

    let endLineIdx = currentLineIdx;
    while (endLineIdx < document.lineCount - 1 && document.lineAt(endLineIdx + 1).text.trim().startsWith('|')) {
      endLineIdx++;
    }

    const tableLines: string[] = [];
    for (let l = startLineIdx; l <= endLineIdx; l++) {
      tableLines.push(document.lineAt(l).text);
    }

    const tableStr = tableLines.join('\n');
    let tableNode;
    try {
      tableNode = parseGeometricTable(tableStr);
    } catch (e) {
      await vscode.commands.executeCommand('type', { text: '\n' });
      return;
    }

    if (!tableNode || tableNode.cells.length === 0) {
      await vscode.commands.executeCommand('type', { text: '\n' });
      return;
    }

    // Map cursor position to the table grid
    const r = currentLineIdx - startLineIdx;
    const c = position.character;

    // Find hLines and vLines exactly as in the parser
    const maxLength = Math.max(...tableLines.map(line => line.length));
    const grid = tableLines.map(line => line.padEnd(maxLength, ' '));

    const hLines: number[] = [];
    for (let row = 0; row < grid.length; row++) {
      const rowStr = grid[row];
      const isBorderRow =
        /^[|+\-\s=_]+$/.test(rowStr) &&
        (/[-=_]/.test(rowStr) || rowStr.includes('+'));
      if (isBorderRow) {
        hLines.push(row);
      }
    }

    const vLinesSet = new Set<number>();
    for (const borderRow of hLines) {
      const rowStr = grid[borderRow];
      for (let col = 0; col < rowStr.length; col++) {
        if (rowStr[col] === '|' || rowStr[col] === '+') {
          vLinesSet.add(col);
        }
      }
    }
    const vLines = Array.from(vLinesSet).sort((a, b) => a - b);

    if (hLines.length < 2 || vLines.length < 2) {
      await vscode.commands.executeCommand('type', { text: '\n' });
      return;
    }

    // Find row interval j
    let j = -1;
    for (let idx = 0; idx < hLines.length - 1; idx++) {
      if (r > hLines[idx] && r < hLines[idx + 1]) {
        j = idx;
        break;
      }
    }

    // Find col interval i
    const currentLineBoundaryPos = getLineBoundaryPos(currentLineText, vLines);
    let i = -1;
    for (let idx = 0; idx < vLines.length - 1; idx++) {
      const left = currentLineBoundaryPos[idx] !== -1 ? currentLineBoundaryPos[idx] : vLines[idx];
      const right = currentLineBoundaryPos[idx + 1] !== -1 ? currentLineBoundaryPos[idx + 1] : vLines[idx + 1];
      if (c > left && c <= right) {
        i = idx;
        break;
      }
    }

    if (j === -1 || i === -1) {
      // Cursor is on a border row or border column
      await vscode.commands.executeCommand('type', { text: '\n' });
      return;
    }

    // Find the cell containing (j, i)
    const cell = tableNode.cells.find(
      (cell: any) => cell.row <= j && j < cell.row + cell.rowspan && cell.column <= i && i < cell.column + cell.colspan
    );

    if (!cell) {
      await vscode.commands.executeCommand('type', { text: '\n' });
      return;
    }

    // Determine the split position in the cell's content
    const cellStartRow = hLines[cell.row] + 1;
    let linesBeforeCursor = 0;
    for (let rowIdx = cellStartRow; rowIdx < r; rowIdx++) {
      if (!hLines.includes(rowIdx)) {
        linesBeforeCursor++;
      }
    }

    const lineIdx = linesBeforeCursor;

    // Split the text of the line containing the cursor
    const documentLineText = document.lineAt(currentLineIdx).text;
    const boundaryPos = getLineBoundaryPos(documentLineText, vLines);
    const leftSep = boundaryPos[cell.column] !== -1 ? boundaryPos[cell.column] : vLines[cell.column];
    const rightSep = boundaryPos[cell.column + cell.colspan] !== -1 ? boundaryPos[cell.column + cell.colspan] : vLines[cell.column + cell.colspan];

    const colStart = leftSep + 1;
    const cellColEnd = rightSep - 1;
    const cellLineSlice = documentLineText.substring(colStart, cellColEnd + 1);

    const relCursor = c - colStart;
    const part1 = cellLineSlice.substring(0, relCursor).trim();
    const part2 = cellLineSlice.substring(relCursor).trim();

    // Reconstruct cell content
    const newContent = [...cell.content];
    while (newContent.length <= lineIdx) {
      newContent.push('');
    }
    
    newContent[lineIdx] = part1;
    newContent.splice(lineIdx + 1, 0, part2);

    cell.content = newContent;

    // Also add a new line to all other cells in the same row range (at the end of each cell's content)
    for (const otherCell of tableNode.cells) {
      if (otherCell.id !== cell.id) {
        if (otherCell.row <= cell.row && cell.row < otherCell.row + otherCell.rowspan) {
          otherCell.content.push('');
        }
      }
    }

    // Format the modified table
    let formattedTable;
    try {
      formattedTable = formatGeometricTable(tableNode);
    } catch (e) {
      await vscode.commands.executeCommand('type', { text: '\n' });
      return;
    }

    // Replace the old table in the document
    const range = new vscode.Range(
      new vscode.Position(startLineIdx, 0),
      new vscode.Position(endLineIdx, document.lineAt(endLineIdx).text.length)
    );

    let success = false;
    try {
      isFormatting = true;
      isApplyingExtensionEdit = true;
      const workspaceEdit = new vscode.WorkspaceEdit();
      workspaceEdit.replace(document.uri, range, formattedTable);
      success = await vscode.workspace.applyEdit(workspaceEdit);
      logToFile(`tableEnterCommand: workspace.applyEdit success: ${success}`);
    } catch (err: any) {
      logToFile(`Error applying tableEnter edit: ${err.message}`);
      console.error('Error applying tableEnter edit:', err);
    } finally {
      isApplyingExtensionEdit = false;
      isFormatting = false;
    }

    if (success) {
      // Calculate new cursor position in the formatted table
      const newHLines: number[] = [];
      const newRawLines = formattedTable.split('\n');
      const newMaxLength = Math.max(...newRawLines.map(line => line.length));
      const newGrid = newRawLines.map(line => line.padEnd(newMaxLength, ' '));
      for (let row = 0; row < newGrid.length; row++) {
        const rowStr = newGrid[row];
        const isBorderRow =
          /^[|+\-\s=_]+$/.test(rowStr) &&
          (/[-=_]/.test(rowStr) || rowStr.includes('+'));
        if (isBorderRow) {
          newHLines.push(row);
        }
      }

      const newVLinesSet = new Set<number>();
      for (const borderRow of newHLines) {
        const rowStr = newGrid[borderRow];
        for (let col = 0; col < rowStr.length; col++) {
          if (rowStr[col] === '|' || rowStr[col] === '+') {
            newVLinesSet.add(col);
          }
        }
      }
      const newVLines = Array.from(newVLinesSet).sort((a, b) => a - b);

      const newCursorLine = startLineIdx + newHLines[cell.row] + 1 + lineIdx + 1;
      const newCursorChar = newVLines[cell.column] + 2;

      const newPosition = new vscode.Position(newCursorLine, newCursorChar);
      activeEditor.selection = new vscode.Selection(newPosition, newPosition);
    }
  });

  context.subscriptions.push(formattingProvider);
  context.subscriptions.push(tableEnterCommand);
}

export function deactivate() {}

function getLineBoundaryPos(lineText: string, vLines: number[]): number[] {
  const lineVLines: number[] = [];
  for (let colIdx = 0; colIdx < lineText.length; colIdx++) {
    if (lineText[colIdx] === '|') {
      lineVLines.push(colIdx);
    }
  }

  const boundaryPos = Array(vLines.length).fill(-1);
  if (lineVLines.length >= 2 && vLines.length >= 2) {
    boundaryPos[0] = lineVLines[0];
    boundaryPos[vLines.length - 1] = lineVLines[lineVLines.length - 1];
    for (let k = 1; k < lineVLines.length - 1; k++) {
      const s = lineVLines[k];
      let closestIdx = 1;
      let minDiff = Math.abs(s - vLines[1]);
      for (let idx = 2; idx < vLines.length - 1; idx++) {
        const diff = Math.abs(s - vLines[idx]);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      }
      boundaryPos[closestIdx] = s;
    }
  }
  return boundaryPos;
}
