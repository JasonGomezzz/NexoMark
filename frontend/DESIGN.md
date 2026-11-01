# NexoMark IA — Sistema visual "Conforme"

> Fuente de verdad visual del frontend React. Dirección **C · Conforme**, elegida por Jason el 31/10/2026.
> Ese día reemplazó a la B · Línea, elegida el 30/10.
> Contrato compartido con Flutter: `docs/diseno/direcciones.md`, sección «Dirección elegida» (fuera de Git).
> Si cambia un token aquí o en `src/index.css`, se cambia también allí el mismo día.
> Tailwind v4 CSS-first: todos los tokens viven en `src/index.css`.
> - `@theme` para claro y `html[data-theme='dark']` para oscuro.
> - Los componentes propios van en `@layer components`.

## La idea

Cada campaña es una **prueba de imprenta**:
- **La mesa:** el marino enmarca toda la app.
- **El pliego:** la hoja clara donde ocurre el trabajo, con **marcas de corte** turquesa en las esquinas.
- **La orden de trabajo:** el recorrido Dictar → Generar → Aprobar → Publicar → Medir son cinco **casillas** que se sellan.
- **El sello «conforme»:** con él aprueba el cliente. Lleva la N, las dos piezas (quien crea y quien aprueba), y la versión. **Lo sellado es exactamente lo que se publica.**

La orden **es** la navegación (`components/linea/estaciones.js` + `OrdenTrabajo.jsx`):
- Cada casilla lleva a su paso y dice cuántas campañas esperan ahí.
- Tramo por rol:
  - marketero: los 5 pasos;
  - superadmin: sin Dictar;
  - cliente: Aprobar, Publicar y Medir.

## Color

Estrategia **restringida**:
- neutros fríos de papel;
- la mesa marina como contenedor fijo;
- turquesa para lo actual y la tinta del sello;
- colores por red solo en datos.

**Sin degradados, sin vidrio, sin desenfoque y sin sombras en reposo.**

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `cama` / `cama-2` / `cama-line` | `#14283F` / `#1D3550` / `#2C4862` | `#07111D` / `#14283F` / `#22405A` | La mesa: marco, orden de trabajo, banda de acceso |
| `background` (pliego) | `#F7FBFB` | `#0F2236` | Hoja de trabajo (frío, nunca crema) |
| `surface-container-lowest` | `#FFFFFF` | `#14283F` | Campos, menús, hojas modales |
| `surface-container-low` / `-high` | `#EDF5F5` / `#DCE9EA` | `#193249` / `#29485F` | Hover de filas, esqueletos |
| `on-surface` / `on-surface-variant` | `#14283F` / `#425C67` | `#F3FAFB` / `#BDCFD7` | Texto |
| `outline` | `#5A737D` | `#90ACBA` | Bordes de campo (3:1 o más), texto terciario |
| `outline-variant` (pelo fuerte) | `#9FB8BE` | `#3D5A6E` | Reglas de sección, casillas por sellar |
| `hairline` (pelo) | `#C9DADD` | `#22405A` | Hilos de la ficha y las tablas |
| `registro` | `#79DDD3` | `#3FA79E` | Marcas de corte |
| `primary` / `on-primary` | `#087B75` / `#FFFFFF` | `#17B8AD` / `#0B1929` | Botón principal, enlaces, foco, tinta del sello |
| `turquoise` / `turquoise-soft` | `#17B8AD` / `#79DDD3` | igual | Casilla actual, micrófono-sello |
| `chart-instagram` / `-x` / `-facebook` / `-tiktok` | `#B4307E` / `#6F7A16` / `#2463C8` / `#C2501A` | `#D45A9C` / `#8E9A2E` / `#5B8FE0` / `#DE7340` | Barras por red (orden fijo) |
| Estados | `success`, `error`, `warning`, `tertiary` y sus `-container` | | Badges FSM, avisos, «ejemplo» |

- `tests/brandPalette.test.js` exige 4.5:1 en los pares de texto, en ambos temas.
- Los colores por red pasan los 5 chequeos de `dataviz/validate_palette.js`.
- `banda`, `banda-2` y `via` quedan como alias de la mesa (heredados de la B).

## Tipografía

- **Bricolage Grotesque** (500–800, con tamaño óptico `opsz` 12–96) se usa en titulares, cifras y el texto dictado. Tiene carácter de tinta impresa. Se aplica a `h1`, `h2` y `h3` desde la base, y con la utilidad `font-display`.
- **Inter** se usa en el cuerpo, los controles y las tablas.

| Rol | Tamaño / interlineado | Peso |
|---|---|---|
| Título de página | 30 → 40 / 1.05, −0.025em | 800 |
| Texto dictado | 28 → 42 / 1.2, −0.022em | 600 |
| h2 | 20–24 / 1.2 | 700–800 |
| Cifra (`.cifra`) | 36–56 / 1 | 800 |
| Cuerpo | 15 / 1.5 | 400 |
| Pequeño | 13 / 1.4 | 500 |

- Mínimo 13 px; los ejes de gráfico van a 12.
- No se usan mayúsculas espaciadas ni rótulos encima de los títulos.
- Las cifras de las tablas van con `tabular-nums`.

## Formas, trazos y espacio

**Formas:**
- Pliego de 18 px (14 en móvil).
- Botones y campos de 10 px; todos los botones miden 44 px de alto.
- Casillas de 7–9 px.
- Sello, micrófono y avatares en círculo; modales de 22 px.

**Trazos:**
- `.regla`: filete de 1 px `outline-variant` que abre una sección.
- Hilos de 1 px `hairline`.
- Casillas por sellar con borde punteado de 1.5 px.
- Marcas de corte (`.corte`) de 1.5 × 16 px.
- Foco: 2 px `primary`.

