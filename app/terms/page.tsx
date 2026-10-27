import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of use — Wooli" };

export default function TermsPage() {
  return (
    <main className="doc">
      <h1>Terms of use</h1>
      <p className="updated">Last updated October 27, 2026</p>

      <p>
        These terms cover your use of the Wooli app for iPhone. Wooli is licensed to you under
        Apple&apos;s standard <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/">Licensed Application End User License Agreement</a>;
        these terms add a few points specific to Wooli.
      </p>

      <h2>Not financial advice</h2>
      <p>
        Budgets, balances, net worth and spending summaries are for your own organizing. They may be
        incomplete or out of date, and they are not financial, tax or investment advice. Check
        important numbers with your bank.
      </p>

      <h2>Not medical advice</h2>
      <p>
        The period tracker&apos;s predictions are estimates based on what you&apos;ve logged. They are not
        medical advice and must not be used for contraception or to diagnose anything. Talk to a
        doctor about your health.
      </p>

      <h2>Travel plans</h2>
      <p>
        Flight, train and place details are what you or your trip mates entered, or came from Apple
        Maps. Always confirm times, bookings and opening hours with the airline, operator or venue.
      </p>

      <h2>Third-party services</h2>
      <p>
        Bank connections are provided by SimpleFIN Bridge under their own terms and fees, which you
        agree to with them directly. Maps and place information come from Apple, and movie details
        from Apple&apos;s iTunes Search. Instagram reels you share are read from Instagram. Wooli
        isn&apos;t responsible for these services.
      </p>

      <h2>Your content</h2>
      <p>
        What you add to Wooli is yours. When you share a trip or your Eats list, the people you invite
        can see it, and those you let make changes (trip mates, or a partner on your Eats list) can
        edit it. Only share with people you trust.
      </p>

      <h2>No warranty</h2>
      <p>
        Wooli is provided as is. To the extent the law allows, the developer is not liable for losses
        from using the app, including missed bookings or financial decisions.
      </p>

      <h2>Acknowledgements</h2>
      <p>
        Airport data from OurAirports (public domain) and mwgg/Airports (MIT license). Coastlines from
        Natural Earth (public domain). Full notices are in the app under Settings → About → Acknowledgements.
      </p>

      <h2>Contact</h2>
      <p>Email <a href="mailto:woolitravel@gmail.com">woolitravel@gmail.com</a>.</p>
    </main>
  );
}
