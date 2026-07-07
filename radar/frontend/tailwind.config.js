/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cinematic Cyber-Intelligence design system
        surface: {
          DEFAULT: '#0e141b',
          dim: '#0e141b',
          bright: '#343a41',
          lowest: '#090f15',
          low: '#161c23',
          base: '#1a2027',
          high: '#242a32',
          highest: '#2f353d',
        },
        primary: {
          DEFAULT: '#a1c9ff',
          container: '#3b9eff',
          fixed: '#d3e4ff',
          'fixed-dim': '#a1c9ff',
        },
        secondary: {
          DEFAULT: '#7dffa2',
          container: '#05e777',
        },
        tertiary: {
          DEFAULT: '#ffb3b2',
          container: '#ff696f',
        },
        critical: '#ff696f',
        warning: '#ffb300',
        success: '#7dffa2',
        on: {
          surface: '#dde3ed',
          'surface-variant': '#c0c7d4',
          primary: '#00325b',
        },
        outline: {
          DEFAULT: '#8a919e',
          variant: '#404752',
        },
        'surface-variant': '#2f353d',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        'display-lg': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-md': ['24px', { lineHeight: '32px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-sm': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'body-md': ['15px', { lineHeight: '22px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'mono-data': ['13px', { lineHeight: '20px', fontWeight: '500' }],
        'mono-label': ['11px', { lineHeight: '14px', fontWeight: '700', letterSpacing: '0.08em' }],
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
      },
      boxShadow: {
        glow: '0 0 15px rgba(59, 158, 255, 0.25)',
        'glow-sm': '0 0 8px rgba(59, 158, 255, 0.15)',
        'glow-critical': '0 0 12px rgba(255, 105, 111, 0.25)',
        'glow-success': '0 0 12px rgba(125, 255, 162, 0.25)',
      },
      backgroundImage: {
        'dot-grid': 'radial-gradient(circle, rgba(59, 158, 255, 0.05) 1px, transparent 1px)',
      },
      backgroundSize: {
        'dot-grid': '20px 20px',
      },
    },
  },
  plugins: [],
}
