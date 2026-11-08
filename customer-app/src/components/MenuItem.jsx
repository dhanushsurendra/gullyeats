import defaultFoodImage from '../assets/default-food.png'
import { rupees } from '../utils/format'
import { Stepper, VegMark } from './ui'

export function MenuItem({ item, quantity, onAdd, onRemove, canOrder = true }) {
  const available = item.isInStock !== false

  return (
    <article
      className={`flex gap-4 rounded-card bg-surface p-3 shadow-card transition ${
        available ? '' : 'opacity-60'
      }`}
    >
      <div className='min-w-0 flex-1 py-1'>
        <VegMark isVeg={item.isVeg} />
        <h3 className='mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug'>{item.name}</h3>
        <p className='mt-1 text-sm font-medium text-grey-700'>{rupees(item.price)}</p>
        {!available && <p className='mt-1 text-xs font-medium text-danger'>Sold out for now</p>}
      </div>

      <div className='relative flex w-28 shrink-0 flex-col items-center'>
        <img
          src={item.imageUrl || defaultFoodImage}
          alt=''
          loading='lazy'
          className={`h-24 w-28 rounded-2xl bg-grey-100 object-cover ${available ? '' : 'grayscale'}`}
          onError={(e) => {
            e.currentTarget.onerror = null
            e.currentTarget.src = defaultFoodImage
          }}
        />
        {available && canOrder && (
          // z-10: the dark theme dims the placeholder photo with a filter, which lifts it above the button.
          <div className='relative z-10 -mt-5'>
            <Stepper
              name={item.name}
              quantity={quantity}
              onAdd={() => onAdd(item._id)}
              onRemove={() => onRemove(item._id)}
            />
          </div>
        )}
      </div>
    </article>
  )
}
