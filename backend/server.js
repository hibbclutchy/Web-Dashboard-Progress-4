import { createServer } from 'node:http'
import { URL } from 'node:url'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { centroid, feature } from '@turf/turf'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadEnvFile(path.join(__dirname, '.env'))

const PORT = Number(process.env.PORT || 4000)
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000'
const CACHE_TTL_MS = 15 * 60 * 1000
const REQUEST_TIMEOUT_MS = 90 * 1000
const REGION_REQUEST_DELAY_MS = 500
const REGION_429_RETRY_DELAY_MS = 2500
const REGION_CACHE_FILE = path.join(__dirname, 'cache', 'region-coordinates.json')
const RANGE_CHUNK_SIZE = 5000
const responseCache = new Map()
const regionCoordinateCache = new Map()
const pendingRequests = new Map()

function loadRegionCoordinateCache() {
  if (!existsSync(REGION_CACHE_FILE)) return
  try {
    const saved = JSON.parse(readFileSync(REGION_CACHE_FILE, 'utf8'))
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [name, coordinate] of Object.entries(saved)) {
        if (coordinate === null || (coordinate && Number.isFinite(coordinate.lat) && Number.isFinite(coordinate.lng))) {
          regionCoordinateCache.set(name, coordinate)
        }
      }
    }
  } catch (error) {
    console.warn(`Cache koordinat wilayah tidak dapat dibaca: ${error?.message || 'format tidak valid'}`)
  }
}

function saveRegionCoordinateCache() {
  mkdirSync(path.dirname(REGION_CACHE_FILE), { recursive: true })
  writeFileSync(REGION_CACHE_FILE, JSON.stringify(Object.fromEntries(regionCoordinateCache), null, 2))
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

loadRegionCoordinateCache()

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!match || match[1] in process.env) continue
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}

function clean(value) {
  if (value === null || value === undefined) return ''
  const text = String(value).trim()
  if (!text || ['-', '#VALUE!', '#N/A', '#DIV/0!', '#REF!', 'N/A'].includes(text.toUpperCase())) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? value : ''

  const normalized = text.replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.')
  if (/^[-+]?\d+(?:[.,]\d+)?$/.test(normalized)) {
    const numeric = Number(normalized)
    if (Number.isFinite(numeric)) return numeric
  }
  return text
}

function valuesEndpoint(spreadsheetId, range, key) {
  const params = new URLSearchParams({ key, fields: 'values', valueRenderOption: 'UNFORMATTED_VALUE', majorDimension: 'ROWS' })
  return `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?${params}`
}

function metadataEndpoint(spreadsheetId, key) {
  const params = new URLSearchParams({ key, fields: 'sheets(properties(title,gridProperties(rowCount)))' })
  return `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?${params}`
}

async function fetchJson(endpoint) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const apiMessage = payload?.error?.message || payload?.error?.status
      throw new Error(apiMessage ? `Google Sheets API: ${apiMessage}` : `Google Sheets API error (${response.status})`)
    }
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchRawValues(spreadsheetId, range, key) {
  const payload = await fetchJson(valuesEndpoint(spreadsheetId, range, key))
  return Array.isArray(payload.values) ? payload.values.filter(Array.isArray).map(row => row.map(clean)) : []
}

async function fetchOpenRangeValues(spreadsheetId, range, key, match) {
  const [, rawSheetName, firstColumn, lastColumn] = match
  const sheetName = rawSheetName.replace(/^'|'$/g, '').replace(/''/g, "'")
  const metadata = await fetchJson(metadataEndpoint(spreadsheetId, key))
  const rowCount = metadata.sheets?.find(sheet => sheet.properties?.title === sheetName)?.properties?.gridProperties?.rowCount
  if (!rowCount || rowCount < 1) return fetchRawValues(spreadsheetId, range, key)

  const ranges = Array.from({ length: Math.ceil(rowCount / RANGE_CHUNK_SIZE) }, (_, index) => {
    const start = index * RANGE_CHUNK_SIZE + 1
    const end = Math.min(rowCount, start + RANGE_CHUNK_SIZE - 1)
    return `${rawSheetName}!${firstColumn}${start}:${lastColumn}${end}`
  })
  return (await Promise.all(ranges.map(chunkRange => fetchRawValues(spreadsheetId, chunkRange, key)))).flat()
}

