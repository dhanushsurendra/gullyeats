const express = require('express')
const router = express.Router()
const {
  createBasicCart,
  updateCartLocation,
  createMenuItems,
  generateAndUploadQR,
  addStaff,
  getPresignedUploadUrl,
  updateCartImage,
  getAllCarts,
  getAllStaff,
  deleteStaff,
  getMenuItems,
  getPhotoCredits,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getQRDetails,
  updateMenuItemStock,
  toggleCartStatus,
  getPresignedUploadUrlForMenuItem,
  getPresignedUploadUrlForExistingMenuItem,
  updateMenuItemImage,
  switchStaffCart,
  updateCart,
  getCart,
  getFoodNames,
} = require('../controllers/cartController')
const { getSalesDashboard } = require('../controllers/salesController')
const asyncHandler = require('../utils/asyncHandler')
const { discoverCarts, RADIUS_KM } = require('../utils/discoverCarts')
const auth = require('../middlewares/auth')
const { createAreaAlert, getAreaAlerts, confirmAreaAlert } = require('../controllers/areaAlertController')

router.post('/create-basic-cart', auth, createBasicCart)

router.post('/update-location/:cartId', auth, updateCartLocation)

router.post('/create-menu/:cartId', auth, createMenuItems)

router.post('/generate-cart-qr/:cartId', auth, generateAndUploadQR)

router.post('/add-staff/:cartId', auth, addStaff)

router.put('/switch-staff-cart/:staffId', auth, switchStaffCart)

router.post('/generate-cart-image-url/:cartId', auth, getPresignedUploadUrl)

router.post(
  '/generate-menu-image-url/:cartId/',
  auth,
  getPresignedUploadUrlForMenuItem,
)

router.post(
  '/generate-menu-image-url/:cartId/:menuItemId',
  auth,
  getPresignedUploadUrlForExistingMenuItem,
)

router.put('/update-cart/:cartId', auth, updateCart)

router.put('/update-cart-image/:cartId', auth, updateCartImage)

router.get('/get-all-carts/:userId', auth, getAllCarts)

router.get('/get-cart/:cartId', getCart)

router.get('/get-all-staff/:cartId', auth, getAllStaff)

router.delete('/delete-staff/:staffId', auth, deleteStaff)

router.get('/sales-insights/:cartId', auth, getSalesDashboard)

router.get('/get-menu-items/:cartId', getMenuItems)

router.get('/food-names', auth, getFoodNames)

router.get('/photo-credits', getPhotoCredits)

// Customer home page: nearby carts and/or a search. Public, like get-cart.
router.get('/discover', asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  const here =
    req.query.lat !== undefined && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && Number.isFinite(lat + lng)
      ? [lat, lng]
      : null
  res.json({ success: true, data: await discoverCarts({ here, q: req.query.q }), radiusKm: RADIUS_KM })
}))

router.put('/update-menu-item/:cartId', auth, updateMenuItem)

router.delete('/delete-menu-item/:cartId/:itemId', auth, deleteMenuItem)

router.post('/add-menu-item/:cartId', auth, addMenuItem)

router.get('/get-qr-details/:cartId', getQRDetails)

router.patch('/update-stock/:cartId/:itemId', auth, updateMenuItemStock)

router.put('/toggle-cart-status/:cartId', auth, toggleCartStatus)

// Area alerts between nearby carts. Not behind the fee lock: a locked cart
// still needs to hear about an eviction drive.
router.post('/area-alerts/:cartId', auth, createAreaAlert)
router.get('/area-alerts/:cartId', auth, getAreaAlerts)
router.post('/area-alerts/:cartId/confirm/:alertId', auth, confirmAreaAlert)

module.exports = router
