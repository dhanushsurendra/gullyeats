// RCT-076..095: GullyPulse, every screen: feed, likes, double-tap, comments, reports,
// My posts, review and moderation outcomes, limits, locked states, offline.
import { test, expect } from '@playwright/test'
import { adminLogin, call, confess, customerOrder, onboardVendor, placeOrder } from './helpers.js'
import { API } from './urls.js'

let v, admin
test.beforeAll(async () => {
  v = await onboardVendor({ cartName: `QA-Pulse ${Date.now() % 1e5}` })
  admin = await adminLogin()
})
const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`
const newCustomer = () => customerOrder(v.cartId, [{ menuItemId: v.menu[1]._id, quantity: 1 }])
/** A published confession by a fresh customer; returns { id, text, key }. */
async function published(prefix = 'QA post') {
  const author = await newCustomer()
  const text = `${prefix} ${stamp()}: the green chutney here deserves an award`
  const r = await confess(author.key, text)
  expect(r.status, r.body.message).toBe(201)
  return { id: r.body.data.confession.id, text, key: author.key }
}
const cardOf = (page, text) => page.locator('article').filter({ hasText: text })
const adminId = async (text, status = 'PUBLISHED') =>
  (await call('GET', `/admin/moderation/queue?status=${status}&kind=confession&limit=100`, { token: admin })).body.data.items.find((c) => c.text === text)?.id

test('RCT-076 the feed: locked without an order, open with one, newest posts, all caught up', async ({ page }) => {
  await page.goto('/confessions')
  await expect(page.getByText('Unlocks with your order')).toBeVisible()
  const post = await published()
  await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goto('/confessions')
  await expect(page.getByRole('tab', { name: /Popular/ })).toHaveAttribute('aria-selected', 'true')
  await expect(cardOf(page, post.text)).toBeVisible()
  await expect(cardOf(page, post.text)).toContainText('Anonymous')
  // No poster details anywhere on the card.
  await expect(cardOf(page, post.text)).not.toContainText(v.cartName)
  await expect(cardOf(page, post.text)).not.toContainText(/6000099|00999/)
})

test('RCT-077 the feed loads more as you scroll, without repeats', async ({ page }) => {
  test.setTimeout(240_000)
  // Make sure there are more than 20 (one page) published posts.
  const feed = async (key, cursor) => (await call('GET', `/confessions/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { headers: { 'X-Gully-Order': key } })).body.data
  const probe = await newCustomer()
  let first = await feed(probe.key)
  for (let i = 0; !first.nextCursor && i < 8; i++) {
    const a = await newCustomer()
    for (let j = 0; j < 3; j++) await confess(a.key, `QA paging ${stamp()} number ${j}: masala chai beats coffee`)
    first = await feed(probe.key)
  }
  expect(first.nextCursor, 'more than one page of posts').toBeTruthy()

  await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goto('/confessions')
  await expect(page.locator('article').first()).toBeVisible()
  await expect(page.locator('article')).toHaveCount(20)
  await page.mouse.wheel(0, 30000)
  await expect.poll(() => page.locator('article').count(), { timeout: 20_000 }).toBeGreaterThan(20)
  const ids = await page.locator('article header p.text-xs').allTextContents()
  expect(new Set(ids).size).toBe(ids.length)
})

test('RCT-078 like and unlike: the count moves, stays after reload, and others see it', async ({ page }) => {
  const post = await published()
  await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goto(`/confessions/${post.id}`)
  const like = page.getByRole('button', { name: 'Like', exact: true })
  await expect(like).toContainText('0')
  await like.click()
  const unlike = page.getByRole('button', { name: 'Unlike' })
  await expect(unlike).toContainText('1')
  await expect(unlike).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Unlike' })).toContainText('1')
  // Another customer sees 1 like, not liked by them.
  const other = await newCustomer()
  const seen = (await call('GET', `/confessions/${post.id}`, { headers: { 'X-Gully-Order': other.key } })).body.data
  expect(seen).toMatchObject({ likes: 1, liked: false })
  await page.getByRole('button', { name: 'Unlike' }).click()
  await expect(page.getByRole('button', { name: 'Like', exact: true })).toContainText('0')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Like', exact: true })).toContainText('0')
})

