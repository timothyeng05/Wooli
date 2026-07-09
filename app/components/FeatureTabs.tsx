'use client'

import { useState } from 'react'

const BUDGET_FEATURES = [
  { icon: '🗂️', title: 'Smart categories', desc: 'Organise every transaction into income, spending, and transfers. Customise defaults or build your own.' },
  { icon: '💰', title: 'Monthly targets', desc: 'Set a spending limit per category and see at a glance whether you\'re on track, month by month.' },
  { icon: '👥', title: 'Household members', desc: 'Tag transactions to the right person. See who\'s spending what across the household.' },
  { icon: '🏦', title: 'Bank sync via Plaid', desc: 'Connect your institutions and automatically sync transactions and balances. Read-only, always secure.' },
  { icon: '📈', title: 'Spending trends', desc: 'Monthly and yearly views of income vs. expenses, category breakdowns, and net worth over time.' },
  { icon: '🎯', title: 'Goals & forecast', desc: 'Set savings goals and see projected cash flow based on your spending patterns.' },
]

const TRIPS_FEATURES = [
  { icon: '🗓️', title: 'Day-by-day itinerary', desc: 'Organise activities, meals, and plans for each day of your trip in a structured journal.' },
  { icon: '🍽️', title: 'Meals & ratings', desc: 'Log every restaurant you visit and rate dishes as you go — never forget a great meal.' },
  { icon: '📝', title: 'Daily summaries', desc: 'AI-assisted summaries capture your trip story as you document each day.' },
  { icon: '📍', title: 'Locations & routes', desc: 'Track where you went and keep notes on each destination.' },
  { icon: '🛍️', title: 'Shopping & stores', desc: 'Keep a list of stores and things to pick up at each destination.' },
  { icon: '📸', title: 'Trip overview', desc: 'A clean overview of your whole trip — activities confirmed, meals eaten, memories logged.' },
]

export default function FeatureTabs() {
  const [tab, setTab] = useState<'budget' | 'trips'>('budget')
  const features = tab === 'budget' ? BUDGET_FEATURES : TRIPS_FEATURES

  return (
    <div>
      {/* Tab selector */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <button
          onClick={() => setTab('budget')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition ${
            tab === 'budget'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
        >
          💰 Budget
          {tab === 'budget' && (
            <span className="text-[10px] bg-white/30 px-1.5 py-0.5 rounded-full font-medium">primary</span>
          )}
        </button>
        <button
          onClick={() => setTab('trips')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition ${
            tab === 'trips'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
        >
          ✈️ Trips
        </button>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {features.map(f => (
          <div key={f.title} className="rounded-2xl border border-gray-200 p-6">
            <div className="text-2xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
            <p className="text-sm text-gray-500">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
