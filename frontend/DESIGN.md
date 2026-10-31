# NexoMark IA — Sistema visual "Línea"

> Fuente de verdad visual del frontend React. Dirección **B · Línea**, elegida por Jason el 30/10/2026.
> Contrato compartido con Flutter: `docs/diseno/direcciones.md`, sección «Dirección elegida» (fuera de Git).
> Si cambia un token aquí o en `src/index.css`, se cambia también allí el mismo día.
> Tailwind v4 CSS-first: todos los tokens viven en `src/index.css`.
> - `@theme` para claro y `html[data-theme='dark']` para oscuro.
> - No existe `tailwind.config.js`.

## La idea

Cada campaña es un viaje por una línea de cinco estaciones: **Dictar → Generar → Aprobar → Publicar → Medir**.
- **El marino es el andén:** la banda de navegación.
- **El turquesa es el tren que avanza:** la estación actual, la vía del dictado y el micrófono.
- **La N son dos piezas que encajan:** quien crea y quien aprueba. Encajan dos veces:
  - al entrar al login y al registro;
  - cuando el cliente aprueba.

El recorrido **es** la navegación:
- **Banda:** cada estación lleva a su etapa (`components/linea/estaciones.js`) y muestra cuántas campañas esperan ahí.
- **Tramo por rol:**
  - marketero: las 5 estaciones;
  - superadmin: sin Dictar, porque no crea campañas;
  - cliente: Aprobar, Publicar y Medir.

## Color

Estrategia **restringida** en la app:
- neutros fríos y un acento;
- la banda marina como contenedor fijo;
- los colores por red solo en datos.

**Sin degradados, sin vidrio, sin desenfoque y sin sombras en reposo.**

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `background` | `#F5FAFA` | `#0B1929` | Fondo de página |
| `surface-container-lowest` | `#FFFFFF` | `#102236` | Campos, menús, hojas modales |
| `surface-container-low` / `-high` | `#EDF5F5` / `#DCE9EA` | `#193249` / `#29485F` | Hover de filas, esqueletos |
| `on-surface` / `on-surface-variant` | `#14283F` / `#425C67` | `#F3FAFB` / `#BDCFD7` | Texto |
| `outline` | `#5A737D` | `#90ACBA` | Bordes de campo (3:1 o más), texto terciario, placeholders |
| `outline-variant` | `#B6CDD1` | `#3D5A6E` | Divisores, estaciones inactivas, meses futuros |
| `hairline` | `#D6E5E7` | `#1F3A52` | Hilos entre filas |
| `primary` / `on-primary` | `#087B75` / `#FFFFFF` | `#17B8AD` / `#0B1929` | Botón principal, enlaces, foco |
| `banda` / `banda-2` / `via` | `#14283F` / `#1D3550` / `#2C4862` | igual | Banda de la línea, conteos, vía |
| `regla` | `#14283F` | `#3D5A6E` | Filete de 6 px que abre una sección |
| `turquoise` / `turquoise-soft` | `#17B8AD` / `#79DDD3` | igual | Estación actual, vía del dictado, micrófono |
| `chart-instagram` / `-x` / `-facebook` / `-tiktok` | `#B4307E` / `#6F7A16` / `#2463C8` / `#C2501A` | `#D45A9C` / `#8E9A2E` / `#5B8FE0` / `#DE7340` | Una línea por red (orden fijo) |
| Estados | `success`, `error`, `warning`, `tertiary` y sus `-container` | | Badges FSM, avisos, «Datos de ejemplo» |

- `tests/brandPalette.test.js` exige 4.5:1 en los pares de texto, en ambos temas.
- Los colores por red pasan los 5 chequeos de `dataviz/validate_palette.js` sobre `#F5FAFA`, `#FFFFFF`, `#14283F` y `#0B1929`.
- No se usan turquesa, verde ni ámbar para series: quedan para estados.

## Tipografía

- **Overpass** (600, 700 y 800) es la voz de la línea: titulares, estaciones, cifras y el texto dictado. Desciende de la señalética vial. Se aplica a todos los `h1`, `h2` y `h3` desde la base, y con la utilidad `font-display`.
- **Inter** (400 a 700) es para el cuerpo, los controles y las tablas.

| Rol | Tamaño / interlineado | Peso |
|---|---|---|
| Título de página | 30 → 38 / 1.05, −0.02em | 800 |
| Frase dictada | 25 → 34 / 1.18, −0.02em | 700 |
| h2 de sección | 24 / 1.2 | 800 |
| Cifra (`.cifra`) | 28–56 / 1, −0.02em | 800 |
| Cuerpo | 15 / 1.5 | 400 |
| Pequeño | 13 / 1.4 | 500 |

- Mínimo 13 px. La única excepción son las etiquetas de los gráficos, a 12 px.
- No se usan mayúsculas espaciadas ni rótulos encima de los títulos.
- Las cifras de las tablas van con `tabular-nums`.

## Formas, trazos y espacio

**Formas:**
- Botones en pastilla (`rounded-full`) con 44 px de alto en todos los tamaños.
- Campos de 10 px (alto 44–48 px, borde `outline`).
- Superficies de 14 px y hojas modales de 22 px.
- Estaciones, micrófono, avatares y badges, en círculo o pastilla.

