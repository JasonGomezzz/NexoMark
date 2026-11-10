# Documentos públicos de NexoMark IA — borradores

Estos archivos son borradores para revisión, no políticas vigentes. El borrador v0.10 llegó a
publicarse en GitHub Pages con sus avisos de "no vigente"; la versión actual es la **v0.14**
(10 de noviembre de 2026), que describe el código al 09/11: planes y créditos nuevos, compra simulada,
almacenamiento del navegador y los canales de atención.
Los nombres de los responsables y el correo del proyecto son visibles en el repositorio público.
El workflow de Pages es manual y bloquea borradores por defecto. Consultar `PAGES_SETUP.md`.

## Contenido

| Archivo | Para qué |
|---|---|
| `index.html` | Índice con enlaces a todos los documentos |
| `privacidad.html` | Política de privacidad (URL que piden Meta, TikTok y X) |
| `terminos.html` | Términos de servicio (Meta los exige para pasar a modo Live) |
| `eliminacion-datos.html` | Instrucciones de eliminación de datos (campo "User data deletion" de Meta) |
| `cookies.html` | Política de cookies y almacenamiento (qué guarda la web y qué cargan terceros) |
| `compras.html` | Condiciones de compra de créditos (planes, consumo, pago simulado) |
| `arrepentimiento.html` | Arrepentimiento de compra, con botón que abre un correo ya preparado |
| `reclamos.html` | Canal de reclamos, quejas y atención |
| `responsables.html` | Quiénes son los responsables y cómo contactarlos |
| `historial/` | Borradores anteriores v0.1–v0.10, v0.12 y v0.13 (privacidad y términos) con enlaces relativos adaptados |
| `CAMBIOS.md` | Registro de cambios por versión (no se publica) |
| `REQUISITOS-AUDITORIA.md` | Qué piden Meta, TikTok y X, con fuentes, y qué falta (no se publica) |

## Revisar

Abrir `index.html` en un navegador y seguir los enlaces. No requiere servidor ni dependencias.

## También se sirve desde la web

La web publica estos mismos archivos en `/legal/` (por ejemplo `/legal/privacidad.html`) desde
`frontend/public/legal/`, para que los enlaces de la landing, el acceso y los planes funcionen sin
depender de GitHub Pages. Es una copia: después de cambiar un texto, ejecutar `npm run legal:sync`
en `frontend/`. Un test del frontend falla si la copia no coincide con `legal-site/`.

## Antes de dar vigencia

- Confirmar la modalidad de facturación de la clave de Gemini y la región de Render y Neon
  (bloques `class="pending"` de la política).
- Confirmar que ambos responsables siguen como responsables y que pueden atender el buzón.
- Aprobar el texto, quitar los avisos de borrador y los pendientes, y fijar la fecha de vigencia.
  Solo entonces el preparador publica sin `--allow-drafts`.
- Actualizar los textos antes de activar cualquier red o proveedor nuevo (otra red, otro proveedor de IA o de correo).

Al cambiar un texto: subir el número de versión, registrar el cambio en `CAMBIOS.md` y copiar a
`historial/` la versión de privacidad y términos que se sustituye (el preparador no admite otros
archivos ahí; desde la v0.12 se conservan todas, la v0.11 no se guardó).

Referencias:

- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- https://developers.facebook.com/docs/development/terms-and-policies/privacy-policy/
