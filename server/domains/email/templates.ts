type EmailLayoutInput = {
  preheader: string
  title: string
  bodyHtml: string
  ctaLabel?: string
  ctaUrl?: string
  appName?: string
  tagline?: string
}

export function renderEmailLayout(input: EmailLayoutInput): string {
  const appName = input.appName ?? 'AxiomEdge'
  const tagline = input.tagline ?? 'Evidence over instinct.'
  const cta = input.ctaLabel && input.ctaUrl
    ? `<tr>
        <td style="padding:28px 32px 8px;">
          <a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:#14E0B8;color:#041018;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px;">
            ${escapeHtml(input.ctaLabel)}
          </a>
        </td>
      </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0A0E17;color:#E8EDF5;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0E17;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#151D2E;border:1px solid #232F48;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 12px;border-bottom:1px solid #232F48;">
                <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;font-weight:700;letter-spacing:0.2em;color:#E8EDF5;">${escapeHtml(appName)}</div>
                <div style="margin-top:6px;font-size:12px;color:#9AA6BF;">${escapeHtml(tagline)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px;">
                <h1 style="margin:0;font-size:22px;line-height:1.3;color:#FFFFFF;">${escapeHtml(input.title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 8px;font-size:15px;line-height:1.6;color:#C5D0E6;">
                ${input.bodyHtml}
              </td>
            </tr>
            ${cta}
            <tr>
              <td style="padding:24px 32px 28px;font-size:12px;line-height:1.5;color:#7D8AA5;">
                You are receiving this because of your ${escapeHtml(appName)} notification settings.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function renderWelcomeEmail(input: {
  displayName: string
  appUrl: string
  appName?: string
}) {
  return renderEmailLayout({
    appName: input.appName,
    preheader: 'Your AxiomEdge workspace is ready.',
    title: `Welcome, ${input.displayName}`,
    bodyHtml: `
      <p style="margin:0 0 16px;">Your account is live. Start with charts, strategy templates, and evidence-based reviews — no broker connection required.</p>
      <p style="margin:0;">Open your workspace to finish onboarding and load your first watchlist.</p>
    `,
    ctaLabel: 'Open workspace',
    ctaUrl: `${input.appUrl}/app`,
  })
}

export function renderLoginEmail(input: {
  displayName: string
  ip?: string | null
  time: string
  appUrl: string
  appName?: string
}) {
  const locationLine = input.ip
    ? `<p style="margin:0 0 12px;"><strong>IP address:</strong> ${escapeHtml(input.ip)}</p>`
    : ''

  return renderEmailLayout({
    appName: input.appName,
    preheader: 'New sign-in to your AxiomEdge account.',
    title: 'New sign-in detected',
    bodyHtml: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(input.displayName)}, we noticed a new sign-in to your account.</p>
      <p style="margin:0 0 12px;"><strong>Time:</strong> ${escapeHtml(input.time)}</p>
      ${locationLine}
      <p style="margin:0;">If this was not you, change your password and enable MFA in settings immediately.</p>
    `,
    ctaLabel: 'Review security settings',
    ctaUrl: `${input.appUrl}/app/settings`,
  })
}

export function renderAlertEmail(input: {
  displayName: string
  symbolLabel: string
  firedAt: string
  appUrl: string
  appName?: string
}) {
  return renderEmailLayout({
    appName: input.appName,
    preheader: `Alert triggered for ${input.symbolLabel}.`,
    title: 'Market alert triggered',
    bodyHtml: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(input.displayName)}, one of your alerts just fired.</p>
      <p style="margin:0 0 12px;"><strong>Symbol:</strong> ${escapeHtml(input.symbolLabel)}</p>
      <p style="margin:0 0 12px;"><strong>Time:</strong> ${escapeHtml(input.firedAt)}</p>
      <p style="margin:0;">Open the chart workspace to review the setup in context.</p>
    `,
    ctaLabel: 'Open charts',
    ctaUrl: `${input.appUrl}/app/chart`,
  })
}

export function renderBacktestEmail(input: {
  displayName: string
  runLabel: string
  tradeCount: number
  appUrl: string
  runId: string
  appName?: string
}) {
  return renderEmailLayout({
    appName: input.appName,
    preheader: `Backtest ${input.runLabel} finished.`,
    title: 'Backtest complete',
    bodyHtml: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(input.displayName)}, your backtest has finished running.</p>
      <p style="margin:0 0 12px;"><strong>Run:</strong> ${escapeHtml(input.runLabel)}</p>
      <p style="margin:0 0 12px;"><strong>Trades:</strong> ${input.tradeCount}</p>
      <p style="margin:0;">Review metrics, equity curve, and trade list in Backtest Lab.</p>
    `,
    ctaLabel: 'View results',
    ctaUrl: `${input.appUrl}/app/backtest?run=${encodeURIComponent(input.runId)}`,
  })
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}
