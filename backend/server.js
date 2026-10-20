require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const { Server } = require('socket.io')
const http = require('http')
const errorHandler = require('./middlewares/errorHandler')
const vendorRoutes = require('./routes/vendorRoutes')
const cartRoutes = require('./routes/cartRoutes')
const orderRoutes = require('./routes/orderRoutes')
const paymentRoutes = require('./routes/paymentRoutes')
const adminRoutes = require('./routes/adminRoutes')
const { razorpayWebhook } = require('./controllers/paymentController')
const cookieParser = require('cookie-parser')

const app = express()
const server = http.createServer(app)

app.use(cookieParser())

const allowedOrigins = (process.env.FRONTEND_URL_CUSTOMER || process.env.FRONTEND_URL_ADMIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean)

const corsOptions = {
  origin(origin, callback) {
    // Native Flutter requests and server-to-server requests
    // commonly have no Origin header.
    if (!origin) return callback(null, true)

    if (allowedOrigins.includes(origin.replace(/\/+$/, ''))) {
      return callback(null, true)
    }

    return callback(new Error('Origin not allowed by CORS'))
  },
  credentials: true,
}

app.use(cors(corsOptions))

const io = new Server(server, {
  cors: {
    ...corsOptions,
    methods: ['GET', 'POST'],
  },
})

app.use((req, res, next) => {
  req.io = io
  next()
})

/*
 * IMPORTANT: this MUST be registered before app.use(express.json()) below.
 * express.raw() gives razorpayWebhook the exact raw request bytes, which is
 * what its HMAC signature check is computed over. If express.json() runs
 * first, the body arrives already parsed and every webhook call will fail
 * signature verification.
 *
 * Path here matches the /api prefix used by every other route — so your
 * Razorpay dashboard "Webhook URL" should be:
 *   https://<your-ngrok-or-domain>/api/payments/webhook/razorpay
 */
app.post(
  '/api/payments/webhook/razorpay',
  express.raw({ type: 'application/json' }),
  razorpayWebhook,
)

app.use(express.json({ limit: '10kb' }))

app.get('/', (req, res) => {
  res.send('GullyEats API is running 🚀')
})

app.use('/api/vendors', vendorRoutes)
app.use('/api/carts', cartRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/admin', adminRoutes)

app.use(errorHandler)

async function startServer() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not configured')
  }

  await mongoose.connect(process.env.MONGO_URI)
  console.log('GullyEats DB Connected')

  const PORT = process.env.PORT || 5000

  server.listen(PORT, () => {
    console.log(
      `Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`,
    )
  })
}

startServer().catch((err) => {
  console.error('Server startup failed:', err)
  process.exit(1)
})

io.on('connection', (socket) => {
  console.log('Vendor connected:', socket.id)

  socket.on('join_order', (orderNumber) => {
    socket.join(`order:${orderNumber}`)
    console.log(`Customer joined room: ${orderNumber}`)
  })

  socket.on('join_vendor', (cartId) => {
    socket.join(cartId.toString())
    console.log(`Vendor joined room: ${cartId}`)
  })

  socket.on('disconnect', () => {
    console.log('Vendor disconnected:', socket.id)
  })
})

