import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Fraunces, Plus_Jakarta_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import "./styles/tokens.css";
import "./components/ds/ds.css";

// Field Notes North Star: Fraunces display + Plus Jakarta Sans body (with Source Serif 4 fallback).
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const sourceSerif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"], weight: ["600", "800"] });

export const metadata: Metadata = {
  title: "Wooli: trips, places to eat, movies, recipes and budget in one app for iPhone and Mac",
  description:
    "Wooli is an app for iPhone and Mac for planning trips day by day, ranking the places you eat and the movies you watch, and saving recipes, with an optional budget and private health tracker. Your data stays on your devices and in your own iCloud.",
  icons: { icon: "/wooli-icon.png", apple: "/wooli-icon.png" },
};

export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${plusJakarta.variable} ${sourceSerif.variable}`}>
      <body>
        <header className="site-header">
          <Link href="/" className="wordmark">
            <Image src="/wooli-icon.png" alt="" width={36} height={36} priority />
            Wooli
          </Link>
          <nav aria-label="Site">
            <Link href="/app">Web App</Link>
            <Link href="/demo">Try the demo</Link>
            <Link href="/support">Support</Link>
            <Link href="/privacy">Privacy</Link>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <p>Wooli is made by Tim Eng in New York.</p>
          <nav aria-label="Legal">
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/terms">Terms of use</Link>
            <Link href="/support">Support</Link>
            <a href="mailto:woolitravel@gmail.com">woolitravel@gmail.com</a>
          </nav>
        </footer>
      </body>
    </html>
  );
}
