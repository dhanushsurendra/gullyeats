/*
 * Saves Bengaluru's main roads (OpenStreetMap motorway, trunk, primary and
 * secondary) to data/blr_main_roads.json for utils/mainRoads.js.
 *
 *   node scripts/fetch-main-roads.js [tilesDir]
 *
 * The free Overpass service is often slow or busy, so the city is fetched in
 * 16 tiles with retries; each tile is kept in tilesDir (default: the system
 * temp folder), and a rerun skips the tiles it already has. Delete tilesDir
 * to fetch fresh data. Re-run every few months; road classes rarely change.
 * Map data © OpenStreetMap contributors (ODbL).
 */
const fs = require('fs')
const os = require('os')
const path = require('path')

const OUT = path.join(__dirname, '../data/blr_main_roads.json')
const TILES = process.argv[2] || path.join(os.tmpdir(), 'gullyeats-main-roads')
const [S, W, N, E] = [12.75, 77.35, 13.25, 77.9] // Bengaluru and its edges
const STEPS = 4
const query = (s, w, n, e) =>
  `[out:json][timeout:90];way(${s},${w},${n},${e})[highway~"^(motorway|trunk|primary|secondary)$"];out tags geom;`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchTile(file, bbox) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'User-Agent': 'GullyEats-onboarding', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query(...bbox)),
        signal: AbortSignal.timeout(120000),
      })
      const text = await res.text()
      if (res.ok && text.startsWith('{')) return fs.writeFileSync(file, text)
      console.log(`${path.basename(file)}: Overpass said ${res.status}, retrying`)
    } catch (e) {
      console.log(`${path.basename(file)}: ${e.message}, retrying`)
    }
    await sleep(15000)
  }
  throw new Error(`Gave up on ${path.basename(file)}; run again later`)
}

;(async () => {
  fs.mkdirSync(TILES, { recursive: true })
  const roads = new Map() // OSM way id -> { n, p }
  for (let i = 0; i < STEPS; i++) {
    for (let j = 0; j < STEPS; j++) {
      const file = path.join(TILES, `t${i}${j}.json`)
      const bbox = [
        S + ((N - S) * i) / STEPS, W + ((E - W) * j) / STEPS,
        S + ((N - S) * (i + 1)) / STEPS, W + ((E - W) * (j + 1)) / STEPS,
      ]
      if (!fs.existsSync(file)) await fetchTile(file, bbox)
      for (const w of JSON.parse(fs.readFileSync(file, 'utf8')).elements) {
        if (w.type !== 'way' || !w.geometry) continue
        roads.set(w.id, {
          n: w.tags?.name || w.tags?.['name:en'] || '',
          // 5 decimals is about 1 m.
          p: w.geometry.map(({ lat, lon }) => [+lat.toFixed(5), +lon.toFixed(5)]),
        })
      }
    }
  }
  fs.writeFileSync(OUT, JSON.stringify([...roads.values()]))
  console.log(`${roads.size} roads saved to ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`)
})().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
