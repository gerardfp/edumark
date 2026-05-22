"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatInline = formatInline;
exports.renderToHTML = renderToHTML;
// Utility to escape HTML special characters
function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
// Format inline markdown constructs: **bold**, *italic*, `code`, [text](url), ![alt](img)
function formatInline(text) {
    let html = escapeHTML(text);
    // Images: ![alt](url)
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="edu-img" />');
    // Links: [text](url)
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="edu-link">$1</a>');
    // Bold: **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic: *text*
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Code: `code`
    html = html.replace(/`(.*?)`/g, '<code class="edu-inline-code">$1</code>');
    return html;
}
function renderToHTML(doc, customStyles = '') {
    const frontmatterHTML = renderFrontmatter(doc.frontmatter);
    const childrenHTML = renderNodes(doc.children);
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=scale=1.0">
  <title>${escapeHTML(doc.frontmatter.title || 'Recurso Educativo Edumark')}</title>
  <style>
    /* Reset & CSS Variables for harmonious colors and rich typography */
    :root {
      --primary-color: #3b82f6;
      --primary-dark: #2563eb;
      --bg-color: #f8fafc;
      --text-color: #1e293b;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
      
      --card-bg: #ffffff;
      --didyouknow-bg: #eff6ff;
      --didyouknow-border: #bfdbfe;
      --warning-bg: #fff7ed;
      --warning-border: #ffedd5;
      --hint-bg: #f0fdf4;
      --hint-border: #bbf7d0;
      --solution-bg: #faf5ff;
      --solution-border: #f3e8ff;
      --reflection-bg: #f5f3ff;
      --reflection-border: #edd9ff;
      --activity-bg: #fff1f2;
      --activity-border: #ffe4e6;
      --note-bg: #f8fafc;
      --note-border: #cbd5e1;
    }

    body {
      font-family: 'Outfit', 'Inter', system-ui, -apple-system, sans-serif;
      line-height: 1.6;
      color: var(--text-color);
      background-color: var(--bg-color);
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    header.edu-header {
      margin-bottom: 3rem;
      padding-bottom: 1.5rem;
      border-bottom: 2px solid var(--border-color);
    }

    h1.edu-title {
      font-size: 2.5rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 0.5rem 0;
      background: linear-gradient(to right, #2563eb, #3b82f6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .edu-meta {
      display: flex;
      gap: 1.5rem;
      font-size: 0.95rem;
      color: var(--text-muted);
    }

    .edu-section {
      margin: 2.5rem 0 1.5rem 0;
    }

    .edu-section h2 {
      font-size: 1.75rem;
      font-weight: 700;
      color: #1e293b;
      border-left: 5px solid var(--primary-color);
      padding-left: 0.75rem;
      margin: 0;
    }

    p.edu-paragraph {
      margin: 0 0 1.25rem 0;
      font-size: 1.05rem;
    }

    /* PREMIUM DIDACTICAL CARDS */
    .edu-card {
      border-radius: 12px;
      border: 1px solid var(--border-color);
      margin: 1.5rem 0;
      padding: 1.25rem 1.5rem;
      background-color: var(--card-bg);
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .edu-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .card-header h3 {
      font-size: 1.15rem;
      font-weight: 700;
      margin: 0;
      color: #0f172a;
    }

    .card-header .icon {
      font-size: 1.5rem;
    }

    /* CARD THEMES */
    .edu-card.didyouknow { background-color: var(--didyouknow-bg); border-color: var(--didyouknow-border); }
    .edu-card.warning { background-color: var(--warning-bg); border-color: var(--warning-border); }
    .edu-card.hint { background-color: var(--hint-bg); border-color: var(--hint-border); }
    .edu-card.solution { background-color: var(--solution-bg); border-color: var(--solution-border); }
    .edu-card.reflection { background-color: var(--reflection-bg); border-color: var(--reflection-border); }
    .edu-card.activity { background-color: var(--activity-bg); border-color: var(--activity-border); }
    .edu-card.note { background-color: var(--note-bg); border-color: var(--note-border); }

    /* LISTS & CHECKLISTS */
    ul.edu-list {
      margin: 0 0 1.25rem 1.5rem;
      padding: 0;
    }

    li.edu-list-item {
      margin-bottom: 0.5rem;
      font-size: 1.05rem;
    }

    li.checklist-item {
      list-style: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-left: -1.5rem;
      margin-bottom: 0.5rem;
    }

    li.checklist-item input[type="checkbox"] {
      width: 1.15rem;
      height: 1.15rem;
      accent-color: var(--primary-color);
      cursor: not-allowed;
    }

    /* CODE BLOCKS */
    pre.edu-code {
      background-color: #0f172a;
      color: #f8fafc;
      padding: 1.25rem;
      border-radius: 8px;
      overflow-x: auto;
      font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
      font-size: 0.95rem;
      margin: 1.5rem 0;
      border: 1px solid #1e293b;
    }

    code.edu-inline-code {
      font-family: 'Fira Code', Consolas, monospace;
      font-size: 0.9rem;
      background-color: #f1f5f9;
      color: #0f172a;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      border: 1px solid var(--border-color);
    }

    /* QUESTION BLOCKS */
    .edu-question {
      border: 2px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      margin: 2rem 0;
      background-color: #ffffff;
    }

    .edu-question-prompt {
      font-weight: 700;
      font-size: 1.2rem;
      margin-bottom: 1rem;
      color: #0f172a;
    }

    .edu-question-options {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }

    .edu-question-option {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background-color: var(--bg-color);
    }

    .edu-question-option.correct {
      border-color: #86efac;
      background-color: #f0fdf4;
    }

    .edu-question-option input[type="checkbox"],
    .edu-question-option input[type="radio"] {
      width: 1.2rem;
      height: 1.2rem;
      accent-color: var(--primary-color);
    }

    .edu-explanation {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px dashed var(--border-color);
      font-style: italic;
      color: var(--text-muted);
    }

    /* GEOMETRIC TABLES */
    table.edu-table {
      width: 100%;
      border-collapse: collapse;
      margin: 2rem 0;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
    }

    table.edu-table th, 
    table.edu-table td {
      border: 1px solid var(--border-color);
      padding: 0.85rem 1.15rem;
      font-size: 1rem;
      text-align: left;
    }

    table.edu-table th,
    table.edu-table td.header {
      background-color: #f1f5f9;
      font-weight: 700;
      color: #0f172a;
    }

    table.edu-table tr:nth-child(even) {
      background-color: #fafbfd;
    }

    /* RUBRIC TABLES SPECIFIC STYLING */
    table.edu-table.rubric {
      border: 2px solid #6366f1;
    }
    table.edu-table.rubric th {
      background-color: #e0e7ff;
      color: #312e81;
    }

    /* PRINT AND DARK MODE */
    @media print {
      body {
        background-color: #ffffff;
        color: #000000;
        max-width: 100%;
        padding: 0;
      }
      .edu-card {
        box-shadow: none !important;
        page-break-inside: avoid;
      }
    }

    ${customStyles}
  </style>
</head>
<body>
  ${frontmatterHTML}
  <main>
    ${childrenHTML}
  </main>
</body>
</html>`;
}
function renderFrontmatter(meta) {
    if (!meta.title && !meta.author && !meta.level)
        return '';
    return `<header class="edu-header">
  ${meta.title ? `<h1 class="edu-title">${escapeHTML(meta.title)}</h1>` : ''}
  <div class="edu-meta">
    ${meta.author ? `<span class="edu-author"><strong>Autor:</strong> ${escapeHTML(meta.author)}</span>` : ''}
    ${meta.level ? `<span class="edu-level"><strong>Nivel:</strong> ${escapeHTML(meta.level)}</span>` : ''}
  </div>
</header>`;
}
function renderNodes(nodes) {
    let html = '';
    let i = 0;
    while (i < nodes.length) {
        const node = nodes[i];
        // Group consecutive list items into a single <ul> block
        if (node.type === 'list-item') {
            const listItems = [];
            while (i < nodes.length && nodes[i].type === 'list-item') {
                listItems.push(nodes[i]);
                i++;
            }
            html += `<ul class="edu-list">\n`;
            for (const item of listItems) {
                if (item.checked !== undefined) {
                    html += `  <li class="checklist-item"><input type="checkbox" ${item.checked ? 'checked' : ''} disabled /> ${formatInline(item.content)}</li>\n`;
                }
                else {
                    html += `  <li class="edu-list-item">${formatInline(item.content)}</li>\n`;
                }
            }
            html += `</ul>\n`;
            continue;
        }
        // Standard render for single nodes
        html += renderNode(node);
        i++;
    }
    return html;
}
function renderNode(node) {
    switch (node.type) {
        case 'paragraph':
            return `<p class="edu-paragraph">${formatInline(node.content)}</p>\n`;
        case 'code-block':
            return `<pre class="edu-code"><code class="language-${escapeHTML(node.language || 'text')}">${escapeHTML(node.content)}</code></pre>\n`;
        case 'directive':
            return renderDirective(node);
        case 'table':
            return renderTable(node);
        case 'question':
            return renderQuestion(node);
        default:
            return '';
    }
}
function renderDirective(node) {
    if (node.name === 'section') {
        return `<section class="edu-section">
  <h2>${escapeHTML(node.title || '')}</h2>
</section>\n`;
    }
    // Get visually elegant card properties
    let titleText = '';
    let icon = '📝';
    switch (node.name) {
        case 'didyouknow':
            titleText = '¿Sabías que...?';
            icon = '💡';
            break;
        case 'warning':
            titleText = 'Atención';
            icon = '⚠️';
            break;
        case 'hint':
            titleText = 'Sugerencia';
            icon = '🔍';
            break;
        case 'solution':
            titleText = 'Solución';
            icon = '🔑';
            break;
        case 'reflection':
            titleText = 'Reflexión';
            icon = '💭';
            break;
        case 'activity':
            titleText = 'Actividad';
            icon = '✍️';
            break;
        case 'note':
            titleText = 'Nota';
            icon = '📝';
            break;
    }
    if (node.title) {
        titleText += ` — ${node.title}`;
    }
    const childHTML = renderNodes(node.children);
    return `<div class="edu-card ${node.name}">
  <div class="card-header">
    <span class="icon">${icon}</span>
    <h3>${escapeHTML(titleText)}</h3>
  </div>
  <div class="card-body">
    ${childHTML}
  </div>
</div>\n`;
}
function renderQuestion(node) {
    let optionsHTML = '';
    if (node.options && node.options.length > 0) {
        optionsHTML += `<div class="edu-question-options">\n`;
        for (const opt of node.options) {
            const inputType = node.questionType === 'multiple-choice' ? 'checkbox' : 'radio';
            const cssClass = opt.checked ? 'edu-question-option correct' : 'edu-question-option';
            optionsHTML += `  <div class="${cssClass}">
    <input type="${inputType}" ${opt.checked ? 'checked' : ''} disabled />
    <span>${formatInline(opt.text)}</span>
  </div>\n`;
        }
        optionsHTML += `</div>\n`;
    }
    const promptHTML = node.prompt ? `<div class="edu-question-prompt">${formatInline(node.prompt)}</div>\n` : '';
    const explanationHTML = node.explanation ? `<div class="edu-explanation"><strong>Explicación:</strong> ${formatInline(node.explanation)}</div>\n` : '';
    return `<div class="edu-question">
  ${promptHTML}
  ${optionsHTML}
  ${explanationHTML}
</div>\n`;
}
function renderTable(node) {
    const { rowsCount, colsCount, cells, isRubric } = node;
    if (rowsCount === 0 || colsCount === 0)
        return '';
    const covered = Array.from({ length: rowsCount }, () => Array(colsCount).fill(false));
    let html = `<table class="edu-table${isRubric ? ' rubric' : ''}">\n`;
    for (let r = 0; r < rowsCount; r++) {
        html += `  <tr>\n`;
        for (let c = 0; c < colsCount; c++) {
            if (covered[r][c])
                continue;
            // Find the cell originating at (r, c)
            const cell = cells.find(cell => cell.row === r && cell.column === c);
            if (cell) {
                // Mark spanned grid units as covered
                for (let row = r; row < r + cell.rowspan; row++) {
                    for (let col = c; col < c + cell.colspan; col++) {
                        if (row < rowsCount && col < colsCount) {
                            covered[row][col] = true;
                        }
                    }
                }
                const tag = cell.classes.includes('header') || r === 0 ? 'th' : 'td';
                const rowspanAttr = cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : '';
                const colspanAttr = cell.colspan > 1 ? ` colspan="${cell.colspan}"` : '';
                // Compile classes and styles
                const classList = ['edu-cell', ...cell.classes].join(' ');
                const classAttr = ` class="${escapeHTML(classList)}"`;
                const styleKeys = Object.keys(cell.styles);
                const styleAttr = styleKeys.length > 0
                    ? ` style="${styleKeys.map(k => `${escapeHTML(k)}: ${escapeHTML(cell.styles[k])}`).join('; ')}"`
                    : '';
                // Formatted cell content
                const cellText = cell.content.map(line => formatInline(line)).join('<br/>');
                html += `    <${tag}${rowspanAttr}${colspanAttr}${classAttr}${styleAttr}>${cellText}</${tag}>\n`;
            }
            else {
                // Fallback for missing grid origins
                html += `    <td></td>\n`;
            }
        }
        html += `  </tr>\n`;
    }
    html += `</table>\n`;
    return html;
}
//# sourceMappingURL=renderer.js.map