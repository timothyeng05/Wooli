"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type {
  TripItemKind,
  TripItemRecord,
  TripLeg,
  TripRecord,
} from "@/lib/cloudkit/schema";

export type TripPage = "overview" | "ideas" | `city:${string}`;

export interface TripsScreenProps {
  trips: TripRecord[];
  tripItems: TripItemRecord[];
  selectedTripId: string | null;
  page: TripPage;
  onSelectTrip: (tripId: string | null, page?: TripPage) => void;
}

// ---------------------------------------------------------------------------
// Date & formatting helpers (timezone-safe for yyyy-MM-dd DayKeys)
// ---------------------------------------------------------------------------

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
  // Guard against malformed multi-year ranges
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
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatDayWithWeekday(day?: string): string {
  if (!day) return "TBD";
  const dt = parseDayUTC(day);
  if (!dt) return day;
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatDateRange(startDay?: string, endDay?: string): string {
  if (!startDay && !endDay) return "Dates TBD";
  if (startDay && (!endDay || startDay === endDay)) {
    const dt = parseDayUTC(startDay);
    return dt
      ? dt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })
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
  const endStr = e.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
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

// ---------------------------------------------------------------------------
// Design system tokens & kind metadata (Theme.swift)
// ---------------------------------------------------------------------------

const KIND_META: Record<
  TripItemKind,
  { label: string; icon: string; color: string; softBg: string }
> = {
  transit: {
    label: "Transit",
    icon: "✈️",
    color: "#2563EB",
    softBg: "rgba(37, 99, 235, 0.12)",
  },
  stay: {
    label: "Stay",
    icon: "🛏️",
    color: "#7C3AED",
    softBg: "rgba(124, 58, 237, 0.12)",
  },
  meal: {
    label: "Meal",
    icon: "🍽️",
    color: "#D97706",
    softBg: "rgba(217, 119, 6, 0.13)",
  },
  activity: {
    label: "Activity",
    icon: "📍",
    color: "#0D9488",
    softBg: "rgba(13, 148, 136, 0.12)",
  },
  note: {
    label: "Note",
    icon: "📝",
    color: "#64748B",
    softBg: "rgba(100, 116, 139, 0.12)",
  },
};

function sortLegs(legs: TripLeg[]): TripLeg[] {
  return [...legs]
    .filter((l) => !l.isHome)
    .sort((a, b) => a.startDay.localeCompare(b.startDay));
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
  if (trip.startDay <= today && (!trip.endDay || trip.endDay >= today)) {
    return "On your trip";
  }
  const days = diffDays(today, trip.startDay);
  if (days === 0) return "Next trip · today";
  if (days === 1) return "Next trip · tomorrow";
  if (days > 1) return `Next trip · in ${days} days`;
  return "Trip";
}

function formatCostTotals(
  totals: Record<string, number>,
  points: Record<string, number>,
): string {
  const parts: string[] = [];
  for (const [currency, amount] of Object.entries(totals)) {
    if (amount > 0) parts.push(formatMoney(amount, currency));
  }
  for (const [program, pts] of Object.entries(points)) {
    if (pts > 0) {
      const label = program ? ` ${program}` : "";
      parts.push(`${pts.toLocaleString("en-US")} pts${label}`);
    }
  }
  return parts.join(" + ") || "—";
}

// ---------------------------------------------------------------------------
// Shared UI primitives (TicketCard, LuggageTag)
// ---------------------------------------------------------------------------

function LuggageTag({
  label,
  color = "#2563EB",
}: {
  label: string;
  color?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px 3px 8px",
        borderRadius: "4px 10px 10px 4px",
        border: `1.5px solid ${color}`,
        background: `color-mix(in srgb, ${color} 14%, var(--card, #ffffff))`,
        color: "var(--ink, #0F1B33)",
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--paper, #EEF3FA)",
          border: `1.5px solid ${color}`,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--card, #FFFFFF)",
  border: "1px solid var(--line, #D8E2F0)",
  borderRadius: 14,
  padding: 20,
  boxShadow: "0 2px 6px rgba(15, 27, 51, 0.05)",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "#5F6F8E",
  margin: 0,
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function TripsScreen({
  trips,
  tripItems,
  selectedTripId,
  page,
  onSelectTrip,
}: TripsScreenProps) {
  const [search, setSearch] = useState("");
  const today = useMemo(() => todayKey(), []);

  const selectedTrip = useMemo(
    () => (selectedTripId ? trips.find((t) => t.id === selectedTripId) ?? null : null),
    [trips, selectedTripId],
  );

  // Gallery view when no trip is selected
  if (!selectedTrip) {
    return (
      <TripsGalleryView
        trips={trips}
        tripItems={tripItems}
        today={today}
        onOpenTrip={(id) => onSelectTrip(id, "overview")}
      />
    );
  }

  return (
    <SingleTripView
      trip={selectedTrip}
      allItems={tripItems.filter((i) => i.tripID === selectedTrip.id)}
      page={page}
      today={today}
      search={search}
      onSearchChange={setSearch}
      onSelectTrip={onSelectTrip}
    />
  );
}

export default TripsScreen;

// ---------------------------------------------------------------------------
// 1. All Trips Gallery View
// ---------------------------------------------------------------------------

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
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "48px 20px" }}>
        <div
          style={{
            ...cardStyle,
            textAlign: "center",
            padding: "48px 24px",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧳</div>
          <h2
            style={{
              fontFamily: "var(--font-source-serif), Georgia, serif",
              fontSize: 24,
              fontWeight: 700,
              margin: "0 0 8px",
              color: "var(--ink, #0F1B33)",
            }}
          >
            Plan your first trip
          </h2>
          <p
            style={{
              margin: "0 auto",
              maxWidth: 420,
              color: "var(--ink-2, #475877)",
              fontSize: 15,
            }}
          >
            Create a trip in Wooli on Mac or iPhone to see your itinerary,
            boarding passes, stays, and trip costs here.
          </p>
        </div>
      </div>
    );
  }

  const nextTrip = upcoming[0] ?? null;
  const otherUpcoming = upcoming.slice(1);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 20px 64px" }}>
      <div style={{ marginBottom: 20 }}>
        <p style={eyebrowStyle}>iCloud Trips</p>
        <h1
          style={{
            fontFamily: "var(--font-source-serif), Georgia, serif",
            fontSize: 30,
            fontWeight: 800,
            margin: "4px 0 0",
            color: "var(--ink, #0F1B33)",
          }}
        >
          All Trips
        </h1>
      </div>

      {nextTrip && (
        <NextTripTicketHero
          trip={nextTrip}
          items={itemsByTrip.get(nextTrip.id) ?? []}
          today={today}
          onClick={() => onOpenTrip(nextTrip.id)}
        />
      )}

      {otherUpcoming.length > 0 && (
        <TripSection
          title="Upcoming"
          trips={otherUpcoming}
          itemsByTrip={itemsByTrip}
          onOpenTrip={onOpenTrip}
        />
      )}

      {past.length > 0 && (
        <TripSection
          title="Past"
          trips={past}
          itemsByTrip={itemsByTrip}
          onOpenTrip={onOpenTrip}
        />
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
  const nights =
    trip.startDay && trip.endDay ? Math.max(0, diffDays(trip.startDay, trip.endDay)) : 0;
  const scheduledCount = items.filter((i) => Boolean(i.day)).length;
  const routeText =
    cities.length > 0 ? cities.join(" → ") : trip.destination || "Destination TBD";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        border: "none",
        cursor: "pointer",
        position: "relative",
        borderRadius: 22,
        padding: 22,
        marginBottom: 28,
        color: "#FFFFFF",
        background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)",
        boxShadow: "0 10px 26px rgba(37, 99, 235, 0.28)",
      }}
    >
      {/* Ticket side notches */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: -9,
          top: "50%",
          transform: "translateY(-50%)",
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "var(--paper, #EEF3FA)",
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: -9,
          top: "50%",
          transform: "translateY(-50%)",
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "var(--paper, #EEF3FA)",
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#FEF3C7",
          }}
        >
          {heroEyebrow(trip, today)}
        </span>
        {trip.scope === "shared" && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 999,
              background: "rgba(255, 255, 255, 0.18)",
              color: "#FFFFFF",
            }}
          >
            Shared
          </span>
        )}
      </div>

      <div
        style={{
          fontFamily: "var(--font-source-serif), Georgia, serif",
          fontSize: "clamp(24px, 3vw, 32px)",
          fontWeight: 800,
          lineHeight: 1.15,
          marginBottom: 6,
        }}
      >
        {trip.name || "Untitled trip"}
      </div>

      <div
        style={{
          fontSize: 13,
          color: "rgba(255, 255, 255, 0.85)",
          marginBottom: 14,
        }}
      >
        {scheduledCount} scheduled plan{scheduledCount === 1 ? "" : "s"}
        {legs.length > 0 ? ` · ${legs.length} stop${legs.length === 1 ? "" : "s"}` : ""}
      </div>

      {/* Inset dark panel (TicketCard.swift) */}
      <div
        style={{
          background: "rgba(15, 27, 51, 0.24)",
          borderRadius: 12,
          padding: "2px 14px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 0",
            borderBottom: "1px solid rgba(255, 255, 255, 0.22)",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            📅 {formatDateRange(trip.startDay, trip.endDay)}
          </span>
          <span style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
            {nights} night{nights === 1 ? "" : "s"}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 0",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600 }}>📍 {routeText}</span>
          <span style={{ fontSize: 13, color: "#FEF3C7", fontWeight: 600 }}>
            Open →
          </span>
        </div>
      </div>
    </button>
  );
}

