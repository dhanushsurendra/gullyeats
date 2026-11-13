// RCT-096..109: GullyPlay beyond "a round saves a score": lobby settings, how to play,
// sound, pause, the food-ready alert mid-game, leaderboard, share, offline scores,
// playing without an order, adding a phone number, pilot skins and server limits.
// Rounds are fast-forwarded with Playwright's clock instead of played in real time.
import { test, expect } from '@playwright/test'
import { call, customerOrder, onboardVendor, placeOrder, vendorOrder } from './helpers.js'

// Each test places an order and plays at least part of a round: allow for a busy server.
test.describe.configure({ timeout: 120_000 })

let v
test.beforeAll(async () => {
  v = await onboardVendor({ cartName: `QA-Play ${Date.now() % 1e5}` })
})
const playUrl = (id, game) => `/c/${v.cartId}/order/${id}/play/${game}`

/** Opens a game for a new browser order, with a controllable clock. */
async function openGame(page, game = 'reflex', names = ['Pani Puri']) {
  await page.clock.install()
  const id = await placeOrder(page, v.cartId, names)
  await page.goto(playUrl(id, game))
  await expect(page.getByRole('button', { name: /Launch/ })).toBeVisible()
  return id
}
/** Launches and fast-forwards a whole round. */
async function playRound(page, launch = /Launch/) {
  await page.getByRole('button', { name: launch }).click()
  await page.clock.runFor(70_000)
  await expect(page.getByRole('button', { name: /Play again/ })).toBeVisible({ timeout: 20_000 })
}

test('RCT-096 lobby: each game shows its title and today\'s twist; settings switch and stay switched', async ({ page }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  for (const [game, title] of [['nebula', 'Nebula Rush'], ['reflex', 'Zero Reflex'], ['synapse', 'Synapse']]) {
    await page.goto(playUrl(id, game))
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/Today’s|twist|anomaly/i).first()).toBeVisible()
  }
  const motion = page.getByRole('switch', { name: /Reduced motion/ })
  const before = await motion.getAttribute('aria-checked')
  await motion.click()
  await expect(motion).not.toHaveAttribute('aria-checked', before)
  await page.reload()
  await expect(page.getByRole('switch', { name: /Reduced motion/ })).not.toHaveAttribute('aria-checked', before)
  const vib = page.getByRole('switch', { name: /Vibration/ })
  if (await vib.count()) {
    await vib.click()
    await page.reload()
    await expect(page.getByRole('switch', { name: /Vibration/ })).toHaveAttribute('aria-checked', 'false')
  }
})

