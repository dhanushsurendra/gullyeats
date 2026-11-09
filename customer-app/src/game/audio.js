/*
 * GullyPlay sound: every effect and the music loop are synthesised with Web
 * Audio, so there are no files to download and it works offline.
 *
 *   audio.unlock()           // from a tap: phones only allow sound after one
 *   audio.play('boom', { size: 'big' })
 *   audio.music.start() / .stop() / .setIntense(true)
 *   audio.setMuted(true)     // remembered on the phone
 *
 * Phones without Web Audio (or with it blocked) stay silent; nothing breaks.
 */

const MUTE_KEY = 'gullyplay-muted'

let ctx = null
let master = null
let musicBus = null
let noiseBuf = null
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
})()

function ensure() {
  if (ctx) return ctx
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
  if (!AC) return null
  try {
    ctx = new AC()
  } catch {
    return null
  }
  master = ctx.createGain()
  master.gain.value = muted ? 0 : 0.8
  // A gentle limiter, so a pile of explosions can't clip.
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -12
  comp.ratio.value = 6
  master.connect(comp).connect(ctx.destination)
  musicBus = ctx.createGain()
  musicBus.gain.value = 0.55
  musicBus.connect(master)
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return ctx
}

// One note: an oscillator with a quick attack and an exponential fade, optionally sliding in pitch.
function tone({ freq, to, type = 'sine', dur = 0.15, gain = 0.1, at = 0, bus, attack = 0.005 }) {
  const t = ctx.currentTime + at
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(bus || master)
  o.start(t)
  o.stop(t + dur + 0.02)
}

// A burst of filtered noise: explosions, whooshes, hats.
function noise({ dur = 0.2, gain = 0.2, freq = 1200, to, type = 'lowpass', at = 0, q = 0.7, bus }) {
  const t = ctx.currentTime + at
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  const f = ctx.createBiquadFilter()
  f.type = type
  f.Q.value = q
  f.frequency.setValueAtTime(freq, t)
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(bus || master)
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.02)
}

const CHIME = [659, 740, 830, 988, 1109] // rises with the energy combo
let lastShot = 0

