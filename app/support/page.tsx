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

      <h3>My data isn&apos;t showing on my other iPhone or iPad.</h3>
      <p>
        Wooli syncs through iCloud. Make sure both devices are signed in to the same Apple Account and
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

      <h3>Can I hide the parts of Wooli I don&apos;t use?</h3>
      <p>
        Yes. Go to Settings → Apps and switch off anything you don&apos;t want, or drag the apps into the
        order you like. Budget works without a bank connection, and you can turn it on later.
      </p>

      <h3>A city in my trip looks empty.</h3>
      <p>
        It&apos;s probably folded. Tap the city&apos;s header, or tap Expand all above the itinerary, to show its days.
      </p>

      <h3>How do I save a restaurant from Apple Maps?</h3>
      <p>
        In Apple Maps, open the place, tap Share, then choose Wooli. Rank it if you&apos;ve been, save it
        to Want to Try, or add it to a trip&apos;s ideas.
      </p>

      <h3>How do I save places or a recipe from an Instagram reel?</h3>
      <p>
        In Instagram, tap Share on the reel or post, then choose Wooli. Wooli reads the caption and
        either finds the restaurants it mentions for Eats, or splits a recipe into ingredients and steps
        for Recipes. If it guesses wrong, flip the switch on the sheet. If Instagram doesn&apos;t
        share the caption, paste it into the recipe editor instead.
      </p>

      <h3>How do I share one Eats list with my partner?</h3>
      <p>
        In Eats, open Friends and tap Partner. Once they accept, you both add and rank places in the
        same list. Friends you invite can see your list but not change it.
      </p>

      <h3>My periods aren&apos;t showing in Health.</h3>
      <p>
        Wooli reads your cycle from Apple Health. In Settings → Health → Data Access &amp; Devices → Wooli, turn on
        access and choose All Recorded Data, so predictions can use your history. Periods logged in another
        app can be changed only there or in the Health app.
      </p>

      <h3>A recipe has the wrong tags.</h3>
      <p>
        Open the recipe, tap Edit, and change the meal, cuisine, main ingredient or time under Tags.
        Wooli won&apos;t re-tag a recipe you&apos;ve changed by hand.
      </p>

      <h3>How do I delete my data?</h3>
      <p>
        Delete items in the app, or delete the app. Anything synced to iCloud can also be removed in
        Settings → your name → iCloud → Manage Account Storage. See the <a href="/privacy">privacy policy</a> for details.
      </p>
    </main>
  );
}
