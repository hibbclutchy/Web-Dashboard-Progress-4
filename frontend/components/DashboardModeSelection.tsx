import Link from 'next/link'
import { Activity, HandCoins, Scale } from 'lucide-react'
import type { CSSProperties } from 'react'

type DashboardModeSelectionProps = {
  commodity: string
  basePath: string
}

type Mode = {
  title: string
  description: string
  label: string
  href: string
  Icon: typeof Activity
}

const modes: Mode[] = [
  {
    title: 'Produktivitas',
    description: 'Lihat dashboard produktivitas komoditas ini.',
    label: 'Buka Dashboard',
    href: 'monitoring',
    Icon: Activity,
  },
  {
    title: 'BANPEM (Bantuan Pemerintah)',
    description: 'Lihat data program bantuan pemerintah untuk komoditas ini.',
    label: 'Buka Dashboard',
    href: 'banpem',
    Icon: HandCoins,
  },  {
    title: 'Neraca Pangan',
    description: 'Lihat ketersediaan, kebutuhan, dan neraca pangan komoditas ini.',
    label: 'Buka Dashboard',
    href: 'neraca',
    Icon: Scale,
  },
]

const COMMODITY_ACCENTS: Record<string, string> = {
  dashboardkedelai: '#E8B93B',
  dashboardkacanghijau: '#6FBF44',
  dashboardkacangtanah: '#B98A4E',
  dashboardubikayu: '#D8C6A0',
  dashboardubijalar: '#7B4B94',
}

const cardStyle = (accent: string) => ({
  '--accent': accent,
  background: `linear-gradient(145deg, color-mix(in srgb, ${accent} 16%, transparent), transparent 55%, color-mix(in srgb, ${accent} 9%, transparent))`,
  boxShadow: `0 2px 8px rgba(15, 23, 42, .05), 0 24px 60px color-mix(in srgb, ${accent} 16%, transparent)`,
}) as CSSProperties

export default function DashboardModeSelection({ commodity, basePath }: DashboardModeSelectionProps) {
  const slug = basePath.replace(/^\//, '')
  const accent = COMMODITY_ACCENTS[slug] || '#6FBF44'

  return (
    <main className="min-h-screen bg-canvas px-5 py-8 text-ink transition-colors duration-500 dark:bg-navy dark:text-white sm:px-8">
      <Link
        href={basePath}
        aria-label={`Kembali ke ringkasan ${commodity}`}
        className="glass fixed left-5 top-5 z-10 inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold text-ink/80 backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-soft dark:bg-white/5 dark:text-white/90 sm:left-8"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-akabi-removebg-preview.png" alt="Logo AKABI" className="h-6 w-6 rounded-md bg-white object-contain p-0.5" />
        <span>Kembali</span>
      </Link>
      <section
        className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col items-center justify-center overflow-hidden p-6 py-20 text-ink dark:text-white sm:p-10 sm:py-20"
      >
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[.28em] text-ink/55 dark:text-emerald-200/70">Dashboard AKABI</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-ink dark:text-white sm:text-4xl">
            Pilih Dashboard {commodity}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-ink/60 dark:text-white/65 sm:text-base">
            Pilih jenis dashboard untuk melihat informasi komoditas.
          </p>
        </div>

        <div className="mt-12 grid w-full gap-6 md:grid-cols-2 xl:grid-cols-3">
          {modes.map(({ title, description, label, href, Icon }) => (
            <Link
              key={href}
              href={`${basePath}/${href}`}
              className="group block h-full rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-canvas dark:focus-visible:ring-offset-navy"
            >
              <div
                className="glass relative flex h-full min-h-[15rem] flex-col overflow-hidden rounded-3xl border border-white/40 p-7 text-ink backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:shadow-2xl dark:border-white/10 dark:text-white"
                style={cardStyle(accent)}
              >
                <div className="pointer-events-none absolute inset-0 bg-white/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:bg-white/5" aria-hidden="true" />
                <div className="relative grid h-12 w-12 shrink-0 place-items-center self-center rounded-full bg-white/75 text-[var(--accent)] shadow-[inset_0_2px_8px_rgba(15,23,42,.12),0_8px_20px_rgba(255,255,255,.25)] dark:bg-white/90">
                  <Icon size={21} strokeWidth={2.2} aria-hidden="true" />
                </div>
                <h2 className="relative mt-7 text-xl font-extrabold tracking-tight text-ink dark:text-white">{title}</h2>
                <p className="relative mt-3 max-w-sm text-sm leading-6 text-ink/60 dark:text-slate-300">{description}</p>
                <span className="relative mt-auto inline-flex items-center gap-2 pt-8 text-sm font-bold text-[var(--accent)]">
                  {label} <span className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true">&rarr;</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}


