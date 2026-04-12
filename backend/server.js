require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const errorHandler = require('./middlewares/errorHandler');
const vendorRoutes = require('./routes/vendorRoutes');
const cartRoutes = require('./routes/cartRoutes');

const app = express();

app.use(cors());
app.use(express.json()); 

app.use('/api/vendors', vendorRoutes);
app.use('/api/carts', cartRoutes);

app.use(errorHandler);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("GullyEats DB Connected"))
  .catch(err => console.log("DB Connection Error: ", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));