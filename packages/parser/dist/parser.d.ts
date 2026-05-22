import { DocumentNode } from '@edumark/shared';
export interface ParseError {
    message: string;
    lineNum: number;
    column?: number;
}
export interface ParseResult {
    ast: DocumentNode;
    errors: ParseError[];
}
export declare function parse(source: string): ParseResult;
//# sourceMappingURL=parser.d.ts.map