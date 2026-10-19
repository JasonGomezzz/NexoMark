import PlatformIcon from './PlatformIcon'

const LABELS = {
  instagram: 'Instagram', facebook: 'Facebook', twitter: 'Twitter / X',
  linkedin: 'LinkedIn (retirada)', google_ads: 'Google Ads (retirada)', tiktok: 'TikTok',
}

export default function CampaignPlatforms({ campaign }) {
  const platforms = campaign.plataformas?.length ? campaign.plataformas : [campaign.plataforma]
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {platforms.filter(Boolean).map(platform => (
        <span key={platform} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <PlatformIcon platform={platform} className="h-4 w-4" />
          <span>{LABELS[platform] || platform}</span>
        </span>
      ))}
    </span>
  )
}
