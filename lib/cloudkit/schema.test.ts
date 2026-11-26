import { describe, expect, it } from "vitest";
import {
  decodeEatsRecord,
  decodeTripItemRecord,
  decodeTripRecord,
  encodeEatsRecord,
  isEatsZone,
  tripIDFromZone,
  type ZoneRef,
} from "./schema";

describe("cloudkit zone helpers", () => {
  it("recognizes eats and trip zones", () => {
    expect(isEatsZone("eats")).toBe(true);
    expect(isEatsZone("trip-123")).toBe(false);
    expect(tripIDFromZone("trip-abc-123")).toBe("abc-123");
    expect(tripIDFromZone("eats")).toBeNull();
  });
});

describe("EatsPlace CloudKit codec", () => {
  const sharedZone: ZoneRef = {
    zoneName: "eats",
    ownerRecordName: "_jess_owner_id",
    scope: "shared",
  };

  it("decodes a shared EatsPlace record with visits JSON", () => {
    const place = decodeEatsRecord(
      {
        recordName: "place-1",
        recordType: "EatsPlace",
        recordChangeTag: "tag-9",
        fields: {
          name: { value: "L'Industrie Pizzeria" },
          address: { value: "254 S 2nd St, Brooklyn, NY" },
          sentiment: { value: "loved" },
          rank: { value: 94.5 },
          visitedDay: { value: "2026-10-12" },
          visits: { value: JSON.stringify([{ day: "2026-10-12" }]) },
          notes: { value: "Pizza\nBurrata slice" },
          createdAt: { value: 1791800000000 },
        },
      },
      sharedZone,
    );

    expect(place.isWish).toBe(false);
    expect(place.scope).toBe("shared");
    expect(place.ownerRecordName).toBe("_jess_owner_id");
    expect(place.sentiment).toBe("loved");
    expect(place.visits).toEqual([{ day: "2026-10-12" }]);
  });

  it("round-trips EatsWish through encodeEatsRecord", () => {
    const encoded = encodeEatsRecord({
      id: "wish-1",
      isWish: true,
      scope: "private",
      zoneName: "eats",
      name: "Torrisi",
      address: "275 Mulberry St, New York, NY",
      mapItemID: "",
      sentiment: "liked",
      rank: 0,
      visitedDay: "",
      visits: [],
      notes: "Italian",
      tripID: "",
      tripItemID: "",
      createdAt: 1791800000000,
    });

    expect(encoded.recordType).toBe("EatsWish");
    const decoded = decodeEatsRecord(encoded, { zoneName: "eats", scope: "private" });
    expect(decoded.isWish).toBe(true);
    expect(decoded.name).toBe("Torrisi");
    expect(decoded.notes).toBe("Italian");
  });
});

describe("Trip & TripItem CloudKit codecs", () => {
  const tripZone: ZoneRef = { zoneName: "trip-spain-2026", scope: "private" };

  it("decodes Trip with legs and dayTitles", () => {
    const trip = decodeTripRecord(
      {
        recordName: "spain-2026",
        recordType: "Trip",
        fields: {
          name: { value: "Spain 2026" },
          destination: { value: "Madrid & Barcelona" },
          startDay: { value: "2026-12-24" },
          endDay: { value: "2027-01-04" },
          legs: {
            value: JSON.stringify([
              { id: "l1", name: "Madrid", emoji: "🇪🇸", startDay: "2026-12-25", endDay: "2026-12-29", isHome: false },
            ]),
          },
          dayTitles: { value: JSON.stringify({ "2026-12-25": "Arrive Madrid" }) },
        },
      },
      tripZone,
    );

    expect(trip.name).toBe("Spain 2026");
    expect(trip.legs).toHaveLength(1);
    expect(trip.dayTitles["2026-12-25"]).toBe("Arrive Madrid");
  });

  it("decodes TripItem with transport JSON and cost", () => {
    const item = decodeTripItemRecord(
      {
        recordName: "item-1",
        recordType: "TripItem",
        fields: {
          day: { value: "2026-12-24" },
          kind: { value: "transit" },
          title: { value: "JFK -> MAD" },
          time: { value: 1170 },
          cost: { value: 840 },
          currency: { value: "USD" },
          transport: { value: JSON.stringify({ mode: "flight", flightNumber: "DL 126" }) },
        },
      },
      tripZone,
      "spain-2026",
    );

    expect(item.kind).toBe("transit");
    expect(item.time).toBe(1170);
    expect(item.transport?.flightNumber).toBe("DL 126");
  });
});