async function fetchSheetValues(spreadsheetId, range, key, cacheKey, forceRefresh) {
  const now = Date.now()
  const cached = responseCache.get(cacheKey)
  if (!forceRefresh && cached && cached.expiresAt > now) return cached.values

  const pending = pendingRequests.get(cacheKey)
  if (pending) return pending

  const request = (async () => {
    const openRange = range.match(/^(.+)!([A-Z]+):([A-Z]+)$/i)
    const values = openRange
      ? await fetchOpenRangeValues(spreadsheetId, range, key, openRange)
      : await fetchRawValues(spreadsheetId, range, key)
    responseCache.set(cacheKey, { values, expiresAt: Date.now() + CACHE_TTL_MS })
    return values
  })()

  pendingRequests.set(cacheKey, request)
  try {
    return await request
  } finally {
    pendingRequests.delete(cacheKey)
  }
}

async function sheetsHandler(url) {
  const range = url.searchParams.get('range') || process.env.GOOGLE_SHEETS_RANGE || 'Sheet1!A:Z'
  const forceRefresh = url.searchParams.get('refresh') === '1'
  const key = process.env.GOOGLE_SHEETS_API_KEY?.trim()
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim()

  if (!key || !spreadsheetId || key.startsWith('your_') || spreadsheetId.startsWith('your_')) {
    return { status: 200, body: { source: 'demo', message: 'Google Sheets credentials are not configured.', values: [] } }
  }

  const cacheKey = `${spreadsheetId}:${range}`
  try {
    const values = await fetchSheetValues(spreadsheetId, range, key, cacheKey, forceRefresh)
    return { status: 200, body: { source: 'google-sheets', values, rowCount: Math.max(0, values.length - 1), range } }
  } catch (error) {
    const cached = responseCache.get(cacheKey)
    if (cached) return { status: 200, body: { source: 'google-sheets', values: cached.values, rowCount: Math.max(0, cached.values.length - 1), range, message: 'Menggunakan cache terakhir karena koneksi sedang bermasalah.' } }
    const message = error?.name === 'AbortError' ? 'Google Sheets terlalu lama merespons (batas 90 detik).' : error?.message || 'Unable to reach Google Sheets.'
    return { status: 502, body: { source: 'error', error: message } }
  }
}

const banpemDemoRows = [
  { tahun: 2026, provinsi: 'Jawa Timur', kabupatenKota: 'Ngawi', targetHa: 1850, cpclKab: 1760, skBrmpHa: 1700, skKpaHa: 1640, skPpkHa: 1580, klikHa: 1500, klikRp: 9750000000, kontrakHa: 1420, nilaiKontrakRp: 9230000000, belumKontrakHa: 430, spmRp: 7800000000, sp2dRp: 6500000000, salurHa: 1000, tanamHa: 875, keterangan: '' },
  { tahun: 2026, provinsi: 'Jawa Tengah', kabupatenKota: 'Grobogan', targetHa: 1575, cpclKab: 1490, skBrmpHa: 1450, skKpaHa: 1380, skPpkHa: 1320, klikHa: 1260, klikRp: 8190000000, kontrakHa: 1210, nilaiKontrakRp: 7865000000, belumKontrakHa: 365, spmRp: 6700000000, sp2dRp: 5520000000, salurHa: 845, tanamHa: 720, keterangan: '' },
  { tahun: 2026, provinsi: 'Sulawesi Selatan', kabupatenKota: 'Bone', targetHa: 1120, cpclKab: 1040, skBrmpHa: 1010, skKpaHa: 960, skPpkHa: 900, klikHa: 845, klikRp: 5492500000, kontrakHa: 860, nilaiKontrakRp: 5590000000, belumKontrakHa: 260, spmRp: 4700000000, sp2dRp: 3900000000, salurHa: 590, tanamHa: 505, keterangan: 'Data contoh mode demo.' },
]

