// Run with: node --test "src/game/*.test.js"
import { test } from 'node:test'
import assert from 'node:assert'

import { applyRound, ghostOf, MISSION_XP, missionsFor, NEW_PILOT, rankOf, RANKS, skinFor } from './pilot.js'
import { ROUND_MS } from './nebula.js'

const round = (score, stats = {}, durationMs = ROUND_MS) => ({
  score,
  durationMs,
  stats: { kills: 0, drones: 0, energy: 0, near: 0, hits: 0, boss: 0, bossHits: 0, maxCombo: 1, bombs: 0, powers: 0, ...stats },
})

test('three different missions a day, the same for everyone', () => {
  const a = missionsFor('2026-11-09')
  assert.strictEqual(a.length, 3)
  assert.strictEqual(new Set(a.map((m) => m.id)).size, 3)
  assert.deepStrictEqual(missionsFor('2026-11-09').map((m) => m.id), a.map((m) => m.id))
  const days = Array.from({ length: 10 }, (_, i) => missionsFor(`2026-12-${10 + i}`).map((m) => m.id).join())
  assert.ok(new Set(days).size > 3)
})

test('XP turns into the right rank', () => {
  assert.strictEqual(rankOf(0).name, 'Cadet')
  assert.strictEqual(rankOf(299).name, 'Cadet')
  assert.strictEqual(rankOf(300).name, 'Pilot')
  assert.strictEqual(rankOf(1450).progress, (1450 - 900) / (2000 - 900))
  assert.strictEqual(rankOf(99999).name, RANKS.at(-1).name)
  assert.strictEqual(rankOf(99999).next, null)
})

test('a round pays XP and each mission only once a day', () => {
  const day = '2026-11-09'
  const all = round(5000, { near: 99, boss: 1, bossHits: 120, maxCombo: 5, bombs: 2, powers: 5, drones: 5, kills: 99 })
  const first = applyRound(NEW_PILOT, day, all)
  assert.strictEqual(first.completed.length, 3)
  assert.strictEqual(first.gained, 500 + 3 * MISSION_XP)
  assert.ok(first.rankUp)
  const again = applyRound(first.profile, day, all)
  assert.strictEqual(again.completed.length, 0)
  assert.strictEqual(again.gained, 500)
  // A new day, new missions to do.
  assert.strictEqual(applyRound(again.profile, '2026-11-10', all).completed.length, 3)
})

test('a locked skin falls back to Classic', () => {
  assert.strictEqual(skinFor({ ...NEW_PILOT, skin: 'void' }).id, 'classic')
  assert.strictEqual(skinFor({ ...NEW_PILOT, xp: 99999, skin: 'void' }).id, 'void')
})

test('the ghost is capped at one round', () => {
  const trail = Array.from({ length: 5000 }, (_, i) => i)
  assert.strictEqual(ghostOf(trail).length, 2 * (ROUND_MS / 100 + 2))
})
