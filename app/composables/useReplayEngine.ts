export type ReplayCandle = {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

const REPLAY_STEP_MS = 500

export function useReplayEngine() {
  const isActive = ref(false)
  const cursorIndex = ref(0)
  const totalBars = ref(0)
  const isPlaying = ref(false)

  let playTimer: ReturnType<typeof setInterval> | undefined

  const visibleCount = computed(() => {
    if (!isActive.value || totalBars.value === 0) {
      return totalBars.value
    }
    return Math.min(cursorIndex.value + 1, totalBars.value)
  })

  const atStart = computed(() => cursorIndex.value <= 0)
  const atEnd = computed(() => totalBars.value === 0 || cursorIndex.value >= totalBars.value - 1)

  function setTotalBars(count: number) {
    totalBars.value = count
    if (cursorIndex.value >= count) {
      cursorIndex.value = Math.max(0, count - 1)
    }
  }

  function pause() {
    isPlaying.value = false
    if (playTimer) {
      clearInterval(playTimer)
      playTimer = undefined
    }
  }

  function toggleMode() {
    if (isActive.value) {
      pause()
      isActive.value = false
      return
    }

    isActive.value = true
    if (totalBars.value > 0 && cursorIndex.value >= totalBars.value) {
      cursorIndex.value = totalBars.value - 1
    }
  }

  function stepForward() {
    if (!isActive.value || atEnd.value) {
      pause()
      return
    }
    cursorIndex.value += 1
    if (cursorIndex.value >= totalBars.value - 1) {
      pause()
    }
  }

  function stepBack() {
    if (!isActive.value || atStart.value) return
    cursorIndex.value -= 1
  }

  function play() {
    if (!isActive.value || atEnd.value) return
    isPlaying.value = true
    if (playTimer) clearInterval(playTimer)
    playTimer = setInterval(() => {
      if (cursorIndex.value >= totalBars.value - 1) {
        pause()
        return
      }
      cursorIndex.value += 1
    }, REPLAY_STEP_MS)
  }

  function resetCursor() {
    pause()
    cursorIndex.value = 0
  }

  onBeforeUnmount(() => {
    pause()
  })

  return {
    isActive,
    cursorIndex,
    totalBars,
    isPlaying,
    visibleCount,
    atStart,
    atEnd,
    setTotalBars,
    toggleMode,
    stepForward,
    stepBack,
    play,
    pause,
    resetCursor,
  }
}

export type ReplayEngine = ReturnType<typeof useReplayEngine>