function numeric(value) {
  const cleaned = clean(value)
  return typeof cleaned === 'number' && Number.isFinite(cleaned) ? cleaned : 0
}

function normalizeHeader(value) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

function findHeaderIndex(headers, aliases) {
  const normalizedHeaders = headers.map(normalizeHeader)
  const normalizedAliases = aliases.map(normalizeHeader)
  const exact = normalizedHeaders.findIndex(header => normalizedAliases.includes(header))
  if (exact >= 0) return exact
  return normalizedHeaders.findIndex(header => normalizedAliases.some(alias => header.includes(alias) || alias.includes(header)))
}

function banpemHeaderMap(headers) {
  return {
    tahun: findHeaderIndex(headers, ['Tahun']),
    provinsi: findHeaderIndex(headers, ['Provinsi']),
    kabupatenKota: findHeaderIndex(headers, ['Kabupaten/Kota', 'Kabupaten Kota', 'Kab/Kota']),
    targetHa: findHeaderIndex(headers, ['Target (Ha)', 'Target Ha']),
    cpclKab: findHeaderIndex(headers, ['CPCL KAB', 'CPCL Kabupaten']),
    skBrmpHa: findHeaderIndex(headers, ['SK BRMP (Ha)', 'SK BRMP Ha']),
    skKpaHa: findHeaderIndex(headers, ['SK KPA (Ha)', 'SK KPA Ha']),
    skPpkHa: findHeaderIndex(headers, ['SK PPK (Ha)', 'SK PPK Ha']),
    klikHa: findHeaderIndex(headers, ['Klik (Ha)', 'Klik Ha']),
    klikRp: findHeaderIndex(headers, ['Klik (Rp)', 'Klik Rp']),
    kontrakHa: findHeaderIndex(headers, ['Kontrak (Ha)', 'Kontrak Ha']),
    nilaiKontrakRp: findHeaderIndex(headers, ['Nilai Kontrak (Rp)', 'Nilai Kontrak Rp', 'Nilai Kontrak']),
    belumKontrakHa: findHeaderIndex(headers, ['Belum Kontrak (Ha)', 'Belum Kontrak Ha']),
    spmRp: findHeaderIndex(headers, ['SPM (Rp)', 'SPM Rp']),
    sp2dRp: findHeaderIndex(headers, ['SP2D (Rp)', 'SP2D Rp']),
    salurHa: findHeaderIndex(headers, ['Salur (Ha)', 'Salur Ha']),
    tanamHa: findHeaderIndex(headers, ['Tanam (Ha)', 'Tanam Ha']),
    keterangan: findHeaderIndex(headers, ['Keterangan', 'Catatan', 'Keterangan/Catatan', 'Ket']),
  }
}

function valueAt(row, index) {
  return index >= 0 ? row[index] : ''
}

function textAt(row, index) {
  return String(valueAt(row, index) ?? '').trim()
}

function parseBanpemValues(values) {
  const headers = Array.isArray(values[0]) ? values[0] : []
  const map = banpemHeaderMap(headers)
  if (map.tahun < 0) return []
  return values.slice(1).map(row => ({
    tahun: numeric(valueAt(row, map.tahun)),
    provinsi: textAt(row, map.provinsi),
    kabupatenKota: textAt(row, map.kabupatenKota),
    targetHa: numeric(valueAt(row, map.targetHa)),
    cpclKab: numeric(valueAt(row, map.cpclKab)),
    skBrmpHa: numeric(valueAt(row, map.skBrmpHa)),
    skKpaHa: numeric(valueAt(row, map.skKpaHa)),
    skPpkHa: numeric(valueAt(row, map.skPpkHa)),
    klikHa: numeric(valueAt(row, map.klikHa)),
    klikRp: numeric(valueAt(row, map.klikRp)),
    kontrakHa: numeric(valueAt(row, map.kontrakHa)),
    nilaiKontrakRp: numeric(valueAt(row, map.nilaiKontrakRp)),
    belumKontrakHa: numeric(valueAt(row, map.belumKontrakHa)),
    spmRp: numeric(valueAt(row, map.spmRp)),
    sp2dRp: numeric(valueAt(row, map.sp2dRp)),
    salurHa: numeric(valueAt(row, map.salurHa)),
    tanamHa: numeric(valueAt(row, map.tanamHa)),
    keterangan: textAt(row, map.keterangan),
  })).filter(row => row.tahun)
}

