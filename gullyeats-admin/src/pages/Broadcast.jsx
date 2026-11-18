import { useEffect, useRef, useState } from 'react'
import { Bell, Send, X } from 'lucide-react'
import { api } from '../services/api'
import { Card, CardHeader, ErrorNote, Btn, Seg, Select, ask } from '../components/ui'
import { num } from '../utils/format'

/*
 * A message from GullyEats to vendors, as a push to the vendor app (backend
 * controllers/broadcastController.js). A group is worked out on the server
 * when sending, so only its counts show here; single carts are added by
 * search, like addresses in an email's To box. Each send is in the Action log.
 */
const MAX_TITLE = 65
const MAX_BODY = 240
const MAX_PICKED = 50
const AUDIENCES = [
  ['all', 'All carts'],
  ['unpaid', 'Unpaid fees'],
  ['inactive', 'No recent orders'],
  ['picked', 'Pick carts'],
]
const field =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-brand dark:bg-transparent'
const plural = (n, one, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`

// "To" box: picked carts as chips with an ×, and a search that suggests carts.
function CartPicker({ picked, setPicked }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState([])
  const [active, setActive] = useState(0)
  const input = useRef(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return setHits([])
    let live = true
    const t = setTimeout(() => {
      api
        .broadcastSearch(term)
        .then((r) => {
          if (!live) return
          setHits(r.filter((c) => !picked.some((p) => p.id === c.id)))
          setActive(0)
        })
        .catch(() => live && setHits([]))
    }, 250)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [q, picked])

  const add = (c) => {
    if (picked.length >= MAX_PICKED) return
    setPicked([...picked, c])
    setQ('')
    setHits([])
    input.current?.focus()
  }
  const remove = (id) => setPicked(picked.filter((p) => p.id !== id))
  const onKey = (e) => {
    if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, hits.length - 1))
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0))
    else if (e.key === 'Enter' && hits[active]) add(hits[active])
    else if (e.key === 'Escape') setHits([])
    else if (e.key === 'Backspace' && !q && picked.length) remove(picked[picked.length - 1].id)
    else return
    e.preventDefault()
  }

  return (
    <div className='relative'>
      <div
        onClick={() => input.current?.focus()}
        className='flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-1.5 focus-within:border-brand dark:bg-transparent'
      >
        <span className='px-1 text-[12px] text-neutral-500'>To</span>
        {picked.map((c) => (
          <span key={c.id} className='inline-flex max-w-full items-center gap-1 rounded-full bg-brand/10 py-0.5 pl-2.5 pr-1 text-[12px] font-medium text-brand'>
            <span className='truncate'>{c.name}</span>
            <button
              type='button'
              onClick={() => remove(c.id)}
              aria-label={`Remove ${c.name}`}
              className='grid h-4 w-4 place-items-center rounded-full hover:bg-brand/20'
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => setTimeout(() => setHits([]), 150)}
          placeholder={picked.length ? '' : 'Type a cart, owner or city'}
          aria-label='Add a cart'
          role='combobox'
          aria-expanded={hits.length > 0}
          disabled={picked.length >= MAX_PICKED}
          className='min-w-[140px] flex-1 bg-transparent px-1 py-1 text-[13px] outline-none'
        />
      </div>
      {hits.length > 0 && (
        <ul role='listbox' className='absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-line bg-white shadow-float dark:bg-[#1c1730]'>
          {hits.map((c, i) => (
            <li key={c.id} role='option' aria-selected={i === active}>
              <button
                type='button'
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(c)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] ${i === active ? 'bg-neutral-50 dark:bg-white/5' : ''}`}
              >
                <span className='min-w-0 flex-1'>
                  <b className='block truncate font-medium'>{c.name}</b>
                  <small className='text-neutral-500'>{[c.owner, c.city].filter(Boolean).join(' · ')}</small>
                </span>
                {!c.onApp && <small className='shrink-0 text-neutral-400'>not on the app</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {picked.length >= MAX_PICKED && (
        <p className='mt-1 text-[12px] text-neutral-500'>Up to {MAX_PICKED} carts at a time. Use a group for more.</p>
      )}
    </div>
  )
}

