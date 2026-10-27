import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy policy — Wooli" };

export default function PrivacyPage() {
  return (
    <main className="doc">
      <h1>Privacy policy</h1>
      <p className="updated">Last updated October 27, 2026</p>

      <p>
        Wooli is an iPhone app for planning trips, ranking places you&apos;ve eaten and movies you&apos;ve
        watched, saving recipes, keeping a budget and tracking your period. <strong>Wooli does not collect any data.</strong> The developer has no
        servers that receive your information and cannot see it.
      </p>

      <h2>Where your information lives</h2>
      <ul>
        <li><strong>On your iPhone.</strong> Budget categories, transactions you enter or import, period entries and your settings are stored on your device.</li>
        <li><strong>In your own iCloud.</strong> Trips, your Eats list, your Movies list and your saved recipes sync through Apple&apos;s CloudKit to the private database in your iCloud account, so they&apos;re on all your devices. Only you, and people you invite, can see them. The developer cannot access your iCloud data.</li>
        <li><strong>When you share.</strong> If you invite someone to a trip or share your Eats list, they can see what you shared, and anyone you allow to make changes (for example a partner sharing one Eats list with you) can edit it. You can stop sharing at any time.</li>
      </ul>

      <h2>Bank connections (optional)</h2>
      <p>
        If you choose to connect a bank, Wooli uses <a href="https://beta-bridge.simplefin.org">SimpleFIN Bridge</a>,
        a separate service you sign up for and pay directly. Your iPhone downloads balances and
        transactions straight from SimpleFIN; nothing passes through the developer. Your SimpleFIN
        access key is kept in your iPhone&apos;s Keychain. SimpleFIN&apos;s own privacy policy applies to
        what you share with them. You can also use Wooli without a bank connection by entering amounts yourself.
      </p>

      <h2>Apple services</h2>
      <p>
        Place search, maps and place details come from Apple Maps, movie search and posters come from
        Apple&apos;s iTunes Search, and Face ID (if you turn it on) is
        handled by iOS. Apple&apos;s privacy policy applies to these services. Wooli never sees your Face ID data.
        Suggested categories for transactions are worked out on your iPhone with Apple Intelligence (when it&apos;s on); your
        transactions aren&apos;t sent anywhere to do this.
      </p>

      <h2>Instagram reels</h2>
      <p>
        If you share an Instagram reel or post to Wooli, your iPhone downloads that post&apos;s public page
        from Instagram to read its caption, so Instagram sees that request like any visit to the post. The
        caption is read on your iPhone (with Apple Intelligence when it&apos;s on) to find place names, which
        are then looked up in Apple Maps, or to split a recipe into ingredients and steps. Nothing is sent to
        the developer, and Wooli only keeps the places or recipe you choose to save, with the reel&apos;s link
        (and, for a recipe, its caption).
      </p>

      <h2>What Wooli doesn&apos;t do</h2>
      <ul>
        <li>No accounts, sign-ups or analytics.</li>
        <li>No advertising, and no tracking across apps or websites.</li>
        <li>No selling or sharing of your information with anyone.</li>
      </ul>

      <h2>Deleting your data</h2>
      <p>
        Delete items in the app, or delete the app to remove what&apos;s stored on your iPhone. To remove
        synced trips, Eats places, movies and recipes, delete them in the app, or remove Wooli&apos;s data in Settings →
        your name → iCloud → Manage Account Storage.
      </p>

      <h2>Children</h2>
      <p>Wooli is not directed at children under 13.</p>

      <h2>Changes</h2>
      <p>If this policy changes, the new version will be posted on this page with a new date.</p>

      <h2>Contact</h2>
      <p>Questions about privacy? Email <a href="mailto:woolitravel@gmail.com">woolitravel@gmail.com</a>.</p>
    </main>
  );
}