const banpemNumericFields = ['targetHa', 'cpclKab', 'skBrmpHa', 'skKpaHa', 'skPpkHa', 'klikHa', 'klikRp', 'kontrakHa', 'nilaiKontrakRp', 'belumKontrakHa', 'spmRp', 'sp2dRp', 'salurHa', 'tanamHa']

function hasBanpemData(row) {
  return banpemNumericFields.some(field => row[field] > 0)
}

function banpemYears(rows) {
  return [...new Set(rows.map(row => row.tahun).filter(Boolean))].sort((a, b) => a - b)
}

function defaultBanpemYear(rows) {
  const yearsWithData = banpemYears(rows).filter(year => rows.some(row => row.tahun === year && hasBanpemData(row)))
  return yearsWithData.at(-1) || banpemYears(rows).at(-1) || 2026
}

function banpemBody(source, rows, options, range) {
  const years = banpemYears(rows)
  const requestedYear = Number(options?.year)
  const selectedYear = Number.isFinite(requestedYear) && requestedYear > 0 ? requestedYear : defaultBanpemYear(rows)
  const filteredRows = rows.filter(row => row.tahun === selectedYear)
  return { source, years, rows: filteredRows, selectedYear, range, ...(options?.text ? { message: options.text } : {}) }
}

async function banpemSheetHandler(url) {
  const range = url.searchParams.get('range') || 'MASTERBANPEM!A:Z'
  const forceRefresh = url.searchParams.get('refresh') === '1'
  const key = process.env.GOOGLE_SHEETS_API_KEY?.trim()
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim()
  const requestedYear = Number(url.searchParams.get('year'))
  const requestOptions = { year: Number.isFinite(requestedYear) ? requestedYear : undefined }
  const demo = message => ({ status: 200, body: banpemBody('demo', banpemDemoRows, { ...requestOptions, text: message }, range) })

  if (!key || !spreadsheetId || key.startsWith('your_') || spreadsheetId.startsWith('your_')) {
    return demo('Google Sheets credentials are not configured.')
  }

  const cacheKey = `${spreadsheetId}:banpem:${range}`
  try {
    const values = await fetchSheetValues(spreadsheetId, range, key, cacheKey, forceRefresh)
    const rows = parseBanpemValues(values)
    if (!rows.length) return demo('Data BANPEM belum tersedia; menampilkan data contoh.')
    return { status: 200, body: banpemBody('sheet', rows, requestOptions, range) }
  } catch (error) {
    const cached = responseCache.get(cacheKey)
    const cachedRows = cached ? parseBanpemValues(cached.values) : []
    if (cachedRows.length) return { status: 200, body: banpemBody('sheet', cachedRows, { ...requestOptions, text: 'Menggunakan cache terakhir karena koneksi sedang bermasalah.' }, range) }
    return demo(error?.name === 'AbortError' ? 'Google Sheets terlalu lama merespons; menampilkan data contoh.' : 'Google Sheets belum siap; menampilkan data contoh.')
  }
}
async function fetchRegionJson(endpoint) {
  await sleep(REGION_REQUEST_DELAY_MS)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(`Wilayah API error (${response.status})`)
      error.status = response.status
      error.retryAfter = response.headers.get('retry-after')
      throw error
    }
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

function retryAfterMs(value) {
  if (!value) return REGION_429_RETRY_DELAY_MS
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(REGION_429_RETRY_DELAY_MS, seconds * 1000)
  const dateMs = Date.parse(value)
  return Number.isFinite(dateMs) ? Math.max(REGION_429_RETRY_DELAY_MS, dateMs - Date.now()) : REGION_429_RETRY_DELAY_MS
}

