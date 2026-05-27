'use client'
import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function SetView({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lng], 13) }, [map, lat, lng])
  return null
}

const pin = L.divIcon({
  className: '',
  html: `<div style="
    background:#3b82f6;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
    width:20px;height:20px;border:3px solid #fff;
    box-shadow:0 2px 8px rgba(0,0,0,.35);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 20],
})

export default function DayLocationMap({ location }: { location: string }) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!location.trim()) return
    setCoords(null)
    setError(false)
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`
    fetch(url, { headers: { 'Accept-Language': 'en' } })
      .then(r => r.json())
      .then(data => {
        if (data[0]) {
          setCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
        } else {
          setError(true)
        }
      })
      .catch(() => setError(true))
  }, [location])

  if (error) return (
    <p className="text-xs text-gray-400 py-3 text-center">Could not find "{location}" on the map</p>
  )
  if (!coords) return (
    <div className="h-48 flex items-center justify-center text-xs text-gray-400">Loading map…</div>
  )

  return (
    <div className="w-full rounded-xl overflow-hidden border border-gray-100 shadow-sm" style={{ height: 220 }}>
      <MapContainer center={[coords.lat, coords.lng]} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} zoomControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <SetView lat={coords.lat} lng={coords.lng} />
        <Marker position={[coords.lat, coords.lng]} icon={pin} />
        <Circle center={[coords.lat, coords.lng]} radius={2000} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.08, weight: 1.5 }} />
      </MapContainer>
    </div>
  )
}
