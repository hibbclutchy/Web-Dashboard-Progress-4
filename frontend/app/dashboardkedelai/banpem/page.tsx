'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Banknote, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, FileCheck2, FileText, Leaf, RefreshCw, ShieldCheck, Sprout, WalletCards, X } from 'lucide-react'
import DashboardHeader from '../../../components/DashboardHeader'
import { apiUrl } from '../../../lib/api'

type DataSource = 'loading' | 'sheet' | 'demo' | 'error'
type BanpemRow = {
  tahun: number
  provinsi: string
  kabupatenKota: string
  targetHa: number
  cpclKab: number
  skBrmpHa: number
  skKpaHa: number
  skPpkHa: number
  klikHa: number
  klikRp: number
  kontrakHa: number
  nilaiKontrakRp: number
  belumKontrakHa: number
  spmRp: number
  sp2dRp: number
  salurHa: number
  tanamHa: number
  keterangan: string
}
type BanpemResponse = { source?: string; message?: string; error?: string; years?: number[]; rows?: BanpemRow[]; selectedYear?: number }
type Kpi = { label: string; value: number; unit: 'Ha' | 'Rp' | 'Kab'; icon: LucideIcon; background: string }

const pageSize = 20
const numberFields: (keyof Omit<BanpemRow, 'tahun' | 'provinsi' | 'kabupatenKota' | 'keterangan'>)[] = ['targetHa', 'cpclKab', 'skBrmpHa', 'skKpaHa', 'skPpkHa', 'klikHa', 'klikRp', 'kontrakHa', 'nilaiKontrakRp', 'belumKontrakHa', 'spmRp', 'sp2dRp', 'salurHa', 'tanamHa']
const fmt = (value: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(value))
const fmtRp = (value: number) => value >= 1e9 ? `Rp ${(value / 1e9).toFixed(1).replace('.', ',')} M` : value >= 1e6 ? `Rp ${fmt(value / 1e6)} Jt` : `Rp ${fmt(value)}`
const toNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0

function normalizeRow(row: BanpemRow): BanpemRow {
  return {
    tahun: toNumber(row.tahun), provinsi: String(row.provinsi || '').trim(), kabupatenKota: String(row.kabupatenKota || '').trim(),
    targetHa: toNumber(row.targetHa), cpclKab: toNumber(row.cpclKab), skBrmpHa: toNumber(row.skBrmpHa), skKpaHa: toNumber(row.skKpaHa), skPpkHa: toNumber(row.skPpkHa), klikHa: toNumber(row.klikHa), klikRp: toNumber(row.klikRp), kontrakHa: toNumber(row.kontrakHa), nilaiKontrakRp: toNumber(row.nilaiKontrakRp), belumKontrakHa: toNumber(row.belumKontrakHa), spmRp: toNumber(row.spmRp), sp2dRp: toNumber(row.sp2dRp), salurHa: toNumber(row.salurHa), tanamHa: toNumber(row.tanamHa), keterangan: String(row.keterangan || '').trim(),
  }
}

function sumRows(rows: BanpemRow[]): Omit<BanpemRow, 'tahun' | 'provinsi' | 'kabupatenKota' | 'keterangan'> {
  return rows.reduce((total, row) => {
    numberFields.forEach(field => { total[field] += row[field] })
    return total
  }, { targetHa: 0, cpclKab: 0, skBrmpHa: 0, skKpaHa: 0, skPpkHa: 0, klikHa: 0, klikRp: 0, kontrakHa: 0, nilaiKontrakRp: 0, belumKontrakHa: 0, spmRp: 0, sp2dRp: 0, salurHa: 0, tanamHa: 0 })
}

function KpiCard({ label, value, unit, icon: Icon, background }: Kpi) {
  const display = unit === 'Rp' ? fmtRp(value) : fmt(value)
  return <div className="glass rounded-2xl p-5"><div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background }}><Icon size={19} className="text-[#087443]" /></div><p className="mt-5 text-xs font-semibold text-slate-500 dark:text-slate-300">{label}</p><div className="mt-1 flex items-baseline gap-1"><b className="text-2xl text-ink dark:text-white">{display}</b>{unit !== 'Rp' && <span className="text-xs text-slate-400">{unit}</span>}</div></div>
}

