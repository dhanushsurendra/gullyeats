# Fix plan: vendor app (`ordering/`) and backend

Written 2026-11-06 at the end of a long session, so the next session can start from here without the earlier conversation. Everything in "Findings" comes from a read-only review of every file in `ordering/lib` and of the backend endpoints it calls. See Progress for what has been fixed since.

## Progress (branch `ordering-fixes`, 2026-11-06)

Done, one commit per group, not merged or pushed: B1–B4, B6–B15, F1–F29. F22 is now a real language setting: English, Kannada and Hindi through `flutter gen-l10n` (`ordering/lib/l10n/`, `LanguageProvider`); the Hindi and Kannada text needs a native speaker's check. Also, outside the plan: `/api/admin/*` now needs an admin login (it was public), and `send-otp`/`verify-otp` refuse staff and admin accounts (the OTP in the response let anyone log in as an admin). Backend tests: `npm test` (node:test, stubbed models, 27 pass). Vendor app: `flutter test` (5 pass), `flutter analyze` has no errors or warnings.

Still open, needing a decision: **B5** (what the payment lock should block), **B16** (OTP login design), **F27** (should a photo be optional), **F30** (dead code to delete), **F31** (UI pass). Not done: Edit Cart has no parcel-charge field (the backend now saves it), and any client can still join any cart's socket room.

Behaviour changes to know before deploying: customers can only cancel unpaid orders and can't shrink a paid one; QR orders need the cart open and active; serving needs payment; order prices come from the menu. After deploy, the admin dashboard needs its login cookie to work cross-site (`SameSite=None` in production), and `gullyeats-admin/src/services/api.js` reads `import.meta.env.API_URL` where `.env` defines `VITE_API_URL`.


- **`main`** (local only, **not pushed**) has all the onboarding-app work merged: responsive layout, bug fixes, resuming half-finished outlets, Send Credentials with `POST /vendors/reset-pin`, the QR poster flow, the shared UI widgets, and tests (353 pass). It also has the backend fixes: QR link, `findManagedCart` access checks on cart and staff endpoints, `get-all-carts` login, active-by-default carts, menu replace on save, and no PIN logging. It also has the customer-app "Order served" fix.
- **`local-testing`** is `main` with the onboarding app pointed at `http://192.168.0.165:5000/api` (this PC). **Never merge it.** Rebase it onto `main` before using it.
- **`backend/.env`** (gitignored) still has **local values**: `NODE_ENV=development`, plus local `FRONTEND_URL_CUSTOMER`, `FRONTEND_URL` and `FRONTEND_URL_ADMIN`. The production values are kept as `# Production:` comments. Restore them before deploying. `MONGO_URI` points at the real Atlas cluster, which may be production.
- **Nothing is deployed.** The backend must be redeployed for any backend fix to take effect.
- **⚠️ Do not deploy the current `main` backend before fixing B3 below.** `findManagedCart` lets staff assigned to a cart manage it, and `switch-staff-cart` lets anyone reassign any account to any cart, so the two together allow a cart takeover.

## How we work (agreed with the user)

- **Branches:** work on a branch, one commit per fix, with clear messages. Don't push unless asked. Merge into `main` only when asked.
- **Scope:** the user tests on their Android phone (I2219) via `local-testing`. Do the `ordering/` UI work only when asked, following `docs/ui-guidelines.md`.
- **Tests:** add a test for each logic fix: Flutter widget tests with `http.runWithClient` and `MockClient`, and for the backend, stubbed-model checks or a real test setup. For the onboarding app, run `flutter test` and update goldens only after looking at the changed images.
- **Business rules:**
  - Orders are served only after payment, so undo-serve restores `PAID`.
  - "PREPARING" is just the admin dashboard's label for `PAID`.
  - The onboarding app (`frontend/`) is used by GullyEats staff, not vendors. They send the OTP SMS from their own phones, and the OTP coming back in the API response is by design.
  - Vendors and their staff use `ordering/`. They log in with a VEN- or STF- ID (or phone number) and a PIN.

## Findings and proposed fixes

### Backend (fix first: security and money)

