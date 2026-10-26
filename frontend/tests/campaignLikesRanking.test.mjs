import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { campaignLikesRanking } from '../src/services/publicationStatistics.js'

const post = (campaignId, likes, extra = {}) => ({
  campaign_id: campaignId, title: `Campaña ${campaignId}`, platform: 'facebook',
  registered_at: '2026-10-01T12:00:00Z', metrics: { likes }, ...extra,
})

test('ranking sums publications and versions by campaign, never individual leaderboard posts', () => {
  const rows = [post(1, 5), post(1, 8, { platform: 'instagram', version: 2 }),
    post(2, 10), post(3, 7), post(4, 1)]
  const result = campaignLikesRanking(rows, 2026)
  assert.deepEqual(result.campaigns.map(row => [row.campaignId, row.likes]), [[1, 13], [2, 10], [3, 7]])
  assert.equal(result.campaigns[0].publications, 2)
  assert.equal(result.total, 4)
  assert.equal(result.incomplete, false)
  assert.equal(rows[0].likes, undefined)
})

test('ranking follows platform and year including Lima year boundary', () => {
  const rows = [post(1, 5), post(1, 100, { platform: 'tiktok' }),
    post(2, 999, { registered_at: '2026-01-01T04:59:59Z' }), post(3, 888, { platform: 'google_ads' })]
  const result = campaignLikesRanking(rows, 2026, 'facebook')
  assert.equal(result.total, 1)
  assert.equal(result.campaigns[0].likes, 5)
  assert.equal(campaignLikesRanking(rows, 2025, 'facebook').campaigns[0].likes, 999)
  assert.equal(campaignLikesRanking(rows, 2026).campaigns[0].likes, 105)
})

test('unknown counters are excluded, actual zero is ranked and partial coverage remains visible', () => {
  const result = campaignLikesRanking([post(1, null), post(2, 0), post(3, 8), post(3, null)], 2026)
  assert.equal(result.excluded, 1)
  assert.equal(result.incomplete, true)
  assert.deepEqual(result.campaigns.map(row => row.campaignId), [3, 2])
  assert.equal(result.campaigns[0].partial, true)
  assert.equal(result.campaigns[0].covered, 1)
  assert.equal(result.campaigns[0].publications, 2)
  assert.equal(result.campaigns[1].likes, 0)
  assert.equal(result.campaigns[1].partial, false)
})

test('multi-post deliveries preserve backend counter and coverage semantics', () => {
  const result = campaignLikesRanking([post(1, 12, { publication_count: 2 }), post(1, null)], 2026)
  assert.equal(result.campaigns[0].likes, 12)
  assert.equal(result.campaigns[0].publications, 3)
  assert.equal(result.campaigns[0].covered, 2)
})

test('ties share rank, use a stable ID order and disclose a tie at the top-three cutoff', () => {
  const result = campaignLikesRanking([post(4, 5), post(3, 5), post(2, 5), post(1, 8)], 2026)
  assert.deepEqual(result.campaigns.map(row => [row.campaignId, row.rank, row.tied]), [[1, 1, false], [2, 2, true], [3, 2, true]])
  assert.equal(result.tiedAtCutoff, true)
})

test('empty and invalid measurements do not create fabricated scores', () => {
  assert.deepEqual(campaignLikesRanking([], 2026), { campaigns: [], excluded: 0, incomplete: false, total: 0, tiedAtCutoff: false })
  const result = campaignLikesRanking([post(1, '12'), post(2, -1), post(3, NaN), post(4, undefined)], 2026)
  assert.equal(result.campaigns.length, 0)
  assert.equal(result.excluded, 4)
  assert.equal(result.incomplete, true)
})

test('ranking is dashboard-only, reuses selected filters and does not call a provider', () => {
  const component = readFileSync(new URL('../src/components/campaign/CampaignLikesRanking.jsx', import.meta.url), 'utf8')
  const parent = readFileSync(new URL('../src/components/campaign/PublicationStatistics.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(component, /fetch\(|api\.|axios|useEffect|setInterval/)
  assert.match(component, /Sin|sin mediciones/)
  assert.match(parent, /!campaignId && <CampaignLikesRanking rows=\{data.publications\} year=\{year\} platform=\{selectedPlatform\}/)
})
