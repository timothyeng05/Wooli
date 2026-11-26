import type { Place, Trip } from "@/app/demo/data";
import type { EatsPlaceRecord, TripItemRecord, TripRecord } from "./schema";

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
