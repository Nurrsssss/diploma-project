/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      backgroundImage: {
        'custom-gradient':
          'linear-gradient(135deg, #115E59 0%, #0D9488 38%, #14B8A6 68%, #06B6D4 100%)',
        'hero-mesh':
          'radial-gradient(ellipse 85% 55% at 50% -25%, rgba(13, 148, 136, 0.28), transparent), radial-gradient(ellipse 55% 45% at 100% 5%, rgba(6, 182, 212, 0.18), transparent), radial-gradient(ellipse 50% 35% at 0% 100%, rgba(15, 118, 110, 0.12), transparent)',
        'step-circle': 'linear-gradient(180deg, #5EEAD4 0%, #0D9488 100%)',
        'text-gradient-dark':
          'linear-gradient(117deg, #042F2E 12%, #115E59 40%, #0E7490 72%)',
      },
      screens: {
        xs: '480px',
      },
      colors: {
        primary: '#0D9488',
        primaryDark: '#115E59',
        primaryLight: '#14B8A6',
        accent: '#06B6D4',
        secondary: '#0891B2',
        darkPurple: '#0F766E',
        lightBg: '#F0FDFA',
        preDesign: '#ECFEFF',
        surface: '#FFFFFF',
        muted: '#64748B',
        pageBg: '#F4FBF9',
      },
      boxShadow: {
        soft:
          '0 2px 8px -2px rgba(15, 23, 42, 0.06), 0 8px 24px -8px rgba(13, 148, 136, 0.18)',
        card:
          '0 1px 2px rgba(15, 23, 42, 0.05), 0 12px 32px -8px rgba(13, 148, 136, 0.22)',
      },
      fontFamily: {
        outfit: ['var(--font-outfit)'],
        ibm: ['var(--font-ibm)'],
      },
    },
  },
  plugins: [],
}
