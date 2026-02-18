import { useState, useEffect } from 'react'
import { THEMES, DEFAULT_THEME_ID, Theme } from './themes'

const STORAGE_KEY = 'git-switcher-theme'

/** Writes all CSS custom-property overrides directly onto :root */
function applyTheme(theme: Theme): void {
    const root = document.documentElement
    for (const [prop, value] of Object.entries(theme.vars)) {
        root.style.setProperty(prop, value)
    }
}

/**
 * Manages the active colour palette.
 * The selected theme id is persisted in localStorage so it survives reloads.
 */
export function useTheme() {
    const [themeId, setThemeId] = useState<string>(() => {
        return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID
    })

    // Apply whenever themeId changes (including initial mount)
    useEffect(() => {
        const theme = THEMES.find(t => t.id === themeId) ?? THEMES[0]
        applyTheme(theme)
    }, [themeId])

    const switchTheme = (id: string) => {
        localStorage.setItem(STORAGE_KEY, id)
        setThemeId(id)
    }

    return { themeId, switchTheme, themes: THEMES }
}
