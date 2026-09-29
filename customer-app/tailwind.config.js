/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#FE5200", 
        black: "#000000",
        white: "#FFFFFF",
        grey: {
          600: "#4B5563",
          500: "#6B7280",
          400: "#757575",
          300: "#E5E5E5",
          200: "#EEEEEE",
          100: "#F5F5F5",
        },
        lightOrange: "#FFF0E5",
        lightRed: "#FEF2F2",
        success: "#16A34A",
        successAlt: "#039855",
        error: "#DC2626",
      },

      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
      },

      fontSize: {
        h1: ["1.5rem", { lineHeight: "2rem", fontWeight: "600" }],
        h2: ["1.125rem", { lineHeight: "1.625rem", fontWeight: "600" }], 
        h3: ["1rem", { lineHeight: "1.5rem", fontWeight: "600" }],       
        body: ["0.875rem", { lineHeight: "1.375rem", fontWeight: "400" }], 
        caption: ["0.75rem", { lineHeight: "1.125rem", fontWeight: "400" }], 
      },

      borderRadius: {
        'xl': '16px',   
        'pill': '30px',
      },

      spacing: {
        '4px': '4px',
        '8px': '8px',
        '12px': '12px',
        '16px': '16px',
        '24px': '24px',
      },
    },
  },
  plugins: [],
}