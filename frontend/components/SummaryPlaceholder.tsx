import Link from 'next/link'
import DashboardHeader from './DashboardHeader'

export default function SummaryPlaceholder({ commodity, chooseHref }: { commodity: string; chooseHref: string }) {
  return <div className="min-h-screen bg-canvas dark:bg-[#061a13] transition-colors">
    <DashboardHeader subtitle={`${commodity} Insight`} title={`Ringkasan ${commodity}`} backHref="/" />
    <main className="p-5 md:p-9">
      <div className="mb-8"><h1 className="text-3xl font-bold tracking-tight text-ink dark:text-white md:text-[34px]">Ringkasan {commodity}</h1><p className="mt-3 text-sm text-slate-500 dark:text-slate-300">Ringkasan data komoditas sebelum memilih dashboard.</p></div>
      <div className="glass rounded-2xl p-8 text-center"><div className="mx-auto max-w-xl"><h2 className="text-xl font-bold text-ink dark:text-white">Data belum tersedia untuk komoditas ini</h2><p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-300">Dashboard dan ringkasan {commodity} sedang disiapkan. Silakan pilih dashboard untuk melihat pilihan yang tersedia.</p><Link href={chooseHref} className="mt-6 inline-flex rounded-xl bg-[#0b6b43] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#0b6b43]/20">Pilih Dashboard</Link></div></div>
      <div className="mt-6 grid gap-4 md:grid-cols-3"><div className="glass rounded-2xl p-5"><p className="text-xs font-semibold text-slate-400">Produktivitas Nasional</p><p className="mt-3 text-lg font-bold text-slate-400">Belum tersedia</p></div><div className="glass rounded-2xl p-5"><p className="text-xs font-semibold text-slate-400">Program BANPEM</p><p className="mt-3 text-lg font-bold text-slate-400">Belum tersedia</p></div><div className="glass rounded-2xl p-5"><p className="text-xs font-semibold text-slate-400">Neraca Pangan</p><p className="mt-3 text-lg font-bold text-slate-400">Belum tersedia</p></div></div>
    </main>
  </div>
}
