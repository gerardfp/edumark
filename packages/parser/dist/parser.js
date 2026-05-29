"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = parse;
const lexer_js_1 = require("./lexer.js");
const table_parser_js_1 = require("./table-parser.js");
function parseFrontmatter(lines) {
    const meta = {};
    for (const line of lines) {
        const trim = line.trim();
        if (!trim)
            continue;
        const idx = trim.indexOf(':');
        if (idx !== -1) {
            const k = trim.substring(0, idx).trim();
            const v = trim.substring(idx + 1).trim();
            meta[k] = v;
        }
    }
    return meta;
}
function parse(source) {
    const tokens = (0, lexer_js_1.tokenize)(source);
    const errors = [];
    let tokenIdx = 0;
    // 1. Parse Frontmatter if present
    let frontmatter = {};
    if (tokens.length > 0 && tokens[0].type === 'FRONTMATTER_BOUNDARY') {
        tokenIdx++; // consume opening '---'
        const fmLines = [];
        let closed = false;
        while (tokenIdx < tokens.length) {
            const tok = tokens[tokenIdx];
            if (tok.type === 'FRONTMATTER_BOUNDARY') {
                closed = true;
                tokenIdx++; // consume closing '---'
                break;
            }
            else if (tok.type === 'FRONTMATTER_LINE') {
                fmLines.push(tok.text);
                tokenIdx++;
            }
            else {
                // malformed frontmatter, but let's accept it
                fmLines.push(tok.text);
                tokenIdx++;
            }
        }
        if (!closed) {
            errors.push({
                message: 'Frontmatter sin cerrar. Se esperaba "---".',
                lineNum: tokens[0].lineNum
            });
        }
        frontmatter = parseFrontmatter(fmLines);
    }
    // 2. Parse Blocks recursively
    const { nodes: astChildren } = parseBlocks(tokens.slice(tokenIdx), errors);
    const ast = {
        type: 'document',
        frontmatter,
        children: astChildren
    };
    return { ast, errors };
}
function parseBlocks(tokens, errors, state = { idx: 0 }, parentDirectives = []) {
    const nodes = [];
    const hStack = [];
    function addNode(node) {
        if (hStack.length > 0) {
            hStack[hStack.length - 1].node.children.push(node);
        }
        else {
            nodes.push(node);
        }
    }
    while (state.idx < tokens.length) {
        const tok = tokens[state.idx];
        if (tok.type === 'EMPTY_LINE') {
            state.idx++;
            continue;
        }
        // Code Blocks
        if (tok.type === 'CODE_BLOCK_TOGGLE') {
            const startLine = tok.lineNum;
            // Extract language if specified: ```typescript -> typescript
            const langMatch = tok.text.trim().match(/^```([a-zA-Z0-9+\-#_]+)?/);
            const language = langMatch ? langMatch[1] : undefined;
            state.idx++;
            const codeLines = [];
            let closed = false;
            while (state.idx < tokens.length) {
                const nextTok = tokens[state.idx];
                if (nextTok.type === 'CODE_BLOCK_TOGGLE') {
                    closed = true;
                    state.idx++;
                    break;
                }
                else {
                    codeLines.push(nextTok.text);
                    state.idx++;
                }
            }
            if (!closed) {
                errors.push({
                    message: 'Bloque de código sin cerrar con "```".',
                    lineNum: startLine
                });
            }
            addNode({
                type: 'code-block',
                language,
                content: codeLines.join('\n')
            });
            continue;
        }
        // Tables
        if (tok.type === 'TABLE_LINE') {
            const tableLines = [];
            const startLine = tok.lineNum;
            while (state.idx < tokens.length && tokens[state.idx].type === 'TABLE_LINE') {
                tableLines.push(tokens[state.idx].text);
                state.idx++;
            }
            try {
                const tableNode = (0, table_parser_js_1.parseGeometricTable)(tableLines.join('\n'));
                if (tableNode.cells.length > 0) {
                    addNode(tableNode);
                }
                else {
                    errors.push({
                        message: 'Estructura de tabla inválida o vacía.',
                        lineNum: startLine
                    });
                }
            }
            catch (err) {
                errors.push({
                    message: `Error al procesar la tabla geométrica: ${err.message}`,
                    lineNum: startLine
                });
            }
            continue;
        }
        // List Items
        if (tok.type === 'LIST_ITEM_LINE') {
            const itemText = tok.text.trim().substring(2); // remove "- "
            let checked = undefined;
            let content = itemText;
            if (itemText.startsWith('[ ]')) {
                checked = false;
                content = itemText.substring(3).trim();
            }
            else if (itemText.startsWith('[x]') || itemText.startsWith('[X]')) {
                checked = true;
                content = itemText.substring(3).trim();
            }
            addNode({
                type: 'list-item',
                checked,
                content
            });
            state.idx++;
            continue;
        }
        // Hierarchical Directives
        if (tok.type === 'HIERARCHICAL_DIRECTIVE_START') {
            const lineText = tok.text.trim();
            const match = lineText.match(/^([#>%]+)(?:([a-zA-Z0-9_\-]+))?(?:\s+(.*))?$/);
            if (match) {
                const hashes = match[1];
                const dirName = match[2] || 'generic';
                const dirArgsStr = (match[3] || '').trim();
                const level = hashes.length;
                const title = dirArgsStr || undefined;
                const node = {
                    type: 'directive',
                    name: dirName,
                    title,
                    children: []
                };
                // Unwind hStack for any level >= new level
                while (hStack.length > 0 && hStack[hStack.length - 1].level >= level) {
                    hStack.pop();
                }
                if (hStack.length > 0) {
                    hStack[hStack.length - 1].node.children.push(node);
                }
                else {
                    nodes.push(node);
                }
                hStack.push({ node, level });
            }
            state.idx++;
            continue;
        }
        // Directives
        if (tok.type === 'DIRECTIVE_START') {
            const startLine = tok.lineNum;
            const lineText = tok.text.trim();
            // Parse name and arguments e.g. @question type=multiple-choice
            const match = lineText.match(/^@([a-zA-Z0-9_\-]+)(.*)$/);
            if (!match) {
                state.idx++;
                continue;
            }
            const dirName = match[1];
            const dirArgsStr = match[2].trim();
            // Parse arguments like key=value
            const args = {};
            const argPairs = dirArgsStr.split(/\s+/).filter(Boolean);
            for (const pair of argPairs) {
                const eqIdx = pair.indexOf('=');
                if (eqIdx !== -1) {
                    args[pair.substring(0, eqIdx).trim()] = pair.substring(eqIdx + 1).trim();
                }
                else {
                    // If just an unkeyed argument, treat as a single flag or accumulate as title
                    args['title'] = (args['title'] ? args['title'] + ' ' : '') + pair;
                }
            }
            if (dirName === 'section') {
                const title = dirArgsStr || undefined;
                addNode({
                    type: 'directive',
                    name: 'section',
                    title,
                    children: []
                });
                state.idx++;
                continue;
            }
            // We are entering a didactical block / question
            state.idx++; // consume the DIRECTIVE_START token
            const { nodes: children, closed: innerClosed } = parseBlocks(tokens, errors, state, [...parentDirectives, dirName]);
            if (!innerClosed) {
                errors.push({
                    message: `Bloque didáctico "@${dirName}" sin cerrar. Se esperaba "@end" o "@end-${dirName}".`,
                    lineNum: startLine
                });
            }
            // Handle didactical blocks and questions
            if (dirName === 'question') {
                const questionType = (args['type'] || 'multiple-choice');
                // Extract prompt paragraphs and list options
                let promptLines = [];
                const options = [];
                let explanation = undefined;
                for (const child of children) {
                    if (child.type === 'paragraph') {
                        promptLines.push(child.content);
                    }
                    else if (child.type === 'list-item') {
                        options.push({
                            checked: child.checked || false,
                            text: child.content
                        });
                    }
                    else if (child.type === 'directive' && child.name === 'solution') {
                        // Extracted from solution block inside question
                        const solPara = child.children.find((c) => c.type === 'paragraph');
                        if (solPara) {
                            explanation = solPara.content;
                        }
                    }
                }
                addNode({
                    type: 'question',
                    questionType,
                    prompt: promptLines.join('\n\n'),
                    options,
                    explanation
                });
            }
            else {
                // Standard didactical block
                const title = dirArgsStr || undefined;
                // If block is a rubric, flag internal table as rubric table
                if (dirName === 'rubric') {
                    for (const child of children) {
                        if (child.type === 'table') {
                            child.isRubric = true;
                        }
                    }
                }
                addNode({
                    type: 'directive',
                    name: dirName,
                    title,
                    children
                });
            }
            continue;
        }
        // Directives closing
        if (tok.type === 'DIRECTIVE_END') {
            const endText = tok.text.trim();
            if (endText === '@end') {
                if (parentDirectives.length > 0) {
                    state.idx++;
                    return { nodes, closed: true };
                }
                else {
                    state.idx++;
                    continue;
                }
            }
            else if (endText.startsWith('@end-')) {
                const endName = endText.substring(5).trim();
                const foundIdx = parentDirectives.lastIndexOf(endName);
                if (foundIdx !== -1) {
                    if (foundIdx === parentDirectives.length - 1) {
                        state.idx++;
                        return { nodes, closed: true };
                    }
                    else {
                        // Closed by ancestor, let parent caller handle and consume it
                        return { nodes, closed: true };
                    }
                }
                else {
                    state.idx++;
                    continue;
                }
            }
        }
        // Normal Text Paragraphs
        if (tok.type === 'TEXT_LINE') {
            const paragraphLines = [];
            while (state.idx < tokens.length && tokens[state.idx].type === 'TEXT_LINE') {
                paragraphLines.push(tokens[state.idx].text);
                state.idx++;
            }
            addNode({
                type: 'paragraph',
                content: paragraphLines.join('\n')
            });
            continue;
        }
        // Fallback
        state.idx++;
    }
    return { nodes, closed: false };
}
//# sourceMappingURL=parser.js.map