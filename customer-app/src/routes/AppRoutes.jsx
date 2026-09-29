import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Welcome from '../pages/Welcome'
import Menu from '../pages/Menu'
import NotFound from '../pages/NotFound'
import CustomerCart from '../pages/CustomerCart'
import PhoneCapture from '../pages/PhoneCapture'
import OrderToken from '../pages/OrderToken'
import GetOrderUpdates from '../pages/GetOrderUpdates'
import OrderStatus from '../pages/OrderStatus'
import CounterPayment from '../pages/CounterPayment'
import OrderServed from '../pages/OrderServed'
import ThankYou from '../pages/ThankYou'
import NewOrder from '../pages/NewOrder'

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Welcome />} />
        <Route path='/menu/:cartId' element={<Menu />} />
        <Route path='/customer-cart/:id' element={<CustomerCart />} />
        <Route path='/phone-capture/:id' element={<PhoneCapture />} />
        <Route path='/order-token/' element={<OrderToken />} />
        <Route path='/get-updates/' element={<GetOrderUpdates />} />
        <Route path='/order-status/' element={<OrderStatus />} />
        <Route path='/order/:token/add' element={<Menu />} />
        <Route path='/order/:token/payment' element={<CounterPayment />} />
        <Route path='/order/:token/served' element={<OrderServed />} />
        <Route path='/order/:token/thank-you' element={<ThankYou />} />
        <Route path='/new-order' element={<NewOrder />} />
        <Route path='*' element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
