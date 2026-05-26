# Edumark 📘

**Edumark** es un lenguaje de marcado declarativo para crear materiales didácticos (apuntes, guías, exámenes, rúbricas y hojas de actividades). A partir de archivos `.edu`, compila los documentos a formato HTML.

El propósito de Edumark es separar el contenido didáctico del diseño visual, permitiendo escribir el material en texto plano con una sintaxis declarativa simple y generar un formato HTML estructurado y listo para usar o imprimir.

---

## 🔌 Extensión para VS Code

Existe una extensión para Visual Studio Code que facilita la creación de documentos Edumark.

> [!IMPORTANT]
> **Las siguientes características de edición y visualización son proporcionadas por la extensión de VS Code:**
>
> - **Coloreado Sintáctico**: Resalta las directivas didácticas, metadatos, preguntas y bloques de código.
> - **Soporte de Tablas**:
>   - **Tablas estilo Ataula**: Soporta y resalta bordes con esquinas utilizando el carácter `+` (ej. `+---+---+`).
>   - **Tablas estilo Markdown**: Soporta líneas de separación y alineaciones con `:` (ej. `| :--- | :---: |`).
> - **Edición Asistida y Auto-ajuste**: Formatea de forma dinámica las tablas de texto plano mientras escribes para que las columnas se ajusten automáticamente a su contenido.
> - **Vista Previa en Tiempo Real**: Renderiza el HTML final en un panel lateral de VS Code mientras editas el archivo `.edu`.

---

## 📦 Características del Lenguaje

El lenguaje Edumark soporta:

