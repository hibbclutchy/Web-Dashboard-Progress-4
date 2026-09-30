'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Leaf,
  RefreshCw,
  Search,
  Settings,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import DashboardHeader from '../../../components/DashboardHeader'
import { apiUrl } from '../../../lib/api'
import { months, parseSheetValues, regions as demoRegions, Region } from '../../../lib/data'

type DataSource = 'loading' | 'google-sheets' | 'demo' | 'error'
type SheetResponse = {
  source?: string
  message?: string
  error?: string
  values?: unknown[][]
  rowCount?: number
}
type NotificationState = { text: string; createdAt: number }

const NOTIFICATION_STORAGE_KEY = 'akabi:last-export-notification'
const money = (value: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(value))
const productivity = (row: Region) => row.harvested > 0 ? row.production * 10 / row.harvested : 0
const percentChange = (current: number, previous: number) => previous ? ((current - previous) / Math.abs(previous)) * 100 : 0

export default function Dashboard() {
  const [activePanel, setActivePanel] = useState<'filter' | 'settings' | 'notice' | null>(null)
  const [hasUnreadNotification, setHasUnreadNotification] = useState(false)
  const [notificationText, setNotificationText] = useState('')
  const [data, setData] = useState<Region[]>(demoRegions)
  const [source, setSource] = useState<DataSource>('loading')
  const [dataMessage, setDataMessage] = useState('Menghubungkan ke Google Sheets...')
  const [year, setYear] = useState('Semua Tahun')
  const [province, setProvince] = useState('Semua Provinsi')
  const [city, setCity] = useState('Semua Kabupaten')
  const [month, setMonth] = useState('Semua Bulan')
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [token, setToken] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')

  const loadData = async () => {
    setSource('loading')
    setDataMessage('Menghubungkan ke Google Sheets...')

    try {
      const response = await fetch(apiUrl(`/api/sheets?refresh=1&t=${Date.now()}`), { cache: 'no-store' })
      const payload: SheetResponse = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Gagal mengambil data')

      const parsed = parseSheetValues(payload.values || [])
      if (payload.source === 'google-sheets' && parsed.length) {
        setData(parsed)
        setSource('google-sheets')
        setDataMessage(`${money(parsed.length)} baris data dari Google Sheets`)
      } else if (payload.source === 'google-sheets') {
        setSource('error')
        setDataMessage('Google Sheets tersambung, tetapi header wajib atau baris data tidak ditemukan. Periksa range dan nama kolom.')
      } else {
        setSource('demo')
        setDataMessage(payload.message || 'Kredensial atau data Google Sheets belum siap; data terakhir tetap ditampilkan.')
      }
    } catch (error) {
      setSource('error')
      setDataMessage(error instanceof Error ? `${error.message}. Data terakhir tetap ditampilkan.` : 'Gagal menghubungkan Google Sheets. Data terakhir tetap ditampilkan.')
    }
  }

  useEffect(() => {
    loadData()
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadData()
    }, 15 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY)
    if (saved) {
      try {
        const notification = JSON.parse(saved) as NotificationState
        if (notification.text) setNotificationText(notification.text)
      } catch {
        window.localStorage.removeItem(NOTIFICATION_STORAGE_KEY)
      }
    }

    const receiveNotification = (event: StorageEvent) => {
      if (event.key !== NOTIFICATION_STORAGE_KEY || !event.newValue) return
      try {
        const notification = JSON.parse(event.newValue) as NotificationState
        if (notification.text) {
          setNotificationText(notification.text)
          setHasUnreadNotification(true)
        }
      } catch {
        // Ignore malformed local storage events.
      }
    }

    window.addEventListener('storage', receiveNotification)
    return () => window.removeEventListener('storage', receiveNotification)
  }, [])

  useEffect(() => {
    const closePopups = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setDownloadOpen(false)
      setActivePanel(null)
    }
    window.addEventListener('keydown', closePopups)
    return () => window.removeEventListener('keydown', closePopups)
  }, [])

  useEffect(() => {
    const closePanelOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('[data-panel-trigger]') || target.closest('[data-panel-content]')) return
      setActivePanel(null)
    }
    document.addEventListener('mousedown', closePanelOnOutsideClick)
    return () => document.removeEventListener('mousedown', closePanelOnOutsideClick)
  }, [])

  const years = useMemo(() => ['Semua Tahun', ...Array.from(new Set(data.map(row => row.year))).sort().reverse()], [data])
  const provinces = useMemo(() => ['Semua Provinsi', ...Array.from(new Set(data.map(row => row.province))).sort((a, b) => a.localeCompare(b, 'id'))], [data])
  const cities = useMemo(() => [
    'Semua Kabupaten',
    ...Array.from(new Set(data.filter(row => province === 'Semua Provinsi' || row.province === province).map(row => row.city))).sort((a, b) => a.localeCompare(b, 'id')),
  ], [data, province])

  const matches = (row: Region, includeYear = true) => (
    (!includeYear || year === 'Semua Tahun' || row.year === year) &&
    (province === 'Semua Provinsi' || row.province === province) &&
    (city === 'Semua Kabupaten' || row.city === city) &&
    (month === 'Semua Bulan' || row.month === month) &&
    (!query || `${row.province} ${row.city} ${row.commodity || ''}`.toLowerCase().includes(query.toLowerCase()))
  )

  const filtered = useMemo(() => data.filter(row => matches(row)), [data, year, province, city, month, query])
  const totals = useMemo(() => sumRows(filtered), [filtered])
  const previousYear = useMemo(() => {
    const yearsInData = Array.from(new Set(data.map(row => Number(row.year)).filter(Boolean))).sort((a, b) => b - a)
    const currentYear = year === 'Semua Tahun' ? yearsInData[0] : Number(year)
    return currentYear ? String(currentYear - 1) : ''
  }, [data, year])
  const previousTotals = useMemo(() => sumRows(data.filter(row => row.year === previousYear && matches(row, false))), [data, previousYear, province, city, month, query])
  const productiveRows = filtered.filter(row => row.harvested > 0 && productivity(row) > 0)
  const averageProductivity = productiveRows.length ? productiveRows.reduce((sum, row) => sum + productivity(row), 0) / productiveRows.length : 0
  const totalProductivity = totals.harvested ? totals.production * 10 / totals.harvested : 0
  const previousProductivity = previousTotals.harvested ? previousTotals.production * 10 / previousTotals.harvested : 0
  const previousAverageRows = data.filter(row => row.year === previousYear && matches(row, false) && row.harvested > 0)
  const previousAverageProductivity = previousAverageRows.length ? previousAverageRows.reduce((sum, row) => sum + productivity(row), 0) / previousAverageRows.length : 0
  const trend = months.map(currentMonth => {
    const rows = filtered.filter(row => row.month === currentMonth)
    return {
      month: currentMonth,
      planted: rows.reduce((sum, row) => sum + row.planted, 0),
      harvested: rows.reduce((sum, row) => sum + row.harvested, 0),
    }
  }).filter(row => row.planted || row.harvested)
  const ranked = [...filtered].filter(row => row.harvested > 0 && productivity(row) > 0).sort((a, b) => productivity(b) - productivity(a))
  const zero = filtered.filter(row => row.planted > 0 && row.harvested === 0)
  const showChanges = year !== 'Semua Tahun'

  const exportExcel = async () => {
    setNotice('')
    let valid = false
    try {
      const response = await fetch(apiUrl('/api/export-auth'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        cache: 'no-store',
      })
      const result = await response.json().catch(() => ({ valid: false })) as { valid?: boolean }
      valid = response.ok && Boolean(result.valid)
    } catch {
      setNotice('Gagal memverifikasi token. Periksa koneksi lalu coba lagi.')
      return
    }
    if (!valid) {
      setNotice('Token tidak valid. Silakan periksa kembali.')
      return
    }
    const rows = [
      ['Tahun', 'Bulan', 'Provinsi', 'Kabupaten/Kota', 'Komoditas', 'Luas Tanam (Ha)', 'Luas Panen (Ha)', 'Produksi (Ton)', 'Produktivitas (Ku/Ha)'],
      ...filtered.map(row => [row.year, row.month, row.province, row.city, row.commodity || 'Kedelai', row.planted, row.harvested, row.production, productivity(row).toFixed(2)]),
    ]
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Database Kedelai"><Table>${rows.map(row => `<Row>${row.map(cell => `<Cell><Data ss:Type="${typeof cell === 'number' ? 'Number' : 'String'}">${String(cell).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet></Workbook>`
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/vnd.ms-excel' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'database-kedelai.xls'
    link.click()
    URL.revokeObjectURL(url)

    const notification: NotificationState = { text: 'Export Excel berhasil diunduh.', createdAt: Date.now() }
    window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notification))
    setNotificationText(notification.text)
    setHasUnreadNotification(true)
    setNotice('File Excel berhasil diunduh.')
    setToken('')
    setDownloadOpen(false)
  }

  return (
    <div>
      <div className="min-h-screen bg-canvas dark:bg-[#061a13] grid-pattern transition-colors">
        <main>
          <DashboardHeader
            subtitle="Kedelai Insight"
            title="Dashboard Monitoring"
            backHref="/dashboardkedelai"
            searchValue={query}
            onSearchChange={setQuery}
            hasUnreadNotification={hasUnreadNotification}
            onNotificationClick={() => { if (activePanel !== 'notice') setHasUnreadNotification(false); setActivePanel(activePanel === 'notice' ? null : 'notice') }}
            notificationContent={activePanel === 'notice' && <div data-panel-content className="absolute right-0 top-12 z-40 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-xs shadow-xl dark:border-white/10 dark:bg-[#102b20]"><div className="flex items-start justify-between gap-3"><b className="dark:text-white">Notifikasi</b><button aria-label="Tutup notifikasi" onClick={() => setActivePanel(null)} className="text-slate-400"><X size={15} /></button></div><p className="mt-2 text-slate-500 dark:text-slate-300">{notificationText || 'Belum ada notifikasi baru.'}</p></div>}
            onFilterClick={() => setActivePanel(activePanel === 'filter' ? null : 'filter')}
            onSettingsClick={() => setActivePanel(activePanel === 'settings' ? null : 'settings')}
          />

          <section className="p-5 md:p-9">
            <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div><h1 className="text-3xl font-bold tracking-tight text-ink dark:text-white md:text-[34px]">Dashboard Monitoring</h1><p className="mt-3 text-sm text-slate-500 dark:text-slate-300">Pantau performa komoditas kedelai secara real-time.</p></div>
              <div className="relative flex gap-2"><button onClick={loadData} disabled={source === 'loading'} className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-bold text-slate-600 shadow-sm disabled:opacity-60 dark:bg-white/10 dark:text-white"><RefreshCw size={16} className={source === 'loading' ? 'animate-spin' : ''} /> Refresh</button><button onClick={() => { setNotice(''); setDownloadOpen(true) }} className="flex items-center gap-2 rounded-xl bg-[#0b6b43] px-4 py-3 text-xs font-bold text-white shadow-lg shadow-[#0b6b43]/20"><Download size={16} /> Export Excel</button>{downloadOpen && <TokenDialog token={token} setToken={setToken} notice={notice} onClose={() => { setDownloadOpen(false); setNotice(''); setToken('') }} onExport={exportExcel} />}</div>
            </div>
            <DataStatus source={source} message={dataMessage} />
            {activePanel === 'filter' && <div data-panel-content className="fixed right-5 top-[88px] z-30 w-[min(520px,calc(100vw-2.5rem))] glass rounded-2xl p-4 shadow-2xl"><div className="mb-3 flex items-center justify-between"><b className="text-sm text-ink dark:text-white">Filter data</b><button aria-label="Tutup filter" onClick={() => setActivePanel(null)} className="text-slate-400"><X size={17} /></button></div><Filters year={year} setYear={setYear} month={month} setMonth={setMonth} province={province} setProvince={value => { setProvince(value); setCity('Semua Kabupaten') }} city={city} setCity={setCity} years={years} provinces={provinces} cities={cities} /></div>}
            <Overview filtered={filtered} totals={totals} previousTotals={previousTotals} avg={averageProductivity} previousAvg={previousAverageProductivity} totalProductivity={totalProductivity} previousProductivity={previousProductivity} trend={trend} ranked={ranked} zero={zero} query={query} setQuery={setQuery} showChanges={showChanges} />
            {activePanel === 'settings' && <div data-panel-content><SettingsPage onRefresh={loadData} source={source} onClose={() => setActivePanel(null)} /></div>}
          </section>
        </main>
      </div>
    </div>
  )
}

