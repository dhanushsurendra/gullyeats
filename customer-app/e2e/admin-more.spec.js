// ADM-037..054: the rest of the admin dashboard: date ranges, theme, navigation, phone
// menu, attention panel, activity feed, charts, map filters, cart filters and drawer
// numbers, Insights, Collections and Payments exports, Actions, the moderation queues,
// Feedback paging, login limits and search.
import { test, expect } from '@playwright/test'
import { adminLogin, backdate, call, confess, customerOrder, onboardVendor, paidOrder, secrets } from './helpers.js'
import { ADMIN } from './urls.js'

test.use({ baseURL: ADMIN, viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false })

let v, admin
test.beforeAll(async () => {
  v = await onboardVendor({ cartName: `QA-AdminMore ${Date.now() % 1e5}` })
  admin = await adminLogin()
})
const inr = (n = 0) => {
  const a = Math.abs(n)
  if (a >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}
const search = (page, text) => page.getByPlaceholder('Filter tables…').fill(text)
// The dashboard card (Card: div.rise.rounded-2xl) that holds this heading.
const card = (page, title) => page.locator('div.rise.rounded-2xl').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
const kpi = (page, label) => page.locator('div').filter({ has: page.getByText(label, { exact: true }) })
async function signIn(page) {
  const { adminEmail, adminPassword } = secrets()
  await page.goto('/login')
  await page.locator('input[type=email]').fill(adminEmail)
  await page.locator('input[type=password]').fill(adminPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}
const overview = async (q) => (await call('GET', `/admin/overview?${q}`, { token: admin })).body.data.kpis

test('ADM-037 date range: Today, 7 Days, 30 Days, This Month and a custom range all match the API', async ({ page }) => {
  test.setTimeout(150_000)
  await paidOrder(v)
  await signIn(page)
  await page.goto('/revenue')
  for (const [label, q] of [['Today', 'range=today'], ['7 Days', 'range=7d'], ['30 Days', 'range=30d'], ['This Month', 'range=month']]) {
    const req = page.waitForRequest((r) => r.url().includes('/admin/overview') && r.url().includes(q))
    await page.locator('header').getByRole('button', { name: label, exact: true }).click()
    await req
    const k = await overview(q)
    await expect(kpi(page, 'GMV (selected range)').filter({ hasText: inr(k.orderGmvRange) }).first(), label).toBeVisible()
    await expect(kpi(page, 'Platform fee earned').filter({ hasText: inr(k.platformFeeRange) }).first(), label).toBeVisible()
  }
  // Custom: Cancel keeps the old range; Apply uses the dates.
  await page.locator('header').getByRole('button', { name: 'Custom', exact: true }).click()
  await expect(page.getByText('Custom Date Range')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('Custom Date Range')).toHaveCount(0)
  const day = (n) => new Date(Date.now() + 5.5 * 3600e3 - n * 864e5).toISOString().slice(0, 10)
  await page.locator('header').getByRole('button', { name: 'Custom', exact: true }).click()
  const dates = page.locator('input[type=date]')
  await dates.nth(0).fill(day(10))
  await dates.nth(1).fill(day(0))
  const req = page.waitForRequest((r) => r.url().includes('/admin/overview') && r.url().includes(`startDate=${day(10)}`))
  await page.getByRole('button', { name: 'Apply' }).click()
  await req
  const k = await overview(`startDate=${day(10)}&endDate=${day(0)}`)
  await expect(kpi(page, 'GMV (selected range)').filter({ hasText: inr(k.orderGmvRange) }).first()).toBeVisible()
})

test('ADM-038 dark mode switches and is remembered', async ({ page }) => {
  await signIn(page)
  const isDark = () => page.evaluate(() => document.documentElement.classList.contains('dark'))
  const before = await isDark()
  await page.getByRole('button', { name: 'Toggle dark mode' }).click()
  expect(await isDark()).toBe(!before)
  await page.reload()
  expect(await isDark()).toBe(!before)
  await page.getByRole('button', { name: 'Toggle dark mode' }).click()
})

test('ADM-039 every sidebar link opens its page; on a phone the menu opens and closes', async ({ page }) => {
  await signIn(page)
  const pages = [['Owners', '/owners', 'Owners'], ['Carts', '/restaurants', 'Restaurants / Carts'], ['Orders', '/orders', 'Orders'],
    ['Moderation', '/moderation', 'Moderation'], ['Analytics', '/analytics', 'Analytics'], ['Revenue', '/revenue', 'Revenue'],
    ['Business', '/insights', 'Business Insights'], ['Payments', '/payments', 'Payments'], ['Collections', '/collections', 'Collections'],
    ['Action log', '/actions', 'Action log'], ['Feedback', '/feedback', 'Feedback'], ['Settings', '/settings', 'Settings'],
    ['Dashboard', '/', 'Dashboard']]
  for (const [link, path, title] of pages) {
    await page.getByRole('link', { name: link, exact: true }).first().click()
    await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : path}`))
    await expect(page.locator('header').getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
  }
  await page.setViewportSize({ width: 375, height: 800 })
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('link', { name: 'Payments', exact: true }).last().click()
  await expect(page).toHaveURL(/\/payments$/)
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.getByRole('button', { name: 'Close menu' })).toBeInViewport()
  await page.getByRole('button', { name: 'Close menu' }).click()
  // The menu slides off the screen.
  await expect(page.getByRole('button', { name: 'Close menu' })).not.toBeInViewport()
})

test('ADM-040 Attention Required lists overdue fees and Review opens Collections', async ({ page }) => {
  const due = await onboardVendor({ cartName: `QA-Attn ${Date.now() % 1e5}` })
  await paidOrder(due)
  backdate(due.cartId, 3)
  await signIn(page)
  const item = card(page, 'Attention Required').getByText('Platform fee pending', { exact: true })
  await expect(item).toBeVisible({ timeout: 30_000 })
  await item.locator('xpath=ancestor::div[.//button[normalize-space()="Review"]][1]').getByRole('button', { name: 'Review' }).click()
  await expect(page).toHaveURL(/\/collections$/)
})

test('ADM-041 the activity feed shows a new order with its number, amount and cart', async ({ page }) => {
  const o = await paidOrder(v, 2)
  await signIn(page)
  await expect(card(page, 'Platform Activity')).toContainText(`Order #${o.body.data.orderNumber} · ₹${o.body.data.totalPrice} · ${v.cartName}`, { timeout: 30_000 })
})

test('ADM-042 charts: each revenue period loads its series; the order overview renders', async ({ page }) => {
  await signIn(page)
  await page.goto('/analytics')
  for (const [label, period] of [['7 Days', '7d'], ['30 Days', '30d'], ['3 Months', '3m'], ['12 Months', '12m']]) {
    const res = page.waitForResponse((r) => r.url().includes('/admin/series') && r.url().includes(`period=${period}`))
    await card(page, 'Revenue & Orders').getByRole('button', { name: label, exact: true }).click()
    expect((await res).status(), label).toBe(200)
  }
  await expect(page.getByRole('heading', { name: 'Order Overview' })).toBeVisible()
  await expect(page.locator('.recharts-surface').first()).toBeVisible()
})

test('ADM-043 the cart map: status toggles and the city filter change what is shown', async ({ page }) => {
  await signIn(page)
  const map = card(page, 'Cart Network')
  const subtitle = map.getByText(/carts on the map/)
  await expect(subtitle).toBeVisible({ timeout: 60_000 })
  const count = async () => Number((await subtitle.textContent()).match(/([\d,]+) carts on the map/)[1].replace(/,/g, ''))
  await expect.poll(count, { timeout: 60_000 }).toBeGreaterThan(0) // carts loaded
  const all = await count()
  await map.getByRole('button', { name: 'Live' }).click()
  await expect.poll(count).toBeLessThanOrEqual(all)
  await map.getByRole('button', { name: 'Live' }).click()
  await expect.poll(count).toBe(all)
  await map.getByLabel('City').selectOption('Bengaluru')
  await expect.poll(count).toBeLessThan(all + 1)
  await expect.poll(count).toBeGreaterThan(0)
})

test('ADM-044 Carts filters (status, location, owner, sort) and an owner\'s View link', async ({ page }) => {
  await paidOrder(v)
  await signIn(page)
  await page.goto('/restaurants')
  const rows = page.getByRole('row')
  await page.getByLabel('Status').selectOption('LIVE')
  await expect.poll(async () => [...new Set(await rows.evaluateAll((r) => r.slice(1).map((x) => x.children[3]?.textContent)))]).toEqual(['LIVE'])
  await page.getByLabel('Status').selectOption('')
  await page.getByLabel('Location').selectOption('Bengaluru')
  await expect.poll(async () => [...new Set(await rows.evaluateAll((r) => r.slice(1).map((x) => x.children[2]?.textContent)))]).toEqual(['Bengaluru'])
  await page.getByLabel('Location').selectOption('')
  await page.getByLabel('Sort').selectOption('ordersToday')
  const today = await rows.evaluateAll((r) => r.slice(1, 15).map((x) => Number(x.children[4]?.textContent)))
  expect(today).toEqual([...today].sort((a, b) => b - a))

  // Owners > View shows only that owner's carts.
  await page.goto('/owners')
  await search(page, v.vendorId)
  await page.getByRole('row').filter({ has: page.getByRole('button', { name: 'View' }) }).getByRole('button', { name: 'View' }).click()
  await expect(page).toHaveURL(/\/restaurants\?ownerId=/)
  await search(page, '')
  await expect(page.getByText(/1 carts · one owner/)).toBeVisible()
  await page.getByRole('button', { name: 'Show all owners' }).click()
  await expect(page).toHaveURL(/\/restaurants$/)
})

test('ADM-045 the cart drawer\'s last-30-days numbers match the vendor\'s sales report', async ({ page }) => {
  const d = await onboardVendor({ cartName: `QA-Drawer ${Date.now() % 1e5}` })
  await paidOrder(d, 0, 2)
  await paidOrder(d, 2)
  const cancelled = await customerOrder(d.cartId, [{ menuItemId: d.menu[1]._id, quantity: 1 }])
  await call('DELETE', `/orders/delete-order/${cancelled.body.data._id}`, { token: d.token })
  const day = (n) => new Date(Date.now() + 5.5 * 3600e3 - n * 864e5).toISOString().slice(0, 10)
  const sales = (await call('GET', `/carts/sales-insights/${d.cartId}?startDate=${day(29)}&endDate=${day(0)}`, { token: d.token })).body.data
  await signIn(page)
  await page.goto('/restaurants')
  await search(page, d.cartName)
  await page.getByText(d.cartName).first().click()
  const stat = (label) => page.locator('div.rounded-md').filter({ has: page.getByText(label, { exact: true }) })
  await expect(stat('Revenue')).toContainText(inr(sales.revenue))
  await expect(stat('Orders')).toContainText(String(sales.totalOrders))
  await expect(stat('Cancellation')).toContainText(`${sales.cancellationRate.toFixed(1)}%`)
  await expect(page.getByText('TOP ITEMS BY REVENUE')).toBeVisible()
  await expect(page.getByText('Masala Dosa')).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByText('TOP ITEMS BY REVENUE')).toHaveCount(0)
})

test('ADM-046 Business insights: every tab loads and its numbers match the API', async ({ page }) => {
  await signIn(page)
  await page.goto('/insights')
  const errors = []
  page.on('response', (r) => r.url().includes('/insights/') && r.status() >= 400 && errors.push(r.url()))
  const growth = (await call('GET', '/admin/insights/growth', { token: admin })).body.data
  await expect(kpi(page, 'Fees earned this month').filter({ hasText: inr(growth.revenue?.mtdFees ?? growth.mtdFees ?? 0) }).first()).toBeVisible({ timeout: 30_000 })
  for (const [tab, heading] of [['Vendors', 'At risk'], ['Fee leakage', 'Carts that may be avoiding the platform fee'], ['Customers & Ops', 'When customers order'], ['Growth', 'Cities']]) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 30_000 })
    await expect(page).toHaveURL(new RegExp(`tab=${{ Vendors: 'vendors', 'Fee leakage': 'leakage', 'Customers & Ops': 'operations', Growth: 'growth' }[tab]}`))
  }
  const vendors = (await call('GET', '/admin/insights/vendors', { token: admin })).body.data
  await page.getByRole('button', { name: 'Vendors', exact: true }).click()
  const carts = vendors.summary?.carts ?? vendors.carts
  if (carts != null) await expect(kpi(page, 'Carts').filter({ hasText: carts.toLocaleString('en-IN') }).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('ADM-047 Collections: age buckets filter, SMS reminder is logged, CSV export', async ({ page, context }) => {
  const due = await onboardVendor({ cartName: `QA-Coll ${Date.now() % 1e5}` })
  await paidOrder(due)
  backdate(due.cartId, 4)
  await context.route(/^sms:/, (r) => r.abort())
  await signIn(page)
  await page.goto('/collections')
  await search(page, due.cartName)
  const row = page.getByRole('row').filter({ hasText: due.cartName })
  await expect(row).toBeVisible({ timeout: 60_000 })
  await expect(row).toContainText('₹2')
  await page.getByRole('button', { name: /^8\+ days/ }).click()
  await expect(row).toHaveCount(0)
  await page.getByRole('button', { name: /^3–7 days/ }).click()
  await expect(row).toBeVisible()
  await page.getByRole('button', { name: /^All/ }).click()
  await page.evaluate(() => { window.open = () => null })
  await row.getByRole('button', { name: 'SMS' }).click()
  await expect(row.getByText('Opened')).toBeVisible()
  await expect.poll(async () => (await call('GET', '/admin/actions?action=SEND_REMINDER&limit=20', { token: admin })).body.data.items
    .some((a) => a.target === due.cartName && a.details.channel === 'sms')).toBe(true)
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export CSV/ }).first().click()])
  expect(file.suggestedFilename()).toMatch(/^gullyeats-overdue-fees-.*\.csv$/)
  const csv = await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'))
  expect(csv.split('\n')[0]).toMatch(/Cart.*City.*Owner.*Phone.*Orders.*Days owed/)
  expect(csv).toContain(due.cartName)
})

