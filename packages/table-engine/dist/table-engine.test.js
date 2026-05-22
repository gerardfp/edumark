"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const table_parser_js_1 = require("./table-parser.js");
const table_formatter_js_1 = require("./table-formatter.js");
(0, vitest_1.describe)('Table Engine - Geometric Parser', () => {
    (0, vitest_1.it)('should parse a simple 2x2 ASCII table', () => {
        const tableStr = `
|-------|-------|
| A     | B     |
|-------|-------|
| C     | D     |
|-------|-------|
`.trim();
        const table = (0, table_parser_js_1.parseGeometricTable)(tableStr);
        (0, vitest_1.expect)(table.rowsCount).toBe(2);
        (0, vitest_1.expect)(table.colsCount).toBe(2);
        (0, vitest_1.expect)(table.cells.length).toBe(4);
        const cellA = table.cells.find(c => c.row === 0 && c.column === 0);
        (0, vitest_1.expect)(cellA).toBeDefined();
        (0, vitest_1.expect)(cellA?.content).toEqual(['A']);
        (0, vitest_1.expect)(cellA?.colspan).toBe(1);
        (0, vitest_1.expect)(cellA?.rowspan).toBe(1);
    });
    (0, vitest_1.it)('should parse complex colspan and rowspan geometrically', () => {
        const tableStr = `
|--------------------|----------|
| nombre | apellidos | profesor |
|--------|-----------|----------|
| Gerard | Falco     | Sí       |
|--------|-----------|          |
| gerardfalco@edu.es |          |
|--------------------|----------|
`.trim();
        const table = (0, table_parser_js_1.parseGeometricTable)(tableStr);
        (0, vitest_1.expect)(table.rowsCount).toBe(3);
        (0, vitest_1.expect)(table.colsCount).toBe(3);
        // Cell at bottom left "gerardfalco@edu.es" has colspan = 2
        const cellEmail = table.cells.find(c => c.content[0] === 'gerardfalco@edu.es');
        (0, vitest_1.expect)(cellEmail).toBeDefined();
        (0, vitest_1.expect)(cellEmail?.row).toBe(2);
        (0, vitest_1.expect)(cellEmail?.column).toBe(0);
        (0, vitest_1.expect)(cellEmail?.colspan).toBe(2);
        (0, vitest_1.expect)(cellEmail?.rowspan).toBe(1);
        // Cell at right "profesor / Sí" has rowspan = 2 (row 1 & 2)
        const cellProf = table.cells.find(c => c.content[0] === 'Sí');
        (0, vitest_1.expect)(cellProf).toBeDefined();
        (0, vitest_1.expect)(cellProf?.row).toBe(1);
        (0, vitest_1.expect)(cellProf?.column).toBe(2);
        (0, vitest_1.expect)(cellProf?.colspan).toBe(1);
        (0, vitest_1.expect)(cellProf?.rowspan).toBe(2);
    });
    (0, vitest_1.it)('should parse cell classes and styles from metadata block', () => {
        const tableStr = `
|------------------------|
|{.header; color: blue}  |
| Contenido              |
|------------------------|
`.trim();
        const table = (0, table_parser_js_1.parseGeometricTable)(tableStr);
        (0, vitest_1.expect)(table.cells.length).toBe(1);
        const cell = table.cells[0];
        (0, vitest_1.expect)(cell.classes).toEqual(['header']);
        (0, vitest_1.expect)(cell.styles).toEqual({ color: 'blue' });
        (0, vitest_1.expect)(cell.content).toEqual(['Contenido']);
    });
});
(0, vitest_1.describe)('Table Engine - Formatter', () => {
    (0, vitest_1.it)('should format simple tables matching original structure', () => {
        const tableStr = `
|-------|-------|
| A     | B     |
|-------|-------|
| C     | D     |
|-------|-------|
`.trim();
        const parsed = (0, table_parser_js_1.parseGeometricTable)(tableStr);
        const formatted = (0, table_formatter_js_1.formatGeometricTable)(parsed);
        const expected = `
|---|---|
| A | B |
|---|---|
| C | D |
|---|---|
`.trim();
        (0, vitest_1.expect)(formatted).toBe(expected);
    });
    (0, vitest_1.it)('should format complex tables preserving geometric properties', () => {
        const tableStr = `
|--------------------|----------|
| nombre | apellidos | profesor |
|--------|-----------|----------|
| Gerard | Falco     | Sí       |
|--------|-----------|          |
| gerardfalco@edu.es |          |
|--------------------|----------|
`.trim();
        const parsed = (0, table_parser_js_1.parseGeometricTable)(tableStr);
        const formatted = (0, table_formatter_js_1.formatGeometricTable)(parsed);
        // Check that there is no horizontal separator inside the rowspan cell
        const lines = formatted.split('\n');
        // Line corresponding to border row 4 should have spaces at the profesor column
        (0, vitest_1.expect)(lines[4]).toContain('          |');
        // Check that email cell has colspan 2 (no separator between name/apellidos cols)
        (0, vitest_1.expect)(lines[5]).toContain('gerardfalco@edu.es');
    });
    (0, vitest_1.it)('should dynamically expand column widths if content exceeds the limit instead of wrapping', () => {
        const tableStr = `
|-------|-------|
| A very long line is here | Short |
|-------|-------|
`.trim();
        const parsed = (0, table_parser_js_1.parseGeometricTable)(tableStr);
        const formatted = (0, table_formatter_js_1.formatGeometricTable)(parsed);
        const expected = `
|--------------------------|-------|
| A very long line is here | Short |
|--------------------------|-------|
`.trim();
        (0, vitest_1.expect)(formatted).toBe(expected);
    });
    (0, vitest_1.it)('should dynamically expand column width for long words typed without spaces', () => {
        const tableStr = `
|-------|
| hola  |
|-------|
`.trim();
        const parsed = (0, table_parser_js_1.parseGeometricTable)(tableStr);
        // Manually update the cell content to simulate typing 'adios' after 'hola' without spaces
        const cell = parsed.cells[0];
        cell.content = ['holaadios'];
        const formatted = (0, table_formatter_js_1.formatGeometricTable)(parsed);
        const expected = `
|-----------|
| holaadios |
|-----------|
`.trim();
        (0, vitest_1.expect)(formatted).toBe(expected);
    });
    (0, vitest_1.it)('should handle progressive typing of long word by expanding column dynamically instead of wrapping', () => {
        const tableStr = `
|-------|
| holaa |
| d     |
|-------|
`.trim();
        const parsed = (0, table_parser_js_1.parseGeometricTable)(tableStr);
        const cell = parsed.cells[0];
        // Simulating user typing 'i' on the first line (so the first line becomes 'holaai')
        cell.content = ['holaai', 'd'];
        const formatted = (0, table_formatter_js_1.formatGeometricTable)(parsed);
        const expected = `
|--------|
| holaai |
| d      |
|--------|
`.trim();
        (0, vitest_1.expect)(formatted).toBe(expected);
    });
    (0, vitest_1.it)('should dynamically shrink column width when characters are deleted', () => {
        const tableStr = `
|-----------|
| holaadios |
|-----------|
`.trim();
        const parsed = (0, table_parser_js_1.parseGeometricTable)(tableStr);
        // Simulating deleting 'adios' from 'holaadios' to get 'hola'
        const cell = parsed.cells[0];
        cell.content = ['hola'];
        const formatted = (0, table_formatter_js_1.formatGeometricTable)(parsed);
        const expected = `
|------|
| hola |
|------|
`.trim();
        (0, vitest_1.expect)(formatted).toBe(expected);
    });
});
//# sourceMappingURL=table-engine.test.js.map