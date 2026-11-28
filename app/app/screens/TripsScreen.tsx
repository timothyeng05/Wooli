"use client";

import { useMemo, useState } from "react";
import type {
  TripItemKind,
  TripItemRecord,
  TripLeg,
  TripRecord,
} from "@/lib/cloudkit/schema";
import { Badge, Card, ListMapSplit, Pill, type BadgeTone } from "@/app/components/ds";

export type TripPage = "overview" | "ideas" | `city:${string}`;

export interface TripsScreenProps {
  trips: TripRecord[];
  tripItems: TripItemRecord[];
  selectedTripId: string | null;
  page: TripPage;
  onSelectTrip: (tripId: string | null, page?: TripPage) => void;
}

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDayUTC(day: string): Date | null {
  const parts = day.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

function diffDays(startDay: string, endDay: string): number {
  const a = parseDayUTC(startDay);
  const b = parseDayUTC(endDay);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function enumerateDays(startDay: string, endDay: string): string[] {
  const start = parseDayUTC(startDay);
  const end = parseDayUTC(endDay);
  if (!start || !end || end < start) return startDay ? [startDay] : [];
  const days: string[] = [];
  const cursor = new Date(start.getTime());
  for (let i = 0; i < 120 && cursor <= end; i++) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cursor.getUTCDate()).padStart(2, "0");
    days.push(`${y}-${m}-${d}`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function formatDayShort(day?: string): string {
  if (!day) return "TBD";
  const dt = parseDayUTC(day);
  if (!dt) return day;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function formatDayWithWeekday(day?: string): string {
  if (!day) return "TBD";
  const dt = parseDayUTC(day);
  if (!dt) return day;
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function formatDateRange(startDay?: string, endDay?: string): string {
  if (!startDay && !endDay) return "Dates TBD";
  if (startDay && (!endDay || startDay === endDay)) {
    const dt = parseDayUTC(startDay);
    return dt
      ? dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
      : startDay;
  }
  const s = parseDayUTC(startDay ?? "");
  const e = parseDayUTC(endDay ?? "");
  if (!s || !e) return `${startDay ?? ""} – ${endDay ?? ""}`;
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  const startStr = s.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
  const endStr = e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${startStr} – ${endStr}`;
}

function formatClock(minutes?: number): string {
  if (typeof minutes !== "number" || Number.isNaN(minutes)) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
}

const KIND_META: Record<TripItemKind, { label: string; icon: string; colorVar: string }> = {
  transit: { label: "Travel", icon: "✈️", colorVar: "var(--kind-transit)" },
  stay: { label: "Stay", icon: "🏨", colorVar: "var(--kind-stay)" },
  meal: { label: "Meal", icon: "🍽️", colorVar: "var(--kind-meal)" },
  activity: { label: "Activity", icon: "📍", colorVar: "var(--kind-activity)" },
  note: { label: "Note", icon: "📝", colorVar: "var(--kind-note)" },
};

function sortLegs(legs: TripLeg[]): TripLeg[] {
  return [...legs].filter((l) => !l.isHome).sort((a, b) => a.startDay.localeCompare(b.startDay));
}

function sortTripItems(items: TripItemRecord[]): TripItemRecord[] {
  return [...items].sort(
    (a, b) =>
      (a.day ?? "9999-99-99").localeCompare(b.day ?? "9999-99-99") ||
      (a.time ?? 9999) - (b.time ?? 9999) ||
      (a.order ?? 9999) - (b.order ?? 9999) ||
      a.createdAt - b.createdAt,
  );
}

function heroEyebrow(trip: TripRecord, today: string): string {
  if (!trip.startDay) return "Upcoming trip";
  if (trip.startDay <= today && (!trip.endDay || trip.endDay >= today)) return "On your trip";
  const days = diffDays(today, trip.startDay);
  if (days === 0) return "Next trip · today";
  if (days === 1) return "Next trip · tomorrow";
  if (days > 1) return `Next trip · in ${days} days`;
  return "Trip";
}

function formatCostTotals(totals: Record<string, number>, points: Record<string, number>): string {
  const parts: string[] = [];
  for (const [currency, amount] of Object.entries(totals)) {
    if (amount > 0) parts.push(formatMoney(amount, currency));
  }
  for (const [program, pts] of Object.entries(points)) {
    if (pts > 0) parts.push(`${pts.toLocaleString("en-US")} pts${program ? ` ${program}` : ""}`);
  }
  return parts.join(" + ") || "—";
}

function stayLabelOnDay(item: TripItemRecord, day: string): string | null {
  if (item.kind !== "stay") return null;
  if (item.day === day) return "Check in";
  if (item.checkOutDay === day) return "Check out";
  return null;
}

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: "var(--weight-semibold)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-tertiary)",
  margin: 0,
};

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

export function TripsScreen({ trips, tripItems, selectedTripId, page, onSelectTrip }: TripsScreenProps) {
  const [search, setSearch] = useState("");
  const today = useMemo(() => todayKey(), []);
  const visibleTripItems = useMemo(() => tripItems.filter((i) => !i.isHiddenPlaceholder), [tripItems]);

  const selectedTrip = useMemo(
    () => (selectedTripId ? trips.find((t) => t.id === selectedTripId) ?? null : null),
    [trips, selectedTripId],
  );

  if (!selectedTrip) {
    return (
      <TripsGalleryView
        trips={trips}
        tripItems={visibleTripItems}
        today={today}
        onOpenTrip={(id) => onSelectTrip(id, "overview")}
      />
    );
  }

  return (
    <SingleTripView
      trip={selectedTrip}
      allItems={visibleTripItems.filter((i) => i.tripID === selectedTrip.id)}
      page={page}
      today={today}
      search={search}
      onSearchChange={setSearch}
      onSelectTrip={onSelectTrip}
    />
  );
}

export default TripsScreen;

/* -------------------------------------------------------------------------- */
/* 1. All Trips Gallery View                                                  */
/* -------------------------------------------------------------------------- */

function TripsGalleryView({
  trips,
  tripItems,
  today,
  onOpenTrip,
}: {
  trips: TripRecord[];
  tripItems: TripItemRecord[];
  today: string;
  onOpenTrip: (tripId: string) => void;
}) {
  const { upcoming, past } = useMemo(() => {
    const up = trips
      .filter((t) => !t.endDay || t.endDay >= today)
      .sort((a, b) => (a.startDay || "9999").localeCompare(b.startDay || "9999"));
    const pa = trips
      .filter((t) => Boolean(t.endDay) && t.endDay < today)
      .sort((a, b) => (b.startDay || "").localeCompare(a.startDay || ""));
    return { upcoming: up, past: pa };
  }, [trips, today]);

  const itemsByTrip = useMemo(() => {
    const map = new Map<string, TripItemRecord[]>();
    for (const item of tripItems) {
      const list = map.get(item.tripID) ?? [];
      list.push(item);
      map.set(item.tripID, list);
    }
    return map;
  }, [tripItems]);

  if (trips.length === 0) {
    return (
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "var(--space-48) var(--space-16)" }}>
        <Card padding="lg" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: "var(--space-12)" }}>🧳</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, margin: "0 0 8px" }}>
            Plan your first trip
          </h2>
          <p style={{ margin: "0 auto", maxWidth: 420, color: "var(--ink-tertiary)", fontSize: 15 }}>
            Create a trip in Wooli on Mac or iPhone to see your itinerary, boarding passes, stays, and trip costs here.
          </p>
        </Card>
      </div>
    );
  }

  const nextTrip = upcoming[0] ?? null;
  const otherUpcoming = upcoming.slice(1);

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "var(--space-16) var(--space-16) var(--space-48)" }}>
      <header style={{ marginBottom: "var(--space-20)" }}>
        <p style={eyebrowStyle}>Read-only iCloud Trips</p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, margin: "4px 0 0" }}>
          All Trips
        </h1>
      </header>

      {nextTrip && (
        <NextTripTicketHero
          trip={nextTrip}
          items={itemsByTrip.get(nextTrip.id) ?? []}
          today={today}
          onClick={() => onOpenTrip(nextTrip.id)}
        />
      )}

      {otherUpcoming.length > 0 && (
        <section style={{ marginTop: "var(--space-24)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, margin: "0 0 var(--space-12)" }}>
            Upcoming
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "var(--space-16)" }}>
            {otherUpcoming.map((trip) => {
              const items = itemsByTrip.get(trip.id) ?? [];
              const legs = sortLegs(trip.legs);
              const nights = trip.startDay && trip.endDay ? Math.max(0, diffDays(trip.startDay, trip.endDay)) : 0;
              const plansCount = items.filter((i) => Boolean(i.day)).length;
              return (
                <Card
                  key={trip.id}
                  interactive
                  padding="md"
                  onClick={() => onOpenTrip(trip.id)}
                  style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 }}>
                        {trip.name || "Untitled trip"}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--ink-tertiary)", marginTop: 2 }}>
                        {formatDateRange(trip.startDay, trip.endDay)}
                        {nights > 0 ? ` · ${nights}n` : ""}
                      </div>
                    </div>
                    {trip.scope === "shared" && <Badge tone="travel">Shared</Badge>}
                  </div>
                  {(trip.destination || legs.length > 0) && (
                    <div style={{ fontSize: 13, color: "var(--brand)", fontWeight: "var(--weight-medium)" }}>
                      {legs.length > 0 ? legs.map((l) => `${l.emoji ? `${l.emoji} ` : ""}${l.name}`).join(" → ") : trip.destination}
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: "var(--space-8)",
                      borderTop: "1px solid var(--border-hairline)",
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      color: "var(--ink-tertiary)",
                    }}
                  >
                    <span>{plansCount} plans</span>
                    <span>{legs.length > 0 ? `${legs.length} stops` : "Single stop"}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* 2-col 16:9 Past Trips cards with bottom scrims */}
      {past.length > 0 && (
        <section style={{ marginTop: "var(--space-32)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, margin: "0 0 var(--space-12)" }}>
            Past Trips
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "var(--space-16)" }}>
            {past.map((trip, i) => {
              const legs = sortLegs(trip.legs);
              const items = itemsByTrip.get(trip.id) ?? [];
              const plansCount = items.filter((it) => Boolean(it.day)).length;
              const palette = [
                "linear-gradient(135deg, #1e3a2f 0%, #2b4c3f 100%)",
                "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
                "linear-gradient(135deg, #3b2f2f 0%, #6b4f3b 100%)",
              ][i % 3];
              return (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => onOpenTrip(trip.id)}
                  style={{
                    position: "relative",
                    aspectRatio: "16 / 9",
                    borderRadius: "var(--radius-card)",
                    overflow: "hidden",
                    border: "1px solid var(--border-hairline)",
                    background: palette,
                    color: "#ffffff",
                    textAlign: "left",
                    padding: 0,
                    cursor: "pointer",
                    boxShadow: "var(--shadow-card)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(to top, rgba(14, 22, 18, 0.85) 0%, rgba(14, 22, 18, 0.15) 60%, transparent 100%)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      padding: "var(--space-20)",
                    }}
                  >
                    <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.85, marginBottom: 4 }}>
                      {formatDateRange(trip.startDay, trip.endDay)} · {plansCount} plans
                    </div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600 }}>
                      {trip.name || "Untitled trip"}
                    </div>
                    {(legs.length > 0 || trip.destination) && (
                      <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
                        {legs.length > 0 ? legs.map((l) => l.name).join(" → ") : trip.destination}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function NextTripTicketHero({
  trip,
  items,
  today,
  onClick,
}: {
  trip: TripRecord;
  items: TripItemRecord[];
  today: string;
  onClick: () => void;
}) {
  const legs = sortLegs(trip.legs);
  const cities = legs.map((l) => l.name).filter(Boolean);
  const nights = trip.startDay && trip.endDay ? Math.max(0, diffDays(trip.startDay, trip.endDay)) : 0;
  const scheduledCount = items.filter((i) => Boolean(i.day)).length;
  const routeText = cities.length > 0 ? cities.join(" → ") : trip.destination || "Destination TBD";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        border: "none",
        borderRadius: "var(--radius-card)",
        padding: "var(--space-24)",
        background: "linear-gradient(135deg, var(--ticket-start) 0%, var(--ticket-end) 100%)",
        color: "var(--on-ticket)",
        boxShadow: "var(--shadow-ticket)",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-12)" }}>
        <span style={{ fontSize: 11, fontWeight: "var(--weight-semibold)", letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--ticket-highlight)" }}>
          {heroEyebrow(trip, today)}
        </span>
        <span style={{ fontSize: 13, opacity: 0.9 }}>{formatDateRange(trip.startDay, trip.endDay)}</span>
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, marginBottom: 4 }}>
        {trip.name || "Untitled trip"}
      </div>
      <div style={{ fontSize: 15, opacity: 0.92, marginBottom: "var(--space-16)" }}>{routeText}</div>
      <div
        style={{
          borderTop: "1px dashed var(--ticket-rule)",
          paddingTop: "var(--space-12)",
          display: "flex",
          gap: "var(--space-20)",
          fontSize: 13,
          opacity: 0.9,
        }}
      >
        <span>{nights > 0 ? `${nights} nights` : "Dates TBD"}</span>
        <span>{legs.length > 0 ? `${legs.length} stops` : "Single destination"}</span>
        <span>{scheduledCount} scheduled plans</span>
      </div>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Single Trip View (List + Map Split)                                     */
/* -------------------------------------------------------------------------- */

function SingleTripView({
  trip,
  allItems,
  page,
  today,
  search,
  onSearchChange,
  onSelectTrip,
}: {
  trip: TripRecord;
  allItems: TripItemRecord[];
  page: TripPage;
  today: string;
  search: string;
  onSearchChange: (v: string) => void;
  onSelectTrip: (tripId: string | null, page?: TripPage) => void;
}) {
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const legs = useMemo(() => sortLegs(trip.legs), [trip.legs]);
  const sortedItems = useMemo(() => sortTripItems(allItems), [allItems]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedItems;
    return sortedItems.filter((item) =>
      [
        item.title,
        item.placeName,
        item.placeAddress,
        item.notes,
        item.kind,
        item.transport?.flightNumber,
        item.transport?.airline,
      ]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [sortedItems, search]);

  const tripDaySet = useMemo(() => new Set(enumerateDays(trip.startDay, trip.endDay)), [trip.startDay, trip.endDay]);
  const ideas = useMemo(
    () => filteredItems.filter((i) => !i.day || (tripDaySet.size > 0 && !tripDaySet.has(i.day))),
    [filteredItems, tripDaySet],
  );

  const activeLegId = page.startsWith("city:") ? page.slice(5) : null;
  const activeLeg = activeLegId ? legs.find((l) => l.id === activeLegId) ?? null : null;

  const mapItems = useMemo(() => {
    if (activeLeg) {
      const legDays = new Set(enumerateDays(activeLeg.startDay, activeLeg.endDay));
      return filteredItems.filter((i) => i.day && legDays.has(i.day));
    }
    return filteredItems.filter((i) => Boolean(i.day));
  }, [activeLeg, filteredItems]);

  const leftColumn = (
    <div>
      {/* Header & Search */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-12)",
          marginBottom: "var(--space-16)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-12)", flexWrap: "wrap" }}>
          <Pill size="sm" onClick={() => onSelectTrip(null)}>
            ← All Trips
          </Pill>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, margin: 0 }}>
                {trip.name || "Untitled trip"}
              </h1>
              {trip.scope === "shared" && <Badge tone="travel">Shared</Badge>}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-tertiary)" }}>
              {formatDateRange(trip.startDay, trip.endDay)}
              {trip.destination ? ` · ${trip.destination}` : ""}
            </div>
          </div>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search itinerary…"
          style={{
            border: "1px solid var(--border-hairline)",
            background: "var(--bg-card)",
            color: "var(--ink-primary)",
            borderRadius: "var(--radius-s)",
            padding: "7px 12px",
            fontSize: 13,
            minWidth: 200,
          }}
        />
      </div>

      {/* Subpage Pills */}
      <div style={{ display: "flex", gap: "var(--space-8)", flexWrap: "wrap", marginBottom: "var(--space-20)" }}>
        <Pill size="sm" active={page === "overview"} onClick={() => onSelectTrip(trip.id, "overview")}>
          Overview
        </Pill>
        {legs.map((leg, idx) => (
          <Pill
            key={leg.id}
            size="sm"
            active={page === `city:${leg.id}`}
            onClick={() => onSelectTrip(trip.id, `city:${leg.id}`)}
          >
            {leg.emoji && leg.emoji !== "📍" ? leg.emoji : `${idx + 1}.`} {leg.name || `City ${idx + 1}`}
          </Pill>
        ))}
        <Pill size="sm" active={page === "ideas"} count={ideas.length} onClick={() => onSelectTrip(trip.id, "ideas")}>
          Wishlists &amp; Ideas
        </Pill>
      </div>

      {page === "ideas" ? (
        <IdeasPageView ideas={ideas} search={search} />
      ) : activeLeg ? (
        <CityLegTimeline
          trip={trip}
          leg={activeLeg}
          items={mapItems}
          today={today}
          selectedPinId={selectedPinId}
          onSelectPin={setSelectedPinId}
        />
      ) : (
        <TripOverviewView
          trip={trip}
          legs={legs}
          items={filteredItems}
          today={today}
          selectedPinId={selectedPinId}
          onSelectPin={setSelectedPinId}
          onOpenLeg={(legId) => onSelectTrip(trip.id, `city:${legId}`)}
        />
      )}
    </div>
  );

  const mapColumn = (
    <TripSpatialMap
      legs={activeLeg ? [activeLeg] : legs}
      items={page === "ideas" ? ideas : mapItems}
      selectedId={selectedPinId}
      onSelect={setSelectedPinId}
    />
  );

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "var(--space-16) var(--space-16) var(--space-48)" }}>
      <ListMapSplit
        left={leftColumn}
        right={mapColumn}
        mapToggleLabel={{ show: "Show route map", hide: "Hide route map" }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2a. Trip Overview + Chronological Itinerary Timeline                       */
/* -------------------------------------------------------------------------- */

function TripOverviewView({
  trip,
  legs,
  items,
  today,
  selectedPinId,
  onSelectPin,
  onOpenLeg,
}: {
  trip: TripRecord;
  legs: TripLeg[];
  items: TripItemRecord[];
  today: string;
  selectedPinId: string | null;
  onSelectPin: (id: string | null) => void;
  onOpenLeg: (legId: string) => void;
}) {
  const days = useMemo(() => enumerateDays(trip.startDay, trip.endDay), [trip.startDay, trip.endDay]);
  const totals = useMemo(() => {
    const cur: Record<string, number> = {};
    const pts: Record<string, number> = {};
    for (const it of items) {
      if (typeof it.cost === "number" && it.cost > 0) {
        const c = it.currency || "USD";
        cur[c] = (cur[c] ?? 0) + it.cost;
      }
      if (typeof it.points === "number" && it.points > 0) {
        const p = it.pointsProgram || "Points";
        pts[p] = (pts[p] ?? 0) + it.points;
      }
    }
    return formatCostTotals(cur, pts);
  }, [items]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-20)" }}>
      {/* Departure Board Route & Cost Strip */}
      <Card
        padding="md"
        style={{
          background: "var(--board)",
          color: "var(--on-board)",
          borderColor: "transparent",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-12)" }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--board-muted)" }}>
              Route
            </div>
            <div style={{ fontSize: 15, fontWeight: "var(--weight-semibold)", marginTop: 2 }}>
              {legs.length > 0 ? legs.map((l) => l.name).join(" → ") : trip.destination || "TBD"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--board-muted)" }}>
              Duration
            </div>
            <div style={{ fontSize: 15, fontWeight: "var(--weight-semibold)", marginTop: 2 }}>
              {days.length > 0 ? `${days.length} days` : "TBD"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--board-muted)" }}>
              Tracked Cost
            </div>
            <div style={{ fontSize: 15, fontWeight: "var(--weight-semibold)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
              {totals}
            </div>
          </div>
        </div>
      </Card>

      {/* City Legs */}
      {legs.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "var(--space-12)" }}>
          {legs.map((leg, i) => (
            <Card key={leg.id} interactive padding="sm" onClick={() => onOpenLeg(leg.id)}>
              <div style={{ fontSize: 11, color: "var(--ink-tertiary)", fontWeight: "var(--weight-semibold)" }}>
                STOP {i + 1} · {formatDayShort(leg.startDay)} – {formatDayShort(leg.endDay)}
              </div>
              <div style={{ fontSize: 16, fontWeight: "var(--weight-semibold)", marginTop: 4 }}>
                {leg.emoji && leg.emoji !== "📍" ? `${leg.emoji} ` : ""}
                {leg.name}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Chronological Itinerary Timeline */}
      <ItineraryTimeline
        trip={trip}
        days={days}
        items={items}
        today={today}
        selectedPinId={selectedPinId}
        onSelectPin={onSelectPin}
      />
    </div>
  );
}

function CityLegTimeline({
  trip,
  leg,
  items,
  today,
  selectedPinId,
  onSelectPin,
}: {
  trip: TripRecord;
  leg: TripLeg;
  items: TripItemRecord[];
  today: string;
  selectedPinId: string | null;
  onSelectPin: (id: string | null) => void;
}) {
  const days = useMemo(() => enumerateDays(leg.startDay, leg.endDay), [leg.startDay, leg.endDay]);
  return (
    <ItineraryTimeline
      trip={trip}
      days={days}
      items={items}
      today={today}
      selectedPinId={selectedPinId}
      onSelectPin={onSelectPin}
    />
  );
}

function ItineraryTimeline({
  trip,
  days,
  items,
  today,
  selectedPinId,
  onSelectPin,
}: {
  trip: TripRecord;
  days: string[];
  items: TripItemRecord[];
  today: string;
  selectedPinId: string | null;
  onSelectPin: (id: string | null) => void;
}) {
  if (days.length === 0) {
    return (
      <Card>
        <p style={{ margin: 0, color: "var(--ink-tertiary)" }}>No scheduled days for this trip yet.</p>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-24)" }}>
      {days.map((day, dayIdx) => {
        const dayItems = items.filter((i) => i.day === day || i.checkOutDay === day);
        const dayTitle = trip.dayTitles[day];
        const isToday = day === today;
        return (
          <section key={day} style={{ borderTop: dayIdx > 0 ? "1px solid var(--border-hairline)" : "none", paddingTop: dayIdx > 0 ? "var(--space-20)" : 0 }}>
            {/* Day Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-12)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 }}>
                  {formatDayWithWeekday(day)}
                </span>
                {dayTitle && <span style={{ fontSize: 14, color: "var(--ink-tertiary)" }}>— {dayTitle}</span>}
              </div>
              {isToday && <Badge tone="brand">Today</Badge>}
            </div>

            {dayItems.length === 0 ? (
              <div
                style={{
                  padding: "var(--space-12) var(--space-16)",
                  borderRadius: "var(--radius-m)",
                  background: "var(--bg-paper-soft)",
                  fontSize: 13,
                  color: "var(--ink-tertiary)",
                }}
              >
                Open day — no scheduled items
              </div>
            ) : (
              /* Vertical Timeline Track beside soft #F4F0EA containers holding nested white booking cards */
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
                {dayItems.map((item) => {
                  const meta = KIND_META[item.kind];
                  const stayLabel = stayLabelOnDay(item, day);
                  const milestoneTitle = stayLabel ?? meta.label;
                  const status = item.extras?.status;
                  const statusTone: BadgeTone =
                    status === "booked" ? "income" : status === "planned" ? "travel" : status === "cancelled" ? "expense" : "neutral";
                  const selected = selectedPinId === item.id;

                  return (
                    <div key={`${item.id}-${day}`} style={{ display: "flex", gap: "var(--space-12)", alignItems: "stretch" }}>
                      {/* Circular Milestone Header + Vertical Track */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 32, flexShrink: 0 }}>
                        <span
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: "var(--radius-full)",
                            background: "var(--bg-card)",
                            border: `1.5px solid ${meta.colorVar}`,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 14,
                            flexShrink: 0,
                          }}
                          title={milestoneTitle}
                        >
                          {stayLabel === "Check out" ? "🗝️" : meta.icon}
                        </span>
                        <span style={{ flex: 1, width: 1.5, background: "var(--border-hairline)", marginTop: 4 }} />
                      </div>

                      {/* Soft #F4F0EA container holding nested white booking card */}
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          padding: "var(--space-8)",
                          borderRadius: "var(--radius-card)",
                          background: "var(--bg-paper-soft)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: "var(--weight-semibold)",
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: "var(--ink-tertiary)",
                            marginBottom: 6,
                            paddingLeft: 4,
                          }}
                        >
                          {milestoneTitle}
                          {typeof item.time === "number" ? ` · ${formatClock(item.time)}` : ""}
                        </div>
                        <Card
                          interactive
                          padding="sm"
                          onClick={() => onSelectPin(selected ? null : item.id)}
                          style={{ borderColor: selected ? "var(--brand)" : undefined }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: "var(--weight-semibold)", color: "var(--ink-primary)" }}>
                                {item.title || item.placeName || milestoneTitle}
                              </div>
                              {(item.placeName || item.placeAddress) && (
                                <div style={{ fontSize: 12.5, color: "var(--ink-tertiary)", marginTop: 2 }}>
                                  {[item.placeName, item.placeAddress].filter(Boolean).join(" · ")}
                                </div>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                              {status && <Badge tone={statusTone}>{status}</Badge>}
                              {typeof item.cost === "number" && item.cost > 0 && (
                                <Badge tone="neutral">{formatMoney(item.cost, item.currency)}</Badge>
                              )}
                            </div>
                          </div>
                          {item.transport && (
                            <div style={{ fontSize: 12.5, color: "var(--ink-secondary)", marginTop: 6 }}>
                              {[
                                item.transport.airline,
                                item.transport.flightNumber,
                                item.transport.fromAirport && item.transport.toAirport
                                  ? `${item.transport.fromAirport} → ${item.transport.toAirport}`
                                  : null,
                                item.transport.confirmation ? `Conf ${item.transport.confirmation}` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          )}
                          {item.notes && (
                            <div
                              style={{
                                marginTop: 8,
                                paddingTop: 8,
                                borderTop: "1px solid var(--border-hairline)",
                                fontSize: 12.5,
                                color: "var(--ink-secondary)",
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {item.notes}
                            </div>
                          )}
                        </Card>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2b. Airbnb Wishlists / Saves (Ideas)                                       */
/* -------------------------------------------------------------------------- */

function IdeasPageView({ ideas, search }: { ideas: TripItemRecord[]; search: string }) {
  if (ideas.length === 0) {
    return (
      <Card>
        <p style={{ margin: 0, color: "var(--ink-tertiary)" }}>
          {search ? "No saved ideas match your search." : "No unscheduled ideas or wishlist saves yet."}
        </p>
      </Card>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "var(--space-16)" }}>
      {ideas.map((item) => {
        const meta = KIND_META[item.kind];
        return (
          <Card key={item.id} padding="sm" style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
            <div
              style={{
                aspectRatio: "1 / 1",
                borderRadius: "var(--radius-s)",
                background: "var(--bg-paper-soft)",
                border: "1px solid var(--border-hairline)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "var(--space-16)",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: 32, marginBottom: 8 }}>{meta.icon}</span>
              <Badge tone="neutral">{meta.label}</Badge>
            </div>
            <div style={{ fontSize: 15, fontWeight: "var(--weight-semibold)" }}>{item.title || item.placeName}</div>
            {item.placeAddress && (
              <div style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>{item.placeAddress}</div>
            )}
            {item.notes && (
              <div
                style={{
                  marginTop: "auto",
                  padding: "6px 8px",
                  borderRadius: "var(--radius-xs)",
                  background: "var(--bg-paper-soft)",
                  fontSize: 12,
                  color: "var(--ink-secondary)",
                }}
              >
                {item.notes}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Trip Spatial Map (Floating pill pins + dashed flight/route polylines)   */
/* -------------------------------------------------------------------------- */

function TripSpatialMap({
  legs,
  items,
  selectedId,
  onSelect,
}: {
  legs: TripLeg[];
  items: TripItemRecord[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const geoLegs = useMemo(
    () => legs.filter((l) => typeof l.latitude === "number" && typeof l.longitude === "number"),
    [legs],
  );
  const geoItems = useMemo(
    () => items.filter((i) => typeof i.latitude === "number" && typeof i.longitude === "number"),
    [items],
  );

  const allCoords = useMemo(
    () => [
      ...geoLegs.map((l) => ({ lat: l.latitude!, lng: l.longitude! })),
      ...geoItems.map((i) => ({ lat: i.latitude!, lng: i.longitude! })),
    ],
    [geoLegs, geoItems],
  );

  const bounds = useMemo(() => {
    if (allCoords.length === 0) return null;
    const lats = allCoords.map((c) => c.lat);
    const lngs = allCoords.map((c) => c.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      minLat,
      minLng,
      latSpan: Math.max(0.02, maxLat - minLat),
      lngSpan: Math.max(0.02, maxLng - minLng),
    };
  }, [allCoords]);

  const toPct = (lat: number, lng: number) => {
    if (!bounds) return { x: 50, y: 50 };
    return {
      x: 12 + ((lng - bounds.minLng) / bounds.lngSpan) * 76,
      y: 86 - ((lat - bounds.minLat) / bounds.latSpan) * 72,
    };
  };

  const legRoutePts = geoLegs.map((l) => toPct(l.latitude!, l.longitude!));

  return (
    <Card padding="none" style={{ height: 540, overflow: "hidden", background: "var(--bg-paper-soft)" }}>
      <div
        style={{
          padding: "var(--space-12) var(--space-16)",
          borderBottom: "1px solid var(--border-hairline)",
          background: "var(--bg-card)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: "var(--weight-semibold)" }}>Route &amp; Places Map</span>
        <span style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>
          {geoLegs.length} stops · {geoItems.length} pins
        </span>
      </div>

      {!bounds ? (
        <div
          style={{
            height: "calc(100% - 44px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-24)",
            textAlign: "center",
            color: "var(--ink-tertiary)",
            fontSize: 13.5,
          }}
        >
          No coordinates synced for this trip yet.
        </div>
      ) : (
        <div
          style={{
            position: "relative",
            height: "calc(100% - 44px)",
            backgroundImage: "radial-gradient(circle at 1px 1px, var(--border-hairline) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        >
          {/* Dashed flight/route polylines */}
          {legRoutePts.length >= 2 && (
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
            >
              <polyline
                fill="none"
                stroke="var(--brand-blue)"
                strokeWidth="0.7"
                strokeDasharray="2 1.8"
                points={legRoutePts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
              />
            </svg>
          )}

          {/* City Leg Markers */}
          {geoLegs.map((leg, i) => {
            const pt = toPct(leg.latitude!, leg.longitude!);
            return (
              <div
                key={leg.id}
                style={{
                  position: "absolute",
                  left: `${pt.x}%`,
                  top: `${pt.y}%`,
                  transform: "translate(-50%, -50%)",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-full)",
                  background: "var(--board)",
                  color: "var(--on-board)",
                  fontSize: 11.5,
                  fontWeight: "var(--weight-semibold)",
                  boxShadow: "var(--shadow-card)",
                  zIndex: 8,
                  whiteSpace: "nowrap",
                }}
              >
                {i + 1}. {leg.name}
              </div>
            );
          })}

          {/* Trip Item Floating Pill Pins */}
          {geoItems.slice(0, 45).map((item) => {
            const pt = toPct(item.latitude!, item.longitude!);
            const active = selectedId === item.id;
            const meta = KIND_META[item.kind];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(active ? null : item.id)}
                title={item.title || item.placeName}
                style={{
                  position: "absolute",
                  left: `${pt.x}%`,
                  top: `${pt.y}%`,
                  transform: `translate(-50%, -50%) scale(${active ? 1.12 : 1})`,
                  zIndex: active ? 20 : 10,
                  padding: "4px 9px",
                  borderRadius: "var(--radius-full)",
                  border: active ? "2px solid var(--ink-primary)" : "1px solid var(--border-strong)",
                  background: active ? "var(--brand)" : "var(--bg-card)",
                  color: active ? "var(--on-brand)" : "var(--ink-primary)",
                  fontSize: 11.5,
                  fontWeight: "var(--weight-medium)",
                  boxShadow: "var(--shadow-card)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  maxWidth: 150,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {meta.icon} {item.title || item.placeName}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