function TripSection({
  title,
  trips,
  itemsByTrip,
  onOpenTrip,
}: {
  title: string;
  trips: TripRecord[];
  itemsByTrip: Map<string, TripItemRecord[]>;
  onOpenTrip: (tripId: string) => void;
}) {
  return (
    <section style={{ marginTop: 24 }}>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          margin: "0 0 12px",
          color: "var(--ink, #0F1B33)",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
          gap: 16,
        }}
      >
        {trips.map((trip) => {
          const items = itemsByTrip.get(trip.id) ?? [];
          const legs = sortLegs(trip.legs);
          const nights =
            trip.startDay && trip.endDay
              ? Math.max(0, diffDays(trip.startDay, trip.endDay))
              : 0;
          const plansCount = items.filter((i) => Boolean(i.day)).length;

          return (
            <button
              key={trip.id}
              type="button"
              onClick={() => onOpenTrip(trip.id)}
              style={{
                ...cardStyle,
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                transition: "transform 120ms ease, box-shadow 120ms ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      color: "var(--ink, #0F1B33)",
                      marginBottom: 2,
                    }}
                  >
                    {trip.name || "Untitled trip"}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--ink-2, #475877)",
                    }}
                  >
                    {formatDateRange(trip.startDay, trip.endDay)}
                    {nights > 0 ? ` · ${nights}n` : ""}
                  </div>
                </div>
                {trip.scope === "shared" && <LuggageTag label="Shared" />}
              </div>

              {(trip.destination || legs.length > 0) && (
                <div
                  style={{
                    fontSize: 13,
                    color: "#2563EB",
                    fontWeight: 600,
                  }}
                >
                  {legs.length > 0
                    ? legs.map((l) => `${l.emoji ? `${l.emoji} ` : ""}${l.name}`).join(" → ")
                    : trip.destination}
                </div>
              )}

              <div
                style={{
                  marginTop: "auto",
                  paddingTop: 8,
                  borderTop: "1px solid var(--line, #D8E2F0)",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "#5F6F8E",
                }}
              >
                <span>
                  {plansCount} plan{plansCount === 1 ? "" : "s"}
                </span>
                <span>
                  {legs.length > 0
                    ? `${legs.length} cit${legs.length === 1 ? "y" : "ies"}`
                    : "Single stop"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. Single Trip View (Overview / City:<legId> / Ideas)
// ---------------------------------------------------------------------------

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
        item.transport?.fromAirport,
        item.transport?.toAirport,
      ]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [sortedItems, search]);

  const tripDaySet = useMemo(
    () => new Set(enumerateDays(trip.startDay, trip.endDay)),
    [trip.startDay, trip.endDay],
  );

  const ideas = useMemo(
    () =>
      filteredItems.filter(
        (i) => !i.day || (tripDaySet.size > 0 && !tripDaySet.has(i.day)),
      ),
    [filteredItems, tripDaySet],
  );

  const activeLegId = page.startsWith("city:") ? page.slice(5) : null;
  const activeLeg = activeLegId ? legs.find((l) => l.id === activeLegId) ?? null : null;

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "20px 20px 64px" }}>
      {/* Top breadcrumb & search bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => onSelectTrip(null)}
            style={{
              border: "1px solid var(--line, #D8E2F0)",
              background: "var(--card, #FFFFFF)",
              color: "var(--ink, #0F1B33)",
              borderRadius: 10,
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ← All Trips
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1
                style={{
                  fontFamily: "var(--font-source-serif), Georgia, serif",
                  fontSize: 24,
                  fontWeight: 800,
                  margin: 0,
                  color: "var(--ink, #0F1B33)",
                }}
              >
                {trip.name || "Untitled trip"}
              </h1>
              {trip.scope === "shared" && <LuggageTag label="Shared" />}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-2, #475877)" }}>
              {formatDateRange(trip.startDay, trip.endDay)}
              {trip.destination ? ` · ${trip.destination}` : ""}
            </div>
          </div>
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search plans…"
          aria-label="Search plans"
          style={{
            border: "1px solid var(--line, #D8E2F0)",
            background: "var(--card, #FFFFFF)",
            color: "var(--ink, #0F1B33)",
            borderRadius: 10,
            padding: "7px 12px",
            fontSize: 13,
            minWidth: 200,
          }}
        />
      </div>

      {/* Subpage pill bar (mirrors sidebar for narrow/collapsed states) */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <PagePill
          active={page === "overview"}
          label="Overview"
          onClick={() => onSelectTrip(trip.id, "overview")}
        />
        {legs.map((leg, idx) => (
          <PagePill
            key={leg.id}
            active={page === `city:${leg.id}`}
            label={`${leg.emoji && leg.emoji !== "📍" ? leg.emoji : `${idx + 1}.`} ${leg.name || `City ${idx + 1}`}`}
            onClick={() => onSelectTrip(trip.id, `city:${leg.id}`)}
          />
        ))}
        <PagePill
          active={page === "ideas"}
          label={`Ideas (${ideas.length})`}
          onClick={() => onSelectTrip(trip.id, "ideas")}
        />
      </div>

      {page === "ideas" ? (
        <IdeasPageView ideas={ideas} search={search} />
      ) : activeLeg ? (
        <CityLegView
          trip={trip}
          leg={activeLeg}
          legIndex={legs.findIndex((l) => l.id === activeLeg.id)}
          items={filteredItems}
          allTripItems={sortedItems}
          today={today}
        />
      ) : (
        <TripOverviewView
          trip={trip}
          legs={legs}
          items={filteredItems}
          allTripItems={sortedItems}
          today={today}
          onOpenLeg={(legId) => onSelectTrip(trip.id, `city:${legId}`)}
        />
      )}
    </div>
  );
}

