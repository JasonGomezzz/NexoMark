---
version: 1
slug: "src-pages-publicationsstatspage-jsx"
primary_target: "src/pages/PublicationsStatsPage.jsx"
related_targets: ["src/components/social/NetworkPanel.jsx"]
---

# Métricas (estadísticas de publicaciones)

Modo: Operate. Ruta `/stats`, visible para cliente, marketero y superadmin con el mismo componente; el backend recorta los datos por rol. En la orden de trabajo es la casilla "Medir".

## Direction contract

THESIS: Las métricas son planchas de imprenta, una por red, y cada pieza publicada lleva el sello de la versión que aprobó el cliente; se rechaza el tablero de tarjetas de KPI con gráficos vacíos.

OWN-WORLD: Sistema Conforme (DESIGN.md, dirección C del 31/10): mesa marina con la orden de trabajo, pliego #F7FBFB / #0F2236 con marcas de corte, Bricolage Grotesque 800 para cifras, colores por red validados (Instagram #B4307E, X #6F7A16, Facebook #2463C8, TikTok #C2501A; en oscuro #D45A9C, #8E9A2E, #5B8FE0, #DE7340), "sin dato" nunca 0.

STORY: El visitante ve primero el total del año de cada red con sus barras por mes, después lo publicado con su sello y la tabla de publicaciones, y abre una para ver su cadena aprobada → publicada → medida y actualizarla desde Meta.

FIRST VIEWPORT: "Informe del año" y "Métricas de <año>" con la línea de estado (publicadas · esperando aprobación · fallidas), selector de año y "Actualizar métricas". Debajo, "Una plancha por red": columnas separadas por hilos con logo, cifras grandes, filas finas y barras CSS de 12 meses con su tabla para lector de pantalla.

FORM: Conforme, planchas por red y piezas selladas; seed ef3c7bb1. En móvil las planchas se apilan.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
