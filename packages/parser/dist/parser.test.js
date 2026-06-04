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
    (0, vitest_1.it)('should parse hierarchical directives with variable levels and implicit closures', () => {
        const source = `
#page Pagina 1
contenido 1
##page Subpágina 1
contenido 2
###page Subsubpágina 2
contenido 3
###page Subsubpágina 3
contenido 4
##page Subpágina 2
contenido 5
#page Pagina 2
contenido 6
`.trim();
        const { ast, errors } = (0, parser_js_1.parse)(source);
        (0, vitest_1.expect)(errors.length).toBe(0);
        (0, vitest_1.expect)(ast.children.length).toBe(2);
        // Page 1
        const p1 = ast.children[0];
        (0, vitest_1.expect)(p1.type).toBe('directive');
        (0, vitest_1.expect)(p1.name).toBe('page');
        (0, vitest_1.expect)(p1.title).toBe('Pagina 1');
        (0, vitest_1.expect)(p1.children.length).toBe(3); // paragraph 1, subpage 1, subpage 2
        (0, vitest_1.expect)(p1.children[0].type).toBe('paragraph');
        (0, vitest_1.expect)(p1.children[0].content).toBe('contenido 1');
        // Subpage 1
        const sub1 = p1.children[1];
        (0, vitest_1.expect)(sub1.type).toBe('directive');
        (0, vitest_1.expect)(sub1.name).toBe('page');
        (0, vitest_1.expect)(sub1.title).toBe('Subpágina 1');
        (0, vitest_1.expect)(sub1.children.length).toBe(3); // paragraph 2, subsubpage 2, subsubpage 3
        // Subsubpage 2
        const subsub2 = sub1.children[1];
        (0, vitest_1.expect)(subsub2.type).toBe('directive');
        (0, vitest_1.expect)(subsub2.name).toBe('page');
        (0, vitest_1.expect)(subsub2.title).toBe('Subsubpágina 2');
        (0, vitest_1.expect)(subsub2.children.length).toBe(1); // paragraph 3
        // Subpage 2
        const sub2 = p1.children[2];
        (0, vitest_1.expect)(sub2.type).toBe('directive');
        (0, vitest_1.expect)(sub2.name).toBe('page');
        (0, vitest_1.expect)(sub2.title).toBe('Subpágina 2');
        (0, vitest_1.expect)(sub2.children.length).toBe(1); // paragraph 5
        // Page 2
        const p2 = ast.children[1];
        (0, vitest_1.expect)(p2.type).toBe('directive');
        (0, vitest_1.expect)(p2.name).toBe('page');
        (0, vitest_1.expect)(p2.title).toBe('Pagina 2');
        (0, vitest_1.expect)(p2.children.length).toBe(1); // paragraph 6
    });
    (0, vitest_1.it)('should handle reorganised hierarchical directives (pages, sections, tasks, images, aliases)', () => {
        const source = `
---
aliases:
  mi-seccion: idevice-text
---
#page Pagina 1
#seccion Seccion 1
contenido seccion 1
#imagen imagen1.png
#tarea Tarea 1
contenido tarea 1
#mi-seccion Seccion Personalizada
contenido seccion personalizada
#seccion Seccion 2
contenido seccion 2
#page Pagina 2
contenido pagina 2
`.trim();
        const { ast, errors } = (0, parser_js_1.parse)(source);
        (0, vitest_1.expect)(errors.length).toBe(0);
        (0, vitest_1.expect)(ast.children.length).toBe(2);
        const p1 = ast.children[0];
        (0, vitest_1.expect)(p1.type).toBe('directive');
        (0, vitest_1.expect)(p1.name).toBe('page');
        (0, vitest_1.expect)(p1.title).toBe('Pagina 1');
        // Children of Page 1:
        // 1. Seccion 1 (which contains paragraph & imagen, since imagen doesn't close it)
        // 2. Tarea 1 (closes Seccion 1 because both are idevices)
        // 3. Mi-seccion (closes Tarea 1 because both are idevices)
        // 4. Seccion 2 (closes Mi-seccion because both are idevices)
        (0, vitest_1.expect)(p1.children.length).toBe(4);
        const sec1 = p1.children[0];
        (0, vitest_1.expect)(sec1.type).toBe('directive');
        (0, vitest_1.expect)(sec1.name).toBe('seccion');
        (0, vitest_1.expect)(sec1.title).toBe('Seccion 1');
        (0, vitest_1.expect)(sec1.children.length).toBe(2);
        (0, vitest_1.expect)(sec1.children[0].content).toBe('contenido seccion 1');
        (0, vitest_1.expect)(sec1.children[1].type).toBe('directive');
        (0, vitest_1.expect)(sec1.children[1].name).toBe('imagen');
        (0, vitest_1.expect)(sec1.children[1].title).toBe('imagen1.png');
        const tarea1 = p1.children[1];
        (0, vitest_1.expect)(tarea1.type).toBe('directive');
        (0, vitest_1.expect)(tarea1.name).toBe('tarea');
        (0, vitest_1.expect)(tarea1.title).toBe('Tarea 1');
        (0, vitest_1.expect)(tarea1.children.length).toBe(1);
        (0, vitest_1.expect)(tarea1.children[0].content).toBe('contenido tarea 1');
        const misec = p1.children[2];
        (0, vitest_1.expect)(misec.type).toBe('directive');
        (0, vitest_1.expect)(misec.name).toBe('mi-seccion');
        (0, vitest_1.expect)(misec.title).toBe('Seccion Personalizada');
        (0, vitest_1.expect)(misec.children.length).toBe(1);
        (0, vitest_1.expect)(misec.children[0].content).toBe('contenido seccion personalizada');
        const sec2 = p1.children[3];
        (0, vitest_1.expect)(sec2.type).toBe('directive');
        (0, vitest_1.expect)(sec2.name).toBe('seccion');
        (0, vitest_1.expect)(sec2.title).toBe('Seccion 2');
        (0, vitest_1.expect)(sec2.children.length).toBe(1);
        (0, vitest_1.expect)(sec2.children[0].content).toBe('contenido seccion 2');
        const p2 = ast.children[1];
        (0, vitest_1.expect)(p2.type).toBe('directive');
        (0, vitest_1.expect)(p2.name).toBe('page');
        (0, vitest_1.expect)(p2.title).toBe('Pagina 2');
        (0, vitest_1.expect)(p2.children.length).toBe(1);
        (0, vitest_1.expect)(p2.children[0].content).toBe('contenido pagina 2');
    });
});
//# sourceMappingURL=parser.test.js.map