**Trazos:**
- Vía de 6 px (4 px en la línea en miniatura).
- Anillo de 4–5 px en las estaciones.
- Hilos de 1 px.
- `.regla`: filete de 6 px que abre cada sección, en lugar de tarjetas.
- Foco: 2 px `primary`, separado de 2–3 px.

**Espacio:**
- Base 4.
- Margen lateral de 40 px en escritorio y 16 px en móvil.
- Entre secciones, 40–48 px.

**Sombras:**
- `shadow-sm` y `shadow-md` valen «nada».
- Solo flota lo que flota: menú de cuenta y toasts (`shadow-lg`), hojas modales (`shadow-xl`) y cajón (`shadow-2xl`).

## Componentes de la línea

- **`AppLayout` + `LineaNav`:**
  - Escritorio: banda marina de 96 px con el logo, la línea y, a la derecha, créditos y menú de cuenta. El menú guarda inicio, todas las campañas, créditos, guía, configuración, tema y salir.
  - Móvil: fila superior con el menú, el logo y los créditos, y debajo la línea en miniatura.
  - Estación actual: círculo turquesa de 40 px con el ícono del paso y un anillo `turquoise-soft`.
  - Una página puede fijar su estación con `useEstacionPagina` (`EstacionContext`); el detalle lo hace según el estado de la campaña.
- **Vía del dictado** (`VoiceBriefCard` + `useBriefDictado`):
  - Cada frase final es una parada con su tiempo; la frase en curso va tenue y con cursor.
  - La vía termina en el micrófono, de 84 px (68 px en móvil).
  - "Prefiero escribir" cambia a un área de texto grande.
  - La Web Speech API no entrega el nivel de voz, así que los anillos solo dicen «te escucho».
- **Próxima estación:**
  - A la derecha del dictado, los 7 campos se muestran como paradas.
  - Al completar, se vuelven el formulario con la marca «propuesto por la IA» o «falta».
- **`CampaignStepper`:**
  - El viaje de una campaña por los 5 verbos (no por los estados internos).
  - El rechazo marca Aprobar en rojo.
- **La pieza:**
  - En el detalle, imagen y copy primero; a la derecha, «Siguiente paso» según el estado.
  - En la revisión del cliente, la pieza se muestra como el post publicado: cuenta, imagen a todo el ancho (`ImageLightbox variante="post"`) y copy.
- **`PlanoDelAnio`:** una línea por red y un mes por estación.
  - El tamaño y el número de la estación dicen cuántas publicaciones hubo; debajo, los me gusta en formato compacto.
  - Una estación hueca es un mes sin publicaciones; los meses que no llegan van en gris.
  - En móvil, el plano va en vertical. Tiene una tabla `sr-only` equivalente.
- **Listas:**
  - Filas finas en las que el título es un enlace que cubre la fila.
  - Pestañas por estación y búsqueda.
  - Mini recorrido de 5 puntos en escritorio.

## Movimiento

**Curvas** (en `@theme`):
- `--ease-out` `cubic-bezier(.23,1,.32,1)` para entrar;
- `--ease-in-out` `cubic-bezier(.77,0,.175,1)` para moverse;
- `--ease-drawer` `cubic-bezier(.32,.72,0,1)`.

| Qué | Duración |
|---|---|
| Presionar (escala 0.97) | 140 ms |
| Hover de color | 160 ms |
| Menú de cuenta (sale de su botón) | 180 ms; salida en 120 ms |
| Parada nueva del dictado (`.entra`) | 180 ms |
| Formulario que propone la IA (`.entra-lenta`) | 200 ms |
| Hojas modales (`.entra-hoja`, desde abajo) | 220 ms |
| Cajón | 280 ms |
| **Encaje de la N** (`NexoN encajar`) | 420 ms, una vez |
| **Aprobación del cliente** (la N encaja y la vía se llena hasta Publicar) | 420 ms |
| Tren de «Generando» (movimiento continuo, lineal) | 1.8 s |
| Anillos de escucha | 1.6 s |

- No se anima lo que se usa decenas de veces al día: la banda, los filtros, las filas y la selección de mes.
- Nada aparece desde escala 0.
- Con «reducir movimiento», todo queda en su estado final: lo cubren `MotionConfig reducedMotion="user"`, la regla global de `index.css` y `useReducedMotion` en las secciones de la portada.

## Datos (reglas)

- Un dato que no existe se escribe **«sin dato»**, nunca 0. Un 0 contado (publicaciones del mes) sí es 0.
- Lo inventado se rotula «ejemplo» (`.demo-tag`). Están rotulados:
  - el testimonio del acceso;
  - el «10× más rápida»;
  - los precios S/ 99 y S/ 299;
  - las métricas de ejemplo de la portada.
- X y TikTok solo aparecen si el servidor los activa o si ya hay publicaciones en esa red.
- TikTok no entrega métricas: se dice, no se dibuja.

## Idioma

- Español de Perú, en voz activa.
- Los botones dicen lo que hacen: «Dictar una campaña», «Completar campos», «Enviar al cliente», «Aprobar y publicar», «Pedir cambios».
- Los errores dicen qué pasó y qué hacer.

## Coherencia con el backend

- Cada rol ve lo suyo, recortado en el servidor.
- 1 crédito = 1 generación; completar los campos y restaurar versiones no gastan.
- La aprobación del cliente pide valoración y `version` (Spring).
- Al aprobar se publica en los destinos elegidos al enviar; sin destinos, la interfaz lo dice («no se publica sola»).
