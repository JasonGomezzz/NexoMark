# Documentos de NexoMark — borradores

Actualizado el 30 de octubre de 2026. La versión del repositorio es el borrador
**v0.12**, sin fecha de vigencia ni aprobación legal. `historial/` conserva v0.1
a v0.11; solo se adaptan sus enlaces para consultarlos desde esa carpeta.
Los responsables y el correo público del proyecto fueron confirmados por el usuario.
No se incluyen contraseñas, claves, bases de datos ni campañas reales.

## Repositorio y sitio publicado

El repositorio actual es `JasonGomezzz/NexoMark`; la rama de trabajo es `piero`.
La PR #1 incorporó los documentos y el workflow a la rama principal. Se verificó
históricamente un despliegue de v0.10 en
https://jasongomezzz.github.io/MarketMind-Voice/ . Ese antecedente no confirma qué
versión sirve hoy Pages ni que la URL siga siendo la misma tras renombrar el repo.

El workflow `.github/workflows/legal-pages.yml` es **manual**. Subir commits a
`piero` no actualiza el sitio publicado ni da vigencia a los documentos. Para
desplegarlos después, consultar `PAGES_SETUP.md` y comprobar la URL que emita Pages.
En esta actualización no se ejecuta ese despliegue ni se envía la app a revisión.

## Funciones reflejadas

- Acceso web, Google web configurado, edición de perfil, foto opcional y
  verificaciones de cambios de correo y contraseña. La configuración no implica
  que todas las cuentas de Google estén autorizadas en producción.
- Generación con IA, revisión del cliente y publicación web confirmada por el usuario.
- TikTok: autorización y envío probados en Sandbox; el propietario termina de
  publicar en TikTok. Se verificaron vinculación y contadores de una publicación
  existente. No se implementó Direct Post ni se acredita aprobación de producción.
- Estadísticas de publicaciones registradas, con fechas de medición, avisos de
  datos incompletos y disponibilidad. La API de X identificó un registro no
  encontrado; se excluye de los totales conservando el historial.
- Sincronización web de Facebook, Instagram y TikTok con espera mínima de cinco
  minutos; X mantiene consulta manual con presupuesto. Facebook Insights devolvió
  datos vacíos en la prueba real: falta autorizar/verificar `read_insights` y la
  disponibilidad de esos contadores. No se sustituyen por cifras manuales.
- Flutter: compilación, instalación y arranque verificados en un Samsung Galaxy
  A56 el 30/10/2026. No demuestra pruebas completas de ambos roles. Las conexiones,
  publicación y consultas externas se realizan en la web; Google nativo sigue deshabilitado.

## Revisar y preparar

Abrir `index.html`, `privacidad.html` y `terminos.html` directamente o servir esta
carpeta con un servidor estático. Las páginas no requieren sesión ni dependencias.

Desde la raíz del repositorio:

```powershell
node --test scripts/prepare-legal-site.test.mjs
node scripts/prepare-legal-site.mjs "$env:TEMP/nexomark-legal-preview-v012" --allow-drafts
```

Usar una carpeta de salida nueva: el preparador no sobrescribe directorios.
Solo incluye HTML permitido, estilos e historial; valida enlaces y rechaza
borradores por defecto si no se indica `--allow-drafts`.

## Pendientes antes de dar vigencia

- Revisar el texto por los responsables, las prácticas reales y las condiciones aplicables.
- Verificar modalidad de Gemini, condiciones externas y ubicaciones de procesamiento.
  Los créditos internos no acreditan precios ni saldo del proveedor.
- Organizar acceso seguro al buzón público y registro privado de solicitudes.
- Verificar atención de solicitudes y eliminación de datos, incluidos respaldos.
- Revisar conservación y custodia de copias. Se probó históricamente un respaldo
  manual PostgreSQL y su restauración separada; no consta una rutina periódica,
  rotación automática ni segunda copia externa verificada. Ver `../scripts/POSTGRES_BACKUP.md`.
- Comprobar la entrega actual de correos. Hay configuración de Gmail SMTP y Resend
  mediante n8n, pero esta actualización documental no realiza envíos de prueba.
- Confirmar calendario académico y continuidad. No existe un cierre ni borrado
  automático por una fecha de evaluación.

La aplicación y su base siguen ejecutándose en la laptop para pruebas. El uso
de Gemini, redes, correo y ngrok puede involucrar servicios externos. GitHub
Pages aloja estos documentos, no Django, Spring ni PostgreSQL. Obsidian y los
documentos privados de contexto permanecen fuera del repositorio.

`CAMBIOS.md` registra las revisiones. Actualizar documentos no implementa funciones
ni cambia por sí mismo el tratamiento autorizado o la aprobación de las redes.
