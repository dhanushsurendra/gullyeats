// ADM-061..063: Business > GullyPlay and GullyPulse. The live DB holds other data,
// so the API checks compare before and after; the browser checks the pages render.
import { test, expect } from '@playwright/test'
import { call, confess, customerOrder, onboardVendor, secrets } from './helpers.js'
import { ADMIN, API } from './urls.js'

test.use({ baseURL: ADMIN, viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false })

let v
test.beforeAll(async () => {
  v = await onboardVendor({ cartName: `QA-Engage ${Date.now() % 1e5}` })
})
async function signIn(page) {
  const { adminEmail, adminPassword } = secrets()
  await page.goto('/login')
  await page.locator('input[type=email]').fill(adminEmail)
  await page.locator('input[type=password]').fill(adminPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}
const insights = async (page, kind) => {
  const r = await page.request.get(`${API}/admin/insights/${kind}?days=7`)
  expect(r.status()).toBe(200)
  return (await r.json()).data
}
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10)
const nebula = (score) => ({
  score, durationMs: 55_000, day: today(),
  stats: { kills: Math.ceil(score / 20), drones: 0, energy: 0, near: 0, hits: 0, boss: 0, bossHits: 0 },
})

test('ADM-061 GullyPlay counts a new player and every round they play, without showing who', async ({ page }) => {
  await signIn(page)
  const before = await insights(page, 'play')
  const o = await customerOrder(v.cartId, [{ menuItemId: v.menu[0]._id, quantity: 1 }])
  const send = (score) => call('POST', '/games/nebula/scores', { headers: { 'X-Gully-Order': o.key }, body: nebula(score) })
  for (const s of [200, 100, 400]) expect((await send(s)).status).toBe(200)

  const after = await insights(page, 'play')
  expect(after.summary.players).toBe(before.summary.players + 1)
  expect(after.summary.rounds).toBe(before.summary.rounds + 3)
  const ng = (d) => d.perGame.find((g) => g.game === 'nebula')
  expect(ng(after).rounds).toBe(ng(before).rounds + 3)
  expect(JSON.stringify(after)).not.toContain(o.body.data._id)

  await page.goto('/insights?tab=play')
  await expect(page.getByText('QR customers who played')).toBeVisible()
  await expect(page.getByText('Players per day')).toBeVisible()
  await expect(page.locator('.recharts-line')).toHaveCount(3)
  const row = page.getByRole('row').filter({ hasText: 'Nebula Rush' })
  await expect(row).toBeVisible()
  await page.screenshot({ path: 'test-results/insights-play.png', fullPage: true })
})

test('ADM-062 GullyPulse counts a new post and its poster', async ({ page }) => {
  await signIn(page)
  const before = await insights(page, 'pulse')
  const o = await customerOrder(v.cartId, [{ menuItemId: v.menu[0]._id, quantity: 1 }])
  expect((await confess(o.key, `QA-insights post ${Date.now()}`)).status).toBe(201)
  const after = await insights(page, 'pulse')
  expect(after.summary.posts).toBe(before.summary.posts + 1)
  expect(after.summary.posters).toBe(before.summary.posters + 1)
  expect(after.daily.at(-1).posts).toBe(before.daily.at(-1).posts + 1)

  await page.goto('/insights?tab=pulse')
  await expect(page.getByText('Activity per day')).toBeVisible()
  await expect(page.getByText('Moderation health')).toBeVisible()
  await expect(page.getByText('Most engaging posts')).toBeVisible()
  await page.screenshot({ path: 'test-results/insights-pulse.png', fullPage: true })
})

test('ADM-063 the 7/30-day switch is kept in the address and changes the range', async ({ page }) => {
  await signIn(page)
  await page.goto('/insights?tab=pulse')
  const seven = page.waitForResponse((r) => r.url().includes('/insights/pulse?days=7'))
  await page.getByRole('button', { name: 'Last 7 days' }).click()
  await seven
  await expect(page).toHaveURL(/tab=pulse.*days=7|days=7.*tab=pulse/)
  await page.reload()
  await expect(page.getByText('Activity per day')).toBeVisible()
  const ticks = page.locator('.recharts-xAxis .recharts-cartesian-axis-tick')
  expect(await ticks.count()).toBeLessThanOrEqual(7)
  await page.getByRole('button', { name: 'GullyPlay' }).click()
  await expect(page).toHaveURL(/tab=play/)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/insights?tab=play')
  await expect(page.getByText('Players per day')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await page.screenshot({ path: 'test-results/insights-play-phone.png', fullPage: true })
})
