// RCT-031..060: every customer-app screen and flow not covered in customer.spec.js,
// including what the vendor does from the other side (driven through the vendor API).
import { test, expect } from '@playwright/test'
import { addItems, call, customerOrder, onboardVendor, paidOrder, placeOrder, vendorOrder } from './helpers.js'

let v // a fresh cart for this file, so closing or editing it never touches other specs
test.beforeAll(async () => {
  v = await onboardVendor({ cartName: `QA-Flows ${Date.now() % 1e5}` })
})
const item = (name) => v.menu.find((m) => m.name === name)
const setOpen = (isOpen, cart = v) => call('PUT', `/carts/toggle-cart-status/${cart.cartId}`, { token: cart.token, body: { isOpen } })

test('RCT-031 the QR link shows the splash, then the cart welcome page', async ({ page }) => {
  await page.goto(`/c/${v.cartId}`)
  await expect(page.getByText('Scan. Crave. Devour.')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/c/${v.cartId}/welcome$`), { timeout: 5000 })
  await expect(page.getByRole('heading', { name: v.cartName })).toBeVisible()
  await expect(page.getByText('Open now')).toBeVisible()
})

test('RCT-032 "/" returns to the last scanned cart; with none, a scan prompt with no dead ends', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Scan a cart to start')).toBeVisible()
  await expect(page.getByRole('button', { name: /Back to/ })).toHaveCount(0)

  await page.goto(`/c/${v.cartId}/welcome`)
  await expect(page.getByRole('heading', { name: v.cartName })).toBeVisible()
  await page.goto('/')
  await expect(page).toHaveURL(new RegExp(`/c/${v.cartId}/menu$`))
  await page.goto('/no/such/page')
  await page.getByRole('button', { name: `Back to ${v.cartName}` }).click()
  await expect(page).toHaveURL(new RegExp(`/c/${v.cartId}/menu$`))
})

test('RCT-033 a closed cart can be browsed but not ordered from', async ({ page }) => {
  await setOpen(false)
  try {
    await page.goto(`/c/${v.cartId}/welcome`)
    await expect(page.getByText('Closed', { exact: true })).toBeVisible()
    await expect(page.getByText("This cart isn't taking orders right now. You can still look at the menu.")).toBeVisible()
    await page.getByRole('button', { name: 'View the menu' }).click()
    await expect(page.getByText("This cart is closed right now, so ordering is paused. Here's what they serve.")).toBeVisible()
    await expect(page.getByText('Masala Dosa').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /^Add / })).toHaveCount(0)
  } finally {
    await setOpen(true)
  }
  await page.reload()
  await expect(page.getByText('Order here, then pay at the counter. Cooking starts once you pay.')).toBeVisible()
})

test('RCT-034 the welcome page shows the cart rating from customers', async ({ page }) => {
  const r = await onboardVendor({ cartName: `QA-Rated ${Date.now() % 1e5}` })
  for (const stars of [5, 4]) {
    const o = await paidOrder(r)
    await call('PUT', `/orders/serve-order/${o.body.data._id}`, { token: r.token })
    await call('PUT', `/orders/submit-feedback/${o.body.data._id}`, { headers: { 'X-Gully-Order': o.key }, body: { rating: stars } })
  }
  await page.goto(`/c/${r.cartId}/welcome`)
  await expect(page.getByLabel('Rated 4.5 out of 5 by 2 customers')).toBeVisible()
  await expect(page.getByText('· 2 ratings')).toBeVisible()
})

test('RCT-035 Terms & Privacy links open the terms page', async ({ page, context }) => {
  await page.goto(`/c/${v.cartId}/welcome`)
  const [terms] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: /Terms/ }).click()])
  await terms.waitForLoadState()
  await expect(terms).toHaveURL(/\/terms\.html/)
  await expect(terms.locator('body')).toContainText(/privacy/i)
  await terms.close()
  await addItems(page, v.cartId, ['Pani Puri'])
  await page.goto(`/c/${v.cartId}/cart`)
  await expect(page.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/terms.html#privacy')
})

test('RCT-036 menu search: matches, clear, and no match', async ({ page }) => {
  await page.goto(`/c/${v.cartId}/menu`)
  const box = page.getByLabel('Search dishes')
  await box.fill('dosa')
  await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Masala Dosa'])
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(box).toHaveValue('')
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(3)
  await box.fill('pizza')
  await expect(page.getByText('No dishes match')).toBeVisible()
  await expect(page.getByText('Try another name or filter.')).toBeVisible()
})

test('RCT-037 menu filters: veg, non-veg, all', async ({ page }) => {
  await page.goto(`/c/${v.cartId}/menu`)
  const filter = (name) => page.getByRole('group', { name: 'Filter' }).getByRole('button', { name, exact: true })
  await filter('Veg').click()
  await expect(filter('Veg')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Masala Dosa', 'Pani Puri'])
  await filter('Non-veg').click()
  await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Chicken Roll'])
  await filter('All').click()
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(3)
})

test('RCT-038 a cart with no dishes says the menu is empty', async ({ page }) => {
  const e = await onboardVendor({ cartName: `QA-Empty ${Date.now() % 1e5}` })
  for (const m of e.menu) {
    const r = await call('DELETE', `/carts/delete-menu-item/${e.cartId}/${m._id}`, { token: e.token })
    expect(r.status, r.body.message).toBeLessThan(300)
  }
  await page.goto(`/c/${e.cartId}/menu`)
  await expect(page.getByText('The menu is empty')).toBeVisible()
})

test('RCT-039 sold-out dishes move to the bottom of the menu', async ({ page }) => {
  const stock = (isInStock) => call('PATCH', `/carts/update-stock/${v.cartId}/${item('Masala Dosa')._id}`, { token: v.token, body: { isInStock } })
  await stock(false)
  try {
    await page.goto(`/c/${v.cartId}/menu`)
    await expect(page.getByRole('heading', { level: 3 }).last()).toHaveText('Masala Dosa')
    await expect(page.getByText('Sold out for now')).toBeVisible()
  } finally {
    await stock(true)
  }
})

test('RCT-040 cart page: steppers, remove to zero, Add more items, Clear, bill with the server fee', async ({ page }) => {
  const fee = (await call('GET', `/carts/get-cart/${v.cartId}`)).body.data.platformFee
  await addItems(page, v.cartId, ['Masala Dosa', 'Pani Puri'])
  await page.getByRole('button', { name: /View cart/ }).click()
  await page.getByRole('button', { name: 'Add one more Masala Dosa' }).click()
  await expect(page.getByText('Item total')).toBeVisible()
  const row = (label) => page.locator('div', { has: page.getByText(label, { exact: true }) }).last()
  await expect(row('Item total')).toContainText('₹150')
  await expect(row('Platform fee')).toContainText(`₹${fee}`)
  await expect(row('To pay at the counter')).toContainText(`₹${150 + fee}`)
  await page.getByRole('button', { name: 'Remove one Pani Puri' }).click()
  await expect(page.getByText('Pani Puri')).toHaveCount(0)
  await page.getByRole('button', { name: 'Add more items' }).click()
  await expect(page).toHaveURL(/\/menu$/)
  await page.goto(`/c/${v.cartId}/cart`)
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(page.getByText('Your cart is empty')).toBeVisible()
})

test('RCT-041 phone number: digits only, kept for the next order, and saved on the order', async ({ page }) => {
  await addItems(page, v.cartId, ['Pani Puri'])
  await page.goto(`/c/${v.cartId}/cart`)
  await page.locator('#phone').fill('+91 60000-99901')
  await expect(page.locator('#phone')).toHaveValue('6000099901')
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page.getByText('Your token', { exact: true })).toBeVisible()
  const id = page.url().split('/').pop()
  expect((await vendorOrder(v, id)).phoneNumber).toMatch(/6000099901$/)
  await addItems(page, v.cartId, ['Pani Puri'])
  await page.goto(`/c/${v.cartId}/cart`)
  await expect(page.locator('#phone')).toHaveValue('6000099901')
})

test('RCT-042 adding items to a paid order asks for the difference, then goes back to paid', async ({ page }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await expect(page.getByText("Paid. You're in the queue")).toBeVisible()
  await page.getByRole('button', { name: 'Add or change items' }).click()
  await expect(page.getByText(/You've paid ₹\s?32\. Pay for new items at the counter/)).toBeVisible()
  await page.getByRole('button', { name: 'Add Masala Dosa', exact: true }).click()
  await expect(page.getByText(/New total ₹\s?92/)).toBeVisible()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText(/Pay ₹\s?60 more at the counter/)).toBeVisible()
  const paidRow = page.locator('div', { has: page.getByText('Paid so far', { exact: true }) }).last()
  await expect(paidRow).toContainText('₹32')
  expect((await vendorOrder(v, id)).status).toBe('PENDING')
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await expect(page.getByText("Paid. You're in the queue")).toBeVisible()
})

test('RCT-043 the order editor: no changes, empty order, and back without reopening', async ({ page }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.getByRole('button', { name: 'Add or change items' }).click()
  await expect(page.getByRole('button', { name: 'No changes yet' })).toBeDisabled()
  await page.getByRole('button', { name: 'Remove one Pani Puri' }).click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Your order needs at least one item. To cancel it, go back to your order.')).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).first().click()
  await expect(page).toHaveURL(new RegExp(`/order/${id}$`))
  await page.goBack()
  await expect(page).not.toHaveURL(/\/add$/)
})

test('RCT-044 a customer cannot take paid items off; the server refuses too', async ({ page }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri', 'Masala Dosa'])
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await page.getByRole('button', { name: 'Add or change items' }).click()
  await page.getByRole('button', { name: 'Remove one Pani Puri' }).click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Ask the cart to remove items from a paid order')).toBeVisible()
  expect((await vendorOrder(v, id)).orderItems).toHaveLength(2)
})

test('RCT-045 the vendor shrinks a paid order and adds a parcel charge: the token shows the change', async ({ page }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri', 'Masala Dosa'])
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await expect(page.getByText("Paid. You're in the queue")).toBeVisible()
  const r = await call('PUT', `/orders/update-order/${id}`, {
    token: v.token, body: { orderItems: [{ menuItemId: item('Masala Dosa')._id, quantity: 1 }], parcelCharge: 10 },
  })
  expect(r.status, r.body.message).toBe(200)
  // 60 + 10 parcel + fee, against 92 paid: 20 back.
  await expect(page.getByText(/Collect ₹\s?20 back from the vendor/)).toBeVisible()
  await expect(page.locator('div', { has: page.getByText('Parcel charge', { exact: true }) }).last()).toContainText('₹10')
  await expect(page.getByText('Pani Puri')).toHaveCount(0)
})

test('RCT-046 vendor cancellations: a paid order shows the refund, an unpaid one says nothing was charged', async ({ page }) => {
  const paid = await placeOrder(page, v.cartId, ['Masala Dosa'])
  await call('PUT', `/orders/mark-order-paid/${paid}`, { token: v.token })
  await call('DELETE', `/orders/delete-order/${paid}`, { token: v.token })
  await expect(page).toHaveURL(/\/cancelled$/)
  await expect(page.getByText('Collect your money back from the vendor')).toBeVisible()
  await expect(page.getByText(/₹\s?62/)).toBeVisible()

  const unpaid = await placeOrder(page, v.cartId, ['Pani Puri'])
  await call('DELETE', `/orders/delete-order/${unpaid}`, { token: v.token })
  await expect(page).toHaveURL(/\/cancelled$/)
  await expect(page.getByText(/You weren't charged anything\./)).toBeVisible()
  await page.getByRole('button', { name: 'Order something else' }).click()
  await expect(page).toHaveURL(new RegExp(`/c/${v.cartId}/menu$`))
})

test('RCT-047 the cancel sheet: keep my order, Escape, and an order paid meanwhile', async ({ page }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.getByRole('button', { name: 'Cancel order' }).click()
  await page.getByRole('button', { name: 'Keep my order' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Cancel order' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('button', { name: 'Cancel order' }).click()
  // The vendor marks it paid while the sheet is open.
  await page.routeWebSocket(/socket\.io/, () => {}) // keep the page from hearing it first
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await page.getByRole('dialog').getByRole('button', { name: 'Yes, cancel order' }).click()
  await expect(page.getByRole('dialog')).toContainText('This order is already paid. Ask the cart to cancel it.')
  expect((await vendorOrder(v, id)).status).toBe('PAID')
})

test('RCT-048 served page: stars, quick picks and text are sent together; Skip and thank-you buttons', async ({ page }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await call('PUT', `/orders/serve-order/${id}`, { token: v.token })
  await expect(page).toHaveURL(/\/served$/)
  await expect(page.getByRole('button', { name: 'Send feedback' })).toBeDisabled()
  await page.getByRole('radio', { name: '5 stars' }).click()
  await expect(page.getByText('Loved it')).toBeVisible()
  await page.getByRole('button', { name: 'Tasty food 😋' }).click()
  await page.getByRole('button', { name: 'Quick service ⚡' }).click()
  await page.getByRole('button', { name: 'Quick service ⚡' }).click() // tapped off again
  await page.getByLabel('Your feedback').fill('crispy')
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(page.getByText('Thanks for your feedback!')).toBeVisible()
  expect(await vendorOrder(v, id)).toMatchObject({ rating: 5, feedback: 'Tasty food 😋 · crispy' })

  await page.getByRole('button', { name: /Read GullyPulse confessions/ }).click()
  await expect(page).toHaveURL(/\/confessions$/)
  await page.goBack()
  await page.getByRole('button', { name: 'Order again' }).click()
  await expect(page).toHaveURL(new RegExp(`/c/${v.cartId}/menu$`))

  const other = await placeOrder(page, v.cartId, ['Pani Puri'])
  await call('PUT', `/orders/mark-order-paid/${other}`, { token: v.token })
  await call('PUT', `/orders/serve-order/${other}`, { token: v.token })
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page).toHaveURL(/\/thank-you$/)
  expect((await vendorOrder(v, other)).rating ?? null).toBeNull()
})

test('RCT-049 when the vendor un-serves an order, the customer goes back to the token page', async ({ page }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await call('PUT', `/orders/serve-order/${id}`, { token: v.token })
  await expect(page).toHaveURL(/\/served$/)
  await call('PUT', `/orders/serve-order-undo/${id}`, { token: v.token })
  await expect(page).toHaveURL(new RegExp(`/order/${id}$`))
  await expect(page.getByText("Paid. You're in the queue")).toBeVisible()
})

test('RCT-050 vendor edits to an unpaid order show live on the token page', async ({ page }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  await call('PUT', `/orders/update-order/${id}`, {
    token: v.token, body: { orderItems: [{ menuItemId: item('Pani Puri')._id, quantity: 3 }] },
  })
  await expect(page.getByText(/Pay ₹\s?92 at the counter/)).toBeVisible()
  await expect(page.getByText('3 ×')).toBeVisible()
})

test('RCT-051 the token page shows a line to read while waiting', async ({ page }) => {
  const line = (await call('GET', '/orders/get-truth-line')).body.data
  await placeOrder(page, v.cartId, ['Pani Puri'])
  if (line) await expect(page.getByText('Something to read while you wait')).toBeVisible()
})

test('RCT-053 the server prices orders itself: a tampered price is ignored', async ({ page }) => {
  await addItems(page, v.cartId, ['Masala Dosa'])
  await page.goto(`/c/${v.cartId}/cart`)
  await page.route('**/orders/create-order', async (route) => {
    const body = route.request().postDataJSON()
    body.orderItems = body.orderItems.map((i) => ({ ...i, price: 1, total: 1 }))
    await route.continue({ postData: JSON.stringify({ ...body, subtotal: 1, platformFee: 0, totalPrice: 1 }) })
  })
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page.getByText(/Pay ₹\s?62 at the counter/)).toBeVisible()
})

test('RCT-054 a dish removed after it went in the basket is refused clearly', async ({ page }) => {
  const extra = await call('POST', `/carts/add-menu-item/${v.cartId}`, { token: v.token, body: { name: 'QA Vada Pav', price: 25, isVeg: true } })
  const extraId = extra.body.data._id
  await addItems(page, v.cartId, ['QA Vada Pav'])
  await call('DELETE', `/carts/delete-menu-item/${v.cartId}/${extraId}`, { token: v.token })
  await page.goto(`/c/${v.cartId}/cart`)
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page.getByRole('alert')).toHaveText('Some items are no longer on the menu')
})

test('RCT-055 a price changed after the basket was filled: the order uses the new price', async ({ page }) => {
  await addItems(page, v.cartId, ['Pani Puri'])
  await call('PUT', `/carts/update-menu-item/${v.cartId}`, { token: v.token, body: { id: item('Pani Puri')._id, price: 35 } })
  try {
    await page.goto(`/c/${v.cartId}/cart`)
    await page.getByRole('button', { name: /Place order/ }).click()
    await expect(page.getByText(/Pay ₹\s?37 at the counter/)).toBeVisible()
  } finally {
    await call('PUT', `/carts/update-menu-item/${v.cartId}`, { token: v.token, body: { id: item('Pani Puri')._id, price: 30 } })
  }
})

test('RCT-056 the order API refuses bad quantities and unknown items', async () => {
  const bad = async (orderItems) => (await call('POST', '/orders/create-order', { body: { cartId: v.cartId, orderItems } }))
  expect((await bad([{ menuItemId: item('Pani Puri')._id, quantity: 0 }])).status).toBe(400)
  expect((await bad([{ menuItemId: item('Pani Puri')._id, quantity: -2 }])).status).toBe(400)
  expect((await bad([{ menuItemId: item('Pani Puri')._id, quantity: 1.5 }])).status).toBe(400)
  expect((await bad([{ menuItemId: item('Pani Puri')._id, quantity: 100000 }])).body.message).toBe('Item quantity is too large')
  expect((await bad([{ menuItemId: '000000000000000000000000', quantity: 1 }])).body.message).toBe('Some items are no longer on the menu')
  expect((await bad([])).status).toBe(400)
})

test('RCT-057 an order open in two tabs updates in both', async ({ page, context }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  const second = await context.newPage()
  await second.goto(page.url())
  await expect(second.getByText('Your token', { exact: true })).toBeVisible()
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await expect(page.getByText("Paid. You're in the queue")).toBeVisible()
  await expect(second.getByText("Paid. You're in the queue")).toBeVisible()
})

test('RCT-058 reloading the token, served and cancelled pages keeps the right page', async ({ page }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.reload()
  await expect(page.getByText('Your token', { exact: true })).toBeVisible()
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await call('PUT', `/orders/serve-order/${id}`, { token: v.token })
  await page.reload()
  await expect(page.getByText('Your food is ready!')).toBeVisible()
  // Opening the token URL of a served order goes to the served page.
  await page.goto(`/c/${v.cartId}/order/${id}`)
  await expect(page).toHaveURL(/\/served$/)
})

test('RCT-059 the open-order card shows each status and disappears once served', async ({ page }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goto(`/c/${v.cartId}/menu`)
  const card = page.getByRole('button', { name: /Your token #\d+/ })
  await expect(card).toContainText('Pay at the counter')
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await page.reload()
  await expect(card).toContainText('Paid · in the queue')
  await call('PUT', `/orders/preparing/${id}`, { token: v.token, body: { preparing: true } })
  await page.reload()
  await expect(card).toContainText('Being prepared')
  await call('PUT', `/orders/serve-order/${id}`, { token: v.token })
  await page.reload()
  await expect(page.getByRole('button', { name: new RegExp(`Your token #${(await vendorOrder(v, id)).orderNumber}\\b`) })).toHaveCount(0)
})

test('RCT-060 an order key from another phone cannot edit, cancel or rate the order', async () => {
  // A wrong key is answered like a missing order, so it never confirms the order exists.
  const mine = await customerOrder(v.cartId, [{ menuItemId: item('Pani Puri')._id, quantity: 1 }])
  const other = await customerOrder(v.cartId, [{ menuItemId: item('Pani Puri')._id, quantity: 1 }])
  const id = mine.body.data._id
  const asOther = { 'X-Gully-Order': other.key }
  expect([401, 403, 404]).toContain((await call('PUT', `/orders/update-order/${id}`, { headers: asOther, body: { orderItems: [{ menuItemId: item('Pani Puri')._id, quantity: 5 }] } })).status)
  expect([401, 403, 404]).toContain((await call('DELETE', `/orders/delete-order/${id}`, { headers: asOther })).status)
  expect([401, 403, 404]).toContain((await call('PUT', `/orders/submit-feedback/${id}`, { headers: asOther, body: { rating: 1 } })).status)
  expect([401, 403, 404]).toContain((await call('PUT', `/orders/update-order/${id}`, { body: { orderItems: [] } })).status)
  expect([401, 403, 404]).toContain((await call('GET', `/orders/queue/${id}`)).status)
})
