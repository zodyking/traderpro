const OPEN_KEY = 'cmd-palette-open'

export function useCommandPalette() {
  const open = useState<boolean>(OPEN_KEY, () => false)

  function show() {
    open.value = true
  }

  function hide() {
    open.value = false
  }

  function toggle() {
    open.value = !open.value
  }

  return { open: readonly(open), show, hide, toggle }
}
