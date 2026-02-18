import { useThemeContext } from '../ThemeContext'

const THEME_DESCRIPTIONS: Record<string, string> = {
    lava: 'The classic. Dark navy depths with a fiery red-orange accent and warm gold text.',
    matrix: 'Monochrome green on near-black. Feels like staring into a terminal from 1999.',
    synthwave: 'Hot pink and purple neon on deep indigo. Pure 80s arcade energy.',
    glacier: 'Cool cyan and steel blue on midnight. Clean, cold, precise.',
    amber: 'Old phosphor-monitor warmth. Like coding on a desk from 1983.',
}

export default function Settings() {
    const { themeId, switchTheme, themes } = useThemeContext()

    return (
        <div>
            <h1 className="page-title">▸ SETTINGS</h1>

            <div className="pixel-card pixel-card--highlight mb-md">
                <h2 className="section-title">◈ Colour Palette</h2>
                <p className="settings-hint">Choose the visual theme for the application. Your preference is saved automatically.</p>

                <div className="palette-grid">
                    {themes.map(t => (
                        <button
                            key={t.id}
                            className={`palette-card${themeId === t.id ? ' palette-card--active' : ''}`}
                            onClick={() => switchTheme(t.id)}
                            aria-label={`Switch to ${t.label} theme`}
                        >
                            <div className={`palette-card__swatch theme-swatch--${t.id}`} />
                            <div className="palette-card__body">
                                <span className="palette-card__name">{t.label}</span>
                                <span className="palette-card__desc">{THEME_DESCRIPTIONS[t.id]}</span>
                            </div>
                            {themeId === t.id && (
                                <span className="palette-card__badge">▶ ACTIVE</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