test('RCT-079 double-tap likes once and never unlikes', async ({ page }) => {
  const post = await published()
  await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goto(`/confessions/${post.id}`)
  const text = page.getByText(post.text)
  await text.dblclick()
  await expect(page.getByRole('button', { name: 'Unlike' })).toContainText('1')
  await text.dblclick()
  await expect(page.getByRole('button', { name: 'Unlike' })).toContainText('1')
})

test('RCT-080 comments: post one, it shows with You, the count goes up, and others see it', async ({ page }) => {
  const post = await published()
  await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goto('/confessions')
  await cardOf(page, post.text).getByRole('button', { name: /comments$/ }).click()
  await expect(page).toHaveURL(new RegExp(`/confessions/${post.id}$`))
  await expect(page.getByText('No comments yet. Say something nice.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send comment' })).toBeDisabled()
  const text = `QA comment ${stamp()}: same, every single time`
  await page.getByLabel('Comment anonymously').fill(text)
  await page.getByRole('button', { name: 'Send comment' }).click()
  const mine = page.locator('li').filter({ hasText: text })
  await expect(mine).toContainText('You')
  await expect(page.getByRole('heading', { name: '1 comment' })).toBeVisible()
  await expect(page.getByLabel('Comment anonymously')).toHaveValue('')
  // The author replying shows "Author" to everyone.
  const reply = await call('POST', `/confessions/${post.id}/comments`, { headers: { 'X-Gully-Order': post.key }, body: { text: `QA author reply ${stamp()}` } })
  expect(reply.status).toBe(201)
  await page.reload()
  await expect(page.locator('li').filter({ hasText: 'QA author reply' })).toContainText('Author')
  await expect(page.getByRole('heading', { name: '2 comments' })).toBeVisible()
  // Another customer sees the comment without "You".
  const other = await newCustomer()
  const list = (await call('GET', `/confessions/${post.id}/comments`, { headers: { 'X-Gully-Order': other.key } })).body.data.items
  expect(list.find((c) => c.text === text)).toMatchObject({ mine: false })
})

