import { RiCheckboxBlankCircleLine, RiCheckboxCircleFill, RiLockLine } from 'react-icons/ri'

import { MISSION_XP, missionsFor, rankOf, RANKS, SKINS, skinFor } from '../game/pilot'

/*
 * Nebula Rush pilot progress for the arcade (pages/Play.jsx): rank, today's
 * missions and the skin picker before a round, XP and missions after it.
 */

function RankBar({ xp }) {
  const r = rankOf(xp)
  return (
    <div className='w-full'>
      <div className='flex items-baseline justify-between text-sm'>
        <span className='font-bold'>{r.name}</span>
        <span className='text-xs tabular-nums text-white/60'>{r.next ? `${xp} / ${r.next} XP` : `${xp} XP · top rank`}</span>
      </div>
      <div className='mt-1 h-2 overflow-hidden rounded-full bg-white/10'>
        <div className='h-full rounded-full bg-[#7df9ff] transition-[width] duration-700' style={{ width: `${r.progress * 100}%` }} />
      </div>
    </div>
  )
}

const Label = ({ children }) => <p className='text-[11px] font-bold uppercase tracking-wider text-white/60'>{children}</p>

export function PilotLobby({ day, profile, onSkin }) {
  const done = profile.day === day ? profile.done : []
  const rank = rankOf(profile.xp).index
  const current = skinFor(profile)
  return (
    <div className='mt-4 w-full space-y-4 rounded-2xl bg-white/5 p-4 text-left ring-1 ring-white/10'>
      <RankBar xp={profile.xp} />
      <div>
        <Label>Today’s missions · +{MISSION_XP} XP each</Label>
        <ul className='mt-2 space-y-1.5'>
          {missionsFor(day).map((m) => {
            const ok = done.includes(m.id)
            return (
              <li key={m.id} className='flex items-center gap-2 text-sm'>
                {ok ? <RiCheckboxCircleFill className='shrink-0 text-[#22c55e]' /> : <RiCheckboxBlankCircleLine className='shrink-0 text-white/40' />}
                <span className={ok ? 'text-white/50 line-through' : ''}>{m.text}</span>
              </li>
            )
          })}
        </ul>
      </div>
      <div>
        <Label>Ship</Label>
        <div className='mt-2 flex flex-wrap gap-2'>
          {SKINS.map((s) => {
            const locked = s.rank > rank
            const on = current.id === s.id
            return (
              <button
                key={s.id}
                type='button'
                disabled={locked}
                onClick={() => onSkin(s.id)}
                aria-label={locked ? `${s.name}, unlocks at ${RANKS[s.rank].name}` : s.name}
                aria-pressed={on}
                className={`flex h-10 w-10 items-center justify-center rounded-full ring-2 transition active:scale-90 disabled:opacity-40 ${on ? 'ring-[#7df9ff]' : 'ring-white/10'}`}
                style={{ background: `linear-gradient(135deg, ${s.wing}, ${s.edge})` }}
              >
                {locked && <RiLockLine size={14} className='text-white' />}
              </button>
            )
          })}
        </div>
        <p className='mt-1.5 text-xs text-white/50'>{current.name} · rank up to unlock more</p>
      </div>
    </div>
  )
}

export function PilotResult({ news }) {
  return (
    <div className='mt-4 w-full rounded-2xl bg-white/5 p-3 text-left ring-1 ring-white/10'>
      <div className='mb-2 flex items-center justify-between'>
        <span className='text-sm font-semibold text-[#7df9ff]'>+{news.gained} XP</span>
        {news.rankUp && (
          <span className='animate-pop rounded-full bg-[#7df9ff] px-2 py-0.5 text-xs font-bold text-[#1c0b33]'>
            Rank up: {rankOf(news.profile.xp).name}!
          </span>
        )}
      </div>
      <RankBar xp={news.profile.xp} />
      {news.completed.map((m) => (
        <p key={m.id} className='mt-1.5 flex items-center gap-1.5 text-xs text-[#22c55e]'>
          <RiCheckboxCircleFill className='shrink-0' /> {m.text} · +{MISSION_XP} XP
        </p>
      ))}
    </div>
  )
}
