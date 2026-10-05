'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties } from 'react'

export const COMMODITIES = [
  { id: 'kedelai', name: 'Kedelai', accent: '#E8B93B', slug: 'dashboardkedelai', href: '/dashboardkedelai' },
  { id: 'kacang-hijau', name: 'Kacang Hijau', accent: '#6FBF44', slug: 'dashboardkacanghijau', href: '/dashboardkacanghijau' },
  { id: 'kacang-tanah', name: 'Kacang Tanah', accent: '#B98A4E', slug: 'dashboardkacangtanah', href: '/dashboardkacangtanah' },
  { id: 'ubi-kayu', name: 'Ubi Kayu', accent: '#D8C6A0', slug: 'dashboardubikayu', href: '/dashboardubikayu' },
  { id: 'ubi-jalar', name: 'Ubi Jalar', accent: '#7B4B94', slug: 'dashboardubijalar', href: '/dashboardubijalar' },
] as const

type CommodityCardsProps = {
  activeSlug?: string
}

export default function CommodityCards({ activeSlug }: CommodityCardsProps) {
  return (
    <div className="relative isolate">
      <div className="pointer-events-none absolute -left-12 top-6 -z-10 h-40 w-40 rounded-full bg-[#E8B93B]/20 blur-3xl dark:bg-[#E8B93B]/10" aria-hidden="true" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-52 w-52 rounded-full -translate-x-1/2 -translate-y-1/2 bg-[#6FBF44]/20 blur-3xl dark:bg-[#6FBF44]/10" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-8 bottom-0 -z-10 h-44 w-44 rounded-full bg-[#7B4B94]/20 blur-3xl dark:bg-[#7B4B94]/10" aria-hidden="true" />

      <div className="flex flex-col gap-4 px-1 pb-5 pt-1 md:flex-row md:gap-5">
        {COMMODITIES.map(commodity => {
          const isActive = activeSlug === commodity.slug
          const cardStyle = {
            '--accent': commodity.accent,
            background: `linear-gradient(145deg, color-mix(in srgb, ${commodity.accent} 18%, transparent), transparent 55%, color-mix(in srgb, ${commodity.accent} 10%, transparent))`,
          } as CSSProperties

          return (
            <div
              key={commodity.id}
              className={`glass group relative flex aspect-square w-full flex-1 md:min-w-0 overflow-hidden rounded-3xl border border-white/40 text-ink backdrop-blur-xl transition-opacity duration-150 ease-out hover:opacity-95 dark:border-white/10 dark:text-white ${isActive ? 'z-10' : ''}`}
              style={cardStyle}
            >
              <Link
                href={commodity.href}
                aria-label={`Buka dashboard ${commodity.name}`}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex h-full w-full flex-col items-center justify-center p-6 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset"
              >
                <span className="pointer-events-none absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 dark:bg-white/5" aria-hidden="true" />
                <span className="relative grid h-24 w-24 place-items-center rounded-full bg-white/75 p-4 shadow-[inset_0_2px_8px_rgba(15,23,42,.12),0_8px_20px_rgba(255,255,255,.25)] transition-transform duration-300 group-hover:scale-105 dark:bg-white/90">
                  <Image src="/logo-akabi-removebg-preview.png" alt="Logo AKABI" width={72} height={72} className="h-full w-full object-contain" />
                </span>
                <span className="relative mt-5 font-sans text-base font-bold leading-tight sm:text-lg">{commodity.name}</span>
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
