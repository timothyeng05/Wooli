"use client";

import {
  decodeEatsRecord,
  decodeTripItemRecord,
  decodeTripRecord,
  encodeEatsRecord,
  isEatsZone,
  tripIDFromZone,
  WOOLI_CONTAINER_ID,
  type CloudKitRecordPayload,
  type EatsPlaceRecord,
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
}

export function getCloudKitConfig() {
  const apiToken = process.env.NEXT_PUBLIC_CLOUDKIT_API_TOKEN ?? "";
  const environment = (process.env.NEXT_PUBLIC_CLOUDKIT_ENV ?? "production") as "production" | "development";
  const containerIdentifier = process.env.NEXT_PUBLIC_CLOUDKIT_CONTAINER ?? WOOLI_CONTAINER_ID;
  return { apiToken, environment, containerIdentifier };
}

interface CKDatabase {
  fetchAllRecordZones(): Promise<{ zones: Array<{ zoneID: { zoneName: string; ownerRecordName?: string } }> }>;
  performQuery(
    query: { recordType: string },
    options?: { zoneID: { zoneName: string; ownerRecordName?: string } },
  ): Promise<{ records: CloudKitRecordPayload[] }>;
  saveRecords(
    records: CloudKitRecordPayload[],
    options?: { zoneID: { zoneName: string; ownerRecordName?: string } },
  ): Promise<{ records: CloudKitRecordPayload[] }>;
  deleteRecords(
    recordNames: string[],
    options?: { zoneID: { zoneName: string; ownerRecordName?: string } },
  ): Promise<unknown>;
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
      existing.addEventListener("load", () => (window.CloudKit ? resolve(window.CloudKit) : reject(new Error("CloudKit failed to load"))));
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

async function queryZone(db: CKDatabase, zone: ZoneRef, recordType: string): Promise<CloudKitRecordPayload[]> {
  try {
    const res = await db.performQuery(
      { recordType },
      { zoneID: { zoneName: zone.zoneName, ownerRecordName: zone.ownerRecordName } },
    );
    return res.records ?? [];
  } catch {
    return [];
  }
}

export async function fetchWooliCloudSnapshot(container: CKContainer, userRecordName: string): Promise<WooliCloudSnapshot> {
  const [privZonesRes, sharedZonesRes] = await Promise.all([
    container.privateCloudDatabase.fetchAllRecordZones().catch(() => ({ zones: [] })),
    container.sharedCloudDatabase.fetchAllRecordZones().catch(() => ({ zones: [] })),
  ]);

  const zones: Array<{ db: CKDatabase; ref: ZoneRef }> = [
    ...(privZonesRes.zones ?? []).map((z) => ({
      db: container.privateCloudDatabase,
      ref: { zoneName: z.zoneID.zoneName, ownerRecordName: z.zoneID.ownerRecordName, scope: "private" as const },
    })),
    ...(sharedZonesRes.zones ?? []).map((z) => ({
      db: container.sharedCloudDatabase,
      ref: { zoneName: z.zoneID.zoneName, ownerRecordName: z.zoneID.ownerRecordName, scope: "shared" as const },
    })),
  ];

  const trips: TripRecord[] = [];
  const tripItems: TripItemRecord[] = [];
  const eats: EatsPlaceRecord[] = [];

  await Promise.all(
    zones.map(async ({ db, ref }) => {
      if (isEatsZone(ref.zoneName)) {
        const [places, wishes] = await Promise.all([
          queryZone(db, ref, "EatsPlace"),
          queryZone(db, ref, "EatsWish"),
        ]);
        for (const rec of [...places, ...wishes]) {
          eats.push(decodeEatsRecord(rec, ref));
        }
        return;
      }
      const tripID = tripIDFromZone(ref.zoneName);
      if (tripID) {
        const [tripRecs, itemRecs] = await Promise.all([
          queryZone(db, ref, "Trip"),
          queryZone(db, ref, "TripItem"),
        ]);
        for (const rec of tripRecs) trips.push(decodeTripRecord(rec, ref));
        for (const rec of itemRecs) tripItems.push(decodeTripItemRecord(rec, ref, tripID));
      }
    }),
  );

  trips.sort((a, b) => b.startDay.localeCompare(a.startDay));
  eats.sort((a, b) => b.rank - a.rank);

  return { userRecordName, trips, tripItems, eats };
}

export async function saveEatsPlaceToCloud(container: CKContainer, place: EatsPlaceRecord): Promise<EatsPlaceRecord> {
  const db = place.scope === "shared" ? container.sharedCloudDatabase : container.privateCloudDatabase;
  const zoneID = { zoneName: place.zoneName, ownerRecordName: place.ownerRecordName };
  const res = await db.saveRecords([encodeEatsRecord(place)], { zoneID });
  const saved = res.records?.[0];
  if (!saved) return place;
  return decodeEatsRecord(saved, {
    zoneName: place.zoneName,
    ownerRecordName: place.ownerRecordName,
    scope: place.scope,
  });
}
