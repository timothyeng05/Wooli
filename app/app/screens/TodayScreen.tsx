"use client";

import Image from "next/image";
import type {
  AccountRecord,
  BudgetCategoryRecord,
  MealSentiment,
  TransactionRecord,
  TripRecord,
} from "@/lib/cloudkit/schema";
import type { WooliCloudSnapshot } from "@/lib/cloudkit/client";
import { Badge, Card, type BadgeTone } from "@/app/components/ds";

const SENTIMENT_ORDER: MealSentiment[] = ["mustTry", "loved", "liked", "fine", "disliked"];

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

function formatShortDay(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  const reviewStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysLeft = Math.max(0, lastDay.getDate() - now.getDate());

  const hiddenAccountIds = new Set(
    accounts.filter((a) => a.isHidden || a.hideTransactions).map((a) => a.providerAccountId),
  );
  const catById = new Map(categories.map((c) => [c.id, c]));

  let spent = 0;
  let toReview = 0;

  for (const tx of transactions) {
    if (tx.isHidden || tx.isSplit || hiddenAccountIds.has(tx.accountId)) continue;
    if (tx.needsReview && tx.transactedAt >= reviewStart) toReview += 1;

    const cat = tx.categoryId ? catById.get(tx.categoryId) : undefined;
    if (tx.isTransfer || cat?.isTransfer) continue;

    if (tx.transactedAt >= monthStart) {
      if (cat) {
        if (!cat.isIncome) spent -= tx.amount;
      } else if (tx.amount < 0) {
        spent -= tx.amount;
      }
    }
  }

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
  const hasBudgetData =
    snapshot.accounts.length > 0 || snapshot.transactions.length > 0 || snapshot.categories.length > 0;
  const budget = hasBudgetData
    ? computeTodayBudget(snapshot.accounts, snapshot.categories, snapshot.transactions)
    : null;

  const heroTrip = tripSummary && (tripSummary.isClose || !budget) ? tripSummary : null;

  const ownEats = snapshot.eats.filter((e) => e.scope !== "shared");
  const eatsPool = ownEats.length > 0 ? ownEats : snapshot.eats;
  const rankedEats = eatsPool
    .filter((e) => !e.isWish)
    .sort((a, b) => SENTIMENT_ORDER.indexOf(a.sentiment) - SENTIMENT_ORDER.indexOf(b.sentiment) || b.rank - a.rank);
  const wishEats = eatsPool.filter((e) => e.isWish);
  const topEat = rankedEats[0];

  const visitedSights = snapshot.sights.filter((s) => Boolean(s.visitedDay));
  const wantSights = snapshot.sights.filter((s) => !s.visitedDay);
  const nextSight = wantSights[0];

  const openTripTarget = (tripId: string) => {
    if (onOpenTrip) onOpenTrip(tripId);
    else onOpenSpace("trips");
  };

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "var(--space-8) var(--space-4) var(--space-40)" }}>
      <header style={{ marginBottom: "var(--space-24)" }}>
        <p
          style={{
            margin: "0 0 var(--space-4)",
            fontSize: 12,
            fontWeight: "var(--weight-semibold)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-tertiary)",
          }}
        >
          {todayFormatted}
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(28px, 3.6vw, 36px)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            margin: 0,
            color: "var(--ink-primary)",
          }}
        >
          {getGreeting()}
        </h1>
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
            borderRadius: "var(--radius-card)",
            padding: "var(--space-24)",
            marginBottom: "var(--space-16)",
            cursor: "pointer",
            color: "var(--on-ticket)",
            background: "linear-gradient(135deg, var(--ticket-start) 0%, var(--ticket-end) 100%)",
            boxShadow: "var(--shadow-ticket)",
            display: "block",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--space-12)",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: "var(--weight-semibold)",
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                color: "var(--ticket-highlight)",
              }}
            >
              {heroTrip.isUnderway ? "On your trip" : "Next trip"}
            </span>
            <span style={{ fontSize: 13, fontWeight: "var(--weight-medium)", color: "rgba(255,255,255,0.88)" }}>
              {heroTrip.dateRange}
            </span>
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 32,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.15,
              marginBottom: "var(--space-4)",
            }}
          >
            {heroTrip.status}
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: "var(--weight-semibold)",
              marginBottom: heroTrip.route ? "var(--space-12)" : 0,
            }}
          >
            {heroTrip.trip.name}
          </div>
          {heroTrip.route && (
            <div
              style={{
                borderTop: "1px solid var(--ticket-rule)",
                paddingTop: "var(--space-12)",
                fontSize: 13,
                color: "rgba(255,255,255,0.92)",
              }}
            >
              {heroTrip.route}
            </div>
          )}
        </button>
      ) : budget ? (
        <Card
          interactive
          padding="lg"
          onClick={() => onOpenSpace("budget")}
          style={{ marginBottom: "var(--space-16)", cursor: "pointer" }}
          eyebrow="This month"
          actions={
            <Badge tone={budget.left < 0 ? "expense" : "brand"}>
              {budget.planned > 0 ? `${Math.round(budget.fraction * 100)}% used` : "Active"}
            </Badge>
          }
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 32,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              color: "var(--ink-primary)",
              lineHeight: 1.15,
              marginBottom: "var(--space-4)",
            }}
          >
            {budget.headline}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--ink-tertiary)",
              marginBottom: budget.planned > 0 ? "var(--space-16)" : 0,
            }}
          >
            {budget.daysLeftText}
          </div>
          {budget.planned > 0 && (
            <div>
              <div
                style={{
                  height: 8,
                  borderRadius: "var(--radius-full)",
                  background: "var(--track)",
                  overflow: "hidden",
                  marginBottom: "var(--space-8)",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, Math.round(budget.fraction * 100))}%`,
                    borderRadius: "var(--radius-full)",
                    background: budget.left < 0 ? "var(--expense)" : "var(--brand)",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "var(--ink-tertiary)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span>$0</span>
                <span>{money(budget.spent)} spent</span>
                <span>{money(budget.planned)}</span>
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {/* To-Do Card (read-only link to Budget review) */}
      {budget && budget.toReview > 0 && (
        <Card
          interactive
          padding="sm"
          onClick={() => onOpenSpace("budget")}
          style={{
            marginBottom: "var(--space-24)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-12)",
          }}
        >
          <Image src="/apps/budget.png" alt="" width={40} height={40} style={{ borderRadius: "var(--radius-s)" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: "var(--weight-semibold)", color: "var(--ink-primary)" }}>
              {budget.toReview} transaction{budget.toReview === 1 ? "" : "s"} flagged for review
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-tertiary)" }}>Open Budget to inspect recent activity</div>
          </div>
          <Badge tone="pending">{budget.toReview}</Badge>
        </Card>
      )}

      {/* TodayBoard Summary Cards */}
      <div
        style={{
          fontSize: 11,
          fontWeight: "var(--weight-semibold)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-tertiary)",
          margin: "0 var(--space-4) var(--space-12)",
        }}
      >
        Field Notes Overview
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--space-12)",
          marginBottom: "var(--space-32)",
        }}
      >
        <SummaryCard
          label="Next Trip"
          tone="travel"
          title={tripSummary ? tripSummary.trip.name : "No upcoming trips"}
          detail={
            tripSummary
              ? `${tripSummary.status} · ${tripSummary.dateRange}`
              : `${snapshot.trips.length} trip${snapshot.trips.length === 1 ? "" : "s"} saved`
          }
          onClick={() => (tripSummary ? openTripTarget(tripSummary.trip.id) : onOpenSpace("trips"))}
        />

        <SummaryCard
          label="Budget"
          tone={budget && budget.left < 0 ? "expense" : "income"}
          title={budget ? budget.headline : "No accounts"}
          detail={
            budget
              ? budget.planned > 0
                ? `${Math.round(budget.fraction * 100)}% of ${money(budget.planned)} plan`
                : `${snapshot.accounts.filter((a) => !a.isHidden).length} active accounts`
              : "Connect accounts in iCloud"
          }
          ringPercent={budget && budget.planned > 0 ? Math.min(100, Math.round(budget.fraction * 100)) : undefined}
          onClick={() => onOpenSpace("budget")}
        />

        <SummaryCard
          label="Eats"
          tone="pending"
          title={`${snapshot.eats.length} place${snapshot.eats.length === 1 ? "" : "s"}`}
          detail={
            topEat
              ? `#1 ${topEat.name} · ${wishEats.length} want to try`
              : `${rankedEats.length} ranked · ${wishEats.length} want to try`
          }
          onClick={() => onOpenSpace("eats")}
        />

        <SummaryCard
          label="Sights"
          tone="brand"
          title={`${snapshot.sights.length} sight${snapshot.sights.length === 1 ? "" : "s"}`}
          detail={nextSight ? `Next: ${nextSight.name}` : `${visitedSights.length} visited · ${wantSights.length} to go`}
          onClick={() => onOpenSpace("sights")}
        />
      </div>

      {/* 3-Column "Your apps" Grid */}
      <div
        style={{
          fontSize: 11,
          fontWeight: "var(--weight-semibold)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-tertiary)",
          margin: "0 var(--space-4) var(--space-16)",
        }}
      >
        Your apps
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "var(--space-20) var(--space-12)",
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
              padding: "var(--space-4)",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--space-8)",
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
                borderRadius: "var(--radius-l)",
                objectFit: "cover",
                boxShadow: "var(--shadow-card)",
              }}
            />
            <span
              style={{
                fontSize: 14,
                fontWeight: "var(--weight-medium)",
                color: "var(--ink-primary)",
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
  tone,
  title,
  detail,
  ringPercent,
  onClick,
}: {
  label: string;
  tone: BadgeTone;
  title: string;
  detail: string;
  ringPercent?: number;
  onClick: () => void;
}) {
  const ringColor =
    tone === "expense"
      ? "var(--expense)"
      : tone === "income"
        ? "var(--income)"
        : tone === "travel"
          ? "var(--brand-blue)"
          : "var(--brand)";

  return (
    <Card
      interactive
      padding="sm"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-8)",
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
        <Badge tone={tone}>{label}</Badge>
        {typeof ringPercent === "number" && (
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <circle cx="13" cy="13" r="10" fill="none" stroke="var(--track)" strokeWidth="3" />
            <circle
              cx="13"
              cy="13"
              r="10"
              fill="none"
              stroke={ringColor}
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
          fontWeight: "var(--weight-semibold)",
          color: "var(--ink-primary)",
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
          color: "var(--ink-tertiary)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {detail}
      </div>
    </Card>
  );
}

export default TodayScreen;
