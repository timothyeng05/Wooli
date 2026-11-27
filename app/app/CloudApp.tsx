"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import DemoApp from "@/app/demo/DemoApp";
import {
  toDemoAccounts,
  toDemoCategories,
  toDemoEats,
  toDemoMovies,
  toDemoRecipes,
  toDemoSights,
  toDemoTrips,
  toDemoTxns,
} from "@/lib/cloudkit/adapter";
import {
  fetchWooliCloudSnapshot,
  getCloudKitConfig,
  initCloudKit,
  saveEatsPlaceToCloud,
  type WooliCloudSnapshot,
} from "@/lib/cloudkit/client";
import type { EatsPlaceRecord, MealSentiment } from "@/lib/cloudkit/schema";

export default function CloudApp() {
  const config = getCloudKitConfig();
  const hasToken = Boolean(config.apiToken);

  const [status, setStatus] = useState<"idle" | "loading" | "signed-out" | "signed-in" | "error">(
    hasToken ? "loading" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<WooliCloudSnapshot | null>(null);

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
        setStatus("signed-in");
      } else {
        setSnapshot(null);
        setStatus("signed-out");
        container.whenUserSignsIn().then(async (signedUser) => {
          setStatus("loading");
          const data = await fetchWooliCloudSnapshot(container, signedUser.userRecordName);
          setSnapshot(data);
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

  const demoTrips = useMemo(() => (snapshot ? toDemoTrips(snapshot.trips, snapshot.tripItems) : []), [snapshot]);
  const demoEats = useMemo(() => (snapshot ? toDemoEats(snapshot.eats) : []), [snapshot]);
  const demoSights = useMemo(() => (snapshot ? toDemoSights(snapshot.sights) : []), [snapshot]);
  const demoMovies = useMemo(() => (snapshot ? toDemoMovies(snapshot.movies) : []), [snapshot]);
  const demoRecipes = useMemo(() => (snapshot ? toDemoRecipes(snapshot.recipes) : []), [snapshot]);
  const demoAccounts = useMemo(() => (snapshot ? toDemoAccounts(snapshot.accounts) : []), [snapshot]);
  const demoCategories = useMemo(
    () => (snapshot ? toDemoCategories(snapshot.categories, snapshot.transactions) : []),
    [snapshot],
  );
  const demoTxns = useMemo(
    () => (snapshot ? toDemoTxns(snapshot.transactions, snapshot.accounts) : { review: [], posted: [] }),
    [snapshot],
  );

  const handleAddCloudEat = useCallback(
    async (input: { name: string; address: string; sentiment: MealSentiment; isWish: boolean }) => {
      if (!snapshot) return;
      const container = await initCloudKit();
      const now = Date.now();
      const today = new Date().toISOString().slice(0, 10);
      const record: EatsPlaceRecord = {
        id: crypto.randomUUID(),
        isWish: input.isWish,
        scope: "private",
        zoneName: "eats",
        name: input.name,
        address: input.address,
        mapItemID: "",
        sentiment: input.sentiment,
        rank: (snapshot.eats[0]?.rank ?? 0) + 1,
        visitedDay: input.isWish ? "" : today,
        visits: input.isWish ? [] : [{ day: today }],
        notes: "",
        tripID: "",
        tripItemID: "",
        createdAt: now,
      };
      const saved = await saveEatsPlaceToCloud(container, record);
      setSnapshot((prev) => (prev ? { ...prev, eats: [saved, ...prev.eats] } : prev));
    },
    [snapshot],
  );

  const signOutButton = (
    <div id="apple-sign-out-button" style={{ display: status === "signed-in" ? "inline-block" : "none" }} />
  );

  return (
    <main className={status === "signed-in" ? "demo-page" : "ck-page"}>
      {status !== "signed-in" && (
        <section className="ck-card" style={{ maxWidth: 520, margin: "40px auto", textAlign: "center" }}>
          <Image src="/wooli-icon.png" alt="Wooli" width={64} height={64} style={{ borderRadius: 14, margin: "0 auto 12px" }} />
          <p className="ck-kicker">Apple iCloud · Cross-Platform</p>
          <h1 style={{ fontFamily: "var(--font-source-serif), Georgia, serif", margin: "0 0 8px" }}>
            Sign in to Wooli
          </h1>
          <p className="ck-sub" style={{ margin: "0 auto 20px" }}>
            Log in with your Apple ID to unlock your live iCloud <strong>Trips</strong>, <strong>Eats</strong>,{" "}
            <strong>Sights</strong>, <strong>Movies</strong>, <strong>Recipes</strong>, and <strong>Budget</strong>.
          </p>

          {error && <div className="ck-error" style={{ textAlign: "left" }}>{error}</div>}

          {!hasToken && (
            <p className="ck-meta">
              Missing <code>NEXT_PUBLIC_CLOUDKIT_API_TOKEN</code>. Add your CloudKit Console API token to{" "}
              <code>.env.local</code> or Vercel Environment Variables.
            </p>
          )}

          {hasToken && status === "loading" && <p className="ck-meta">Connecting to Apple iCloud ({config.environment})…</p>}

          <div
            id="apple-sign-in-button"
            style={{ display: hasToken && status === "signed-out" ? "inline-block" : "none", marginTop: 8 }}
          />
        </section>
      )}

      {status === "signed-in" && snapshot && (
        <>
          {snapshot.warnings.length > 0 && (
            <div className="ck-error" style={{ maxWidth: 1120, margin: "0 auto 12px" }}>
              {snapshot.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}
          <DemoApp
            cloudMode
            initialTrips={demoTrips}
            initialEats={demoEats}
            initialSights={demoSights}
            initialMovies={demoMovies}
            initialRecipes={demoRecipes}
            initialAccounts={demoAccounts}
            initialCategories={demoCategories}
            initialReview={demoTxns.review}
            initialPosted={demoTxns.posted}
            onRefreshCloud={refresh}
            onAddCloudEat={handleAddCloudEat}
            signOutSlot={signOutButton}
          />
          <p className="demo-foot">
            Synced with Apple iCloud · {snapshot.trips.length} trips · {snapshot.eats.length} eats ·{" "}
            {snapshot.sights.length} sights · {snapshot.movies.length} movies · {snapshot.recipes.length} recipes ·{" "}
            {snapshot.accounts.length} accounts.
          </p>
        </>
      )}

      {status !== "signed-in" && signOutButton}
    </main>
  );
}