function DataStatus({ source, message }: { source: DataSource; message: string }) {
  const className = source === 'sheet' || source === 'loading' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'
  const dotClassName = source === 'loading' ? 'animate-pulse bg-emerald-500' : source === 'sheet' ? 'bg-emerald-500' : 'bg-amber-500'
  const title = source === 'sheet' ? 'Google Sheets tersambung' : source === 'loading' ? 'Memuat data' : source === 'demo' ? 'Mode data contoh' : 'Koneksi bermasalah'
  return <div className={`mb-6 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${className}`}><span className={`h-2 w-2 rounded-full ${dotClassName}`} /><b>{title}</b><span className="opacity-80">{message}</span></div>
}

function YearFilter({ years, year, setYear, onClose }: { years: number[]; year: number | null; setYear: (year: number) => void; onClose: () => void }) {
  return <div className="fixed right-5 top-[88px] z-30 w-[min(360px,calc(100vw-2.5rem))] glass rounded-2xl p-4 shadow-2xl"><div className="mb-3 flex items-center justify-between"><b className="text-sm text-ink dark:text-white">Filter data</b><button aria-label="Tutup filter" onClick={onClose} className="text-slate-400"><X size={17} /></button></div><div><span className="block text-[10px] font-bold text-slate-500 dark:text-slate-200">Tahun</span><div className="relative mt-2"><select aria-label="Pilih tahun BANPEM" value={year ?? ''} onChange={event => setYear(Number(event.target.value))} className="h-[38px] w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#102b20] dark:text-white">{years.map(item => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-slate-400" /></div></div><p className="mt-3 text-right text-[11px] text-slate-400">Diterapkan ke seluruh dashboard</p></div>
}

export default function KedelaiBanpemPage() {
  const [filterOpen, setFilterOpen] = useState(false)
  const [source, setSource] = useState<DataSource>('loading')
  const [message, setMessage] = useState('Menghubungkan ke Google Sheets...')
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [rows, setRows] = useState<BanpemRow[]>([])
  const [currentPage, setCurrentPage] = useState(1)

  const loadData = async (year?: number, refresh = false) => {
    setSource('loading')
    setMessage('Menghubungkan ke Google Sheets...')
    try {
      const params = new URLSearchParams()
      if (year) params.set('year', String(year))
      if (refresh) params.set('refresh', '1')
      const response = await fetch(apiUrl(`/api/banpem-sheet${params.size ? `?${params}` : ''}`), { cache: 'no-store' })
      const payload = await response.json() as BanpemResponse
      if (!response.ok) throw new Error(payload.error || 'Gagal mengambil data BANPEM')
      const availableYears = Array.isArray(payload.years) ? payload.years.filter(item => Number.isFinite(item)).sort((a, b) => a - b) : []
      const serverYear = toNumber(payload.selectedYear) || year || 2026
      setYears(availableYears)
      setSelectedYear(serverYear)
      setRows(Array.isArray(payload.rows) ? payload.rows.map(normalizeRow) : [])
      setCurrentPage(1)
      setSource(payload.source === 'sheet' ? 'sheet' : 'demo')
      setMessage(payload.message || `${payload.rows?.length || 0} kabupaten/kota tersedia untuk tahun ${serverYear}`)
    } catch (error) {
      setRows([])
      setSource('error')
      setMessage(error instanceof Error ? `${error.message}.` : 'Gagal menghubungkan ke backend.')
    }
  }

  useEffect(() => { loadData(2026) }, [])
  const changeYear = (year: number) => { setFilterOpen(false); loadData(year) }
  const totals = useMemo(() => sumRows(rows), [rows])
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const pageRows = useMemo(() => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize), [rows, currentPage])
  useEffect(() => { setCurrentPage(page => Math.min(page, totalPages)) }, [totalPages])

  const kpis: Kpi[] = [
    { label: 'Target', value: totals.targetHa, unit: 'Ha', icon: Leaf, background: '#e4f6eb' },
    { label: 'CPCL KAB', value: totals.cpclKab, unit: 'Kab', icon: CheckCircle2, background: '#e4f8ef' },
    { label: 'SK BRMP', value: totals.skBrmpHa, unit: 'Ha', icon: FileCheck2, background: '#e0f4e8' },
    { label: 'SK KPA', value: totals.skKpaHa, unit: 'Ha', icon: ShieldCheck, background: '#e8f7ee' },
    { label: 'SK PPK', value: totals.skPpkHa, unit: 'Ha', icon: CheckCircle2, background: '#e4f6eb' },
    { label: 'Klik', value: totals.klikHa, unit: 'Ha', icon: FileText, background: '#fff1dc' },
    { label: 'Klik', value: totals.klikRp, unit: 'Rp', icon: Banknote, background: '#e4f8ef' },
    { label: 'Kontrak', value: totals.kontrakHa, unit: 'Ha', icon: FileText, background: '#fff1dc' },
    { label: 'Nilai Kontrak', value: totals.nilaiKontrakRp, unit: 'Rp', icon: WalletCards, background: '#e4f6eb' },
    { label: 'Belum Kontrak', value: totals.belumKontrakHa, unit: 'Ha', icon: ShieldCheck, background: '#fff1dc' },
    { label: 'SPM', value: totals.spmRp, unit: 'Rp', icon: FileText, background: '#e4f8ef' },
    { label: 'SP2D', value: totals.sp2dRp, unit: 'Rp', icon: Banknote, background: '#e0f4e8' },
    { label: 'Salur', value: totals.salurHa, unit: 'Ha', icon: Sprout, background: '#e4f6eb' },
    { label: 'Tanam', value: totals.tanamHa, unit: 'Ha', icon: Leaf, background: '#e0f4e8' },
  ]

  const tableHeaders = ['Provinsi', 'Kabupaten/Kota', 'Target (Ha)', 'CPCL KAB', 'SK BRMP (Ha)', 'SK KPA (Ha)', 'SK PPK (Ha)', 'Klik (Ha)', 'Klik (Rp)', 'Kontrak (Ha)', 'Nilai Kontrak (Rp)', 'Belum Kontrak (Ha)', 'SPM (Rp)', 'SP2D (Rp)', 'Salur (Ha)', 'Tanam (Ha)', 'Keterangan']
  return <div><div className="min-h-screen bg-canvas dark:bg-[#061a13] grid-pattern transition-colors"><main>
    <DashboardHeader
      subtitle="Kedelai Insight"
      title="Dashboard BANPEM"
      backHref="/dashboardkedelai"
      onFilterClick={() => setFilterOpen(open => !open)}
    />    <section className="p-5 md:p-9"><div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><h1 className="text-3xl font-bold tracking-tight text-ink dark:text-white md:text-[34px]">Dashboard BANPEM (Bantuan Pemerintah)</h1><p className="mt-3 text-sm text-slate-500 dark:text-slate-300">Pantau realisasi bantuan pemerintah komoditas kedelai per kabupaten/kota.</p></div><button onClick={() => loadData(selectedYear ?? 2026, true)} disabled={source === 'loading'} className="flex items-center gap-2 self-start rounded-xl bg-white px-4 py-3 text-xs font-bold text-slate-600 shadow-sm disabled:opacity-60 dark:bg-white/10 dark:text-white md:self-auto"><RefreshCw size={16} className={source === 'loading' ? 'animate-spin' : ''} /> Refresh</button></div>
      <DataStatus source={source} message={message} />
      {filterOpen && <YearFilter years={years} year={selectedYear} setYear={changeYear} onClose={() => setFilterOpen(false)} />}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/45 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"><span>Filter tahun aktif</span><b className="text-sm text-[#087443] dark:text-[#82d3a4]">{selectedYear ?? '—'}</b></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(kpi => <KpiCard key={`${kpi.label}-${kpi.unit}`} {...kpi} />)}</div>
      <div className="glass mt-6 rounded-2xl p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-bold text-ink dark:text-white">Realisasi BANPEM per Kabupaten/Kota</h2><p className="mt-1 text-xs text-slate-400">Data read-only dari sumber backend Google Sheets untuk tahun {selectedYear ?? 'aktif'}.</p></div><span className="text-xs text-slate-400">{rows.length} kabupaten/kota</span></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[2550px] text-left text-xs"><thead><tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-400 dark:border-white/10">{tableHeaders.map(header => <th key={header} className="whitespace-nowrap px-3 py-3">{header}</th>)}</tr></thead><tbody>{pageRows.map((row, index) => <tr key={`${row.tahun}-${row.provinsi}-${row.kabupatenKota}-${(currentPage - 1) * pageSize + index}`} className="border-b border-slate-100 text-slate-600 dark:border-white/5 dark:text-slate-300"><td className="px-3 py-3 font-semibold text-ink dark:text-white">{row.provinsi || '—'}</td><td className="px-3 py-3 font-semibold">{row.kabupatenKota || '—'}</td><td className="px-3 py-3">{fmt(row.targetHa)}</td><td className="px-3 py-3">{fmt(row.cpclKab)}</td><td className="px-3 py-3">{fmt(row.skBrmpHa)}</td><td className="px-3 py-3">{fmt(row.skKpaHa)}</td><td className="px-3 py-3">{fmt(row.skPpkHa)}</td><td className="px-3 py-3">{fmt(row.klikHa)}</td><td className="px-3 py-3">{fmtRp(row.klikRp)}</td><td className="px-3 py-3">{fmt(row.kontrakHa)}</td><td className="px-3 py-3">{fmtRp(row.nilaiKontrakRp)}</td><td className="px-3 py-3">{fmt(row.belumKontrakHa)}</td><td className="px-3 py-3">{fmtRp(row.spmRp)}</td><td className="px-3 py-3">{fmtRp(row.sp2dRp)}</td><td className="px-3 py-3">{fmt(row.salurHa)}</td><td className="px-3 py-3">{fmt(row.tanamHa)}</td><td className="max-w-[360px] px-3 py-3 leading-relaxed">{row.keterangan || '—'}</td></tr>)}{Boolean(rows.length) && <tr className="bg-[#f4fbf6] font-bold text-ink dark:bg-white/5 dark:text-white"><td className="px-3 py-3" colSpan={2}>Grand total</td><td className="px-3 py-3">{fmt(totals.targetHa)}</td><td className="px-3 py-3">{fmt(totals.cpclKab)}</td><td className="px-3 py-3">{fmt(totals.skBrmpHa)}</td><td className="px-3 py-3">{fmt(totals.skKpaHa)}</td><td className="px-3 py-3">{fmt(totals.skPpkHa)}</td><td className="px-3 py-3">{fmt(totals.klikHa)}</td><td className="px-3 py-3">{fmtRp(totals.klikRp)}</td><td className="px-3 py-3">{fmt(totals.kontrakHa)}</td><td className="px-3 py-3">{fmtRp(totals.nilaiKontrakRp)}</td><td className="px-3 py-3">{fmt(totals.belumKontrakHa)}</td><td className="px-3 py-3">{fmtRp(totals.spmRp)}</td><td className="px-3 py-3">{fmtRp(totals.sp2dRp)}</td><td className="px-3 py-3">{fmt(totals.salurHa)}</td><td className="px-3 py-3">{fmt(totals.tanamHa)}</td><td className="px-3 py-3">—</td></tr>}</tbody></table>{!rows.length && source !== 'loading' && <p className="p-8 text-center text-sm text-slate-400">Data tahun {selectedYear ?? 2026} belum tersedia</p>}</div>{Boolean(rows.length) && <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-4 text-xs dark:border-white/10"><span className="text-slate-400">Menampilkan {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, rows.length)} dari {rows.length} baris</span><div className="flex items-center gap-2"><button aria-label="Halaman sebelumnya" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage === 1} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-white"><ChevronLeft size={15} /></button><span className="min-w-[110px] text-center font-semibold text-slate-500 dark:text-slate-300">Halaman {currentPage} dari {totalPages}</span><button aria-label="Halaman berikutnya" onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={currentPage >= totalPages} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-white"><ChevronRight size={15} /></button></div></div>}</div>
    </section>
  </main></div></div>
}


