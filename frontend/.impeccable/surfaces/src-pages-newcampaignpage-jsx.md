---
version: 1
slug: "src-pages-newcampaignpage-jsx"
primary_target: "src/pages/NewCampaignPage.jsx"
related_targets: ["src/components/AppLayout.jsx","src/components/campaign/VoiceBriefCard.jsx"]
---

# Dictar la campaña y marco de la app

Modo: Operate. Ruta `/campaigns/new` (solo marketero) dentro del marco `AppLayout`, que comparten todas las rutas privadas. Tarea: dictar o escribir el brief, revisar los 7 campos que propone la IA y generar (1 crédito). Restricciones: interpretar no cobra; el formulario sigue disponible ("la voz acelera, no obliga"); el dictado se transcribe en el dispositivo cuando se puede y se dice la verdad cuando no.

## Direction contract

THESIS: Cada campaña es una prueba de imprenta: se dicta sobre un pliego y sale con una ficha técnica que la IA llena; se rechaza el formulario con un botón "Dictar" secundario y la barra lateral de CRM.

OWN-WORLD: Dirección C · Conforme (31/10/2026, reemplaza a la B · Línea). Mesa marina #14283F (oscuro #07111D) con la orden de trabajo de cinco casillas, la actual turquesa #17B8AD; pliego #F7FBFB (oscuro #0F2236) con marcas de corte #79DDD3; Bricolage Grotesque 500–800 para titulares, cifras y el texto dictado, Inter para el resto; botones de 10 px y 44 px de alto, filete `.regla` de 1 px para abrir secciones, cero sombras en reposo.

STORY: El marketero ve en la orden que está en Dictar, habla, ve su idea escrita en grande sobre el pliego, y pasa a la ficha técnica donde la IA propone los 7 campos marcados «propuesto por la IA» o «falta».

FIRST VIEWPORT: Encabezado "Orden nueva · paso 1 de 5" y "Dicta la campaña". Izquierda: párrafo dictado a 28–42 px (lo provisional en tinta tenue) y el micrófono-sello de 86 px con aro que gira "escuchando · mm:ss". Derecha (380 px, separada por un hilo): "Ficha técnica" con los 7 campos y "Completar ficha".

FORM: Conforme (imprenta: mesa, pliego, orden de trabajo y sello); elegida por Jason entre tres láminas; seed ef3c7bb1.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
