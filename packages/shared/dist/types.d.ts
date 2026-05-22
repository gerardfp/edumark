export interface Frontmatter {
    title?: string;
    author?: string;
    level?: string;
    [key: string]: any;
}
export type ASTNode = DocumentNode | ParagraphNode | DirectiveBlockNode | TableNode | QuestionNode | ListItemNode | CodeBlockNode;
export interface DocumentNode {
    type: 'document';
    frontmatter: Frontmatter;
    children: ASTNode[];
}
export interface ParagraphNode {
    type: 'paragraph';
    content: string;
}
export type DirectiveType = 'didyouknow' | 'warning' | 'hint' | 'solution' | 'reflection' | 'activity' | 'note' | 'section';
export interface DirectiveBlockNode {
    type: 'directive';
    name: DirectiveType;
    title?: string;
    children: ASTNode[];
}
export interface ListItemNode {
    type: 'list-item';
    checked?: boolean;
    content: string;
}
export interface CodeBlockNode {
    type: 'code-block';
    language?: string;
    content: string;
}
export type QuestionType = 'multiple-choice' | 'true-false' | 'open';
export interface QuestionOption {
    checked: boolean;
    text: string;
}
export interface QuestionNode {
    type: 'question';
    questionType: QuestionType;
    prompt: string;
    options: QuestionOption[];
    explanation?: string;
}
export interface TableCell {
    id: string;
    row: number;
    column: number;
    rowspan: number;
    colspan: number;
    content: string[];
    classes: string[];
    styles: Record<string, string>;
}
export interface TableNode {
    type: 'table';
    rowsCount: number;
    colsCount: number;
    cells: TableCell[];
    isRubric?: boolean;
    colWidths?: number[];
}
//# sourceMappingURL=types.d.ts.map