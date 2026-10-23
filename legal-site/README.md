# Documentos públicos de NexoMark IA — borradores

Estos archivos son borradores para revisión, no políticas vigentes. El borrador v0.10 llegó a
publicarse en GitHub Pages con sus avisos de "no vigente"; la versión actual es la **v0.13**
(22 de octubre de 2026), que describe el código al 21/10: acceso con Google, foto de perfil,
cambio de correo, TikTok y la app para Android e iOS.
Los nombres de los responsables y el correo del proyecto son visibles en el repositorio público.
El workflow de Pages es manual y bloquea borradores por defecto. Consultar `PAGES_SETUP.md`.

## Contenido

| Archivo | Para qué |
|---|---|
| `index.html` | Índice con enlaces a los tres documentos |
| `privacidad.html` | Política de privacidad (URL que piden Meta, TikTok y X) |
| `terminos.html` | Términos de servicio (Meta los exige para pasar a modo Live) |
| `eliminacion-datos.html` | Instrucciones de eliminación de datos (campo "User data deletion" de Meta) |
| `historial/` | Borradores anteriores v0.1–v0.10 y v0.12 (privacidad y términos) con enlaces relativos adaptados |
| `CAMBIOS.md` | Registro de cambios por versión (no se publica) |
| `REQUISITOS-AUDITORIA.md` | Qué piden Meta, TikTok y X, con fuentes, y qué falta (no se publica) |

## Revisar

Abrir `index.html` en un navegador y seguir los enlaces. No requiere servidor ni dependencias.

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
