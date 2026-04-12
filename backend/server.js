require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan'); 
const compression = require('compression'); 
const errorHandler = require('./middlewares/errorHandler');
const vendorRoutes = require('./routes/vendorRoutes');
const cartRoutes = require('./routes/cartRoutes');

const app = express();

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined')); 
}

app.use(compression()); 

app.use(helmet()); 
app.use(mongoSanitize());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: "Too many requests from this IP, please try again later."
});
app.use('/api/', limiter);

app.use(cors());
app.use(express.json({ limit: '10kb' })); 

app.use('/api/vendors', vendorRoutes);
app.use('/api/carts', cartRoutes);

app.use(errorHandler);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("GullyEats DB Connected"))
  .catch(err => console.log("DB Connection Error: ", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`));