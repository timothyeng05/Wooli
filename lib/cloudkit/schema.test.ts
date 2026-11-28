import { describe, expect, it } from "vitest";
import { toDemoCategories, toDemoEats, toDemoTrips } from "./adapter";
import { fetchWooliCloudSnapshot } from "./client";
import {
  COREDATA_ZONE_NAME,
  decodeAccountCD,
  decodeCategoryCD,
  decodeEatsRecord,
  decodeMovieCD,
  decodeRecipeCD,
  decodeRecurringCD,
  decodeSightCD,
  decodeTransactionCD,
  decodeTripItemRecord,
  decodeTripRecord,
  encodeEatsRecord,
  isEatsZone,
  tripIDFromZone,
  type CloudKitRecordPayload,
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

  it("decodes Trip extras, TripItem extras, isHiddenPlaceholder, and excludes cancelled/placeholders in toDemoTrips", () => {
    const trip = decodeTripRecord(
      {
        recordName: "spain-2026",
        recordType: "Trip",
        fields: {
          name: { value: "Spain 2026" },
          startDay: { value: "2026-12-24" },
          endDay: { value: "2027-01-04" },
          legs: {
            value: JSON.stringify([
              { id: "l1", name: "Madrid", emoji: "🇪🇸", startDay: "2026-12-24", endDay: "2026-12-29", isHome: false, countryCode: "ES" },
            ]),
          },
          extras: { value: JSON.stringify({ budget: 5000, budgetCurrency: "USD", travelers: 2 }) },
        },
      },
      tripZone,
    );

    expect(trip.extras?.budget).toBe(5000);
    expect(trip.legs[0].countryCode).toBe("ES");

    const activeStay = decodeTripItemRecord(
      {
        recordName: "stay-1",
        recordType: "TripItem",
        fields: {
          day: { value: "2026-12-25" },
          kind: { value: "stay" },
          title: { value: "Hotel" },
          extras: { value: JSON.stringify({ status: "booked", url: "https://example.com" }) },
        },
      },
      tripZone,
      "spain-2026",
    );
    const cancelledFlight = decodeTripItemRecord(
      {
        recordName: "flight-cancelled",
        recordType: "TripItem",
        fields: {
          day: { value: "2026-12-24" },
          kind: { value: "transit" },
          title: { value: "Old Flight" },
          extras: { value: JSON.stringify({ status: "cancelled" }) },
        },
      },
      tripZone,
      "spain-2026",
    );
    const placeholder = decodeTripItemRecord(
      {
        recordName: "meal-placeholder",
        recordType: "TripItem",
        fields: {
          day: { value: "2026-12-25" },
          kind: { value: "meal" },
          title: { value: "Lunch" },
        },
      },
      tripZone,
      "spain-2026",
    );

    expect(activeStay.isHiddenPlaceholder).toBe(false);
    expect(cancelledFlight.extras?.status).toBe("cancelled");
    expect(placeholder.isHiddenPlaceholder).toBe(true);

    const demo = toDemoTrips([trip], [activeStay, cancelledFlight, placeholder]);
    expect(demo[0].bookings).toHaveLength(1);
    expect(demo[0].bookings[0].what).toBe("Hotel");
    expect(demo[0].cities[0].days[0].plans).toHaveLength(1);
  });
});