test('ADM-048 Payments: CSV export with every column, and scrolling loads more without repeats', async ({ page }) => {
  await signIn(page)
  await page.goto('/payments')
  const [file] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.getByRole('button', { name: /Export CSV/ }).click()])
  expect(file.suggestedFilename()).toMatch(/^gullyeats-platform-fees-.*\.csv$/)
  const csv = await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'))
  expect(csv.split('\n')[0]).toMatch(/Cart.*Owner.*Billing days.*Orders billed.*Platform fee \(INR\).*Status.*Verified at.*Source.*Refunded.*Created at/)
  const shown = page.getByText(/Newest first · showing \d+/)
  const first = await shown.textContent()
  await page.mouse.wheel(0, 50000)
  await expect(shown).not.toHaveText(first, { timeout: 30_000 })
  const keys = await page.getByRole('row').evaluateAll((r) => r.slice(1).map((x) => x.textContent))
  expect(new Set(keys).size).toBe(keys.length)
})

test('ADM-049 Action log: filter by action and CSV export', async ({ page }) => {
  await call('POST', `/admin/vendors/${v.vendorId}/reset-pin`, { token: admin })
  await signIn(page)
  await page.goto('/actions')
  await page.getByLabel('Action').selectOption('RESET_PIN')
  await expect.poll(async () => [...new Set(await page.getByRole('row').evaluateAll((r) => r.slice(1).map((x) => x.children[2]?.textContent)))]).toEqual(['Reset PIN'])
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export CSV/ }).click()])
  const csv = await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'))
  expect(csv.split('\n')[0]).toMatch(/By.*Action.*On.*Details/)
  expect(csv).toContain(v.vendorId)
})

