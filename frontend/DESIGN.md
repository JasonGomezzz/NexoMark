# NexoMark IA — Sistema de diseño "Lumina Creative"

> Fuente de verdad visual para TODO el frontend React.
> Look **sobrio, profesional, claro u oscuro**. Azul marino y turquesa. Tipografía Inter.
> Adaptado a **Tailwind v4 (config CSS-first `@theme`)** — NO existe `tailwind.config.js`.
> Todos los tokens viven en `src/index.css` dentro de `@theme` y se usan como
> utilidades Tailwind normales (`bg-primary`, `text-on-surface`, `rounded-xl`, …).

## Marca y estética

Estética **minimalista moderna** para un entorno de marketing de alto rendimiento.
Prioriza claridad, velocidad y acabado premium. La interfaz se siente como un
espacio de trabajo de gama alta: ordenado, intencional, con "aire". Los elementos
de UI ceden protagonismo para que el contenido generado por IA (copy + imagen)
sea el foco. Profundidad por **sombras ambientales suaves**, no por bordes duros.

## Color (tokens semánticos)

Paleta derivada del icono aprobado: azul marino `#14283F`, turquesa `#17B8AD`
y blanco `#FFFFFF`. Se conserva el icono original sin recolorearlo. En modo
claro se usa turquesa oscuro `#087B75` para texto y botones con blanco;
en modo oscuro, `primary` es `#17B8AD` con `on-primary` azul marino. Los pares
de texto/acciones principales tienen pruebas de contraste mínimo 4.5:1.
Los logos de plataformas conservan sus colores oficiales y los estados
mantienen verde, rojo y ámbar; no usar la paleta de marca para ocultar alertas.