function PagePill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active ? "1px solid #2563EB" : "1px solid var(--line, #D8E2F0)",
        background: active ? "#2563EB" : "var(--card, #FFFFFF)",
        color: active ? "#FFFFFF" : "var(--ink, #0F1B33)",
        borderRadius: 999,
        padding: "6px 14px",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// 2a. Trip Overview (Departure-board route header, legs, bookings, costs)
// ---------------------------------------------------------------------------

function TripOverviewView({
  trip,
  legs,
  items,
  allTripItems,
  today,
  onOpenLeg,
}: {
  trip: TripRecord;
  legs: TripLeg[];
  items: TripItemRecord[];
  allTripItems: TripItemRecord[];
  today: string;
  onOpenLeg: (legId: string) => void;
}) {
  const firstFlight = allTripItems.find(
    (i) => i.kind === "transit" && i.transport?.mode === "flight",
  );
  const bookings = items.filter((i) => i.kind === "transit" || i.kind === "stay");
  const totalDays =
    trip.startDay && trip.endDay ? Math.max(1, diffDays(trip.startDay, trip.endDay) + 1) : 0;
  const scheduledPlans = allTripItems.filter((i) => Boolean(i.day)).length;

  const fromCode = firstFlight?.transport?.fromAirport || "HOME";
  const toCode =
    firstFlight?.transport?.toAirport ||
    (trip.destination ? trip.destination.slice(0, 3).toUpperCase() : "DEST");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Departure-board style route header */}
      <div
        style={{
          background: "#0F1B33",
          color: "#FFFFFF",
          borderRadius: 18,
          padding: 22,
          boxShadow: "0 8px 24px rgba(15, 27, 51, 0.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#FEF3C7",
            }}
          >
            Departure Board · Route Summary
          </span>
          <span style={{ fontSize: 12, color: "#B3C0D9" }}>
            {totalDays > 0 ? `${totalDays} days · ` : ""}
            {legs.length} cit{legs.length === 1 ? "y" : "ies"} · {scheduledPlans} plan
            {scheduledPlans === 1 ? "" : "s"}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 30,
              fontWeight: 900,
              letterSpacing: "0.04em",
              color: "#FEF3C7",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fromCode}
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 80,
              borderTop: "2px dashed rgba(255, 255, 255, 0.28)",
              position: "relative",
              textAlign: "center",
            }}
          >
            <span
              style={{
                position: "relative",
                top: -12,
                background: "#0F1B33",
                padding: "0 8px",
                fontSize: 14,
              }}
            >
              ✈️
            </span>
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 900,
              letterSpacing: "0.04em",
              color: "#FEF3C7",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {toCode}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
            background: "rgba(255, 255, 255, 0.08)",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <BoardCell label="Dates" value={formatDateRange(trip.startDay, trip.endDay)} />
          <BoardCell
            label="Route"
            value={
              legs.length > 0
                ? legs.map((l) => l.name).filter(Boolean).join(" → ")
                : trip.destination || "—"
            }
          />
          <BoardCell
            label="Primary Transit"
            value={
              firstFlight?.transport?.flightNumber
                ? `${firstFlight.transport.airline ?? ""} ${firstFlight.transport.flightNumber}`.trim()
                : "See bookings"
            }
          />
        </div>

        {trip.notes && (
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 14,
              color: "#B3C0D9",
              lineHeight: 1.5,
            }}
          >
            {trip.notes}
          </p>
        )}
      </div>

      {/* Two-column body: Legs/Stops + Costs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Legs / Stops Summary */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 12,
            }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--ink, #0F1B33)" }}>
              Stops &amp; Cities
            </h2>
            <span style={{ fontSize: 12, color: "#5F6F8E" }}>
              {legs.length} stop{legs.length === 1 ? "" : "s"}
            </span>
          </div>

          {legs.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: "#5F6F8E" }}>
              No city legs defined yet. All scheduled plans are grouped under the trip dates.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {legs.map((leg, idx) => {
                const nights = Math.max(0, diffDays(leg.startDay, leg.endDay));
                const isNow = leg.startDay <= today && leg.endDay >= today;
                const legPlanCount = allTripItems.filter(
                  (i) => i.day && i.day >= leg.startDay && i.day <= leg.endDay,
                ).length;

                return (
                  <button
                    key={leg.id}
                    type="button"
                    onClick={() => onOpenLeg(leg.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid var(--line, #D8E2F0)",
                      background: "var(--paper, #EEF3FA)",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        background: "#2563EB",
                        color: "#FFFFFF",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {leg.emoji && leg.emoji !== "📍" ? leg.emoji : idx + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 15,
                          fontWeight: 600,
                          color: "var(--ink, #0F1B33)",
                        }}
                      >
                        <span>{leg.name || `City ${idx + 1}`}</span>
                        {isNow && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: "2px 6px",
                              borderRadius: 999,
                              background: "#2563EB",
                              color: "#FFFFFF",
                            }}
                          >
                            NOW
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-2, #475877)" }}>
                        {formatDayShort(leg.startDay)} – {formatDayShort(leg.endDay)} ·{" "}
                        {nights} night{nights === 1 ? "" : "s"} · {legPlanCount} plan
                        {legPlanCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <span style={{ fontSize: 13, color: "#2563EB", fontWeight: 600 }}>→</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Trip Costs Card (TripCostsCard from MacTripWorkspace.swift) */}
        <TripCostsCard items={allTripItems} />
      </div>

      {/* Bookings & Stays (DepartureBoard style) */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 12,
          }}
        >
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--ink, #0F1B33)" }}>
            Bookings &amp; Stays
          </h2>
          <span style={{ fontSize: 12, color: "#5F6F8E" }}>
            {bookings.length} item{bookings.length === 1 ? "" : "s"}
          </span>
        </div>

        {bookings.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: "#5F6F8E" }}>
            No flights, trains, or stays added yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {bookings.map((b, idx) => {
              const meta = KIND_META[b.kind];
              const t = b.transport;
              const route =
                t?.fromAirport || t?.toAirport
                  ? `${t.fromAirport ?? "?"} → ${t.toAirport ?? "?"}`
                  : null;
              const detailParts = [
                b.day ? formatDayWithWeekday(b.day) : "Unscheduled",
                typeof b.time === "number" ? formatClock(b.time) : null,
                b.checkOutDay ? `out ${formatDayShort(b.checkOutDay)}` : null,
                t?.airline || t?.flightNumber
                  ? `${t.airline ?? ""} ${t.flightNumber ?? ""}`.trim()
                  : null,
                route,
                t?.seats ? `Seats ${t.seats}` : null,
                b.placeName,
              ].filter(Boolean);

              return (
                <div
                  key={b.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "11px 0",
                    borderTop: idx > 0 ? "1px solid var(--line, #D8E2F0)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: meta.softBg,
                        color: meta.color,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      {t?.mode === "train" ? "🚆" : meta.icon}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--ink, #0F1B33)",
                        }}
                      >
                        {b.title || b.placeName || meta.label}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-2, #475877)" }}>
                        {detailParts.join(" · ")}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {t?.confirmation && (
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#2563EB",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {t.confirmation}
                      </div>
                    )}
                    {typeof b.cost === "number" && b.cost > 0 && (
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--ink, #0F1B33)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatMoney(b.cost, b.currency)}
                      </div>
                    )}
                    {typeof b.points === "number" && b.points > 0 && (
                      <div style={{ fontSize: 12, color: "#5F6F8E" }}>
                        {b.points.toLocaleString("en-US")} {b.pointsProgram ?? "pts"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BoardCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#B3C0D9",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF" }}>{value}</div>
    </div>
  );
}

function TripCostsCard({ items }: { items: TripItemRecord[] }) {
  const { grandTotals, grandPoints, lines, unpricedCount } = useMemo(() => {
    const totals: Record<string, number> = {};
    const points: Record<string, number> = {};
    const buckets: Record<
      "transit" | "stay" | "meal" | "other",
      {
        title: string;
        icon: string;
        count: number;
        totals: Record<string, number>;
        points: Record<string, number>;
      }
    > = {
      transit: { title: "Flights & Trains", icon: "✈️", count: 0, totals: {}, points: {} },
      stay: { title: "Stays", icon: "🛏️", count: 0, totals: {}, points: {} },
      meal: { title: "Meals", icon: "🍽️", count: 0, totals: {}, points: {} },
      other: { title: "Activities & Other", icon: "📍", count: 0, totals: {}, points: {} },
    };

    let unpriced = 0;

    for (const item of items) {
      const hasCost = typeof item.cost === "number" && item.cost > 0;
      const hasPoints = typeof item.points === "number" && item.points > 0;
      if (!hasCost && !hasPoints) {
        if (item.kind === "transit" || item.kind === "stay") unpriced += 1;
        continue;
      }

      const key =
        item.kind === "transit"
          ? "transit"
          : item.kind === "stay"
            ? "stay"
            : item.kind === "meal"
              ? "meal"
              : "other";
      const bucket = buckets[key];
      bucket.count += 1;

      if (hasCost && item.cost) {
        const cur = item.currency || "USD";
        totals[cur] = (totals[cur] ?? 0) + item.cost;
        bucket.totals[cur] = (bucket.totals[cur] ?? 0) + item.cost;
      }
      if (hasPoints && item.points) {
        const prog = item.pointsProgram || "";
        points[prog] = (points[prog] ?? 0) + item.points;
        bucket.points[prog] = (bucket.points[prog] ?? 0) + item.points;
      }
    }

    return {
      grandTotals: totals,
      grandPoints: points,
      lines: Object.values(buckets).filter((b) => b.count > 0),
      unpricedCount: unpriced,
    };
  }, [items]);

  const hasAnyCost =
    Object.keys(grandTotals).length > 0 || Object.keys(grandPoints).length > 0;

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--ink, #0F1B33)" }}>
          Trip Costs
        </h2>
        {hasAnyCost && (
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "var(--ink, #0F1B33)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatCostTotals(grandTotals, grandPoints)}
          </span>
        )}
      </div>

      {lines.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: "#5F6F8E" }}>
          Add prices or points to flights, trains, and stays to see what this trip costs.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lines.map((line) => (
            <div
              key={line.title}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "rgba(37, 99, 235, 0.12)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                  }}
                >
                  {line.icon}
                </span>
                <span style={{ fontSize: 14, color: "var(--ink, #0F1B33)" }}>{line.title}</span>
                <span style={{ fontSize: 12, color: "#5F6F8E" }}>{line.count}</span>
              </div>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--ink, #0F1B33)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatCostTotals(line.totals, line.points)}
              </span>
            </div>
          ))}
        </div>
      )}

      {unpricedCount > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#5F6F8E" }}>
          ⓘ {unpricedCount} booking{unpricedCount === 1 ? "" : "s"} without a price
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2b. City / Leg Day-by-Day Itinerary View
// ---------------------------------------------------------------------------

function CityLegView({
  trip,
  leg,
  legIndex,
  items,
  allTripItems,
  today,
}: {
  trip: TripRecord;
  leg: TripLeg;
  legIndex: number;
  items: TripItemRecord[];
  allTripItems: TripItemRecord[];
  today: string;
}) {
  const days = useMemo(() => enumerateDays(leg.startDay, leg.endDay), [leg.startDay, leg.endDay]);
  const nights = Math.max(0, diffDays(leg.startDay, leg.endDay));
  const isNow = leg.startDay <= today && leg.endDay >= today;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Leg header */}
      <div
        style={{
          ...cardStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#2563EB",
              color: "#FFFFFF",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            {leg.emoji && leg.emoji !== "📍" ? leg.emoji : legIndex + 1}
          </span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2
                style={{
                  fontFamily: "var(--font-source-serif), Georgia, serif",
                  fontSize: 22,
                  fontWeight: 800,
                  margin: 0,
                  color: "var(--ink, #0F1B33)",
                }}
              >
                {leg.name || `City ${legIndex + 1}`}
              </h2>
              {isNow && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "#2563EB",
                    color: "#FFFFFF",
                  }}
                >
                  NOW
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-2, #475877)" }}>
              {formatDateRange(leg.startDay, leg.endDay)} · {nights} night
              {nights === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      </div>

      {/* Day-by-day cards */}
      {days.map((day) => {
        const dayIndex = trip.startDay ? diffDays(trip.startDay, day) + 1 : null;
        const dayTitle = trip.dayTitles[day];
        const dayPlans = items.filter((i) => i.day === day);
        const stayingOver = allTripItems.filter(
          (i) =>
            i.kind === "stay" &&
            i.day &&
            i.day < day &&
            i.checkOutDay &&
            i.checkOutDay > day,
        );
        const isToday = day === today;

        return (
          <div
            key={day}
            style={{
              ...cardStyle,
              borderColor: isToday ? "#2563EB" : "var(--line, #D8E2F0)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 12,
                paddingBottom: 10,
                borderBottom: "1px solid var(--line, #D8E2F0)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {dayIndex !== null && dayIndex > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: isToday ? "#2563EB" : "#5F6F8E",
                    }}
                  >
                    Day {dayIndex}
                  </span>
                )}
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    margin: 0,
                    color: "var(--ink, #0F1B33)",
                  }}
                >
                  {formatDayWithWeekday(day)}
                </h3>
                {dayTitle && (
                  <span style={{ fontSize: 14, color: "var(--ink-2, #475877)" }}>
                    · {dayTitle}
                  </span>
                )}
                {isToday && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "2px 7px",
                      borderRadius: 999,
                      background: "rgba(37, 99, 235, 0.14)",
                      color: "#2563EB",
                    }}
                  >
                    Today
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, color: "#5F6F8E" }}>
                {dayPlans.length} plan{dayPlans.length === 1 ? "" : "s"}
              </span>
            </div>

            {stayingOver.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                {stayingOver.map((s) => (
                  <span
                    key={s.id}
                    style={{
                      fontSize: 12,
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: "rgba(124, 58, 237, 0.1)",
                      color: "#7C3AED",
                      fontWeight: 600,
                    }}
                  >
                    🛏️ Staying at {s.placeName || s.title}
                  </span>
                ))}
              </div>
            )}

            {dayPlans.length === 0 ? (
              <div style={{ fontSize: 13, color: "#5F6F8E", padding: "4px 0" }}>
                Nothing scheduled for this day yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {dayPlans.map((item) => (
                  <TripPlanRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TripPlanRow({ item }: { item: TripItemRecord }) {
  const meta = KIND_META[item.kind];
  const t = item.transport;
  const route =
    t?.fromAirport || t?.toAirport
      ? `${t.fromAirport ?? "?"} → ${t.toAirport ?? "?"}`
      : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 12,
        background: "var(--paper, #EEF3FA)",
        border: "1px solid var(--line, #D8E2F0)",
      }}
    >
      {/* Time column */}
      <div
        style={{
          width: 48,
          flexShrink: 0,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ink-2, #475877)",
          fontVariantNumeric: "tabular-nums",
          paddingTop: 3,
        }}
      >
        {formatClock(item.time)}
      </div>

      {/* Kind badge */}
      <span
        title={meta.label}
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: meta.softBg,
          color: meta.color,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {item.kind === "transit" && t?.mode === "train" ? "🚆" : meta.icon}
      </span>

      {/* Main details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--ink, #0F1B33)",
            }}
          >
            {item.title || item.placeName || meta.label}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 999,
              background: meta.softBg,
              color: meta.color,
            }}
          >
            {meta.label}
          </span>
        </div>

        {(item.placeName || item.placeAddress) && (
          <div style={{ fontSize: 13, color: "var(--ink-2, #475877)", marginTop: 2 }}>
            {[
              item.placeName && item.placeName !== item.title ? item.placeName : null,
              item.placeAddress,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}

        {t && (
          <div style={{ fontSize: 12, color: "#2563EB", fontWeight: 600, marginTop: 3 }}>
            {[
              t.airline || t.flightNumber
                ? `${t.airline ?? ""} ${t.flightNumber ?? ""}`.trim()
                : null,
              route,
              t.seats ? `Seats ${t.seats}` : null,
              t.confirmation ? `Ref ${t.confirmation}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}

        {item.notes && (
          <div
            style={{
              fontSize: 13,
              color: "var(--ink-2, #475877)",
              marginTop: 4,
              whiteSpace: "pre-wrap",
            }}
          >
            {item.notes}
          </div>
        )}
      </div>

      {/* Cost / Points */}
      {(typeof item.cost === "number" && item.cost > 0) ||
      (typeof item.points === "number" && item.points > 0) ? (
        <div style={{ textAlign: "right", flexShrink: 0, fontSize: 13, fontWeight: 600 }}>
          {typeof item.cost === "number" && item.cost > 0 && (
            <div style={{ color: "var(--ink, #0F1B33)", fontVariantNumeric: "tabular-nums" }}>
              {formatMoney(item.cost, item.currency)}
            </div>
          )}
          {typeof item.points === "number" && item.points > 0 && (
            <div style={{ fontSize: 12, color: "#5F6F8E" }}>
              {item.points.toLocaleString("en-US")} {item.pointsProgram ?? "pts"}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2c. Ideas View (Unscheduled trip items)
// ---------------------------------------------------------------------------

function IdeasPageView({
  ideas,
  search,
}: {
  ideas: TripItemRecord[];
  search: string;
}) {
  if (ideas.length === 0) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", padding: "40px 24px" }}>
        <div style={{ fontSize: 34, marginBottom: 8 }}>💡</div>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            margin: "0 0 6px",
            color: "var(--ink, #0F1B33)",
          }}
        >
          {search.trim() ? "No matching ideas" : "No ideas yet"}
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "#5F6F8E" }}>
          {search.trim()
            ? "Try clearing your search filter."
            : "Unscheduled places and ideas saved on Mac or iPhone will appear here."}
        </p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 14,
        }}
      >
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--ink, #0F1B33)" }}>
          Ideas &amp; Unscheduled Plans
        </h2>
        <span style={{ fontSize: 12, color: "#5F6F8E" }}>
          {ideas.length} item{ideas.length === 1 ? "" : "s"}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ideas.map((item) => (
          <TripPlanRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
