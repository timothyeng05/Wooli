"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ACCOUNTS,
  APPS,
  BEEN,
  CATEGORIES,
  FORECAST_DATA,
  MOVIES,
  NEW_PLACE,
  POSTED,
  RECIPES,
  REVIEW,
  SIGHTS,
  TRIPS,
  WANT,
  type AppId,
  type Category,
  type Kind,
  type Movie,
  type Place,
  type Recipe,
  type Sight,
  type Trip,
  type Txn,
} from "./data";

// A Mac window in the browser: app switcher top right, Mac sidebar for apps
// with subpages (Trips, Budget), and the native Wooli experience laid out with fidelity.

type TripPage = "overview" | "ideas" | "bookings" | `city:${string}`;
type BudgetPage = "dashboard" | "accounts" | "transactions" | "reports" | "plan" | "forecast" | "categories" | "rules" | "recurring";

const money = (n: number, cents = false) =>
  (n < 0 ? "−" : "") +
  "$" +
  Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });

const KIND_ICON: Record<Kind, string> = { transit: "✈︎", stay: "⌂", meal: "🍽", activity: "★", note: "✎" };

export interface DemoAppProps {
  cloudMode?: boolean;
  initialTrips?: Trip[];
  initialEats?: Place[];
  initialSights?: Sight[];
  initialMovies?: Movie[];
  initialRecipes?: Recipe[];
  initialAccounts?: typeof ACCOUNTS;
  initialCategories?: Category[];
  initialReview?: Txn[];
  initialPosted?: Txn[];
  onRefreshCloud?: () => void;
  onAddCloudEat?: (input: { name: string; address: string; sentiment: "loved" | "liked" | "fine" | "disliked"; isWish: boolean }) => Promise<void>;
  signOutSlot?: React.ReactNode;
}

