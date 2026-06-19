'use client'
import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type LocationPoint = { label: string; query: string; color: string; coords?: { lat: number; lng: number } }
type GeoResult = { label: string; lat: number; lng: number; color: string }

const GAP_KM = 160

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

function bearingDeg(from: [number, number], to: [number, number]): number {
  const dLon = (to[1] - from[1]) * Math.PI / 180
  const lat1 = from[0] * Math.PI / 180
  const lat2 = to[0] * Math.PI / 180
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

function midpoint(from: [number, number], to: [number, number]): [number, number] {
  return [(from[0] * 0.45 + to[0] * 0.55), (from[1] * 0.45 + to[1] * 0.55)]
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

// Numbered circle pin
function makeNumberIcon(num: number, color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};color:#fff;border-radius:50%;width:24px;height:24px;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);text-align:center;line-height:19px;font-size:11px;font-weight:800;">${num}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

// SVG arrowhead pointing up (North), rotated by bearing
function makeArrowIcon(angle: number, color: string) {
  // Arrow path points upward; rotate to match travel direction
  const svg = `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style="transform:rotate(${angle}deg);transform-origin:center;display:block;filter:drop-shadow(0 1px 3px rgba(0,0,0,.4));"><path d="M8 1 L15 15 L8 11 L1 15 Z" fill="${color}"/></svg>`
  return L.divIcon({
    className: '',
    html: svg,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
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
        return fetch(`/api/trips/geocode?q=${encodeURIComponent(loc.query)}`)
          .then(r => r.json())
          .then(data => {
            if (data.lat != null && data.lng != null) fetched.push({ label: loc.label, lat: data.lat, lng: data.lng, color: loc.color })
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

          {/* Per-segment colored lines with arrowheads */}
          {activePoints.map((p, i) => {
            if (i === activePoints.length - 1) return null
            const from: [number, number] = [p.lat, p.lng]
            const to: [number, number] = [activePoints[i + 1].lat, activePoints[i + 1].lng]
            const angle = bearingDeg(from, to)
            const mid = midpoint(from, to)
            return (
              <React.Fragment key={i}>
                <Polyline
                  positions={[from, to]}
                  pathOptions={{ color: p.color, weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
                />
                <Marker position={mid} icon={makeArrowIcon(angle, p.color)} />
              </React.Fragment>
            )
          })}

          {/* Numbered pins */}
          {activePoints.map((p, i) => (
            <Marker key={i} position={[p.lat, p.lng]} icon={makeNumberIcon(i + 1, p.color)} zIndexOffset={100}>
              <Tooltip direction="top" offset={[0, -12]} opacity={0.95}>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{p.label}</span>
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
