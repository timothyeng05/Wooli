"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchWooliCloudSnapshot,
  getCloudKitConfig,
  initCloudKit,
  saveEatsPlaceToCloud,
  type WooliCloudSnapshot,
} from "@/lib/cloudkit/client";
import type { EatsPlaceRecord, MealSentiment, TripItemRecord } from "@/lib/cloudkit/schema";

type Tab = "eats" | "trips";
type EatsFilter = "all" | "private" | "shared";

function formatTime(minutes?: number): string {
  if (typeof minutes !== "number") return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function CloudApp() {
  const config = getCloudKitConfig();
  const hasToken = Boolean(config.apiToken);

  const [status, setStatus] = useState<"idle" | "loading" | "signed-out" | "signed-in" | "error">(
    hasToken ? "loading" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<WooliCloudSnapshot | null>(null);
  const [tab, setTab] = useState<Tab>("eats");
  const [eatsFilter, setEatsFilter] = useState<EatsFilter>("all");
  const [selectedTripId, setSelectedTripId] = useState<string>("");

  // Quick-add Eats state
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newSentiment, setNewSentiment] = useState<MealSentiment>("loved");
  const [newIsWish, setNewIsWish] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!hasToken) return;
    setStatus("loading");
    setError(null);
    try {
      const container = await initCloudKit();
      const user = await container.setUpAuth();
      if (user) {
        const data = await fetchWooliCloudSnapshot(container, user.userRecordName);
        setSnapshot(data);
        setSelectedTripId((prev) => prev || data.trips[0]?.id || "");
        setStatus("signed-in");
      } else {
        setSnapshot(null);
        setStatus("signed-out");
        container.whenUserSignsIn().then(async (signedUser) => {
          setStatus("loading");
          const data = await fetchWooliCloudSnapshot(container, signedUser.userRecordName);
          setSnapshot(data);
          setSelectedTripId((prev) => prev || data.trips[0]?.id || "");
          setStatus("signed-in");
        });
      }
      container.whenUserSignsOut().then(() => {
        setSnapshot(null);
        setStatus("signed-out");
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to Apple CloudKit");
      setStatus("error");
    }
  }, [hasToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredEats = useMemo(() => {
    const list = snapshot?.eats ?? [];
    if (eatsFilter === "all") return list;
    return list.filter((p) => p.scope === eatsFilter);
  }, [snapshot, eatsFilter]);

  const rankedEats = useMemo(() => filteredEats.filter((p) => !p.isWish), [filteredEats]);
  const wishEats = useMemo(() => filteredEats.filter((p) => p.isWish), [filteredEats]);

  const selectedTrip = useMemo(
    () => snapshot?.trips.find((t) => t.id === selectedTripId) ?? snapshot?.trips[0] ?? null,
    [snapshot, selectedTripId],
  );

  const itemsByDay = useMemo(() => {
    if (!selectedTrip || !snapshot) return [] as Array<[string, TripItemRecord[]]>;
    const items = snapshot.tripItems
      .filter((i) => i.tripID === selectedTrip.id)
      .sort((a, b) => (a.day ?? "").localeCompare(b.day ?? "") || (a.time ?? 9999) - (b.time ?? 9999));
    const map = new Map<string, TripItemRecord[]>();
    for (const item of items) {
      const key = item.day || "Ideas & Unscheduled";
      const group = map.get(key) ?? [];
      group.push(item);
      map.set(key, group);
    }
    return Array.from(map.entries());
  }, [selectedTrip, snapshot]);

  const handleAddEat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !snapshot) return;
    setSaving(true);
    setError(null);
    try {
      const container = await initCloudKit();
      const now = Date.now();
      const today = new Date().toISOString().slice(0, 10);
      const record: EatsPlaceRecord = {
        id: crypto.randomUUID(),
        isWish: newIsWish,
        scope: "private",
        zoneName: "eats",
        name: newName.trim(),
        address: newAddress.trim(),
        mapItemID: "",
        sentiment: newSentiment,
        rank: (snapshot.eats[0]?.rank ?? 0) + 1,
        visitedDay: newIsWish ? "" : today,
        visits: newIsWish ? [] : [{ day: today }],
        notes: "",
        tripID: "",
        tripItemID: "",
        createdAt: now,
      };
      const saved = await saveEatsPlaceToCloud(container, record);
      setSnapshot((prev) => (prev ? { ...prev, eats: [saved, ...prev.eats] } : prev));
      setNewName("");
      setNewAddress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save to iCloud");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="ck-page">
      <header className="ck-head">
        <div>
          <p className="ck-kicker">Cross-Platform · Apple CloudKit</p>
          <h1>Wooli on the Web</h1>
          <p className="ck-sub">
            Sign in with your Apple ID to view and update your private and shared <strong>Eats</strong> and{" "}
            <strong>Trips</strong> directly from iCloud—nothing stored on third-party servers.
          </p>
        </div>

        <div className="ck-auth-bar">
          <div id="apple-sign-in-button" style={{ display: status === "signed-in" ? "none" : "block" }} />
          <div id="apple-sign-out-button" style={{ display: status === "signed-in" ? "block" : "none" }} />
          {status === "signed-in" && (
            <button className="ck-btn" onClick={refresh}>
              Refresh iCloud
            </button>
          )}
        </div>
      </header>

      {error && <div className="ck-error">{error}</div>}
      {snapshot && snapshot.warnings.length > 0 && (
        <div className="ck-error">
          {snapshot.warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}

      {!hasToken && (
        <section className="ck-card">
          <h2>Connect your CloudKit JS API Token</h2>
          <p className="ck-sub">
            CloudKit JS needs a public API token from your Apple Developer CloudKit Console to enable Sign in with Apple
            on Windows/web:
          </p>
          <ol className="ck-setup-steps">
            <li>
              Open <strong>CloudKit Console</strong> (<code>icloud.developer.apple.com</code>) and select container{" "}
              <code>{config.containerIdentifier}</code>.
            </li>
            <li>
              Go to <strong>Tokens → API Tokens → New API Token</strong>, set Sign-in Callback to{" "}
              <code>https://wooli-rho.vercel.app</code> (and <code>http://localhost:4127</code> for local testing).
            </li>
            <li>
              Add <code>NEXT_PUBLIC_CLOUDKIT_API_TOKEN</code> (and optionally{" "}
              <code>NEXT_PUBLIC_CLOUDKIT_ENV=production</code>) to <code>.env.local</code> and Vercel Environment
              Variables.
            </li>
          </ol>
        </section>
      )}

      {hasToken && status === "loading" && (
        <section className="ck-card">
          <p className="ck-sub">Connecting to Apple iCloud ({config.environment})…</p>
        </section>
      )}

      {hasToken && status === "signed-out" && (
        <section className="ck-card">
          <h2>Sign in with Apple to sync your iCloud data</h2>
          <p className="ck-sub">
            Use the Sign in with Apple button above. Your private <code>eats</code> and <code>trip-*</code> zones—plus
            lists shared with you—will load directly from Apple CloudKit.
          </p>
        </section>
      )}

      {status === "signed-in" && snapshot && (
        <>
          <div className="ck-tabs">
            <button className={`ck-tab ${tab === "eats" ? "is-active" : ""}`} onClick={() => setTab("eats")}>
              Eats ({snapshot.eats.length})
            </button>
            <button className={`ck-tab ${tab === "trips" ? "is-active" : ""}`} onClick={() => setTab("trips")}>
              Trips ({snapshot.trips.length})
            </button>
          </div>

          {tab === "eats" && (
            <section>
              <form className="ck-form" onSubmit={handleAddEat}>
                <input
                  type="text"
                  placeholder="Restaurant or cafe name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Address / neighborhood (optional)"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                />
                <select value={newSentiment} onChange={(e) => setNewSentiment(e.target.value as MealSentiment)}>
                  <option value="loved">Loved</option>
                  <option value="liked">Liked</option>
                  <option value="fine">Fine</option>
                  <option value="disliked">Disliked</option>
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                  <input type="checkbox" checked={newIsWish} onChange={(e) => setNewIsWish(e.target.checked)} />
                  Want to Try
                </label>
                <button className="ck-btn is-primary" type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Add to iCloud"}
                </button>
              </form>

              <div className="ck-tabs">
                {(["all", "private", "shared"] as EatsFilter[]).map((f) => (
                  <button key={f} className={`ck-tab ${eatsFilter === f ? "is-active" : ""}`} onClick={() => setEatsFilter(f)}>
                    {f === "all" ? "All Lists" : f === "private" ? "My Eats" : "Shared with Me"}
                  </button>
                ))}
              </div>

              <h2>Ranked ({rankedEats.length})</h2>
              <div className="ck-grid" style={{ marginBottom: 24 }}>
                {rankedEats.map((p) => (
                  <article key={`${p.scope}-${p.id}`} className="ck-item">
                    <div className="ck-item-top">
                      <h3>{p.name}</h3>
                      <span className={`ck-badge ${p.scope === "shared" ? "is-shared" : ""}`}>
                        {p.scope === "shared" ? "Shared" : p.sentiment}
                      </span>
                    </div>
                    {p.address && <p className="ck-meta">{p.address}</p>}
                    {p.visitedDay && <p className="ck-meta">Visited {p.visitedDay}</p>}
                    {p.notes && <p className="ck-notes">{p.notes}</p>}
                  </article>
                ))}
              </div>

              <h2>Want to Try ({wishEats.length})</h2>
              <div className="ck-grid">
                {wishEats.map((p) => (
                  <article key={`${p.scope}-${p.id}`} className="ck-item">
                    <div className="ck-item-top">
                      <h3>{p.name}</h3>
                      <span className={`ck-badge ${p.scope === "shared" ? "is-shared" : ""}`}>
                        {p.scope === "shared" ? "Shared Wish" : "Want to Try"}
                      </span>
                    </div>
                    {p.address && <p className="ck-meta">{p.address}</p>}
                    {p.notes && <p className="ck-notes">{p.notes}</p>}
                  </article>
                ))}
              </div>
            </section>
          )}

          {tab === "trips" && (
            <section className="ck-trip-layout">
              <div className="ck-trip-list">
                {snapshot.trips.map((t) => (
                  <button
                    key={t.id}
                    className={`ck-trip-btn ${selectedTrip?.id === t.id ? "is-active" : ""}`}
                    onClick={() => setSelectedTripId(t.id)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong>{t.name}</strong>
                      {t.scope === "shared" && <span className="ck-badge is-shared">Shared</span>}
                    </div>
                    <div className="ck-meta">
                      {t.startDay} → {t.endDay}
                    </div>
                  </button>
                ))}
              </div>

              <div className="ck-card">
                {selectedTrip ? (
                  <>
                    <h2>{selectedTrip.name}</h2>
                    <p className="ck-meta" style={{ marginBottom: 16 }}>
                      {selectedTrip.destination} · {selectedTrip.startDay} to {selectedTrip.endDay}
                    </p>
                    {itemsByDay.map(([day, items]) => (
                      <div key={day} className="ck-day">
                        <h4>{selectedTrip.dayTitles[day] ? `${day} · ${selectedTrip.dayTitles[day]}` : day}</h4>
                        {items.map((item) => (
                          <div key={item.id} className="ck-plan-row">
                            <span className="ck-time">{formatTime(item.time)}</span>
                            <div>
                              <strong>{item.title}</strong>
                              {(item.placeName || item.transport?.flightNumber || item.cost) && (
                                <div className="ck-meta">
                                  {[
                                    item.placeName,
                                    item.transport?.flightNumber,
                                    item.cost ? `${item.currency ?? "USD"} ${item.cost}` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </div>
                              )}
                              {item.notes && <div className="ck-notes">{item.notes}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="ck-sub">No trips found in your iCloud zones.</p>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
