'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/auth/actions'
import WooliLogo from '@/app/components/WooliLogo'

const NAV_LINKS = [
  {
    href: '/period', label: 'Period', alsoMatches: [] as string[],
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
      </svg>
    ),
  },
  {
    href: '/budget', label: 'Budget', alsoMatches: [] as string[],
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    ),
  },
  {
    href: '/trips', label: 'Trips', alsoMatches: [] as string[],
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 11 22 2 13 21 11 13 3 11"/>
      </svg>
    ),
  },
  {
    href: '/lists', label: 'Lists', alsoMatches: [] as string[],
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    ),
  },
  {
    href: '/wishlist', label: 'Wishlist', alsoMatches: [] as string[],
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
      </svg>
    ),
  },
  {
    href: '/friends', label: 'Friends', alsoMatches: [] as string[],
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    href: '/settings', label: 'Settings', alsoMatches: [] as string[],
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
  },
] as const

const MAIN_HREFS = ['/budget', '/trips']

export default function Nav({ fullAccess = true, isLoggedIn = true, tripsEnabled = true }: { fullAccess?: boolean; isLoggedIn?: boolean; tripsEnabled?: boolean }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [desktopMoreOpen, setDesktopMoreOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string, alsoMatches: readonly string[] = []) => {
    const all = [href, ...alsoMatches]
    return all.some(p => pathname === p || pathname.startsWith(p + '/'))
  }

  const allMainTabs = NAV_LINKS.filter(l => MAIN_HREFS.includes(l.href))
  const mainTabs = fullAccess
    ? allMainTabs
    : allMainTabs.filter(l => l.href === '/budget' || (l.href === '/trips' && tripsEnabled))
  const moreTabs = NAV_LINKS.filter(l => !MAIN_HREFS.includes(l.href))
  const moreActive = moreTabs.some(({ href, alsoMatches }) => isActive(href, alsoMatches))

  if (!isLoggedIn) {
    return (
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <WooliLogo size={28} />
            <span className="font-serif font-bold text-lg text-blue-700 tracking-tight">Wooli</span>
          </Link>
          <Link
            href="/login"
            className="px-4 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Log in
          </Link>
        </div>
      </nav>
    )
  }

  return (
    <>
      {/* Top bar */}
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4 sm:gap-8">
          <Link href="/" className="flex items-center gap-2">
            <WooliLogo size={28} />
            <span className="font-serif font-bold text-lg text-blue-700 tracking-tight">Wooli</span>
          </Link>

          {/* Desktop nav: Budget, Trips, More */}
          <div className="hidden md:flex items-center gap-1 flex-1">
            {mainTabs.map(({ href, label, alsoMatches }) => {
              const active = isActive(href, alsoMatches)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </Link>
              )
            })}

            {/* Desktop More dropdown — owner only */}
            {fullAccess ? (
            <div className="relative">
              <button
                onClick={() => setDesktopMoreOpen(v => !v)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
                  moreActive || desktopMoreOpen ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                More
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {desktopMoreOpen && (
                <>
                  <div className="fixed inset-0 z-[40]" onClick={() => setDesktopMoreOpen(false)} />
                  <div className="absolute top-full left-0 mt-1.5 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-[50] py-1.5 overflow-hidden">
                    {moreTabs.map(({ href, label, icon, alsoMatches }) => {
                      const active = isActive(href, alsoMatches)
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setDesktopMoreOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors ${
                            active ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span className={active ? 'text-blue-600' : 'text-gray-400'}>{icon}</span>
                          {label}
                        </Link>
                      )
                    })}
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <form>
                        <button
                          formAction={logout}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-left"
                        >
                          <span className="text-gray-400">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                              <polyline points="16 17 21 12 16 7"/>
                              <line x1="21" y1="12" x2="9" y2="12"/>
                            </svg>
                          </span>
                          Sign out
                        </button>
                      </form>
                    </div>
                  </div>
                </>
              )}
            </div>
            ) : (
              <div className="flex items-center gap-1 ml-auto">
                <div className="relative">
                  <button
                    onClick={() => setDesktopMoreOpen(v => !v)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
                      desktopMoreOpen ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    More
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {desktopMoreOpen && (
                    <>
                      <div className="fixed inset-0 z-[40]" onClick={() => setDesktopMoreOpen(false)} />
                      <div className="absolute top-full left-0 mt-1.5 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-[50] py-1.5 overflow-hidden">
                        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Coming soon</p>
                        {[
                          !tripsEnabled && { label: 'Trips', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg> },
                          { label: 'Journal', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg> },
                          { label: 'Friends', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
                        ].filter(Boolean).map(({ label, icon }: any) => (
                          <div key={label} className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-gray-300 cursor-not-allowed select-none">
                            <span className="text-gray-300">{icon}</span>
                            {label}
                            <span className="ml-auto text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">Soon</span>
                          </div>
                        ))}
                        <div className="border-t border-gray-100 mt-1 pt-1">
                          <form>
                            <button formAction={logout} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-left">
                              <span className="text-gray-400">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                                </svg>
                              </span>
                              Sign out
                            </button>
                          </form>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar — Budget, Trips, More */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-pb">
        <div className="flex">
          {mainTabs.map(({ href, label, icon, alsoMatches }) => {
            const active = isActive(href, alsoMatches)
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition ${
                  active ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                {icon}
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}

          <button
            onClick={() => setMoreOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition ${
              moreActive ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="19" cy="12" r="2"/>
            </svg>
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile More sheet — restricted users */}
      {!fullAccess && moreOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-2xl shadow-xl">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
              <p className="text-base font-semibold text-gray-900">More</p>
              <button onClick={() => setMoreOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-4 py-3 pb-8 space-y-1">
              <p className="px-1 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Coming soon</p>
              {[
                { label: 'Trips', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg> },
                { label: 'Journal', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg> },
                { label: 'Friends', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
              ].map(({ label, icon }) => (
                <div key={label} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-300 cursor-not-allowed select-none">
                  <span className="text-gray-300">{icon}</span>
                  {label}
                  <span className="ml-auto text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Coming soon</span>
                </div>
              ))}
              <div className="pt-2">
                <form>
                  <button formAction={logout} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 text-left">
                    <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mobile More sheet — owner only */}
      {fullAccess && moreOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-2xl shadow-xl">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
              <p className="text-base font-semibold text-gray-900">More</p>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
                aria-label="Close"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="px-4 py-3 pb-8 space-y-1">
              {moreTabs.map(({ href, label, icon, alsoMatches }) => {
                const active = isActive(href, alsoMatches)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <span className={active ? 'text-blue-600' : 'text-gray-400'}>{icon}</span>
                    {label}
                  </Link>
                )
              })}
              <form>
                <button
                  formAction={logout}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors text-left"
                >
                  <span className="text-gray-400">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                  </span>
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  )
}
