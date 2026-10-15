import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PlatformIcon from '@/components/campaign/PlatformIcon'
import heroBackground from '@/assets/landing/hero-business-background-v1.png'
import CampaignArtwork from './CampaignArtwork'

/** Demonstration only: no API calls, generated assets or publication actions. */
export default function HeroSection() {
  return (
    <section className="landing-hero pt-28 pb-16 md:pt-40 md:pb-24" style={{ '--hero-photo': `url(${heroBackground})` }}>
      <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-6 md:px-10 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
        <div className="hero-introduction">
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Del negocio a sus clientes
          </p>
          <h1 className="mb-6 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight text-on-surface md:text-6xl">
            Tus ideas, convertidas en <span className="text-primary">campañas.</span>
          </h1>
          <p className="mb-8 max-w-xl text-lg leading-relaxed text-on-surface-variant">
            Crea contenido con IA, trabaja las propuestas con tu cliente y lleva
            cada campaña a sus redes. Todo en un mismo espacio, con la aprobación
            siempre en manos de las personas.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/login">
              <Button className="shadow-sm">Crear mi campaña <ArrowRight className="h-4 w-4" /></Button>
            </Link>
            <a href="#como-funciona">
              <Button variant="ghost">Ver el proceso <ArrowDown className="h-4 w-4" /></Button>
            </a>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <span className="text-sm text-on-surface-variant">Conecta tus canales</span>
            {['facebook', 'instagram', 'twitter', 'tiktok'].map(platform => (
              <PlatformIcon key={platform} platform={platform} className="h-5 w-5" />
            ))}
          </div>
        </div>
        <div className="hero-campaign-preview" aria-label="NexoMark: de la idea al contenido aprobado">
          <div className="hero-preview-caption"><span>CREACIÓN CONECTADA</span><span>NEXOMARK</span></div>
          <div className="hero-campaign-art"><CampaignArtwork /></div>
          <div className="hero-preview-brief"><span className="story-eyebrow">Tu próximo paso</span><p>Una idea.<br />Todo conectado.</p></div>
          <div className="hero-preview-footer"><span><Check size={15} aria-hidden="true" /> La última palabra es tuya.</span><span>El flujo de NexoMark</span></div>
        </div>
      </div>
    </section>
  )
}
