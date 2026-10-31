import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const light = css.split('@theme {')[1].split('\n}')[0]
const dark = css.split("html[data-theme='dark'] {")[1].split('\n}')[0]
const color = (block, token) => block.match(new RegExp(`--color-${token}: (#[a-f0-9]{6});`, 'i'))?.[1]
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(part => parseInt(part, 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

test('NexoMark palette preserves approved navy and turquoise in dark mode', () => {
  assert.equal(color(dark, 'surface'), '#14283f')
  assert.equal(color(dark, 'primary'), '#17b8ad')
  assert.equal(color(light, 'on-surface'), '#14283f')
  assert.doesNotMatch(css, /#4648d4|#6063ee|#9d76ff|#aeb2ff/i)
})

test('brand text and actions meet WCAG AA contrast in both themes', () => {
  for (const block of [light, dark]) {
    for (const [foreground, background] of [
      ['on-primary', 'primary'], ['on-primary-container', 'primary-container'],
      ['on-surface', 'surface'], ['on-surface-variant', 'surface'],
      ['primary', 'surface'], ['on-primary-fixed', 'primary-fixed'],
    ]) {
      assert.ok(contrast(color(block, foreground), color(block, background)) >= 4.5,
        `${foreground} on ${background} must meet 4.5:1`)
    }
  }
})

test('mobile themes, legal pages and PDF export use the same brand', () => {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
  const flutter = read('../../mobile_flutter/lib/core/theme/tokens.dart')
  const legal = read('../../legal-site/styles.css')
  const pdf = read('../../backend/templates/campaigns/campaign_pdf.html')
  assert.match(flutter, /0xFF17B8AD/)
  assert.match(flutter, /0xFF14283F/)
  for (const source of [legal, pdf]) {
    assert.match(source, /#14283f/i)
    assert.match(source, /#087b75/i)
  }
})

test('campaign demonstration is automatic, labelled, and never calls a service', () => {
  const hero = readFileSync(new URL('../src/components/landing/HeroSection.jsx', import.meta.url), 'utf8')
  const story = readFileSync(new URL('../src/components/landing/HowItWorks.jsx', import.meta.url), 'utf8')
  const gallery = readFileSync(new URL('../src/components/landing/ShowcaseMarquee.jsx', import.meta.url), 'utf8')
  assert.match(hero, /El flujo de NexoMark/)
  assert.match(story, /Brief del negocio/)
  assert.match(story, /Revisión del cliente/)
  assert.match(story, /useInView/)
  assert.doesNotMatch(story, /useScroll|scrollTo/)
  assert.match(story, /prefers-reduced-motion: no-preference/)
  assert.doesNotMatch(story, /fetch\(|axios|setInterval|setTimeout|preventDefault/)
  assert.doesNotMatch(hero, /fetch\(|axios|useEffect|98%|heroImg/)
  assert.doesNotMatch(gallery, /useAnimationFrame|repeat: Infinity/)
  assert.match(css, /--radius-xl: 0\.25rem/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(css, /animation: workflow-progress/)
})

test('comparison charts and public theme toggle follow the active theme', () => {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
  const chart = read('../src/components/campaign/PlatformComparison.jsx')
  const toggle = read('../src/components/ui/ThemeToggle.jsx')
  assert.match(chart, /fill: 'var\(--color-on-surface-variant\)'/)
  assert.match(chart, /backgroundColor: 'var\(--color-surface-container-lowest\)'/)
  assert.match(toggle, /Activar tema claro/)
  assert.match(toggle, /Activar tema oscuro/)
  assert.match(toggle, /onClick=\{toggleTheme\}/)
  const flutter = read('../../mobile_flutter/lib/app.dart')
  const preferences = read('../../mobile_flutter/lib/core/preferences.dart')
  assert.match(preferences, /ThemeMode.system/)
  assert.match(flutter, /darkTheme: buildTheme\(Brightness.dark\)/)
  assert.match(flutter, /theme: buildTheme\(Brightness.light\)/)
})

test('comparison series are distinct and readable on both chart themes', () => {
  const chartLight = css.split('@theme static {')[1].split('\n}')[0] + light
  for (const block of [chartLight, dark]) {
    const series = ['facebook', 'instagram', 'twitter', 'tiktok'].map(key => color(block, `chart-${key}`))
    assert.equal(new Set(series).size, 4)
    for (const foreground of series) assert.ok(contrast(foreground, color(block, 'surface-container-low')) >= 3)
  }
})

test('photographic hero background is a local asset with overlays for both themes', () => {
  const image = readFileSync(new URL('../src/assets/landing/hero-business-background-v1.png', import.meta.url))
  assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.match(css, /var\(--hero-photo\)/)
  assert.match(css, /html\[data-theme='dark'\] \.landing-hero/)
  assert.match(css, /background-repeat: no-repeat/)
})
