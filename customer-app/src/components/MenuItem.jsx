import defaultFoodImage from '../assets/default-food.png'

export function MenuItem({
  item,
  quantity,
  onAdd,
  onRemove,
  disabled = false,
}) {
  const outOfStock = !item.isInStock || disabled

  return (
    <div
      className={`
        group
        flex items-center gap-4
        border border-grey-200
        rounded-xl
        p-3
        bg-white
        transition-all
        duration-200
        ease-out
        ${
          outOfStock
            ? 'opacity-50'
            : 'hover:border-primary/30 hover:shadow-md active:scale-[0.99]'
        }
      `}
    >
      {/* ==========================================
          FOOD IMAGE
      ========================================== */}

      <div className='w-20 h-20 shrink-0 overflow-hidden rounded-xl bg-grey-100'>
        <img
          src={item.imageUrl || defaultFoodImage}
          alt={item.name}
          className='
            w-full h-full
            object-cover
            transition-transform
            duration-300
            ease-out
            group-hover:scale-105
          '
          onError={(e) => {
            e.currentTarget.onerror = null
            e.currentTarget.src = defaultFoodImage
          }}
        />
      </div>

      {/* ==========================================
          ITEM DETAILS
      ========================================== */}

      <div className='flex-1 min-w-0 self-stretch flex flex-col justify-center'>
        {/* Item name */}
        <div className='flex items-start gap-2'>
          <span
            className={`
              w-2 h-2
              shrink-0
              rounded-full
              mt-1.5
              ${item.isVeg ? 'bg-green-500' : 'bg-red-500'}
            `}
          />

          <p className='text-sm font-semibold text-black leading-snug line-clamp-2'>
            {item.name}
          </p>
        </div>

        {/* Price */}
        <p className='text-sm font-semibold text-grey-700 mt-1'>
          ₹{item.price}
        </p>
        
        {/* Out of stock */}
        {outOfStock && !disabled && (
          <p className='text-caption text-red-500 mt-1'>Out of stock</p>
        )}
      </div>

      {/* ==========================================
          ACTION
      ========================================== */}

      {!outOfStock && (
        <div className='shrink-0'>
          {quantity === 0 ? (
            /* ADD */
            <button
              onClick={() => onAdd(item._id)}
              className='
                flex items-center justify-center
                gap-1
                border border-primary
                text-primary
                bg-white
                px-4 py-2
                rounded-pill
                font-semibold
                text-sm
                transition-all
                duration-200
                hover:bg-primary
                hover:text-white
                active:scale-95
              '
            >
              <span className='text-base leading-none'>+</span>
              ADD
            </button>
          ) : (
            <div
              className='
    flex items-center
    gap-1
    border border-primary/30
    bg-white
    rounded-pill
    px-1
    py-1
    shadow-sm
  '
            >
              {/* Minus */}
              <button
                onClick={() => onRemove(item._id)}
                className='
      w-7 h-7
      rounded-full
      flex items-center justify-center
      text-primary
      text-base
      font-semibold
      leading-none
      transition-all
      duration-150
      hover:bg-lightOrange
      active:scale-90
    '
              >
                −
              </button>

              {/* Quantity */}
              <span
                className='
      min-w-7
      text-center
      text-sm
      font-semibold
      text-black
    '
              >
                {quantity}
              </span>

              {/* Plus */}
              <button
                onClick={() => onAdd(item._id)}
                className='
                  w-7 h-7
                  rounded-full
                  flex items-center justify-center
                  text-primary
                  text-base
                  font-semibold
                  leading-none
                  transition-all
                  duration-150
                  hover:bg-lightOrange
                  active:scale-90
                '
              >
                +
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
