export type TokenType =
  | 'FRONTMATTER_BOUNDARY'
  | 'FRONTMATTER_LINE'
  | 'DIRECTIVE_START'
  | 'HIERARCHICAL_DIRECTIVE_START'
  | 'DIRECTIVE_END'
  | 'CODE_BLOCK_TOGGLE'
  | 'TABLE_LINE'
  | 'LIST_ITEM_LINE'
  | 'TEXT_LINE'
  | 'EMPTY_LINE';

export interface Token {
  type: TokenType;
  text: string;
  lineNum: number;
}

export function tokenize(source: string): Token[] {
  const rawLines = source.split(/\r?\n/);
  const tokens: Token[] = [];
  let inFrontmatter = false;
  let inCodeBlock = false;
  let hasFrontmatterStarted = false;

  for (let idx = 0; idx < rawLines.length; idx++) {
    const rawLine = rawLines[idx];
    const line = rawLine.trim();
    const lineNum = idx + 1;

    // Handle code blocks (takes absolute precedence except frontmatter)
    if (line.startsWith('```')) {
      if (!inFrontmatter) {
        inCodeBlock = !inCodeBlock;
        tokens.push({ type: 'CODE_BLOCK_TOGGLE', text: rawLine, lineNum });
        continue;
      }
    }

    if (inCodeBlock) {
      tokens.push({ type: 'TEXT_LINE', text: rawLine, lineNum });
      continue;
    }

    // Handle Frontmatter
    if (line === '---') {
      if (!hasFrontmatterStarted && idx === 0) {
        inFrontmatter = true;
        hasFrontmatterStarted = true;
        tokens.push({ type: 'FRONTMATTER_BOUNDARY', text: line, lineNum });
        continue;
      } else if (inFrontmatter) {
        inFrontmatter = false;
        tokens.push({ type: 'FRONTMATTER_BOUNDARY', text: line, lineNum });
        continue;
      }
    }

    if (inFrontmatter) {
      tokens.push({ type: 'FRONTMATTER_LINE', text: rawLine, lineNum });
      continue;
    }

    // Handle Directive Start
    if (line.startsWith('@') && !line.startsWith('@end') && /^[a-zA-Z]/.test(line.substring(1))) {
      tokens.push({ type: 'DIRECTIVE_START', text: line, lineNum });
      continue;
    }

    // Handle Hierarchical Directive Start (e.g. #page or ##page)
    if (line.startsWith('#')) {
      const hMatch = line.match(/^(#+)([a-zA-Z0-9_\-]+)(.*)$/);
      if (hMatch) {
        tokens.push({ type: 'HIERARCHICAL_DIRECTIVE_START', text: line, lineNum });
        continue;
      }
    }

    // Handle Directive End
    if (/^@end(-[a-zA-Z0-9_\-]+)?$/.test(line)) {
      tokens.push({ type: 'DIRECTIVE_END', text: line, lineNum });
      continue;
    }

    // Handle Tables
    if (line.startsWith('|')) {
      tokens.push({ type: 'TABLE_LINE', text: rawLine, lineNum });
      continue;
    }

    // Handle List Items
    if (line.startsWith('- ')) {
      tokens.push({ type: 'LIST_ITEM_LINE', text: rawLine, lineNum });
      continue;
    }

    // Handle Empty Lines
    if (line === '') {
      tokens.push({ type: 'EMPTY_LINE', text: '', lineNum });
      continue;
    }

    // Otherwise it is normal text line
    tokens.push({ type: 'TEXT_LINE', text: rawLine, lineNum });
  }

  return tokens;
}
