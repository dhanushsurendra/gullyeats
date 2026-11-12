const express = require('express')
const router = express.Router()
const {
  createOrder,
  deleteOrder,
  getOrdersForToday,
  getAllOrders,
  getOrder,
  serveOrder,
  serveOrderUndo,
  markOrderPaid,
  markOrderUnpaid,
  undoDeleteOrder,
  updateOrder,
  getTruthLine,
  submitOrderFeedback,
  setPreparing,
  getQueue,
  getPushKey,
  savePushSubscription,
} = require('../controllers/orderController')
const auth = require('../middlewares/auth')
const optionalAuth = require('../middlewares/optionalAuth')
const cartPaymentLock = require('../middlewares/cartPaymentLock')

// The customer web app calls create, update, delete, get order, truth line
// and feedback without logging in; the controllers apply customer rules
// unless the caller manages the order's cart.

router.post('/create-order', optionalAuth, cartPaymentLock, createOrder)

// Customer browser pushes (before '/:cartId', which would catch push-key).
router.get('/push-key', getPushKey)
router.post('/push-subscribe/:orderId', savePushSubscription)

router.delete('/delete-order/:orderId', optionalAuth, deleteOrder)

router.get('/orders-today/:cartId', auth, getOrdersForToday)

router.get('/orders/:cartId', auth, getAllOrders)

router.put('/update-order/:orderId', optionalAuth, updateOrder)

router.get('/get-truth-line', getTruthLine)

router.get('/queue/:orderId', getQueue)

router.put('/preparing/:orderId', auth, setPreparing)

router.get('/:cartId', auth, getAllOrders)

router.get('/order/:orderId', optionalAuth, getOrder)

router.put('/serve-order/:orderId', auth, serveOrder)

router.put('/serve-order-undo/:orderId', auth, serveOrderUndo)

router.put('/submit-feedback/:orderNumber', submitOrderFeedback)

router.put('/mark-order-paid/:orderId', auth, markOrderPaid)

router.put('/mark-order-unpaid/:orderId', auth, markOrderUnpaid)

router.put('/delete-order-undo/:orderId', auth, undoDeleteOrder)

module.exports = router
