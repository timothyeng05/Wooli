'use client'
import { useState } from 'react'
import { findMeta } from '@/lib/trips/trip-sections'
import type { SectionData } from '@/lib/trips/trip-sections'
import {
  type EditorSection,
  ACTIVITY_TYPES, MEAL_TYPES, ADD_SECTION_GROUPS, ALL_SECTION_TYPES,
} from '@/lib/trips/trip-utils'
import {
  TravelEditor, HotelEditor, DriveEditor, CarEditor,
  ActivityEditor, MealEditor, GeneralEditor,
} from './SectionEditors'

export function SectionEditorCard({ section, onChange, onMoveUp, onMoveDown, dayOptions, currentDate, onMoveToDay }: {
  section: EditorSection
  onChange: (updates: Partial<SectionData>) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  dayOptions?: { date: string; label: string }[]
  currentDate?: string
  onMoveToDay?: (targetDate: string) => void
}) {
  const [moveDayTarget, setMoveDayTarget] = useState(currentDate ?? '')
  const meta = findMeta(section.type)
  if (!meta) return null

  const t = section.type.toUpperCase()

  return (
    <div className={`rounded-xl border p-4 ${meta.bg} ${meta.border}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {(onMoveUp || onMoveDown) && (
            <div className="flex flex-col gap-0.5">
              <button onClick={onMoveUp} disabled={!onMoveUp}
                className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-default transition leading-none text-xs px-0.5" title="Move up">▲</button>
              <button onClick={onMoveDown} disabled={!onMoveDown}
                className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-default transition leading-none text-xs px-0.5" title="Move down">▼</button>
            </div>
          )}
          <select
            value={section.type}
            onChange={e => onChange({ type: e.target.value })}
            className={`text-sm font-semibold border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1 py-0.5 cursor-pointer ${meta.text}`}
          >
            {ALL_SECTION_TYPES.map(type => {
              const m = findMeta(type)
              return m ? <option key={type} value={type}>{m.icon} {m.label}</option> : null
            })}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Mark as must-do / appointment">
            <input type="checkbox" checked={!!section.pinned}
              onChange={e => onChange({ pinned: e.target.checked || undefined })}
              className="w-4 h-4 rounded border-gray-300 accent-amber-500 cursor-pointer" />
            <span className="text-xs text-gray-400">⭐ Important</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Mark as skipped">
            <input type="checkbox" checked={!!section.skipped}
              onChange={e => onChange({ skipped: e.target.checked || undefined })}
              className="w-4 h-4 rounded border-gray-300 accent-gray-400 cursor-pointer" />
            <span className="text-xs text-gray-400">✗ Skipped</span>
          </label>
        </div>
      </div>
      {(meta.banner || meta.travel) && !meta.car
        ? <TravelEditor section={section} onChange={onChange} />
        : meta.hotel
        ? <HotelEditor section={section} onChange={onChange} />
        : meta.car
        ? <CarEditor section={section} onChange={onChange} />
        : (meta.drive || meta.transit)
        ? <DriveEditor section={section} onChange={onChange} />
        : ACTIVITY_TYPES.has(t)
        ? <ActivityEditor section={section} onChange={onChange} />
        : MEAL_TYPES.has(t)
        ? <MealEditor section={section} onChange={onChange} />
        : <GeneralEditor section={section} onChange={onChange} />
      }
      {onMoveToDay && dayOptions && dayOptions.length > 1 && (
        <div className="mt-3 pt-3 border-t border-gray-200/60">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 whitespace-nowrap">Move to:</span>
            <select
              value={moveDayTarget}
              onChange={e => setMoveDayTarget(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
            >
              {dayOptions.map(opt => (
                <option key={opt.date} value={opt.date}>{opt.label}</option>
              ))}
            </select>
            {moveDayTarget !== currentDate && (
              <button
                onClick={() => onMoveToDay(moveDayTarget)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition whitespace-nowrap"
              >
                Move →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function AddSectionPicker({ onAdd, onCancel }: { onAdd: (type: string) => void; onCancel?: () => void }) {
  return (
    <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Add section</p>
        {onCancel && <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600 transition">Cancel</button>}
      </div>
      {ADD_SECTION_GROUPS.map(group => (
        <div key={group.label}>
          <p className="text-xs text-gray-400 mb-1.5">{group.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {group.types.map(type => {
              const meta = findMeta(type)
              if (!meta) return null
              return (
                <button
                  key={type}
                  onClick={() => onAdd(type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition hover:shadow-sm ${meta.bg} ${meta.border} ${meta.text}`}
                >
                  {meta.icon} {meta.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
