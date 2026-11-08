# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

GullyEats is a QR-based ordering platform for street food carts. It's a monorepo of five independent projects with no shared tooling or root package. Run commands from inside each project directory.

| Dir | Stack | Purpose |
|---|---|---|
| `backend/` | Node (CommonJS), Express 5, Mongoose, Socket.IO | Single API for all clients |
| `frontend/` | Flutter (package `gullyeats`) | **Onboarding** app, used by GullyEats staff (not vendors) to onboard a vendor: OTP login for the vendor's number, create or resume a cart, photo, location, menu, staff, QR poster |
| `ordering/` | Flutter (package `ordering`) | **Vendor ordering** app: live orders, serve/paid toggles, sales charts, platform-fee payment via Razorpay |
| `customer-app/` | React 19 + Vite 8 + Tailwind 4 + Redux Toolkit (React Compiler enabled) | Customer web app opened from a cart's QR code (`/c/:cartId/...`). Dark theme by default, switchable from every top bar: use the colour tokens in `src/index.css` (`bg-surface` for cards, `bg-ink` for dark chips), never `bg-white`/`bg-grey-900`, so both themes work |
| `gullyeats-admin/` | React 18 + Vite 5 + Tailwind 3 + Redux Toolkit, Recharts, Leaflet | Super-admin dashboard |

## Commands

```bash
# backend (needs backend/.env with MONGO_URI, JWT_SECRET, AWS_*, BUCKET_NAME, RAZORPAY_*, FRONTEND_URL_CUSTOMER, FRONTEND_URL_ADMIN)
npm run dev        # nodemon server.js, default port 5000
npm start

# customer-app / gullyeats-admin
npm run dev
npm run build
npm run lint       # customer-app only (ESLint); the admin app has no linter

# frontend / ordering (Flutter)
flutter pub get
flutter run
flutter analyze
flutter test
flutter test test/responsive/screens_responsive_test.dart --plain-name "signup"   # one screen
flutter test test/responsive --update-goldens   # after an intended visual change
flutter run -t tool/screen_gallery.dart          # every screen with sample data, on a device
```

`frontend/test/responsive/` renders every onboarding screen at 6 phone/tablet sizes, at 1.3× and 1.5× system text size, in landscape and with the keyboard open, and fails on any layout error (overflow, unbounded constraints). For the small phone, standard phone, tablet and small phone at 1.5× text, it also compares each screen with a reference image in `test/responsive/goldens/`. A failed comparison writes diff images to `test/responsive/failures/`, which is gitignored. The goldens were generated on Windows, and font rendering differs on macOS and Linux, so regenerate them with `--update-goldens` before comparing on another OS. Add `--dart-define=SHOTS=<dir>` to also save a PNG for every screen and size. Add new screens to the `screens` list there. `ordering/test/responsive/` is the same harness for the vendor app: a fake backend (`fake_backend.dart`) answers its requests with sample data, it also renders Kannada and Tamil (using Windows' Nirmala UI font as the phone's fallback), and it stubs the Razorpay plugin. The web apps have no real tests. The backend `npm test` runs `node:test` with stubbed models.

Vendor-app text lives in `ordering/lib/l10n/app_{en,hi,kn,ta}.arb`; run `flutter gen-l10n` after editing them. Screens read it as `context.l10n.<key>`, and code without a `BuildContext` uses `LanguageProvider.strings`. Compare order statuses with the server's codes (`"SERVED"`), never with translated labels.

The vendor app has a light and a dark theme (dark by default, switch on Profile, `ThemeProvider` saves it). `AppColors` neutrals (`background`, `surface`, `black` = main text, `greyNNN`, `lightOrange`) are getters that follow `AppColors.dark`, so they can't sit inside `const` widgets. `AppColors.white` is always white: use it only for text/icons on orange or coloured fills, and `surface`/`background` for cards and pages. The goldens are light; `--dart-define=DARK=true --dart-define=SHOTS=<dir>` renders every screen dark to look at.

`tool/screen_gallery.dart` (debug builds only) opens each screen with sample data and never logs in. Switch screens with `adb shell "run-as com.example.gullyeats sh -c 'echo <index> > files/gallery_index'"`.

