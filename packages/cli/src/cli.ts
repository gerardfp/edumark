#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@edumark/parser';
import { renderToHTML } from '@edumark/renderer-html';

const program = new Command();

program
  .name('edumark')
  .description('Herramienta de consola para Edumark - Lenguaje educativo declarativo')
  .version('1.0.0');

// Command: render <file> [-o output]
program
  .command('render')
  .description('Compila un archivo .edu a HTML')
  .argument('<archivo>', 'Ruta al archivo .edu a compilar')
  .option('-o, --output <salida>', 'Ruta del archivo HTML resultante')
  .action((filePath, options) => {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: El archivo "${filePath}" no existe.`);
      process.exit(1);
    }

    const source = fs.readFileSync(fullPath, 'utf8');
    const { ast, errors } = parse(source);

    if (errors.length > 0) {
      console.error(`\n❌ Se encontraron errores de sintaxis en "${filePath}":`);
      for (const err of errors) {
        console.error(`  - Línea ${err.lineNum}: ${err.message}`);
      }
      process.exit(1);
    }

    const html = renderToHTML(ast);
    const outputPath = options.output
      ? path.resolve(options.output)
      : fullPath.replace(/\.edu$/, '.html');

    fs.writeFileSync(outputPath, html, 'utf8');
    console.log(`\n✨ Compilado con éxito:`);
    console.log(`   De: ${path.basename(fullPath)}`);
    console.log(`   A:  ${path.basename(outputPath)}`);
  });

// Command: build
program
  .command('build')
  .description('Compila todos los archivos .edu del directorio actual')
  .action(() => {
    const cwd = process.cwd();
    const files = fs.readdirSync(cwd).filter(file => file.endsWith('.edu'));

    if (files.length === 0) {
      console.log('No se encontraron archivos .edu en el directorio actual.');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    console.log(`Compilando archivos .edu en: ${cwd}\n`);

    for (const file of files) {
      const fullPath = path.join(cwd, file);
      const source = fs.readFileSync(fullPath, 'utf8');
      const { ast, errors } = parse(source);

      if (errors.length > 0) {
        console.error(`❌ Error en ${file}:`);
        for (const err of errors) {
          console.error(`  - Línea ${err.lineNum}: ${err.message}`);
        }
        failCount++;
      } else {
        const html = renderToHTML(ast);
        const outputPath = fullPath.replace(/\.edu$/, '.html');
        fs.writeFileSync(outputPath, html, 'utf8');
        console.log(`✔ ${file} -> ${path.basename(outputPath)}`);
        successCount++;
      }
    }

    console.log(`\nSummary: ${successCount} compilaron con éxito, ${failCount} fallaron.`);
    if (failCount > 0) {
      process.exit(1);
    }
  });

// Command: lint <file>
program
  .command('lint')
  .description('Valida la sintaxis de un archivo .edu y reporta errores')
  .argument('<archivo>', 'Ruta al archivo .edu a validar')
  .action((filePath) => {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: El archivo "${filePath}" no existe.`);
      process.exit(1);
    }

    const source = fs.readFileSync(fullPath, 'utf8');
    const { errors } = parse(source);

    if (errors.length > 0) {
      console.error(`\n❌ Sintaxis inválida. Se encontraron ${errors.length} errores:`);
      for (const err of errors) {
        console.error(`  - [Línea ${err.lineNum}] ${err.message}`);
      }
      process.exit(1);
    } else {
      console.log(`\n✔ Sintaxis válida para: ${path.basename(fullPath)}`);
    }
  });

program.parse(process.argv);
