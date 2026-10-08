'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight, ChevronDown, Download, Factory, Filter, Leaf, PackageOpen, RefreshCw, Scale, ShoppingBasket, Sprout, Warehouse, X } from 'lucide-react'
import DashboardHeader from '../../../components/DashboardHeader'
import { apiUrl } from '../../../lib/api'

type DataSource = 'loading' | 'sheet' | 'demo' | 'error'
type NeracaRow = {
  tahun: number; bulan: string; stokAwal: number; produksi: number; tercecer: number; produksiBersih: number; impor: number; ekspor: number
  totalKetersediaan: number; rumahTangga: number; benih: number; industriHoreka: number; industriPakan: number; totalKebutuhan: number; neracaTon: number
}
type NeracaResponse = { source?: string; message?: string; error?: string; years?: number[]; months?: string[]; rows?: NeracaRow[]; selectedYear?: number; selectedMonth?: string }
type Totals = Omit<NeracaRow, 'tahun' | 'bulan'>

const fields: (keyof Totals)[] = ['stokAwal', 'produksi', 'tercecer', 'produksiBersih', 'impor', 'ekspor', 'totalKetersediaan', 'rumahTangga', 'benih', 'industriHoreka', 'industriPakan', 'totalKebutuhan', 'neracaTon']
const money = (value: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(value))
const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0

function normalizeRow(row: NeracaRow): NeracaRow {
  return { tahun: numeric(row.tahun), bulan: String(row.bulan || '').trim(), stokAwal: numeric(row.stokAwal), produksi: numeric(row.produksi), tercecer: numeric(row.tercecer), produksiBersih: numeric(row.produksiBersih), impor: numeric(row.impor), ekspor: numeric(row.ekspor), totalKetersediaan: numeric(row.totalKetersediaan), rumahTangga: numeric(row.rumahTangga), benih: numeric(row.benih), industriHoreka: numeric(row.industriHoreka), industriPakan: numeric(row.industriPakan), totalKebutuhan: numeric(row.totalKebutuhan), neracaTon: numeric(row.neracaTon) }
}

function sumRows(rows: NeracaRow[]): Totals {
  return rows.reduce((total, row) => { fields.forEach(field => { total[field] += row[field] }); return total }, { stokAwal: 0, produksi: 0, tercecer: 0, produksiBersih: 0, impor: 0, ekspor: 0, totalKetersediaan: 0, rumahTangga: 0, benih: 0, industriHoreka: 0, industriPakan: 0, totalKebutuhan: 0, neracaTon: 0 })
}

