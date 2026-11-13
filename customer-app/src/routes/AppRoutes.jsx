import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import Welcome from '../pages/Welcome'
import Menu from '../pages/Menu'
import NotFound from '../pages/NotFound'
import CustomerCart from '../pages/CustomerCart'
import OrderToken from '../pages/OrderToken'
import OrderServed from '../pages/OrderServed'
import ThankYou from '../pages/ThankYou'
import Splash from '../pages/Splash'
import OrderCancelled from '../pages/OrderCancelled'
import RootRedirect from '../components/RootRedirect'
import Confessions from '../pages/Confessions'
import ConfessionNew from '../pages/ConfessionNew'
import ConfessionDetail from '../pages/ConfessionDetail'
import Play from '../pages/Play'
import HowToPlay from '../pages/HowToPlay'
import PhotoCredits from '../pages/PhotoCredits'

// `:orderNumber` holds the order's _id, not its token number.
export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<RootRedirect />} />
        <Route path='/c/:cartId' element={<Splash />} />
        <Route path='/c/:cartId/welcome' element={<Welcome />} />
        <Route path='/c/:cartId/menu' element={<Menu />} />
        <Route path='/c/:cartId/cart' element={<CustomerCart />} />
        {/* The phone step is now part of the cart page. */}
        <Route path='/c/:cartId/phone' element={<Navigate to='../cart' relative='path' replace />} />
        <Route path='/c/:cartId/order/:orderNumber' element={<OrderToken />} />
        <Route path='/c/:cartId/order/:orderNumber/add' element={<Menu />} />
        <Route path='/c/:cartId/order/:orderNumber/served' element={<OrderServed />} />
        <Route path='/c/:cartId/order/:orderNumber/cancelled' element={<OrderCancelled />} />
        <Route path='/c/:cartId/order/:orderNumber/thank-you' element={<ThankYou />} />
        <Route path='/c/:cartId/order/:orderNumber/play/:game' element={<Play />} />
        <Route path='/play/how-to-play' element={<HowToPlay />} />
        <Route path='/photo-credits' element={<PhotoCredits />} />
        {/* GullyPulse: one feed for every cart, so no post is tied to a cart. */}
        <Route path='/confessions' element={<Confessions />} />
        <Route path='/confessions/new' element={<ConfessionNew />} />
        <Route path='/confessions/:publicId' element={<ConfessionDetail />} />
        <Route path='*' element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
