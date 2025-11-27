/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Poppins', 'sans-serif'],
            },
            colors: {
                primary: '#A88BEB',
                secondary: '#F8C0FF',
                accent: '#F9F871',
                background: '#F7F8FA',
                textPrimary: '#1E1E1E',
                textSecondary: '#6B6B6B',
            }
        },
    },
    plugins: [],
}
