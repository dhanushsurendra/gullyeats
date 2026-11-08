import { api } from '../constants/api'
import { istDay } from '../game/nebula'

/*
 * GullyPlay (Nebula Rush) helpers: the server's score and leaderboard routes,
 * and today's best kept on the phone. Players are the same people as in
 * GullyPulse: the order key (usePulseKey) proves they ordered.
 */

export const play = (key, path, options = {}) =>
  api(`/games/nebula${path}`, { ...options, headers: key ? { 'X-Gully-Order': key } : undefined })

const BEST = 'nebula-best' // { day, score }
const PENDING = 'nebula-pending' // the best round not yet sent: { day, score, durationMs, stats }

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

export function bestToday() {
  const b = read(BEST)
  return b?.day === istDay() ? b.score : 0
}

// Records a finished round. Returns { best, newBest }.
export function saveRound(day, round) {
  const old = read(BEST)
  const before = old?.day === day ? old.score : 0
  const newBest = round.score > before
  if (newBest) write(BEST, { day, score: round.score })
  return { best: Math.max(before, round.score), newBest }
}

/*
 * Sends a round to the leaderboard. If it can't be sent (offline), the round
 * waits on the phone and goes with the next one. Returns the server's
 * { best, rank } or null.
 */
export async function submitRound(key, day, round) {
  if (!key) return null
  const body = { day, score: round.score, durationMs: round.durationMs, stats: { kills: round.kills, energy: round.energy, hits: round.hits } }
  const waiting = read(PENDING)
  if (waiting && waiting.day >= istDay(Date.now() - 864e5) && waiting.score > body.score) {
    try {
      await play(key, '/scores', { method: 'POST', body: waiting })
    } catch {
      /* try again next round */
    }
  }
  try {
    const r = await play(key, '/scores', { method: 'POST', body })
    write(PENDING, null)
    return r
  } catch (e) {
    // Offline or server down: keep the better round for later. A refused round (400) is dropped.
    if (!e.status || e.status >= 500) {
      if (!waiting || body.score > waiting.score) write(PENDING, body)
    }
    throw e
  }
}
