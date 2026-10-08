import DashboardModeSelection from '../../../components/DashboardModeSelection'
import { notFound } from 'next/navigation'

const COMMODITIES: Record<string, string> = {
  dashboardkacanghijau: 'Kacang Hijau',
  dashboardkacangtanah: 'Kacang Tanah',
  dashboardubikayu: 'Ubi Kayu',
  dashboardubijalar: 'Ubi Jalar',
}

export default function DashboardSelection({ params }: { params: { slug: string } }) {
  const commodity = COMMODITIES[params.slug]
  if (!commodity) notFound()

  return <DashboardModeSelection commodity={commodity} basePath={`/${params.slug}`} />
}
