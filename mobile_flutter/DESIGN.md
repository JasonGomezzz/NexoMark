# NexoMark IA — diseño de la app móvil (Flutter)

> Dirección **C · Conforme**, elegida por Jason el 31/10/2026 para web y móvil.
> Los tokens salen de `docs/diseno/direcciones.md` → «Dirección elegida: C · Conforme»
> (contrato con la sesión web) y viven en `lib/core/theme/`. Este archivo cubre
> solo lo propio de móvil: marco, navegación, gestos, hápticos, tamaños y
> movimiento. La identidad compartida está en `frontend/DESIGN.md`.

## La idea en móvil

Cada campaña es una prueba de imprenta:
- La **mesa** marina enmarca toda la app. Encima van la marca, la barra de volver y la orden de trabajo.
- El trabajo ocurre en un **pliego** claro con **marcas de corte** turquesa en las cuatro esquinas.
- El recorrido Dictar → Generar → Aprobar → Publicar → Medir es la **orden de trabajo**: cinco casillas.
- El cliente aprueba con un **sello** que lleva la N y la versión.

## Marco

| Pieza | Dónde | Medidas |
|---|---|---|
| Mesa | `Scaffold` de fondo `cama` (`#14283F` claro, `#07111D` oscuro) | Barra de estado siempre con íconos claros (`estiloMesa`) |
| Pliego | `Pliego` en `widgets/conforme.dart` | 8 px de mesa a los lados y abajo, radio 14, relleno interior 16 |
| Marcas de corte | Pintadas sobre la mesa, 4 px fuera del pliego | 1.5 × 16 px, color `registro` |
| Barra superior de una pestaña | `MesaBar`: N + «NexoMark» a la izquierda; créditos y cuenta a la derecha | 56 px |
| Barra de una pantalla de segundo nivel | `AppBar` del tema (ya va sobre la mesa) dentro de `MesaScaffold` | Título centrado en iOS, a la izquierda en Android |
| Título dentro del pliego | `PliegoTitulo`: dato de contexto (13 px), título Bricolage 30/800, regla de 1 px | |
| Acción principal | Fija al pie del pliego (`PieAccion` o la barra de la pantalla), separada por un hilo | Zona del pulgar |

Dentro del pliego no hay tarjetas en grilla: las listas son filas separadas por
hilos de 1 px (`hairline`) y las secciones se abren con una regla de 1 px (`outline-variant`).

## Navegación

- **Orden de trabajo abajo, sobre la mesa** (`OrdenBar`): es la barra de pestañas.
  - Marketero: Dictar, Generar, Aprobar, Publicar y Medir.
  - Cliente: Aprobar, Publicar y Medir.
  - Superadmin: aviso de que el panel está en la web.
- **Casillas:** 34 px, radio 7. La actual va rellena en turquesa con el ícono del paso. Las demás llevan borde punteado de 1.5 px.
- **Conteo real** en una pastilla `cama-2` arriba a la derecha:
  - Generar = borrador + generando + generada + rechazada.
  - Aprobar = esperando al cliente.
  - Publicar = aprobadas.
  - Un 0 no se dibuja, pero se anuncia.
- **Tocar la casilla activa vuelve a su raíz.** Cambiar de pestaña no se anima, salvo el sellado de la casilla (160 ms), porque se usa decenas de veces al día.
- **Segundo nivel** (cuenta, créditos, redes, detalle de campaña, revisión del cliente, todas las campañas): se abre con `push` sobre la mesa, sin la orden de trabajo.
- En la web móvil la orden es una pastilla «Dictar · 1 de 5» con menú. En la app es la barra inferior: así lo pide la tabla de traducción a Flutter de `direcciones.md` y es lo nativo en iOS y en Android.

## Gestos y plataforma

| | iOS | Android |
|---|---|---|
| Volver | Deslizar desde el borde izquierdo (`CupertinoPageTransitionsBuilder`) | Atrás predictivo de Android 14+ (`PredictiveBackPageTransitionsBuilder`) |
| Confirmaciones | `confirmarAccion` muestra la alerta de iOS (`AlertDialog.adaptive` + `CupertinoDialogAction`) | Diálogo Material con el botón principal relleno |
| Casillas de destino | `Checkbox.adaptive` (círculo de iOS) | Casilla Material |
| Respuesta al toque | Sin onda (`NoSplash`): escala 0.97 de `Pressable` y resaltado tenue | Onda `InkSparkle` |
| Hojas | Arrastrar hacia abajo cierra; asa visible | Igual |

## Hápticos

| Momento | Háptico |
|---|---|
| Empezar a dictar | `lightImpact` |
| Elegir una ficha (tono, industria, red) o cambiar de pestaña | `selectionClick` |
| Completar la ficha (la IA propuso los campos) | `selectionClick` |
| Enviar a la IA o al cliente | `mediumImpact` |
| La campaña quedó generada | `heavyImpact` |
| El sello del cliente encaja | `heavyImpact`, en el mismo cuadro en que la N encaja |
| Pedir cambios | `mediumImpact` |

