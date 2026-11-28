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
  deleted?: boolean;
  created?: { timestamp: number };
  fields: Record<string, CloudKitFieldValue>;
}

export type MealSentiment = "mustTry" | "loved" | "liked" | "fine" | "disliked";

export interface EatsVisit {
  id?: string;
  day: string;
  note?: string;
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
  latitude?: number;
  longitude?: number;
  timeZoneID?: string;
  countryCode?: string;
  mapItemID?: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
  group: string;
}

export interface TripExtras {
  budget?: number;
  budgetCurrency?: string;
  fxRates?: Record<string, number>;
  fxUpdatedAt?: number | string;
  travelers?: number;
  checklist?: ChecklistItem[];
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
  extras?: TripExtras;
}

export type TripItemKind = "activity" | "meal" | "transit" | "stay" | "note";
export type BookingStatus = "idea" | "planned" | "booked" | "cancelled";

export interface TripStationPlace {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  mapItemID?: string;
}

export interface TripTransport {
  mode: "flight" | "train";
  flightNumber?: string;
  airline?: string;
  fromAirport?: string;
  toAirport?: string;
  departTerminal?: string;
  arriveTerminal?: string;
  cabin?: string;
  fromStation?: TripStationPlace;
  toStation?: TripStationPlace;
  arriveTime?: number;
  arriveDayOffset?: number;
  seats?: string;
  confirmation?: string;
}

export interface ItemExtras {
  status?: BookingStatus;
  endTime?: number;
  url?: string;
  source?: string;
  attachmentIDs?: string[];
  ignoredWarnings?: string[];
  paidBy?: string;
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
  mapItemID?: string;
  checkOutDay?: string;
  order?: number;
  cost?: number;
  currency?: string;
  points?: number;
  pointsProgram?: string;
  transport?: TripTransport;
  extras?: ItemExtras;
  isHiddenPlaceholder: boolean;
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

function parseSentiment(raw: string | undefined): MealSentiment {
  if (raw === "mustTry" || raw === "loved" || raw === "liked" || raw === "fine" || raw === "disliked") {
    return raw;
  }
  return "liked";
}

export function decodeEatsRecord(rec: CloudKitRecordPayload, zone: ZoneRef): EatsPlaceRecord {
  const f = rec.fields ?? {};
  const visitedDay = field<string>(f, "visitedDay") ?? "";
  let visits = parseJson<EatsVisit[]>(field<string>(f, "visits"), []);
  if (visits.length === 0 && visitedDay) {
    visits = [{ day: visitedDay }];
  }
  const sentiment = parseSentiment(field<string>(f, "sentiment"));

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

const MEAL_PLACEHOLDER_SLOTS = new Set(["Breakfast", "Lunch", "Dinner"]);

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
    extras: parseJson<TripExtras | undefined>(field<string>(f, "extras") ?? field<string>(f, "extrasJson"), undefined),
  };
}

export function decodeTripItemRecord(rec: CloudKitRecordPayload, zone: ZoneRef, tripID: string): TripItemRecord {
  const f = rec.fields ?? {};
  const kindRaw = field<string>(f, "kind");
  const kind: TripItemKind =
    kindRaw === "activity" || kindRaw === "meal" || kindRaw === "transit" || kindRaw === "stay" || kindRaw === "note"
      ? kindRaw
      : "activity";
  const title = field<string>(f, "title") ?? "";
  const notes = field<string>(f, "notes") ?? "";
  const placeName = field<string>(f, "placeName");
  const latitude = field<number>(f, "latitude");
  const longitude = field<number>(f, "longitude");
  const extras = parseJson<ItemExtras | undefined>(field<string>(f, "extras"), undefined);
  const hasPlace = Boolean(placeName && typeof latitude === "number" && typeof longitude === "number");
  const isMealPlaceholder = kind === "meal" && !hasPlace && !notes && MEAL_PLACEHOLDER_SLOTS.has(title);

  return {
    id: rec.recordName,
    tripID,
    scope: zone.scope,
    zoneName: zone.zoneName,
    ownerRecordName: zone.ownerRecordName,
    day: field<string>(f, "day"),
    kind,
    title,
    time: field<number>(f, "time"),
    notes,
    placeName,
    placeAddress: field<string>(f, "placeAddress"),
    latitude,
    longitude,
    mapItemID: field<string>(f, "mapItemID"),
    checkOutDay: field<string>(f, "checkOutDay"),
    order: field<number>(f, "order"),
    cost: field<number>(f, "cost"),
    currency: field<string>(f, "currency"),
    points: field<number>(f, "points"),
    pointsProgram: field<string>(f, "pointsProgram"),
    transport: parseJson<TripTransport | undefined>(field<string>(f, "transport"), undefined),
    extras,
    isHiddenPlaceholder: isMealPlaceholder && extras?.source !== "slot",
    createdAt: field<number>(f, "createdAt") ?? rec.created?.timestamp ?? Date.now(),
  };
}

