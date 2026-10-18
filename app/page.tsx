import Link from "next/link";

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div>
          <h1>Your trips, your meals and your money, in one app.</h1>
          <p className="lede">
            Wooli is an iPhone app for planning a trip day by day, ranking the places you eat,
            and keeping an easy budget. Everything stays on your phone and in your own iCloud.
          </p>
          <span className="store-badge" aria-label="Coming soon to the App Store">
            <span>Coming soon to the</span>
            <strong>App Store</strong>
          </span>
          <p className="hero-note">For iPhone, iOS 26 and later.</p>
        </div>

        <div className="objects" aria-hidden="true">
          <div className="ticket">
            <div className="ends">
              <div className="end"><small>From</small><b>Tokyo</b></div>
              <div className="route"><i /><span>✈</span><i /></div>
              <div className="end"><small>To</small><b>Fukuoka</b></div>
            </div>
            <p className="meta">Tuesday, June 2, about 880 km by plane</p>
            <div className="leg"><span>JL321 HND to FUK</span><span>1:45 – 3:35 PM</span></div>
          </div>
          <div className="eat-row">
            <div>
              <b>1. Tonkatsu Hasegawa</b>
              <small>Japanese, Ryogoku, Tokyo</small>
            </div>
            <span className="score">9.8</span>
          </div>
          <div className="budget">
            <div className="row"><span>Restaurants</span><span>$372 of $600</span></div>
            <div className="bar"><i /></div>
          </div>
        </div>
      </section>

      <section className="features">
        <article className="feature trips">
          <h2>Trips</h2>
          <div>
            <p>Lay out a trip city by city, then fill in each day. Flights and trains sit inside the day you leave, with times, seats and booking codes.</p>
            <ul>
              <li>Breakfast, lunch and dinner slots on every day, ready to fill in.</li>
              <li>Pin places from Apple Maps and see each day on a map.</li>
              <li>Invite the people you&apos;re travelling with to plan together.</li>
            </ul>
          </div>
        </article>

        <article className="feature eats">
          <h2>Eats</h2>
          <div>
            <p>Rank every place you eat by comparing it to the ones you already know. Your best meal is a 10, and everything else falls into place behind it.</p>
            <ul>
              <li>Meals from your trips are ready to rank as soon as the day is over.</li>
              <li>Share your list with friends and see where you agree.</li>
              <li>Save a place straight from the share button in Apple Maps.</li>
            </ul>
          </div>
        </article>

        <article className="feature money">
          <h2>Budget</h2>
          <div>
            <p>Set a plan for each category and see what&apos;s left this month. Enter spending yourself for free, or bring in your bank transactions through SimpleFIN.</p>
            <ul>
              <li>Review new transactions in a few taps, with rules that learn your merchants.</li>
              <li>Five years of history, net worth and recurring bills.</li>
              <li>A private period tracker you can lock with Face ID, if you want it.</li>
            </ul>
          </div>
        </article>
      </section>

      <section className="yours">
        <h2>Your data stays yours.</h2>
        <p>
          Wooli has no accounts, no ads and no analytics. Trips and your Eats list sync through
          your own iCloud, and your bank data goes straight from SimpleFIN to your phone. We never
          see any of it.
        </p>
        <p><Link href="/privacy">Read the privacy policy</Link></p>
      </section>
    </main>
  );
}