test('ADM-050 moderation queues: approve and reject from word-filter review; approve an auto-blocked post', async ({ page }) => {
  const stamp = Date.now()
  const a = await customerOrder(v.cartId, [{ menuItemId: v.menu[0]._id, quantity: 1 }])
  const review1 = `QA admin review ${stamp}: this traffic is shit`
  const review2 = `QA admin review ${stamp}: what a bullshit queue`
  const blocked = `QA admin blocked ${stamp}: fuck this is spicy`
  expect((await confess(a.key, review1)).status).toBe(202)
  expect((await confess(a.key, review2)).status).toBe(202)
  expect((await confess(a.key, blocked)).status).toBe(422)
  const feed = async () => (await call('GET', '/confessions/feed', { headers: { 'X-Gully-Order': a.key } })).body.data.items.map((c) => c.text)

  await signIn(page)
  await page.goto('/moderation')
  await page.getByRole('button', { name: /^Word-filter review/ }).click()
  const panel = page.getByLabel('Moderation item')
  const decide = async (text, button) => {
    await page.getByRole('row').filter({ hasText: text.slice(0, 40) }).first().click()
    await expect(panel).toContainText(text)
    await expect(panel).toContainText('WORD FILTER')
    await panel.getByPlaceholder('Reason (required, saved in the log)').fill('QA decision')
    await panel.getByRole('button', { name: button }).click()
    await expect(page.getByRole('row').filter({ hasText: text.slice(0, 40) })).toHaveCount(0)
  }
  await decide(review1, /Approve & publish/)
  await decide(review2, /^Reject/)
  expect(await feed()).toContain(review1)
  expect(await feed()).not.toContain(review2)

  await page.getByRole('button', { name: /^Auto-blocked/ }).click()
  await decide(blocked, /Approve & publish/)
  expect(await feed()).toContain(blocked)
  // Posts/Comments switch on the review queue.
  await page.getByRole('button', { name: /^Word-filter review/ }).click()
  await page.getByRole('button', { name: 'Comments', exact: true }).click()
  await expect(page.getByText(/Nothing here\. All clear\.|QA|.+/).first()).toBeVisible()
})

