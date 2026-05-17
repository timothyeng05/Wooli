'use client'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type MapDay = {
  date: string
  title: string
  dayNumber: number
  lat: number
  lng: number
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(points, { padding: [40, 40] })
    }
  }, [map, points])
  return null
}

function makeIcon(n: number, isFirst: boolean, isLast: boolean) {
  const color = isFirst ? '#22c55e' : isLast ? '#ef4444' : '#3b82f6'
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};color:#fff;border-radius:50%;
      width:28px;height:28px;display:flex;align-items:center;
      justify-content:center;font-size:11px;font-weight:700;
      border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);
    ">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

export default function TripRouteMap({ days }: { days: MapDay[] }) {
  if (days.length === 0) return null

  const points: [number, number][] = days.map(d => [d.lat, d.lng])

  // Deduplicate consecutive identical coords for the polyline
  const routeLine: [number, number][] = []
  for (const p of points) {
    const prev = routeLine[routeLine.length - 1]
    if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) routeLine.push(p)
  }

  return (
    <div className="w-full h-80 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      <MapContainer
        center={points[0]}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        <Polyline positions={routeLine} pathOptions={{ color: '#3b82f6', weight: 2.5, opacity: 0.7, dashArray: '6 4' }} />
        {days.map((d, i) => (
          <Marker key={d.date} position={[d.lat, d.lng]} icon={makeIcon(d.dayNumber, i === 0, i === days.length - 1)}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">Day {d.dayNumber}</div>
                <div className="text-gray-600">{d.title}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
