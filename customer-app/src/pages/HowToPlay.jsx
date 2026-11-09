import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { RiArrowLeftSLine } from 'react-icons/ri'

/*
 * How to play the GullyPlay games, in plain words. Opened from each game's
 * lobby (/play/how-to-play#<game>) and from the token page. Always dark, like
 * the arcade.
 */
const GUIDES = [
  {
    id: 'nebula',
    title: 'Nebula Rush',
    time: '55 seconds',
    goal: 'Fly your ship through space, blast rocks, and take down the Mothership at the end.',
    steps: [
      'Drag your finger anywhere on the screen to move your ship. It shoots by itself.',
      'Shoot rocks, comets and drones for points. Drones chase you and shoot back.',
      'Every 10 seconds the direction everything comes from turns. A warning shows just before.',
      'Grab the ⚡ energy for extra points. Grab power-ups for a shield, faster shooting, or a magnet that pulls energy to you.',
      'Fly close past rocks without touching them for “near miss” points.',
      'When the Nova bar is full, double-tap to blow up everything on screen.',
      'At the end the Mothership arrives. Keep shooting it. Points count double in this last part.',
    ],
    careful: 'Three hits and your ship is down, and the round ends.',
  },
  {
    id: 'reflex',
    title: 'Zero Reflex',
    time: '30 seconds',
    goal: 'Follow the rule at the top and tap the right shapes as fast as you can.',
    steps: [
      'A rule shows at the top, like “Tap CYAN”, “Tap ▲” or “Tap anything but ORANGE”.',
      'Shapes pop up. Tap only the ones that match the rule.',
      'Later the rules get harder: “Tap only CYAN ▲” means the colour and the shape must both match.',
      'The faster you tap, the more points you get.',
      'Get 5 right in a row for double points, 10 in a row for triple.',
      'A gold ★ sometimes pops up. Tap it quickly for a bonus, whatever the rule says.',
      'In the last 5 seconds every point counts double.',
    ],
    careful: 'A wrong tap loses points and your streak. When it says FREEZE, don’t tap anything until it ends: you get a bonus for holding still.',
    extra: 'Each day has a twist: Tiny (smaller targets), Rush (more targets that vanish faster), Blackout (the rule hides after a second, so remember it) or Drift (targets float around).',
  },
  {
    id: 'synapse',
    title: 'Synapse',
    time: '45 seconds',
    goal: 'Remember a chain of glowing neurons that grows by one every time you get it right.',
    steps: [
      'First, 3 neurons light up one after another. Watch the order (each one has its own sound too).',
      'When it says YOUR TURN, tap the same neurons in the same order.',
      'Next time, only the NEW neuron lights up. Tap the whole chain again from the start, and finish with the new one.',
      'Example: you tapped Blue, Pink, Yellow. Now Green lights up. Tap Blue, Pink, Yellow, Green.',
      'At 6, 10 and 14 neurons it says REVERSE. The whole chain is shown again: tap it backwards, for double points.',
      'Tap quickly for a speed bonus. In the last 10 seconds every point counts double.',
    ],
    careful:
      'Tapping the wrong neuron, or waiting too long, is a miss: the whole chain is shown again so you can retry. Three misses and the round ends. Get 3 chains right in a row to earn a shield, which forgives one miss.',
    extra: 'Each day has a twist: Silent (no sounds after the first chain), Shuffle (the circle turns after each chain, so follow the colours), Mirror (tap the neuron opposite the one that lights up) or Ghost (the new neuron only makes a sound, it doesn’t light up).',
  },
]

export default function HowToPlay() {
  const navigate = useNavigate()
  const { hash } = useLocation()

  // Opened for one game: jump to it.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])

  // Back to the game when we came from one; otherwise home.
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))

  return (
    <div className='mx-auto min-h-dvh max-w-md bg-[#070b1f] text-white'>
      <header className='sticky top-0 z-10 flex h-14 items-center gap-2 bg-[#070b1f]/95 px-3 backdrop-blur'>
        <button
          type='button'
          onClick={back}
          aria-label='Back'
          className='flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition active:scale-90'
        >
          <RiArrowLeftSLine size={24} />
        </button>
        <h1 className='text-lg font-bold'>How to play</h1>
      </header>

      <main className='space-y-4 px-4 pb-10 pt-2'>
        <p className='text-sm text-white/70'>
          Every game is the same for everyone today, so you can compare scores fairly. Your best score of the day goes on the
          leaderboard, which starts fresh at midnight.
        </p>

        {GUIDES.map((g) => (
          <section key={g.id} id={g.id} className='scroll-mt-16 rounded-2xl bg-white/6 p-4 ring-1 ring-white/10'>
            <div className='flex items-baseline justify-between gap-2'>
              <h2 className='text-xl font-bold'>{g.title}</h2>
              <span className='shrink-0 text-xs font-semibold text-white/60'>{g.time}</span>
            </div>
            <p className='mt-1 text-sm text-[#7df9ff]'>{g.goal}</p>
            <ol className='mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-white/90'>
              {g.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p className='mt-3 rounded-xl bg-[#ff6b6b]/10 px-3 py-2 text-sm leading-relaxed text-white/90 ring-1 ring-[#ff6b6b]/30'>
              <span className='font-semibold text-[#ff8f8f]'>Be careful: </span>
              {g.careful}
            </p>
            {g.extra && <p className='mt-2 text-sm leading-relaxed text-white/70'>{g.extra}</p>}
          </section>
        ))}
      </main>
    </div>
  )
}
