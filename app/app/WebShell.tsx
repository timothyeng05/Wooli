"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { WooliCloudSnapshot } from "@/lib/cloudkit/client";
import type {
  AccountRecord,
  BudgetCategoryRecord,
  EatsPlaceRecord,
  MealSentiment,
  MovieEntryRecord,
  RecipeEntryRecord,
  SightEntryRecord,
  TransactionRecord,
  TripItemRecord,
  TripRecord,
} from "@/lib/cloudkit/schema";
import { TodayScreen } from "./screens/TodayScreen";
import { BudgetScreen } from "./screens/BudgetScreen";
import { TripsScreen } from "./screens/TripsScreen";
import { EatsScreen } from "./screens/EatsScreen";
import { SightsScreen } from "./screens/SightsScreen";
import { MoviesScreen } from "./screens/MoviesScreen";
import { RecipesScreen } from "./screens/RecipesScreen";

export type AppSpace = "today" | "budget" | "trips" | "eats" | "sights" | "movies" | "recipes";
export type BudgetTab = "dashboard" | "accounts" | "transactions" | "plan" | "categories" | "recurring";
export type TripPage = "overview" | "ideas" | `city:${string}`;

export interface TodayScreenProps {
  snapshot: WooliCloudSnapshot;
  onOpenSpace: (space: AppSpace) => void;
  onOpenTrip?: (tripId: string) => void;
}

export interface BudgetScreenProps {
  activeTab: BudgetTab;
  onSelectTab: (tab: BudgetTab) => void;
  accounts: AccountRecord[];
  categories: BudgetCategoryRecord[];
  transactions: TransactionRecord[];
}

export interface TripsScreenProps {
  trips: TripRecord[];
  tripItems: TripItemRecord[];
  selectedTripId: string | null;
  page: TripPage;
  onSelectTrip: (tripId: string | null, page?: TripPage) => void;
}

export interface EatsScreenProps {
  eats: EatsPlaceRecord[];
  onAddCloudEat: (input: {
    name: string;
    address: string;
    sentiment: MealSentiment;
    isWish: boolean;
  }) => Promise<void>;
}

export interface SightsScreenProps {
  sights: SightEntryRecord[];
}

export interface MoviesScreenProps {
  movies: MovieEntryRecord[];
}

export interface RecipesScreenProps {
  recipes: RecipeEntryRecord[];
}

interface WebShellProps {
  snapshot: WooliCloudSnapshot;
  onSync: () => Promise<void>;
  onAddCloudEat: EatsScreenProps["onAddCloudEat"];
  signOutSlot: ReactNode;
}

const APP_ITEMS: Array<{ id: AppSpace; title: string; icon: string }> = [
  { id: "today", title: "Today", icon: "/apps/today.png" },
  { id: "budget", title: "Budget", icon: "/apps/budget.png" },
  { id: "trips", title: "Trips", icon: "/apps/trips.png" },
  { id: "eats", title: "Eats", icon: "/apps/eats.png" },
  { id: "sights", title: "Sights", icon: "/apps/sights.png" },
  { id: "movies", title: "Movies", icon: "/apps/movies.png" },
  { id: "recipes", title: "Recipes", icon: "/apps/recipes.png" },
];

