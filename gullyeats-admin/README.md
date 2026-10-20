# GullyEats Super Admin (React + Vite + Tailwind + Redux Toolkit, plain JS)

## 1. Backend (one-time)
Your existing routes are per-cart / per-owner; none list the whole platform. Copy `backend-admin/` into your backend:

- `controllers/adminController.js` → `controllers/`
- `routes/adminRoutes.js` → `routes/`

Then in `app.js`:
```js
app.use('/api/admin', require('./routes/adminRoutes'))
```
Make sure CORS allows `http://localhost:5173`. The admin routes are **unauthenticated for now** (matching the dummy JWT). Protect them before going live.

## 2. Frontend
```bash
npm install
cp .env.example .env     # adjust paths if your mounts differ
npm run dev              # http://localhost:5173
```
Login: `admin@gullyeats.com` / `CoolStud*123` (client-side check, dummy token; see `src/services/api.js`).

## Notes
- `VITE_CART_PATH` must match where your cart router is mounted; it is used for the existing `GET /sales-insights/:cartId` (restaurant drawer).
- Cart coordinates are read as `location.coordinates = [lat, lng]` (how your `updateCartLocation` stores them; GeoJSON normally uses [lng, lat]).
- Cart status: LIVE = `isOpen`; PAUSED = closed and `isActive === false`; ATTENTION = has a PENDING platform-fee payment; otherwise OFFLINE.
- Order status mapping: PENDING = awaiting payment, PAID = preparing, SERVED, CANCELLED.
- GMV = sum of `totalPrice` for non-cancelled orders. Platform revenue = `platformFee`. `Payment` documents are owners paying GullyEats those fees.
- Orders have no star rating, so the feedback card shows feedback count and rate instead of an average rating.

