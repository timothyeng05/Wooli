import type { Metadata } from "next";
import DemoApp from "./DemoApp";
import "./demo.css";

export const metadata: Metadata = {
  title: "Try Wooli: an interactive demo with sample data",
  description: "Click around Wooli's Mac app in your browser: plan a trip, rank a restaurant, review a transaction. Sample data only.",
};

export default function DemoPage() {
  return (
    <main className="demo-page">
      <header className="demo-intro">
        <p className="demo-kicker">Interactive demo · sample data</p>
        <h1>Take Wooli for a spin.</h1>
        <p>
          This is the Mac app, in your browser, filled with a made-up life. Switch apps from the grid at the top
          right, press <kbd>⌘K</kbd> to search, rank a new pizza place in Eats, and clear the review queue in
          Budget. Nothing you do here is saved.
        </p>
      </header>
      <DemoApp />
      <p className="demo-foot">
        The real app syncs through your own iCloud, works on iPhone and Mac, and has Sights and a private Health
        tracker too.
      </p>
    </main>
  );
}
