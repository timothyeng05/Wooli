import Image from "next/image";
import Link from "next/link";

// The home page opens the way the app does: the waving clay sheep on its blue
// launch screen. Each app's own sheep icon (ios/Wooli/Wooli/Assets.xcassets/
// AppIcons) introduces it, and the screenshots come from the app's sample data.

type App = { slug: string; name: string; line: string };

const explore: App[] = [
  { slug: "trips", name: "Trips", line: "Plan a trip day by day on Apple Maps, together if you like." },
  { slug: "eats", name: "Eats", line: "Rank every place you eat against the ones you know." },
  { slug: "sights", name: "Sights", line: "Landmarks, museums and parks to fit into a trip." },
  { slug: "movies", name: "Movies", line: "Rank every film you see in a few taps." },
  { slug: "recipes", name: "Recipes", line: "Share a recipe reel and get ingredients and steps." },
];

const personal: App[] = [
  { slug: "budget", name: "Budget", line: "Plan each month and see where your money goes." },
  { slug: "health", name: "Health", line: "A private cycle tracker built on Apple Health." },
];

function Shot({ src, caption, priority }: { src: string; caption: string; priority?: boolean }) {
  return (
    <figure className="shot">
      <Image src={src} alt={caption} width={660} height={1434} sizes="(max-width: 760px) 60vw, 280px" priority={priority} />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function StoreBadge() {
  return (
    <span className="store-badge" aria-label="Coming soon to the App Store">
      <span>Coming soon to the</span>
      <strong>App Store</strong>
    </span>
  );
}

function AppList({ title, apps }: { title: string; apps: App[] }) {
  return (
    <div className="app-group">
      <h3>{title}</h3>
      <ul>
        {apps.map((app) => (
          <li key={app.slug}>
            <a href={`#${app.slug}`}>
              <Image src={`/apps/${app.slug}.png`} alt="" width={72} height={72} />
              <span>
                <b>{app.name}</b>
                <small>{app.line}</small>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Home() {
  return (
    <main className="home">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-text">
          <h1 id="hero-title">Trips, meals and money, in one app.</h1>
          <p className="lede">An app for the things you keep track of, on your iPhone and Mac.</p>
          <div className="hero-actions">
            <StoreBadge />
            <a className="hero-link" href="#apps">See the eight apps</a>
          </div>
          <p className="hero-note">For iPhone (iOS 26 and later) and Mac (macOS 26 and later).</p>
        </div>
        <Image
          className="hero-sheep"
          src="/sheep-wave.jpg"
          alt="Wooli's mascot, a woolly clay sheep, waving hello"
          width={960}
          height={960}
          sizes="(max-width: 760px) 80vw, 520px"
          priority
        />
      </section>

      <section className="apps" id="apps" aria-labelledby="apps-title">
        <div className="apps-head">
          <Image src="/apps/today.png" alt="" width={120} height={120} />
          <div>
            <h2 id="apps-title">Pick the apps you want.</h2>
            <p>Today puts what&apos;s next from each one on a single screen.</p>
          </div>
        </div>
        <div className="app-groups">
          <AppList title="Explore" apps={explore} />
          <AppList title="Personal" apps={personal} />
        </div>
      </section>

      <section className="feature" id="trips" aria-labelledby="trips-title">
        <div className="feature-text">
          <Image className="feature-icon" src="/apps/trips.png" alt="" width={64} height={64} />
          <h2 id="trips-title">A trip, city by city.</h2>
          <p>
            Fill each day with meals, stays and plans. Flights and trains sit inside the day you leave,
            with times, seats and booking codes. Invite the people you&apos;re travelling with to plan together.
          </p>
        </div>
        <div className="shots">
          <Shot src="/screens/trip.jpg" caption="A week in Japan on one map." />
          <Shot src="/screens/train.jpg" caption="A train, inside the day you take it." />
        </div>
      </section>

      <section className="feature feature-band" id="eats" aria-labelledby="eats-title">
        <div className="shots">
          <Shot src="/screens/eats-map.jpg" caption="Every place you've ranked, on a map." />
          <Shot src="/screens/eats-place.jpg" caption="Scores, visits and notes for each place." />
        </div>
        <div className="feature-text">
          <Image className="feature-icon" src="/apps/eats.png" alt="" width={64} height={64} />
          <h2 id="eats-title">Every meal, ranked against the last.</h2>
          <p>
            Compare a new place with ones you know and your list sorts itself. Keep a Want to Try list,
            filter to places near you, and share a reel to pull out the restaurants in it.
          </p>
          <p id="sights" className="aside">
            <Image src="/apps/sights.png" alt="" width={40} height={40} />
            <span>Sights keeps the landmarks and museums you want to see, ready to add to a trip.</span>
          </p>
        </div>
      </section>

      <section className="pair" aria-labelledby="pair-title">
        <h2 id="pair-title">Films and recipes, kept the same way.</h2>
        <article id="movies">
          <div className="pair-text">
            <Image src="/apps/movies.png" alt="" width={64} height={64} />
            <h3>Movies</h3>
            <p>Search any film, say how you felt, then rank it. Filter by genre, decade or director.</p>
          </div>
          <Shot src="/screens/movies.jpg" caption="Your films, ranked and filtered." />
        </article>
        <article id="recipes">
          <div className="pair-text">
            <Image src="/apps/recipes.png" alt="" width={64} height={64} />
            <h3>Recipes</h3>
            <p>Share a recipe reel and Wooli splits it into ingredients and steps, tagged by meal and time.</p>
          </div>
          <Shot src="/screens/recipes.jpg" caption="Dinner in under 30 minutes." />
        </article>
      </section>

      <section className="personal" aria-labelledby="personal-title">
        <div className="personal-head">
          <h2 id="personal-title">Budget and Health, for your eyes only.</h2>
          <p id="budget">
            Enter spending yourself for free, or bring in bank transactions through SimpleFIN, a separate
            service with its own small yearly fee.
          </p>
          <p id="health">Health reads your cycle from Apple Health, predicts the next one, and locks with Face ID.</p>
        </div>
        <div className="strip" tabIndex={0} aria-label="Budget and Health screenshots">
          <Shot src="/screens/dashboard.jpg" caption="The dashboard leads with what needs review." />
          <Shot src="/screens/review.jpg" caption="Review a transaction in a tap or two." />
          <Shot src="/screens/budget.jpg" caption="A plan for every category." />
          <Shot src="/screens/health.jpg" caption="Health predicts your next period." />
        </div>
      </section>

      <section className="yours" aria-labelledby="yours-title">
        <div>
          <h2 id="yours-title">Your data stays yours.</h2>
          <p>
            No accounts, no ads, no analytics. Your lists and budget sync through your own iCloud, your cycle
            stays in Apple Health, and bank data goes straight from SimpleFIN to your devices.
          </p>
          <p>
            <Link href="/privacy">Read the privacy policy</Link>
            {" · "}
            <a href="https://github.com/timothyeng05/Wooli" target="_blank" rel="noopener noreferrer">
              Open source on GitHub
            </a>
          </p>
        </div>
        <StoreBadge />
      </section>
    </main>
  );
}
