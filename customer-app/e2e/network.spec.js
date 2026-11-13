// RCT-061..072 and ADM-055..057: no internet, a server that is down or slow,
// and live updates missed while the phone was offline.
import { test, expect } from '@playwright/test'
import { addItems, call, onboardVendor, placeOrder, secrets, vendorOrder } from './helpers.js'
import { ADMIN, API } from './urls.js'

let v
test.beforeAll(async () => {
  v = await onboardVendor({ cartName: `QA-Net ${Date.now() % 1e5}` })
})
const OFFLINE = 'No internet connection. Check your network and try again.'
const DOWN = 'Couldn’t reach GullyEats right now. Please try again.'

test('RCT-061 welcome page: offline it keeps the cart it has; a first visit that fails offers Try again', async ({ page, context }) => {
  // Already opened once: going offline and back to the welcome page still shows the cart.
  await page.goto(`/c/${v.cartId}/menu`)
  await expect(page.getByText('Masala Dosa').first()).toBeVisible()
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Back' }).first().click()
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByRole('heading', { name: v.cartName })).toBeVisible()
  await context.setOffline(false)

  // First visit with the server unreachable.
  await page.evaluate(() => localStorage.clear())
  await page.route(`${API}/**`, (r) => r.abort('connectionrefused'))
  await page.goto(`/c/${v.cartId}/welcome`)
  await expect(page.getByText("Couldn't open this cart")).toBeVisible()
  await expect(page.getByText(DOWN)).toBeVisible()
  await page.unroute(`${API}/**`)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: v.cartName })).toBeVisible()
})

test('RCT-062 menu with the server down: message and retry', async ({ page }) => {
  await page.route(`${API}/carts/**`, (r) => r.abort('connectionrefused'))
  await page.goto(`/c/${v.cartId}/menu`)
  await expect(page.getByText("Couldn't load the menu")).toBeVisible()
  await expect(page.getByText(DOWN)).toBeVisible()
  await page.unroute(`${API}/carts/**`)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Masala Dosa').first()).toBeVisible()
})

test('RCT-063 the browser goes offline on the cart page: the offline message, then the order goes through', async ({ page, context }) => {
  await addItems(page, v.cartId, ['Pani Puri'])
  await page.goto(`/c/${v.cartId}/cart`)
  await context.setOffline(true)
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page.getByRole('alert')).toHaveText(OFFLINE)
  await expect(page.getByRole('button', { name: /Place order/ })).toBeEnabled()
  await context.setOffline(false)
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page.getByText('Your token', { exact: true })).toBeVisible()
})

test('RCT-064 a server error while placing shows its message and nothing is ordered', async ({ page }) => {
  await addItems(page, v.cartId, ['Pani Puri'])
  await page.goto(`/c/${v.cartId}/cart`)
  await page.route('**/orders/create-order', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false}' }))
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page.getByRole('alert')).toHaveText('Something went wrong. Please try again.')
  await page.unroute('**/orders/create-order')
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page.getByText('Your token', { exact: true })).toBeVisible()
})

test('RCT-065 updates missed while offline arrive when the connection comes back', async ({ page, context }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  await context.setOffline(true)
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await call('PUT', `/orders/preparing/${id}`, { token: v.token, body: { preparing: true } })
  await page.waitForTimeout(1500)
  await expect(page.getByText(/Pay ₹\s?32 at the counter/)).toBeVisible() // still the old state
  await context.setOffline(false)
  await expect(page.getByText('Your food is being prepared')).toBeVisible({ timeout: 30_000 })
})

test('RCT-066 updates missed while the live connection was down arrive when the tab is shown again', async ({ page }) => {
  // The socket drops (e.g. phone asleep) without the browser noticing being offline.
  await page.routeWebSocket(/socket\.io/, (ws) => ws.close())
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await page.waitForTimeout(1500)
  await expect(page.getByText(/Pay ₹\s?32 at the counter/)).toBeVisible()
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(page.getByText("Paid. You're in the queue")).toBeVisible()
})

