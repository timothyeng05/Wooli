"use client";

import {
  decodeAccountCD,
  decodeCategoryCD,
  decodeEatsRecord,
  decodeMovieCD,
  decodeRecipeCD,
  decodeSightCD,
  decodeTransactionCD,
  decodeTripItemRecord,
  decodeTripRecord,
  encodeEatsRecord,
  isCoreDataZone,
  isEatsZone,
  tripIDFromZone,
  WOOLI_CONTAINER_ID,
  type AccountRecord,
  type BudgetCategoryRecord,
  type CloudKitRecordPayload,
  type EatsPlaceRecord,
  type MovieEntryRecord,
  type RecipeEntryRecord,
  type SightEntryRecord,
  type TransactionRecord,
  type TripItemRecord,
  type TripRecord,
  type ZoneRef,
} from "./schema";

const CLOUDKIT_JS_URL = "https://cdn.apple-cloudkit.com/ck/2/cloudkit.js";

export interface WooliCloudSnapshot {
  userRecordName: string;
  trips: TripRecord[];
  tripItems: TripItemRecord[];
  eats: EatsPlaceRecord[];
  sights: SightEntryRecord[];
  movies: MovieEntryRecord[];
  recipes: RecipeEntryRecord[];
  accounts: AccountRecord[];
  categories: BudgetCategoryRecord[];
  transactions: TransactionRecord[];
  warnings: string[];
}

export function getCloudKitConfig() {
  const apiToken = process.env.NEXT_PUBLIC_CLOUDKIT_API_TOKEN ?? "";
  const environment = (process.env.NEXT_PUBLIC_CLOUDKIT_ENV ?? "production") as "production" | "development";
  const containerIdentifier = process.env.NEXT_PUBLIC_CLOUDKIT_CONTAINER ?? WOOLI_CONTAINER_ID;
  return { apiToken, environment, containerIdentifier };
}

interface CKZoneID {
  zoneName: string;
  ownerRecordName?: string;
}

interface CKZoneChangeResult {
  zoneID?: CKZoneID;
  records?: CloudKitRecordPayload[];
  syncToken?: string;
  moreComing?: boolean;
}

interface CKDatabase {
  fetchAllRecordZones(): Promise<{ zones: Array<{ zoneID: CKZoneID }> }>;
  fetchRecordZoneChanges?(
    zones: Array<{ zoneID: CKZoneID; syncToken?: string }>,
  ): Promise<{ zones?: CKZoneChangeResult[]; hasErrors?: boolean; errors?: Array<{ reason?: string }> }>;
  performQuery(
    query: { recordType: string; zoneID?: CKZoneID },
    options?: { zoneID?: CKZoneID },
  ): Promise<{ records: CloudKitRecordPayload[] }>;
  saveRecords(
    records: CloudKitRecordPayload[],
    options?: { zoneID: CKZoneID },
  ): Promise<{ records: CloudKitRecordPayload[] }>;
  deleteRecords(recordNames: string[], options?: { zoneID: CKZoneID }): Promise<unknown>;
}

interface CKContainer {
  privateCloudDatabase: CKDatabase;
  sharedCloudDatabase: CKDatabase;
  setUpAuth(): Promise<{ userRecordName: string } | null>;
  whenUserSignsIn(): Promise<{ userRecordName: string }>;
  whenUserSignsOut(): Promise<void>;
}

interface CKGlobal {
  configure(cfg: unknown): void;
  getDefaultContainer(): CKContainer;
}

declare global {
  interface Window {
    CloudKit?: CKGlobal;
  }
}

let scriptPromise: Promise<CKGlobal> | null = null;
let configured = false;