async function fetchRegionJsonWith429Retry(endpoint) {
  try {
    return await fetchRegionJson(endpoint)
  } catch (error) {
    if (error?.status !== 429) throw error
    await sleep(retryAfterMs(error.retryAfter))
    return fetchRegionJson(endpoint)
  }
}

function normalizeRegionCode(value) {
  const text = String(value ?? '').trim()
  const match = text.match(/^(\d+)\.(\d+)$/)
  return match ? match[1] + '.' + match[2].padStart(2, '0') : text
}

async function findRegionCoordinate(code) {
  code = normalizeRegionCode(code)
  if (!/^\d+\.\d+$/.test(code)) return null
  try {
    const boundaryPayload = await fetchRegionJsonWith429Retry(`https://wilayah.smartartstudio.my.id/api/boundaries/${encodeURIComponent(code)}`)
    const lat = Number(boundaryPayload?.lat)
    const lng = Number(boundaryPayload?.lng)
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
  } catch (error) {
    console.warn(`Gagal mengambil koordinat kode wilayah "${code}": ${error?.message || 'Wilayah API error'}`)
    return null
  }
}

async function regionCoordinatesHandler(request) {
  let body
  try { body = await readBody(request) } catch { return { status: 400, body: { error: 'Body JSON tidak valid.' } } }
  const locations = Array.isArray(body?.locations)
    ? body.locations.filter(item => item && typeof item.name === 'string').map(item => ({ name: item.name.trim(), code: item.code !== null && item.code !== undefined ? normalizeRegionCode(item.code) : '' })).filter(item => item.name)
    : Array.isArray(body?.names) ? body.names.filter(name => typeof name === 'string').map(name => ({ name: name.trim(), code: '' })).filter(item => item.name) : []
  const uniqueLocations = [...new Map(locations.map(item => [item.name, item])).values()]
  const points = [], unmapped = []
  for (const location of uniqueLocations) {
    const { name, code } = location
    if (!regionCoordinateCache.has(name) || regionCoordinateCache.get(name) === null) {
      const coordinate = await findRegionCoordinate(code)
      regionCoordinateCache.set(name, coordinate)
      saveRegionCoordinateCache()
    }
    const coordinate = regionCoordinateCache.get(name)
    if (coordinate) points.push({ name, ...coordinate })
    else unmapped.push({ name, code, reason: code ? 'Kode wilayah tidak valid atau koordinat tidak tersedia.' : 'Kode wilayah kosong.' })
  }
  return { status: 200, body: { points, unmapped } }
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(body))
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = ''
    request.on('data', chunk => { raw += chunk; if (raw.length > 1_000_000) reject(new Error('Request body too large')) })
    request.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}) } catch { reject(new Error('Invalid JSON')) } })
    request.on('error', reject)
  })
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  if (request.method === 'OPTIONS') return sendJson(response, 204, {})

  try {
    if (request.method === 'GET' && url.pathname === '/api/health') return sendJson(response, 200, { status: 'ok', service: 'akabi-backend' })
    if (request.method === 'GET' && url.pathname === '/api/sheets') {
      const result = await sheetsHandler(url)
      return sendJson(response, result.status, result.body)
    }
    if (request.method === 'GET' && url.pathname === '/api/banpem-sheet') {
      const result = await banpemSheetHandler(url)
      return sendJson(response, result.status, result.body)
    }
    if (request.method === 'POST' && url.pathname === '/api/region-coordinates') {
      const result = await regionCoordinatesHandler(request)
      return sendJson(response, result.status, result.body)
    }
    if (request.method === 'POST' && url.pathname === '/api/export-auth') {
      const body = await readBody(request)
      const configuredToken = process.env.EXPORT_TOKEN?.trim()
      const providedToken = typeof body.token === 'string' ? body.token.trim() : ''
      const valid = Boolean(configuredToken && providedToken && providedToken === configuredToken)
      return sendJson(response, valid ? 200 : 401, { valid })
    }
    return sendJson(response, 404, { error: 'Route not found' })
  } catch (error) {
    return sendJson(response, 500, { error: error?.message || 'Internal server error' })
  }
})

server.listen(PORT, () => console.log(`AKABI backend berjalan di http://localhost:${PORT}`))

