import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { prepareLegalSite } from './prepare-legal-site.mjs'

/**
 * Copia el sitio legal (solo los archivos permitidos por el preparador de Pages) a
 * frontend/public/legal, que la web sirve como /legal/. Reutiliza el mismo preparador
 * para que las dos salidas tengan exactamente la misma lista de archivos y validen sus
 * enlaces igual. Permite los borradores: la decisión de subir y publicar sigue siendo de
 * los responsables (un push a remejora despliega la web en Vercel).
 *
 * Uso (desde frontend/): npm run legal:sync
 */
const source = fileURLToPath(new URL('../legal-site/', import.meta.url))
const target = fileURLToPath(new URL('../frontend/public/legal/', import.meta.url))

await rm(target, { recursive: true, force: true })
const { files } = await prepareLegalSite({ source, target, allowDrafts: true })
console.log(`frontend/public/legal actualizado (${files.length} archivos)`)
