export default defineNuxtRouteMiddleware(async () => {
  const { loggedIn, session } = useUserSession()

  if (loggedIn.value) {
    return navigateTo('/app')
  }

  if (!session.value?.mfaPending) {
    return navigateTo('/login')
  }
})
