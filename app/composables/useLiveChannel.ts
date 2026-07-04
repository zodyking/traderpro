import { useWebSocket } from '@vueuse/core'

type LiveMessage = {
  type?: string
  channel?: string
  payload?: unknown
  status?: string
  message?: string
}

export function useLiveChannel() {
  const status = ref<'connected' | 'reconnecting' | 'disconnected'>('disconnected')
  const subscriptions = ref<Set<string>>(new Set())
  const handlers = new Map<string, Set<(payload: unknown) => void>>()

  const protocol = import.meta.client && window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = import.meta.client ? window.location.host : 'localhost:3000'
  const url = `${protocol}://${host}/ws/live`

  const { open, close, send } = useWebSocket(url, {
    immediate: false,
    autoReconnect: {
      retries: 10,
      delay: 1000,
      onFailed() {
        status.value = 'disconnected'
      },
    },
    onConnected() {
      status.value = 'connected'
      for (const channel of subscriptions.value) {
        send(JSON.stringify({ op: 'sub', channel }))
      }
    },
    onDisconnected() {
      status.value = 'reconnecting'
    },
    onMessage(_ws, event) {
      const data = JSON.parse(event.data as string) as LiveMessage
      if (data.channel && data.payload !== undefined) {
        const channelHandlers = handlers.get(data.channel)
        channelHandlers?.forEach((handler) => handler(data.payload))
      }
    },
  })

  function connect() {
    if (import.meta.client) open()
  }

  function disconnect() {
    close()
    status.value = 'disconnected'
  }

  function subscribe(channel: string, handler: (payload: unknown) => void) {
    subscriptions.value.add(channel)
    if (!handlers.has(channel)) handlers.set(channel, new Set())
    handlers.get(channel)!.add(handler)

    if (status.value === 'connected') {
      send(JSON.stringify({ op: 'sub', channel }))
    }

    return () => {
      handlers.get(channel)?.delete(handler)
      if (handlers.get(channel)?.size === 0) {
        handlers.delete(channel)
        subscriptions.value.delete(channel)
        send(JSON.stringify({ op: 'unsub', channel }))
      }
    }
  }

  return {
    status,
    connect,
    disconnect,
    subscribe,
  }
}
