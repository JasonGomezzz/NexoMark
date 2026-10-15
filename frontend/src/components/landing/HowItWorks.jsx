import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useTransform } from 'motion/react'
import { ArrowRight, Check, FileText, MessageSquare, PenLine } from 'lucide-react'
import PlatformIcon from '@/components/campaign/PlatformIcon'
import CampaignArtwork from './CampaignArtwork'
import { STORY_STAGES, STORY_TRACKS, storyCycleTiming, storyStageAt } from './campaignStory'
import { createStoryPlayback } from './storyPlayback'
import './campaign-story.css'

// A short/mobile viewport or reduced-motion preference gets the complete static story.
const ANIMATED_QUERY = '(min-width: 1100px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)'
const subscribe = callback => {
  const query = window.matchMedia(ANIMATED_QUERY)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}
const getSnapshot = () => window.matchMedia(ANIMATED_QUERY).matches
const getServerSnapshot = () => false
const subscribeVisibility = callback => {
  document.addEventListener('visibilitychange', callback)
  return () => document.removeEventListener('visibilitychange', callback)
}
const getVisibility = () => document.visibilityState !== 'hidden'
const getServerVisibility = () => true
const PLAYBACK_LABELS = {
  ready: 'Lista para comenzar',
  playing: 'Reproducción automática continua',
  paused: 'En pausa',
  suspended: 'Se reanudará al volver',
}
const CHANNELS = [
  ['facebook', 'Facebook', 'Página del negocio'],
  ['instagram', 'Instagram', 'Cuenta profesional'],
  ['twitter', 'X', 'Texto e imagen'],
  ['tiktok', 'TikTok', 'Finaliza en su app'],
]

function StoryTitleFrame({ progress, stage, index }) {
  const windows = [[0, .18, .25, 1], [0, .18, .25, .46, .53, 1], [0, .46, .53, .72, .79, 1], [0, .72, .79, 1]]
  const opacity = useTransform(progress, windows[index], index === 0 ? [1, 1, 0, 0] : index === 3 ? [0, 0, 1, 1] : [0, 0, 1, 1, 0, 0])
  const y = useTransform(progress, windows[index], index === 0 ? [0, 0, -16, -16] : index === 3 ? [16, 16, 0, 0] : [16, 16, 0, 0, -16, -16])
  return <motion.span className="story-title-frame" style={{ opacity, y }}>{stage.headline[0]}<br /><span>{stage.headline[1]}</span></motion.span>
}

function StoryIntro({ progress }) {
  return <>
    <p className="story-eyebrow">Así trabaja NexoMark</p>
    {progress ? <h2 id="campaign-story-title">
      <span className="sr-only">Tu idea, conectada de principio a fin.</span>
      <span className="story-title-first" aria-hidden="true">Tu idea.</span>
      <span className="story-title-frames" aria-hidden="true">{STORY_STAGES.map((stage, index) => <StoryTitleFrame key={stage.id} progress={progress} stage={stage} index={index} />)}</span>
    </h2> : <h2 id="campaign-story-title">Una idea.<br />Todo un<br /><span>recorrido.</span></h2>}
    <p className="story-intro-description">Del primer brief al contenido aprobado. Sin perder el hilo, ni el control.</p>
  </>
}

function BriefCard() {
  return <>
    <div className="story-card-heading"><FileText size={16} /><span>Brief del negocio</span><span>01</span></div>
    <span className="story-eyebrow">Todo empieza aquí</span>
    <h3>Tu idea, con<br />una dirección.</h3>
    <dl className="story-brief-fields">
      <div><dt>Negocio</dt><dd>Lo que te hace diferente</dd></div>
      <div><dt>Público</dt><dd>A quién quieres llegar</dd></div>
      <div><dt>Objetivo</dt><dd>Lo que quieres comunicar</dd></div>
    </dl>
    <span className="story-card-signature">Una idea que merece contarse.</span>
  </>
}

