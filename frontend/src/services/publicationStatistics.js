const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

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
