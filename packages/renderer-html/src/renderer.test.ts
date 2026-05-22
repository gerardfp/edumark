import { describe, it, expect } from 'vitest';
import { renderToHTML, formatInline } from './renderer.js';
import { DocumentNode } from '@edumark/shared';

describe('Edumark HTML Renderer - Inline Formatting', () => {
  it('should convert bold, italic, code and link Markdown structures', () => {
    const raw = 'Este es un texto **negrita** y *cursiva* con `codigo` y un [enlace](https://google.com).';
    const formatted = formatInline(raw);
    
    expect(formatted).toContain('<strong>negrita</strong>');
    expect(formatted).toContain('<em>cursiva</em>');
    expect(formatted).toContain('<code class="edu-inline-code">codigo</code>');
    expect(formatted).toContain('<a href="https://google.com" target="_blank" class="edu-link">enlace</a>');
  });
});

describe('Edumark HTML Renderer - Block Rendering', () => {
  it('should render an AST containing cards and tables into a fully styled HTML document', () => {
    const doc: DocumentNode = {
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

    const html = renderToHTML(doc);

    // Verify Frontmatter title and metadata
    expect(html).toContain('Introducción a RSA');
    expect(html).toContain('Gerard Falco');
    
    // Verify didyouknow card
    expect(html).toContain('class="edu-card didyouknow"');
    expect(html).toContain('💡');
    expect(html).toContain('¿Sabías que...? — RSA 1977');
    expect(html).toContain('RSA fue diseñado en 1977.');
    
    // Verify table structure with colspan
    expect(html).toContain('<table class="edu-table">');
    expect(html).toContain('<th colspan="2" class="edu-cell header">Encabezado Completo</th>');
    expect(html).toContain('<td class="edu-cell" style="color: red">A</td>');
  });
});
