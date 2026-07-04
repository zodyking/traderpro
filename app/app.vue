<script setup lang="ts">
const { initTheme } = useTheme()

onMounted(() => {
  initTheme()
})

useHead({
  htmlAttrs: {
    class: 'dark',
  },
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