const SOUNDS = {
  // Nebula Rush
  shoot({ overdrive }) {
    // Auto-fire is constant: keep it soft and thin it out.
    const now = ctx.currentTime
    if (now - lastShot < (overdrive ? 0.1 : 0.16)) return
    lastShot = now
    tone({ freq: overdrive ? 1300 : 950, to: overdrive ? 500 : 380, type: 'square', dur: 0.06, gain: 0.018 })
  },
  ping: () => tone({ freq: 1500, to: 1100, type: 'triangle', dur: 0.04, gain: 0.03 }),
  boom({ size }) {
    if (size === 'drone') {
      noise({ dur: 0.6, gain: 0.45, freq: 2400, to: 200 })
      tone({ freq: 220, to: 40, type: 'sawtooth', dur: 0.5, gain: 0.12 })
      return
    }
    const big = size === 'big'
    noise({ dur: big ? 0.38 : 0.2, gain: big ? 0.32 : 0.2, freq: big ? 1100 : 2200, to: 120 })
    if (big) tone({ freq: 110, to: 38, dur: 0.3, gain: 0.22 })
  },
  comet: () => noise({ dur: 0.45, gain: 0.07, freq: 4000, to: 500, type: 'bandpass', q: 3 }),
  drone() {
    tone({ freq: 196, to: 247, type: 'sawtooth', dur: 0.25, gain: 0.05 })
    tone({ freq: 247, to: 196, type: 'sawtooth', dur: 0.25, gain: 0.05, at: 0.25 })
  },
  energy({ combo = 1 }) {
    const f = CHIME[Math.min(combo, CHIME.length) - 1]
    tone({ freq: f, dur: 0.22, gain: 0.09 })
    tone({ freq: f * 2, dur: 0.16, gain: 0.035, at: 0.04 })
  },
  power() {
    ;[523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'square', dur: 0.09, gain: 0.04, at: i * 0.055 }))
  },
  powerEnd: () => [784, 523].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.1, gain: 0.04, at: i * 0.08 })),
  shieldBreak() {
    tone({ freq: 2200, to: 700, type: 'triangle', dur: 0.3, gain: 0.08 })
    noise({ dur: 0.15, gain: 0.12, freq: 6000, type: 'highpass' })
  },
  hit() {
    tone({ freq: 180, to: 50, type: 'sawtooth', dur: 0.35, gain: 0.16 })
    noise({ dur: 0.3, gain: 0.3, freq: 900, to: 100 })
  },
  near: () => tone({ freq: 1760, to: 2200, dur: 0.05, gain: 0.035 }),
  warn() {
    for (let i = 0; i < 3; i++) tone({ freq: 880, type: 'square', dur: 0.08, gain: 0.04, at: i * 0.18 })
  },
  shift() {
    noise({ dur: 0.45, gain: 0.12, freq: 300, to: 3000, type: 'bandpass', q: 2 })
    tone({ freq: 160, to: 640, dur: 0.35, gain: 0.07 })
  },
  surge() {
    tone({ freq: 110, to: 880, type: 'sawtooth', dur: 0.7, gain: 0.07 })
    ;[440, 554, 659].forEach((f) => tone({ freq: f, type: 'square', dur: 0.5, gain: 0.03, at: 0.6 }))
  },
  sector: () => [392, 523, 659].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.14, gain: 0.05, at: i * 0.07 })),
  enemyShot({ big }) {
    tone({ freq: big ? 520 : 700, to: big ? 260 : 420, type: 'sawtooth', dur: big ? 0.18 : 0.1, gain: big ? 0.05 : 0.03 })
  },
  bossIn() {
    tone({ freq: 55, to: 110, type: 'sawtooth', dur: 1.4, gain: 0.14 })
    tone({ freq: 82, to: 165, type: 'square', dur: 1.4, gain: 0.04 })
    noise({ dur: 1.2, gain: 0.08, freq: 200, to: 1200, type: 'bandpass', q: 1.5 })
  },
  laserWarn() {
    for (let i = 0; i < 4; i++) tone({ freq: 1240, type: 'square', dur: 0.05, gain: 0.035, at: i * 0.2 })
  },
  laser() {
    tone({ freq: 140, to: 90, type: 'sawtooth', dur: 0.6, gain: 0.12 })
    noise({ dur: 0.6, gain: 0.15, freq: 3000, to: 800, type: 'bandpass', q: 1 })
  },
  bossDown() {
    noise({ dur: 1.6, gain: 0.5, freq: 3000, to: 80 })
    tone({ freq: 160, to: 30, type: 'sawtooth', dur: 1.4, gain: 0.18 })
    ;[523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, type: 'square', dur: 0.2, gain: 0.05, at: 0.6 + i * 0.08 }))
  },
  bomb() {
    noise({ dur: 0.9, gain: 0.4, freq: 600, to: 6000, type: 'bandpass', q: 0.8 })
    tone({ freq: 90, to: 30, type: 'sine', dur: 0.8, gain: 0.3 })
  },
  bombReady: () => [880, 1320].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.14, gain: 0.06, at: i * 0.09 })),
  over({ crashed }) {
    const notes = crashed ? [392, 330, 262, 196] : [523, 659, 784, 1047]
    notes.forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.22, gain: 0.08, at: i * 0.13 }))
  },
  // Zero Reflex
  right({ streak = 0 }) {
    const f = 880 * 2 ** (Math.min(streak, 12) / 24) // creeps up as the streak grows
    tone({ freq: f, dur: 0.12, gain: 0.08 })
    tone({ freq: f * 1.5, dur: 0.1, gain: 0.04, at: 0.03 })
  },
  wrong: () => tone({ freq: 140, to: 110, type: 'square', dur: 0.2, gain: 0.07 }),
  missed: () => tone({ freq: 300, to: 200, type: 'triangle', dur: 0.12, gain: 0.03 }),
  rule: ({ freeze }) =>
    freeze
      ? [523, 523].forEach((f, i) => tone({ freq: f / 2, type: 'square', dur: 0.12, gain: 0.06, at: i * 0.15 }))
      : tone({ freq: 660, to: 990, type: 'triangle', dur: 0.12, gain: 0.06 }),
  hold: () => [659, 988].forEach((f, i) => tone({ freq: f, dur: 0.18, gain: 0.07, at: i * 0.09 })),
  // Synapse: each neuron has its own note, so the chain can be heard.
  fire: ({ note }) => {
    // Silent day: a soft tick instead of the neuron's note.
    if (!note) return tone({ freq: 2000, type: 'square', dur: 0.02, gain: 0.015 })
    tone({ freq: note, type: 'triangle', dur: 0.32, gain: 0.09 })
    tone({ freq: note * 2, dur: 0.18, gain: 0.025 })
  },
  link: ({ note }) => tone({ freq: note, type: 'sine', dur: 0.2, gain: 0.1 }),
  chain: ({ length = 3 }) =>
    [0, 4, 7, 12].forEach((s, i) => tone({ freq: 523 * 2 ** ((s + Math.min(length - 3, 7)) / 12), type: 'triangle', dur: 0.14, gain: 0.06, at: i * 0.06 })),
  shieldUp: () => [988, 1319, 1760].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.12, gain: 0.05, at: i * 0.06 })),
  reverse: () => tone({ freq: 990, to: 495, type: 'square', dur: 0.35, gain: 0.05 }),
  // The arcade
  count: () => tone({ freq: 440, type: 'square', dur: 0.1, gain: 0.05 }),
  go: () => tone({ freq: 880, type: 'square', dur: 0.25, gain: 0.06 }),
  best: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.25, gain: 0.07, at: 0.5 + i * 0.09 })),
  ready() {
    ;[784, 988, 1175].forEach((f, i) => tone({ freq: f, dur: 0.5, gain: 0.08, at: i * 0.14 }))
    ;[784, 988, 1175].forEach((f, i) => tone({ freq: f, dur: 0.5, gain: 0.08, at: 0.7 + i * 0.14 }))
  },
}

