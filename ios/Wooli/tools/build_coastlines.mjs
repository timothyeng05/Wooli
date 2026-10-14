// Builds Wooli/Trips/coastlines.bin: the world's land outlines for the flight globe.
// Input: world-atlas land-110m.json (Natural Earth 1:110m, public domain).
//   npm install topojson-client@3 world-atlas@2   (in a scratch folder)
// Usage: node build_coastlines.mjs <that folder> ../Wooli/Trips/coastlines.bin
// Format: repeated rings — UInt16 point count, then Int16 lon×100, Int16 lat×100 per point (little-endian).
import { readFileSync, writeFileSync } from 'node:fs';
const [dir, out] = process.argv.slice(2);
const topo = await import(dir + '/node_modules/topojson-client/src/index.js');
const land = JSON.parse(readFileSync(dir + '/node_modules/world-atlas/land-110m.json'));
const geo = topo.feature(land, land.objects.land);
const rings = [];
for (const f of geo.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) for (const ring of poly) rings.push(ring);
}
const points = rings.reduce((n, r) => n + r.length, 0);
const buf = Buffer.alloc(rings.length * 2 + points * 4);
let o = 0;
for (const ring of rings) {
  buf.writeUInt16LE(ring.length, o); o += 2;
  for (const [lon, lat] of ring) { buf.writeInt16LE(Math.round(lon * 100), o); buf.writeInt16LE(Math.round(lat * 100), o + 2); o += 4; }
}
writeFileSync(out, buf);
console.error(`${rings.length} rings, ${points} points, ${buf.length} bytes`);