- **Bloques Didácticos**: Cajas estilizadas para llamadas pedagógicas (`💡 ¿Sabías que...?`, `⚠️ Atención`, `🔍 Sugerencia`, `🔑 Solución`, `💭 Reflexión`, `✍️ Actividad`, `📝 Nota`).
- **Preguntas**: Selección única o múltiple con sus opciones y bloque de explicación opcional (`@solution`).
- **Tablas Geométricas**: Tablas en texto plano (ASCII) que admiten celdas combinadas (*colspan* y *rowspan*) y estilos en línea (`{ .clase; estilo: valor }`).
- **Rúbricas**: Tablas de evaluación que se definen dentro del bloque `@rubric`.
- **Formateo de Texto**: Negrita (`**`), cursiva (`*`), código en línea (`` ` ``), imágenes y enlaces markdown.
- **CLI de Compilación**: Comandos para validar sintaxis (`lint`), compilar a HTML (`render`) y construir carpetas (`build`).

---

## 🛠️ Guía de Sintaxis de Edumark (`.edu`)

Los archivos de Edumark utilizan la extensión `.edu`. A continuación se detalla cómo escribir cada elemento.

### 1. Metadatos (Frontmatter)
Todo documento puede comenzar con un bloque de metadatos encerrado entre `---` para definir las propiedades generales:
```markdown
---
title: Introducción a la Programación
author: Gerard F.P.
level: 1º de Bachillerato
---
```

### 2. Secciones
Define títulos de secciones con la directiva `@section`:
```markdown
@section 1. Conceptos Básicos
```

### 3. Bloques Didácticos (Cajas de Contenido)
Permiten resaltar información. Comienzan con `@<nombre-bloque>` y terminan con `@end`.

Tipos de bloques admitidos:
- `@didyouknow` (💡 ¿Sabías que...?)
- `@warning` (⚠️ Atención)
- `@hint` (🔍 Sugerencia)
- `@solution` (🔑 Solución)
- `@reflection` (💭 Reflexión)
- `@activity` (✍️ Actividad)
- `@note` (📝 Nota)

**Ejemplo de uso:**
```markdown
@didyouknow ¿El primer bug?
El término "bug" se popularizó cuando Grace Hopper encontró una polilla real bloqueando un relé en el ordenador Harvard Mark II en 1947.
@end
```

### 4. Preguntas Interactivas (`@question`)
Soporte para modelar preguntas y respuestas de manera estructurada:
- El texto después de `@question` especifica atributos opcionales como el tipo: `type=multiple-choice` (casillas) o `type=single-choice` (botones de radio).
- Las opciones se declaran como listas con `- [ ]` (desmarcada) o `- [x]` (marcada como correcta).
- Se puede incrustar un bloque `@solution` dentro de la pregunta para ofrecer una explicación detallada del resultado.

**Ejemplo de uso:**
```markdown
@question type=single-choice
¿Cuál de los siguientes lenguajes se compila directamente a código de máquina?
- [ ] JavaScript
- [x] C++
- [ ] Python

@solution
C++ es un lenguaje compilado directamente a código nativo de la CPU, a diferencia de JavaScript o Python que son interpretados o utilizan máquinas virtuales.
@end
@end
```

### 5. Tablas Geométricas
Edumark procesa tablas en formato de cuadrícula ASCII. El compilador detecta la combinación de columnas (*colspan*) y filas (*rowspan*) si se omiten las líneas divisorias internas.
La primera línea de texto de una celda puede albergar un bloque de propiedades entre llaves `{}` para aplicar clases CSS (como `.header`) o estilos CSS en línea.

**Ejemplo de uso:**
```markdown
+------------------------------------+------------------------------------+
| { .header; text-align: center }                                         |
| Tabla Comparativa de Rendimiento                                        |
+------------------------------------+------------------------------------+
| Dispositivo                        | Tiempo de Ejecución                |
+------------------------------------+------------------------------------+
| Ordenador de Sobremesa             | 1.2 segundos                       |
+------------------------------------+------------------------------------+
| Teléfono Móvil                     | 4.8 segundos                       |
+------------------------------------+------------------------------------+
```

El coloreado de sintaxis en VS Code ofrece soporte para múltiples estilos de tablas:
- **Tablas estilo Ataula**: Bordes definidos con esquinas utilizando el carácter `+` (ej. `+---+---+`).
- **Tablas estilo Markdown**: Líneas de separación tradicionales e indicaciones de alineación con dos puntos `:` (ej. `| :--- | :---: |`).

### 6. Rúbricas de Evaluación
Una rúbrica se define envolviendo una tabla geométrica dentro de un bloque `@rubric`:
```markdown
@rubric Rúbrica del Proyecto
+--------------------+--------------------+--------------------+
| Criterio           | Excelente (3p)     | A mejorar (1p)     |
+--------------------+--------------------+--------------------+
| Código             | Estilo impecable y | Estilo desordenado |
|                    | modularizado.      | y difícil de leer. |
+--------------------+--------------------+--------------------+
@end
```

### 7. Formato en Línea y Bloques de Código
- **Negrita**: `**texto**`
- **Cursiva**: `*texto*`
- **Código en línea**: `` `código` ``
- **Enlaces**: `[Texto del enlace](url)`
- **Imágenes**: `![Descripción de imagen](url)`
- **Bloque de código**:
  ```text
  ```javascript
  const mensaje = "¡Hola, Edumark!";
  console.log(mensaje);
  ```
  ```

---

## 💻 Uso de la Herramienta CLI (`edumark`)

Edumark incluye un CLI para compilar archivos `.edu` desde la terminal.

### 📌 Comandos Disponibles

#### 1. Compilar un archivo individual a HTML
Compila un archivo `.edu` a HTML:
```bash
npx edumark render recurso.edu -o indice.html
```
*Si se omite el flag `-o`, genera el HTML con el mismo nombre y ubicación del archivo original (ej. `recurso.html`).*

#### 2. Compilar todos los archivos de un directorio
Compila todos los archivos `.edu` del directorio actual:
```bash
npx edumark build
```

#### 3. Validar sintaxis (Linting)
Valida la sintaxis de un archivo `.edu` y muestra los errores encontrados sin generar archivos de salida:
```bash
npx edumark lint recurso.edu
```

---

## 🏗️ Estructura del Monorepo

Proyecto TypeScript organizado como monorepo con npm workspaces:
- **`packages/parser`**: Parser que convierte código `.edu` en un Árbol de Sintaxis Abstracta (AST).
- **`packages/renderer-html`**: Renderizador que convierte el AST de Edumark en un documento HTML con estilos responsivos.
- **`packages/cli`**: Aplicación de línea de comandos (CLI) basada en `commander`.
- **`packages/shared`**: Tipos y definiciones compartidas por los paquetes.
- **`packages/vscode-extension`**: Extensión de VS Code con coloreado de sintaxis y previsualización de archivos `.edu`.
