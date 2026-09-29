import Button from "../components/Button";
import phone from '../assets/phone.png'
import MenuHeader from "../components/MenuHeader";
import { useNavigate } from "react-router-dom";

export default function PhoneCapture() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-poppins flex flex-col">

      <MenuHeader 
      onBack={() => navigate(-1)}
        title="Get Order Updates"
        subtitle="No OTP. No spam. Only for this order."
      />

      <main className="flex-1 px-4 py-6">        
        <div className="flex justify-center mb-6">
          <img
            src={phone} 
            alt="order updates"
            className="w-52 object-contain"
          />
        </div>
        <div className="bg-white border border-grey-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-1 mb-3">
            <h3 className="text-body font-semibold">
              Add your phone number
            </h3>
            <span className="text-red-500">*</span>
          </div>
          <div className="flex items-center bg-grey-100 rounded-xl px-3 py-3 mb-4">
            <span className="text-grey-700 font-medium mr-2">
              +91
            </span>
            <input
              type="tel"
              placeholder="0000000000"
              className="bg-transparent outline-none w-full text-body"
            />
          </div>
          <div className="space-y-4 text-[12px] text-grey-500">
            <p>Faster updates if token is called</p>
            <p>Helps vendor confirm your order</p>
            <p>Useful if network disconnects</p>
          </div>
        </div>
      </main>
      <div className="px-4 pb-6">
        <Button className="w-full">SKIP</Button>

        <p className="text-center text-[11px] text-grey-500 mt-3">
          🔒 Your number is used only for this order and never saved.
        </p>
      </div>
    </div>
  );
}