export default function DemoApp({
  cloudMode = false,
  initialTrips,
  initialEats,
  initialSights,
  initialMovies,
  initialRecipes,
  initialAccounts,
  initialCategories,
  initialReview,
  initialPosted,
  onRefreshCloud,
  onAddCloudEat,
  signOutSlot,
}: DemoAppProps = {}) {
  const tripsList = initialTrips && initialTrips.length > 0 ? initialTrips : TRIPS;
  const sightsList = initialSights && initialSights.length > 0 ? initialSights : cloudMode ? [] : SIGHTS;
  const moviesList = initialMovies && initialMovies.length > 0 ? initialMovies : cloudMode ? [] : MOVIES;
  const recipesList = initialRecipes && initialRecipes.length > 0 ? initialRecipes : cloudMode ? [] : RECIPES;
  const categoriesList = initialCategories && initialCategories.length > 0 ? initialCategories : cloudMode ? [] : CATEGORIES;
  const accountsList = initialAccounts && initialAccounts.length > 0 ? initialAccounts : cloudMode ? [] : ACCOUNTS;
  const [app, setApp] = useState<AppId>("today");
  const [tripId, setTripId] = useState(tripsList[0].id);
  const [tripPage, setTripPage] = useState<TripPage>("overview");
  const [budgetPage, setBudgetPage] = useState<BudgetPage>("dashboard");
  const [switcher, setSwitcher] = useState(false);
  const [palette, setPalette] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Budget state is shared across Today and Budget
  const [review, setReview] = useState<Txn[]>(initialReview ?? (cloudMode ? [] : REVIEW));
  const [posted, setPosted] = useState<Txn[]>(initialPosted ?? (cloudMode ? [] : POSTED));
  const [plans, setPlans] = useState<Record<string, number>>(() => Object.fromEntries(categoriesList.map((c) => [c.id, c.plan])));
  const [ranked, setRanked] = useState<Place[]>(initialEats ?? (cloudMode ? [] : BEEN));

  useEffect(() => {
    if (initialEats) setRanked(initialEats);
  }, [initialEats]);

  useEffect(() => {
    if (initialReview) setReview(initialReview);
  }, [initialReview]);

  useEffect(() => {
    if (initialPosted) setPosted(initialPosted);
  }, [initialPosted]);

  useEffect(() => {
    if (initialCategories) setPlans(Object.fromEntries(initialCategories.map((c) => [c.id, c.plan])));
  }, [initialCategories]);

  useEffect(() => {
    if (initialTrips && initialTrips.length > 0 && !initialTrips.some((t) => t.id === tripId)) {
      setTripId(initialTrips[0].id);
    }
  }, [initialTrips, tripId]);

  const spent = useMemo(() => {
    const extra: Record<string, number> = {};
    for (const t of posted) if (t.category && !POSTED.includes(t)) extra[t.category] = (extra[t.category] ?? 0) - t.amount;
    return Object.fromEntries(categoriesList.map((c) => [c.id, c.spent + (extra[c.id] ?? 0)]));
  }, [posted, categoriesList]);
  const totalPlan = Object.values(plans).reduce((a, b) => a + b, 0);
  const totalSpent = Object.values(spent).reduce((a, b) => a + b, 0);
  const left = totalPlan - totalSpent;

  const say = useCallback((text: string) => setToast(text), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
      if (e.key === "Escape") {
        setPalette(false);
        setSwitcher(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (next: AppId) => {
    setApp(next);
    setSwitcher(false);
  };

  const categorize = (id: string, category: string) => {
    const txn = review.find((t) => t.id === id);
    if (!txn) return;
    setReview((r) => r.filter((t) => t.id !== id));
    setPosted((p) => [{ ...txn, category, suggestion: undefined }, ...p]);
    const cat = CATEGORIES.find((c) => c.id === category);
    say(`${txn.payee} → ${cat?.name ?? category}`);
  };

  const hasSidebar = app === "trips" || app === "budget";
  const trip = tripsList.find((t) => t.id === tripId) ?? tripsList[0];
  const title = APPS.find((a) => a.id === app)?.name ?? "Wooli";

  return (
    <div className="dm-window">
      {/* macOS window title bar */}
      <div className="dm-titlebar">
        <div className="dm-lights" aria-hidden="true">
          <span className="dm-light is-red" />
          <span className="dm-light is-amber" />
          <span className="dm-light is-green" />
        </div>
        {hasSidebar && (
          <button
            className="dm-tool"
            onClick={() => setSidebar((s) => !s)}
            aria-label={sidebar ? "Hide sidebar" : "Show sidebar"}
            title="Show or hide sidebar (⌃⌘S)"
          >
            <SidebarGlyph />
          </button>
        )}
        <div className="dm-title">
          <Image src={`/apps/${app}.png`} alt="" width={22} height={22} style={{ borderRadius: 5 }} />
          <span>{title}</span>
        </div>
        <div className="dm-tools">
          {cloudMode && onRefreshCloud && (
            <button className="dm-tool" onClick={onRefreshCloud} title="Refresh iCloud" aria-label="Refresh iCloud" style={{ width: "auto", padding: "0 10px", fontSize: 12, fontWeight: 600 }}>
              ☁️ Sync
            </button>
          )}
          {cloudMode && signOutSlot}
          <button className="dm-search" onClick={() => setPalette(true)}>
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>
          <div className="dm-switch-wrap">
            <button
              className="dm-tool"
              aria-label="Switch apps"
              aria-expanded={switcher}
              onClick={() => setSwitcher((s) => !s)}
              title="Switch apps"
            >
              <GridGlyph />
            </button>
            {switcher && (
              <div className="dm-switcher" role="menu">
                {APPS.map((a) => (
                  <button key={a.id} role="menuitem" className={a.id === app ? "is-on" : ""} onClick={() => go(a.id)}>
                    <span className="dm-switch-icon">
                      <Image src={`/apps/${a.id}.png`} alt="" width={48} height={48} />
                      {a.id === "budget" && review.length > 0 && <b className="dm-dot">{review.length}</b>}
                    </span>
                    <span>{a.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`dm-body ${hasSidebar && sidebar ? "has-sidebar" : ""} ${app === "trips" ? "wide-sidebar" : ""}`}>
        {hasSidebar && sidebar && (
          <nav className="dm-sidebar" aria-label={`${title} pages`}>
            {app === "trips" ? (
              <TripsSidebar
                trips={tripsList}
                tripId={tripId}
                page={tripPage}
                onPick={(id, page) => {
                  setTripId(id);
                  setTripPage(page);
                }}
                onNew={() => say("New Trip… works in the Mac app")}
              />
            ) : (
              <BudgetSidebar page={budgetPage} reviewCount={review.length} onPick={setBudgetPage} />
            )}
          </nav>
        )}

        <main className="dm-detail" onClick={() => setSwitcher(false)}>
          <div className="dm-scroll" key={`${app}-${tripId}-${tripPage}-${budgetPage}`}>
            {app === "today" && (
              <TodayScreen
                left={left}
                spentTotal={totalSpent}
                plannedTotal={totalPlan}
                reviewCount={review.length}
                go={go}
                openTrip={() => {
                  setTripId(tripsList[0].id);
                  setTripPage("overview");
                  go("trips");
                }}
              />
            )}
            {app === "budget" && (
              <BudgetScreen
                page={budgetPage}
                setPage={setBudgetPage}
                review={review}
                posted={posted}
                categorize={categorize}
                plans={plans}
                setPlans={setPlans}
                spent={spent}
                left={left}
                totalPlan={totalPlan}
                totalSpent={totalSpent}
              />
            )}
            {app === "sights" && <SightsScreen sights={sightsList} say={say} />}
            {app === "trips" && <TripsScreen trip={trip} page={tripPage} setPage={setTripPage} say={say} />}
            {app === "eats" && <EatsScreen ranked={ranked} setRanked={setRanked} say={say} cloudMode={cloudMode} onAddCloudEat={onAddCloudEat} />}
            {app === "movies" && <MoviesScreen movies={moviesList} say={say} />}
            {app === "recipes" && <RecipesScreen recipes={recipesList} say={say} />}
          </div>
        </main>
      </div>

      {palette && (
        <Palette
          onClose={() => setPalette(false)}
          onPick={(action) => {
            setPalette(false);
            action();
          }}
          entries={[
            ...APPS.map((a) => ({ id: `app-${a.id}`, title: a.name, sub: "App", icon: `/apps/${a.id}.png`, action: () => go(a.id) })),
            ...tripsList.flatMap((t) => [
              { id: `trip-${t.id}`, title: t.name, sub: `Trip · ${t.dates}`, icon: "/apps/trips.png", action: () => { setTripId(t.id); setTripPage("overview"); go("trips"); } },
              ...t.cities.map((c) => ({ id: `city-${c.id}`, title: c.name, sub: `City in ${t.name}`, icon: "/apps/trips.png", action: () => { setTripId(t.id); setTripPage(`city:${c.id}`); go("trips"); } })),
            ]),
            { id: "budget-forecast", title: "Forecast", sub: "Budget · Long-term projections", icon: "/apps/budget.png", action: () => { setBudgetPage("forecast"); go("budget"); } },
            { id: "budget-plan", title: "Plan", sub: "Budget · Monthly categories", icon: "/apps/budget.png", action: () => { setBudgetPage("plan"); go("budget"); } },
            { id: "budget-activity", title: "Transactions", sub: "Budget · Recent spending", icon: "/apps/budget.png", action: () => { setBudgetPage("transactions"); go("budget"); } },
            { id: "budget-accounts", title: "Accounts", sub: "Budget · Balances", icon: "/apps/budget.png", action: () => { setBudgetPage("accounts"); go("budget"); } },
            ...sightsList.map((s) => ({ id: `sight-${s.id}`, title: s.name, sub: `Sights · ${s.city}`, icon: "/apps/sights.png", action: () => go("sights") })),
            ...recipesList.map((r) => ({ id: `recipe-${r.id}`, title: r.name, sub: "Recipe", icon: "/apps/recipes.png", action: () => go("recipes") })),
          ]}
        />
      )}

      <div className={`dm-toast ${toast ? "is-on" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}

/* =========================================================
   TODAY SCREEN (Matches Image 2 & TodayBoard.swift)
========================================================= */

function TodayScreen({
  left,
  spentTotal,
  plannedTotal,
  reviewCount,
  go,
  openTrip,
}: {
  left: number;
  spentTotal: number;
  plannedTotal: number;
  reviewCount: number;
  go: (a: AppId) => void;
  openTrip: () => void;
}) {
  const isOver = left < 0;
  const headline = isOver ? `${money(Math.abs(left))} over` : `${money(left)} left`;
  const progressPct = Math.min(Math.max((spentTotal / (plannedTotal || 1)) * 100, 0), 100);

  return (
    <div>
      <div className="dm-date-header">Wednesday, November 25</div>

      {/* Hero: "This month" Budget Status Card (Image 2) */}
      <div className="dm-today-hero" onClick={() => go("budget")} role="button" tabIndex={0}>
        <div className="dm-hero-eyebrow">THIS MONTH</div>
        <div className="dm-hero-amount">{headline}</div>
        <div className="dm-hero-sub">5 days left this month</div>
        <div className="dm-hero-progress">
          <div className="dm-progress-track">
            <div className="dm-progress-fill" style={{ width: `${progressPct}%` }}>
              <span className="dm-progress-thumb" />
            </div>
          </div>
          <div className="dm-progress-labels">
            <span>$0</span>
            <span>{money(spentTotal)} spent</span>
            <span>{money(plannedTotal)}</span>
          </div>
        </div>
      </div>

      {/* Explore Section (Image 2) */}
      <div className="dm-section-title">EXPLORE</div>
      <div className="dm-explore-row">
        {/* 1. Sights: Sézane Madrid */}
        <div className="dm-explore-card" onClick={() => go("sights")}>
          <div className="dm-explore-art">
            <div className="dm-map-art">
              <svg className="dm-map-grid" viewBox="0 0 160 120" preserveAspectRatio="none">
                <rect width="160" height="120" fill="#e8eff9" />
                <path d="M0,30 Q80,20 160,35 M0,75 L160,70 M40,0 L45,120 M115,0 L110,120" stroke="#cbdcf0" strokeWidth="6" fill="none" />
                <path d="M70,0 Q80,60 90,120" stroke="#b9d0ec" strokeWidth="8" fill="none" />
                <rect x="50" y="38" width="55" height="30" fill="#dbe6f5" rx="3" />
              </svg>
              <div className="dm-map-pin is-purple">📍</div>
              <div className="dm-map-badge"> Maps Legal</div>
            </div>
          </div>
          <div className="dm-explore-info">
            <div className="dm-explore-tag">SIGHTS</div>
            <div className="dm-explore-title">Sézane Madrid</div>
            <div className="dm-explore-sub">Next to see</div>
          </div>
        </div>

        {/* 2. Trips: Spain 2026 */}
        <div className="dm-explore-card" onClick={openTrip}>
          <div className="dm-explore-art">
            <div className="dm-tint-art is-trips">
              <Image src="/apps/trips.png" alt="Trips" width={88} height={88} style={{ objectFit: "contain" }} />
            </div>
          </div>
          <div className="dm-explore-info">
            <div className="dm-explore-tag">TRIPS</div>
            <div className="dm-explore-title">Spain 2026</div>
            <div className="dm-explore-sub">In 29 days</div>
          </div>
        </div>

        {/* 3. Eats: JUA */}
        <div className="dm-explore-card" onClick={() => go("eats")}>
          <div className="dm-explore-art">
            <div className="dm-map-art">
              <svg className="dm-map-grid" viewBox="0 0 160 120" preserveAspectRatio="none">
                <rect width="160" height="120" fill="#e8eff9" />
                <path d="M0,45 L160,45 M0,85 L160,85 M30,0 L30,120 M85,0 L85,120 M140,0 L140,120" stroke="#cbdcf0" strokeWidth="5" fill="none" />
                <path d="M0,15 L160,95" stroke="#f2dfcb" strokeWidth="7" fill="none" />
                <rect x="35" y="50" width="45" height="30" fill="#dbe6f5" rx="3" />
              </svg>
              <div className="dm-map-pin is-orange">📍</div>
              <div className="dm-map-badge"> Maps Legal</div>
            </div>
          </div>
          <div className="dm-explore-info">
            <div className="dm-explore-tag">EATS</div>
            <div className="dm-explore-title">JUA</div>
            <div className="dm-explore-sub">Your #1 place</div>
          </div>
        </div>

        {/* 4. Recipes: 譚仔米線 inspired */}
        <div className="dm-explore-card" onClick={() => go("recipes")}>
          <div className="dm-explore-art">
            <div className="dm-tint-art is-recipes">
              <Image src="/apps/recipes.png" alt="Recipes" width={88} height={88} style={{ objectFit: "contain" }} />
            </div>
          </div>
          <div className="dm-explore-info">
            <div className="dm-explore-tag">RECIPES</div>
            <div className="dm-explore-title">譚仔米線 inspired rice...</div>
            <div className="dm-explore-sub">Dinner · Chinese · 45 min</div>
          </div>
        </div>
      </div>

      {/* Your Apps Section (Image 2) */}
      <div className="dm-section-title">YOUR APPS</div>
      <div className="dm-apps-grid">
        <button className="dm-app-tile" onClick={() => go("budget")}>
          <div className="dm-app-tile-icon">
            <Image src="/apps/budget.png" alt="Budget" width={84} height={84} />
            {reviewCount > 0 && <span className="dm-dot">{reviewCount}</span>}
          </div>
          <span className="dm-app-tile-title">Budget</span>
        </button>

        <button className="dm-app-tile" onClick={() => go("sights")}>
          <div className="dm-app-tile-icon">
            <Image src="/apps/sights.png" alt="Sights" width={84} height={84} />
          </div>
          <span className="dm-app-tile-title">Sights</span>
        </button>

        <button className="dm-app-tile" onClick={() => go("trips")}>
          <div className="dm-app-tile-icon">
            <Image src="/apps/trips.png" alt="Trips" width={84} height={84} />
          </div>
          <span className="dm-app-tile-title">Trips</span>
        </button>

        <button className="dm-app-tile" onClick={() => go("eats")}>
          <div className="dm-app-tile-icon">
            <Image src="/apps/eats.png" alt="Eats" width={84} height={84} />
          </div>
          <span className="dm-app-tile-title">Eats</span>
        </button>

        <button className="dm-app-tile" onClick={() => go("movies")}>
          <div className="dm-app-tile-icon">
            <Image src="/apps/movies.png" alt="Movies" width={84} height={84} />
          </div>
          <span className="dm-app-tile-title">Movies</span>
        </button>

        <button className="dm-app-tile" onClick={() => go("recipes")}>
          <div className="dm-app-tile-icon">
            <Image src="/apps/recipes.png" alt="Recipes" width={84} height={84} />
          </div>
          <span className="dm-app-tile-title">Recipes</span>
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   BUDGET SIDEBAR & SCREENS (Matches Image 1)
========================================================= */

const BUDGET_SECTIONS: { id: BudgetPage; name: string; icon: string }[] = [
  { id: "dashboard", name: "Dashboard", icon: "🏠" },
  { id: "accounts", name: "Accounts", icon: "💳" },
  { id: "transactions", name: "Transactions", icon: "🧾" },
  { id: "reports", name: "Reports", icon: "📊" },
  { id: "plan", name: "Plan", icon: "🎯" },
  { id: "forecast", name: "Forecast", icon: "📈" },
  { id: "categories", name: "Categories", icon: "🏷️" },
  { id: "rules", name: "Rules", icon: "🪄" },
  { id: "recurring", name: "Recurring", icon: "🔄" },
];

function BudgetSidebar({ page, reviewCount, onPick }: { page: BudgetPage; reviewCount: number; onPick: (p: BudgetPage) => void }) {
  return (
    <div className="dm-mac-sidebar">
      <div className="dm-sidebar-header">
        <Image src="/apps/budget.png" alt="Budget" width={28} height={28} />
        <span>Budget</span>
      </div>
      <div className="dm-sidebar-menu">
        {BUDGET_SECTIONS.map((s) => (
          <button
            key={s.id}
            className={`dm-sidebar-row ${page === s.id ? "is-active" : ""}`}
            onClick={() => onPick(s.id)}
          >
            <span>{s.icon}</span>
            <span>{s.name}</span>
            {s.id === "transactions" && reviewCount > 0 && <span className="dm-sidebar-badge">{reviewCount}</span>}
          </button>
        ))}
      </div>
      <div className="dm-sidebar-footer">
        <span>⚙️</span>
        <span>Settings · Synced</span>
      </div>
    </div>
  );
}

function BudgetScreen(props: {
  page: BudgetPage;
  setPage: (p: BudgetPage) => void;
  review: Txn[];
  posted: Txn[];
  categorize: (id: string, cat: string) => void;
  plans: Record<string, number>;
  setPlans: (fn: (p: Record<string, number>) => Record<string, number>) => void;
  spent: Record<string, number>;
  left: number;
  totalPlan: number;
  totalSpent: number;
}) {
  const { page, review, posted, categorize, plans, spent, left, totalPlan, totalSpent } = props;
  const [tab, setTab] = useState<"plan" | "compare" | "chance">("plan");
  const [tableTab, setTableTab] = useState<"accounts" | "cashflow" | "events">("accounts");
  const [q, setQ] = useState("");
  const [picking, setPicking] = useState<string | null>(null);

  // 1. Forecast view (Image 1)
  if (page === "forecast") {
    return (
      <div className="dm-forecast-screen">
        <div className="dm-forecast-main">
          {/* Top Bar */}
          <div className="dm-forecast-top">
            <div className="dm-forecast-headline">
              <h2>Forecasting</h2>
              <button className="dm-scenario-pill">
                <span>🌐 {FORECAST_DATA.name}</span>
                <small>▾</small>
              </button>
              <span className="dm-saved-text">{FORECAST_DATA.savedTime}</span>
            </div>

            <div className="dm-forecast-actions">
              <div className="dm-segmented">
                <button className={tab === "plan" ? "is-active" : ""} onClick={() => setTab("plan")}>
                  Plan
                </button>
                <button className={tab === "compare" ? "is-active" : ""} onClick={() => setTab("compare")}>
                  Compare
                </button>
                <button className={tab === "chance" ? "is-active" : ""} onClick={() => setTab("chance")}>
                  Chance of success
                </button>
              </div>
              <button className="dm-btn-primary">
                <span>+ Add event</span>
                <small>▾</small>
              </button>
            </div>
          </div>

          {/* 4 KPI cards */}
          <div className="dm-kpi-grid">
            <div className="dm-kpi-card">
              <div className="dm-kpi-label">Net worth (EOY)</div>
              <div className="dm-kpi-val">$186K</div>
            </div>
            <div className="dm-kpi-card">
              <div className="dm-kpi-label">Net worth at retirement</div>
              <div className="dm-kpi-val">$4.82M</div>
            </div>
            <div className="dm-kpi-card">
              <div className="dm-kpi-label">Retirement age</div>
              <div className="dm-kpi-val">62</div>
            </div>
            <div className="dm-kpi-card">
              <div className="dm-kpi-label">Net worth at end</div>
              <div className="dm-kpi-val">$3.95M</div>
            </div>
          </div>

          {/* Projection Chart */}
          <div className="dm-chart-card">
            <div className="dm-chart-wrap">
              <svg viewBox="0 0 760 220" width="100%" height="100%" preserveAspectRatio="none">
                {/* Horizontal gridlines */}
                <line x1="40" y1="30" x2="740" y2="30" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />
                <line x1="40" y1="85" x2="740" y2="85" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />
                <line x1="40" y1="140" x2="740" y2="140" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />
                <line x1="40" y1="195" x2="740" y2="195" stroke="currentColor" strokeOpacity="0.15" />

                {/* Y-axis labels */}
                <text x="35" y="34" textAnchor="end" fontSize="10" fill="currentColor" opacity="0.6">$6.00M</text>
                <text x="35" y="89" textAnchor="end" fontSize="10" fill="currentColor" opacity="0.6">$4.00M</text>
                <text x="35" y="144" textAnchor="end" fontSize="10" fill="currentColor" opacity="0.6">$2.00M</text>
                <text x="35" y="198" textAnchor="end" fontSize="10" fill="currentColor" opacity="0.6">$0</text>

                {/* Vertical milestone lines */}
                {FORECAST_DATA.milestones.map((m) => {
                  const x = 50 + ((m.offsetPct / 100) * 670);
                  return (
                    <g key={m.year}>
                      <line x1={x} y1="30" x2={x} y2="195" stroke="currentColor" strokeOpacity="0.12" strokeDasharray="2 3" />
                      <circle cx={x} cy="38" r="10" fill="var(--dm-brand-soft)" stroke="var(--dm-brand)" strokeWidth="1.5" />
                      <text x={x} y="42" textAnchor="middle" fontSize="10">{m.icon}</text>
                    </g>
                  );
                })}

                {/* Projected plan curve */}
                <path
                  d="M 50,192 C 120,185 200,165 280,135 C 360,105 420,60 480,48 C 540,55 640,58 720,60"
                  fill="none"
                  stroke="var(--dm-text)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* X-axis labels */}
                <text x="50" y="212" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">2026</text>
                <text x="120" y="212" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">2028</text>
                <text x="210" y="212" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">2032</text>
                <text x="300" y="212" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">2036</text>
                <text x="390" y="212" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">2040</text>
                <text x="480" y="212" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">2056</text>
                <text x="600" y="212" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">2072</text>
                <text x="720" y="212" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">2088</text>
              </svg>
            </div>

            <div className="dm-chart-legend">
              <div className="dm-legend-left">
                <span className="dm-legend-item">
                  <span className="dm-legend-line" />
                  <span>Projected plan</span>
                </span>
                <span className="dm-legend-item">
                  <span className="dm-legend-line" style={{ background: "var(--dm-expense)" }} />
                  <span>Below $0 (unfunded)</span>
                </span>
                <span>In today's dollars</span>
              </div>
              <div>Drag an icon to change when it happens</div>
            </div>
          </div>

          {/* Projection Table */}
          <div className="dm-forecast-table-card">
            <div className="dm-table-tabs">
              <button className={`dm-table-tab ${tableTab === "accounts" ? "is-active" : ""}`} onClick={() => setTableTab("accounts")}>
                Accounts
              </button>
              <button className={`dm-table-tab ${tableTab === "cashflow" ? "is-active" : ""}`} onClick={() => setTableTab("cashflow")}>
                Cash Flow
              </button>
              <button className={`dm-table-tab ${tableTab === "events" ? "is-active" : ""}`} onClick={() => setTableTab("events")}>
                Events
              </button>
            </div>
            <table className="dm-forecast-table">
              <thead>
                <tr>
                  <th></th>
                  {FORECAST_DATA.projections.map((p) => (
                    <th key={p.year}>{p.year}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Net Worth</td>
                  {FORECAST_DATA.projections.map((p) => (
                    <td key={p.year}>{p.netWorth}</td>
                  ))}
                </tr>
                <tr>
                  <td>Assets</td>
                  {FORECAST_DATA.projections.map((p) => (
                    <td key={p.year}>{p.assets}</td>
                  ))}
                </tr>
                <tr className="is-sub">
                  <td>Extra savings</td>
                  {FORECAST_DATA.projections.map((p) => (
                    <td key={p.year}>{p.savings}</td>
                  ))}
                </tr>
                <tr className="is-sub">
                  <td>Company 401(k)</td>
                  {FORECAST_DATA.projections.map((p) => (
                    <td key={p.year}>{p.retirement}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right drawer: Edit assumptions */}
        <div className="dm-forecast-side">
          <div className="dm-assumptions-card">
            <div className="dm-assumptions-title">Edit assumptions</div>

            <div className="dm-field-group">
              <div className="dm-field-label">Scenario name and icon</div>
              <div className="dm-participant-row">
                <span>🌐 {FORECAST_DATA.name}</span>
              </div>
            </div>

            <div className="dm-field-group">
              <div className="dm-field-label">Participants</div>
              <div className="dm-participant-row">
                <div className="dm-part-left">
                  <span className="dm-part-avatar">M</span>
                  <span>Me</span>
                </div>
                <span>Age 31</span>
              </div>
              <div className="dm-participant-row" style={{ marginTop: 4 }}>
                <div className="dm-part-left">
                  <span className="dm-part-avatar is-jess">S</span>
                  <span>Sam</span>
                </div>
                <span>Age 30</span>
              </div>
            </div>

            <div className="dm-field-group">
              <div className="dm-field-label">Current income sources</div>
              <div className="dm-income-row">
                <span>💼 Income (Me)</span>
                <b>$142K →</b>
              </div>
              <div className="dm-income-row" style={{ marginTop: 4 }}>
                <span>💼 Income (Sam)</span>
                <b>$128K →</b>
              </div>
            </div>

            <div className="dm-field-group">
              <div className="dm-field-label">Yearly living expenses</div>
              <div className="dm-participant-row">
                <span>$84,000</span>
                <small>Match inflation (3%) ▾</small>
              </div>
            </div>

            <div className="dm-field-group">
              <div className="dm-field-label">Taxes</div>
              <div className="dm-participant-row">
                <span>Married filing jointly ▾</span>
              </div>
            </div>

            <div className="dm-field-group">
              <div className="dm-field-label">Yearly inflation rate</div>
              <div className="dm-participant-row">
                <span>2–3%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Transactions Activity
  if (page === "transactions") {
    const all = [...review, ...posted].filter((t) => t.payee.toLowerCase().includes(q.toLowerCase()));
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Activity</h2>
          <input
            className="dm-search"
            style={{ width: 220, padding: "6px 12px" }}
            placeholder="Search payees…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="dm-card dm-table-wrap">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Payee</th>
                <th>Category</th>
                <th>Account</th>
                <th className="is-num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {all.map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td>
                    {!t.category && <span className="dm-review-dot" title="Needs review" />} {t.payee}
                  </td>
                  <td>{t.category ? t.category : <span className="dm-pill is-pending">Needs review</span>}</td>
                  <td>{t.account}</td>
                  <td className={`is-num ${t.amount > 0 ? "is-income" : ""}`}>{money(t.amount, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 3. Accounts
  if (page === "accounts") {
    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Connected Accounts</h2>
        <div className="dm-card dm-table-wrap">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Type</th>
                <th className="is-num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ACCOUNTS.map((a) => (
                <tr key={a.name}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Image src={a.logo} alt="" width={24} height={24} style={{ borderRadius: 6 }} />
                      <b>{a.name}</b>
                    </div>
                  </td>
                  <td>{a.kind}</td>
                  <td className={`is-num ${a.balance < 0 ? "" : "is-income"}`}>{money(a.balance, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 4. Reports
  if (page === "reports") {
    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Spending Reports</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {CATEGORIES.map((c) => (
            <div key={c.id} className="dm-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{c.emoji} <b>{c.name}</b></span>
                <b>{money(spent[c.id])}</b>
              </div>
              <div style={{ marginTop: 8, height: 6, background: "var(--dm-track)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min((spent[c.id] / (plans[c.id] || 1)) * 100, 100)}%`, background: "var(--dm-brand)", borderRadius: 999 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--dm-text-2)", marginTop: 6 }}>
                <span>Plan: {money(plans[c.id])}</span>
                <span>Last month: {money(c.last)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 5. Plan
  if (page === "plan") {
    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Monthly Plan</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {CATEGORIES.map((c) => (
            <div key={c.id} className="dm-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span>{c.emoji} <b>{c.name}</b></span>
                <span className="dm-pill" style={{ background: "var(--dm-brand-soft)", color: "var(--dm-brand)" }}>{money(plans[c.id])}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--dm-text-2)" }}>{money(spent[c.id])} spent so far this month</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 6. Categories / Rules / Recurring
  if (page === "categories") {
    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Categories ({CATEGORIES.length})</h2>
        <div className="dm-card dm-table-wrap">
          <table className="dm-table">
            <thead>
              <tr><th>Category</th><th>Group</th><th className="is-num">Plan</th></tr>
            </thead>
            <tbody>
              {CATEGORIES.map((c) => (
                <tr key={c.id}>
                  <td>{c.emoji} {c.name}</td>
                  <td style={{ textTransform: "capitalize" }}>{c.group}</td>
                  <td className="is-num">{money(c.plan)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (page === "rules") {
    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Categorization Rules</h2>
        <div className="dm-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--dm-border)", paddingBottom: 10 }}>
              <span>When payee contains <b>Whole Foods</b></span>
              <span className="dm-pill" style={{ background: "var(--dm-brand-soft)", color: "var(--dm-brand)" }}>→ Groceries</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--dm-border)", paddingBottom: 10 }}>
              <span>When payee contains <b>Spotify</b></span>
              <span className="dm-pill" style={{ background: "var(--dm-brand-soft)", color: "var(--dm-brand)" }}>→ Subscriptions</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 2 }}>
              <span>When payee contains <b>MTA*NYCT</b></span>
              <span className="dm-pill" style={{ background: "var(--dm-brand-soft)", color: "var(--dm-brand)" }}>→ Transport</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (page === "recurring") {
    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Recurring Bills & Subs</h2>
        <div className="dm-card dm-table-wrap">
          <table className="dm-table">
            <thead>
              <tr><th>Bill / Payee</th><th>Frequency</th><th>Account</th><th className="is-num">Amount</th></tr>
            </thead>
            <tbody>
              <tr><td>Apartment Rent</td><td>Monthly · 1st</td><td>Chase Checking</td><td className="is-num">$2,200.00</td></tr>
              <tr><td>Spotify Premium</td><td>Monthly · 20th</td><td>Amex 2008</td><td className="is-num">$11.99</td></tr>
              <tr><td>iCloud+ 2TB</td><td>Monthly · 15th</td><td>Amex 2008</td><td className="is-num">$9.99</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 7. Default: Dashboard
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>Budget Dashboard</h2>
          <div style={{ color: "var(--dm-text-2)", fontSize: 13 }}>November 2026 · 4 connected accounts</div>
        </div>
      </div>

      {/* Top summary row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div className="dm-card" style={{ padding: 18, background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)", color: "#fff" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", opacity: 0.85 }}>THIS MONTH</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{money(Math.abs(left))} {left < 0 ? "over" : "left"}</div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>{money(totalSpent)} spent of {money(totalPlan)} target</div>
        </div>

        <div className="dm-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--dm-text-3)" }}>SPENDING PACE</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: "var(--dm-income)" }}>$214 under pace</div>
          <div style={{ fontSize: 12, color: "var(--dm-text-2)", marginTop: 2 }}>Pacing based on last 6 months</div>
        </div>
      </div>

      {/* Needs review queue */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Needs Review ({review.length})</h3>
        {review.length > 0 && <span className="dm-pill is-pending">{review.length} to categorize</span>}
      </div>

      {review.length === 0 ? (
        <div className="dm-card" style={{ padding: 28, textAlign: "center", marginBottom: 20 }}>
          <b>All caught up!</b>
          <div style={{ color: "var(--dm-text-2)", marginTop: 4, fontSize: 13 }}>No transactions waiting for category assignment.</div>
        </div>
      ) : (
        <div className="dm-card dm-table-wrap" style={{ marginBottom: 24 }}>
          <table className="dm-table">
            <thead>
              <tr>
                <th>Payee</th>
                <th>Date</th>
                <th>Account</th>
                <th>Action</th>
                <th className="is-num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {review.map((t) => (
                <tr key={t.id}>
                  <td><b>{t.payee}</b></td>
                  <td>{t.date}</td>
                  <td>{t.account}</td>
                  <td>
                    {t.suggestion ? (
                      <button
                        className="dm-btn-primary"
                        style={{ padding: "4px 10px", fontSize: 11 }}
                        onClick={() => categorize(t.id, t.suggestion!)}
                      >
                        Accept {t.suggestion}
                      </button>
                    ) : (
                      <button
                        className="dm-search"
                        style={{ padding: "4px 10px", fontSize: 11 }}
                        onClick={() => categorize(t.id, "dining")}
                      >
                        Pick category
                      </button>
                    )}
                  </td>
                  <td className="is-num">{money(t.amount, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Activity */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Recent Activity</h3>
      <div className="dm-card dm-table-wrap">
        <table className="dm-table">
          <thead>
            <tr><th>Payee</th><th>Date</th><th>Category</th><th>Account</th><th className="is-num">Amount</th></tr>
          </thead>
          <tbody>
            {posted.slice(0, 4).map((t) => (
              <tr key={t.id}>
                <td><b>{t.payee}</b></td>
                <td>{t.date}</td>
                <td><span className="dm-pill" style={{ background: "var(--dm-track)" }}>{t.category}</span></td>
                <td>{t.account}</td>
                <td className={`is-num ${t.amount > 0 ? "is-income" : ""}`}>{money(t.amount, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================
   SIGHTS SCREEN
========================================================= */

function SightsScreen({ sights, say }: { sights: Sight[]; say: (msg: string) => void }) {
  const [tab, setTab] = useState<"want" | "been">("want");
  const filtered = sights.filter((s) => (tab === "been" ? s.visited : !s.visited));

  return (
    <div>
      {/* Sights Hero */}
      <div className="dm-sights-hero">
        <div className="dm-hero-eyebrow">YOUR SIGHTS</div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>{sights.length} places</div>
        <div style={{ fontSize: 13, color: "var(--dm-text-2)" }}>
          {sights.filter((s) => s.visited).length} been · {sights.filter((s) => !s.visited).length} to go
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div className="dm-segmented">
          <button className={tab === "want" ? "is-active" : ""} onClick={() => setTab("want")}>
            Want to go ({SIGHTS.filter((s) => !s.visited).length})
          </button>
          <button className={tab === "been" ? "is-active" : ""} onClick={() => setTab("been")}>
            Been ({SIGHTS.filter((s) => s.visited).length})
          </button>
        </div>
      </div>

      <div className="dm-sights-grid">
        {filtered.map((s) => (
          <div key={s.id} className="dm-sight-card" onClick={() => say(`${s.name} · ${s.city}`)}>
            <div className="dm-sight-top">
              <span className="dm-sight-city">{s.city}</span>
              <span>{s.visited ? "✓ Visited" : "📍 To see"}</span>
            </div>
            <div className="dm-sight-name">{s.name}</div>
            <div style={{ fontSize: 11, color: "var(--dm-brand)", fontWeight: 600 }}>{s.category}</div>
            <div className="dm-sight-notes">{s.notes}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   TRIPS SCREEN
========================================================= */

function TripsSidebar({
  trips,
  tripId,
  page,
  onPick,
  onNew,
}: {
  trips: Trip[];
  tripId: string;
  page: TripPage;
  onPick: (id: string, p: TripPage) => void;
  onNew: () => void;
}) {
  return (
    <div className="dm-mac-sidebar">
      <div className="dm-sidebar-header">
        <Image src="/apps/trips.png" alt="Trips" width={28} height={28} />
        <span>Trips</span>
      </div>
      <div className="dm-sidebar-menu">
        {trips.map((t) => (
          <button
            key={t.id}
            className={`dm-sidebar-row ${tripId === t.id ? "is-active" : ""}`}
            onClick={() => onPick(t.id, "overview")}
          >
            <span>🧳</span>
            <span>{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TripsScreen({
  trip,
  page,
  setPage,
  say,
}: {
  trip: Trip;
  page: TripPage;
  setPage: (p: TripPage) => void;
  say: (msg: string) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>{trip.name}</h2>
          <div style={{ color: "var(--dm-text-2)", fontSize: 13 }}>{trip.dates} · {trip.countdown}</div>
        </div>
      </div>

      <div className="dm-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--dm-brand)", textTransform: "uppercase" }}>FLIGHT OUT</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{trip.from} → {trip.to}</div>
            <div style={{ fontSize: 13, color: "var(--dm-text-2)" }}>{trip.flight} · {trip.times}</div>
          </div>
          <span className="dm-pill" style={{ background: "var(--dm-brand-soft)", color: "var(--dm-brand)" }}>Confirmed</span>
        </div>
      </div>

      <div className="dm-section-title">CITIES & STOPS</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {trip.cities.map((c) => (
          <div key={c.id} className="dm-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--dm-brand)", textTransform: "uppercase" }}>{c.dates}</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{c.name}</div>
            <div style={{ fontSize: 12, color: "var(--dm-text-2)", marginTop: 2 }}>{c.nights} nights</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   EATS SCREEN
========================================================= */

function EatsScreen({
  ranked,
  setRanked,
  say,
  cloudMode = false,
  onAddCloudEat,
}: {
  ranked: Place[];
  setRanked: (fn: (p: Place[]) => Place[]) => void;
  say: (msg: string) => void;
  cloudMode?: boolean;
  onAddCloudEat?: (input: { name: string; address: string; sentiment: "loved" | "liked" | "fine" | "disliked"; isWish: boolean }) => Promise<void>;
}) {
  const [duel, setDuel] = useState<Place | null>(cloudMode ? null : NEW_PLACE);
  const [addName, setAddName] = useState("");
  const [addAddr, setAddAddr] = useState("");
  const [addSentiment, setAddSentiment] = useState<"loved" | "liked" | "fine" | "disliked">("loved");
  const [addWish, setAddWish] = useState(false);
  const [saving, setSaving] = useState(false);

  const submitCloudEat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !onAddCloudEat) return;
    setSaving(true);
    try {
      await onAddCloudEat({ name: addName.trim(), address: addAddr.trim(), sentiment: addSentiment, isWish: addWish });
      say(`Saved ${addName.trim()} to iCloud`);
      setAddName("");
      setAddAddr("");
    } finally {
      setSaving(false);
    }
  };

  const vote = (chosen: Place) => {
    if (duel) {
      setRanked((prev) => [duel, ...prev.filter((p) => p.id !== duel.id)]);
      say(`Ranked ${duel.name} as #1!`);
      setDuel(null);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>Eats Passport</h2>
          <div style={{ color: "var(--dm-text-2)", fontSize: 13 }}>{ranked.length} ranked places · NYC & abroad</div>
        </div>
      </div>

      {cloudMode && onAddCloudEat && (
        <form onSubmit={submitCloudEat} className="dm-card" style={{ padding: 14, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Add restaurant or cafe…"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            required
            style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--dm-border)", fontSize: 13, flex: "1 1 180px" }}
          />
          <input
            type="text"
            placeholder="Neighborhood / address"
            value={addAddr}
            onChange={(e) => setAddAddr(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--dm-border)", fontSize: 13, flex: "1 1 160px" }}
          />
          <select
            value={addSentiment}
            onChange={(e) => setAddSentiment(e.target.value as "loved" | "liked" | "fine" | "disliked")}
            style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--dm-border)", fontSize: 13 }}
          >
            <option value="loved">Loved</option>
            <option value="liked">Liked</option>
            <option value="fine">Fine</option>
            <option value="disliked">Disliked</option>
          </select>
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
            <input type="checkbox" checked={addWish} onChange={(e) => setAddWish(e.target.checked)} />
            Want to Try
          </label>
          <button className="dm-btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save to iCloud"}
          </button>
        </form>
      )}

      {duel && (
        <div className="dm-card" style={{ padding: 20, marginBottom: 20, background: "var(--dm-brand-soft)", border: "1px solid rgba(37, 99, 235, 0.2)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--dm-brand)", textTransform: "uppercase", marginBottom: 8 }}>
            ⚡️ PAIRWISE DUEL · JUST VISITED
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
            Which one did you enjoy more?
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="dm-btn-primary" onClick={() => vote(duel)}>
              {duel.emoji} {duel.name} ({duel.area})
            </button>
            <button className="dm-btn-primary" style={{ background: "var(--dm-card)", color: "var(--dm-text)", border: "1px solid var(--dm-border)" }} onClick={() => vote(ranked[0])}>
              {ranked[0]?.emoji} {ranked[0]?.name} ({ranked[0]?.area})
            </button>
          </div>
        </div>
      )}

      <div className="dm-card dm-table-wrap">
        <table className="dm-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Place</th>
              <th>Cuisine</th>
              <th>Neighborhood</th>
              <th>Visits</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p, idx) => (
              <tr key={p.id}>
                <td><b>#{idx + 1}</b></td>
                <td>
                  <span style={{ marginRight: 8 }}>{p.emoji}</span>
                  <b>{p.name}</b>
                </td>
                <td>{p.cuisine}</td>
                <td>{p.area}</td>
                <td>{p.visits.length} visit{p.visits.length === 1 ? "" : "s"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================
   MOVIES SCREEN
========================================================= */

function MoviesScreen({ movies, say }: { movies: Movie[]; say: (msg: string) => void }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Movies ({movies.length} ranked)</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {movies.map((m, idx) => (
          <div key={m.title} className="dm-card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--dm-brand)" }}>#{idx + 1}</span>
              <span className="dm-pill" style={{ background: "var(--dm-brand-soft)", color: "var(--dm-brand)" }}>{m.feel}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>{m.title}</div>
            <div style={{ fontSize: 12, color: "var(--dm-text-2)", marginTop: 2 }}>
              {m.year} · {m.genre} · Dir. {m.director}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   RECIPES SCREEN
========================================================= */

function RecipesScreen({ recipes, say }: { recipes: Recipe[]; say: (msg: string) => void }) {
  const [selected, setSelected] = useState<Recipe | undefined>(recipes[0]);

  if (!selected) {
    return (
      <div className="dm-card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Recipes</h2>
        <p style={{ color: "var(--dm-text-2)", marginTop: 6 }}>No recipes found in iCloud yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 20 }}>
      <div style={{ flex: "0 0 260px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>Recipes</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recipes.map((r) => (
            <button
              key={r.id}
              className={`dm-sidebar-row ${selected.id === r.id ? "is-active" : ""}`}
              onClick={() => setSelected(r)}
            >
              <span>{r.emoji}</span>
              <span>{r.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <div className="dm-card" style={{ padding: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--dm-brand)", textTransform: "uppercase" }}>{selected.meal} · {selected.mins} MIN</div>
          <h3 style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{selected.emoji} {selected.name}</h3>
          <div style={{ fontSize: 13, color: "var(--dm-text-2)", marginTop: 2, marginBottom: 20 }}>{selected.from}</div>

          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--dm-text-3)", marginBottom: 8 }}>
            INGREDIENTS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 24 }}>
            {selected.ingredients.map((ing) => (
              <div key={ing.name} style={{ display: "flex", justifyContent: "space-between", background: "var(--dm-track)", padding: "6px 12px", borderRadius: 8, fontSize: 12 }}>
                <span>{ing.name}</span>
                <b>{ing.amount}</b>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--dm-text-3)", marginBottom: 8 }}>
            STEPS
          </div>
          <ol style={{ paddingLeft: 20, fontSize: 13, lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 6 }}>
            {selected.steps.map((st, i) => (
              <li key={i}>{st}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   COMMAND PALETTE & GLYPHS
========================================================= */

function Palette({
  onClose,
  onPick,
  entries,
}: {
  onClose: () => void;
  onPick: (action: () => void) => void;
  entries: { id: string; title: string; sub: string; icon: string; action: () => void }[];
}) {
  const [q, setQ] = useState("");
  const filtered = entries.filter((e) => (e.title + " " + e.sub).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="dm-palette-scrim" onClick={onClose}>
      <div className="dm-palette" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          placeholder="Search apps, trips, places, sights, budget…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="dm-palette-list">
          {filtered.length === 0 ? (
            <div style={{ padding: 16, color: "var(--dm-text-2)", textAlign: "center", fontSize: 13 }}>
              Nothing matches "{q}".
            </div>
          ) : (
            filtered.map((e) => (
              <button key={e.id} className="dm-palette-item" onClick={() => onPick(e.action)}>
                <Image src={e.icon} alt="" width={22} height={22} style={{ borderRadius: 5 }} />
                <div className="dm-pal-text">
                  <b>{e.title}</b>
                  <small>{e.sub}</small>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SidebarGlyph() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
      <rect x="0.75" y="0.75" width="16.5" height="12.5" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="6.5" y1="1" x2="6.5" y2="13" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function GridGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {[0, 6, 12].flatMap((x) =>
        [0, 6, 12].map((y) => <rect key={`${x}${y}`} x={x} y={y} width="4" height="4" rx="1.2" fill="currentColor" />)
      )}
    </svg>
  );
}
