"use client";

import Image from "next/image";
import { useState } from "react";

// Screenshots from the app's sample data, one tab per app group — the same
// Personal / Explore split as the app's ☰ switcher.

const groups = {
  personal: {
    title: "Personal",
    blurb: "Budget and Health: your money and your cycle, kept private.",
    shots: [
      { src: "/screens/dashboard.jpg", caption: "The dashboard leads with what needs review." },
      { src: "/screens/review.jpg", caption: "Review a transaction in a tap or two." },
      { src: "/screens/budget.jpg", caption: "A plan for every category, month by month." },
      { src: "/screens/health.jpg", caption: "Health predicts your next period." },
    ],
  },
  explore: {
    title: "Explore",
    blurb: "Trips, Eats, Movies and Recipes: the places you go and the things you love.",
    shots: [
      { src: "/screens/trip.jpg", caption: "A trip, city by city, on one map." },
      { src: "/screens/train.jpg", caption: "Flights and trains sit inside the day you travel." },
      { src: "/screens/eats-map.jpg", caption: "Every place you've ranked, on a map." },
      { src: "/screens/eats-place.jpg", caption: "Scores, visits and notes for each place." },
      { src: "/screens/movies.jpg", caption: "Rank films and filter by genre or decade." },
      { src: "/screens/recipes.jpg", caption: "Recipes tagged by meal, cuisine and time." },
    ],
  },
} as const;

type Group = keyof typeof groups;

export default function Screens() {
  const [group, setGroup] = useState<Group>("personal");
  const current = groups[group];

  return (
    <section className="screens" aria-labelledby="screens-title">
      <div className="screens-head">
        <h2 id="screens-title">A look inside</h2>
        <div className="screens-tabs" role="tablist" aria-label="App groups">
          {(Object.keys(groups) as Group[]).map((key) => (
            <button
              key={key}
              role="tab"
              id={`tab-${key}`}
              aria-selected={group === key}
              aria-controls="screens-panel"
              onClick={() => setGroup(key)}
            >
              {groups[key].title}
            </button>
          ))}
        </div>
      </div>
      <p className="screens-blurb">{current.blurb}</p>
      <div id="screens-panel" role="tabpanel" aria-labelledby={`tab-${group}`} className="screens-row" tabIndex={0}>
        {current.shots.map((shot) => (
          <figure key={shot.src}>
            <Image src={shot.src} alt={shot.caption} width={660} height={1434} sizes="240px" />
            <figcaption>{shot.caption}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
