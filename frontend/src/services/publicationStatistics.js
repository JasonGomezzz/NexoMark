const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function publicationsToSynchronize(rows = [], now = Date.now()) {
  const stale = timestamp => !timestamp || now - new Date(timestamp).getTime() >= 300000
  return rows.filter(row => row.can_refresh && ['facebook', 'instagram', 'tiktok'].includes(row.platform)
    && stale(row.checked_at) && stale(row.measured_at))
}

export function monthLabel(value) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return '—'
  return months[Number(value.slice(5)) - 1]
}

export function monthlyChartData(rows = []) {
  return rows.map(row => ({ ...row, name: monthLabel(row.month) }))
}

export const comparisonPlatforms = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'twitter', label: 'X' },
  { key: 'tiktok', label: 'TikTok' },
]

// Missing measurements remain null: a missing API counter is never a zero.
export function platformComparisonData(platforms = {}, metric) {
  return comparisonPlatforms.map(({ key, label }) => {
    const group = platforms[key]
    const publications = group?.publications ?? null
    const measured = group?.metrics?.[metric]
    const value = metric === 'publications' ? publications : measured?.value ?? null
    const covered = metric === 'publications' ? publications : measured?.covered ?? 0
    return {
      platform: key, name: label, value, covered, publications,
      partial: value != null && covered < publications,
      status: metric !== 'publications' && publications === 0 ? 'Sin publicaciones'
        : value == null ? 'No disponible'
          : metric === 'publications' ? 'Publicaciones confirmadas'
            : `${covered}/${publications ?? '—'} publicaciones con dato`,
    }
  })
}

export function platformMonthlyData(data, platform) {
  if (!comparisonPlatforms.some(row => row.key === platform)) return []
  return months.map((name, index) => {
    const month = `${data.year}-${String(index + 1).padStart(2, '0')}`
    const publications = data.monthly?.find(row => row.month === month)
    const likes = data.monthly_likes?.find(row => row.month === month)
    return {
      month, name, publications: publications?.[platform] ?? null,
      likes: likes?.[platform] ?? null,
      covered: likes?.[`${platform}_covered`] ?? 0,
      total: likes?.[`${platform}_publications`] ?? publications?.[platform] ?? null,
    }
  })
}

export function statisticsHistory(rows, year, platform = null) {
  // Match the backend's publication_month(), independent of the browser timezone.
  const calendar = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'America/Lima' })
  return rows.filter(row => {
    if (platform && row.platform !== platform) return false
    const date = new Date(row.registered_at)
    return !Number.isNaN(date.getTime()) && Number(calendar.format(date)) === Number(year)
  })
}

export function campaignLikesRanking(rows = [], year, platform = null) {
  const campaigns = new Map()
  for (const row of statisticsHistory(rows, year, platform)) {
    if (row.included_in_totals === false) continue
    if (!comparisonPlatforms.some(item => item.key === row.platform)) continue
    if (!Number.isSafeInteger(row.campaign_id) || row.campaign_id <= 0) continue
    const group = campaigns.get(row.campaign_id) ?? {
      campaignId: row.campaign_id, title: row.title, likes: 0, covered: 0, publications: 0,
    }
    const count = Number.isSafeInteger(row.publication_count) && row.publication_count > 0 ? row.publication_count : 1
    group.publications += count
    // A missing or invalid counter must not promote an unmeasured campaign as zero.
    if (Number.isSafeInteger(row.metrics?.likes) && row.metrics.likes >= 0) {
      group.likes += row.metrics.likes
      group.covered += count
    }
    campaigns.set(row.campaign_id, group)
  }
  const measured = [...campaigns.values()].filter(row => row.covered > 0)
    .sort((a, b) => b.likes - a.likes || a.campaignId - b.campaignId)
  let rank = 0
  const ranked = measured.map((row, index) => {
    if (index === 0 || measured[index - 1].likes !== row.likes) rank = index + 1
    return {
      ...row, rank,
      tied: measured[index - 1]?.likes === row.likes || measured[index + 1]?.likes === row.likes,
      partial: row.covered < row.publications,
    }
  })
  return {
    campaigns: ranked.slice(0, 3),
    excluded: campaigns.size - measured.length,
    incomplete: [...campaigns.values()].some(row => row.covered < row.publications),
    total: campaigns.size,
    tiedAtCutoff: ranked.length > 3 && ranked[2].likes === ranked[3].likes,
  }
}
