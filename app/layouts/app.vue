<script setup lang="ts">
useKeyboardShortcuts()
</script>

<template>
  <div class="min-h-dvh bg-bg-base">
    <WorkspaceNavRail />
    <WorkspaceCommandBar />
    <WorkspaceCommandPalette />
    <main class="ml-rail pt-command-bar">
      <slot />
    </main>
  </div>
</template>
