import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { RiAddLine, RiFireLine, RiQuillPenLine, RiSpyLine, RiTimeLine } from 'react-icons/ri'

import { ConfessionCard, ConfessionSkeleton, PulseLocked, ReportSheet, Toast } from '../components/Confession'
import { Button, Page, TopBar } from '../components/ui'
import { useLike, useNearScreen, usePaged } from '../hooks/usePulse'
import { pulse, usePulseKey } from '../utils/pulse'

const MY_STATUS = {
  published: ['Live', 'bg-success-soft text-success'],
  in_review: ['In review', 'bg-amber-50 text-amber-700'],
  removed: ['Not shown', 'bg-grey-100 text-grey-500'],
}

// GullyPulse feed: popular anonymous confessions, newest-weighted.
export default function Confessions() {
  const navigate = useNavigate()
  const location = useLocation()
  const key = usePulseKey()
  const [tab, setTab] = useState('feed')
  const [mine, setMine] = useState(null)
  const [reporting, setReporting] = useState(null)
  const [toast, setToast] = useState(location.state?.toast || '')
  const clearToast = useCallback(() => setToast(''), [])

  const load = useCallback(
    (cursor) => pulse(key, `/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
    [key],
  )
  const feed = usePaged(load)
  const { setItems } = feed
  const update = useCallback(
    (id, fn) => setItems((list) => list.map((c) => (c.id === id ? fn(c) : c))),
    [setItems],
  )
  const like = useLike(key, update, setToast)
  const sentinel = useNearScreen(feed.more, !feed.loading && !feed.done && !feed.error)

  // Don't keep the toast for the next visit (back button).
  useEffect(() => {
    if (location.state?.toast) navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate])

  useEffect(() => {
    if (tab !== 'mine' || !key) return undefined
    let live = true
    pulse(key, '/mine')
      .then((rows) => live && setMine(rows))
      .catch((e) => live && setToast(e.message))
    return () => {
      live = false
    }
  }, [tab, key])

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))
  const compose = () =>
    key ? navigate('/confessions/new') : setToast('Place an order at any GullyEats cart to post a confession.')
  const report = (c) => (key ? setReporting(c) : setToast('Place an order at any GullyEats cart to report.'))

  // reporting?.: the React Compiler reads these paths while rendering, when reporting can be null.
  const sendReport = async (reason) => {
    const id = reporting?.id
    const r = await pulse(key, `/${id}/report`, { method: 'POST', body: { reason } })
    if (r.hidden) setItems((list) => list.filter((c) => c.id !== id))
    setReporting(null)
    setToast(r.hidden ? 'Thanks. This post is hidden while our team reviews it.' : 'Thanks for reporting. Our team will take a look.')
  }

  if (!key) return <PulseLocked onBack={back} />

  return (
    <Page>
      <TopBar title='GullyPulse' subtitle='Anonymous confessions' onBack={back} />

      <main className='flex-1 space-y-4 px-4 pb-32 pt-4'>
        <section className='animate-fade-up relative overflow-hidden rounded-card bg-linear-to-br from-night-deep via-night to-night-soft p-5 text-white shadow-card'>
          <RiSpyLine size={120} className='absolute -right-6 -top-4 text-lilac/20' aria-hidden />
          <p className='text-xs font-bold uppercase tracking-wider text-lilac'>Open confession</p>
          <h2 className='mt-1 text-xl font-bold leading-snug'>Say it. Nobody will know it was you.</h2>
          <p className='mt-1 text-sm text-white/75'>Only people who've ordered can post. Be kind, no names.</p>
          <button
            type='button'
            onClick={compose}
            className='mt-4 flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-dark active:scale-95'
          >
            <RiQuillPenLine size={18} /> Write a confession
          </button>
        </section>

        {key && (
          <div className='flex gap-2' role='tablist' aria-label='Show'>
            {[
              ['feed', 'Popular', <RiFireLine key='i' size={16} />],
              ['mine', 'My posts', <RiTimeLine key='i' size={16} />],
            ].map(([value, label, icon]) => (
              <button
                key={value}
                type='button'
                role='tab'
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition active:scale-95 ${
                  tab === value ? 'bg-night text-white' : 'bg-surface text-grey-600 ring-1 ring-grey-200'
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        )}

        {tab === 'feed' ? (
          <>
            {feed.items.map((c, i) => (
              <ConfessionCard
                key={c.id}
                confession={c}
                style={{ animationDelay: `${Math.min(i % 20, 6) * 40}ms` }}
                onLike={(on) => like(c, on)}
                onOpen={() => navigate(`/confessions/${c.id}`)}
                onReport={() => report(c)}
              />
            ))}
            {(feed.loading || !feed.started) && !feed.items.length && [0, 1, 2].map((i) => <ConfessionSkeleton key={i} />)}
            {feed.done && !feed.items.length && (
              <div className='py-12 text-center'>
                <p className='text-4xl' aria-hidden>🤫</p>
                <p className='mt-3 font-semibold'>No confessions yet</p>
                <p className='mt-1 text-sm text-grey-500'>Be the first to spill something.</p>
              </div>
            )}
            {feed.error && (
              <div className='rounded-card bg-surface p-4 text-center shadow-card'>
                <p className='text-sm text-danger'>{feed.error}</p>
                <Button variant='secondary' className='mt-3' onClick={feed.more}>
                  Try again
                </Button>
              </div>
            )}
            {feed.loading && feed.items.length > 0 && <ConfessionSkeleton />}
            {feed.done && feed.items.length > 0 && (
              <p className='py-4 text-center text-xs text-grey-400'>You’re all caught up</p>
            )}
            <div ref={sentinel} aria-hidden />
          </>
        ) : (
          <MyPosts rows={mine} open={(id) => navigate(`/confessions/${id}`)} />
        )}
      </main>

      <div className='pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md justify-end px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]'>
        <button
          type='button'
          onClick={compose}
          aria-label='Write a confession'
          className='pointer-events-auto flex h-14 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-white shadow-float transition hover:bg-primary-dark active:scale-95'
        >
          <RiAddLine size={22} /> Confess
        </button>
      </div>

      {reporting && <ReportSheet onClose={() => setReporting(null)} onSubmit={sendReport} />}
      <Toast message={toast} onDone={clearToast} />
    </Page>
  )
}

function MyPosts({ rows, open }) {
  if (!rows) return [0, 1].map((i) => <ConfessionSkeleton key={i} />)
  if (!rows.length) {
    return (
      <div className='py-12 text-center'>
        <p className='text-4xl' aria-hidden>📝</p>
        <p className='mt-3 font-semibold'>You haven’t posted yet</p>
        <p className='mt-1 text-sm text-grey-500'>Only you can see this list.</p>
      </div>
    )
  }
  return (
    <ul className='space-y-3'>
      <li className='px-1 text-xs text-grey-500'>Only you can see this list.</li>
      {rows.map((c) => {
        const [label, tone] = MY_STATUS[c.status] || MY_STATUS.removed
        const live = c.status === 'published'
        return (
          <li key={c.id}>
            <button
              type='button'
              disabled={!live}
              onClick={() => open(c.id)}
              className='w-full rounded-card bg-surface p-4 text-left shadow-card transition enabled:active:scale-[0.99]'
            >
              <div className='flex items-center justify-between gap-3'>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{label}</span>
                {live && (
                  <span className='text-xs text-grey-500'>
                    ♥ {c.likes} · 💬 {c.comments}
                  </span>
                )}
              </div>
              <p className='mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-grey-700'>{c.text}</p>
              {c.status === 'in_review' && (
                <p className='mt-2 text-xs text-grey-500'>Our team is checking this before it goes live.</p>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