export interface SightEntryRecord {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  mapItemID?: string;
  visitedDay: string;
  notes: string;
  createdAt?: number;
}

export interface MovieEntryRecord {
  id: string;
  title: string;
  year: string;
  director: string;
  genre: string;
  posterURL?: string;
  synopsis?: string;
  appleID?: string;
  sentiment: MealSentiment;
  rank: number;
  watchedDay: string;
  notes: string;
  isWishlist: boolean;
  createdAt?: number;
}

export interface RecipeEntryRecord {
  id: string;
  title: string;
  ingredientsText: string;
  stepsText: string;
  notes: string;
  caption?: string;
  sourceURL: string;
  meal: string;
  cuisine: string;
  mainIngredient?: string;
  minutes: number;
  tagVersion?: number;
  createdAt?: number;
}

export interface AccountRecord {
  id: string;
  providerAccountId: string;
  ownerId?: string;
  name: string;
  nickname: string;
  institutionName: string;
  currency: string;
  balance: number;
  balanceDate?: number;
  kindRaw: string;
  isHidden: boolean;
  hideTransactions: boolean;
}

export interface BudgetCategoryRecord {
  id: string;
  name: string;
  icon: string;
  colorHex?: string;
  parentId?: string;
  isIncome: boolean;
  isTransfer: boolean;
  sortOrder: number;
  monthlyTarget: number;
  rolloverEnabled: boolean;
  rolloverBalance: number;
  rolloverThrough?: string;
}

export interface TransactionRecord {
  id: string;
  providerTransactionId: string;
  accountId: string;
  amount: number;
  description: string;
  payee?: string;
  transactedAt: number;
  isPending: boolean;
  categoryId?: string;
  isTransfer: boolean;
  needsReview: boolean;
  isHidden: boolean;
  normalizedMerchant: string;
  note: string;
  customTitle: string;
  isSplit: boolean;
  splitParentId: string;
}

export interface RecurringItemRecord {
  id: string;
  merchant: string;
  title: string;
  categoryId?: string;
  accountId: string;
  amount: number;
  cadenceRaw: string;
  lastDate: number;
  nextDate: number;
  lastTransactionId: string;
  isActive: boolean;
  isManual: boolean;
  createdAt: number;
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
    mapItemID: field<string>(f, "CD_mapItemID"),
    visitedDay: field<string>(f, "CD_visitedDay") ?? "",
    notes: field<string>(f, "CD_notes") ?? "",
    createdAt: field<number>(f, "CD_createdAt") ?? rec.created?.timestamp,
  };
}

export function decodeMovieCD(rec: CloudKitRecordPayload): MovieEntryRecord {
  const f = rec.fields ?? {};
  const sentiment = parseSentiment(field<string>(f, "CD_sentimentRaw"));
  return {
    id: field<string>(f, "CD_id") ?? rec.recordName,
    title: field<string>(f, "CD_title") ?? "",
    year: field<string>(f, "CD_year") ?? "",
    director: field<string>(f, "CD_director") ?? "",
    genre: field<string>(f, "CD_genre") ?? "",
    posterURL: field<string>(f, "CD_posterURL"),
    synopsis: field<string>(f, "CD_synopsis"),
    appleID: field<string>(f, "CD_appleID"),
    sentiment,
    rank: field<number>(f, "CD_rank") ?? 0,
    watchedDay: field<string>(f, "CD_watchedDay") ?? "",
    notes: field<string>(f, "CD_notes") ?? "",
    isWishlist: Boolean(field<number | boolean>(f, "CD_isWishlist")),
    createdAt: field<number>(f, "CD_createdAt") ?? rec.created?.timestamp,
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
    caption: field<string>(f, "CD_caption"),
    sourceURL: field<string>(f, "CD_sourceURL") ?? "",
    meal: field<string>(f, "CD_meal") ?? "",
    cuisine: field<string>(f, "CD_cuisine") ?? "",
    mainIngredient: field<string>(f, "CD_mainIngredient"),
    minutes: field<number>(f, "CD_minutes") ?? 0,
    tagVersion: field<number>(f, "CD_tagVersion"),
    createdAt: field<number>(f, "CD_createdAt") ?? rec.created?.timestamp,
  };
}