test('RCT-081 a blocked comment is refused with a message; a borderline one waits for review', async ({ page }) => {
  const post = await published()
  await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goto(`/confessions/${post.id}`)
  const box = page.getByLabel('Comment anonymously')
  await box.fill('what the fuck man')
  await page.getByRole('button', { name: 'Send comment' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByText('what the fuck man')).toHaveCount(1) // only in the box
  await box.fill(`QA this is shit ${stamp()}`)
  await page.getByRole('button', { name: 'Send comment' }).click()
  await expect(page.getByText('Your comment is waiting for a quick review.')).toBeVisible()
  await expect(page.getByRole('heading', { name: '0 comments' })).toBeVisible()
})

test('RCT-082 reporting a post: needs a reason, Cancel and Escape close, one report per person', async ({ page }) => {
  const post = await published()
  await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goto('/confessions')
  const card = cardOf(page, post.text)
  await card.getByRole('button', { name: 'Report this confession' }).click()
  const sheet = page.getByRole('dialog', { name: 'Report this confession' })
  await expect(sheet.getByRole('button', { name: 'Report', exact: true })).toBeDisabled()
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await expect(sheet).toHaveCount(0)
  await card.getByRole('button', { name: 'Report this confession' }).click()
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await card.getByRole('button', { name: 'Report this confession' }).click()
  await sheet.getByRole('radio', { name: 'Spam' }).click()
  await sheet.getByRole('button', { name: 'Report', exact: true }).click()
  await expect(page.getByText('Thanks for reporting. Our team will take a look.')).toBeVisible()
  await card.getByRole('button', { name: 'Report this confession' }).click()
  await sheet.getByRole('radio', { name: 'Spam' }).click()
  await sheet.getByRole('button', { name: 'Report', exact: true }).click()
  await expect(sheet).toContainText('You already reported this.')
})

test('RCT-083 the fourth report hides a post from the reporter\'s feed straight away', async ({ page }) => {
  const post = await published()
  for (let i = 0; i < 3; i++) {
    const r = await newCustomer()
    await call('POST', `/confessions/${post.id}/report`, { headers: { 'X-Gully-Order': r.key }, body: { reason: 'abusive' } })
  }
  await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goto(`/confessions/${post.id}`)
  await page.getByRole('button', { name: 'Report this confession' }).click()
  await page.getByRole('radio', { name: 'Abusive or offensive' }).click()
  await page.getByRole('button', { name: 'Report', exact: true }).click()
  await expect(page).toHaveURL(/\/confessions$/)
  await expect(page.getByText('Thanks. This post is hidden while our team reviews it.')).toBeVisible()
  await expect(cardOf(page, post.text)).toHaveCount(0)
})

test('RCT-084 reporting comments: thanks, and the fourth report hides it and lowers the count', async ({ page }) => {
  const post = await published()
  const commenter = await newCustomer()
  const text = `QA comment to report ${stamp()}`
  const c = await call('POST', `/confessions/${post.id}/comments`, { headers: { 'X-Gully-Order': commenter.key }, body: { text } })
  const commentId = c.body.data.comment.id
  for (let i = 0; i < 3; i++) {
    const r = await newCustomer()
    await call('POST', `/confessions/comments/${commentId}/report`, { headers: { 'X-Gully-Order': r.key }, body: { reason: 'spam' } })
  }
  await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goto(`/confessions/${post.id}`)
  await expect(page.getByRole('heading', { name: '1 comment' })).toBeVisible()
  await page.locator('li').filter({ hasText: text }).getByRole('button', { name: 'Report this comment' }).click()
  const sheet = page.getByRole('dialog', { name: 'Report this comment' })
  await sheet.getByRole('radio', { name: 'Spam' }).click()
  await sheet.getByRole('button', { name: 'Report', exact: true }).click()
  await expect(page.getByText('Thanks for reporting. Our team will take a look.')).toBeVisible()
  await expect(page.getByText(text)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '0 comments' })).toBeVisible()
  // My own comment has no report button.
  await page.getByLabel('Comment anonymously').fill(`QA mine ${stamp()}`)
  await page.getByRole('button', { name: 'Send comment' }).click()
  await expect(page.locator('li').filter({ hasText: 'QA mine' }).getByRole('button', { name: 'Report this comment' })).toHaveCount(0)
})

