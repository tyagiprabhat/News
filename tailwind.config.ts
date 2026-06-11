import type { Config } from 'tailwindcss';

// Semantic color tokens resolve to CSS variables defined per-theme in
// globals.css (Éditorial Noir = default/dark, Swiss Mono = light).
// Variables are RGB channel triplets so Tailwind's <alpha-value> works.
function token(name: string) {
  return `rgb(var(${name}) / <alpha-value>)`;
}

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: token('--canvas'),
        surface: token('--surface'),
        surface2: token('--surface-2'),
        hairline: token('--hairline'),
        ink: token('--ink'),
        'ink-muted': token('--ink-muted'),
        accent: token('--accent'),
        'accent-hover': token('--accent-hover'),
        'accent-ink': token('--accent-ink'),
        breaking: token('--breaking'),
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgb(0 0 0 / 0.12), 0 8px 24px rgb(0 0 0 / 0.18)',
      },
      zIndex: {
        60: '60',
      },
    },
  },
  plugins: [],
};

export default config;
