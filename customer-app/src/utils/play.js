import { api } from '../constants/api'
import { istDay } from '../game/nebula'
import { NEW_PILOT } from '../game/pilot'

/*
 * GullyPlay helpers, per game ('nebula', 'reflex'): the server's score and
 * leaderboard routes, and today's best kept on the phone. Players are the same
 * people as in GullyPulse: the order key (usePulseKey) proves they ordered.
 */

export const play = (game, key, path, options = {}) =>
  api(`/games/${game}${path}`, { ...options, headers: key ? { 'X-Gully-Order': key } : undefined })

// Adds a number to an order placed without one (one identity across orders and carts).
export const linkPhone = (key, phone) => api('/games/phone', { method: 'POST', body: { phone }, headers: { 'X-Gully-Order': key } })

const BEST = (game) => `${game}-best` // { day, score }
const PENDING = (game) => `${game}-pending` // the best round not yet sent: { day, score, durationMs, stats }

// Storage can be missing or blocked (private mode): the game still works.
function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}
function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* not saved; fine */
  }
}

export function bestToday(game) {
  const b = read(BEST(game))
  return b?.day === istDay() ? b.score : 0
}

// Records a finished round. Returns { best, newBest }.
export function saveRound(game, day, round) {
  const old = read(BEST(game))
  const before = old?.day === day ? old.score : 0
  const newBest = round.score > before
  if (newBest) write(BEST(game), { day, score: round.score })
  return { best: Math.max(before, round.score), newBest }
}

/*
 * Sends a round to the leaderboard. If it can't be sent (offline), the round
 * waits on the phone and goes with the next one. Returns the server's
 * { best, rank } or null.
 */
export async function submitRound(game, key, day, round) {
  if (!key) return null
  const body = { day, score: round.score, durationMs: round.durationMs, stats: round.stats }
  const waiting = read(PENDING(game))
  if (waiting && waiting.day >= istDay(Date.now() - 864e5) && waiting.score > body.score) {
    try {
      await play(game, key, '/scores', { method: 'POST', body: waiting })
    } catch {
      /* try again next round */
    }
  }
  try {
    const r = await play(game, key, '/scores', { method: 'POST', body })
    write(PENDING(game), null)
    return r
  } catch (e) {
    // Offline or server down: keep the better round for later. A refused round (400) is dropped.
    if (!e.status || e.status >= 500) {
      if (!waiting || body.score > waiting.score) write(PENDING(game), body)
    }
    throw e
  }
}

// Nebula Rush pilot (game/pilot.js).
const PILOT = 'nebula-pilot'
export const loadPilot = () => ({ ...NEW_PILOT, ...read(PILOT) })
export const savePilot = (p) => write(PILOT, p)

// Arcade settings, for every game.
const PREFS = 'gullyplay-prefs'
export function loadPrefs() {
  const calm = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return { calm: Boolean(calm), haptics: true, ...read(PREFS) }
}
export const savePrefs = (p) => write(PREFS, p)