test('RCT-067 the token page offline on open: message, Try again, Back to menu', async ({ page }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.route(`${API}/orders/order/**`, (r) => r.abort('internetdisconnected'))
  await page.reload()
  await expect(page.getByText("Couldn't load your order")).toBeVisible()
  await page.unroute(`${API}/orders/order/**`)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Your token', { exact: true })).toBeVisible()
  await page.route(`${API}/orders/order/**`, (r) => r.abort('internetdisconnected'))
  await page.reload()
  await page.getByRole('button', { name: 'Back to menu' }).click()
  await expect(page).toHaveURL(new RegExp(`/c/${v.cartId}/menu$`))
  expect(id).toMatch(/^[a-f0-9]{24}$/)
})

test('RCT-068 saving order changes offline fails clearly and keeps the edit', async ({ page, context }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.getByRole('button', { name: 'Add or change items' }).click()
  await page.getByRole('button', { name: 'Add Masala Dosa', exact: true }).click()
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText(OFFLINE)).toBeVisible()
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText(/Pay ₹\s?92 at the counter/)).toBeVisible()
  expect((await vendorOrder(v, id)).totalPrice).toBe(92)
})

test('RCT-069 cancelling offline shows the error in the sheet; the order stays', async ({ page, context }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.getByRole('button', { name: 'Cancel order' }).click()
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Yes, cancel order' }).click()
  await expect(page.getByRole('dialog')).toContainText(OFFLINE)
  await context.setOffline(false)
  expect((await vendorOrder(v, id)).status).toBe('PENDING')
})

test('RCT-070 sending feedback offline fails clearly, then sends', async ({ page, context }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await call('PUT', `/orders/serve-order/${id}`, { token: v.token })
  await expect(page).toHaveURL(/\/served$/)
  await page.getByRole('radio', { name: '3 stars' }).click()
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(page.getByText(OFFLINE)).toBeVisible()
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(page.getByText('Thanks for your feedback!')).toBeVisible()
})

test('RCT-071 a slow network shows loading placeholders, never a blank page', async ({ page }) => {
  await page.route(`${API}/carts/get-menu-items/**`, async (r) => {
    await new Promise((res) => setTimeout(res, 3000))
    await r.continue()
  })
  await page.goto(`/c/${v.cartId}/menu`)
  await expect(page.locator('.skeleton, [class*=shimmer], [class*=animate-pulse]').first()).toBeVisible()
  await expect(page.getByText('Masala Dosa').first()).toBeVisible({ timeout: 15_000 })

  await page.route(`${API}/orders/order/**`, async (r) => {
    await new Promise((res) => setTimeout(res, 3000))
    await r.continue()
  })
  await placeOrder(page, v.cartId, ['Pani Puri']).catch(() => {})
  await page.reload()
  await expect(page.getByRole('status', { name: 'Fetching your token…' })).toBeVisible()
  await expect(page.getByText('Your token', { exact: true })).toBeVisible({ timeout: 15_000 })
})

test('RCT-072 a lost connection while placing an order never creates two orders', async ({ page }) => {
  await addItems(page, v.cartId, ['Pani Puri'])
  await page.goto(`/c/${v.cartId}/cart`)
  // The request reaches the server, the answer is lost on the way back.
  let first = true
  await page.route('**/orders/create-order', async (r) => {
    if (!first) return r.continue()
    first = false
    await r.fetch()
    await r.abort('connectionreset')
  })
  const before = ((await call('GET', `/orders/orders-today/${v.cartId}`, { token: v.token })).body.data || []).length
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  const after = ((await call('GET', `/orders/orders-today/${v.cartId}`, { token: v.token })).body.data || []).length
  // One order exists on the server; the basket is still there so the customer can see what happened.
  expect(after).toBe(before + 1)
})

// ---- admin dashboard ----