export function loadCloudKitScript(): Promise<CKGlobal> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("CloudKit JS only runs in the browser."));
  }
  if (window.CloudKit) return Promise.resolve(window.CloudKit);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CLOUDKIT_JS_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () =>
        window.CloudKit ? resolve(window.CloudKit) : reject(new Error("CloudKit failed to load")),
      );
      existing.addEventListener("error", () => reject(new Error("Failed to load Apple CloudKit JS")));
      return;
    }
    const script = document.createElement("script");
    script.src = CLOUDKIT_JS_URL;
    script.async = true;
    script.onload = () => (window.CloudKit ? resolve(window.CloudKit) : reject(new Error("CloudKit global missing")));
    script.onerror = () => reject(new Error("Failed to load Apple CloudKit JS"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function initCloudKit(): Promise<CKContainer> {
  const { apiToken, environment, containerIdentifier } = getCloudKitConfig();
  if (!apiToken) {
    throw new Error("Missing NEXT_PUBLIC_CLOUDKIT_API_TOKEN");
  }
  const CK = await loadCloudKitScript();
  if (!configured) {
    CK.configure({
      containers: [
        {
          containerIdentifier,
          apiTokenAuth: {
            apiToken,
            persist: true,
            signInButton: { id: "apple-sign-in-button", theme: "black" },
            signOutButton: { id: "apple-sign-out-button", theme: "white-with-outline" },
          },
          environment,
        },
      ],
    });
    configured = true;
  }
  return CK.getDefaultContainer();
}

async function fetchAllRecordsInZone(
  db: CKDatabase,
  zoneID: CKZoneID,
  recordTypes: string[],
  warnings: string[],
): Promise<CloudKitRecordPayload[]> {
  // Prefer fetchRecordZoneChanges (like iOS CKSyncEngine) because it does not
  // require QUERYABLE indexes in CloudKit Console.
  if (typeof db.fetchRecordZoneChanges === "function") {
    try {
      const all: CloudKitRecordPayload[] = [];
      let syncToken: string | undefined;
      for (let page = 0; page < 20; page++) {
        const res = await db.fetchRecordZoneChanges([{ zoneID, ...(syncToken ? { syncToken } : {}) }]);
        const zoneRes = res.zones?.[0];
        if (zoneRes?.records?.length) {
          all.push(...zoneRes.records);
        }
        if (zoneRes?.moreComing && zoneRes.syncToken && zoneRes.syncToken !== syncToken) {
          syncToken = zoneRes.syncToken;
        } else {
          break;
        }
      }
      return all;
    } catch (err) {
      warnings.push(`Zone ${zoneID.zoneName} changes fallback: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const fallback: CloudKitRecordPayload[] = [];
  for (const recordType of recordTypes) {
    try {
      const res = await db.performQuery({ recordType, zoneID }, { zoneID });
      if (res.records?.length) fallback.push(...res.records);
    } catch (err) {
      warnings.push(`${zoneID.zoneName}/${recordType}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return fallback;
}

export async function fetchWooliCloudSnapshot(container: CKContainer, userRecordName: string): Promise<WooliCloudSnapshot> {
  const warnings: string[] = [];

  const [privZonesRes, sharedZonesRes] = await Promise.all([
    container.privateCloudDatabase.fetchAllRecordZones().catch((err) => {
      warnings.push(`private zones: ${err instanceof Error ? err.message : String(err)}`);
      return { zones: [] };
    }),
    container.sharedCloudDatabase.fetchAllRecordZones().catch((err) => {
      warnings.push(`shared zones: ${err instanceof Error ? err.message : String(err)}`);
      return { zones: [] };
    }),
  ]);

  const zones: Array<{ db: CKDatabase; rawZoneID: CKZoneID; ref: ZoneRef }> = [
    ...(privZonesRes.zones ?? []).map((z) => ({
      db: container.privateCloudDatabase,
      rawZoneID: z.zoneID,
      ref: { zoneName: z.zoneID.zoneName, ownerRecordName: z.zoneID.ownerRecordName, scope: "private" as const },
    })),
    ...(sharedZonesRes.zones ?? []).map((z) => ({
      db: container.sharedCloudDatabase,
      rawZoneID: z.zoneID,
      ref: { zoneName: z.zoneID.zoneName, ownerRecordName: z.zoneID.ownerRecordName, scope: "shared" as const },
    })),
  ];

  const trips: TripRecord[] = [];
  const tripItems: TripItemRecord[] = [];
  const eats: EatsPlaceRecord[] = [];
  const sights: SightEntryRecord[] = [];
  const movies: MovieEntryRecord[] = [];
  const recipes: RecipeEntryRecord[] = [];
  const accounts: AccountRecord[] = [];
  const categories: BudgetCategoryRecord[] = [];
  const transactions: TransactionRecord[] = [];

  await Promise.all(
    zones.map(async ({ db, rawZoneID, ref }) => {
      if (isEatsZone(ref.zoneName)) {
        const recs = await fetchAllRecordsInZone(db, rawZoneID, ["EatsPlace", "EatsWish"], warnings);
        for (const rec of recs) {
          if (rec.recordType === "EatsPlace" || rec.recordType === "EatsWish") {
            eats.push(decodeEatsRecord(rec, ref));
          }
        }
        return;
      }
      if (isCoreDataZone(ref.zoneName)) {
        const recs = await fetchAllRecordsInZone(
          db,
          rawZoneID,
          ["CD_SightEntry", "CD_MovieEntry", "CD_RecipeEntry", "CD_LocalAccount", "CD_BudgetCategory", "CD_LocalTransaction"],
          warnings,
        );
        for (const rec of recs) {
          switch (rec.recordType) {
            case "CD_SightEntry":
              sights.push(decodeSightCD(rec));
              break;
            case "CD_MovieEntry":
              movies.push(decodeMovieCD(rec));
              break;
            case "CD_RecipeEntry":
              recipes.push(decodeRecipeCD(rec));
              break;
            case "CD_LocalAccount":
              accounts.push(decodeAccountCD(rec));
              break;
            case "CD_BudgetCategory":
              categories.push(decodeCategoryCD(rec));
              break;
            case "CD_LocalTransaction":
              transactions.push(decodeTransactionCD(rec));
              break;
          }
        }
        return;
      }
      const tripID = tripIDFromZone(ref.zoneName);
      if (tripID) {
        const recs = await fetchAllRecordsInZone(db, rawZoneID, ["Trip", "TripItem"], warnings);
        for (const rec of recs) {
          if (rec.recordType === "Trip") trips.push(decodeTripRecord(rec, ref));
          else if (rec.recordType === "TripItem") tripItems.push(decodeTripItemRecord(rec, ref, tripID));
        }
      }
    }),
  );

  trips.sort((a, b) => b.startDay.localeCompare(a.startDay));
  eats.sort((a, b) => b.rank - a.rank);
  movies.sort((a, b) => b.rank - a.rank);
  transactions.sort((a, b) => b.transactedAt - a.transactedAt);

  return { userRecordName, trips, tripItems, eats, sights, movies, recipes, accounts, categories, transactions, warnings };
}

export async function saveEatsPlaceToCloud(container: CKContainer, place: EatsPlaceRecord): Promise<EatsPlaceRecord> {
  const db = place.scope === "shared" ? container.sharedCloudDatabase : container.privateCloudDatabase;
  const zoneID: CKZoneID = { zoneName: place.zoneName, ownerRecordName: place.ownerRecordName };
  const res = await db.saveRecords([encodeEatsRecord(place)], { zoneID });
  const saved = res.records?.[0];
  if (!saved) return place;
  return decodeEatsRecord(saved, {
    zoneName: place.zoneName,
    ownerRecordName: place.ownerRecordName,
    scope: place.scope,
  });
}
