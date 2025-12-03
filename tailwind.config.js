/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",    // 針對您放在最外層的檔案
    "./src/**/*.{js,ts,jsx,tsx}" // 針對 src 資料夾內的檔案 (預防萬一)
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
