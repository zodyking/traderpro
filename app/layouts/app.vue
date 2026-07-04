<template>
  <div class="min-h-dvh bg-bg-base">
    <WorkspaceNavRail />
    <WorkspaceCommandBar />
    <main class="ml-rail pt-command-bar">
      <slot />
    </main>
  </div>
</template>
