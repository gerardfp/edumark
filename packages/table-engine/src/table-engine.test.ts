import { describe, it, expect } from 'vitest';
import { parseGeometricTable } from './table-parser.js';
import { formatGeometricTable } from './table-formatter.js';

describe('Table Engine - Geometric Parser', () => {
  it('should parse a simple 2x2 ASCII table', () => {
    const tableStr = `
|-------|-------|
| A     | B     |
|-------|-------|
| C     | D     |
|-------|-------|
`.trim();

    const table = parseGeometricTable(tableStr);
    expect(table.rowsCount).toBe(2);
    expect(table.colsCount).toBe(2);
    expect(table.cells.length).toBe(4);

    const cellA = table.cells.find(c => c.row === 0 && c.column === 0);
    expect(cellA).toBeDefined();
    expect(cellA?.content).toEqual(['A']);
    expect(cellA?.colspan).toBe(1);
    expect(cellA?.rowspan).toBe(1);
  });

  it('should parse complex colspan and rowspan geometrically', () => {
    const tableStr = `
|--------------------|----------|
| nombre | apellidos | profesor |
|--------|-----------|----------|
| Gerard | Falco     | Sí       |
|--------|-----------|          |
| gerardfalco@edu.es |          |
|--------------------|----------|
`.trim();

    const table = parseGeometricTable(tableStr);
    expect(table.rowsCount).toBe(3);
    expect(table.colsCount).toBe(3);

    // Cell at bottom left "gerardfalco@edu.es" has colspan = 2
    const cellEmail = table.cells.find(c => c.content[0] === 'gerardfalco@edu.es');
    expect(cellEmail).toBeDefined();
    expect(cellEmail?.row).toBe(2);
    expect(cellEmail?.column).toBe(0);
    expect(cellEmail?.colspan).toBe(2);
    expect(cellEmail?.rowspan).toBe(1);

    // Cell at right "profesor / Sí" has rowspan = 2 (row 1 & 2)
    const cellProf = table.cells.find(c => c.content[0] === 'Sí');
    expect(cellProf).toBeDefined();
    expect(cellProf?.row).toBe(1);
    expect(cellProf?.column).toBe(2);
    expect(cellProf?.colspan).toBe(1);
    expect(cellProf?.rowspan).toBe(2);
  });

  it('should parse cell classes and styles from metadata block', () => {
    const tableStr = `
|------------------------|
|{.header; color: blue}  |
| Contenido              |
|------------------------|
`.trim();

    const table = parseGeometricTable(tableStr);
    expect(table.cells.length).toBe(1);
    const cell = table.cells[0];
    expect(cell.classes).toEqual(['header']);
    expect(cell.styles).toEqual({ color: 'blue' });
    expect(cell.content).toEqual(['Contenido']);
  });
});

describe('Table Engine - Formatter', () => {
  it('should format simple tables matching original structure', () => {
    const tableStr = `
|-------|-------|
| A     | B     |
|-------|-------|
| C     | D     |
|-------|-------|
`.trim();

    const parsed = parseGeometricTable(tableStr);
    const formatted = formatGeometricTable(parsed);
    const expected = `
|---|---|
| A | B |
|---|---|
| C | D |
|---|---|
`.trim();
    expect(formatted).toBe(expected);
  });

  it('should format complex tables preserving geometric properties', () => {
    const tableStr = `
|--------------------|----------|
| nombre | apellidos | profesor |
|--------|-----------|----------|
| Gerard | Falco     | Sí       |
|--------|-----------|          |
| gerardfalco@edu.es |          |
|--------------------|----------|
`.trim();

    const parsed = parseGeometricTable(tableStr);
    const formatted = formatGeometricTable(parsed);
    
    // Check that there is no horizontal separator inside the rowspan cell
    const lines = formatted.split('\n');
    // Line corresponding to border row 4 should have spaces at the profesor column
    expect(lines[4]).toContain('          |');
    
    // Check that email cell has colspan 2 (no separator between name/apellidos cols)
    expect(lines[5]).toContain('gerardfalco@edu.es');
  });

  it('should dynamically expand column widths if content exceeds the limit instead of wrapping', () => {
    const tableStr = `
|-------|-------|
| A very long line is here | Short |
|-------|-------|
`.trim();

    const parsed = parseGeometricTable(tableStr);
    const formatted = formatGeometricTable(parsed);

    const expected = `
|--------------------------|-------|
| A very long line is here | Short |
|--------------------------|-------|
`.trim();

    expect(formatted).toBe(expected);
  });

  it('should dynamically expand column width for long words typed without spaces', () => {
    const tableStr = `
|-------|
| hola  |
|-------|
`.trim();

    const parsed = parseGeometricTable(tableStr);
    // Manually update the cell content to simulate typing 'adios' after 'hola' without spaces
    const cell = parsed.cells[0];
    cell.content = ['holaadios'];

    const formatted = formatGeometricTable(parsed);

    const expected = `
|-----------|
| holaadios |
|-----------|
`.trim();

    expect(formatted).toBe(expected);
  });

  it('should handle progressive typing of long word by expanding column dynamically instead of wrapping', () => {
    const tableStr = `
|-------|
| holaa |
| d     |
|-------|
`.trim();

    const parsed = parseGeometricTable(tableStr);
    const cell = parsed.cells[0];
    // Simulating user typing 'i' on the first line (so the first line becomes 'holaai')
    cell.content = ['holaai', 'd'];

    const formatted = formatGeometricTable(parsed);

    const expected = `
|--------|
| holaai |
| d      |
|--------|
`.trim();

    expect(formatted).toBe(expected);
  });

  it('should dynamically shrink column width when characters are deleted', () => {
    const tableStr = `
|-----------|
| holaadios |
|-----------|
`.trim();

    const parsed = parseGeometricTable(tableStr);
    // Simulating deleting 'adios' from 'holaadios' to get 'hola'
    const cell = parsed.cells[0];
    cell.content = ['hola'];

    const formatted = formatGeometricTable(parsed);

    const expected = `
|------|
| hola |
|------|
`.trim();

    expect(formatted).toBe(expected);
  });

  it('should simplify table with redundant column boundaries (Case 1 from table_simplify)', () => {
    const tableStr = `
|---|---|
| A     |
|---|---|
`.trim();

    const parsed = parseGeometricTable(tableStr);
    const formatted = formatGeometricTable(parsed);

    const expected = `
|---|
| A |
|---|
`.trim();

    expect(formatted).toBe(expected);
  });

  it('should simplify table with redundant column boundaries (Case 2 from table_simplify)', () => {
    const tableStr = `
|---|---|---|
| A         |
|---|---|---|
|   |       |
|---|---|---|
`.trim();

    const parsed = parseGeometricTable(tableStr);
    const formatted = formatGeometricTable(parsed);

    const expected = `
|---|---|
| A     |
|---|---|
|   |   |
|---|---|
`.trim();

    expect(formatted).toBe(expected);
  });
});
