import test from 'node:test'
import assert from 'node:assert/strict'
import { monthLabel, monthlyChartData, platformComparisonData, platformMonthlyData, statisticsHistory } from '../src/services/publicationStatistics.js'

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

test('platform detail has twelve months, preserving zero and missing likes separately', () => {
  const data = { year: 2026,
    monthly: [{ month: '2026-01', instagram: 2 }, { month: '2026-02', instagram: 0 }],
    monthly_likes: [{ month: '2026-01', instagram: 0, instagram_covered: 1, instagram_publications: 2 },
      { month: '2026-02', instagram: null, instagram_covered: 0, instagram_publications: 0 }],
  }
  const rows = platformMonthlyData(data, 'instagram')
  assert.equal(rows.length, 12)
  assert.equal(rows[0].name, 'Ene')
  assert.equal(rows[0].publications, 2)
  assert.equal(rows[0].likes, 0)
  assert.equal(rows[0].covered, 1)
  assert.equal(rows[0].total, 2)
  assert.equal(rows[1].publications, 0)
  assert.equal(rows[1].likes, null)
  assert.equal(rows[11].month, '2026-12')
  assert.equal(rows[11].likes, null)
  assert.equal(rows[11].publications, null)
  assert.deepEqual(platformMonthlyData(data, 'linkedin'), [])
})

test('monthly detail never borrows another year or platform', () => {
  const data = { year: 2025, monthly: [{ month: '2026-01', facebook: 99 }],
    monthly_likes: [{ month: '2025-01', tiktok: 99 }] }
  assert.ok(platformMonthlyData(data, 'facebook').every(row => row.publications === null && row.likes === null))
})

test('history follows the selected network and backend Lima calendar year', () => {
  const rows = [
    { platform: 'facebook', registered_at: '2026-01-01T04:59:59Z', id: 1 },
    { platform: 'facebook', registered_at: '2026-01-01T05:00:00Z', id: 2 },
    { platform: 'tiktok', registered_at: '2026-08-01T12:00:00Z', id: 3 },
    { platform: 'twitter', registered_at: 'invalid', id: 4 },
  ]
  assert.deepEqual(statisticsHistory(rows, 2026, 'facebook').map(row => row.id), [2])
  assert.deepEqual(statisticsHistory(rows, 2025, 'facebook').map(row => row.id), [1])
  assert.deepEqual(statisticsHistory(rows, 2026).map(row => row.id), [2, 3])
  assert.equal(rows.length, 4)
})
