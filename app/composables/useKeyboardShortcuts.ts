export function useKeyboardShortcuts() {
  const palette = useCommandPalette()
  const router = useRouter()
  const route = useRoute()

  function onKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement
    const inInput = target.tagName === 'INPUT'
      || target.tagName === 'TEXTAREA'
      || target.isContentEditable

    // Cmd+K / Ctrl+K — toggle command palette (always fires)
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      palette.toggle()
      return
    }

    // Letter shortcuts only fire when focus is not in a form field
    if (inInput) return

    switch (e.key) {
      case 'b':
      case 'B':
        e.preventDefault()
        router.push('/app/backtest')
        break
      case 'j':
      case 'J':
        e.preventDefault()
        router.push('/app/journal')
        break
    }

    // 1-4 set chart timeframe, but only on the chart page
    if (route.path.startsWith('/app/chart')) {
      const timeframes = ['5m', '1h', '4h', '1d'] as const
      const idx = Number.parseInt(e.key, 10) - 1
      if (idx >= 0 && idx <= 3) {
        e.preventDefault()
        const workspace = useWorkspaceStore()
        workspace.chartInterval = timeframes[idx]!
        workspace.saveWorkspace()
      }
    }
  }

  onMounted(() => {
    if (import.meta.client) {
      window.addEventListener('keydown', onKeyDown)
    }
  })

  onUnmounted(() => {
    if (import.meta.client) {
      window.removeEventListener('keydown', onKeyDown)
    }
  })
}
