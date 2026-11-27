"use client";

import Image from "next/image";
import type {
  AccountRecord,
  BudgetCategoryRecord,
  TransactionRecord,
  TripRecord,
} from "@/lib/cloudkit/schema";
import type { WooliCloudSnapshot } from "@/lib/cloudkit/client";

export type AppSpace = "today" | "budget" | "trips" | "eats" | "sights" | "movies" | "recipes";

export interface TodayScreenProps {
  snapshot: WooliCloudSnapshot;
  onOpenSpace: (space: AppSpace) => void;
  onOpenTrip?: (tripId: string) => void;
}

const APP_GRID: Array<{ id: AppSpace; title: string; icon: string }> = [
  { id: "budget", title: "Budget", icon: "/apps/budget.png" },
  { id: "trips", title: "Trips", icon: "/apps/trips.png" },
  { id: "eats", title: "Eats", icon: "/apps/eats.png" },
  { id: "sights", title: "Sights", icon: "/apps/sights.png" },
  { id: "movies", title: "Movies", icon: "/apps/movies.png" },
  { id: "recipes", title: "Recipes", icon: "/apps/recipes.png" },
];

function money(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  return `${sign}$${Math.round(Math.abs(amount)).toLocaleString("en-US")}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysBetween(fromDayKey: string, toDayKeyStr: string): number {
  const a = new Date(`${fromDayKey}T00:00:00`).getTime();
  const b = new Date(`${toDayKeyStr}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

interface TodayTripSummary {
  trip: TripRecord;
  isUnderway: boolean;
  daysAway: number;
  isClose: boolean;
  status: string;
  route: string | null;
  dateRange: string;
}

function computeTodayTrip(trips: TripRecord[]): TodayTripSummary | null {
  if (trips.length === 0) return null;
  const today = toDayKey(new Date());

  const current = trips.find((t) => t.startDay && t.endDay && t.startDay <= today && t.endDay >= today);
  let trip: TripRecord | undefined = current;
  let isUnderway = Boolean(current);
  let daysAway = 0;

  if (!trip) {
    const upcoming = trips
      .filter((t) => t.startDay && t.startDay > today)
      .sort((a, b) => a.startDay.localeCompare(b.startDay));
    if (upcoming.length > 0) {
      trip = upcoming[0];
      isUnderway = false;
      daysAway = daysBetween(today, trip.startDay);
    }
  }

  if (!trip) return null;

  let status: string;
  if (isUnderway) {
    const totalDays = Math.max(1, daysBetween(trip.startDay, trip.endDay) + 1);
    const currentDay = Math.max(1, daysBetween(trip.startDay, today) + 1);
    status = `Day ${currentDay} of ${totalDays}`;
  } else {
    status = daysAway === 1 ? "Tomorrow" : `In ${daysAway} days`;
  }

  const cities = trip.legs.filter((l) => !l.isHome && l.name).map((l) => l.name);
  const route = cities.length > 0 ? cities.join(" → ") : trip.destination || null;
  const dateRange =
    trip.startDay && trip.endDay
      ? `${formatShortDay(trip.startDay)} – ${formatShortDay(trip.endDay)}`
      : "Dates TBD";

  return {
    trip,
    isUnderway,
    daysAway,
    isClose: isUnderway || daysAway <= 14,
    status,
    route,
    dateRange,
  };
}

function formatShortDay(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface TodayBudgetSummary {
  spent: number;
  planned: number;
  left: number;
  fraction: number;
  toReview: number;
  headline: string;
  daysLeftText: string;
}

function computeTodayBudget(
  accounts: AccountRecord[],
  categories: BudgetCategoryRecord[],
  transactions: TransactionRecord[],
): TodayBudgetSummary {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysLeft = Math.max(0, lastDay.getDate() - now.getDate());

  const hiddenAccountIds = new Set(accounts.filter((a) => a.isHidden).map((a) => a.providerAccountId));
  const catById = new Map(categories.map((c) => [c.id, c]));

  let spent = 0;
  let toReview = 0;

  for (const tx of transactions) {
    if (tx.isHidden || tx.isSplit || hiddenAccountIds.has(tx.accountId)) continue;
    const cat = tx.categoryId ? catById.get(tx.categoryId) : undefined;
    if (tx.isTransfer || cat?.isTransfer) continue;

    if (tx.needsReview) toReview += 1;

    if (tx.transactedAt >= monthStart) {
      if (cat?.isIncome) continue;
      if (tx.amount < 0) spent += Math.abs(tx.amount);
    }
  }

  // Planned expenses: groups with monthlyTarget > 0 use group target, otherwise sum of children
  const expenseGroups = categories.filter((c) => !c.parentId && !c.isIncome && !c.isTransfer);
  let planned = 0;
  for (const g of expenseGroups) {
    if (g.monthlyTarget > 0) {
      planned += g.monthlyTarget;
    } else {
      const children = categories.filter((c) => c.parentId === g.id);
      planned += children.reduce((acc, ch) => acc + ch.monthlyTarget, 0);
    }
  }

  const left = planned - spent;
  const fraction = planned > 0 ? Math.min(spent / planned, 1) : 0;
  const headline =
    planned > 0
      ? left >= 0
        ? `${money(left)} left`
        : `${money(-left)} over`
      : `${money(spent)} spent`;
  const daysLeftText =
    daysLeft === 0 ? "Last day of the month" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left this month`;

  return { spent, planned, left, fraction, toReview, headline, daysLeftText };
}

export function TodayScreen({ snapshot, onOpenSpace, onOpenTrip }: TodayScreenProps) {
  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const tripSummary = computeTodayTrip(snapshot.trips);
  const hasBudgetData = snapshot.accounts.length > 0 || snapshot.transactions.length > 0 || snapshot.categories.length > 0;
  const budget = hasBudgetData
    ? computeTodayBudget(snapshot.accounts, snapshot.categories, snapshot.transactions)
    : null;

  const heroTrip = tripSummary && (tripSummary.isClose || !budget) ? tripSummary : null;

  // Eats counts
  const rankedEats = snapshot.eats.filter((e) => !e.isWish);
  const wishEats = snapshot.eats.filter((e) => e.isWish);
  const topEat = rankedEats[0];

  // Sights counts
  const visitedSights = snapshot.sights.filter((s) => Boolean(s.visitedDay));
  const wantSights = snapshot.sights.filter((s) => !s.visitedDay);
  const nextSight = wantSights[0];

  const openTripTarget = (tripId: string) => {
    if (onOpenTrip) onOpenTrip(tripId);
    else onOpenSpace("trips");
  };

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "8px 4px 40px" }}>
      {/* Header: Greeting + Date */}
      <header style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontFamily: "var(--font-source-serif), Georgia, serif",
            fontSize: "clamp(28px, 3.6vw, 34px)",
            fontWeight: 800,
            letterSpacing: "-0.015em",
            margin: "0 0 4px",
            color: "var(--ink, #0f1b33)",
          }}
        >
          {getGreeting()}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 500,
            color: "var(--ink-2, #475877)",
          }}
        >
          {todayFormatted}
        </p>
      </header>

      {/* Hero Card: Trip (if close or no budget) else Budget */}
      {heroTrip ? (
        <button
          type="button"
          onClick={() => openTripTarget(heroTrip.trip.id)}
          style={{
            width: "100%",
            textAlign: "left",
            border: "none",
            borderRadius: 22,
            padding: "20px 22px",
            marginBottom: 16,
            cursor: "pointer",
            color: "#ffffff",
            background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
            boxShadow: "0 12px 28px rgba(37, 99, 235, 0.24)",
            display: "block",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                color: "#fef3c7",
              }}
            >
              {heroTrip.isUnderway ? "On your trip" : "Next trip"}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)" }}>
              {heroTrip.dateRange}
            </span>
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.15,
              marginBottom: 4,
            }}
          >
            {heroTrip.status}
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: heroTrip.route ? 12 : 0 }}>
            {heroTrip.trip.name}
          </div>
          {heroTrip.route && (
            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.28)",
                paddingTop: 10,
                fontSize: 13,
                color: "rgba(255,255,255,0.92)",
              }}
            >
              📍 {heroTrip.route}
            </div>
          )}
        </button>
      ) : budget ? (
        <button
          type="button"
          onClick={() => onOpenSpace("budget")}
          style={{
            width: "100%",
            textAlign: "left",
            border: "1px solid var(--line, #d8e2f0)",
            borderRadius: 22,
            padding: "20px 22px",
            marginBottom: 16,
            cursor: "pointer",
            background: "var(--card, #ffffff)",
            boxShadow: "0 4px 16px rgba(15, 27, 51, 0.05)",
            display: "block",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: "var(--brand, #2563eb)",
              marginBottom: 8,
            }}
          >
            This month
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              color: "var(--ink, #0f1b33)",
              lineHeight: 1.15,
              marginBottom: 4,
            }}
          >
            {budget.headline}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-2, #475877)", marginBottom: budget.planned > 0 ? 14 : 0 }}>
            {budget.daysLeftText}
          </div>
          {budget.planned > 0 && (
            <div>
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: "var(--line, #e3eaf5)",
                  overflow: "hidden",
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, Math.round(budget.fraction * 100))}%`,
                    borderRadius: 999,
                    background: budget.left < 0 ? "#b91c1c" : "var(--brand, #2563eb)",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "var(--ink-2, #475877)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span>$0</span>
                <span>{money(budget.spent)} spent</span>
                <span>{money(budget.planned)}</span>
              </div>
            </div>
          )}
        </button>
      ) : null}

      {/* To-Do Card (only when there are items needing attention) */}
      {budget && budget.toReview > 0 && (
        <button
          type="button"
          onClick={() => onOpenSpace("budget")}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            marginBottom: 18,
            borderRadius: 14,
            border: "1px solid var(--line, #d8e2f0)",
            background: "var(--card, #ffffff)",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <Image src="/apps/budget.png" alt="" width={40} height={40} style={{ borderRadius: 10 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink, #0f1b33)" }}>
              Review {budget.toReview} transaction{budget.toReview === 1 ? "" : "s"}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-2, #475877)" }}>Categorize recent activity</div>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-2, #475877)" }}>›</span>
        </button>
      )}

      {/* TodayBoard Summary Cards: Trip, Budget, Eats, Sights */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: "var(--ink-2, #475877)",
          margin: "4px 4px 10px",
        }}
      >
        Today
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {/* Next Upcoming Trip Card */}
        <SummaryCard
          label="Next Trip"
          title={tripSummary ? tripSummary.trip.name : "No upcoming trips"}
          detail={
            tripSummary
              ? `${tripSummary.status} · ${tripSummary.dateRange}`
              : `${snapshot.trips.length} trip${snapshot.trips.length === 1 ? "" : "s"} saved`
          }
          accent="#2563eb"
          onClick={() => (tripSummary ? openTripTarget(tripSummary.trip.id) : onOpenSpace("trips"))}
        />

        {/* Budget Status Card */}
        <SummaryCard
          label="Budget"
          title={budget ? budget.headline : "No accounts"}
          detail={
            budget
              ? budget.planned > 0
                ? `${Math.round(budget.fraction * 100)}% of ${money(budget.planned)} plan`
                : `${snapshot.accounts.filter((a) => !a.isHidden).length} active accounts`
              : "Connect accounts in iCloud"
          }
          accent={budget && budget.left < 0 ? "#b91c1c" : "#15803d"}
          ringPercent={budget && budget.planned > 0 ? Math.min(100, Math.round(budget.fraction * 100)) : undefined}
          onClick={() => onOpenSpace("budget")}
        />

        {/* Eats Count Card */}
        <SummaryCard
          label="Eats"
          title={`${snapshot.eats.length} place${snapshot.eats.length === 1 ? "" : "s"}`}
          detail={
            topEat
              ? `#1 ${topEat.name} · ${wishEats.length} want to try`
              : `${rankedEats.length} ranked · ${wishEats.length} want to try`
          }
          accent="#d97706"
          onClick={() => onOpenSpace("eats")}
        />

        {/* Sights Count Card */}
        <SummaryCard
          label="Sights"
          title={`${snapshot.sights.length} sight${snapshot.sights.length === 1 ? "" : "s"}`}
          detail={
            nextSight
              ? `Next: ${nextSight.name}`
              : `${visitedSights.length} visited · ${wantSights.length} to go`
          }
          accent="#0d9488"
          onClick={() => onOpenSpace("sights")}
        />
      </div>

      {/* 3-Column "Your apps" Grid of 88px sheep icons */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: "var(--ink-2, #475877)",
          margin: "0 4px 14px",
        }}
      >
        Your apps
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "20px 12px",
          maxWidth: 460,
        }}
      >
        {APP_GRID.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpenSpace(item.id)}
            style={{
              background: "transparent",
              border: "none",
              padding: 4,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Image
              src={item.icon}
              alt={item.title}
              width={88}
              height={88}
              style={{
                width: 88,
                height: 88,
                borderRadius: 23,
                objectFit: "cover",
                boxShadow: "0 4px 14px rgba(15, 27, 51, 0.12)",
              }}
            />
            <span
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "var(--ink, #0f1b33)",
              }}
            >
              {item.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  title,
  detail,
  accent,
  ringPercent,
  onClick,
}: {
  label: string;
  title: string;
  detail: string;
  accent: string;
  ringPercent?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: 16,
        borderRadius: 14,
        border: "1px solid var(--line, #d8e2f0)",
        background: "var(--card, #ffffff)",
        boxShadow: "0 2px 10px rgba(15, 27, 51, 0.04)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: accent,
          }}
        >
          {label}
        </span>
        {typeof ringPercent === "number" && (
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <circle cx="13" cy="13" r="10" fill="none" stroke="var(--line, #d8e2f0)" strokeWidth="3" />
            <circle
              cx="13"
              cy="13"
              r="10"
              fill="none"
              stroke={accent}
              strokeWidth="3"
              strokeDasharray={`${(ringPercent / 100) * 62.83} 62.83`}
              strokeLinecap="round"
              transform="rotate(-90 13 13)"
            />
          </svg>
        )}
      </div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: "var(--ink, #0f1b33)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-2, #475877)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {detail}
      </div>
    </button>
  );
}

export default TodayScreen;
