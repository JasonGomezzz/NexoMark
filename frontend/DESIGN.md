# NexoMark IA — Sistema visual "Nexo"

> Fuente de verdad visual del frontend React y única identidad del producto.
> Identidad tomada del icono aprobado (`brand/nexomark-icon-approved-1024.png`,
> traído de la rama `piero` y verificado): **azul marino `#14283F`**,
> **turquesa `#17B8AD`** y blanco. Tipografía **Inter**. Modo **claro y oscuro**.
> Tailwind v4 CSS-first: todos los tokens viven en `src/index.css` (`@theme` para
> claro y `html[data-theme='dark']` para oscuro). No existe `tailwind.config.js`.

## Marca

- **Nombre visible:** NexoMark IA. El código, los paquetes y el repositorio siguen como `marketmind`.
- **Logo:** `components/BrandLogo.jsx` = icono (`/nexomark-icon-192.png`) + "NexoMark" en Inter 800 + cápsula "IA".
  `tone="navy"` sobre superficies marinas (texto blanco, cápsula turquesa). El tamaño sigue al `font-size` del contenedor.
- **Favicon:** `/favicon.png` (64 px) y `apple-touch-icon` `/nexomark-icon-192.png`, reducciones del maestro.
- **Idea gráfica:** la N son dos piezas que encajan (quien crea y quien aprueba). El marino es el contenedor
  (barra lateral, paneles de marca, pie); el turquesa es la pieza que avanza (paso actual, progreso, acción).
- `<html lang="es">`, título "NexoMark IA — De la idea dictada al post publicado", `theme-color` `#14283F`.

## Color

Estrategia: **restringida en la app** (neutros fríos + un acento) y **comprometida en la portada**
(campos marinos y turquesa que ocupan regiones enteras). Las superficies se separan por tono y,
en la app, por un borde fino del color de tema; no hay vidrio ni degradados decorativos.

### Marca (iguales en ambos temas)

| Token | Hex | Uso |
|---|---|---|
| `navy` | `#14283F` | Barra lateral, panel de acceso, panel del flujo, pie |
| `navy-deep` | `#0B1929` | Velo de cajones, fondo oscuro |
| `navy-raised` | `#1D3550` | Bloques sobre marino (créditos, testimonio) |
| `navy-line` | `#2C4862` | Divisores sobre marino |
| `turquoise` | `#17B8AD` | Pieza turquesa: paso actual, barras de avance, cápsula IA |
| `turquoise-soft` | `#79DDD3` | Texto/acento turquesa sobre marino |
| `on-navy` / `on-navy-muted` | `#FFFFFF` / `#B9CBD8` | Texto sobre marino (≥ 9:1) |
| `on-navy-error` | `#FFB4AB` | Error sobre marino |
| `paper` | `#FFFFFF` | Botón `onBrand` (no lo altera el modo oscuro) |

### Semánticos

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `background` | `#F5FAFA` | `#0B1929` | Fondo de página |
| `surface-container-lowest` | `#FFFFFF` | `#14283F` | Tarjetas, inputs |
| `surface-container-low` | `#EDF5F5` | `#193249` | Secciones alternas, piezas de la portada |
| `surface-container` / `-high` / `-highest` | `#E5EFEF` / `#DCE9EA` / `#D3E3E5` | `#203B52` / `#29485F` / `#33546B` | Chips, fondos sutiles |
| `on-surface` | `#14283F` | `#F3FAFB` | Texto principal |
| `on-surface-variant` | `#425C67` | `#BDCFD7` | Texto secundario |
| `outline` | `#5A737D` | `#90ACBA` | Bordes de campos (≥ 3:1), placeholders (≥ 4.5:1) |
| `outline-variant` | `#B6CDD1` | `#3D5A6E` | Bordes de tarjeta, divisores |
| **`primary`** | **`#087B75`** | **`#17B8AD`** | Botones, enlaces, foco. En claro es el turquesa oscurecido por contraste |
| `on-primary` | `#FFFFFF` | `#0B1929` | Texto sobre `primary` |
| `primary-container` | `#086A65` | `#21C9BB` | Hover del botón primario |
| `primary-fixed` / `on-primary-fixed` | `#E4F6F3` / `#14283F` | `#143A42` / `#D1F4EE` | Selección suave, badge "Pendiente IA" |
| `secondary-container` | `#E9F2F5` | `#1C364B` | Badge "Generado" |
| `tertiary` / `tertiary-container` | `#904900` / `#FFE3C2` | `#FFBD7C` / `#633600` | Ámbar: avisos, etiquetas de ejemplo |
| `success` / `success-container` | `#2A7430` / `#DCF3DD` | `#8FD991` / `#173D1B` | Solo el estado "Aprobado" |
| `error` / `error-container` | `#BA1A1A` / `#FFDAD6` | `#FFB4AB` / `#93000A` | Rechazado, destructivo |
| `warning` / `warning-container` | `#9A4F00` / `#FFE3C2` | `#FFBD7C` / `#563100` | Pendiente |

