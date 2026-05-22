import { describe, it, expect } from 'vitest';
import { parse } from './parser.js';

describe('Edumark Parser', () => {
  it('should parse frontmatter and basic didactical directives', () => {
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

    const { ast, errors } = parse(source);
    expect(errors.length).toBe(0);
    expect(ast.frontmatter).toEqual({
      title: 'Criptografía RSA',
      level: 'secondary'
    });

    expect(ast.children.length).toBe(3);
    expect(ast.children[0]).toEqual({
      type: 'directive',
      name: 'section',
      title: 'Introducción',
      children: []
    });

    const didYouKnowNode = ast.children[2] as any;
    expect(didYouKnowNode.type).toBe('directive');
    expect(didYouKnowNode.name).toBe('didyouknow');
    expect(didYouKnowNode.title).toBe('Title=RSA');
    expect(didYouKnowNode.children.length).toBe(1);
    expect(didYouKnowNode.children[0].type).toBe('paragraph');
    expect(didYouKnowNode.children[0].content).toContain('cifrado RSA fue inventado');
  });

  it('should parse questions and extract prompt, options and explanation', () => {
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

    const { ast, errors } = parse(source);
    expect(errors.length).toBe(0);
    expect(ast.children.length).toBe(1);

    const questionNode = ast.children[0] as any;
    expect(questionNode.type).toBe('question');
    expect(questionNode.questionType).toBe('multiple-choice');
    expect(questionNode.prompt).toBe('¿Cuál es la clave pública en RSA?');
    expect(questionNode.options).toEqual([
      { checked: false, text: 'p y q' },
      { checked: true, text: 'e y n' },
      { checked: false, text: 'd' }
    ]);
    expect(questionNode.explanation).toContain('La clave pública está compuesta por');
  });

  it('should parse specific @end-name closing tags and handle nested stacks correctly', () => {
    const source = `
@didyouknow
Este es un bloque didactico.
@warning
Cuidado con esta alerta.
@end-warning
Texto intermedio.
@end-didyouknow
`.trim();

    const { ast, errors } = parse(source);
    console.log("DEBUG ERRORS:", errors);
    expect(errors.length).toBe(0);
    expect(ast.children.length).toBe(1);

    const didYouKnowNode = ast.children[0] as any;
    expect(didYouKnowNode.type).toBe('directive');
    expect(didYouKnowNode.name).toBe('didyouknow');
    expect(didYouKnowNode.children.length).toBe(3);

    expect(didYouKnowNode.children[0].content).toContain('Este es un bloque didactico.');
    expect(didYouKnowNode.children[1].type).toBe('directive');
    expect(didYouKnowNode.children[1].name).toBe('warning');
    expect(didYouKnowNode.children[2].content).toContain('Texto intermedio.');
  });

  it('should close inner blocks implicitly when outer specific @end-name is used', () => {
    const source = `
@didyouknow
Este es un bloque didactico.
@warning
Cuidado con esta alerta sin cerrar explicitamente.
@end-didyouknow
`.trim();

    const { ast, errors } = parse(source);
    expect(errors.length).toBe(0);
    expect(ast.children.length).toBe(1);

    const didYouKnowNode = ast.children[0] as any;
    expect(didYouKnowNode.type).toBe('directive');
    expect(didYouKnowNode.children.length).toBe(2);
    expect(didYouKnowNode.children[1].name).toBe('warning');
  });

  it('should report an error for missing @end tag', () => {
    const source = `
@warning
Cuidado con los números primos pequeños.
`.trim();

    const { ast, errors } = parse(source);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain('Bloque didáctico "@warning" sin cerrar. Se esperaba "@end"');
  });
});