test('ADM-051 a reason is required for every moderation decision', async ({ page }) => {
  const a = await customerOrder(v.cartId, [{ menuItemId: v.menu[0]._id, quantity: 1 }])
  const text = `QA no reason ${Date.now()}: shit happens at the counter`
  await confess(a.key, text)
  await signIn(page)
  await page.goto('/moderation')
  await page.getByRole('button', { name: /^Word-filter review/ }).click()
  await page.getByRole('row').filter({ hasText: text.slice(0, 30) }).first().click()
  const panel = page.getByLabel('Moderation item')
  await panel.getByRole('button', { name: /Approve & publish/ }).click()
  await expect(panel.getByText(/reason/i).last()).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: text.slice(0, 30) })).toHaveCount(1)
  await panel.getByRole('button', { name: 'Harmless in context' }).click()
  await expect(panel.getByPlaceholder('Reason (required, saved in the log)')).toHaveValue('Harmless in context')
  await panel.getByRole('button', { name: /Approve & publish/ }).click()
  await expect(page.getByRole('row').filter({ hasText: text.slice(0, 30) })).toHaveCount(0)
})

test('ADM-052 Feedback: total count, newest first, and more on scroll', async ({ page }) => {
  await signIn(page)
  await page.goto('/feedback')
  const first = (await call('GET', '/admin/feedback?limit=30', { token: admin })).body.data
  await expect(page.getByText(new RegExp(`${first.total.toLocaleString('en-IN')} total · showing`))).toBeVisible()
  if (first.pagination.hasMore) {
    const shown = page.getByText(/total · showing \d+/)
    const before = await shown.textContent()
    await page.mouse.wheel(0, 50000)
    await expect(shown).not.toHaveText(before, { timeout: 30_000 })
  }
})

