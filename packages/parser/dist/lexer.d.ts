export type TokenType = 'FRONTMATTER_BOUNDARY' | 'FRONTMATTER_LINE' | 'DIRECTIVE_START' | 'HIERARCHICAL_DIRECTIVE_START' | 'DIRECTIVE_END' | 'CODE_BLOCK_TOGGLE' | 'TABLE_LINE' | 'LIST_ITEM_LINE' | 'TEXT_LINE' | 'EMPTY_LINE';
export interface Token {
    type: TokenType;
    text: string;
    lineNum: number;
}
export declare function tokenize(source: string): Token[];
//# sourceMappingURL=lexer.d.ts.map