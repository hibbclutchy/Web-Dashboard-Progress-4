'use client'

import { useEffect, useMemo, useState } from 'react'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, Tooltip } from 'react-leaflet'
import type { Region } from '../lib/data'
import { apiUrl } from '../lib/api'

type RegionSummary = Region & { key: string; productivity: number }
type Coordinate = { name: string; lat: number; lng: number }

type ProductivityMapProps = { data: Region[]; year: string }

const productivityFor = (row: Pick<Region, 'harvested' | 'production'>) => row.harvested > 0 ? row.production * 10 / row.harvested : 0

function markerColor(value: number, min: number, max: number) {
  const ratio = max > min ? (value - min) / (max - min) : 0.5
  const hue = Math.round(18 + ratio * 122)
  return `hsl(${hue} 72% 43%)`
}

function markerIcon(summary: RegionSummary, min: number, max: number) {
  const ratio = max > min ? (summary.productivity - min) / (max - min) : 0.5
  const size = Math.round(18 + ratio * 14)
  const color = markerColor(summary.productivity, min, max)
  return divIcon({
    className: 'productivity-marker',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 2px 7px rgba(15,65,38,.35)"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export default function ProductivityMap({ data, year }: ProductivityMapProps) {
  const grouped = useMemo(() => {
    const groups = new Map<string, RegionSummary>()
    data.filter(row => year === 'Semua Tahun' || row.year === year).forEach(row => {
      const key = `${row.province}::${row.city}`
      const current = groups.get(key) || { ...row, key, planted: 0, harvested: 0, production: 0, productivity: 0 }
      current.planted += row.planted
      current.harvested += row.harvested
      current.production += row.production
      current.productivity = productivityFor(current)
      groups.set(key, current)
    })
    return [...groups.values()].filter(row => row.city)
  }, [data, year])

  const names = useMemo(() => [...new Set(grouped.map(row => row.city))], [grouped])
  const [coordinates, setCoordinates] = useState<Coordinate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!names.length) {
      setCoordinates([])
      setError('')
      return () => { cancelled = true }
    }
    setLoading(true)
    setError('')
    fetch(apiUrl('/api/region-coordinates'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names }),
      cache: 'no-store',
    }).then(async response => {
      const payload = await response.json().catch(() => ({})) as { points?: Coordinate[]; error?: string }
      if (!response.ok) throw new Error(payload.error || 'Gagal mengambil koordinat wilayah.')
      if (!cancelled) setCoordinates(Array.isArray(payload.points) ? payload.points : [])
    }).catch(fetchError => {
      if (!cancelled) {
        setCoordinates([])
        setError(fetchError instanceof Error ? fetchError.message : 'Gagal mengambil koordinat wilayah.')
      }
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [names])

  const coordinateByName = useMemo(() => new Map(coordinates.map(point => [point.name, point])), [coordinates])
  const points = useMemo(() => grouped.flatMap(summary => {
    const coordinate = coordinateByName.get(summary.city)
    return coordinate ? [{ summary, coordinate }] : []
  }), [coordinateByName, grouped])
  const values = grouped.map(row => row.productivity)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 0

  return <div className="glass rounded-2xl p-5">
    <div className="flex items-start justify-between gap-3">
      <div><h2 className="font-bold text-ink dark:text-white">Persebaran per Kabupaten/Kota</h2><p className="mt-1 text-xs text-slate-400">Produktivitas berdasarkan tahun yang dipilih</p></div>
      <div className="text-right text-[10px] text-slate-400">{year}</div>
    </div>
    {loading && <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">Memuat koordinat wilayah...</p>}
    {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-200">{error}</p>}
    {!loading && !error && grouped.length > 0 && !points.length && <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">Belum ada titik koordinat yang cocok untuk tahun tersebut.</p>}
    {!loading && !error && !grouped.length && <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">Tidak ada data wilayah untuk tahun tersebut.</p>}
    <div className="relative mt-4 h-[380px] overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
      <MapContainer center={[-2.5, 118]} zoom={5} scrollWheelZoom className="h-full w-full">
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {points.map(({ summary, coordinate }) => <Marker key={summary.key} position={[coordinate.lat, coordinate.lng]} icon={markerIcon(summary, min, max)}><Tooltip>{summary.city} — {summary.productivity.toFixed(2)} Ku/Ha</Tooltip><Popup>{summary.city} — {summary.productivity.toFixed(2)} Ku/Ha</Popup></Marker>)}
      </MapContainer>
      <div className="absolute bottom-3 left-3 z-[1000] rounded-lg bg-white/90 px-3 py-2 text-[10px] text-slate-600 shadow-sm dark:bg-[#102b20]/90 dark:text-slate-200">
        <div className="mb-1 font-semibold">Produktivitas</div>
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#b84a24]" /> Rendah <span className="ml-1 h-3.5 w-3.5 rounded-full bg-[#159a5c]" /> Tinggi</div>
        <div className="mt-1 text-slate-400">Ukuran titik mengikuti nilai</div>
      </div>
    </div>
  </div>
}
