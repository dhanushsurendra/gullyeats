import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RiFlag2Line, RiSendPlane2Fill } from 'react-icons/ri'

import { Avatar, ConfessionCard, ConfessionSkeleton, ReportSheet, Toast } from '../components/Confession'
import { Button, Page, Spinner, StatusScreen, TopBar } from '../components/ui'
import { useLike, usePaged } from '../hooks/usePulse'
import { pulse, timeAgo, usePulseKey } from '../utils/pulse'

const MAX = 300

// One confession with its comments.
export default function ConfessionDetail() {
  const navigate = useNavigate()
  const { publicId } = useParams()
  const key = usePulseKey()
  const [confession, setConfession] = useState(null)
  const [missing, setMissing] = useState('')
  const [reporting, setReporting] = useState(null) // { kind, id }
  const [toast, setToast] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [commentError, setCommentError] = useState('')
  const clearToast = useCallback(() => setToast(''), [])

  useEffect(() => {
    let live = true
    pulse(key, `/${publicId}`)
      .then((c) => live && setConfession(c))
      .catch((e) => live && setMissing(e.status === 404 ? 'This confession isn’t available any more.' : e.message))
    return () => {
      live = false
    }
  }, [key, publicId])

  const load = useCallback(
    (cursor) => pulse(key, `/${publicId}/comments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
    [key, publicId],
  )
  const comments = usePaged(load)
  const { more, started } = comments
  useEffect(() => {
    if (!started) more()
  }, [started, more])

  const update = useCallback((id, fn) => setConfession((c) => (c && c.id === id ? fn(c) : c)), [])
  const like = useLike(key, update, setToast)

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/confessions'))
  const needOrder = (what) => setToast(`Place an order at any GullyEats cart to ${what}.`)

  const sendComment = async (e) => {
    e.preventDefault()
    if (!key) return needOrder('comment')
    setSending(true)
    setCommentError('')
    try {
      const r = await pulse(key, `/${publicId}/comments`, { method: 'POST', body: { text } })
      setText('')
      if (r.status === 'published') {
        comments.setItems((list) => [...list, r.comment])
        setConfession((c) => ({ ...c, comments: c.comments + 1 }))
      } else {
        setToast('Your comment is waiting for a quick review.')
      }
    } catch (err) {
      setCommentError(err.message)
    } finally {
      setSending(false)
    }
  }

  // reporting?.: the React Compiler reads these paths while rendering, when reporting can be null.
  const sendReport = async (reason) => {
    const kind = reporting?.kind
    const id = reporting?.id
    const path = kind === 'comment' ? `/comments/${id}/report` : `/${id}/report`
    const r = await pulse(key, path, { method: 'POST', body: { reason } })
    setReporting(null)
    if (r.hidden && kind === 'confession') {
      navigate('/confessions', { replace: true, state: { toast: 'Thanks. This post is hidden while our team reviews it.' } })
      return
    }
    if (r.hidden) {
      comments.setItems((list) => list.filter((c) => c.id !== id))
      setConfession((c) => ({ ...c, comments: Math.max(0, c.comments - 1) }))
    }
    setToast('Thanks for reporting. Our team will take a look.')
  }
  const report = (kind, id) => (key ? setReporting({ kind, id }) : needOrder('report'))

  if (missing) {
    return (
      <Page className='bg-white'>
        <TopBar title='Confession' onBack={back} />
        <StatusScreen icon='🫥' tone='grey' title='Not found' message={missing}>
          <Button onClick={() => navigate('/confessions', { replace: true })}>See other confessions</Button>
        </StatusScreen>
      </Page>
    )
  }

  return (
    <Page>
      <TopBar title='Confession' subtitle={confession ? `#${confession.id}` : ''} onBack={back} />
      <main className='flex-1 space-y-4 px-4 pb-40 pt-4'>
        {confession ? (
          <ConfessionCard
            confession={confession}
            large
            onLike={(on) => like(confession, on)}
            onReport={() => report('confession', confession.id)}
          />
        ) : (
          <ConfessionSkeleton />
        )}

        <section aria-labelledby='comments-title'>
          <h2 id='comments-title' className='px-1 text-sm font-semibold text-grey-600'>
            {confession ? `${confession.comments} ${confession.comments === 1 ? 'comment' : 'comments'}` : 'Comments'}
          </h2>
          <ul className='mt-3 space-y-3'>
            {comments.items.map((c) => (
              <li key={c.id} className='animate-fade-up flex gap-3'>
                <Avatar seed={c.id} small />
                <div className='min-w-0 flex-1 rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 shadow-card'>
                  <div className='flex items-center gap-2'>
                    <span className='text-[13px] font-semibold'>Anonymous</span>
                    {c.byAuthor && (
                      <span className='rounded-full bg-grey-900 px-1.5 py-0.5 text-[10px] font-semibold text-white'>Author</span>
                    )}
                    {c.mine && (
                      <span className='rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary'>You</span>
                    )}
                    <time className='text-xs text-grey-400' dateTime={c.createdAt}>
                      {timeAgo(c.createdAt)}
                    </time>
                    {!c.mine && (
                      <button
                        type='button'
                        onClick={() => report('comment', c.id)}
                        aria-label='Report this comment'
                        className='-my-2 -mr-2 ml-auto flex h-9 w-9 items-center justify-center rounded-full text-grey-300 transition hover:bg-grey-100 hover:text-grey-600'
                      >
                        <RiFlag2Line size={15} />
                      </button>
                    )}
                  </div>
                  <p className='mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-grey-800'>{c.text}</p>
                </div>
              </li>
            ))}
          </ul>
          {comments.loading && (
            <div className='flex justify-center py-4 text-primary'>
              <Spinner />
            </div>
          )}
          {comments.error && <p className='py-3 text-center text-sm text-danger'>{comments.error}</p>}
          {!comments.done && !comments.loading && comments.items.length > 0 && (
            <Button variant='ghost' className='mt-2' onClick={comments.more}>
              Show more comments
            </Button>
          )}
          {comments.done && !comments.items.length && (
            <p className='py-6 text-center text-sm text-grey-500'>No comments yet. Say something nice.</p>
          )}
        </section>
      </main>

      {confession && (
        <form
          onSubmit={sendComment}
          className='fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-grey-200/70 bg-white/95 px-4 pt-3 backdrop-blur-md pb-safe'
        >
          {commentError && <p className='mb-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger' role='alert'>{commentError}</p>}
          <div className='flex items-end gap-2'>
            <label htmlFor='comment' className='sr-only'>
              Comment anonymously
            </label>
            <textarea
              id='comment'
              rows={1}
              value={text}
              maxLength={MAX}
              onFocus={() => !key && needOrder('comment')}
              onChange={(e) => {
                setText(e.target.value)
                if (commentError) setCommentError('')
              }}
              placeholder={key ? 'Comment anonymously…' : 'Order to join the conversation'}
              className='max-h-32 min-h-12 flex-1 resize-none rounded-2xl bg-grey-50 px-4 py-3 text-[15px] outline-none ring-1 ring-grey-200 [field-sizing:content] placeholder:text-grey-400 focus:ring-2 focus:ring-primary/40'
            />
            <button
              type='submit'
              disabled={!text.trim() || sending}
              aria-label='Send comment'
              className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary-dark active:scale-90 disabled:bg-grey-300'
            >
              {sending ? <Spinner /> : <RiSendPlane2Fill size={20} />}
            </button>
          </div>
        </form>
      )}

      {reporting && (
        <ReportSheet what={reporting.kind} onClose={() => setReporting(null)} onSubmit={sendReport} />
      )}
      <Toast message={toast} onDone={clearToast} />
    </Page>
  )
}