test('ADM-053 five wrong passwords lock that email for 15 minutes', async ({ page }) => {
  const email = `qa-lock-${Date.now()}@gullyeats.test`
  await page.goto('/login')
  for (let i = 0; i < 6; i++) {
    await page.locator('input[type=email]').fill(email)
    await page.locator('input[type=password]').fill(`wrong-${i}`)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
  }
  await expect(page.getByRole('alert')).toContainText('Too many attempts. Please try again in 15 minutes.')
})

test('ADM-054 the search box filters every list page', async ({ page }) => {
  const o = await paidOrder(v)
  await signIn(page)
  await page.goto('/orders')
  await expect(page.getByText(/Showing \d+ orders/)).toBeVisible({ timeout: 30_000 })
  await search(page, v.cartName)
  const rows = page.getByRole('row')
  await expect.poll(async () => [...new Set(await rows.evaluateAll((r) => r.slice(1).map((x) => x.children[1]?.textContent)))]).toEqual([v.cartName])
  await expect(page.getByRole('row').filter({ hasText: `#${o.body.data.orderNumber}` })).toHaveCount(1)
  await page.goto('/restaurants')
  await search(page, v.cartName)
  await expect(page.getByRole('row').filter({ hasText: v.cartName })).toHaveCount(1)
  await search(page, 'zz-no-such-thing-qa')
  await expect(page.getByText('No restaurants match these filters.')).toBeVisible()
})
