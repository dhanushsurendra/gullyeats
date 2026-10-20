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
  submitOrderFeedback
} = require('../controllers/orderController')

router.post('/create-order', createOrder)

router.delete('/delete-order/:orderId', deleteOrder)

router.get('/orders-today/:cartId', getOrdersForToday)

router.get('/orders/:cartId', getAllOrders)

router.put('/update-order/:orderId', updateOrder)

router.get('/get-truth-line', getTruthLine)

router.get('/:cartId', getAllOrders)

router.get('/order/:orderId', getOrder)

router.put('/serve-order/:orderId', serveOrder)

router.put('/serve-order-undo/:orderId', serveOrderUndo)

router.put('/submit-feedback/:orderNumber', submitOrderFeedback)

router.put('/mark-order-paid/:orderId', markOrderPaid)

router.put('/mark-order-unpaid/:orderId', markOrderUnpaid)

router.put('/delete-order-undo/:orderId', undoDeleteOrder)

module.exports = router
