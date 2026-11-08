import { DEFAULT_SKIN, ROUND_MS, rng, seedFor } from './nebula.js'

/*
 * Nebula Rush progression, kept on the phone (utils/play.js stores it):
 * pilot XP and rank, three daily missions, ship skins unlocked by rank.
 * Cosmetic only: none of it changes how a round plays or scores, so the
 * daily leaderboard stays fair. Pure functions; no storage here.
 */

export const RANKS = [
  { name: 'Cadet', xp: 0 },
  { name: 'Pilot', xp: 300 },
  { name: 'Ace', xp: 900 },
  { name: 'Captain', xp: 2000 },
  { name: 'Commander', xp: 4000 },
  { name: 'Legend', xp: 8000 },
]

export function rankOf(xp) {
  let i = 0
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i += 1
  const next = RANKS[i + 1]
  return { index: i, name: RANKS[i].name, next: next ? next.xp : null, progress: next ? (xp - RANKS[i].xp) / (next.xp - RANKS[i].xp) : 1 }
}

export const MISSION_XP = 100
// Each is checked against one round's result().
export const MISSIONS = [
  { id: 'near15', text: 'Skim 15 rocks in one round', done: (r) => r.stats.near >= 15 },
  { id: 'boss', text: 'Take down the Mothership', done: (r) => r.stats.boss >= 1 },
  { id: 'boss50', text: 'Wear the Mothership down to half', done: (r) => r.stats.boss >= 1 || r.stats.bossHits >= 60 },
  { id: 'combo5', text: 'Reach a x5 energy combo', done: (r) => r.stats.maxCombo >= 5 },
  { id: 'bomb', text: 'Set off a Nova bomb', done: (r) => r.stats.bombs >= 1 },
  { id: 'survive', text: 'Survive the whole round', done: (r) => r.durationMs >= ROUND_MS },
  { id: 'powers3', text: 'Grab 3 power-ups in one round', done: (r) => r.stats.powers >= 3 },
  { id: 'drones3', text: 'Destroy 3 hunter drones', done: (r) => r.stats.drones >= 3 },
  { id: 'kills60', text: 'Destroy 60 rocks and comets', done: (r) => r.stats.kills >= 60 },
  { id: 'score3k', text: 'Score 3,000 in one round', done: (r) => r.score >= 3000 },
]

// Today's three, the same for everyone.
export function missionsFor(day) {
  const rand = rng(seedFor(day) ^ 0x6d155105)
  const pool = [...MISSIONS]
  return Array.from({ length: 3 }, () => pool.splice(Math.floor(rand() * pool.length), 1)[0])
}

export const SKINS = [
  { id: 'classic', name: 'Classic', rank: 0, ...DEFAULT_SKIN },
  { id: 'ember', name: 'Ember', rank: 1, wing: '#fca5a5', edge: '#ef4444', hull: '#fff1f2', cockpit: '#facc15', flame: ['#ef4444', '#fde047'] },
  { id: 'venom', name: 'Venom', rank: 2, wing: '#86efac', edge: '#22c55e', hull: '#ecfdf5', cockpit: '#166534', flame: ['#22c55e', '#bef264'] },
  { id: 'royal', name: 'Royal', rank: 3, wing: '#c4b5fd', edge: '#8b5cf6', hull: '#f5f3ff', cockpit: '#fde047', flame: ['#a855f7', '#f0abfc'] },
  { id: 'gold', name: 'Gold', rank: 4, wing: '#fde047', edge: '#eab308', hull: '#fffbeb', cockpit: '#7c2d12', flame: ['#f59e0b', '#ffffff'] },
  { id: 'void', name: 'Void', rank: 5, wing: '#475569', edge: '#f472b6', hull: '#0f172a', cockpit: '#f472b6', flame: ['#f472b6', '#7df9ff'] },
]
export const skinFor = (profile) => {
  const s = SKINS.find((k) => k.id === profile.skin)
  return s && s.rank <= rankOf(profile.xp).index ? s : SKINS[0]
}

export const NEW_PILOT = { xp: 0, skin: 'classic', day: '', done: [], tipsDone: false }

// A finished round: XP, missions newly done today, rank-up. Returns the new profile and what changed.
export function applyRound(profile, day, result) {
  const p = profile.day === day ? profile : { ...profile, day, done: [] }
  const completed = missionsFor(day).filter((m) => !p.done.includes(m.id) && m.done(result))
  const gained = Math.floor(result.score / 10) + completed.length * MISSION_XP
  const next = { ...p, xp: p.xp + gained, done: [...p.done, ...completed.map((m) => m.id)] }
  return { profile: next, gained, completed, rankUp: rankOf(next.xp).index > rankOf(p.xp).index }
}

// The ship's path, trimmed to one round (100 ms samples as x, y pairs).
const GHOST_POINTS = 2 * (ROUND_MS / 100 + 2)
export const ghostOf = (trail) => trail.slice(0, GHOST_POINTS)
