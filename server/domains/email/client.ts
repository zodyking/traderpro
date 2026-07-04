import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { getSmtpStatus, isSmtpConfigured, resolveFromAddress } from './config'

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
  if (!isSmtpConfigured()) return null

  const host = process.env.SMTP_HOST!.trim()
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER?.trim() ?? ''
  const password = process.env.SMTP_PASSWORD ?? ''
  const from = resolveFromAddress()!
  const secure = process.env.SMTP_SECURE === '1' || port === 465

  return { host, port, user, password, from, secure }
}

export { isSmtpConfigured, getSmtpStatus, resolveFromAddress, resolveFromEmail } from './config'

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
      const status = getSmtpStatus()
      if (!status.hostConfigured) {
        console.warn('[email] SMTP_HOST not configured; skipped send to', input.to)
      }
      else if (!status.fromConfigured) {
        console.warn('[email] SMTP from address not configured; set SMTP_FROM_EMAIL; skipped send to', input.to)
      }
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
