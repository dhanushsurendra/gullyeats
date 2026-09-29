import { FiPlus, FiMinus } from 'react-icons/fi'

export const MenuItem = ({ item, onAdd, onRemove, quantity }) => (
  <div className='p-16px bg-white border border-grey-200 rounded-xl flex justify-between 
  items-center shadow-sm mb-12px'>
    <div className='flex-1'>
      <DietIndicator isVeg={item.isVeg} />

      <h3 className='text-h3 text-black mt-1 font-semibold'>{item.name}</h3>
      <p className='text-h3 text-black mt-1 font-bold'>₹{item.price}</p>
    </div>

    <div className='ml-12px'>
      {quantity === 0 ? (
        <button
          onClick={() => onAdd(item.id)}
          className='bg-light-orange text-primary border border-primary/30 px-6 py-2 
          rounded-pill font-bold text-caption active:scale-95 transition-all shadow-sm'
        >
          + ADD
        </button>
      ) : (
        <div className='flex items-center bg-white border border-primary rounded-pill p-1 
        shadow-sm'>
          <button
            onClick={() => onRemove(item.id)}
            className='w-8 h-8 flex items-center justify-center text-grey-500 
            active:scale-75 transition'
          >
            <FiMinus className='text-gray-400' size={14} strokeWidth={4} />
          </button>
          <span className='w-6 text-center text-primary font-bold text-body'>
            {quantity}
          </span>
          <button
            onClick={() => onAdd(item.id)}
            className='w-8 h-8 flex items-center justify-center bg-primary text-white 
            rounded-full active:scale-75 transition shadow-md'
          >
            <FiPlus size={14} strokeWidth={4} />
          </button>
        </div>
      )}
    </div>
  </div>
)

const DietIndicator = ({ isVeg }) => (
  <div className='flex items-center gap-1.5 mt-1'>
    <div
      className={`
      w-3.5 h-3.5 border-2 flex items-center justify-center rounded-sm
      ${isVeg ? 'border-green-600' : 'border-red-600'}
    `}
    >
      <div
        className={`
        w-1.5 h-1.5 rounded-full
        ${isVeg ? 'bg-green-600' : 'bg-red-600'}
      `}
      />
    </div>
    <span className='text-[11px] font-medium text-grey-500 uppercase tracking-tight'>
      {isVeg ? 'Veg' : 'Non-Veg'}
    </span>
  </div>
)
