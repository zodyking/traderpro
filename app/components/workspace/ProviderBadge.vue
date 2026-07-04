<script setup lang="ts">
type ProviderState = 'healthy' | 'delayed' | 'gapped' | 'untrusted' | 'unavailable'

const props = defineProps<{
  name: string
  state: ProviderState
}>()

const stateConfig: Record<
  ProviderState,
  { label: string; variant: 'bull' | 'warn' | 'bear' | 'default'; description: string }
> = {
  healthy: {
    label: 'Healthy',
    variant: 'bull',
    description: 'Feed is live and within expected latency.',
  },
  delayed: {
    label: 'Delayed',
    variant: 'warn',
    description: 'Data is arriving but behind real-time.',
  },
  gapped: {
    label: 'Gapped',
    variant: 'warn',
    description: 'Missing bars or sequence gaps detected.',
  },
  untrusted: {
    label: 'Untrusted',
    variant: 'bear',
    description: 'Feed failed validation checks.',
  },
  unavailable: {
    label: 'Unavailable',
    variant: 'default',
    description: 'Provider is offline or unreachable.',
  },
}

const config = computed(() => stateConfig[props.state])
</script>

<template>
  <div
    class="inline-flex items-center gap-2 rounded border border-border-hair bg-bg-raised px-2.5 py-1.5"
    :title="config.description"
  >
    <span class="font-mono text-xs text-text-secondary">{{ name }}</span>
    <UiBadge :label="config.label" :variant="config.variant" />
  </div>
</template>
