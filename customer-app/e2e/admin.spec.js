// ADM-xxx: the admin dashboard in a browser, signed in as the QA admin.
import { test, expect } from '@playwright/test'
import { adminLogin, backdate, call, confess, customerOrder, onboardVendor, paidOrder, secrets, state } from './helpers.js'
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
    // The elements that stick out (not inside something that clips them), for the failure message.
    const wide = await page.evaluate(() => {
      const w = document.documentElement.clientWidth
      const clipped = (e) => { for (let p = e.parentElement; p; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') return true; return false }
      return [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > w + 0.5 && !clipped(e))
        .slice(0, 5).map((e) => `${e.tagName}.${String(e.className).slice(0, 80)} "${(e.textContent || '').trim().slice(0, 40)}"`)
    })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `${path}: ${wide.join(' | ')}`).toBeLessThanOrEqual(0)
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

let admin
const adminToken = async () => (admin ||= await adminLogin())
const overview = async () => (await call('GET', '/admin/overview', { token: await adminToken() })).body.data.kpis
const actionsLog = async (action) =>
  (await call('GET', `/admin/actions?limit=50${action ? `&action=${action}` : ''}`, { token: await adminToken() })).body.data.items
const search = (page, text) => page.getByPlaceholder('Filter tables…').fill(text)
const ownerRow = (page) => page.getByRole('row').filter({ has: page.getByRole('button', { name: 'View' }) })

test('ADM-010 dashboard numbers match the API, and a paid order moves them by its amount', async ({ page }) => {
  test.setTimeout(120_000)
  const before = await overview()
  const o = await paidOrder(v, 2)
  const after = await overview()
  expect(after.totalOrders).toBe(before.totalOrders + 1)
  expect(after.ordersToday.value).toBe(before.ordersToday.value + 1)
  // GMV = the sum of totalPrice over PAID + SERVED orders.
  expect(after.orderGmvRange).toBe(before.orderGmvRange + o.body.data.totalPrice)
  expect(after.platformFeeRange).toBe(before.platformFeeRange + o.body.data.platformFee)

  await signIn(page)
  // The KPI card holding both the label and the API's value.
  const card = (label, value) =>
    page.locator('div').filter({ has: page.getByText(label, { exact: true }) }).filter({ hasText: value.toLocaleString('en-IN') })
  await expect(card('Total Orders', after.totalOrders).first()).toBeVisible()
  await expect(card('Orders Today', after.ordersToday.value).first()).toBeVisible()
})

test('ADM-012 Owners: the list loads and search finds a vendor by ID and phone', async ({ page }) => {
  test.setTimeout(120_000)
  await signIn(page)
  await page.goto('/owners')
  await expect(ownerRow(page).first()).toBeVisible({ timeout: 60_000 })
  for (const q of [v.vendorId, v.phoneNumber]) {
    await search(page, q)
    await expect(ownerRow(page), q).toHaveCount(1)
  }
  await search(page, 'QA-no-such-owner-xyz')
  await expect(page.getByText('No owners match.')).toBeVisible()
})

test('ADM-013 disable a vendor, then enable; both are logged', async ({ page }) => {
  test.setTimeout(120_000)
  const nv = await onboardVendor({ cartName: `QA-Owner ${Date.now() % 1e5}` })
  await signIn(page)
  await page.goto('/owners')
  await search(page, nv.vendorId)
  const row = ownerRow(page)
  await row.getByRole('button', { name: 'Disable' }).click()
  await page.getByRole('dialog').getByRole('textbox').fill('QA test')
  await page.getByRole('dialog').getByRole('button', { name: 'Disable', exact: true }).click()
  await expect(row.getByRole('button', { name: 'Enable' })).toBeVisible()
  expect((await call('POST', '/vendors/login', { body: { vendorIdentifier: nv.vendorId, pin: nv.pin } })).status).toBe(403)

  await row.getByRole('button', { name: 'Enable' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enable', exact: true }).click()
  await expect(row.getByRole('button', { name: 'Disable' })).toBeVisible()
  expect((await call('POST', '/vendors/login', { body: { vendorIdentifier: nv.vendorId, pin: nv.pin } })).status).toBe(200)

  const log = await actionsLog()
  for (const action of ['DISABLE_VENDOR', 'ENABLE_VENDOR']) {
    const a = log.find((x) => x.action === action && x.target.includes(nv.vendorId))
    expect(a, action).toBeTruthy()
    expect(a.by).toBe('QA Admin')
  }
})

test('ADM-014 reset a vendor PIN from Settings: new PIN shown once, old one stops working', async ({ page }) => {
  const nv = await onboardVendor({ cartName: `QA-Pin ${Date.now() % 1e5}`, open: false })
  await signIn(page)
  await page.goto('/settings')
  await page.getByPlaceholder('VEN-XXXXXX').fill(nv.vendorId)
  await page.getByRole('button', { name: 'Generate new PIN' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Reset PIN' }).click()
  await expect(page.getByText('Shown once. Share it with the vendor now.')).toBeVisible()
  const pin = (await page.locator('span.font-mono').textContent()).trim()
  expect(pin).toMatch(/^\d{4,6}$/)
  expect((await call('POST', '/vendors/login', { body: { vendorIdentifier: nv.vendorId, pin: nv.pin } })).status).toBe(401)
  expect((await call('POST', '/vendors/login', { body: { vendorIdentifier: nv.vendorId, pin } })).status).toBe(200)
  await page.reload()
  await expect(page.locator('span.font-mono')).toHaveCount(0)
})

test('ADM-015 Restaurants shows LIVE, OFFLINE, PAUSED and ATTENTION as the README maps them', async ({ page }) => {
  test.setTimeout(180_000)
  const tag = Date.now() % 1e5
  const live = await onboardVendor({ cartName: `QA-Live ${tag}` })
  const offline = await onboardVendor({ cartName: `QA-Offline ${tag}`, open: false })
  const paused = await onboardVendor({ cartName: `QA-Paused ${tag}`, open: false })
  const p = await call('PUT', `/carts/update-cart/${paused.cartId}`, { token: paused.token, body: { isActive: false } })
  expect(p.status, p.body.message).toBeLessThan(300)
  // ATTENTION: an unpaid bill with a checkout started (a PENDING payment).
  const due = await onboardVendor({ cartName: `QA-Attention ${tag}` })
  await paidOrder(due)
  backdate(due.cartId)
  const checkout = await call('POST', `/payments/create-razorpay-order/${due.cartId}`, { token: due.token })
  expect(checkout.status, checkout.body.message).toBeLessThan(300)

  const carts = (await call('GET', '/admin/carts', { token: await adminToken() })).body.data
  const status = (c) => carts.find((x) => x.id === c.cartId)?.status
  expect([status(live), status(offline), status(paused), status(due)]).toEqual(['LIVE', 'OFFLINE', 'PAUSED', 'ATTENTION'])

  await signIn(page)
  await page.goto('/restaurants')
  await search(page, String(tag))
  for (const [c, s] of [[live, 'LIVE'], [offline, 'OFFLINE'], [paused, 'PAUSED'], [due, 'ATTENTION']]) {
    await expect(page.getByRole('row').filter({ hasText: c.cartName }), c.cartName).toContainText(s)
  }
})

test('ADM-017 resuming a cart is refused while its vendor is disabled', async ({ page }) => {
  const nv = await onboardVendor({ cartName: `QA-Resume ${Date.now() % 1e5}` })
  await call('POST', `/admin/owners/${nv.userId}/disable`, { token: await adminToken() })
  try {
    await signIn(page)
    await page.goto('/restaurants')
    await search(page, nv.cartName)
    await page.getByText(nv.cartName).first().click()
    await page.getByRole('button', { name: 'Resume cart' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Resume', exact: true }).click()
    await expect(page.getByText(/Enable the vendor first\./)).toBeVisible()
    const carts = (await call('GET', '/admin/carts', { token: await adminToken() })).body.data
    expect(carts.find((c) => c.id === nv.cartId).status).toBe('SUSPENDED')
  } finally {
    await call('POST', `/admin/owners/${nv.userId}/enable`, { token: await adminToken() })
  }
})

test('ADM-018 the map gets each cart as [lat, lng] and draws pins', async ({ page }) => {
  test.setTimeout(120_000)
  const carts = (await call('GET', '/admin/carts', { token: await adminToken() })).body.data
  const mine = carts.find((c) => c.id === v.cartId)
  // onboardVendor puts the cart in Bengaluru; swapped it would be in the sea off Somalia.
  expect([mine.lat, mine.lng]).toEqual([12.9716, 77.5946])
  const outside = carts.filter((c) => c.lat != null && !(c.lat > 6 && c.lat < 37 && c.lng > 68 && c.lng < 98))
  expect(outside.map((c) => `${c.name} ${c.lat},${c.lng}`)).toEqual([])

  await signIn(page)
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.leaflet-marker-icon, path.leaflet-interactive').first()).toBeVisible({ timeout: 30_000 })
})

test('ADM-019 Orders: status filter and cursor paging without duplicates', async ({ page }) => {
  test.setTimeout(120_000)
  const ids = new Set()
  let cursor = ''
  for (let i = 0; i < 3; i++) {
    const q = `/admin/orders?status=SERVED&limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
    const r = (await call('GET', q, { token: await adminToken() })).body
    for (const o of r.data) {
      expect(o.status).toBe('SERVED')
      expect(ids.has(o.id), `duplicate ${o.id}`).toBe(false)
      ids.add(o.id)
    }
    if (!r.pagination.hasMore) break
    cursor = r.pagination.nextCursor
  }
  expect(ids.size).toBeGreaterThan(0)

  await signIn(page)
  await page.goto('/orders')
  const shown = page.getByText(/^Showing \d+ orders$/)
  await page.getByRole('button', { name: 'Served', exact: true }).click()
  await expect(page.getByRole('row').nth(1)).toBeVisible({ timeout: 30_000 })
  const statusCol = () => page.getByRole('row').evaluateAll((rows) => rows.slice(1).map((r) => r.children[5]?.textContent))
  await expect.poll(async () => [...new Set(await statusCol())]).toEqual(['SERVED'])
  const first = await shown.textContent()
  await page.mouse.wheel(0, 50000)
  await expect(shown).not.toHaveText(first, { timeout: 30_000 })
  expect([...new Set(await statusCol())]).toEqual(['SERVED'])
  const keys = await page.getByRole('row').evaluateAll((rows) => rows.slice(1).map((r) => r.textContent))
  expect(new Set(keys).size).toBe(keys.length)
})

test('ADM-021/022 Payments lists fee payments; Mark fee paid settles the bill and unlocks the cart', async ({ page }) => {
  test.setTimeout(120_000)
  const nv = await onboardVendor({ cartName: `QA-MarkPaid ${Date.now() % 1e5}` })
  await paidOrder(nv)
  await paidOrder(nv, 1)
  backdate(nv.cartId)
  const lock = (await call('GET', `/payments/payment-status/${nv.cartId}`, { token: nv.token })).body
  expect(lock.isLocked).toBe(true)
  expect(lock.totalPending).toBeGreaterThan(0)
  expect((await customerOrder(nv.cartId, [{ menuItemId: nv.menu[0]._id, quantity: 1 }])).status).toBe(403)

  await signIn(page)
  await page.goto('/restaurants')
  await search(page, nv.cartName)
  await page.getByText(nv.cartName).first().click()
  await page.getByRole('button', { name: 'Mark fee paid' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Mark paid' }).click()
  await expect(page.getByText(`Marked ₹${lock.totalPending} as paid.`)).toBeVisible()
  expect((await call('GET', `/payments/payment-status/${nv.cartId}`, { token: nv.token })).body.isLocked).toBe(false)
  expect((await customerOrder(nv.cartId, [{ menuItemId: nv.menu[0]._id, quantity: 1 }])).status).toBe(201)

  await page.goto('/payments')
  await search(page, nv.cartName)
  const row = page.getByRole('row').filter({ hasText: nv.cartName })
  await expect(row).toContainText('VERIFIED')
  await expect(row).toContainText('MANUAL')
  await expect(row).toContainText(`₹${lock.totalPending}`)
})

test('ADM-023 Collections lists an overdue cart and logs a reminder', async ({ page, context }) => {
  test.setTimeout(120_000)
  const nv = await onboardVendor({ cartName: `QA-Overdue ${Date.now() % 1e5}` })
  await paidOrder(nv)
  backdate(nv.cartId, 3)
  // The reminder opens WhatsApp in a new tab; keep it inside the test.
  await context.route(/wa\.me|whatsapp/, (r) => r.fulfill({ body: 'whatsapp' }))
  await signIn(page)
  await page.goto('/collections')
  await search(page, nv.cartName)
  const row = page.getByRole('row').filter({ hasText: nv.cartName })
  await expect(row).toBeVisible({ timeout: 60_000 })
  const popup = page.waitForEvent('popup')
  await row.getByRole('button', { name: /WhatsApp/ }).click()
  await (await popup).close()
  await expect(row.getByText('Opened')).toBeVisible()
  await expect.poll(async () => (await actionsLog('SEND_REMINDER')).some((a) => a.target === nv.cartName)).toBe(true)
})

test('ADM-025/026 Moderation: counts match the queue; remove, restore and suspend the poster', async ({ page }) => {
  test.setTimeout(180_000)
  const token = await adminToken()
  const counts = (await call('GET', '/admin/moderation/counts', { token })).body.data
  const reported = (await call('GET', '/admin/moderation/queue?status=REPORTED&kind=confession&limit=100', { token })).body.data.items
  expect(counts.reported).toBe(reported.length)

  const o = await customerOrder(v.cartId, [{ menuItemId: v.menu[0]._id, quantity: 1 }])
  const text = `QA moderation ${Date.now()}: the chai here fixes every bad day`
  const posted = await confess(o.key, text)
  expect(posted.status, posted.body.message).toBe(201)
  const feed = async () => (await call('GET', '/confessions/feed', { headers: { 'X-Gully-Order': o.key } })).body.data.items
  expect((await feed()).some((c) => c.text === text), 'post is in the feed').toBe(true)
  // Moderation acts on the database id, which only admins see.
  const published = (await call('GET', '/admin/moderation/queue?status=PUBLISHED&kind=confession&limit=100', { token })).body.data.items
  const id = published.find((c) => c.text === text)?.id
  expect(id, 'admin finds the post').toBeTruthy()
  const inFeed = async () => (await feed()).some((c) => c.text === text)

  await signIn(page)
  await page.goto('/moderation')
  await expect(page.getByRole('button', { name: counts.reported ? `Reported posts (${counts.reported})` : 'Reported posts', exact: true })).toBeVisible()

  // Remove (as a published post has no queue of its own), then act on it from the dashboard.
  expect((await call('POST', `/admin/moderation/confession/${id}/remove`, { token, body: { reason: 'QA remove' } })).status).toBe(200)
  expect(await inFeed()).toBe(false)
  await page.getByRole('button', { name: 'Removed', exact: true }).click()
  await page.getByRole('row').filter({ hasText: text.slice(0, 30) }).first().click()
  const panel = page.getByLabel('Moderation item')
  const reason = panel.getByPlaceholder('Reason (required, saved in the log)')

  await reason.fill('QA suspend')
  await panel.getByRole('combobox').selectOption('1')
  await panel.getByRole('button', { name: 'Suspend', exact: true }).click()
  await expect(panel.getByRole('button', { name: 'Lift suspension' })).toBeVisible()
  expect((await confess(o.key, 'QA while suspended this should not be allowed at all')).status).toBe(403)
  await reason.fill('QA lift')
  await panel.getByRole('button', { name: 'Lift suspension' }).click()
  await expect(panel.getByRole('button', { name: 'Lift suspension' })).toHaveCount(0)

  await reason.fill('QA restore')
  await panel.getByRole('button', { name: /Restore/ }).click()
  await expect.poll(inFeed).toBe(true)
  const log = await actionsLog()
  for (const a of ['REMOVE_CONFESSION', 'RESTORE_CONFESSION', 'SUSPEND_POSTER', 'UNSUSPEND_POSTER']) {
    expect(log.some((x) => x.action === a), a).toBe(true)
  }
})

test('ADM-027 the Actions page shows each admin action with who and when', async ({ page }) => {
  const nv = await onboardVendor({ cartName: `QA-Log ${Date.now() % 1e5}`, open: false })
  await call('POST', `/admin/vendors/${nv.vendorId}/reset-pin`, { token: await adminToken() })
  await signIn(page)
  await page.goto('/actions')
  const row = page.getByRole('row').filter({ hasText: nv.vendorId }).first()
  await expect(row).toContainText('Reset PIN')
  await expect(row).toContainText('QA Admin')
  await expect(row).toContainText(/\d{1,2}:\d{2}/)
  await page.getByLabel('Action').selectOption('RESET_PIN')
  await expect(row).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'Disabled vendor' })).toHaveCount(0)
})

test('ADM-028 Feedback lists ratings and text from served orders', async ({ page }) => {
  const o = await paidOrder(v)
  const id = o.body.data._id
  await call('PUT', `/orders/serve-order/${id}`, { token: v.token })
  const text = `QA admin feedback ${Date.now()}`
  const r = await call('PUT', `/orders/submit-feedback/${id}`, { headers: { 'X-Gully-Order': o.key }, body: { rating: 3, feedback: text } })
  expect(r.status).toBe(200)
  await signIn(page)
  await page.goto('/feedback')
  const item = page.locator('div.border-b').filter({ hasText: text })
  await expect(item).toBeVisible()
  await expect(item.getByLabel('3 of 5 stars')).toBeVisible()
  await expect(item).toContainText(`Order #${o.body.data.orderNumber}`)
})

test('ADM-036 a new platform fee applies to new orders only', async ({ page }) => {
  const token = await adminToken()
  const original = (await call('GET', '/admin/settings', { token })).body.data.platformFee
  const old = await customerOrder(v.cartId, [{ menuItemId: v.menu[1]._id, quantity: 1 }])
  const next = original === 5 ? 6 : 5
  try {
    await signIn(page)
    await page.goto('/collections')
    await page.getByLabel('Platform fee in rupees').fill(String(next))
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Change fee' }).click()
    await expect(page.getByText('Saved. New orders now pay this fee.')).toBeVisible()

    const fresh = await customerOrder(v.cartId, [{ menuItemId: v.menu[1]._id, quantity: 1 }])
    expect(fresh.body.data.platformFee).toBe(next)
    expect(fresh.body.data.totalPrice).toBe(30 + next)
    // The order placed before keeps its fee, even after an edit.
    const edited = await call('PUT', `/orders/update-order/${old.body.data._id}`, {
      headers: { 'X-Gully-Order': old.key }, body: { orderItems: [{ menuItemId: v.menu[1]._id, quantity: 2 }] },
    })
    expect(edited.body.data.platformFee).toBe(original)
    expect(edited.body.data.totalPrice).toBe(60 + original)
    expect((await call('POST', '/admin/settings', { token, body: { platformFee: 101 } })).status).toBe(400)
    expect((await call('POST', '/admin/settings', { token, body: { platformFee: 2.5 } })).status).toBe(400)
    expect((await actionsLog('SET_PLATFORM_FEE'))[0].details).toMatchObject({ from: original, to: next })
  } finally {
    await call('POST', '/admin/settings', { token, body: { platformFee: original } })
  }
})
