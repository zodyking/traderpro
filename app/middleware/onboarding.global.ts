export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client) return
  if (!to.path.startsWith('/app')) return
  if (to.path === '/app/onboarding') return

  const completed = localStorage.getItem('ae_onboarded')
  if (!completed) {
    return navigateTo('/app/onboarding')
  }
})
