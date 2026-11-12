import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, X, Trash2, RotateCcw, UserX, Flag } from 'lucide-react'
import usePaged from '../hooks/usePaged'
import { api } from '../services/api'
import { Card, CardHeader, Table, State, Seg, ScrollFooter, Skeleton, ErrorNote, Btn } from '../components/ui'
import StatusBadge from '../components/StatusBadge'
import { ist } from '../utils/format'

/*
 * GullyPulse Moderation Centre: word-filter review, community reports,
 * auto-blocked submissions and removed content, for confessions and comments.
 */

const QUEUES = {
  review: { label: 'Word-filter review', status: 'PENDING_REVIEW', count: ['review', 'reviewComments'] },
  reported: { label: 'Reported posts', status: 'REPORTED', kind: 'confession', count: ['reported'] },
  reportedComments: { label: 'Reported comments', status: 'REPORTED', kind: 'comment', count: ['reportedComments'] },
  blocked: { label: 'Auto-blocked', status: 'BLOCKED', count: ['blocked', 'blockedComments'] },
  removed: { label: 'Removed', status: 'REMOVED,REJECTED' },
}

const STATUS = {
  PUBLISHED: ['ACTIVE', 'Published'],
  PENDING_REVIEW: ['REVIEW', 'Needs review'],
  REPORTED: ['ATTENTION', 'Community reported – admin review required'],
  BLOCKED: ['CANCELLED', 'Auto-blocked'],
  REJECTED: ['REJECTED', 'Rejected'],
  REMOVED: ['SUSPENDED', 'Removed'],
}

const REASON_LABEL = {
  abusive: 'Abusive',
  sexual: 'Sexual',
  hate: 'Hate',
  harassment: 'Harassment',
  personal_info: 'Identifies someone',
  spam: 'Spam',
  other: 'Other',
}

const KIND_LABEL = {
  exact: 'exact',
  variant: 'spelling variant',
  phonetic: 'sounds like',
  compound: 'inside word',
  obfuscated: 'split letters',
  masked: 'masked',
  fuzzy: 'fuzzy match',
  context: 'aimed at someone',
}

const ACTION_LABEL = {
  APPROVE_CONFESSION: 'Approved',
  REJECT_CONFESSION: 'Rejected',
  REMOVE_CONFESSION: 'Removed',
  RESTORE_CONFESSION: 'Restored',
  APPROVE_COMMENT: 'Approved',
  REJECT_COMMENT: 'Rejected',
  REMOVE_COMMENT: 'Removed',
  RESTORE_COMMENT: 'Restored',
  SUSPEND_POSTER: 'Suspended poster',
  UNSUSPEND_POSTER: 'Lifted suspension',
}

// Which buttons each status gets (mirrors the server's rules).
const ACTIONS = {
  PENDING_REVIEW: ['approve', 'reject'],
  BLOCKED: ['approve', 'reject'],
  REPORTED: ['restore', 'remove'],
  PUBLISHED: ['remove'],
  REMOVED: ['restore'],
  REJECTED: ['approve'],
}
const ACTION_BTN = {
  approve: ['Approve & publish', Check, 'bg-green-600 border-green-600 text-white hover:bg-green-700'],
  restore: ['Restore', RotateCcw, 'bg-green-600 border-green-600 text-white hover:bg-green-700'],
  reject: ['Reject', X, 'bg-red-600 border-red-600 text-white hover:bg-red-700'],
  remove: ['Remove', Trash2, 'bg-red-600 border-red-600 text-white hover:bg-red-700'],
}
const QUICK_REASONS = ['Harmless in context', 'Abusive language', 'Sexual content', 'Hate or slur', 'Identifies a person', 'Spam']

// The text with every detected word marked.
function Highlighted({ text, matches = [] }) {
  const needles = [...new Set(matches.map((m) => m.found).filter(Boolean))]
  if (!needles.length) return text
  const esc = needles.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length)
  const parts = text.split(new RegExp(`(${esc.join('|')})`, 'giu'))
  return parts.map((p, i) =>
    i % 2 ? (
      <mark key={i} className='rounded bg-red-100 px-0.5 font-semibold text-red-700'>
        {p}
      </mark>
    ) : (
      p
    ),
  )
}