const BUDGET_TABS: Array<{ id: BudgetTab; label: string; section: "main" | "tools" }> = [
  { id: "dashboard", label: "Dashboard", section: "main" },
  { id: "accounts", label: "Accounts", section: "main" },
  { id: "transactions", label: "Transactions", section: "main" },
  { id: "plan", label: "Plan", section: "main" },
  { id: "categories", label: "Categories", section: "tools" },
  { id: "recurring", label: "Recurring", section: "tools" },
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function tripCaption(trip: TripRecord, today: string): string {
  if (trip.startDay && trip.startDay > today) {
    const ms = new Date(`${trip.startDay}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime();
    const days = Math.round(ms / 86400000);
    if (days === 1) return "tomorrow";
    if (days > 1) return `in ${days} days`;
  }
  if (trip.endDay && trip.endDay >= today) return "now";
  if (trip.startDay && trip.endDay) return `${trip.startDay} – ${trip.endDay}`;
  return trip.destination || "Planned";
}

function BudgetTabIcon({ tab }: { tab: BudgetTab }) {
  switch (tab) {
    case "dashboard":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.5L12 3l9 7.5" />
          <path d="M5 9.5V20h14V9.5" />
        </svg>
      );
    case "accounts":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L3 7l9 5 9-5-9-5z" />
          <path d="M3 12l9 5 9-5" />
          <path d="M3 17l9 5 9-5" />
        </svg>
      );
    case "transactions":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2.5" />
          <path d="M2 10h20" />
        </svg>
      );
    case "plan":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" />
          <path d="M9 4v14M15 6v14" />
        </svg>
      );
    case "categories":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="8" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
          <rect x="13" y="13" width="8" height="8" rx="1.5" />
        </svg>
      );
    case "recurring":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 0 0-15.5-6.3L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 15.5 6.3L21 16" />
          <path d="M21 21v-5h-5" />
        </svg>
      );
  }
}

export default function WebShell({ snapshot, onSync, onAddCloudEat, signOutSlot }: WebShellProps) {
  const [space, setSpace] = useState<AppSpace>("today");
  const [budgetTab, setBudgetTab] = useState<BudgetTab>("dashboard");
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [tripPage, setTripPage] = useState<TripPage>("overview");
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [appsOpen, setAppsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!appsOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setAppsOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAppsOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [appsOpen]);

  const hasSidebar = space === "budget" || space === "trips";
  const today = useMemo(() => todayKey(), []);

  const reviewCount = useMemo(
    () => snapshot.transactions.filter((t) => t.needsReview && !t.isHidden).length,
    [snapshot.transactions],
  );

  const { upcomingTrips, pastTrips } = useMemo(() => {
    const upcoming = snapshot.trips
      .filter((t) => !t.endDay || t.endDay >= today)
      .sort((a, b) => a.startDay.localeCompare(b.startDay));
    const past = snapshot.trips
      .filter((t) => Boolean(t.endDay && t.endDay < today))
      .sort((a, b) => b.startDay.localeCompare(a.startDay));
    return { upcomingTrips: upcoming, pastTrips: past };
  }, [snapshot.trips, today]);

  const ideaCountByTrip = useMemo(() => {
    const counts = new Map<string, number>();
    for (const trip of snapshot.trips) {
      const items = snapshot.tripItems.filter((i) => i.tripID === trip.id);
      const count = items.filter((i) => !i.day || (trip.startDay && i.day < trip.startDay) || (trip.endDay && i.day > trip.endDay)).length;
      counts.set(trip.id, count);
    }
    return counts;
  }, [snapshot.trips, snapshot.tripItems]);

  const handleOpenSpace = (next: AppSpace) => {
    setSpace(next);
    setAppsOpen(false);
    if (next === "budget" || next === "trips") {
      setSidebarVisible(true);
    }
  };

  const handleSelectTrip = (tripId: string | null, page: TripPage = "overview") => {
    setSpace("trips");
    setSelectedTripId(tripId);
    setTripPage(page);
    if (tripId) {
      setExpandedTripId(tripId);
    }
  };

  const handleSyncClick = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await onSync();
    } finally {
      setSyncing(false);
    }
  };

  const currentSpaceTitle = useMemo(() => {
    if (space === "budget") {
      const tab = BUDGET_TABS.find((t) => t.id === budgetTab);
      return tab ? `Budget · ${tab.label}` : "Budget";
    }
    if (space === "trips") {
      if (!selectedTripId) return "Trips";
      const trip = snapshot.trips.find((t) => t.id === selectedTripId);
      return trip?.name || "Trip";
    }
    return APP_ITEMS.find((a) => a.id === space)?.title ?? "Today";
  }, [space, budgetTab, selectedTripId, snapshot.trips]);

  const renderTripGroup = (trip: TripRecord) => {
    const isExpanded = expandedTripId === trip.id;
    const isOverviewActive = selectedTripId === trip.id && tripPage === "overview";
    const legs = trip.legs.filter((l) => !l.isHome).sort((a, b) => a.startDay.localeCompare(b.startDay));
    const ideas = ideaCountByTrip.get(trip.id) ?? 0;

    return (
      <div key={trip.id} className="ws-trip-group">
        <div className="ws-trip-row">
          <button
            type="button"
            className="ws-trip-chevron"
            aria-label={isExpanded ? `Collapse ${trip.name}` : `Expand ${trip.name}`}
            onClick={() => setExpandedTripId(isExpanded ? null : trip.id)}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 120ms ease" }}
            >
              <path d="M4.5 2.5L8 6l-3.5 3.5" />
            </svg>
          </button>
          <button
            type="button"
            className={`ws-trip-trigger${isOverviewActive ? " is-active" : ""}`}
            onClick={() => handleSelectTrip(trip.id, "overview")}
          >
            <span className="ws-trip-name">{trip.name || "Untitled trip"}</span>
            <span className="ws-trip-caption">{tripCaption(trip, today)}</span>
          </button>
        </div>

        {isExpanded && (
          <div className="ws-trip-children">
            {legs.map((leg, idx) => {
              const active = selectedTripId === trip.id && tripPage === `city:${leg.id}`;
              const isNow = Boolean(leg.startDay && leg.endDay && leg.startDay <= today && leg.endDay >= today);
              const nights =
                leg.startDay && leg.endDay
                  ? Math.max(0, Math.round((new Date(leg.endDay).getTime() - new Date(leg.startDay).getTime()) / 86400000))
                  : 0;
              return (
                <button
                  key={leg.id}
                  type="button"
                  className={`ws-sb-item${active ? " is-active" : ""}`}
                  onClick={() => handleSelectTrip(trip.id, `city:${leg.id}`)}
                >
                  <span className="ws-city-badge">
                    {leg.emoji && leg.emoji !== "📍" ? leg.emoji : idx + 1}
                  </span>
                  <span className="ws-city-name">{leg.name || `City ${idx + 1}`}</span>
                  {isNow ? (
                    <span className="ws-now-pill">NOW</span>
                  ) : nights > 0 ? (
                    <span className="ws-nights-label">{nights} d</span>
                  ) : null}
                </button>
              );
            })}
            <button
              type="button"
              className={`ws-sb-item${selectedTripId === trip.id && tripPage === "ideas" ? " is-active" : ""}`}
              onClick={() => handleSelectTrip(trip.id, "ideas")}
            >
              <span aria-hidden="true">💡</span>
              <span className="ws-city-name">Ideas</span>
              {ideas > 0 && <span className="ws-nights-label">{ideas}</span>}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="ws-root">
      <div className="ws-shell">
        {space === "budget" && sidebarVisible && (
          <aside className="ws-rail" aria-label="Budget navigation">
            <div className="ws-rail-header" title="Budget">
              <Image src="/apps/budget.png" alt="Budget" width={28} height={28} className="ws-rail-icon" />
            </div>
            {BUDGET_TABS.filter((t) => t.section === "main").map((t) => (
              <button
                key={t.id}
                type="button"
                className={`ws-rail-btn${budgetTab === t.id ? " is-active" : ""}`}
                title={t.label}
                aria-label={t.label}
                onClick={() => setBudgetTab(t.id)}
              >
                <BudgetTabIcon tab={t.id} />
                {t.id === "transactions" && reviewCount > 0 && <span className="ws-rail-dot" aria-label={`${reviewCount} to review`} />}
              </button>
            ))}
            <div className="ws-rail-divider" />
            {BUDGET_TABS.filter((t) => t.section === "tools").map((t) => (
              <button
                key={t.id}
                type="button"
                className={`ws-rail-btn${budgetTab === t.id ? " is-active" : ""}`}
                title={t.label}
                aria-label={t.label}
                onClick={() => setBudgetTab(t.id)}
              >
                <BudgetTabIcon tab={t.id} />
              </button>
            ))}
            <div className="ws-rail-spacer" />
          </aside>
        )}

        {space === "trips" && sidebarVisible && (
          <aside className="ws-trips-sidebar" aria-label="Trips navigation">
            <button
              type="button"
              className={`ws-sb-item${selectedTripId === null ? " is-active" : ""}`}
              onClick={() => handleSelectTrip(null, "overview")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
              <span>All trips</span>
            </button>

            {upcomingTrips.length > 0 && (
              <>
                <div className="ws-sb-section">Upcoming</div>
                {upcomingTrips.map(renderTripGroup)}
              </>
            )}

            {pastTrips.length > 0 && (
              <>
                <div className="ws-sb-section">Past</div>
                {pastTrips.map(renderTripGroup)}
              </>
            )}
          </aside>
        )}

        <div className="ws-main">
          <header className="ws-toolbar">
            <div className="ws-toolbar-left">
              {hasSidebar && (
                <button
                  type="button"
                  className="ws-icon-btn is-square"
                  aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
                  title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
                  onClick={() => setSidebarVisible((v) => !v)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="16" rx="2.5" />
                    <path d="M9 4v16" />
                  </svg>
                </button>
              )}
              <h2 className="ws-toolbar-title">{currentSpaceTitle}</h2>
            </div>

            <div className="ws-toolbar-right" ref={popoverRef}>
              <button
                type="button"
                className="ws-icon-btn"
                onClick={handleSyncClick}
                disabled={syncing}
                title="Sync with Apple iCloud"
              >
                <span aria-hidden="true">☁️</span>
                <span>{syncing ? "Syncing…" : "Sync"}</span>
              </button>

              <div className="ws-signout-slot">{signOutSlot}</div>

              <button
                type="button"
                className="ws-icon-btn is-square"
                aria-label="Switch apps"
                aria-expanded={appsOpen}
                title="Switch apps"
                onClick={() => setAppsOpen((o) => !o)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="3" width="4.5" height="4.5" rx="1" />
                  <rect x="9.75" y="3" width="4.5" height="4.5" rx="1" />
                  <rect x="16.5" y="3" width="4.5" height="4.5" rx="1" />
                  <rect x="3" y="9.75" width="4.5" height="4.5" rx="1" />
                  <rect x="9.75" y="9.75" width="4.5" height="4.5" rx="1" />
                  <rect x="16.5" y="9.75" width="4.5" height="4.5" rx="1" />
                  <rect x="3" y="16.5" width="4.5" height="4.5" rx="1" />
                  <rect x="9.75" y="16.5" width="4.5" height="4.5" rx="1" />
                  <rect x="16.5" y="16.5" width="4.5" height="4.5" rx="1" />
                </svg>
              </button>

              {appsOpen && (
                <div className="ws-apps-popover" role="dialog" aria-label="Apps">
                  <h3 className="ws-popover-heading">Apps</h3>
                  <div className="ws-apps-grid">
                    {APP_ITEMS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`ws-app-tile-btn${space === item.id ? " is-current" : ""}`}
                        onClick={() => handleOpenSpace(item.id)}
                      >
                        <Image src={item.icon} alt={item.title} width={56} height={56} className="ws-app-tile-img" />
                        {item.id === "budget" && reviewCount > 0 && (
                          <span className="ws-app-badge">{reviewCount}</span>
                        )}
                        <span className="ws-app-tile-label">{item.title}</span>
                      </button>
                    ))}
                  </div>
                  <div className="ws-popover-sep" />
                  <div className="ws-popover-more">
                    <button type="button" className="ws-icon-btn" onClick={handleSyncClick} disabled={syncing}>
                      <span aria-hidden="true">☁️</span>
                      <span>{syncing ? "Syncing…" : "Sync iCloud"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </header>

          <div className="ws-detail">
            <div className={`ws-detail-inner${space === "budget" ? " is-wide" : ""}`}>
              {space === "today" && (
                <TodayScreen
                  snapshot={snapshot}
                  onOpenSpace={handleOpenSpace}
                  onOpenTrip={(tripId) => handleSelectTrip(tripId, "overview")}
                />
              )}
              {space === "budget" && (
                <BudgetScreen
                  activeTab={budgetTab}
                  onSelectTab={setBudgetTab}
                  accounts={snapshot.accounts}
                  categories={snapshot.categories}
                  transactions={snapshot.transactions}
                />
              )}
              {space === "trips" && (
                <TripsScreen
                  trips={snapshot.trips}
                  tripItems={snapshot.tripItems}
                  selectedTripId={selectedTripId}
                  page={tripPage}
                  onSelectTrip={handleSelectTrip}
                />
              )}
              {space === "eats" && <EatsScreen eats={snapshot.eats} onAddCloudEat={onAddCloudEat} />}
              {space === "sights" && <SightsScreen sights={snapshot.sights} />}
              {space === "movies" && <MoviesScreen movies={snapshot.movies} />}
              {space === "recipes" && <RecipesScreen recipes={snapshot.recipes} />}
            </div>
          </div>

          <footer className="ws-footer-bar">
            Synced with Apple iCloud · {snapshot.trips.length} trips · {snapshot.eats.length} eats ·{" "}
            {snapshot.sights.length} sights · {snapshot.movies.length} movies · {snapshot.recipes.length} recipes ·{" "}
            {snapshot.accounts.length} accounts.
          </footer>
        </div>
      </div>
    </div>
  );
}
