import type { Category, Movie, Place, Recipe, Sight, Trip, Txn } from "@/app/demo/data";
import type {
  AccountRecord,
  BudgetCategoryRecord,
  EatsPlaceRecord,
  MovieEntryRecord,
  RecipeEntryRecord,
  SightEntryRecord,
  TransactionRecord,
  TripItemRecord,
  TripRecord,
} from "./schema";

function formatClock(minutes?: number): string {
  if (typeof minutes !== "number") return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function toDemoTrips(trips: TripRecord[], items: TripItemRecord[]): Trip[] {
  return trips.map((t) => {
    const tItems = items
      .filter((i) => i.tripID === t.id)
      .sort((a, b) => (a.day ?? "").localeCompare(b.day ?? "") || (a.time ?? 9999) - (b.time ?? 9999));

    const firstFlight = tItems.find((i) => i.kind === "transit" && i.transport?.mode === "flight");

    const cities = t.legs
      .filter((l) => !l.isHome)
      .map((l, idx) => {
        const legItems = tItems.filter((i) => i.day && i.day >= l.startDay && i.day <= l.endDay);
        const byDay = new Map<string, TripItemRecord[]>();
        for (const item of legItems) {
          const d = item.day ?? l.startDay;
          const arr = byDay.get(d) ?? [];
          arr.push(item);
          byDay.set(d, arr);
        }
        return {
          id: l.id,
          name: l.emoji ? `${l.emoji} ${l.name}` : l.name,
          dates: `${l.startDay} – ${l.endDay}`,
          nights: Math.max(
            1,
            Math.round((new Date(l.endDay).getTime() - new Date(l.startDay).getTime()) / 86400000),
          ),
          x: 25 + ((idx * 22) % 55),
          y: 35 + ((idx * 17) % 45),
          days: Array.from(byDay.entries()).map(([day, dayItems]) => ({
            label: t.dayTitles[day] ? `${day} · ${t.dayTitles[day]}` : day,
            plans: dayItems.map((i) => ({
              time: formatClock(i.time),
              kind: i.kind,
              title: i.title,
              sub: [i.placeName, i.transport?.flightNumber, i.notes].filter(Boolean).join(" · "),
            })),
          })),
        };
      });

    return {
      id: t.id,
      name: t.scope === "shared" ? `${t.name} (Shared)` : t.name,
      dates: t.startDay && t.endDay ? `${t.startDay} – ${t.endDay}` : "Dates TBD",
      countdown: t.destination || "iCloud Trip",
      from: firstFlight?.transport?.fromAirport || "HOME",
      fromCity: "Origin",
      to: firstFlight?.transport?.toAirport || t.destination || "DEST",
      toCity: t.destination || "Destination",
      flight: firstFlight?.transport?.flightNumber || "Planned",
      times: firstFlight ? formatClock(firstFlight.time) : `${t.startDay} → ${t.endDay}`,
      people: t.scope === "shared" ? ["You", "Shared"] : ["You"],
      cities:
        cities.length > 0
          ? cities
          : [
              {
                id: `${t.id}-all`,
                name: t.destination || t.name,
                dates: `${t.startDay} – ${t.endDay}`,
                nights: 1,
                x: 50,
                y: 50,
                days: [],
              },
            ],
      ideas: tItems
        .filter((i) => !i.day)
        .map((i) => ({ title: i.title, sub: i.notes || i.placeName || "Idea", kind: i.kind })),
      bookings: tItems
        .filter((i) => i.kind === "transit" || i.kind === "stay")
        .map((i) => ({
          kind: i.kind,
          what: i.title,
          when: i.day ? `${i.day}${i.time ? ` · ${formatClock(i.time)}` : ""}` : "Unscheduled",
          ref: i.transport?.confirmation || (i.cost ? `${i.currency ?? "USD"} ${i.cost}` : "Saved"),
          status: "Confirmed" as const,
        })),
    };
  });
}

const SENTIMENT_EMOJI: Record<EatsPlaceRecord["sentiment"], string> = {
  loved: "😍",
  liked: "😋",
  fine: "🙂",
  disliked: "😕",
};

export function toDemoEats(eats: EatsPlaceRecord[]): Place[] {
  return eats.map((p) => {
    const firstLine = p.notes.split("\n")[0]?.trim() || "";
    const cuisine = firstLine && !firstLine.startsWith("http") ? firstLine : p.isWish ? "Want to try" : "Eats";
    return {
      id: p.id,
      name: p.scope === "shared" ? `${p.name} · Shared` : p.name,
      cuisine,
      area: p.address || "Saved",
      price: p.isWish ? "Wish" : p.sentiment,
      emoji: p.isWish ? "📌" : SENTIMENT_EMOJI[p.sentiment],
      note: p.notes,
      visits: p.visits.map((v) => ({
        date: v.day,
        who: p.scope === "shared" ? "shared list" : "you",
        ate: v.notes ?? "",
      })),
    };
  });
}

export function toDemoSights(sights: SightEntryRecord[]): Sight[] {
  return sights.map((s) => ({
    id: s.id,
    name: s.name,
    city: s.address.split(",").slice(-2, -1)[0]?.trim() || s.address || "Saved",
    category: s.visitedDay ? "Visited" : "Want to go",
    visited: Boolean(s.visitedDay),
    notes: s.notes,
    lat: s.latitude ?? 0,
    lng: s.longitude ?? 0,
  }));
}

export function toDemoMovies(movies: MovieEntryRecord[]): Movie[] {
  return movies
    .filter((m) => !m.isWishlist)
    .map((m) => ({
      title: m.title,
      year: Number(m.year) || 0,
      genre: m.genre || "Film",
      director: m.director || "",
      feel: m.sentiment === "loved" ? "Loved" : m.sentiment === "fine" || m.sentiment === "disliked" ? "Fine" : "Liked",
      seen: m.watchedDay || "",
    }));
}

export function toDemoRecipes(recipes: RecipeEntryRecord[]): Recipe[] {
  return recipes.map((r) => ({
    id: r.id,
    name: r.title || "Untitled Recipe",
    emoji: "🍳",
    meal: r.meal || "Meal",
    mins: r.minutes || 30,
    from: r.cuisine || (r.sourceURL ? "Saved from reel" : "Saved"),
    ingredients: r.ingredientsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => ({ name: line, amount: "" })),
    steps: r.stepsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  }));
}

