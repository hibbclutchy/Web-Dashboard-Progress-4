'use client'

import dynamic from 'next/dynamic'
import type { Region } from '../lib/data'

const ProductivityMapLeaflet = dynamic(() => import('./ProductivityMapLeaflet'), { ssr: false })

export default function ProductivityMap(props: { data: Region[]; year: string; province: string }) {
  return <ProductivityMapLeaflet {...props} />
}