function sumRows(rows: Region[]) {
  return rows.reduce((sum, row) => ({ planted: sum.planted + row.planted, harvested: sum.harvested + row.harvested, production: sum.production + row.production }), { planted: 0, harvested: 0, production: 0 })
}

function DataStatus({ source, message }: { source: DataSource; message: string }) {
  const className = source === 'google-sheets' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : source === 'loading' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'
  const dotClassName = source === 'loading' ? 'animate-pulse bg-emerald-500' : source === 'google-sheets' ? 'bg-emerald-500' : 'bg-amber-500'
  return <div className={`mb-6 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${className}`}><span className={`h-2 w-2 rounded-full ${dotClassName}`} /><b>{source === 'google-sheets' ? 'Google Sheets tersambung' : source === 'loading' ? 'Memuat data' : source === 'demo' ? 'Mode data contoh' : 'Koneksi bermasalah'}</b><span className="opacity-80"> {message}</span></div>
}

function Filters({ year, setYear, month, setMonth, province, setProvince, city, setCity, years, provinces, cities }: { year: string; setYear: (value: string) => void; month: string; setMonth: (value: string) => void; province: string; setProvince: (value: string) => void; city: string; setCity: (value: string) => void; years: string[]; provinces: string[]; cities: string[] }) {
  return <div><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-200"><Filter size={16} className="text-[#0b7a4b]" /> Filter data</div><button onClick={() => { setYear(`Semua Tahun`); setMonth(`Semua Bulan`); setProvince(`Semua Provinsi`); setCity(`Semua Kabupaten`); }} className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"><X size={14} /> Clear Filter</button></div><div className="mt-4 grid items-start grid-cols-2 gap-3 md:grid-cols-4"><Select label="Tahun" value={year} set={setYear} items={years} /><Select label="Bulan" value={month} set={setMonth} items={['Semua Bulan', ...months]} /><SearchableSelect label="Provinsi" value={province} set={setProvince} items={provinces} placeholder="Cari provinsi..." /><SearchableSelect label="Kabupaten / Kota" value={city} set={setCity} items={cities} placeholder="Cari kabupaten/kota..." /></div><p className="mt-3 text-right text-[11px] text-slate-400">Diterapkan ke seluruh dashboard</p></div>
}

function SearchableSelect({ label, value, set, items, placeholder }: { label: string; value: string; set: (value: string) => void; items: string[]; placeholder: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const visibleItems = items.filter(item => item === value || item.toLowerCase().includes(query.toLowerCase()))
  const choose = (item: string) => { set(item); setQuery(''); setOpen(false) }
  return <div className="relative"><span className="block text-[10px] font-bold text-slate-500 dark:text-slate-200">{label}</span><button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)} className="mt-2 flex h-[38px] w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-xs font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#102b20] dark:text-white"><span className="truncate">{value}</span><ChevronDown size={14} className={`ml-2 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} /></button>{open && <div className="absolute left-0 top-[66px] z-50 w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#102b20]"><div className="flex items-center gap-2 border-b border-slate-100 px-2 pb-2 dark:border-white/10"><Search size={14} className="text-slate-400" /><input autoFocus aria-label={placeholder} value={query} onChange={event => setQuery(event.target.value)} className="w-full bg-transparent py-1 text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-white" placeholder={placeholder} /></div><div role="listbox" className="mt-1 max-h-48 overflow-y-auto">{visibleItems.map(item => <button key={item} role="option" aria-selected={item === value} type="button" onClick={() => choose(item)} className={`w-full rounded-lg px-2 py-2 text-left text-xs ${item === value ? 'bg-[#e4f6eb] font-semibold text-[#087443] dark:bg-[#159a5c]/20 dark:text-[#b8efd0]' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/10'}`}>{item}</button>)}{!visibleItems.length && <p className="px-2 py-3 text-center text-[11px] text-slate-400">Wilayah tidak ditemukan.</p>}</div></div>}</div>
}
function Overview({ filtered, totals, previousTotals, avg, previousAvg, totalProductivity, previousProductivity, trend, ranked, zero, query, setQuery, showChanges }: { filtered: Region[]; totals: { planted: number; harvested: number; production: number }; previousTotals: { planted: number; harvested: number; production: number }; avg: number; previousAvg: number; totalProductivity: number; previousProductivity: number; trend: { month: string; planted: number; harvested: number }[]; ranked: Region[]; zero: Region[]; query: string; setQuery: (value: string) => void; showChanges: boolean }) {
  const kpis: [string, number, string, LucideIcon, string, number][] = [
    ['Total Luas Tanam', totals.planted, 'Ha', Leaf, '#e4f6eb', previousTotals.planted],
    ['Total Luas Panen', totals.harvested, 'Ha', CheckCircle2, '#e4f8ef', previousTotals.harvested],
    ['Total Produksi', totals.production, 'Ton', Activity, '#fff1dc', previousTotals.production],
    ['Produktivitas Keseluruhan', totalProductivity, 'Kuintal/Ha', Activity, '#e0f4e8', previousProductivity],
  ]
  return <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{kpis.map(([label, value, unit, Icon, background, previous]) => <div className="glass rounded-2xl p-5" key={label}><div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background }}><Icon size={19} className="text-[#087443]" /></div><p className="mt-5 text-xs font-semibold text-slate-500 dark:text-slate-300">{label}</p><div className="mt-1 flex items-baseline gap-1"><b className="text-2xl text-ink dark:text-white">{value.toFixed(2).replace(/\.00$/, '') === '0' ? '0' : unit === 'Ha' || unit === 'Ton' ? money(value) : value.toFixed(2)}</b><span className="text-xs text-slate-400">{unit}</span></div>{showChanges && <Change current={value} previous={previous} />}</div>)}</div><div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_1fr]"><div className="glass rounded-2xl p-5"><h2 className="font-bold text-ink dark:text-white">Tren Luas Tanam & Panen</h2><p className="mt-1 text-xs text-slate-400">Performa bulanan sesuai filter aktif</p><div className="mt-5 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={trend} barGap={8}><CartesianGrid vertical={false} stroke="#e9edf4" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9aa4b5' }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9aa4b5' }} /><Tooltip contentStyle={{ border: '1px solid rgba(148,163,184,.2)', borderRadius: 12 }} formatter={(value) => typeof value === 'number' ? value.toFixed(2) : value} /><Bar dataKey="planted" name="Luas Tanam (Ha)" fill="#159a5c" radius={[5, 5, 0, 0]} /><Bar dataKey="harvested" name="Luas Panen (Ha)" fill="#f4a261" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></div><div className="glass rounded-2xl p-5"><h2 className="font-bold text-ink dark:text-white">Top Wilayah</h2><p className="mt-1 text-xs text-slate-400">Produktivitas tertinggi</p><div className="mt-5 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={ranked.slice(0, 6).map(row => ({ city: row.city, value: Number(productivity(row).toFixed(1)) }))} layout="vertical" margin={{ left: 5, right: 12 }}><XAxis type="number" hide /><YAxis type="category" dataKey="city" width={105} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#718096' }} /><Bar dataKey="value" radius={[0, 5, 5, 0]} barSize={14}>{ranked.slice(0, 6).map((_, index) => <Cell key={index} fill={index === 0 ? '#159a5c' : '#82d3a4'} />)}</Bar><Tooltip /></BarChart></ResponsiveContainer></div></div></div><div className="mt-6 grid grid-cols-2 items-stretch gap-3 md:gap-6"><div className="glass flex min-h-[390px] flex-col rounded-2xl p-5"><h2 className="font-bold text-ink dark:text-white">Early Warning System</h2><p className="mt-1 text-xs text-slate-400">Wilayah dengan produktivitas terendah</p><div className="mt-4 space-y-3">{ranked.slice(-5).reverse().map(row => <RegionLine key={`${row.city}-${row.month}`} row={row} />)}{!ranked.length && <Empty />}</div></div><div className="glass flex min-h-[390px] flex-col rounded-2xl p-5"><h2 className="font-bold text-ink dark:text-white">Zero Report</h2><p className="mt-1 text-xs text-slate-400">Wilayah belum melaporkan panen</p><div className="mt-4 space-y-3">{zero.slice(0, 5).map(row => <RegionLine key={`${row.city}-${row.month}`} row={row} zero />)}{!zero.length && <Empty text="Tidak ada zero report pada filter ini." />}</div></div></div><div className="mt-6"><ProvinceMapPlaceholder /></div><DataTable rows={filtered} query={query} setQuery={setQuery} /></>
}

