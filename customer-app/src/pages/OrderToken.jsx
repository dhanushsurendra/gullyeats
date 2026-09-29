import React from 'react'
import { RiArrowLeftSLine } from 'react-icons/ri'

export default function OrderToken() {
  const orderItems = [
    { name: 'Pani Puri', qty: 2, price: 40 },
    { name: 'Dahi Puri', qty: 1, price: 50 },
  ]

  const total = orderItems.reduce((acc, item) => acc + item.qty * item.price, 0)

  return (
    <div className='min-h-screen bg-[#FFF8F4] font-poppins flex flex-col relative overflow-hidden'>
      {/* Decorative Background Blobs - These give it that "Premium" feel */}
      <div className='absolute top-[-10%] right-[-10%] w-64 h-64 bg-orange-100 rounded-full blur-3xl opacity-50' />
      <div className='absolute bottom-[20%] left-[-10%] w-48 h-48 bg-orange-50 rounded-full blur-2xl opacity-60' />

      {/* HEADER */}
      <header className='px-4 pt-6 pb-2 relative z-10'>
        <div className='flex items-center justify-between'>
          <button className='p-2.5 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-orange-50 active:scale-90 transition-transform'>
            <RiArrowLeftSLine size={24} className='text-gray-700' />
          </button>

          <div className='text-center'>
            <span className='text-primary text-[10px] font-black uppercase tracking-[0.2em]'>
              Gully<span className='text-gray-900'>Eats</span>
            </span>
            <h2 className='text-[20px] font-black text-gray-900 leading-tight'>
              Raju Momos
            </h2>
            <p className='text-[11px] text-gray-400 font-medium'>
              BTM 2nd Stage • Bengaluru
            </p>
          </div>

          <div className='w-12' />
        </div>

        {/* Currently Serving Badge */}
        <div className='flex justify-center mt-6'>
          <div className='bg-white/90 backdrop-blur-sm border border-orange-100 px-6 py-2.5 text-center rounded-2xl shadow-sm'>
            <h3 className='text-primary text-[10px] font-bold uppercase tracking-wider mb-0.5'>
              Currently Serving
            </h3>
            <span className='font-black text-2xl text-gray-900'>#62</span>
          </div>
        </div>
      </header>

      <main className='flex-1 px-5 py-6 space-y-5 relative z-10'>
        {/* TOKEN CARD */}
        <div className='bg-white rounded-[2.5rem] p-8 text-center shadow-[0_10px_40px_rgba(255,92,0,0.06)] border border-orange-50 relative'>
          <p className='text-[11px] text-gray-400 font-bold uppercase tracking-[0.15em] mb-3'>
            Your Token
          </p>
          <h1 className='text-[72px] font-black text-gray-900 leading-none tracking-tighter'>
            #67
          </h1>
          <div className='mt-4 inline-block bg-orange-50 px-4 py-1.5 rounded-full'>
            <p className='text-primary text-[11px] font-bold'>
              Show this token when called
            </p>
          </div>

          {/* Decorative Dot Connector */}
          <div className='absolute -bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center'>
            <div className='w-px h-4 bg-orange-200' />
            <div className='w-2.5 h-2.5 bg-primary rounded-full shadow-lg shadow-primary/40' />
          </div>
        </div>
        <div className='h-2' /> {/* Spacing for the dot */}
        {/* ORDER SUMMARY */}
        <div className='bg-white rounded-4xl p-6 shadow-sm border border-gray-50'>
          <h3 className='font-black text-gray-900 text-md mb-4 uppercase tracking-tight'>
            Order Summary
          </h3>

          <div className='space-y-3'>
            {orderItems.map((item, idx) => (
              <div key={idx} className='flex justify-between items-center'>
                <span className='text-gray-500 font-medium'>
                  {item.name}{' '}
                  <span className='text-gray-900 font-bold ml-1'>
                    ×{item.qty}
                  </span>
                </span>
                <span className='font-bold text-gray-900'>
                  ₹{item.qty * item.price}
                </span>
              </div>
            ))}
          </div>

          <div className='flex justify-between items-center pt-4 border-t border-dashed border-gray-200 mt-4'>
            <span className='font-black text-lg'>Total:</span>
            <span className='text-2xl font-black text-primary'>₹{total}</span>
          </div>
        </div>
        {/* STATUS BAR */}
        <div className='bg-white border-2 border-orange-100 rounded-3xl p-5 shadow-sm relative overflow-hidden'>
          <div className='flex justify-between items-start mb-2'>
            <div>
              <p className='text-primary text-xs font-black uppercase tracking-wider'>
                Status: Waiting
              </p>
              <p className='text-[12px] text-gray-500 font-medium'>
                Stay nearby. Vendor will call your token.
              </p>
            </div>
          </div>
          <div className='h-1.5 bg-gray-100 mt-4 rounded-full w-full overflow-hidden'>
            <div className='h-full bg-primary rounded-full w-1/2 animate-pulse' />
          </div>
        </div>
        {/* QUOTE CARD */}
        <div className='bg-[#FFF1E9] rounded-2xl p-4 text-center border border-orange-100'>
          <p className='text-[9px] text-orange-400 font-black uppercase tracking-[0.2em] mb-1'>
            Truth Line
          </p>
          <p className='text-[13px] text-orange-800 font-medium italic leading-relaxed px-4'>
            "You're not just waiting for food... <br /> you're pausing from
            everything."
          </p>
        </div>
      </main>

      {/* FOOTER ACTIONS */}
      <footer className='px-5 pb-10 space-y-3 relative z-10'>
        <button className='w-full bg-primary hover:bg-orange-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-orange-200 transition-all active:scale-[0.98]'>
          ADD MORE ITEMS
        </button>

        <button className='w-full bg-white border-2 border-red-50 text-red-400 py-4 rounded-2xl font-bold text-sm hover:bg-red-50 transition-colors active:scale-[0.98]'>
          DELETE ORDER
        </button>

        <div className='text-center pt-2'>
          <p className='text-[10px] text-gray-400 font-medium uppercase tracking-tighter'>
            No online payment. Pay only at the counter.
          </p>
          <p className='text-[12px] text-primary font-black mt-1'>
            You're officially in the queue now.
          </p>
        </div>
      </footer>
    </div>
  )
}