export default function Broadcast() {
  const [audience, setAudience] = useState('all')
  const [days, setDays] = useState('30')
  const [picked, setPicked] = useState([])
  const [staff, setStaff] = useState(false)
  const [reach, setReach] = useState(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const ids = picked.map((p) => p.id).join(',')
  const groupDays = audience === 'inactive' ? days : undefined

  // The server counts the group; nothing is listed.
  useEffect(() => {
    if (audience === 'picked' && !ids) return setReach({ carts: 0, users: 0, onApp: 0, phones: 0 })
    let live = true
    setReach(null)
    setError('')
    api
      .broadcastPreview({ audience, days: groupDays, cartIds: audience === 'picked' ? ids : undefined, staff: staff ? '1' : '' })
      .then((r) => live && setReach(r))
      .catch((e) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [audience, groupDays, ids, staff])

  const to =
    audience === 'picked'
      ? picked.length === 1
        ? picked[0].name
        : plural(picked.length, 'cart')
      : { all: 'all carts', unpaid: 'carts with unpaid fees', inactive: `carts with no orders for ${days} days` }[audience]
  const ready = title.trim() && body.trim() && reach?.phones > 0 && !busy

  const send = async () => {
    if (!ready) return
    if (
      !(await ask({
        title: `Send to ${to}?`,
        message: `"${title.trim()}" will reach ${plural(reach.users, 'person', 'people')} on ${plural(reach.phones, 'phone')} now${staff ? ', staff included' : ''}. A push can't be taken back.`,
        confirm: 'Send now',
      }))
    )
      return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      setResult(
        await api.sendBroadcast({
          title: title.trim(),
          body: body.trim(),
          staff,
          audience,
          days: groupDays,
          cartIds: audience === 'picked' ? picked.map((p) => p.id) : undefined,
        }),
      )
      setTitle('')
      setBody('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='max-w-2xl'>
      <Card>
        <CardHeader title='New message' subtitle='A notification in the vendor app, in English.' />
        <div className='space-y-4 px-4 py-4 text-[13px]'>
          <div className='space-y-2'>
            <p className='font-medium'>Send to</p>
            <div className='flex flex-wrap items-center gap-2'>
              <Seg options={AUDIENCES} value={audience} onChange={setAudience} />
              {audience === 'inactive' && (
                <Select value={days} onChange={(e) => setDays(e.target.value)} aria-label='No orders for'>
                  {['7', '14', '30', '60', '90'].map((d) => (
                    <option key={d} value={d}>
                      for {d} days
                    </option>
                  ))}
                </Select>
              )}
            </div>
            {audience === 'picked' && <CartPicker picked={picked} setPicked={setPicked} />}
            <label className='flex items-center gap-2'>
              <input type='checkbox' checked={staff} onChange={(e) => setStaff(e.target.checked)} className='accent-[#FE5200]' />
              Also send to each cart's staff
            </label>
            <p className='rounded-lg bg-neutral-50 px-3 py-2 text-[12.5px] dark:bg-white/5' aria-live='polite'>
              {!reach ? (
                'Counting…'
              ) : audience === 'picked' && !picked.length ? (
                <span className='text-neutral-500'>Add carts above.</span>
              ) : (
                <>
                  {plural(reach.carts, 'cart')} · {plural(reach.users, 'person', 'people')} · {num(reach.onApp)} on the app ·{' '}
                  {plural(reach.phones, 'phone')}
                  {reach.users > reach.onApp && (
                    <span className='text-neutral-500'> · {num(reach.users - reach.onApp)} won't get it (not logged in on the app)</span>
                  )}
                </>
              )}
            </p>
          </div>

          <label className='block'>
            <span className='mb-1.5 flex justify-between font-medium'>
              Title <small className='font-normal text-neutral-500'>{title.length}/{MAX_TITLE}</small>
            </span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={MAX_TITLE} placeholder='e.g. Platform fee due' className={field} />
          </label>
          <label className='block'>
            <span className='mb-1.5 flex justify-between font-medium'>
              Message <small className='font-normal text-neutral-500'>{body.length}/{MAX_BODY}</small>
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={MAX_BODY}
              rows={4}
              placeholder='What vendors should know'
              className={`${field} resize-y`}
            />
          </label>

          <div className='rounded-2xl bg-neutral-100 p-3 dark:bg-neutral-800' aria-label='Preview'>
            <p className='mb-1 flex items-center gap-1.5 text-[11px] text-neutral-500'>
              <Bell size={11} /> GullyEats Vendor · now
            </p>
            <b className='block break-words text-[13px]'>{title.trim() || 'Title'}</b>
            <p className='whitespace-pre-line break-words text-[12.5px] text-neutral-600 dark:text-neutral-300'>{body.trim() || 'Your message'}</p>
          </div>

          {error && <ErrorNote message={error} />}
          {result && (
            <p role='status' className='rounded-lg bg-green-50 px-3 py-2 text-green-700 dark:bg-green-900/20 dark:text-green-400'>
              Sent to {num(result.sent)} of {plural(result.phones, 'phone')} ({plural(result.carts, 'cart')}).
              {result.phones > 0 && result.sent === 0 && ' None went through: check FIREBASE_SERVICE_ACCOUNT on the server.'}
            </p>
          )}

          <Btn primary type='button' onClick={send} disabled={!ready} className='inline-flex max-w-full items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50'>
            <Send size={13} className='shrink-0' /> <span className='truncate'>{busy ? 'Sending…' : audience === 'picked' && !picked.length ? 'Send' : `Send to ${to}`}</span>
          </Btn>
        </div>
      </Card>
    </div>
  )
}
