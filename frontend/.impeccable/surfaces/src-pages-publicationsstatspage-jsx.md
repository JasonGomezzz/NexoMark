---
version: 1
slug: "src-pages-publicationsstatspage-jsx"
primary_target: "src/pages/PublicationsStatsPage.jsx"
related_targets: ["src/components/social/NetworkPanel.jsx"]
---

# Métricas (estadísticas de publicaciones)

Modo: Operate. Ruta `/stats`, visible para cliente, marketero y superadmin con el mismo componente; el backend recorta los datos por rol. En la línea es la estación "Medir".

## Direction contract

THESIS: El año es un plano de líneas, una por red, y cada número nace de una versión aprobada; se rechaza el tablero de tarjetas de KPI con gráficos vacíos.

OWN-WORLD: Sistema de la línea (DESIGN.md, dirección B del 30/10): banda marina con estaciones, fondo #F5FAFA / #0B1929, Overpass 800 para cifras, colores por red validados (Instagram #B4307E, X #6F7A16, Facebook #2463C8, TikTok #C2501A; en oscuro #D45A9C, #8E9A2E, #5B8FE0, #DE7340), "sin dato" nunca 0.

STORY: El visitante ve primero cómo se movió cada red mes a mes, después el detalle de un mes y de cada publicación, y abre una para ver su cadena aprobada → publicada → medida y actualizarla desde Meta.

FIRST VIEWPORT: Título "Métricas de <año>" con la línea de estado (publicadas · esperando aprobación · fallidas), selector de año y "Actualizar métricas". Debajo, el plano: una fila por red con logo, la línea de 12 estaciones-mes (tamaño = publicaciones, número debajo = me gusta o reacciones) y el total del año.

FORM: Línea, plano del año; seed ef3c7bb1. En móvil el plano gira a vertical.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