function MatchChips({ matches = [] }) {
  if (!matches.length) return <span className='text-neutral-400'>—</span>
  return (
    <div className='flex flex-wrap gap-1'>
      {matches.slice(0, 4).map((m, i) => (
        <span
          key={i}
          title={`${m.category} · ${KIND_LABEL[m.kind] || m.kind}`}
          className={`rounded px-1.5 py-px text-[11px] font-medium ${m.severity === 'severe' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}
        >
          {m.found}
          {m.found.toLowerCase() !== m.term && <span className='opacity-70'> → {m.term}</span>}
        </span>
      ))}
      {matches.length > 4 && <span className='text-[11px] text-neutral-500'>+{matches.length - 4}</span>}
    </div>
  )
}

const reasonsText = (r = {}) =>
  Object.entries(r)
    .filter(([, n]) => n)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${REASON_LABEL[k] || k} ${n}`)
    .join(' · ')

const columns = (kind) => [
  { key: 'at', label: 'When', render: (r) => <span className='text-neutral-500'>{ist(r.at)}</span> },
  {
    key: 'text',
    label: kind === 'comment' ? 'Comment' : 'Confession',
    className: 'whitespace-normal min-w-[260px] max-w-[420px]',
    render: (r) => (
      <div>
        <p className='line-clamp-3 break-words'>
          <Highlighted text={r.text} matches={r.matches} />
        </p>
        {r.parent && <p className='mt-0.5 truncate text-[11.5px] text-neutral-500'>On #{r.parent.publicId}: {r.parent.text}</p>}
      </div>
    ),
  },
  { key: 'matches', label: 'Detected', className: 'whitespace-normal min-w-[160px]', render: (r) => <MatchChips matches={r.matches} /> },
  {
    key: 'reports',
    label: 'Reports',
    className: 'whitespace-normal',
    render: (r) =>
      r.reportCount ? (
        <div>
          <b className='inline-flex items-center gap-1 font-semibold text-red-600'>
            <Flag size={12} /> {r.reportCount}
          </b>
          <p className='text-[11.5px] text-neutral-500'>{reasonsText(r.reportReasons)}</p>
        </div>
      ) : (
        <span className='text-neutral-400'>0</span>
      ),
  },
  {
    key: 'poster',
    label: 'Poster',
    render: (r) => (
      <div className='leading-tight'>
        <b className='font-mono text-[12px] font-medium'>{r.poster}</b>
        <p className='text-[11.5px] text-neutral-500'>
          #{r.publicId}
          {r.orderNumber != null && ` · token ${r.orderNumber}`}
        </p>
      </div>
    ),
  },
  {
    key: 'cart',
    label: 'Cart / city',
    render: (r) => (
      <div className='leading-tight'>
        {r.cart || '—'}
        <p className='text-[11.5px] text-neutral-500'>{r.city || ''}</p>
      </div>
    ),
  },
]

function Queue({ queue, kind, hidden, onOpen }) {
  const q = QUEUES[queue]
  const fetchPage = useCallback(
    (cursor) => api.moderationQueue({ kind, status: q.status, cursor, limit: 30 }),
    [kind, q.status],
  )
  const p = usePaged(fetchPage)
  const rows = p.rows.filter((r) => !hidden.has(r.id))
  return (
    <>
      <State loading={p.loading && !p.rows.length} error={!p.rows.length && p.error}>
        <Table columns={columns(kind)} rows={rows} onRow={onOpen} empty={p.hasMore ? '' : 'Nothing here. All clear.'} />
      </State>
      <ScrollFooter {...p} count={rows.length} noun='items' />
    </>
  )
}

export default function Moderation() {
  const [params, setParams] = useSearchParams()
  const queue = QUEUES[params.get('q')] ? params.get('q') : 'review'
  const kind = QUEUES[queue].kind || (params.get('kind') === 'comment' ? 'comment' : 'confession')
  const [counts, setCounts] = useState({})
  const [open, setOpen] = useState(null)
  const [hidden, setHidden] = useState(() => new Set())

  const loadCounts = useCallback(() => {
    api.moderationCounts().then(setCounts).catch(() => {})
  }, [])
  useEffect(loadCounts, [loadCounts])

  const set = (patch) => setParams({ q: queue, kind, ...patch })
  const tabLabel = (k) => {
    const n = (QUEUES[k].count || []).reduce((sum, c) => sum + (counts[c] || 0), 0)
    return n ? `${QUEUES[k].label} (${n})` : QUEUES[k].label
  }

  const onDone = (id) => {
    setHidden((h) => new Set(h).add(id))
    setOpen(null)
    loadCounts()
  }

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-[18px] font-semibold'>Moderation</h1>
        <p className='text-neutral-500'>GullyPulse confessions and comments waiting for a decision.</p>
      </div>
      <Card>
        <CardHeader
          title={QUEUES[queue].label}
          subtitle='Click a row for the full text, reports, poster history and actions.'
          right={
            <div className='flex max-w-full flex-wrap items-center gap-2'>
              <Seg options={Object.keys(QUEUES).map((k) => [k, tabLabel(k)])} value={queue} onChange={(q) => set({ q })} />
              {!QUEUES[queue].kind && (
                <Seg
                  options={[
                    ['confession', 'Posts'],
                    ['comment', 'Comments'],
                  ]}
                  value={kind}
                  onChange={(k) => set({ kind: k })}
                />
              )}
            </div>
          }
        />
        <Queue key={`${queue}-${kind}`} queue={queue} kind={kind} hidden={hidden} onOpen={(r) => setOpen(r)} />
      </Card>
      {open && <Drawer row={open} onClose={() => setOpen(null)} onDone={onDone} />}
    </div>
  )
}

function Drawer({ row, onClose, onDone }) {
  const [state, setState] = useState({ loading: true })
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [days, setDays] = useState('7')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let live = true
    api
      .moderationItem(row.kind, row.id)
      .then((d) => live && setState({ d }))
      .catch((e) => live && setState({ error: e.message }))
    return () => {
      live = false
    }
  }, [row.kind, row.id, version])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const run = async (name, fn) => {
    if (!reason.trim()) return setError('Add a reason first (pick one below or type it).')
    setBusy(name)
    setError('')
    try {
      await fn()
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setBusy('')
    }
  }

  const act = async (action) => {
    if (await run(action, () => api.moderate(row.kind, row.id, action, reason.trim()))) onDone(row.id)
  }
  const suspend = async (n) => {
    if (await run('suspend', () => api.suspendPoster(row.kind, row.id, n, reason.trim()))) {
      setReason('')
      setVersion((v) => v + 1)
    }
  }

  const d = state.d
  const [badge, statusLabel] = STATUS[d?.status] || ['OFFLINE', d?.status]

  return (
    <div className='fixed inset-0 z-50 flex justify-end bg-black/30' onClick={onClose}>
      <aside
        role='dialog'
        aria-label='Moderation item'
        className='h-full w-full max-w-lg overflow-y-auto bg-white p-5 shadow-xl'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-start justify-between gap-3'>
          <div>
            <h3 className='text-[16px] font-semibold'>
              {row.kind === 'comment' ? 'Comment' : 'Confession'} #{row.publicId}
            </h3>
            <p className='text-neutral-500'>{ist(row.at)}</p>
          </div>
          <button onClick={onClose} aria-label='Close' className='rounded p-1 hover:bg-neutral-100'>
            <X size={16} />
          </button>
        </div>

        {state.loading ? (
          <Skeleton rows={4} />
        ) : state.error ? (
          <ErrorNote message={state.error} />
        ) : (
          <>
            <div className='mt-2'>
              <StatusBadge status={badge} label={statusLabel} />
            </div>

            {d.parent && (
              <div className='mt-4 rounded-md border border-line bg-neutral-50 p-3'>
                <p className='text-[11.5px] font-medium text-neutral-500'>ON CONFESSION #{d.parent.publicId}</p>
                <p className='mt-1 line-clamp-4 text-[12.5px] text-neutral-600'>{d.parent.text}</p>
              </div>
            )}

            <p className='mt-4 whitespace-pre-wrap break-words rounded-md border border-line p-3 text-[14px] leading-relaxed'>
              <Highlighted text={d.text} matches={d.moderation.matches} />
            </p>

            <Section title='WORD FILTER'>
              {d.moderation.matches?.length ? (
                <>
                  <table className='w-full text-[12.5px]'>
                    <thead className='text-left text-[11px] text-neutral-500'>
                      <tr>
                        <th className='py-1 font-medium'>Found</th>
                        <th className='font-medium'>Suspected word</th>
                        <th className='font-medium'>Category</th>
                        <th className='font-medium'>How</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.moderation.matches.map((m, i) => (
                        <tr key={i} className='border-t border-line'>
                          <td className='py-1.5 font-medium text-red-700'>{m.found}</td>
                          <td>{m.term}</td>
                          <td className='capitalize'>{m.category}</td>
                          <td className='text-neutral-500'>
                            {KIND_LABEL[m.kind] || m.kind}
                            {m.severity === 'severe' && <span className='ml-1 text-red-600'>· severe</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {d.moderation.reason && <p className='mt-1.5 text-[12px] text-neutral-500'>{d.moderation.reason}</p>}
                </>
              ) : (
                <p className='text-neutral-500'>Nothing detected.</p>
              )}
            </Section>

            <Section title={`COMMUNITY REPORTS (${d.reportCount})`}>
              {d.reports.length ? (
                <>
                  {reasonsText(d.reportReasons) && <p className='mb-1.5 font-medium'>{reasonsText(d.reportReasons)}</p>}
                  <ul className='max-h-40 overflow-y-auto text-[12.5px]'>
                    {d.reports.map((r, i) => (
                      <li key={i} className='flex justify-between border-t border-line py-1'>
                        <span>{REASON_LABEL[r.reason] || r.reason}</span>
                        <span className='text-neutral-500'>
                          <span className='font-mono'>{r.by}</span> · {ist(r.at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className='text-neutral-500'>No reports.</p>
              )}
            </Section>

            <Section title='POSTER (ADMINS ONLY)'>
              <dl className='grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12.5px]'>
                <Item k='Poster ID' v={<span className='font-mono'>{d.poster.id}</span>} />
                <Item k='Order' v={d.poster.orderNumber != null ? `Token ${d.poster.orderNumber} · ${ist(d.poster.orderedAt)}` : '—'} />
                <Item k='Order ID' v={<span className='break-all font-mono text-[11px]'>{d.poster.orderId}</span>} />
                <Item k='Phone' v={d.poster.phone || 'Not given'} />
                <Item k='Cart' v={d.poster.cart || '—'} />
                <Item k='City' v={d.poster.city || '—'} />
                <Item k='Their posts' v={tally(d.poster.posts)} />
                <Item k='Their comments' v={tally(d.poster.comments)} />
              </dl>
              {d.poster.suspendedUntil && (
                <p className='mt-2 rounded-md bg-neutral-800 px-2.5 py-1.5 text-[12px] text-white'>
                  Suspended until {ist(d.poster.suspendedUntil)}
                </p>
              )}
            </Section>

            <Section title='DECISION'>
              <div className='mb-2 flex flex-wrap gap-1'>
                {QUICK_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={`rounded-full border px-2 py-0.5 text-[11.5px] ${reason === r ? 'border-brand bg-brand-50 text-brand' : 'border-line text-neutral-600 hover:border-brand'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                placeholder='Reason (required, saved in the log)'
                className='w-full rounded-md border border-line px-2.5 py-1.5 text-[13px] outline-none focus:border-brand'
              />
              {error && <p className='mt-2 text-[12px] text-red-600'>{error}</p>}
              <div className='mt-3 flex flex-wrap gap-2'>
                {(ACTIONS[d.status] || []).map((a) => {
                  const [label, Icon, cls] = ACTION_BTN[a]
                  return (
                    <button
                      key={a}
                      onClick={() => act(a)}
                      disabled={!!busy}
                      className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50 ${cls}`}
                    >
                      <Icon size={13} /> {busy === a ? 'Saving…' : label}
                    </button>
                  )
                })}
              </div>
              <div className='mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3'>
                <UserX size={14} className='text-neutral-500' />
                <span className='text-[12.5px]'>Suspend poster for</span>
                <select
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className='rounded-md border border-line bg-white px-2 py-1 text-[12px]'
                >
                  <option value='1'>1 day</option>
                  <option value='7'>7 days</option>
                  <option value='30'>30 days</option>
                  <option value='365'>1 year</option>
                  <option value='3650'>Permanently</option>
                </select>
                <Btn onClick={() => suspend(Number(days))} disabled={!!busy}>
                  {busy === 'suspend' ? 'Saving…' : 'Suspend'}
                </Btn>
                {d.poster.suspendedUntil && (
                  <Btn onClick={() => suspend(0)} disabled={!!busy}>
                    Lift suspension
                  </Btn>
                )}
              </div>
            </Section>

            <Section title='MODERATION HISTORY'>
              {d.history.length ? (
                <ul className='text-[12.5px]'>
                  {d.history.map((h, i) => (
                    <li key={i} className='border-t border-line py-1.5'>
                      <b className='font-medium'>{ACTION_LABEL[h.action] || h.action}</b> by {h.by}
                      <span className='text-neutral-500'> · {ist(h.at)}</span>
                      {h.reason && <p className='text-neutral-500'>“{h.reason}”</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className='text-neutral-500'>No admin actions yet.</p>
              )}
            </Section>
          </>
        )}
      </aside>
    </div>
  )
}

const tally = (t = {}) => {
  const parts = Object.entries(t).map(([k, n]) => `${n} ${(STATUS[k]?.[1] || k).toLowerCase().split(' –')[0]}`)
  return parts.length ? parts.join(', ') : 'None'
}

const Section = ({ title, children }) => (
  <section className='mt-5'>
    <p className='mb-1.5 text-[11.5px] font-medium text-neutral-500'>{title}</p>
    {children}
  </section>
)

const Item = ({ k, v }) => (
  <div>
    <dt className='text-[11px] text-neutral-500'>{k}</dt>
    <dd>{v}</dd>
  </div>
)
