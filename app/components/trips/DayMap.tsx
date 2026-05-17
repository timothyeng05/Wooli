'use client'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEffect } from 'react'
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
    width:24px;height:24px;border:3px solid #fff;
    box-shadow:0 2px 8px rgba(0,0,0,.4);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
})

export default function DayMap({ lat, lng }: { lat: number; lng: number }) {
  return (
    <div className="w-full h-48 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      <MapContainer center={[lat, lng]} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <SetView lat={lat} lng={lng} />
        <Marker position={[lat, lng]} icon={pin} />
      </MapContainer>
    </div>
  )
}
