import { lstat, readFile, readdir, mkdir, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// eliminacion-datos.html is the "data deletion instructions URL" Meta asks for.
export const ROOT_FILES = [
  'index.html', 'privacidad.html', 'terminos.html', 'cookies.html', 'compras.html', 'arrepentimiento.html',
  'reclamos.html', 'responsables.html', 'eliminacion-datos.html', 'styles.css',
]

export async function prepareLegalSite({ source, target, allowDrafts = false }) {
  source = path.resolve(source)
  target = path.resolve(target)
  const relativeTarget = path.relative(source, target)
  const targetOutside = relativeTarget === '..' || relativeTarget.startsWith(`..${path.sep}`) || path.isAbsolute(relativeTarget)
  if (!relativeTarget || !targetOutside) {
    throw new Error('La salida debe estar fuera de la carpeta fuente.')
  }
  if (!(await lstat(source)).isDirectory() || (await lstat(source)).isSymbolicLink()) {
    throw new Error('La fuente debe ser una carpeta real, no un enlace.')
  }
  try { await access(target); throw new Error('La salida ya existe; no se sobrescribe.') }
  catch (error) { if (error.code !== 'ENOENT') throw error }

  const files = new Map()
  async function add(relative) {
    const file = path.join(source, relative)
    const stat = await lstat(file)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Archivo no permitido: ${relative}`)
    files.set(relative.replaceAll(path.sep, '/'), await readFile(file, 'utf8'))
  }
  for (const file of ROOT_FILES) await add(file)
  const history = path.join(source, 'historial')
  const historyStat = await lstat(history)
  if (!historyStat.isDirectory() || historyStat.isSymbolicLink()) throw new Error('Historial no permitido.')
  for (const name of await readdir(history)) {
    if (/^(privacidad|terminos)-v\d+\.\d+-\d{4}-\d{2}-\d{2}\.html$/.test(name)) await add(`historial/${name}`)
  }
  const currentDocuments = ROOT_FILES.filter(name => name.endsWith('.html')).map(name => files.get(name))
  const drafts = currentDocuments.some(html => /borrador|class="pending"/i.test(html))
  if (drafts && !allowDrafts) throw new Error('Los textos tienen borradores o pendientes. Publicación bloqueada sin --allow-drafts.')

  // Validate references against the exact allowlist. Never deploy the repository root.
  for (const [name, text] of files) {
    if (!name.endsWith('.html')) continue
    for (const match of text.matchAll(/href="([^"]+)"/g)) {
      const href = match[1]
      if (/^(https?:|mailto:|#)/i.test(href)) continue
      const destination = path.posix.normalize(path.posix.join(path.posix.dirname(name), href.split(/[?#]/)[0]))
      if (!files.has(destination)) throw new Error(`Enlace local fuera del sitio: ${name} -> ${href}`)
    }
  }
  await mkdir(target, { recursive: true })
  for (const [name, text] of files) {
    const destination = path.join(target, name)
    await mkdir(path.dirname(destination), { recursive: true })
    await writeFile(destination, text, { flag: 'wx', encoding: 'utf8' })
  }
  await writeFile(path.join(target, '.nojekyll'), '', { flag: 'wx' })
  return { files: [...files.keys(), '.nojekyll'], drafts }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const destinations = args.filter(arg => !arg.startsWith('--'))
  const target = destinations[0]
  if (destinations.length !== 1 || args.some(arg => arg.startsWith('--') && arg !== '--allow-drafts')) {
    console.error('Uso: node scripts/prepare-legal-site.mjs <carpeta-nueva> [--allow-drafts]')
    process.exitCode = 1
  } else {
    try {
      const result = await prepareLegalSite({
        source: fileURLToPath(new URL('../legal-site/', import.meta.url)), target,
        allowDrafts: args.includes('--allow-drafts'),
      })
      console.log(JSON.stringify(result, null, 2))
    } catch (error) { console.error(error.message); process.exitCode = 1 }
  }
}
