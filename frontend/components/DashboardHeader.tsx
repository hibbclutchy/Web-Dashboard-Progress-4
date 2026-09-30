'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Bell, Filter, Home, Moon, Search, Settings, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTheme } from './ThemeProvider'

// Komponen ini WAJIB dipakai untuk header dashboard komoditas apa pun (monitoring & BANPEM). Jangan buat state tema lokal baru - selalu pakai context tema global. Set backHref ke halaman jembatan komoditas masing-masing (/{slug}), bukan ke landing.
type DashboardHeaderProps = {
  logoSrc?: string
  wordmark?: string
  subtitle?: string
  title: string
  backHref: string
  homeHref?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  hasUnreadNotification?: boolean
  onNotificationClick?: () => void
  notificationContent?: ReactNode
  onFilterClick?: () => void
  onSettingsClick?: () => void
}

const toolbarButtonClass = 'rounded-xl bg-white p-2.5 text-slate-600 shadow-sm dark:bg-white/10 dark:text-slate-200'

export default function DashboardHeader({
  logoSrc = '/logo-akabi-removebg-preview.png',
  wordmark = 'AKABI',
  subtitle,
  title,
  backHref,
  homeHref = '/',
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Cari nama wilayah...',
  hasUnreadNotification = false,
  onNotificationClick,
  notificationContent,
  onFilterClick,
  onSettingsClick,
}: DashboardHeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const hasSearch = typeof searchValue === 'string' && Boolean(onSearchChange)
  const hasNotification = typeof onNotificationClick === 'function'
  const hasFilter = typeof onFilterClick === 'function'
  const hasSettings = typeof onSettingsClick === 'function'

  return (
    <header className="relative flex min-h-[76px] items-center justify-between border-b border-slate-200/70 bg-white/55 px-5 backdrop-blur-xl dark:border-white/10 dark:bg-[#081f16]/60 md:px-9">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-white shadow-sm">
          <Image src={logoSrc} alt="Logo resmi AKABI" width={40} height={40} className="h-full w-full object-contain p-1" priority />
        </div>
        <div><b className="text-lg tracking-tight text-ink dark:text-white">{wordmark}</b>{subtitle && <p className="text-[10px] font-bold uppercase tracking-[.22em] text-slate-400">{subtitle}</p>}</div>
      </div>
      <div className="absolute left-1/2 hidden -translate-x-1/2 items-center text-xs text-slate-600 dark:text-slate-200 md:flex"><b>{title}</b></div>
      <div className="ml-auto flex items-center gap-2">
        {hasSearch && <label className="hidden items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs text-slate-500 shadow-sm dark:bg-[#102b20] dark:text-slate-200 md:flex"><Search size={15} /><input aria-label="Cari nama wilayah" value={searchValue} onChange={event => onSearchChange?.(event.target.value)} className="w-32 bg-transparent text-slate-700 outline-none placeholder:text-slate-400 dark:text-white" placeholder={searchPlaceholder} /></label>}
        <Link href={backHref} aria-label="Kembali ke Pilih Mode Dashboard" title="Kembali ke Pilih Mode Dashboard" className={toolbarButtonClass}><ArrowLeft size={18} /></Link>
        <Link href={homeHref} aria-label="Dashboard utama" title="Dashboard utama" className={toolbarButtonClass}><Home size={18} /></Link>
        {hasNotification && <div className="relative">
          <button aria-label="Notifikasi" data-panel-trigger onClick={onNotificationClick} className={`relative ${toolbarButtonClass}`}>
            <Bell size={18} />{hasUnreadNotification && <i className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-400" />}
          </button>
          {notificationContent}
        </div>}
        {hasFilter && <button aria-label="Buka filter" data-panel-trigger onClick={onFilterClick} className={toolbarButtonClass}><Filter size={18} /></button>}
        {hasSettings && <button aria-label="Buka settings" data-panel-trigger onClick={onSettingsClick} className={toolbarButtonClass}><Settings size={18} /></button>}
        <button type="button" aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'} onClick={toggleTheme} className={toolbarButtonClass}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
      </div>
    </header>
  )
}
