declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    displayName: string
    experience: 'novice' | 'developing' | 'advanced' | 'system'
    uiMode: 'novice' | 'pro'
  }
}

export {}