export function decodeAccountCD(rec: CloudKitRecordPayload): AccountRecord {
  const f = rec.fields ?? {};
  return {
    id: rec.recordName,
    providerAccountId: field<string>(f, "CD_providerAccountId") ?? rec.recordName,
    ownerId: field<string>(f, "CD_ownerId"),
    name: field<string>(f, "CD_name") ?? "",
    nickname: field<string>(f, "CD_nickname") ?? "",
    institutionName: field<string>(f, "CD_institutionName") ?? "",
    currency: field<string>(f, "CD_currency") ?? "USD",
    balance: field<number>(f, "CD_balance") ?? 0,
    balanceDate: field<number>(f, "CD_balanceDate"),
    kindRaw: field<string>(f, "CD_kindRaw") ?? "other",
    isHidden: Boolean(field<number | boolean>(f, "CD_isHidden")),
    hideTransactions: Boolean(field<number | boolean>(f, "CD_hideTransactions")),
  };
}

export function decodeCategoryCD(rec: CloudKitRecordPayload): BudgetCategoryRecord {
  const f = rec.fields ?? {};
  return {
    id: field<string>(f, "CD_id") ?? rec.recordName,
    name: field<string>(f, "CD_name") ?? "",
    icon: field<string>(f, "CD_icon") ?? "•",
    colorHex: field<string>(f, "CD_colorHex"),
    parentId: field<string>(f, "CD_parentId"),
    isIncome: Boolean(field<number | boolean>(f, "CD_isIncome")),
    isTransfer: Boolean(field<number | boolean>(f, "CD_isTransfer")),
    sortOrder: field<number>(f, "CD_sortOrder") ?? 0,
    monthlyTarget: field<number>(f, "CD_monthlyTarget") ?? 0,
    rolloverEnabled: Boolean(field<number | boolean>(f, "CD_rolloverEnabled")),
    rolloverBalance: field<number>(f, "CD_rolloverBalance") ?? 0,
    rolloverThrough: field<string>(f, "CD_rolloverThrough"),
  };
}

export function decodeTransactionCD(rec: CloudKitRecordPayload): TransactionRecord {
  const f = rec.fields ?? {};
  const needsReviewRaw = field<number | boolean>(f, "CD_needsReview");
  return {
    id: rec.recordName,
    providerTransactionId: field<string>(f, "CD_providerTransactionId") ?? rec.recordName,
    accountId: field<string>(f, "CD_accountId") ?? "",
    amount: field<number>(f, "CD_amount") ?? 0,
    description: field<string>(f, "CD_transactionDescription") ?? "",
    payee: field<string>(f, "CD_payee"),
    transactedAt: field<number>(f, "CD_transactedAt") ?? rec.created?.timestamp ?? Date.now(),
    isPending: Boolean(field<number | boolean>(f, "CD_isPending")),
    categoryId: field<string>(f, "CD_categoryId"),
    isTransfer: Boolean(field<number | boolean>(f, "CD_isTransfer")),
    needsReview: needsReviewRaw === undefined ? true : Boolean(needsReviewRaw),
    isHidden: Boolean(field<number | boolean>(f, "CD_isHidden")),
    normalizedMerchant: field<string>(f, "CD_normalizedMerchant") ?? "",
    note: field<string>(f, "CD_note") ?? "",
    customTitle: field<string>(f, "CD_customTitle") ?? "",
    isSplit: Boolean(field<number | boolean>(f, "CD_isSplit")),
    splitParentId: field<string>(f, "CD_splitParentId") ?? "",
  };
}

export function decodeRecurringCD(rec: CloudKitRecordPayload): RecurringItemRecord {
  const f = rec.fields ?? {};
  const isActiveRaw = field<number | boolean>(f, "CD_isActive");
  return {
    id: field<string>(f, "CD_id") ?? rec.recordName,
    merchant: field<string>(f, "CD_merchant") ?? "",
    title: field<string>(f, "CD_title") ?? "",
    categoryId: field<string>(f, "CD_categoryId"),
    accountId: field<string>(f, "CD_accountId") ?? "",
    amount: field<number>(f, "CD_amount") ?? 0,
    cadenceRaw: field<string>(f, "CD_cadenceRaw") ?? "monthly",
    lastDate: field<number>(f, "CD_lastDate") ?? rec.created?.timestamp ?? Date.now(),
    nextDate: field<number>(f, "CD_nextDate") ?? rec.created?.timestamp ?? Date.now(),
    lastTransactionId: field<string>(f, "CD_lastTransactionId") ?? "",
    isActive: isActiveRaw === undefined ? true : Boolean(isActiveRaw),
    isManual: Boolean(field<number | boolean>(f, "CD_isManual")),
    createdAt: field<number>(f, "CD_createdAt") ?? rec.created?.timestamp ?? Date.now(),
  };
}
