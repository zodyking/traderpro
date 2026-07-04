declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    displayName: string
    experience: 'novice' | 'developing' | 'advanced' | 'system'
    uiMode: 'novice' | 'pro'
  }

  interface UserSession {
    mfaPending?: boolean
    pendingUserId?: string
    alpacaOAuthState?: string
    alpacaOAuthUserId?: string
  }
}

export {}
