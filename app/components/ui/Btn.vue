<script setup lang="ts">
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
type BtnSize = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: BtnVariant
    size?: BtnSize
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    loading?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    disabled: false,
    loading: false,
  },
)

const variantClasses: Record<BtnVariant, string> = {
  primary:
    'bg-accent text-bg-base border border-accent hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-40 disabled:hover:bg-accent disabled:active:bg-accent',
  secondary:
    'bg-bg-raised text-text-primary border border-border-strong hover:bg-bg-overlay active:bg-bg-surface disabled:opacity-40',
  ghost:
    'bg-transparent text-text-secondary border border-transparent hover:bg-bg-raised hover:text-text-primary active:bg-bg-overlay disabled:opacity-40',
  destructive:
    'bg-bear/10 text-bear border border-bear/30 hover:bg-bear/20 active:bg-bear/30 disabled:opacity-40',
}

const sizeClasses: Record<BtnSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-8 px-3 text-sm gap-2',
  lg: 'h-10 px-4 text-md gap-2',
}
</script>

<template>
  <button
    :type="props.type"
    :disabled="props.disabled || props.loading"
    class="inline-flex items-center justify-center rounded-md font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base disabled:cursor-not-allowed"
    :class="[variantClasses[props.variant], sizeClasses[props.size]]"
  >
    <svg
      v-if="props.loading"
      class="size-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="3"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
    <slot />
  </button>
</template>