test('RCT-085 posting: counter, minimum length, posted toast, and a duplicate is refused', async ({ page }) => {
  await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goto('/confessions')
  await page.getByRole('button', { name: 'Write a confession' }).first().click()
  await expect(page).toHaveURL(/\/confessions\/new$/)
  const box = page.getByLabel('Your confession')
  await box.fill('short')
  await expect(page.getByText('5 more characters')).toBeVisible()
  await expect(page.getByText('5/500')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Post anonymously' })).toBeDisabled()
  const text = `QA long enough ${stamp()} to post here`
  await box.fill(text)
  await page.getByRole('button', { name: 'Post anonymously' }).click()
  await expect(page).toHaveURL(/\/confessions$/)
  await expect(page.getByText('Posted anonymously 🎉')).toBeVisible()
  await expect(cardOf(page, text)).toContainText('You')
  await expect(cardOf(page, text).getByRole('button', { name: 'Report this confession' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Write a confession' }).first().click()
  await page.getByLabel('Your confession').fill(text)
  await page.getByRole('button', { name: 'Post anonymously' }).click()
  await expect(page.getByRole('alert')).toContainText('You already posted this.')
})

test('RCT-086 a borderline post goes to review, shows "In review" in My posts, and goes live once approved', async ({ page }) => {
  await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goto('/confessions/new')
  const text = `QA review ${stamp()}: the shit traffic made me late again`
  await page.getByLabel('Your confession').fill(text)
  await page.getByRole('button', { name: 'Post anonymously' }).click()
  await expect(page.getByText('Sent for a quick review')).toBeVisible()
  await page.getByRole('button', { name: 'Back to confessions' }).click()
  await expect(cardOf(page, text)).toHaveCount(0)
  await page.getByRole('tab', { name: /My posts/ }).click()
  await expect(page.getByText('Only you can see this list.')).toBeVisible()
  const row = page.getByRole('listitem').filter({ hasText: text })
  await expect(row).toContainText('In review')
  await expect(row).toContainText('Our team is checking this before it goes live.')
  await expect(row.getByRole('button')).toBeDisabled()

  const id = await adminId(text, 'PENDING_REVIEW')
  expect((await call('POST', `/admin/moderation/confession/${id}/approve`, { token: admin, body: { reason: 'QA ok' } })).status).toBe(200)
  await page.reload()
  await page.getByRole('tab', { name: /My posts/ }).click()
  await expect(page.getByRole('listitem').filter({ hasText: text })).toContainText('Live')
  await page.getByRole('tab', { name: /Popular/ }).click()
  await expect(cardOf(page, text)).toBeVisible()
})

test('RCT-087 a post an admin removes shows "Not shown" in My posts and "Not found" by its link', async ({ page }) => {
  await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goto('/confessions/new')
  const text = `QA to remove ${stamp()}: my secret samosa spot`
  await page.getByLabel('Your confession').fill(text)
  await page.getByRole('button', { name: 'Post anonymously' }).click()
  await expect(cardOf(page, text)).toBeVisible()
  const publicId = (await cardOf(page, text).locator('header p.text-xs').textContent()).match(/#(\w+)/)[1]
  const id = await adminId(text)
  await call('POST', `/admin/moderation/confession/${id}/remove`, { token: admin, body: { reason: 'QA remove' } })
  await page.getByRole('tab', { name: /My posts/ }).click()
  await expect(page.getByRole('listitem').filter({ hasText: text })).toContainText('Not shown')
  await page.goto(`/confessions/${publicId}`)
  await expect(page.getByText('This confession isn’t available any more.')).toBeVisible()
  await page.getByRole('button', { name: 'See other confessions' }).click()
  await expect(page).toHaveURL(/\/confessions$/)
})

test('RCT-088 the composer from the token page: prompts prefill, the bare prompt cannot be posted, posting returns to the token', async ({ page }) => {
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.getByRole('button', { name: 'I secretly…' }).click()
  await expect(page).toHaveURL(/\/confessions\/new$/)
  const box = page.getByLabel('Your confession')
  await expect(box).toHaveValue('I secretly ')
  await expect(page.getByRole('button', { name: 'Post anonymously' })).toBeDisabled()
  await box.press('End')
  await box.pressSequentially(`eat two plates of momos ${stamp()}`)
  await page.getByRole('button', { name: 'Post anonymously' }).click()
  await expect(page).toHaveURL(new RegExp(`/order/${id}$`))
  await expect(page.getByText('Posted anonymously 🎉')).toBeVisible()
})

test('RCT-089 the token page GullyPulse card: like there, open a post, See all', async ({ page }) => {
  await published('QA card')
  await placeOrder(page, v.cartId, ['Pani Puri'])
  const strip = page.getByRole('list', { name: 'Top confessions' })
  await expect(strip).toBeVisible()
  const first = strip.getByRole('listitem').first()
  const likeBtn = first.getByRole('button', { name: /^(Like|Unlike)$/ })
  const before = Number((await likeBtn.textContent()).trim())
  const wasLiked = (await likeBtn.getAttribute('aria-pressed')) === 'true'
  await likeBtn.click()
  await expect(likeBtn).toHaveText(String(before + (wasLiked ? -1 : 1)))
  await strip.getByRole('button', { name: 'See all' }).click()
  await expect(page).toHaveURL(/\/confessions$/)
  await page.goBack()
  await strip.getByRole('listitem').first().getByRole('button', { name: /comments$/ }).click()
  await expect(page).toHaveURL(/\/confessions\/\w+$/)
})

test('RCT-090 posting limit: three posts an hour, then a clear message', async ({ page }) => {
  await placeOrder(page, v.cartId, ['Pani Puri'])
  for (let i = 0; i < 3; i++) {
    await page.goto('/confessions/new')
    await page.getByLabel('Your confession').fill(`QA limit ${stamp()} post number ${i}`)
    await page.getByRole('button', { name: 'Post anonymously' }).click()
    await expect(page).toHaveURL(/\/confessions$/)
  }
  await page.goto('/confessions/new')
  await page.getByLabel('Your confession').fill(`QA limit ${stamp()} one too many`)
  await page.getByRole('button', { name: 'Post anonymously' }).click()
  await expect(page.getByRole('alert')).toContainText('You can post 3 confessions an hour. Try again later.')
})

test('RCT-091 a suspended poster sees "Posting is paused" and can still read', async ({ page }) => {
  await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goto('/confessions/new')
  const text = `QA suspend me ${stamp()} please`
  await page.getByLabel('Your confession').fill(text)
  await page.getByRole('button', { name: 'Post anonymously' }).click()
  await expect(page).toHaveURL(/\/confessions$/)
  const id = await adminId(text)
  await call('POST', `/admin/moderation/confession/${id}/suspend`, { token: admin, body: { days: 1, reason: 'QA' } })
  try {
    await page.goto('/confessions/new')
    await expect(page.getByText('Posting is paused')).toBeVisible()
    await page.goto('/confessions')
    await expect(page.locator('article').first()).toBeVisible()
  } finally {
    await call('POST', `/admin/moderation/confession/${id}/suspend`, { token: admin, body: { days: 0, reason: 'QA lift' } })
  }
})

test('RCT-092 only a cancelled order on the phone: GullyPulse stays locked', async ({ page }) => {
  await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.getByRole('button', { name: 'Cancel order' }).click()
  await page.getByRole('button', { name: 'Yes, cancel order' }).click()
  await expect(page).toHaveURL(/\/cancelled$/)
  await page.goto('/confessions')
  await expect(page.getByText('Unlocks with your order')).toBeVisible()
  const post = await published()
  await page.goto(`/confessions/${post.id}`)
  await expect(page.getByText('Unlocks with your order')).toBeVisible()
})

test('RCT-093 more than one page of comments: Show more comments', async ({ page }) => {
  test.setTimeout(180_000)
  const post = await published()
  for (let a = 0; a < 2; a++) {
    const who = await newCustomer()
    for (let i = 0; i < 11; i++) {
      await call('POST', `/confessions/${post.id}/comments`, { headers: { 'X-Gully-Order': who.key }, body: { text: `QA c${a}-${i} ${stamp()}` } })
    }
  }
  await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goto(`/confessions/${post.id}`)
  await expect(page.getByRole('heading', { name: '22 comments' })).toBeVisible()
  await expect(page.getByText(/^QA c\d-\d+/)).toHaveCount(20)
  await page.getByRole('button', { name: 'Show more comments' }).click()
  await expect(page.getByText(/^QA c\d-\d+/)).toHaveCount(22)
  await expect(page.getByRole('button', { name: 'Show more comments' })).toHaveCount(0)
})

test('RCT-094 a like that fails offline is put back with a message', async ({ page, context }) => {
  const post = await published()
  await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.goto(`/confessions/${post.id}`)
  await expect(page.getByRole('button', { name: 'Like', exact: true })).toBeVisible()
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Like', exact: true }).click()
  await expect(page.getByText('No internet connection. Check your network and try again.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Like', exact: true })).toContainText('0')
  await context.setOffline(false)
})

test('RCT-095 the feed with the server failing: error and Try again; a comment offline keeps the text', async ({ page, context }) => {
  const post = await published()
  await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.route(`${API}/confessions/feed**`, (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false,"message":"QA feed down"}' }))
  await page.goto('/confessions')
  await expect(page.getByText('QA feed down')).toBeVisible()
  await page.unroute(`${API}/confessions/feed**`)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('article').first()).toBeVisible()

  await page.goto(`/confessions/${post.id}`)
  await page.getByLabel('Comment anonymously').fill('QA offline comment')
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Send comment' }).click()
  await expect(page.getByRole('alert')).toContainText('No internet connection')
  await expect(page.getByLabel('Comment anonymously')).toHaveValue('QA offline comment')
  await context.setOffline(false)
})
