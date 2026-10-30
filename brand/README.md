# Identidad de NexoMark IA

**NexoMark IA** conecta las tres partes centrales del producto: las ideas del
marketero, las campañas creadas con inteligencia artificial y la aprobación del
cliente.

## Concepto del símbolo

- El icono aprobado es `nexomark-icon-approved-1024.png`: una **N** blanca y
  turquesa, formada por dos piezas que encajan, sobre un contenedor azul oscuro.
- Representa la colaboración entre quien crea la campaña y el negocio/cliente
  que la revisa. Es la referencia para la aplicación y el prototipo Figma.
- Utilizar el archivo aprobado sin redibujar el encaje ni cambiar sus colores.

## Colores

| Uso | Color |
|---|---|
| Fondo del icono aprobado | Azul oscuro `#14283F` |
| Pieza izquierda | Blanco `#FFFFFF` |
| Pieza derecha | Turquesa `#17B8AD` |

Colores extraídos de los píxeles del PNG maestro. La interfaz web, Flutter,
Android y el sitio legal usan esta identidad. En modo claro, enlaces y botones
con texto blanco usan turquesa oscuro `#087B75` (hover `#086A65`) por contraste;
en modo oscuro, el turquesa original lleva texto azul marino. Superficies claras
`#F5FAFA` y oscuras `#0B1929` complementan la paleta sin modificar el icono.
Se conservan colores semánticos de error/advertencia y logos de redes sociales.
Los temas Android usan la marca por defecto en lugar del color del dispositivo.

La tipografía recomendada es **Inter**, con peso 800 para el nombre y pesos
400–600 para textos de interfaz.

## Archivos

- `nexomark-icon-approved-1024.png`: maestro aprobado de 1024 × 1024.
- `../frontend/public/nexomark-icon.png`: copia idéntica para BrandLogo y favicon.
- `../mobile_flutter/assets/brand/nexomark-icon.png`: copia idéntica para el acceso Flutter.
- Se retiraron `nexomark-mark.svg`, `nexomark-logo.svg` y
  `nexomark-logo-preview.png`, correspondientes al diseño anterior.
  Sus versiones previas siguen disponibles en el historial de Git.
- Los archivos de concepto son propuestas, no sustitutos del maestro aprobado.

El estado del icono en Figma debe comprobarse en el archivo de diseño; estos
recursos del repositorio no actualizan automáticamente ese prototipo.

No deformar el logo, cambiar sus proporciones ni separar la cápsula `IA` del
nombre. El isotipo puede utilizarse solo cuando el nombre ya sea visible en el
contexto.
