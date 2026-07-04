const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value)
}

function parseFromHeader(value: string): { name: string, email: string } | null {
  const bracketMatch = value.match(/^(.+?)\s*<([^>]+)>$/)
  if (bracketMatch) {
    const email = bracketMatch[2]!.trim()
    if (!isValidEmail(email)) return null
    return { name: bracketMatch[1]!.trim(), email }
  }

  if (isValidEmail(value)) {
    return { name: 'AxiomEdge', email: value }
  }

  return null
}

export function deriveDefaultFromEmail(): string {
  const appUrl = process.env.NUXT_PUBLIC_APP_URL?.trim()
  if (appUrl) {
    try {
      const { hostname } = new URL(appUrl)
      if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return `noreply@${hostname}`
      }
    }
    catch {
      // ignore invalid URL
    }
  }

  return 'noreply@localhost.localdomain'
}

export function resolveFromAddress(): string | null {
  const full = process.env.SMTP_FROM?.trim()
  if (full) {
    const parsed = parseFromHeader(full)
    if (parsed) {
      return `${parsed.name} <${parsed.email}>`
    }
  }

  const email = process.env.SMTP_FROM_EMAIL?.trim() || deriveDefaultFromEmail()
  if (!isValidEmail(email)) {
    return null
  }

  const name = process.env.SMTP_FROM_NAME?.trim() || 'AxiomEdge'
  return `${name} <${email}>`
}

export function resolveFromEmail(): string | null {
  const from = resolveFromAddress()
  if (!from) return null
  return parseFromHeader(from)?.email ?? null
}

export function isSmtpConfigured(): boolean {
  const host = process.env.SMTP_HOST?.trim()
  if (!host) return false
  return resolveFromAddress() !== null
}

export function getSmtpStatus() {
  const host = Boolean(process.env.SMTP_HOST?.trim())
  const fromAddress = resolveFromAddress()
  const fromEmail = resolveFromEmail()

  return {
    hostConfigured: host,
    fromConfigured: fromAddress !== null,
    configured: host && fromAddress !== null,
    fromAddress,
    fromEmail,
    fromEmailSource: process.env.SMTP_FROM_EMAIL?.trim()
      ? 'SMTP_FROM_EMAIL'
      : process.env.SMTP_FROM?.trim()
        ? 'SMTP_FROM'
        : 'derived',
  }
}
