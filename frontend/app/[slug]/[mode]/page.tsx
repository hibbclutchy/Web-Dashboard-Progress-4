import DashboardComingSoon from '../../../components/DashboardComingSoon'
import { notFound } from 'next/navigation'

const COMMODITIES: Record<string, string> = {
  dashboardkacanghijau: 'Kacang Hijau',
  dashboardkacangtanah: 'Kacang Tanah',
  dashboardubikayu: 'Ubi Kayu',
  dashboardubijalar: 'Ubi Jalar',
}

type DashboardMode = 'monitoring' | 'banpem' | 'neraca'

const MODES: Record<DashboardMode, string> = {
  monitoring: 'Monitoring Produktivitas',
  banpem: 'BANPEM (Bantuan Pemerintah)',
  neraca: 'Neraca Pangan',
}

export default function DashboardModePage({ params }: { params: { slug: string; mode: string } }) {
  const commodity = COMMODITIES[params.slug]
  const mode = MODES[params.mode as DashboardMode]
  if (!commodity || !mode) notFound()

  return <DashboardComingSoon commodity={commodity} mode={mode} backHref={`/${params.slug}/pilih`} />
}


