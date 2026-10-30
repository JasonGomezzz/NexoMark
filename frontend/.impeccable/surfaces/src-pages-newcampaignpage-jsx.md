---
version: 1
slug: "src-pages-newcampaignpage-jsx"
primary_target: "src/pages/NewCampaignPage.jsx"
related_targets: ["src/components/AppLayout.jsx","src/components/campaign/VoiceBriefCard.jsx"]
---

# Dictar la campaña y marco de la app

Modo: Operate. Ruta `/campaigns/new` (solo marketero) dentro del marco `AppLayout`, que comparten todas las rutas privadas. Tarea: dictar o escribir el brief, revisar los 7 campos que propone la IA y generar (1 crédito). Restricciones: interpretar no cobra; el formulario sigue disponible ("la voz acelera, no obliga"); el dictado se transcribe en el dispositivo cuando se puede y se dice la verdad cuando no.

## Direction contract

THESIS: La campaña es un viaje por una línea de cinco estaciones y la voz es el tren que la arranca; se rechaza el formulario con un botón "Dictar" secundario y la barra lateral de CRM.

OWN-WORLD: Banda marina #14283F con una vía #2C4862 de 6 px y cinco estaciones; la actual es un círculo turquesa #17B8AD de 40 px con anillo #79DDD3. Fondo #F5FAFA (oscuro #0B1929), Overpass 800 para titulares y frases, Inter para el resto, botones en pastilla, cero sombras en reposo, filetes de 6 px para abrir secciones.

STORY: El marketero ve dónde está en el recorrido, habla, ve cada frase quedarse como una parada en una vía que termina en el micrófono, y pasa a "Próxima estación: Generar" donde la IA completa los campos.

FIRST VIEWPORT: Banda de 96 px con las cinco estaciones (Dictar actual). Izquierda (≈2/3): título "Dicta la campaña", vía vertical turquesa con las frases a 34 px y el micrófono de 84 px al final. Derecha (380 px): "Próxima estación: Generar" con los 7 campos como paradas y el botón "Completar campos".

FORM: Línea (transit diagram) — challenger del catálogo fusionado, ganó por claridad y reconocimiento; seed ef3c7bb1.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
