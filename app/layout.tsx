import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Source_Serif_4, Manrope } from "next/font/google";
import "./globals.css";

const sourceSerif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Wooli — trips, eats and money in one iPhone app",
  description:
    "Wooli is an iPhone app for planning trips day by day, ranking the places you eat, and keeping a simple budget. Your data stays on your phone and in your own iCloud.",
  icons: { icon: "/wooli-icon.png", apple: "/wooli-icon.png" },
};

export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sourceSerif.variable} ${manrope.variable}`}>
      <body>
        <header className="site-header">
          <Link href="/" className="wordmark">
            <Image src="/wooli-icon.png" alt="" width={32} height={32} priority />
            Wooli
          </Link>
          <nav aria-label="Site">
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