| # | Problem | Where | Proposed fix |
|---|---|---|---|
| B3 | `switch-staff-cart` lets any logged-in user set any account's `cartId` to any cart. Combined with `findManagedCart`'s staff rule, that allows a cart takeover. | `cartController.js` `switchStaffCart` (~line 610) | Load the staff account and require `role === 'staff'`. Call `findManagedCart` on the staff member's current cart **and** on the target cart, so the caller must manage both. Make the staff rule owner-only for write actions if that's simpler. |
| B2 | `update-menu-item` deletes whatever S3 object the client names in `oldImageUrl`, with no login. | `cartController.js` `updateMenuItem` (~294) | Require login and `findManagedCart`. Only delete `oldImageUrl` if it equals the item's stored `imageUrl` from **before** the update, never a client-supplied value. |
| B1 | No login on most write and read routes: every order route except create, get order and feedback; `add-menu-item`, `update-menu-item`, `delete-menu-item`, `update-stock`, `toggle-cart-status` and `sales-insights`. | `routes/orderRoutes.js`, `routes/cartRoutes.js` | Add `auth` and `findManagedCart` (via the order's `cartId`) to the vendor-only routes: mark paid/unpaid, serve and undo, undo delete, `orders-today`, `/:cartId` lists, menu writes, stock, toggle status and sales. **The customer app calls `create-order`, `order/:orderId`, `update-order` (add items), `delete-order` (cancel) and `submit-feedback` with no login**, so those need a separate design: for example, customer actions only while the order is `PENDING`, matched by order ID and phone number. Check `customer-app/src` for every endpoint it calls before locking anything. |
| B4 | `createOrder` trusts the client's prices, subtotal, total, `platformFee`, `status` and `orderType`, and never checks that items belong to the cart. Customers can create ₹0 "PAID" orders, and vendors can set `platformFee: 0`. | `orderController.js` `createOrder` (line 7) | Load the menu items by ID with the cart's `cartId`. Use the server's prices, reject out-of-stock items and missing IDs, and compute subtotal, platform fee (server constant, ₹2 today) and total on the server. Take the parcel charge from the cart's `parcelCharge` or a validated non-negative input. Customers always create `PENDING`; only an authenticated vendor or staff member may create `PAID`. Check the cart exists and is active and open. Apply the same rules to `updateOrder`. |
| B5 | The payment lock isn't enforced on the server. `cartPaymentLockMiddleware` is imported in `paymentRoutes.js` but never applied, so locked carts keep taking orders. | `middlewares/cartPaymentLock.js` | Decide the intended behaviour with the user, probably: block new orders (`create-order`) for a locked cart with a clear message. The middleware needs adapting, since it expects the cart owner as `req.user`; a cart-ID-based check is needed for customer orders. |
| B6 | `updateOrder` compares the new total against `paidAmount`, which nothing ever sets, so every edit of a paid order becomes "collect the full total" and goes back to `PENDING`. | `orderController.js` `updateOrder` (~251) | Set `paidAmount = totalPrice` in `markOrderPaid`, and when creating as `PAID`; clear it in `markOrderUnpaid`. Add `paidAmount` to the Order schema. Until then, use `existingOrder.status === 'PAID' ? existingOrder.totalPrice : 0`. |
| B7 | `update-menu-item` saves whatever fields the client sends (`$set: item`), including `cartId`. | same | Whitelist `name`, `price`, `isVeg`, `isInStock`, `imageUrl` and validate them (price ≥ 0, name ≥ 2 characters). |
| B8 | `toggle-cart-status` flips `isOpen` instead of setting it; the app's `isOpen` value is ignored. | `cartController.js` `toggleCartStatus` (~788) | Accept `{ isOpen }` in the body and set it, or keep the toggle and return the state. Update the app to send `isOpen`. |
| B9 | `update-cart` ignores `parcelCharge`, so the vendor's parcel charge edits never save. | `cartController.js` `updateCart` | Read and validate `parcelCharge` (number ≥ 0) and save it. |
| B10 | `get-all-carts` only returns carts the user owns, so staff accounts get an empty list and can't use the vendor app. | `getAllCarts` | For `role === 'staff'`, return the cart in `user.cartId`. Keep the "only your own ID" check. |
| B11 | `deleteOrder` (cancel) only notifies the `order:<id>` socket room, not the vendor's cart room, and allows cancelling any status, even `SERVED`. | `orderController.js` (~353, emit at ~379) | Also emit `order_cancelled` to the cart room. Allow cancel only for `PENDING`/`PAID` (customers: `PENDING` only). |
| B12 | The sales dashboard uses the server's time zone for day boundaries (`new Date(...).setHours`), so "today" is off by 5.5 hours on a UTC server. | `salesController.js` ~46 | Parse `startDate`/`endDate` as IST days, as `getOrdersForToday` and `getAllOrders` already do (`${date}T00:00:00+05:30`). Make the app send `YYYY-MM-DD` instead of `DateTime.toString()`. |
| B13 | An unused query loads every cart's orders in the date range on each sales request. | `salesController.js` ~52 | Delete it. |
| B14 | `markOrderPaid`, `markOrderUnpaid` and `serveOrderUndo` only notify the order room; `undoDeleteOrder` notifies no one. Other vendor devices don't update. | `orderController.js` | Emit `order_updated` to both the order room and the cart room in each. |
| B15 | Vendor-app login tokens never expire (`vendorLogin` signs without `expiresIn`). `change-pin` needs no login and only checks the current PIN, so a 4-digit PIN can be guessed with no attempt limit. | `vendorController.js` | Add `expiresIn` (e.g. 30 days) and handle 401 in the app (see F15). Make `change-pin` use `auth` and `req.user._id` instead of a body `id`. Add rate limiting (`express-rate-limit` is already installed) to `login`, `change-pin`, `send-otp` and `verify-otp`. |
| B16 | `send-otp`/`verify-otp` are open to anyone, so anyone can get a valid OTP for any vendor number and log in as them. | `vendorController.js` | Needs a decision: a staff login for the onboarding app, or a real SMS gateway. Rate limiting (B15) is the minimum. |

### Frontend (`ordering/`)

| # | Problem | Where | Proposed fix |
|---|---|---|---|
| F1 | The socket URL is hardcoded to `http://192.168.0.241:5000/`, so live orders never arrive in production. | `features/orders/providers/order_provider.dart:118` | Derive it from `ApiConstants.baseUrl` (strip `/api`). |
| F2 | The QR poster loads hardcoded cart `69db91dd3766ae8b43dd50c7` with no token. | `features/profile/presentation/qr_screen.dart:38` | Use `CartProvider.selectedCart!.id` and the auth token. Consider reusing the onboarding app's post-share flow. |
| F3 | Stock Control loads hardcoded cart `69db91dd…`, sends an empty token, and overwrites the shared menu list. | `features/cart/presentation/stock_screen.dart:33` | Use the selected cart and token. Pass the token to `toggleStock` (`menu_provider.dart` sends `null`). |
| F4 | Change PIN sends hardcoded user ID `69db91a03766ae8b43dd50bf` and an empty token. | `features/profile/presentation/change_pin_screen.dart:76-83` | Use `AuthProvider.user!['id']` and the token, with B15's backend change. Validate 4 digits client-side. |
| F5 | Staff accounts see no carts after login. | `switch_cart_screen.dart` and B10 | Fix B10. Show an empty state ("No carts assigned. Contact your vendor.") with logout. |
| F6 | New items ignore the in-stock toggle: the app sends key `"inStock"` but the model reads `"isInStock"`. | `features/orders/screens/add_new_item.dart:102` | Use `"isInStock"`. The backend `addMenuItem` must also read it. |
| F7 | Parcel charge edits never persist. | `cart_service.dart:95` and B9 | Fix B9. |
| F8 | Editing a paid order says to collect the full total and marks it unpaid. | B6 | Fix B6. Make the card banner and the sheet agree. |
| F9 | Editing an order silently drops items no longer on the menu, and re-prices every item at today's menu price. | `features/orders/screens/add_new_order.dart:120-130` | Keep removed items as fixed lines (from the order's own name and price), and keep each line's original price unless its quantity changes. Or block editing with a clear message. |
| F10 | The parcel charge field accepts negative or non-numeric input. If typed before any items are added, it's set to 0 while the field still shows the amount. | `add_new_order.dart:620-640`, `setParcelPrice` in `order_provider.dart` | Use digits only. Always store the typed value and apply it when items exist, and recompute when items change. |
| F11 | The welcome screen hangs if the payment-status check fails (`paymentStatus!` on null, snackbar only). | `features/cart/presentation/welcome_screen.dart:73` | Show an error with Retry and Switch Cart and Logout options. |
| F12 | When a payment is already verified, `checkout: null` crashes the cast and the vendor stays on the lock screen. | `features/payment/services/payment_service.dart:70`, `payment_lock_screen.dart` | Make `checkout` nullable. If `payment.status == VERIFIED` or `isLocked == false`, go to home. |
| F13 | The Edit Cart city dropdown fails to build for any city except "Bangalore". | `features/cart/presentation/edit_cart_screen.dart:52` | Add the cart's city to the list if missing, as the onboarding app does. |
| F14 | Customer cancellations don't reach the vendor. | `order_provider.dart` and B11 | Listen for `order_cancelled` (after B11) and update the order. |
| F15 | There's no handling for invalid or expired tokens, and the cart-switch screen has no logout. | `auth_service.dart`, `switch_cart_screen.dart` | On a 401 anywhere, clear the session and go to login. Add logout to the cart-switch screen. |
| F16 | Back after login returns to the login screen. | `features/auth/presentation/login_screen.dart:63` | Use `pushReplacement`. |
| F17 | New socket orders are appended at the bottom of a newest-first list. | `order_provider.dart:101` | Insert at index 0. |
| F18 | No error handling on the Profile open/closed switch (`profile_screen.dart:354`), Sales loading (`sales_screen.dart` `_loadSales`, `cart_provider.dart:116`) or Order Overview loading. | listed | Wrap them in try/catch and show `AppSnackBar`. Sales should show an error state. |
| F19 | One `_isLoading` flag in `OrderProvider` serves the orders list, the menu and the overview, so opening the new-order sheet or Overview shows a spinner on the Orders tab. | `order_provider.dart` | Use separate flags (`isOrdersLoading`, `isMenuLoading`, `isOverviewLoading`). |
| F20 | Edit Menu shows a stale snapshot after searching. | `features/orders/screens/edit_menu_screen.dart` | Derive the filtered list from `provider.menuItems` and the query on every build. |
| F21 | Failed stock toggles revert silently. | `menu_provider.dart` `toggleStock` | Show an error snackbar. |
| F22 | Language "SAVE" does nothing. | `features/profile/presentation/language_preferences_screen.dart:170` | Ask the user: implement it, or hide the screen until languages exist. |
| F23 | No timeouts on order, menu, sales and login requests. | `orders_service.dart`, `menu_service.dart`, `cart_service.dart` (`toggleCartStatus`, `fetchSales`), `auth_service.dart` | Add `.timeout(...)`: 10s, or 60s for uploads. |
| F24 | Edit Cart photos upload uncompressed, as `image/jpg`, with a 15-second timeout. | `cart_service.dart` `updateCartDetails` | Compress with `compressImage` first, send `image/jpeg`, and allow 60 seconds. |
| F25 | The cart must be re-picked on every launch, and SWITCH CART is disabled when the selection equals the current cart. | `splash_screen.dart`, `switch_cart_screen.dart` | Load the selected cart on start. Skip the picker when one is saved and still exists, or when there's only one cart. |
| F26 | The QR tab title reads "QR Orders Orders (n)", and the empty state always says "No active orders". | `orders_screen.dart:130`, `:520` | Fix the title switch, and give each tab its own empty message. |
| F27 | Add Item accepts a whitespace-only name and a non-numeric price. | `add_new_item.dart` | Trim before validating, and use a digits-only price field. A photo is currently required; ask the user whether it should be optional. |
| F28 | The Razorpay checkout theme is white (`#ffffff`). | `payment_lock_screen.dart:115` | Use the brand colour `#FE5200`. |
| F29 | Debug output in production code. | `staff_service.dart:28`, `payment_provider.dart:111`, `payment_service.dart:133`, `staff_management_screen.dart:83`, `order_model.dart` (`fromJson` logs every order), `qr_screen.dart:40` | Remove them. |
| F30 | Dead code. | `orders/screens/order_details.dart` (`OrderDetailsSheet`), `payment_success_screen.dart` (fully commented), `core/utils/launch_upi_intent.dart`, about ten unused `AppRoutes` entries | Delete it after confirming with the user. |
| F31 | The UI hasn't had the responsive and consistency pass. | whole app | Port the onboarding app's work using the checklist at the end of `docs/ui-guidelines.md`: `BaseScreen` short-window fallback, `AppButton` minimum height, `AppBackButton` `onPressed`, `AppFooter`, `InfoBox`, `formatPrice`, `AppSnackBar` theme colours, and the `test/responsive` harness with goldens. Also fix the copy-pasted error messages (e.g. "Failed to update order" on menu calls). |

## Suggested order

1. **B3, B2 and B1** (security), including the customer-app endpoint audit. B3 must be fixed before any backend deploy.
2. **F1–F4** (hardcoded URL and IDs). These are small and high-impact.
3. **B4 and B6, then F8, F9 and F10** (money).
4. **F5 and B10** (staff login).
5. **F11–F15** with B11 (stuck screens, cancellations, sessions).
6. **B5** after a decision on what the payment lock should block.
7. Everything else, then **F31** (UI pass) if the user wants it.

After each step: run the tests, check the vendor app with `flutter analyze` (its tests are only the default template; add real ones), let the user test on their phone via a local-testing-style branch for `ordering/`, then commit.