function Status({ source, message }: { source: DataSource; message: string }) {
  const warning = source === 'demo' || source === 'error'
  return <div className={`mb-6 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${warning ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}><span className={`h-2 w-2 rounded-full ${source === 'loading' ? 'animate-pulse' : ''} ${warning ? 'bg-amber-500' : 'bg-emerald-500'}`} /><b>{source === 'loading' ? 'Memuat data' : source === 'sheet' ? 'Google Sheets tersambung' : source === 'demo' ? 'Mode data contoh' : 'Koneksi bermasalah'}</b><span className="opacity-80">{message}</span></div>
}

function Metric({ label, value, icon: Icon, tone = 'green' }: { label: string; value: number; icon: LucideIcon; tone?: 'green' | 'orange' | 'red' }) {
  const colors = tone === 'red' ? 'bg-red-50 text-red-600 dark:bg-red-500/10' : tone === 'orange' ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10' : 'bg-emerald-50 text-[#087443] dark:bg-emerald-500/10'
  return <div className="glass rounded-2xl p-5"><div className={`grid h-10 w-10 place-items-center rounded-xl ${colors}`}><Icon size={19} /></div><p className="mt-5 text-xs font-semibold text-slate-500 dark:text-slate-300">{label}</p><div className="mt-1 flex items-baseline gap-1"><b className="text-2xl text-ink dark:text-white">{money(value)}</b><span className="text-xs text-slate-400">Ton</span></div></div>
}

export default function KedelaiNeracaPage() {
  const [filterOpen, setFilterOpen] = useState(false)
  const [source, setSource] = useState<DataSource>('loading')
  const [message, setMessage] = useState('Menghubungkan ke Google Sheets...')
  const [years, setYears] = useState<number[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [year, setYear] = useState<number | null>(null)
  const [month, setMonth] = useState('')
  const [rows, setRows] = useState<NeracaRow[]>([])

  useEffect(() => {
    const body = document.body, html = document.documentElement
    const bodyOverflow = body.style.overflow, htmlOverflow = html.style.overflow, bodyPadding = body.style.paddingRight
    if (filterOpen) { const scrollbar = window.innerWidth - html.clientWidth; body.style.overflow = 'hidden'; html.style.overflow = 'hidden'; if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px` }
    return () => { body.style.overflow = bodyOverflow; html.style.overflow = htmlOverflow; body.style.paddingRight = bodyPadding }
  }, [filterOpen])

  const loadData = async (nextYear?: number, nextMonth?: string, refresh = false) => {
    setSource('loading'); setMessage('Menghubungkan ke Google Sheets...')
    try {
      const params = new URLSearchParams()
      if (nextYear) params.set('year', String(nextYear))
      if (nextMonth) params.set('month', nextMonth)
      if (refresh) params.set('refresh', '1')
      const response = await fetch(apiUrl(`/api/neraca-sheet${params.size ? `?${params}` : ''}`), { cache: 'no-store' })
      const payload = await response.json() as NeracaResponse
      if (!response.ok) throw new Error(payload.error || 'Gagal mengambil data neraca')
      setYears(Array.isArray(payload.years) ? payload.years.filter(Number.isFinite).sort((a, b) => a - b) : [])
      setMonths(Array.isArray(payload.months) ? payload.months : [])
      setYear(numeric(payload.selectedYear) || nextYear || null)
      setMonth(payload.selectedMonth || nextMonth || '')
      setRows(Array.isArray(payload.rows) ? payload.rows.map(normalizeRow) : [])
      setSource(payload.source === 'sheet' ? 'sheet' : 'demo')
      setMessage(payload.message || `${payload.rows?.length || 0} data neraca tersedia.`)
    } catch (error) { setSource('error'); setRows([]); setMessage(error instanceof Error ? error.message : 'Gagal menghubungkan ke backend.') }
  }

  useEffect(() => { loadData() }, [])
  const totals = useMemo(() => sumRows(rows), [rows])
  const changeYear = (value: number) => { setFilterOpen(false); loadData(value) }
  const changeMonth = (value: string) => { setFilterOpen(false); loadData(year || undefined, value) }
  const deficit = totals.neracaTon < 0

  return <div className="min-h-screen bg-canvas dark:bg-[#061a13] grid-pattern transition-colors"><DashboardHeader subtitle="Kedelai Insight" title="Dashboard Neraca Pangan" backHref="/dashboardkedelai/pilih" onFilterClick={() => setFilterOpen(open => !open)} /><main className="p-5 md:p-9">
    <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><h1 className="text-3xl font-bold tracking-tight text-ink dark:text-white md:text-[34px]">Dashboard Neraca Pangan</h1><p className="mt-3 text-sm text-slate-500 dark:text-slate-300">Pantau ketersediaan, kebutuhan, dan neraca pangan kedelai nasional.</p></div><button onClick={() => loadData(year || undefined, month, true)} disabled={source === 'loading'} className="flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-bold text-slate-600 shadow-sm disabled:opacity-60 dark:bg-white/10 dark:text-white"><RefreshCw size={16} className={source === 'loading' ? 'animate-spin' : ''} />Refresh</button></div>
    <Status source={source} message={message} />
    {filterOpen && <div className="fixed right-5 top-[var(--dashboard-header-height)] z-30 w-[min(420px,calc(100vw-2.5rem))] glass rounded-2xl p-4 shadow-2xl"><div className="mb-3 flex items-center justify-between"><b className="text-sm text-ink dark:text-white">Filter data</b><button onClick={() => setFilterOpen(false)} className="text-slate-400" aria-label="Tutup filter"><X size={17} /></button></div><div className="grid grid-cols-2 gap-3"><label><span className="block text-[10px] font-bold text-slate-500 dark:text-slate-200">Tahun</span><div className="relative mt-2"><select value={year ?? ''} onChange={event => changeYear(Number(event.target.value))} className="h-[38px] w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-[#102b20] dark:text-white">{years.map(item => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-slate-400" /></div></label><label><span className="block text-[10px] font-bold text-slate-500 dark:text-slate-200">Bulan</span><div className="relative mt-2"><select value={month} onChange={event => changeMonth(event.target.value)} className="h-[38px] w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-[#102b20] dark:text-white">{months.map(item => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-slate-400" /></div></label></div></div>}
    <div className="mb-6 flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/45 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"><span>Filter aktif</span><b className="text-sm text-[#087443] dark:text-[#82d3a4]">{month || '�'} {year ?? ''}</b></div>
    <section><div className="mb-3"><h2 className="font-bold text-ink dark:text-white">Total Ketersediaan</h2><p className="mt-1 text-xs text-slate-400">Komponen ketersediaan pangan pada periode aktif.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Metric label="Impor" value={totals.impor} icon={Download} /><Metric label="Ekspor" value={totals.ekspor} icon={ArrowUpRight} tone="orange" /><Metric label="Stok Awal" value={totals.stokAwal} icon={Warehouse} /><Metric label="Produksi" value={totals.produksi} icon={Sprout} /><Metric label="Tercecer" value={totals.tercecer} icon={PackageOpen} tone="orange" /><Metric label="Produksi Bersih" value={totals.produksiBersih} icon={Leaf} /></div></section>
    <section className="mt-6"><div className="mb-3"><h2 className="font-bold text-ink dark:text-white">Total Kebutuhan</h2><p className="mt-1 text-xs text-slate-400">Komponen kebutuhan pangan pada periode aktif.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Benih" value={totals.benih} icon={Leaf} /><Metric label="Industri Pakan" value={totals.industriPakan} icon={Factory} /><Metric label="Industri dan Horeka" value={totals.industriHoreka} icon={ShoppingBasket} /><Metric label="Rumah Tangga" value={totals.rumahTangga} icon={Warehouse} /></div></section>
    <section className={`mt-6 rounded-2xl p-6 ${deficit ? 'bg-red-600 text-white' : 'bg-[#087443] text-white'}`}><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-wide text-white/75">Neraca (Ton)</p><b className="mt-2 block text-4xl">{money(totals.neracaTon)} Ton</b><p className="mt-2 text-sm text-white/80">Total Ketersediaan: {money(totals.totalKetersediaan)} Ton � Total Kebutuhan: {money(totals.totalKebutuhan)} Ton</p></div><Scale size={48} className="text-white/80" /></div></section>
  </main></div>
}
