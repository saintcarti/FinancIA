import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef6ff',
          100: '#d9eaff',
          200: '#bcd9ff',
          400: '#5b95f5',
          600: '#1f60d6',
          700: '#1a4eb0',
          900: '#0e2a66'
        },
        accent: {
          500: '#11b07a'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui']
      }
    }
  },
  plugins: []
};
export default config;
