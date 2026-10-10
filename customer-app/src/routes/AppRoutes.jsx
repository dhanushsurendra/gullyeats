import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Welcome from '../pages/Welcome'
import Menu from '../pages/Menu'
import NotFound from '../pages/NotFound'
import CustomerCart from '../pages/CustomerCart'
import PhoneCapture from '../pages/PhoneCapture'
import OrderToken from '../pages/OrderToken'
import OrderServed from '../pages/OrderServed'
import ThankYou from '../pages/ThankYou'
import Splash from '../pages/Splash'
import OrderCancelled from '../pages/OrderCancelled'
import RootRedirect from '../components/RootRedirect'

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<RootRedirect />} />
        <Route path='/c/:cartId' element={<Splash />} />
        <Route path='/c/:cartId/welcome' element={<Welcome />} />
        <Route path='/c/:cartId/menu' element={<Menu />} />
        <Route path='/c/:cartId/cart' element={<CustomerCart />} />
        <Route path='/c/:cartId/phone' element={<PhoneCapture />} />
        <Route path='/c/:cartId/order/:orderNumber' element={<OrderToken />} />
        <Route path='/c/:cartId/order/:orderNumber/add' element={<Menu />} />
        <Route
          path='/c/:cartId/order/:orderNumber/served'
          element={<OrderServed />}
        />
        <Route
          path='/c/:cartId/order/:orderNumber/cancelled'
          element={<OrderCancelled />}
        />
        <Route
          path='/c/:cartId/order/:orderNumber/thank-you'
          element={<ThankYou />}
        />
        <Route path='*' element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