export function toDemoAccounts(accounts: AccountRecord[]) {
  return accounts
    .filter((a) => !a.isHidden)
    .map((a) => ({
      name: a.nickname || a.name,
      kind: a.kindRaw || "Account",
      balance: a.balance,
      logo: "/wooli-icon.png",
    }));
}

export function toDemoCategories(categories: BudgetCategoryRecord[], txns: TransactionRecord[]): Category[] {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const spentByCat: Record<string, number> = {};
  for (const t of txns) {
    if (!t.isHidden && !t.isTransfer && !t.isSplit && t.transactedAt >= monthStart && t.categoryId && t.amount < 0) {
      spentByCat[t.categoryId] = (spentByCat[t.categoryId] ?? 0) + Math.abs(t.amount);
    }
  }
  return categories
    .filter((c) => !c.isIncome && !c.isTransfer)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({
      id: c.id,
      name: c.name,
      emoji: c.icon || "•",
      group: "home" as const,
      plan: c.monthlyTarget,
      spent: Math.round(spentByCat[c.id] ?? 0),
      last: 0,
    }));
}

export function toDemoTxns(txns: TransactionRecord[], accounts: AccountRecord[]) {
  const acctName = new Map(accounts.map((a) => [a.providerAccountId, a.nickname || a.name]));
  const formatDay = (ts: number) =>
    new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const visible = txns.filter((t) => !t.isHidden && !t.isSplit);
  const toTxn = (t: TransactionRecord): Txn => ({
    id: t.id,
    payee: t.customTitle || t.payee || t.description,
    amount: t.amount,
    date: formatDay(t.transactedAt),
    account: acctName.get(t.accountId) || "Account",
    category: t.categoryId,
  });

  return {
    review: visible.filter((t) => t.needsReview).slice(0, 50).map(toTxn),
    posted: visible.filter((t) => !t.needsReview).slice(0, 100).map(toTxn),
  };
}
