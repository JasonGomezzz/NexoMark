import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getApprovedPublicationCopy } from '../src/services/campaignPublication.js'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('Google Ads cannot prepare publication; historical copy remains intact', () => {
  const campaign = { estado: 'aprobado', textos_por_plataforma: { google_ads: 'Copy histórico', facebook: 'Copy social' } }
  assert.equal(getApprovedPublicationCopy(campaign, 'google_ads'), null)
  assert.equal(campaign.textos_por_plataforma.google_ads, 'Copy histórico')
  assert.equal(getApprovedPublicationCopy(campaign, 'facebook'), 'Copy social')
})

test('active selectors, statistics and the workflow no longer offer Google Ads', () => {
  for (const path of ['../src/pages/NewCampaignPage.jsx', '../src/pages/ClientCampaignsPage.jsx',
    '../src/components/campaign/PublicationStatistics.jsx', '../src/components/campaign/PlatformIcon.jsx',
    '../../n8n/marketmind_ia_workflow.json']) {
    assert.doesNotMatch(read(path), /google_ads|Google Ads|ads\.google\.com/)
  }
  const detail = read('../src/pages/CampaignDetailPage.jsx')
  assert.doesNotMatch(detail, /ads\.google\.com/)
  assert.match(detail, /!\['linkedin', 'google_ads'\]\.includes\(platform\)/)
})