## Tamaños

- **Toque mínimo de 48 × 48 dp** en todo, incluidos los íconos de la barra, la cuenta (48), los créditos (48 de alto) y las fichas (`MaterialTapTargetSize.padded`).
- **Botones:** radio 10 y 52 de alto. El principal va relleno (`primary`) y el secundario con borde o como texto.
- **Micrófono-sello:** círculo turquesa de 84 dentro de un aro de 124. Mientras escucha, el aro lleva el texto «escuchando · mm:ss».
- **Texto:** nada baja de 13 sp; los ejes de gráfico van a 12.
  - La barra inferior crece con la letra del sistema hasta 1.15×. Más se parte a 360 dp.
  - El contenido escala completo: probado a 1.3× y 360 dp sin cortes.
- **Tipografía:**
  - Bricolage Grotesque para títulos (30/800), el dictado (28/600), las cifras de plancha (36/800) y los h2 (21/800).
  - Inter para el resto, con tracking 0. Material dejaba +0.25 en el cuerpo.

## Pantallas clave

- **Dictar** (`lab_screen.dart`). Tres etapas en la misma pestaña:
  1. **Dictar:** el brief es un párrafo continuo grande. Lo confirmado va en tinta plena y lo provisional, en tinta tenue con cursor turquesa. Debajo: el aviso de dónde se transcribe y la ficha técnica con los 7 campos «por completar». Al pie, el micrófono-sello y «Completar ficha».
  2. **Ficha técnica:** cada campo dice de dónde salió: «propuesto por la IA», «corregido por ti» o «falta». Industria, tono y red son fichas con los valores que acepta el servidor. Los errores del servidor se muestran en su campo.
  3. **Generando / Prueba lista:** imagen, estado y texto, con «Revisar y enviar al cliente».
- **Detalle de campaña:** recorrido en cinco casillas, fichas de red, tono e industria, y «Enviar al cliente» fijo abajo. Los destinos se eligen en una hoja: ninguno viene marcado, porque publicar en una cuenta real es una decisión explícita.
- **Revisión del cliente:** la campaña ocupa el pliego. Valoración y «Pedir cambios / Aprobar» quedan fijos abajo.
- **Métricas:**
  - Resumen del año en una línea y selector de año.
  - Una **plancha** por red: logo, nombre, dos cifras grandes, filas finas con el resto y 12 meses de barras con el color de la red.
  - Barras sin eje Y: el valor se lee al tocar o con el lector de pantalla. Un mes sin dato lleva una raya en la base; un mes que aún no llega, nada.
  - Debajo, **«Lo publicado, con su sello»**: cada pieza con su sello y la versión que aprobó el cliente (`version_aprobada`).
- **Login:** marca y recorrido de ejemplo directo sobre la mesa; el formulario va en un pliego.

## Movimiento

Curvas y duraciones en `lib/core/theme/motion.dart`, tomadas del contrato:

| Qué | Curva | Duración |
|---|---|---|
| Presionar | escala 0.97 | 140 ms |
| La casilla se sella | `easeOut` | 160 ms |
| Párrafo o parada nueva | `easeOut` | 180 ms |
| Entradas, hojas | `easeOut` / curva de iOS | 220 ms |
| **Sello del cliente:** cae de 0.96 a 1 con opacidad y la pieza turquesa de la N encaja dentro | `easeOut` | 420 ms, una vez |
| **Encaje de la N al arrancar** | (sin cambios) | ≈ 0.8 s, una vez por arranque |
| Aro «escuchando · mm:ss» | lineal | 24 s por vuelta, solo mientras escucha |
| Halo del micrófono | sigue el volumen real | 120 ms por lectura |

- Nada aparece desde escala 0: el mínimo es 0.95, siempre con opacidad.
- Con «reducir movimiento» (iOS) o «quitar animaciones» (Android), todo queda en su estado final:
  - el sello ya está puesto y solo se funde;
  - el aro no gira;
  - el halo queda fijo;
  - las barras aparecen completas.

## Datos honestos

- Un dato que el proveedor no informa se escribe «sin dato», nunca 0.
- TikTok y X no entregan métricas. Su plancha muestra solo los envíos y lo dice.
- X y TikTok aparecen solo si el servidor los activa (`x/config`, `tiktok/config`).
- La imagen de la IA simulada lleva el rótulo «Imagen de ejemplo».

## Pruebas

- `flutter analyze && flutter test`.
- `test/paleta_test.dart` mide el contraste AA:
  - los pares de texto en claro y oscuro;
  - los pares de la mesa: texto, paso inactivo, conteo, casilla actual y marcas de corte;
  - las series de los gráficos, a 3:1 o más sobre el pliego y las superficies.
