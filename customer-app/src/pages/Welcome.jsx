import Button from '../components/Button'
import Card from '../components/Card'
import InfoCard from '../components/InfoCard'
import illustration from '../assets/welcome.png'
import { useNavigate } from 'react-router-dom'

export default function Welcome() {
  const navigate = useNavigate()

  const handleStart = () => {
    const cartId = 'demo123'
    navigate(`/menu/${cartId}`)
  }

  return (
    <div className='min-h-screen bg-white flex justify-center font-poppins'>
      <div className='w-full max-w-md px-16px py-24px'>
        <div className='text-center mt-16px'>
          <p className='text-primary text-caption font-semibold tracking-wider uppercase'>
            GULLYEATS
          </p>
          <h1 className='text-h1 text-black mt-8px font-bold'>Welcome</h1>

          <p className='text-body text-grey-500 mt-4px'>
            Order directly. No app download needed.
          </p>
        </div>

        <div className='mt-24px'>
          <InfoCard
            name='Raju Momos'
            location='BTM 2nd Stage, Bengaluru'
            onLiveCart={() => console.log('Live Cart')}
          />
        </div>

        <div className='flex justify-center my-6'>
          <img
            src={illustration}
            alt='food illustration'
            className='w-56 object-contain'
          />
        </div>

        <div className='mt-32px'>
          <Button onClick={handleStart} className='w-full'>
            START ORDER
          </Button>

          <p className='text-center text-caption text-grey-400 mt-8px'>
            Takes less than 10 seconds.
          </p>
        </div>

        <Card className='mt-24px bg-grey-100 p-16px rounded-xl'>
          <p className='text-h3 text-black mb-12px uppercase'>HOW IT WORKS</p>

          <ul className='space-y-8px text-body text-grey-500 list-disc list-inside'>
            <li>No login required</li>
            <li>Token generated instantly</li>
            <li>Pay only at the counter</li>
          </ul>
        </Card>

        {/* Footer */}
        <div className='my-24px text-center'>
          <p className='text-primary text-caption font-medium'>
            ✨ You're about to unlock this cart's menu
          </p>
          <p className='text-caption text-grey-400 mt-4px'>
            By continuing, you agree to fair use rules.
          </p>
        </div>
      </div>
    </div>
  )
}