function CopyCard() {
  return <>
    <div className="story-card-heading"><PenLine size={16} /><span>Texto de campaña</span></div>
    <span className="story-eyebrow">El mensaje</span>
    <h3>Tu mensaje.<br />Con intención.</h3>
    <p className="story-copy-body">Texto que parte de tu idea y toma forma según tu público, tu tono y tu canal.</p>
    <span className="story-card-signature">Creado con IA. Revisado por ti.</span>
  </>
}

function Approval() {
  return <div className="story-approval-content">
    <span className="story-approval-check"><Check size={18} /></span>
    <div><span>Revisión del cliente</span><strong>Contenido aprobado</strong></div>
    <MessageSquare size={17} className="story-approval-message" />
  </div>
}

function useTrack(progress, name) {
  const { input, output } = STORY_TRACKS[name]
  return useTransform(progress, input, output)
}

function StoryScene({ progress }) {
  const briefOpacity = useTrack(progress, 'briefOpacity')
  const briefY = useTrack(progress, 'briefY')
  const briefScale = useTrack(progress, 'briefScale')
  const opacity = useTrack(progress, 'contentOpacity')
  const copyX = useTrack(progress, 'copyX')
  const copyY = useTrack(progress, 'copyY')
  const copyRotate = useTrack(progress, 'copyRotate')
  const imageX = useTrack(progress, 'imageX')
  const imageY = useTrack(progress, 'imageY')
  const imageRotate = useTrack(progress, 'imageRotate')
  const scale = useTrack(progress, 'contentScale')
  const groupX = useTrack(progress, 'groupX')
  const reviewOpacity = useTrack(progress, 'reviewOpacity')
  const reviewY = useTrack(progress, 'reviewY')
  const reviewScale = useTrack(progress, 'reviewScale')
  const connections = useTrack(progress, 'connections')

  return (
    <div className="story-scene" aria-hidden="true">
      <svg className="story-connectors" viewBox="0 0 640 440" fill="none">
        {CHANNELS.map(([key], i) => <motion.path key={key}
          d={`M 399 205 H 434 Q 450 205 450 ${i < 2 ? 189 : 221} V ${94 + i * 72} Q 450 ${78 + i * 72} 466 ${78 + i * 72} H 496`}
          stroke="var(--color-primary)" strokeWidth="1.5" style={{ pathLength: connections, opacity: connections }} />)}
      </svg>
      <motion.div className="story-card story-brief" style={{ opacity: briefOpacity, y: briefY, scale: briefScale }}><BriefCard /></motion.div>
      <motion.div className="story-content-pair" style={{ x: groupX }}>
        <motion.div className="story-card story-copy" style={{ opacity, x: copyX, y: copyY, rotate: copyRotate, scale }}><CopyCard /></motion.div>
        <motion.div className="story-card story-image" style={{ opacity, x: imageX, y: imageY, rotate: imageRotate, scale }}><CampaignArtwork /></motion.div>
        <motion.div className="story-approval" style={{ opacity: reviewOpacity, y: reviewY, scale: reviewScale }}><Approval /></motion.div>
      </motion.div>
      {CHANNELS.map(([key, label, detail], i) => <StoryChannel key={key} progress={progress} index={i} platform={key} label={label} detail={detail} />)}
    </div>
  )
}

function StoryChannel({ progress, index, platform, label, detail }) {
  const start = 0.76 + index * 0.025
  const opacity = useTransform(progress, [0, start, start + 0.08, 1], [0, 0, 1, 1])
  const x = useTransform(progress, [0, start, start + 0.08, 1], [22, 22, 0, 0])
  return <motion.div className="story-channel" style={{ top: 52 + index * 72, opacity, x }}>
    <PlatformIcon platform={platform} className="h-5 w-5" />
    <div><strong>{label}</strong><span>{detail}</span></div>
  </motion.div>
}