describe("mustTry sentiment, EatsVisit.note, and CoreData decoders", () => {
  it("preserves mustTry sentiment and EatsVisit.note", () => {
    const place = decodeEatsRecord(
      {
        recordName: "p1",
        recordType: "EatsPlace",
        fields: {
          name: { value: "Atomix" },
          sentiment: { value: "mustTry" },
          visits: { value: JSON.stringify([{ id: "v1", day: "2026-11-01", note: "Tasting menu" }]) },
        },
      },
      { zoneName: "eats", scope: "private" },
    );
    expect(place.sentiment).toBe("mustTry");
    expect(place.visits[0].note).toBe("Tasting menu");

    const demo = toDemoEats([place]);
    expect(demo[0].emoji).toBe("⭐️");
    expect(demo[0].visits[0].ate).toBe("Tasting menu");
  });

  it("decodes CoreData account, category, transaction, movie, sight, recipe, recurring fields", () => {
    const acc = decodeAccountCD({
      recordName: "acc-rec",
      recordType: "CD_LocalAccount",
      fields: {
        CD_providerAccountId: { value: "sf-1" },
        CD_name: { value: "Checking" },
        CD_hideTransactions: { value: 1 },
        CD_ownerId: { value: "tim" },
        CD_balanceDate: { value: 1700000000000 },
      },
    });
    expect(acc.hideTransactions).toBe(true);
    expect(acc.ownerId).toBe("tim");
    expect(acc.balanceDate).toBe(1700000000000);

    const cat = decodeCategoryCD({
      recordName: "cat-rec",
      recordType: "CD_BudgetCategory",
      fields: {
        CD_id: { value: "groceries" },
        CD_name: { value: "Groceries" },
        CD_monthlyTarget: { value: 600 },
        CD_rolloverEnabled: { value: 1 },
        CD_rolloverBalance: { value: 45 },
        CD_rolloverThrough: { value: "2026-11" },
        CD_colorHex: { value: "#22c55e" },
      },
    });
    expect(cat.rolloverEnabled).toBe(true);
    expect(cat.rolloverBalance).toBe(45);
    expect(cat.colorHex).toBe("#22c55e");

    const tx = decodeTransactionCD({
      recordName: "tx-rec",
      recordType: "CD_LocalTransaction",
      fields: {
        CD_providerTransactionId: { value: "tx-1#split-1" },
        CD_accountId: { value: "sf-1" },
        CD_amount: { value: -50 },
        CD_splitParentId: { value: "tx-1" },
        CD_isPending: { value: 1 },
        CD_note: { value: "Half" },
        CD_normalizedMerchant: { value: "costco" },
      },
    });
    expect(tx.needsReview).toBe(true);
    expect(tx.splitParentId).toBe("tx-1");
    expect(tx.isPending).toBe(true);
    expect(tx.note).toBe("Half");

    const movie = decodeMovieCD({
      recordName: "m1",
      recordType: "CD_MovieEntry",
      fields: {
        CD_title: { value: "Spirited Away" },
        CD_sentimentRaw: { value: "mustTry" },
        CD_posterURL: { value: "https://img/poster.jpg" },
        CD_appleID: { value: "tmdb:129" },
      },
    });
    expect(movie.sentiment).toBe("mustTry");
    expect(movie.posterURL).toBe("https://img/poster.jpg");

    const sight = decodeSightCD({
      recordName: "s1",
      recordType: "CD_SightEntry",
      fields: { CD_name: { value: "Fushimi Inari" }, CD_mapItemID: { value: "I123" } },
    });
    expect(sight.mapItemID).toBe("I123");

    const recipe = decodeRecipeCD({
      recordName: "r1",
      recordType: "CD_RecipeEntry",
      fields: { CD_title: { value: "Pasta" }, CD_mainIngredient: { value: "Pasta" }, CD_tagVersion: { value: 2 } },
    });
    expect(recipe.mainIngredient).toBe("Pasta");
    expect(recipe.tagVersion).toBe(2);

    const recItem = decodeRecurringCD({
      recordName: "rec-1",
      recordType: "CD_RecurringItem",
      fields: {
        CD_id: { value: "rec-1" },
        CD_merchant: { value: "netflix" },
        CD_title: { value: "Netflix" },
        CD_amount: { value: -15.99 },
        CD_cadenceRaw: { value: "monthly" },
      },
    });
    expect(recItem.isActive).toBe(true);
    expect(recItem.amount).toBe(-15.99);
  });

  it("subtracts refunds in toDemoCategories", () => {
    const now = Date.now();
    const cats = [
      decodeCategoryCD({
        recordName: "c1",
        recordType: "CD_BudgetCategory",
        fields: { CD_id: { value: "shopping" }, CD_name: { value: "Shopping" }, CD_monthlyTarget: { value: 200 } },
      }),
    ];
    const txns = [
      decodeTransactionCD({
        recordName: "t1",
        recordType: "CD_LocalTransaction",
        fields: { CD_categoryId: { value: "shopping" }, CD_amount: { value: -120 }, CD_transactedAt: { value: now } },
      }),
      decodeTransactionCD({
        recordName: "t2",
        recordType: "CD_LocalTransaction",
        fields: { CD_categoryId: { value: "shopping" }, CD_amount: { value: 30 }, CD_transactedAt: { value: now } },
      }),
    ];
    const demo = toDemoCategories(cats, txns);
    expect(demo[0].spent).toBe(90);
  });
});

describe("fetchWooliCloudSnapshot pagination and tombstone filtering", () => {
  it("fetches beyond 20 pages, skips deleted tombstones, and decodes CD_RecurringItem", async () => {
    let pageCalls = 0;
    const mockContainer = {
      privateCloudDatabase: {
        async fetchAllRecordZones() {
          return { zones: [{ zoneID: { zoneName: COREDATA_ZONE_NAME } }] };
        },
        async fetchRecordZoneChanges(zones: Array<{ zoneID: { zoneName: string }; syncToken?: string }>) {
          pageCalls += 1;
          const nextToken = `tok-${pageCalls}`;
          const isLast = pageCalls === 25;
          const records: CloudKitRecordPayload[] =
            pageCalls === 1
              ? [
                  {
                    recordName: "tx-deleted",
                    recordType: "CD_LocalTransaction",
                    deleted: true,
                    fields: {},
                  },
                  {
                    recordName: "rec-1",
                    recordType: "CD_RecurringItem",
                    fields: { CD_id: { value: "rec-1" }, CD_title: { value: "Rent" }, CD_amount: { value: -3000 } },
                  },
                ]
              : [
                  {
                    recordName: `tx-${pageCalls}`,
                    recordType: "CD_LocalTransaction",
                    fields: { CD_amount: { value: -10 }, CD_transactedAt: { value: 1700000000000 } },
                  },
                ];
          return {
            zones: [{ zoneID: zones[0].zoneID, records, syncToken: nextToken, moreComing: !isLast }],
          };
        },
        async performQuery() {
          return { records: [] };
        },
        async saveRecords() {
          return { records: [] };
        },
        async deleteRecords() {
          return {};
        },
      },
      sharedCloudDatabase: {
        async fetchAllRecordZones() {
          return { zones: [] };
        },
        async performQuery() {
          return { records: [] };
        },
        async saveRecords() {
          return { records: [] };
        },
        async deleteRecords() {
          return {};
        },
      },
      async setUpAuth() {
        return null;
      },
      async whenUserSignsIn() {
        return { userRecordName: "_u1" };
      },
      async whenUserSignsOut() {},
    };

    const snap = await fetchWooliCloudSnapshot(mockContainer, "_u1");
    expect(pageCalls).toBe(25);
    expect(snap.transactions).toHaveLength(24);
    expect(snap.transactions.some((t) => t.id === "tx-deleted")).toBe(false);
    expect(snap.recurringItems).toHaveLength(1);
    expect(snap.recurringItems[0].title).toBe("Rent");
  });
});
