import { useEffect, useState } from 'react'
import { Check, ImageIcon, Merge, X } from 'lucide-react'
import { api } from '../services/api'
import { Card, CardHeader, State, ErrorNote, Btn, ask } from '../components/ui'
import { ist } from '../utils/format'

/*
 * New dish names vendors use that aren't in the common list yet. Once 3
 * different carts use one it shows here: fix the spellings, pick a default
 * photo from Pixabay (copied to S3 on approve), then approve, merge it into
 * an existing dish, or reject it.
 */
const LANGS = [
  ['hi', 'Hindi'],
  ['kn', 'Kannada'],
  ['ta', 'Tamil'],
]

function DishRow({ dish, onDone }) {
  const [form, setForm] = useState({ name: dish.name, ...dish.spellings })
  const [mergeInto, setMergeInto] = useState(dish.similar || '')
  const [images, setImages] = useState(null)
  const [picked, setPicked] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const run = async (label, fn) => {
    setBusy(label)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  const findImages = () =>
    run('images', async () => {
      setImages(await api.dishImages(dish.id))
      setPicked(null)
    })

  const approve = () =>
    run('approve', async () => {
      await api.approveDish(dish.id, { ...form, imageId: picked })
      onDone(`${form.name} added to the common list${picked ? ' with its photo' : ''}.`)
    })

  const merge = () =>
    run('merge', async () => {
      if (!(await ask({ title: `Merge "${dish.name}" into ${mergeInto}?`, message: 'It becomes another name for that dish.', confirm: 'Merge' }))) return
      await api.mergeDish(dish.id, mergeInto)
      onDone(`${dish.name} is now another name for ${mergeInto}.`)
    })

  const reject = () =>
    run('reject', async () => {
      if (!(await ask({ title: `Reject "${dish.name}"?`, message: "It stays each vendor's own item and won't be suggested.", confirm: 'Reject' }))) return
      await api.rejectDish(dish.id)
      onDone(`${dish.name} rejected.`)
    })

  const input = (key, label) => (
    <label key={key} className='block text-[11px] font-semibold text-neutral-500'>
      {label}
      {dish.typed?.includes(key) && <span className='ml-1 font-normal text-emerald-600'>(typed by vendors)</span>}
      <input
        value={form[key] || ''}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className='mt-1 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] font-normal text-ink outline-none focus:border-brand dark:bg-transparent'
      />
    </label>
  )

  return (
    <div className='border-b border-line px-5 py-4 last:border-b-0'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h4 className='text-[15px] font-bold'>{dish.name}</h4>
        <span className='text-[12px] text-neutral-500'>
          Used by {dish.carts} carts · first seen {ist(dish.firstSeen)} · last {ist(dish.lastSeen)}
        </span>
      </div>
      {dish.similar && (
        <p className='mt-1 text-[12px] text-amber-700'>Looks like {dish.similar}, which is already in the list.</p>
      )}

      <div className='mt-3 grid gap-3 sm:grid-cols-4'>
        {input('name', 'English name')}
        {LANGS.map(([k, label]) => input(k, label))}
      </div>

      <div className='mt-3'>
        <Btn onClick={findImages} disabled={!!busy}>
          <ImageIcon size={13} className='mr-1 inline' />
          {busy === 'images' ? 'Searching…' : images ? 'Search again' : 'Find images'}
        </Btn>
        {images && (
          <div className='mt-3'>
            {images.length === 0 && <p className='text-[12px] text-neutral-500'>Pixabay has no photos for this name.</p>}
            <div className='flex flex-wrap gap-2'>
              {images.map((img) => (
                <button
                  key={img.id}
                  type='button'
                  onClick={() => setPicked(picked === img.id ? null : img.id)}
                  aria-pressed={picked === img.id}
                  aria-label={`Photo: ${img.tags}`}
                  className={`overflow-hidden rounded-xl border-2 transition ${picked === img.id ? 'border-brand ring-2 ring-brand/30' : 'border-transparent opacity-80 hover:opacity-100'}`}
                >
                  <img src={img.preview} alt={img.tags} className='h-24 w-28 object-cover' />
                </button>
              ))}
            </div>
            <p className='mt-1 text-[11px] text-neutral-500'>
              Photos from{' '}
              <a href='https://pixabay.com' target='_blank' rel='noreferrer' className='underline'>
                Pixabay
              </a>
              . {picked ? 'The picked photo is copied to S3 when you approve.' : 'Tap one to use it, or approve without a photo.'}
            </p>
          </div>
        )}
      </div>

      {error && <div className='mt-3'><ErrorNote message={error} /></div>}

      <div className='mt-4 flex flex-wrap items-center gap-2'>
        <Btn primary onClick={approve} disabled={!!busy || form.name.trim().length < 2}>
          <Check size={13} className='mr-1 inline' />
          {busy === 'approve' ? 'Approving…' : 'Approve'}
        </Btn>
        <span className='mx-1 text-neutral-300'>|</span>
        <input
          value={mergeInto}
          onChange={(e) => setMergeInto(e.target.value)}
          placeholder='Dish to merge into'
          aria-label='Dish to merge into'
          className='w-44 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-brand dark:bg-transparent'
        />
        <Btn onClick={merge} disabled={!!busy || !mergeInto.trim()}>
          <Merge size={13} className='mr-1 inline' />
          Merge
        </Btn>
        <Btn onClick={reject} disabled={!!busy} className='hover:!border-red-500 hover:!text-red-600'>
          <X size={13} className='mr-1 inline' />
          Reject
        </Btn>
      </div>
    </div>
  )
}

export default function Dishes() {
  const [dishes, setDishes] = useState(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    api.dishes().then(setDishes, (e) => setError(e.message))
  }, [])

  const done = (id) => (message) => {
    setNote(message)
    setDishes((list) => list.filter((d) => d.id !== id))
  }

  return (
    <Card>
      <CardHeader
        title='New dishes'
        subtitle='Dish names 3 or more carts use that aren’t in the common list. Approved dishes are suggested to every vendor.'
      />
      {note && <p className='mx-5 mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700 dark:bg-emerald-900/20'>{note}</p>}
      <State loading={!dishes && !error} error={error}>
        {dishes?.length === 0 ? (
          <p className='px-5 py-10 text-center text-[13px] text-neutral-500'>No new dishes to review.</p>
        ) : (
          dishes?.map((d) => <DishRow key={d.id} dish={d} onDone={done(d.id)} />)
        )}
      </State>
    </Card>
  )
}
