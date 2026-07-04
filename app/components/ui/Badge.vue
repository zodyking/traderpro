<script setup lang="ts">
type BadgeVariant = 'default' | 'bull' | 'bear' | 'warn' | 'info' | 'accent'

const props = withDefaults(
  defineProps<{
    label: string
    variant?: BadgeVariant
    dot?: boolean
  }>(),
  {
    variant: 'default',
    dot: true,
  },
)

const variantClasses: Record<BadgeVariant, { container: string; dot: string }> = {
  default: {
    container: 'bg-bg-raised text-text-secondary border-border-hair',
    dot: 'bg-text-muted',
  },
  bull: {
    container: 'bg-bull/10 text-bull border-bull/20',
    dot: 'bg-bull',
  },
  bear: {
    container: 'bg-bear/10 text-bear border-bear/20',
    dot: 'bg-bear',
  },
  warn: {
    container: 'bg-warn/10 text-warn border-warn/20',
    dot: 'bg-warn',
  },
  info: {
    container: 'bg-info/10 text-info border-info/20',
    dot: 'bg-info',
  },
  accent: {
    container: 'bg-accent/10 text-accent border-accent/20',
    dot: 'bg-accent',
  },
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-2xs font-medium tracking-wide uppercase"
    :class="variantClasses[props.variant].container"
  >
    <span
      v-if="props.dot"
      class="size-1.5 shrink-0 rounded-full"
      :class="variantClasses[props.variant].dot"
      aria-hidden="true"
    />
    {{ props.label }}
  </span>
</template>
