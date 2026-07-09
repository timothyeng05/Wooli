// Screenshot harness for visual verification (works locally and in Claude Code
// on the web). Boots the dev server if needed, captures routes at the given
// widths with Playwright, and cleans up after itself.
//
//   npm run screenshot -- /preview-trips "/preview-trips?view=edit" --widths 1440,768
//
// Options:
//   --widths 1440,1024x768   comma-separated widths (or WxH; height defaults to 900)
//   --out DIR                output directory (default: screenshots/)
//   --port N                 attach to a server already running on port N
//   --full                   full-page screenshots instead of viewport-sized
//
// Notes for preview pages: put throwaway pages under /preview-* — that prefix is
// not in proxy.ts's matcher, so no auth/middleware changes are needed. Delete the
// page before committing.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { chromium } from 'playwright'

// The remote sandbox routes HTTPS through a proxy; localhost must bypass it.
process.env.NO_PROXY = [process.env.NO_PROXY, 'localhost,127.0.0.1'].filter(Boolean).join(',')

const args = process.argv.slice(2)
const routes = []
let widths = [1440, 768]
let outDir = 'screenshots'
let attachPort = null
let fullPage = false
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--widths') widths = args[++i].split(',')
  else if (args[i] === '--out') outDir = args[++i]
  else if (args[i] === '--port') attachPort = Number(args[++i])
  else if (args[i] === '--full') fullPage = true
  else routes.push(args[i])
}
if (!routes.length) {
  console.error('Usage: npm run screenshot -- <route> [route...] [--widths 1440,768] [--out dir] [--port N] [--full]')
  process.exit(1)
}
const sizes = widths.map(w => {
  const [width, height] = String(w).split('x').map(Number)
  return { width, height: height || 900 }
})

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer()
  srv.listen(0, '127.0.0.1', () => {
    const { port } = srv.address()
    srv.close(() => resolve(port))
  })
  srv.on('error', reject)
})

const responds = async (url) => {
  try { return (await fetch(url)).status < 500 } catch { return false }
}

async function waitFor(url, ms) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (await responds(url)) return true
    await new Promise(r => setTimeout(r, 2000))
  }
  return false
}

let server = null
async function ensureServer() {
  if (attachPort) {
    if (!(await responds(`http://localhost:${attachPort}/`))) {
      console.error(`Nothing responding on port ${attachPort}`)
      process.exit(1)
    }
    return attachPort
  }
  const port = await freePort()
  // Placeholder Supabase env as a fallback; a real .env.local wins if present.
  server = spawn('npx', ['next', 'dev', '--webpack'], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.placeholder',
      ...process.env,
      PORT: String(port),
    },
  })
  console.log(`Starting dev server on port ${port}…`)
  if (!(await waitFor(`http://localhost:${port}${routes[0]}`, 150000))) {
    console.error('Dev server did not become ready in 150s')
    stop(1)
  }
  return port
}

function stop(code) {
  if (!server) process.exit(code)
  // Next spawns subprocesses that can outlive a plain SIGTERM — follow up hard.
  try { process.kill(-server.pid, 'SIGTERM') } catch {}
  setTimeout(() => {
    try { process.kill(-server.pid, 'SIGKILL') } catch {}
    process.exit(code)
  }, 1500)
}
process.on('SIGINT', () => stop(130))

async function launchBrowser() {
  try {
    return await chromium.launch()
  } catch {
    // Claude Code on the web pre-installs Chromium here; the npm-installed
    // Playwright version may not match what `chromium.launch()` looks for.
    return await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  }
}

const port = await ensureServer()
mkdirSync(outDir, { recursive: true })
const browser = await launchBrowser()

for (const route of routes) {
  const slug = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'home'
  for (const { width, height } of sizes) {
    const page = await browser.newPage({ viewport: { width, height } })
    await page.goto(`http://localhost:${port}${route}`, { waitUntil: 'networkidle', timeout: 60000 })
      .catch(e => console.warn(`${route} @${width}: ${e.message.split('\n')[0]}`))
    await page.waitForTimeout(1500) // maps/fonts settle
    const file = path.join(outDir, `${slug}-${width}.png`)
    await page.screenshot({ path: file, fullPage })
    console.log(`saved ${file}`)
    await page.close()
  }
}

await browser.close()
stop(0)
