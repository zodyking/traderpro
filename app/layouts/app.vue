<template>
  <div class="min-h-dvh bg-bg-base">
    <WorkspaceNavRail />
    <WorkspaceCommandBar />
    <main class="ml-rail pt-command-bar">
      <div class="p-4">
        <slot />
      </div>
    </main>
  </div>
</template>
