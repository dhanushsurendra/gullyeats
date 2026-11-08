import { useState } from 'react'

/*
 * Light or dark theme. Dark is the default; the customer's choice is kept on
 * the phone. index.html applies it before React loads, so there's no flash.
 * Keep KEY and the colours in sync with the script in index.html.
 */
const KEY = 'gullyeats-theme'
const BAR = { dark: '#0c0c0e', light: '#fe5200' } // browser address-bar colour

export const currentTheme = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[theme])
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Private mode or blocked storage: the theme still applies until reload.
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(currentTheme)
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }
  return [theme, toggle]
}