/*
 * The music: a short synth loop (Am - F - C - G), bass and arpeggio, with
 * hats when it's intense. Notes are scheduled a little ahead on the audio
 * clock so timers can wobble without the beat wobbling.
 */
const CHORDS = [
  [57, 60, 64, 69], // Am
  [53, 57, 60, 65], // F
  [48, 52, 55, 60], // C
  [55, 59, 62, 67], // G
]
const midi = (n) => 440 * 2 ** ((n - 69) / 12)
const music = {
  timer: null,
  step: 0,
  next: 0,
  intense: false,
  start() {
    if (!ensure() || this.timer) return
    this.step = 0
    this.next = ctx.currentTime + 0.05
    this.timer = setInterval(() => this.schedule(), 40)
  },
  stop() {
    clearInterval(this.timer)
    this.timer = null
  },
  setIntense(on) {
    this.intense = on
  },
  schedule() {
    if (ctx.state !== 'running') return
    const sixteenth = 60 / (this.intense ? 138 : 112) / 4
    while (this.next < ctx.currentTime + 0.15) {
      const at = this.next - ctx.currentTime
      const s = this.step % 16
      const chord = CHORDS[Math.floor(this.step / 16) % CHORDS.length]
      if (s === 0 || s === 6 || s === 8 || s === 14) {
        tone({ freq: midi(chord[0] - 12), type: 'triangle', dur: sixteenth * 2.5, gain: 0.11, at, bus: musicBus })
      }
      const arp = chord[[0, 1, 2, 3, 2, 1][s % 6]] + 12
      tone({ freq: midi(arp), type: 'square', dur: sixteenth * 0.9, gain: s % 4 === 0 ? 0.022 : 0.014, at, bus: musicBus })
      if (this.intense && s % 2 === 1) noise({ dur: 0.04, gain: 0.05, freq: 8000, type: 'highpass', at, bus: musicBus })
      this.next += sixteenth
      this.step += 1
    }
  },
}

export const audio = {
  // Call from a tap. Creates or wakes the audio context.
  unlock() {
    if (!ensure()) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  },
  play(name, opts = {}) {
    if (muted || !ctx || ctx.state !== 'running') return
    try {
      SOUNDS[name]?.(opts)
    } catch {
      /* a sound failing never stops the game */
    }
  },
  music,
  get muted() {
    return muted
  },
  setMuted(on) {
    muted = on
    try {
      localStorage.setItem(MUTE_KEY, on ? '1' : '0')
    } catch {
      /* not remembered; fine */
    }
    if (master) master.gain.setTargetAtTime(on ? 0 : 0.8, ctx.currentTime, 0.02)
  },
}
