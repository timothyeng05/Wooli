'use client'
import dynamic from 'next/dynamic'
import type { MapDay } from './TripRouteMap'

const TripRouteMap = dynamic(() => import('./TripRouteMap'), { ssr: false })

export default function TripRouteMapClient({ days }: { days: MapDay[] }) {
  return <TripRouteMap days={days} />
}
