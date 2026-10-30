# GitHub Pages para documentos de NexoMark

Actualizado el 30 de octubre de 2026. Repositorio: `JasonGomezzz/NexoMark`.
Versión preparada en el repositorio: borrador v0.12, sin vigencia.

La PR #1 ya fue fusionada a la rama principal. La ejecución histórica
`38188212909` desplegó borradores v0.10 y se comprobó entonces
https://jasongomezzz.github.io/MarketMind-Voice/ . Tras el cambio de nombre del
repositorio debe comprobarse la URL actual en Settings → Pages o en el resultado
de un despliegue; no se presupone que esa dirección histórica siga activa.

## Subir código y desplegar son pasos distintos

`.github/workflows/legal-pages.yml` solo tiene `workflow_dispatch`: no se ejecuta
por push ni por PR. Subir los archivos a `piero` no despliega el sitio ni actualiza
la rama principal. Esta actualización no cambia la fuente de Pages, la rama por
defecto ni sus permisos, y no lanza el workflow.

## Despliegue manual posterior

1. Revisar los textos y el commit de la rama que se pretende publicar.
2. En Settings → Pages, comprobar la fuente **GitHub Actions** ya configurada y
   la URL del sitio. El environment `github-pages` debe permitir esa rama.
3. En Actions → Publicar documentos NexoMark → Run workflow, seleccionar la rama
   revisada. El workflow debe estar presente en la rama predeterminada para
   ofrecer ejecución manual; no hace falta cambiar esa rama ni fusionar todo `piero`.
4. Marcar `confirm_publication` solo con autorización para publicar documentos,
   nombres y correo. Para borradores, `allow_drafts` mantiene los avisos visibles;
   si no se marca, el preparador bloquea los textos con borradores o pendientes.
5. Autorizar el environment si existe revisor y esperar a que finalice el despliegue.
6. Abrir la URL exacta emitida por GitHub y comprobar sin sesión las rutas de
   privacidad y términos, versión, avisos, enlaces y vista móvil.

## Qué se publica

El preparador incluye únicamente `index.html`, `privacidad.html`, `terminos.html`,
`styles.css` e historial HTML permitido, y comprueba los enlaces locales. No
publica README, CAMBIOS, estas instrucciones, la raíz del repo, Obsidian,
credenciales ni datos de usuarios. Los archivos subidos al repositorio público
sí son visibles en el código y su historial, aunque no formen parte de Pages.

El workflow usa un token temporal con permisos limitados; no requiere claves de
redes ni un token personal guardado. No seleccionar la raíz del proyecto como
contenido estático del sitio.

## Uso en integraciones

Antes de usar las URLs en TikTok u otra red, comprobar que las páginas publicadas
son accesibles y reflejan el proyecto. Publicar borradores no los convierte en
políticas vigentes ni acredita aprobación de producción. Pages no sustituye una
aplicación funcional ni el callback HTTPS de las conexiones.

Referencias:

- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow
