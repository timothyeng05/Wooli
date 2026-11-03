import Link from "next/link";
import Screens from "./screens";

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div>
          <h1>Your money, your trips and your favorite places, in one app.</h1>
          <p className="lede">
            Wooli is an iPhone app for keeping a budget, planning a trip day by day, ranking the
            places you eat and the movies you watch, and saving recipes. Turn on just the parts you
            want. Everything stays on your phone and in your own iCloud.
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

      <Screens />

      <section className="features">
        <article className="feature trips">
          <h2>Trips</h2>
          <div>
            <p>Lay out a trip city by city, then fill in each day. Flights and trains sit inside the day you leave, with times, seats and booking codes.</p>
            <ul>
              <li>Breakfast, lunch and dinner slots on every day, ready to fill in.</li>
              <li>Find places with Apple Maps, open their full listing and see each day on a map.</li>
              <li>Invite the people you&apos;re travelling with to plan together.</li>
            </ul>
          </div>
        </article>

        <article className="feature eats">
          <h2>Eats</h2>
          <div>
            <p>Rank every place you eat by comparing it to the ones you already know. Your best meal is a 10, and everything else falls into place behind it.</p>
            <ul>
              <li>Keep a Want to Try list, and save places straight from Apple Maps.</li>
              <li>Share an Instagram reel and Wooli finds the restaurants in it.</li>
              <li>Log every visit, share your list with friends, or keep one list with your partner.</li>
              <li>Sights keeps the landmarks, museums and parks you want to see, ready to add to a trip.</li>
            </ul>
          </div>
        </article>

        <article className="feature money">
          <h2>Budget</h2>
          <div>
            <p>Set a plan for each category and see what&apos;s left this month. Enter spending yourself for free, or bring in your bank transactions through SimpleFIN.</p>
            <ul>
              <li>Spending Pace shows whether this month is on track against your usual months.</li>
              <li>Review new transactions in a tap from Today, with suggested categories and rules.</li>
              <li>Recurring bills and income, net worth and reports.</li>
            </ul>
          </div>
        </article>

        <article className="feature money">
          <h2>Health</h2>
          <div>
            <p>A private period tracker that learns your cycle and predicts the next one. Lock it with Face ID if you like.</p>
          </div>
        </article>

        <article className="feature more">
          <h2>Movies &amp; Recipes</h2>
          <div>
            <p>Rank the films you watch the same way you rank restaurants, and keep the recipes you find on Instagram.</p>
            <ul>
              <li>Search any film, say how you felt, then compare it to ones you&apos;ve seen.</li>
              <li>Keep a Want to See list, and filter your films by genre, decade or director.</li>
              <li>Share a recipe reel and Wooli splits it into ingredients and steps.</li>
              <li>Recipes are tagged by meal, cuisine, main ingredient and time, so you can find dinner in under 30 minutes.</li>
            </ul>
          </div>
        </article>
      </section>

      <section className="yours">
        <h2>Your data stays yours.</h2>
        <p>
          Wooli has no accounts, no ads and no analytics. Everything you add syncs through your own
          iCloud, and your bank data goes straight from SimpleFIN to your phone. We never see any of it.
        </p>
        <p><Link href="/privacy">Read the privacy policy</Link></p>
      </section>
    </main>
  );
}
