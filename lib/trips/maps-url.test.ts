import { describe, it, expect } from 'vitest'
import { coordsFromText, placeNameFromText } from './maps-url'

describe('coordsFromText', () => {
  it('extracts the place pin (!3d!4d)', () => {
    const u = 'https://www.google.com/maps/place/Tokyo+Tower/data=!3d35.6585805!4d139.7454329'
    expect(coordsFromText(u)).toEqual({ lat: 35.6585805, lng: 139.7454329 })
  })

  it('extracts the map center (@lat,lng)', () => {
    expect(coordsFromText('https://www.google.com/maps/@35.0,135.7,17z')).toEqual({ lat: 35.0, lng: 135.7 })
  })

  it('extracts a q= coordinate', () => {
    expect(coordsFromText('https://maps.google.com/maps?q=34.05,-118.25&z=15')).toEqual({ lat: 34.05, lng: -118.25 })
  })

  it('extracts coords from embedded JSON', () => {
    expect(coordsFromText('...{"latitude": 51.5, "longitude": -0.12}...')).toEqual({ lat: 51.5, lng: -0.12 })
  })

  it('returns null when there are no coords', () => {
    expect(coordsFromText('https://maps.app.goo.gl/abc123')).toBeNull()
  })

  it('prefers the place pin over the map center', () => {
    const u = 'https://www.google.com/maps/place/X/@1.0,2.0,17z/data=!3d3.0!4d4.0'
    expect(coordsFromText(u)).toEqual({ lat: 3.0, lng: 4.0 })
  })
})

describe('placeNameFromText', () => {
  it('reads the business name from a /place/ URL', () => {
    const u = 'https://www.google.com/maps/place/A+Happy+Pancake/@35.0,135.7,17z'
    expect(placeNameFromText('', u)).toBe('A Happy Pancake')
  })

  it('ignores a coords-only /place/ segment', () => {
    const u = 'https://www.google.com/maps/place/35.0,135.7'
    expect(placeNameFromText('', u)).toBeNull()
  })

  it('falls back to og:title, stripping the Google Maps suffix', () => {
    const body = '<meta property="og:title" content="Ichiran Ramen - Google Maps">'
    expect(placeNameFromText(body, 'https://maps.app.goo.gl/x')).toBe('Ichiran Ramen')
  })

  it('falls back to <title>', () => {
    const body = '<title>Senso-ji Temple - Google Maps</title>'
    expect(placeNameFromText(body, 'https://maps.app.goo.gl/x')).toBe('Senso-ji Temple')
  })
})
