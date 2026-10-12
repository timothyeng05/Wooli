import type { Config } from 'tailwindcss'

const config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // Brand color tokens (primary/blue/green/red/sand/seaglass) live in
  // app/globals.css under @theme — the CSS-first Tailwind v4 config.
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config satisfies Config