function AnimatedStory() {
  const target = useRef(null)
  const [active, setActive] = useState(0)
  const progress = useMotionValue(0)
  const inView = useInView(target, { amount: 0.6 })
  const documentVisible = useSyncExternalStore(subscribeVisibility, getVisibility, getServerVisibility)
  const [playback] = useState(() => createStoryPlayback({
    getProgress: () => progress.get(),
    setProgress: value => progress.set(value),
    animateToEnd: onComplete => animate(progress, [progress.get(), 1, 1], {
      ...storyCycleTiming(progress.get()), ease: 'linear', onComplete,
    }),
  }))
  const status = useSyncExternalStore(playback.subscribe, playback.getSnapshot, playback.getSnapshot)

  useEffect(() => {
    playback.setVisible(inView && documentVisible)
    // Stop on exit, hidden tab, reduced-motion switch or unmount, retaining position.
    return () => playback.setVisible(false)
  }, [playback, inView, documentVisible])

  useMotionValueEvent(progress, 'change', value => setActive(previous => {
    const next = storyStageAt(value)
    return previous === next ? previous : next
  }))

  function goToStage(index) {
    // Selecting a chapter continues the automatic sequence without moving the page.
    playback.seek(STORY_STAGES[index].position)
    playback.play()
  }

  return <section ref={target} id="como-funciona" className="campaign-story campaign-story--animated" aria-labelledby="campaign-story-title">
    <div className="story-playback-layout">
      <div className="story-inner">
        <div className="story-editorial">
          <StoryIntro progress={progress} />
          <ol className="story-chapters" aria-label="Etapas del ejemplo">
            {STORY_STAGES.map((stage, index) => <li key={stage.id}>
              <button type="button" onClick={() => goToStage(index)} aria-current={active === index ? 'step' : undefined} aria-label={`Ver etapa ${index + 1}: ${stage.title}`}>
                <span className="story-chapter-index">0{index + 1}</span><span>{stage.title}</span><ArrowRight size={14} aria-hidden="true" />
              </button>
            </li>)}
          </ol>
          <p className="story-playback-status" role="status">{PLAYBACK_LABELS[status]}</p>
        </div>
        <div className="story-demonstration">
          <div className="story-scene-heading"><span>NEXOMARK · UN PROCESO CONECTADO</span><span>0{active + 1} / 04</span></div>
          <div className="story-canvas"><StoryScene progress={progress} /></div>
          <div className="story-explanation">
            {STORY_STAGES.map((stage, index) => <p key={stage.id} hidden={active !== index}><span>{stage.label}</span>{stage.description}</p>)}
          </div>
          <div className="story-progress" aria-hidden="true"><motion.span style={{ scaleX: progress }} /></div>
          <p className="story-disclaimer">Demostración ilustrativa. No genera contenido ni realiza publicaciones.</p>
        </div>
      </div>
    </div>
  </section>
}

function StaticStory() {
  return <section id="como-funciona" className="campaign-story campaign-story--static" aria-labelledby="campaign-story-title">
    <div className="story-inner">
      <div className="story-editorial"><StoryIntro /><p className="story-disclaimer">El flujo de NexoMark</p></div>
      <ol className="story-static-steps">
        {STORY_STAGES.map((stage, index) => <li key={stage.id}>
          <div className="story-static-heading"><span className="story-chapter-index">0{index + 1}</span><h3>{stage.title}</h3></div>
          <p>{stage.description}</p>
          {index === 0 && <div className="story-static-brief">Tu negocio · Tu público · Tu objetivo</div>}
          {index === 1 && <div className="story-static-art"><CampaignArtwork /><blockquote>Tu idea toma forma. Texto e imagen, conectados en una misma propuesta.</blockquote></div>}
          {index === 2 && <div className="story-static-approval"><Approval /></div>}
          {index === 3 && <div className="story-static-channels">{CHANNELS.map(([key, label]) => <span key={key}><PlatformIcon platform={key} />{label}</span>)}</div>}
        </li>)}
      </ol>
    </div>
    <p className="story-disclaimer story-static-disclaimer">Demostración ilustrativa. No genera contenido ni realiza publicaciones.</p>
  </section>
}

export default function HowItWorks() {
  const animate = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return animate ? <AnimatedStory /> : <StaticStory />
}
