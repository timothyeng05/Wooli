"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ACCOUNTS,
  APPS,
  BEEN,
  CATEGORIES,
  MOVIES,
  NEW_PLACE,
  POSTED,
  RECIPES,
  REVIEW,
  TRIPS,
  WANT,
  type AppId,
  type Category,
  type Kind,
  type Place,
  type Txn,
} from "./data";

// A Mac window in the browser: the app switcher top right, a sidebar for the
// apps with pages of their own (Trips, Budget), and the iPhone's screens laid
// out wider. Nothing saves; every change lives until the page reloads.

type TripPage = "overview" | "ideas" | "bookings" | `city:${string}`;
type BudgetPage = "dashboard" | "transactions" | "plan" | "accounts";

const money = (n: number, cents = false) =>
  (n < 0 ? "−" : "") +
  "$" +
  Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });

const KIND_ICON: Record<Kind, string> = { transit: "✈︎", stay: "⌂", meal: "🍽", activity: "★", note: "✎" };

export default function DemoApp() {
  const [app, setApp] = useState<AppId>("today");
  const [tripId, setTripId] = useState(TRIPS[0].id);
  const [tripPage, setTripPage] = useState<TripPage>("overview");
  const [budgetPage, setBudgetPage] = useState<BudgetPage>("dashboard");
  const [switcher, setSwitcher] = useState(false);
  const [palette, setPalette] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Budget state is shared by Today and Budget, so it lives here.
  const [review, setReview] = useState<Txn[]>(REVIEW);
  const [posted, setPosted] = useState<Txn[]>(POSTED);
  const [plans, setPlans] = useState<Record<string, number>>(() => Object.fromEntries(CATEGORIES.map((c) => [c.id, c.plan])));
  const [ranked, setRanked] = useState<Place[]>(BEEN);

  const spent = useMemo(() => {
    const extra: Record<string, number> = {};
    for (const t of posted) if (t.category && !POSTED.includes(t)) extra[t.category] = (extra[t.category] ?? 0) - t.amount;
    return Object.fromEntries(CATEGORIES.map((c) => [c.id, c.spent + (extra[c.id] ?? 0)]));
  }, [posted]);
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
  const trip = TRIPS.find((t) => t.id === tripId) ?? TRIPS[0];
  const title = APPS.find((a) => a.id === app)?.name ?? "Wooli";

  return (
    <div className="dm-window" role="application" aria-label="Wooli demo window">
      <div className="dm-titlebar">
        <div className="dm-lights" aria-hidden="true">
          <i /> <i /> <i />
        </div>
        {hasSidebar && (
          <button className="dm-tool" onClick={() => setSidebar((s) => !s)} aria-label={sidebar ? "Hide sidebar" : "Show sidebar"} title="Show or hide the sidebar">
            <SidebarGlyph />
          </button>
        )}
        <div className="dm-title">
          <Image src={`/apps/${app}.png`} alt="" width={20} height={20} />
          <span>{title}</span>
        </div>
        <div className="dm-tools">
          <button className="dm-search" onClick={() => setPalette(true)}>
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>
          <div className="dm-switch-wrap">
            <button className="dm-tool" aria-label="Switch apps" aria-expanded={switcher} onClick={() => setSwitcher((s) => !s)} title="Switch apps">
              <GridGlyph />
            </button>
            {switcher && (
              <div className="dm-switcher" role="menu">
                {APPS.map((a) => (
                  <button key={a.id} role="menuitem" className={a.id === app ? "is-on" : ""} onClick={() => go(a.id)}>
                    <span className="dm-switch-icon">
                      <Image src={`/apps/${a.id}.png`} alt="" width={52} height={52} />
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
              <TripsSidebar tripId={tripId} page={tripPage} onPick={(id, page) => { setTripId(id); setTripPage(page); }} onNew={() => say("New Trip… works in the app")} />
            ) : (
              <BudgetRail page={budgetPage} reviewCount={review.length} onPick={setBudgetPage} />
            )}
          </nav>
        )}
        <main className="dm-detail" onClick={() => setSwitcher(false)}>
          <div className="dm-scroll" key={`${app}-${tripId}-${tripPage}-${budgetPage}`}>
            {app === "today" && <TodayScreen left={left} reviewCount={review.length} rankedCount={ranked.length} go={go} openTrip={() => { setTripId("portugal"); setTripPage("overview"); go("trips"); }} />}
            {app === "trips" && <TripsScreen trip={trip} page={tripPage} setPage={setTripPage} say={say} />}
            {app === "eats" && <EatsScreen ranked={ranked} setRanked={setRanked} say={say} />}
            {app === "movies" && <MoviesScreen say={say} />}
            {app === "recipes" && <RecipesScreen say={say} />}
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
              />
            )}
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
            ...TRIPS.flatMap((t) => [
              { id: `trip-${t.id}`, title: t.name, sub: `Trip · ${t.dates}`, icon: "/apps/trips.png", action: () => { setTripId(t.id); setTripPage("overview"); go("trips"); } },
              ...t.cities.map((c) => ({ id: `city-${c.id}`, title: c.name, sub: `City in ${t.name}`, icon: "/apps/trips.png", action: () => { setTripId(t.id); setTripPage(`city:${c.id}`); go("trips"); } })),
            ]),
            ...(["dashboard", "transactions", "plan", "accounts"] as BudgetPage[]).map((p) => ({
              id: `budget-${p}`, title: p[0].toUpperCase() + p.slice(1), sub: "Budget", icon: "/apps/budget.png", action: () => { setBudgetPage(p); go("budget"); },
            })),
            ...RECIPES.map((r) => ({ id: `recipe-${r.id}`, title: r.name, sub: "Recipe", icon: "/apps/recipes.png", action: () => go("recipes") })),
          ]}
        />
      )}

      <div className={`dm-toast ${toast ? "is-on" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}

/* ---------- Chrome ---------- */

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
      {[0, 6, 12].flatMap((x) => [0, 6, 12].map((y) => <rect key={`${x}${y}`} x={x} y={y} width="4" height="4" rx="1.2" fill="currentColor" />))}
    </svg>
  );
}

function Palette({ entries, onClose, onPick }: { entries: { id: string; title: string; sub: string; icon: string; action: () => void }[]; onClose: () => void; onPick: (a: () => void) => void }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const shown = entries.filter((e) => `${e.title} ${e.sub}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <div className="dm-scrim" onClick={onClose}>
      <div className="dm-palette" role="dialog" aria-label="Search Wooli" onClick={(e) => e.stopPropagation()}>
        <input
          ref={input}
          value={q}
          placeholder="Search trips, cities, apps, pages…"
          onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setI((n) => Math.min(n + 1, shown.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setI((n) => Math.max(n - 1, 0)); }
            if (e.key === "Enter" && shown[i]) onPick(shown[i].action);
          }}
        />
        <ul>
          {shown.map((e, n) => (
            <li key={e.id}>
              <button className={n === i ? "is-on" : ""} onMouseEnter={() => setI(n)} onClick={() => onPick(e.action)}>
                <Image src={e.icon} alt="" width={24} height={24} />
                <b>{e.title}</b>
                <small>{e.sub}</small>
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="dm-empty">Nothing matches “{q}”.</li>}
        </ul>
      </div>
    </div>
  );
}