Flutter work uses the official `dart-flutter` Claude Code plugin (`claude plugin marketplace add flutter/agent-plugins`, then `claude plugin install dart-flutter@dart-flutter`). It provides the Flutter skills (for example `flutter-build-responsive-layout`, `flutter-fix-layout-issues` and `flutter-add-widget-test`) and the Dart/Flutter MCP server (`dart mcp-server`). The MCP server can launch the app, read runtime errors, inspect the widget tree and hot reload.

## API base URLs (hardcoded)

Every client points at the deployed backend by default, so check these before testing locally:
- `frontend/lib/core/constants/api_constants.dart` and `ordering/lib/core/constants/api_constants.dart` (`baseUrl`)
- `customer-app/src/constants/api.js` (`API_BASE_URL`, overridable with `VITE_API_BASE_URL`; the Socket.IO URL comes from stripping `/api` off it)
- `gullyeats-admin/.env` (`VITE_API_URL`, `VITE_ADMIN_PATH`, `VITE_CART_PATH`; see `.env.example`)

## Backend architecture

- `server.js` wires everything together. Routes are mounted under `/api/{vendors,carts,orders,payments,admin}` and are implemented as `routes/*Routes.js` → `controllers/*Controller.js`. Handlers are wrapped in `utils/asyncHandler`. To return an error, set `res.status(code)` and then `throw new Error(msg)`; `middlewares/errorHandler` turns that into `{ success: false, message }`.
- **The Razorpay webhook must stay registered before `express.json()`.** It needs `express.raw` so the HMAC signature check runs on the raw request bytes. The JSON body limit is `10kb`.
- CORS uses an allowlist built from `FRONTEND_URL_CUSTOMER` and `FRONTEND_URL_ADMIN` (comma-separated) plus `http://localhost:5173`. Requests with no `Origin` header (the Flutter apps) are allowed.
- Auth: vendors and staff log in with phone + OTP + PIN (`vendorRoutes`). `middlewares/auth.js` reads `Authorization: Bearer <jwt>` and sets `req.user = { _id, role }` (role is one of `vendor | staff | admin`). Many cart, menu and order routes are deliberately **unauthenticated**, since the customer web app calls them without logging in. Admin login sets a `token` cookie. Cart routes check access with `utils/cartAccess.js`: `findManagedCart` lets in the owner, an admin or the cart's staff (orders, stock, open/close, fee lock status); `findOwnedCart` refuses staff (menu edits, cart details, sales, fee bills and payment, staff logins). The vendor app hides those screens for staff and shows a Handover tab (today's collected / to collect / refunded) in place of Sales.
- Real-time: `req.io` is attached to every request. Vendor clients join the room `<cartId>` (`join_vendor`). Customers join `order:<id>` (`join_order`). Controllers emit `new_order_received`, `order_updated` and `order_cancelled` to these rooms.
- Billing lock: carts owe GullyEats a daily `platformFee` that is summed from their orders over IST calendar days (`utils/cartPaymentLock.js`, 26h grace period). `middlewares/cartPaymentLock.js` returns 403 with the lock status when a cart has unpaid fees. `Payment` documents are owner→platform fee payments, not customer payments.
- Uploads: images and QR codes go to S3 through presigned URLs (`utils/s3Client.js`). Order numbers come from the `Counter` model (`utils/getNextOrderNumber.js`).
- Menu item names: `name` is English. `names.{hi,kn,ta}` holds the same name written in each script, by sound, never translated. `utils/transliterate.js` fills it on save. It looks the name up in `FoodName` first, a list of about 1,200 common items with checked spellings (`data/food_names.json`, loaded with `node scripts/seed-food-names.js`; reseeding skips entries marked `reviewed`), then in the `Transliteration` cache. Any other name is spelled word by word, from `data/food_words.json` (common words, corrected by hand where Google is wrong) and Google Input Tools (unofficial and free, no key) for words not in it. A failed request never blocks a save. Orders copy `names` like `name`. The vendor app shows `displayName`, suggests names from `GET /api/carts/food-names` as the vendor types on Add Item (the onboarding app's Add Menu screen does the same, in English), and lets vendors correct the spelling in the edit dialog. To fill names on old items, run `node scripts/transliterate-menus.js`.
- GullyPulse (anonymous confessions, `/api/confessions`, customer pages under `/confessions`): a customer proves they ordered with `X-Gully-Order: <orderId>.<accessKey>`. The key is a random secret that `createOrder` returns only to customer QR orders (`Order.accessKey`, `select: false`). The customer app keeps it in `cart.orders`. Likes, reports and bans key on `authorKey`, an HMAC of the order's phone (or the order id when no phone was given). Public responses go only through `toPublic`/`commentToPublic` and never carry ids that identify the poster. `utils/wordFilter.js` + `data/blocked_words.json` decide BLOCK / REVIEW / ALLOW. Four unique reports hide an item (status `REPORTED`). Admins act through `/api/admin/moderation/*` (Moderation page), and every action is logged in `AdminAction`. The feed sorts by a stored `hot` score (`utils/confessionScore.js`); update pipelines need `{ updatePipeline: true }` in Mongoose 9.
- GullyPlay (games `nebula` = Nebula Rush and `reflex` = Zero Reflex; `/api/games/:game/{scores,leaderboard}`; customer page `/c/:cartId/order/:orderNumber/play/:game`, picked from the token page): same `X-Gully-Order` identity as GullyPulse, one best score per player per game per IST day (`GameScore`), players shown only by an alias made from `authorKey`. Each game's rules are a pure module in `customer-app/src/game/<id>.js` (seeded by the IST date so everyone gets the same round; `node --test "src/game/*.test.js"`), described for the shared arcade page (`pages/Play.jsx`: loop, pause, food-ready banner, results, leaderboard) in `game/catalog.js`. To add a game: a module with `LIMITS`, a catalog entry, and a `GAMES` entry in `backend/controllers/gameController.js` whose `limits` equal the module's `LIMITS` (a backend test compares them). Scores come from the phone, so the server only refuses impossible ones: never tie rewards to the boards.
- `Cart.location.coordinates` is stored as `[lat, lng]`, not the GeoJSON `[lng, lat]` order, even though there is a `2dsphere` index on it.

## Flutter apps

Both apps use the same structure: `lib/core/` (constants, routes, theme, widgets, utils) and `lib/features/<feature>/{models,providers,services,screens|presentation,widgets}`. State management uses `provider` with `ChangeNotifier`s that are registered in `main.dart`. Services make HTTP calls using `ApiConstants`. Tokens are stored in `shared_preferences`. Both apps are locked to portrait mode and use the Poppins font. In `frontend/`, screens are built on `core/widgets/base_screen.dart`, which caps content at 500px wide. With `expandToFullHeight: true` the child gets a bounded height, so it must scroll itself (a `ListView` or a `SingleChildScrollView`). Step screens put their main buttons in `AppFooter`, passed as `bottomNavigationBar`. **UI rules for both Flutter apps (tokens, layout, feedback, responsive and async rules, and a checklist for porting them to `ordering/`) are in `docs/ui-guidelines.md`.** Only `ordering` uses `socket_io_client` (in `OrderProvider`) and `razorpay_flutter`.

## Admin dashboard domain mapping (from gullyeats-admin/README.md)

- Cart status: LIVE = `isOpen`. PAUSED = closed and `isActive === false`. ATTENTION = the cart has a PENDING platform-fee `Payment`. Anything else is OFFLINE.
- Order status: PENDING = awaiting payment, PAID = preparing, SERVED, CANCELLED. "Preparing" is not a status: the vendor app can set `Order.preparingAt` on a PAID order (`PUT /api/orders/preparing/:orderId`), which billing and sales ignore. The customer token page shows Placed → Paid → Preparing → Served and the cart's queue from `GET /api/orders/queue/:orderId`: paid, unserved orders from the last 12h in payment order, with only token numbers of others. Every order change emits `queue_changed` (no payload) to the Socket.IO room `queue:<cartId>`, which customers join with `join_queue`.
- GMV = the sum of `totalPrice` over paid orders (`PAID` or `SERVED`). Platform revenue = their `platformFee`. Unpaid and cancelled orders count toward order totals only. The vendor sales report and fee billing use the same rule.
- Customers can rate a served order 1–5 stars (`Order.rating`) and/or leave text (`Order.feedback`) through `PUT /api/orders/submit-feedback/:orderId`. The admin feedback list shows both; insights views still show counts and rates. The customer app keeps a summary of every order placed on the phone (`cart.orders` in redux-persist), so the menu and welcome pages link back to open orders after the back button, a closed tab or a re-scan.
