export interface Frontmatter {
  title?: string;
  author?: string;
  level?: string;
  [key: string]: any;
}

export type ASTNode =
  | DocumentNode
  | ParagraphNode
  | DirectiveBlockNode
  | TableNode
  | QuestionNode
  | ListItemNode
  | CodeBlockNode;

export interface DocumentNode {
  type: 'document';
  frontmatter: Frontmatter;
  children: ASTNode[];
}

export interface ParagraphNode {
  type: 'paragraph';
  content: string; // contains raw text with inline formatting
}

export type DirectiveType = string;

export interface DirectiveBlockNode {
  type: 'directive';
  name: DirectiveType;
  title?: string; // e.g. for @section title, or @didyouknow Custom Title
  children: ASTNode[];
}

export interface ListItemNode {
  type: 'list-item';
  checked?: boolean; // null/undefined if not a checklist item, false for [ ], true for [x]
  content: string;
}

export interface CodeBlockNode {
  type: 'code-block';
  language?: string;
  content: string;
}

// Question types: multiple-choice, true-false, open
export type QuestionType = 'multiple-choice' | 'true-false' | 'open';

export interface QuestionOption {
  checked: boolean;
  text: string;
}

export interface QuestionNode {
  type: 'question';
  questionType: QuestionType;
  prompt: string;
  options: QuestionOption[]; // for multiple-choice/true-false
  explanation?: string; // optional @solution content inside or attributes
}

// Geometric Table Representation
export interface TableCell {
  id: string;
  row: number;       // Grid row index (0-based)
  column: number;    // Grid column index (0-based)
  rowspan: number;
  colspan: number;
  content: string[]; // Content lines inside the cell
  classes: string[];
  styles: Record<string, string>;
}

export interface TableNode {
  type: 'table';
  rowsCount: number;
  colsCount: number;
  cells: TableCell[];
  isRubric?: boolean; // set if parsed within @rubric block
  colWidths?: number[];
}