/* ---------- Shared bits ---------- */

function Head({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <header className="dm-head">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </header>
  );
}
function Plus({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button className="dm-plus" onClick={onClick} aria-label={label} title={label}>
      +
    </button>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <p className="dm-label">{children}</p>;
}
function Gauge({ value, max, warn }: { value: number; max: number; warn?: boolean }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <span className={`dm-gauge ${warn || pct >= 90 ? "is-warn" : ""}`}>
      <i style={{ width: `${pct}%` }} />
    </span>
  );
}

/* ---------- Today ---------- */

function Board({ rows }: { rows: { date: string; what: string; status: string }[] }) {
  return (
    <div className="dm-board">
      <div className="dm-board-head">
        <span>Next up</span>
        <span>Status</span>
      </div>
      {rows.map((r, n) => (
        <div className="dm-board-row" key={r.what}>
          <span className="dm-flaps">
            {r.date.split("").map((ch, i) => (
              <i key={i} style={{ animationDelay: `${n * 120 + i * 45}ms` }}>
                {ch === " " ? " " : ch}
              </i>
            ))}
          </span>
          <span className="dm-board-what">{r.what}</span>
          <span className="dm-board-status">{r.status}</span>
        </div>
      ))}
    </div>
  );
}

function TodayScreen({ left, reviewCount, rankedCount, go, openTrip }: { left: number; reviewCount: number; rankedCount: number; go: (a: AppId) => void; openTrip: () => void }) {
  return (
    <div className="dm-page">
      <Head title="Today" sub="Wednesday, October 28" />
      <div className="dm-today">
        <div className="dm-today-main">
          <Board
            rows={[
              { date: "TODAY ", what: "Spotify · $11.99", status: "DUE" },
              { date: "FRI 30", what: "Dinner · Lucali", status: "7 PM" },
              { date: "NOV 01", what: "Rent · $1,900", status: "AUTOPAY" },
              { date: "NOV 13", what: "Fly to Lisbon", status: "ON TIME" },
            ]}
          />
          <div className="dm-card dm-rows">
            <button className="dm-row" onClick={() => go("budget")}>
              <span className="dm-tile is-money">💳</span>
              <span className="dm-row-text">
                <b>{money(left)} left this month</b>
                <small>Budget · $214 under pace</small>
              </span>
              <span className="dm-chev">›</span>
            </button>
            <button className="dm-row" onClick={() => go("budget")}>
              <span className="dm-tile is-brand">✓</span>
              <span className="dm-row-text">
                <b>{reviewCount === 0 ? "All caught up" : `${reviewCount} to review`}</b>
                <small>{reviewCount === 0 ? "Nothing waiting in Budget" : "4 have a suggested category"}</small>
              </span>
              <span className="dm-chev">›</span>
            </button>
            <button className="dm-row" onClick={openTrip}>
              <span className="dm-tile is-travel">🧳</span>
              <span className="dm-row-text">
                <b>Lisbon & Porto in 16 days</b>
                <small>Trips · 2 cities · 3 bookings to check</small>
              </span>
              <span className="dm-chev">›</span>
            </button>
          </div>
        </div>
        <div className="dm-today-side">
          <div className="dm-card">
            <Label>Your stickers</Label>
            <div className="dm-stickers">
              <button className="dm-sticker is-food" onClick={() => go("eats")}>{rankedCount} places</button>
              <button className="dm-sticker is-brand" onClick={() => go("trips")}>8 cities</button>
              <button className="dm-sticker is-slate" onClick={() => go("budget")}>3 months on budget</button>
              <button className="dm-sticker is-rose" onClick={() => go("movies")}>{MOVIES.length} films</button>
            </div>
          </div>
          <div className="dm-card">
            <Label>Tonight</Label>
            <button className="dm-row" onClick={() => go("recipes")}>
              <span className="dm-tile is-food">🍝</span>
              <span className="dm-row-text">
                <b>Cacio e pepe</b>
                <small>Recipes · 20 min · 4 ingredients</small>
              </span>
              <span className="dm-chev">›</span>
            </button>
          </div>
          <div className="dm-card">
            <Label>Want to try nearby</Label>
            <button className="dm-row" onClick={() => go("eats")}>
              <span className="dm-tile is-food">🍜</span>
              <span className="dm-row-text">
                <b>Thai Diner</b>
                <small>Thai · Nolita · 0.6 mi</small>
              </span>
              <span className="dm-chev">›</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Trips ---------- */

function TripsSidebar({ tripId, page, onPick, onNew }: { tripId: string; page: TripPage; onPick: (id: string, p: TripPage) => void; onNew: () => void }) {
  return (
    <div className="dm-trips-side">
      <div className="dm-side-head">
        <span>Trips</span>
        <button onClick={onNew} aria-label="New trip">+</button>
      </div>
      {TRIPS.map((t) => {
        const open = t.id === tripId;
        return (
          <div key={t.id} className="dm-side-group">
            <button className={`dm-side-item is-trip ${open && page === "overview" ? "is-on" : ""}`} onClick={() => onPick(t.id, "overview")}>
              <span>🧳</span>
              <span className="dm-side-text">
                <b>{t.name}</b>
                <small>{t.dates}</small>
              </span>
            </button>
            {open && (
              <div className="dm-side-sub">
                {t.cities.map((c, n) => (
                  <button key={c.id} className={`dm-side-item ${page === `city:${c.id}` ? "is-on" : ""}`} onClick={() => onPick(t.id, `city:${c.id}`)}>
                    <span className="dm-num">{n + 1}</span>
                    <span>{c.name}</span>
                  </button>
                ))}
                <button className={`dm-side-item ${page === "ideas" ? "is-on" : ""}`} onClick={() => onPick(t.id, "ideas")}>
                  <span>💡</span>
                  <span>Ideas</span>
                </button>
                <button className={`dm-side-item ${page === "bookings" ? "is-on" : ""}`} onClick={() => onPick(t.id, "bookings")}>
                  <span>🎫</span>
                  <span>Bookings</span>
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TripMap({ trip, active, onPick }: { trip: (typeof TRIPS)[number]; active?: string; onPick: (id: string) => void }) {
  const pts = trip.cities.map((c) => `${c.x},${c.y}`).join(" ");
  return (
    <div className="dm-map">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path className="dm-land" d={trip.id === "portugal" ? "M30,0 L70,0 L72,30 L66,55 L70,80 L60,100 L28,100 L24,86 L32,70 L28,50 L34,30 Z" : "M10,30 C30,18 50,22 64,30 C80,38 92,36 100,44 L100,100 L0,100 L0,52 C10,60 24,70 34,72 C30,56 18,44 10,30 Z"} />
        <polyline className="dm-route" points={pts} />
      </svg>
      {trip.cities.map((c, n) => (
        <button key={c.id} className={`dm-pin ${active === c.id ? "is-on" : ""}`} style={{ left: `${c.x}%`, top: `${c.y}%` }} onClick={() => onPick(c.id)}>
          <b>{n + 1}</b>
          <span>{c.name}</span>
        </button>
      ))}
    </div>
  );
}

function Ticket({ trip }: { trip: (typeof TRIPS)[number] }) {
  return (
    <div className="dm-ticket">
      <div className="dm-ticket-ends">
        <div>
          <small>From</small>
          <b>{trip.from}</b>
          <span>{trip.fromCity}</span>
        </div>
        <div className="dm-ticket-plane" aria-hidden="true">
          <i /> <span>✈︎</span> <i />
        </div>
        <div className="is-right">
          <small>To</small>
          <b>{trip.to}</b>
          <span>{trip.toCity}</span>
        </div>
      </div>
      <p>
        {trip.dates} · {trip.countdown} · {trip.cities.length} cities
      </p>
      <div className="dm-ticket-flight">
        <span className="dm-ticket-badge">✈︎</span>
        <b>{trip.flight}</b>
        <span>{trip.times}</span>
      </div>
    </div>
  );
}

function PlanRow({ p, onClick }: { p: { time: string; kind: Kind; title: string; sub: string }; onClick?: () => void }) {
  return (
    <button className="dm-plan" onClick={onClick}>
      <span className="dm-plan-time">{p.time}</span>
      <span className={`dm-plan-dot is-${p.kind}`}>{KIND_ICON[p.kind]}</span>
      <span className="dm-row-text">
        <b>{p.title}</b>
        <small>{p.sub}</small>
      </span>
    </button>
  );
}

function TripsScreen({ trip, page, setPage, say }: { trip: (typeof TRIPS)[number]; page: TripPage; setPage: (p: TripPage) => void; say: (s: string) => void }) {
  if (page.startsWith("city:")) {
    const city = trip.cities.find((c) => `city:${c.id}` === page) ?? trip.cities[0];
    const n = trip.cities.indexOf(city) + 1;
    return (
      <div className="dm-page">
        <Head title={city.name} sub={`${city.dates} · ${city.nights} nights · ${city.days.reduce((a, d) => a + d.plans.length, 0)} plans`} action={<Plus label="Add a plan" onClick={() => say("Adding plans works in the app")} />} />
        <div className="dm-split">
          <div className="dm-days">
            {city.days.map((d) => (
              <section key={d.label} className="dm-card">
                <Label>{d.label}</Label>
                {d.plans.map((p) => (
                  <PlanRow key={p.title} p={p} onClick={() => say(`${p.title}: open in Maps, edit, or move to another day`)} />
                ))}
                <button className="dm-plan is-add" onClick={() => say("Adding plans works in the app")}>
                  <span className="dm-plan-time" />
                  <span className="dm-plan-dot is-add">+</span>
                  <span className="dm-row-text">
                    <b>Add to this day</b>
                  </span>
                </button>
              </section>
            ))}
          </div>
          <div className="dm-sticky">
            <TripMap trip={trip} active={city.id} onPick={(id) => setPage(`city:${id}`)} />
            <p className="dm-caption">
              Stop {n} of {trip.cities.length}. Pick a pin to jump between cities.
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (page === "ideas") {
    return (
      <div className="dm-page">
        <Head title="Ideas" sub={`Saved for ${trip.name}, not yet on a day`} />
        <div className="dm-grid2">
          {trip.ideas.map((i) => (
            <div key={i.title} className="dm-card dm-idea">
              <span className={`dm-plan-dot is-${i.kind}`}>{KIND_ICON[i.kind]}</span>
              <span className="dm-row-text">
                <b>{i.title}</b>
                <small>{i.sub}</small>
              </span>
              <button className="dm-btn is-soft" onClick={() => say(`${i.title} added to a day`)}>Add to a day</button>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (page === "bookings") {
    return (
      <div className="dm-page">
        <Head title="Bookings" sub="Flights, trains and stays, pulled from your confirmation emails" action={<button className="dm-btn" onClick={() => say("Import works in the app: paste or drop a confirmation")}>Import…</button>} />
        <div className="dm-card dm-table-wrap">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Booking</th>
                <th>When</th>
                <th>Reference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {trip.bookings.map((b) => (
                <tr key={b.what}>
                  <td>
                    <span className={`dm-plan-dot is-${b.kind} is-small`}>{KIND_ICON[b.kind]}</span> {b.what}
                  </td>
                  <td>{b.when}</td>
                  <td className="dm-mono">{b.ref}</td>
                  <td>
                    <span className={`dm-pill is-${b.status.toLowerCase()}`}>{b.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  return (
    <div className="dm-page">
      <Head
        title={trip.name}
        sub={`${trip.dates} · ${trip.people.length > 1 ? "planning with Maya" : "just you"}`}
        action={
          <div className="dm-people">
            {trip.people.map((p) => (
              <span key={p} className="dm-avatar">{p}</span>
            ))}
            <button className="dm-btn is-soft" onClick={() => say("Invites work in the app, through iCloud sharing")}>Invite</button>
          </div>
        }
      />
      <div className="dm-split">
        <div className="dm-days">
          <Ticket trip={trip} />
          {trip.cities.map((c, n) => (
            <section key={c.id} className="dm-city">
              <button className="dm-city-head" onClick={() => setPage(`city:${c.id}`)}>
                <span className="dm-city-num">{n + 1}</span>
                <span className="dm-row-text">
                  <b>{c.name}</b>
                  <small>
                    {c.dates} · {c.nights} nights · {c.days.reduce((a, d) => a + d.plans.length, 0)} plans
                  </small>
                </span>
                <span className="dm-chev">›</span>
              </button>
              <div className="dm-card">
                {c.days[0].plans.slice(0, 3).map((p) => (
                  <PlanRow key={p.title} p={p} onClick={() => setPage(`city:${c.id}`)} />
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="dm-sticky">
          <TripMap trip={trip} onPick={(id) => setPage(`city:${id}`)} />
          <div className="dm-card dm-row is-static">
            <span className="dm-tile is-food">🍽</span>
            <span className="dm-row-text">
              <b>3 to try in {trip.cities[0].name}</b>
              <small>From your Eats list</small>
            </span>
            <span className="dm-pill is-pending">Want to try</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Eats ---------- */

function Stamp({ n, big }: { n: number; big?: boolean }) {
  return <span className={`dm-stamp ${big ? "is-big" : ""}`}>{big ? <><small>Loved</small>#{n}<small>Brooklyn</small></> : n}</span>;
}

function EatsScreen({ ranked, setRanked, say }: { ranked: Place[]; setRanked: (p: Place[]) => void; say: (s: string) => void }) {
  const [tab, setTab] = useState<"been" | "want">("been");
  const [sel, setSel] = useState<string>(ranked[2]?.id ?? ranked[0].id);
  const placed = ranked.some((p) => p.id === NEW_PLACE.id);
  const [range, setRange] = useState<[number, number]>([0, ranked.length]);
  const [step, setStep] = useState(1);
  const mid = Math.floor((range[0] + range[1]) / 2);
  const ranking = !placed && range[0] < range[1];
  const place = ranked.find((p) => p.id === sel) ?? ranked[0];
  const rank = ranked.indexOf(place) + 1;

  const choose = (newIsBetter: boolean) => {
    const next: [number, number] = newIsBetter ? [range[0], mid] : [mid + 1, range[1]];
    if (next[0] >= next[1]) {
      const list = [...ranked];
      list.splice(next[0], 0, NEW_PLACE);
      setRanked(list);
      setSel(NEW_PLACE.id);
      say(`${NEW_PLACE.name} placed at #${next[0] + 1}`);
    }
    setRange(next);
    setStep((s) => s + 1);
  };

  return (
    <div className="dm-page">
      <Head title="Eats" action={<Plus label="Add a place" onClick={() => say("Search Apple Maps for a place in the app")} />} />
      <div className="dm-split is-eats">
        <div className="dm-days">
          <div className="dm-passport">
            <small>Your passport</small>
            <b>{ranked.length} places</b>
            <span>8 cities · {WANT.length} want to try · last stamp Oct 24</span>
            <div className="dm-passport-stamps">
              {[3, 7, 18, 22].map((n) => (
                <i key={n}>{n}</i>
              ))}
            </div>
          </div>
          <div className="dm-segment" role="tablist">
            <button role="tab" aria-selected={tab === "been"} className={tab === "been" ? "is-on" : ""} onClick={() => setTab("been")}>Been</button>
            <button role="tab" aria-selected={tab === "want"} className={tab === "want" ? "is-on" : ""} onClick={() => setTab("want")}>Want to try</button>
          </div>
          {tab === "been" ? (
            <div className="dm-card dm-rows">
              {ranked.map((p, n) => (
                <button key={p.id} className={`dm-row ${p.id === sel ? "is-sel" : ""} ${p.id === NEW_PLACE.id ? "is-new" : ""}`} onClick={() => setSel(p.id)}>
                  <Stamp n={n + 1} />
                  <span className="dm-row-text">
                    <b>{p.name}</b>
                    <small>
                      {p.cuisine} · {p.area}
                    </small>
                  </span>
                  <span className="dm-chev">›</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="dm-card dm-rows">
              {WANT.map((w) => (
                <div key={w.name} className="dm-row is-static">
                  <span className="dm-tile is-food">📍</span>
                  <span className="dm-row-text">
                    <b>{w.name}</b>
                    <small>
                      {w.cuisine} · {w.area} · {w.from}
                    </small>
                  </span>
                  <button className="dm-btn is-soft is-small" onClick={() => say(`Log a visit to ${w.name}, then rank it`)}>Been</button>
                </div>
              ))}
            </div>
          )}
          {ranking && (
            <div className="dm-card dm-versus">
              <Label>Which was better?</Label>
              <div className="dm-versus-pair">
                <button className="dm-versus-card is-new" onClick={() => choose(true)}>
                  <b>{NEW_PLACE.name}</b>
                  <small>
                    {NEW_PLACE.cuisine} · {NEW_PLACE.area}
                  </small>
                </button>
                <span>or</span>
                <button className="dm-versus-card" onClick={() => choose(false)}>
                  <b>{ranked[mid].name}</b>
                  <small>
                    {ranked[mid].cuisine} · {ranked[mid].area}
                  </small>
                </button>
              </div>
              <p className="dm-caption">Step {step} of about {Math.ceil(Math.log2(ranked.length + 1))} · placing {NEW_PLACE.name} on your list</p>
            </div>
          )}
        </div>
        <div className="dm-sticky">
          <div className="dm-place">
            <div className="dm-place-head">
              <div>
                <h3>{place.name}</h3>
                <p>
                  {place.cuisine} · {place.area} · {place.price}
                </p>
              </div>
              <Stamp n={rank} big />
            </div>
            <div className="dm-place-actions">
              <button className="dm-btn" onClick={() => say(`Visit logged at ${place.name}`)}>+ Log a visit</button>
              <button className="dm-btn is-soft" onClick={() => say("Opens Apple Maps in the app")}>Directions</button>
            </div>
            <div className="dm-card dm-note">
              <Label>Your notes · {place.visits[0].date}</Label>
              <p>{place.note}</p>
              <span className="dm-postage" aria-hidden="true">{place.emoji}</span>
            </div>
            <div className="dm-card dm-rows">
              {place.visits.map((v) => (
                <div key={v.date} className="dm-row is-static">
                  <span className="dm-avatar">{v.who.includes("Maya") ? "MJ" : v.who.includes("Sam") ? "SK" : v.who.includes("Mom") ? "MO" : "TE"}</span>
                  <span className="dm-row-text">
                    <b>
                      {v.date} · {v.who}
                    </b>
                    <small>{v.ate}</small>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Movies ---------- */

function MoviesScreen({ say }: { say: (s: string) => void }) {
  const genres = ["All", ...Array.from(new Set(MOVIES.map((m) => m.genre)))];
  const [genre, setGenre] = useState("All");
  const shown = MOVIES.map((m, i) => ({ ...m, rank: i + 1 })).filter((m) => genre === "All" || m.genre === genre);
  return (
    <div className="dm-page">
      <Head title="Movies" sub={`${MOVIES.length} films ranked · 4 loved`} action={<Plus label="Add a film" onClick={() => say("Search any film in the app, then say how you felt")} />} />
      <div className="dm-chips" role="group" aria-label="Filter by genre">
        {genres.map((g) => (
          <button key={g} className={g === genre ? "is-on" : ""} aria-pressed={g === genre} onClick={() => setGenre(g)}>
            {g}
          </button>
        ))}
      </div>
      <div className="dm-stubs">
        {shown.map((m) => (
          <button key={m.title} className={`dm-stub is-${m.feel.toLowerCase()}`} onClick={() => say(`${m.title} · ${m.director}`)}>
            <span className="dm-stub-rank">#{m.rank}</span>
            <span className="dm-stub-body">
              <small>Admit one · {m.seen}</small>
              <b>{m.title}</b>
              <span>
                {m.year} · {m.genre} · {m.director}
              </span>
            </span>
            <span className="dm-stub-feel">{m.feel}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Recipes ---------- */

function RecipesScreen({ say }: { say: (s: string) => void }) {
  const [meal, setMeal] = useState("All");
  const [open, setOpen] = useState<string | null>(null);
  const [have, setHave] = useState<Record<string, boolean>>({});
  const [cooking, setCooking] = useState<number | null>(null);
  const meals = ["All", "Breakfast", "Lunch", "Dinner"];
  const shown = RECIPES.filter((r) => meal === "All" || r.meal === meal);
  const recipe = RECIPES.find((r) => r.id === open);

  if (recipe) {
    return (
      <div className="dm-page">
        <button className="dm-back" onClick={() => { setOpen(null); setCooking(null); }}>‹ Recipes</button>
        <Head title={recipe.name} sub={`${recipe.meal} · ${recipe.mins} min · ${recipe.ingredients.length} ingredients`} action={<button className="dm-btn is-soft" onClick={() => say("Share sends the recipe card")}>Share</button>} />
        <div className="dm-split">
          <div className="dm-days">
            <button className="dm-btn is-wide" onClick={() => setCooking(cooking === null ? 0 : null)}>{cooking === null ? "Start cooking" : "Stop cooking"}</button>
            {cooking !== null ? (
              <div className="dm-card dm-cook">
                <Label>
                  Step {cooking + 1} of {recipe.steps.length}
                </Label>
                <p>{recipe.steps[cooking]}</p>
                <div className="dm-place-actions">
                  <button className="dm-btn is-soft" disabled={cooking === 0} onClick={() => setCooking(cooking - 1)}>Back</button>
                  {cooking < recipe.steps.length - 1 ? (
                    <button className="dm-btn" onClick={() => setCooking(cooking + 1)}>Next step</button>
                  ) : (
                    <button className="dm-btn" onClick={() => { setCooking(null); say("Enjoy! Marked as cooked."); }}>Done</button>
                  )}
                </div>
              </div>
            ) : (
              <div className="dm-card">
                <Label>Steps</Label>
                <ol className="dm-steps">
                  {recipe.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
          <div className="dm-sticky">
            <div className="dm-card dm-note">
              <Label>{recipe.from}</Label>
              <p>Pulled from a shared reel: ingredients and steps, tagged by meal and time.</p>
              <span className="dm-postage" aria-hidden="true">{recipe.emoji}</span>
            </div>
            <div className="dm-card dm-rows">
              {recipe.ingredients.map((i) => {
                const key = `${recipe.id}-${i.name}`;
                return (
                  <label key={key} className={`dm-row dm-check ${have[key] ? "is-done" : ""}`}>
                    <input type="checkbox" checked={!!have[key]} onChange={() => setHave((h) => ({ ...h, [key]: !h[key] }))} />
                    <span className="dm-row-text">
                      <b>{i.name}</b>
                      <small>{i.amount}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dm-page">
      <Head title="Recipes" sub="Share a recipe reel to Wooli and it splits it into ingredients and steps" action={<Plus label="Add a recipe" onClick={() => say("Share a reel from Instagram or TikTok in the app")} />} />
      <div className="dm-chips" role="group" aria-label="Filter by meal">
        {meals.map((m) => (
          <button key={m} className={m === meal ? "is-on" : ""} aria-pressed={m === meal} onClick={() => setMeal(m)}>
            {m}
          </button>
        ))}
      </div>
      <div className="dm-recipes">
        {shown.map((r) => (
          <button key={r.id} className="dm-recipe" onClick={() => setOpen(r.id)}>
            <span className="dm-recipe-art">{r.emoji}</span>
            <b>{r.name}</b>
            <small>
              {r.meal} · {r.mins} min
            </small>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Budget ---------- */

const BUDGET_PAGES: { id: BudgetPage; name: string; icon: string }[] = [
  { id: "dashboard", name: "Dashboard", icon: "📊" },
  { id: "transactions", name: "Activity", icon: "🧾" },
  { id: "plan", name: "Plan", icon: "🗂️" },
  { id: "accounts", name: "Accounts", icon: "🏦" },
];

function BudgetRail({ page, reviewCount, onPick }: { page: BudgetPage; reviewCount: number; onPick: (p: BudgetPage) => void }) {
  return (
    <div className="dm-rail">
      {BUDGET_PAGES.map((p) => (
        <button key={p.id} className={page === p.id ? "is-on" : ""} onClick={() => onPick(p.id)} title={p.name}>
          <span className="dm-rail-icon">
            {p.icon}
            {p.id === "dashboard" && reviewCount > 0 && <b className="dm-dot">{reviewCount}</b>}
          </span>
          <small>{p.name}</small>
        </button>
      ))}
    </div>
  );
}

function PaceCurve({ left }: { left: number }) {
  return (
    <svg className="dm-pace" viewBox="0 0 300 70" aria-hidden="true">
      <path d="M8,52 C60,10 110,10 160,36 S 200,52 200,52" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M200,52 C230,40 260,28 292,20" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2.5" strokeDasharray="5 6" />
      <circle cx="8" cy="52" r="5" fill="currentColor" />
      <circle cx="292" cy="20" r="4" fill="currentColor" fillOpacity="0.6" />
      <g transform="translate(200,52)">
        <path d="M0,-4 C-9,-14 -9,-26 0,-28 C9,-26 9,-14 0,-4 Z" className="dm-pace-pin" transform="translate(0,-2)" />
        <circle cy="-21" r="3.5" className="dm-pace-pin-dot" />
      </g>
      <title>{money(left)} left</title>
    </svg>
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
}) {
  const { page, review, posted, categorize, plans, setPlans, spent, left, totalPlan } = props;
  const [picking, setPicking] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const catName = (id?: string) => (id === "income" ? "Income" : CATEGORIES.find((c) => c.id === id)?.name ?? "Uncategorized");

  if (page === "transactions") {
    const all = [...review, ...posted].filter((t) => t.payee.toLowerCase().includes(q.toLowerCase()));
    return (
      <div className="dm-page">
        <Head title="Activity" sub="October · synced from 4 accounts" action={<input className="dm-input" placeholder="Search payees" value={q} onChange={(e) => setQ(e.target.value)} />} />
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
                  <td>{t.category ? catName(t.category) : <span className="dm-pill is-pending">Needs review</span>}</td>
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

  if (page === "plan") {
    return (
      <div className="dm-page">
        <Head title="Plan" sub={`October · ${money(totalPlan)} planned · drag a slider to change a category`} />
        <div className="dm-grid2">
          {CATEGORIES.map((c) => (
            <div key={c.id} className={`dm-card dm-cat is-${c.group}`}>
              <div className="dm-cat-top">
                <span className={`dm-tile is-${c.group}`}>{c.emoji}</span>
                <span className="dm-row-text">
                  <b>{c.name}</b>
                  <small>
                    {money(spent[c.id])} of {money(plans[c.id])}
                  </small>
                </span>
                <b className={plans[c.id] - spent[c.id] < 0 ? "is-over" : ""}>{money(plans[c.id] - spent[c.id])} left</b>
              </div>
              <Gauge value={spent[c.id]} max={plans[c.id]} />
              <input
                type="range"
                min={Math.round(c.plan * 0.5)}
                max={Math.round(c.plan * 1.6)}
                step={c.plan > 500 ? 50 : 10}
                value={plans[c.id]}
                aria-label={`${c.name} plan`}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setPlans((p) => ({ ...p, [c.id]: v }));
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (page === "accounts") {
    const net = ACCOUNTS.reduce((a, b) => a + b.balance, 0);
    return (
      <div className="dm-page">
        <Head title="Accounts" sub={`Net worth ${money(net)} · synced 12 minutes ago through SimpleFIN`} />
        <div className="dm-card dm-rows">
          {ACCOUNTS.map((a) => (
            <div key={a.name} className="dm-row is-static">
              <Image className="dm-logo" src={a.logo} alt="" width={36} height={36} />
              <span className="dm-row-text">
                <b>{a.name}</b>
                <small>{a.kind}</small>
              </span>
              <b className={a.balance < 0 ? "is-expense" : ""}>{money(a.balance, true)}</b>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dm-page">
      <Head title="October" />
      <div className="dm-dash">
        <div className="dm-days">
          <div className="dm-hero">
            <small>Left to spend</small>
            <b>{money(left)}</b>
            <PaceCurve left={left} />
            <div className="dm-hero-foot">
              <span>Oct 1</span>
              <span>Day 28 · $214 under pace</span>
              <span>Oct 31</span>
            </div>
          </div>
          <div className={`dm-review-head ${review.length === 0 ? "is-done" : ""}`}>
            <span className="dm-city-num">{review.length === 0 ? "✓" : review.length}</span>
            <span className="dm-row-text">
              <b>{review.length === 0 ? "All reviewed" : "Needs review"}</b>
              <small>{review.length === 0 ? "Every transaction has a category" : `${review.filter((r) => r.suggestion).length} have a suggested category`}</small>
            </span>
          </div>
          {review.length > 0 && (
            <div className="dm-card dm-rows">
              {review.map((t) => {
                const sug = CATEGORIES.find((c) => c.id === t.suggestion);
                return (
                  <div key={t.id} className="dm-row is-static dm-txn">
                    <span className={`dm-tile ${sug ? `is-${sug.group}` : ""}`}>{sug?.emoji ?? "?"}</span>
                    <span className="dm-row-text">
                      <b>{t.payee}</b>
                      <small>
                        {sug ? `✦ ${sug.name}?` : "Uncategorized"} · {t.account}
                      </small>
                    </span>
                    <b className="dm-amt">{money(t.amount, true)}</b>
                    <span className="dm-txn-actions">
                      {sug && (
                        <button className="dm-btn is-small" onClick={() => categorize(t.id, sug.id)}>
                          ✓ {sug.name}
                        </button>
                      )}
                      <button className="dm-btn is-soft is-small" onClick={() => setPicking(picking === t.id ? null : t.id)}>
                        {sug ? "Change" : "Pick category"}
                      </button>
                    </span>
                    {picking === t.id && (
                      <div className="dm-picker">
                        {CATEGORIES.map((c) => (
                          <button key={c.id} onClick={() => { categorize(t.id, c.id); setPicking(null); }}>
                            <span>{c.emoji}</span> {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="dm-days">
          <Label>Categories</Label>
          {CATEGORIES.filter((c) => c.id !== "rent").map((c: Category) => (
            <div key={c.id} className="dm-card dm-cat">
              <div className="dm-cat-top">
                <span className={`dm-tile is-${c.group}`}>{c.emoji}</span>
                <span className="dm-row-text">
                  <b>{c.name}</b>
                  <small>
                    {money(spent[c.id])} of {money(plans[c.id])} · last month {money(c.last)}
                  </small>
                </span>
                <b className={plans[c.id] - spent[c.id] < 0 ? "is-over" : ""}>{money(plans[c.id] - spent[c.id])} left</b>
              </div>
              <Gauge value={spent[c.id]} max={plans[c.id]} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
