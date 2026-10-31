import { Cloud, Laptop, Mic, PenLine, Square } from 'lucide-react'
import { avisoProcesamiento, MAX_BRIEF, PROCESAMIENTO, unsupportedMessage } from '../../services/voiceIntent'
import { cn } from '@/lib/utils'

/**
 * Paso Dictar de la línea: cada frase dictada queda como una parada en una
 * vía turquesa que termina en el micrófono. "Prefiero escribir" cambia a un
 * área de texto grande. El estado vive en `useBriefDictado` (lo tiene la
 * página, que pinta al lado la próxima estación con "Completar campos").
 * La Web Speech API no entrega el nivel de voz: los anillos dicen "te
 * escucho", no fingen un medidor.
 */
const reloj = (segundos) => `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`

export default function VoiceBriefCard({ brief, disabled }) {
  const { texto, segmentos, escribiendo, interpretando, error, segundos, voz } = brief
  const ocupado = disabled || interpretando
  const vacio = !texto.trim() && !voz.interim
  // Si el texto se editó a mano ya no coincide con las frases: se muestra como una sola parada.
  const editado = segmentos.map((s) => s.texto).join(' ').replace(/\s+/g, ' ').trim() !== texto.trim()
  const paradas = editado ? (texto.trim() ? [{ t: null, texto: texto.trim() }] : []) : segmentos

  return (
      <section aria-label="Brief de la campaña" className="min-w-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] text-on-surface-variant">
            {escribiendo ? 'Escribe la idea como se la contarías a tu diseñador.' : 'Cada frase que dices queda como una parada.'}
          </p>
          <button
            type="button"
            onClick={brief.alternarEscritura}
            disabled={ocupado}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-outline-variant px-4 text-sm font-semibold text-on-surface transition-colors hover:border-outline hover:bg-surface-container-low disabled:opacity-50"
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
              className="w-full resize-y rounded-[14px] border border-outline bg-surface-container-lowest px-5 py-4 font-display text-[22px] font-semibold leading-snug text-on-surface outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <p className="mt-2 text-right text-[13px] tabular-nums text-on-surface-variant">
              {texto.length}/{MAX_BRIEF}
            </p>
          </div>
        ) : (
          <div className="relative pl-12 sm:pl-[86px]">
            {/* La vía: de la primera parada al micrófono */}
            <span
              aria-hidden="true"
              className={cn(
                'absolute bottom-[54px] left-[19px] top-4 w-[5px] rounded-full sm:left-[51px] sm:w-1.5',
                vacio ? 'bg-outline-variant' : 'bg-turquoise',
              )}
            />
            <ol aria-live="polite" aria-label="Lo que vas dictando" className="space-y-5 pb-6">
              {vacio && (
                <li className="relative">
                  <span aria-hidden="true" className="absolute -left-[37px] top-2 h-4 w-4 rounded-full border-4 border-outline-variant bg-background sm:-left-[45px] sm:h-[18px] sm:w-[18px] sm:border-[5px]" />
                  <p className="font-display text-[25px] font-bold leading-[1.18] tracking-[-0.02em] text-outline sm:text-[30px]">
                    {voz.supported
                      ? 'Toca el micrófono y cuenta la campaña como se la contarías a tu diseñador.'
                      : 'Escribe la idea de la campaña con «Prefiero escribir».'}
                  </p>
                  <p className="mt-2 text-[15px] text-on-surface-variant">
                    Ej.: «Súbeme una foto con un 2×1 en capuchinos los martes para Café Aurora, tono casual, en Instagram».
                  </p>
                </li>
              )}
              {paradas.map((parada, index) => (
                <li key={`${index}-${parada.t}`} className="entra relative">
                  <span aria-hidden="true" className="absolute -left-[37px] top-2.5 h-4 w-4 rounded-full border-4 border-turquoise bg-background sm:-left-[45px] sm:h-[18px] sm:w-[18px] sm:border-[5px]" />
                  {parada.t !== null && <p className="text-[13px] font-semibold tabular-nums text-outline">{reloj(parada.t)}</p>}
                  <p className="mt-1 font-display text-[25px] font-bold leading-[1.18] tracking-[-0.02em] text-on-surface sm:text-[34px]">
                    {parada.texto}
                  </p>
                </li>
              ))}
              {voz.interim && (
                <li className="relative">
                  <span aria-hidden="true" className="absolute -left-[37px] top-2.5 h-4 w-4 rounded-full border-4 border-outline-variant bg-background sm:-left-[45px] sm:h-[18px] sm:w-[18px] sm:border-[5px]" />
                  <p className="text-[13px] font-semibold tabular-nums text-outline">{reloj(segundos)}</p>
                  <p className="mt-1 font-display text-[25px] font-semibold leading-[1.18] tracking-[-0.02em] text-outline sm:text-[34px]">
                    {voz.interim}
                    <span aria-hidden="true" className="caret-blink ml-1 inline-block h-[0.9em] w-[3px] translate-y-[0.1em] rounded-full bg-turquoise" />
                  </p>
                </li>
              )}
            </ol>

            {/* El micrófono: la estación donde está el tren */}
            <div className="relative -ml-12 flex items-center gap-4 sm:-ml-[86px] sm:gap-5">
              {voz.supported ? (
                <div className="relative grid h-[88px] w-[88px] shrink-0 place-items-center sm:h-[108px] sm:w-[108px]">
                  {voz.listening && (
                    <>
                      <span aria-hidden="true" className="escucha-anillo absolute inset-1 rounded-full border-[3px] border-turquoise/55" />
                      <span aria-hidden="true" className="escucha-anillo escucha-anillo-2 absolute inset-0 rounded-full border-2 border-turquoise/25" />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={voz.listening ? voz.stop : brief.empezarDictado}
                    disabled={ocupado || voz.procesamiento === PROCESAMIENTO.COMPROBANDO}
                    aria-pressed={voz.listening}
                    aria-label={voz.listening ? 'Terminar de dictar' : 'Dictar la campaña'}
                    className="relative grid h-[68px] w-[68px] place-items-center rounded-full bg-turquoise text-navy-deep transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-50 sm:h-[84px] sm:w-[84px]"
                  >
                    {voz.listening ? <Square className="h-7 w-7" strokeWidth={2.25} aria-hidden="true" /> : <Mic className="h-8 w-8" strokeWidth={2.25} aria-hidden="true" />}
                  </button>
                </div>
              ) : (
                <span aria-hidden="true" className="grid h-[88px] w-[88px] shrink-0 place-items-center sm:h-[108px] sm:w-[108px]">
                  <span className="h-6 w-6 rounded-full border-4 border-outline-variant bg-background" />
                </span>
              )}
              <div className="min-w-0">
                {voz.supported ? (
                  <>
                    <p className="font-display text-xl font-extrabold leading-tight text-on-surface sm:text-[22px]">
                      {voz.listening ? (
                        <>
                          Te escucho <span className="tabular-nums text-primary">· {reloj(segundos)}</span>
                        </>
                      ) : texto ? (
                        'Sigue dictando o completa los campos'
                      ) : (
                        'Dictar'
                      )}
                    </p>
                    <p className="text-sm text-on-surface-variant">
                      {voz.listening ? 'Toca para terminar. Puedes pausar y seguir.' : 'Toca el micrófono para hablar.'}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-on-surface-variant">{unsupportedMessage(voz.unsupportedReason)}</p>
                )}
              </div>
            </div>

          </div>
        )}
        {!escribiendo && voz.supported && (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 pl-0 text-[13px] text-on-surface-variant sm:pl-[86px]">
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

        {(error || voz.error) && (
          <p role="alert" className="mt-5 rounded-[10px] border border-error/25 bg-error-container px-4 py-3 text-sm text-on-error-container">
            {error || voz.error}
          </p>
        )}
      </section>

  )
}