Base blanca (#f5fafa) para máximo brillo. El **turquesa** es el acento de marca y
de acciones primarias. Los colores de estado están calibrados para legibilidad
alta sobre fondo claro (fondo container suave + texto del mismo tono).

| Token Tailwind        | Hex       | Uso |
|-----------------------|-----------|-----|
| `background`          | `#f5fafa` | Fondo global |
| `surface`             | `#f5fafa` | Superficie base |
| `surface-container-low` | `#edf5f5` | Sidebar, secciones anidadas, hover |
| `surface-container`   | `#e5efef` | Tarjetas alternas |
| `surface-container-high` | `#dce9ea` | Chips, fondos sutiles |
| `surface-container-highest` | `#d3e3e5` | Marquee, zonas grises |
| `on-surface`          | `#14283f` | Texto primario |
| `on-surface-variant`  | `#425c67` | Texto secundario |
| `outline`             | `#607983` | Íconos apagados |
| `outline-variant`     | `#b6cdd1` | Bordes de tarjeta |
| **`primary`**         | `#087b75` | **Azul marino y turquesa — CTAs, marca** |
| `primary-container`   | `#086a65` | Hover del primary |
| `on-primary`          | `#ffffff` | Texto sobre primary |
| `primary-fixed`       | `#d1f4ee` | Banners suaves, badges turquesa |
| `on-primary-fixed`    | `#14283f` | Texto sobre primary-fixed |
| `secondary-container` | `#dce9ed` | Badges/eyebrows |
| `tertiary`            | `#904900` | Ámbar — acento secundario, "más popular" |
| `tertiary-container`  | `#ffe3c2` | Fondo ámbar suave |
| **`success`**         | `#2e7d32` | Estado aprobado |
| `success-container`   | `#dcf3dd` | Fondo verde suave |
| **`error`**           | `#ba1a1a` | Estado rechazado, destructivo |
| `error-container`     | `#ffdad6` | Fondo rojo suave |
| **`warning`**         | `#b55d00` | Estado pendiente |
| `warning-container`   | `#ffe3c2` | Fondo ámbar de aviso |

## Tipografía

**Inter** en todos los roles (legibilidad + carácter profesional neutral).

| Rol         | Tamaño | Peso | Line-height | Tracking | Utilidad Tailwind |
|-------------|--------|------|-------------|----------|-------------------|
| display-xl  | 60px   | 800  | 72px        | -0.02em  | `text-6xl font-extrabold tracking-tight` |
| display-lg  | 48px   | 700  | 56px        | -0.02em  | `text-5xl font-bold tracking-tight` |
| h1          | 36px   | 700  | 44px        | -0.02em  | `text-4xl font-bold tracking-tight` |
| h2          | 30px   | 600  | 38px        | -0.01em  | `text-3xl font-semibold` |
| h3          | 24px   | 600  | 32px        | —        | `text-2xl font-semibold` |
| body-lg     | 18px   | 400  | 28px        | —        | `text-lg` |
| body        | 16px   | 400  | 24px        | —        | `text-base` |
| label-md    | 14px   | 500  | 20px        | —        | `text-sm font-medium` |
| label-sm    | 12px   | 600  | 16px        | 0.05em   | `text-xs font-semibold tracking-wider uppercase` |

- Titulares con `text-wrap: balance`.
- Números en columnas: `tabular-nums`.

## Radios (formas)

| Elemento | Radio | Utilidad |
|----------|-------|----------|
| Botones, inputs | 4px | `rounded-lg` |
| Tarjetas estándar | 4px | `rounded-xl` |
| Feature cards, modales | 4px | `rounded-3xl` |
| Badges de estado / chips | full (pill) | `rounded-full` |

## Elevación (sombras ambientales)

- **Nivel 1 (tarjeta):** `shadow-sm` — `0 1px 3px rgb(15 23 42 / .06)`
- **Nivel 2 (hover/dropdown):** `shadow-lg`
- **Nivel 3 (modal):** `shadow-xl`
- **Nav fija:** `backdrop-blur` (12px) + fondo `surface/80`.
- Efecto **`.glass-card`**: superficie sólida del tema, sin blur ni borde decorativo.

### Superficies y movimiento

- Tarjetas y paneles sólidos, sin borde decorativo; separación por espacio y tono.
- Radios de 4px: esquinas discretas en tarjetas, botones y modales.
- Se mantienen bordes de campos editables, anillos de foco y estados de selección.
- Nombres CSS históricos `glass-*` / `liquid-*` se conservan por compatibilidad,
  pero ya no aplican transparencias ni desenfoque ornamental.
- Portada: composición editorial de la identidad de NexoMark y relato en `Cómo funciona`.
  No se muestran ni se consultan campañas guardadas o marcas de clientes.
  Brief → Texto e imagen → Revisión del cliente → Conexión con las redes.
  En escritorio (≥1100 × 700px), reproducción automática continua de 14 segundos con tarjetas que se separan,
  se alinean para aprobación y conectan a los canales. Tipografía por etapa: comienzo,
  forma, aprobación y canales. Inicia al estar visible el 60% de la sección,
  mantiene el resultado 2 segundos y vuelve al inicio sin intervención. Sin sticky ni dependencia del scroll.
  Sin botones de reproducción, pausa ni repetición. Elegir una etapa continúa
  la secuencia desde ese punto sin mover la página. Se suspende fuera de
  pantalla o al ocultar la pestaña, y continúa desde su posición al volver.
  Móvil, ventanas pequeñas y movimiento reducido: los cuatro pasos en lectura normal,
  sin sticky ni animación. Todos los datos son ilustrativos, no llama a IA ni publica.
  TikTok indica que se termina en su app; no promete publicación directa automática.
- Galería estática, sin carrusel infinito. Botones sin rebote ni escala al pulsar.
- Logos de redes sociales y fotografías no se recolorean.
- Toaster usa superficie sólida del tema, sin borde, radio4px y sombra suave.

## Espaciado

- **Regla de 8px:** todo múltiplo de 8 (8, 16, 24, 32, 48, 64).
- Contenedor centrado máx **1440px** (`max-w-[1440px] mx-auto`).
- Padding lateral desktop 40px, tablet 24px, mobile 16px.
- Padding interno de tarjetas ≥ 24px (sensación "airy").

## Componentes

- **Botón primario:** `bg-primary text-on-primary rounded-lg`, hover `bg-primary-container`, sin rebote al pulsar.
- **Botón secundario:** `border border-outline-variant bg-white`, hover `bg-surface-container-low`.
- **Tarjeta:** superficie sólida del tema, sin borde decorativo, radio4px y sombra suave.
- **Input:** borde `outline-variant`, foco → ring turquesa 1px. Font 16px (evita zoom iOS).
- **Bloques de contenido IA:** distinguir del input manual con tinte turquesa suave o borde degradado.

## Badges de estado FSM (crítico — usar SIEMPRE estos)

Los seis estados reales del backend (`CampaignStatus`). Pill (`rounded-full`),
fondo = tinte ~10% del color, texto = color pleno.

| Estado (valor real)     | Etiqueta ES          | Fondo               | Texto     |
|-------------------------|----------------------|---------------------|-----------|
| `borrador`              | Borrador             | `surface-container-high` | `on-surface-variant` |
| `pendiente_ia`          | Pendiente IA         | `primary-fixed`     | `primary` |
| `generado`              | Generado             | `secondary-container`| `primary` |
| `pendiente_aprobacion`  | Pendiente aprobación | `warning-container` | `tertiary`|
| `aprobado`              | Aprobado             | `success-container` | `success` |
| `rechazado`             | Rechazado            | `error-container`   | `error`   |

## Animación (motion/react)

Movimiento con propósito, sutil (evitar sensación "AI-generated" por exceso):
- **Portada:** entrada breve del texto y composición estática de la identidad de NexoMark.
- **Relato de NexoMark:** separación de capas, alineación y conexiones SVG en una secuencia automática controlable.
- **Scroll-reveal** en las demás secciones (fade + translateY al entrar en viewport).
- Galería estática, sin marquee infinito; sin rebote ni escala en botones.
- Respetar `prefers-reduced-motion` siempre.

## Idioma

**Todo en español.** "Iniciar sesión" (no Login), "Empezar gratis", "Crear campaña".
Voz activa, sentence case, sin relleno.

## Reglas de coherencia con el backend (no inventar)

- **No** login social (solo JWT). **No** presupuesto en campañas. **No** video AI.
- Planes = **cuota de tokens de IA** (1 crédito = 1 generación).
- Imagen de anuncio = **base64** (`imagen_b64`) con botón "Descargar PNG".
- Roles: SuperAdmin (usuarios/analytics/cuota) · Marketero (crea campañas) ·
  Cliente (revisa/aprueba, no crea).

---

# Especificaciones de componentes

> Componentes recurrentes de la app. **Cada valor deriva de los tokens `@theme`
> ya definidos** — nunca se inventa un color ni un tamaño nuevo. Al construir una
> pantalla, se reutiliza esta spec para que todas se vean de la misma familia.

## Stat card (tarjeta de métrica)

Usada en Dashboard, Analytics y Admin. Estructura fija:
- Contenedor: `rounded-xl border border-outline-variant bg-white p-6 shadow-sm hover:shadow-lg transition-all`
- Ícono en cuadro tintado 48px: `h-12 w-12 rounded-lg` + tinte del contexto
  (primary → `bg-primary/10 text-primary`; éxito → `bg-success-container text-success`;
  ámbar → `bg-tertiary-container text-tertiary`).
- Label: `text-sm text-on-surface-variant`.
- Número: `text-3xl font-bold tabular-nums text-on-surface` (o `text-error` si es alerta, p.ej. créditos = 0).
- Micro-tendencia opcional: pill `text-xs font-bold` verde (`text-success`) o rojo (`text-error`).

```jsx
<div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm hover:shadow-lg transition-all">
  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
    <Megaphone className="h-6 w-6" />
  </div>
  <p className="text-sm text-on-surface-variant">Campañas activas</p>
  <h3 className="mt-1 text-3xl font-bold tabular-nums text-on-surface">42</h3>
</div>
```

## Badge de estado FSM

Pill (`rounded-full px-3 py-1.5 text-sm font-semibold`). Fondo = tinte del estado,
texto = color pleno (ver tabla FSM arriba). Siempre estos seis, nunca inventar nombres.

```jsx
// Ejemplo: aprobado
<span className="inline-flex items-center gap-1.5 rounded-full bg-success-container px-3 py-1.5 text-sm font-semibold text-success">
  <CircleCheck className="h-3.5 w-3.5" /> Aprobado
</span>
```

## Stepper FSM (línea de tiempo del estado)

En el detalle de campaña. Muestra el recorrido `borrador → pendiente_ia → generado
→ pendiente_aprobacion → aprobado/rechazado`.
- Nodo **completado**: círculo `bg-success text-white` con check.
- Nodo **actual**: círculo `bg-primary text-white` (con `ring-4 ring-primary/20`).
- Nodo **futuro**: círculo `bg-surface-container-high text-outline`.
- Conector: línea `h-0.5` — `bg-success` si el tramo ya pasó, `bg-outline-variant` si no.
- Etiqueta bajo cada nodo: `text-xs font-medium` (activo `text-on-surface`, resto `text-on-surface-variant`).

## Tabla de datos

Lista de campañas y directorio de usuarios. Misma anatomía:
- Contenedor: `rounded-xl border border-outline-variant bg-white shadow-sm overflow-hidden`.
  Envolver en `overflow-x-auto` para que no rompa en móvil.
- Header: `bg-surface-container-low`, celdas `text-xs uppercase tracking-wide font-semibold text-on-surface-variant px-4 py-3`.
- Filas: `border-b border-outline-variant/40 hover:bg-surface-container-low transition-colors`.
- Columna de estado: usa el **badge FSM**. Números alineados con `tabular-nums`.
- Acciones al final: botones `ghost` con íconos lucide.

## Estado vacío (empty state)

Cuando una lista no tiene datos. Centrado, invita a actuar (nunca pantalla en blanco):
- Ícono grande en círculo `h-16 w-16 rounded-full bg-surface-container-high text-outline`.
- Título `text-lg font-semibold text-on-surface`.
- Descripción `text-sm text-on-surface-variant max-w-sm`.
- Un CTA primario (si aplica). Voz activa: "Crea tu primera campaña".

```jsx
<div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-outline-variant bg-white/50 p-12 text-center">
  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high text-outline">
    <Megaphone className="h-7 w-7" />
  </div>
  <h3 className="text-lg font-semibold text-on-surface">Aún no tienes campañas</h3>
  <p className="max-w-sm text-sm text-on-surface-variant">Crea tu primera campaña y deja que la IA genere el copy y la imagen.</p>
  <Button className="mt-2">Crear campaña</Button>
</div>
```

## Skeleton loader

Mientras Axios trae datos (uniforme en toda la app):
- Bloques `animate-pulse rounded bg-surface-container-high` con la forma del contenido real
  (una barra por línea de texto, un cuadro por imagen).
- Nunca spinner a pantalla completa: skeleton con la silueta del layout.

```jsx
<div className="h-8 w-16 animate-pulse rounded bg-surface-container-high" />
```

## Comparativa de publicaciones (dashboard)

- Tres gráficas de barras: publicaciones confirmadas, Me gusta y compartidos/reposts, para el mismo año seleccionado.
- Cada gráfica compara Facebook, Instagram, X y TikTok; no mezcla vistas con impresiones.
- Colores de series `chart-facebook`, `chart-instagram`, `chart-twitter`, `chart-tiktok`, con variantes claras/oscuras. Se emiten con `@theme static` para que también estén disponibles en SVG.
- Los colores se acompañan de nombres, iconos, cifras y cobertura de medición legibles sin hover. No se depende solo del color ni de la gráfica para leer los datos.
- Valores ausentes no se transforman en cero; las sumas de cobertura incompleta se identifican como parciales. No se estiman compartidos a partir de likes.
- La vista inicial es la comparativa anual. Un selector con iconos abre el detalle de cada red: totales, publicaciones/Me gusta mensuales y métricas específicas. «Volver a comparativa» restaura la vista general sin cambiar el año.
- Los meses proceden de `monthly` y `monthly_likes`, sin nuevas consultas a proveedores. Los valores exactos y su cobertura están disponibles en un desplegable accesible, sin repetir una tabla abierta por defecto.
- El historial del dashboard sigue el año y la red elegidos, usando el calendario America/Lima igual que el backend. La vista de estadísticas dentro de una campaña conserva su comportamiento previo.
- El historial y la consulta manual de métricas se conservan; esta presentación no añade consultas a proveedores, permisos ni consumo de API.
- Validación visual del componente con datos de prueba explícitamente etiquetados (fuera del producto); no constituye una nueva comprobación de métricas reales.

## Ranking de campañas por Me gusta

- Bloque del dashboard debajo de la comparativa/detalle; reutiliza el mismo año y plataforma seleccionados, sin solicitudes adicionales ni consumo de créditos.
- Hasta tres campañas, agrupadas por ID, sumando contadores acumulados guardados de publicaciones del año (incluidas versiones anteriores). El año sigue America/Lima igual que las estadísticas.
- Cero medido participa; sin mediciones no equivale a cero y se excluye con aviso. Si falta alguna medición, se advierte que la comparación está incompleta y se muestra cobertura por campaña.
- Empates comparten puesto y se ordenan por ID ascendente. Si el corte de tres deja otra campaña empatada fuera, se informa explícitamente.
- Cada nombre enlaza a la campaña. El título es «Campañas con más Me gusta», no «más exitosas»: no demuestra ventas, rentabilidad ni usuarios únicos.
- No cambia la pantalla individual de campañas ni la obtención, autorización o actualización de contadores.

## Toasts (react-hot-toast)

Vocabulario fijo y coherente con la acción (la acción "Aprobar" → toast "Aprobada"):
- Éxito: "Campaña generada", "Enviada a aprobación", "Campaña aprobada", "Cuenta creada".
- Error: "Cuota agotada", "Credenciales inválidas", "No se pudo generar".
- Posición `top-right`. Éxito en verde semántico, error en rojo. Sin disculpas, específico.

## Modal / Drawer

- **Overlay**: `fixed inset-0 bg-on-surface/40 backdrop-blur-sm` (on-surface = #14283f al 40%).
- **Modal** (centrado): tarjeta `rounded-3xl bg-white p-8 shadow-xl max-w-lg` con animación
  de entrada (scale 0.96→1, opacity). Acción destructiva usa botón `error`, no turquesa.
- **Drawer** (lateral, p.ej. historial): entra desde la derecha, `w-full max-w-md h-full
  bg-white shadow-xl`, animación `x: 100% → 0`.
- Cerrar con botón X (`ghost`), clic en overlay, y tecla Esc.