**Contraste verificado:** `tests/brandPalette.test.js` exige 4.5:1 en 22 pares reales de texto y
estado (badges FSM, enlaces, placeholders, etiquetas de ejemplo) en ambos temas, y en el texto sobre
marino. Si cambias un token, el test te dice qué par se rompe.

## Tipografía

Inter en todos los roles (cargada de Google Fonts, 400–800).

| Rol | Tamaño | Peso | Tracking | Uso |
|---|---|---|---|---|
| Display portada | `clamp(1.85rem, 5.3vw, 4.6rem)` | 800 | −0.035em | Titular del hero, siempre en 2 líneas |
| Sección portada | `clamp(2rem, 4vw, 3.5rem)` | 800 | −0.03em | Títulos de sección |
| h1 app | 36–40 px | 700 | −0.02em | Título de página |
| h2/h3 | 20–24 px | 600–700 | −0.01em | Tarjetas, pasos |
| Cuerpo | 16–18 px, interlineado 1.6 | 400 | — | Texto corrido en tinta plena |
| Pequeño | 13–15 px | 500–600 | — | Rótulos, ayudas. Nada por debajo de 13 px |

- Titulares con `text-wrap: balance` (regla base). Cifras con `tabular-nums`.
- Sin mayúsculas espaciadas en rótulos nuevos, sin eyebrows sobre los titulares, sin palabra resaltada en otro color.

## Formas (radios)

La familia es la del icono: **cuadrado redondeado** para contenedores y **círculo** para lo que es
un punto en un recorrido (nodos del stepper, avatares, interruptores de selección).

| Token / utilidad | Valor | Uso |
|---|---|---|
| `rounded-lg` | 10 px | Botones, inputs, ítems de navegación |
| `rounded-xl` | 14 px | Tarjetas de la app, fragmentos de interfaz |
| `rounded-2xl` | 18 px | Piezas del tablero de la portada, paneles marinos |
| `rounded-3xl` | 22 px | Modales |
| `rounded-full` | — | Nodos del stepper, avatares, badges FSM |

## Elevación

Sombras solo en lo que flota: menús, toasts, modales y el cajón móvil (`shadow-lg`, `shadow-xl`,
`shadow-2xl`, teñidas de marino; más profundas en oscuro). Nada en reposo lleva sombra.
Las clases históricas `glass-card`, `glass-liquid`, `glass-liquid-dark`, `glass-soft` y `glass-float`
se conservan por compatibilidad con páginas existentes, pero ahora son **superficies sólidas** del tema
(ver `index.css`): sin transparencia ni desenfoque.

## Movimiento

Curvas en `@theme`: `--ease-out` `cubic-bezier(.23,1,.32,1)` para entradas, `--ease-drawer`
`cubic-bezier(.32,.72,0,1)` para el cajón. Botones `active:scale-[0.97]` en 150 ms.

- **Momento firma:** la demostración del flujo del hero (`FlowDemo`): la transcripción se escribe,
  la barra de generación avanza y los pasos se marcan con el círculo turquesa. Se repite con
  "Reproducir de nuevo" o al elegir otro ejemplo. No llama a la API.
- Entrada única de la foto del hero (`.shutter-in`, clip-path 1.1 s).
- Pasos y funciones aparecen una vez al entrar en pantalla (16 px, escalonado 70 ms).
- `prefers-reduced-motion`: todo se muestra en su estado final (el flujo aparece completo).
- La galería es estática: no hay carrusel infinito.

## Marco de la app (`components/AppLayout.jsx`)

- Escritorio (≥ 1024 px): barra lateral marina fija de 256 px (pegada al desplazar), con logo,
  navegación por rol, bloque de créditos (marketero/superadmin), usuario, botón de tema y salida.
  Ítem activo: fondo turquesa al 15 % + icono turquesa.
- Móvil y tableta: barra superior con menú, logo y tema; la navegación se abre en un cajón desde la
  izquierda (Esc cierra, el foco entra al cajón y vuelve al botón).
- El contenido desplaza el documento (no un contenedor interno) y recorta el desborde horizontal.

## Portada (`pages/LandingPage.jsx`)

Tablero de piezas rellenas con 8–12 px de separación: propuesta (2 líneas) + acción, panel marino con
el flujo **Dictar → Generar → Aprobar → Publicar → Medir** (selector de tres ejemplos), foto de ambiente
rotulada "generada con IA"; después pasos con garantías reales, funciones con fragmentos de interfaz
(`data-ui`), galería estática de imágenes de ejemplo, planes de ejemplo en tabla y cierre con el nombre
a todo lo ancho. Contrato de dirección en `.impeccable/surfaces/src-pages-landingpage-jsx.md`.

