// CloudKit schema types and encoders/decoders matching:
// - ios/Wooli/Wooli/Eats/EatsModels.swift & EatsBook.swift
// - ios/Wooli/Wooli/Trips/TripModels.swift & TripStore.swift

export const WOOLI_CONTAINER_ID = "iCloud.com.timothyeng.wooli";
export const EATS_ZONE_NAME = "eats";
export const TRIP_ZONE_PREFIX = "trip-";
export const COREDATA_ZONE_NAME = "com.apple.coredata.cloudkit.zone";

export type DatabaseScope = "private" | "shared";

export interface ZoneRef {
  zoneName: string;
  ownerRecordName?: string;
  scope: DatabaseScope;
}

export interface CloudKitFieldValue {
  value: unknown;
  type?: string;
}

export interface CloudKitRecordPayload {
  recordName: string;
  recordType: string;
  recordChangeTag?: string;
  created?: { timestamp: number };
  fields: Record<string, CloudKitFieldValue>;
}

export type MealSentiment = "loved" | "liked" | "fine" | "disliked";

export interface EatsVisit {
  id?: string;
  day: string;
  notes?: string;
}

export interface EatsPlaceRecord {
  id: string;
  isWish: boolean;
  scope: DatabaseScope;
  zoneName: string;
  ownerRecordName?: string;
  recordChangeTag?: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  mapItemID: string;
  sentiment: MealSentiment;
  rank: number;
  visitedDay: string;
  visits: EatsVisit[];
  notes: string;
  tripID: string;
  tripItemID: string;
  createdAt: number;
}

export interface TripLeg {
  id: string;
  name: string;
  emoji: string;
  startDay: string;
  endDay: string;
  isHome: boolean;
}

export interface TripRecord {
  id: string;
  scope: DatabaseScope;
  zoneName: string;
  ownerRecordName?: string;
  recordChangeTag?: string;
  name: string;
  destination: string;
  startDay: string;
  endDay: string;
  notes: string;
  dayTitles: Record<string, string>;
  legs: TripLeg[];
}

export type TripItemKind = "activity" | "meal" | "transit" | "stay" | "note";

export interface TripTransport {
  mode: "flight" | "train";
  flightNumber?: string;
  airline?: string;
  fromAirport?: string;
  toAirport?: string;
  seats?: string;
  confirmation?: string;
}

export interface TripItemRecord {
  id: string;
  tripID: string;
  scope: DatabaseScope;
  zoneName: string;
  ownerRecordName?: string;
  day?: string;
  kind: TripItemKind;
  title: string;
  time?: number;
  notes: string;
  placeName?: string;
  placeAddress?: string;
  latitude?: number;
  longitude?: number;
  checkOutDay?: string;
  order?: number;
  cost?: number;
  currency?: string;
  points?: number;
  pointsProgram?: string;
  transport?: TripTransport;
  createdAt: number;
}

export function isEatsZone(zoneName: string): boolean {
  return zoneName === EATS_ZONE_NAME;
}

export function tripIDFromZone(zoneName: string): string | null {
  return zoneName.startsWith(TRIP_ZONE_PREFIX) ? zoneName.slice(TRIP_ZONE_PREFIX.length) : null;
}

