"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const renderer_js_1 = require("./renderer.js");
(0, vitest_1.describe)('Edumark HTML Renderer - Inline Formatting', () => {
    (0, vitest_1.it)('should convert bold, italic, code and link Markdown structures', () => {
        const raw = 'Este es un texto **negrita** y *cursiva* con `codigo` y un [enlace](https://google.com).';
        const formatted = (0, renderer_js_1.formatInline)(raw);
        (0, vitest_1.expect)(formatted).toContain('<strong>negrita</strong>');
        (0, vitest_1.expect)(formatted).toContain('<em>cursiva</em>');
        (0, vitest_1.expect)(formatted).toContain('<code class="edu-inline-code">codigo</code>');
        (0, vitest_1.expect)(formatted).toContain('<a href="https://google.com" target="_blank" class="edu-link">enlace</a>');
    });
});
(0, vitest_1.describe)('Edumark HTML Renderer - Block Rendering', () => {
    (0, vitest_1.it)('should render an AST containing cards and tables into a fully styled HTML document', () => {
        const doc = {
            type: 'document',
            frontmatter: {
                title: 'Introducción a RSA',
                author: 'Gerard Falco',
                level: 'Secundaria'
            },
            children: [
                {
                    type: 'directive',
                    name: 'didyouknow',
                    title: 'RSA 1977',
                    children: [
                        {
                            type: 'paragraph',
                            content: 'RSA fue diseñado en 1977.'
                        }
                    ]
                },
                {
                    type: 'table',
                    rowsCount: 2,
                    colsCount: 2,
                    cells: [
                        {
                            id: 'cell-1',
                            row: 0,
                            column: 0,
                            rowspan: 1,
                            colspan: 2,
                            content: ['Encabezado Completo'],
                            classes: ['header'],
                            styles: {}
                        },
                        {
                            id: 'cell-2',
                            row: 1,
                            column: 0,
                            rowspan: 1,
                            colspan: 1,
                            content: ['A'],
                            classes: [],
                            styles: { color: 'red' }
                        },
                        {
                            id: 'cell-3',
                            row: 1,
                            column: 1,
                            rowspan: 1,
                            colspan: 1,
                            content: ['B'],
                            classes: [],
                            styles: {}
                        }
                    ]
                }
            ]
        };
        const html = (0, renderer_js_1.renderToHTML)(doc);
        // Verify Frontmatter title and metadata
        (0, vitest_1.expect)(html).toContain('Introducción a RSA');
        (0, vitest_1.expect)(html).toContain('Gerard Falco');
        // Verify didyouknow card
        (0, vitest_1.expect)(html).toContain('class="edu-card didyouknow"');
        (0, vitest_1.expect)(html).toContain('💡');
        (0, vitest_1.expect)(html).toContain('¿Sabías que...? — RSA 1977');
        (0, vitest_1.expect)(html).toContain('RSA fue diseñado en 1977.');
        // Verify table structure with colspan
        (0, vitest_1.expect)(html).toContain('<table class="edu-table">');
        (0, vitest_1.expect)(html).toContain('<th colspan="2" class="edu-cell header">Encabezado Completo</th>');
        (0, vitest_1.expect)(html).toContain('<td class="edu-cell" style="color: red">A</td>');
    });
});
//# sourceMappingURL=renderer.test.js.map