## Datos de ejemplo (regla)

Lo inventado no se borra (decisión de Jason): se rotula con `.demo-tag` (ámbar, 13 px) o con un aviso
visible. Hoy: testimonios del panel de acceso (sin foto, avatar de iniciales), "Generación 10× más
rápida", precios S/ 99 y S/ 299, "98% completado" (dentro del flujo de ejemplo), métricas de ejemplo en
Funciones. Un dato que no existe se escribe "sin dato" o "Sin definir", nunca 0 ni "—" ambiguo.

## Idioma

Todo en español (Perú). Voz activa, sentence case, acciones con el verbo de lo que hacen
("Crear cuenta", "Reproducir de nuevo"). Errores que dicen qué pasó y qué hacer.

## Coherencia con el backend (no inventar)

- JWT propio de Django; se entra con correo y contraseña o con Google (ID token verificado en el servidor; las cuentas creadas con Google no tienen contraseña hasta que la crean con «Olvidé mi contraseña»). Roles: SuperAdmin, Marketero (crea campañas), Cliente (revisa y aprueba).
- 1 crédito = 1 generación; mejorar texto y restaurar versiones no gastan. Planes reales: sin definir.
- Rutas por rol verificadas con `GET /api/auth/me/` (`PrivateRoute` + `RoleRoute`); `/stats` es de los tres roles.

---

# Especificaciones de componentes

Cada valor sale de los tokens de arriba; no se inventan colores ni tamaños nuevos.

## Botón (`components/ui/button.jsx`)

Variantes: `default` (primary), `outline`, `secondary`, `ghost`, `light`, `onBrand` (blanco con texto
marino, para superficies de marca en ambos temas). Tamaños `sm` 36 px, `default` 44 px, `lg` 48 px,
`icon` 40 px; todos `rounded-lg`. Para enlaces con aspecto de botón usar `ButtonLink` (no anidar
`<button>` dentro de `<a>`). Foco: anillo `primary` con separación del color de fondo.

## Campo de formulario (`components/auth/AuthField.jsx`)

Etiqueta visible encima, alto 48 px, borde `outline` (3:1), foco `primary` + anillo al 30 %, error en
`error` anunciado con `role="alert"`, ayuda en 13 px. Contraseña con botón mostrar/ocultar.

## Stat card

`rounded-xl border border-outline-variant bg-white p-6` (en oscuro `bg-white` sigue el tema). Ícono
48 px en cuadro tintado (`bg-primary/10 text-primary`, `bg-tertiary-container text-tertiary`,
`bg-success-container text-success`). Número `text-3xl font-bold tabular-nums`.

## Badge de estado FSM

Pill `rounded-full px-3 py-1.5 text-sm font-semibold`; siempre estos seis:

| Estado | Etiqueta | Fondo | Texto |
|---|---|---|---|
| `borrador` | Borrador | `surface-container-high` | `on-surface-variant` |
| `pendiente_ia` | Pendiente IA | `primary-fixed` | `primary` |
| `generado` | Generado | `secondary-container` | `primary` |
| `pendiente_aprobacion` | Pendiente aprobación | `warning-container` | `tertiary` |
| `aprobado` | Aprobado | `success-container` | `success` |
| `rechazado` | Rechazado | `error-container` | `error` |

## Stepper FSM (`components/CampaignStepper.jsx`)

Nodos circulares de 36 px: hecho `bg-primary text-on-primary` con check, actual `bg-primary` +
`ring-4 ring-primary/25`, rechazado/fracaso `bg-error`, futuro `bg-surface-container-high text-outline`.
Conectores de 2 px `bg-primary` (tramo recorrido) o `bg-outline-variant`. En pantallas angostas solo se
rotula el paso actual. Mismo lenguaje que el flujo de la portada.

## Tabla de datos

Contenedor `rounded-xl border border-outline-variant` dentro de `overflow-x-auto`. Cabecera
`bg-surface-container-low`, filas con borde `outline-variant/40` y hover `surface-container-low`.
Números `tabular-nums`. Estado con badge FSM.

## Estado vacío, skeleton, toasts, modal y cajón

- Vacío: ícono en círculo 64 px `bg-surface-container-high`, título 18 px, descripción 14 px, una acción.
- Skeleton: `animate-pulse bg-surface-container-high` con la silueta del contenido.
- Toasts: solo vía `components/ui/AppToaster` (superficie sólida, borde fino, `shadow-lg`, `rounded-xl`).
- Modal: velo `bg-on-surface/40`, tarjeta `glass-liquid rounded-3xl p-8` (sólida), cerrar con X, velo y Esc.
- Cajón: entra desde el lado con `--ease-drawer` (≈ 280 ms), velo `navy-deep/60`.
