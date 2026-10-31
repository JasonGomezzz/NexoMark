import { CheckCircle2, ClipboardCheck, MessageSquareText, RotateCcw } from 'lucide-react'

const GUIDE_ITEMS = [
  {
    icon: ClipboardCheck,
    title: 'Revisa la propuesta completa',
    text: 'Abre una campaña pendiente para leer el copy, revisar la imagen disponible y confirmar que la idea respeta el brief.',
  },
  {
    icon: CheckCircle2,
    title: 'Aprueba cuando esté lista',
    text: 'Al aprobar, la campaña pasa a estado aprobado y el marketero puede continuar con la publicación o entrega final.',
  },
  {
    icon: MessageSquareText,
    title: 'Rechaza con feedback accionable',
    text: 'Si algo no encaja, deja un comentario concreto. El marketero recibirá tu motivo y podrá preparar una nueva versión.',
  },
  {
    icon: RotateCcw,
    title: 'Consulta pendientes en cualquier momento',
    text: 'El dashboard muestra las más recientes; la sección Campañas pendientes guarda el resto para que no pierdas solicitudes.',
  },
]

export default function ClientHelpPage() {
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <h1 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] text-on-surface sm:text-[38px]">Soporte y guía del cliente</h1>
        <p className="mt-2 text-base text-on-surface-variant">
          Todo lo necesario para revisar campañas, tomar decisiones y enviar feedback útil al marketero.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {GUIDE_ITEMS.map(({ icon: Icon, title, text }) => (
          <article key={title} className="glass-soft rounded-xl p-6 shadow-sm">
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-fixed text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{text}</p>
          </article>
        ))}
      </section>

      <section className="glass-liquid rounded-xl p-6">
        <h2 className="text-xl font-semibold text-on-surface">Estados principales</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <StatusHelp title="Pendiente" text="Está esperando tu revisión." />
          <StatusHelp title="Aprobada" text="Ya diste visto bueno a la propuesta." />
          <StatusHelp title="Rechazada" text="Enviaste feedback para una nueva versión." />
        </div>
      </section>
    </div>
  )
}

function StatusHelp({ title, text }) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
      <p className="font-semibold text-on-surface">{title}</p>
      <p className="mt-1 text-sm text-on-surface-variant">{text}</p>
    </div>
  )
}