**Espacio:**
- Base 4.
- El pliego va a 22 px de la mesa (8 px en móvil), con un relleno de 36–40 px (16 en móvil).

**Sombras:**
- `shadow-sm` y `shadow-md` valen «nada».
- Solo flotan los toasts (`shadow-lg`), las hojas modales (`shadow-xl`) y el cajón (`shadow-2xl`).

## Componentes

- **`AppLayout`:**
  - Escritorio: mesa con un riel de 236 px (marca, orden de trabajo, lo secundario, créditos y usuario) y el pliego con marcas de corte.
  - Móvil: mesa fina con menú, marca, la pastilla «Paso · n de 5» (`PasoActual`) y los créditos. El cajón lleva la orden y lo secundario.
  - Una página fija su paso con `useEstacionPagina`; el detalle lo hace según el estado.
- **Dictar** (`VoiceBriefCard` + `useBriefDictado`):
  - Párrafo continuo grande sobre el pliego; lo provisional en tinta tenue y con cursor.
  - **Micrófono-sello:** disco turquesa de 86 px (72 en móvil) dentro de un aro de 132 px con el texto «escuchando · mm:ss», que gira en 24 s, lineal, solo mientras escucha.
  - «Prefiero escribir» cambia a un área de texto grande.
  - La Web Speech API no da el nivel de voz, así que el sello no finge un medidor.
- **Ficha técnica:**
  - Tabla de los 7 campos con hilos finos.
  - Al completarla, se vuelve el formulario con la marca «propuesto por la IA» o «falta».
- **`CampaignStepper`:**
  - Cinco casillas de la orden de una campaña: selladas con ✓, la actual turquesa con su ícono y las que faltan punteadas.
  - El rechazo marca Aprobar en rojo.
- **`SelloConforme`:**
  - Sello con la N y la versión.
  - `estampar`: cae (escala 1.12 → 1, giro −8° → −4°, opacidad) y la N encaja dentro, en 420 ms y una sola vez.
  - Se usa en la pieza aprobada, en la aprobación del cliente y en «Lo publicado, con su sello».
- **La pieza:**
  - En el detalle, imagen y copy primero; a la derecha, «Siguiente paso».
  - En la revisión del cliente, la pieza se ve como el post publicado (`ImageLightbox variante="post"`).
- **Métricas** (`PlanchasRedes.jsx`):
  - Una **plancha** por red: cifras grandes, filas finas y barras CSS de 12 meses con su tabla `sr-only`.
  - Debajo, **«Lo publicado, con su sello»**, con la miniatura (`/api/campaigns/{id}/miniatura/`, solo para el personal) y el sello de la versión aprobada.
- **Listas:** filas finas cuyo título es un enlace que cubre la fila, pestañas por paso, búsqueda y mini casillas en escritorio.
- **Tablas del personal** (usuarios, créditos, analítica): sin tarjeta; un filete fuerte arriba y abajo, hilos entre filas. En móvil, una tabla que no cabe se vuelve lista (créditos).
- **Gráficos de conteo:** barras horizontales con el número escrito al lado; no se usan donas.
- **Vacíos y errores:** filete, título y una frase que dice qué hacer. Sin íconos dentro de círculos ni recuadros punteados.
- **Hojas modales:** `bg-surface-container-lowest`, borde `outline-variant`, radio 22 y `shadow-xl`, con entrada `.entra-hoja`. El fondo se oscurece con `navy-deep/60`, sin desenfoque.

## Movimiento

**Curvas:**
- `--ease-out` `cubic-bezier(.23,1,.32,1)` para entrar;
- `--ease-in-out` `cubic-bezier(.77,0,.175,1)`;
- `--ease-drawer` `cubic-bezier(.32,.72,0,1)`.

| Qué | Duración |
|---|---|
| Presionar (escala 0.97) | 140 ms |
| Casilla que se sella | 160 ms |
| Párrafo dictado y parada nueva (`.entra`) | 180 ms |
| Ficha que propone la IA (`.entra-lenta`) | 200 ms |
| Hojas modales (`.entra-hoja`) | 220 ms |
| Cajón | 280 ms |
| **Sello del cliente** con la N | 420 ms, una vez |
| **Encaje de la N** en el acceso | 420 ms |
| Aro del sello | 24 s, lineal |
| Tren de «Generando» | 1.8 s, lineal |

- No se anima lo que se usa decenas de veces al día: la orden, los filtros y las filas.
- Nada aparece desde escala 0.
- Con «reducir movimiento», todo queda en su estado final: lo cubren `MotionConfig`, la regla global y `useReducedMotion` en la portada.

## Datos (reglas)

- Un dato que no existe se escribe **«sin dato»**, nunca 0. Un 0 contado sí es 0.
- Lo inventado se rotula «ejemplo» (`.demo-tag`): el testimonio del acceso, el «10× más rápida», los precios de la portada, los planes del modal (pasarela simulada) y las métricas de ejemplo de la portada.
- X y TikTok solo aparecen si el servidor los activa o si ya hay publicaciones. TikTok no entrega métricas: se dice.

## Idioma

- Español de Perú, en voz activa.
- Los botones dicen lo que hacen: «Dictar una campaña», «Completar ficha», «Enviar al cliente», «Aprobar y publicar», «Pedir cambios».
- Los errores dicen qué pasó y qué hacer.

## Coherencia con el backend

- Cada rol ve lo suyo.
- 1 crédito = 1 generación; completar la ficha y restaurar versiones no gastan.
- La aprobación del cliente pide valoración y `version` (Spring).
- Sin cuentas de destino, la interfaz dice que la campaña «no se publica sola».