function field<T>(fields: Record<string, CloudKitFieldValue>, key: string): T | undefined {
  const entry = fields[key];
  return entry ? (entry.value as T) : undefined;
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function decodeEatsRecord(rec: CloudKitRecordPayload, zone: ZoneRef): EatsPlaceRecord {
  const f = rec.fields ?? {};
  const visitedDay = field<string>(f, "visitedDay") ?? "";
  let visits = parseJson<EatsVisit[]>(field<string>(f, "visits"), []);
  if (visits.length === 0 && visitedDay) {
    visits = [{ day: visitedDay }];
  }
  const sentimentRaw = field<string>(f, "sentiment");
  const sentiment: MealSentiment =
    sentimentRaw === "loved" || sentimentRaw === "liked" || sentimentRaw === "fine" || sentimentRaw === "disliked"
      ? sentimentRaw
      : "liked";

  return {
    id: rec.recordName,
    isWish: rec.recordType === "EatsWish",
    scope: zone.scope,
    zoneName: zone.zoneName,
    ownerRecordName: zone.ownerRecordName,
    recordChangeTag: rec.recordChangeTag,
    name: field<string>(f, "name") ?? "",
    address: field<string>(f, "address") ?? "",
    latitude: field<number>(f, "latitude"),
    longitude: field<number>(f, "longitude"),
    mapItemID: field<string>(f, "mapItemID") ?? "",
    sentiment,
    rank: field<number>(f, "rank") ?? 0,
    visitedDay,
    visits,
    notes: field<string>(f, "notes") ?? "",
    tripID: field<string>(f, "tripID") ?? "",
    tripItemID: field<string>(f, "tripItemID") ?? "",
    createdAt: field<number>(f, "createdAt") ?? rec.created?.timestamp ?? Date.now(),
  };
}

export function encodeEatsRecord(place: EatsPlaceRecord): CloudKitRecordPayload {
  const fields: Record<string, CloudKitFieldValue> = {
    name: { value: place.name },
    address: { value: place.address },
    mapItemID: { value: place.mapItemID },
    sentiment: { value: place.sentiment },
    rank: { value: place.rank },
    visitedDay: { value: place.visitedDay },
    visits: { value: JSON.stringify(place.visits) },
    notes: { value: place.notes },
    tripID: { value: place.tripID },
    tripItemID: { value: place.tripItemID },
    createdAt: { value: place.createdAt },
  };
  if (typeof place.latitude === "number") fields.latitude = { value: place.latitude };
  if (typeof place.longitude === "number") fields.longitude = { value: place.longitude };

  return {
    recordName: place.id,
    recordType: place.isWish ? "EatsWish" : "EatsPlace",
    recordChangeTag: place.recordChangeTag,
    fields,
  };
}

export function decodeTripRecord(rec: CloudKitRecordPayload, zone: ZoneRef): TripRecord {
  const f = rec.fields ?? {};
  return {
    id: rec.recordName,
    scope: zone.scope,
    zoneName: zone.zoneName,
    ownerRecordName: zone.ownerRecordName,
    recordChangeTag: rec.recordChangeTag,
    name: field<string>(f, "name") ?? "Untitled Trip",
    destination: field<string>(f, "destination") ?? "",
    startDay: field<string>(f, "startDay") ?? "",
    endDay: field<string>(f, "endDay") ?? "",
    notes: field<string>(f, "notes") ?? "",
    dayTitles: parseJson<Record<string, string>>(field<string>(f, "dayTitles"), {}),
    legs: parseJson<TripLeg[]>(field<string>(f, "legs"), []),
  };
}

export function decodeTripItemRecord(rec: CloudKitRecordPayload, zone: ZoneRef, tripID: string): TripItemRecord {
  const f = rec.fields ?? {};
  const kindRaw = field<string>(f, "kind");
  const kind: TripItemKind =
    kindRaw === "activity" || kindRaw === "meal" || kindRaw === "transit" || kindRaw === "stay" || kindRaw === "note"
      ? kindRaw
      : "activity";

  return {
    id: rec.recordName,
    tripID,
    scope: zone.scope,
    zoneName: zone.zoneName,
    ownerRecordName: zone.ownerRecordName,
    day: field<string>(f, "day"),
    kind,
    title: field<string>(f, "title") ?? "",
    time: field<number>(f, "time"),
    notes: field<string>(f, "notes") ?? "",
    placeName: field<string>(f, "placeName"),
    placeAddress: field<string>(f, "placeAddress"),
    latitude: field<number>(f, "latitude"),
    longitude: field<number>(f, "longitude"),
    checkOutDay: field<string>(f, "checkOutDay"),
    order: field<number>(f, "order"),
    cost: field<number>(f, "cost"),
    currency: field<string>(f, "currency"),
    points: field<number>(f, "points"),
    pointsProgram: field<string>(f, "pointsProgram"),
    transport: parseJson<TripTransport | undefined>(field<string>(f, "transport"), undefined),
    createdAt: field<number>(f, "createdAt") ?? rec.created?.timestamp ?? Date.now(),
  };
}

export interface SightEntryRecord {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  visitedDay: string;
  notes: string;
}

export interface MovieEntryRecord {
  id: string;
  title: string;
  year: string;
  director: string;
  genre: string;
  sentiment: MealSentiment;
  rank: number;
  watchedDay: string;
  notes: string;
  isWishlist: boolean;
}

export interface RecipeEntryRecord {
  id: string;
  title: string;
  ingredientsText: string;
  stepsText: string;
  notes: string;
  sourceURL: string;
  meal: string;
  cuisine: string;
  minutes: number;
}

export interface AccountRecord {
  id: string;
  providerAccountId: string;
  name: string;
  nickname: string;
  institutionName: string;
  currency: string;
  balance: number;
  kindRaw: string;
  isHidden: boolean;
}

export interface BudgetCategoryRecord {
  id: string;
  name: string;
  icon: string;
  parentId?: string;
  isIncome: boolean;
  isTransfer: boolean;
  sortOrder: number;
  monthlyTarget: number;
}

export interface TransactionRecord {
  id: string;
  providerTransactionId: string;
  accountId: string;
  amount: number;
  description: string;
  payee?: string;
  transactedAt: number;
  categoryId?: string;
  isTransfer: boolean;
  needsReview: boolean;
  isHidden: boolean;
  customTitle: string;
  isSplit: boolean;
}

export function isCoreDataZone(zoneName: string): boolean {
  return zoneName === COREDATA_ZONE_NAME;
}

export function decodeSightCD(rec: CloudKitRecordPayload): SightEntryRecord {
  const f = rec.fields ?? {};
  return {
    id: field<string>(f, "CD_id") ?? rec.recordName,
    name: field<string>(f, "CD_name") ?? "",
    address: field<string>(f, "CD_address") ?? "",
    latitude: field<number>(f, "CD_latitude"),
    longitude: field<number>(f, "CD_longitude"),
    visitedDay: field<string>(f, "CD_visitedDay") ?? "",
    notes: field<string>(f, "CD_notes") ?? "",
  };
}

export function decodeMovieCD(rec: CloudKitRecordPayload): MovieEntryRecord {
  const f = rec.fields ?? {};
  const s = field<string>(f, "CD_sentimentRaw");
  const sentiment: MealSentiment =
    s === "loved" || s === "liked" || s === "fine" || s === "disliked" ? s : "liked";
  return {
    id: field<string>(f, "CD_id") ?? rec.recordName,
    title: field<string>(f, "CD_title") ?? "",
    year: field<string>(f, "CD_year") ?? "",
    director: field<string>(f, "CD_director") ?? "",
    genre: field<string>(f, "CD_genre") ?? "",
    sentiment,
    rank: field<number>(f, "CD_rank") ?? 0,
    watchedDay: field<string>(f, "CD_watchedDay") ?? "",
    notes: field<string>(f, "CD_notes") ?? "",
    isWishlist: Boolean(field<number | boolean>(f, "CD_isWishlist")),
  };
}

export function decodeRecipeCD(rec: CloudKitRecordPayload): RecipeEntryRecord {
  const f = rec.fields ?? {};
  return {
    id: field<string>(f, "CD_id") ?? rec.recordName,
    title: field<string>(f, "CD_title") ?? "",
    ingredientsText: field<string>(f, "CD_ingredientsText") ?? "",
    stepsText: field<string>(f, "CD_stepsText") ?? "",
    notes: field<string>(f, "CD_notes") ?? "",
    sourceURL: field<string>(f, "CD_sourceURL") ?? "",
    meal: field<string>(f, "CD_meal") ?? "",
    cuisine: field<string>(f, "CD_cuisine") ?? "",
    minutes: field<number>(f, "CD_minutes") ?? 0,
  };
}

export function decodeAccountCD(rec: CloudKitRecordPayload): AccountRecord {
  const f = rec.fields ?? {};
  return {
    id: rec.recordName,
    providerAccountId: field<string>(f, "CD_providerAccountId") ?? rec.recordName,
    name: field<string>(f, "CD_name") ?? "",
    nickname: field<string>(f, "CD_nickname") ?? "",
    institutionName: field<string>(f, "CD_institutionName") ?? "",
    currency: field<string>(f, "CD_currency") ?? "USD",
    balance: field<number>(f, "CD_balance") ?? 0,
    kindRaw: field<string>(f, "CD_kindRaw") ?? "other",
    isHidden: Boolean(field<number | boolean>(f, "CD_isHidden")),
  };
}

export function decodeCategoryCD(rec: CloudKitRecordPayload): BudgetCategoryRecord {
  const f = rec.fields ?? {};
  return {
    id: field<string>(f, "CD_id") ?? rec.recordName,
    name: field<string>(f, "CD_name") ?? "",
    icon: field<string>(f, "CD_icon") ?? "•",
    parentId: field<string>(f, "CD_parentId"),
    isIncome: Boolean(field<number | boolean>(f, "CD_isIncome")),
    isTransfer: Boolean(field<number | boolean>(f, "CD_isTransfer")),
    sortOrder: field<number>(f, "CD_sortOrder") ?? 0,
    monthlyTarget: field<number>(f, "CD_monthlyTarget") ?? 0,
  };
}

export function decodeTransactionCD(rec: CloudKitRecordPayload): TransactionRecord {
  const f = rec.fields ?? {};
  return {
    id: rec.recordName,
    providerTransactionId: field<string>(f, "CD_providerTransactionId") ?? rec.recordName,
    accountId: field<string>(f, "CD_accountId") ?? "",
    amount: field<number>(f, "CD_amount") ?? 0,
    description: field<string>(f, "CD_transactionDescription") ?? "",
    payee: field<string>(f, "CD_payee"),
    transactedAt: field<number>(f, "CD_transactedAt") ?? rec.created?.timestamp ?? Date.now(),
    categoryId: field<string>(f, "CD_categoryId"),
    isTransfer: Boolean(field<number | boolean>(f, "CD_isTransfer")),
    needsReview: Boolean(field<number | boolean>(f, "CD_needsReview")),
    isHidden: Boolean(field<number | boolean>(f, "CD_isHidden")),
    customTitle: field<string>(f, "CD_customTitle") ?? "",
    isSplit: Boolean(field<number | boolean>(f, "CD_isSplit")),
  };
}
