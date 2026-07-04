<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: string
    height?: string
    rounded?: boolean
  }>(),
  {
    width: '100%',
    height: '1rem',
    rounded: true,
  },
)
</script>

<template>
  <div
    class="shimmer"
    :class="rounded ? 'rounded-md' : ''"
    :style="{ width, height }"
    aria-hidden="true"
  />
</template>
