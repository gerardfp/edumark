"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const parser_js_1 = require("./parser.js");
(0, vitest_1.describe)('Edumark Parser', () => {
    (0, vitest_1.it)('should parse frontmatter and basic didactical directives', () => {
        const source = `
---
title: Criptografía RSA
level: secondary
---

@section Introducción

Este es un recurso educativo sobre RSA.

@didyouknow Title=RSA
El cifrado RSA fue inventado en 1977.
@end
`.trim();
        const { ast, errors } = (0, parser_js_1.parse)(source);
        (0, vitest_1.expect)(errors.length).toBe(0);
        (0, vitest_1.expect)(ast.frontmatter).toEqual({
            title: 'Criptografía RSA',
            level: 'secondary'
        });
        (0, vitest_1.expect)(ast.children.length).toBe(3);
        (0, vitest_1.expect)(ast.children[0]).toEqual({
            type: 'directive',
            name: 'section',
            title: 'Introducción',
            children: []
        });
        const didYouKnowNode = ast.children[2];
        (0, vitest_1.expect)(didYouKnowNode.type).toBe('directive');
        (0, vitest_1.expect)(didYouKnowNode.name).toBe('didyouknow');
        (0, vitest_1.expect)(didYouKnowNode.title).toBe('Title=RSA');
        (0, vitest_1.expect)(didYouKnowNode.children.length).toBe(1);
        (0, vitest_1.expect)(didYouKnowNode.children[0].type).toBe('paragraph');
        (0, vitest_1.expect)(didYouKnowNode.children[0].content).toContain('cifrado RSA fue inventado');
    });
    (0, vitest_1.it)('should parse questions and extract prompt, options and explanation', () => {
        const source = `
@question type=multiple-choice
¿Cuál es la clave pública en RSA?

- [ ] p y q
- [x] e y n
- [ ] d

@solution
La clave pública está compuesta por el exponente e y el módulo n.
@end
@end
`.trim();
        const { ast, errors } = (0, parser_js_1.parse)(source);
        (0, vitest_1.expect)(errors.length).toBe(0);
        (0, vitest_1.expect)(ast.children.length).toBe(1);
        const questionNode = ast.children[0];
        (0, vitest_1.expect)(questionNode.type).toBe('question');
        (0, vitest_1.expect)(questionNode.questionType).toBe('multiple-choice');
        (0, vitest_1.expect)(questionNode.prompt).toBe('¿Cuál es la clave pública en RSA?');
        (0, vitest_1.expect)(questionNode.options).toEqual([
            { checked: false, text: 'p y q' },
            { checked: true, text: 'e y n' },
            { checked: false, text: 'd' }
        ]);
        (0, vitest_1.expect)(questionNode.explanation).toContain('La clave pública está compuesta por');
    });
    (0, vitest_1.it)('should parse specific @end-name closing tags and handle nested stacks correctly', () => {
        const source = `
@didyouknow
Este es un bloque didactico.
@warning
Cuidado con esta alerta.
@end-warning
Texto intermedio.
@end-didyouknow
`.trim();
        const { ast, errors } = (0, parser_js_1.parse)(source);
        console.log("DEBUG ERRORS:", errors);
        (0, vitest_1.expect)(errors.length).toBe(0);
        (0, vitest_1.expect)(ast.children.length).toBe(1);
        const didYouKnowNode = ast.children[0];
        (0, vitest_1.expect)(didYouKnowNode.type).toBe('directive');
        (0, vitest_1.expect)(didYouKnowNode.name).toBe('didyouknow');
        (0, vitest_1.expect)(didYouKnowNode.children.length).toBe(3);
        (0, vitest_1.expect)(didYouKnowNode.children[0].content).toContain('Este es un bloque didactico.');
        (0, vitest_1.expect)(didYouKnowNode.children[1].type).toBe('directive');
        (0, vitest_1.expect)(didYouKnowNode.children[1].name).toBe('warning');
        (0, vitest_1.expect)(didYouKnowNode.children[2].content).toContain('Texto intermedio.');
    });
    (0, vitest_1.it)('should close inner blocks implicitly when outer specific @end-name is used', () => {
        const source = `
@didyouknow
Este es un bloque didactico.
@warning
Cuidado con esta alerta sin cerrar explicitamente.
@end-didyouknow
`.trim();
        const { ast, errors } = (0, parser_js_1.parse)(source);
        (0, vitest_1.expect)(errors.length).toBe(0);
        (0, vitest_1.expect)(ast.children.length).toBe(1);
        const didYouKnowNode = ast.children[0];
        (0, vitest_1.expect)(didYouKnowNode.type).toBe('directive');
        (0, vitest_1.expect)(didYouKnowNode.children.length).toBe(2);
        (0, vitest_1.expect)(didYouKnowNode.children[1].name).toBe('warning');
    });
    (0, vitest_1.it)('should report an error for missing @end tag', () => {
        const source = `
@warning
Cuidado con los números primos pequeños.
`.trim();
        const { ast, errors } = (0, parser_js_1.parse)(source);
        (0, vitest_1.expect)(errors.length).toBe(1);
        (0, vitest_1.expect)(errors[0].message).toContain('Bloque didáctico "@warning" sin cerrar. Se esperaba "@end"');
    });
});
//# sourceMappingURL=parser.test.js.map