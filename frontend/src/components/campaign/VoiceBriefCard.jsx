import { Cloud, Laptop, Mic, PenLine, Square } from 'lucide-react'
import { avisoProcesamiento, MAX_BRIEF, PROCESAMIENTO, unsupportedMessage } from '../../services/voiceIntent'
import { cn } from '@/lib/utils'

/**
 * Paso Dictar (dirección "Conforme"): lo que dices se escribe sobre el pliego
 * como un párrafo continuo, igual que una prueba de imprenta. Lo provisional va
 * en tinta tenue con cursor. El micrófono es un sello: mientras escucha, su aro
 * dice «escuchando · mm:ss» y gira despacio. "Prefiero escribir" cambia a un
 * área de texto grande. El estado vive en `useBriefDictado` (lo tiene la página,
 * que pinta al lado la ficha técnica con "Completar ficha").
 * La Web Speech API no entrega el nivel de voz: el sello no finge un medidor.
 */
const reloj = (segundos) => `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`

function AroSello({ texto }) {
  return (
    <svg viewBox="0 0 132 132" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <path id="aro-sello" d="M66 66 m-55 0 a55 55 0 1 1 110 0 a55 55 0 1 1 -110 0" />
      </defs>
      <circle cx="66" cy="66" r="64" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" />
      <circle cx="66" cy="66" r="46" fill="none" stroke="var(--color-primary)" strokeWidth="1" />
      <text className="fill-primary text-[11px] font-semibold tracking-[0.06em]">
        <textPath href="#aro-sello" textLength="340">
          {texto}
        </textPath>
      </text>
    </svg>
  )
}

export default function VoiceBriefCard({ brief, disabled }) {
  const { texto, escribiendo, interpretando, error, segundos, voz } = brief
  const ocupado = disabled || interpretando
  const vacio = !texto.trim() && !voz.interim
  const aro = voz.listening ? `escuchando · ${reloj(segundos)} · escuchando · ${reloj(segundos)} ·` : 'toca para dictar · toca para dictar ·'

  return (
    <section aria-label="Brief de la campaña" className="flex min-w-0 flex-col">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] text-on-surface-variant">
          {escribiendo ? 'Escribe la idea como se la contarías a tu diseñador.' : 'Lo que dices se escribe aquí, como una prueba.'}
        </p>
        <button
          type="button"
          onClick={brief.alternarEscritura}
          disabled={ocupado}
          className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-outline-variant px-4 text-sm font-semibold text-on-surface transition-colors hover:border-outline hover:bg-surface-container-low disabled:opacity-50"
        >
          {escribiendo ? <Mic className="h-4 w-4" aria-hidden="true" /> : <PenLine className="h-4 w-4" aria-hidden="true" />}
          {escribiendo ? 'Volver a dictar' : 'Prefiero escribir'}
        </button>
      </div>

      {escribiendo ? (
        <div>
          <label htmlFor="brief-texto" className="sr-only">
            Brief de la campaña
          </label>
          <textarea
            id="brief-texto"
            rows={7}
            value={texto}
            autoFocus
            onChange={(e) => brief.escribir(e.target.value.slice(0, MAX_BRIEF))}
            disabled={ocupado}
            placeholder="Ej.: Súbeme una foto con un 2×1 en capuchinos los martes para Café Aurora, tono casual, para universitarios, en Instagram."
            className="w-full resize-y rounded-[14px] border border-outline bg-surface-container-lowest px-5 py-4 font-display text-[24px] font-semibold leading-snug text-on-surface outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          <p className="mt-2 text-right text-[13px] tabular-nums text-on-surface-variant">
            {texto.length}/{MAX_BRIEF}
          </p>
        </div>
      ) : (
        <>
          {/* La prueba: el párrafo dictado */}
          <div aria-live="polite" aria-label="Lo que vas dictando" className="min-h-[9rem]">
            {vacio ? (
              <>
                <p className="max-w-[24ch] font-display text-[28px] font-semibold leading-[1.2] tracking-[-0.022em] text-outline sm:text-[42px]">
                  {voz.supported
                    ? 'Toca el sello y cuenta la campaña como se la contarías a tu diseñador.'
                    : 'Escribe la idea de la campaña con «Prefiero escribir».'}
                </p>
                <p className="mt-3 text-[15px] text-on-surface-variant">
                  Ej.: «Súbeme una foto con un 2×1 en capuchinos los martes para Café Aurora, tono casual, en Instagram».
                </p>
              </>
            ) : (
              <p className="entra max-w-[26ch] font-display text-[28px] font-semibold leading-[1.2] tracking-[-0.022em] text-on-surface sm:text-[42px]">
                {texto}
                {voz.interim && <span className="font-medium text-outline"> {voz.interim}</span>}
                {voz.listening && (
                  <span aria-hidden="true" className="caret-blink ml-1 inline-block h-[0.9em] w-[3px] translate-y-[0.1em] rounded-full bg-turquoise" />
                )}
              </p>
            )}
          </div>

          {/* El sello: el micrófono */}
          <div className="mt-8 flex items-center gap-4 sm:gap-6">
            {voz.supported ? (
              <div className="relative grid h-[112px] w-[112px] shrink-0 place-items-center sm:h-[132px] sm:w-[132px]">
                <span className={cn('absolute inset-0', voz.listening && 'sello-gira')}>
                  <AroSello texto={aro} />
                </span>
                <button
                  type="button"
                  onClick={voz.listening ? voz.stop : brief.empezarDictado}
                  disabled={ocupado || voz.procesamiento === PROCESAMIENTO.COMPROBANDO}
                  aria-pressed={voz.listening}
                  aria-label={voz.listening ? 'Terminar de dictar' : 'Dictar la campaña'}
                  className="relative grid h-[72px] w-[72px] place-items-center rounded-full bg-turquoise text-navy-deep transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-50 sm:h-[86px] sm:w-[86px]"
                >
                  {voz.listening ? <Square className="h-7 w-7" strokeWidth={2.25} aria-hidden="true" /> : <Mic className="h-8 w-8" strokeWidth={2.25} aria-hidden="true" />}
                </button>
              </div>
            ) : null}
            <div className="min-w-0">
              {voz.supported ? (
                <>
                  <p className="font-display text-xl font-bold leading-tight text-on-surface sm:text-[22px]">
                    {voz.listening ? 'Te escucho' : texto ? 'Sigue dictando o completa la ficha' : 'Dictar'}
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    {voz.listening ? 'Toca para terminar. Puedes pausar y seguir.' : 'Toca el sello para hablar.'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-on-surface-variant">{unsupportedMessage(voz.unsupportedReason)}</p>
              )}
            </div>
          </div>

          {voz.supported && (
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-on-surface-variant">
              <p className="flex items-start gap-1.5">
                {voz.procesamiento === PROCESAMIENTO.LOCAL ? (
                  <Laptop className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Cloud className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                {avisoProcesamiento(voz.procesamiento)}
              </p>
              {voz.descargando ? (
                <span>Descargando español para dictar en este equipo…</span>
              ) : (
                voz.idiomaDescargable && (
                  <button
                    type="button"
                    onClick={voz.instalarIdioma}
                    disabled={ocupado || voz.listening}
                    className="-my-3 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    Descargar español para dictar sin enviar audio
                  </button>
                )
              )}
            </div>
          )}
        </>
      )}

      {(error || voz.error) && (
        <p role="alert" className="mt-5 rounded-[10px] border border-error/25 bg-error-container px-4 py-3 text-sm text-on-error-container">
          {error || voz.error}
        </p>
      )}
    </section>
  )
}
