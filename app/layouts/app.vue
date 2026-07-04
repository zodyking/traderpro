<script setup lang="ts">
useKeyboardShortcuts()
</script>

<template>
  <div class="min-h-dvh bg-bg-base">
    <WorkspaceNavRail class="hidden md:flex" />
    <WorkspaceCommandBar />
    <WorkspaceCommandPalette />
    <WorkspaceMobileTabBar />
    <main class="pt-command-bar pb-tab-bar md:ml-rail md:pb-0">
      <slot />
    </main>
  </div>
</template>