function ProvinceMapPlaceholder() {
  const tiles = ['Sumatera', 'Jawa', 'Kalimantan', 'Sulawesi', 'Bali & Nusa Tenggara', 'Maluku', 'Papua']
  return <div className="glass rounded-2xl p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-ink dark:text-white">Persebaran per Provinsi</h2><p className="mt-1 text-xs text-slate-400">Preview layout peta  data spasial akan ditambahkan</p></div><span className="rounded-full bg-[#e4f6eb] px-2.5 py-1 text-[10px] font-bold text-[#087443] dark:bg-[#159a5c]/20 dark:text-[#82d3a4]">Coming soon</span></div><div className="relative mt-5 flex h-64 items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#82d3a4]/60 bg-[#f4fbf6] dark:bg-[#0b2117]"><div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'linear-gradient(rgba(21,154,92,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(21,154,92,.12) 1px, transparent 1px)', backgroundSize: '24px 24px' }} /><svg viewBox="0 0 520 220" className="relative h-[85%] w-[92%]" aria-label="Shape placeholder peta Indonesia"><path d="M35 65l42-14 33 11 31-19 45 7 19 20 44-8 28 18 42-4 17 20-35 16-51-5-26 19-40-8-36 17-49-12-42 3-20-22 18-20zM146 139l44-8 42 13-10 17-51 3-31-12zM274 142l33-10 42 10-16 21-45-2zM382 128l47-15 54 17-9 26-66 11-37-16z" fill="#c7ebd5" stroke="#159a5c" strokeWidth="2" strokeLinejoin="round" /><path d="M98 60l-18 50M152 52l-8 60M207 63l-8 54M270 74l-7 43M330 84l-5 43M402 84l-12 45" stroke="#82d3a4" strokeWidth="1.5" strokeDasharray="4 4" /></svg><div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-white/85 px-2.5 py-1.5 text-[10px] text-slate-500 shadow-sm dark:bg-[#102b20]/90 dark:text-slate-300"><span className="h-2.5 w-2.5 rounded-full bg-[#159a5c]" /> Shape provinsi</div></div><div className="mt-4 grid grid-cols-2 gap-2 text-[10px] text-slate-500 dark:text-slate-300 sm:grid-cols-4">{tiles.map((tile, index) => <div key={tile} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${['bg-[#159a5c]', 'bg-[#f4a261]', 'bg-[#75c9a5]', 'bg-[#8ad2a5]', 'bg-[#d996c7]', 'bg-[#f0c36b]', 'bg-[#9ea5b5]'][index]}`} />{tile}</div>)}</div></div>
}
function Change({ current, previous }: { current: number; previous: number }) {
  const change = percentChange(current, previous)
  if (!previous) return <p className="mt-3 text-[11px] text-slate-400">Belum ada data tahun sebelumnya</p>
  const up = change >= 0
  return <p className={`mt-3 flex items-center gap-1 text-[11px] font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>{up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {up ? 'Naik' : 'Turun'} {Math.abs(change).toFixed(1)}% <span className="font-normal text-slate-400">vs tahun sebelumnya</span></p>
}

function DataTable({ rows, query, setQuery }: { rows: Region[]; query: string; setQuery: (value: string) => void }) {
  const pageSize = 25
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const pageRows = useMemo(() => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize), [rows, currentPage])

  useEffect(() => { setCurrentPage(1) }, [rows, query])
  useEffect(() => { setCurrentPage(page => Math.min(page, totalPages)) }, [totalPages])

  return <div className="glass mt-6 rounded-2xl p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-bold text-ink dark:text-white">Data Tabular Rinci</h2><p className="mt-1 text-xs text-slate-400">Database sesuai filter dan pencarian wilayah aktif.</p></div><div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-white/10 dark:bg-[#102b20] dark:text-slate-200"><Search size={14} /><input aria-label="Cari wilayah pada tabel" value={query} onChange={event => setQuery(event.target.value)} className="w-44 bg-transparent text-slate-700 outline-none placeholder:text-slate-400 dark:text-white" placeholder="Cari wilayah..." /><span className="ml-2 text-[10px] text-slate-400">{rows.length} baris</span></div></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead><tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-400 dark:border-white/10">{['Tahun', 'Bulan', 'Provinsi', 'Kabupaten/Kota', 'Komoditas', 'Luas Tanam (Ha)', 'Luas Panen (Ha)', 'Produksi (Ton)', 'Produktivitas (Ku/Ha)'].map(header => <th key={header} className="whitespace-nowrap px-3 py-3">{header}</th>)}</tr></thead><tbody>{pageRows.map((row, index) => <tr key={`${row.year}-${row.city}-${row.month}-${(currentPage - 1) * pageSize + index}`} className="border-b border-slate-100 text-slate-600 dark:border-white/5 dark:text-slate-300"><td className="px-3 py-3">{row.year}</td><td className="px-3 py-3">{row.month}</td><td className="px-3 py-3 font-semibold">{row.province}</td><td className="px-3 py-3">{row.city}</td><td className="px-3 py-3">{row.commodity || 'Kedelai'}</td><td className="px-3 py-3">{money(row.planted)}</td><td className="px-3 py-3">{money(row.harvested)}</td><td className="px-3 py-3">{money(row.production)}</td><td className="px-3 py-3">{productivity(row).toFixed(2)}</td></tr>)}</tbody></table>{!rows.length && <Empty />}</div><div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-4 text-xs dark:border-white/10"><span className="text-slate-400">Menampilkan {rows.length ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, rows.length)} dari {rows.length} baris</span><div className="flex items-center gap-2"><button aria-label="Halaman sebelumnya" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage === 1} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-white"><ChevronLeft size={15} /></button><span className="min-w-[100px] text-center font-semibold text-slate-500 dark:text-slate-300">Halaman {Math.min(currentPage, totalPages)} / {totalPages}</span><button aria-label="Halaman berikutnya" onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={currentPage >= totalPages} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-white"><ChevronRight size={15} /></button></div></div></div>
}

function SettingsPage({ source, onRefresh, onClose }: { source: DataSource; onRefresh: () => void; onClose: () => void }) {
  return <div className="fixed right-5 top-[88px] z-40 w-[min(430px,calc(100vw-2.5rem))] glass rounded-2xl p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-ink dark:text-white">Koneksi data</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Google Sheets dikonfigurasi aman di server melalui file <code>.env.local</code>.</p></div><button aria-label="Tutup settings" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"><X size={17} /></button></div><div className="mt-5 rounded-xl border border-slate-200 p-4 text-sm dark:border-white/10"><div className="flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${source === 'google-sheets' ? 'bg-emerald-500' : 'bg-amber-500'}`} /><div><b className="dark:text-white">{source === 'google-sheets' ? 'Google Sheets tersambung' : 'Belum menggunakan data Google Sheets'}</b><p className="mt-1 text-xs text-slate-400">Pastikan API key dibatasi untuk Google Sheets API dan spreadsheet dapat diakses oleh API key.</p></div></div></div><button onClick={onRefresh} className="mt-5 flex items-center gap-2 rounded-xl bg-[#0b6b43] px-4 py-3 text-xs font-bold text-white"><RefreshCw size={15} /> Uji & muat ulang koneksi</button></div>
}

