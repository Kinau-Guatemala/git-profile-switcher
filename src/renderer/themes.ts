/* ============================================================
   GIT CONFIG SWITCHER — Color Palettes
   Each theme overrides the CSS custom properties defined in retro.css.
   All palettes maintain the retro 8-bit pixel aesthetic.
   ============================================================ */

export interface Theme {
    id: string
    /** Short display label shown in the UI swatch tooltip */
    label: string
    /** Accent hex used to draw the swatch button itself */
    accent: string
    /** CSS variable overrides applied to :root */
    vars: Record<string, string>
}

export const THEMES: Theme[] = [
    /* ── 1. LAVA (default) ── Red / Orange / Gold on dark navy ── */
    {
        id: 'lava',
        label: 'LAVA',
        accent: '#FF6500',
        vars: {
            '--c-red': '#C40C0C',
            '--c-orange': '#FF6500',
            '--c-gold': '#CC561E',
            '--c-warm': '#F6CE71',
            '--c-warm-light': '#FFF5DC',
            '--c-dark': '#1A1A2E',
            '--c-darker': '#0F0F1A',
            '--c-surface': '#2A2A40',
            '--c-surface-2': '#353550',
            '--c-text': '#F6CE71',
            '--c-text-muted': '#B8A060',
            '--c-border': '#CC561E',
        },
    },

    /* ── 2. MATRIX ── Bright green on deep black-green ── */
    {
        id: 'matrix',
        label: 'MATRIX',
        accent: '#00FF41',
        vars: {
            '--c-red': '#008F11',
            '--c-orange': '#00FF41',
            '--c-gold': '#00C832',
            '--c-warm': '#9BF0A0',
            '--c-warm-light': '#E0FFE3',
            '--c-dark': '#0A1A0A',
            '--c-darker': '#050E05',
            '--c-surface': '#0E2010',
            '--c-surface-2': '#152818',
            '--c-text': '#9BF0A0',
            '--c-text-muted': '#5A9060',
            '--c-border': '#00C832',
        },
    },

    /* ── 3. SYNTHWAVE ── Hot-pink / purple on near-black indigo ── */
    {
        id: 'synthwave',
        label: 'SYNTHWAVE',
        accent: '#FF2D87',
        vars: {
            '--c-red': '#B026FF',
            '--c-orange': '#FF2D87',
            '--c-gold': '#CC00AA',
            '--c-warm': '#FFD166',
            '--c-warm-light': '#FFF0C0',
            '--c-dark': '#0F0822',
            '--c-darker': '#080414',
            '--c-surface': '#1A0E30',
            '--c-surface-2': '#251540',
            '--c-text': '#FFD166',
            '--c-text-muted': '#A08050',
            '--c-border': '#CC00AA',
        },
    },

    /* ── 4. GLACIER ── Cyan / steel blue on deep midnight blue ── */
    {
        id: 'glacier',
        label: 'GLACIER',
        accent: '#00BFFF',
        vars: {
            '--c-red': '#0055CC',
            '--c-orange': '#00BFFF',
            '--c-gold': '#007ACC',
            '--c-warm': '#B0E0FF',
            '--c-warm-light': '#E0F4FF',
            '--c-dark': '#080F1A',
            '--c-darker': '#050A12',
            '--c-surface': '#0E1A2E',
            '--c-surface-2': '#152238',
            '--c-text': '#B0E0FF',
            '--c-text-muted': '#607090',
            '--c-border': '#007ACC',
        },
    },

    /* ── 5. AMBER ── Old phosphor monitor on near-black brown ── */
    {
        id: 'amber',
        label: 'AMBER',
        accent: '#FFB000',
        vars: {
            '--c-red': '#CC4400',
            '--c-orange': '#FFB000',
            '--c-gold': '#CC7700',
            '--c-warm': '#FFE08A',
            '--c-warm-light': '#FFF8DC',
            '--c-dark': '#1A1200',
            '--c-darker': '#0F0A00',
            '--c-surface': '#2A1E00',
            '--c-surface-2': '#352700',
            '--c-text': '#FFE08A',
            '--c-text-muted': '#B89040',
            '--c-border': '#CC7700',
        },
    },
]

export const DEFAULT_THEME_ID = 'lava'
