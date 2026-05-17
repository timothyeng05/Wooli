'use client'
import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type ContextPoint = {
  lat: number
  lng: number
  label: string
  type: 'prev' | 'current' | 'next'
}

function FitBounds({ points }: { points: ContextPoint[] }) {
  const map = useMap()
  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current || !points.length) return
    fitted.current = true
    const latlngs = points.map(p => [p.lat, p.lng] as [number, number])
    if (latlngs.length === 1) {
      map.setView(latlngs[0], 12)
    } else {
      const bounds = latlngs.reduce(
        (b, c) => b.extend(c),
        L.latLngBounds(latlngs[0], latlngs[0])
      )
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [map, points])
  return null
}

function makeIcon(type: 'prev' | 'current' | 'next') {
  const size = type === 'current' ? 18 : 12
  const color = type === 'current' ? '#3b82f6' : type === 'prev' ? '#94a3b8' : '#cbd5e1'
  const border = type === 'current' ? 3 : 2
  const shadow = type === 'current' ? 'rgba(59,130,246,.5)' : 'rgba(0,0,0,.2)'
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};border-radius:50%;width:${size}px;height:${size}px;border:${border}px solid #fff;box-shadow:0 2px 6px ${shadow};"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export default function DayContextMap({ points }: { points: ContextPoint[] }) {
  const current = points.find(p => p.type === 'current')
  if (!current) return null

  const ordered = (['prev', 'current', 'next'] as const)
    .map(t => points.find(p => p.type === t))
    .filter((p): p is ContextPoint => !!p)

  const line: [number, number][] = []
  for (const p of ordered) {
    const last = line[line.length - 1]
    if (!last || last[0] !== p.lat || last[1] !== p.lng) {
      line.push([p.lat, p.lng])
    }
  }

  return (
    <div style={{ height: '220px' }} className="w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      <MapContainer
        center={[current.lat, current.lng]}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={ordered} />
        {line.length > 1 && (
          <Polyline
            positions={line}
            pathOptions={{ color: '#3b82f6', weight: 2.5, opacity: 0.6, dashArray: '6 4' }}
          />
        )}
        {ordered.map((p, i) => (
          <Marker key={i} position={[p.lat, p.lng]} icon={makeIcon(p.type)}>
            <Popup><span className="text-sm font-medium">{p.label}</span></Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
