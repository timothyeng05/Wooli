'use client'
import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type LocationPoint = { label: string; query: string; color: string }
type GeoResult = { label: string; lat: number; lng: number; color: string }

function FitBounds({ points }: { points: GeoResult[] }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13)
    } else {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number]))
      map.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [map, points])
  return null
}

function makeIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);width:16px;height:16px;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 16],
  })
}

export default function DayLocationMap({ locations }: { locations: LocationPoint[] }) {
  const [points, setPoints] = useState<GeoResult[]>([])
  const [loading, setLoading] = useState(true)

  const locKey = locations.map(l => `${l.query}:${l.color}`).join('|')

  useEffect(() => {
    if (!locations.length) { setLoading(false); return }
    setPoints([])
    setLoading(true)
    const fetched: GeoResult[] = []
    Promise.all(
      locations.map(loc =>
        fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc.query)}&format=json&limit=1`,
          { headers: { 'Accept-Language': 'en' } }
        )
          .then(r => r.json())
          .then(data => {
            if (data[0]) fetched.push({ label: loc.label, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), color: loc.color })
          })
          .catch(() => {})
      )
    ).then(() => { setPoints(fetched); setLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locKey])

  if (loading) return (
    <div className="h-[260px] flex items-center justify-center text-xs text-gray-400">Loading map…</div>
  )
  if (!points.length) return (
    <p className="text-xs text-gray-400 py-4 text-center">Could not find locations on the map</p>
  )

  return (
    <div className="w-full" style={{ height: 260 }}>
      <MapContainer
        center={[points[0].lat, points[0].lng]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {points.map((p, i) => (
          <Marker key={i} position={[p.lat, p.lng]} icon={makeIcon(p.color)}>
            <Tooltip direction="top" offset={[0, -16]} opacity={0.95} permanent={false}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{p.label}</span>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
