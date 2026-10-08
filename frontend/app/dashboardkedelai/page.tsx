'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Activity, ArrowDownRight, ArrowUpRight, HandCoins, Leaf, Scale, Sprout } from 'lucide-react'
import DashboardHeader from '../../components/DashboardHeader'
import { apiUrl } from '../../lib/api'
import { parseSheetValues, type Region } from '../../lib/data'

type BanpemRow = { tahun: number; targetHa: number; kontrakHa: number; salurHa: number; tanamHa: number }
type NeracaRow = { tahun: number; bulan: string; totalKetersediaan: number; totalKebutuhan: number; neracaTon: number }
type SheetResponse = { source?: string; values?: unknown[][]; error?: string }
type BanpemResponse = { rows?: BanpemRow[]; selectedYear?: number; error?: string }
type NeracaResponse = { rows?: NeracaRow[]; selectedYear?: number; error?: string }

const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0
const money = (value: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(value))
const productivity = (row: Region) => row.harvested > 0 ? row.production * 10 / row.harvested : 0

function aggregateRegions(rows: Region[]) {
  const regions = new Map<string, Region>()
  rows.forEach(row => {
    const key = `${row.province}\u0000${row.city}`
    const current = regions.get(key)
    if (current) {
      current.planted += row.planted
      current.harvested += row.harvested
      current.production += row.production
    } else {
      regions.set(key, { ...row })
    }
  })
  return Array.from(regions.values())
}

function latestMonitoringYear(rows: Region[]) {
  return [...new Set(rows.filter(row => row.planted || row.harvested || row.production).map(row => row.year))].sort().at(-1) || ''
}

function sum<T extends object>(rows: T[], fields: (keyof T)[]) {
  return rows.reduce((total, row) => {
    fields.forEach(field => { total[field] = number(total[field]) + number(row[field]) })
    return total
  }, {} as Record<keyof T, number>)
}

