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
  getCart
} = require('../controllers/cartController')
const { getSalesDashboard } = require('../controllers/salesController')
const auth = require('../middlewares/auth')

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

router.get('/get-all-carts/:userId', getAllCarts)

router.get('/get-cart/:cartId', getCart)

router.get('/get-all-staff/:cartId', auth, getAllStaff)

router.delete('/delete-staff/:staffId', auth, deleteStaff)

router.get('/sales-insights/:cartId', getSalesDashboard)

router.get('/get-menu-items/:cartId', getMenuItems)

router.put('/update-menu-item/:cartId', updateMenuItem)

router.delete('/delete-menu-item/:cartId/:itemId', deleteMenuItem)

router.post('/add-menu-item/:cartId', addMenuItem)

router.get('/get-qr-details/:cartId', getQRDetails)

router.patch('/update-stock/:cartId/:itemId', updateMenuItemStock)

router.put('/toggle-cart-status/:cartId', toggleCartStatus)

module.exports = router
