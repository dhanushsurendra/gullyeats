import * as nebula from './nebula'
import * as reflex from './reflex'

/*
 * The GullyPlay games, as the arcade page (pages/Play.jsx) needs them: how to
 * make, run, draw and control a round, and what to show at the end. Each
 * engine leaves what happened in `game.events` ({ type, ... }); the page plays
 * those through game/audio.js under the same names.
 * `id` is also the server's game name (/api/games/:id).
 */

// Score, time bar and anything else the game wants on top.
function hudBase(ctx, game, roundMs) {
  const { w } = game
  const left = Math.max(0, roundMs - game.t)
  const urgent = left < Math.min(10000, roundMs / 4)
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fillRect(16, 10, w - 32, 4)
  ctx.fillStyle = urgent ? '#ff6b6b' : '#22d3ee'
  ctx.fillRect(16, 10, (w - 32) * (left / roundMs), 4)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 26px Poppins, system-ui, sans-serif'
  ctx.fillText(String(game.score), 16, 46)
  ctx.textAlign = 'right'
  ctx.fillStyle = urgent ? '#ff6b6b' : '#ffffff'
  ctx.font = '700 20px Poppins, system-ui, sans-serif'
  ctx.fillText(`${Math.ceil(left / 1000)}s`, w - 16, 42)
}

const POWER_LABEL = { overdrive: 'OVERDRIVE', magnet: 'MAGNET' }

const nebulaGame = {
  id: 'nebula',
  title: 'Nebula Rush',
  tagline: 'Dodge rocks, blast drones',
  seconds: 45,
  controls: 'drag',
  hint: 'Drag anywhere to fly · grab ⚡ energy and power-ups · skim rocks for bonus',
  boardNote: 'Same rocks for everyone today. Resets at midnight.',
  music: true,
  intense: (game) => game.surge,
  create: (day, size) => nebula.createGame(nebula.seedFor(day), size),
  step: nebula.step,
  result: nebula.result,
  draw(ctx, game) {
    nebula.draw(ctx, game)
    hudBase(ctx, game, nebula.ROUND_MS)
    ctx.textAlign = 'left'
    ctx.font = '700 13px Poppins, system-ui, sans-serif'
    let y = 66
    if (game.combo > 1) {
      ctx.fillStyle = '#fde047'
      ctx.fillText(`⚡ x${game.combo}`, 16, y)
      y += 18
    }
    if (game.surge) {
      ctx.fillStyle = '#fe5200'
      ctx.fillText('SURGE x2', 16, y)
    }
    // Hull: three pips, plus a ring when shielded.
    for (let i = 0; i < nebula.MAX_HITS; i++) {
      ctx.fillStyle = i < nebula.MAX_HITS - game.hits ? '#fe5200' : 'rgba(255,255,255,0.18)'
      ctx.beginPath()
      ctx.arc(game.w - 22 - i * 16, 60, 5, 0, Math.PI * 2)
      ctx.fill()
    }
    if (game.ship.shield) {
      ctx.strokeStyle = '#22d3ee'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(game.w - 22 - nebula.MAX_HITS * 16, 60, 6, 0, Math.PI * 2)
      ctx.stroke()
    }
    // Timed power-ups, as draining bars.
    let py = 78
    for (const [k, ms] of Object.entries(game.power)) {
      if (ms <= 0) continue
      const st = nebula.POWER_STYLE[k]
      ctx.textAlign = 'right'
      ctx.fillStyle = st.color
      ctx.font = '700 10px Poppins, system-ui, sans-serif'
      ctx.fillText(POWER_LABEL[k], game.w - 16, py)
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.fillRect(game.w - 76, py + 4, 60, 3)
      ctx.fillStyle = st.color
      ctx.fillRect(game.w - 76, py + 4, 60 * (ms / nebula.POWER_MS[k]), 3)
      py += 20
    }
  },
  overTitle: (r) => (r.stats.hits >= nebula.MAX_HITS ? 'Ship down' : 'Time’s up'),
  stats: (r) => [
    ['Destroyed', r.stats.kills + r.stats.drones],
    ['Energy', r.stats.energy],
    ['Near misses', r.stats.near],
  ],
}

const reflexGame = {
  id: 'reflex',
  title: 'Zero Reflex',
  tagline: 'Tap fast. Or don’t.',
  seconds: 20,
  controls: 'tap',
  hint: 'Follow the rule at the top · on FREEZE, don’t tap',
  boardNote: 'Same rules for everyone today. Resets at midnight.',
  music: true,
  intense: (game) => game.t >= 15000,
  create: (day, size) => reflex.createGame(reflex.seedFor(day), size),
  step: (game, dt) => reflex.step(game, dt),
  tap: reflex.tap,
  result: reflex.result,
  draw(ctx, game) {
    reflex.draw(ctx, game)
    hudBase(ctx, game, reflex.ROUND_MS)
    const x = reflex.multiplierOf(game)
    if (game.streak > 1) {
      ctx.textAlign = 'left'
      ctx.fillStyle = x > 1 ? '#fde047' : 'rgba(255,255,255,0.7)'
      ctx.font = '700 13px Poppins, system-ui, sans-serif'
      ctx.fillText(x > 1 ? `🔥 ${game.streak} streak · x${x}` : `${game.streak} streak`, 16, 66)
    }
  },
  overTitle: () => 'Time’s up',
  stats: (r) => {
    const tries = r.stats.hits + r.stats.wrong + r.stats.missed
    return [
      ['Accuracy', tries ? `${Math.round((100 * r.stats.hits) / tries)}%` : '–'],
      ['Avg reaction', r.stats.hits ? `${r.stats.avgMs} ms` : '–'],
    ]
  },
}

export const GAMES = { nebula: nebulaGame, reflex: reflexGame }
export { istDay } from './nebula'
