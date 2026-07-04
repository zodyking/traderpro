import type { Peer } from 'crossws'
import type Redis from 'ioredis'
import { useRedis, useRedisSubscriber } from '../../utils/redis'

type WsMessage =
  | { op: 'sub', channel: string }
  | { op: 'unsub', channel: string }
  | { op: 'ping' }

type PeerState = {
  channels: Set<string>
  redis?: Redis
}

const peerState = new WeakMap<Peer, PeerState>()

function getState(peer: Peer): PeerState {
  let state = peerState.get(peer)
  if (!state) {
    state = { channels: new Set() }
    peerState.set(peer, state)
  }
  return state
}

function parseMessage(raw: string): WsMessage | null {
  try {
    return JSON.parse(raw) as WsMessage
  }
  catch {
    return null
  }
}

async function replayLatest(channel: string, peer: Peer) {
  try {
    const redis = useRedis()
    const parts = channel.split('.')
    if (parts[0] === 'market' && parts[1] === 'candle' && parts.length === 4) {
      const [, , symbolId, interval] = parts
      const latest = await redis.get(`candle:latest:${symbolId}:${interval}`)
      if (latest) {
        peer.send(JSON.stringify({ channel, payload: JSON.parse(latest) }))
      }
      return
    }

    if (parts[0] === 'backtest' && parts[2] === 'progress' && parts.length === 3) {
      const runId = parts[1]
      const latest = await redis.get(`backtest:progress:${runId}`)
      if (latest) {
        peer.send(JSON.stringify({ channel, payload: JSON.parse(latest) }))
      }
    }

    if (parts[0] === 'alerts' && parts[1] === 'user' && parts.length === 3) {
      const recent = await redis.lrange(`alerts.user.${parts[2]}:recent`, 0, 19)
      for (const entry of recent.reverse()) {
        peer.send(JSON.stringify({ channel, payload: JSON.parse(entry) }))
      }
    }
  }
  catch {
    // ignore replay failures
  }
}

export default defineWebSocketHandler({
  async open(peer) {
    getState(peer)
    peer.send(JSON.stringify({ type: 'ack', status: 'connected' }))
  },

  async message(peer, message) {
    const text = message.text()
    const payload = parseMessage(text)
    if (!payload) {
      peer.send(JSON.stringify({ type: 'error', message: 'Invalid JSON message' }))
      return
    }

    const state = getState(peer)

    if (payload.op === 'ping') {
      peer.send(JSON.stringify({ type: 'pong' }))
      return
    }

    if (payload.op === 'sub') {
      state.channels.add(payload.channel)

      if (!state.redis) {
        try {
          const subscriber = useRedisSubscriber()
          state.redis = subscriber
          await subscriber.connect()
          await subscriber.subscribe(...state.channels)

          subscriber.on('message', (channel: string, data: string) => {
            if (state.channels.has(channel)) {
              peer.send(JSON.stringify({ channel, payload: JSON.parse(data) }))
            }
          })
        }
        catch {
          peer.send(JSON.stringify({ type: 'error', message: 'Redis subscription unavailable' }))
        }
      }
      else {
        await state.redis.subscribe(payload.channel)
      }

      await replayLatest(payload.channel, peer)
      peer.send(JSON.stringify({ type: 'subscribed', channel: payload.channel }))
      return
    }

    if (payload.op === 'unsub') {
      state.channels.delete(payload.channel)
      if (state.redis) {
        await state.redis.unsubscribe(payload.channel)
      }
      peer.send(JSON.stringify({ type: 'unsubscribed', channel: payload.channel }))
    }
  },

  async close(peer) {
    const state = peerState.get(peer)
    if (state?.redis) {
      await state.redis.quit()
    }
    peerState.delete(peer)
  },
})
