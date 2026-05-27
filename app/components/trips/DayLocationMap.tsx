'use client'
import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type LocationPoint = { label: string; query: string; color: string; coords?: { lat: number; lng: number } }
type GeoResult = { label: string; lat: number; lng: number; color: string }

const GAP_KM = 160 // ~100 miles — splits into separate city groups

function haversineKm(a: GeoResult, b: GeoResult): number {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLon = (b.lng - a.lng) * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180)
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function groupPoints(points: GeoResult[]): GeoResult[][] {
  if (!points.length) return []
  const groups: GeoResult[][] = [[points[0]]]
  for (let i = 1; i < points.length; i++) {
    if (haversineKm(points[i - 1], points[i]) > GAP_KM) {
      groups.push([points[i]])
    } else {
      groups[groups.length - 1].push(points[i])
    }
  }
  return groups
}

function FitBounds({ points }: { points: GeoResult[] }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14)
    } else {
      map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number])), { padding: [40, 40] })
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
  const [activeGroup, setActiveGroup] = useState(0)

  const locKey = locations.map(l => `${l.coords?.lat ?? l.query}:${l.coords?.lng ?? ''}:${l.color}`).join('|')

  useEffect(() => {
    setActiveGroup(0)
    if (!locations.length) { setLoading(false); return }
    setPoints([])
    setLoading(true)
    const fetched: GeoResult[] = []
    Promise.all(
      locations.map(loc => {
        if (loc.coords) {
          fetched.push({ label: loc.label, lat: loc.coords.lat, lng: loc.coords.lng, color: loc.color })
          return Promise.resolve()
        }
        return fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc.query)}&format=json&limit=1`,
          { headers: { 'Accept-Language': 'en' } }
        )
          .then(r => r.json())
          .then(data => {
            if (data[0]) fetched.push({ label: loc.label, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), color: loc.color })
          })
          .catch(() => {})
      })
    ).then(() => { setPoints(fetched); setLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locKey])

  if (loading) return (
    <div className="h-[260px] flex items-center justify-center text-xs text-gray-400">Loading map…</div>
  )
  if (!points.length) return (
    <p className="text-xs text-gray-400 py-4 text-center">No coordinates set — edit a card and paste coordinates to pin it</p>
  )

  const groups = groupPoints(points)
  const activePoints = groups[activeGroup] ?? []
  const polyline = activePoints.map(p => [p.lat, p.lng] as [number, number])

  return (
    <div>
      {groups.length > 1 && (
        <div className="flex gap-1.5 px-3 py-2 bg-white border-b border-gray-100 flex-wrap">
          {groups.map((g, i) => (
            <button
              key={i}
              onClick={() => setActiveGroup(i)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                activeGroup === i ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {g[0].label}{g.length > 1 ? ` +${g.length - 1}` : ''}
            </button>
          ))}
        </div>
      )}
      <div style={{ height: 260 }}>
        <MapContainer
          key={activeGroup}
          center={[activePoints[0].lat, activePoints[0].lng]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
          zoomControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={activePoints} />
          {polyline.length > 1 && (
            <Polyline
              positions={polyline}
              pathOptions={{ color: '#94a3b8', weight: 2, dashArray: '5, 7', opacity: 0.8 }}
            />
          )}
          {activePoints.map((p, i) => (
            <Marker key={i} position={[p.lat, p.lng]} icon={makeIcon(p.color)}>
              <Tooltip direction="top" offset={[0, -16]} opacity={0.95}>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{p.label}</span>
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