test.describe('admin', () => {
  test.use({ baseURL: ADMIN, viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false })

  async function signIn(page) {
    const { adminEmail, adminPassword } = secrets()
    await page.goto('/login')
    await page.locator('input[type=email]').fill(adminEmail)
    await page.locator('input[type=password]').fill(adminPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).not.toHaveURL(/\/login/)
  }

  test('ADM-055 sign-in with the API down says so, and works when it is back', async ({ page }) => {
    const { adminEmail, adminPassword } = secrets()
    await page.route(`${API}/**`, (r) => r.abort('connectionrefused'))
    await page.goto('/login')
    await page.locator('input[type=email]').fill(adminEmail)
    await page.locator('input[type=password]').fill(adminPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toContainText('Cannot reach the API')
    await page.unroute(`${API}/**`)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('ADM-056 pages with the API failing show an error, not a blank or crashed page', async ({ page }) => {
    await signIn(page)
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route(`${API}/admin/**`, (r) =>
      r.request().url().includes('/admin/logout') ? r.continue() : r.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false,"message":"QA forced failure"}' }))
    for (const path of ['/', '/owners', '/restaurants', '/orders', '/payments', '/collections', '/insights', '/actions', '/moderation', '/feedback', '/dishes']) {
      await page.goto(path)
      await expect(page.getByText(/QA forced failure|Something went wrong|Couldn/).first(), path).toBeVisible({ timeout: 15_000 })
    }
    expect(errors).toEqual([])
  })

  test('ADM-057 the dashboard offline, then back: it loads again without signing in again', async ({ page, context }) => {
    await signIn(page)
    await page.goto('/orders')
    await expect(page.getByText(/Showing \d+ orders/)).toBeVisible({ timeout: 30_000 })
    await context.setOffline(true)
    await page.getByRole('link', { name: 'Payments' }).first().click().catch(() => {})
    await page.waitForTimeout(1000)
    await context.setOffline(false)
    await page.goto('/payments')
    await expect(page.getByRole('heading', { name: 'Platform fee payments' })).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/)
  })
})

test('RCT-110 a change made while the token page is still joining its live updates is not lost', async ({ page }) => {
  // Hold the page's "join this order" message for 2 s, and mark the order paid in that gap.
  let held = false
  await page.routeWebSocket(/socket\.io/, (ws) => {
    const server = ws.connectToServer()
    ws.onMessage((m) => {
      if (typeof m === 'string' && m.includes('"join_order"')) {
        held = true
        setTimeout(() => server.send(m), 2000)
      } else server.send(m)
    })
    server.onMessage((m) => ws.send(m))
  })
  await addItems(page, v.cartId, ['Pani Puri'])
  await page.goto(`/c/${v.cartId}/cart`)
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page.getByText('Your token', { exact: true })).toBeVisible()
  const id = page.url().split('/').pop()
  await expect.poll(() => held).toBe(true)
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  // Without the ack-then-refetch, the page would stay on "Pay ₹32 at the counter".
  await expect(page.getByText("Paid. You're in the queue")).toBeVisible({ timeout: 8000 })
})

test('RCT-111 an old answer arriving late never replaces newer order details', async ({ page }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  // On the next open, the first fetch of the order answers 3 s late (a slow network).
  let first = true
  await page.route(`${API}/orders/order/${id}`, async (route) => {
    if (!first) return route.continue()
    first = false
    const res = await route.fetch() // the order as it is now: 1 × Pani Puri, ₹32
    await new Promise((r) => setTimeout(r, 3000))
    await route.fulfill({ response: res })
  })
  await page.reload()
  // Meanwhile the vendor changes it; the page hears it live (or fetches it again).
  await call('PUT', `/orders/update-order/${id}`, {
    token: v.token, body: { orderItems: [{ menuItemId: v.menu[1]._id, quantity: 3 }] },
  })
  await expect(page.getByText(/Pay ₹\s?92 at the counter/)).toBeVisible({ timeout: 8000 })
  // The late ₹32 answer has landed by now; the page must still show ₹92.
  await page.waitForTimeout(4000)
  await expect(page.getByText(/Pay ₹\s?92 at the counter/)).toBeVisible()
})
