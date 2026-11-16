const fs = require('fs')
const path = require('path')

/*
 * Whether a point is right next to a main road (motorway, trunk, primary or
 * secondary in OpenStreetMap), for the onboarding app's "near a main road"
 * warning. Eviction drives are most common there. A risk hint only: it never
 * says a spot is allowed.
 *
 * The roads come from data/blr_main_roads.json (scripts/fetch-main-roads.js),
 * a saved copy, because the free Overpass service is too slow to ask live.
 */

const FILE = path.join(__dirname, '../data/blr_main_roads.json')
const NEAR_M = 25 // phone GPS is 5–20 m off; a footpath cart is within ~15 m of the road's centre line
const CELL = 0.005 // degrees, about 550 m: bigger than NEAR_M, so a point's own and neighbouring cells suffice

let cells = null // "i:j" -> [{ a, b, n }] segments crossing that cell

const key = (i, j) => `${i}:${j}`

/** [roads] is [{ n: name, p: [[lat, lng], ...] }]. */
function load(roads) {
  cells = new Map()
  for (const { n, p } of roads) {
    for (let k = 1; k < p.length; k++) {
      const a = p[k - 1]
      const b = p[k]
      const i0 = Math.floor(Math.min(a[0], b[0]) / CELL)
      const i1 = Math.floor(Math.max(a[0], b[0]) / CELL)
      const j0 = Math.floor(Math.min(a[1], b[1]) / CELL)
      const j1 = Math.floor(Math.max(a[1], b[1]) / CELL)
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const list = cells.get(key(i, j))
          if (list) list.push({ a, b, n })
          else cells.set(key(i, j), [{ a, b, n }])
        }
      }
    }
  }
}

// Metres from point [lat, lng] to segment a–b, on a flat projection around
// the point (fine at these distances).
function metresToSegment([lat, lng], a, b) {
  const mLat = 111320
  const mLng = 111320 * Math.cos((lat * Math.PI) / 180)
  const ax = (a[1] - lng) * mLng
  const ay = (a[0] - lat) * mLat
  const bx = (b[1] - lng) * mLng
  const by = (b[0] - lat) * mLat
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0
  return Math.hypot(ax + t * dx, ay + t * dy)
}

/**
 * The nearest main road's name within NEAR_M of [lat, lng] ('' when it has
 * none in OpenStreetMap), or null when there is none or no data file.
 */
function mainRoadNear(lat, lng) {
  if (!cells) {
    if (!fs.existsSync(FILE)) return null
    load(JSON.parse(fs.readFileSync(FILE, 'utf8')))
  }
  const ci = Math.floor(lat / CELL)
  const cj = Math.floor(lng / CELL)
  let best = null
  for (let i = ci - 1; i <= ci + 1; i++) {
    for (let j = cj - 1; j <= cj + 1; j++) {
      for (const s of cells.get(key(i, j)) || []) {
        const d = metresToSegment([lat, lng], s.a, s.b)
        if (d <= NEAR_M && (!best || d < best.d)) best = { d, n: s.n }
      }
    }
  }
  return best ? best.n : null
}

module.exports = { mainRoadNear, NEAR_M, _load: load }
