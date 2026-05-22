#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const parser_1 = require("@edumark/parser");
const renderer_html_1 = require("@edumark/renderer-html");
const program = new commander_1.Command();
program
    .name('edumark')
    .description('Herramienta de consola para Edumark - Lenguaje educativo declarativo')
    .version('1.0.0');
// Command: render <file> [-o output]
program
    .command('render')
    .description('Compila un archivo .did a HTML')
    .argument('<archivo>', 'Ruta al archivo .did a compilar')
    .option('-o, --output <salida>', 'Ruta del archivo HTML resultante')
    .action((filePath, options) => {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
        console.error(`Error: El archivo "${filePath}" no existe.`);
        process.exit(1);
    }
    const source = fs.readFileSync(fullPath, 'utf8');
    const { ast, errors } = (0, parser_1.parse)(source);
    if (errors.length > 0) {
        console.error(`\n❌ Se encontraron errores de sintaxis en "${filePath}":`);
        for (const err of errors) {
            console.error(`  - Línea ${err.lineNum}: ${err.message}`);
        }
        process.exit(1);
    }
    const html = (0, renderer_html_1.renderToHTML)(ast);
    const outputPath = options.output
        ? path.resolve(options.output)
        : fullPath.replace(/\.did$/, '.html');
    fs.writeFileSync(outputPath, html, 'utf8');
    console.log(`\n✨ Compilado con éxito:`);
    console.log(`   De: ${path.basename(fullPath)}`);
    console.log(`   A:  ${path.basename(outputPath)}`);
});
// Command: build
program
    .command('build')
    .description('Compila todos los archivos .did del directorio actual')
    .action(() => {
    const cwd = process.cwd();
    const files = fs.readdirSync(cwd).filter(file => file.endsWith('.did'));
    if (files.length === 0) {
        console.log('No se encontraron archivos .did en el directorio actual.');
        return;
    }
    let successCount = 0;
    let failCount = 0;
    console.log(`Compilando archivos .did en: ${cwd}\n`);
    for (const file of files) {
        const fullPath = path.join(cwd, file);
        const source = fs.readFileSync(fullPath, 'utf8');
        const { ast, errors } = (0, parser_1.parse)(source);
        if (errors.length > 0) {
            console.error(`❌ Error en ${file}:`);
            for (const err of errors) {
                console.error(`  - Línea ${err.lineNum}: ${err.message}`);
            }
            failCount++;
        }
        else {
            const html = (0, renderer_html_1.renderToHTML)(ast);
            const outputPath = fullPath.replace(/\.did$/, '.html');
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
    .description('Valida la sintaxis de un archivo .did y reporta errores')
    .argument('<archivo>', 'Ruta al archivo .did a validar')
    .action((filePath) => {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
        console.error(`Error: El archivo "${filePath}" no existe.`);
        process.exit(1);
    }
    const source = fs.readFileSync(fullPath, 'utf8');
    const { errors } = (0, parser_1.parse)(source);
    if (errors.length > 0) {
        console.error(`\n❌ Sintaxis inválida. Se encontraron ${errors.length} errores:`);
        for (const err of errors) {
            console.error(`  - [Línea ${err.lineNum}] ${err.message}`);
        }
        process.exit(1);
    }
    else {
        console.log(`\n✔ Sintaxis válida para: ${path.basename(fullPath)}`);
    }
});
program.parse(process.argv);
//# sourceMappingURL=cli.js.map