function TokenDialog({ token, setToken, notice, onClose, onExport }: { token: string; setToken: (value: string) => void; notice: string; onClose: () => void; onExport: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" onMouseDown={onClose}><div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#102b20]" onMouseDown={event => event.stopPropagation()}><div className="flex items-start justify-between"><div><h2 className="font-bold dark:text-white">Secure Excel export</h2><p className="mt-1 text-xs text-slate-400">Masukkan token untuk mengunduh database Excel sesuai filter.</p></div><button aria-label="Tutup dialog" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"><X size={18} /></button></div><input autoFocus value={token} onChange={event => setToken(event.target.value)} onKeyDown={event => event.key === 'Enter' && onExport()} placeholder="Masukkan token akses" className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none dark:border-white/10 dark:bg-white/5 dark:text-white" /><div className="mt-4 flex justify-end gap-2"><button onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">Batal</button><button onClick={onExport} className="rounded-xl bg-[#0b7a4b] px-4 py-2.5 text-xs font-bold text-white">Download Excel</button></div>{notice && <p className="mt-3 text-xs text-red-500">{notice}</p>}</div></div>
}

function RegionLine({ row, zero }: { row: Region; zero?: boolean }) {
  return <div className="flex items-center gap-3"><div className={`grid h-8 w-8 place-items-center rounded-full text-[10px] font-bold ${zero ? 'bg-amber-50 text-amber-500 dark:bg-amber-500/10' : 'bg-red-50 text-red-500 dark:bg-red-500/10'}`}>{zero ? 'ZR' : <AlertTriangle size={14} />}</div><div className="flex-1"><b className="block text-xs text-slate-700 dark:text-white">{row.city}</b><span className="text-[10px] text-slate-400">{row.province}  {row.month} {row.year}</span></div><b className={`text-xs ${zero ? 'text-amber-500' : 'text-red-500'}`}>{zero ? 'Perlu follow up' : `${productivity(row).toFixed(2)} Ku/Ha`}</b></div>
}

function Empty({ text = 'Tidak ada data untuk filter yang dipilih.' }: { text?: string }) {
  return <p className="p-8 text-center text-xs text-slate-400">{text}</p>
}

function Select({ label, value, set, items }: { label: string; value: string; set: (value: string) => void; items: string[] }) {
  const [open, setOpen] = useState(false)
  const choose = (item: string) => { set(item); setOpen(false) }
  return <div className="relative"><span className="block text-[10px] font-bold text-slate-500 dark:text-slate-200">{label}</span><button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)} className="mt-2 flex h-[38px] w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-xs font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#102b20] dark:text-white"><span className="truncate">{value}</span><ChevronDown size={14} className={`ml-2 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} /></button>{open && <div className="absolute left-0 top-[66px] z-50 w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#102b20]"><div role="listbox" className="max-h-48 overflow-y-auto">{items.map(item => <button key={item} role="option" aria-selected={item === value} type="button" onClick={() => choose(item)} className={`w-full rounded-lg px-2 py-2 text-left text-xs ${item === value ? 'bg-[#e4f6eb] font-semibold text-[#087443] dark:bg-[#159a5c]/20 dark:text-[#b8efd0]' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/10'}`}>{item}</button>)}</div></div>}</div>
}
























