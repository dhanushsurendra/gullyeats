// ADM-xxx: the admin dashboard in a browser, signed in as the QA admin.
import { test, expect } from '@playwright/test'
import { call, onboardVendor, secrets, state } from './helpers.js'
import { ADMIN } from './urls.js'

test.use({ baseURL: ADMIN, viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false })

let v
test.beforeAll(() => { v = state().vendor })

async function signIn(page) {
  const { adminEmail, adminPassword } = secrets()
  await page.goto('/login')
  await page.locator('input[type=email]').fill(adminEmail)
  await page.locator('input[type=password]').fill(adminPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

test('ADM-001 the admin signs in and lands on the dashboard', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
})

test('ADM-002 a wrong password shows a generic error', async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[type=email]').fill(secrets().adminEmail)
  await page.locator('input[type=password]').fill('not-the-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Invalid email or password')).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test('ADM-003 empty fields are not submitted', async ({ page }) => {
  await page.goto('/login')
  let posted = false
  page.on('request', (r) => r.url().includes('/admin/login') && (posted = true))
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/login/)
  expect(posted).toBe(false)
})

test('ADM-005 signed-out visitors are sent to login', async ({ page }) => {
  for (const path of ['/', '/owners', '/payments', '/moderation']) {
    await page.goto(path)
    await expect(page, path).toHaveURL(/\/login/)
  }
})

test('ADM-006 an expired session returns to login instead of a blank page', async ({ page, context }) => {
  await signIn(page)
  await context.clearCookies()
  await page.goto('/orders')
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
})

test('ADM-007 log out ends the session', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'Log out' }).click()
  const confirm = page.getByRole('dialog').getByRole('button', { name: /Log out/ })
  if (await confirm.isVisible().catch(() => false)) await confirm.click()
  await expect(page).toHaveURL(/\/login/)
  await page.goBack()
  await expect(page).toHaveURL(/\/login/)
  expect((await page.request.get(`${ADMIN.replace('5184', '5050')}/api/admin/overview`)).status()).toBe(401)
})

const PAGES = ['/', '/owners', '/restaurants', '/orders', '/analytics', '/revenue', '/payments',
  '/collections', '/insights', '/actions', '/moderation', '/feedback', '/settings']

test('ADM-010/011/024 every page loads without failed API calls or errors', async ({ page }) => {
  test.setTimeout(180_000)
  await signIn(page)
  const failures = []
  page.on('response', (r) => r.url().includes(':5050/') && r.status() >= 400 && failures.push(`${r.status()} ${r.url()}`))
  page.on('pageerror', (e) => failures.push(`pageerror ${e.message}`))
  for (const path of PAGES) {
    await page.goto(path)
    await page.waitForLoadState('networkidle', { timeout: 60_000 })
    await expect(page.getByText(/Cannot reach the API|Request failed|Something went wrong/), path).toHaveCount(0)
  }
  expect(failures).toEqual([])
})

test('ADM-016 suspend and resume a cart from Restaurants', async ({ page }) => {
  test.setTimeout(120_000)
  await signIn(page)
  await page.goto('/restaurants')
  await page.getByPlaceholder('Filter tables…').fill(v.cartName)
  await page.getByText(v.cartName).first().click()
  const cartState = async () => (await call('GET', `/carts/get-cart/${v.cartId}`)).body.data

  await page.getByRole('button', { name: 'Suspend cart' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Suspend', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Resume cart' })).toBeVisible()
  const o = await call('POST', '/orders/create-order', { body: { cartId: v.cartId, orderItems: [{ menuItemId: v.menu[0]._id, quantity: 1 }] } })
  expect(o.status).toBe(403)

  await page.getByRole('button', { name: 'Resume cart' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Suspend cart' })).toBeVisible()
  await call('PUT', `/carts/toggle-cart-status/${v.cartId}`, { token: v.token, body: { isOpen: true } })
  expect((await cartState()).isOpen).toBe(true)
})

test('ADM-029 Orders CSV export downloads a file', async ({ page }) => {
  await signIn(page)
  await page.goto('/orders')
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.getByRole('button', { name: /Export/ }).first().click()])
  expect(download.suggestedFilename()).toMatch(/\.csv$/)
})

test('ADM-030 the dashboard has no sideways scroll on a phone', async ({ page }) => {
  await signIn(page)
  await page.setViewportSize({ width: 375, height: 800 })
  for (const path of ['/', '/restaurants', '/orders', '/actions', '/collections', '/moderation']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle', { timeout: 60_000 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
})

test('ADM-031..035 new dish names: 3 carts put them up for review; approve, merge, reject', async ({ page }) => {
  test.setTimeout(240_000)
  // Three vendors each add the same new items (names start "QA " for cleanup).
  const vendors = []
  for (let i = 0; i < 3; i++) vendors.push(await onboardVendor({ cartName: `QA-Dish ${i}`, open: false }))
  for (const v of vendors) {
    for (const name of ['QA Kulhad Chai', 'QA Golgappa', 'QA Combo Ramesh']) {
      const r = await call('POST', `/carts/add-menu-item/${v.cartId}`, { token: v.token, body: { name, price: 20, isVeg: true } })
      expect(r.status, name).toBe(201)
    }
  }
  await new Promise((r) => setTimeout(r, 3000)) // tracking runs after the save returns

  await signIn(page)
  await page.goto('/dishes')
  const row = (name) => page.locator('div.border-b').filter({ has: page.getByRole('heading', { name, exact: true }) })
  await expect(row('QA Kulhad Chai')).toContainText('Used by 3 carts')

  // Find images: 5 Pixabay photos (or a clear message when there are none).
  await row('QA Kulhad Chai').getByRole('button', { name: /Find images/ }).click()
  await expect(row('QA Kulhad Chai').getByText(/Photos from|no photos/)).toBeVisible({ timeout: 20_000 })

  // Approve with a corrected Hindi spelling (no photo, so nothing lands in S3).
  await row('QA Kulhad Chai').getByLabel(/Hindi/).fill('क्यूए कुल्हड़ चाय')
  await row('QA Kulhad Chai').getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText('QA Kulhad Chai added to the common list.')).toBeVisible()
  const names = (await call('GET', '/carts/food-names', { token: vendors[0].token })).body.data
  expect(names.find((n) => n.name === 'QA Kulhad Chai')).toMatchObject({ hi: 'क्यूए कुल्हड़ चाय' })

  // Merge into an existing dish.
  await row('QA Golgappa').getByLabel('Dish to merge into').fill('Pani Puri')
  await row('QA Golgappa').getByRole('button', { name: 'Merge' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Merge' }).click()
  await expect(page.getByText('QA Golgappa is now another name for Pani Puri.')).toBeVisible()

  // Reject.
  await row('QA Combo Ramesh').getByRole('button', { name: 'Reject' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Reject' }).click()
  await expect(page.getByText('QA Combo Ramesh rejected.')).toBeVisible()

  // All three are gone from the list after a reload.
  await page.reload()
  await expect(page.getByRole('heading', { name: /^QA / })).toHaveCount(0)
})
