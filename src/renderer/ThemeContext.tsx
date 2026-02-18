import { createContext, useContext } from 'react'
import { THEMES, Theme } from './themes'

export interface ThemeContextValue {
    themeId: string
    switchTheme: (id: string) => void
    themes: Theme[]
}

export const ThemeContext = createContext<ThemeContextValue>({
    themeId: 'lava',
    switchTheme: () => { },
    themes: THEMES,
})

export function useThemeContext(): ThemeContextValue {
    return useContext(ThemeContext)
}
