import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Page, Spinner, StatusScreen, TopBar } from '../components/ui'
import { api } from '../constants/api'

// "by-sa 2.0" -> CC BY-SA 2.0 and its deed; cc0 is the public-domain dedication.
function licence(code) {
  const [kind, version] = code.split(' ')
  if (kind === 'cc0') return { label: `CC0 ${version}`, url: `https://creativecommons.org/publicdomain/zero/${version}/` }
  if (!version) return { label: code }
  return { label: `CC ${kind.toUpperCase()} ${version}`, url: `https://creativecommons.org/licenses/${kind}/${version}/` }
}

const link = 'font-medium text-primary underline underline-offset-2'

/* Who took the default dish photos. Linked from the bottom of the menu. */
export default function PhotoCredits() {
  const navigate = useNavigate()
  const [credits, setCredits] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/carts/photo-credits').then(setCredits, (e) => setError(e.message))
  }, [])

  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))

  return (
    <Page>
      <TopBar title='Photo credits' onBack={back} />
      {error ? (
        <StatusScreen icon='📷' tone='grey' title="Couldn't load the credits" message={error} />
      ) : !credits ? (
        <div className='flex flex-1 items-center justify-center'>
          <Spinner className='h-6 w-6 text-primary' />
        </div>
      ) : (
        <main className='px-4 pb-10 pt-4'>
          <p className='text-sm text-grey-600'>
            When a cart hasn't added its own photo of a dish, we show one of these. Thank you to the photographers who shared
            them. Each was cropped to fit the menu.
          </p>
          <ul className='mt-4 divide-y divide-grey-200/70 rounded-2xl bg-surface shadow-card'>
            {credits.map((c) => {
              const l = licence(c.license)
              return (
                <li key={c.dish} className='px-4 py-3 text-sm'>
                  <p className='font-semibold'>{c.dish}</p>
                  <p className='mt-0.5 text-grey-600'>
                    <a href={c.page} target='_blank' rel='noopener noreferrer' className={link}>
                      Photo
                    </a>{' '}
                    {c.creator ? `by ${c.creator}` : `via ${c.source}`},{' '}
                    {l.url ? (
                      <a href={l.url} target='_blank' rel='noopener noreferrer' className={link}>
                        {l.label}
                      </a>
                    ) : (
                      l.label
                    )}
                  </p>
                </li>
              )
            })}
          </ul>
        </main>
      )}
    </Page>
  )
}
