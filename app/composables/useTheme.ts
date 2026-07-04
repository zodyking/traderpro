export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'ae_theme'

export function useTheme() {
  const theme = useState<ThemeMode>('theme', () => 'dark')

  function applyTheme(mode: ThemeMode) {
    theme.value = mode
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, mode)
      document.documentElement.classList.toggle('light', mode === 'light')
      document.documentElement.classList.toggle('dark', mode === 'dark')
    }
  }

  function initTheme() {
    if (!import.meta.client) return

    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    const mode = stored === 'light' ? 'light' : 'dark'
    applyTheme(mode)
  }

  function toggleTheme() {
    applyTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  function setTheme(mode: ThemeMode) {
    applyTheme(mode)
  }

  return {
    theme,
    initTheme,
    toggleTheme,
    setTheme,
  }
}
