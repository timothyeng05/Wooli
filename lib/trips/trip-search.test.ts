import { describe, it, expect } from 'vitest'
import { searchDays, type SearchableDay } from './trip-search'

const day = (date: string, title: string | null, sections: object[] | null): SearchableDay => ({
  date,
  title,
  notes: sections ? JSON.stringify(sections) : null,
})

const days: SearchableDay[] = [
  day('2026-06-01', 'Arrival in Tokyo', [
    { type: 'ACTIVITY', lines: ['teamLab Planets', '- book tickets ahead'] },
  ]),
  day('2026-06-02', null, [
    { type: 'MEAL', lines: ['Sushi Dai', '- omakase'], place: 'Tsukiji Market', rating: 9 },
  ]),
  day('2026-06-03', 'Rest day', null),
]

describe('searchDays', () => {
  it('matches a day title', () => {
    expect(searchDays(days, 'arrival')).toEqual([
      { date: '2026-06-01', snippet: 'Arrival in Tokyo' },
    ])
  })

  it('matches a section line and returns it as the snippet', () => {
    expect(searchDays(days, 'teamlab')).toEqual([
      { date: '2026-06-01', snippet: 'teamLab Planets' },
    ])
  })

  it('strips the bullet dash from a matched bullet line', () => {
    expect(searchDays(days, 'tickets')).toEqual([
      { date: '2026-06-01', snippet: 'book tickets ahead' },
    ])
  })

  it('matches a section place', () => {
    expect(searchDays(days, 'tsukiji')).toEqual([
      { date: '2026-06-02', snippet: 'Tsukiji Market' },
    ])
  })

  it('matches the section type label', () => {
    expect(searchDays(days, 'meal')).toEqual([
      { date: '2026-06-02', snippet: 'Sushi Dai' },
    ])
  })

  it('is case-insensitive', () => {
    expect(searchDays(days, 'SUSHI')).toEqual([
      { date: '2026-06-02', snippet: 'Sushi Dai' },
    ])
  })

  it('returns an empty list when nothing matches', () => {
    expect(searchDays(days, 'onsen')).toEqual([])
  })

  it('returns nothing for queries under the 2-character minimum', () => {
    expect(searchDays(days, 't')).toEqual([])
    expect(searchDays(days, ' t ')).toEqual([])
  })
})