export default function KedelaiSummaryPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [monitoringRows, setMonitoringRows] = useState<Region[]>([])
  const [monitoringYear, setMonitoringYear] = useState('')
  const [banpemRows, setBanpemRows] = useState<BanpemRow[]>([])
  const [banpemYear, setBanpemYear] = useState<number | null>(null)
  const [neracaRows, setNeracaRows] = useState<NeracaRow[]>([])
  const [neracaYear, setNeracaYear] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [sheetResult, banpemResult, neracaResult] = await Promise.all([
          fetch(apiUrl('/api/sheets'), { cache: 'no-store' }),
          fetch(apiUrl('/api/banpem-sheet'), { cache: 'no-store' }),
          fetch(apiUrl('/api/neraca-sheet'), { cache: 'no-store' }),
        ])
        const sheet = await sheetResult.json() as SheetResponse
        const banpem = await banpemResult.json() as BanpemResponse
        const neraca = await neracaResult.json() as NeracaResponse
        if (!sheetResult.ok) throw new Error(sheet.error || 'Gagal mengambil data monitoring')
        if (!banpemResult.ok) throw new Error(banpem.error || 'Gagal mengambil data BANPEM')
        if (!neracaResult.ok) throw new Error(neraca.error || 'Gagal mengambil data neraca')

        const nextMonitoringRows = sheet.source === 'google-sheets' ? parseSheetValues(sheet.values || []) : []
        const nextMonitoringYear = latestMonitoringYear(nextMonitoringRows)
        setMonitoringRows(nextMonitoringRows)
        setMonitoringYear(nextMonitoringYear)
        setBanpemRows(Array.isArray(banpem.rows) ? banpem.rows : [])
        setBanpemYear(number(banpem.selectedYear) || null)

        const selectedNeracaYear = number(neraca.selectedYear)
        const fullYearResult = selectedNeracaYear
          ? await fetch(apiUrl(`/api/neraca-sheet?year=${selectedNeracaYear}&month=Semua%20Bulan`), { cache: 'no-store' })
          : null
        const fullYear = fullYearResult?.ok ? await fullYearResult.json() as NeracaResponse : neraca
        setNeracaRows(Array.isArray(fullYear.rows) ? fullYear.rows : [])
        setNeracaYear(number(fullYear.selectedYear) || selectedNeracaYear || null)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Gagal memuat ringkasan data.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const productivitySummary = useMemo(() => {
    const rows = aggregateRegions(monitoringRows.filter(row => row.year === monitoringYear))
    const productive = rows.filter(row => row.harvested > 0)
    const average = productive.length ? productive.reduce((total, row) => total + productivity(row), 0) / productive.length : 0
    return {
      average,
      top: rows.filter(row => productivity(row) > average).sort((a, b) => productivity(b) - productivity(a)).slice(0, 2),
      bottom: rows.filter(row => productivity(row) > 0 && productivity(row) < average).sort((a, b) => productivity(a) - productivity(b)).slice(0, 2),
    }
  }, [monitoringRows, monitoringYear])
  const banpemTotals = useMemo(() => sum(banpemRows, ['targetHa', 'kontrakHa', 'salurHa', 'tanamHa']), [banpemRows])
  const neracaTotals = useMemo(() => sum(neracaRows, ['totalKetersediaan', 'totalKebutuhan', 'neracaTon']), [neracaRows])

  return <div className="min-h-screen bg-canvas dark:bg-[#061a13] grid-pattern transition-colors"><DashboardHeader subtitle="Kedelai Insight" title="Ringkasan Kedelai" backHref="/" /><main className="p-5 md:p-9">
    <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><h1 className="text-3xl font-bold tracking-tight text-ink dark:text-white md:text-[34px]">Ringkasan Kedelai</h1><p className="mt-3 text-sm text-slate-500 dark:text-slate-300">Ikhtisar nasional tahun data terbaru dari Monitoring, BANPEM, dan Neraca Pangan.</p></div><Link href="/dashboardkedelai/pilih" className="inline-flex w-fit rounded-xl bg-[#0b6b43] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#0b6b43]/20">Pilih Dashboard</Link></div>
    {error && <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">{error}</div>}
    <div className="glass rounded-2xl p-6"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Produktivitas Nasional Tahun {monitoringYear || '�'}</p><div className="mt-3 flex flex-wrap items-end gap-3"><b className="text-4xl text-[#087443] dark:text-[#82d3a4]">{productivitySummary.average.toFixed(2)}</b><span className="pb-1 text-sm text-slate-400">Ku/Ha</span></div><p className="mt-3 text-sm text-slate-500 dark:text-slate-300">Rata-rata nasional menjadi pembanding wilayah di atas dan di bawah rata-rata.</p></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><RegionList title="Di atas rata-rata nasional" rows={productivitySummary.top} positive /><RegionList title="Di bawah rata-rata nasional" rows={productivitySummary.bottom} /></div>
    <section className="mt-6"><div className="mb-3"><h2 className="font-bold text-ink dark:text-white">Ringkasan BANPEM Tahun {banpemYear ?? '�'}</h2><p className="mt-1 text-xs text-slate-400">Akumulasi seluruh kabupaten/kota pada tahun data terbaru.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Target" value={banpemTotals.targetHa || 0} unit="Ha" icon={Leaf} /><Kpi label="Kontrak" value={banpemTotals.kontrakHa || 0} unit="Ha" icon={HandCoins} /><Kpi label="Salur" value={banpemTotals.salurHa || 0} unit="Ha" icon={Sprout} /><Kpi label="Tanam" value={banpemTotals.tanamHa || 0} unit="Ha" icon={Activity} /></div></section>
    <section className="mt-6"><div className="mb-3"><h2 className="font-bold text-ink dark:text-white">Ringkasan Neraca Tahun {neracaYear ?? '�'}</h2><p className="mt-1 text-xs text-slate-400">Akumulasi seluruh bulan pada tahun data terbaru.</p></div><div className="grid gap-4 sm:grid-cols-3"><Kpi label="Total Ketersediaan" value={neracaTotals.totalKetersediaan || 0} unit="Ton" icon={Scale} /><Kpi label="Total Kebutuhan" value={neracaTotals.totalKebutuhan || 0} unit="Ton" icon={Activity} /><Kpi label="Neraca" value={neracaTotals.neracaTon || 0} unit="Ton" icon={neracaTotals.neracaTon >= 0 ? ArrowUpRight : ArrowDownRight} positive={neracaTotals.neracaTon >= 0} /></div></section>
    {loading && <p className="mt-6 text-center text-sm text-slate-400">Memuat ringkasan data...</p>}
  </main></div>
}

function RegionList({ title, rows, positive = false }: { title: string; rows: Region[]; positive?: boolean }) {
  return <div className="glass rounded-2xl p-5"><h2 className="font-bold text-ink dark:text-white">{title}</h2><div className="mt-4 space-y-3">{rows.map(row => <div key={`${row.province}-${row.city}`} className="flex items-center justify-between gap-3"><div><b className="block text-sm text-slate-700 dark:text-white">{row.city}</b><span className="text-xs text-slate-400">{row.province}</span></div><b className={positive ? 'text-emerald-600' : 'text-amber-600'}>{productivity(row).toFixed(2)} Ku/Ha</b></div>)}{!rows.length && <p className="py-5 text-center text-xs text-slate-400">Belum ada wilayah yang memenuhi kriteria.</p>}</div></div>
}

function Kpi({ label, value, unit, icon: Icon, positive }: { label: string; value: number; unit: string; icon: LucideIcon; positive?: boolean }) {
  return <div className="glass rounded-2xl p-5"><div className={`grid h-10 w-10 place-items-center rounded-xl ${positive === false ? 'bg-red-50 text-red-600 dark:bg-red-500/10' : 'bg-emerald-50 text-[#087443] dark:bg-emerald-500/10'}`}><Icon size={19} /></div><p className="mt-5 text-xs font-semibold text-slate-500 dark:text-slate-300">{label}</p><div className="mt-1 flex items-baseline gap-1"><b className="text-2xl text-ink dark:text-white">{money(value)}</b><span className="text-xs text-slate-400">{unit}</span></div></div>
}