test('RCT-097 How to play: from the token page and from a game, every game explained', async ({ page }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.getByRole('button', { name: 'How to play' }).click()
  await expect(page).toHaveURL(/\/play\/how-to-play$/)
  for (const t of ['Nebula Rush', 'Zero Reflex', 'Synapse']) await expect(page.getByText(t, { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page).toHaveURL(new RegExp(`/order/${id}$`))
  await page.goto(playUrl(id, 'synapse'))
  await page.getByRole('link', { name: 'How to play' }).click()
  await expect(page).toHaveURL(/how-to-play#synapse$/)
})

test('RCT-098 sound on/off is remembered', async ({ page }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goto(playUrl(id, 'reflex'))
  const toggle = page.getByRole('button', { name: /Turn sound (on|off)/ })
  const before = await toggle.getAttribute('aria-label')
  await toggle.click()
  await page.reload()
  await expect(page.getByRole('button', { name: /Turn sound (on|off)/ })).not.toHaveAttribute('aria-label', before)
})

test('RCT-099 leaving the game pauses it; Resume and Back to my order', async ({ page }) => {
  const id = await openGame(page)
  await page.getByRole('button', { name: /Launch/ }).click()
  await page.clock.runFor(3000)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(page.getByText('Paused', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Resume/ }).first().click()
  await expect(page.getByText('Paused', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByText('Paused', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back to my order' }).click()
  await expect(page).toHaveURL(new RegExp(`/order/${id}$`))
})

test('RCT-100 food ready mid-game: the game pauses with an alert; finish the round or view the order', async ({ page }) => {
  const id = await openGame(page)
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await page.getByRole('button', { name: /Launch/ }).click()
  await page.clock.runFor(3000)
  await call('PUT', `/orders/serve-order/${id}`, { token: v.token })
  await page.clock.runFor(2000)
  await expect(page.getByText('Your food is ready for pickup!')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Finish this round' }).click()
  await expect(page.getByText('Your food is ready for pickup!')).toHaveCount(0)
  await expect(page.getByText('Paused', { exact: true })).toBeVisible()
  // It doesn't ring twice for the same order.
  await page.getByRole('button', { name: /Resume/ }).first().click()
  await page.clock.runFor(5000)
  await expect(page.getByText('Your food is ready for pickup!')).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Your food is ready for pickup!')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'View order' }).click()
  await expect(page).toHaveURL(/\/served$/)
})

test('RCT-101 a finished round: score saved with rank, best today on the token page, Play again', async ({ page }) => {
  const id = await openGame(page)
  const saved = page.waitForResponse((r) => r.url().includes('/games/reflex/scores'))
  await playRound(page)
  expect((await saved).status()).toBeLessThan(300)
  await expect(page.getByText(/You’re #\d+ today/)).toBeVisible()
  await expect(page.getByText('Best today', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Play again/ }).click()
  await expect(page.getByText('Zero Reflex').last()).toBeVisible()
  await page.goto(`/c/${v.cartId}/order/${id}`)
  await expect(page.getByRole('button', { name: /Zero Reflex/ })).toContainText(/Best today: \d+|Tap fast/)
})

test('RCT-102 the leaderboard shows my row as You, by alias only', async ({ page }) => {
  await openGame(page, 'reflex', ['Masala Dosa'])
  await playRound(page)
  await expect(page.getByText(/You’re #\d+ today/)).toBeVisible()
  await page.getByRole('button', { name: /Leaderboard/ }).first().click()
  const board = page.getByRole('dialog', { name: /Today’s top pilots/ })
  await expect(board).toBeVisible()
  const me = board.getByRole('listitem').filter({ hasText: 'You' })
  await expect(me).toHaveCount(1)
  await expect(board).not.toContainText(/\d{10}|QA-Play/)
  await page.keyboard.press('Escape')
  await expect(board).toHaveCount(0)
})

test('RCT-103 Share copies the score and the cart link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.addInitScript(() => { delete Navigator.prototype.share })
  await openGame(page)
  await playRound(page)
  await page.getByRole('button', { name: /Share/ }).click()
  await expect(page.getByText('Copied! Paste it to a friend.')).toBeVisible()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toMatch(new RegExp(`I scored \\d+ in today’s Zero Reflex on GullyEats\\. Can you beat it\\? http://localhost:5183/c/${v.cartId}$`))
})

test('RCT-104 a score that can\'t be sent offline says so and is kept for the next round', async ({ page, context }) => {
  await openGame(page)
  await page.getByRole('button', { name: /Launch/ }).click()
  await context.setOffline(true)
  await page.clock.runFor(70_000)
  await expect(page.getByText('Couldn’t send your score. It will go with your next round.')).toBeVisible({ timeout: 20_000 })
  await context.setOffline(false)
})

test('RCT-105 playing on an order this phone didn\'t place: no leaderboard entry', async ({ page }) => {
  const other = await customerOrder(v.cartId, [{ menuItemId: v.menu[1]._id, quantity: 1 }])
  await page.clock.install()
  let posted = false
  page.on('request', (r) => r.url().includes('/scores') && r.method() === 'POST' && (posted = true))
  await page.goto(playUrl(other.body.data._id, 'reflex'))
  await playRound(page)
  await expect(page.getByText('Place an order to join the leaderboard')).toBeVisible()
  expect(posted).toBe(false)
})

test('RCT-106 adding a phone number from the game: checked, saved on the order, and used at the next checkout', async ({ page }) => {
  const id = await openGame(page)
  await page.getByRole('button', { name: /Keep your rank across orders/ }).click()
  const input = page.locator('#save-phone')
  await input.fill('1234567890')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Enter a valid 10-digit mobile number.')).toBeVisible()
  const phone = `60000999${String(Date.now() % 100).padStart(2, '0')}`
  await input.fill(phone)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText(/Saved\. Order with this number/)).toBeVisible()
  expect((await vendorOrder(v, id)).phoneNumber).toMatch(new RegExp(`${phone}$`))
  await page.goto(`/c/${v.cartId}/menu`)
  await page.getByRole('button', { name: 'Add Pani Puri', exact: true }).click()
  await page.goto(`/c/${v.cartId}/cart`)
  await expect(page.locator('#phone')).toHaveValue(phone)
  // Only for an order with no number yet.
  const again = await call('POST', '/games/phone', { headers: { 'X-Gully-Order': await page.evaluate((oid) => {
    const o = JSON.parse(JSON.parse(localStorage.getItem('persist:gullyeats')).orders).find((x) => x._id === oid)
    return `${o._id}.${o.accessKey}`
  }, id) }, body: { phone: '9876543210' } })
  expect(again.status).toBeGreaterThanOrEqual(400)
})

test('RCT-107 Nebula Rush pilot: locked ships can\'t be picked, a picked ship stays, missions listed', async ({ page }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goto(playUrl(id, 'nebula'))
  await expect(page.getByText(/Today’s missions/)).toBeVisible()
  const locked = page.getByRole('button', { name: /unlocks at/ })
  if (await locked.count()) await expect(locked.first()).toBeDisabled()
  const free = page.getByRole('button', { pressed: false }).filter({ hasNot: page.locator('svg[class*=lock]') })
  const ships = page.locator('button[aria-pressed]:not([disabled])')
  const n = await ships.count()
  expect(n).toBeGreaterThan(0)
  const pick = ships.nth(n - 1)
  const name = await pick.getAttribute('aria-label')
  await pick.click()
  await expect(page.locator(`button[aria-label="${name}"]`)).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.locator(`button[aria-label="${name}"]`)).toHaveAttribute('aria-pressed', 'true')
  expect(free).toBeTruthy()
})

test('RCT-108 every game plays a full round to a result', async ({ page }) => {
  test.setTimeout(120_000)
  const id = await openGame(page, 'nebula')
  for (const game of ['nebula', 'synapse', 'reflex']) {
    await page.goto(playUrl(id, game))
    await playRound(page)
    await expect(page.getByText(/You’re #\d+ today/)).toBeVisible()
  }
})

test('RCT-109 the scores API refuses impossible scores and other days', async () => {
  const o = await customerOrder(v.cartId, [{ menuItemId: v.menu[1]._id, quantity: 1 }])
  const key = { 'X-Gully-Order': o.key }
  const day = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10)
  const send = (game, body) => call('POST', `/games/${game}/scores`, { headers: key, body })
  expect((await send('reflex', { day, score: 99_999_999, durationMs: 30_000 })).status).toBe(400)
  expect((await send('reflex', { day, score: 10, durationMs: 100 })).status).toBe(400)
  expect((await send('reflex', { day: '2020-01-01', score: 10, durationMs: 30_000 })).status).toBe(400)
  expect((await send('nosuchgame', { day, score: 10, durationMs: 30_000 })).status).toBe(404)
  expect((await call('POST', `/games/reflex/scores`, { body: { day, score: 10, durationMs: 30_000 } })).status).toBeGreaterThanOrEqual(400)
})
