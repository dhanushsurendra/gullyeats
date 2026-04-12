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
  deleteStaff
} = require('../controllers/cartController')
const auth = require('../middlewares/auth')

router.post('/create-basic-cart', auth, createBasicCart)

router.post('/update-location/:cartId', auth, updateCartLocation)

router.post('/create-menu/:cartId', auth, createMenuItems)

router.post('/generate-cart-qr/:cartId', auth, generateAndUploadQR)

router.post('/add-staff/:cartId', auth, addStaff)

router.post('/generate-url/:cartId', auth, getPresignedUploadUrl);

router.put('/update-cart-image/:cartId', auth, updateCartImage);

router.get('/get-all-carts/', auth, getAllCarts);

router.get('/get-all-staff/:cartId', auth, getAllStaff);

router.delete('/delete-staff/:staffId', auth, deleteStaff);

module.exports = router
