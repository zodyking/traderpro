import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

type SmtpConfig = {
  host: string
  port: number
  user: string
  password: string
  from: string
  secure: boolean
}

let transporter: Transporter | null | undefined

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim()
  if (!host) return null

  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER?.trim() ?? ''
  const password = process.env.SMTP_PASSWORD ?? ''
  const from = process.env.SMTP_FROM?.trim() || 'AxiomEdge <noreply@axiomedge.app>'
  const secure = process.env.SMTP_SECURE === '1' || port === 465

  return { host, port, user, password, from, secure }
}

export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null
}

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter

  const config = getSmtpConfig()
  if (!config) {
    transporter = null
    return transporter
  }

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user
      ? {
          user: config.user,
          pass: config.password,
        }
      : undefined,
  })

  return transporter
}

export async function sendRawEmail(input: {
  to: string
  subject: string
  html: string
  text?: string
}): Promise<boolean> {
  const config = getSmtpConfig()
  const mailer = getTransporter()

  if (!config || !mailer) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[email] SMTP not configured; skipped send to', input.to)
    }
    return false
  }

  await mailer.sendMail({
    from: config.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  })

  return true
}

export function resetEmailTransporterForTests() {
  transporter = undefined
}
