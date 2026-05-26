import { Token, tokenize } from './lexer.js';
import {
  ASTNode,
  DocumentNode,
  Frontmatter,
  DirectiveBlockNode,
  DirectiveType,
  ListItemNode,
  CodeBlockNode,
  TableNode,
  QuestionNode,
  QuestionOption,
  QuestionType,
  ParagraphNode
} from '@edumark/shared';
import { parseGeometricTable } from './table-parser.js';

export interface ParseError {
  message: string;
  lineNum: number;
  column?: number;
}

export interface ParseResult {
  ast: DocumentNode;
  errors: ParseError[];
}

function parseFrontmatter(lines: string[]): Frontmatter {
  const meta: Frontmatter = {};
  for (const line of lines) {
    const trim = line.trim();
    if (!trim) continue;
    const idx = trim.indexOf(':');
    if (idx !== -1) {
      const k = trim.substring(0, idx).trim();
      const v = trim.substring(idx + 1).trim();
      meta[k] = v;
    }
  }
  return meta;
}

export function parse(source: string): ParseResult {
  const tokens = tokenize(source);
  const errors: ParseError[] = [];
  let tokenIdx = 0;

  // 1. Parse Frontmatter if present
  let frontmatter: Frontmatter = {};
  if (tokens.length > 0 && tokens[0].type === 'FRONTMATTER_BOUNDARY') {
    tokenIdx++; // consume opening '---'
    const fmLines: string[] = [];
    let closed = false;
    while (tokenIdx < tokens.length) {
      const tok = tokens[tokenIdx];
      if (tok.type === 'FRONTMATTER_BOUNDARY') {
        closed = true;
        tokenIdx++; // consume closing '---'
        break;
      } else if (tok.type === 'FRONTMATTER_LINE') {
        fmLines.push(tok.text);
        tokenIdx++;
      } else {
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

  const ast: DocumentNode = {
    type: 'document',
    frontmatter,
    children: astChildren
  };

  return { ast, errors };
}

function parseBlocks(
  tokens: Token[],
  errors: ParseError[],
  state = { idx: 0 },
  parentDirectives: string[] = []
): { nodes: ASTNode[]; closed: boolean } {
  const nodes: ASTNode[] = [];

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
      const codeLines: string[] = [];
      let closed = false;

      while (state.idx < tokens.length) {
        const nextTok = tokens[state.idx];
        if (nextTok.type === 'CODE_BLOCK_TOGGLE') {
          closed = true;
          state.idx++;
          break;
        } else {
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

      nodes.push({
        type: 'code-block',
        language,
        content: codeLines.join('\n')
      });
      continue;
    }

    // Tables
    if (tok.type === 'TABLE_LINE') {
      const tableLines: string[] = [];
      const startLine = tok.lineNum;
      while (state.idx < tokens.length && tokens[state.idx].type === 'TABLE_LINE') {
        tableLines.push(tokens[state.idx].text);
        state.idx++;
      }

      try {
        const tableNode = parseGeometricTable(tableLines.join('\n'));
        if (tableNode.cells.length > 0) {
          nodes.push(tableNode);
        } else {
          errors.push({
            message: 'Estructura de tabla inválida o vacía.',
            lineNum: startLine
          });
        }
      } catch (err: any) {
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
      let checked: boolean | undefined = undefined;
      let content = itemText;

      if (itemText.startsWith('[ ]')) {
        checked = false;
        content = itemText.substring(3).trim();
      } else if (itemText.startsWith('[x]') || itemText.startsWith('[X]')) {
        checked = true;
        content = itemText.substring(3).trim();
      }

      nodes.push({
        type: 'list-item',
        checked,
        content
      } as ListItemNode);
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
      const args: Record<string, string> = {};
      const argPairs = dirArgsStr.split(/\s+/).filter(Boolean);
      for (const pair of argPairs) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx !== -1) {
          args[pair.substring(0, eqIdx).trim()] = pair.substring(eqIdx + 1).trim();
        } else {
          // If just an unkeyed argument, treat as a single flag or accumulate as title
          args['title'] = (args['title'] ? args['title'] + ' ' : '') + pair;
        }
      }

      if (dirName === 'section') {
        const title = dirArgsStr || undefined;
        nodes.push({
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
      
      const { nodes: children, closed: innerClosed } = parseBlocks(
        tokens,
        errors,
        state,
        [...parentDirectives, dirName]
      );

      if (!innerClosed) {
        errors.push({
          message: `Bloque didáctico "@${dirName}" sin cerrar. Se esperaba "@end" o "@end-${dirName}".`,
          lineNum: startLine
        });
      }

      // Handle didactical blocks and questions
      if (dirName === 'question') {
        const questionType = (args['type'] || 'multiple-choice') as QuestionType;
        
        // Extract prompt paragraphs and list options
        let promptLines: string[] = [];
        const options: QuestionOption[] = [];
        let explanation: string | undefined = undefined;

        for (const child of children) {
          if (child.type === 'paragraph') {
            promptLines.push(child.content);
          } else if (child.type === 'list-item') {
            options.push({
              checked: child.checked || false,
              text: child.content
            });
          } else if (child.type === 'directive' && child.name === 'solution') {
            // Extracted from solution block inside question
            const solPara = child.children.find((c: any) => c.type === 'paragraph') as ParagraphNode | undefined;
            if (solPara) {
              explanation = solPara.content;
            }
          }
        }

        nodes.push({
          type: 'question',
          questionType,
          prompt: promptLines.join('\n\n'),
          options,
          explanation
        } as QuestionNode);
      } else {
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

        nodes.push({
          type: 'directive',
          name: dirName as DirectiveType,
          title,
          children
        } as DirectiveBlockNode);
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
        } else {
          state.idx++;
          continue;
        }
      } else if (endText.startsWith('@end-')) {
        const endName = endText.substring(5).trim();
        const foundIdx = parentDirectives.lastIndexOf(endName);
        if (foundIdx !== -1) {
          if (foundIdx === parentDirectives.length - 1) {
            state.idx++;
            return { nodes, closed: true };
          } else {
            // Closed by ancestor, let parent caller handle and consume it
            return { nodes, closed: true };
          }
        } else {
          state.idx++;
          continue;
        }
      }
    }

    // Normal Text Paragraphs
    if (tok.type === 'TEXT_LINE') {
      const paragraphLines: string[] = [];
      while (state.idx < tokens.length && tokens[state.idx].type === 'TEXT_LINE') {
        paragraphLines.push(tokens[state.idx].text);
        state.idx++;
      }
      nodes.push({
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
