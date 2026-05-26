# Edumark 📘

**Edumark** es un lenguaje de marcado educativo y declarativo diseñado específicamente para la creación ágil de materiales didácticos de alta calidad (apuntes, guías, exámenes, rúbricas y hojas de actividades). A partir de archivos fuente sencillos `.did`, Edumark compila los documentos en páginas HTML modernas, responsivas y con un diseño estético y premium.

---

## 🚀 Propósito

El propósito de Edumark es separar el contenido pedagógico de la maquetación visual. Los educadores y creadores de contenido pueden centrarse en la redacción del material (preguntas, actividades, reflexiones y tablas) mediante una sintaxis declarativa intuitiva, mientras que el motor de renderizado de Edumark se encarga de presentarlo en un formato web premium, listo para impresión o visualización interactiva.

---

## 📦 Características Principales

- **Bloques Didácticos Integrados**: Cajas visualmente estilizadas para llamadas pedagógicas (`💡 ¿Sabías que...?`, `⚠️ Atención`, `🔍 Sugerencia`, `🔑 Solución`, etc.).
- **Sistema de Preguntas Interactivas**: Soporte para preguntas de selección única o múltiple con sus opciones y explicaciones correspondientes.
- **Tablas Geométricas Avanzadas**: Tablas complejas creadas con caracteres ASCII que admiten celdas combinadas (*colspan* y *rowspan*) y estilos personalizados inline.
- **Rúbricas Automatizadas**: Tablas con estilo especial adaptadas para la evaluación pedagógica.
- **Formateo Enriquecido de Texto**: Negrita, cursiva, código fuente, imágenes y enlaces tipo markdown clásico.
- **CLI de Compilación**: Herramientas integradas para validar sintaxis (`lint`), compilar a HTML (`render`) y construir directorios completos (`build`).

---

## 🛠️ Guía de Sintaxis de Edumark (`.did`)

Los archivos de Edumark utilizan la extensión `.did`. A continuación, se detalla cómo escribir cada elemento didáctico.

### 1. Metadatos (Frontmatter)
Todo documento puede comenzar con un bloque de metadatos encerrado entre `---` para definir las propiedades generales del recurso educativo:
```markdown
---
title: Introducción a la Programación
author: Gerard F.P.
level: 1º de Bachillerato
---
```

### 2. Secciones
Define títulos de secciones didácticas con la directiva `@section`:
```markdown
@section 1. Conceptos Básicos
```

### 3. Bloques Didácticos (Cajas de Contenido)
Permiten resaltar información de manera elegante. Comienzan con `@<nombre-bloque>` y terminan con `@end`.

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
Edumark tiene soporte nativo para modelar preguntas y respuestas de manera estructurada:
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
Edumark procesa tablas en formato de cuadrícula ASCII. El compilador detecta automáticamente la combinación de columnas (*colspan*) y filas (*rowspan*) si se omiten las líneas divisorias internas.
Además, la primera línea de texto de una celda puede albergar un bloque de propiedades entre llaves `{}` para aplicar clases CSS (como `.header`) o estilos CSS en línea.

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

Edumark incluye un CLI para compilar archivos `.did` directamente desde la terminal.

### 📌 Comandos Disponibles

#### 1. Compilar un archivo individual a HTML
Genera un archivo HTML de diseño premium a partir del archivo `.did`:
```bash
npx edumark render recurso.did -o indice.html
```
*Si se omite el flag `-o`, creará un archivo HTML con el mismo nombre y en la misma ubicación que el archivo original (ej. `recurso.html`).*

#### 2. Compilar todos los archivos de un directorio
Compila automáticamente todos los archivos `.did` presentes en el directorio actual:
```bash
npx edumark build
```

#### 3. Validar sintaxis (Linting)
Comprueba si un archivo `.did` contiene errores de sintaxis (como etiquetas o bloques sin cerrar) y reporta la línea exacta del fallo sin generar archivos de salida:
```bash
npx edumark lint recurso.did
```

---

## 🏗️ Estructura del Monorepo

El proyecto está organizado como un monorepo de TypeScript administrado con workspaces de npm:
- **`packages/parser`**: Analizador léxico y sintáctico (Lexer/Parser) que convierte la sintaxis `.did` en un Árbol de Sintaxis Abstracta (AST).
- **`packages/renderer-html`**: Renderizador premium que convierte el AST de Edumark en código HTML optimizado con estilos de diseño modernos y responsivos.
- **`packages/cli`**: Aplicación de línea de comandos basada en `commander` que implementa las herramientas para el usuario final.
- **`packages/shared`**: Tipos y definiciones comunes compartidas por los distintos paquetes del proyecto.
- **`packages/vscode-extension`**: Extensión de Visual Studio Code que dota al editor de soporte de sintaxis y previsualización de documentos `.did`.
