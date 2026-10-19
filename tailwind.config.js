/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0b0b0b',
        coal: '#171717',
        panel: '#141414',
        line: '#262626',
        bone: '#ededed',
        mute: '#8f8f8f',
        brand: '#6fb300',
        acid: '#b6ff2e',
      },
      fontFamily: {
        display: ['Unbounded', 'sans-serif'],
        sans: ['Manrope', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'acid-hard': '4px 4px 0 0 #6fb300',
        'bone-hard': '4px 4px 0 0 #b6ff2e',
        'acid-glow': '0 0 25px rgba(182, 255, 46, 0.45)',
        'acid-glow-lg': '0 0 50px rgba(182, 255, 46, 0.7)',
        'stamp-glow': '0 0 30px rgba(182, 255, 46, 0.5)',
      },
      keyframes: {
        stampImpact: {
          '0%': { transform: 'scale(2.8) rotate(-15deg)', opacity: '0' },
          '60%': { transform: 'scale(0.92) rotate(2deg)', opacity: '1' },
          '80%': { transform: 'scale(1.05) rotate(-1deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        pulseAcid: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 20px rgba(182, 255, 46, 0.4)' },
          '50%': { opacity: '0.85', boxShadow: '0 0 40px rgba(182, 255, 46, 0.8)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        }
      },
      animation: {
        'stamp-impact': 'stampImpact 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'pulse-acid': 'pulseAcid 2.5s infinite ease-in-out',
        'marquee': 'marquee 25s linear infinite',
        'marquee-slow': 'marquee 45s linear infinite',
      }
    },
  },
  plugins: [],
}
