import test from 'node:test'
import assert from 'node:assert/strict'
import { monthLabel, monthlyChartData, platformComparisonData } from '../src/services/publicationStatistics.js'

test('months use unambiguous Spanish labels in calendar order', () => {
  assert.deepEqual(Array.from({ length: 12 }, (_, i) => monthLabel(`2026-${String(i + 1).padStart(2, '0')}`)),
    ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'])
  for (const value of [null, '', '2026-00', '2026-13', '2026-1']) assert.equal(monthLabel(value), '—')
})

test('comparison always includes exactly four active networks in a stable order', () => {
  const rows = platformComparisonData({ linkedin: { publications: 99 }, google_ads: { publications: 99 } }, 'publications')
  assert.deepEqual(rows.map(row => row.platform), ['facebook', 'instagram', 'twitter', 'tiktok'])
  assert.ok(rows.every(row => row.value === null))
})

test('comparison preserves zero, unavailable and partial measurements without estimating', () => {
  const platforms = {
    facebook: { publications: 2, metrics: { likes: { value: 0, covered: 2 }, shares: { value: null, covered: 0 } } },
    instagram: { publications: 3, metrics: { likes: { value: 7, covered: 1 } } },
    twitter: { publications: 0, metrics: { likes: { value: null, covered: 0 } } },
  }
  const likes = platformComparisonData(platforms, 'likes')
  assert.equal(likes[0].value, 0)
  assert.equal(likes[0].partial, false)
  assert.equal(likes[1].value, 7)
  assert.equal(likes[1].partial, true)
  assert.equal(likes[1].status, '1/3 publicaciones con dato')
  assert.equal(likes[2].value, null)
  assert.equal(likes[2].status, 'Sin publicaciones')
  assert.equal(likes[3].value, null)
  assert.equal(likes[3].status, 'No disponible')
  assert.equal(platformComparisonData(platforms, 'shares')[0].value, null)
  assert.equal(platforms.instagram.metrics.likes.value, 7)
})

test('publication comparison uses confirmed totals, not pending deliveries or metric coverage', () => {
  const rows = platformComparisonData({ facebook: { publications: 3, pending: 5, metrics: {} } }, 'publications')
  assert.equal(rows[0].value, 3)
  assert.equal(rows[0].partial, false)
  assert.equal(rows[0].status, 'Publicaciones confirmadas')
})

test('chart labels preserve actual zeroes and missing measurements', () => {
  const rows = [{ month: '2026-01', facebook: 0 }, { month: '2026-02', facebook: null }]
  const result = monthlyChartData(rows)
  assert.equal(result[0].facebook, 0)
  assert.equal(result[1].facebook, null)
  assert.equal(result[0].name, 'Ene')
  assert.equal(rows[0].name, undefined)
})
