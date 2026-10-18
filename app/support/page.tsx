import type { Metadata } from "next";

export const metadata: Metadata = { title: "Support — Wooli" };

export default function SupportPage() {
  return (
    <main className="doc">
      <h1>Support</h1>
      <p className="updated">
        Email <a href="mailto:woolitravel@gmail.com">woolitravel@gmail.com</a> and you&apos;ll hear back within a couple of days.
      </p>

      <h2>Common questions</h2>

      <h3>My trips aren&apos;t showing on my other iPhone or iPad.</h3>
      <p>
        Trips sync through iCloud. Make sure both devices are signed in to the same Apple Account and
        that iCloud Drive is on in Settings → your name → iCloud. Changes can take a minute to appear.
      </p>

      <h3>How do I plan a trip with someone else?</h3>
      <p>
        Open the trip and tap the invite button at the top. They get an iCloud invite and can add and
        edit plans with you.
      </p>

      <h3>Do I need to pay for a bank connection?</h3>
      <p>
        No. You can enter spending yourself for free. If you&apos;d like transactions brought in
        automatically, Wooli connects to SimpleFIN Bridge, which charges its own small yearly fee.
        That fee goes to SimpleFIN, not to Wooli.
      </p>

      <h3>A city in my trip looks empty.</h3>
      <p>
        It&apos;s probably folded. Tap the city&apos;s header, or tap Expand all above the itinerary, to show its days.
      </p>

      <h3>How do I save a restaurant from Apple Maps?</h3>
      <p>
        In Apple Maps, open the place, tap Share, then choose Wooli. Add it to Eats to rank it, or to a
        trip&apos;s ideas.
      </p>

      <h3>How do I delete my data?</h3>
      <p>
        Delete items in the app, or delete the app. Synced trips and Eats places can also be removed in
        Settings → your name → iCloud → Manage Account Storage. See the <a href="/privacy">privacy policy</a> for details.
      </p>
    </main>
  );
}
