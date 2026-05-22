const fs = require('fs');
const path = require('path');
const { parse } = require('./packages/parser/dist/index.js');
const { formatGeometricTable } = require('./packages/table-engine/dist/index.js');

const filePath = path.resolve('recurso.did');
const source = fs.readFileSync(filePath, 'utf8');

// Parse the AST
const { ast, errors } = parse(source);
if (errors.length > 0) {
  console.error('Errors found in parsing:', errors);
  process.exit(1);
}

// We will find all table nodes in the AST and format them.
// Wait, we need to replace the original table lines in the source file with the formatted table.
// Let's do it by doing a simple line-by-line replacement.
const lines = source.split(/\r?\n/);
const outputLines = [];

let i = 0;
while (i < lines.length) {
  const line = lines[i];
  if (line.trim().startsWith('|')) {
    // Accumulate all table lines
    const tableLines = [];
    while (i < lines.length && lines[i].trim().startsWith('|')) {
      tableLines.push(lines[i]);
      i++;
    }
    const tableStr = tableLines.join('\n');
    try {
      // Parse table node
      const { parseGeometricTable } = require('./packages/table-engine/dist/index.js');
      const isRubric = tableStr.includes('Criterio'); // or whatever heuristic
      const tableNode = parseGeometricTable(tableStr, isRubric);
      const formatted = formatGeometricTable(tableNode);
      outputLines.push(formatted);
      console.log('Formatted a table successfully!');
    } catch (err) {
      console.error('Error formatting table, keeping original:', err);
      outputLines.push(tableStr);
    }
  } else {
    outputLines.push(line);
    i++;
  }
}

fs.writeFileSync(filePath, outputLines.join('\n'), 'utf8');
console.log('Done!');
